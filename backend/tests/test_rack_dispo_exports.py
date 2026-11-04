"""Real output checks: dimensions, paper, ports and untrusted project data."""

from copy import deepcopy
from io import BytesIO, StringIO
import csv
import json
import math
from xml.etree import ElementTree as ET

import ezdxf
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pypdf import PdfReader
import pytest

from edeco_toolbox.tools.rack_dispo.api import MAX_BODY_BYTES, PREFIX, register
from edeco_toolbox.tools.rack_dispo.model import ExportRequest, HE_MM, PANEL_WIDTH_MM
from edeco_toolbox.tools.rack_dispo.render import dxf_bytes, pdf_bytes, scenes, svg_bytes


def document():
    rack = {"id": "rack-a", "label": "0.3 · UKV", "units": 42, "widthMm": 800, "heightMm": 2100, "depthMm": 1000, "usableDepthMm": None, "frontDoorClearanceMm": None, "rearDoorClearanceMm": None, "weightLimitKg": None, "powerBudgetW": None, "room": "UG", "notes": ""}
    profile = {"id": "panel24", "name": "Patchpanel 24 Ports", "kind": "patch", "units": 1, "depthMm": None, "inwardCableMm": None, "outwardCableMm": None, "weightKg": None, "powerW": None, "loadLimitKg": None, "portCount": 24, "medium": "RJ45", "manufacturer": "", "article": "", "source": "Eigener generischer Planungsbaustein", "verified": False}
    placement = {"id": "patch-a", "rackId": "rack-a", "profileId": "panel24", "label": "Panel A", "startUnit": 40, "side": "front", "status": "planned", "delivery": "open", "montage": "open", "notes": "", "supportedById": None, "zeroStartMm": None, "zeroHeightMm": None, "zeroInwardOffsetMm": None}
    return {"version": 1, "name": "Rack Planung", "room": "UG", "author": "Dür'g(er)", "index": "A", "date": "2026-11-04", "racks": [rack], "profiles": [profile], "placements": [placement], "ports": []}


def request(doc=None, **kwargs):
    return ExportRequest.model_validate({"document": doc or document(), "views": ["front"], "format": "svg", **kwargs})


@pytest.fixture
def client():
    app = FastAPI()
    register(app)
    with TestClient(app) as result:
        yield result


def test_svg_is_own_mm_vector_with_24_then_48_ports_and_no_external_assets():
    doc = document()
    doc["racks"][0]["label"] = 'Rack <script>alert("x")</script> & Prüfen'
    doc["placements"][0]["label"] = "https://remote.invalid/secret.svg"
    tree = ET.fromstring(svg_bytes(request(doc)))
    assert tree.attrib["width"].endswith("mm")
    assert len(tree.findall('.//*[@data-role="port"]')) == 24
    assert not tree.findall(".//{http://www.w3.org/2000/svg}script")
    assert not tree.findall(".//{http://www.w3.org/2000/svg}image")
    assert "<script>" not in svg_bytes(request(doc)).decode()
    assert not any("href" in key for node in tree.iter() for key in node.attrib)
    doc["profiles"][0]["portCount"] = 48
    doc["profiles"][0]["units"] = 2
    tree = ET.fromstring(svg_bytes(request(doc)))
    ports = tree.findall('.//*[@data-role="port"]')
    assert len(ports) == 48
    assert len({port.attrib["y"] for port in ports}) == 2


def test_drawing_colours_preserve_source_metadata_in_vector_pdf_and_cad():
    doc = document()
    doc["racks"][0]["metadata"] = {"drawingFill": "#AABBCC"}
    doc["profiles"][0].update(kind="switch", metadata={"drawingFill": "#FFFF00"})
    doc["placements"].append({**doc["placements"][0], "id": "collision", "label": "Konflikt"})
    payload = request(doc)
    tree = ET.fromstring(svg_bytes(payload))
    assert tree.find('.//*[@data-role="cabinet"]').attrib["fill"] == "#aabbcc"
    assert tree.find('.//*[@data-role="mounting-field"]').attrib["fill"] == "#ffffff"
    faces = tree.findall('.//*[@data-role="device"]')
    assert [face.attrib["fill"] for face in faces] == ["#ffff00", "#ffff00"]
    assert faces[0].attrib["stroke"] == "#222222"
    assert faces[1].attrib["stroke"] != "#222222"  # only conflict outline changes
    assert all(port.attrib["stroke"] == "#222222" for port in tree.findall('.//*[@data-role="port"]'))
    reader = PdfReader(BytesIO(pdf_bytes(payload)))
    operators = reader.pages[0].get_contents().get_data().decode("ascii")
    assert "0.6667 0.7333 0.8000 rg" in operators
    assert "1.0000 1.0000 0.0000 rg" in operators
    cad = ezdxf.read(StringIO(dxf_bytes(payload).decode("utf-8")))
    assert next(hatch for hatch in cad.modelspace().query("HATCH") if hatch.dxf.layer == "CABINET").dxf.true_color == 0xAABBCC
    assert all(hatch.dxf.true_color == 0xFFFF00 for hatch in cad.modelspace().query("HATCH") if hatch.dxf.layer == "DEVICES")
    # No project marking means neutral white, including switches. Invalid
    # metadata cannot become CSS URLs or copy the dark application's colours.
    doc["racks"][0]["metadata"]["drawingFill"] = "url(https://external.invalid/x)"
    doc["profiles"][0]["metadata"]["drawingFill"] = "not-a-colour"
    neutral = scenes(request(doc))[0]
    assert next(shape for shape in neutral.shapes if shape.role == "cabinet").fill == "#cccccc"
    assert all(shape.fill == "#ffffff" for shape in neutral.shapes if shape.role == "device")
    doc["racks"][0]["metadata"]["drawingFill"] = "#000000"
    doc["profiles"][0]["metadata"]["drawingFill"] = "#111111"
    dark = scenes(request(doc))[0]
    assert next(shape for shape in dark.shapes if shape.role == "cabinet").color == "#ffffff"
    assert all(shape.color == "#ffffff" for shape in dark.shapes if shape.role == "port")
    assert all(shape.fill == "#111111" for shape in dark.shapes if shape.role == "device")
    assert next(shape for shape in dark.shapes if shape.role == "mounting-field").fill == "#ffffff"


def test_sides_removed_objects_and_zero_he_have_real_positions():
    doc = document()
    rear = {**doc["placements"][0], "id": "rear-panel", "side": "rear", "label": "Rückseite"}
    removed = {**doc["placements"][0], "id": "removed-panel", "status": "removed"}
    doc["placements"].extend([rear, removed])
    zero_profile = {**doc["profiles"][0], "id": "pdu", "name": "PDU", "kind": "pdu", "units": 0, "portCount": 0}
    doc["profiles"].append(zero_profile)
    zero = {**doc["placements"][0], "id": "zero-pdu", "profileId": "pdu", "side": "zero-rear", "zeroStartMm": 100, "zeroHeightMm": 900, "zeroInwardOffsetMm": 5}
    doc["placements"].append(zero)
    front, back = scenes(request(doc, views=["front", "rear"]))
    assert sum(s.role == "device" for s in front.shapes) == 1
    assert sum(s.role == "device" for s in back.shapes) == 1
    assert sum(s.role == "zero-he" for s in front.shapes) == 0
    zero_rect = next(s for s in back.shapes if s.role == "zero-he")
    rail_bottom = 70 + (2100 - 42 * HE_MM) / 2 + 42 * HE_MM
    assert zero_rect.y == pytest.approx(rail_bottom - 100 - 900)
    front_port_x = [s.x for s in front.shapes if s.role == "port"]
    rear_port_x = [s.x for s in back.shapes if s.role == "port"]
    assert front_port_x == sorted(front_port_x)
    # Rear is a device mounted at the rear, viewed from its own connector face.
    assert rear_port_x == sorted(rear_port_x)


def test_pdf_is_a4_searchable_with_explicit_scale_and_full_labels():
    doc = document()
    doc["placements"][0]["label"] = "Vollständige Gerätebeschriftung " * 12
    reader = PdfReader(BytesIO(pdf_bytes(request(doc, views=["front", "rear"]))))
    assert len(reader.pages) == 4  # each selected view plus readable appendix
    for page in reader.pages:
        assert float(page.mediabox.width) == pytest.approx(210 * 72 / 25.4)
        assert float(page.mediabox.height) == pytest.approx(297 * 72 / 25.4)
    first = reader.pages[0].extract_text()
    assert "Massstab 1:10" in first
    assert "Vorderansicht" in first
    assert "Rückansicht" in reader.pages[2].extract_text()
    text = " ".join(page.extract_text() for page in reader.pages)
    assert "44.45" in text and "482.6" in text
    assert "Gerätebeschriftung" in text
    assert "keine Ausführungsfreigabe" in str(reader.metadata.subject)
    for page in reader.pages:
        assert "/XObject" not in page["/Resources"]  # genuine vector operators


def test_pdf_retains_planning_notes_and_uses_german_work_status_and_zero_zone_labels():
    doc = document()
    doc["racks"][0]["notes"] = "Serviceraum links freihalten."
    doc["placements"][0].update(notes="Beschriftung mit Bauleitung abstimmen.", delivery="delivered", montage="done")
    doc["profiles"].append({**doc["profiles"][0], "id": "pdu", "name": "PDU", "kind": "pdu", "units": 0, "portCount": 0})
    doc["placements"].append({**doc["placements"][0], "id": "zero-pdu", "profileId": "pdu", "label": "Steckdosenleiste", "side": "zero-rear", "status": "existing", "delivery": "not-required", "montage": "ordered", "notes": "Rückwärtigen Anschluss prüfen."})
    reader = PdfReader(BytesIO(pdf_bytes(request(doc, views=["front", "rear"]))))
    text = " ".join(" ".join(page.extract_text().split()) for page in reader.pages)
    for expected in ["Rack-Notiz: Serviceraum links freihalten.", "Geräte-Notiz: Beschriftung mit Bauleitung abstimmen.", "Lieferung: Geliefert", "Montage: Erledigt", "Geplant", "Bestand", "Lieferung: Nicht erforderlich", "Montage: Bestellt", "0-HE-Zone rückwärtig", "Rückwärtigen Anschluss prüfen."]:
        assert expected in text
    assert "zero-rear" not in text
    assert "planned" not in text


def test_dxf_r2013_is_actual_mm_not_pdf_paper_scale():
    cad = ezdxf.read(StringIO(dxf_bytes(request()).decode("utf-8")))
    assert cad.dxfversion == "AC1027"
    assert cad.units == 4
    cabinet = next(entity for entity in cad.modelspace().query("LWPOLYLINE") if entity.dxf.layer == "CABINET")
    points = list(cabinet.get_points())
    assert max(p[0] for p in points) - min(p[0] for p in points) == 800
    assert max(p[1] for p in points) - min(p[1] for p in points) == 2100
    face = next(entity for entity in cad.modelspace().query("LWPOLYLINE") if entity.dxf.layer == "DEVICES")
    points = list(face.get_points())
    assert max(p[0] for p in points) - min(p[0] for p in points) == pytest.approx(PANEL_WIDTH_MM)
    assert max(p[1] for p in points) - min(p[1] for p in points) == pytest.approx(HE_MM)
    assert len([entity for entity in cad.modelspace().query("LWPOLYLINE") if entity.dxf.layer == "PORTS_RJ45"]) == 24
    assert not cad.modelspace().query("IMAGE INSERT PDFUNDERLAY")
    assert cad.header["$EXTMAX"][0] > cad.header["$EXTMIN"][0]


def test_multiple_racks_are_selected_without_mutating_or_moving_conflicts():
    doc = document()
    doc["racks"].append({**doc["racks"][0], "id": "rack-b", "label": "Rack B"})
    doc["placements"].append({**doc["placements"][0], "id": "collision", "label": "Kollision"})
    original = deepcopy(doc)
    drawings = scenes(request(doc, rack_ids=["rack-a"], views=["front", "rear"]))
    assert len(drawings) == 2
    assert any("überlagerter" in warning for warning in drawings[0].warnings)
    assert sum(s.role == "device" for s in drawings[0].shapes) == 2
    assert doc == original
    assert len(scenes(request(doc, views=["front", "rear"]))) == 4


def test_export_reports_actual_depth_door_weight_and_power_without_assumed_defaults():
    doc = document()
    doc["racks"][0].update(usableDepthMm=500, frontDoorClearanceMm=20, weightLimitKg=5, powerBudgetW=100)
    doc["profiles"][0].update(depthMm=300, inwardCableMm=40, outwardCableMm=50, weightKg=10, powerW=120)
    doc["placements"].append({**doc["placements"][0], "id": "rear-device", "side": "rear"})
    warnings = scenes(request(doc))[0].warnings
    assert any("Tiefenkollision (680 > 500 mm)" in item for item in warnings)
    assert any("50 mm Kabelraum" in item for item in warnings)
    assert any("Summe 20 kg" in item for item in warnings)
    assert any("Summe 240 W" in item for item in warnings)
    doc["profiles"][0]["weightKg"] = None
    warnings = scenes(request(doc))[0].warnings
    assert any("2 Geräteangabe(n) offen" in item for item in warnings)
    assert not any("Summe 0 kg" in item for item in warnings)


def test_zero_he_cable_space_collides_and_inner_door_sum_is_not_outer_depth():
    doc = document()
    doc["racks"][0].update(usableDepthMm=500, frontDoorClearanceMm=30, rearDoorClearanceMm=30, depthMm=550)
    doc["profiles"][0].update(depthMm=100, inwardCableMm=30, outwardCableMm=0)
    doc["placements"][0].update(startUnit=1, side="rear")
    doc["profiles"].append({**doc["profiles"][0], "id": "pdu", "name": "PDU", "kind": "pdu", "units": 0, "portCount": 0, "depthMm": 10, "inwardCableMm": 20})
    doc["placements"].append({**doc["placements"][0], "id": "zero-pdu", "label": "PDU", "profileId": "pdu", "side": "zero-rear", "zeroStartMm": 0, "zeroHeightMm": 50, "zeroInwardOffsetMm": 350})
    warnings = scenes(request(doc, views=["rear"]))[0].warnings
    assert any("560 mm überschreiten die Gehäusetiefe 550 mm" in item for item in warnings)
    assert any("0-HE-Zubehör überschneidet den Geräte-/Kabelraum" in item for item in warnings)
    doc["profiles"][1]["inwardCableMm"] = 0
    assert not any("0-HE-Zubehör überschneidet den Geräte-/Kabelraum" in item for item in scenes(request(doc, views=["rear"]))[0].warnings)


@pytest.mark.parametrize("edit", [
    lambda d: d["racks"][0].update(widthMm=math.nan),
    lambda d: d["racks"][0].update(widthMm=0),
    lambda d: d["racks"][0].update(units=True),
    lambda d: d["placements"][0].update(profileId="missing"),
    lambda d: d["placements"][0].update(id="rack-a"),
    lambda d: d["placements"][0].update(startUnit=1.5),
    lambda d: d.update(version=True),
    lambda d: d["profiles"][0].update(svg='<svg onload="bad()"/>'),
    lambda d: d["ports"].append({"placementId": "patch-a", "number": 25, "label": "", "target": "", "outlet": "", "room": "", "state": "built"}),
    lambda d: d.update(metadata={"__proto__": {"bad": True}}),
    lambda d: d["racks"][0].update(label="NUL\u0000Text"),
])
def test_api_rejects_invalid_numbers_references_and_untrusted_fields(client, edit):
    doc = document()
    edit(doc)
    result = client.post(PREFIX + "/export", content=json.dumps({"document": doc, "format": "svg"}), headers={"Content-Type": "application/json"})
    assert result.status_code == 422


def test_api_returns_real_attachments_and_csv_unknown_is_not_zero(client):
    doc = document()
    doc["placements"][0]["label"] = '=HYPERLINK("https://example.invalid")'
    for format, expected in [("svg", b"<svg"), ("pdf", b"%PDF"), ("dxf", b"SECTION")]:
        result = client.post(PREFIX + "/export", json={"document": doc, "format": format, "views": ["front"]})
        assert result.status_code == 200
        assert expected in result.content[:150]
        assert "attachment; filename=" in result.headers["content-disposition"]
        assert result.headers["cache-control"] == "no-store"
    result = client.post(PREFIX + "/export", json={"document": doc, "format": "bom-csv", "views": ["front"]})
    rows = list(csv.reader(StringIO(result.content.decode("utf-8-sig")), delimiter=";"))
    assert rows[1][1].startswith("'=")
    assert rows[1][-3:] == ["", "", ""]
    result = client.post(PREFIX + "/export", json={"document": doc, "format": "ports-csv", "views": ["front"]})
    rows = list(csv.reader(StringIO(result.content.decode("utf-8-sig")), delimiter=";"))
    assert len(rows) == 25
    assert all(row[-1] == "unknown" for row in rows[1:])


def test_api_limits_payload_and_selection(client):
    assert client.post(PREFIX + "/export", content=b" " * (MAX_BODY_BYTES + 1)).status_code == 413
    assert client.post(PREFIX + "/export", json={"document": document(), "format": "svg", "rack_ids": ["absent"]}).status_code == 422
    assert client.post(PREFIX + "/export", json={"document": document(), "format": "svg", "views": ["front", "front"]}).status_code == 422


def test_export_uses_toolhub_session_and_origin_protection():
    from edeco_toolbox.local_security import register as register_security

    app = FastAPI()
    register_security(app)
    register(app)
    payload = {"document": document(), "format": "svg", "views": ["front"]}
    with TestClient(app, base_url="http://127.0.0.1") as local:
        assert local.post(PREFIX + "/export", json=payload).status_code == 403
        local.get("/api/toolbox/session")
        assert local.post(PREFIX + "/export", json=payload).status_code == 200
        assert local.post(PREFIX + "/export", json=payload, headers={"Origin": "https://other.invalid"}).status_code == 403
        assert local.post(PREFIX + "/export", json=payload, headers={"Host": "attacker.invalid"}).status_code == 403
