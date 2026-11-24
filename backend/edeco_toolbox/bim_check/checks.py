"""Regeln auf Modellobjekte anwenden, unabhängig vom Eingabeformat und der UI."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import json
import math
import re

import regex

from .guide import Guide, Rule
from .model import BuildingModel, Element


STATUSES = ("OK", "Fehlt", "Leer", "Abweichend", "Optional")
MAX_RESULTS = 100_000
_MISSING = object()


@dataclass(slots=True)
class Finding:
    rule_id: str
    element_id: str
    ifc_class: str
    name: str
    number: str
    storey: str
    pset: str
    attribute: str
    status: str
    actual: str
    expected: str
    message: str


@dataclass
class CheckReport:
    rows: list[Finding]
    counts: dict[str, int]
    warnings: list[str]
    pass_rate: float | None


def _display(value) -> str:
    if value is _MISSING or value is None:
        return ""
    if isinstance(value, bool):
        return "True" if value else "False"
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)


def _blank(value) -> bool:
    return value is None or (isinstance(value, str) and not value.strip()) or (
        isinstance(value, (list, tuple, dict)) and not value
    )


def _is_date(value) -> bool:
    if isinstance(value, date):
        return True
    if not isinstance(value, str):
        return False
    try:
        # ISO date or a full ISO datetime as used in IFC and Excel exports.
        datetime.fromisoformat(value)
        return len(value) >= 10
    except ValueError:
        return False


def _valid_type(value, datatype: str) -> bool:
    if datatype == "Text":
        return isinstance(value, str)
    if datatype == "Boolean":
        return isinstance(value, bool)
    if datatype == "Ganzzahl":
        return type(value) is int
    if datatype == "Zahl":
        return type(value) is int or (type(value) is float and math.isfinite(value))
    if datatype == "Datum":
        return _is_date(value)
    return False


def _matches_value(value, expected: str) -> bool:
    if isinstance(value, bool):
        labels = {"true", "ja", "yes", "1"} if value else {"false", "nein", "no", "0"}
        return expected.casefold() in labels
    if type(value) in (int, float):
        try:
            return Decimal(str(value)) == Decimal(expected.replace(",", "."))
        except InvalidOperation:
            return False
    return _display(value) == expected


def _expectation(rule: Rule) -> str:
    parts = ["Pflichtfeld" if rule.required else "Optional"]
    if rule.datatype:
        parts.append(rule.datatype)
    if rule.expected:
        parts.append(f"Soll: {rule.expected}")
    if rule.allowed:
        parts.append("Erlaubt: " + " | ".join(rule.allowed))
    if rule.pattern:
        parts.append("Muster: " + rule.pattern)
    return " · ".join(parts)


def _assess(value, rule: Rule, pattern, nova_field: bool, missing_pset: bool) -> tuple[str, str]:
    if value is _MISSING:
        if not rule.required:
            return "Optional", "Optionales Feld fehlt."
        if missing_pset:
            return "Fehlt", f"Property-Set «{rule.pset}» fehlt am Objekt."
        if rule.pset:
            return "Fehlt", f"Eigenschaft «{rule.attribute}» fehlt im vorhandenen PSet «{rule.pset}»."
        return "Fehlt", f"Direktes Attribut «{rule.attribute}» fehlt am Objekt."
    if nova_field and isinstance(value, str) and value.strip().lower() in {"nicht_definiert", "nicht definiert"}:
        return ("Leer" if rule.required else "Optional", "Der Nova-Wert kennzeichnet ein nicht definiertes Feld.")
    if _blank(value):
        return ("Leer", "Das Feld ist vorhanden und leer.") if rule.required else ("Optional", "Optionales Feld ist leer.")
    problems = []
    values = value if isinstance(value, (list, tuple)) else [value]
    if rule.datatype and not all(_valid_type(member, rule.datatype) for member in values):
        problems.append(f"Datentyp entspricht nicht «{rule.datatype}».")
    if rule.expected and not all(_matches_value(member, rule.expected) for member in values):
        problems.append("Wert weicht vom Sollwert ab.")
    if rule.allowed and not all(any(_matches_value(member, option) for option in rule.allowed) for member in values):
        problems.append("Wert ist in der erlaubten Liste nicht enthalten.")
    if pattern is not None:
        try:
            if not all(pattern.fullmatch(_display(member), timeout=0.05) for member in values):
                problems.append("Wert entspricht nicht dem Muster.")
        except TimeoutError as exc:
            raise ValueError(f"Das Muster in Regel «{rule.id}» braucht zu lange. Bitte vereinfachen.") from exc
    return ("Abweichend", " ".join(problems)) if problems else ("OK", "Vorgabe erfüllt.")


def evaluate(model: BuildingModel, guide: Guide) -> CheckReport:
    by_class: dict[str, list[int]] = defaultdict(list)
    for index, element in enumerate(model.elements):
        for name in {element.ifc_class.casefold(), *(item.casefold() for item in element.classes)}:
            by_class[name].append(index)
    warnings = list(dict.fromkeys([*model.warnings, *guide.warnings]))
    rows = []
    counts = dict.fromkeys(STATUSES, 0)
    declared = set(model.declared_attributes)
    for rule in guide.rules:
        classes = {name.strip().casefold() for name in re.split(r"[,;|]", rule.ifc_class) if name.strip()}
        if not classes or "*" in classes or "alle" in classes:
            targets = range(len(model.elements))
        else:
            targets = sorted({index for name in classes for index in by_class.get(name, ())})
        if not targets:
            warnings.append(f"Regel «{rule.id}»: Keine Zielobjekte für «{rule.ifc_class}» im Modell.")
            continue
        if len(rows) + len(targets) > MAX_RESULTS:
            raise ValueError(f"Die Prüfung umfasst mehr als {MAX_RESULTS:,} Objekt-Regel-Paare. Modell oder Regelwerk aufteilen.".replace(",", "’"))
        expected = _expectation(rule)
        pattern = regex.compile(rule.pattern) if rule.pattern else None
        for index in targets:
            element: Element = model.elements[index]
            nova_field = "NovaBauteil" in element.classes and not rule.pset
            if rule.pset:
                value = element.psets.get(rule.pset, {}).get(rule.attribute, _MISSING)
            else:
                default = None if nova_field and rule.attribute in declared else _MISSING
                value = element.attributes.get(rule.attribute, default)
            status, message = _assess(value, rule, pattern, nova_field, bool(rule.pset and rule.pset not in element.psets))
            counts[status] += 1
            rows.append(Finding(rule.id, element.id, element.ifc_class, element.name, element.number,
                                element.storey, rule.pset, rule.attribute, status, _display(value), expected, message))
    checked = len(rows) - counts["Optional"]
    return CheckReport(rows, counts, warnings, round(100 * counts["OK"] / checked, 2) if checked else None)
