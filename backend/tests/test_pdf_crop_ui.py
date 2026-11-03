"""Exercise the native crop UI against its real API, without a Java service."""

from contextlib import closing

import pytest

from test_documents import sample_pdf
from test_editor_navigation import editor, playwright  # noqa: F401
from test_phase3 import env  # noqa: F401


def open_crop(page):
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="PDF-Werkstatt öffnen", exact=True).click()
    crop = page.locator('[data-pdf-tool="crop"]')
    playwright.expect(crop).to_have_attribute("aria-disabled", "false")
    crop.click()


def test_native_crop_large_selection_document_zoom_and_vector_export(editor, tmp_path):
    import pypdfium2 as pdfium

    page, _, _, _ = editor
    open_crop(page)
    page.get_by_label("PDF zum Zuschneiden hinzufügen", exact=True).set_input_files({
        "name": "Plans.pdf", "mimeType": "application/pdf", "buffer": sample_pdf([["FIRST VECTOR PAGE"], ["SECOND VECTOR PAGE"]]),
    })
    image = page.get_by_role("img", name="PDF-Seite 1 von Plans.pdf", exact=True)
    playwright.expect(image).to_be_visible()
    page.screenshot(path=str(tmp_path / "crop-initial.png"), full_page=True)
    assert image.bounding_box()["height"] > 500
    viewport = page.locator(".pdf-crop-viewport")
    sheet = page.locator(".pdf-crop-page")
    selection = page.get_by_role("group", name="Zuschneidebereich", exact=True)
    bounds = sheet.bounding_box()
    page.mouse.move(bounds["x"] + bounds["width"] * .1, bounds["y"] + bounds["height"] * .1)
    page.mouse.down()
    page.mouse.move(bounds["x"] + bounds["width"] * .85, bounds["y"] + bounds["height"] * .85, steps=8)
    page.mouse.up()
    assert selection.evaluate("el => parseFloat(el.style.width)") == pytest.approx(75, abs=1)
    before = selection.get_attribute("style")
    # Clicking alone never replaces the current crop by an almost-zero rectangle.
    page.mouse.click(bounds["x"] + bounds["width"] * .5, bounds["y"] + bounds["height"] * .5)
    assert selection.get_attribute("style") == before
    playwright.expect(selection.get_by_role("button")).to_have_count(8)
    left_handle = page.get_by_role("button", name="Linker Rand des Ausschnitts verschieben", exact=True)
    left_handle.focus()
    left = selection.evaluate("el => parseFloat(el.style.left)")
    page.keyboard.press("Shift+ArrowRight")
    assert selection.evaluate("el => parseFloat(el.style.left)") > left
    right_handle = page.locator(".pdf-crop-handle-e")
    pos = right_handle.bounding_box()
    before_width = selection.evaluate("el => parseFloat(el.style.width)")
    page.mouse.move(pos["x"] + pos["width"] / 2, pos["y"] + pos["height"] / 2)
    page.mouse.down()
    page.mouse.move(pos["x"] - 25, pos["y"] + pos["height"] / 2, steps=5)
    page.mouse.up()
    assert selection.evaluate("el => parseFloat(el.style.width)") < before_width
    page.get_by_role("button", name="Auswahl zurücksetzen", exact=True).click()
    page.get_by_label("Rand links (mm)", exact=True).fill("10")
    page.get_by_label("Rand links (mm)", exact=True).blur()
    assert selection.evaluate("el => parseFloat(el.style.left)") > 4
    zoom = float(viewport.get_attribute("data-crop-zoom"))
    chrome_width = page.locator(".tool-header").bounding_box()["width"]
    canvas = viewport.bounding_box()
    page.mouse.move(canvas["x"] + canvas["width"] / 2, canvas["y"] + canvas["height"] / 2)
    page.keyboard.down("Control")
    page.mouse.wheel(0, -200)
    page.keyboard.up("Control")
    page.wait_for_function("z => Number(document.querySelector('.pdf-crop-viewport').dataset.cropZoom) > z", arg=zoom)
    assert page.locator(".tool-header").bounding_box()["width"] == chrome_width
    assert page.evaluate("visualViewport.scale") == 1
    viewport.focus()
    page.keyboard.press("Control+0")
    playwright.expect(viewport).to_have_attribute("data-crop-zoom", "1")
    page.get_by_role("button", name="Ganze Seite", exact=True).click()
    page.wait_for_function("""() => {
      const view = document.querySelector('.pdf-crop-viewport').getBoundingClientRect();
      const paper = document.querySelector('.pdf-crop-page').getBoundingClientRect();
      return paper.left >= view.left && paper.top >= view.top && paper.right <= view.right && paper.bottom <= view.bottom;
    }""")
    page.get_by_role("button", name="Nächste PDF-Seite", exact=True).click()
    playwright.expect(page.get_by_role("img", name="PDF-Seite 2 von Plans.pdf", exact=True)).to_be_visible()
    playwright.expect(page.get_by_label("Rand links (mm)", exact=True)).to_have_value("0")
    page.get_by_role("button", name="Vorherige PDF-Seite", exact=True).click()
    playwright.expect(page.get_by_label("Rand links (mm)", exact=True)).to_have_value("10")
    page.get_by_label("Anwenden auf", exact=True).select_option("range")
    page.get_by_label("Seitenbereich", exact=True).fill("3")
    playwright.expect(page.get_by_role("button", name="Zuschneiden & speichern", exact=True)).to_be_disabled()
    page.get_by_label("Anwenden auf", exact=True).select_option("all")
    with page.expect_download() as saved:
        page.get_by_role("button", name="Zuschneiden & speichern", exact=True).click()
    path = tmp_path / saved.value.suggested_filename
    saved.value.save_as(path)
    with pdfium.PdfDocument(path) as result:
        assert len(result) == 2
        for index in range(2):
            with closing(result[index]) as pdf_page, closing(pdf_page.get_textpage()) as text:
                assert pdf_page.get_size()[0] == pytest.approx(595 - 10 * 72 / 25.4, abs=.01)
                assert pdf_page.get_size()[1] == pytest.approx(842)
                assert "VECTOR PAGE" in text.get_text_range()
    page.screenshot(path=str(tmp_path / "crop-desktop.png"), full_page=True)
    # Both the original PDF and crop survive a visit to the tool palette.
    page.get_by_role("button", name="Werkzeugauswahl", exact=True).click()
    page.locator('[data-pdf-tool="crop"]').click()
    playwright.expect(page.get_by_label("Rand links (mm)", exact=True)).to_have_value("10")
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".pdf-crop-editor").evaluate("el => el.scrollWidth <= el.clientWidth")
    page.get_by_role("button", name="Zuschneiden & speichern", exact=True).scroll_into_view_if_needed()
    playwright.expect(page.get_by_role("button", name="Zuschneiden & speichern", exact=True)).to_be_visible()
    page.screenshot(path=str(tmp_path / "crop-mobile.png"), full_page=True)


def test_rotated_userunit_page_uses_physical_millimetres(editor, tmp_path):
    from io import BytesIO

    import pypdfium2 as pdfium
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import NameObject, NumberObject

    page, _, _, _ = editor
    open_crop(page)
    # PDFium intentionally reports canvas dimensions independently of /UserUnit.
    reader = PdfReader(BytesIO(sample_pdf([["USER UNIT TWO"]], rotation=90)))
    writer = PdfWriter()
    reader.pages[0][NameObject("/UserUnit")] = NumberObject(2)
    writer.add_page(reader.pages[0])
    output = BytesIO()
    writer.write(output)
    page.get_by_label("PDF zum Zuschneiden hinzufügen", exact=True).set_input_files({
        "name": "Double-unit.pdf", "mimeType": "application/pdf", "buffer": output.getvalue(),
    })
    playwright.expect(page.get_by_role("img", name="PDF-Seite 1 von Double-unit.pdf", exact=True)).to_be_visible()
    playwright.expect(page.locator(".pdf-crop-size")).to_contain_text("594.08")
    page.get_by_label("Rand links (mm)", exact=True).fill("10")
    page.get_by_label("Rand links (mm)", exact=True).blur()
    assert page.get_by_role("group", name="Zuschneidebereich", exact=True).evaluate("el => parseFloat(el.style.left)") == pytest.approx(10 / (842 * 2 * 25.4 / 72) * 100, abs=.01)
    with page.expect_download() as saved:
        page.get_by_role("button", name="Zuschneiden & speichern", exact=True).click()
    path = tmp_path / "physical.pdf"
    saved.value.save_as(path)
    with pdfium.PdfDocument(path) as result, closing(result[0]) as pdf_page:
        assert pdf_page.get_size()[0] == pytest.approx(842 - 10 * 72 / 25.4 / 2, abs=.01)
