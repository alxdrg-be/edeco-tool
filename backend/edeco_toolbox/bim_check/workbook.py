"""Regelvorlage und vollständigen XLSX-Bericht für eine lokale Prüfung erstellen."""

from io import BytesIO
from pathlib import PureWindowsPath

from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from openpyxl.cell.cell import ILLEGAL_CHARACTERS_RE
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

from .checks import CheckReport, STATUSES
from .guide import Rule


def _table(sheet, headings, widths) -> None:
    sheet.freeze_panes = "A2"
    cells = []
    for col, (title, width) in enumerate(zip(headings, widths), 1):
        sheet.column_dimensions[get_column_letter(col)].width = width
        cell = WriteOnlyCell(sheet, title)
        cell.font = Font(name="Calibri", bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="126678")
        cells.append(cell)
    sheet.append(cells)


def _row(sheet, values) -> None:
    # Explicit text cells preserve external model strings, including leading = or +.
    cells = []
    for value in values:
        if isinstance(value, str):
            cell = WriteOnlyCell(sheet, ILLEGAL_CHARACTERS_RE.sub("", value))
            cell.data_type = "s"
            cells.append(cell)
        else:
            cells.append(value)
    sheet.append(cells)


def _bytes(book: Workbook) -> bytes:
    data = BytesIO()
    try:
        book.save(data)
        return data.getvalue()
    finally:
        book.close()


_RULE_HEADERS = ("Regel-ID", "IFC-Klasse", "PSet", "Attribut", "Pflichtfeld", "Datentyp", "Sollwert", "Erlaubte Werte", "Muster")
_RULE_WIDTHS = (21, 19, 32, 23, 14, 16, 22, 34, 28)


def template_xlsx(source: str = "IFC") -> bytes:
    if source.upper() not in {"IFC", "NOVA"}:
        raise ValueError("Eine Regelvorlage gibt es für IFC und NOVA.")
    book = Workbook()
    sheet = book.active
    sheet.title = "Prüfregeln"
    _table(sheet, _RULE_HEADERS, _RULE_WIDTHS)
    if source.upper() == "NOVA":
        _row(sheet, ("Raumnummer", "NovaRaumbezug", "", "Raumnummer", "Ja", "Text", "", "", ""))
        _row(sheet, ("Raumgeschoss", "NovaRaumbezug", "", "Geschoss", "Ja", "Text", "", "", ""))
        _row(sheet, ("Bauteilgeschoss", "NovaBauteil", "", "Geschoss", "Ja", "", "", "", ""))
    else:
        _row(sheet, ("Raumbezeichnung", "IfcSpace", "", "Name", "Ja", "Text", "", "", ""))
        _row(sheet, ("Raumlage", "IfcSpace", "Pset_SpaceCommon", "IsExternal", "Nein", "Boolean", "", "", ""))
        _row(sheet, ("Nutzungsart", "IfcSpace", "Firma_Raum", "Nutzung", "Ja", "Text", "", "Büro;Lager;Technik", ""))
    sheet.auto_filter.ref = sheet.dimensions
    for column, options in (("E", "Ja,Nein"), ("F", "Text,Zahl,Ganzzahl,Boolean,Datum")):
        validation = DataValidation(type="list", formula1=f'"{options}"', allow_blank=True)
        sheet.add_data_validation(validation)
        validation.add(f"{column}2:{column}1001")
    return _bytes(book)


def report_xlsx(
    report: CheckReport, *, model_filename: str = "", guide_filename: str = "", rules: list[Rule] | None = None
) -> bytes:
    book = Workbook(write_only=True)
    summary = book.create_sheet("Übersicht")
    _table(summary, ("Status", "Anzahl"), (31, 20))
    for status in STATUSES:
        _row(summary, (status, report.counts.get(status, 0)))
    _row(summary, ("Geprüfte Objekt-Regel-Paare", len(report.rows)))
    percentage = WriteOnlyCell(summary, None if report.pass_rate is None else report.pass_rate / 100)
    percentage.number_format = "0.00%"
    _row(summary, ("Trefferquote", percentage))
    for title, filename in (("Modelldatei", model_filename), ("Regeldatei", guide_filename)):
        if filename:
            _row(summary, (title, PureWindowsPath(filename).name))
    sheet = book.create_sheet("Prüfergebnisse")
    _table(sheet,
           ("Status", "Regel-ID", "Objekt-ID", "Klasse", "Geschoss", "Nummer", "Bezeichnung", "PSet", "Attribut", "Istwert", "Vorgabe", "Begründung"),
           (15, 22, 28, 22, 19, 16, 35, 31, 27, 35, 50, 50))
    for row in report.rows:
        _row(sheet, (row.status, row.rule_id, row.element_id, row.ifc_class, row.storey, row.number,
                     row.name, row.pset, row.attribute, row.actual, row.expected, row.message))
    sheet.auto_filter.ref = f"A1:L{len(report.rows) + 1}"
    if rules is not None:
        applied = book.create_sheet("Verwendete Regeln")
        _table(applied, _RULE_HEADERS, _RULE_WIDTHS)
        for rule in rules:
            _row(applied, (rule.id, rule.ifc_class, rule.pset, rule.attribute, "Ja" if rule.required else "Nein",
                           rule.datatype, rule.expected, ";".join(rule.allowed), rule.pattern))
        applied.auto_filter.ref = f"A1:I{len(rules) + 1}"
    if report.warnings:
        notes = book.create_sheet("Hinweise")
        _table(notes, ("Hinweis",), (105,))
        for warning in report.warnings:
            _row(notes, (warning,))
    return _bytes(book)
