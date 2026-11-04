"""Realistic CAD template roles, readable geometry and variable-height export."""

from contextlib import closing
from io import BytesIO

import ezdxf
import pypdfium2 as pdfium
import pytest

from nova_legend.legend.export import build_dxf
from nova_legend.legend.general import _row_colors, _row_svg, load, system_colors
from nova_legend.legend.layout import layout
from nova_legend.legend.model import default_style, empty_doc, normalize, section_style
from nova_legend.legend.pdf import build_pdf


def company_template(path):
    """Synthetic equivalent of the uploaded file's role/scale corner cases.

    No customer blocks or project identifiers are included. The group heading
    intentionally uses the same x and font size as every ordinary row.
    """
    doc = ezdxf.new("R2013", units=4)
    doc.layers.add("E_Licht", true_color=0x0080FF)
    doc.linetypes.add("DASH", pattern=[3, 2, -1])
    msp = doc.modelspace()
    labels = ["UP-Deckenleitung", "UP-Bodenleitung", "Verteilung", "Decke / Wand",
              "Farbcodes", "Lichtinstallation", "Kraftinstallation"]
    for index, label in enumerate(labels):
        msp.add_text(label, height=2).set_placement((25, 40 - index * 5))
    msp.add_spline([(5, 40), (10, 41.2), (15, 40)], dxfattribs={"layer": "E_Licht"})
    msp.add_spline([(5, 35), (10, 36.2), (15, 35)], dxfattribs={"layer": "E_Licht", "linetype": "DASH"})
    box = doc.blocks.new("Box")
    box.add_lwpolyline([(0, 0), (4, 0), (4, 1.5), (0, 1.5)], close=True, dxfattribs={"color": 0})
    msp.add_blockref("Box", (7, 30), dxfattribs={"layer": "E_Licht"})
    msp.add_blockref("Box", (5, 25), dxfattribs={"layer": "E_Licht"})
    msp.add_blockref("Box", (12, 25), dxfattribs={"layer": "E_Licht"})
    for y, color in [(15, 0x0099FF), (10, 0xFF0000)]:
        msp.add_solid([(5, y), (14, y), (5, y + 1), (14, y + 1)], dxfattribs={"true_color": color})
    doc.saveas(path)
    return path


def test_same_column_heading_small_chips_and_shallow_cable_curves_are_read_correctly(tmp_path):
    part = load(str(company_template(tmp_path / "general.dxf")), 190, None)
    rows = {row["text"]: row for row in part.rows}
    assert rows["Farbcodes"]["heading"] is True
    assert rows["Lichtinstallation"]["picture"] == "swatch"
    assert rows["Lichtinstallation"]["swatch"] == "#0099ff"
    assert rows["Kraftinstallation"]["swatch"] == "#ff0000"
    assert rows["UP-Deckenleitung"]["picture"] == rows["UP-Bodenleitung"]["picture"] == "line"
    assert rows["Verteilung"]["picture"] == "symbol"
    assert rows["Verteilung"]["colors"][0] == "#0080ff"
    assert system_colors(part, {"licht": "#123456", "kraft": "#654321"}) == {
        "#0099ff": "#123456", "#ff0000": "#654321"}
    assert len(rows["UP-Bodenleitung"]["svg"]) > 100


def test_general_and_apparatus_texts_align_and_palette_finishes_the_content(tmp_path):
    part = load(str(company_template(tmp_path / "general.dxf")), 190, None)
    doc = empty_doc("Legende")
    doc["style"].update(compact_flow=False, columns=2)
    doc["blocks"] = [{"id": "b", "title": "Apparate", "style": section_style("#0099ff"),
                      "items": [{"id": "i", "kind": "note", "text": "Weiteres Symbol"}]}]
    placed = layout(doc, {}, part.info())
    texts = {p["text"]: p for p in placed["prims"] if p["t"] == "text"}
    assert texts["UP-Deckenleitung"]["x"] == pytest.approx(texts["Weiteres Symbol"]["x"])
    assert texts["Farbcodes"]["y"] < texts["Weiteres Symbol"]["y"]
    assert texts["Farbcodes"]["y"] < texts["Lichtinstallation"]["y"]
    assert texts["Lichtinstallation"]["y"] == texts["Kraftinstallation"]["y"]
    general_row = next(row for row in part.rows if row["text"] == "Verteilung")
    glyph = next(p for p in placed["prims"] if p["t"] == "grow" and p["row"] == general_row["id"])
    assert glyph["w"] > 4 and glyph["h"] > 1.5
    lines = [p for p in placed["prims"] if p["t"] == "grow" and p["row"] in ("g0", "g1")]
    assert all(p["w"] >= 12 for p in lines)  # full readable corridor, not a four-mm square
    assert placed["height"] < 150


def test_nested_byblock_and_layer_zero_resolve_like_drawing_but_keep_true_white_fill():
    doc = ezdxf.new("R2013")
    doc.layers.add("Blue", true_color=0x0080FF)
    inner = doc.blocks.new("Inner")
    inner.add_line((0, 0), (4, 0), dxfattribs={"color": 0})
    inner.add_line((0, 1), (4, 1), dxfattribs={"color": 256})
    inner.add_solid([(0, 0), (1, 0), (0, 1), (1, 1)], dxfattribs={"true_color": 0xFFFFFF})
    outer = doc.blocks.new("Outer")
    outer.add_blockref("Inner", (0, 0), dxfattribs={"color": 0})
    insert = doc.modelspace().add_blockref("Outer", (0, 0), dxfattribs={"layer": "Blue"})
    assert _row_colors(doc, [insert])[0] == "#0080ff"
    _, svg = _row_svg(doc, [insert], (0, 0, 4, 1))
    assert "#0080ff" in svg and "#ffffff" in svg
    # CAD foreground adapts to white paper, while explicit red remains red.
    black = doc.modelspace().add_line((0, 0), (4, 0), dxfattribs={"color": 7})
    red = doc.modelspace().add_line((0, 1), (4, 1), dxfattribs={"true_color": 0xFF0000})
    _, svg = _row_svg(doc, [black, red], (0, 0, 4, 1))
    assert "#000000" in svg and "#ff0000" in svg


def test_default_font_is_larger_old_project_value_is_kept_and_pdf_has_no_a4_filler():
    assert default_style()["text_size"] == 2.8
    assert normalize({"style": {"text_size": 2.5}})["style"]["text_size"] == 2.5
    doc = empty_doc("Kurze Legende")
    placed = layout(doc)
    dxf = build_dxf(placed, None, lambda _prim: None)
    data = build_pdf(dxf, placed["width"], placed["height"])
    with pdfium.PdfDocument(BytesIO(data)) as pdf, closing(pdf[0]) as page:
        width, height = page.get_size()
        assert width * 25.4 / 72 == pytest.approx(210, abs=.1)
        assert height * 25.4 / 72 < 60


def test_conductor_and_endpoint_stay_together_but_an_apparatus_leader_is_not_a_symbol(tmp_path):
    doc = ezdxf.new("R2013", units=4)
    msp = doc.modelspace()
    for label, y in [("Leitung von/nach OBEN", 30), ("Apparat", 20), ("Hinweis", 10)]:
        msp.add_text(label, height=2).set_placement((25, y))
    for y in (30, 20):
        msp.add_line((3, y + .7), (18, y + .7))
        msp.add_circle((3, y + .7), .7)
    file = tmp_path / "endpoints.dxf"
    doc.saveas(file)
    rows = {row["text"]: row for row in load(str(file), 190, None).rows}
    assert rows["Leitung von/nach OBEN"]["picture"] == "line"
    assert rows["Leitung von/nach OBEN"]["gw"] > 15
    assert rows["Apparat"]["picture"] == "symbol"
    assert rows["Apparat"]["gw"] == pytest.approx(1.4)
