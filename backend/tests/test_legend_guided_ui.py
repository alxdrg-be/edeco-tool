"""The guided NOVA controls act on the same saved legend and exported layout."""

from copy import deepcopy
import re

from nova_legend.legend.model import normalize, section_style
from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_legend_scope import _project


def open_project(page, name="Geschosse", *, after_reload=False):
    if after_reload:
        nova = page.get_by_role("button", name="NOVA-Legenden öffnen", exact=True)
        back = page.get_by_role("button", name="Zurück zu Projekten", exact=True)
        project = page.get_by_role("button", name=name, exact=True)
        nova.or_(back).or_(project).first.wait_for(state="visible")
        if nova.is_visible():
            nova.click()
        elif back.is_visible():
            back.click()
    else:
        page.get_by_role("button", name="Zurück zu Projekten", exact=True).click()
    page.get_by_role("button", name=name, exact=True).click()
    page.get_by_role("button", name="Legende", exact=True).click()
    playwright.expect(page.get_by_role("region", name="Geschossauswahl der Legende", exact=True)).to_be_visible()


def save(page):
    with page.expect_response(lambda response: "/legend" in response.url and response.request.method == "PUT") as saved:
        page.get_by_role("button", name="Legende speichern", exact=True).click()
    assert saved.value.status == 200


def counts(panel):
    return panel.locator(".legend-scope-counts dd").all_text_contents()


def screenshot(page, tmp_path, name):
    # Browser CI captures every run; a local review can copy these to artifacts.
    path = tmp_path / name
    page.screenshot(path=str(path), full_page=True)
    return path


def test_floor_multiselection_counts_preview_save_reload_and_optical_mode_are_explicit(editor, tmp_path):
    page, _, client, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1100})
    pid, eg, og, doc = _project(client, tmp_path)
    assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
    open_project(page)
    panel = page.get_by_role("region", name="Geschossauswahl der Legende", exact=True)
    playwright.expect(panel.locator(".legend-scope-counts dd").first).to_have_text("8")
    assert counts(panel)[:2] == ["8", "3"]
    original = deepcopy(client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"])
    panel.get_by_role("button", name=re.compile(r"^EG")).click()
    playwright.expect(panel.locator(".legend-scope-counts dd").first).to_have_text("4")
    playwright.expect(panel.get_by_label("Nur vorkommende Symbole", exact=True)).to_be_checked()
    playwright.expect(page.locator(".legend-paper")).not_to_contain_text("Funk-Gateway")
    playwright.expect(page.locator(".legend-paper")).to_contain_text("Brandmelder")
    assert counts(panel)[:2] == ["4", "2"]
    # Multi-selection combines quantities, rather than swapping a single floor.
    panel.get_by_role("button", name=re.compile(r"^OG")).click()
    playwright.expect(panel.locator(".legend-scope-counts dd").first).to_have_text("8")
    panel.get_by_role("button", name=re.compile(r"^EG")).click()
    playwright.expect(panel.locator(".legend-scope-counts dd").first).to_have_text("4")
    playwright.expect(page.locator(".legend-paper")).to_contain_text("Funk-Gateway")
    playwright.expect(page.locator(".legend-paper")).not_to_contain_text("Brandmelder")
    page.get_by_role("button", name="Optisch angleichen", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Optisch angleichen", exact=True)).to_have_attribute("aria-pressed", "true")
    save(page)
    stored = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert stored["scope"]["plan_ids"] == [og]
    assert stored["scope"]["only_present"] is True
    assert stored["style"]["symbol_weight"] == "optical"
    assert stored["blocks"] == original["blocks"], "The floor filter is reversible; it must not delete stored symbols."
    assert stored["title"] == original["title"]
    page.reload()
    open_project(page, after_reload=True)
    panel = page.get_by_role("region", name="Geschossauswahl der Legende", exact=True)
    playwright.expect(panel.get_by_role("button", name=re.compile(r"^OG"))).to_have_attribute("aria-pressed", "true")
    playwright.expect(panel.get_by_role("button", name=re.compile(r"^EG"))).to_have_attribute("aria-pressed", "false")
    playwright.expect(panel.locator(".legend-scope-counts dd").first).to_have_text("4")
    playwright.expect(page.get_by_role("button", name="Optisch angleichen", exact=True)).to_have_attribute("aria-pressed", "true")
    page.get_by_role("button", name="Editor gross öffnen", exact=True).click()
    page.get_by_role("button", name="Ganzes Blatt", exact=True).click()
    screenshot(page, tmp_path, "nova-geschossfilter-gross.png")


def test_text_width_warning_selects_the_exact_item_and_table_is_editable(editor, tmp_path):
    page, _, client, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1100})
    pid, _, _, doc = _project(client, tmp_path)
    first = "Gruppe T13 16 A " + "Beleuchtung " * 16
    second = "Gruppe T23 16 A " + "Steckdosen " * 18
    doc["blocks"].append({"id": "long-texts", "title": "Textprüfung", "style": section_style("#0088aa"), "items": [
        {"id": "long-first", "kind": "text", "text": first.strip()},
        {"id": "long-second", "kind": "text", "text": second.strip()},
    ]})
    doc = normalize(doc)
    assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
    open_project(page)
    page.get_by_role("button", name="Editor gross öffnen", exact=True).click()
    text_panel = page.locator(".legend-text-panel")
    text_panel.locator(":scope > summary").click()
    text_panel.get_by_role("button", name="Warnen + Vorschlag", exact=True).click()
    warnings = page.get_by_label("Texthinweise", exact=True)
    selected_warning = warnings.get_by_role("button").filter(has_text=second.strip())
    playwright.expect(selected_warning).to_have_count(1)
    selected_warning.click()
    selected_properties = page.locator(".legend-selection-details")
    playwright.expect(selected_properties.get_by_label("Text", exact=True)).to_have_value(second.strip())
    playwright.expect(selected_properties.get_by_label("Text", exact=True)).to_be_focused()
    # Warnings resolve through exact block/item IDs, even when item kinds match.
    playwright.expect(page.locator('.legend-paper [data-entry="long-second"]')).to_have_count(1)
    screenshot(page, tmp_path, "nova-texthinweis-korrektur.png")
    text_panel.get_by_role("button", name="Tabelle gross bearbeiten", exact=True).click()
    table = page.get_by_role("dialog", name="Abkürzungstabelle bearbeiten", exact=True)
    table.get_by_role("button", name="Regel hinzufügen", exact=True).click()
    table.get_by_label("Langform Regel 1", exact=True).fill("Gruppe")
    table.get_by_label("Kurzform Regel 1", exact=True).fill("Gr.")
    playwright.expect(table.get_by_label("Geltungsbereich Regel 1", exact=True)).to_have_value("all")
    playwright.expect(table.get_by_label("Regel 1 aktiv", exact=True)).to_be_checked()
    screenshot(page, tmp_path, "nova-abkuerzungstabelle.png")
    page.keyboard.press("Escape")
    playwright.expect(table).not_to_be_visible()
    playwright.expect(text_panel.get_by_role("button", name="Tabelle gross bearbeiten", exact=True)).to_be_focused()
    save(page)
    saved = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert saved["text_rules"]["mode"] == "warn"
    assert saved["text_rules"]["rules"][0]["long"] == "Gruppe"
    assert saved["blocks"] == doc["blocks"]


def test_palette_review_preserves_source_colours_and_large_editor_has_separate_panes(editor, tmp_path):
    page, _, client, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1100})
    pid, _, _, doc = _project(client, tmp_path)
    for bid, title, colour in [("colour-a", "Prüffarbe Schwachstrom", "#803300"), ("colour-b", "Prüffarbe ZUKO", "#813401")]:
        doc["blocks"].append({"id": bid, "title": title, "style": section_style(colour), "items": [
            {"id": f"text-{bid}", "kind": "text", "text": "Musterrubrik für die Farbprüfung"},
        ]})
    doc = normalize(doc)
    assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
    open_project(page)
    page.locator('[data-legend-section="colours"] > summary').click()
    conflict = page.locator(".legend-palette-issues button").filter(has_text="Prüffarbe Schwachstrom / Prüffarbe ZUKO")
    playwright.expect(conflict).to_contain_text("Ähnliche Farben")
    conflict.click()
    playwright.expect(page.locator(".legend-selection-details").get_by_label("Überschrift", exact=True)).to_have_value("Prüffarbe Schwachstrom")
    page.get_by_label("Graustufen – nur Vorschau", exact=True).check()
    playwright.expect(page.locator(".legend-editor")).to_have_class(re.compile("preview-grayscale"))
    page.get_by_label("Graustufen – nur Vorschau", exact=True).uncheck()
    assert client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"] == doc
    page.get_by_role("button", name="Editor gross öffnen", exact=True).click()
    canvas = page.locator(".legend-canvas-shell").bounding_box()
    props = page.locator(".legend-props").bounding_box()
    assert canvas and props
    assert canvas["x"] + canvas["width"] <= props["x"] + 1
    assert canvas["width"] > props["width"] * 2
    page.get_by_role("button", name="Ganzes Blatt", exact=True).click()
    screenshot(page, tmp_path, "nova-farbpruefung-gross.png")
    for width in [1100, 760]:
        page.set_viewport_size({"width": width, "height": 1000})
        page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
        bounds = page.get_by_role("dialog", name="Legendeneditor", exact=True).bounding_box()
        assert bounds and bounds["x"] >= 0 and bounds["x"] + bounds["width"] <= width + 1
        assert page.locator(".legend-expand-button").is_visible()
        assert page.get_by_role("dialog", name="Legendeneditor", exact=True).evaluate("element => element.scrollWidth <= element.clientWidth + 1")
        screenshot(page, tmp_path, f"nova-responsive-{width}.png")


def test_filtered_combination_edits_visible_second_part_without_changing_the_hidden_head(editor, tmp_path):
    page, _, client, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1100})
    pid, _, og, doc = _project(client, tmp_path)
    items = [item for block in doc["blocks"] for item in block["items"]]
    first = next(item for item in items if item["text"] == "Brandmelder")
    second = next(item for item in items if item["text"] == "Funk-Gateway")
    first["id"] = "floor-combination"
    first["text"] = "EG Brandmelder Original"
    second["text"] = "OG Gateway Original"
    first["parts"] = [deepcopy(second)]
    for block in doc["blocks"]:
        block["items"] = [item for item in block["items"] if item is not second]
    doc["scope"] = {"plan_ids": [og], "only_present": True, "title_suffix": False, "filename_suffix": False}
    doc = normalize(doc)
    source = deepcopy(next(item for block in doc["blocks"] for item in block["items"] if item["id"] == "floor-combination"))
    assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
    open_project(page)
    paper = page.locator(".legend-paper")
    playwright.expect(paper).to_contain_text("OG Gateway Original")
    playwright.expect(paper).not_to_contain_text("EG Brandmelder Original")
    paper.locator('[data-entry="floor-combination"] .lg-hit').first.click()
    tabs = page.get_by_role("tablist", name="Symbole dieses Eintrags", exact=True)
    playwright.expect(tabs.get_by_role("tab", name="Text 2 / Symbol 2", exact=True)).to_have_attribute("aria-selected", "true")
    playwright.expect(tabs.get_by_role("tab", name="Text 1 / Symbol 1", exact=True)).to_have_attribute("aria-selected", "false")
    properties = page.locator(".legend-selection-details")
    field = properties.get_by_label("Text 2", exact=True)
    playwright.expect(field).to_have_value("OG Gateway Original")
    field.fill("OG Gateway korrigiert")
    field.press("Tab")
    properties.get_by_title("Um 90 Grad drehen", exact=True).click()
    save(page)
    stored = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    changed = next(item for block in stored["blocks"] for item in block["items"] if item["id"] == "floor-combination")
    assert {key: value for key, value in changed.items() if key != "parts"} == {
        key: value for key, value in source.items() if key != "parts"
    }, "The hidden EG head must not be edited through the visible OG part."
    expected_part = {**source["parts"][0], "text": "OG Gateway korrigiert", "rotation": 90}
    assert changed["parts"] == [expected_part]
    playwright.expect(paper).to_contain_text("OG Gateway korrigiert")
    playwright.expect(paper).not_to_contain_text("EG Brandmelder Original")
    screenshot(page, tmp_path, "nova-gefilterte-kombination.png")
