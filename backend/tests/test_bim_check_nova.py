from datetime import date

import pytest
from openpyxl import Workbook

from edeco_toolbox.bim_check.nova import parse_nova


def write_book(tmp_path, rows, extra=None):
    book = Workbook()
    sheet = book.active
    sheet.title = "NOVA-Objekte"
    for row in rows:
        sheet.append(row)
    if extra:
        more = book.create_sheet("Nova-Import")
        for row in extra:
            more.append(row)
    path = tmp_path / "Modellabgleich.xlsx"
    book.save(path)
    return path


def test_references_and_proposals_remain_distinguishable(tmp_path):
    path = write_book(tmp_path, [
        ["Projektübersicht"],
        ["Index", "Klasse", "Bezeichnung", "Gebäude", "Geschoss", "Raumnummer", "Raum", "A_RaumNr", "Watt"],
        ["E1", "Leuchte", "Pendelleuchte", "A", "EG", 0.01, "Büro", "0.010 Büro", 0],
        ["E2", "Leuchte", "Wandlampe", "A", "EG", "0.010", "Saal"],
        ["E3", "IfcSpace", "Originalklassentext", "A", "OG", "0.010", "Büro"],
        ["E4", "Melder", "Zentrale", "B", "EG", "0.010", "Büro"],
        ["E1", "Leuchte", "Duplikat", "A", "EG", "1234", "Alt"],
        ["E5", "Klemme", "Reserve", "", "", "1", "Lager"],
        [None, "Bauteil", "Zwischensumme"],
    ], extra=[["Index", "A_Name"], ["E1", "Ungeprüfter Vorschlag"], ["E7", "Weitere Zeile"]])
    model = parse_nova(path)
    rooms = [e for e in model.elements if e.ifc_class == "NovaRaumbezug"]
    objects = [e for e in model.elements if "NovaBauteil" in e.classes]
    assert model.source == "NOVA"
    assert len(rooms) == 3 and len(objects) == 5
    assert rooms[0].number == "0.010"
    assert rooms[0].attributes["Abweichende Raumbezeichnungen"] == ["Büro", "Saal"]
    assert rooms[0].name == "0.010"
    assert all(not e.polygons and e.area_m2 is None and e.volume_m3 is None for e in rooms)
    assert not any("IfcSpace" in e.classes for e in model.elements)
    assert objects[0].room_ids == objects[1].room_ids == [rooms[0].id]
    assert objects[2].room_ids == [rooms[1].id] and objects[3].room_ids == [rooms[2].id]
    assert objects[4].room_ids == []
    assert objects[0].attributes["Watt"] == 0 and objects[0].name == "Pendelleuchte"
    assert "Watt" not in objects[1].attributes and "Watt" in model.declared_attributes
    assert any("bereits vorhandenem Index" in m for m in model.warnings)
    assert any("ohne Index oder Klasse" in m for m in model.warnings)
    assert any("Weitere Arbeitsblätter" in m for m in model.warnings)


def test_numeric_number_format_and_combined_references(tmp_path):
    book = Workbook()
    sheet = book.active
    sheet.append(["GlobalId", "Objektklasse", "A_GeschossID", "A_RaumNr", "Raum Nr", "Gebäude"])
    sheet.append(["A/B", "Melder", "1. OG", "5", 5, "Haus:1"])
    sheet["E2"].number_format = "000"
    sheet.append(["C", "Schalter", "1. OG", "UG-20-2 Lager unten"])
    sheet.append(["D", "Schalter", "1. OG", "nicht_definiert"])
    sheet.append(["E", "Schalter", "1. OG", None, date(2026, 11, 23)])
    sheet.append(["F", "Schalter", "1. OG", "5.03.2 Schacht", date(2002, 3, 5)])
    sheet.append(["G", "Schalter", "1. OG", date(2026, 11, 23)])
    path = tmp_path / "export.xlsx"
    book.save(path)
    model = parse_nova(path)
    rooms = [e for e in model.elements if e.ifc_class == "NovaRaumbezug"]
    assert [(e.number, e.name) for e in rooms] == [("005", "005"), ("UG-20-2", "Lager unten"), ("5.03.2", "Schacht")]
    assert model.elements[5].room_ids == []
    assert "/" not in model.elements[0].id and "/" not in rooms[0].id
    assert model.elements[3].room_ids == []
    assert any("Datumsformat" in m for m in model.warnings)


def test_no_room_model_in_guide_or_corrupt_workbook(tmp_path):
    path = write_book(tmp_path, [["Klasse", "PSet", "Attribut", "Pflichtfeld"], ["IfcSpace", "", "Name", "ja"]])
    with pytest.raises(ValueError, match="Keine NOVA-Objektliste"):
        parse_nova(path)
    path.write_bytes(b'Keine Excel-Datei')
    with pytest.raises(ValueError, match="XLSX"):
        parse_nova(path)


def test_multiple_object_sheets_require_an_explicit_choice(tmp_path):
    rows = [["Index", "Klasse", "Raumnummer"], ["A", "Bauteil", "002"]]
    with pytest.raises(ValueError, match="Mehrere NOVA-Objektlisten"):
        parse_nova(write_book(tmp_path, rows, extra=rows))


def test_names_without_a_number_do_not_generate_rooms(tmp_path):
    path = write_book(tmp_path, [
        ["Index", "Klasse", "A_RaumNr", "Geschoss"], ["A", "Gerät", "WC Damen", "EG"]
    ])
    model = parse_nova(path)
    assert len(model.elements) == 1
    assert model.elements[0].room_ids == []
