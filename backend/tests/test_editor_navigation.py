"""Exercise the actual React editor against an isolated local API and SQLite DB."""

from __future__ import annotations

import os
import re
import socket
import threading
import time
from pathlib import Path

import pytest
import uvicorn

playwright = pytest.importorskip("playwright.sync_api")

from edeco_toolbox.app import create_app
from test_phase2 import import_dxf, nova_like_dxf
from test_phase3 import env  # noqa: F401 - isolated settings and catalogue


def launch_chromium(pw):
    """Chromium for the browser tests: NOVA_TEST_CHROMIUM, Playwright's own, or one found
    on the machine. Without any browser the tests are skipped locally; in CI (GitHub
    Actions sets CI=true) they must run, so a missing browser fails there."""
    candidates = [os.environ.get("NOVA_TEST_CHROMIUM") or None]
    candidates += sorted(str(p) for p in Path("/opt/pw-browsers").glob("chromium-*/chrome-linux/chrome"))
    error = None
    for path in candidates:
        try:
            return pw.chromium.launch(executable_path=path, headless=True)
        except Exception as exc:  # noqa: BLE001 - try the next browser
            error = exc
    if os.environ.get("CI"):
        raise RuntimeError(f"Kein Chromium für die Browser-Tests: {error}")
    pytest.skip("Kein Chromium für die Browser-Tests gefunden (NOVA_TEST_CHROMIUM setzen)")


def open_app(page, port):
    """Open the local UI. Windows CI sometimes reports ERR_NO_BUFFER_SPACE for a moment."""
    url = f"http://127.0.0.1:{port}"
    last = None
    for attempt in range(5):
        try:
            page.goto(url, wait_until="domcontentloaded")
            page.get_by_role("button", name="NOVA-Legenden öffnen", exact=True).click()
            return
        except Exception as exc:  # noqa: BLE001 - only transient network errors are retried
            last = exc
            text = str(exc)
            transient = (
                "ERR_NO_BUFFER_SPACE" in text
                or "ERR_CONNECTION" in text
                or "ERR_NETWORK_CHANGED" in text
                or "ERR_INSUFFICIENT_RESOURCES" in text
            )
            if not transient or attempt == 4:
                raise
            time.sleep(0.5 * (attempt + 1))
    raise last


@pytest.fixture()
def editor(env):
    client, tmp = env
    ui = Path(__file__).resolve().parents[2] / "ui" / "dist"
    if not (ui / "index.html").is_file():
        pytest.skip("Build the UI with npm run build before browser tests")
    ids = []
    for name in ("Browser A", "Browser B"):
        pid = client.post("/api/projects", json={"name": name}).json()["id"]
        assert import_dxf(client, pid, nova_like_dxf(tmp / f"{name}.dxf")).status_code == 200
        doc = client.post(f"/api/projects/{pid}/legend/propose", json={}).json()["doc"]
        doc["title"]["text"] = name
        assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
        ids.append(pid)
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(
        create_app(client.app.state.nova, ui_dir=ui), log_level="error"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise RuntimeError("Browser test API did not start")
        time.sleep(0.02)
    try:
        with playwright.sync_playwright() as pw:
            browser = launch_chromium(pw)
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            open_app(page, port)
            page.get_by_text("Browser A", exact=True).click()
            page.get_by_role("button", name="Legende", exact=True).click()
            page.get_by_role("button", name="T Titel", exact=True).click()
            field = page.get_by_label("Text", exact=True)
            playwright.expect(field).to_have_value("Browser A")
            playwright.expect(page.get_by_label("Textgrösse Titel", exact=True)).to_have_value("5")
            assert page.locator(".legend-project").count() == 0
            yield page, field, client, ids
            assert not errors
            browser.close()
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()


# the editor saves to one named legend: /legend?legend=<id>
LEGEND_URL = re.compile(r"/legend(\?.*)?$")


def test_returning_to_toolbox_saves_the_open_legend_and_filters_tools(editor):
    page, field, client, (pid, _) = editor
    field.fill("Aus der Toolbox gespeichert")
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Ein Ort. Deine Werkzeuge.")).to_be_visible()
    assert title(client, pid) == "Aus der Toolbox gespeichert"
    playwright.expect(page.get_by_role("button", name="BIM2STEIGER öffnen")).to_be_enabled()
    search = page.get_by_role("searchbox", name="Werkzeug suchen")
    search.fill("PDF Seiten")
    playwright.expect(page.locator(".toolbox-card")).to_have_count(1)
    playwright.expect(page.get_by_role("heading", name="PDF-Werkstatt", exact=True)).to_be_visible()
    search.fill("unbekanntes-tool")
    page.get_by_role("button", name="Filter zurücksetzen").click()
    page.get_by_role("button", name="BIM", exact=True).click()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(1)
    page.get_by_role("button", name="Alle", exact=True).click()
    page.get_by_role("button", name="NOVA-Legenden öffnen", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Projekte", exact=True)).to_be_visible()


def test_failed_save_keeps_the_user_in_the_module_when_returning_to_toolbox(editor):
    page, field, client, (pid, _) = editor
    before = title(client, pid)
    page.route(LEGEND_URL, lambda route: route.fulfill(
        status=500, content_type="application/json", body='{"detail":"Test-Speicherfehler"}')
        if route.request.method == "PUT" else route.continue_())
    field.fill("Darf nicht verloren gehen")
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    playwright.expect(field).to_have_value("Darf nicht verloren gehen")
    playwright.expect(page.get_by_role("heading", name="Ein Ort. Deine Werkzeuge.")).not_to_be_visible()
    assert title(client, pid) == before
    page.unroute(LEGEND_URL)
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Ein Ort. Deine Werkzeuge.")).to_be_visible()
    assert title(client, pid) == "Darf nicht verloren gehen"


def open_bim_from_editor(page):
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="BIM2STEIGER öffnen", exact=True).click()
    frame = page.frame_locator('iframe[title="BIM2STEIGER"]')
    playwright.expect(frame.locator("#catalogueCoverage")).to_contain_text(re.compile(r"11.777"))
    return frame


def test_bim_catalogue_favorites_and_tender_survive_returning_to_toolbox(editor):
    page, _, _, _ = editor
    frame = open_bim_from_editor(page)
    frame.locator("#openSearch").click()
    frame.locator("#searchInput").fill("112001")
    frame.locator(".search-result").first.click()
    playwright.expect(frame.locator("#articleTitle")).not_to_be_empty()
    playwright.expect(frame.locator("#addTender")).to_be_enabled()
    frame.locator("#saveFavorite").click()
    playwright.expect(frame.locator("#saveFavorite")).to_have_attribute("aria-pressed", "true")
    frame.locator("#addTender").click()
    form = frame.locator("#tenderForm")
    form.locator('[name="quantity"]').fill("2")
    form.locator('[name="unit"]').select_option("Stk")
    form.locator('[name="bkp"]').fill("232.5")
    form.locator('[name="room"]').fill("R1")
    form.get_by_role("button", name="Position übernehmen", exact=True).click()
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Ein Ort. Deine Werkzeuge.")).to_be_visible()
    assert page.evaluate("JSON.parse(localStorage.getItem('steiger2bim.tender.v1'))[0].quantity") == 2
    page.get_by_role("button", name="BIM2STEIGER öffnen", exact=True).click()
    frame = page.frame_locator('iframe[title="BIM2STEIGER"]')
    playwright.expect(frame.locator("#favoriteCount")).to_have_text("1")
    frame.locator("#openTender").click()
    playwright.expect(frame.locator("#tenderLines")).to_contain_text("112001")


def test_bim_open_dialog_and_storage_failure_prevent_leaving(editor):
    page, _, _, _ = editor
    frame = open_bim_from_editor(page)
    frame.locator("#openSearch").click()
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    playwright.expect(frame.locator("#toast")).to_contain_text("offenen Dialog")
    frame.get_by_role("button", name="Suche schliessen", exact=True).click()
    child = page.frames[1]
    child.wait_for_function("pendingToolRequests === 0")
    child.evaluate("""() => {
      window.originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('Test quota failure'); };
    }""")
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    playwright.expect(frame.locator("#toast")).to_contain_text("Speicherung fehlgeschlagen")
    child.evaluate("() => { Storage.prototype.setItem = window.originalSetItem; }")
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Ein Ort. Deine Werkzeuge.")).to_be_visible()


def test_toolbox_shows_all_tiles_without_scroll_and_greys_only_planned_tools(editor):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1400, "height": 900})
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(10)
    assert page.locator(".toolbox").evaluate("el => el.scrollHeight <= el.clientHeight")
    # A 900px native window also needs space for its Windows title bar.
    page.set_viewport_size({"width": 1400, "height": 860})
    assert page.locator(".toolbox").evaluate("el => el.scrollHeight <= el.clientHeight")
    planned = ["Dateien umbenennen", "Projektzentrale", "Änderungsbericht",
               "Leistungsbilanz", "Kabelberechnung", "Anlagetool"]
    for name in planned:
        tile = page.locator(".toolbox-card").filter(has=page.get_by_role("heading", name=name, exact=True))
        playwright.expect(tile).to_be_visible()
        playwright.expect(tile.locator(".toolbox-badge")).to_have_text("Geplant")
    playwright.expect(page.get_by_role("heading", name="Blitzschutz", exact=True)).to_have_count(0)
    for tile in page.locator(".toolbox-card:not(.is-available)").all():
        playwright.expect(tile.get_by_role("button")).to_be_disabled()
        assert tile.locator(".toolbox-symbol").evaluate("el => getComputedStyle(el).filter") == "grayscale(1)"
    playwright.expect(page.get_by_role("button", name="NOVA-Legenden öffnen", exact=True)).to_be_enabled()
    playwright.expect(page.get_by_role("button", name="BIM2STEIGER öffnen", exact=True)).to_be_enabled()
    playwright.expect(page.get_by_role("button", name="Dokumenten-Assistent öffnen", exact=True)).to_be_enabled()
    playwright.expect(page.get_by_role("button", name="PDF-Werkstatt öffnen", exact=True)).to_be_enabled()
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".toolbox").evaluate("el => el.scrollWidth <= el.clientWidth")
    assert page.locator(".toolbox").evaluate("el => el.scrollHeight > el.clientHeight")
    page.get_by_role("heading", name="Anlagetool", exact=True).scroll_into_view_if_needed()
    playwright.expect(page.get_by_role("heading", name="Anlagetool", exact=True)).to_be_in_viewport()


@pytest.mark.skipif(not os.environ.get("EDECO_TEST_STIRLING_URL"), reason="Live Stirling service required")
def test_own_pdf_workspace_merges_two_real_pdfs_and_guards_leaving(editor):
    import pypdfium2 as pdfium
    from test_documents import sample_pdf
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="PDF-Werkstatt öffnen", exact=True).click()
    page.get_by_role("button", name="PDFs organisieren", exact=True).click()
    picker = page.get_by_label("PDF-Dateien hinzufügen", exact=True)
    picker.wait_for(state="attached", timeout=60000)
    picker.set_input_files([
        {"name": "Plan-A.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["FIRST PLAN"]])},
        {"name": "Plan-B.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["SECOND PLAN"]])},
    ])
    playwright.expect(page.locator(".pdf-page-card")).to_have_count(2)
    page.get_by_role("button", name="↓ PDF erstellen", exact=True).click()
    with page.expect_download() as downloaded:
        page.get_by_role("link", name="PDF herunterladen", exact=True).click(timeout=60000)
    with pdfium.PdfDocument(downloaded.value.path()) as result:
        assert len(result) == 2
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    dialog = page.get_by_role("alertdialog", name="Ergebnisse gespeichert?")
    playwright.expect(dialog).to_be_visible()
    dialog.get_by_role("button", name="Hier bleiben", exact=True).click()
    playwright.expect(page.locator(".pdf-desk")).to_be_visible()
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Zur Toolbox wechseln", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Ein Ort. Deine Werkzeuge.")).to_be_visible()


def test_document_assistant_imports_pdf_finds_exact_source_and_preserves_library(editor):
    from test_documents import sample_pdf
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Dokumenten-Assistent öffnen", exact=True).click()
    page.get_by_label("Dokumentstand für neue Dateien").fill("Testausgabe 2026")
    page.get_by_label("Dokumente hinzufügen", exact=True).set_input_files({
        "name": "Test-Richtlinie.pdf", "mimeType": "application/pdf", "buffer": sample_pdf()})
    playwright.expect(page.locator(".doc-document")).to_have_count(1)
    page.get_by_label("Deine Frage", exact=True).fill("Was ist am Schutzleiter zu prüfen?")
    playwright.expect(page.get_by_role("button", name="KI-Antwort", exact=True)).to_be_disabled()
    page.get_by_role("button", name="Fundstellen suchen", exact=True).click()
    playwright.expect(page.locator(".doc-source")).to_have_count(1)
    playwright.expect(page.locator(".doc-source-link")).to_contain_text("Seite 2")
    playwright.expect(page.locator(".doc-source-link")).to_contain_text("Testausgabe 2026")
    playwright.expect(page.get_by_alt_text("Test-Richtlinie, Originalseite 2")).to_be_visible()
    playwright.expect(page.locator(".doc-source-highlight").first).to_be_visible()
    assert page.get_by_alt_text("Test-Richtlinie, Originalseite 2").evaluate("el => el.naturalWidth > 0")
    page.get_by_label("PDF-Vergrösserung", exact=True).select_option("1.5")
    assert page.locator(".doc-pdf-page").evaluate("el => el.clientWidth > el.parentElement.clientWidth")
    playwright.expect(page.locator(".doc-source-highlight").first).to_be_visible()
    page.get_by_label("Deine Frage", exact=True).fill("Photovoltaik")
    page.get_by_role("button", name="Fundstellen suchen", exact=True).click()
    playwright.expect(page.locator(".doc-answer")).to_contain_text("Keine passende Fundstelle")
    playwright.expect(page.locator(".doc-source-highlight")).to_have_count(0)
    playwright.expect(page.get_by_alt_text("Test-Richtlinie, Originalseite 2")).to_have_count(0)
    page.reload()
    playwright.expect(page.locator(".doc-document")).to_have_count(1)
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".document-assistant").evaluate("el => el.scrollWidth <= el.clientWidth")
    page.get_by_role("button", name="Entfernen", exact=True).click()
    page.get_by_role("button", name="Jetzt entfernen", exact=True).click()
    playwright.expect(page.locator(".doc-document")).to_have_count(0)


def test_document_assistant_defaults_to_free_server_and_opens_cited_pdf_page(editor):
    import json
    from test_documents import sample_pdf
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Dokumenten-Assistent öffnen", exact=True).click()
    page.get_by_label("Dokumente hinzufügen", exact=True).set_input_files({
        "name": "Test.pdf", "mimeType": "application/pdf", "buffer": sample_pdf()})
    playwright.expect(page.locator(".doc-document")).to_have_count(1)
    page.route("**/api/tools/dokumenten-assistent/connection", lambda route: route.fulfill(json={"ok": True, "message": "Testserver erreichbar. Keine Dokumente übertragen."}))
    page.get_by_role("button", name="KI-Verbindung", exact=True).click()
    dialog = page.get_by_role("dialog", name="KI-Verbindung einrichten")
    playwright.expect(dialog.get_by_label("Betriebsart")).to_have_value("ollama")
    dialog.get_by_label("KI-Serveradresse", exact=True).fill("http://ki-server:11434/api/chat")
    dialog.get_by_role("button", name="Speichern und Server prüfen").click()
    playwright.expect(dialog).to_contain_text("Testserver erreichbar")
    dialog.get_by_role("button", name="Schliessen", exact=True).click()
    def answer(route):
        body = json.loads(route.request.post_data)
        assert body["use_ai"] is True
        body["use_ai"] = False
        response = route.fetch(post_data=json.dumps(body))
        result = response.json()
        result.update(mode="ai", blocks=[{"text": "Der Schutzleiter ist vor Inbetriebnahme zu prüfen.", "source_ids": [result["sources"][0]["id"]]}])
        route.fulfill(json=result)
    page.route("**/api/tools/dokumenten-assistent/ask", answer)
    page.get_by_label("Deine Frage", exact=True).fill("Schutzleiter")
    page.get_by_role("button", name="KI-Antwort", exact=True).click()
    playwright.expect(page.locator(".doc-answer-block")).to_contain_text("Schutzleiter")
    page.locator(".doc-citations button").click()
    playwright.expect(page.get_by_alt_text("Test, Originalseite 2")).to_be_visible()
    playwright.expect(page.locator(".doc-source-highlight").first).to_be_visible()


def test_common_updater_checks_and_requires_confirmation_before_install(editor):
    import json
    page, _, _, _ = editor
    page.evaluate("""() => {
      const original = window.fetch;
      window.fetch = async (...args) => {
        if (String(args[0]) === '/api/toolbox/updates') await new Promise(resolve => setTimeout(resolve, 500));
        return original(...args);
      };
    }""")
    state = {"current": "v0.2.0-build.4", "status": "unchecked", "message": "Noch nicht geprüft.",
             "can_install": False, "packaged": True, "automatic": False,
             "release_url": "https://github.com/alxdrg-be/edeco-tool/releases", "session_key": "test-session"}
    actions = []
    page.route("**/api/toolbox/updates", lambda route: route.fulfill(json=state))
    def action(route):
        assert route.request.headers.get("x-edeco-update") == "test-session"
        kind = route.request.url.rsplit("/", 1)[1]
        actions.append(kind)
        if kind == "check":
            route.fulfill(json={**state, "status": "available", "latest": "v0.2.0-build.5", "can_install": True, "message": "Ein Toolbox-Update ist verfügbar."})
        else:
            assert kind == "install" and json.loads(route.request.post_data) == {}
            route.fulfill(json={**state, "status": "installing", "message": "Setup geprüft. Die Toolbox schliesst sich."})
    page.route("**/api/toolbox/updates/check", action)
    page.route("**/api/toolbox/updates/install", action)
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Nach Updates suchen", exact=True).click()
    page.get_by_role("button", name="Update installieren", exact=True).click()
    assert actions == ["check"]
    page.get_by_role("button", name="Jetzt aktualisieren", exact=True).click()
    playwright.expect(page.get_by_role("status").filter(has_text="Setup geprüft")).to_be_visible()
    assert actions == ["check", "install"]


def title(client, pid):
    return client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]["title"]["text"]


def test_the_view_menu_floats_the_settings_and_opens_the_wide_view(editor):
    page, _field, _client, _ids = editor
    page.locator("summary").filter(has_text="Ansicht").click()
    view = page.get_by_role("group", name="Ansicht", exact=True)
    playwright.expect(view.get_by_role("button", name="Einstellungen schwebend")).to_be_visible()
    view.get_by_role("button", name="Als Fenster", exact=True).click()
    close = page.locator("button.btn", has_text="Grossansicht beenden")
    playwright.expect(close).to_be_visible()
    close.click()
    playwright.expect(page.locator(".legend-editor.windowed")).not_to_be_visible()


def test_the_toolbar_shows_what_this_computer_chose(editor):
    page, _field, _client, _ids = editor
    toolbar = page.locator(".legend-toolbar")
    playwright.expect(toolbar.get_by_role("combobox", name="Rastermass")).to_be_visible()
    playwright.expect(toolbar.get_by_label("Schriftgrösse in mm")).to_have_count(0)
    page.locator("summary").filter(has_text="Ansicht").click()
    page.get_by_role("group", name="Sichtbar in der Leiste").get_by_label("Schrift, Symbole, gleiche Fläche").check()
    page.keyboard.press("Escape")
    playwright.expect(toolbar.get_by_label("Schriftgrösse in mm")).to_be_visible()
    # kept on this computer for the next time
    assert "sizes" in page.evaluate("() => window.localStorage.getItem('nl.legend.toolbar')")


def test_a_symbol_can_take_the_section_colour(editor):
    page, _field, client, ids = editor
    # sections start closed in the list: open the first one
    page.locator(".outline-block .outline-title").filter(has_not_text="Allgemein").first.click()
    item = page.locator("button.outline-item").filter(has_not_text="T Titel").first
    playwright.expect(item).to_be_visible()
    item.click()
    take = page.get_by_role("button", name="Farbe von Abschnitt übernehmen")
    playwright.expect(take).to_be_visible()
    playwright.expect(page.get_by_label("Symbolfarbe")).to_be_visible()
    with page.expect_response(LEGEND_URL) as saved:
        take.click()
    assert saved.value.ok
    doc = client.get(f"/api/projects/{ids[0]}/legend").json()["legend"]["doc"]
    picked = [(it["symbol_color"], b["style"]["symbol"])
              for b in doc["blocks"] for it in b["items"] if it.get("symbol_color")]
    assert len(picked) == 1 and picked[0][0] == picked[0][1]


def test_the_grid_starts_on_and_stays_off_once_switched(editor):
    page, _field, _client, _ids = editor
    grid = page.get_by_role("button", name="Raster anzeigen")
    playwright.expect(grid).to_have_attribute("aria-pressed", "true")
    grid.click()
    playwright.expect(grid).to_have_attribute("aria-pressed", "false")
    page.reload()
    page.get_by_text("Browser A", exact=True).click()
    page.get_by_role("button", name="Legende", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Raster anzeigen")).to_have_attribute("aria-pressed", "false")


@pytest.mark.parametrize("destination", ["global_tab", "project_tab", "back", "project"])
def test_immediate_navigation_saves_to_the_original_project(editor, destination):
    page, field, client, (a, b) = editor
    # Reproduce the original cross-project bug with the destination's load delayed.
    page.evaluate(r"""() => {
        const original = window.fetch;
        window.fetch = async (...args) => {
            if (/\/Browser%20B\/legend(\?.*)?$/.test(String(args[0])) && (!args[1]?.method || args[1].method === 'GET'))
                await new Promise(resolve => setTimeout(resolve, 1400));
            return original(...args);
        };
    }""")
    field.fill("Last edit in A")
    if destination == "global_tab":
        page.get_by_role("button", name="Kategorien", exact=True).click()
        playwright.expect(page.get_by_role("button", name="Kategorien", exact=True)).to_have_class("tab active")
    elif destination == "project_tab":
        page.get_by_role("button", name="Gesamtliste", exact=False).click()
        playwright.expect(field).not_to_be_visible()
    elif destination == "back":
        page.get_by_role("button", name="← Alle Projekte", exact=True).click()
        playwright.expect(page.get_by_role("button", name="Legende erstellen", exact=True)).to_be_visible()
    else:
        page.get_by_role("combobox", name="Projekt wechseln", exact=True).select_option(b)
        playwright.expect(page.get_by_role("heading", name="Browser B", exact=True)).to_be_visible()
    page.wait_for_timeout(1700)
    assert title(client, a) == "Last edit in A"
    assert title(client, b) == "Browser B"


@pytest.mark.parametrize("destination", ["global_tab", "project_tab", "project"])
def test_failed_save_keeps_the_editor_open_and_can_be_retried(editor, destination):
    page, field, client, (a, b) = editor

    def fail_save(route):
        if route.request.method == "PUT":
            route.fulfill(status=503, content_type="application/json", body='{"detail":"Speicher nicht erreichbar"}')
        else:
            route.continue_()

    page.route(LEGEND_URL, fail_save)
    field.fill("Retry this edit")
    if destination == "global_tab":
        page.get_by_role("button", name="Kategorien", exact=True).click()
    elif destination == "project_tab":
        page.get_by_role("button", name="Gesamtliste", exact=False).click()
    else:
        page.get_by_role("combobox", name="Projekt wechseln", exact=True).select_option(b)
    playwright.expect(page.get_by_text("Legende nicht gespeichert:", exact=False)).to_be_visible()
    playwright.expect(field).to_have_value("Retry this edit")
    playwright.expect(page.get_by_role("combobox", name="Projekt wechseln", exact=True)).to_have_value(a)
    assert title(client, a) == "Browser A"
    page.unroute(LEGEND_URL, fail_save)
    page.get_by_role("button", name="Kategorien", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Kategorien", exact=True)).to_have_class("tab active")
    assert title(client, a) == "Retry this edit"


def test_navigation_waits_for_an_inflight_autosave_and_then_saves_the_latest_edit(editor):
    page, field, client, (a, b) = editor
    page.evaluate(r"""() => {
        const original = window.fetch;
        window.legendWrites = [];
        window.fetch = async (...args) => {
            if (/\/legend(\?.*)?$/.test(String(args[0])) && args[1]?.method === 'PUT') {
                window.legendWrites.push(JSON.parse(args[1].body).doc.title.text);
                if (window.legendWrites.length === 1) {
                    window.saveWaiting = true;
                    await new Promise(resolve => { window.releaseSave = resolve; });
                }
            }
            return original(...args);
        };
    }""")
    field.fill("First autosave")
    page.wait_for_function("window.saveWaiting === true")
    field.fill("Newest edit wins")
    page.evaluate("window.releaseSave()")
    page.get_by_role("combobox", name="Projekt wechseln", exact=True).select_option(b)
    playwright.expect(page.get_by_role("heading", name="Browser B", exact=True)).to_be_visible()
    assert title(client, a) == "Newest edit wins"
    assert title(client, b) == "Browser B"
    assert page.evaluate("window.legendWrites") == ["First autosave", "Newest edit wins"]


def test_copy_contains_the_edit_that_was_pending_when_copy_was_requested(editor):
    page, field, client, (a, b) = editor
    field.fill("Include me in the copy")
    page.once("dialog", lambda dialog: dialog.accept("Browser copy"))
    page.locator("summary").filter(has_text="Projektaktionen").click()
    page.get_by_role("button", name="Projekt duplizieren", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Browser copy", exact=True)).to_be_visible(timeout=15000)
    assert title(client, a) == "Include me in the copy"
    assert title(client, "Browser copy") == "Include me in the copy"


def test_close_warning_only_appears_while_the_document_is_unsaved(editor):
    page, field, client, (a, b) = editor

    def closing_is_blocked():
        return page.evaluate("!window.dispatchEvent(new Event('beforeunload', { cancelable: true }))")

    assert not closing_is_blocked()
    field.fill("Not saved yet")
    assert closing_is_blocked()
    with page.expect_response(lambda response: response.request.method == "PUT" and LEGEND_URL.search(response.url)):
        page.get_by_role("button", name="Kategorien", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Kategorien", exact=True)).to_have_class("tab active")
    assert not closing_is_blocked()
    assert title(client, a) == "Not saved yet"


def test_several_legends_are_edited_and_saved_separately(editor):
    page, field, client, (a, b) = editor
    field.fill("Hauptlegende")
    page.get_by_role("button", name="+ Neu", exact=True).click()
    page.get_by_label("Name", exact=True).fill("Brandmelder")
    page.get_by_role("radio", name="Leer", exact=True).check()
    page.get_by_role("button", name="Anlegen", exact=True).click()
    playwright.expect(page.get_by_label("Legende wählen").locator("option", has_text="Brandmelder")).to_have_count(1)
    page.get_by_role("button", name="T Titel", exact=True).click()
    playwright.expect(field).to_have_value("Brandmelder")
    field.fill("Brandmelder EG")
    page.get_by_label("Legende wählen").select_option(label="Legende")
    page.get_by_role("button", name="T Titel", exact=True).click()
    playwright.expect(field).to_have_value("Hauptlegende")
    items = client.get(f"/api/projects/{a}/legends").json()["items"]
    assert [i["name"] for i in items] == ["Legende", "Brandmelder"]
    second = client.get(f"/api/projects/{a}/legend?legend={items[1]['id']}").json()["legend"]
    assert second["doc"]["title"]["text"] == "Brandmelder EG"
    assert title(client, a) == "Hauptlegende"


def test_dragging_onto_an_empty_cell_places_the_entry_there(editor):
    page, field, client, (a, b) = editor
    doc = client.get(f"/api/projects/{a}/legend").json()["legend"]["doc"]
    entries = [{"id": f"e{k}", "kind": "text", "text": f"Eintrag {k}"} for k in range(4)]
    doc["style"]["columns"] = 3
    doc["blocks"] = [{"id": "blk", "title": "Test", "items": entries}]
    assert client.put(f"/api/projects/{a}/legend", json={"doc": doc}).status_code == 200
    # The open editor still shows the previous document. Leave and return so it
    # loads the legend just written; the legend switcher is a dropdown, not a tab.
    playwright.expect(page.get_by_label("Legende wählen")).to_be_visible()
    page.get_by_role("button", name="Gesamtliste", exact=False).click()
    page.get_by_role("button", name="Legende", exact=True).click()
    first = page.locator('[data-hit="item"][data-id="e0"]')
    last = page.locator('[data-hit="item"][data-id="e3"]')
    playwright.expect(last).to_be_visible()
    page.set_viewport_size({"width": 1600, "height": 1200})
    first.scroll_into_view_if_needed()
    src, ref = first.bounding_box(), last.bounding_box()
    # 4 entries in 3 columns: 2, 2 and an empty third column; aim at its second row
    tx, ty = ref["x"] + ref["width"] * 1.5, ref["y"] + ref["height"] / 2
    page.mouse.move(src["x"] + 10, src["y"] + src["height"] / 2)
    page.mouse.down()
    page.mouse.move(tx - 40, ty, steps=5)
    page.mouse.move(tx, ty, steps=5)
    # the entries glide: right after the preview arrives, a moved entry carries a transition
    page.wait_for_function("""() => [...document.querySelectorAll('g[data-entry]')]
        .some(g => (g.style.transition || '').includes('transform'))""", timeout=3000)
    page.wait_for_timeout(400)                 # live preview with the highlighted cell
    page.mouse.up()
    # right after the drop the entry is already at its new place (no jump back to the old one)
    page.wait_for_timeout(60)
    early = first.bounding_box()
    page.wait_for_timeout(1500)                # autosave
    late = first.bounding_box()
    assert abs(early["x"] - late["x"]) < 2 and abs(early["y"] - late["y"]) < 2
    items = client.get(f"/api/projects/{a}/legend").json()["legend"]["doc"]["blocks"][0]["items"]
    assert [it["kind"] == "gap" and "_" or it["id"] for it in items] == ["_", "e1", "e2", "e3", "_", "e0"]


def test_two_entries_are_combined_with_ctrl_click_and_split_again(editor):
    page, _field, client, (a, _b) = editor
    doc = client.get(f"/api/projects/{a}/legend").json()["legend"]["doc"]
    symbols = [it for b in doc["blocks"] for it in b["items"] if it["kind"] == "symbol"][:2]
    assert len(symbols) == 2
    for k, it in enumerate(symbols):
        it["id"], it["text"] = f"c{k}", ["Decke", "Wand"][k]
    doc["blocks"] = [{"id": "blk", "title": "Test", "items": symbols}]
    assert client.put(f"/api/projects/{a}/legend", json={"doc": doc}).status_code == 200
    playwright.expect(page.get_by_label("Legende wählen")).to_be_visible()
    page.get_by_role("button", name="Gesamtliste", exact=False).click()
    page.get_by_role("button", name="Legende", exact=True).click()
    page.set_viewport_size({"width": 1600, "height": 1200})
    page.locator('[data-hit="item"][data-id="c0"]').click()
    page.locator('[data-hit="item"][data-id="c1"]').click(modifiers=["Control"])
    combine = page.get_by_role("button", name="Kombinieren", exact=True)
    playwright.expect(combine).to_be_visible()
    with page.expect_response(LEGEND_URL) as saved:
        combine.click()
    assert saved.value.ok
    playwright.expect(page.locator("svg text", has_text="Decke / Wand")).to_be_visible()
    page.get_by_role("tab", name="Text 2 / Symbol 2").click()
    playwright.expect(page.get_by_label("Grösse Symbol 2")).to_be_visible()
    items = client.get(f"/api/projects/{a}/legend").json()["legend"]["doc"]["blocks"][0]["items"]
    assert [it["id"] for it in items] == ["c0"] and items[0]["parts"][0]["text"] == "Wand"
    with page.expect_response(LEGEND_URL) as saved:
        page.get_by_role("button", name="Trennen", exact=True).click()
    assert saved.value.ok
    items = client.get(f"/api/projects/{a}/legend").json()["legend"]["doc"]["blocks"][0]["items"]
    assert [it["text"] for it in items] == ["Decke", "Wand"] and not items[0].get("parts")


def test_a_symbol_is_saved_as_company_symbol_from_the_editor(editor):
    page, _field, client, (a, _b) = editor
    # sections start closed in the list: open the first one
    page.locator(".outline-block .outline-title").filter(has_not_text="Allgemein").first.click()
    item = page.locator("button.outline-item").filter(has_not_text="T Titel").first
    playwright.expect(item).to_be_visible()
    item.click()
    save = page.get_by_role("button", name="Als Firmensymbol speichern")
    playwright.expect(save).to_be_visible()
    save.click()
    playwright.expect(page.get_by_text("✓ Firmensymbol", exact=False)).to_be_visible()
    items = client.get("/api/company/symbols").json()["items"]
    assert len(items) == 1 and items[0]["symbol_factor"] == 1.0
    doc = client.get(f"/api/projects/{a}/legend").json()["legend"]["doc"]
    first = next(it for b in doc["blocks"] for it in b["items"] if it["kind"] == "symbol")
    assert items[0]["family_key"] == first["family_key"] and items[0]["text"] == first["text"]


def test_the_admin_list_is_visible_and_locks_after_the_first_name(env, monkeypatch):
    """Everyone sees the same star list. An empty list stays open; afterwards only admins edit it."""
    from nova_legend import config

    client, _tmp = env
    ui = Path(__file__).resolve().parents[2] / "ui" / "dist"
    if not (ui / "index.html").is_file():
        pytest.skip("Build the UI with npm run build before browser tests")
    me = config.current_user()
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(create_app(client.app.state.nova, ui_dir=ui), log_level="error"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise RuntimeError("Browser test API did not start")
        time.sleep(0.02)
    shots = _tmp / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    try:
        with playwright.sync_playwright() as pw:
            browser = launch_chromium(pw)
            page = browser.new_page(viewport={"width": 1280, "height": 900})
            open_app(page, port)
            page.get_by_role("button", name="Einstellungen", exact=True).click()
            playwright.expect(page.get_by_role("heading", name="Legende Allgemein", exact=True)).to_be_visible()
            playwright.expect(page.get_by_role("heading", name="Admin", exact=True)).to_be_visible()
            playwright.expect(page.get_by_text("Zeilen der Legende Allgemein", exact=True)).to_be_visible()
            playwright.expect(page.get_by_text("Windows-Name dieses Computers", exact=False)).to_be_visible()
            assert page.get_by_text("Legende der Firma", exact=True).count() == 0
            assert page.get_by_text("NovaFirma12").count() == 0
            playwright.expect(page.locator(".card", has=page.get_by_role("heading", name="Benutzerschablonen")).locator(".stencil-read")).to_be_visible()
            playwright.expect(page.get_by_label("Update-Kanal")).to_be_visible()
            playwright.expect(page.get_by_text("Offen für alle", exact=True)).to_be_visible()
            playwright.expect(page.get_by_text("jeder darf ändern", exact=False)).to_be_visible()
            page.locator(".card", has=page.get_by_role("heading", name="Legende Allgemein", exact=True)).screenshot(
                path=str(shots / "legende-allgemein.png"))
            page.locator(".admin-box").screenshot(path=str(shots / "admin-offen.png"))
            assert client.put("/api/company/legend", json={"admins": [me, "marco"]}).status_code == 200
            page.reload()
            page.get_by_role("button", name="Einstellungen", exact=True).click()
            playwright.expect(page.get_by_label("Update-Kanal")).to_be_visible()
            playwright.expect(page.get_by_text("Du bist Admin", exact=True)).to_be_visible()
            playwright.expect(page.get_by_text("Nur Admins können weitere Namen", exact=False)).to_be_visible()
            playwright.expect(page.locator(".admin-list")).to_contain_text(me)
            playwright.expect(page.locator(".admin-list")).to_contain_text("marco")
            assert page.locator(".admin-list .star").count() == 2
            page.locator("section.admin-box").screenshot(path=str(shots / "admin-du.png"))
            monkeypatch.setattr(config, "current_user", lambda: "gast")
            page.reload()
            page.get_by_role("button", name="Einstellungen", exact=True).click()
            playwright.expect(page.get_by_label("Update-Kanal")).to_have_count(0)
            playwright.expect(page.get_by_text("Nicht Admin", exact=True)).to_be_visible()
            playwright.expect(page.get_by_text("Die Liste ist gesperrt", exact=False)).to_be_visible()
            playwright.expect(page.get_by_label("Admin-Liste")).to_be_disabled()
            page.locator(".card", has=page.locator(".admin-title")).screenshot(path=str(shots / "admin-gesperrt.png"))
            browser.close()
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()


def edit_category(page):
    page.get_by_role("button", name="Kategorien", exact=True).click()
    page.locator(".cat-table tbody tr").first.click()
    field = page.get_by_label("Titel", exact=True)
    original = field.input_value()
    field.fill("Kategorie mit Änderungen")
    return field, original


@pytest.mark.parametrize("destination", ["workspace", "category"])
def test_category_navigation_can_cancel_or_discard_a_draft(editor, destination):
    page, _, client, _ = editor
    field, original = edit_category(page)

    def leave():
        if destination == "workspace":
            page.get_by_role("button", name="Projekte", exact=True).click()
        else:
            page.locator(".cat-table tbody tr").nth(1).click()

    assert page.evaluate("!window.dispatchEvent(new Event('beforeunload', { cancelable: true }))")
    leave()
    dialog = page.get_by_role("alertdialog", name="Änderungen speichern?")
    playwright.expect(dialog).to_be_visible()
    dialog.get_by_role("button", name="Abbrechen", exact=True).click()
    playwright.expect(field).to_have_value("Kategorie mit Änderungen")
    leave()
    dialog.get_by_role("button", name="Verwerfen", exact=True).click()
    playwright.expect(dialog).not_to_be_visible()
    if destination == "workspace":
        page.get_by_role("button", name="Kategorien", exact=True).click()
    page.locator(".cat-table tbody tr").first.click()
    playwright.expect(page.get_by_label("Titel", exact=True)).to_have_value(original)
    assert not page.evaluate("!window.dispatchEvent(new Event('beforeunload', { cancelable: true }))")
    assert client.get("/api/categories").json()["items"][0]["title"] == original


def test_category_navigation_saves_before_leaving_and_retries_a_failed_save(editor):
    page, _, client, _ = editor
    _, original = edit_category(page)

    def fail_save(route):
        if route.request.method == "PUT":
            route.fulfill(status=503, json={"detail": "Firmenordner nicht erreichbar"})
        else:
            route.continue_()

    page.route("**/api/categories/*", fail_save)
    page.get_by_role("button", name="Projekte", exact=True).click()
    dialog = page.get_by_role("alertdialog", name="Änderungen speichern?")
    dialog.get_by_role("button", name="Speichern", exact=True).click()
    playwright.expect(dialog.get_by_role("alert")).to_contain_text("nicht gespeichert")
    assert client.get("/api/categories").json()["items"][0]["title"] == original
    page.unroute("**/api/categories/*", fail_save)
    dialog.get_by_role("button", name="Speichern", exact=True).click()
    playwright.expect(dialog).not_to_be_visible()
    playwright.expect(page.get_by_role("button", name="Projekte", exact=True)).to_have_class("tab active")
    assert client.get("/api/categories").json()["items"][0]["title"] == "Kategorie mit Änderungen"
    assert not page.evaluate("!window.dispatchEvent(new Event('beforeunload', { cancelable: true }))")


def test_invalid_category_cannot_be_saved_by_navigation(editor):
    page, _, client, _ = editor
    _, original = edit_category(page)
    page.get_by_label("Spalten in der Legende", exact=True).fill("0")
    page.get_by_role("button", name="Projekte", exact=True).click()
    dialog = page.get_by_role("alertdialog", name="Änderungen speichern?")
    dialog.get_by_role("button", name="Speichern", exact=True).click()
    playwright.expect(dialog.get_by_role("alert")).to_be_visible()
    dialog.get_by_role("button", name="Abbrechen", exact=True).click()
    playwright.expect(page.get_by_label("Titel", exact=True)).to_have_value("Kategorie mit Änderungen")
    assert client.get("/api/categories").json()["items"][0]["title"] == original


@pytest.mark.parametrize("old_response", ["success", "error"])
def test_library_ignores_an_outdated_search_response(editor, old_response):
    page, _, _, _ = editor
    page.get_by_role("button", name="Bibliothek", exact=True).click()
    playwright.expect(page.locator(".tile").first).to_be_visible()
    page.evaluate("""(oldResponse) => {
        const original = window.fetch;
        window.fetch = async (...args) => {
            const response = await original(...args);
            const url = new URL(String(args[0]), location.href);
            if (url.pathname === '/api/library/families' && url.searchParams.get('q') === 'Schalter') {
                window.oldSearchWaiting = true;
                await new Promise(resolve => { window.releaseOldSearch = resolve; });
                if (oldResponse === 'error') throw new Error('Outdated search failed');
            }
            return response;
        };
    }""", old_response)
    search = page.get_by_role("textbox", name="Symbole suchen")
    search.fill("Schalter")
    page.wait_for_function("window.oldSearchWaiting === true")
    search.fill("Brandmelder")
    playwright.expect(page.locator(".tile .name")).to_have_text(["Brandmelder"])
    page.evaluate("async () => { window.releaseOldSearch(); await new Promise(resolve => setTimeout(resolve, 100)); }")
    playwright.expect(search).to_have_value("Brandmelder")
    playwright.expect(page.locator(".tile .name")).to_have_text(["Brandmelder"])
    playwright.expect(page.locator(".toast.error")).not_to_be_visible()
    playwright.expect(page.locator(".result-count")).to_have_text("1 Eintrag")


@pytest.mark.parametrize("override", [None, "19.2"])
def test_new_project_uses_the_configured_nova_version_and_allows_an_override(editor, override):
    page, _, client, _ = editor
    assert client.put("/api/settings", json={"nova_version": "20"}).status_code == 200
    page.reload()
    page.get_by_role("button", name="Legende erstellen", exact=True).click()
    page.get_by_role("radio", name="Neues Projekt", exact=True).check()
    version = page.get_by_label("Nova-Version", exact=True)
    playwright.expect(version).to_have_value("20")
    if override:
        version.select_option(override)
    page.get_by_label("Bezeichnung", exact=True).fill("Nova version test")
    page.get_by_role("button", name="Projekt anlegen", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Nova version test", exact=True)).to_be_visible()
    assert client.get("/api/projects/Nova%20version%20test").json()["meta"]["nova_version"] == (override or "20")


def test_editor_space_and_view_options_do_not_change_the_exported_document(editor):
    page, _, client, (a, _) = editor
    page.set_viewport_size({"width": 1440, "height": 960})
    page.locator(".project-page").evaluate("node => { node.scrollTop = 0; }")
    assert not page.locator("details.fold").evaluate("node => node.open")
    canvas = page.locator(".legend-canvas").bounding_box()
    # the sheet starts on the first screen, under the project head and a two-row toolbar
    assert canvas["y"] < 600
    assert min(canvas["height"], 960 - canvas["y"]) >= 400
    before = client.get(f"/api/projects/{a}/legend").json()["legend"]["doc"]
    page.locator("summary").filter(has_text="Ansicht").click()
    playwright.expect(page.get_by_role("group", name="Ansicht", exact=True).get_by_role("combobox", name="Rastermass")).to_be_focused()
    page.get_by_role("button", name="Raster anzeigen", exact=True).click()
    page.get_by_role("button", name="Dunkler Modus", exact=True).click()
    assert page.locator(".legend-paper > rect").first.evaluate("node => getComputedStyle(node).fill") == "rgb(255, 255, 255)"
    page.locator("summary").filter(has_text="Ansicht").click()
    page.get_by_role("button", name="Als Fenster", exact=True).click()
    playwright.expect(page.locator(".legend-editor.windowed")).to_be_visible()
    page.locator("summary").filter(has_text="Ansicht").click()
    view_menu = page.get_by_role("group", name="Ansicht", exact=True)
    playwright.expect(view_menu.get_by_role("combobox", name="Rastermass")).to_be_visible()
    menu_box = view_menu.bounding_box()
    assert menu_box["y"] >= 0 and menu_box["y"] + menu_box["height"] <= 960
    page.keyboard.press("Escape")
    playwright.expect(view_menu).not_to_be_visible()
    playwright.expect(page.locator("summary").filter(has_text="Ansicht")).to_be_focused()
    playwright.expect(page.locator(".legend-editor.windowed")).to_be_visible()
    page.get_by_role("button", name="Fenster schliessen", exact=True).click()
    playwright.expect(page.locator(".legend-editor.windowed")).not_to_be_visible()
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator("summary").filter(has_text="Ansicht").click()
    playwright.expect(view_menu).to_be_visible()
    menu_box = view_menu.bounding_box()
    assert menu_box["x"] >= 0 and menu_box["x"] + menu_box["width"] <= 390
    page.keyboard.press("Shift+Tab")
    playwright.expect(view_menu).not_to_be_visible()
    playwright.expect(page.locator("summary").filter(has_text="Ansicht")).to_be_focused()
    page.set_viewport_size({"width": 1440, "height": 960})
    with page.expect_download() as downloaded:
        page.get_by_role("button", name="DXF herunterladen", exact=True).click()
    import ezdxf
    assert len(ezdxf.readfile(downloaded.value.path()).modelspace()) > 0
    assert client.get(f"/api/projects/{a}/legend").json()["legend"]["doc"] == before


def test_the_list_shows_one_line_per_section_until_opened(editor):
    page, _field, _client, _ids = editor
    block = page.locator(".outline-block").filter(has_not_text="Allgemein").first
    title = block.locator(".outline-title")
    playwright.expect(title).to_be_visible()
    playwright.expect(block.locator("button.outline-item")).to_have_count(0)
    title.click()
    playwright.expect(block.locator("button.outline-item").first).to_be_visible()
    count = int(title.locator(".outline-count").inner_text())
    playwright.expect(block.locator("button.outline-item")).to_have_count(count)
