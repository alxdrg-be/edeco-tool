"""Real text widths, reversible presentation and safe abbreviation boundaries."""

from copy import deepcopy
from io import StringIO

import ezdxf
import pytest

from nova_legend.legend.export import build_dxf
from nova_legend.legend.layout import layout, text_width
from nova_legend.legend.model import empty_doc, normalize, section_style
from nova_legend.legend.text_rules import abbreviate, normalize_text_rules, rule_problem

from test_phase3 import env  # noqa: F401 - isolated local API and company settings


def rule(long="Gruppenbezeichnung", short="Gr.", scope="all", active=True):
    return {"id": "r", "long": long, "short": short, "scope": scope, "active": active}


def document(mode="wrap", text="Gruppenbezeichnung", parts=False):
    doc = empty_doc()
    doc["style"].update(width=80, columns=2, compact_flow=False, symbol_fit="corridor")
    doc["text_rules"] = {"mode": mode, "rules": [rule()]}
    item = {"id": "i", "kind": "text", "text": text, "hidden": False}
    if parts:
        item.update(kind="symbol", symbol_key="s", family_key="f", length_mm=None, width_mm=None,
                    parts=[{"symbol_key": "s2", "family_key": "f2", "text": "T13", "length_mm": None, "width_mm": None}])
    doc["blocks"] = [{"id": "b", "category_id": "licht", "title": "Licht", "layer": "",
                      "style": section_style("#0080ff"), "items": [item]}]
    return normalize(doc)


def test_missing_settings_keep_old_wrapping_and_empty_table():
    doc = normalize({"blocks": []})
    assert doc["text_rules"] == {"mode": "wrap", "rules": []}
    assert layout(doc)["warnings"] == []


def test_normalization_bounds_data_without_losing_invalid_rows_for_correction():
    settings = normalize_text_rules({"mode": "unknown", "rules": [
        {"id": "same", "long": "  Gruppe  ", "short": "Gr.", "active": False},
        {"id": "same", "long": "T13", "short": "T", "scope": "missing"},
        None,
    ]})
    assert settings["mode"] == "wrap"
    assert settings["rules"][0] == {"id": "same", "long": "Gruppe", "short": "Gr.", "scope": "all", "active": False}
    assert settings["rules"][1]["id"] != "same"
    assert settings["rules"][1]["scope"] == "missing"
    assert rule_problem(settings["rules"][1])
    assert len(normalize_text_rules({"rules": [rule()] * 200})["rules"]) == 100


def test_whole_words_case_and_punctuation_preserve_codes_and_quantities():
    text = "Gruppe, GRUPPE T13 16 A 2.5 mm² Gruppentaster GruppeT13 Gruppe12"
    assert abbreviate(text, [rule("Gruppe", "Gr.")]) == "Gr., Gr. T13 16 A 2.5 mm² Gruppentaster GruppeT13 Gruppe12"


@pytest.mark.parametrize(("long", "short"), [("T13", "T"), ("16 A", "A"), ("mm", "m"), ("IP", "I"), ("Gruppe", "G1"), ("MM", "x"), ("ip", "x"), ("µA", "x"), ("μa", "x")])
def test_technical_replacements_are_not_executed(long, short):
    assert rule_problem(rule(long, short))
    assert abbreviate(f"{long} / Gruppe T13 16 A", [rule(long, short)]) == f"{long} / Gruppe T13 16 A"


def test_case_insensitive_matching_cannot_bypass_lowercase_unit_protection():
    assert abbreviate("Leitung 2 mm", [rule("MM", "x")]) == "Leitung 2 mm"


def test_disabled_and_unrelated_category_rules_have_no_effect():
    text = "Gruppenbezeichnung"
    assert abbreviate(text, [rule(active=False)], "licht") == text
    assert abbreviate(text, [rule(scope="kraft")], "licht") == text
    assert abbreviate(text, [rule(scope="licht")], "licht") == "Gr."
    assert abbreviate(text, [rule(scope="missing")], "licht") == text


def test_rules_have_literal_replacements_and_do_not_cross_paragraphs():
    assert abbreviate("Schalter Gruppe", [rule("Schalter Gruppe", "Sch.-Gr.")]) == "Sch.-Gr."
    assert abbreviate("Schalter\nGruppe", [rule("Schalter Gruppe", "Sch.-Gr.")]) == "Schalter\nGruppe"
    assert abbreviate("Gruppe (klein)", [rule("Gruppe (klein)", "Gr. (kl.)")]) == "Gr. (kl.)"


def test_warn_uses_real_font_width_and_never_replaces_saved_text():
    doc = document("warn")
    before = deepcopy(doc)
    placed = layout(doc)
    assert doc == before
    warning = placed["warnings"][0]
    assert warning["block"] == "b" and warning["item"] == "i"
    assert warning["kind"] == "text-width"
    assert warning["text"] == "Gruppenbezeichnung"
    assert warning["suggestion"] == "Gr."
    assert warning["width_mm"] == pytest.approx(text_width("Gruppenbezeichnung", doc["style"]["text_size"], accurate=True), abs=.001)
    assert warning["width_mm"] > warning["available_mm"]
    # No silent truncation: automatic wrapping still contains the entire source.
    drawn = [prim["text"] for prim in placed["prims"] if prim["t"] == "text" and prim.get("item") == "i"]
    assert "".join(drawn) == "Gruppenbezeichnung"


def test_same_character_count_can_fit_or_warn_based_on_glyph_width():
    narrow, wide = layout(document("warn", "iiiiiiiiii")), layout(document("warn", "MMMMMMMMMM"))
    assert narrow["warnings"] == []
    assert wide["warnings"][0]["width_mm"] > wide["warnings"][0]["available_mm"]


def test_opt_in_abbreviation_changes_identical_preview_export_only():
    doc = document("abbreviate")
    before = deepcopy(doc)
    placed = layout(doc)
    assert not placed["warnings"]
    assert doc == before
    drawn = [prim["text"] for prim in placed["prims"] if prim["t"] == "text" and prim.get("item") == "i"]
    assert drawn == ["Gr."]
    exported = build_dxf(placed, None, lambda _prim: None)
    assert "Gr." in [entity.dxf.text for entity in exported.modelspace().query("TEXT")]
    assert doc["blocks"][0]["items"][0]["text"] == "Gruppenbezeichnung"


def test_remaining_overflow_after_abbreviation_is_reported():
    doc = document("abbreviate", "Gruppenbezeichnung und eine sehr lange weitere Beschreibung")
    placed = layout(doc)
    warning = placed["warnings"][0]
    assert warning["display_text"].startswith("Gr. und")
    assert warning["text"].startswith("Gruppenbezeichnung")
    assert warning["suggestion"] == ""


def test_combination_preserves_child_codes_descriptions_and_symbols():
    doc = document("abbreviate", parts=True)
    before = deepcopy(doc)
    placed = layout(doc, {"i": (5, 5, False), "i:part:0": (5, 5, False)})
    assert doc == before
    texts = [prim["text"] for prim in placed["prims"] if prim["t"] == "text" and prim.get("item") == "i"]
    assert " ".join(texts).replace("  ", " ") == "Gr. / T13"
    assert [prim["key"] for prim in placed["prims"] if prim["t"] == "symbol"] == ["s", "s2"]
    assert doc["blocks"][0]["items"][0]["parts"][0]["text"] == "T13"


def test_compact_flow_only_reports_final_visible_rows_once():
    doc = document("warn")
    doc["style"]["compact_flow"] = True
    doc["blocks"][0]["items"] += [{**doc["blocks"][0]["items"][0], "id": "hidden", "hidden": True}]
    placed = layout(doc)
    assert [warning["item"] for warning in placed["warnings"]] == ["i"]


def test_rules_survive_api_reload_and_preview_export_use_the_same_text(env):
    client, _tmp = env
    project = client.post("/api/projects", json={"name": "Textregeln"}).json()["id"]
    doc = document("warn")
    doc["general_on"] = False
    assert client.put(f"/api/projects/{project}/legend", json={"doc": doc}).status_code == 200
    restored = client.get(f"/api/projects/{project}/legend").json()["legend"]["doc"]
    assert restored["text_rules"] == doc["text_rules"]
    placed = client.post(f"/api/projects/{project}/legend/layout", json={"doc": restored}).json()
    assert placed["warnings"][0]["suggestion"] == "Gr."
    assert placed["warnings"][0]["item"] == "i"
    doc["text_rules"]["mode"] = "abbreviate"
    assert client.put(f"/api/projects/{project}/legend", json={"doc": doc}).status_code == 200
    placed = client.post(f"/api/projects/{project}/legend/layout", json={"doc": doc}).json()
    assert not placed["warnings"]
    assert [prim["text"] for prim in placed["prims"] if prim.get("item") == "i" and prim["t"] == "text"] == ["Gr."]
    response = client.get(f"/api/projects/{project}/legend/export", params={"format": "dxf"})
    assert response.status_code == 200
    drawing = ezdxf.read(StringIO(response.text, newline=None))
    assert "Gr." in [entity.dxf.text for entity in drawing.modelspace().query("TEXT")]
    saved = client.get(f"/api/projects/{project}/legend").json()["legend"]["doc"]
    assert saved["blocks"][0]["items"][0]["text"] == "Gruppenbezeichnung"
