"""Floor scope is a reversible view and uses the same pipeline for CAD/PDF."""

from copy import deepcopy
from io import StringIO
from pathlib import Path

import ezdxf

from nova_legend.legend.scope import normalize_scope, scope_info, scoped_document, selected_plan_ids
from nova_legend.legend.model import empty_doc, normalize, section_style
from nova_legend.projects.store import ProjectManager

from test_phase2 import V2_LONG, import_dxf
from test_phase3 import env  # noqa: F401


def _without_source_metadata(blocks):
    copied = deepcopy(blocks)
    for block in copied:
        for item in block["items"]:
            for part in [item, *(item.get("parts") or [])]:
                part.pop("_source_part", None)
    return copied


def test_normalizer_preserves_explicit_unknown_ids_and_never_turns_invalid_selection_into_all():
    assert normalize_scope(None) == {"plan_ids": [], "only_present": False, "title_suffix": False, "filename_suffix": False}
    scope = normalize_scope({"plan_ids": [3, "7", 3, True, 999], "only_present": "false"})
    assert scope["plan_ids"] == [3, 7, 999]
    assert selected_plan_ids(scope) == {3, 7, 999}
    assert selected_plan_ids(normalize_scope({"plan_ids": ["not-a-floor"]})) == {-1}
    assert selected_plan_ids(normalize_scope({"plan_ids": []})) is None


def test_combination_filter_promotes_present_part_and_keeps_custom_content_without_mutation():
    doc = empty_doc("Manuell")
    doc["scope"] = {"plan_ids": [2], "only_present": True, "title_suffix": True, "filename_suffix": False}
    doc["blocks"] = [{"id": "group", "title": "Apparate", "items": [
        {"id": "combined", "kind": "symbol", "family_key": "absent", "symbol_key": "first", "text": "Nicht hier",
         "parts": [{"family_key": "present", "symbol_key": "second", "text": "Hier",
                                                 "color": "#0080ff", "symbol_factor": 1.2}]},
        {"id": "text", "kind": "text", "text": "Eigener Hinweis"},
        {"id": "line", "kind": "line", "text": "Leitung"},
        {"id": "kept", "kind": "symbol", "family_key": "absent", "symbol_key": "third", "text": "Bewusst beibehalten", "keep": True},
        {"id": "gone", "kind": "symbol", "family_key": "absent", "symbol_key": "first", "text": "Nicht da"},
    ]}]
    original = deepcopy(doc)
    evaluation = {"rows": [{"family_key": "present", "symbol_key": "second", "total": 5}], "unknown": []}
    view = scoped_document(doc, evaluation, [{"id": 2, "name": "OG"}])
    assert doc == original
    assert view["title"]["text"] == "Manuell · OG"
    assert [item["id"] for item in view["blocks"][0]["items"]] == ["combined", "text", "line", "kept"]
    first = view["blocks"][0]["items"][0]
    assert first["text"] == "Hier" and first["color"] == "#0080ff" and first["symbol_factor"] == 1.2
    assert "parts" not in first and "symbol_color" not in first
    doc["scope"]["only_present"] = False
    assert len(scoped_document(doc, evaluation, [])["blocks"][0]["items"]) == 5


def test_scope_counts_distinguish_known_types_unknown_components_and_output_rows():
    doc = empty_doc()
    doc["blocks"] = [{"id": "b", "items": [{"id": "a", "kind": "symbol"}, {"id": "b", "kind": "text"},
                                             {"id": "c", "kind": "gap"}, {"id": "d", "kind": "symbol", "hidden": True}]}]
    result = {"rows": [{"family_key": "x", "symbol_key": "sx", "total": 7, "counts": {1: 7}}],
              "unknown": [{"total": 2, "counts": {1: 2}}]}
    info = scope_info(doc, result, [{"id": 1, "name": "EG", "current_version": 1}])
    assert info["counts"] == {"components": 9, "symbol_types": 1, "legend_rows": 2, "unknown_components": 2, "manual_rows": 1}
    assert info["plans"][0]["components"] == 9
    assert info["plans"][0]["symbol_types"] == 1


def _floor(path: Path, entries: list[tuple[str, str, int]], color: int = 5) -> Path:
    drawing = ezdxf.new("R2013")
    drawing.layers.add("E_Licht", color=color)
    model = drawing.modelspace()
    number = 0
    for item, name, amount in entries:
        for _ in range(amount):
            number += 1
            block = drawing.blocks.new(f"{name.replace(',', '_')}_A0TEST{number:04d}")
            block.add_circle((0, 0), 120)
            ref = model.add_blockref(block.name, (1000 * number, 0), dxfattribs={"layer": "E_Licht"})
            if item:
                ref.add_attrib("TypID", item)
                ref.add_attrib("Bez", name)
                ref.add_attrib("Herkunft", V2_LONG)
    drawing.saveas(path)
    return path


def _project(client, tmp):
    pid = client.post("/api/projects", json={"name": "Geschosse"}).json()["id"]
    first = import_dxf(client, pid, _floor(tmp / "eg.dxf", [("10-10", "Schalter, Schema 0, UP", 2),
                                                           ("230-10", "Brandmelder, UP", 1), ("", "Sensor Fremd", 1)]), "EG").json()
    eg = first["plans"][0]["id"]
    second = import_dxf(client, pid, _floor(tmp / "og.dxf", [("10-10", "Schalter, Schema 0, UP", 3),
                                                            ("290-99", "Funk-Gateway", 1)]), "OG").json()
    og = next(plan["id"] for plan in second["plans"] if plan["name"] == "OG")
    doc = client.post(f"/api/projects/{pid}/legend/propose", json={}).json()["doc"]
    doc["blocks"].append({"id": "manual", "title": "Hinweis", "style": section_style(None),
                           "items": [{"id": "manual-text", "kind": "text", "text": "Eigener Hinweis"}]})
    return pid, eg, og, normalize(doc)


def _layout(client, pid, doc):
    response = client.post(f"/api/projects/{pid}/legend/layout", json={"doc": doc})
    assert response.status_code == 200, response.text
    return response.json()


def _texts(placed):
    return " ".join(prim.get("text", "") for prim in placed["prims"] if prim["t"] == "text")


def test_api_scope_combines_floors_persists_and_filters_same_entries_in_preview_and_dxf(env):
    client, tmp = env
    pid, eg, og, doc = _project(client, tmp)
    original = deepcopy(doc)
    all_floors = _layout(client, pid, doc)
    assert all_floors["scope_info"]["counts"]["components"] == 8
    assert all_floors["scope_info"]["counts"]["symbol_types"] == 3
    doc["scope"] = {"plan_ids": [eg], "only_present": True, "title_suffix": False, "filename_suffix": False}
    placed = _layout(client, pid, doc)
    assert placed["scope_info"]["counts"]["components"] == 4
    assert placed["scope_info"]["counts"]["symbol_types"] == 2
    assert placed["scope_info"]["counts"]["unknown_components"] == 1
    assert "Funk-Gateway" not in _texts(placed)
    assert "Eigener Hinweis" in _texts(placed) and "Brandmelder" in _texts(placed)
    assert len(doc["blocks"]) == len(original["blocks"])
    assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
    restored = client.get(f"/api/projects/{pid}/legend").json()
    assert restored["legend"]["doc"] == doc
    assert restored["scope_info"]["selected_plan_ids"] == [eg]
    assert restored["scope_info"]["counts"] == placed["scope_info"]["counts"]
    exported = client.get(f"/api/projects/{pid}/legend/export", params={"format": "dxf"})
    assert exported.status_code == 200
    cad = ezdxf.read(StringIO(exported.text, newline=None))
    cad_text = " ".join(entity.dxf.text for entity in cad.modelspace().query("TEXT"))
    assert "Funk-Gateway" not in cad_text and "Brandmelder" in cad_text and "Eigener Hinweis" in cad_text
    pdf = client.get(f"/api/projects/{pid}/legend/export", params={"format": "pdf"})
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    doc["scope"]["plan_ids"] = [eg, og]
    combined = _layout(client, pid, doc)
    assert combined["scope_info"]["counts"]["components"] == 8
    assert combined["scope_info"]["counts"]["symbol_types"] == 3
    doc["scope"]["plan_ids"] = [og]
    second = _layout(client, pid, doc)
    assert second["scope_info"]["counts"]["components"] == 4
    assert second["scope_info"]["counts"]["unknown_components"] == 0
    assert "Brandmelder" not in _texts(second) and "Funk-Gateway" in _texts(second)


def test_deleted_or_unknown_floor_has_zero_components_and_blocks_export_instead_of_showing_all(env):
    client, tmp = env
    pid, _, _, doc = _project(client, tmp)
    doc["scope"] = {"plan_ids": [999999], "only_present": True, "title_suffix": False, "filename_suffix": False}
    placed = _layout(client, pid, doc)
    assert placed["scope_info"]["missing_plan_ids"] == [999999]
    assert placed["scope_info"]["counts"]["components"] == 0
    assert "Brandmelder" not in _texts(placed) and "Eigener Hinweis" in _texts(placed)
    client.put(f"/api/projects/{pid}/legend", json={"doc": doc})
    assert client.get(f"/api/projects/{pid}/legend/export", params={"format": "dxf"}).status_code == 409


def test_empty_selected_floor_does_not_fall_back_to_other_imports_and_preserves_manual_lines(env):
    client, tmp = env
    pid, _, _, doc = _project(client, tmp)
    project = ProjectManager(Path(client.app.state.nova.settings.projects_folder)).get(pid)
    empty_id = project.add_plan("Noch leer")
    doc["scope"] = {"plan_ids": [empty_id], "only_present": True}
    placed = _layout(client, pid, doc)
    assert placed["scope_info"]["counts"]["components"] == 0
    assert placed["scope_info"]["counts"]["symbol_types"] == 0
    assert placed["scope_info"]["missing_plan_ids"] == []
    assert "Eigener Hinweis" in _texts(placed) and "Brandmelder" not in _texts(placed)


def test_legend_copy_keeps_floor_scope_and_optional_names_are_output_only(env):
    client, tmp = env
    pid, eg, _, doc = _project(client, tmp)
    title = doc["title"]["text"]
    doc["scope"] = {"plan_ids": [eg], "only_present": True, "title_suffix": True, "filename_suffix": True}
    saved = client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).json()["legend"]
    copied = client.post(f"/api/projects/{pid}/legends", json={"name": "EG Kopie", "source": "copy", "copy_of": saved["id"]}).json()["legend"]
    assert copied["doc"]["scope"] == doc["scope"]
    assert copied["doc"]["title"]["text"] == title
    placed = _layout(client, pid, copied["doc"])
    assert f"{title} · EG" in _texts(placed)
    name = client.get(f"/api/projects/{pid}/legend/export-name", params={"legend": copied["id"]}).json()["name"]
    assert name.endswith("-EG Kopie-EG.dxf")


def test_presentation_defaults_are_scoped_admin_checked_and_never_copy_contents_or_floor_ids(env):
    client, tmp = env
    pid, eg, _, doc = _project(client, tmp)
    client.put(f"/api/projects/{pid}/legend", json={"doc": doc})
    before = client.get(f"/api/projects/{pid}/legend").json()["legend"]
    doc["scope"] = {"plan_ids": [eg], "only_present": True}
    doc["style"]["text_size"] = 3.2
    doc["text_rules"] = {"mode": "warn", "rules": [{"long": "Gruppe", "short": "Gr.", "scope": "all", "active": True}]}
    project = client.put(f"/api/projects/{pid}/legend/defaults/project", json={"doc": doc})
    assert project.status_code == 200, project.text
    defaults = project.json()
    assert set(defaults["project"]) == {"style", "text_rules", "variant_rules"}
    assert defaults["project"]["style"]["text_size"] == 3.2
    assert defaults["company"] is None
    assert client.get(f"/api/projects/{pid}/legend").json()["legend"] == before
    proposal = client.post(f"/api/projects/{pid}/legend/propose", json={}).json()["doc"]
    assert proposal["style"]["text_size"] == 3.2 and proposal["text_rules"]["mode"] == "warn"
    assert proposal["scope"]["plan_ids"] == []
    state = client.app.state.nova
    state.company.set_legend_settings({"legend_admins": ["not-the-current-user"]})
    blocked = client.put(f"/api/projects/{pid}/legend/defaults/company", json={"doc": doc})
    assert blocked.status_code == 403
    assert client.get(f"/api/projects/{pid}/legend/defaults").json()["company"] is None
    assert client.get(f"/api/projects/{pid}/legend").json()["legend"] == before


def test_company_default_is_used_only_without_a_project_override_and_explicit_proposal_values_win(env):
    client, tmp = env
    pid, _, _, doc = _project(client, tmp)
    doc["style"]["text_size"] = 3.2
    own = client.put(f"/api/projects/{pid}/legend/defaults/project", json={"doc": doc})
    assert own.status_code == 200
    doc["style"]["text_size"] = 4.0
    firm = client.put(f"/api/projects/{pid}/legend/defaults/company", json={"doc": doc})
    assert firm.status_code == 200, firm.text
    assert firm.json()["effective"]["style"]["text_size"] == 3.2
    other = client.post("/api/projects", json={"name": "Andere Vorgabe"}).json()["id"]
    other_defaults = client.get(f"/api/projects/{other}/legend/defaults").json()
    assert other_defaults["project"] is None
    assert other_defaults["effective"]["style"]["text_size"] == 4.0
    proposal = client.post(f"/api/projects/{other}/legend/propose", json={}).json()["doc"]
    assert proposal["style"]["text_size"] == 4.0 and proposal["scope"]["plan_ids"] == []
    explicit = client.post(f"/api/projects/{other}/legend/propose", json={"style": {"text_size": 2.1},
                            "text_rules": {"mode": "warn", "rules": []},
                            "variant_rules": {"orientation": True}}).json()["doc"]
    assert explicit["style"]["text_size"] == 2.1
    assert explicit["text_rules"]["mode"] == "warn" and explicit["variant_rules"]["orientation"] is True


def test_legacy_document_and_new_proposal_retain_actual_company_grouping_opt_out(env):
    client, tmp = env
    pid, _, _, doc = _project(client, tmp)
    state = client.app.state.nova
    state.company.set_options({"merge_labels": False, "merge_orientation": True})
    doc.pop("variant_rules", None)
    project = ProjectManager(Path(state.settings.projects_folder)).get(pid)
    project.set_legend(doc)
    restored = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert restored["variant_rules"]["labels"] is False
    assert restored["variant_rules"]["orientation"] is True
    assert project.legend()["doc"] == doc  # read-time migration never overwrites the saved document
    proposal = client.post(f"/api/projects/{pid}/legend/propose", json={}).json()["doc"]
    assert proposal["variant_rules"]["labels"] is False
    assert proposal["variant_rules"]["orientation"] is True
    explicit = client.post(f"/api/projects/{pid}/legend/propose", json={"variant_rules": {"labels": True}}).json()["doc"]
    assert explicit["variant_rules"]["labels"] is True


def _color_document():
    doc = empty_doc("Farben")
    doc["scope"] = {"plan_ids": [1], "only_present": True}
    doc["blocks"] = [{"id": "colors", "title": "Licht", "style": section_style("#0000ff"), "items": [
        {"id": "same", "kind": "symbol", "family_key": "switch", "symbol_key": "s", "text": "Schalter",
         "color": "#ff0000", "layer_colors": ["#ff0000", "#0000ff", "#00ff00"]}]}]
    return doc


def test_floor_colors_are_render_only_and_selected_color_outside_floor_is_never_silently_replaced():
    doc = _color_document()
    original = deepcopy(doc)
    plans = [{"id": 1, "name": "EG"}, {"id": 2, "name": "OG"}]
    result = {"rows": [{"family_key": "switch", "symbol_key": "s", "total": 2,
                        "layer_colors": ["#0000ff"], "source_colors_complete": True}], "unknown": []}
    blue = scoped_document(doc, result, plans)
    shown = blue["blocks"][0]["items"][0]
    assert shown["color"] == "#0000ff" and shown["layer_colors"] == ["#0000ff"]
    assert doc == original
    doc["blocks"][0]["items"][0]["visible_layer_colors"] = ["#ff0000"]
    before = deepcopy(doc)
    absent = scoped_document(doc, result, plans)
    assert absent["blocks"] == []
    assert absent["_scope_color_warnings"][0]["kind"] == "selected-colors-absent"
    assert doc == before
    doc["blocks"][0]["items"][0]["visible_layer_colors"] = ["#ff0000", "#0000ff"]
    partial = scoped_document(doc, result, plans)
    shown = partial["blocks"][0]["items"][0]
    assert shown["visible_layer_colors"] == ["#0000ff"]
    assert partial["_scope_color_warnings"][0]["kind"] == "selected-colors-partial"
    # Disabling the floor filter restores the exact saved source palette/selection.
    doc["scope"]["plan_ids"] = []
    restored = scoped_document(doc, result, plans)
    assert _without_source_metadata(restored["blocks"]) == doc["blocks"]


def test_unverified_legacy_palette_is_reported_instead_of_claiming_floor_colors():
    doc = _color_document()
    result = {"rows": [{"family_key": "switch", "symbol_key": "s", "total": 2,
                        "layer_colors": ["#0000ff"], "source_colors_complete": False}], "unknown": []}
    view = scoped_document(doc, result, [{"id": 1, "name": "EG"}])
    assert _without_source_metadata(view["blocks"]) == doc["blocks"]
    assert "nicht vollständig belegt" in view["_scope_color_warnings"][0]["message"]
    info = scope_info(doc, result, [{"id": 1, "name": "EG"}])
    assert info["color_warning_count"] == 1 and info["color_warnings"][0]["kind"] == "unverified-source-colors"


def test_monochrome_combination_override_survives_first_part_promotion_and_floor_palette_filtering():
    doc = _color_document()
    main = doc["blocks"][0]["items"][0]
    main.update(family_key="absent", symbol_key="missing", symbol_color="#aa00bb",
                parts=[{"family_key": "switch", "symbol_key": "s", "text": "Schalter",
                        "color": "#ff0000", "layer_colors": ["#ff0000", "#0000ff"],
                        "visible_layer_colors": ["#ff0000"]}])
    before = deepcopy(doc)
    result = {"rows": [{"family_key": "switch", "symbol_key": "s", "total": 2,
                        "layer_colors": ["#0000ff"], "source_colors_complete": True}], "unknown": []}
    promoted = scoped_document(doc, result, [{"id": 1, "name": "EG"}])["blocks"][0]["items"][0]
    assert promoted["symbol_key"] == "s" and promoted["symbol_color"] == "#aa00bb"
    assert promoted["layer_colors"] == ["#0000ff"] and promoted["id"] == main["id"]
    assert doc == before


def test_same_layer_name_retains_each_floors_actual_palette_for_proposal_layout_and_exports(env):
    client, tmp = env
    pid = client.post("/api/projects", json={"name": "Farben je Geschoss"}).json()["id"]
    eg_data = import_dxf(client, pid, _floor(tmp / "eg-blue.dxf", [("10-10", "Schalter, Schema 0, UP", 2)], color=5), "EG").json()
    eg = eg_data["plans"][0]["id"]
    og_data = import_dxf(client, pid, _floor(tmp / "og-red.dxf", [("10-10", "Schalter, Schema 0, UP", 3)], color=1), "OG").json()
    og = next(plan["id"] for plan in og_data["plans"] if plan["name"] == "OG")
    doc = client.post(f"/api/projects/{pid}/legend/propose", json={}).json()["doc"]
    item = next(item for block in doc["blocks"] for item in block["items"] if item["kind"] == "symbol")
    assert set(item["layer_colors"]) == {"#0000ff", "#ff0000"}
    saved_original = deepcopy(doc)
    for floor, expected in [(eg, "#0000ff"), (og, "#ff0000")]:
        doc["scope"] = {"plan_ids": [floor], "only_present": True}
        layout = _layout(client, pid, doc)
        assert layout["scope_info"]["color_warnings"] == []
        assert {prim["color"] for prim in layout["prims"] if prim["t"] == "symbol"} == {expected}
        assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
        response = client.get(f"/api/projects/{pid}/legend/export", params={"format": "dxf", "general": False})
        assert response.status_code == 200, response.text
        cad = ezdxf.read(StringIO(response.text, newline=None))
        colors = {entity.dxf.true_color for insert in cad.modelspace().query("INSERT")
                  for entity in insert.virtual_entities() if entity.dxf.hasattr("true_color")}
        assert colors == {int(expected[1:], 16)}
        assert client.get(f"/api/projects/{pid}/legend/export", params={"format": "pdf", "general": False}).status_code == 200
    assert doc["blocks"] == saved_original["blocks"]
    doc["scope"] = {"plan_ids": [], "only_present": True}
    all_layout = _layout(client, pid, doc)
    assert {prim["color"] for prim in all_layout["prims"] if prim["t"] == "symbol"} == {"#0000ff", "#ff0000"}


def test_member_snapshots_prove_up_ap_source_keys_colors_and_counts_inside_the_selected_floor(env):
    client, tmp = env
    pid = client.post("/api/projects", json={"name": "Quellvarianten"}).json()["id"]
    first = import_dxf(client, pid, _floor(tmp / "up.dxf", [("10-10", "Schalter, Schema 0, UP", 2)], color=5), "EG").json()
    eg = first["plans"][0]["id"]
    second = import_dxf(client, pid, _floor(tmp / "ap.dxf", [("20-10", "Schalter, Schema 0, AP", 3)], color=1), "OG").json()
    og = next(plan["id"] for plan in second["plans"] if plan["name"] == "OG")
    doc = client.post(f"/api/projects/{pid}/legend/propose", json={}).json()["doc"]
    all_rows = _layout(client, pid, doc)["scope_info"]["rows"]
    members = [member for row in all_rows for member in row["symbol_variants"]]
    assert len(members) == 2
    up = next(member for member in members if member["mounting"] == "UP")
    ap = next(member for member in members if member["mounting"] == "AP")
    assert up["symbol_key"] != ap["symbol_key"]
    assert up["layer_colors"] == ["#0000ff"] and up["total"] == 2
    assert ap["layer_colors"] == ["#ff0000"] and ap["total"] == 3
    assert up["source_colors_complete"] and ap["source_colors_complete"]
    assert up["counts"] == {str(eg): 2} and ap["counts"] == {str(og): 3}
    for plan_id, wanted in [(eg, "UP"), (og, "AP")]:
        doc["scope"] = {"plan_ids": [plan_id], "only_present": True}
        rows = _layout(client, pid, doc)["scope_info"]["rows"]
        selected = [member for row in rows for member in row["symbol_variants"]]
        assert len(selected) == 1 and selected[0]["mounting"] == wanted


def _manual_members():
    doc = _color_document()
    head = doc["blocks"][0]["items"][0]
    head.update(symbol_key="up", color="#0000ff", layer_colors=["#0000ff"],
                parts=[{"family_key": "switch", "symbol_key": "ap", "text": "Taster AP",
                        "color": "#ff0000", "layer_colors": ["#ff0000"], "rotation": 0}])
    result = {"rows": [{"family_key": "switch", "symbol_key": "up", "total": 2,
                        "layer_colors": ["#ff0000"], "source_colors_complete": True,
                        "symbol_variants": [{"symbol_key": "ap", "mounting": "AP", "total": 2,
                                             "layer_colors": ["#ff0000"], "source_colors_complete": True}]}],
              "unknown": []}
    return doc, head, result


def test_manual_members_of_same_family_use_exact_presence_and_keep_source_part_when_promoted():
    doc, head, result = _manual_members()
    original = deepcopy(doc)
    view = scoped_document(doc, result, [{"id": 1, "name": "OG"}])
    shown = view["blocks"][0]["items"][0]
    assert shown["symbol_key"] == "ap" and shown["layer_colors"] == ["#ff0000"]
    assert shown["_source_part"] == 1 and shown["id"] == head["id"] and "parts" not in shown
    assert doc == original
    head["symbol_color"] = "#aa00bb"
    forced = scoped_document(doc, result, [{"id": 1, "name": "OG"}])["blocks"][0]["items"][0]
    assert forced["symbol_color"] == "#aa00bb" and forced["symbol_key"] == "ap" and forced["_source_part"] == 1
    head["keep"] = True
    kept = scoped_document(doc, result, [{"id": 1, "name": "OG"}])["blocks"][0]["items"][0]
    assert kept["symbol_key"] == "up" and kept["layer_colors"] == ["#0000ff"]
    assert kept["parts"][0]["symbol_key"] == "ap" and kept["parts"][0]["layer_colors"] == ["#ff0000"]


def test_distinct_explicit_rows_in_same_family_keep_member_palettes_without_color_cross_product():
    doc, head, result = _manual_members()
    head.pop("parts")
    doc["blocks"][0]["items"].append({"id": "ap-row", "kind": "symbol", "family_key": "switch",
                                     "symbol_key": "ap", "text": "Taster AP", "color": "#ff0000",
                                     "layer_colors": ["#ff0000"]})
    result["rows"][0]["layer_colors"] = ["#0000ff", "#ff0000"]
    result["rows"][0]["symbol_variants"].append({"symbol_key": "up", "mounting": "UP", "total": 1,
                                                "layer_colors": ["#0000ff"], "source_colors_complete": True})
    view = scoped_document(doc, result, [{"id": 1, "name": "EG + OG"}])
    assert [(item["symbol_key"], item["layer_colors"]) for item in view["blocks"][0]["items"]] == [
        ("up", ["#0000ff"]), ("ap", ["#ff0000"])]


def test_same_drawing_key_different_color_rotation_keeps_original_part_index_without_filtering_or_after_promotion():
    doc, head, result = _manual_members()
    head["parts"][0].update(symbol_key="up", rotation=90)
    result["rows"][0]["symbol_variants"][0].update(symbol_key="up", mounting="UP")
    original = deepcopy(doc)
    filtered = scoped_document(doc, result, [{"id": 1, "name": "OG"}])["blocks"][0]["items"][0]
    assert filtered["symbol_key"] == "up" and filtered["rotation"] == 90 and filtered["_source_part"] == 1
    assert filtered["layer_colors"] == ["#ff0000"] and "parts" not in filtered
    assert doc == original
    doc["scope"] = {"plan_ids": [], "only_present": False}
    unfiltered = scoped_document(doc, result, [{"id": 1, "name": "OG"}])["blocks"][0]["items"][0]
    assert unfiltered["_source_part"] == 0 and unfiltered["parts"][0]["_source_part"] == 1
    assert unfiltered.get("rotation", 0) == head.get("rotation", 0)
    saved = normalize({**doc, "blocks": [{**doc["blocks"][0], "items": [unfiltered]}]})
    assert "_source_part" not in saved["blocks"][0]["items"][0]
    assert "_source_part" not in saved["blocks"][0]["items"][0]["parts"][0]


def test_sole_canonical_family_representative_keeps_family_presence_fallback_without_inventing_an_explicit_member():
    doc, head, result = _manual_members()
    head.pop("parts")
    original = deepcopy(doc)
    view = scoped_document(doc, result, [{"id": 1, "name": "OG"}])
    shown = view["blocks"][0]["items"][0]
    assert shown["symbol_key"] == "up" and shown["layer_colors"] == ["#ff0000"]
    assert shown["_source_part"] == 0 and doc == original


def test_reimported_member_colors_update_old_snapshots_unless_a_color_was_explicitly_selected():
    doc, head, result = _manual_members()
    result["rows"][0]["layer_colors"] = ["#ff0000", "#00ff00"]
    result["rows"][0]["symbol_variants"] = [
        {"symbol_key": "up", "mounting": "UP", "total": 1, "layer_colors": ["#ff0000"], "source_colors_complete": True},
        {"symbol_key": "ap", "mounting": "AP", "total": 1, "layer_colors": ["#00ff00"], "source_colors_complete": True}]
    before = deepcopy(doc)
    view = scoped_document(doc, result, [{"id": 1, "name": "Neuer Import"}])["blocks"][0]["items"][0]
    assert view["layer_colors"] == ["#ff0000"] and view["parts"][0]["layer_colors"] == ["#00ff00"]
    assert doc == before
    head["visible_layer_colors"] = ["#0000ff"]
    filtered = scoped_document(doc, result, [{"id": 1, "name": "Neuer Import"}])["blocks"][0]["items"][0]
    assert filtered["symbol_key"] == "ap" and filtered["_source_part"] == 1
