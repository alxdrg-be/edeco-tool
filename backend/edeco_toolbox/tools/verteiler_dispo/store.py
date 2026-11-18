"""Local, revisioned distribution documents; never place this database on SMB."""

from __future__ import annotations

from contextlib import closing, contextmanager
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sqlite3

from pydantic import ValidationError

from .models import DistributionDocument


class Conflict(ValueError):
    """The edited base revision is no longer current."""


class CorruptDocument(ValueError):
    """A stored document cannot be read without changing existing data."""


def _json(document: DistributionDocument) -> str:
    return json.dumps(document.model_dump(mode="json"), ensure_ascii=False,
                      sort_keys=True, separators=(",", ":"), allow_nan=False)


def _digest(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


class DistributionStore:
    def __init__(self, home: Path):
        home.mkdir(parents=True, exist_ok=True)
        self.path = home / "dispositions.sqlite3"
        with closing(sqlite3.connect(self.path, timeout=10)) as db:
            version = db.execute("PRAGMA user_version").fetchone()[0]
            if version not in (0, 1):
                raise CorruptDocument("Die Verteilerablage hat eine neuere Dateiversion. Die vorhandene Datei wurde nicht verändert.")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, name TEXT NOT NULL, project_number TEXT NOT NULL,
                    revision INTEGER NOT NULL CHECK(revision > 0), updated_at TEXT NOT NULL,
                    data TEXT NOT NULL, sha256 TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS revisions (
                    document_id TEXT NOT NULL, revision INTEGER NOT NULL,
                    created_at TEXT NOT NULL, data TEXT NOT NULL, sha256 TEXT NOT NULL,
                    PRIMARY KEY(document_id, revision),
                    FOREIGN KEY(document_id) REFERENCES documents(id)
                );
                PRAGMA user_version=1;
            """)

    @contextmanager
    def connection(self, *, write: bool = False):
        with closing(sqlite3.connect(self.path, timeout=10)) as db:
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys=ON")
            with db:
                db.execute("BEGIN IMMEDIATE" if write else "BEGIN")
                yield db

    @staticmethod
    def _decode(row) -> dict:
        if row is None:
            raise KeyError("Verteiler nicht gefunden.")
        try:
            if _digest(row["data"]) != row["sha256"]:
                raise ValueError("Prüfsumme")
            document = DistributionDocument.model_validate_json(row["data"])
            if document.revision != row["revision"]:
                raise ValueError("Revision")
        except (ValidationError, ValueError, TypeError) as error:
            raise CorruptDocument("Der gespeicherte Verteiler konnte nicht gelesen werden. Die vorhandenen Daten wurden nicht verändert.") from error
        return {"document": document.model_dump(mode="json"), "revision": row["revision"],
                "updated_at": row["updated_at"]}

    def list(self) -> list[dict]:
        with self.connection() as db:
            return [dict(row) for row in db.execute(
                "SELECT id,name,project_number,revision,updated_at FROM documents ORDER BY updated_at DESC,id LIMIT 1000")]

    def get(self, document_id: str) -> dict:
        with self.connection() as db:
            return self._decode(db.execute("SELECT * FROM documents WHERE id=?", (document_id,)).fetchone())

    def save(self, document: DistributionDocument, base_revision: int) -> dict:
        if type(base_revision) is not int or base_revision < 0 or document.revision != base_revision:
            raise Conflict("Die Basisrevision passt nicht zum Entwurf. Bitte den aktuellen Stand laden; deine Eingaben bleiben erhalten.")
        now = datetime.now(timezone.utc).isoformat()
        with self.connection(write=True) as db:
            previous = db.execute("SELECT revision FROM documents WHERE id=?", (document.id,)).fetchone()
            current = previous["revision"] if previous is not None else 0
            if current != base_revision:
                raise Conflict("Der Verteiler wurde inzwischen geändert. Bitte den aktuellen Stand laden; deine Eingaben bleiben erhalten.")
            # The server assigns the revision; a client cannot skip or replace history.
            saved = document.model_copy(update={"revision": current + 1})
            data = _json(saved)
            digest = _digest(data)
            db.execute("""INSERT INTO documents VALUES (?,?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET name=excluded.name,project_number=excluded.project_number,
                    revision=excluded.revision,updated_at=excluded.updated_at,data=excluded.data,sha256=excluded.sha256""",
                       (saved.id, saved.name, saved.project_number, saved.revision, now, data, digest))
            db.execute("INSERT INTO revisions VALUES (?,?,?,?,?)", (saved.id, saved.revision, now, data, digest))
            return {"document": saved.model_dump(mode="json"), "revision": saved.revision, "updated_at": now}

    def history(self, document_id: str) -> list[dict]:
        with self.connection() as db:
            if db.execute("SELECT 1 FROM documents WHERE id=?", (document_id,)).fetchone() is None:
                raise KeyError("Verteiler nicht gefunden.")
            return [dict(row) for row in db.execute(
                "SELECT revision,created_at,sha256 FROM revisions WHERE document_id=? ORDER BY revision DESC LIMIT 1000",
                (document_id,))]

    def revision(self, document_id: str, revision: int) -> dict:
        with self.connection() as db:
            return self._decode(db.execute(
                "SELECT revision,created_at AS updated_at,data,sha256 FROM revisions WHERE document_id=? AND revision=?",
                (document_id, revision)).fetchone())
