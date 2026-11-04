"""Readable long CAD symbols, reversible source appearance and multi-column templates."""
from copy import deepcopy

import ezdxf
import pytest

from nova_legend.legend.general import load, system_colors
from nova_legend.legend.layout import layout
from nova_legend.legend.model import normalize, section_style


def apparatus_doc(columns=4, fit="corridor"):
    return normalize({"style": {"compact_flow": True, "columns": columns, "text_size": 2.8,
                                "grid": "dicht", "symbol_fit": fit},
                      "blocks": [{"id": "light", "title": "Licht", "style": section_style("#0099ff"),
                                  "items": [{"id": key, "symbol_key": key, "color": "#0099ff", "text": key}
                                            for key in ("long", "round", "vertical", "pair")]}]})


@pytest.mark.parametrize("columns", [3, 4])
def test_long_luminaire_uses_corridor_while_round_symbol_and_sources_stay_readable(columns):
    doc = apparatus_doc(columns)
    pair = doc["blocks"][0]["items"][-1]
    pair["layer_colors"] = ["#0099ff", "#ff0000"]
    before = deepcopy(doc)
    sizes = {"long": (-15, -.25, 15, .25, False), "round": (-2, -2, 2, 2, False),
             "vertical": (-.5, -5, .5, 5, False), "pair": (-2, -2, 2, 2, False)}
    result = layout(doc, sizes)
    glyphs = [p for p in result["prims"] if p["t"] == "symbol"]
    long = next(p for p in glyphs if p["id"] == "long")
    round_glyph = next(p for p in glyphs if p["id"] == "round")
    assert long["w"] > 12 and long["h"] > .2
    assert round_glyph["h"] > 4
    pairs = [p for p in glyphs if p["id"] == "pair"]
    assert len(pairs) == 2 and {p["color"] for p in pairs} == {"#0099ff", "#ff0000"}
    assert all(p["h"] > 4 for p in pairs)
    hits = {p["id"]: p for p in result["prims"] if p["t"] == "hit" and p["kind"] == "item"}
    texts = {p["item"]: p for p in result["prims"] if p["t"] == "text" and p.get("item")}
    for glyph in glyphs:
        hit = hits[glyph["id"]]
        assert glyph["x0"] >= hit["x"] - .001
        assert glyph["x0"] + glyph["w"] < texts[glyph["id"]]["x"]
        assert glyph["y0"] >= hit["y"] - .001
        assert glyph["y0"] + glyph["h"] <= hit["y"] + hit["h"] + .001
    assert doc == before
    # Opening an old stored legend keeps its square fit and source orientation.
    old = apparatus_doc(columns, "square")
    old_long = next(p for p in layout(old, sizes)["prims"] if p["t"] == "symbol" and p["id"] == "long")
    assert old_long["w"] < 4.2
    doc["blocks"][0]["items"][2]["rotation"] = 90
    turned = next(p for p in layout(doc, sizes)["prims"] if p["t"] == "symbol" and p["id"] == "vertical")
    assert turned["rot"] == 90 and turned["w"] > 12
    assert all(p["rot"] == 0 for p in glyphs)


def test_general_source_look_is_a_reversible_document_choice_without_global_reset():
    general = {"rows": [{"id": "arrow", "text": "Leitung von/nach OBEN", "picture": "symbol",
                          "gw": 18, "gh": 2, "rotation": 45, "symbol_factor": 2, "text_scale": 1.5},
                         {"id": "rack", "text": "Rack", "picture": "symbol", "gw": 8, "gh": 8,
                          "symbol_factor": 2}]}
    original = deepcopy(general)
    doc = apparatus_doc()
    doc["style"]["general_source_look"] = True
    placed = layout(doc, {}, general)
    grows = [p for p in placed["prims"] if p["t"] == "grow"]
    assert len(grows) == 2 and all(p["rot"] == 0 for p in grows)
    assert all(p["h"] <= 4.15 for p in grows)
    assert grows[0]["w"] > 12
    assert general == original
    doc["style"]["general_source_look"] = False
    rotated = next(p for p in layout(doc, {}, general)["prims"] if p["t"] == "grow" and p["row"] == "arrow")
    assert rotated["rot"] == 45 and rotated["h"] <= 4.15
    assert rotated["draw_w"] > rotated["w"]  # pre-rotation graphic size is retained for the SVG transform


def test_multiple_caption_columns_keep_all_rows_and_nested_colour_bars(tmp_path):
    drawing = ezdxf.new("R2013", units=4)
    ms = drawing.modelspace()
    for column, x in enumerate((25, 125)):
        for index in range(5):
            y = 80 - index * 6
            ms.add_text(f"Apparat {column}-{index}", height=2).set_placement((x, y))
            ms.add_circle((x - 10, y + .7), 1.5, dxfattribs={"true_color": 0x0099FF})
    ms.add_text("Farbcodes", height=2).set_placement((100, 40))
    bar = drawing.blocks.new("filled-colour-chip")
    bar.add_solid([(0, 0), (8, 0), (0, 1), (8, 1)], dxfattribs={"color": 0})
    wrapper = drawing.blocks.new("nested-colour-chip")
    wrapper.add_blockref(bar.name, (0, 0), dxfattribs={"color": 0})
    codes = [("Lichtinstallation", 0x0099FF), ("Kraftinstallation", 0xFF0000),
             ("BUS / HLKS", 0x0000FF), ("KNX-Installation", 0x00FFFF)]
    for x in (115, 165):
        for index, (label, color) in enumerate(codes):
            y = 33 - index * 6
            ms.add_text(label + (" rechts" if x == 165 else ""), height=2).set_placement((x, y))
            ms.add_blockref(wrapper.name, (x - 10, y + .2), dxfattribs={"true_color": color})
    path = tmp_path / "two-column-template.dxf"
    drawing.saveas(path)
    part = load(str(path), 190, None)
    assert len(part.rows) == 19 and part.columns == 4
    assert {r["text"] for r in part.rows if r["text"].startswith("Apparat")} == {
        f"Apparat {column}-{index}" for column in (0, 1) for index in range(5)}
    chips = [r for r in part.rows if r.get("picture") == "swatch"]
    assert len(chips) == 8 and {r["swatch"] for r in chips} == {"#0099ff", "#ff0000", "#0000ff", "#00ffff"}
    assert "mehrere Textspalten" in part.info()["scope_warning"]
    # BUS/HLKS and KNX are distinct installation systems, not an accidental common map.
    part.rows = [r for r in part.rows if not r["text"].endswith(" rechts")]
    assert system_colors(part, {"hlks": "#3344aa", "knx": "#22cccc"}) == {
        "#0000ff": "#3344aa", "#00ffff": "#22cccc"}


def test_internal_general_labels_and_pair_separator_are_kept_but_outer_leader_note_is_not(tmp_path):
    drawing = ezdxf.new('R2013', units=4)
    ms = drawing.modelspace()
    for label, y in [('Installation zu Gruppe', 30), ('Einlasskasten / Schalungsschoner', 20), ('Hinweis', 10)]:
        ms.add_text(label, height=2).set_placement((25, y))
    ms.add_circle((10, 30.7), 2)
    inner = ms.add_text('L3', height=.7).set_placement((9.5, 30.4))
    ms.add_circle((6, 20.7), 1.5)
    ms.add_circle((14, 20.7), 1.5)
    separator = ms.add_text('/', height=1).set_placement((9.8, 20.3))
    outside = ms.add_text('90°', height=.7).set_placement((1, 30.5))
    file = tmp_path / 'general-notes.dxf'
    drawing.saveas(file)
    rows = {r['text']: r for r in load(str(file), 190, None).rows}
    assert inner.dxf.handle in rows['Installation zu Gruppe']['handles']
    assert outside.dxf.handle not in rows['Installation zu Gruppe']['handles']
    assert separator.dxf.handle in rows['Einlasskasten / Schalungsschoner']['handles']


def test_font_metrics_avoid_stranded_suffixes_and_break_at_existing_hyphens():
    from nova_legend.legend.layout import wrap
    assert wrap('Schliessblechkontakt', 2.8, 27, accurate=True) == ['Schliessblechkontakt']
    assert wrap('Mehrkriterienmelder', 2.8, 27, accurate=True) == ['Mehrkriterienmelder']
    assert wrap('Decken-Rechteckleuchte', 2.8, 27, accurate=True) == ['Decken-', 'Rechteckleuchte']


def test_caption_text_layer_keeps_unicode_search_and_identical_vector_appearance():
    from contextlib import closing
    from PIL import ImageChops
    import pypdfium2 as pdfium
    from nova_legend.legend.pdf import build_pdf
    cad = ezdxf.new('R2013', units=4)
    captions = ['Schliessblechkontakt', 'Öffnung für Türen · 2 mm² · Ω · ≥', 'Drehung 90°']
    for text, y in zip(captions, (20, 13, 5)):
        entity = cad.modelspace().add_text(text, height=2).set_placement((3, y))
        if text.startswith('Drehung'):
            entity.dxf.rotation = 20
    original = build_pdf(cad, 100, 30, searchable=False)
    output = build_pdf(cad, 100, 30)
    images, extracted = [], []
    for data in (original, output):
        with pdfium.PdfDocument(data) as pdf, closing(pdf[0]) as page:
            with closing(page.get_textpage()) as text:
                extracted.append(text.get_text_range())
            with closing(page.render(scale=3)) as bitmap:
                images.append(bitmap.to_pil().convert('RGB'))
    assert extracted[0] == ''
    assert all(caption in extracted[1] for caption in captions)
    assert ImageChops.difference(*images).getbbox() is None
