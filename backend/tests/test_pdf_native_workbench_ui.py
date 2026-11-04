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
        page.get_by_role("link", name="Erneut herunterladen", exact=True).click()
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
    with page.expect_download() as event:
        page.get_by_role("button", name="↓ PDF erstellen", exact=True).click()
    playwright.expect(page.get_by_role("status").filter(has_text="PDF erstellt")).to_be_visible()
    target = tmp_path / "rows.pdf"
    event.value.save_as(target)
    result = PdfReader(target)
    assert [p.extract_text().strip() for p in result.pages] == ["ALPHA ONE", "BETA ONE", "ALPHA TWO"]
    assert [p.rotation for p in result.pages] == [0, 0, 90]
    assert hashlib.sha256(first).hexdigest() == digest
    # The documentwise editing remains present when visiting the tool catalog.
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="crop"]').click()
    chooser = page.get_by_role("dialog", name="Welches PDF möchtest du bearbeiten?", exact=True)
    playwright.expect(chooser).to_be_visible()
    chooser.get_by_role("button", name=re.compile("Alpha.pdf")).click()
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


def begin_page_drag(page, source):
    source.scroll_into_view_if_needed()
    bounds = source.bounding_box()
    page.mouse.move(bounds["x"] + bounds["width"] / 2, bounds["y"] + 60)
    page.mouse.down()
    page.mouse.move(bounds["x"] + bounds["width"] / 2 + 15, bounds["y"] + 75, steps=5)
    playwright.expect(page.get_by_role("region", name="Neues Dokument durch Ablegen", exact=True)).to_be_visible()


def save_workbench(page, tmp_path, button):
    with page.expect_download() as event:
        button.click()
    target = tmp_path / event.value.suggested_filename
    event.value.save_as(target)
    return PdfReader(target)


def test_drag_preview_places_pages_before_and_creates_a_new_document(pdf_entry, tmp_path):
    page = pdf_entry
    first = sample_pdf([["ALPHA FIRST"], ["ALPHA SECOND"], ["ALPHA THIRD"]])
    second = sample_pdf([["BETA FIRST"]])
    drop_files(page, [("Alpha.pdf", "application/pdf", first), ("Beta.pdf", "application/pdf", second)])
    page.locator('[data-pdf-tool="multiTool"]').click()
    rows = page.locator(".pdf-document-row")
    playwright.expect(rows).to_have_count(2)
    # An actual HTML drag displays a thumbnail at the proposed insertion point.
    begin_page_drag(page, rows.nth(0).locator(".pdf-page-card").nth(2))
    target = rows.nth(0).locator(".pdf-page-card").nth(0).bounding_box()
    page.mouse.move(target["x"] + 8, target["y"] + 70, steps=8)
    preview = page.locator(".pdf-drop-indicator.is-before")
    playwright.expect(preview).to_be_visible()
    playwright.expect(preview.locator("img")).to_have_count(1)
    page.screenshot(path=artifact_file(tmp_path, "04-page-drop-preview.png"))
    page.mouse.up()
    playwright.expect(rows.nth(0).locator(".pdf-page-card").nth(0)).to_contain_text("Originalseite 3")
    # Dragging a page below the rows creates its own document; no file is lost.
    begin_page_drag(page, rows.nth(0).locator(".pdf-page-card").nth(1))
    destination = page.get_by_role("region", name="Neues Dokument durch Ablegen", exact=True)
    destination.scroll_into_view_if_needed()
    target = destination.bounding_box()
    page.mouse.move(target["x"] + target["width"] / 2, target["y"] + target["height"] / 2, steps=12)
    page.mouse.move(target["x"] + target["width"] / 2, target["y"] + target["height"] / 2)
    page.screenshot(path=artifact_file(tmp_path, "05-new-document-drop-before.png"))
    playwright.expect(destination).to_have_class(re.compile("is-drop-target"))
    page.screenshot(path=artifact_file(tmp_path, "05-new-document-drop.png"))
    page.mouse.up()
    playwright.expect(rows).to_have_count(3)
    playwright.expect(rows.nth(2)).to_contain_text("Neues Dokument 1.pdf")
    playwright.expect(rows.nth(2).locator(".pdf-page-card")).to_have_count(1)
    output = save_workbench(page, tmp_path, page.get_by_role("button", name="Alle PDFs zusammenfügen", exact=True))
    assert [sheet.extract_text().strip() for sheet in output.pages] == ["ALPHA THIRD", "ALPHA SECOND", "BETA FIRST", "ALPHA FIRST"]
    # The new row can be undone and file ordering stays independent of the sources.
    page.get_by_role("button", name="↶ Rückgängig", exact=True).click()
    playwright.expect(rows).to_have_count(2)
    playwright.expect(rows.nth(0).locator(".pdf-page-card")).to_have_count(3)
    page.get_by_role("button", name="Beta.pdf: Reihe nach oben", exact=True).click()
    output = save_workbench(page, tmp_path, page.get_by_role("button", name="Alle PDFs zusammenfügen", exact=True))
    assert [sheet.extract_text().strip() for sheet in output.pages] == ["BETA FIRST", "ALPHA THIRD", "ALPHA FIRST", "ALPHA SECOND"]
    page.screenshot(path=artifact_file(tmp_path, "06-merged-download.png"))


def test_drag_after_preview_and_multi_document_selection_preserve_page_order(pdf_entry, tmp_path):
    page = pdf_entry
    drop_files(page, [("Alpha.pdf", "application/pdf", sample_pdf([["A FIRST"], ["A SECOND"]])),
                      ("Beta.pdf", "application/pdf", sample_pdf([["B FIRST"]]))])
    page.locator('[data-pdf-tool="multiTool"]').click()
    rows = page.locator(".pdf-document-row")
    playwright.expect(rows).to_have_count(2)
    begin_page_drag(page, rows.nth(0).locator(".pdf-page-card").nth(0))
    target = rows.nth(1).locator(".pdf-page-card").nth(0).bounding_box()
    page.mouse.move(target["x"] + target["width"] - 8, target["y"] + 20, steps=12)
    page.mouse.move(target["x"] + target["width"] - 8, target["y"] + 20)
    playwright.expect(page.locator(".pdf-drop-indicator.is-after")).to_be_visible()
    page.mouse.up()
    playwright.expect(rows.nth(1).locator(".pdf-page-card").nth(1)).to_contain_text("Originalseite 1")
    output = save_workbench(page, tmp_path, page.get_by_role("button", name="Alle PDFs zusammenfügen", exact=True))
    assert [sheet.extract_text().strip() for sheet in output.pages] == ["A SECOND", "B FIRST", "A FIRST"]
    # Selecting pages in separate rows keeps both selected while dragging.
    rows.nth(0).locator(".pdf-page-card").nth(0).click()
    rows.nth(1).locator(".pdf-page-card").nth(0).click(modifiers=["Control"])
    begin_page_drag(page, rows.nth(0).locator(".pdf-page-card").nth(0))
    destination = page.get_by_role("region", name="Neues Dokument durch Ablegen", exact=True)
    destination.scroll_into_view_if_needed()
    target = destination.bounding_box()
    page.mouse.move(target["x"] + target["width"] / 2, target["y"] + target["height"] / 2, steps=12)
    page.mouse.move(target["x"] + target["width"] / 2, target["y"] + target["height"] / 2)
    playwright.expect(destination).to_contain_text("2 Seiten hier ablegen")
    page.mouse.up()
    playwright.expect(rows).to_have_count(3)
    playwright.expect(rows.nth(2).locator(".pdf-page-card")).to_have_count(2)
    output = save_workbench(page, tmp_path, rows.nth(2).get_by_role("button", name="PDF erstellen", exact=True))
    assert [sheet.extract_text().strip() for sheet in output.pages] == ["A SECOND", "B FIRST"]
    page.get_by_role("button", name="↶ Rückgängig", exact=True).click()
    playwright.expect(rows).to_have_count(2)
    playwright.expect(rows.nth(1).locator(".pdf-page-card")).to_have_count(2)


def test_page_tools_have_clear_actions_and_extract_without_removing_original_pages(pdf_entry, tmp_path):
    page = pdf_entry
    drop_files(page, [("Plan.pdf", "application/pdf", sample_pdf([["KEEP FIRST"], ["EXTRACT SECOND"]]))])
    page.locator('[data-pdf-tool="extractPages"]').click()
    playwright.expect(page.get_by_role("heading", name="Seiten extrahieren", exact=True)).to_be_visible()
    cards = page.locator(".pdf-page-card")
    playwright.expect(cards).to_have_count(2)
    cards.nth(1).click()
    output = save_workbench(page, tmp_path, page.get_by_role("button", name="Auswahl extrahieren", exact=True))
    assert len(output.pages) == 1 and "EXTRACT SECOND" in output.pages[0].extract_text()
    playwright.expect(cards).to_have_count(2)
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="rotate"]').click()
    playwright.expect(page.get_by_role("heading", name="Seiten drehen", exact=True)).to_be_visible()
    page.get_by_role("button", name="↻ Auswahl drehen", exact=True).click()
    output = save_workbench(page, tmp_path, page.get_by_role("button", name="↓ PDF erstellen", exact=True))
    assert [sheet.rotation for sheet in output.pages] == [0, 90]
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="removePages"]').click()
    playwright.expect(page.get_by_role("heading", name="Seiten löschen", exact=True)).to_be_visible()
    page.get_by_role("button", name="Auswahl löschen", exact=True).click()
    output = save_workbench(page, tmp_path, page.get_by_role("button", name="↓ PDF erstellen", exact=True))
    assert len(output.pages) == 1 and "KEEP FIRST" in output.pages[0].extract_text()
    page.get_by_role("button", name="Plan.pdf: Dokument entfernen", exact=True).click()
    playwright.expect(page.locator(".pdf-selected-preview")).to_have_count(0)
    playwright.expect(page.locator(".pdf-result")).to_have_count(0)
    playwright.expect(page.get_by_role("button", name="↓ PDF erstellen", exact=True)).to_be_disabled()


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
    with page.expect_download() as event:
        page.get_by_role("button", name="Teilen & herunterladen", exact=True).click()
    target = tmp_path / event.value.suggested_filename
    event.value.save_as(target)
    playwright.expect(page.get_by_role("link", name="Erneut herunterladen", exact=True)).to_be_visible()
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
    with page.expect_download() as event:
        page.get_by_role("button", name="Erstellen & herunterladen", exact=True).click()
    target = tmp_path / event.value.suggested_filename
    event.value.save_as(target)
    playwright.expect(page.get_by_role("link", name="Erneut herunterladen", exact=True)).to_be_visible()
    with Image.open(target) as image:
        assert image.format == "PNG"
        assert image.width in (2479, 2480) and image.height in (3508, 3509)
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="scalePages"]').click()
    playwright.expect(page.get_by_role("img", name="Vorschau Seite 1", exact=True)).to_be_visible()
    page.get_by_label("Papierformat", exact=True).select_option("A5")
    playwright.expect(page.get_by_label("Inhalt skalieren (%)", exact=True)).to_have_value("100")
    with page.expect_download() as event:
        page.get_by_role("button", name="Erstellen & herunterladen", exact=True).click()
    resized = tmp_path / event.value.suggested_filename
    event.value.save_as(resized)
    playwright.expect(page.get_by_role("link", name="Erneut herunterladen", exact=True)).to_be_visible()
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
    playwright.expect(page.get_by_role("link", name="Erneut herunterladen", exact=True)).to_be_visible()
    old_blob = page.get_by_role("link", name="Erneut herunterladen", exact=True).get_attribute("href")
    with Image.open(download_result(page, tmp_path)) as retained:
        assert retained.width in (2479, 2480)
    page.get_by_label("Bildauflösung", exact=True).select_option("144")
    playwright.expect(page.get_by_role("link", name="Erneut herunterladen", exact=True)).to_have_count(0)
    assert page.evaluate("url => fetch(url).then(() => false, () => true)", old_blob)
