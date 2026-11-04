"""Local-Qwen setup and source navigation through the real backend, not CORS."""

from __future__ import annotations

import os
import socket
import threading
import time
from pathlib import Path

import pytest
import uvicorn

from edeco_toolbox.app import create_app
from edeco_toolbox.documents.api import PREFIX
from test_documents import local_ollama, sample_pdf  # noqa: F401
from test_editor_navigation import launch_chromium, playwright
from test_phase3 import env  # noqa: F401


@pytest.fixture
def documents_browser(env):
    client, _ = env
    ui = Path(os.environ.get("DOCUMENTS_TEST_UI_DIR", Path(__file__).resolve().parents[2] / "ui" / "dist"))
    if not (ui / "index.html").is_file():
        pytest.skip("Build the UI before the document-browser tests")
    app = create_app(client.app.state.nova, ui_dir=ui)
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise RuntimeError("Document test API did not start")
        time.sleep(0.02)
    try:
        with playwright.sync_playwright() as pw:
            browser = launch_chromium(pw)
            page = browser.new_page(viewport={"width": 1500, "height": 1100})
            page.emulate_media(reduced_motion="reduce")
            errors = []
            requests = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("request", lambda request: requests.append(request.url))
            page.goto(f"http://127.0.0.1:{port}", wait_until="domcontentloaded")
            page.get_by_role("button", name="Dokumenten-Assistent öffnen", exact=True).click()
            playwright.expect(page.get_by_role("heading", name="Deine Dokumente")).to_be_visible()
            state = page.request.get(f"http://127.0.0.1:{port}{PREFIX}/state").json()
            yield page, app, f"http://127.0.0.1:{port}{PREFIX}", {"X-Edeco-Documents": state["session_key"]}, requests
            assert not errors
            browser.close()
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()


def capture(page, filename):
    directory = os.environ.get("DOCUMENTS_REVIEW_DIR")
    if directory:
        path = Path(directory)
        path.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(path / filename), full_page=True)


def test_qwen_guide_and_local_preview_preserve_company_connection_until_saved(documents_browser, local_ollama):
    page, app, api, headers, _ = documents_browser
    company = {"provider": "ollama", "endpoint": "http://ki-server:11434/api/chat", "model": "company-model", "api_key": "company-secret"}
    assert page.request.post(api + "/settings", headers=headers, data=company).ok
    before = app.state.document_ai.path.read_bytes()
    page.reload()
    guide = page.locator(".doc-conversation .doc-qwen-guide")
    playwright.expect(guide).not_to_have_attribute("open", "")
    guide.locator(":scope > summary").click()
    assert guide.locator("ol > li").count() == 6
    playwright.expect(guide).to_contain_text("ollama pull qwen3:4b")
    playwright.expect(guide).to_contain_text("Fundstellen suchen")
    capture(page, "05-dokumente-qwen-anleitung.png")
    guide.get_by_role("button", name="KI-Verbindung öffnen", exact=True).click()
    dialog = page.get_by_role("dialog", name="KI-Verbindung einrichten")
    playwright.expect(dialog.get_by_label("KI-Serveradresse", exact=True)).to_have_value(company["endpoint"])
    setup = dialog.locator(".doc-qwen-guide")
    setup.locator(":scope > summary").click()
    setup.get_by_role("button", name="Lokale Angaben ins Formular einsetzen", exact=True).click()
    playwright.expect(dialog.get_by_label("KI-Serveradresse", exact=True)).to_have_value("http://127.0.0.1:11434/api/chat")
    playwright.expect(dialog.get_by_label("KI-Serveradresse", exact=True)).to_be_focused()
    playwright.expect(dialog.get_by_label("Modell oder Bereitstellungsname", exact=True)).to_have_value("qwen3:4b")
    assert app.state.document_ai.path.read_bytes() == before
    dialog.get_by_role("button", name="Schliessen", exact=True).click()
    page.get_by_role("button", name="KI-Verbindung", exact=True).click()
    playwright.expect(dialog.get_by_label("KI-Serveradresse", exact=True)).to_have_value(company["endpoint"])
    endpoint, calls = local_ollama
    dialog.get_by_label("KI-Serveradresse", exact=True).fill(endpoint)
    dialog.get_by_label("Modell oder Bereitstellungsname", exact=True).fill("qwen3:4b")
    dialog.get_by_role("button", name="Verbindung prüfen", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_contain_text("noch nicht gespeichert")
    assert app.state.document_ai.path.read_bytes() == before
    assert app.state.document_ai.key == "company-secret"
    assert calls[-1]["path"] == "/api/tags" and "Authorization" not in calls[-1]["headers"]
    dialog.get_by_label("Modell oder Bereitstellungsname", exact=True).fill("not-installed")
    dialog.get_by_role("button", name="Speichern und Verbindung prüfen", exact=True).click()
    playwright.expect(dialog.get_by_role("alert")).to_contain_text("Modell fehlt")
    assert app.state.document_ai.path.read_bytes() == before
    dialog.get_by_label("Modell oder Bereitstellungsname", exact=True).fill("qwen3:4b")
    dialog.get_by_role("button", name="Speichern und Verbindung prüfen", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_contain_text("Verbindung gespeichert")
    assert app.state.document_ai.public()["endpoint"] == endpoint and app.state.document_ai.key == ""
    page.set_viewport_size({"width": 390, "height": 844})
    setup.locator(":scope > summary").click()
    assert dialog.evaluate("el => el.scrollWidth <= el.clientWidth + 1")
    capture(page, "05-dokumente-qwen-einrichtung-390px.png")


def test_local_qwen_returns_real_pdf_citation_through_backend_only(documents_browser, local_ollama):
    page, _, api, headers, requests = documents_browser
    endpoint, calls = local_ollama
    assert page.request.post(api + "/settings", headers=headers, data={
        "provider": "ollama", "endpoint": endpoint, "model": "qwen3:4b"}).ok
    page.reload()
    page.get_by_label("Dokumentstand für neue Dateien").fill("Testausgabe 2025")
    page.get_by_label("Dokumente hinzufügen", exact=True).set_input_files({
        "name": "Test-Richtlinie.pdf", "mimeType": "application/pdf", "buffer": sample_pdf()})
    playwright.expect(page.locator(".doc-document")).to_have_count(1)
    page.get_by_label("Deine Frage", exact=True).fill("Was ist am Schutzleiter zu prüfen?")
    page.get_by_role("button", name="KI-Antwort", exact=True).click()
    playwright.expect(page.locator(".doc-answer-block")).to_contain_text("vor Inbetriebnahme")
    page.locator(".doc-citations button").click()
    playwright.expect(page.get_by_alt_text("Test-Richtlinie, Originalseite 2")).to_be_visible()
    playwright.expect(page.locator(".doc-source-highlight").first).to_be_visible()
    playwright.expect(page.locator(".doc-page-title")).to_contain_text("Testausgabe 2025")
    assert calls[-1]["path"] == "/api/chat"
    assert not any(url.startswith(endpoint.removesuffix("/api/chat")) for url in requests)
    capture(page, "06-dokumente-lokale-ki-fundstelle.png")
