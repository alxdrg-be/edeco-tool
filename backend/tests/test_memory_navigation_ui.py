"""Memory and its shared formula shortcut remain reachable in the five-tool demo."""

from __future__ import annotations

import re

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_toolhub_presentation_ui import admin_hub, set_demo


def test_memory_tile_formula_shortcut_and_browser_back_share_the_real_module(editor):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1600, "height": 1000})
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(9)
    memory = page.get_by_role("button", name="Elektro-Memory öffnen", exact=True)
    playwright.expect(memory).to_be_enabled()
    assert page.locator(".toolbox-grid").evaluate("el => getComputedStyle(el).gridTemplateColumns.split(' ').length") == 5
    memory.click()
    playwright.expect(page).to_have_url(re.compile(r"#memory$"))
    playwright.expect(page.get_by_role("heading", name="Elektro-Memory", exact=True)).to_be_visible()
    playwright.expect(page.get_by_role("tab", name="Nachschlagen", exact=True)).to_have_attribute("aria-selected", "true")
    playwright.expect(page.locator("html")).to_have_attribute("data-tool-color", "indigo")
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(9)
    page.go_back()
    playwright.expect(page).to_have_url(re.compile(r"#memory$"))
    playwright.expect(page.get_by_role("heading", name="Elektro-Memory", exact=True)).to_be_visible()
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    playwright.expect(page.locator(".calc-tile")).to_have_count(26)
    page.get_by_role("button", name="Formelrechner öffnen", exact=True).click()
    playwright.expect(page).to_have_url(re.compile(r"#rechner/formelrechner$"))
    playwright.expect(page.get_by_role("tab", name="Formelrechner", exact=True)).to_have_attribute("aria-selected", "true")
    page.reload()
    playwright.expect(page.get_by_role("tab", name="Formelrechner", exact=True)).to_have_attribute("aria-selected", "true")


def test_memory_and_formula_routes_remain_available_in_demo_and_survive_reload(editor):
    page, _ = admin_hub(editor)
    set_demo(page)
    playwright.expect(page.locator(".toolbox-card")).to_have_count(6)  # default demo set incl. Rack-Dispo
    page.get_by_role("button", name="Elektro-Memory öffnen", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Elektro-Memory", exact=True)).to_be_visible()
    playwright.expect(page).to_have_url(re.compile(r"#memory$"))
    page.reload()
    playwright.expect(page.get_by_role("heading", name="Elektro-Memory", exact=True)).to_be_visible()
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(6)  # default demo set incl. Rack-Dispo
    page.evaluate("location.hash = 'rechner/formelrechner'")
    playwright.expect(page.get_by_role("tab", name="Formelrechner", exact=True)).to_have_attribute("aria-selected", "true")
    page.get_by_role("tab", name="Nachschlagen", exact=True).click()
    playwright.expect(page.get_by_role("tab", name="Nachschlagen", exact=True)).to_have_attribute("aria-selected", "true")
    playwright.expect(page).to_have_url(re.compile(r"#rechner/formelrechner$"))
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.evaluate("""() => {
      sessionStorage.setItem('edeco-toolbox-active', 'elektro-memory');
      history.replaceState(null, '', location.pathname + location.search + '#memory');
    }""")
    page.reload()
    playwright.expect(page.get_by_role("heading", name="Elektro-Memory", exact=True)).to_be_visible()


def test_explicit_nova_only_demo_does_not_restore_memory(editor):
    page, _ = admin_hub(editor)
    set_demo(page, only_nova=True)
    page.evaluate("""() => {
      sessionStorage.setItem('edeco-toolbox-active', 'elektro-memory');
      history.replaceState(null, '', location.pathname + location.search + '#memory');
    }""")
    page.reload()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(1)
    playwright.expect(page.get_by_role("heading", name="Elektro-Memory", exact=True)).to_have_count(0)
