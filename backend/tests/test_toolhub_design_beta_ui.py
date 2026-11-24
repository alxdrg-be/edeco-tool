"""An admin opts into the new shell; everybody else keeps the classic UI."""

from __future__ import annotations

import pytest

from test_editor_navigation import editor, env, playwright  # noqa: F401
from ui_helpers import wait_for_toolhub


def home(page):
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    wait_for_toolhub(page)


def settings(page):
    page.get_by_role("button", name="Toolhub-Einstellungen", exact=True).click()
    dialog = page.get_by_role("dialog", name="Toolhub-Einstellungen", exact=True)
    playwright.expect(dialog).to_be_visible()
    return dialog


def expect_design(page, enabled):
    playwright.expect(page.locator("html")).to_have_attribute("data-design-beta", str(enabled).lower())
    playwright.expect(page.locator(".hub-rail")).to_have_count(1 if enabled else 0)
    playwright.expect(page.locator(".hub-header-top")).to_have_count(1 if enabled else 0)
    # A loaded beta stylesheet must not leave the classic body indented.
    if not enabled:
        assert page.locator(".toolhub-header").bounding_box()["x"] == 0


@pytest.mark.parametrize("editor", [False], indirect=True)
def test_admin_design_opt_in_reload_demo_independence_and_return(editor, tmp_path):
    page, _, client, _ = editor
    store = client.app.state.toolhub_presentation
    home(page)
    expect_design(page, False)
    assert not store.snapshot()["design_beta_enabled"]
    assert not store.design_beta_path.exists()
    page.screenshot(path=str(tmp_path / "toolhub-classic.png"), full_page=True)

    dialog = settings(page)
    toggle = dialog.get_by_role("checkbox", name="Neues Design testen (Beta)", exact=False)
    playwright.expect(toggle).not_to_be_checked()
    page.screenshot(path=str(tmp_path / "admin-design-beta-settings.png"), full_page=True)
    # Switching the shell must not close the dialog or discard its other drafts.
    draft_demo = dialog.get_by_role("checkbox", name="Demo-Modus", exact=False)
    draft_demo.check()
    toggle.click()
    expect_design(page, True)
    playwright.expect(toggle).to_be_checked()
    playwright.expect(draft_demo).to_be_checked()
    assert not store.snapshot()["demo_enabled"]
    draft_demo.uncheck()
    assert store.snapshot()["design_beta_enabled"]
    dialog.get_by_role("button", name="Schliessen", exact=True).click()
    page.screenshot(path=str(tmp_path / "toolhub-beta.png"), full_page=True)
    page.reload()
    wait_for_toolhub(page)
    expect_design(page, True)

    dialog = settings(page)
    dialog.get_by_role("checkbox", name="Demo-Modus", exact=False).check()
    dialog.get_by_role("button", name="Speichern", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_have_text("Gespeichert.")
    dialog.get_by_role("button", name="Schliessen", exact=True).click()
    expect_design(page, True)
    assert store.snapshot()["demo_enabled"]
    page.get_by_role("button", name="Demo beenden", exact=True).click()
    playwright.expect(page.locator(".toolbox")).to_have_attribute("data-toolhub-mode", "normal")
    expect_design(page, True)

    dialog = settings(page)
    dialog.get_by_role("checkbox", name="Neues Design testen (Beta)", exact=False).click()
    expect_design(page, False)
    dialog.get_by_role("button", name="Schliessen", exact=True).click()
    page.reload()
    wait_for_toolhub(page)
    expect_design(page, False)
    assert not store.snapshot()["design_beta_enabled"]


def test_non_admin_stays_classic_cannot_opt_in_and_can_use_calculators(editor):
    page, _, client, _ = editor
    store = client.app.state.toolhub_presentation
    assert store.snapshot()["design_beta_enabled"]
    store.identity = "EDECO\\someone"
    page.reload()
    home(page)
    expect_design(page, False)
    assert not store.snapshot()["design_beta_enabled"]
    dialog = settings(page)
    playwright.expect(dialog.get_by_role("checkbox", name="Neues Design testen (Beta)", exact=False)).to_have_count(0)
    dialog.get_by_role("button", name="Schliessen", exact=True).click()
    status = page.evaluate("""async () => (await fetch('/api/toolbox/presentation/design-beta', {
      method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({enabled: true})
    })).status""")
    assert status == 403
    page.reload()
    wait_for_toolhub(page)
    expect_design(page, False)

    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Berechnungen", exact=True)).to_be_visible()
    expect_design(page, False)
    page.get_by_role("button", name="Rechner wechseln", exact=True).click()
    menu = page.get_by_role("dialog", name="Rechner wechseln", exact=True)
    menu.get_by_role("button", name="LS-Schalter", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="LS-Schalter · Schutzprüfung", exact=True)).to_be_visible()
    playwright.expect(page.locator("#wb-load")).to_be_enabled()
    home(page)
    expect_design(page, False)


def test_second_admin_has_independent_design_choice(editor):
    page, _, client, _ = editor
    store = client.app.state.toolhub_presentation
    assert store.snapshot()["design_beta_enabled"]
    store.identity = "EDECO\\nstrauss"
    page.reload()
    home(page)
    expect_design(page, False)
    dialog = settings(page)
    toggle = dialog.get_by_role("checkbox", name="Neues Design testen (Beta)", exact=False)
    playwright.expect(toggle).not_to_be_checked()
    toggle.click()
    expect_design(page, True)
    toggle.click()
    expect_design(page, False)
    dialog.get_by_role("button", name="Schliessen", exact=True).click()
    store.identity = "EDECO\\aduerger"
    page.reload()
    wait_for_toolhub(page)
    expect_design(page, True)
