"""Display grouping preserves source identities and requires catalogue evidence."""

from copy import deepcopy
from types import SimpleNamespace

import pytest

from nova_legend.legend.variants import apply_variant_rules, normalize_variant_rules


def symbol(key, name, *, part=None, sheet="10", item=None, mount="UP", graphic="2D-10"):
    return SimpleNamespace(key=key, dataset="catalogue.V2", name=name, part_name=part or name,
                           sheet=sheet, item=item or f"{sheet}-{key}", mounting=mount,
                           graphic_id=graphic)


def document(*names, rule="count", enabled=True):
    symbols = [symbol(f"s{index}", name) for index, name in enumerate(names)]
    families = {f"catalogue.V2|f{index}": SimpleNamespace(key=f"f{index}", members=[sym])
                for index, sym in enumerate(symbols)}
    items = [{"id": f"i{index}", "kind": "symbol", "family_key": f"f{index}",
              "symbol_key": sym.key, "text": sym.name, "symbol_factor": 1,
              "rotation": 0, "color": "#0099ff", "layer_colors": ["#0099ff"]}
             for index, sym in enumerate(symbols)]
    doc = {"variant_rules": {rule: enabled}, "blocks": [{"id": "b", "items": items}]}
    return doc, families


def test_options_accept_only_booleans_and_default_new_rules_off():
    options = normalize_variant_rules({"count": "true", "mounting": 1, "labels": False, "extra": True})
    assert options == {"labels": False, "orientation": False, "count": False, "placement": False,
                       "mounting": False, "poles": False, "schema": False, "angle": False}
    assert normalize_variant_rules(None)["labels"] is True


def test_disabled_rule_keeps_source_rows_and_enabling_is_display_only():
    doc, families = document("Steckdose T13 1-fach", "Steckdose T13 2-fach", enabled=False)
    before = deepcopy(doc)
    original, info = apply_variant_rules(doc, families=families)
    assert len(original["blocks"][0]["items"]) == 2 and info["merged_rows"] == 0
    doc["variant_rules"]["count"] = True
    enabled_before = deepcopy(doc)
    shown, info = apply_variant_rules(doc, families=families)
    head = shown["blocks"][0]["items"][0]
    assert head["id"] == "i0" and head["family_key"] == "f0"
    assert head["parts"][0]["family_key"] == "f1"
    assert info["groups"] == [{"block": "b", "item": "i0", "source_ids": ["i0", "i1"], "rules": ["count"]}]
    assert info["merged_rows"] == 1
    assert doc == enabled_before
    doc["variant_rules"]["count"] = False
    restored, _ = apply_variant_rules(doc, families=families)
    assert restored["blocks"] == before["blocks"]


@pytest.mark.parametrize(("rule", "first", "second"), [
    ("labels", "Taster (Ohne Text)", "Taster (Mit Text)"),
    ("orientation", "Leuchte liegend", "Leuchte stehend"),
    ("placement", "Leuchte Decke", "Leuchte Wand"),
    ("poles", "Schalter 2-polig", "Schalter 3-polig"),
    ("schema", "Schalter Schema 0", "Schalter Schema 3"),
    ("angle", "Bewegungsmelder 90°", "Bewegungsmelder 180°"),
])
def test_each_named_rule_groups_only_explicit_catalogue_variation(rule, first, second):
    doc, families = document(first, second, rule=rule)
    view, info = apply_variant_rules(doc, families=families)
    assert len(view["blocks"][0]["items"]) == 1
    assert info["applied_rules"][rule] == 1


def test_same_user_description_does_not_merge_unrelated_functions_or_types():
    for names in [("Dimmer 1-fach", "Taster 2-fach"),
                  ("Steckdose T13 1-fach", "Steckdose T23 2-fach")]:
        doc, families = document(*names)
        for item in doc["blocks"][0]["items"]:
            item["text"] = "Apparat"
        shown, info = apply_variant_rules(doc, families=families)
        assert len(shown["blocks"][0]["items"]) == 2
        assert info["merged_rows"] == 0


def test_missing_or_wrong_catalogue_metadata_does_not_guess():
    doc, families = document("Steckdose 1-fach", "Steckdose 2-fach")
    no_metadata, info = apply_variant_rules(doc)
    assert len(no_metadata["blocks"][0]["items"]) == 2
    assert "count" in info["unmatched_rules"]
    families["catalogue.V2|f1"].members[0].item = "20-s1"  # does not belong to stated sheet
    shown, info = apply_variant_rules(doc, families=families)
    assert len(shown["blocks"][0]["items"]) == 2
    assert info["notes"]


def test_original_colours_factors_and_selected_colour_subset_are_retained():
    doc, families = document("Steckdose 1-fach", "Steckdose 2-fach")
    second = doc["blocks"][0]["items"][1]
    second.update(color="#ff0000", layer_colors=["#ff0000", "#00ff00"],
                  visible_layer_colors=["#00ff00"], rotation=90, symbol_factor=1.2)
    before = deepcopy(doc)
    shown, _ = apply_variant_rules(doc, families=families)
    part = shown["blocks"][0]["items"][0]["parts"][0]
    assert part["family_key"] == "f1" and part["symbol_key"] == "s1"
    assert part["layer_colors"] == ["#ff0000", "#00ff00"]
    assert part["visible_layer_colors"] == ["#00ff00"]
    assert part["rotation"] == 90 and part["symbol_factor"] == 1.2
    assert doc == before


def test_three_symbols_fit_but_more_variants_stay_in_separate_rows():
    doc, families = document("Melder 90°", "Melder 180°", "Melder 270°", rule="angle")
    view, info = apply_variant_rules(doc, families=families)
    assert len(view["blocks"][0]["items"]) == 1
    assert len(view["blocks"][0]["items"][0]["parts"]) == 2
    assert info["merged_rows"] == 2
    doc, families = document("Melder 90°", "Melder 180°", "Melder 270°", "Melder 360°", rule="angle")
    view, info = apply_variant_rules(doc, families=families)
    assert len(view["blocks"][0]["items"]) == 4
    assert info["merged_rows"] == 0


def test_manual_combinations_retained_entries_and_separators_are_not_rearranged():
    for divider in [{"id": "gap", "kind": "gap"}, {"id": "line", "kind": "line"},
                    {"id": "text", "kind": "text", "text": "Anderer Bereich"}]:
        doc, families = document("Steckdose 1-fach", "Steckdose 2-fach")
        doc["blocks"][0]["items"].insert(1, divider)
        shown, _ = apply_variant_rules(doc, families=families)
        assert len(shown["blocks"][0]["items"]) == 3
    for extra in [{"parts": [{"symbol_key": "manual", "text": "Manuell"}]},
                  {"keep": True}, {"symbol_color": "#ff0000"}]:
        doc, families = document("Steckdose 1-fach", "Steckdose 2-fach")
        doc["blocks"][0]["items"][1].update(extra)
        shown, _ = apply_variant_rules(doc, families=families)
        assert len(shown["blocks"][0]["items"]) == 2


def test_different_catalogue_sheets_datasets_or_text_styles_do_not_merge():
    for attribute, value in [("sheet", "30"), ("dataset", "other.V2")]:
        doc, families = document("Steckdose 1-fach", "Steckdose 2-fach")
        setattr(families["catalogue.V2|f1"].members[0], attribute, value)
        shown, _ = apply_variant_rules(doc, families=families)
        assert len(shown["blocks"][0]["items"]) == 2
    doc, families = document("Steckdose 1-fach", "Steckdose 2-fach")
    doc["blocks"][0]["items"][1]["text_scale"] = 1.2
    shown, _ = apply_variant_rules(doc, families=families)
    assert len(shown["blocks"][0]["items"]) == 2


def mounting_document():
    up = symbol("up", "Taster UP", part="Taster UP", item="10-15")
    ap = symbol("ap", "Taster AP", part="Taster AP", sheet="20", item="20-15", mount="AP")
    family = SimpleNamespace(key="taster", members=[up, ap])
    doc = {"variant_rules": {"mounting": True}, "blocks": [{"id": "b", "items": [
        {"id": "i", "kind": "symbol", "family_key": "taster", "symbol_key": "up",
         "text": "Taster", "color": "#0099ff", "layer_colors": ["#0099ff", "#ff0000"]}]}]}
    return doc, {"catalogue.V2|taster": family}


def mounting_rows():
    return [{"family_key": "taster", "mountings": {"UP": 3, "AP": 2}, "symbol_variants": [
        {"symbol_key": "up", "mounting": "UP", "total": 3,
         "layer_colors": ["#0099ff"], "source_colors_complete": True},
        {"symbol_key": "ap", "mounting": "AP", "total": 2,
         "layer_colors": ["#ff0000"], "source_colors_complete": True}]}]


def test_up_ap_expands_only_verified_pair_present_in_scoped_project():
    doc, families = mounting_document()
    original = deepcopy(doc)
    view, info = apply_variant_rules(doc, families=families, rows=mounting_rows())
    shown = view["blocks"][0]["items"][0]
    assert shown["id"] == "i" and shown["text"] == "Taster UP"
    assert shown["layer_colors"] == ["#0099ff"]
    assert shown["parts"][0]["symbol_key"] == "ap"
    assert shown["parts"][0]["text"] == "AP"
    assert shown["parts"][0]["layer_colors"] == ["#ff0000"]
    assert info["added_variants"] == 1 and doc == original
    for rows in [None, [{"family_key": "taster", "mountings": {"UP": 3}}]]:
        view, info = apply_variant_rules(doc, families=families, rows=rows)
        assert "parts" not in view["blocks"][0]["items"][0] and info["added_variants"] == 0


def test_up_ap_does_not_expand_uncertain_code_pair_or_choose_arbitrary_variant():
    doc, families = mounting_document()
    family = families["catalogue.V2|taster"]
    row = mounting_rows()
    family.members[1].item = "20-99"
    view, _ = apply_variant_rules(doc, families=families, rows=row)
    assert "parts" not in view["blocks"][0]["items"][0]
    family.members[1].item = "20-15"
    family.members.append(deepcopy(family.members[1]))
    view, _ = apply_variant_rules(doc, families=families, rows=row)
    assert "parts" not in view["blocks"][0]["items"][0]


def test_mounting_colours_are_member_specific_and_do_not_invent_four_glyphs():
    from nova_legend.legend.layout import layout
    from nova_legend.legend.model import normalize

    source, families = mounting_document()
    source = normalize(source)
    item = source["blocks"][0]["items"][0]
    item.update(symbol_factor=1.7, rotation=90, mirror=True, length_mm=1500, width_mm=300)
    original = deepcopy(source)
    view, _ = apply_variant_rules(source, families=families, rows=mounting_rows())
    head = view["blocks"][0]["items"][0]
    part = head["parts"][0]
    assert head["rotation"] == 90 and head["symbol_factor"] == 1.7 and head["mirror"] is True
    assert part["symbol_factor"] == 1.0 and part["rotation"] == 0 and part["mirror"] is False
    assert part["length_mm"] is None and part["width_mm"] is None
    rendered = layout(view)
    symbols = [primitive for primitive in rendered["prims"] if primitive["t"] == "symbol"]
    assert [(symbol["key"], symbol["color"]) for symbol in symbols] == [("up", "#0099ff"), ("ap", "#ff0000")]
    assert source == original
    source["variant_rules"]["mounting"] = False
    restored, _ = apply_variant_rules(source, families=families, rows=mounting_rows())
    assert restored["blocks"][0]["items"][0]["layer_colors"] == ["#0099ff", "#ff0000"]


def test_ap_only_scope_uses_real_ap_drawing_instead_of_repainting_the_up_representative():
    source, families = mounting_document()
    original = deepcopy(source)
    rows = mounting_rows()
    rows[0]["mountings"] = {"AP": 2}
    rows[0]["symbol_variants"] = rows[0]["symbol_variants"][1:]
    view, info = apply_variant_rules(source, families=families, rows=rows)
    shown = view["blocks"][0]["items"][0]
    assert shown["symbol_key"] == "ap" and shown["text"] == "Taster AP"
    assert shown["layer_colors"] == ["#ff0000"] and "parts" not in shown
    assert shown["_source_part"] == -1
    assert info["added_variants"] == 0 and info["applied_rules"]["mounting"] == 1
    assert source == original


def test_up_only_scope_never_adds_absent_ap_member():
    source, families = mounting_document()
    rows = mounting_rows()
    rows[0]["mountings"] = {"UP": 3}
    rows[0]["symbol_variants"] = rows[0]["symbol_variants"][:1]
    view, info = apply_variant_rules(source, families=families, rows=rows)
    shown = view["blocks"][0]["items"][0]
    assert shown["symbol_key"] == "up" and shown["layer_colors"] == ["#0099ff"]
    assert "parts" not in shown and info["added_variants"] == 0


def test_existing_explicit_up_ap_rows_get_member_colours_before_grouping():
    from nova_legend.legend.layout import layout
    from nova_legend.legend.model import normalize

    source, families = mounting_document()
    extra = deepcopy(source["blocks"][0]["items"][0])
    extra.update(id="i-ap", symbol_key="ap", text="Taster AP")
    source["blocks"][0]["items"].append(extra)
    source = normalize(source)
    before = deepcopy(source)
    view, info = apply_variant_rules(source, families=families, rows=mounting_rows())
    assert info["merged_rows"] == 1 and info["added_variants"] == 0
    assert len(view["blocks"][0]["items"]) == 1
    drawings = [primitive for primitive in layout(view)["prims"] if primitive["t"] == "symbol"]
    assert [(drawing["key"], drawing["color"]) for drawing in drawings] == [("up", "#0099ff"), ("ap", "#ff0000")]
    assert source == before


def test_existing_explicit_up_ap_rows_are_not_merged_without_member_evidence():
    source, families = mounting_document()
    extra = deepcopy(source["blocks"][0]["items"][0])
    extra.update(id="i-ap", symbol_key="ap", text="Taster AP")
    source["blocks"][0]["items"].append(extra)
    rows = mounting_rows()
    rows[0].pop("symbol_variants")
    view, info = apply_variant_rules(source, families=families, rows=rows)
    assert len(view["blocks"][0]["items"]) == 2
    assert info["merged_rows"] == info["added_variants"] == 0
    assert any("nicht eindeutig zuordenbar" in note for note in info["notes"])


def test_empty_graphic_ids_are_not_a_verified_mounting_pair():
    source, families = mounting_document()
    for member in families["catalogue.V2|taster"].members:
        member.graphic_id = ""
    view, info = apply_variant_rules(source, families=families, rows=mounting_rows())
    assert "parts" not in view["blocks"][0]["items"][0]
    assert info["added_variants"] == 0


@pytest.mark.parametrize(("caption", "present", "expected"), [
    ("Taster UP", "both", "Taster UP"),
    ("Taster UP", "UP", "Taster UP"),
    ("Taster UP", "AP", "Taster AP"),
    ("Taster AP", "AP", "Taster AP"),
    ("Taster (UP)", "AP", "Taster (AP)"),
])
def test_mounting_labels_are_not_duplicated_or_left_wrong_after_promotion(caption, present, expected):
    source, families = mounting_document()
    source["blocks"][0]["items"][0]["text"] = caption
    source["blocks"][0]["items"][0]["_source_part"] = 0
    original = deepcopy(source)
    rows = mounting_rows()
    if present != "both":
        rows[0]["mountings"] = {present: 3 if present == "UP" else 2}
        rows[0]["symbol_variants"] = [entry for entry in rows[0]["symbol_variants"]
                                         if entry["mounting"] == present]
    view, _ = apply_variant_rules(source, families=families, rows=rows)
    item = view["blocks"][0]["items"][0]
    assert item["text"] == expected
    if present == "AP":
        assert item["_source_part"] == -1
    else:
        assert item["_source_part"] == 0
    if present == "both":
        assert item["parts"][0]["text"] == "AP" and item["parts"][0]["_source_part"] == -1
    assert source == original


def test_auto_grouping_keeps_original_member_part_metadata():
    source, families = document("Steckdose T13 1-fach", "Steckdose T13 2-fach")
    source["blocks"][0]["items"][1]["_source_part"] = 1
    view, _ = apply_variant_rules(source, families=families)
    part = view["blocks"][0]["items"][0]["parts"][0]
    assert part["_source_part"] == 1 and part["_source_item"] == "i1"


@pytest.mark.parametrize(("selected", "expected"), [(["#0099ff"], "up"), (["#ff0000"], "ap")])
def test_mounting_preserves_saved_colour_subset_instead_of_copying_it_to_other_member(selected, expected):
    source, families = mounting_document()
    item = source["blocks"][0]["items"][0]
    item["visible_layer_colors"] = selected
    original = deepcopy(source)
    view, info = apply_variant_rules(source, families=families, rows=mounting_rows())
    shown = view["blocks"][0]["items"][0]
    assert shown["id"] == "i" and shown["symbol_key"] == expected
    assert shown["layer_colors"] == selected
    assert "parts" not in shown and info["added_variants"] == 0
    assert source == original


@pytest.mark.parametrize("fault", ["missing", "incomplete", "wrong-key", "wrong-mount", "missing-colours"])
def test_mounting_requires_complete_unambiguous_source_member_palette(fault):
    source, families = mounting_document()
    row = mounting_rows()
    if fault == "missing":
        row[0].pop("symbol_variants")
    elif fault == "incomplete":
        row[0]["symbol_variants"][1]["source_colors_complete"] = False
    elif fault == "wrong-key":
        row[0]["symbol_variants"][1]["symbol_key"] = "unrelated"
    elif fault == "wrong-mount":
        row[0]["symbol_variants"][1]["mounting"] = "UP"
    else:
        row[0]["symbol_variants"][1]["layer_colors"] = []
    original = deepcopy(source)
    shown, info = apply_variant_rules(source, families=families, rows=row)
    assert "parts" not in shown["blocks"][0]["items"][0]
    assert info["added_variants"] == 0
    assert any("nicht eindeutig zuordenbar" in note for note in info["notes"])
    assert source == original


def test_normalized_render_document_keeps_both_drawings_and_their_colours():
    from nova_legend.legend.layout import layout
    from nova_legend.legend.model import normalize

    source, families = document("Steckdose T13 1-fach", "Steckdose T13 2-fach")
    source["blocks"][0]["items"][1].update(color="#ff0000", layer_colors=["#ff0000"])
    source["style"] = {"compact_flow": True, "symbol_fit": "corridor"}
    stored = normalize(source)
    before = deepcopy(stored)
    view, _ = apply_variant_rules(stored, families=families)
    # This is the same primitive set used by SVG preview, PDF and DXF export.
    placed = layout(view, {"i0": (-2, -2, 2, 2, False), "i0#1": (-3, -2, 3, 2, False)})
    drawings = [primitive for primitive in placed["prims"] if primitive["t"] == "symbol"]
    assert [(drawing["key"], drawing["family_key"], drawing["color"]) for drawing in drawings] == [
        ("s0", "f0", "#0099ff"), ("s1", "f1", "#ff0000")]
    assert drawings[0]["x0"] + drawings[0]["w"] <= drawings[1]["x0"]
    assert stored == before
