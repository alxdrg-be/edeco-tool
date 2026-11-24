"""Zwei Nova-Stände vergleichen: Schlüssel, Baustatus-Filter, unsichere Zuordnung, Bericht."""

from io import BytesIO

from openpyxl import Workbook, load_workbook

from edeco_toolbox.bim_check.compare import compare, compare_xlsx
from edeco_toolbox.bim_check.nova import parse_nova

HEAD = ["Index", "Klasse", "Bezeichnung", "Geschoss", "Raumnummer", "Raum", "Bestandteil von", "Baustatus", "Schaltkreis"]


def book(path, rows):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(HEAD)
    for row in rows:
        sheet.append(row)
    workbook.save(path)
    return parse_nova(path)


def test_key_status_filter_and_uncertain_matches(tmp_path):
    old = book(tmp_path / "alt.xlsx", [
        ["A1", "Bauteil", "Leuchte", "EG", "0.01", "Büro", "Licht", "Etappe_x", "L1"],
        ["A2", "Bauteil", "Steckdose", "EG", "0.01", "Büro", "Kraft", "Etappe_x", "K1"],
        ["A3", "Bauteil", "Melder", "OG", "1.01", "Flur", "BMA", "Etappe_x", None],
        ["A4", "Bauteil", "Taster", "OG", "1.02", "Lager", "KNX", "Etappe_x", None],
        ["A5", "Leitung", "Cu 10", "UG", "-1.01", "Technik", "Erschliessung", "Etappe_x", None],
        ["A6", "Leitung", "Cu 10", "UG", "-1.01", "Technik", "Erschliessung", "Etappe_x", None],
        ["2Ro4NA$nf1x8/isE2", "Bauteil", "Kanal", "EG", "0.02", "Lager", "Trassen", "Etappe_x", None],
    ])
    new = book(tmp_path / "neu.xlsx", [
        ["A1", "Bauteil", "Leuchte", "EG", "0.01", "Büro", "Licht", "Etappe_2", "L1"],      # only Baustatus
        ["A2", "Bauteil", "Steckdose", "EG", "0.01", "Büro", "Kraft", "Etappe_2", "K2 "],     # circuit too
        ["A3", "Bauteil", "Melder", "OG", "1.01", "Flur", "BMA", "Etappe_x", None],          # unchanged
        ["B4", "Bauteil", "Taster", "OG", "1.02", "Lager", "KNX", "Etappe_x", None],         # new key, same object?
        ["B5", "Leitung", "Cu 10", "UG", "-1.01", "Technik", "Erschliessung", "Etappe_x", None],
        ["B6", "Bauteil", "Leuchte", "DA", "9.01", "Dach", "Licht", "Etappe_x", None],
        ["2Ro4NA$nf1x8/isE2", "Bauteil", "Kanal", "EG", "0.02", "Lager", "Trassen", "Etappe_2", None],
    ])
    result = compare(old, new)
    rows = {row["key"]: row for row in result["rows"]}
    assert result["counts"] == {"neu": 2, "entfernt": 2, "geändert": 3, "Zuordnung prüfen": 1, "nur Status": 2}
    # Nova indices contain $ and / and must appear as written, not URL-quoted.
    assert rows["2Ro4NA$nf1x8/isE2"]["status_only"]
    assert rows["A1"]["status_only"] and [c["field"] for c in rows["A1"]["changes"]] == ["Baustatus"]
    assert not rows["A2"]["status_only"]
    assert {c["field"]: (c["old"], c["new"]) for c in rows["A2"]["changes"]} == {
        "Baustatus": ("Etappe_x", "Etappe_2"), "Schaltkreis": ("K1", "K2")}
    assert "A3" not in rows
    # One unmatched taster on each side in the same room: a suggestion, never an automatic match.
    assert rows["B4"]["status"] == "Zuordnung prüfen" and rows["B4"]["old_key"] == "A4"
    assert rows["B4"]["element_id"] == "nova-object:B4"
    # Two equal cables left, one came back with a new key: ambiguous, so new and removed stay apart.
    assert rows["B5"]["status"] == "neu" and rows["A5"]["status"] == "entfernt" and rows["A6"]["status"] == "entfernt"
    assert rows["A5"]["element_id"] == ""
    assert rows["B6"]["status"] == "neu" and rows["B6"]["room"] == "9.01" and rows["B6"]["part_of"] == "Licht"

    report = load_workbook(BytesIO(compare_xlsx(result, "alt.xlsx", "neu.xlsx")), read_only=True)
    assert report.sheetnames == ["Übersicht", "Änderungen", "Datenqualität"]
    lines = list(report["Änderungen"].iter_rows(values_only=True))
    assert ("geändert", "A2") == lines[1 + [r[1] for r in lines[1:]].index("A2")][:2]
    assert sum(1 for line in lines if line[1] == "A2") == 2


def test_room_name_conflicts_are_data_quality_not_differences(tmp_path):
    rows = [["A1", "Bauteil", "Leuchte", "EG", "0.01", "Büro", "Licht", "Etappe_x", None],
            ["A2", "Bauteil", "Leuchte", "EG", "0.01", "Sitzung", "Licht", "Etappe_x", None]]
    old = book(tmp_path / "alt.xlsx", rows)
    new = book(tmp_path / "neu.xlsx", rows)
    result = compare(old, new)
    assert result["rows"] == []
    assert result["quality"] == [{"storey": "EG", "room": "0.01", "names": ["Büro", "Sitzung"]}]
