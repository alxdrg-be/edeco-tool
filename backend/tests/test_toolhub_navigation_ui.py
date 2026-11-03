"""Use the shared tool navigation without bypassing editors' leave contracts."""
from __future__ import annotations

import re

from test_editor_navigation import editor, env, playwright, edit_category, expand_card_options  # noqa: F401


def switch_tool(page, title):
    page.get_by_role("button", name="Werkzeuge", exact=True).click()
    menu = page.get_by_role("dialog", name="Werkzeug wechseln", exact=True)
    menu.get_by_role("searchbox", name="Werkzeug suchen", exact=True).fill(title)
    menu.get_by_role("button", name=title, exact=True).click()
    playwright.expect(menu).not_to_be_visible()


def switch_calculator(page, title, query=None):
    page.get_by_role("button", name="Rechner wechseln", exact=True).click()
    menu = page.get_by_role("dialog", name="Rechner wechseln", exact=True)
    menu.get_by_role("searchbox", name="Rechner suchen", exact=True).fill(query or title)
    menu.get_by_role("button", name=title, exact=True).click()
    playwright.expect(menu).not_to_be_visible()


def test_calculator_switcher_preserves_inputs_and_returns_focus_on_escape(editor):
    page, _, _, _ = editor
    switch_tool(page, "Berechnungen")
    playwright.expect(page.get_by_role("heading", name="Berechnungen", exact=True)).to_be_visible()
    playwright.expect(page.get_by_role("button", name="Berechnungen", exact=True)).to_have_count(0)
    playwright.expect(page.get_by_role("img", name="edeco Toolhub", exact=True)).to_have_count(1)
    playwright.expect(page.locator(".lab-heading")).not_to_contain_text("ENGINEERING")
    switch_calculator(page, "LS-Schalter")
    load = page.locator("#wb-load")
    playwright.expect(load).to_be_enabled()
    expand_card_options(load)
    load.fill("14")
    switch_calculator(page, "Kabelberechnung", "Spannungsfall")
    playwright.expect(page).to_have_url(re.compile(r"#rechner/kabelberechnung$"))
    switch_calculator(page, "LS-Schalter")
    playwright.expect(page.locator("#wb-load")).to_have_value("14")
    trigger = page.get_by_role("button", name="Rechner wechseln", exact=True)
    trigger.click()
    menu = page.get_by_role("dialog", name="Rechner wechseln", exact=True)
    playwright.expect(menu.get_by_role("searchbox")).to_be_focused()
    page.keyboard.press("Escape")
    playwright.expect(menu).not_to_be_visible()
    playwright.expect(trigger).to_be_focused()
    page.set_viewport_size({"width": 390, "height": 844})
    trigger.click()
    playwright.expect(menu).to_be_visible()
    assert menu.evaluate("el => { const r=el.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth; }")


def test_global_switcher_can_cancel_or_discard_nova_draft(editor):
    page, _, client, _ = editor
    field, original = edit_category(page)
    switch_tool(page, "Berechnungen")
    confirm = page.get_by_role("alertdialog", name="Änderungen speichern?", exact=True)
    playwright.expect(confirm).to_be_visible()
    confirm.get_by_role("button", name="Abbrechen", exact=True).click()
    playwright.expect(field).to_have_value("Kategorie mit Änderungen")
    switch_tool(page, "Berechnungen")
    confirm.get_by_role("button", name="Verwerfen", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Berechnungen", exact=True)).to_be_visible()
    assert client.get("/api/categories").json()["items"][0]["title"] == original


def test_global_switcher_obeys_bim_open_dialog_guard(editor):
    page, _, _, _ = editor
    switch_tool(page, "BIM2STEIGER")
    bim = page.frame_locator('iframe[title="BIM2STEIGER"]')
    bim.locator("#openSearch").click()
    switch_tool(page, "Berechnungen")
    playwright.expect(bim.locator("#toast")).to_contain_text("offenen Dialog")
    bim.get_by_role("button", name="Suche schliessen", exact=True).click()
    child = next(frame for frame in page.frames if "/tools/bim2steiger/" in frame.url)
    child.wait_for_function("pendingToolRequests === 0")
    switch_tool(page, "Berechnungen")
    playwright.expect(page.get_by_role("heading", name="Berechnungen", exact=True)).to_be_visible()


def test_one_theme_follows_calculators_and_nova(editor):
    page, _, _, _ = editor
    switch_tool(page, "Berechnungen")
    playwright.expect(page.locator(".engineering-lab")).to_be_visible()
    dark = page.get_by_role("button", name="Dunkler Modus", exact=True)
    if dark.count():
        with page.expect_response(lambda response: response.url.endswith("/api/settings/theme") and response.request.method == "PUT"):
            dark.click()
    playwright.expect(page.locator(".engineering-lab")).to_have_attribute("data-lab-theme", "dark")
    with page.expect_response(lambda response: response.url.endswith("/api/settings/theme") and response.request.method == "PUT"):
        page.get_by_role("button", name="Heller Modus", exact=True).click()
    playwright.expect(page.locator("html")).to_have_attribute("data-theme", "light")
    playwright.expect(page.locator(".engineering-lab")).to_have_attribute("data-lab-theme", "light")
    switch_tool(page, "NOVA-Legenden")
    playwright.expect(page.locator("html")).to_have_attribute("data-theme", "light")
    playwright.expect(page.get_by_role("button", name="Dunkler Modus", exact=True)).to_be_visible()
    playwright.expect(page.get_by_role("img", name="edeco Toolhub", exact=True)).to_have_count(1)
