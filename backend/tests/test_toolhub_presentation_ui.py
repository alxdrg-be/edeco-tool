"""Use the real settings UI and persisted policy across routes and reloads."""

from __future__ import annotations

from pathlib import Path

from test_editor_navigation import editor, env, playwright  # noqa: F401


def admin_hub(editor):
    page, _, client, _ = editor
    store = client.app.state.toolhub_presentation
    store.identity, store.windows = "EDECO\\aduerger", True
    page.reload()
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(9)
    return page, store


def set_demo(page, *, only_nova=False):
    page.get_by_role("button", name="Toolhub-Einstellungen", exact=True).click()
    dialog = page.get_by_role("dialog", name="Toolhub-Einstellungen", exact=True)
    dialog.get_by_role("checkbox", name="Demo-Modus", exact=False).check()
    if only_nova:
        for title in ("Berechnungen", "Dateien umbenennen", "PDF-Werkstatt", "Elektro-Memory", "Rack-Dispo"):
            dialog.get_by_role("checkbox", name=title, exact=True).uncheck()
    dialog.get_by_role("button", name="Speichern", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_have_text("Gespeichert.")
    dialog.get_by_role("button", name="Schliessen", exact=True).click()


def test_demo_six_tools_persist_and_hidden_restore_cannot_bypass_scope(editor, tmp_path):
    page, store = admin_hub(editor)
    page.set_viewport_size({"width": 1600, "height": 1000})
    set_demo(page)
    playwright.expect(page.locator(".toolbox")).to_have_attribute("data-toolhub-mode", "demo")
    playwright.expect(page.locator(".toolbox-card")).to_have_count(6)
    assert sorted(page.locator(".toolbox-tile h2").all_text_contents()) == sorted(["NOVA-Legenden", "Dateien umbenennen", "PDF-Werkstatt", "Berechnungen", "Elektro-Memory", "Rack-Dispo"])
    assert page.locator(".toolbox-grid").evaluate("el => getComputedStyle(el).gridTemplateColumns.split(' ').length") == 3
    playwright.expect(page.get_by_role("combobox", name="Aktives Projekt", exact=True)).to_have_count(0)
    playwright.expect(page.locator(".toolbox-badge")).to_have_count(0)
    page.get_by_role("button", name="Werkzeuge", exact=True).click()
    menu = page.get_by_role("dialog", name="Werkzeug wechseln", exact=True)
    playwright.expect(menu.locator(".toolhub-nav-option")).to_have_count(6)
    playwright.expect(menu.get_by_role("button", name="BIM2STEIGER", exact=True)).to_have_count(0)
    page.keyboard.press("Escape")
    page.evaluate("""() => {
      sessionStorage.setItem('edeco-toolbox-active', 'bim2steiger');
      history.replaceState(null, '', location.pathname + location.search);
    }""")
    page.reload()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(6)
    playwright.expect(page.locator('iframe[title="BIM2STEIGER"]')).to_have_count(0)
    assert store.snapshot()["demo_enabled"]
    page.evaluate("location.hash = 'rechner/ls-schalter'")
    playwright.expect(page.get_by_role("heading", name="LS-Schalter · Schutzprüfung", exact=True)).to_be_visible()
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    screenshot = Path(tmp_path) / "demo-sechs-werkzeuge.png"
    page.screenshot(path=str(screenshot), full_page=True)
    page.get_by_role("button", name="Demo beenden", exact=True).click()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(9)
    assert not store.snapshot()["demo_enabled"]


def test_demo_only_nova_hides_knowledge_and_calculator_deep_links(editor):
    page, _ = admin_hub(editor)
    set_demo(page, only_nova=True)
    playwright.expect(page.locator(".toolbox-card")).to_have_count(1)
    playwright.expect(page.get_by_role("button", name="Wissens-Hub", exact=True)).to_have_count(0)
    page.evaluate("location.hash = 'rechner/ls-schalter'")
    playwright.expect(page.locator(".toolbox-card")).to_have_count(1)
    page.wait_for_function("location.hash === '#toolhub'")
    playwright.expect(page.get_by_role("button", name="Rechner wechseln", exact=True)).to_have_count(0)
    page.get_by_role("button", name="NOVA-Legenden öffnen", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Wissens-Hub", exact=True)).to_have_count(0)
    playwright.expect(page.locator(".toolhub-demo-badge")).to_be_visible()


def test_non_admin_settings_are_read_only_and_delivery_is_hidden(editor):
    page, _, client, _ = editor
    client.app.state.toolhub_presentation.identity = "EDECO\\someone"
    client.app.state.toolhub_presentation.windows = True
    page.reload()
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(9)
    playwright.expect(page.get_by_role("button", name="Planlieferungs-Assistent öffnen", exact=True)).to_have_count(0)
    page.get_by_role("button", name="Toolhub-Einstellungen", exact=True).click()
    dialog = page.get_by_role("dialog", name="Toolhub-Einstellungen", exact=True)
    playwright.expect(dialog.get_by_role("checkbox", name="Demo-Modus", exact=False)).to_be_disabled()
    playwright.expect(dialog.get_by_role("button", name="Speichern", exact=True)).to_have_count(0)
    playwright.expect(dialog).to_contain_text("von den hinterlegten Administratoren verwaltet")
