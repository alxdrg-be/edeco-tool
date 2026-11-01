"""Persistent project identities shared by Toolbox modules, independent of Nova."""

import json
import sqlite3
import uuid
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path


class Conflict(ValueError):
    pass


class ProjectStore:
    def __init__(self, home: Path):
        home.mkdir(parents=True, exist_ok=True)
        self.path = home / "projects.sqlite3"
        with self.connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY, number_key TEXT NOT NULL UNIQUE,
                    data TEXT NOT NULL, version INTEGER NOT NULL,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS selection (
                    singleton INTEGER PRIMARY KEY CHECK(singleton=1), project_id TEXT
                );
                INSERT OR IGNORE INTO selection VALUES (1, NULL);
                CREATE TABLE IF NOT EXISTS deliveries (
                    id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
                    fingerprint TEXT NOT NULL, data TEXT NOT NULL,
                    created_at TEXT NOT NULL, sent_at TEXT
                );
                PRAGMA user_version=1;
            """)

    @contextmanager
    def connection(self, write=False):
        with closing(sqlite3.connect(self.path, timeout=10)) as db:
            db.row_factory = sqlite3.Row
            with db:
                db.execute("BEGIN IMMEDIATE" if write else "BEGIN")
                yield db

    @staticmethod
    def decode(row):
        if row is None:
            raise KeyError("Projekt nicht gefunden.")
        return {**json.loads(row["data"]), **{key: row[key] for key in ("id", "version", "created_at", "updated_at")}}

    def snapshot(self):
        with self.connection() as db:
            projects = [self.decode(row) for row in db.execute("SELECT * FROM projects ORDER BY updated_at DESC, id")]
            selected = db.execute("SELECT project_id FROM selection WHERE singleton=1").fetchone()[0]
            deliveries = [json.loads(row[0]) | {"sent_at": row[1]} for row in db.execute(
                "SELECT data, sent_at FROM deliveries ORDER BY created_at DESC LIMIT 200")]
        return {"projects": projects, "active_id": selected, "deliveries": deliveries}

    def record_delivery(self, summary, fingerprint, project_version):
        with self.connection(write=True) as db:
            existing = db.execute("SELECT fingerprint, data FROM deliveries WHERE id=?", (summary["id"],)).fetchone()
            if existing:
                if existing["fingerprint"] != fingerprint:
                    raise Conflict("Diese Lieferung wurde bereits mit anderem Inhalt vorbereitet. Bitte eine neue Lieferung erstellen.")
                return json.loads(existing["data"])
            project = self.decode(db.execute("SELECT * FROM projects WHERE id=?", (summary["project_id"],)).fetchone())
            if project["archived"] or project["version"] != project_version:
                raise Conflict("Projektdaten wurden geändert oder archiviert. Bitte das Projekt erneut auswählen und die Angaben prüfen.")
            summary = {**summary, "project_number": project["number"], "project_name": project["name"],
                       "created_at": datetime.now(timezone.utc).isoformat()}
            db.execute("INSERT INTO deliveries VALUES (?, ?, ?, ?, ?, NULL)",
                       (summary["id"], project["id"], fingerprint, json.dumps(summary, ensure_ascii=False), summary["created_at"]))
            return summary

    def mark_delivery_sent(self, delivery_id):
        with self.connection(write=True) as db:
            if not db.execute("SELECT 1 FROM deliveries WHERE id=?", (delivery_id,)).fetchone():
                raise KeyError(delivery_id)
            db.execute("UPDATE deliveries SET sent_at=COALESCE(sent_at, ?) WHERE id=?",
                       (datetime.now(timezone.utc).isoformat(), delivery_id))

    def get(self, project_id):
        with self.connection() as db:
            return self.decode(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())

    def save(self, data, project_id=None, version=0):
        now = datetime.now(timezone.utc).isoformat()
        number_key = data["number"].casefold()
        try:
            with self.connection(write=True) as db:
                if project_id:
                    previous = self.decode(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
                    if previous["version"] != version:
                        raise Conflict("Das Projekt wurde inzwischen geändert. Bitte neu laden; deine Eingaben bleiben bis dahin sichtbar.")
                    # References retain their original creation date across edits.
                    old_dates = {item["id"]: item["added_at"] for item in previous["documents"]}
                    for item in data["documents"]:
                        item["added_at"] = old_dates.get(item["id"], now)
                    db.execute("UPDATE projects SET number_key=?, data=?, version=version+1, updated_at=? WHERE id=?",
                               (number_key, json.dumps(data, ensure_ascii=False), now, project_id))
                else:
                    project_id = str(uuid.uuid4())
                    for item in data["documents"]:
                        item["added_at"] = now
                    db.execute("INSERT INTO projects VALUES (?, ?, ?, 1, ?, ?)",
                               (project_id, number_key, json.dumps(data, ensure_ascii=False), now, now))
                    if not data["archived"]:
                        db.execute("UPDATE selection SET project_id=? WHERE singleton=1", (project_id,))
                if data["archived"]:
                    db.execute("UPDATE selection SET project_id=NULL WHERE project_id=?", (project_id,))
                result = self.decode(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
            return result
        except sqlite3.IntegrityError:
            raise Conflict("Diese Projektnummer ist bereits vergeben, eventuell im Archiv.") from None

    def select(self, project_id):
        with self.connection(write=True) as db:
            if project_id:
                project = self.decode(db.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone())
                if project["archived"]:
                    raise Conflict("Archivierte Projekte können nicht aktiv ausgewählt werden.")
            db.execute("UPDATE selection SET project_id=? WHERE singleton=1", (project_id,))
