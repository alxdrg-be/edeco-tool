"""The selectively ported branch workflows against real local PDF APIs."""
import hashlib
from io import BytesIO
import os
from pathlib import Path
import re
import zipfile

from PIL import Image
from pypdf import PdfReader

from test_documents import sample_pdf
from test_pdf_entry_ui import drop_files, pdf_entry, playwright  # noqa: F401
from test_phase3 import env  # noqa: F401


def artifact_file(tmp_path, name):
    folder = Path(os.environ.get("EDECO_PDF_NATIVE_ARTIFACTS", str(tmp_path / "pdf-native")))
    folder.mkdir(parents=True, exist_ok=True)
    return str(folder / name)


def download_result(page, tmp_path):
    with page.expect_download() as event:
        page.get_by_role("link", name="Ergebnis herunterladen", exact=True).click()
    target = tmp_path / event.value.suggested_filename
    event.value.save_as(target)
    return target


def test_document_rows_move_rotate_and_export_real_pages_without_core(pdf_entry, tmp_path):
    page = pdf_entry
    first = sample_pdf([["ALPHA ONE"], ["ALPHA TWO"]])
    second = sample_pdf([["BETA ONE"]])
    digest = hashlib.sha256(first).hexdigest()
    drop_files(page, [("Alpha.pdf", "application/pdf", first), ("Beta.pdf", "application/pdf", second)])
    page.locator('[data-pdf-tool="multiTool"]').click()
    rows = page.locator(".pdf-document-row")
    playwright.expect(rows).to_have_count(2)
    playwright.expect(rows.nth(0).locator(".pdf-page-card")).to_have_count(2)
    rows.nth(0).locator(".pdf-page-card").nth(1).click()
    page.get_by_role("button", name="↻ Drehen", exact=True).click()
    page.get_by_label("Zielreihe", exact=True).select_option(label="Beta.pdf")
    page.get_by_role("button", name="Auswahl verschieben", exact=True).click()
    playwright.expect(rows.nth(0).locator(".pdf-page-card")).to_have_count(1)
    playwright.expect(rows.nth(1).locator(".pdf-page-card")).to_have_count(2)
    page.get_by_role("button", name="↓ PDF erstellen", exact=True).click()
    playwright.expect(page.get_by_role("status").filter(has_text="PDF erstellt")).to_be_visible()
    with page.expect_download() as event:
        page.get_by_role("link", name="PDF herunterladen", exact=True).click()
    target = tmp_path / "rows.pdf"
    event.value.save_as(target)
    result = PdfReader(target)
    assert [p.extract_text().strip() for p in result.pages] == ["ALPHA ONE", "BETA ONE", "ALPHA TWO"]
    assert [p.rotation for p in result.pages] == [0, 0, 90]
    assert hashlib.sha256(first).hexdigest() == digest
    # The documentwise editing remains present when visiting the tool catalog.
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="crop"]').click()
    playwright.expect(page.locator(".pdf-crop-editor")).to_be_visible()
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="multiTool"]').click()
    playwright.expect(rows.nth(1).locator(".pdf-page-card")).to_have_count(2)
    page.locator(".pdf-output-panel").evaluate("node => { node.scrollTop = 0; }")
    page.screenshot(path=artifact_file(tmp_path, "01-document-rows.png"))
    # The native workspace joins the existing unsaved-result leave guard.
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    playwright.expect(page.get_by_role("alertdialog", name="Ergebnisse gespeichert?", exact=True)).to_be_visible()
    page.get_by_role("button", name="Hier bleiben", exact=True).click()
    playwright.expect(rows.nth(1).locator(".pdf-page-card")).to_have_count(2)
    page.get_by_role("button", name="Werkzeuge", exact=True).click()
    page.get_by_role("button", name="Dateien umbenennen", exact=True).click()
    playwright.expect(page.get_by_role("alertdialog", name="Ergebnisse gespeichert?", exact=True)).to_be_visible()
    page.get_by_role("button", name="Hier bleiben", exact=True).click()
    playwright.expect(rows.nth(1).locator(".pdf-page-card")).to_have_count(2)


def test_visual_split_gaps_export_the_expected_page_groups(pdf_entry, tmp_path):
    page = pdf_entry
    page.locator('[data-pdf-tool="split"]').click()
    page.get_by_label("PDF hinzufügen", exact=True).set_input_files({
        "name": "Three.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["FIRST"], ["SECOND"], ["THIRD"]]),
    })
    playwright.expect(page.get_by_role("button", name="Nach Seite 1 trennen", exact=True)).to_be_visible()
    page.get_by_role("button", name="Alle zusammenlassen", exact=True).click()
    page.get_by_role("button", name="Nach Seite 1 trennen", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Nach Seite 1 trennen", exact=True)).to_have_attribute("aria-pressed", "true")
    playwright.expect(page.get_by_role("button", name="Nach Seite 2 trennen", exact=True)).to_have_attribute("aria-pressed", "false")
    page.get_by_role("button", name="Ergebnis erstellen", exact=True).click()
    playwright.expect(page.get_by_role("link", name="Ergebnis herunterladen", exact=True)).to_be_visible()
    target = download_result(page, tmp_path)
    with zipfile.ZipFile(target) as archive:
        assert len(archive.namelist()) == 2
        contents = [[p.extract_text().strip() for p in PdfReader(BytesIO(archive.read(name))).pages] for name in archive.namelist()]
    assert contents == [["FIRST"], ["SECOND", "THIRD"]]
    page.screenshot(path=artifact_file(tmp_path, "02-visual-split.png"))


def test_native_png_dpi_and_independent_content_resize_from_catalog(pdf_entry, tmp_path):
    page = pdf_entry
    page.locator('[data-pdf-tool="convert"]').click()
    page.get_by_role("button", name=re.compile("PDF in PNG")).click()
    source = sample_pdf([["NATIVE VECTOR CONTENT"]])
    page.get_by_label("PDF hinzufügen", exact=True).set_input_files({"name": "Vector.pdf", "mimeType": "application/pdf", "buffer": source})
    playwright.expect(page.get_by_role("img", name="Vorschau Seite 1", exact=True)).to_be_visible()
    canvas = page.get_by_label("PDF-Vorschau mit Dokumentzoom", exact=True)
    image = page.get_by_role("img", name="Vorschau Seite 1", exact=True)
    assert image.bounding_box()["height"] > 400
    width = page.locator(".tool-header").bounding_box()["width"]
    canvas.focus()
    page.keyboard.press("Control++")
    page.wait_for_function("() => Number(document.querySelector('[data-document-zoom]').dataset.documentZoom) > 1")
    assert page.locator(".tool-header").bounding_box()["width"] == width
    page.keyboard.press("Control+0")
    playwright.expect(canvas).to_have_attribute("data-document-zoom", "1")
    page.get_by_label("Bildauflösung", exact=True).select_option("300")
    page.get_by_role("button", name="Ergebnis erstellen", exact=True).click()
    playwright.expect(page.get_by_role("link", name="Ergebnis herunterladen", exact=True)).to_be_visible()
    target = download_result(page, tmp_path)
    with Image.open(target) as image:
        assert image.format == "PNG"
        assert image.width in (2479, 2480) and image.height in (3508, 3509)
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="scalePages"]').click()
    playwright.expect(page.get_by_role("img", name="Vorschau Seite 1", exact=True)).to_be_visible()
    page.get_by_label("Papierformat", exact=True).select_option("A5")
    playwright.expect(page.get_by_label("Inhalt skalieren (%)", exact=True)).to_have_value("100")
    page.get_by_role("button", name="Ergebnis erstellen", exact=True).click()
    playwright.expect(page.get_by_role("link", name="Ergebnis herunterladen", exact=True)).to_be_visible()
    resized = download_result(page, tmp_path)
    output = PdfReader(resized)
    assert "NATIVE VECTOR CONTENT" in output.pages[0].extract_text()
    assert float(output.pages[0].mediabox.width) < 421
    assert float(output.pages[0].mediabox.height) < 596
    page.screenshot(path=artifact_file(tmp_path, "03-native-resize.png"))
    # Switching tasks keeps each input, output and settings; it does not replace
    # the previous task with an empty remounted editor.
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="convert"]').click()
    page.get_by_role("button", name=re.compile("PDF in PNG")).click()
    playwright.expect(page.get_by_label("Bildauflösung", exact=True)).to_have_value("300")
    playwright.expect(page.get_by_role("link", name="Ergebnis herunterladen", exact=True)).to_be_visible()
    old_blob = page.get_by_role("link", name="Ergebnis herunterladen", exact=True).get_attribute("href")
    page.get_by_label("Bildauflösung", exact=True).select_option("144")
    playwright.expect(page.get_by_role("link", name="Ergebnis herunterladen", exact=True)).to_have_count(0)
    assert page.evaluate("url => fetch(url).then(() => false, () => true)", old_blob)
