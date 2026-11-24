"""Raumbezüge aus einer Nova-Objektliste, getrennt von echten IFC-Raumkörpern."""

from collections import defaultdict
from datetime import date, time, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
import re
from urllib.parse import quote

from .model import BuildingModel, Element
from .xlsx import open_xlsx


_MAX_COLUMNS = 512
_MAX_ROWS = 100_000
_EMPTY_REFERENCE = {"-", "leer", "nicht_definiert", "nicht definiert", "unbekannt", "n/a"}
_ALIASES = {
    "index": ("Index", "Objekt-ID", "GlobalId"),
    "class": ("Klasse", "Objektklasse", "NOVA-Klasse"),
    "floor": ("Geschoss", "Geschossname", "Stockwerk", "A_GeschossID"),
    "building": ("Gebäude", "Gebäudename"),
    "number": ("Raumnummer", "Raum-Nr.", "Raum Nr"),
    "room": ("Raum", "Raumname", "Raumbezeichnung"),
    "combined": ("A_RaumNr",),
    "name": ("Bezeichnung", "A_Name", "Name", "Bez"),
}


def _column_key(value: str) -> str:
    return "".join(char for char in value.casefold() if char.isalnum())


def _header(rows):
    for row_num, row in enumerate(rows, 1):
        fields = [str(cell.value).strip() if cell.value is not None else "" for cell in row]
        by_key = {_column_key(label): label for label in fields if label}
        columns = {
            role: [by_key[key] for alias in aliases if (key := _column_key(alias)) in by_key]
            for role, aliases in _ALIASES.items()
        }
        if columns["index"] and columns["class"] and (columns["number"] or columns["combined"]):
            named = [label for label in fields if label]
            if len(named) != len({_column_key(label) for label in named}):
                raise ValueError("Die NOVA-Objektliste enthält mehrfach verwendete Spaltentitel.")
            width = max(i for i, label in enumerate(fields, 1) if label)
            return row_num, fields[:width], columns
    return None


def _object_sheet(book):
    found = []
    for sheet in book:
        if sheet.sheet_state != "visible":
            continue
        header = _header(sheet.iter_rows(max_row=30, max_col=min(sheet.max_column or _MAX_COLUMNS, _MAX_COLUMNS)))
        if header:
            if (sheet.max_column or 0) > _MAX_COLUMNS:
                raise ValueError(f"Die NOVA-Objektliste überschreitet {_MAX_COLUMNS} Spalten.")
            found.append((sheet, *header))
    if not found:
        raise ValueError(
            "Keine NOVA-Objektliste erkannt. Benötigt werden Index oder GlobalId, Klasse "
            "und Raumnummer oder A_RaumNr. Eine Excel-Regeldatei bitte als BIM-Guide öffnen."
        )
    if len(found) > 1:
        raise ValueError("Mehrere NOVA-Objektlisten erkannt. Bitte das gewünschte Blatt separat importieren.")
    return found[0]


def _reference_text(value) -> str:
    text = "" if value is None else str(value).strip()
    return "" if text.casefold() in _EMPTY_REFERENCE else text


def _field(attributes, names) -> str:
    for name in names:
        text = _reference_text(attributes.get(name))
        if text:
            return text
    return ""


def _room_number(value, excel_format) -> str:
    """Textkennungen und einfache numerische Kennungsformate wie 000 oder 0.000 bewahren."""
    if type(value) in (float, int):
        if re.fullmatch(r"0+", excel_format) and value == int(value):
            return str(int(value)).zfill(len(excel_format))
        if re.fullmatch(r"0\.0+", excel_format):
            return f"{value:.{len(excel_format) - 2}f}"
    if value is None or isinstance(value, (date, time, timedelta, bool)):
        return ""
    return _reference_text(value)


def _number_matches(number: str, other: str) -> bool:
    # Excel often stores numeric identifiers without their trailing zeroes.
    if number == other:
        return True
    try:
        return Decimal(number) == Decimal(other)
    except InvalidOperation:
        return False


def _excel_value(cell):
    value = cell.value
    if isinstance(value, (date, time)):
        return value.isoformat()
    if isinstance(value, timedelta):
        return str(value)
    return value


def _room_label(row, room_columns, combined_column, room_name):
    number = ""
    numeric_cell = False
    for column in room_columns:
        cell = row[column]
        if cell.data_type != "e":
            number = _room_number(cell.value, cell.number_format or "")
        if number:
            numeric_cell = type(cell.value) in (float, int) and cell.number_format == "General"
            break
    combined = ""
    if combined_column is not None:
        cell = row[combined_column]
        combined = "" if cell.data_type == "e" else _room_number(cell.value, cell.number_format or "")
    if combined:
        prefix, *label = combined.split(maxsplit=1)
        # Without a number column the first token must look like a room identifier.
        if not number and any(c.isdigit() for c in prefix):
            number = prefix
        elif numeric_cell and _number_matches(number, prefix):
            number = prefix
        if not room_name and label and prefix == number:
            room_name = label[0]
    return number, room_name


def _row_attributes(headers, row):
    errors = 0
    attributes = {}
    for field, cell in zip(headers, row):
        if not field or cell.value is None:
            continue
        if cell.data_type == "e":
            errors += 1
            continue
        value = _excel_value(cell)
        if not isinstance(value, str) or value.strip():
            attributes[field] = value
    return attributes, errors


def _objects(sheet, header_row, headers, columns):
    elements = []
    ids = set()
    room_names = defaultdict(dict)
    duplicate = missing = undetermined = excel_errors = ambiguous_number = 0
    indices = {header: i for i, header in enumerate(headers) if header}
    room_columns = [indices[h] for h in columns["number"]]
    combined_column = indices[columns["combined"][0]] if columns["combined"] else None
    for row_count, row in enumerate(sheet.iter_rows(min_row=header_row + 1, max_col=len(headers)), 1):
        if row_count > _MAX_ROWS:
            raise ValueError(f"Die NOVA-Objektliste überschreitet {_MAX_ROWS} Datenzeilen.")
        attributes, errors = _row_attributes(headers, row)
        excel_errors += errors
        if not attributes:
            continue
        index = _field(attributes, columns["index"])
        object_class = _field(attributes, columns["class"])
        if not index or not object_class:
            missing += 1
            continue
        if index in ids:
            duplicate += 1
            continue
        ids.add(index)

        storey = _field(attributes, columns["floor"])
        number, room_name = _room_label(row, room_columns, combined_column, _field(attributes, columns["room"]))
        room_ids = []
        if number and storey:
            key = (_field(attributes, columns["building"]), storey, number)
            names = room_names[key]
            if room_name:
                names[room_name] = None
            room_ids.append(_room_id(key))
        else:
            undetermined += 1
            if not number and any(isinstance(row[c].value, (date, time)) for c in room_columns):
                ambiguous_number += 1

        # A Nova class label is never evidence of an actual IFC entity.
        reserved = object_class.casefold().startswith("ifc") or object_class == "NovaRaumbezug"
        model_class = "NOVA " + object_class if reserved else object_class
        elements.append(Element(
            id="nova-object:" + quote(index, safe=""), ifc_class=model_class, classes=[model_class, "NovaBauteil"],
            name=_field(attributes, columns["name"]) or object_class, storey=storey,
            attributes=attributes, room_ids=room_ids,
        ))
    if not elements:
        raise ValueError("Die NOVA-Objektliste enthält keine Bauteile mit Index und Klasse.")
    conflicts = 0
    for (building, storey, number), labels in room_names.items():
        names = list(labels)
        attrs = {"Raumnummer": number, "Geschoss": storey}
        if building:
            attrs["Gebäude"] = building
        if len(names) > 1:
            conflicts += 1
            attrs["Abweichende Raumbezeichnungen"] = names
        if len(names) == 1:
            attrs["Raum"] = names[0]
        elements.append(Element(
            id=_room_id((building, storey, number)), ifc_class="NovaRaumbezug", classes=["NovaRaumbezug"],
            name=names[0] if len(names) == 1 else number, number=number, storey=storey, attributes=attrs,
        ))
    warnings = [
        f"Blatt «{sheet.title}»: {len(ids)} Bauteile, {len(room_names)} unterschiedliche Raumbezüge. "
        "Grundlage sind Gebäude, Geschoss und Raumnummer der Bauteile. Raumgrenzen, Flächen und Volumen sind nicht belegt."
    ]
    for count, message in (
        (undetermined, "Bauteile ohne auswertbare Kombination aus Geschoss und Raumnummer blieben ohne Raumzuordnung."),
        (conflicts, "Raumbezüge haben widersprüchliche Raumbezeichnungen. Die vorhandenen Bezeichnungen stehen im Inspektor."),
        (missing, "Zeilen ohne Index oder Klasse wurden ausgelassen."),
        (duplicate, "weitere Zeilen mit bereits vorhandenem Index wurden ausgelassen. Es zählt die erste Bauteilzeile."),
        (ambiguous_number, "Raumnummern im Excel-Datumsformat liessen sich nicht als Kennung lesen."),
        (excel_errors, "Excel-Fehlerzellen lieferten keinen Attributwert."),
    ):
        if count:
            warnings.append(f"{count} {message}")
    return elements, warnings


def _room_id(key) -> str:
    return "nova-room:" + ":".join(quote(part, safe="") for part in key)


def parse_nova(path: Path) -> BuildingModel:
    """Liest Quelldaten der Objektliste; Importvorschläge und Abgleichblätter bleiben separat."""
    with open_xlsx(path, data_only=True) as book:
        sheet, header_row, labels, columns = _object_sheet(book)
        elements, warnings = _objects(sheet, header_row, labels, columns)
        if len(book.worksheets) > 1:
            warnings.append(
                f"Nur «{sheet.title}» wurde als Objektliste gelesen. "
                "Weitere Arbeitsblätter wurden nicht als zusätzliche Bauteile oder als geänderte Istwerte übernommen."
            )
    return BuildingModel(elements=elements, source="NOVA", warnings=warnings,
                         declared_attributes=[name for name in labels if name])
