"""The compact NOVA workspace keeps source drawings and save/export contracts intact."""

import pytest

from test_editor_navigation import editor, env, playwright  # noqa: F401


def test_document_search_and_collapsible_panes_do_not_edit_the_legend(editor, tmp_path):
    page, _, client, (pid, _) = editor
    page.set_viewport_size({"width": 1440, "height": 1000})
    original = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    page.get_by_role("button", name="Editor gross öffnen", exact=True).click()
    view = page.get_by_role("dialog", name="Legendeneditor", exact=True)
    canvas = view.locator(".legend-canvas-shell")
    initial_width = canvas.bounding_box()["width"]
    view.get_by_role("button", name="Eigenschaften ausblenden", exact=True).click()
    playwright.expect(view.locator("#legend-properties")).not_to_be_visible()
    assert canvas.bounding_box()["width"] > initial_width
    view.get_by_role("button", name="Abschnitte ausblenden", exact=True).click()
    playwright.expect(view.locator("#legend-sections-outline")).not_to_be_visible()
    page.set_viewport_size({"width": 1100, "height": 900})
    playwright.expect(view.locator("#legend-properties")).not_to_be_visible()
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.keyboard.press("Control+f")
    search = view.get_by_role("searchbox", name="In dieser Legende suchen", exact=True)
    playwright.expect(search).to_be_focused()
    search.fill("Schalter")
    matches = view.get_by_label("Treffer in dieser Legende", exact=True)
    matches.get_by_role("button").first.click()
    playwright.expect(view.locator("#legend-properties")).to_be_visible()
    playwright.expect(view.locator(".legend-selection-details")).to_contain_text("Ausgewähltes Element")
    view.get_by_role("button", name="Ganzes Blatt", exact=True).click()
    page.screenshot(path=str(tmp_path / "nova-v10-workspace.png"), full_page=True)
    assert client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"] == original
    with page.expect_download() as downloaded:
        view.get_by_role("button", name="PDF herunterladen", exact=True).click()
    assert downloaded.value.suggested_filename.endswith(".pdf")
    downloaded.value.save_as(tmp_path / "nova-v10-export.pdf")
    view.get_by_role("button", name="Zurück zu Projekten", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Deine Projekte", exact=True)).to_be_visible()
    assert client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"] == original


@pytest.mark.parametrize("enlarged", [False, True], ids=["embedded", "enlarged"])
def test_command_palette_cannot_edit_the_legend_behind_it(editor, enlarged):
    page, title, client, (pid, _) = editor
    page.set_viewport_size({"width": 1440, "height": 1000})
    # Give Undo a real edit to undo; a title-only selection would not exercise Delete.
    with page.expect_response(lambda response: response.request.method == "PUT" and "/legend" in response.url):
        title.fill("Titel bleibt trotz Suche erhalten")
    original = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    if enlarged:
        page.get_by_role("button", name="Editor gross öffnen", exact=True).click()
    page.keyboard.press("Control+f")
    search = page.get_by_role("searchbox", name="In dieser Legende suchen", exact=True)
    search.fill("Schalter")
    page.get_by_label("Treffer in dieser Legende", exact=True).get_by_role("button").first.click()
    search.fill("")
    selected = page.locator(".legend-outline .outline-item.active")
    selected.focus()
    rows = page.locator(".legend-outline .outline-block .outline-text")
    labels = rows.all_text_contents()
    assert len(labels) >= 2

    page.keyboard.press("Control+k")
    palette = page.get_by_role("dialog", name="Im Toolhub finden", exact=True)
    playwright.expect(palette).to_be_visible()
    page.keyboard.press("ArrowDown")
    assert palette.locator(".hub-command-result").evaluate_all("nodes => nodes.includes(document.activeElement)")
    for key in ("Delete", "Control+z", "ArrowDown", "Control+y"):
        page.keyboard.press(key)
    # Independently verify the editor guard, even without a portal's bubbling boundary.
    selected.evaluate("node => node.dispatchEvent(new KeyboardEvent('keydown', {key: 'Delete', bubbles: true}))")
    playwright.expect(rows).to_have_text(labels)
    last_button = palette.locator("button:not(:disabled)").last
    last_button.focus()
    page.keyboard.press("Tab")
    playwright.expect(palette.get_by_role("button", name="Suche schliessen", exact=True)).to_be_focused()
    page.keyboard.press("Shift+Tab")
    playwright.expect(last_button).to_be_focused()
    page.keyboard.press("Escape")
    playwright.expect(palette).not_to_be_visible()
    playwright.expect(selected).to_be_focused()
    if enlarged:
        playwright.expect(page.get_by_role("dialog", name="Legendeneditor", exact=True)).to_be_visible()
    page.get_by_role("button", name="T Titel", exact=True).click()
    playwright.expect(title).to_have_value("Titel bleibt trotz Suche erhalten")

    page.keyboard.press("Control+f")
    search.fill("Schalter")
    page.get_by_label("Treffer in dieser Legende", exact=True).get_by_role("button").first.click()
    search.fill("")
    selected.focus()
    selected.evaluate("""node => {
      const event = new KeyboardEvent('keydown', {key: 'Delete', bubbles: true, cancelable: true});
      event.preventDefault(); node.dispatchEvent(event);
    }""")
    playwright.expect(rows).to_have_text(labels)
    # The editor's own enlarged dialog must still support normal keyboard editing.
    page.keyboard.press("Delete")
    playwright.expect(rows).to_have_count(len(labels) - 1)
    page.keyboard.press("Control+z")
    playwright.expect(rows).to_have_text(labels)
    page.get_by_role("button", name="Zurück zu Projekten", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Deine Projekte", exact=True)).to_be_visible()
    assert client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"] == original
