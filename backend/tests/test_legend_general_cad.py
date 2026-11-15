"""An opt-in CAD source is copied intact, not reflowed or recoloured."""

from hashlib import sha256
from pathlib import Path

import ezdxf
import pytest

from nova_legend.legend import general
from nova_legend.legend.export import build_dxf
from nova_legend.legend.layout import layout
from nova_legend.legend.model import normalize
from test_phase3 import env  # noqa: F401


def drawing(path, prefix="Eigene Leitung"):
    doc = ezdxf.new("R2013", units=4)
    for i in range(5):
        y = 40 - i * 7
        doc.modelspace().add_text(f"{prefix} {i}", dxfattribs={"height": 2, "true_color": 0xFF0000}).set_placement((25, y))
        doc.modelspace().add_line((0, y), (20, y), dxfattribs={"true_color": 0x0088FF})
    doc.saveas(path)
    return path


def test_cad_mode_keeps_original_geometry_and_flow_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("NOVA_LEGENDEN_HOME", str(tmp_path / "home"))
    path = drawing(tmp_path / "general.dxf")
    flow = general.load(str(path), 190, None)
    assert len(flow.rows) == 5
    cad = general.load(str(path), 190, None, mode="cad")
    assert cad.rows == [] and cad.mode == "cad" and len(flow.rows) == 5
    assert cad.texts == flow.texts and cad.source_hash == sha256(path.read_bytes()).hexdigest()
    plan = layout(normalize({"title": {"text": ""}, "blocks": []}), {}, cad.info())
    assert not any(p.get("role") in ("general-marker", "general-rule") or p.get("t") == "grow" for p in plan["prims"])
    result = build_dxf(plan, cad, lambda _: None)
    inserted = result.modelspace().query("INSERT")[0]
    assert inserted.dxf.name == "Allgemeinteil"
    assert inserted.dxf.xscale == pytest.approx(1)
    block = result.blocks["Allgemeinteil"]
    assert [e.dxf.text for e in block.query("TEXT")] == [f"Eigene Leitung {i}" for i in range(5)]
    assert all(e.dxf.true_color == 0xFF0000 and e.dxf.height == 2 for e in block.query("TEXT"))
    assert all(e.dxf.true_color == 0x0088FF and e.dxf.end.x - e.dxf.start.x == 20 for e in block.query("LINE"))


def test_loaded_cad_snapshot_does_not_change_with_shared_source(tmp_path, monkeypatch):
    monkeypatch.setenv("NOVA_LEGENDEN_HOME", str(tmp_path / "home"))
    path = drawing(tmp_path / "general.dxf")
    original = path.read_bytes()
    part = general.load(str(path), 190, None, mode="cad")
    assert Path(part.dxf_path) != path
    drawing(path, "Geaenderte Leitung")
    assert Path(part.dxf_path).read_bytes() == original
    fresh = general.load(str(path), 190, None, mode="cad")
    assert fresh.source_hash != part.source_hash
    assert "geaenderte leitung 0" in fresh.texts


def test_company_cad_mode_ignores_row_overrides_and_exports_without_changing_source(env):
    client, tmp = env
    path = drawing(tmp / "server-vorlage.dxf")
    before = path.read_bytes()
    company = client.app.state.nova.company
    company.set_legend_settings({"legend_general_rows": {"eigene leitung 0": {"text": "Anderer Text", "hidden": True}}})
    response = client.put("/api/company/legend", json={"general_path": str(path), "general_mode": "cad"})
    assert response.status_code == 200, response.text
    assert response.json()["general_mode"] == "cad" and response.json()["general"]["mode"] == "cad"
    preview = client.get("/api/company/general/preview").json()
    assert preview["svg"] and not preview.get("rows")
    assert preview["source_hash"] == sha256(before).hexdigest()
    assert client.get("/api/company/general/export/general.pdf?format=pdf").content.startswith(b"%PDF")
    assert client.get("/api/company/general/export/general.dxf?format=dxf").status_code == 200
    assert client.put("/api/company/legend", json={"general_mode": "bad"}).status_code == 422
    assert path.read_bytes() == before
    assert company.legend_settings()["legend_general_rows"]["eigene leitung 0"]["hidden"] is True


def test_builtin_source_switch_restores_previous_cad_mode(env):
    client, tmp = env
    path = drawing(tmp / "cad.dxf")
    client.put("/api/company/legend", json={"general_path": str(path), "general_mode": "cad"})
    response = client.post("/api/company/general/builtin/apply", json={"expected_source": str(path)})
    assert response.status_code == 200, response.text
    assert client.get("/api/company/legend").json()["general_mode"] == "flow"
    response = client.post("/api/company/general/builtin/restore", json={"expected_source": general.BUILTIN_SOURCE})
    assert response.status_code == 200, response.text
    assert client.get("/api/company/legend").json()["general_mode"] == "cad"
