"""End-to-end checks of the actual pinned Stirling Core + OCR container.

Run with EDECO_TEST_STIRLING_URL pointing to the locally deployed service.
Without the explicitly supplied service, these optional integration tests skip.
"""

import io
import os
import zipfile
from contextlib import closing

import pypdfium2 as pdfium
import pytest
from PIL import Image, ImageDraw, ImageFont

from edeco_toolbox.pdf_workshop.client import Crop, PdfFile, StirlingClient
from test_documents import sample_pdf


@pytest.fixture(scope="module")
def engine():
    url = os.environ.get("EDECO_TEST_STIRLING_URL")
    if not url:
        pytest.skip("EDECO_TEST_STIRLING_URL is required for the real Stirling integration")
    client = StirlingClient(url)
    assert client.health()["ready"], "The explicitly configured Stirling service must be running"
    return client


def test_live_merge_preserves_page_order_and_content(engine):
    first = PdfFile("A.pdf", sample_pdf([["FIRST PLAN"]]))
    second = PdfFile("B.pdf", sample_pdf([["SECOND PLAN"]]))
    result = engine.merge([first, second])
    with pdfium.PdfDocument(result) as doc:
        assert len(doc) == 2
        for index, expected in enumerate(["FIRST PLAN", "SECOND PLAN"]):
            with closing(doc[index]) as page, closing(page.get_textpage()) as text:
                assert expected in text.get_text_range()


def test_live_crop_and_resize_change_real_page_geometry(engine):
    source = PdfFile("A.pdf", sample_pdf([["VISIBLE TEXT"]]))
    result = engine.crop(source, Crop(20, 420, 300, 400))
    with pdfium.PdfDocument(result) as doc, closing(doc[0]) as page:
        assert page.get_size() == pytest.approx((300, 400), abs=.1)
        with closing(page.get_textpage()) as text:
            assert "VISIBLE TEXT" in text.get_text_range()
    result = engine.resize(source, "A3")
    with pdfium.PdfDocument(result) as doc, closing(doc[0]) as page:
        assert page.get_size() == pytest.approx((841.89, 1190.55), abs=.1)


def test_live_scan_becomes_searchable_with_tesseract(engine):
    image = Image.new("RGB", (2480, 3508), "white")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 62)
    draw.text((180, 300), "Electrical installation test report 2026", font=font, fill="black")
    draw.text((180, 450), "Protective conductor inspection complete.", font=font, fill="black")
    data = io.BytesIO(); image.save(data, format="PDF", resolution=300)
    with pdfium.PdfDocument(data.getvalue()) as doc, closing(doc[0]) as page, closing(page.get_textpage()) as text:
        assert not text.get_text_range().strip()
    result = engine.ocr(PdfFile("scan.pdf", data.getvalue()))
    with pdfium.PdfDocument(result) as doc, closing(doc[0]) as page, closing(page.get_textpage()) as text:
        assert "Electrical installation test report 2026" in text.get_text_range()
        assert "Protective conductor" in text.get_text_range()


def test_live_dpi_applies_to_raster_output_not_vector_page_size(engine):
    result = engine.raster_images(PdfFile("A.pdf", sample_pdf([["DPI TEST"]])), dpi=144)
    if result.startswith(b"PK"):
        with zipfile.ZipFile(io.BytesIO(result)) as archive:
            result = archive.read(next(name for name in archive.namelist() if name.lower().endswith(".png")))
    image = Image.open(io.BytesIO(result))
    assert image.width == pytest.approx(1190, abs=2)
    assert image.height == pytest.approx(1684, abs=2)


def test_live_company_stamp_is_present_in_output(engine):
    result = engine.stamp(PdfFile("A.pdf", sample_pdf([["PROJECT DOCUMENT"]])), "ENTWURF")
    with pdfium.PdfDocument(result) as doc, closing(doc[0]) as page, closing(page.get_textpage()) as text:
        assert "ENTWURF" in text.get_text_range()
