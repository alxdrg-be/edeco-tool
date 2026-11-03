"""Original plan colours survive proposal, editing and logical combinations."""

from nova_legend.legend.layout import layout
from nova_legend.legend.model import apply_company_symbols, normalize, propose, section_style


def apparatus(key, *, colors=None, layers=None, text="Schalter"):
    return {"family_key": key, "symbol_key": "symbol:" + key, "title": text,
            "categories": ["switches"], "total": 5, "mountings": {"UP": 5},
            "layers": layers or colors or {}}


def test_normalize_preserves_distinct_source_colors_on_item_and_logical_part():
    doc = normalize({"style": {"text_size": 2.5}, "blocks": [{"id": "b", "items": [{
        "id": "i", "symbol_key": "a", "color": "#FF0000",
        "layer_colors": ["#ff0000", "#0099FF", "invalid", "#ffffff"],
        "parts": [{"symbol_key": "b", "color": "#00ff00", "layer_colors": ["#00ff00", "#00ffff"]}],
    }]}]})
    item = doc["blocks"][0]["items"][0]
    assert item["layer_colors"] == ["#ff0000", "#0099ff"]
    assert item["parts"][0]["layer_colors"] == ["#00ff00", "#00ffff"]
    assert doc["style"]["text_size"] == 2.5
    assert normalize(doc) == doc


def test_proposal_keeps_source_variants_in_existing_category_and_company_header():
    categories = [{"id": "switches", "title": "Schalter", "layer": "E_Licht"}]
    doc = propose([apparatus("a", colors={"#ff0000": 3, "#0099ff": 2})], categories,
                  True, {}, "L", colors={"switches": "#808080"},
                  layer_colors={"#ff0000": "#ff0000", "#0099ff": "#0099ff"})
    block = doc["blocks"][0]
    assert block["category_id"] == "switches" and block["style"]["header"] == "#808080"
    assert len(block["items"]) == 1
    item = block["items"][0]
    assert item["color"] == "#ff0000" and item["layer_colors"] == ["#ff0000", "#0099ff"]
    assert "parts" not in item


def test_same_description_still_deduplicates_geometry_without_losing_its_colors():
    categories = [{"id": "switches", "title": "Schalter"}]
    doc = propose([apparatus("left", colors={"#ff0000": 5}),
                   apparatus("right", colors={"#0099ff": 5})], categories, True, {}, "L",
                  layer_colors={"#ff0000": "#ff0000", "#0099ff": "#0099ff"})
    items = doc["blocks"][0]["items"]
    assert len(items) == 1 and items[0]["symbol_key"] == "symbol:left"
    assert items[0]["layer_colors"] == ["#ff0000", "#0099ff"]


def test_category_does_not_discard_the_original_color_of_another_plan_layer():
    categories = [{"id": "switches", "title": "Schalter"}, {"id": "power", "title": "Kraft"}]
    sample = apparatus("a", layers={"E_Licht": 2, "E_Kraft": 3})
    doc = propose([sample], categories, True, {}, "L",
                  layer_categories={"E_Licht": "switches", "E_Kraft": "power"},
                  layer_colors={"E_Licht": "#0099ff", "E_Kraft": "#ff0000"})
    assert len(doc["blocks"]) == 1 and doc["blocks"][0]["category_id"] == "switches"
    assert doc["blocks"][0]["style"]["header"] == "#0099ff"
    assert doc["blocks"][0]["items"][0]["layer_colors"] == ["#ff0000", "#0099ff"]


def test_one_source_color_without_old_dominant_field_still_renders_its_actual_color():
    doc = normalize({"blocks": [{"id": "b", "items": [{"id": "a", "symbol_key": "k",
                                                        "layer_colors": ["#123456"]}]}]})
    assert doc["blocks"][0]["items"][0]["color"] == "#123456"
    symbol = next(p for p in layout(doc)["prims"] if p["t"] == "symbol")
    assert symbol["color"] == "#123456"


def test_company_combination_takes_current_project_colors_not_old_company_palette():
    doc = normalize({"blocks": [{"id": "b", "items": [
        {"id": "a", "symbol_key": "ka", "family_key": "fa", "color": "#ff0000", "text": "Dose"},
        {"id": "b", "symbol_key": "kb", "family_key": "fb", "color": "#0099ff",
         "layer_colors": ["#0099ff", "#00ffff"], "text": "Auslass"},
    ]}]})
    apply_company_symbols(doc, {"fa": {"parts": [{"family_key": "fb", "rotation": 90}]}})
    items = doc["blocks"][0]["items"]
    assert len(items) == 1
    assert items[0]["parts"][0]["layer_colors"] == ["#0099ff", "#00ffff"]
    assert items[0]["parts"][0]["rotation"] == 90


def test_color_variants_have_full_equal_tiles_and_stable_logical_part_indices():
    doc = normalize({"blocks": [{"id": "b", "style": section_style("#00ff00"), "items": [
        {"id": "many", "symbol_key": "ka", "family_key": "fa", "text": "Dose",
         "layer_colors": ["#ff0000", "#0099ff", "#00ffff"],
         "parts": [{"symbol_key": "kb", "text": "Auslass", "layer_colors": ["#ff00ff", "#ffff00"]}]},
        {"id": "single", "symbol_key": "kc", "text": "Einzeln"},
    ]}]})
    sizes = {key: (-2, -2, 2, 2, False) for key in ("many", "many#1", "single")}
    placed = layout(doc, sizes)
    symbols = [p for p in placed["prims"] if p["t"] == "symbol"]
    multiple = [p for p in symbols if p["id"] == "many"]
    single = next(p for p in symbols if p["id"] == "single")
    assert [p["part"] for p in multiple] == [0, 0, 0, 1, 1]
    assert [p["variant"] for p in multiple] == [0, 1, 2, 0, 1]
    assert {p["color"] for p in multiple} == {"#ff0000", "#0099ff", "#00ffff", "#ff00ff", "#ffff00"}
    assert all(abs(p["w"] - single["w"]) < .001 for p in multiple)
    cell = next(p for p in placed["prims"] if p["t"] == "hit" and p.get("id") == "many")
    for symbol in multiple:
        assert symbol["x0"] >= cell["x"]
        assert symbol["y0"] >= cell["y"]
        assert symbol["y0"] + symbol["h"] <= cell["y"] + cell["h"] + .01
    item = doc["blocks"][0]["items"][0]
    item["symbol_color"] = "#123456"
    forced = [p for p in layout(doc, sizes)["prims"] if p["t"] == "symbol" and p["id"] == "many"]
    assert len(forced) == 2 and all(p["color"] == "#123456" for p in forced)
    assert len(item["layer_colors"]) == 3 and len(item["parts"]) == 1
