"""Exercise the tool-first entry and real native file handoff without Java."""
from __future__ import annotations

import os
from contextlib import closing
from pathlib import Path
import socket
import threading
import time

import pytest
import uvicorn

from edeco_toolbox.app import create_app
from test_documents import sample_pdf
from test_editor_navigation import launch_chromium, playwright
from test_phase3 import env  # noqa: F401


@pytest.fixture()
def pdf_entry(env):
    client, _ = env
    default_ui = Path(__file__).resolve().parents[2] / "ui" / "dist"
    ui = Path(os.environ.get("EDECO_TEST_UI_DIR", default_ui))
    if not (ui / "index.html").is_file():
        pytest.skip("Build the UI before browser tests")
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    server = uvicorn.Server(uvicorn.Config(create_app(client.app.state.nova, ui_dir=ui), log_level="error"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise RuntimeError("PDF test API did not start")
        time.sleep(.02)
    try:
        with playwright.sync_playwright() as pw:
            browser = launch_chromium(pw)
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"http://127.0.0.1:{sock.getsockname()[1]}")
            page.get_by_role("button", name="PDF-Werkstatt öffnen", exact=True).click()
            playwright.expect(page.get_by_role("heading", name="Was möchtest du mit deinem PDF tun?", exact=True)).to_be_visible()
            yield page
            assert not errors
            browser.close()
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()


def drop_files(page, files, target=".pdf-tool-home"):
    transfer = page.evaluate_handle("""files => {
      const transfer = new DataTransfer();
      for (const file of files) transfer.items.add(new File([new Uint8Array(file.bytes)], file.name, {type:file.type}));
      return transfer;
    }""", [{"name": name, "type": kind, "bytes": list(data)} for name, kind, data in files])
    for event in ("dragenter", "dragover", "drop"):
        page.locator(target).dispatch_event(event, {"dataTransfer": transfer})


def test_catalog_drop_waits_for_tool_then_opens_large_native_crop(pdf_entry, tmp_path):
    import pypdfium2 as pdfium

    page = pdf_entry
    original = sample_pdf([["ORIGINAL VECTOR TEXT"]])
    start = page.url
    drop_files(page, [("Abgelegter Plan.pdf", "application/pdf", original)])
    playwright.expect(page.get_by_role("status").filter(has_text="Eine PDF ist bereit")).to_be_visible()
    playwright.expect(page.get_by_role("heading", name="Was möchtest du mit deinem PDF tun?", exact=True)).to_be_visible()
    assert page.url == start
    crop_tool = page.locator('[data-pdf-tool="crop"]')
    playwright.expect(crop_tool).to_have_attribute("aria-disabled", "false")
    crop_tool.click()
    preview = page.get_by_role("img", name="PDF-Seite 1 von Abgelegter Plan.pdf", exact=True)
    playwright.expect(preview).to_be_visible()
    assert preview.bounding_box()["height"] > 500
    playwright.expect(page.locator(".pdf-native-crop")).to_be_visible()
    page.get_by_label("Rand links (mm)", exact=True).fill("10")
    with page.expect_download() as saved:
        page.get_by_role("button", name="Zuschneiden & speichern", exact=True).click()
    output = tmp_path / saved.value.suggested_filename
    saved.value.save_as(output)
    with pdfium.PdfDocument(output) as document:
        assert len(document) == 1
        with closing(document[0]) as pdf_page, closing(pdf_page.get_textpage()) as text:
            assert "ORIGINAL VECTOR TEXT" in text.get_text_range()
            assert pdf_page.get_size()[0] < 595
    # A drop on the header must stay inside the application too.
    drop_files(page, [("Anderer Plan.pdf", "application/pdf", original)], ".pdf-workshop .tool-header")
    playwright.expect(page.get_by_role("img", name="PDF-Seite 1 von Anderer Plan.pdf", exact=True)).to_be_visible()
    assert page.url == start


def test_catalog_rejects_other_files_and_requires_one_pdf_for_native_crop(pdf_entry):
    page = pdf_entry
    drop_files(page, [("Datei.txt", "text/plain", b"Not a PDF")])
    playwright.expect(page.get_by_role("alert")).to_contain_text("Bitte PDF-Dateien ablegen")
    assert page.locator(".pdf-pending-files li").count() == 0
    original = sample_pdf([["VECTOR"]])
    drop_files(page, [("Erster Plan.pdf", "application/pdf", original), ("Zweiter Plan.pdf", "application/pdf", original)])
    playwright.expect(page.locator(".pdf-pending-files li")).to_have_count(2)
    crop_tool = page.locator('[data-pdf-tool="crop"]')
    playwright.expect(crop_tool).to_have_attribute("aria-disabled", "false")
    crop_tool.click()
    playwright.expect(page.get_by_role("alert")).to_contain_text("bitte eine PDF-Datei")
    playwright.expect(page.get_by_role("heading", name="Was möchtest du mit deinem PDF tun?", exact=True)).to_be_visible()
    page.get_by_role("button", name="Zweiter Plan.pdf aus der Auswahl entfernen", exact=True).click()
    crop_tool.click()
    playwright.expect(page.get_by_role("img", name="PDF-Seite 1 von Erster Plan.pdf", exact=True)).to_be_visible()
