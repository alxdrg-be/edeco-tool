"""The model, plan and delivery workspaces follow the personal admin beta setting."""

from urllib.parse import urlsplit

import pytest

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_toolhub_design_beta_ui import home
from ui_helpers import wait_for_toolhub


BETA_TILES = {
    "IFC-Viewer": "IFC-Modell öffnen",
    "DWG-Werkstatt": "Planvorschau",
    "Planvergleich": "Alter Stand",
    "Planabgabe": "Pläne wählen",
}


def test_grouped_home_opens_new_workspaces_and_exposes_them_in_search(editor):
    page, *_ = editor
    home(page)
    for section in ("Modelle", "Pläne", "Abgabe"):
        playwright.expect(page.get_by_role("heading", name=section, exact=True)).to_be_visible()

    for name, workspace_heading in BETA_TILES.items():
        page.get_by_role("button", name=f"{name} öffnen", exact=True).click()
        playwright.expect(page.locator(".hub-header-title")).to_have_text(name)
        playwright.expect(page.locator("main").get_by_role("heading", name=workspace_heading, exact=True)).to_be_visible()
        home(page)

    page.keyboard.press("Control+k")
    palette = page.get_by_role("dialog", name="Im Toolhub finden")
    palette.get_by_role("searchbox").fill("DWG-Werkstatt")
    palette.get_by_role("button", name="DWG-Werkstatt", exact=True).click()
    playwright.expect(page.locator(".hub-header-title")).to_have_text("DWG-Werkstatt")


@pytest.mark.parametrize("as_admin", [True, False], ids=["admin-beta-off", "standard-user"])
@pytest.mark.parametrize("editor", [False], indirect=True)
def test_classic_cannot_restore_or_deep_link_beta_workspaces(editor, as_admin):
    page, _, client, _ = editor
    if not as_admin:
        store = client.app.state.toolhub_presentation
        store.identity = "EDECO\\planer"
        page.reload()
    home(page)

    for name in BETA_TILES:
        playwright.expect(page.get_by_role("button", name=f"{name} öffnen", exact=True)).to_have_count(0)
    playwright.expect(page.get_by_role("button", name="BIM-Check & Raum-Viewer öffnen")).to_be_enabled()

    # Restoring the last visited workspace must also respect the current user's preference.
    page.evaluate("""() => {
        sessionStorage.setItem('edeco-toolbox-active', 'ifc-viewer');
        history.replaceState(null, '', location.pathname);
    }""")
    page.reload()
    wait_for_toolhub(page)
    assert page.evaluate("sessionStorage.getItem('edeco-toolbox-active')") is None

    base = urlsplit(page.url)._replace(fragment="").geturl()
    page.goto(base + "#rechner/planvergleich")
    wait_for_toolhub(page)
    page.wait_for_function("location.hash === '#toolhub'")
    playwright.expect(page.get_by_role("button", name="Planvergleich öffnen", exact=True)).to_have_count(0)
