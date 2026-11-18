"""Check the reported floating header/filter controls across real workspaces."""
from __future__ import annotations

from ui_helpers import wait_for_toolhub

import pytest

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_toolhub_navigation_ui import switch_calculator, switch_tool


def test_toolhub_header_alignment_palette_and_shared_theme(editor):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1600, "height": 1000})
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    wait_for_toolhub(page)
    palette = page.locator(".toolbox-card.is-available .toolbox-symbol").evaluate_all(
        "nodes => nodes.map(node => getComputedStyle(node).backgroundImage)")
    assert len(palette) == int(page.locator('.toolbox').get_attribute('data-toolhub-count'))
    assert len(set(palette)) == len(palette)
    geometry = page.locator(".toolhub-header-actions").evaluate("""el =>
      [...el.querySelectorAll(':scope > button, :scope > a, .project-picker select')]
        .filter(node => node.getClientRects().length)
        .map(node => { const r=node.getBoundingClientRect(); return {top:r.top,height:r.height}; })
    """)
    assert max(item["top"] for item in geometry) - min(item["top"] for item in geometry) <= 1
    # V10 separates the coloured navigation row from compact tool actions.
    assert all(abs(item["height"] - 34) <= 1 for item in geometry)
    search = page.locator(".toolbox-search").bounding_box()
    categories = page.locator(".toolbox-categories").bounding_box()
    assert 0 <= categories["x"] - search["x"] - search["width"] <= 24
    reference = page.locator(".hub-header-toolbar").evaluate(
        "el => ({font:getComputedStyle(el).fontFamily,bg:getComputedStyle(el).backgroundColor})")
    playwright.expect(page.locator(".hub-header-top")).to_have_css("background-color", "rgb(1, 124, 146)")
    header_edge = page.locator(".toolhub-header").bounding_box()["x"]
    for tool, colour in (
        ("Berechnungen", "rgb(180, 82, 15)"),
        ("Rack-Dispo", "rgb(74, 91, 104)"),
        ("Dateien umbenennen", "rgb(46, 125, 69)"),
        ("Projektzentrale", "rgb(138, 101, 8)"),
        ("Dokumenten-Assistent", "rgb(107, 63, 168)"),
        ("NOVA-Legenden", "rgb(14, 116, 128)"),
    ):
        switch_tool(page, tool)
        # The single edeco mark sits in the shared corner outside the tool header.
        playwright.expect(page.get_by_role("img", name="edeco Toolhub", exact=True)).to_have_count(1)
        playwright.expect(page.locator(".hub-chrome-corner .toolhub-brand-mark")).to_be_visible()
        playwright.expect(page.locator(".hub-header-top")).to_have_css("background-color", colour)
        assert page.locator(".hub-header-toolbar").evaluate("el => ({font:getComputedStyle(el).fontFamily,bg:getComputedStyle(el).backgroundColor})") == reference
        playwright.expect(page.locator("body")).not_to_contain_text("EDECO ENGINEERING")
        # The shared shell aligns; each workspace retains its own canvas/form padding.
        assert abs(page.locator(".toolhub-header").bounding_box()["x"] - header_edge) <= 1
        if tool in {"Berechnungen", "Dateien umbenennen", "Projektzentrale"}:
            title = page.get_by_role("heading", level=1).bounding_box()
            assert title["x"] >= header_edge
            assert title["x"] + title["width"] <= page.viewport_size["width"]


@pytest.mark.parametrize("width", [360, 375, 390])
def test_mobile_calculator_actions_are_compact_and_remain_available(editor, width):
    page, _, _, _ = editor
    switch_tool(page, "Berechnungen")
    switch_calculator(page, "LS-Schalter")
    page.set_viewport_size({"width": width, "height": 844})
    playwright.expect(page.get_by_role("button", name="Zum Toolhub", exact=True)).to_be_visible()
    page.evaluate("document.fonts.ready")
    actions = page.locator(".lab-export-actions")
    playwright.expect(actions).not_to_have_attribute("open", "")
    assert page.locator(".toolhub-header").bounding_box()["height"] <= 150
    rows = page.locator(".toolhub-header-actions").evaluate(
        "el => [...el.children].filter(node => node.getClientRects().length).map(node => node.getBoundingClientRect().top)")
    assert max(rows) - min(rows) <= 1
    playwright.expect(page.locator(".hub-mobile-theme")).to_be_visible()
    playwright.expect(page.locator(".hub-chrome-corner .toolhub-brand-mark")).to_be_visible()
    assert page.locator(".toolhub-header-actions").evaluate("""el => [...el.children]
        .filter(node => node.getClientRects().length)
        .every(node => { const r=node.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth; })""")
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


def test_calculator_actions_catch_resize_between_snapshot_and_subscription(editor):
    """A breakpoint can change before React's effect subscribes, without another event."""
    page, _, _, _ = editor
    switch_tool(page, "Berechnungen")
    switch_calculator(page, "LS-Schalter")
    page.set_viewport_size({"width": 375, "height": 844})
    page.add_init_script("""(() => {
      const nativeMatchMedia = window.matchMedia.bind(window);
      const race = {subscribed: false, staleReads: 0, changeEvents: 0};
      window.__calculatorBreakpointRace = race;
      window.matchMedia = query => {
        const media = nativeMatchMedia(query);
        if (query !== '(max-width: 760px)') return media;
        media.addEventListener('change', () => { race.changeEvents += 1; });
        return new Proxy(media, {
          get(target, key) {
            if (key === 'matches') {
              // The render saw desktop; by subscription time the viewport is mobile.
              if (!race.subscribed) { race.staleReads += 1; return false; }
              return target.matches;
            }
            if (key === 'addEventListener') return (type, listener, options) => {
              if (type === 'change') race.subscribed = true;
              return target.addEventListener(type, listener, options);
            };
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          }
        });
      };
    })();""")
    page.reload()
    actions = page.locator(".lab-export-actions")
    playwright.expect(actions).to_be_attached()
    page.wait_for_function("window.__calculatorBreakpointRace.subscribed")
    assert page.evaluate("window.__calculatorBreakpointRace.staleReads") >= 1
    assert page.evaluate("window.__calculatorBreakpointRace.changeEvents") == 0
    playwright.expect(actions).not_to_have_attribute("open", "")

    summary = actions.locator("summary")
    export = page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)
    for key in ("Enter", "Space"):
        summary.focus()
        page.keyboard.press(key)
        playwright.expect(export).to_be_visible()
        page.keyboard.press("Escape")
        playwright.expect(actions).not_to_have_attribute("open", "")
        playwright.expect(summary).to_be_focused()

    page.set_viewport_size({"width": 1600, "height": 1000})
    playwright.expect(export).to_be_visible()
    page.set_viewport_size({"width": 375, "height": 844})
    playwright.expect(actions).not_to_have_attribute("open", "")


def test_calculator_actions_close_before_native_toggle_is_handled(editor):
    """Escape/outside close must work before the browser's queued toggle is handled."""
    page, _, _, _ = editor
    switch_tool(page, "Berechnungen")
    switch_calculator(page, "LS-Schalter")
    page.set_viewport_size({"width": 375, "height": 844})
    actions = page.locator(".lab-export-actions")
    playwright.expect(actions).not_to_have_attribute("open", "")
    page.evaluate("""() => {
      window.__blockedCalculatorToggleEvents = 0;
      // Keep React from receiving the queued native event. A user's next
      // interaction can arrive first; it must not depend on that event.
      window.addEventListener('toggle', event => {
        if (event.target instanceof HTMLDetailsElement &&
            event.target.classList.contains('lab-export-actions')) {
          window.__blockedCalculatorToggleEvents += 1;
          event.stopImmediatePropagation();
        }
      }, true);
    }""")
    summary = actions.locator("summary")
    export = page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)
    for activation in ("Enter", "Space", "click"):
        for close in ("Escape", "outside"):
            before = page.evaluate("window.__blockedCalculatorToggleEvents")
            if activation == "click":
                summary.click()
            else:
                summary.focus()
                page.keyboard.press(activation)
            playwright.expect(export).to_be_visible()
            page.wait_for_function("before => window.__blockedCalculatorToggleEvents > before", arg=before)
            if close == "Escape":
                page.keyboard.press("Escape")
                playwright.expect(summary).to_be_focused()
            else:
                # The floating panel can cover the heading on a narrow screen.
                page.mouse.click(8, page.viewport_size["height"] - 8)
            playwright.expect(actions).not_to_have_attribute("open", "")
            playwright.expect(export).not_to_be_visible()
