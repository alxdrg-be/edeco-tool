"""End-to-end checks of the actual pinned Stirling Core + OCR container.

Run with EDECO_TEST_STIRLING_URL pointing to the locally deployed service.
Without the explicitly supplied service, these optional integration tests skip.
"""

import io
import os
from pathlib import Path
import time
import zipfile
from contextlib import closing

import pypdfium2 as pdfium
import pytest
import httpx
from PIL import Image, ImageDraw, ImageFont

from edeco_toolbox.pdf_workshop.client import Crop, PdfFile, StirlingClient
from test_documents import sample_pdf


@pytest.fixture(scope="module")
def engine():
    toolbox = os.environ.get('EDECO_TEST_TOOLBOX_URL')
    if toolbox:
        with httpx.Client(base_url=toolbox, trust_env=False, timeout=10) as browser:
            state = browser.get('/api/tools/pdf-werkstatt/state').json()
            assert state['local'], 'Packaged tests require the bundled local engine'
            for _ in range(160):
                health = browser.post('/api/tools/pdf-werkstatt/check', headers={'X-Edeco-Pdf': state['session_key']}).json()
                if health['ready']:
                    break
                time.sleep(1)
            assert health['ready'], health
            client = StirlingClient(toolbox)
            client.headers['Cookie'] = '; '.join(f'{key}={value}' for key, value in browser.cookies.items())
            yield client
            return
    if os.environ.get('EDECO_TEST_PDF_RUNTIME'):
        from edeco_toolbox.pdf_workshop.runtime import PdfRuntime
        runtime = PdfRuntime()
        try:
            runtime.start()
            for _ in range(310):
                if runtime.ready or (runtime.thread and not runtime.thread.is_alive()):
                    break
                time.sleep(.5)
            assert runtime.health()['ready'], runtime.health()
            assert httpx.get(runtime.url + '/tools/pdf-werkstatt/api/v1/info/status', trust_env=False).status_code == 403
            yield StirlingClient(runtime.url, engine_secret=runtime.secret)
        finally:
            runtime.close()
        return
    url = os.environ.get("EDECO_TEST_STIRLING_URL")
    if not url:
        pytest.skip("EDECO_TEST_STIRLING_URL is required for the real Stirling integration")
    client = StirlingClient(url)
    assert client.health()["ready"], "The explicitly configured Stirling service must be running"
    yield client


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
    scaled = engine.resize(source, 'KEEP', scale_factor=.5)
    with pdfium.PdfDocument(source.data) as original, pdfium.PdfDocument(scaled) as result:
        with closing(original[0]) as before, closing(result[0]) as after:
            assert after.get_size() == pytest.approx(before.get_size(), abs=.1)
            with closing(before.get_textpage()) as left, closing(after.get_textpage()) as right:
                a, b = left.get_charbox(0), right.get_charbox(0)
                assert b[2] - b[0] == pytest.approx((a[2] - a[0]) * .5, abs=.1)


def test_live_scan_becomes_searchable_with_tesseract(engine):
    image = Image.new("RGB", (2480, 3508), "white")
    draw = ImageDraw.Draw(image)
    font_path = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts/arial.ttf' if os.name == 'nt' else Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    font = ImageFont.truetype(str(font_path), 62)
    draw.text((180, 300), "Electrical installation test report 2026", font=font, fill="black")
    draw.text((180, 450), "Protective conductor inspection complete.", font=font, fill="black")
    draw.text((180, 600), "Prüfbericht für elektrische Anlagen", font=font, fill="black")
    data = io.BytesIO(); image.save(data, format="PDF", resolution=300)
    with pdfium.PdfDocument(data.getvalue()) as doc, closing(doc[0]) as page, closing(page.get_textpage()) as text:
        assert not text.get_text_range().strip()
    result = engine.ocr(PdfFile("scan.pdf", data.getvalue()))
    with pdfium.PdfDocument(result) as doc, closing(doc[0]) as page, closing(page.get_textpage()) as text:
        assert "Electrical installation test report 2026" in text.get_text_range()
        assert "Protective conductor" in text.get_text_range()
        assert "Prüfbericht" in text.get_text_range()


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


def post(engine, endpoint, data, content, name='plan.pdf', mime='application/pdf'):
    with httpx.Client(headers=engine.headers, trust_env=False, timeout=180) as client:
        response = client.post(engine.url + '/api/v1/' + endpoint,
                               files={'fileInput': (name, content, mime)}, data=data)
    assert response.status_code == 200, response.text[:1000]
    return response.content


def test_live_split_preserves_all_pages(engine):
    result = post(engine, 'general/split-pages', {'pageNumbers': '1,2'}, sample_pdf([['FIRST'], ['SECOND'], ['THIRD']]))
    with zipfile.ZipFile(io.BytesIO(result)) as archive:
        files = sorted(name for name in archive.namelist() if name.endswith('.pdf'))
        assert len(files) == 3
        for name, expected in zip(files, ['FIRST', 'SECOND', 'THIRD']):
            with pdfium.PdfDocument(archive.read(name)) as doc, closing(doc[0]) as page, closing(page.get_textpage()) as text:
                assert len(doc) == 1 and expected in text.get_text_range()


def test_live_rotation_changes_geometry_and_renders(engine):
    result = post(engine, 'general/rotate-pdf', {'angle': '90', 'pageNumbers': 'all'}, sample_pdf([['ROTATE ME']]))
    with pdfium.PdfDocument(result) as doc, closing(doc[0]) as page:
        assert page.get_size() == pytest.approx((842, 595), abs=1)
        bitmap = page.render(scale=.5)
        try:
            assert bitmap.width == pytest.approx(421, abs=1)
        finally:
            bitmap.close()


def test_live_text_conversion_contains_original_text(engine):
    result = post(engine, 'convert/pdf/text', {'outputFormat': 'txt'}, sample_pdf([['TEXT CONVERSION TEST']]))
    assert b'TEXT CONVERSION TEST' in result


def test_live_image_conversion_and_compression(engine):
    image = Image.effect_noise((1600, 2200), 35).convert('RGB')
    image_data = io.BytesIO(); image.save(image_data, format='PNG')
    result = post(engine, 'convert/img/pdf', {'fitOption': 'fillPage', 'colorType': 'color', 'autoRotate': 'false'},
                  image_data.getvalue(), 'scan.png', 'image/png')
    with pdfium.PdfDocument(result) as doc:
        assert len(doc) == 1
    compressed = post(engine, 'misc/compress-pdf', {'optimizeLevel': '8', 'linearize': 'false', 'normalize': 'false'}, result)
    with pdfium.PdfDocument(compressed) as doc, closing(doc[0]) as page:
        assert len(doc) == 1
        bitmap = page.render(scale=.25)
        assert bitmap.width > 0
        bitmap.close()
    assert len(compressed) < len(result), (len(result), len(compressed))
