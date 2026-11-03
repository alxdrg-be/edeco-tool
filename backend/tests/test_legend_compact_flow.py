"""The full-page reference: two-column key, colour key, flowing apparatus."""

from copy import deepcopy

import pytest

from nova_legend.legend.layout import layout
from nova_legend.legend.model import default_style, normalize, propose, section_style


def flow_document(columns=3, amount=24):
    blocks = []
    for section in range(5):
        items = [{"id": f"s{section}-{index}", "symbol_key": "k", "text": f"Apparat {index + 1}",
                  "color": "#0099ff", "layer_colors": ["#0099ff", "#ff0000"] if index == 2 else ["#0099ff"]}
                 for index in range(amount)]
        blocks.append({"id": f"b{section}", "title": f"Abschnitt {section + 1}",
                       "style": section_style("#0099ff"), "items": items})
    return normalize({"style": {"compact_flow": True, "columns": columns, "grid": "dicht"}, "blocks": blocks})


def key():
    rows = [{"id": f"g{index}", "text": f"Allgemein {index}", "picture": "line", "gw": 10, "gh": .2}
            for index in range(22)]
    rows.append({"id": "colors", "text": "Farbcodes", "heading": True})
    rows += [{"id": f"color{index}", "text": f"Farbcode {index + 1}", "picture": "swatch", "swatch": "#ff0000"}
             for index in range(10)]
    return {"rows": rows}


@pytest.mark.parametrize("columns", [2, 3, 4])
def test_all_items_flow_once_with_original_ids_and_indexes_and_no_overlap(columns):
    doc = flow_document(columns)
    original = deepcopy(doc)
    sizes = {item["id"]: (-2, -2, 2, 2, False) for block in doc["blocks"] for item in block["items"]}
    placed = layout(doc, sizes, key())
    assert doc == original
    hits = [p for p in placed["prims"] if p["t"] == "hit" and p["kind"] == "item"]
    assert len(hits) == 120 and len({p["id"] for p in hits}) == 120
    assert {p["id"] for p in hits} == {item["id"] for block in doc["blocks"] for item in block["items"]}
    for block in doc["blocks"]:
        cells = [p for p in placed["prims"] if p["t"] == "cell" and p["block"] == block["id"]]
        assert [p["index"] for p in cells] == list(range(24))
    for index, first in enumerate(hits):
        for second in hits[index + 1:]:
            assert not (first["x"] < second["x"] + second["w"] - .001 and
                        second["x"] < first["x"] + first["w"] - .001 and
                        first["y"] < second["y"] + second["h"] - .001 and
                        second["y"] < first["y"] + first["h"] - .001)
    body_grids = [p for p in placed["prims"] if p["t"] == "grid" and p.get("flow_column") is not None]
    assert len({p["flow_column"] for p in body_grids}) == columns
    assert all(p["cols"] == 1 for p in body_grids)
    assert not any(p.get("role") == "header" for p in placed["prims"])
    assert any(p.get("role") == "header-marker" for p in placed["prims"])
    assert any("(Fortsetzung)" in p["text"] for p in placed["prims"] if p["t"] == "text")


def test_general_is_always_two_columns_palette_five_by_two_and_precedes_apparatus():
    doc = flow_document(3, 2)
    placed = layout(doc, {}, key())
    grids = {p["block"]: p for p in placed["prims"] if p["t"] == "grid"}
    assert grids["general"]["cols"] == 2
    assert grids["general-colors"]["cols"] == 5
    general = [p for p in placed["prims"] if p["t"] == "hit" and p["kind"] == "general-row" and p["id"].startswith("g")]
    colors = [p for p in placed["prims"] if p["t"] == "hit" and p["kind"] == "general-row" and p["id"].startswith("color") and p["id"] != "colors"]
    apparatus = [p for p in placed["prims"] if p["t"] == "hit" and p["kind"] == "item"]
    assert len(general) == 22 and len(colors) == 10
    assert max(p["y"] + p["h"] for p in general) < min(p["y"] for p in colors)
    assert max(p["y"] + p["h"] for p in colors) < min(p["y"] for p in apparatus)
    assert len({p["x"] for p in colors}) == 5
    assert len({p["y"] for p in colors}) == 2


def test_continuation_title_does_not_change_section_title_or_item_color():
    doc = flow_document(3, 90)
    doc["blocks"] = doc["blocks"][:1]
    before = deepcopy(doc)
    placed = layout(doc)
    titles = [p["text"] for p in placed["prims"] if p["t"] == "text" and p["bold"]]
    assert titles == ["Abschnitt 1", "Abschnitt 1 (Fortsetzung)", "Abschnitt 1 (Fortsetzung)"]
    assert doc == before
    colors = {p["color"] for p in placed["prims"] if p["t"] == "symbol"}
    assert colors == {"#0099ff", "#ff0000"}


def test_new_preset_is_default_while_stored_legacy_layout_and_explicit_raster_are_kept():
    assert default_style()["compact_flow"] is True and default_style()["columns"] == 3
    old = normalize({"style": {"text_size": 2.5, "columns": 2}, "blocks": []})
    assert old["style"]["compact_flow"] is False and old["style"]["columns"] == 2
    assert old["style"]["text_size"] == 2.5
    # Saved accents are intentional document data; changing old defaults is an
    # explicit, undoable editor preset rather than an on-read migration.
    blue = normalize({"general_section": {"header": "#1c7ed6"}, "blocks": []})
    assert blue["general_section"]["header"] == "#1c7ed6"
    new = propose([], [], True, {}, "L")
    assert new["style"]["compact_flow"] is True and new["style"]["columns"] == 3
    custom = flow_document(3, 2)
    custom["style"].update(grid="custom", row=15.5, text_offset=22)
    placed = layout(custom)
    assert all(p["h"] >= 15.5 for p in placed["prims"] if p["t"] == "hit" and p["kind"] == "item")


def test_enlarged_tall_and_wide_symbols_stay_inside_their_own_flow_row():
    doc = flow_document(3, 3)
    first = doc["blocks"][0]["items"][0]
    first["symbol_factor"] = 4
    sizes = {item["id"]: (-1, -4, 1, 4, False) for block in doc["blocks"] for item in block["items"]}
    sizes["s1-0"] = (-4, -1, 4, 1, False)
    doc["blocks"][1]["items"][0]["symbol_factor"] = 4
    placed = layout(doc, sizes)
    rows = {p["id"]: p for p in placed["prims"] if p["t"] == "hit" and p["kind"] == "item"}
    for symbol in [p for p in placed["prims"] if p["t"] == "symbol"]:
        row = rows[symbol["id"]]
        assert symbol["x0"] >= row["x"] - .001
        assert symbol["y0"] >= row["y"] - .001
        assert symbol["y0"] + symbol["h"] <= row["y"] + row["h"] + .001
    assert rows[first["id"]]["h"] > 10


def test_general_heading_uses_configured_accent_as_small_marker_and_thin_rule():
    doc = flow_document(3, 2)
    doc["general_section"].update(header="#aa2288", text="#334455", title="Allgemeiner Teil")
    before = deepcopy(doc)
    placed = layout(doc, {}, key())
    marker = next(p for p in placed["prims"] if p.get("role") == "general-marker")
    rule = next(p for p in placed["prims"] if p.get("role") == "general-rule")
    heading = next(p for p in placed["prims"] if p["t"] == "text" and p["text"] == "Allgemeiner Teil")
    assert marker["fill"] == rule["fill"] == "#aa2288"
    assert marker["w"] < 1 and rule["h"] <= .2
    assert heading["color"] == "#334455" and heading["bold"]
    assert not any(p.get("role") == "header" for p in placed["prims"])
    assert doc == before
