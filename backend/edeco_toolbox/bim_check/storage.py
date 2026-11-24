"""Private, temporäre Modellablage. Grosse Eigenschaftslisten bleiben im Backend."""

import json
from collections import Counter
from contextlib import closing, contextmanager
from dataclasses import fields
from pathlib import Path
import sqlite3

from .model import BuildingModel, Element

MAX_OUTPUT_BYTES = 64 * 1024 * 1024


def encode(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


@contextmanager
def json_output(path: Path):
    """Begrenzt die erzeugte interaktive Ansicht bereits beim Schreiben im Worker."""
    with path.open("wb") as output:
        def write(text: str):
            block = text.encode("utf-8")
            if output.tell() + len(block) > MAX_OUTPUT_BYTES:
                raise ValueError("Die interaktive Ausgabe überschreitet 64 MiB. Bitte Teilmodell oder gezieltere Regeln verwenden.")
            output.write(block)
        yield write


def write_model(directory: Path, model: BuildingModel, model_id: str, filename: str, source: str) -> None:
    storeys = Counter()
    rooms = Counter()
    model_fields = {f.name: getattr(model, f.name) for f in fields(model) if f.name != "elements"}
    with closing(sqlite3.connect(directory / "model.sqlite")) as db:
        db.execute("CREATE TABLE model (metadata TEXT NOT NULL)")
        db.execute("INSERT INTO model VALUES (?)", (encode(model_fields),))
        db.execute("CREATE TABLE elements (id TEXT PRIMARY KEY, summary TEXT NOT NULL, properties TEXT NOT NULL)")
        with json_output(directory / "overview.json") as write:
            write('{"elements":[')
            for index, item in enumerate(model.elements):
                public = {key: value for key, value in vars(item).items() if key not in {"attributes", "psets", "classes"}}
                properties = {key: getattr(item, key) for key in ("attributes", "psets", "classes")}
                entry = encode(public)
                db.execute("INSERT INTO elements VALUES (?, ?, ?)", (item.id, entry, encode(properties)))
                if index:
                    write(",")
                write(entry)
                storeys[item.storey] += 1
                if item.ifc_class in {"IfcSpace", "NovaRaumbezug"} or "IfcSpace" in item.classes:
                    rooms[item.storey] += 1
            summary = {"elements": len(model.elements), "rooms": sum(rooms.values()), "storeys": [
                {"name": name, "elements": storeys[name], "rooms": rooms[name]}
                for name in sorted(storeys, key=lambda name: (not name, name.casefold()))
            ]}
            metadata = {"id": model_id, "source": source, "filename": filename, "warnings": model.warnings, "summary": summary}
            write("]," + encode(metadata)[1:])
        db.commit()


def element_detail(directory: Path, element_id: str) -> dict | None:
    with closing(sqlite3.connect(directory / "model.sqlite")) as db:
        row = db.execute("SELECT summary,properties FROM elements WHERE id = ?", (element_id,)).fetchone()
        if row is None:
            return None
        item = json.loads(row[0]) | json.loads(row[1])
        if "NovaBauteil" in item["classes"]:
            metadata = json.loads(db.execute("SELECT metadata FROM model").fetchone()[0])
            item["attributes"] = dict.fromkeys(metadata["declared_attributes"]) | item["attributes"]
        return item


def read_model(directory: Path) -> BuildingModel:
    with closing(sqlite3.connect(directory / "model.sqlite")) as db:
        metadata = json.loads(db.execute("SELECT metadata FROM model").fetchone()[0])
        elements = [
            Element(**(json.loads(summary) | json.loads(properties)))
            for summary, properties in db.execute("SELECT summary,properties FROM elements ORDER BY rowid")
        ]
    return BuildingModel(elements=elements, **metadata)
