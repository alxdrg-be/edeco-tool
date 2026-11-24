"""An opt-in CAD source is copied intact, not reflowed or recoloured."""

from hashlib import sha256
from pathlib import Path
from collections import Counter

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


def _rendered_line_styles(document):
    from ezdxf.addons.drawing import Frontend, RenderContext
    from ezdxf.addons.drawing.recorder import Recorder

    class Capture(Recorder):
        def __init__(self):
            super().__init__()
            self.line_styles = []

        def draw_line(self, start, end, properties):
            self.line_styles.append((properties.color, properties.lineweight))
            super().draw_line(start, end, properties)

        def draw_solid_lines(self, lines, properties):
            lines = list(lines)
            self.line_styles.extend([(properties.color, properties.lineweight)] * len(lines))
            super().draw_solid_lines(lines, properties)

    capture = Capture()
    Frontend(RenderContext(document), capture).draw_layout(document.modelspace(), finalize=True)
    return Counter(capture.line_styles)


def _layer_source(path):
    source = ezdxf.new("R2013", units=4)
    source.layers.get("0").dxf.true_color = 0x334455
    source.layers.get("0").dxf.lineweight = 35
    source.layers.new("X_Geometrie", dxfattribs={"color": 3, "true_color": 0x22AA55, "lineweight": 50})
    source.modelspace().add_line((0, 0), (20, 0))
    source.modelspace().add_line((0, 10), (20, 10), dxfattribs={"layer": "X_Geometrie"})
    inner = source.blocks.new("NestedZero")
    inner.add_line((0, 0), (20, 0))
    inner.add_line((0, 5), (20, 5), dxfattribs={"color": 0, "lineweight": -2})
    outer = source.blocks.new("ParentZero")
    outer.add_blockref("NestedZero", (0, 0), dxfattribs={"color": 0, "lineweight": -2})
    source.modelspace().add_blockref("ParentZero", (0, 20),
                                   dxfattribs={"layer": "X_Geometrie", "color": 1, "lineweight": 70})
    source.saveas(path)
    return source


def test_cad_layers_keep_source_styles_nested_inheritance_and_project_layers(tmp_path, monkeypatch):
    from nova_legend.legend.export import _import_general

    monkeypatch.setenv("NOVA_LEGENDEN_HOME", str(tmp_path / "home"))
    path = tmp_path / "source.dxf"
    source = _layer_source(path)
    source_bytes = path.read_bytes()
    expected = _rendered_line_styles(source)
    assert expected == Counter({("#334455", .35): 1, ("#22aa55", .5): 2, ("#ff0000", .7): 1})

    target = ezdxf.new("R2013", units=4)
    target.layers.get("0").dxf.color = 6
    target.layers.get("0").dxf.lineweight = 18
    target.layers.new("X_Geometrie", dxfattribs={"color": 5, "lineweight": 13})
    target.modelspace().add_line((100, 0), (120, 0))
    target.modelspace().add_line((100, 10), (120, 10), dxfattribs={"layer": "X_Geometrie"})
    project_styles = _rendered_line_styles(target)
    original_layers = {name: target.layers.get(name).dxf.all_existing_dxf_attribs().copy() for name in ("0", "X_Geometrie")}

    part = general.load(str(path), 190, None, mode="cad")
    _import_general(target, target.modelspace(), part, 0, 0)
    assert _rendered_line_styles(target) == expected + project_styles
    for name in original_layers:
        assert target.layers.get(name).dxf.all_existing_dxf_attribs() == original_layers[name]
    nested = target.blocks["NestedZero"]
    assert all(entity.dxf.layer == "0" for entity in nested)
    assert nested[0].dxf.color == 256 and nested[0].dxf.lineweight == -1
    assert nested[1].dxf.color == 0 and nested[1].dxf.lineweight == -2
    wrapper = target.blocks["Allgemeinteil"]
    assert all(entity.dxf.layer.startswith("NL_CAD_") for entity in wrapper)
    assert path.read_bytes() == source_bytes


def test_flow_fallback_does_not_remap_existing_layer_contract(tmp_path, monkeypatch):
    from nova_legend.legend.export import _import_general

    monkeypatch.setenv("NOVA_LEGENDEN_HOME", str(tmp_path / "home"))
    path = tmp_path / "flow.dxf"
    _layer_source(path)
    part = general.load(str(path), 190, None, mode="flow")
    target = ezdxf.new("R2013", units=4)
    target.layers.new("X_Geometrie", dxfattribs={"color": 5, "lineweight": 13})
    _import_general(target, target.modelspace(), part, 0, 0)
    assert not any(layer.dxf.name.startswith("NL_CAD_") for layer in target.layers)
    assert target.layers.get("X_Geometrie").dxf.color == 5
    assert target.layers.get("X_Geometrie").dxf.lineweight == 13


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
