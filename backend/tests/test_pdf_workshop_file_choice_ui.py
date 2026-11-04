"""Choose a document when changing tools, keeping other editable work intact."""
from io import BytesIO
import os
from pathlib import Path
import zipfile

from pypdf import PdfReader

from test_documents import sample_pdf
from test_editor_navigation import playwright
from test_pdf_entry_ui import drop_files, pdf_entry  # noqa: F401
from test_phase3 import env  # noqa: F401


def test_split_chooses_a_source_and_downloads_without_losing_page_edits(pdf_entry, tmp_path):
    page = pdf_entry
    drop_files(page, [("Alpha.pdf", "application/pdf", sample_pdf([["ALPHA ONLY"]]))])
    drop_files(page, [("Beta.pdf", "application/pdf", sample_pdf([["BETA FIRST"], ["BETA SECOND"], ["BETA THIRD"]]))])
    playwright.expect(page.locator(".pdf-pending-files li")).to_have_count(2)
    page.locator('[data-pdf-tool="multiTool"]').click()
    rows = page.locator(".pdf-document-row")
    playwright.expect(rows).to_have_count(2)
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="split"]').click()
    choice = page.get_by_role("dialog", name="Welches PDF möchtest du teilen?", exact=True)
    playwright.expect(choice).to_be_visible()
    choice.get_by_role("button", name="Beta.pdf", exact=False).click()
    active = page.locator('.pdf-native-workspace:not([hidden])')
    playwright.expect(active.get_by_role("heading", name="PDF teilen", exact=True)).to_be_visible()
    playwright.expect(active.locator(".pdf-mini-page")).to_have_count(3)
    active.get_by_role("button", name="Alle zusammenlassen", exact=True).click()
    active.get_by_role("button", name="Nach Seite 1 trennen", exact=True).click()
    with page.expect_download() as saved:
        active.get_by_role("button", name="Teilen & herunterladen", exact=True).click()
    target = tmp_path / saved.value.suggested_filename
    saved.value.save_as(target)
    with zipfile.ZipFile(target) as archive:
        outputs = [PdfReader(BytesIO(archive.read(name))) for name in sorted(archive.namelist()) if name.endswith(".pdf")]
        assert [[sheet.extract_text().strip() for sheet in output.pages] for output in outputs] == [["BETA FIRST"], ["BETA SECOND", "BETA THIRD"]]
    old_result = active.get_by_role("link", name="Erneut herunterladen", exact=True).get_attribute("href")
    active.get_by_label("PDF hinzufügen", exact=True).set_input_files({"name": "Kaputt.pdf", "mimeType": "application/pdf", "buffer": b"not a PDF"})
    playwright.expect(active.get_by_role("alert")).to_be_visible()
    playwright.expect(active.locator(".pdf-mini-page")).to_have_count(3)
    playwright.expect(active.get_by_role("link", name="Erneut herunterladen", exact=True)).to_have_attribute("href", old_result)
    failed_route = "**/api/tools/pdf-werkstatt/process/split"
    page.route(failed_route, lambda route: route.fulfill(status=503, content_type="application/json", body='{"detail":"Vorübergehend nicht erreichbar"}'))
    active.get_by_role("button", name="Teilen & herunterladen", exact=True).click()
    playwright.expect(active.get_by_role("alert")).to_contain_text("Vorübergehend nicht erreichbar")
    playwright.expect(active.get_by_role("link", name="Erneut herunterladen", exact=True)).to_have_attribute("href", old_result)
    page.unroute(failed_route)
    active.get_by_role("button", name="Dokument schliessen", exact=True).click()
    playwright.expect(active.get_by_role("heading", name="PDF hier ablegen", exact=True)).to_be_visible()
    playwright.expect(active.get_by_role("link", name="Erneut herunterladen", exact=True)).to_have_count(0)
    assert page.evaluate("url => fetch(url).then(() => false).catch(() => true)", old_result)
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="multiTool"]').click()
    playwright.expect(rows).to_have_count(2)
    playwright.expect(rows.nth(0).locator(".pdf-page-card")).to_have_count(1)
    playwright.expect(rows.nth(1).locator(".pdf-page-card")).to_have_count(3)
    # Escape cancels choosing a source without silently consuming either document.
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="scalePages"]').click()
    playwright.expect(page.get_by_role("dialog", name="Welches PDF möchtest du bearbeiten?", exact=True)).to_be_visible()
    artifact = Path(os.environ.get("EDECO_PDF_FLOW_ARTIFACTS", str(tmp_path)))
    artifact.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(artifact / "single-file-tool-choice.png"))
    page.keyboard.press("Escape")
    playwright.expect(page.get_by_role("dialog")).to_have_count(0)
    playwright.expect(page.get_by_role("heading", name="Seitengrösse ändern", exact=True)).to_be_visible()
