"""Late archive defaults must not overwrite a person's edits in the save drawer."""
from __future__ import annotations

import re
from urllib.parse import urlsplit

import pytest

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_network_planner_ui import open_network


@pytest.mark.parametrize("cleared", [False, True], ids=["typed-values", "intentionally-cleared"])
def test_late_archive_defaults_preserve_title_and_author(editor, tmp_path, cleared):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1600, "height": 1000})
    address = urlsplit(page.url)
    base = f"{address.scheme}://{address.netloc}"
    projects = page.request.get(base + "/api/tools/projektzentrale/state").json()
    created = page.request.post(base + "/api/tools/projektzentrale/projects", headers={"X-Edeco-Projects": projects["session_key"]}, data={"number": "1498", "name": "Schulhaus Netzplanung"})
    assert created.ok
    archive_api = base + "/api/tools/berechnungsablage"
    state = page.request.get(archive_api + "/state").json()
    folder = tmp_path / "server"
    folder.mkdir()
    configured = page.request.post(archive_api + "/settings", headers={"X-Edeco-Projects": state["session_key"]}, data={"root": str(folder), "subfolder": "Berechnungen", "revision": state["settings"]["revision"]})
    assert configured.ok
    open_network(page)
    held = []
    pattern = re.compile(r"/api/tools/berechnungsablage/state$")

    def hold(route):
        held.append(route)

    page.route(pattern, hold)
    with page.expect_request(pattern):
        page.get_by_role("button", name="Projektbezogen auf Server speichern", exact=True).click()
    dialog = page.get_by_role("dialog", name="Projektbezogen speichern", exact=True)
    playwright.expect(dialog.get_by_label("Ablage-Projektnummer", exact=True)).to_have_value("1498")
    title = dialog.get_by_label("Rechenstand-Bezeichnung", exact=True)
    author = dialog.get_by_label("Rechenstand-Bearbeiter", exact=True)
    title.fill("Offener Netzentwurf")
    author.fill("Prüfende Person")
    if cleared:
        title.fill("")
        author.fill("")
    save = dialog.get_by_role("button", name="Als neuen Stand speichern", exact=True)
    playwright.expect(save).to_be_disabled()
    assert held
    for route in held:
        route.fulfill(response=route.fetch())
    page.unroute(pattern, hold)
    playwright.expect(save).to_be_enabled()
    playwright.expect(title).to_have_value("" if cleared else "Offener Netzentwurf")
    playwright.expect(author).to_have_value("" if cleared else "Prüfende Person")
    if cleared:
        assert title.evaluate("el => el.validity.valueMissing")
        assert author.evaluate("el => el.validity.valueMissing")
        title.fill("Offener Netzentwurf")
        author.fill("Prüfende Person")
    with page.expect_response(lambda response: response.url.endswith("/api/tools/berechnungsablage/records") and response.request.method == "POST") as saved:
        save.click()
    record = saved.value.json()
    assert saved.value.ok and record["title"] == "Offener Netzentwurf" and record["author"] == "Prüfende Person"
    playwright.expect(dialog.get_by_role("status")).to_contain_text("Gemeinsam gespeichert")
    page.get_by_role("button", name="Information schliessen", exact=True).click()
    page.get_by_role("button", name="Gemeinsame Berechnungsablage öffnen", exact=True).click()
    playwright.expect(page.locator(".archive-item").filter(has_text="Offener Netzentwurf")).to_be_visible()
