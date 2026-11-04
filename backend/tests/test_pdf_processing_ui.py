"""Native OCR/compression flows; real Core can replace the HTTP test transport.

Set EDECO_TEST_STIRLING_URL to exercise actual OCR/qpdf. Otherwise only the
engine transport is synthetic; the UI, PDF inspection, counters and search are real.
"""
from contextlib import closing
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import os
from pathlib import Path
import re
import threading

from PIL import Image, ImageDraw, ImageFont
import pypdfium2 as pdfium
from pypdf import PdfReader, PdfWriter
import pytest

from test_documents import sample_pdf
from test_pdf_entry_ui import pdf_entry, playwright  # noqa: F401
from test_phase3 import env  # noqa: F401


@pytest.fixture(autouse=True)
def processing_engine(monkeypatch):
    actual = os.environ.get("EDECO_TEST_STIRLING_URL")
    if os.environ.get("EDECO_PDF_PROCESSING_LOCAL_UI"):
        from edeco_toolbox.pdf_workshop import api
        from edeco_toolbox.pdf_workshop.client import StirlingClient

        class LocalUiTransport:
            """Exercise offline UI/CSP with the real test endpoint, not an EXE."""
            secret = ""

            @property
            def url(self):
                return os.environ["EDECO_STIRLING_URL"]

            def start(self):
                pass

            def close(self):
                pass

            def health(self):
                return StirlingClient(self.url).health()

        monkeypatch.setenv("EDECO_PDF_RUNTIME", "1")
        monkeypatch.setattr(api, "PdfRuntime", LocalUiTransport)
    if actual:
        monkeypatch.setenv("EDECO_STIRLING_URL", actual)
        yield
        return

    class EngineTransport(BaseHTTPRequestHandler):
        growth_calls = 0
        def log_message(self, *_args):
            pass

        def do_GET(self):
            if self.path.endswith("/api/v1/info/status"):
                payload, kind = json.dumps({"status": "UP", "version": "UI-test-transport"}).encode(), "application/json"
            elif "endpoints-availability" in self.path:
                payload, kind = b"{}", "application/json"
            else:
                payload, kind = b"<!doctype html><html><body>Test engine transport</body></html>", "text/html"
            self.send_response(200); self.send_header("Content-Type", kind); self.end_headers(); self.wfile.write(payload)

        def do_POST(self):
            body = self.rfile.read(int(self.headers["Content-Length"]))
            message = BytesParser(policy=default).parsebytes(b"Content-Type: " + self.headers["Content-Type"].encode() + b"\r\nMIME-Version: 1.0\r\n\r\n" + body)
            source = next(part.get_payload(decode=True) for part in message.iter_parts() if part.get_param("name", header="Content-Disposition") == "fileInput")
            if self.path.endswith("ocr-pdf"):
                result = sample_pdf([["Protective conductor inspection complete", "Pruefbericht elektrische Anlagen"]])
            else:
                writer = PdfWriter(); writer.append_pages_from_reader(PdfReader(io.BytesIO(source)))
                output = io.BytesIO(); writer.write(output); result = output.getvalue()
                if b"GROWCASE" in source:
                    type(self).growth_calls += 1
                    if type(self).growth_calls > 1:
                        self.send_response(503); self.end_headers(); return
                    result += b"\n" * 40000
            self.send_response(200); self.send_header("Content-Type", "application/pdf"); self.end_headers(); self.wfile.write(result)

    server = ThreadingHTTPServer(("127.0.0.1", 0), EngineTransport)
    thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
    monkeypatch.setenv("EDECO_STIRLING_URL", f"http://127.0.0.1:{server.server_port}")
    try:
        yield
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=5)


def screenshot(page, tmp_path, name):
    folder = Path(os.environ.get("EDECO_PDF_PROCESSING_ARTIFACTS", str(tmp_path / "processing-review")))
    folder.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(folder / name), full_page=True, animations="disabled")


def scanned_report():
    font_path = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts/arial.ttf" if os.name == "nt" else Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    image = Image.new("RGB", (1600, 2200), "white")
    drawing = ImageDraw.Draw(image)
    font = ImageFont.truetype(str(font_path), 43)
    for index, line in enumerate(("ELEKTROPLANUNG", "Protective conductor inspection complete", "Pruefbericht elektrische Anlagen", "Projekt 1383 - Beispielpruefung", "Datum: 04.11.2026")):
        drawing.text((100, 180 + index * 100), line, font=font, fill="black")
    drawing.line((100, 740, 1500, 740), fill="#188292", width=8)
    output = io.BytesIO(); image.save(output, format="PDF", resolution=200); image.close()
    return output.getvalue()


def test_ocr_independent_options_real_word_count_search_download_and_close(pdf_entry, tmp_path):
    page = pdf_entry
    page.locator('[data-pdf-tool="ocr"]').click()
    source = scanned_report()
    page.get_by_label("PDF für Texterkennung oder Komprimierung öffnen", exact=True).set_input_files({"name": "Pruefbericht-Scan.pdf", "mimeType": "application/pdf", "buffer": source})
    playwright.expect(page.get_by_role("img", name="PDF-Seite 1 von Pruefbericht-Scan.pdf", exact=True)).to_be_visible()
    assert page.locator(".pdf-processing-workspace").bounding_box()["width"] >= page.viewport_size["width"] * .95
    advanced = page.locator(".pdf-processing-options").filter(has=page.locator("summary", has_text="Erweitert"))
    advanced.locator("summary").click()
    playwright.expect(advanced).to_have_attribute("open", "")
    playwright.expect(page.locator(".pdf-processing-options").filter(has=page.locator("summary", has_text="Einstellungen"))).to_have_attribute("open", "")
    page.get_by_label("Im PDF suchen", exact=True).fill("conductor")
    playwright.expect(page.get_by_text("Keine Treffer in der Textschicht.", exact=False)).to_be_visible()
    with page.expect_download(timeout=120000) as event:
        page.get_by_role("button", name="Erkennen & herunterladen", exact=True).click()
    output = tmp_path / event.value.suggested_filename; event.value.save_as(output)
    with pdfium.PdfDocument(output) as document, closing(document[0]) as sheet, closing(sheet.get_textpage()) as text:
        assert "conductor" in text.get_text_range().lower()
        assert len(document) == 1
    result = page.get_by_role("region", name="PDF-Ergebnis", exact=True)
    playwright.expect(result).to_contain_text("Wörter in der Textschicht")
    playwright.expect(result).to_contain_text("Durchsuchbare Seiten")
    playwright.expect(page.get_by_role("link", name="Erneut herunterladen", exact=True)).to_be_visible()
    playwright.expect(page.locator(".pdf-processing-matches rect.is-current")).to_have_count(1)
    assert page.locator(".pdf-processing-matches rect.is-current").evaluate("node => Number.parseFloat(getComputedStyle(node).fillOpacity)") >= .5
    page.screenshot(path=str(tmp_path / "ocr.png"))
    screenshot(page, tmp_path, "01-ocr-result-and-search.png")
    page.get_by_role("button", name="Dunkler Modus", exact=True).click()
    playwright.expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    screenshot(page, tmp_path, "01-ocr-result-and-search-dark.png")
    page.get_by_role("button", name="Heller Modus", exact=True).click()
    page.get_by_role("button", name="PDF schliessen", exact=True).click()
    playwright.expect(page.get_by_role("region", name="PDF-Ergebnis", exact=True)).to_have_count(0)
    playwright.expect(page.get_by_label("Im PDF suchen", exact=True)).to_have_count(0)
    playwright.expect(page.get_by_text("Öffne ein PDF, um die Einstellungen zu verwenden.", exact=True)).to_be_visible()
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Ein Ort. Deine Werkzeuge.", exact=True)).to_be_visible()


def test_pdf_search_changes_page_and_document_zoom_not_application(pdf_entry, tmp_path):
    page = pdf_entry
    page.locator('[data-pdf-tool="ocr"]').click()
    page.get_by_label("PDF für Texterkennung oder Komprimierung öffnen", exact=True).set_input_files({"name": "Zwei-Seiten.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["Alpha conductor"], ["Beta CONDUCTOR"]])})
    page.get_by_label("Im PDF suchen", exact=True).fill("conductor")
    playwright.expect(page.locator(".pdf-processing-search [role=status]")).to_have_text("1 / 2")
    page.get_by_role("button", name="Nächster Suchtreffer", exact=True).click()
    playwright.expect(page.get_by_role("img", name="PDF-Seite 2 von Zwei-Seiten.pdf", exact=True)).to_be_visible()
    width = page.locator(".tool-header").bounding_box()["width"]
    viewport = page.get_by_label("PDF mit Dokumentzoom und Suchtreffern", exact=True)
    viewport.focus(); page.keyboard.press("Control++")
    playwright.expect(viewport).not_to_have_attribute("data-document-zoom", "1")
    assert page.locator(".tool-header").bounding_box()["width"] == width
    page.keyboard.press("Control+f")
    playwright.expect(page.get_by_label("Im PDF suchen", exact=True)).to_be_focused()
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".pdf-processing-workspace").evaluate("node => node.scrollWidth <= node.clientWidth")
    screenshot(page, tmp_path, "02-ocr-mobile-search.png")


def test_compression_shows_actual_size_change_and_downloads_immediately(pdf_entry, tmp_path):
    page = pdf_entry
    page.locator('[data-pdf-tool="compress"]').click()
    source = sample_pdf([["Compression keeps this original text"]]) + b"\n" * 30000
    page.get_by_label("PDF für Texterkennung oder Komprimierung öffnen", exact=True).set_input_files({"name": "Plan.pdf", "mimeType": "application/pdf", "buffer": source})
    playwright.expect(page.get_by_role("img", name="PDF-Seite 1 von Plan.pdf", exact=True)).to_be_visible()
    with page.expect_download(timeout=120000) as event:
        page.get_by_role("button", name="Komprimieren & herunterladen", exact=True).click()
    output = tmp_path / event.value.suggested_filename; event.value.save_as(output)
    assert output.stat().st_size < len(source)
    with pdfium.PdfDocument(output) as document, closing(document[0]) as sheet, closing(sheet.get_textpage()) as text:
        assert "original text" in text.get_text_range()
    result = page.get_by_role("region", name="PDF-Ergebnis", exact=True)
    playwright.expect(result).to_contain_text("Vorher")
    playwright.expect(result).to_contain_text("Nachher")
    playwright.expect(result).to_contain_text("Gespart")
    playwright.expect(result.locator(".is-saving dd")).to_contain_text("%")
    screenshot(page, tmp_path, "03-compression-size-result.png")


@pytest.mark.skipif(bool(os.environ.get("EDECO_TEST_STIRLING_URL")), reason="Deterministic growth/failure is a test-engine transport case")
def test_larger_result_and_failed_rerun_do_not_claim_savings_or_lose_download(pdf_entry, tmp_path):
    page = pdf_entry
    page.locator('[data-pdf-tool="compress"]').click()
    source = sample_pdf([["GROWCASE valid original text"]])
    picker = page.get_by_label("PDF für Texterkennung oder Komprimierung öffnen", exact=True)
    picker.set_input_files({"name": "Small.pdf", "mimeType": "application/pdf", "buffer": source})
    playwright.expect(page.get_by_role("img", name="PDF-Seite 1 von Small.pdf", exact=True)).to_be_visible()
    with page.expect_download() as event:
        page.get_by_role("button", name="Komprimieren & herunterladen", exact=True).click()
    output = tmp_path / event.value.suggested_filename; event.value.save_as(output)
    assert output.stat().st_size > len(source)
    result = page.get_by_role("region", name="PDF-Ergebnis", exact=True)
    playwright.expect(result).to_contain_text("Grösser geworden")
    playwright.expect(result).not_to_contain_text("Gespart")
    link = page.get_by_role("link", name="Erneut herunterladen", exact=True)
    saved = link.get_attribute("href")
    page.get_by_role("button", name="Komprimieren & herunterladen", exact=True).click()
    playwright.expect(page.get_by_role("alert")).to_contain_text("Verarbeitung nicht abschliessen")
    playwright.expect(link).to_have_attribute("href", saved)
    assert page.evaluate("url => fetch(url).then(response => response.ok)", saved)
    picker.set_input_files({"name": "Invalid.pdf", "mimeType": "application/pdf", "buffer": b"not a PDF"})
    playwright.expect(page.get_by_role("alert")).to_contain_text("gültige PDF")
    playwright.expect(link).to_have_attribute("href", saved)


@pytest.mark.skipif(not os.environ.get("EDECO_TEST_STIRLING_URL"), reason="Real Core is required for its extended UI controls")
def test_live_core_search_label_close_contrast_and_text_selection(pdf_entry):
    page = pdf_entry
    page.get_by_role("button", name="Alle Funktionen", exact=True).click()
    frame = page.frame_locator("iframe[title='Stirling-PDF · edeco PDF-Werkstatt']")
    search = frame.locator("#super-search-input")
    playwright.expect(search).to_have_attribute("aria-label", "PDF-Werkzeuge suchen", timeout=30000)
    playwright.expect(search).to_have_attribute("placeholder", "PDF-Werkzeuge suchen …")
    frame.locator("input[type=file]").first.set_input_files({"name": "Core-Contrast.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["Selection contrast test"]])})
    close = frame.get_by_role("button", name="PDF schließen", exact=True)
    playwright.expect(close).to_be_visible()
    playwright.expect(close).to_have_class(re.compile("edeco-close-control"))
    assert close.evaluate("node => parseFloat(getComputedStyle(node).minWidth)") >= 34, close.evaluate("""node => [...document.styleSheets].flatMap(sheet=>{
      try{return [...sheet.cssRules].filter(rule=>rule.selectorText&&rule.style.minWidth&&node.matches(rule.selectorText)).map(rule=>({selector:rule.selectorText,width:rule.style.minWidth,priority:rule.style.getPropertyPriority('min-width')}));}catch{return[];}
    })""")
    assert close.evaluate("node => getComputedStyle(node).borderTopStyle") == "solid"
    assert close.bounding_box()["width"] >= 34 and close.bounding_box()["height"] >= 34
    selection = frame.locator("body").evaluate("node => getComputedStyle(node, '::selection').backgroundColor")
    assert selection == "rgba(232, 80, 121, 0.52)"


def test_processing_preview_keeps_visible_form_widgets(pdf_entry):
    from test_pdf_marks import form_pdf

    page = pdf_entry
    page.locator('[data-pdf-tool="ocr"]').click()
    page.get_by_label("PDF für Texterkennung oder Komprimierung öffnen", exact=True).set_input_files({"name": "Formular.pdf", "mimeType": "application/pdf", "buffer": form_pdf(90)})
    image = page.get_by_role("img", name="PDF-Seite 1 von Formular.pdf", exact=True)
    playwright.expect(image).to_be_visible()
    playwright.expect(image).to_have_js_property("complete", True)
    assert image.evaluate("""async node => {
      await node.decode(); const canvas=document.createElement('canvas'); canvas.width=node.naturalWidth; canvas.height=node.naturalHeight;
      const ctx=canvas.getContext('2d'); ctx.drawImage(node,0,0); const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let red=0; for(let i=0;i<data.length;i+=4) if(data[i]>180&&data[i+1]<90&&data[i+2]<90) red++; return red;
    }""") > 300
