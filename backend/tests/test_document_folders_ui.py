"""Explicit folder connection, index updates and compact setup help in the real UI."""
from __future__ import annotations

import os
from pathlib import Path

from nova_legend import dialogs
from test_documents_local_ui import documents_browser  # noqa: F401
from test_editor_navigation import playwright
from test_phase3 import env  # noqa: F401


def capture(page, filename):
    if directory := os.environ.get("DOCUMENTS_FOLDER_REVIEW_DIR"):
        target = Path(directory)
        target.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(target / filename), full_page=True)


def test_folder_connect_sync_search_disconnect_and_help(documents_browser, tmp_path, monkeypatch):
    page, app, api, headers, requests = documents_browser
    monkeypatch.setattr(dialogs, "_window", None)
    source = tmp_path / "approved-documents"
    source.mkdir()
    file = source / "Pruefung.txt"
    file.write_text("Vor Inbetriebnahme ist der Schutzleiter zu pruefen.", encoding="utf-8")
    original = file.read_bytes()
    original_mtime = file.stat().st_mtime_ns
    ai_before = app.state.document_ai.public()
    trigger = page.get_by_role("button", name="Dokumentordner", exact=True)
    playwright.expect(trigger).to_be_enabled()
    trigger.click()
    dialog = page.get_by_role("dialog", name="Dokumentordner verbinden", exact=True)
    playwright.expect(dialog.get_by_label("Ordnerpfad", exact=True)).to_be_enabled()
    help_panel = dialog.locator(".doc-folder-guide")
    playwright.expect(help_panel).not_to_have_attribute("open", "")
    dialog.get_by_role("button", name="Auswählen", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_contain_text("vollständigen Ordnerpfad")
    dialog.get_by_label("Ordnerpfad", exact=True).fill(str(source))
    assert app.state.documents.list() == []
    assert not any(url.endswith("/folder/sync") for url in requests)
    dialog.get_by_role("button", name="Verbinden und einlesen", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_contain_text("1 neu/aktualisiert")
    assert file.read_bytes() == original and file.stat().st_mtime_ns == original_mtime
    assert len(app.state.documents.list()) == 1
    before = app.state.documents.list()[0]["id"]
    capture(page, "07-dokumentordner-kompakt.png")
    help_panel.locator("summary").click()
    playwright.expect(help_panel).to_contain_text("Windows-Leserechte")
    playwright.expect(help_panel).to_contain_text("Qwen")
    capture(page, "07-dokumentordner-verbunden.png")
    dialog.get_by_role("button", name="Schliessen", exact=True).click()
    playwright.expect(trigger).to_be_focused()
    playwright.expect(page.locator(".doc-document")).to_have_count(1)
    page.get_by_label("Deine Frage", exact=True).fill("Schutzleiter")
    page.get_by_role("button", name="Fundstellen suchen", exact=True).click()
    playwright.expect(page.locator(".doc-source")).to_contain_text("Vor Inbetriebnahme")
    file.write_text("Nach der Montage ist die Leitungsisolation zu pruefen.", encoding="utf-8")
    trigger.click()
    dialog.get_by_role("button", name="Jetzt aktualisieren", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_contain_text("1 alte lokale Kopien entfernt")
    assert app.state.documents.list()[0]["id"] != before
    assert len(app.state.documents.list()) == 1
    playwright.expect(page.locator(".doc-answer")).to_have_count(0)
    dialog.get_by_role("button", name="Verbindung trennen", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_contain_text("Dokumentkopien bleiben erhalten")
    assert page.request.get(api + "/folder", headers=headers).json()["path"] == ""
    assert len(app.state.documents.list()) == 1
    page.set_viewport_size({"width": 390, "height": 844})
    assert dialog.evaluate("el => el.scrollWidth <= el.clientWidth + 1")
    capture(page, "07-dokumentordner-390px.png")
    dialog.get_by_role("button", name="Schliessen", exact=True).click()
    assert app.state.document_ai.public() == ai_before

