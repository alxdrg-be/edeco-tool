"""An explicitly exported PDF is handed to Rename as a real File, once only."""
from io import BytesIO
import zipfile

from pypdf import PdfReader

from test_documents import sample_pdf
from test_editor_navigation import editor  # noqa: F401
from test_pdf_entry_ui import drop_files, pdf_entry, playwright  # noqa: F401
from test_phase3 import env  # noqa: F401


def test_nova_handoff_saves_before_navigation_and_waits_for_pdf_tool_choice(editor):
    page, title, client, (project_id, _) = editor
    title.fill("Gespeicherte Übergabe NOVA")
    downloads = []
    page.on("download", lambda download: downloads.append(download))
    page.get_by_role("button", name="An PDF-Werkstatt übergeben", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Was möchtest du mit deinem PDF tun?", exact=True)).to_be_visible()
    incoming = page.get_by_role("region", name="Dateiübergabe", exact=True)
    playwright.expect(incoming).to_contain_text("NOVA-Legenden")
    playwright.expect(incoming).to_contain_text("Browser A")
    assert client.get(f"/api/projects/{project_id}/legend").json()["legend"]["doc"]["title"]["text"] == "Gespeicherte Übergabe NOVA"
    assert downloads == []
    playwright.expect(page.locator(".pdf-pending-files li")).to_have_count(0)
    incoming.get_by_role("button", name="Dateien übernehmen", exact=True).click()
    playwright.expect(page.locator(".pdf-pending-files li")).to_have_count(1)
    page.locator('[data-pdf-tool="crop"]').click()
    playwright.expect(page.locator(".pdf-crop-editor")).to_be_visible()
    playwright.expect(page.locator(".pdf-crop-editor img")).to_be_visible()


def test_exported_pdf_handoff_waits_for_acceptance_and_downloads_renamed_copy(pdf_entry, tmp_path):
    page = pdf_entry
    original = sample_pdf([["HANDOFF ALPHA"], ["HANDOFF BETA"]])
    drop_files(page, [("Quelldatei.pdf", "application/pdf", original)])
    page.locator('[data-pdf-tool="multiTool"]').click()
    playwright.expect(page.locator(".pdf-page-card")).to_have_count(2)
    with page.expect_download() as output:
        page.get_by_role("button", name="↓ PDF erstellen", exact=True).click()
    page.locator(".tool-send-to > summary").click()
    # A changed page selection must not forward a stale pre-edit export.
    page.locator(".pdf-page-card").first.click()
    page.get_by_role("button", name="↻ Drehen", exact=True).click()
    playwright.expect(page.locator(".tool-send-to").get_by_role("button", name="Dateien umbenennen", exact=True)).to_be_disabled()
    with page.expect_download() as output:
        page.get_by_role("button", name="↓ PDF erstellen", exact=True).click()
    page.locator(".tool-send-to").get_by_role("button", name="Dateien umbenennen", exact=True).click()
    page.get_by_role("alertdialog", name="Ergebnisse gespeichert?", exact=True).get_by_role("button", name="Werkzeug wechseln", exact=True).click()
    incoming = page.get_by_role("region", name="Dateiübergabe", exact=True)
    playwright.expect(incoming).to_contain_text(output.value.suggested_filename)
    # Opening another tool alone must not import or silently change its project.
    playwright.expect(page.locator(".rename-preview tbody tr")).to_have_count(0)
    incoming.get_by_role("button", name="Dateien übernehmen", exact=True).click()
    playwright.expect(page.locator(".rename-preview tbody tr")).to_have_count(1)
    playwright.expect(incoming).to_have_count(0)
    page.get_by_label(f"Neuer Name für {output.value.suggested_filename}", exact=True).fill("1383_Legende_Kopie.pdf")
    with page.expect_download() as renamed:
        page.get_by_role("button", name="Benannte Kopien als ZIP herunterladen", exact=True).click()
    target = tmp_path / "kopien.zip"
    renamed.value.save_as(target)
    with zipfile.ZipFile(target) as archive:
        assert archive.namelist() == ["1383_Legende_Kopie.pdf"]
        result = PdfReader(BytesIO(archive.read(archive.namelist()[0])))
        assert [item.extract_text().strip() for item in result.pages] == ["HANDOFF ALPHA", "HANDOFF BETA"]
        assert [item.rotation for item in result.pages] == [90, 0]
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="PDF-Werkstatt öffnen", exact=True).click()
    playwright.expect(page.get_by_role("region", name="Dateiübergabe", exact=True)).to_have_count(0)
