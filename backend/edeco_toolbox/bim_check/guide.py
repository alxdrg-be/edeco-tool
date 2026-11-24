"""Excel-Prüfregeln einlesen. Bestandslisten enthalten keine impliziten Sollwerte."""

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
import re

import regex

from .xlsx import open_xlsx


@dataclass
class Rule:
    id: str
    ifc_class: str
    pset: str
    attribute: str
    required: bool = True
    datatype: str = ""
    expected: str = ""
    allowed: list[str] = field(default_factory=list)
    pattern: str = ""


@dataclass
class Guide:
    rules: list[Rule]
    warnings: list[str] = field(default_factory=list)


def _key(value: object) -> str:
    value = str(value or "").casefold()
    for original, replacement in (("ä", "ae"), ("ö", "oe"), ("ü", "ue")):
        value = value.replace(original, replacement)
    return "".join(ch for ch in value if ch.isalnum())


HEADERS = {
    "id": ("Regel-ID", "Regelnummer", "Rule ID"),
    "ifc_class": ("IFC-Klasse", "IFC-Klassen", "IFC Typ", "Klasse", "IfcClass", "IFC Entity", "Entity", "Elementklasse", "Entity type", "Class"),
    "pset": ("PSet", "Property Set", "Property Set Name", "Eigenschaftensatz", "Eigenschaftenset", "Merkmalgruppe", "Set Name"),
    "attribute": ("Attribut", "Attributname", "Attribute", "Attribute Name", "Eigenschaft", "Eigenschaftsname", "Property", "Property Name", "Merkmal", "Parameter"),
    "required": ("Pflichtfeld", "Pflichtfeld ja/nein", "Pflicht", "Erforderlich", "Required", "Mandatory", "Obligatorisch", "Mandatory field"),
    "datatype": ("Datentyp", "Werttyp", "Data type", "Value Type", "Property Type", "Erwarteter Datentyp"),
    "expected": ("Soll", "Sollwert", "Soll-Wert(e)", "Expected", "Expected value", "Vorgabewert"),
    "allowed": ("Erlaubte Werte", "Zulässige Werte", "Werteliste", "Auswahlliste", "Allowed Values", "Enumeration", "Enum"),
    "pattern": ("Muster", "Regex", "Regulärer Ausdruck", "Pattern", "RegExp"),
}
_COLUMN_BY_KEY = {_key(label): column for column, labels in HEADERS.items() for label in labels}

_TYPES = {
    "Text": ("Text", "String", "Zeichenkette", "IfcLabel", "IfcIdentifier", "IfcText", "IfcGloballyUniqueId", "IfcURIReference"),
    "Zahl": ("Zahl", "Number", "Numeric", "Decimal", "Real", "Float", "Double", "Dezimalzahl", "IfcReal", "IfcLengthMeasure", "IfcAreaMeasure", "IfcVolumeMeasure"),
    "Ganzzahl": ("Ganzzahl", "Integer", "Int", "IfcInteger", "IfcCountMeasure"),
    "Boolean": ("Boolean", "Bool", "Boolesch", "Wahrheitswert", "Ja/Nein", "IfcBoolean"),
    "Datum": ("Datum", "Date", "IfcDate"),
}
_TYPE_BY_KEY = {_key(label): category for category, labels in _TYPES.items() for label in labels}
_REQUIRED = {**dict.fromkeys(("ja", "j", "yes", "y", "x", "true", "1", "pflicht", "required", "mandatory"), True),
             **dict.fromkeys(("nein", "n", "no", "false", "0", "optional"), False)}
_MAX_RULES = 1000
_MAX_PATTERN = 1024


def _text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, date):
        return value.isoformat()
    return str(value).strip()


def _header(values) -> dict[str, int] | None:
    fields = [_COLUMN_BY_KEY.get(_key(value)) for value in values]
    checks = {"required", "datatype", "expected", "allowed", "pattern"}
    if "attribute" not in fields or not checks.intersection(fields):
        return None
    result = {}
    for i, name in enumerate(fields):
        if name is None:
            continue
        if name in result:
            raise ValueError(f"Spalte «{HEADERS[name][0]}» ist mehrfach vorhanden.")
        result[name] = i
    return result


def _rule(values: dict[str, str], location: str) -> Rule:
    pset = values.get("pset", "")
    attribute = values.get("attribute", "")
    if not attribute:
        raise ValueError("Der Attributname fehlt.")
    if not pset and "." in attribute:
        pset, attribute = (part.strip() for part in attribute.split(".", 1))
        if not pset or not attribute:
            raise ValueError("Bei «PSet.Attribut» beide Namen angeben.")
    required = _key(values.get("required", "")) or "ja"
    if required not in _REQUIRED:
        raise ValueError(f"Pflichtfeld «{values['required']}» ist unklar. Ja oder Nein angeben.")
    type_name = values.get("datatype", "")
    datatype = _TYPE_BY_KEY.get(_key(type_name), "")
    if type_name and not datatype:
        raise ValueError(f"Unbekannter Datentyp «{type_name}». Möglich sind Text, Zahl, Ganzzahl, Boolean und Datum.")
    pattern = values.get("pattern", "")
    if len(pattern) > _MAX_PATTERN:
        raise ValueError(f"Das Muster überschreitet {_MAX_PATTERN} Zeichen.")
    if pattern:
        try:
            regex.compile(pattern)
        except regex.error as exc:
            raise ValueError(f"Ungültiges Muster «{pattern}» ({exc}).") from exc
    allowed = [entry.strip() for entry in re.split(r"[;|\n]", values.get("allowed", "")) if entry.strip()]
    return Rule(
        id=values.get("id") or location,
        ifc_class=values.get("ifc_class") or "*",
        pset="" if _key(pset) in {"direkt", "attribute", "attribut", "ifcattribute", "direct"} else pset,
        attribute=attribute,
        required=_REQUIRED[required],
        datatype=datatype,
        expected=values.get("expected", ""),
        allowed=allowed,
        pattern=pattern,
    )


def read_guide(path: Path) -> Guide:
    """Findet Kopfzeilen in den ersten 30 Zeilen jedes sichtbaren Arbeitsblatts."""
    with open_xlsx(path, data_only=False) as book:
        return _read_sheets(book)


def _read_sheets(book) -> Guide:
    rules = []
    ids = set()
    ignored = []
    for sheet in book.worksheets:
        if sheet.sheet_state != "visible":
            continue
        # Sparse/incorrect workbook dimensions must not turn a few cells into millions.
        sheet.reset_dimensions()
        rows = iter(sheet.iter_rows(max_col=256))
        columns = None
        for row_num, row in enumerate(rows, 1):
            location = f"{sheet.title}!{row_num}"
            if columns is None:
                try:
                    columns = _header(cell.value for cell in row)
                except ValueError as exc:
                    raise ValueError(f"{location}: {exc}") from exc
                if columns is None and row_num >= 30:
                    break
                continue
            values = {}
            for name, col in columns.items():
                cell = row[col]
                if cell.data_type in {"f", "e"}:
                    raise ValueError(f"{location}: «{HEADERS[name][0]}» enthält eine Formel oder einen Excel-Fehler. Einen festen Regelwert eingeben.")
                values[name] = _text(cell.value)
            if not any(values.values()):
                continue
            try:
                rule = _rule(values, location)
            except ValueError as exc:
                raise ValueError(f"{location}: {exc}") from exc
            if rule.id in ids:
                raise ValueError(f"{location}: Doppelte Regel-ID «{rule.id}».")
            ids.add(rule.id)
            rules.append(rule)
            if len(rules) > _MAX_RULES:
                raise ValueError(f"Die Arbeitsmappe enthält mehr als {_MAX_RULES} Regeln. Regeln aufteilen.")
        if columns is None:
            ignored.append(sheet.title)
    if not rules:
        raise ValueError("Keine Prüfregeln gefunden. Eine Regeldatei braucht eine Spalte «Attribut» und mindestens eine Prüfvorgabe wie «Pflichtfeld», «Datentyp» oder «Sollwert». Eine Nova-Bestandsliste im Modellimport öffnen oder die Regelvorlage verwenden.")
    warnings = [f"Blatt «{title}» enthält keine Regelspalten und wurde übergangen." for title in ignored]
    return Guide(rules, warnings)
