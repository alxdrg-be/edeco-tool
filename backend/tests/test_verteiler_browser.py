"""Real distribution-editor flows against isolated SQLite and the built React UI."""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import socket
import threading
import time

from fastapi import FastAPI
import pytest
import uvicorn

from edeco_toolbox import APP_NAME, APP_VERSION, BUILD, COMMIT
from edeco_toolbox.local_security import register as register_security
from edeco_toolbox.presentation import register as register_presentation
from edeco_toolbox.tools.projects.api import register as register_projects
from edeco_toolbox.tools.verteiler_dispo.api import PREFIX, register as register_verteiler
from edeco_toolbox.ui_cache import CurrentUIFiles
from edeco_toolbox.update_api import register as register_updates
from test_editor_navigation import launch_chromium, playwright


@pytest.fixture()
def verteiler_ui(tmp_path, monkeypatch):
    default = Path(__file__).resolve().parents[2] / "ui" / "dist"
    ui = Path(os.environ.get("EDECO_TEST_UI_DIR", os.environ.get("NOVA_TEST_UI_DIR", default)))
    if not (ui / "index.html").is_file():
        pytest.skip("Build the UI before browser tests")
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path / "toolhub"))
    monkeypatch.setenv("NOVA_LEGENDEN_HOME", str(tmp_path / "nova"))
    app = FastAPI()
    register_security(app)
    register_presentation(app)
    register_projects(app)
    register_verteiler(app)
    register_updates(app)
    app.state.updates.automatic = False

    @app.get("/api/toolbox/status")
    def status():
        return {"name": APP_NAME, "version": APP_VERSION, "build": BUILD, "commit": COMMIT}

    app.mount("/", CurrentUIFiles(directory=ui, html=True), name="test-toolhub-ui")
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    origin = f"http://127.0.0.1:{sock.getsockname()[1]}"
    server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise RuntimeError("Verteiler test API did not start")
        time.sleep(.02)
    try:
        with playwright.sync_playwright() as pw:
            browser = launch_chromium(pw)
            context = browser.new_context(base_url=origin, viewport={"width": 1440, "height": 1000}, accept_downloads=True)
            page = context.new_page()
            errors, requests = [], []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("request", lambda request: requests.append(request.url))
            page.goto(origin)
            page.get_by_role("button", name="Verteiler-Dispo öffnen", exact=True).click()
            playwright.expect(page.get_by_role("heading", name="Verteiler-Dispo", exact=True)).to_be_visible()
            playwright.expect(page.locator('svg[data-view="front"]')).to_be_visible()
            yield page
            assert not errors
            assert not [url for url in requests if "/tools/bim2steiger" in url or "steiger2bim" in url]
            context.close()
            browser.close()
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()


def add_ls(page):
    catalog = page.request.get(PREFIX + "/catalog").json()
    profile = next(item for item in catalog["profiles"] if item["id"] == "generic-mcb-1")
    button = page.get_by_role("button", name=profile["name"] + " hinzufügen", exact=True)
    for group in button.locator("xpath=ancestor::details").all():
        if group.get_attribute("open") is None:
            group.locator("summary").first.click()
    button.click()
    playwright.expect(page.get_by_label("Bezeichnung / BMK", exact=True)).to_be_visible()


def persisted_document(page, predicate=lambda _document: True):
    """Observe the real saved state, including autosave, without reading React internals."""
    save = page.get_by_role("button", name="Speichern", exact=True)
    triggered = False
    deadline = time.monotonic() + 10
    last = None
    while time.monotonic() < deadline:
        if not triggered and save.is_enabled():
            save.click()
            triggered = True
        response = page.request.get(PREFIX + "/documents")
        assert response.ok
        summaries = response.json()
        for summary in summaries:
            saved = page.request.get(PREFIX + "/documents/" + summary["id"])
            assert saved.ok
            last = saved.json()["document"]
            if predicate(last):
                return last
        page.wait_for_timeout(100)
    raise AssertionError(f"The requested edited document did not reach SQLite: {last}")


def placement_positions(page):
    return page.locator("svg[data-view] [data-placement-id]").evaluate_all("""nodes => Object.fromEntries(nodes.map(node =>
      [node.dataset.placementId, [node.dataset.xMm, node.dataset.yMm]]))""")


def test_device_edit_view_switch_and_saved_reload_keep_the_same_assembly(verteiler_ui):
    page = verteiler_ui
    add_ls(page)
    page.get_by_label("Bezeichnung / BMK", exact=True).fill("Q-PRUEF-EG")
    saved = persisted_document(page, lambda doc: any(item["label"] == "Q-PRUEF-EG" for item in doc["cabinet"]["placements"]))
    placement = next(item for item in saved["cabinet"]["placements"] if item["label"] == "Q-PRUEF-EG")
    playwright.expect(page.locator(f'[data-placement-id="{placement["id"]}"]')).to_be_visible()
    front = placement_positions(page)
    page.get_by_role("button", name="Einbauansicht", exact=True).click()
    playwright.expect(page.locator('svg[data-view="internal"]')).to_be_visible()
    assert placement_positions(page) == front
    page.get_by_role("button", name="Mit Abdeckungen", exact=True).click()
    playwright.expect(page.locator('svg[data-view="front"]')).to_be_visible()
    assert placement_positions(page) == front
    page.reload()
    playwright.expect(page.get_by_role("heading", name="Verteiler-Dispo", exact=True)).to_be_visible()
    target = page.locator(f'svg[data-view] [data-placement-id="{placement["id"]}"]')
    playwright.expect(target).to_be_visible()
    target.click()
    playwright.expect(page.get_by_label("Bezeichnung / BMK", exact=True)).to_have_value("Q-PRUEF-EG")
    restored = persisted_document(page, lambda doc: any(item["label"] == "Q-PRUEF-EG" for item in doc["cabinet"]["placements"]))
    assert restored["cabinet"]["placements"] == saved["cabinet"]["placements"]


def test_operator_selection_saves_each_actual_source_profile(verteiler_ui):
    page = verteiler_ui
    catalog = page.request.get(PREFIX + "/catalog").json()
    for operator in ("iwb", "primeo", "ebl"):
        page.get_by_label("Netzbetreiber", exact=True).select_option(operator)
        saved = persisted_document(page, lambda doc: doc["vnb_id"] == operator)
        expected = next(profile for profile in catalog["vnb_profiles"] if profile["id"] == operator)
        assert saved["vnb_profile_version"] == expected["edition"]
        assert set(expected["source_ids"]) <= {source["id"] for source in saved["sources"]}
    page.reload()
    playwright.expect(page.get_by_label("Netzbetreiber", exact=True)).to_have_value("ebl")


def test_future_import_preserves_draft_and_issue_opens_the_actual_wrong_field(verteiler_ui):
    page = verteiler_ui
    add_ls(page)
    page.get_by_label("Bezeichnung / BMK", exact=True).fill("Q-FEHLER")
    original = persisted_document(page, lambda doc: any(item["label"] == "Q-FEHLER" for item in doc["cabinet"]["placements"]))
    payload = {**original, "schema_version": 99, "name": "MUST NOT REPLACE CURRENT DRAFT"}
    page.get_by_label("Verteiler-JSON importieren", exact=True).set_input_files({
        "name": "future.edeco-dispo.json", "mimeType": "application/json", "buffer": json.dumps(payload).encode()})
    playwright.expect(page.get_by_role("alert").filter(has_text=re.compile("Version 1|Dateiversion|Verteiler-Datei"))).to_be_visible()
    playwright.expect(page.get_by_label("Bezeichnung / BMK", exact=True)).to_have_value("Q-FEHLER")
    assert persisted_document(page)["cabinet"]["placements"] == original["cabinet"]["placements"]
    position = page.get_by_label("X (mm)", exact=True)
    position.fill("-50")
    position.press("Enter")
    report = page.get_by_role("button", name=re.compile("^Prüfbericht")).or_(page.get_by_role("tab", name=re.compile("^Prüfbericht")))
    report.click()
    issue = page.get_by_text("«Q-FEHLER» passt nicht in den Innenraum.", exact=True)
    playwright.expect(issue).to_be_visible()
    issue.click()
    playwright.expect(page.get_by_label("X (mm)", exact=True)).to_be_focused()
    playwright.expect(page.get_by_label("X (mm)", exact=True)).to_have_value("-50")
    playwright.expect(page.get_by_label("Bezeichnung / BMK", exact=True)).to_have_value("Q-FEHLER")


def test_responsive_workspace_keeps_the_drawing_and_controls_reachable(verteiler_ui):
    page = verteiler_ui
    for width, height in ((1440, 1000), (1100, 900), (820, 900)):
        page.set_viewport_size({"width": width, "height": height})
        canvas = page.get_by_label("Verteiler-Zeichenfläche", exact=True)
        playwright.expect(canvas).to_be_visible()
        for name in ("Mit Abdeckungen", "Einbauansicht", "Speichern"):
            control = page.get_by_role("button", name=name, exact=True)
            playwright.expect(control).to_be_visible()
            control.scroll_into_view_if_needed()
            assert control.evaluate("""element => {
              const b=element.getBoundingClientRect();
              const at=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
              return at===element || element.contains(at);
            }"""), f"{name} is obscured at {width}px"
        bounds = canvas.bounding_box()
        assert bounds and bounds["width"] >= 280 and bounds["height"] >= 300
        assert bounds["x"] >= -1 and bounds["x"] + bounds["width"] <= width + 1
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 2"), f"Horizontal page overflow at {width}px"


def test_ctrl_wheel_zooms_only_the_drawing_not_the_application(verteiler_ui):
    page = verteiler_ui
    canvas = page.get_by_label("Verteiler-Zeichenfläche", exact=True)
    indicator = canvas.locator(".vd-canvas-controls span")
    before = indicator.inner_text()
    window_width = page.evaluate("innerWidth")
    physical_positions = placement_positions(page)
    canvas.hover()
    page.keyboard.down("Control")
    try:
        page.mouse.wheel(0, -180)
    finally:
        page.keyboard.up("Control")
    playwright.expect(indicator).not_to_have_text(before)
    assert page.evaluate("innerWidth") == window_width
    assert placement_positions(page) == physical_positions


def test_reloaded_company_profile_can_be_dragged_without_mutating_the_old_snapshot(verteiler_ui, tmp_path):
    page = verteiler_ui
    before = persisted_document(page)
    catalog = page.request.get(PREFIX + "/catalog").json()
    profile = dict(next(item for item in catalog["profiles"] if item["kind"] == "custom"))
    profile.update(id="firma:browser-drag", name="Firmenapparat Dragtest", width_mm=40.0, height_mm=60.0,
                   depth_mm=20.0, mounting="free", source_ids=["firma:browser-source"], geometry_status="generic")
    source = {"id": "firma:browser-source", "issuer": "Firmenvorgabe", "title": "Browser-Prüfmuster",
              "url": "https://example.test/geraet.pdf", "edition": "Teststand 1", "checked_on": "2026-11-15",
              "sha256": "", "pages": "", "notes": "Eigene Geometrie, keine Herstellerfreigabe."}
    path = tmp_path / "Firmenbibliothek.json"
    path.write_text(json.dumps({"schema_version": 1, "profiles": [profile], "sources": [source]}), encoding="utf-8")
    page.get_by_role("button", name="Firmenvorlagen", exact=True).click()
    page.get_by_label("Firmenbibliothek-Pfad", exact=True).fill(str(path))
    page.get_by_role("button", name="Pfad speichern", exact=True).click()
    load = page.get_by_role("button", name="Vorlagen laden", exact=True)
    playwright.expect(load).to_be_enabled()
    load.click()
    playwright.expect(page.get_by_text("Firmenvorlagen lokal übernommen. Bestehende Verteiler bleiben unverändert.", exact=True)).to_be_visible()
    page.get_by_role("button", name="Firmenvorlagen schliessen", exact=True).click()
    button = page.get_by_role("button", name="Firmenapparat Dragtest hinzufügen", exact=True)
    playwright.expect(button).to_be_visible()
    unchanged = persisted_document(page)
    assert unchanged["sources"] == before["sources"]
    assert unchanged["profiles"] == before["profiles"]
    assert not any(item["id"] == profile["id"] for item in unchanged["profiles"])
    button.drag_to(page.get_by_label("Verteiler-Zeichenfläche", exact=True), target_position={"x": 180, "y": 190})
    playwright.expect(page.get_by_label("Bezeichnung / BMK", exact=True)).to_have_value(profile["name"])
    saved = persisted_document(page, lambda doc: any(item["profile_id"] == profile["id"] for item in doc["cabinet"]["placements"]))
    assert saved["sources"][:len(before["sources"])] == before["sources"]
    assert next(item for item in saved["profiles"] if item["id"] == profile["id"])["source_ids"] == [source["id"]]
    assert any(item["id"] == source["id"] for item in saved["sources"])
