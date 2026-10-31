"""Persistent local sources. Source IDs and quotations always come from this DB."""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from .extract import extract, preview

STOPWORDS = set("aber alle als also auch auf aus bei bitte das dass dem den der des die diese dieses doch durch ein eine einem einen einer eines es für hat haben ich im in ist kann können man mit muss nach nicht oder sein sind so soll sollen und vom von vor wann warum was welche welcher welches wenn wer wie wird wo zu zum zur über".split())


class DocumentStore:
    def __init__(self, home: Path):
        self.home = home
        self.originals = home / "originals"
        self.originals.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        with self.db() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, title TEXT NOT NULL, filename TEXT NOT NULL,
                    edition TEXT NOT NULL, digest TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
                    pages INTEGER NOT NULL, empty_pages INTEGER NOT NULL, created_at TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS pages (
                    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    number INTEGER NOT NULL, label TEXT NOT NULL, lines TEXT NOT NULL,
                    PRIMARY KEY(document_id, number));
                CREATE TABLE IF NOT EXISTS chunks (
                    id INTEGER PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                    page INTEGER NOT NULL, start_line INTEGER NOT NULL, end_line INTEGER NOT NULL, text TEXT NOT NULL);
                CREATE VIRTUAL TABLE IF NOT EXISTS chunk_search USING fts5(text, content='chunks', content_rowid='id');
                CREATE TRIGGER IF NOT EXISTS chunk_insert AFTER INSERT ON chunks BEGIN
                    INSERT INTO chunk_search(rowid, text) VALUES (new.id, new.text); END;
                CREATE TRIGGER IF NOT EXISTS chunk_delete AFTER DELETE ON chunks BEGIN
                    INSERT INTO chunk_search(chunk_search, rowid, text) VALUES ('delete', old.id, old.text); END;
            """)

    @contextmanager
    def db(self):
        with self.lock:
            db = sqlite3.connect(self.home / "library.sqlite", timeout=20)
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA foreign_keys=ON")
            try:
                with db:
                    yield db
            finally:
                db.close()

    def list(self):
        with self.db() as db:
            return [dict(row) for row in db.execute("SELECT * FROM documents ORDER BY created_at DESC, title")]

    def get(self, document_id: str):
        with self.db() as db:
            row = db.execute("SELECT * FROM documents WHERE id=?", (document_id,)).fetchone()
        if not row:
            raise KeyError(document_id)
        return dict(row)

    def path(self, document_id: str):
        doc = self.get(document_id)
        return self.originals / f"{doc['id']}.{doc['kind']}"

    def add(self, data: bytes, filename: str, title: str = "", edition: str = ""):
        filename = Path(filename.replace("\\", "/")).name[:180]
        kind = Path(filename).suffix.lower().lstrip(".")
        if kind not in {"pdf", "txt", "md"}:
            raise ValueError("Unterstützt werden PDF und UTF-8-Textdateien (.txt, .md).")
        digest = hashlib.sha256(data).hexdigest()
        with self.db() as db:
            row = db.execute("SELECT * FROM documents WHERE digest=?", (digest,)).fetchone()
            if row:
                return {"document": dict(row), "duplicate": True}
        pages = extract(data, kind)
        identifier = uuid.uuid4().hex
        doc = dict(id=identifier, title=(title.strip() or Path(filename).stem)[:180], filename=filename,
                   edition=edition.strip()[:160], digest=digest, kind=kind, pages=len(pages),
                   empty_pages=sum(not any(line["text"].strip() for line in page["lines"]) for page in pages),
                   created_at=datetime.now(timezone.utc).isoformat())
        target = self.originals / f"{identifier}.{kind}"
        target.write_bytes(data)
        try:
            with self.db() as db:
                existing = db.execute("SELECT * FROM documents WHERE digest=?", (digest,)).fetchone()
                if existing:
                    target.unlink(missing_ok=True)
                    return {"document": dict(existing), "duplicate": True}
                db.execute("INSERT INTO documents VALUES (:id,:title,:filename,:edition,:digest,:kind,:pages,:empty_pages,:created_at)", doc)
                for page in pages:
                    db.execute("INSERT INTO pages VALUES (?,?,?,?)", (identifier, page["number"], page["label"], json.dumps(page["lines"], ensure_ascii=False)))
                    lines = page["lines"]
                    for start in range(0, len(lines), 4):
                        group = lines[start:start + 6]
                        text = "\n".join(line["text"] for line in group)
                        if text.strip():
                            db.execute("INSERT INTO chunks(document_id,page,start_line,end_line,text) VALUES (?,?,?,?,?)",
                                       (identifier, page["number"], group[0]["number"], group[-1]["number"], text))
        except Exception:
            target.unlink(missing_ok=True)
            raise
        return {"document": doc, "duplicate": False}

    def remove(self, document_id: str):
        with self.lock:
            path = self.path(document_id)
            with self.db() as db:
                path.unlink(missing_ok=True)
                db.execute("DELETE FROM documents WHERE id=?", (document_id,))

    def page(self, document_id: str, number: int):
        with self.lock:
            doc = self.get(document_id)
            with self.db() as db:
                row = db.execute("SELECT * FROM pages WHERE document_id=? AND number=?", (document_id, number)).fetchone()
            if not row:
                raise KeyError(number)
            lines = json.loads(row["lines"])
            image = preview(self.path(document_id), number, lines) if doc["kind"] == "pdf" else None
            return {"document": doc, "number": number, "label": row["label"], "lines": lines, "image": image}

    def search(self, question: str, document_ids: list[str], limit: int = 6):
        tokens = list(dict.fromkeys(word.lower() for word in re.findall(r"[\wäöüÄÖÜß]+", question)
                                   if len(word) >= 2 and word.lower() not in STOPWORDS))[:24]
        if not tokens or not document_ids:
            return []
        query = " OR ".join('"' + token + '"' + ("*" if len(token) >= 4 else "") for token in tokens)
        placeholders = ",".join("?" for _ in document_ids)
        with self.db() as db:
            rows = db.execute(f"""SELECT c.*, d.title, d.filename, d.edition, d.kind, p.label, bm25(chunk_search) AS rank
                FROM chunk_search JOIN chunks c ON c.id=chunk_search.rowid
                JOIN documents d ON d.id=c.document_id JOIN pages p ON p.document_id=c.document_id AND p.number=c.page
                WHERE chunk_search MATCH ? AND c.document_id IN ({placeholders}) ORDER BY rank LIMIT 36""", [query, *document_ids]).fetchall()
        sources = []
        for row in rows:
            if any(source["document_id"] == row["document_id"] and source["page"] == row["page"]
                   and source["start_line"] <= row["end_line"] and source["end_line"] >= row["start_line"] for source in sources):
                continue
            source = {key: row[key] for key in ("document_id", "page", "start_line", "end_line", "title", "filename", "edition", "kind", "label", "text")}
            source["id"] = f"S{len(sources) + 1}"
            sources.append(source)
            if len(sources) == limit:
                break
        return sources
