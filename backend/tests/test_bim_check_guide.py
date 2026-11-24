from datetime import datetime
from io import BytesIO

from openpyxl import Workbook, load_workbook
import pytest

from edeco_toolbox.bim_check import checks
from edeco_toolbox.bim_check.checks import evaluate
from edeco_toolbox.bim_check.guide import Guide, Rule, read_guide
from edeco_toolbox.bim_check.model import BuildingModel, Element
from edeco_toolbox.bim_check.workbook import report_xlsx, template_xlsx


def write_guide(path, rows, other_sheet=False):
    book = Workbook()
    book.active.title = "Anforderungen"
    for row in rows:
        book.active.append(row)
    if other_sheet:
        book.create_sheet("Inventar").append(["Index", "Klasse", "Bezeichnung", "A_Hersteller"])
    book.save(path)
    book.close()
    return path


def test_excel_headers_type_alias_and_mixed_worksheets(tmp_path):
    path = write_guide(tmp_path / "mehrere.xlsx", [
        ["Raumbuch, Projekt ABC"],
        ["Regel-ID", "ifc entity", "Eigenschaftsname", "Mandatory", "Property type", "Allowed values", "Pattern"],
        ["R01", "IfcSpace", "Firma_Raum.Nutzung", "Y", "IfcLabel", "Büro;Lager|Technik", "[A-ZÄÖÜ].+"],
        ["R02", "IfcProduct", "Name", "optional", "", "", ""],
    ], other_sheet=True)
    guide = read_guide(path)
    assert guide.rules[0] == Rule("R01", "IfcSpace", "Firma_Raum", "Nutzung", True, "Text", "", ["Büro", "Lager", "Technik"], "[A-ZÄÖÜ].+")
    assert guide.rules[1].required is False
    assert guide.rules[1].pset == ""
    assert len(guide.warnings) == 1 and "Inventar" in guide.warnings[0]


@pytest.mark.parametrize(("rows", "match"), [
    ([["Index", "Klasse", "Bezeichnung", "A_Hersteller"], ["GUID", "Kanal", "Kanal", ""]] , "Keine Prüfregeln"),
    ([["Property", "Required", "Pflichtfeld"]], "mehrfach"),
    ([["Rule ID", "Attribute", "Pflicht"], ["identisch", "Name", "ja"], ["identisch", "Tag", "nein"]], "Doppelte Regel-ID"),
    ([["Attribut", "Pflicht"], ["Name", "vielleicht"]], "Ja oder Nein"),
    ([["Attribut", "Data Type"], ["Name", "IfcExperiment"]], "Unbekannter Datentyp"),
    ([["Attribut", "Regex"], ["Name", "["]], "Ungültiges Muster"),
    ([["Attribut", "Regex"], ["Name", "a"*1025]], "überschreitet"),
    ([["Attribut", "Sollwert"], ["Name", "=2+2"]], "Formel"),
    ([["Attribut", "Datentyp"], ["", "Text"]], "Attributname"),
])
def test_unusable_guide_fails_without_partial_results(tmp_path, rows, match):
    with pytest.raises(ValueError, match=match):
        read_guide(write_guide(tmp_path / "regeln.xlsx", rows))


def test_invalid_workbook_and_template_roundtrip(tmp_path):
    path = tmp_path / "kaputt.xlsx"
    path.write_bytes(b"kein Excel")
    with pytest.raises(ValueError, match="XLSX"):
        read_guide(path)
    path.write_bytes(template_xlsx())
    guide = read_guide(path)
    assert len(guide.rules) == 3
    assert {r.pset for r in guide.rules} == {"", "Pset_SpaceCommon", "Firma_Raum"}
    assert not guide.warnings


def test_attributes_standard_custom_psets_required_and_optional():
    room = Element("r1", "IfcSpace", "Büro", "101", "EG", classes=["IfcProduct"],
                   attributes={"Name": "101", "Beschreibung": "  ", "Null": None},
                   psets={"Pset_SpaceCommon": {"IsExternal": False}, "Firma": {"Länge": 0, "Code": "E-09", "Nutzung": "Lager"}})
    wall = Element("w1", "IfcWall", "Wand", classes=["IfcProduct"], attributes={"Name": "Wand"})
    rules = [
        Rule("name", "IfcProduct;IfcSpace", "", "Name"),
        Rule("blank", "IfcSpace", "", "Beschreibung"),
        Rule("null", "IfcSpace", "", "Null"),
        Rule("external", "IfcSpace", "Pset_SpaceCommon", "IsExternal", datatype="Boolean", expected="nein"),
        Rule("zero", "IfcSpace", "Firma", "Länge", datatype="Zahl", expected="0,0"),
        Rule("absent", "IfcSpace", "Pset_Inexistent", "X"),
        Rule("opt", "IfcSpace", "Firma", "Y", False),
        Rule("code", "IfcSpace", "Firma", "Code", pattern="[A-Z]-[0-9]{2}"),
        Rule("usage", "IfcSpace", "Firma", "Nutzung", False, allowed=["Technik", "Büro"]),
        Rule("no_targets", "IfcBuildingStorey", "", "Name"),
    ]
    report = evaluate(BuildingModel([room, wall], "test"), Guide(rules))
    assert report.counts == {"OK": 5, "Fehlt": 1, "Leer": 2, "Abweichend": 1, "Optional": 1}
    assert report.pass_rate == 55.56
    assert len(report.warnings) == 1 and "no_targets" in report.warnings[0]
    assert [(row.rule_id, row.storey, row.number) for row in report.rows if row.status == "Abweichend"] == [("usage", "EG", "101")]
    assert [row.actual for row in report.rows if row.rule_id == "external"] == ["False"]


@pytest.mark.parametrize(("value","datatype","status"), [
    (False, "Ganzzahl", "Abweichend"), (1, "Boolean", "Abweichend"),
    (0, "Ganzzahl", "OK"), (0.5, "Zahl", "OK"), ("12", "Zahl", "Abweichend"),
    ("2025-02-30", "Datum", "Abweichend"), ("2025-11-12", "Datum", "OK"),
    (datetime(2026, 1, 1), "Datum", "OK"),
])
def test_declared_types_use_real_values(value, datatype, status):
    model = BuildingModel([Element("a", "IfcWall", "", attributes={"x": value})], "test")
    report = evaluate(model, Guide([Rule("r", "*", "", "x", datatype=datatype)]))
    assert report.rows[0].status == status


def test_nova_declared_blank_field_and_parent_class():
    model = BuildingModel([
        Element("a", "Leuchte", "", classes=["NovaBauteil"]),
        Element("r", "NovaRaumbezug", ""),
    ], "Nova", declared_attributes=["A_Name"])
    report = evaluate(model, Guide([Rule("r", "NovaBauteil", "", "A_Name"), Rule("x", "*", "", "A_Name", False)]))
    assert [row.status for row in report.rows] == ["Leer", "Optional", "Optional"]
    assert report.rows[-1].message.endswith("fehlt.")


def test_no_targets_and_optional_fields_do_not_inflate_pass_rate():
    model = BuildingModel([Element("x", "IfcSpace", "")], "test")
    report = evaluate(model, Guide([Rule("r", "*", "", "Name", False), Rule("r2", "IfcWall", "", "Name")]))
    assert report.pass_rate is None
    assert report.counts["OK"] == 0


def test_result_limit_returns_an_actionable_error(monkeypatch):
    monkeypatch.setattr(checks, "MAX_RESULTS", 1)
    model = BuildingModel([Element("1", "IfcSpace", ""), Element("2", "IfcSpace", "")], "test")
    with pytest.raises(ValueError, match="aufteilen"):
        evaluate(model, Guide([Rule("r", "*", "", "Name")]))


def test_report_export_preserves_formula_like_text_and_finding_ids():
    model = BuildingModel([Element("+Objekt", "IfcSpace", "=HYPERLINK(A1)", "010", "2. OG", attributes={"Name": "=2+2"})], "test")
    report = evaluate(model, Guide([Rule("R-1", "IfcSpace", "", "Name"), Rule("R-2", "IfcWall", "", "Name")]))
    with BytesIO(report_xlsx(report)) as buffer:
        book = load_workbook(buffer, data_only=False)
        assert book.sheetnames == ["Übersicht", "Prüfergebnisse", "Hinweise"]
        result = book["Prüfergebnisse"]
        assert result.auto_filter.ref == "A1:L2"
        assert [c.value for c in result[2][:10]] == ["OK", "R-1", "+Objekt", "IfcSpace", "2. OG", "010", "=HYPERLINK(A1)", None, "Name", "=2+2"]
        assert all(result[coord].data_type == "s" for coord in ("C2", "G2", "J2"))
        assert result.freeze_panes == "A2"
        assert book["Übersicht"]["B8"].value == 1
        assert "Keine Zielobjekte" in book["Hinweise"]["A2"].value
        book.close()


def test_nova_placeholder_is_reported_and_original_value_preserved():
    model = BuildingModel([Element("id", "Kanal", "", attributes={"A_Hersteller": "nicht_definiert"}, classes=["NovaBauteil"])], "NOVA")
    report = evaluate(model, Guide([Rule("r", "*", "", "A_Hersteller")]))
    assert report.rows[0].status == "Leer"
    assert report.rows[0].actual == "nicht_definiert"


def test_all_selected_ifc_enumeration_values_must_match():
    model = BuildingModel([Element("id", "IfcSpace", "", psets={"Custom": {"Nutzungen": ["Büro", "Lager"]}})], "ifc")
    def rule(allowed):
        return Rule("N", "IfcSpace", "Custom", "Nutzungen", datatype="Text", allowed=allowed, pattern=r"[A-Z].+")
    assert evaluate(model, Guide([rule(["Büro", "Lager", "Technik"])] )).rows[0].status == "OK"
    assert evaluate(model, Guide([rule(["Büro"])] )).rows[0].status == "Abweichend"


def test_export_contains_input_filenames_warnings_and_all_rules_even_if_no_matching_objects():
    guide = Guide([Rule("=originale-id", "IfcWall", "Pset_WallCommon", "IsExternal", True, "Boolean", "false")])
    report = evaluate(BuildingModel([], "ifc", warnings=["Unvollständige Geometrie"]), guide)
    result = report_xlsx(report, model_filename=r"C:\projekt\=haus.ifc", guide_filename="/local/BIM-Guide.xlsx", rules=guide.rules)
    with BytesIO(result) as buffer:
        book = load_workbook(buffer, data_only=False)
        assert book["Übersicht"]["B9"].value == "=haus.ifc" and book["Übersicht"]["B9"].data_type == "s"
        assert book["Übersicht"]["B10"].value == "BIM-Guide.xlsx"
        sheet = book["Verwendete Regeln"]
        assert sheet["A2"].value == "=originale-id" and sheet["A2"].data_type == "s"
        assert sheet["G2"].value == "false" and sheet.auto_filter.ref == "A1:I2"
        assert book["Prüfergebnisse"].max_row == 1
        assert book["Übersicht"]["B8"].value is None
        assert book["Hinweise"]["A2"].value == "Unvollständige Geometrie"
        assert "Keine Zielobjekte" in book["Hinweise"]["A3"].value
        book.close()


def test_nova_rule_template_checks_rooms_and_original_object_columns(tmp_path):
    model = BuildingModel([
        Element("r", "NovaRaumbezug", "", attributes={"Raumnummer": "010", "Geschoss": "EG"}),
        Element("b1", "Leuchte", "", classes=["NovaBauteil"], attributes={"Geschoss": "EG"}),
        Element("b2", "Leuchte", "", classes=["NovaBauteil"]),
    ], "nova", declared_attributes=["Geschoss"])
    path = tmp_path / "Prüfregeln-Nova.xlsx"
    path.write_bytes(template_xlsx("NOVA"))
    report = evaluate(model, read_guide(path))
    assert report.counts == {"OK": 3, "Fehlt": 0, "Leer": 1, "Abweichend": 0, "Optional": 0}
    assert not report.warnings
    assert {r.ifc_class for r in read_guide(path).rules} == {"NovaRaumbezug", "NovaBauteil"}
    with pytest.raises(ValueError, match="IFC und NOVA"):
        template_xlsx("Unbekannt")
