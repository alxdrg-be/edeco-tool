"""Zwei Stände einer Nova-Objektliste vergleichen: neu, entfernt, geändert, Zuordnung prüfen."""

from collections import defaultdict
from dataclasses import asdict, dataclass, field
import math
from urllib.parse import unquote

from .model import BuildingModel, Element

# Fields that change in bulk between stages without touching the planning content.
STATUS_FIELDS = ("Baustatus",)
NEW, REMOVED, CHANGED, CHECK = "neu", "entfernt", "geändert", "Zuordnung prüfen"


@dataclass
class Change:
    field: str
    old: object
    new: object


@dataclass
class Row:
    key: str
    status: str
    element_id: str
    nova_class: str
    name: str
    storey: str
    room: str
    part_of: str
    changes: list[Change] = field(default_factory=list)
    # True when every changed field is a stage status like «Baustatus».
    status_only: bool = False
    old_key: str = ""


def _objects(model: BuildingModel) -> dict[str, Element]:
    # Element ids carry the Nova index URL-quoted; show and match the original text.
    return {unquote(item.id.removeprefix("nova-object:")): item for item in model.elements if "NovaBauteil" in item.classes}


def _rooms(model: BuildingModel) -> dict[str, Element]:
    return {item.id: item for item in model.elements if item.ifc_class == "NovaRaumbezug"}


def _plain(value):
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return value


def _same(old, new) -> bool:
    old, new = _plain(old), _plain(new)
    if old == new:
        return True
    numbers = (int, float)
    if isinstance(old, numbers) and isinstance(new, numbers) and not isinstance(old, bool) and not isinstance(new, bool):
        return math.isclose(old, new, rel_tol=1e-9, abs_tol=1e-9)
    return False


def _changes(old: Element, new: Element) -> list[Change]:
    names = list(dict.fromkeys([*new.attributes, *old.attributes]))
    return [Change(name, _plain(old.attributes.get(name)), _plain(new.attributes.get(name)))
            for name in names if not _same(old.attributes.get(name), new.attributes.get(name))]


def _room_label(item: Element, rooms: dict[str, Element]) -> str:
    for room_id in item.room_ids:
        room = rooms.get(room_id)
        if room:
            return room.number
    return ""


def _row(key, status, item: Element, rooms, changes=(), status_fields=STATUS_FIELDS, old_key="") -> Row:
    changes = list(changes)
    return Row(
        key=key, status=status, element_id=item.id if status != REMOVED else "",
        nova_class=item.ifc_class, name=item.name, storey=item.storey, room=_room_label(item, rooms),
        part_of=str(item.attributes.get("Bestandteil von") or ""), changes=changes,
        status_only=bool(changes) and all(change.field in status_fields for change in changes), old_key=old_key,
    )


def _signature(item: Element, rooms) -> tuple:
    return item.ifc_class, item.storey, _room_label(item, rooms), item.name


def compare(old: BuildingModel, new: BuildingModel, status_fields=STATUS_FIELDS) -> dict:
    """The key is the Nova «Index». Without a shared key, a unique match on class, storey,
    room and name is only a suggestion: two equal sockets in one room are easily swapped."""
    old_objects, new_objects = _objects(old), _objects(new)
    old_rooms, new_rooms = _rooms(old), _rooms(new)
    rows: list[Row] = []
    for key, item in new_objects.items():
        previous = old_objects.get(key)
        if previous is not None:
            changes = _changes(previous, item)
            if changes:
                rows.append(_row(key, CHANGED, item, new_rooms, changes, status_fields))

    added = [key for key in new_objects if key not in old_objects]
    removed = [key for key in old_objects if key not in new_objects]
    by_signature = defaultdict(lambda: ([], []))
    for key in added:
        by_signature[_signature(new_objects[key], new_rooms)][0].append(key)
    for key in removed:
        by_signature[_signature(old_objects[key], old_rooms)][1].append(key)
    for new_keys, old_keys in by_signature.values():
        if len(new_keys) == 1 and len(old_keys) == 1:
            item, previous = new_objects[new_keys[0]], old_objects[old_keys[0]]
            rows.append(_row(new_keys[0], CHECK, item, new_rooms, _changes(previous, item), status_fields, old_keys[0]))
            continue
        rows.extend(_row(key, NEW, new_objects[key], new_rooms) for key in new_keys)
        rows.extend(_row(key, REMOVED, old_objects[key], old_rooms) for key in old_keys)

    order = {CHECK: 0, NEW: 1, REMOVED: 2, CHANGED: 3}
    rows.sort(key=lambda row: (order[row.status], row.status_only, not row.storey, row.storey.casefold(), not row.room, row.room, row.name.casefold(), row.key))
    quality = [
        {"storey": room.storey, "room": room.number, "names": room.attributes["Abweichende Raumbezeichnungen"]}
        for room in new_rooms.values() if room.attributes.get("Abweichende Raumbezeichnungen")
    ]
    counts = {status: sum(row.status == status for row in rows) for status in (NEW, REMOVED, CHANGED, CHECK)}
    counts["nur Status"] = sum(row.status == CHANGED and row.status_only for row in rows)
    return {
        "rows": [asdict(row) for row in rows], "counts": counts, "quality": quality,
        "status_fields": list(status_fields),
        "objects": {"alt": len(old_objects), "neu": len(new_objects)},
    }


def _text(value) -> str:
    return "" if value is None else str(value)


def compare_xlsx(result: dict, old_name: str, new_name: str) -> bytes:
    """Vollständiger Vergleich, unabhängig von den Filtern in der Oberfläche."""
    from io import BytesIO
    from openpyxl import Workbook
    from .workbook import _row, _table

    book = Workbook(write_only=True)
    summary = book.create_sheet("Übersicht")
    _table(summary, ["Angabe", "Wert"], [42, 60])
    counts = result["counts"]
    for label, value in (
        ("Älterer Stand", old_name), ("Aktueller Stand", new_name),
        ("Objekte im älteren Stand", result["objects"]["alt"]), ("Objekte im aktuellen Stand", result["objects"]["neu"]),
        ("Neu", counts[NEW]), ("Entfernt", counts[REMOVED]), ("Geändert", counts[CHANGED]),
        ("davon nur " + ", ".join(result["status_fields"]), counts["nur Status"]),
        ("Zuordnung prüfen", counts[CHECK]), ("Raumbezüge mit mehreren Namen", len(result["quality"])),
    ):
        _row(summary, [label, value])
    changes = book.create_sheet("Änderungen")
    _table(changes, ["Status", "Nova-Index", "Index älterer Stand", "Klasse", "Bezeichnung", "Geschoss", "Raum",
                     "Bestandteil von", "Nur Status", "Feld", "Alt", "Neu"],
           [18, 26, 26, 22, 28, 12, 14, 22, 11, 26, 30, 30])
    for row in result["rows"]:
        base = [row["status"], row["key"], row["old_key"], row["nova_class"], row["name"], row["storey"], row["room"],
                row["part_of"], "ja" if row["status_only"] else ""]
        if not row["changes"]:
            _row(changes, [*base, "", "", ""])
        for change in row["changes"]:
            _row(changes, [*base, change["field"], _text(change["old"]), _text(change["new"])])
    quality = book.create_sheet("Datenqualität")
    _table(quality, ["Geschoss", "Raumnummer", "Bezeichnungen im aktuellen Stand"], [14, 16, 80])
    for entry in result["quality"]:
        _row(quality, [entry["storey"], entry["room"], " | ".join(entry["names"])])
    output = BytesIO()
    book.save(output)
    return output.getvalue()
