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



def expand_card_options(root):
    """Use the visible disclosure, keeping keyboard/button semantics under test."""
    playwright.expect(root).to_be_attached()
    for summary in root.locator("xpath=ancestor::details[not(@open)]/summary").all():
        summary.click()
    more = root.locator('.lab-choice-expand[aria-expanded="false"]')
    if more.count():
        more.click()


def choose_card(root, value):
    expand_card_options(root)
    if root.evaluate("el => el.tagName") == "SELECT":
        root.select_option(value)
        playwright.expect(root).to_have_value(value)
        return
    if root.get_attribute("role") == "group":
        root = root.locator("xpath=..")
        expand_card_options(root)
    option = root.locator(f'button[data-choice-value="{value}"]')
    option.click()
    playwright.expect(option).to_have_attribute("aria-pressed", "true")


def choose_field(page, key, value):
    choose_card(page.locator(f'[data-field-key="{key}"]'), value)


def named_cards(page, label):
    return page.get_by_role("group", name=label, exact=True).or_(
        page.get_by_role("combobox", name=label, exact=True))


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
    planned = ["Änderungsbericht", "Anlagetool"]
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
    playwright.expect(page.get_by_role("button", name="Dateien umbenennen öffnen", exact=True)).to_be_enabled()
    playwright.expect(page.get_by_role("button", name="Projektzentrale öffnen", exact=True)).to_be_enabled()
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".toolbox").evaluate("el => el.scrollWidth <= el.clientWidth")
    assert page.locator(".toolbox").evaluate("el => el.scrollHeight > el.clientHeight")
    page.get_by_role("heading", name="Anlagetool", exact=True).scroll_into_view_if_needed()
    playwright.expect(page.get_by_role("heading", name="Anlagetool", exact=True)).to_be_in_viewport()


def test_plan_delivery_downloads_manifest_and_records_only_explicitly_confirmed_sends(editor, tmp_path):
    import io
    import zipfile
    from test_documents import sample_pdf
    page, _, _, _ = editor
    prefix = page.url.rstrip("/") + "/api/tools/projektzentrale"
    state = page.request.get(prefix + "/state").json()
    project = page.request.post(prefix + "/projects", headers={"X-Edeco-Projects": state["session_key"]}, data={"number": "1498", "name": "Planlieferung Test"}).json()
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Planlieferungs-Assistent öffnen", exact=True).click()
    playwright.expect(page.get_by_label("Lieferprojekt", exact=True)).to_have_value(project["id"])
    page.get_by_label("Lieferempfänger", exact=True).fill("Bauleitung Test")
    page.get_by_label("Lieferdatum", exact=True).fill("2026-11-01")
    playwright.expect(page.get_by_role("button", name="PDFs hinzufügen", exact=True)).to_be_enabled()
    pdf = sample_pdf([["2. OG"]])
    page.get_by_label("PDFs hinzufügen", exact=True).set_input_files({"name": "Grundriss 2og.pdf", "mimeType": "application/pdf", "buffer": pdf})
    page.get_by_label("Index für Grundriss 2og.pdf", exact=True).fill("D")
    playwright.expect(page.get_by_label("Neuer Name für Grundriss 2og.pdf", exact=True)).to_have_value("1498_E-G-APP-OG02-D-50.pdf")
    with page.expect_download() as pending:
        page.get_by_role("button", name="Lieferpaket mit Planliste erstellen", exact=True).click()
    with zipfile.ZipFile(io.BytesIO(pending.value.path().read_bytes())) as archive:
        assert archive.read("1498_E-G-APP-OG02-D-50.pdf") == pdf
        assert "Planliste.html" in archive.namelist()
    playwright.expect(page.get_by_text("Vorbereitet · noch kein Versand bestätigt", exact=True)).to_be_visible()
    page.set_viewport_size({"width": 1400, "height": 900})
    page.screenshot(path=str(tmp_path / "delivery.png"), full_page=True)
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="Als versendet bestätigen", exact=True).click()
    playwright.expect(page.get_by_text("Versand bestätigt", exact=True)).to_be_visible()
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Projektzentrale öffnen", exact=True).click()
    playwright.expect(page.get_by_text("Versand bestätigt", exact=True)).to_be_visible()
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".project-hub").evaluate("el => el.scrollWidth <= el.clientWidth")


def test_calculations_hub_and_lightning_visualisation_validate_and_restore_inputs(editor, tmp_path):
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    playwright.expect(page.locator(".calc-tile")).to_have_count(26)
    playwright.expect(page.get_by_role("button", name="Demnächst")).to_have_count(1)
    page.get_by_role("button", name="Blitzschutz öffnen", exact=True).click()
    playwright.expect(named_cards(page, "Blitzschutzklasse")).to_be_enabled()
    choose_card(named_cards(page, "Blitzschutzklasse"), "I")
    page.get_by_label("Gebäudeumfang U (m)", exact=True).fill("20")
    page.get_by_label("Leitungsweg A (m)", exact=True).fill("3")
    page.get_by_label("Vorhandene Ableiter n", exact=True).fill("2")
    playwright.expect(page.get_by_test_id("separation-result")).to_have_text("0.24 m")
    page.get_by_label("Vorhandener Abstand (m, optional)", exact=True).fill("0,20")
    playwright.expect(page.get_by_text("Vorhandener Abstand unterschreitet das erforderliche s.", exact=True)).to_be_visible()
    page.get_by_label("Vorhandener Abstand (m, optional)", exact=True).fill("0,24")
    playwright.expect(page.get_by_test_id("clearance-aura")).to_have_attribute("data-state", "pass")
    page.get_by_role("button", name="Info: Leitungsweg A (m)", exact=True).click()
    drawer = page.get_by_role("dialog", name="Leitungsweg A")
    playwright.expect(drawer).to_contain_text("SN 414022:2024")
    page.screenshot(path=str(tmp_path / "swiss-info.png"), full_page=True)
    page.keyboard.press("Escape")
    playwright.expect(drawer).not_to_be_visible()
    playwright.expect(page.get_by_role("button", name="Info: Leitungsweg A (m)", exact=True)).to_be_focused()
    # The SVG object is keyboard operable, not a decorative result image.
    page.get_by_role("slider", name="Abstand Dachobjekt", exact=True).focus()
    page.keyboard.press("Home")
    playwright.expect(page.get_by_test_id("clearance-aura")).to_have_attribute("data-state", "fail")
    page.get_by_label("Vorhandener Abstand (m, optional)", exact=True).fill("0.24")
    object_control = page.get_by_role("slider", name="Abstand Dachobjekt", exact=True)
    before = object_control.bounding_box()
    page.mouse.move(before["x"] + before["width"] / 2, before["y"] + before["height"] * .65)
    page.mouse.down()
    page.mouse.move(before["x"] + before["width"] / 2 + 40, before["y"] + before["height"] * .65, steps=5)
    page.mouse.up()
    assert float(page.get_by_label("Vorhandener Abstand (m, optional)", exact=True).input_value()) > .24
    old_y = object_control.bounding_box()["y"]
    page.get_by_role("slider", name="Leitungsweg A (m) Slider", exact=True).focus()
    page.keyboard.press("End")
    assert abs(object_control.bounding_box()["y"] - old_y) < 1, "A is a conductor path, not building height"
    page.get_by_label("Leitungsweg A (m)", exact=True).fill("3")
    page.get_by_label("Vorhandener Abstand (m, optional)", exact=True).fill("0.24")
    page.get_by_label("Berechnungsbemerkung", exact=True).fill("Dachaufbau prüfen")
    page.set_viewport_size({"width": 1400, "height": 1000})
    page.locator(".calc-workspace").evaluate("el => el.scrollTop = 0")
    page.get_by_role("button", name="Heller Rechnermodus", exact=True).click()
    page.screenshot(path=str(tmp_path / "lightning.png"), full_page=True)
    page.get_by_role("button", name="Dunkler Rechnermodus", exact=True).click()
    page.screenshot(path=str(tmp_path / "lightning-dark.png"), full_page=True)
    page.emulate_media(media="print")
    assert page.locator(".calc-panel").first.evaluate("el => getComputedStyle(el).backgroundColor") == "rgb(255, 255, 255)"
    report = page.pdf(path=str(tmp_path / "Trennungsabstand.pdf"), format="A4", print_background=True)
    import pypdfium2 as pdfium
    from contextlib import closing
    with pdfium.PdfDocument(report) as document:
        text = ""
        for index in range(len(document)):
            with closing(document[index]) as pdf_page, closing(pdf_page.get_textpage()) as text_page:
                text += text_page.get_text_range()
        text = re.sub(r"\s+", " ", text)
        assert "0.24 m" in text and "Arthur Flury" in text and "SN 414022" in text
    page.emulate_media(media="screen")
    page.get_by_label("Vorhandene Ableiter n", exact=True).fill("2.5")
    playwright.expect(page.get_by_test_id("separation-result")).to_have_count(0)
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_disabled()
    page.get_by_label("Vorhandene Ableiter n", exact=True).fill("2")
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="Blitzschutz öffnen", exact=True).click()
    playwright.expect(page.get_by_test_id("separation-result")).to_have_text("0.24 m")
    playwright.expect(page.get_by_label("Berechnungsbemerkung", exact=True)).to_have_value("Dachaufbau prüfen")
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".calc-workspace").evaluate("el => el.scrollWidth <= el.clientWidth")


def test_swiss_cable_live_controls_recommendation_drawer_and_export(editor, tmp_path):
    import json
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Kabelberechnung öffnen", exact=True).click()
    playwright.expect(page.get_by_label("Leitungslänge L (m)", exact=True)).to_be_enabled()
    playwright.expect(page.get_by_test_id("voltage-drop-result")).to_have_text("6.74 V")
    playwright.expect(page.get_by_test_id("cable-max-length")).to_have_text("34.1 m")
    playwright.expect(page.get_by_test_id("cable-budget-detail")).to_have_text("2.93 % / 4 %")
    page.get_by_label("Leitungslänge L (m)", exact=True).fill("60")
    page.get_by_label("Leistungsfaktor cos φ", exact=True).fill("0.85")
    playwright.expect(page.get_by_test_id("voltage-drop-result")).to_have_text("13.87 V")
    playwright.expect(page.get_by_test_id("recommended-area")).to_have_text("4 mm²")
    page.get_by_role("button", name="Info: Schweizer Kabelmodell", exact=True).click()
    dialog = page.get_by_role("dialog", name="NIN-orientiertes Modell")
    playwright.expect(dialog).to_contain_text("SN 411000:2025")
    playwright.expect(dialog).to_contain_text("kein NIN-Normwert")
    page.keyboard.press("Escape")
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.locator(".engineering-lab").evaluate("el => el.scrollTop=0")
    page.screenshot(path=str(tmp_path / "cable.png"), full_page=True)
    with page.expect_download() as pending:
        page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True).click()
    proof = json.loads(pending.value.path().read_bytes())
    assert proof["result"]["temperature"] == 55
    assert all(".ch/" in url for url in proof["sources"])
    page.get_by_label("Laststrom I (A)", exact=True).fill("")
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_disabled()
    playwright.expect(page.get_by_test_id("voltage-drop-result")).to_have_text("–")
    page.get_by_label("Laststrom I (A)", exact=True).fill("16")
    page.get_by_role("button", name="Aluminium", exact=True).click()
    playwright.expect(page.get_by_label("Leiterquerschnitt", exact=True)).to_have_value("10")
    page.get_by_role("button", name="3~ · 400 V", exact=True).click()
    playwright.expect(named_cards(page, "Bemessungsspannung Uₙ (V)").locator('button[data-choice-value="400"]')).to_have_attribute("aria-pressed", "true")
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".engineering-lab").evaluate("el => el.scrollWidth <= el.clientWidth")


def test_shared_calculation_archive_settings_save_notes_restore_and_import(editor, tmp_path):
    from test_documents import sample_pdf
    page, _, _, _ = editor
    base = page.url.rstrip("/")
    state = page.request.get(base + "/api/tools/projektzentrale/state").json()
    page.request.post(base + "/api/tools/projektzentrale/projects", headers={"X-Edeco-Projects": state["session_key"]}, data={"number":"1498","name":"Gemeinsames Projekt"})
    server = tmp_path / "server"; server.mkdir()
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Gemeinsame Ablage & Einstellungen", exact=True).click()
    page.get_by_role("button", name="Ablage-Einstellungen", exact=True).click()
    dialog = page.get_by_role("dialog", name="Ablage-Einstellungen")
    dialog.get_by_label("Serverordner", exact=True).fill(str(server))
    dialog.get_by_label("Ablage-Unterordner", exact=True).fill("Planung/Berechnungen")
    dialog.get_by_role("button", name="Verbindung prüfen & speichern", exact=True).click()
    playwright.expect(dialog).not_to_be_visible()
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="Blitzschutz öffnen", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Projektbezogen auf Server speichern", exact=True)).to_be_enabled()
    page.get_by_role("button", name="Projektbezogen auf Server speichern", exact=True).click()
    dialog = page.get_by_role("dialog", name="Projektbezogen speichern")
    playwright.expect(dialog.get_by_label("Ablage-Projektnummer", exact=True)).to_have_value("1498")
    dialog.get_by_label("Rechenstand-Bezeichnung", exact=True).fill("Dachaufbau OG02")
    dialog.get_by_label("Rechenstand-Notizen", exact=True).fill("Mit Bauleitung prüfen")
    dialog.get_by_role("button", name="Als neuen Stand speichern", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_contain_text("Gemeinsam gespeichert")
    page.get_by_role("button", name="Information schliessen", exact=True).click()
    page.get_by_role("button", name="Gemeinsame Berechnungsablage öffnen", exact=True).click()
    page.locator(".archive-item").filter(has_text="Dachaufbau OG02").click()
    page.get_by_label("Weitere Notiz", exact=True).fill("Kollege hat den Planstand verglichen")
    page.get_by_role("button", name="Notiz ergänzen", exact=True).click()
    playwright.expect(page.locator(".archive-comment")).to_contain_text("Kollege hat den Planstand verglichen")
    page.get_by_role("button", name="Eingaben laden & neu berechnen", exact=True).click()
    playwright.expect(page.get_by_label("Berechnungsbemerkung", exact=True)).to_have_value("Mit Bauleitung prüfen")
    playwright.expect(page.get_by_test_id("separation-result")).to_have_text("0.40 m")
    page.get_by_role("button", name="Gemeinsame Berechnungsablage öffnen", exact=True).click()
    page.get_by_role("button", name="Berechnung importieren", exact=True).click()
    dialog = page.get_by_role("dialog", name="Berechnung gemeinsam ablegen")
    dialog.get_by_label("Import-Bezeichnung", exact=True).fill("Ladegrid Beispiel")
    dialog.get_by_label("Berechnungsexportdatei", exact=True).set_input_files({"name":"Ladegrid.pdf","mimeType":"application/pdf","buffer":sample_pdf([["Test-Ladegrid"]])})
    dialog.get_by_role("button", name="Export gemeinsam ablegen", exact=True).click()
    playwright.expect(dialog).not_to_be_visible()
    playwright.expect(page.locator(".archive-item")).to_have_count(2)
    playwright.expect(page.get_by_role("heading", name="Ladegrid Beispiel", exact=True)).to_be_visible()
    with page.expect_download() as downloaded:
        page.get_by_role("button", name="Originalexport herunterladen", exact=True).click()
    assert downloaded.value.path().read_bytes() == sample_pdf([["Test-Ladegrid"]])
    playwright.expect(page.get_by_role("button", name="Ablage-Einstellungen", exact=True)).to_be_enabled()
    page.set_viewport_size({"width":1600,"height":1200})
    page.locator(".engineering-lab").evaluate("el=>el.scrollTop=0")
    page.screenshot(path=str(tmp_path / "gemeinsame-ablage.png"), full_page=True)
    assert len(list((server / "Planung/Berechnungen").glob("*/P-*/*/berechnung.json"))) == 2


def test_every_calculator_has_review_image_without_overlapping_labels(editor, tmp_path):
    import json
    import unicodedata
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1600, "height": 1200})
    page.emulate_media(reduced_motion="reduce")
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    playwright.expect(page.locator(".calc-tile")).to_have_count(26)
    launchers = page.locator(".calc-tile button:not([disabled])").evaluate_all("nodes => nodes.map(node => node.getAttribute('aria-label'))")
    assert len(launchers) == 25
    assert "premium" not in page.locator("body").inner_text().lower()
    page.screenshot(path=str(tmp_path / "00-berechnungen.png"), full_page=True)
    native_titles = {"Blitzschutz", "Kabelberechnung", "E-Mobilität · AC-Vorplanung"}
    manifest = []
    for index, label in enumerate(launchers, 1):
        title = label.removesuffix(" öffnen")
        slug = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()).strip("-")
        filename = f"{index:02d}-{slug}"
        page.get_by_role("button", name=label, exact=True).click()
        playwright.expect(page.get_by_role("heading", level=1)).to_be_visible()
        export_button = page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)
        playwright.expect(export_button).to_be_enabled()
        assert "premium" not in page.locator("body").inner_text().lower(), title
        if title != "Blitzschutz":
            playwright.expect(page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)).to_be_enabled()
        if title not in native_titles:
            playwright.expect(page.locator(".wb-metric").first).to_be_visible()
            numbers = page.locator('.wb-controls input[data-field-key][inputmode="decimal"]:not([disabled]):not([readonly])')
            # Only active fields are rendered. Prefer a consumed engineering value;
            # published-table modes such as PA can legitimately contain only selects.
            probe = None
            for key in ["length", "voltage", "reserve", "route", "current", "power", "ib", "load", "u1", "kw", "cos", "hours"]:
                candidate = page.locator(f'.wb-controls input[data-field-key="{key}"][inputmode="decimal"]:not([disabled]):not([readonly])')
                if candidate.count() and candidate.first.input_value().strip():
                    probe = candidate.first
                    break
            if probe is None:
                for candidate in numbers.all():
                    if candidate.input_value().strip():
                        probe = candidate
                        break
            if probe is not None:
                parameter_group = probe.locator("xpath=ancestor::details[1]")
                was_open = parameter_group.get_attribute("open") is not None
                if not was_open:
                    parameter_group.locator("summary").first.click()
                before = probe.input_value()
                probe.fill("")
                playwright.expect(export_button).to_be_disabled()
                playwright.expect(page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)).to_be_disabled()
                playwright.expect(page.locator('.wb-results [role="alert"]')).to_be_visible()
                probe.fill(before)
                playwright.expect(export_button).to_be_enabled()
                if not was_open:
                    parameter_group.locator("summary").first.click()
        if title == "E-Mobilität · AC-Vorplanung":
            playwright.expect(page.get_by_test_id("ev-current")).to_have_text("11.7 A")
            page.get_by_label("Gebäudereserve (kW)", exact=True).fill("80")
            playwright.expect(page.get_by_test_id("ev-budget")).to_have_text("30.9 kW")
            page.get_by_role("button", name="Ohne LM", exact=True).click()
            playwright.expect(page.locator(".ev-overload")).to_contain_text("79.1 kW")
            page.get_by_role("button", name="Dynamisch", exact=True).click()
            page.get_by_label("Gebäudereserve (kW)", exact=True).fill("30")
        for arrow in page.locator(".wb-arrow").all():
            playwright.expect(arrow).to_be_visible()
        page.get_by_role("heading", level=1).click()
        height = page.locator(".lab-main").evaluate("el=>Math.ceil(el.scrollHeight+150)")
        page.set_viewport_size({"width": 1600, "height": min(3400, max(1200, height))})
        page.locator(".engineering-lab").evaluate("el=>el.scrollTop=0")
        page.mouse.move(1, 1)
        page.screenshot(path=str(tmp_path / f"{filename}.png"), full_page=True)
        manifest.append({"title": title, "file": f"{filename}.png"})
        labels = page.locator(".lab-svg text").evaluate_all("els=>els.map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,x:r.x,y:r.y,w:r.width,h:r.height}})")
        for label_index, a in enumerate(labels):
            for b in labels[label_index + 1:]:
                overlap_x = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
                overlap_y = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
                assert overlap_x <= 1 or overlap_y <= 1, f"{title}: overlapping labels {a['text']} / {b['text']}"
        page.set_viewport_size({"width": 390, "height": 844})
        assert page.locator(".engineering-lab").evaluate("el=>el.scrollWidth<=el.clientWidth"), title
        for arrow in page.locator(".wb-arrow").all():
            playwright.expect(arrow).to_be_visible()
        if title == "E-Mobilität · AC-Vorplanung":
            page.locator(".engineering-lab").evaluate("el=>el.scrollTop=0")
            page.screenshot(path=str(tmp_path / f"{filename}-mobil.png"), full_page=True)
        page.get_by_role("button", name="Heller Rechnermodus", exact=True).click()
        assert page.locator(".engineering-lab").get_attribute("data-lab-theme") == "light"
        page.get_by_role("button", name="Dunkler Rechnermodus", exact=True).click()
        page.set_viewport_size({"width": 1600, "height": 1200})
        page.get_by_role("button", name="Berechnungen", exact=True).click()
    (tmp_path / "review-images.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def test_native_workbench_calculation_can_be_saved_and_restored_with_project_notes(editor, tmp_path):
    import json
    page, _, _, _ = editor
    base = page.url.rstrip("/")
    project_state = page.request.get(base + "/api/tools/projektzentrale/state").json()
    response = page.request.post(base + "/api/tools/projektzentrale/projects", headers={"X-Edeco-Projects": project_state["session_key"]}, data={"number": "1498", "name": "Werkstattversorgung"})
    assert response.ok
    archive_api = base + "/api/tools/berechnungsablage"
    archive_state = page.request.get(archive_api + "/state").json()
    headers = {"X-Edeco-Projects": archive_state["session_key"]}
    server = tmp_path / "server"
    server.mkdir()
    response = page.request.post(archive_api + "/settings", headers=headers, data={"root": str(server), "subfolder": "Berechnungen", "revision": archive_state["settings"]["revision"]})
    assert response.ok
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Ohmsches Gesetz öffnen", exact=True).click()
    voltage = page.locator('input[data-field-key="voltage"]')
    current = page.locator('input[data-field-key="current"]')
    playwright.expect(voltage).to_be_enabled()
    voltage.fill("48")
    current.fill("2")
    playwright.expect(page.locator('input[data-field-key="impedance"]')).to_have_count(0)
    playwright.expect(page.locator('input[data-field-key="cos"]')).to_have_count(0)
    choose_field(page, "known", "ur")
    playwright.expect(page.locator('input[data-field-key="current"]')).to_have_count(0)
    page.locator('input[data-field-key="impedance"]').fill("24")
    playwright.expect(page.locator(".wb-metric").filter(has_text="Wirkleistung").locator("strong")).to_have_text("96 W")
    choose_field(page, "known", "ui")
    playwright.expect(page.locator('input[data-field-key="current"]')).to_have_value("2")
    page.get_by_label("Berechnungsnotizen", exact=True).fill("48-V-Netzteil; rein ohmsche Beispielbelastung")
    playwright.expect(page.locator(".wb-metric").filter(has_text="Wirkleistung").locator("strong")).to_have_text("96 W")
    page.get_by_role("button", name="Projektbezogen auf Server speichern", exact=True).click()
    dialog = page.get_by_role("dialog", name="Projektbezogen speichern")
    playwright.expect(dialog.get_by_label("Rechenstand-Bezeichnung", exact=True)).to_have_value("Ohmsches Gesetz")
    playwright.expect(dialog.get_by_label("Ablage-Projektnummer", exact=True)).to_have_value("1498")
    dialog.get_by_label("Rechenstand-Bezeichnung", exact=True).fill("DC-Netzteil 48 V")
    dialog.get_by_role("button", name="Als neuen Stand speichern", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_contain_text("Gemeinsam gespeichert")
    page.get_by_role("button", name="Information schliessen", exact=True).click()
    voltage.fill("99")
    page.get_by_label("Berechnungsnotizen", exact=True).fill("Lokaler abweichender Entwurf")
    page.get_by_role("button", name="Gemeinsame Berechnungsablage öffnen", exact=True).click()
    page.locator(".archive-item").filter(has_text="DC-Netzteil 48 V").click()
    page.get_by_role("button", name="Eingaben laden & neu berechnen", exact=True).click()
    playwright.expect(page.locator('input[data-field-key="voltage"]')).to_have_value("48")
    playwright.expect(page.locator('input[data-field-key="current"]')).to_have_value("2")
    playwright.expect(page.get_by_label("Berechnungsnotizen", exact=True)).to_have_value("48-V-Netzteil; rein ohmsche Beispielbelastung")
    playwright.expect(page.locator(".wb-metric").filter(has_text="Wirkleistung").locator("strong")).to_have_text("96 W")
    with page.expect_download() as pending:
        page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True).click()
    exported = json.loads(pending.value.path().read_bytes())
    assert exported["calculatorId"] == "ohmsches-gesetz"
    assert exported["input"]["voltage"] == "48"
    records = page.request.get(archive_api + "/records", headers=headers).json()["items"]
    assert len(records) == 1 and records[0]["source"] == "edeco"
    record = page.request.get(archive_api + "/record", headers=headers, params={"key": records[0]["key"]}).json()
    assert record["document"]["input"]["voltage"] == "48"
    assert record["notes"] == "48-V-Netzteil; rein ohmsche Beispielbelastung"


def test_project_hub_persists_contacts_and_references_and_passes_active_number_to_rename(editor, tmp_path):
    from test_documents import sample_pdf
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Projektzentrale öffnen", exact=True).click()
    page.get_by_role("button", name="Neues Projekt", exact=True).click()
    page.get_by_label("Projektnummer", exact=True).fill("1498")
    page.get_by_label("Projektname", exact=True).fill("Neubau Musterstrasse")
    page.get_by_label("Projektadresse", exact=True).fill("Musterstrasse 1")
    page.get_by_label("Ablageordner", exact=True).fill(r"X:\Projekte\1498")
    page.get_by_role("button", name="Kontakt hinzufügen", exact=True).click()
    page.get_by_label("Name Kontakt 1", exact=True).fill("Testkontakt")
    page.get_by_label("Rolle Kontakt 1", exact=True).fill("Bauleitung")
    page.get_by_label("E-Mail Kontakt 1", exact=True).fill("test@example.invalid")
    page.get_by_role("button", name="Dokumentverweis hinzufügen", exact=True).click()
    page.get_by_label(re.compile("^Dokumenttitel ")).fill("Apparatenplan OG02")
    page.get_by_label(re.compile("^Dokumentpfad ")).fill(r"X:\Projekte\1498\Plan.pdf")
    page.get_by_label("Notizen", exact=True).fill("Planlieferung vorbereiten")
    page.get_by_role("button", name="Projekt speichern", exact=True).click()
    playwright.expect(page.get_by_text("Projekt gespeichert.", exact=True)).to_be_visible()
    playwright.expect(page.get_by_text("Aktiv: 1498 · Neubau Musterstrasse", exact=True)).to_be_visible()
    page.set_viewport_size({"width": 1400, "height": 900})
    page.screenshot(path=str(tmp_path / "project-hub.png"), full_page=True)
    page.get_by_role("button", name="Dateien für dieses Projekt benennen", exact=True).click()
    playwright.expect(page.get_by_role("textbox", name="Projektnummer", exact=True)).to_have_value("1498")
    playwright.expect(page.locator(".rename-project")).to_contain_text("1498 · Neubau Musterstrasse")
    playwright.expect(page.get_by_role("button", name="PDFs hinzufügen", exact=True)).to_be_enabled()
    page.get_by_label("PDFs hinzufügen", exact=True).set_input_files({
        "name": "Plan EG.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["Erdgeschoss"]]),
    })
    playwright.expect(page.get_by_label("Neuer Name für Plan EG.pdf", exact=True)).to_have_value("1498_E-G-APP-EG00-C-50.pdf")
    # A project change in another window must not silently rewrite an open naming draft.
    prefix = page.url.rstrip("/") + "/api/tools/projektzentrale"
    state = page.request.get(prefix + "/state").json()
    headers = {"X-Edeco-Projects": state["session_key"]}
    second = page.request.post(prefix + "/projects", headers=headers, data={"number": "3000", "name": "Zweites Projekt"}).json()
    page.request.post(prefix + "/selection", headers=headers, data={"project_id": second["id"]})
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    apply = page.get_by_role("button", name="Projektnummer übernehmen", exact=True)
    playwright.expect(apply).to_be_visible()
    playwright.expect(page.get_by_role("textbox", name="Projektnummer", exact=True)).to_have_value("1498")
    apply.click()
    playwright.expect(page.get_by_role("textbox", name="Projektnummer", exact=True)).to_have_value("3000")
    page.once("dialog", lambda dialog: dialog.accept())
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    picker = page.get_by_label("Aktives Projekt", exact=True)
    playwright.expect(picker).to_have_value(second["id"])
    first_id = next(project["id"] for project in state["projects"] if project["number"] == "1498")
    picker.select_option(first_id)
    playwright.expect(picker).to_have_value(first_id)
    page.get_by_role("button", name="Projektzentrale öffnen", exact=True).click()
    playwright.expect(page.get_by_label("Name Kontakt 1", exact=True)).to_have_value("Testkontakt")
    playwright.expect(page.get_by_label(re.compile("^Dokumenttitel "))).to_have_value("Apparatenplan OG02")
    page.get_by_label("Projekt archiviert", exact=True).check()
    page.get_by_role("button", name="Projekt speichern", exact=True).click()
    playwright.expect(page.get_by_text("Projekt gespeichert.", exact=True)).to_be_visible()
    page.get_by_role("button", name="Archiv", exact=True).click()
    playwright.expect(page.locator(".hub-project-list-item")).to_have_count(1)
    page.reload()
    page.get_by_role("button", name="Archiv", exact=True).click()
    page.locator(".hub-project-list-item").click()
    playwright.expect(page.get_by_label("Projekt archiviert", exact=True)).to_be_checked()
    playwright.expect(page.get_by_label("Notizen", exact=True)).to_have_value("Planlieferung vorbereiten")
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".project-hub").evaluate("el => el.scrollWidth <= el.clientWidth")


def test_project_hub_failed_save_keeps_draft_and_can_retry_before_leaving(editor):
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Projektzentrale öffnen", exact=True).click()
    page.get_by_role("button", name="Neues Projekt", exact=True).click()
    page.get_by_label("Projektnummer", exact=True).fill("2000")
    page.get_by_label("Projektname", exact=True).fill("Ungespeichertes Projekt")
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    dialog = page.get_by_role("alertdialog", name="Projektänderungen speichern?")
    playwright.expect(dialog).to_be_visible()
    page.route("**/api/tools/projektzentrale/projects", lambda route: route.fulfill(status=503, json={"detail": "Test: Speichern fehlgeschlagen."}))
    dialog.get_by_role("button", name="Speichern und weiter", exact=True).click()
    playwright.expect(dialog.get_by_role("alert")).to_contain_text("Speichern fehlgeschlagen")
    playwright.expect(page.get_by_label("Projektname", exact=True)).to_have_value("Ungespeichertes Projekt")
    page.unroute("**/api/tools/projektzentrale/projects")
    dialog.get_by_role("button", name="Speichern und weiter", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Ein Ort. Deine Werkzeuge.")).to_be_visible()
    page.get_by_role("button", name="Projektzentrale öffnen", exact=True).click()
    playwright.expect(page.get_by_label("Projektname", exact=True)).to_have_value("Ungespeichertes Projekt")


def test_file_rename_template_detects_floors_blocks_duplicates_and_downloads_original_copies(editor, tmp_path):
    import io
    import zipfile
    from test_documents import sample_pdf

    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Dateien umbenennen öffnen", exact=True).click()
    page.get_by_role("textbox", name="Projektnummer", exact=True).fill("1498")
    page.get_by_label("PDFs hinzufügen", exact=True).set_input_files([
        {"name": "Grundriss 2og.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["2. Obergeschoss"]])},
        {"name": "Plan EG.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["Erdgeschoss"]])},
    ])
    first = page.get_by_label("Neuer Name für Grundriss 2og.pdf", exact=True)
    second = page.get_by_label("Neuer Name für Plan EG.pdf", exact=True)
    playwright.expect(first).to_have_value("1498_E-G-APP-OG02-C-50.pdf")
    playwright.expect(second).to_have_value("1498_E-G-APP-EG00-C-50.pdf")
    download = page.get_by_role("button", name="Benannte Kopien als ZIP herunterladen")
    page.get_by_label("Geschoss verwenden", exact=True).uncheck()
    playwright.expect(download).to_be_disabled()
    playwright.expect(page.get_by_text("Namenskonflikt: bitte eindeutig benennen.", exact=True)).to_have_count(2)
    page.get_by_label("Geschoss verwenden", exact=True).check()
    page.get_by_label("Index verwenden", exact=True).uncheck()
    playwright.expect(first).to_have_value("1498_E-G-APP-OG02-50.pdf")
    page.get_by_label("Datum verwenden", exact=True).check()
    page.get_by_label("Datum", exact=True).fill("2026-11-01")
    playwright.expect(first).to_have_value("1498_E-G-APP-OG02-50-2026-11-01.pdf")
    page.get_by_label("Datum verwenden", exact=True).uncheck()
    page.get_by_label("Index verwenden", exact=True).check()
    page.set_viewport_size({"width": 1400, "height": 900})
    page.screenshot(path=str(tmp_path / "rename-preview.png"), full_page=True)
    with page.expect_download() as pending:
        download.click()
    path = pending.value.path()
    with zipfile.ZipFile(io.BytesIO(path.read_bytes())) as archive:
        assert archive.namelist() == ["1498_E-G-APP-OG02-C-50.pdf", "1498_E-G-APP-EG00-C-50.pdf"]
        assert archive.read(archive.namelist()[0]) == sample_pdf([["2. Obergeschoss"]])
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Dateien umbenennen öffnen", exact=True).click()
    playwright.expect(page.get_by_role("textbox", name="Projektnummer", exact=True)).to_have_value("1498")
    playwright.expect(page.get_by_role("button", name="PDFs hinzufügen", exact=True)).to_be_enabled()
    page.get_by_label("PDFs hinzufügen", exact=True).set_input_files({
        "name": "Konflikt OG02.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["Erdgeschoss"]]),
    })
    floor = page.get_by_label("Geschoss für Konflikt OG02.pdf", exact=True)
    playwright.expect(floor).to_have_value("")
    playwright.expect(download).to_be_disabled()
    floor.fill("EG00")
    playwright.expect(download).to_be_enabled()
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".rename-tool").evaluate("el => el.scrollWidth <= el.clientWidth")


@pytest.mark.skipif(not os.environ.get("EDECO_TEST_STIRLING_URL"), reason="Live Stirling service required")
def test_stirling_embedded_keeps_original_ui_and_merges_two_real_pdfs(editor):
    import pypdfium2 as pdfium
    from urllib.parse import urlsplit
    from test_documents import sample_pdf
    page, _, _, _ = editor
    external_requests = []
    page.on("request", lambda request: external_requests.append(request.url)
            if urlsplit(request.url).scheme in {"http", "https"} and urlsplit(request.url).hostname not in {"127.0.0.1", "localhost"} else None)
    page.set_viewport_size({"width": 1400, "height": 900})
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="PDF-Werkstatt öffnen", exact=True).click()
    frame = page.frame_locator("iframe[title='Stirling-PDF · edeco PDF-Werkstatt']")
    picker = frame.locator("input[type=file]").first
    picker.wait_for(state="attached", timeout=60000)
    playwright.expect(frame.locator(".sui-logo").first).to_have_css("background-image", re.compile("edeco/logo.svg"))
    picker.set_input_files([
        {"name": "Plan-A.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["FIRST PLAN"]])},
        {"name": "Plan-B.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["SECOND PLAN"]])},
    ])
    frame.get_by_text("Plan-B.pdf", exact=True).first.wait_for(timeout=30000)
    frame.get_by_text("Zusammenführen", exact=True).first.click()
    with page.expect_response(lambda response: response.url.endswith("/api/v1/general/merge-pdfs"), timeout=60000) as processing:
        frame.get_by_role("button", name="Zusammenführen (2 Dateien)", exact=True).click()
    response = processing.value
    assert response.status == 200
    with pdfium.PdfDocument(response.body()) as result:
        assert len(result) == 2
    frame.get_by_text("merged_Plan-A.pdf", exact=True).first.wait_for(timeout=30000)
    assert not external_requests, "PDF processing must not make browser requests to public services"
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    dialog = page.get_by_role("alertdialog", name="Ergebnisse gespeichert?")
    playwright.expect(dialog).to_be_visible()
    dialog.get_by_role("button", name="Hier bleiben", exact=True).click()
    playwright.expect(page.locator("iframe")).to_be_visible()
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
    notes = """## Version 0.2.0 Build 5
- Neue Rechnerauswahl
- Verbesserte Grafiken
- Wissens-Hub ergänzt
- Fehlerkorrekturen
- Ruhigere Schrift
- Weitere Eingaben ergänzt

## Frühere Version
- Veraltete Änderung
"""
    page.route("**/api/toolbox/updates", lambda route: route.fulfill(json=state))
    def action(route):
        assert route.request.headers.get("x-edeco-update") == "test-session"
        kind = route.request.url.rsplit("/", 1)[1]
        actions.append(kind)
        if kind == "check":
            route.fulfill(json={**state, "status": "available", "latest": "v0.2.0-build.5", "notes": notes, "can_install": True, "message": "Ein Toolbox-Update ist verfügbar."})
        else:
            assert kind == "install" and json.loads(route.request.post_data) == {}
            route.fulfill(json={**state, "status": "installing", "message": "Setup geprüft. Die Toolbox schliesst sich."})
    page.route("**/api/toolbox/updates/check", action)
    page.route("**/api/toolbox/updates/install", action)
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Nach Updates suchen", exact=True).click()
    changes = page.locator(".toolbox-update-changes")
    playwright.expect(changes.get_by_role("heading", name="Was sich geändert hat")).to_be_visible()
    playwright.expect(changes.get_by_text("Neue Rechnerauswahl", exact=True)).to_be_visible()
    playwright.expect(changes.get_by_text("Ruhigere Schrift", exact=True)).to_be_visible()
    playwright.expect(changes.get_by_text("Weitere Eingaben ergänzt", exact=True)).not_to_be_visible()
    playwright.expect(changes).not_to_contain_text("Veraltete Änderung")
    page.get_by_role("button", name="Schliessen", exact=True).focus()
    page.keyboard.press("Tab")
    playwright.expect(changes.locator("summary")).to_be_focused()
    page.keyboard.press("Enter")
    playwright.expect(changes.get_by_text("Weitere Eingaben ergänzt", exact=True)).to_be_visible()
    full_notes = page.locator(".toolbox-update-full-notes")
    playwright.expect(full_notes.locator("pre")).not_to_be_visible()
    page.keyboard.press("Tab")
    playwright.expect(full_notes.locator("summary")).to_be_focused()
    page.keyboard.press("Enter")
    playwright.expect(full_notes.locator("pre")).to_contain_text("Veraltete Änderung")
    assert actions == ["check"]
    page.get_by_role("button", name="Update installieren", exact=True).click()
    assert actions == ["check"]
    page.get_by_role("button", name="Jetzt aktualisieren", exact=True).click()
    playwright.expect(page.get_by_role("status").filter(has_text="Setup geprüft")).to_be_visible()
    assert actions == ["check", "install"]


def test_common_updater_shows_when_release_has_no_change_notes(editor):
    page, _, _, _ = editor
    state = {"current": "v0.2.0-build.4", "latest": "v0.2.0-build.5",
             "status": "available", "message": "Ein Toolbox-Update ist verfügbar.",
             "can_install": False, "packaged": False, "automatic": False,
             "release_url": "https://github.com/alxdrg-be/edeco-tool/releases", "session_key": "test-session"}
    page.route("**/api/toolbox/updates", lambda route: route.fulfill(json=state))
    page.route("**/api/toolbox/updates/check", lambda route: route.fulfill(json=state))
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Update verfügbar", exact=True).click()
    changes = page.locator(".toolbox-update-changes")
    playwright.expect(changes).to_be_visible()
    playwright.expect(changes).to_contain_text("keine Änderungsnotizen")
    playwright.expect(page.get_by_role("link", name="Releases öffnen", exact=True)).to_have_attribute(
        "href", state["release_url"])
    playwright.expect(page.get_by_role("button", name="Update installieren", exact=True)).to_have_count(0)


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


def test_charging_schema_updates_topology_values_and_each_budget_colour(editor, tmp_path):
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Ladegrid PKW öffnen", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_enabled()
    choose_field(page, "layout", "legacy")
    feed = page.get_by_test_id("schema-grid-feed")
    playwright.expect(feed).to_have_attribute("data-state", "limited")
    assert "H" not in feed.get_attribute("d").upper(), "UV must feed directly downward without a left detour"
    playwright.expect(page.get_by_test_id("schema-house-feed")).to_have_attribute("data-state", "normal")
    playwright.expect(page.locator(".ev-schema-point")).to_have_count(6)
    playwright.expect(page.locator(".ev-schema-allocated").first).to_have_text("6.7 kW")
    page.locator(".wb-field-group").filter(has=page.get_by_text("Steuerung", exact=True)).locator("summary").click()
    choose_field(page, "mode", "none")
    playwright.expect(page.get_by_test_id("schema-house-feed")).to_have_attribute("data-state", "error")
    playwright.expect(feed).to_have_attribute("data-state", "error")
    playwright.expect(page.locator(".ev-schema-allocated").first).to_have_text("11 kW")
    page.locator(".wb-field-group").filter(has=page.get_by_text("Grid 2", exact=True)).locator("summary").click()
    page.locator('input[data-field-key="count2"]').fill("1")
    playwright.expect(page.get_by_test_id("schema-house-feed")).to_have_attribute("data-state", "normal")
    playwright.expect(feed).to_have_attribute("data-state", "error")
    page.get_by_role("group", name="Ladegrid auswählen", exact=True).get_by_role("button", name="Grid 2", exact=True).click()
    playwright.expect(feed).to_have_attribute("data-state", "normal")
    playwright.expect(page.locator(".ev-schema-point")).to_have_count(1)
    playwright.expect(page.locator(".ev-schema-allocated").first).to_have_text("11 kW")
    page.locator('input[data-field-key="count2"]').fill("2")
    playwright.expect(page.locator(".ev-schema-point")).to_have_count(2)
    page.locator('input[data-field-key="count2"]').fill("")
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_disabled()
    playwright.expect(page.locator(".ev-schema-point")).to_have_count(0)
    page.locator('input[data-field-key="count2"]').fill("2")
    page.set_viewport_size({"width":1600,"height":1900})
    page.get_by_role("group", name="Ladegrid auswählen", exact=True).get_by_role("button", name="Grid 1", exact=True).click()
    page.locator(".engineering-lab").evaluate("el=>el.scrollTop=0")
    page.screenshot(path=str(tmp_path / "ladegrid-grid-ueberlast.png"), full_page=True)
    choose_field(page, "mode", "dynamic")
    playwright.expect(feed).to_have_attribute("data-state", "limited")
    page.locator(".engineering-lab").evaluate("el=>el.scrollTop=0")
    page.screenshot(path=str(tmp_path / "ladegrid-lastmanagement.png"), full_page=True)


def test_electrical_ratings_use_compact_dropdowns_and_short_cards(editor):
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="E-Mobilität · AC-Vorplanung öffnen", exact=True).click()
    house = named_cards(page, "Hausanschluss (A)")
    grid = named_cards(page, "Grid-Vorsicherung (A)")
    playwright.expect(house).to_be_enabled()
    expand_card_options(house)
    assert house.locator("option").evaluate_all("els=>els.map(el=>el.value)") == ["63","80","100","125","160","200","250","315","400","500","630","800"]
    playwright.expect(page.get_by_role("slider", name="Hausanschluss (A) Slider", exact=True)).to_have_count(0)
    choose_card(grid, "63")
    choose_card(house, "125")
    playwright.expect(page.get_by_test_id("ev-budget")).to_have_text("43.6 kW")
    choose_card(named_cards(page, "Ladeleistung je Punkt (kW)"), "22")
    playwright.expect(page.locator(".ev-schema-rated").first).to_have_text("Nennleistung 22 kW")
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="Ladegrid PKW öffnen", exact=True).click()
    playwright.expect(page.locator('[data-field-key="layout"]')).to_be_enabled()
    choose_field(page, "layout", "legacy")
    standard = page.locator('[data-field-key="house"]')
    supply_group = standard.locator("xpath=ancestor::details[1]")
    if supply_group.get_attribute("open") is None:
        supply_group.locator("summary").first.click()
    playwright.expect(standard).to_be_enabled()
    choose_card(standard, "125")
    playwright.expect(page.locator('input[data-field-key="house"]')).to_have_count(0)
    page.locator(".wb-field-group").filter(has=page.get_by_text("Grid 1", exact=True)).locator("summary").click()
    choose_field(page, "grid1", "50")
    choose_field(page, "power1", "22")
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_enabled()
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="LS-Schalter öffnen", exact=True).click()
    breaker = page.locator('[data-field-key="rated"]')
    playwright.expect(breaker).to_be_enabled()
    choose_card(breaker, "13")
    playwright.expect(page.locator('input[data-field-key="load"]')).to_be_enabled()
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="Potenzialausgleich öffnen", exact=True).click()
    # A published PA selection has no arbitrary numeric entry to clear.
    playwright.expect(page.locator('.wb-controls input[data-field-key][inputmode="decimal"]')).to_have_count(0)
    phase = page.locator('[data-field-key="phase"]')
    choose_card(phase, "4")
    choose_field(page, "pen", "4")
    playwright.expect(page.locator(".wb-metric").filter(has_text="Haupt-PA aus den Eingaben").locator("strong")).to_have_text("6 mm² Cu")
    choose_field(page, "paMode", "manual")
    page.locator('input[data-field-key="pe"]').fill("")
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_disabled()
    playwright.expect(page.locator('.wb-results [role="alert"]')).to_be_visible()
    choose_field(page, "paMode", "published")
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_enabled()


def test_reference_style_graphics_and_short_explanations_are_visible(editor):
    page, _, _, _ = editor
    page.set_viewport_size({"width":1600,"height":1500})
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Ladeinfrastruktur-Kosten öffnen", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_enabled()
    choose_field(page, "costLayout", "legacy")
    guide = page.locator(".wb-reading-guide")
    assert guide.get_attribute("open") is None
    guide.locator("summary").click()
    playwright.expect(guide.locator(".lab-prose")).to_be_visible()
    playwright.expect(page.locator(".reference-year-column")).to_have_count(15)
    page.locator(".reference-year-column").nth(1).focus()
    playwright.expect(page.locator(".reference-chart-readout")).to_contain_text("2027")
    assert page.locator(".wb-result-graphics").bounding_box()["x"] < page.locator(".wb-metrics").bounding_box()["x"]
    points = page.locator('input[data-field-key="points"]')
    point_group = points.locator("xpath=ancestor::details[1]")
    if point_group.get_attribute("open") is None:
        point_group.locator("summary").first.click()
    old_total = page.locator(".wb-metric strong").first.inner_text()
    points.fill("1")
    playwright.expect(page.locator(".reference-year-column")).to_have_count(15)
    playwright.expect(page.locator(".wb-metric strong").first).not_to_have_text(old_total)
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="Brandmelder öffnen", exact=True).click()
    playwright.expect(page.locator(".reference-room-plan")).to_be_visible()
    playwright.expect(page.locator(".reference-dimension-label")).to_have_count(2)
    playwright.expect(page.locator(".reference-dimension-label").first).to_have_text("10 m")
    length = page.locator('input[data-field-key="length"]')
    for summary in length.locator("xpath=ancestor::details[not(@open)]/summary").all():
        summary.click()
    length.fill("12")
    playwright.expect(page.locator(".reference-dimension-label").first).to_have_text("12 m")
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="Ohmsches Gesetz öffnen", exact=True).click()
    guide = page.locator(".wb-reading-guide")
    assert guide.get_attribute("open") is None
    guide.locator("summary").click()
    playwright.expect(guide.locator(".lab-prose")).to_be_visible()
    playwright.expect(page.locator(".wb-result-graphics")).to_have_count(0)


def test_reference_ev_activity_waiting_and_single_phase_warning(editor, tmp_path):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1600, "height": 1600})
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="E-Mobilität · AC-Vorplanung öffnen", exact=True).click()
    playwright.expect(page.get_by_label("Anzahl Ladepunkte", exact=True)).to_be_enabled()
    page.get_by_label("Anzahl Ladepunkte", exact=True).fill("3")
    page.get_by_role("button", name="Statisch", exact=True).click()
    factor_basis = named_cards(page, "Faktorgrundlage")
    playwright.expect(factor_basis.locator('button[data-choice-value="reference"]')).to_have_attribute("aria-pressed", "true")
    choose_card(factor_basis, "manual")
    page.get_by_label("Gleichzeitigkeitsfaktor k (statisch)", exact=True).fill("0.5")
    playwright.expect(page.locator('.ev-schema-point[data-active="true"]')).to_have_count(2)
    playwright.expect(page.locator('.ev-schema-point[data-state="waiting"]')).to_have_count(1)
    playwright.expect(page.locator('.ev-schema-point[data-state="waiting"] .ev-schema-allocated')).to_have_text("0 kW")
    page.screenshot(path=str(tmp_path / "ev-aktiv-wartend.png"), full_page=True)
    choose_card(named_cards(page, "Hausanschluss (A)"), "125")
    choose_card(named_cards(page, "Grid-Vorsicherung (A)"), "63")
    choose_card(named_cards(page, "Ladeleistung je Punkt (kW)"), "7.4")
    page.get_by_label("Gebäudereserve (kW)", exact=True).fill("20")
    page.get_by_label("Anzahl Ladepunkte", exact=True).fill("4")
    page.get_by_role("button", name="Ohne LM", exact=True).click()
    playwright.expect(page.get_by_test_id("schema-grid-feed")).to_have_attribute("data-state", "error")
    playwright.expect(page.locator('.ev-schema-secondary').first).to_contain_text("L1")
    page.screenshot(path=str(tmp_path / "ev-einphasig-ueberlast.png"), full_page=True)


def test_actual_calculation_pdf_download_is_a4_and_invalid_inputs_cannot_export(editor, tmp_path):
    import pypdfium2 as pdfium
    from contextlib import closing
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Kabelberechnung öffnen", exact=True).click()
    pdf_button = page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)
    playwright.expect(pdf_button).to_be_enabled()
    with page.expect_download() as pending:
        pdf_button.click()
    download = pending.value
    assert download.suggested_filename.startswith("Kabel · Spannungsfall_25 m_2.5 mm² Cu")
    path = tmp_path / download.suggested_filename
    download.save_as(path)
    assert path.read_bytes().startswith(b"%PDF-")
    with pdfium.PdfDocument(path) as document:
        assert len(document) >= 1
        with closing(document[0]) as pdf_page:
            width, height = pdf_page.get_size()
            assert abs(width - 595.276) < 0.1 and abs(height - 841.89) < 0.1
            with closing(pdf_page.render(scale=1)) as bitmap:
                bitmap.to_pil().save(tmp_path / "kabel-pdf.png")
    page.get_by_label("Laststrom I (A)", exact=True).fill("")
    playwright.expect(pdf_button).to_be_disabled()
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="Ohmsches Gesetz öffnen", exact=True).click()
    playwright.expect(pdf_button).to_be_enabled()
    formula = page.locator(".wb-foundations")
    assert formula.get_attribute("open") is None
    formula.locator("summary").click()
    playwright.expect(formula.locator("code")).to_be_visible()
    with page.expect_download() as second:
        pdf_button.click()
    with pdfium.PdfDocument(second.value.path()) as document:
        assert len(document) >= 1


def test_technical_diagrams_distinguish_device_states_and_cable_inventory(editor):
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Motoranlauf öffnen", exact=True).click()
    playwright.expect(page.locator('[data-symbol="motor"]')).to_have_count(1)
    playwright.expect(page.locator('[data-motor-state]')).to_have_count(2)
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="Brandlast Fluchtweg öffnen", exact=True).click()
    inventory = page.locator(".technical-figure")
    playwright.expect(inventory).to_contain_text("30 Kabel erfasst")
    playwright.expect(inventory).to_contain_text("15 Kabel erfasst")
    page.locator(".wb-position-editor > summary").filter(has_text="Kabelpositionen vorher / nachher bearbeiten").click()
    before = page.get_by_role("region", name="Vorher im Fluchtweg", exact=True)
    after = page.get_by_role("region", name="Nachher im Fluchtweg", exact=True)
    playwright.expect(before).to_be_visible()
    playwright.expect(after).to_be_visible()
    playwright.expect(page.locator('input[data-field-key="countBefore1"]')).to_have_count(0)
    count = before.get_by_label("Vorher · Position 1 · Anzahl", exact=True)
    count.fill("1")
    playwright.expect(inventory).to_contain_text("11 Kabel erfasst")
    playwright.expect(inventory).to_contain_text("15 Kabel erfasst")
    export_button = page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)
    before.get_by_role("button", name="Kabelposition hinzufügen", exact=True).click()
    playwright.expect(export_button).to_be_disabled()
    new_position = before.locator(".fireload-card").nth(2)
    new_position.locator(":scope > summary").click()
    before.get_by_label("Vorher · Position 3 · Brandlast je Kabel (MJ/m)", exact=True).fill("0.5")
    before.get_by_label("Vorher · Position 3 · Anzahl", exact=True).fill("2")
    playwright.expect(export_button).to_be_enabled()
    playwright.expect(inventory).to_contain_text("13 Kabel erfasst")
    playwright.expect(inventory).to_contain_text("15 Kabel erfasst")
    before.get_by_role("button", name="Vorher · Kabelposition 3 entfernen", exact=True).click()
    playwright.expect(before.locator(".fireload-card")).to_have_count(2)
    playwright.expect(inventory).to_contain_text("11 Kabel erfasst")
    count.fill("")
    playwright.expect(export_button).to_be_disabled()
    playwright.expect(page.locator('.wb-results [role="alert"]')).to_be_visible()
    count.fill("1")
    playwright.expect(export_button).to_be_enabled()
    playwright.expect(inventory).to_contain_text("11 Kabel erfasst")


def test_sia_keyboard_entry_preserves_decimal_zeros_and_invalid_fields(editor):
    import json
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1600, "height": 1300})
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="SIA 2056 · Zonenbilanz öffnen", exact=True).click()
    choose_field(page, "siaMode", "manual")
    export_button = page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)
    playwright.expect(export_button).to_be_enabled()
    editor_section = page.locator(".wb-position-editor")
    editor_section.locator("summary").first.click()
    page.get_by_label("Zone 1 · Bezeichnung", exact=True).fill("Tastaturtest")

    def enter(field, text):
        field.fill("")
        field.press_sequentially(text)
        playwright.expect(field).to_have_value(text)
        playwright.expect(field).to_be_focused()
        playwright.expect(editor_section).to_have_attribute("open", "")

    power = page.get_by_label("Tastaturtest · Geräte · Rohleistung (W/m²)", exact=True)
    energy = page.get_by_label("Tastaturtest · Geräte · Rohenergie (kWh/m² pro Jahr)", exact=True)
    kcor = page.get_by_label("Tastaturtest · Kcor Leistung", exact=True)
    year = page.get_by_label("Tastaturtest · Jahresgleichzeitigkeit Energie", exact=True)
    enter(power, "0.05")
    enter(power, "20.0500")
    enter(energy, "30.0500")
    enter(kcor, "0.0500")
    enter(year, "0,5000")
    playwright.expect(export_button).to_be_enabled()
    page.locator(".sia-zone-targets > summary").click()
    target = page.get_by_label("Tastaturtest · Ziel Leistung (W/m²)", exact=True)
    enter(target, "0.0000")
    playwright.expect(page.locator(".wb-status")).to_contain_text("überschreitet")
    target.fill("")
    playwright.expect(export_button).to_be_enabled()
    energy.fill("")
    playwright.expect(export_button).to_be_disabled()
    playwright.expect(page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)).to_be_disabled()
    playwright.expect(page.locator('.wb-results [role="alert"]')).to_be_visible()
    playwright.expect(energy).to_be_focused()
    energy.press_sequentially("30.0500")
    playwright.expect(energy).to_have_value("30.0500")
    playwright.expect(energy).to_be_focused()
    playwright.expect(export_button).to_be_enabled()
    with page.expect_download() as pending:
        export_button.click()
    document = json.loads(Path(pending.value.path()).read_text())
    zone = json.loads(document["input"]["siaZones"])[0]
    assert zone["kcor"] == "0.0500"
    assert zone["yearGlz"] == "0,5000"
    assert zone["consumers"][0]["powerDensity"] == "20.0500"
    assert zone["consumers"][0]["energyDensity"] == "30.0500"
    assert "powerTarget" not in zone
    assert document["result"]["siaBreakdown"]["powerKW"] == pytest.approx(0.10025)
    assert document["result"]["siaBreakdown"]["energyKWh"] == pytest.approx(1502.5)


def test_knowledge_roundtrip_keeps_edited_calculator_and_browser_back(editor):
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.evaluate("location.hash='toolbox'")
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="LS-Schalter öffnen", exact=True).click()
    choose_field(page, "curve", "C")
    load = page.locator('input[data-field-key="load"]')
    for summary in load.locator("xpath=ancestor::details[not(@open)]/summary").all():
        summary.click()
    load.fill("11")
    page.get_by_role("button", name="Info: Berechnungsgrundlagen", exact=True).click()
    drawer = page.get_by_role("dialog", name="Berechnungsgrundlagen", exact=True)
    drawer.get_by_role("link", name="Im Wissens-Hub weiterlesen", exact=False).click()
    playwright.expect(page.locator(".knowledge-article")).to_be_visible()
    assert page.url.endswith("#wissen/schutz-selektivitaet")
    assert page.locator(".knowledge-section[open]").count() == 0
    page.go_back()
    playwright.expect(page.locator('input[data-field-key="load"]')).to_have_value("11")
    playwright.expect(page.locator('[data-field-key="curve"] button[data-choice-value="C"]')).to_have_attribute("aria-pressed", "true")


def test_variable_selectivity_adds_real_stages_and_rejects_invalid_topology(editor):
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Selektivität öffnen", exact=True).click()
    choose_field(page, "selectivityMode", "stages")
    page.locator(".wb-position-editor > summary").click()
    playwright.expect(page.locator(".sel-stage-card")).to_have_count(3)
    page.get_by_role("button", name="Stufe hinzufügen", exact=True).click()
    playwright.expect(page.locator(".sel-stage-card")).to_have_count(4)
    playwright.expect(page.locator(".wb-metric").filter(has_text="Erfasste Schutzstufen").locator("strong")).to_have_text("4")
    page.locator(".sel-stage-card").nth(3).locator("summary").first.click()
    choose_card(named_cards(page, "Stufe 4 · Schutzorgan"), "mccb")
    choose_card(named_cards(page, "Stufe 4 · Kabeltyp"), "CFW")
    playwright.expect(page.locator('.wb-results [role="alert"]')).to_contain_text("Kein belegtes R/X-Paar")
    playwright.expect(page.locator(".wb-result-graphics")).to_have_count(0)
    choose_card(named_cards(page, "Stufe 4 · Querschnitt"), "50")
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_enabled()
    choose_card(named_cards(page, "Stufe 4 · Leitersystem"), "5p")
    playwright.expect(page.locator('.wb-results [role="alert"]')).to_contain_text("dreiphasiger Abschnitt")
    choose_card(named_cards(page, "Stufe 4 · Leitersystem"), "3p")
    page.get_by_role("button", name="Stufe hinzufügen", exact=True).click()
    page.get_by_role("button", name="Stufe hinzufügen", exact=True).click()
    playwright.expect(page.locator(".sel-stage-card")).to_have_count(6)
    playwright.expect(page.get_by_role("button", name="Stufe hinzufügen", exact=True)).to_be_disabled()
    page.locator(".sel-stage-card").nth(5).locator("summary").first.click()
    page.get_by_role("button", name="Stufe 6 entfernen", exact=True).click()
    playwright.expect(page.locator(".sel-stage-card")).to_have_count(5)
    playwright.expect(page.get_by_role("button", name="Stufe hinzufügen", exact=True)).to_be_enabled()


def test_hash_navigation_cannot_discard_an_open_noncalculator_editor(editor):
    page, field, _, _ = editor
    field.fill("Diesen Entwurf behalten")
    for fragment in ("rechner/ls-schalter", "wissen/spannungsfall", "toolbox"):
        page.evaluate("fragment => { location.hash=fragment; }", fragment)
        page.wait_for_timeout(80)
        playwright.expect(field).to_have_value("Diesen Entwurf behalten")
        playwright.expect(page.locator(".engineering-lab")).to_have_count(0)
    page.go_back()
    playwright.expect(field).to_have_value("Diesen Entwurf behalten")


def test_mixed_grid_generation_and_depot_waiting_are_integrated(editor):
    import json
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Ladegrid PKW öffnen", exact=True).click()
    choose_field(page, "layout", "modular")
    for key, value in (("chargingPV", "10"), ("chargingBattery", "20")):
        field = page.locator(f'input[data-field-key="{key}"]')
        playwright.expect(field).to_be_attached()
        for summary in field.locator("xpath=ancestor::details[not(@open)]/summary").all():
            summary.click()
        field.fill(value)
    page.locator(".wb-position-editor > summary").click()
    choose_card(named_cards(page, "PV / Speicher angeschlossen am"), "grid-1")
    with page.expect_download() as pending:
        page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True).click()
    document = json.loads(pending.value.path().read_text())
    model = document["result"]["chargingNetwork"]
    assert model["sourceKW"] == pytest.approx(9)
    assert model["netHouseACKW"] == pytest.approx(model["grossHouseACKW"] - 9)
    assert model["grids"][0]["netInputKW"] == pytest.approx(model["grids"][0]["acInputKW"] - 9)
    assert model["deliveredEnergyKWh"] == pytest.approx(model["assignedKW"] * 10)
    assert page.locator('input[data-field-key="chargingSourceConnection"]').count() == 0
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="Ladegrid E-LKW öffnen", exact=True).click()
    choose_field(page, "depotAllocation", "reference")
    choose_field(page, "feed", "100")
    reserve = page.locator('input[data-field-key="reserve"]')
    for summary in reserve.locator("xpath=ancestor::details[not(@open)]/summary").all():
        summary.click()
    reserve.fill("50")
    with page.expect_download() as pending:
        page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True).click()
    model = json.loads(pending.value.path().read_text())["result"]["depotNetwork"]
    assert model["activeCount"] == 0
    assert model["waitingCount"] == 6
    assert model["assignedDC"] == 0
    playwright.expect(page.locator('[data-testid="mixed-charging-point"][data-state="waiting"]')).to_have_count(2)
