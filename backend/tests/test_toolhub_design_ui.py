"""Check the reported floating header/filter controls across real workspaces."""
from __future__ import annotations

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_toolhub_navigation_ui import switch_calculator, switch_tool


def test_toolhub_header_alignment_palette_and_shared_theme(editor):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1600, "height": 1000})
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(10)
    palette = page.locator(".toolbox-card.is-available .toolbox-symbol").evaluate_all(
        "nodes => nodes.map(node => getComputedStyle(node).backgroundImage)")
    assert len(palette) == 8 and len(set(palette)) == 8
    geometry = page.locator(".toolhub-header-actions").evaluate("""el =>
      [...el.querySelectorAll(':scope > button, :scope > a, .project-picker select')]
        .filter(node => node.getClientRects().length)
        .map(node => { const r=node.getBoundingClientRect(); return {top:r.top,height:r.height}; })
    """)
    assert max(item["top"] for item in geometry) - min(item["top"] for item in geometry) <= 1
    assert all(abs(item["height"] - 42) <= 1 for item in geometry)
    search = page.locator(".toolbox-search").bounding_box()
    categories = page.locator(".toolbox-categories").bounding_box()
    assert 0 <= categories["x"] - search["x"] - search["width"] <= 24
    reference = page.locator(".toolhub-header").evaluate(
        "el => ({font:getComputedStyle(el).fontFamily,bg:getComputedStyle(el).backgroundColor})")
    content_edge = None
    for tool in ("Berechnungen", "Planlieferungs-Assistent", "Dateien umbenennen", "Projektzentrale", "Dokumenten-Assistent", "NOVA-Legenden"):
        switch_tool(page, tool)
        header = page.locator(".toolhub-header")
        playwright.expect(header.get_by_role("img", name="edeco Toolhub", exact=True)).to_have_count(1)
        assert header.evaluate("el => ({font:getComputedStyle(el).fontFamily,bg:getComputedStyle(el).backgroundColor})") == reference
        playwright.expect(page.locator("body")).not_to_contain_text("EDECO ENGINEERING")
        if tool in {"Berechnungen", "Planlieferungs-Assistent", "Dateien umbenennen", "Projektzentrale"}:
            edge = page.get_by_role("heading", level=1).bounding_box()["x"]
            if content_edge is None:
                content_edge = edge
            assert abs(edge - content_edge) <= 1
        if tool == "Planlieferungs-Assistent":
            naming = page.locator("details.rename-naming")
            assert naming.get_attribute("open") is None
            playwright.expect(page.get_by_role("button", name="PDFs hinzufügen", exact=True)).to_be_in_viewport()
            naming.locator("summary").click()
            playwright.expect(page.get_by_label("Fachbereich", exact=True)).to_be_visible()


def test_mobile_calculator_actions_are_compact_and_remain_available(editor):
    page, _, _, _ = editor
    switch_tool(page, "Berechnungen")
    switch_calculator(page, "LS-Schalter")
    page.set_viewport_size({"width": 390, "height": 844})
    playwright.expect(page.get_by_role("button", name="Zum Toolhub", exact=True)).to_be_visible()
    actions = page.locator(".lab-export-actions")
    playwright.expect(actions).not_to_have_attribute("open", "")
    assert page.locator(".toolhub-header").bounding_box()["height"] <= 150
    actions.locator("summary").click()
    export = page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)
    playwright.expect(export).to_be_visible()
    assert actions.locator(".lab-extra-panel").evaluate("el => { const r=el.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth; }")
    with page.expect_download() as download:
        export.click()
    assert download.value.suggested_filename.endswith(".json")
    page.keyboard.press("Escape")
    playwright.expect(actions.locator("summary")).to_be_focused()
    page.set_viewport_size({"width": 1600, "height": 1000})
    playwright.expect(export).to_be_visible()
