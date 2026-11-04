"""Vector-preserving resize and native split/raster conversion proofs."""
import hashlib
import io
import json
import zipfile

import pytest
from PIL import Image, ImageChops
from pydantic import ValidationError
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, NumberObject

from edeco_toolbox.pdf_workshop import API
from edeco_toolbox.pdf_workshop import operations
from edeco_toolbox.pdf_workshop.client import PdfFile
from edeco_toolbox.pdf_workshop.operations import Options, capabilities, process, raster_images, resize_pdf, selected_pages, split_pdf
from test_documents import sample_pdf
from test_pdf_crop import illustrated_pdf, render, unit_pdf
from test_pdf_workbench import native_api  # noqa: F401


def pdf_pages(data):
    return list(PdfReader(io.BytesIO(data)).pages)


def test_split_preserves_vectors_text_order_and_requested_cut_groups():
    source = sample_pdf([[f"PAGE {i}"] for i in range(1, 6)])
    before = hashlib.sha256(source).hexdigest()
    result = split_pdf(source, Options(split_after="4,2", split_mode="custom"))
    with zipfile.ZipFile(io.BytesIO(result)) as archive:
        groups = [[page.extract_text().strip() for page in pdf_pages(archive.read(name))] for name in archive.namelist()]
    assert groups == [["PAGE 1", "PAGE 2"], ["PAGE 3", "PAGE 4"], ["PAGE 5"]]
    assert hashlib.sha256(source).hexdigest() == before


@pytest.mark.parametrize("count", [1, 3])
@pytest.mark.parametrize("mode", ["each", "custom"])
def test_split_each_and_no_cuts_always_produce_real_pdf_zip_parts(count, mode):
    source = sample_pdf([[str(index)] for index in range(count)])
    with zipfile.ZipFile(io.BytesIO(split_pdf(source, Options(split_mode=mode)))) as archive:
        lengths = [len(pdf_pages(archive.read(name))) for name in archive.namelist()]
    assert lengths == ([1] * count if mode == "each" else [count])


@pytest.mark.parametrize("value", ["0", "4", "2-1", "1-999999999", "one", "1,", ""])
def test_ranges_are_bounded_before_expansion(value):
    with pytest.raises(ValueError):
        selected_pages(value, 3)


def test_ranges_keep_requested_order_and_remove_duplicate_numbers():
    assert selected_pages("3,1-2,2", 3) == [3, 1, 2]
    assert selected_pages(" all ", 3) == [1, 2, 3]


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_resize_keep_100_percent_matches_visible_pixels_with_crop_origins_and_rotation(rotation):
    source = illustrated_pdf(rotation, inherited=True)
    before = hashlib.sha256(source).hexdigest()
    result = resize_pdf(source, Options(page_size="KEEP", scale=100, orientation="LANDSCAPE"))
    actual, expected = render(result), render(source)
    assert actual.size == expected.size
    assert all(maximum <= 1 for _, maximum in ImageChops.difference(actual, expected).getextrema())
    assert "CROP VECTOR TEXT" in pdf_pages(result)[0].extract_text()
    assert not pdf_pages(result)[0].get("/XObject")
    assert hashlib.sha256(source).hexdigest() == before


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_resize_100_percent_retains_physical_size_of_userunit_content(rotation):
    source_writer = PdfWriter()
    source_writer.add_page(PdfReader(io.BytesIO(illustrated_pdf(rotation))).pages[0])
    source_writer.pages[0][NameObject("/UserUnit")] = NumberObject(2)
    buffer = io.BytesIO()
    source_writer.write(buffer)
    source = buffer.getvalue()
    result = resize_pdf(source, Options(page_size="KEEP", scale=100))
    # PDFium canvas coordinates ignore UserUnit: an equivalent physical page
    # at unit=1 has doubled width/height and identical pixels at half scale.
    expected, actual = render(source, scale=3), render(result, scale=1.5)
    assert actual.size == expected.size
    assert all(maximum <= 1 for _, maximum in ImageChops.difference(actual, expected).getextrema())
    output_page = pdf_pages(result)[0]
    assert output_page.user_unit == 1
    assert float(output_page.mediabox.width) == pytest.approx((160 if rotation in (0, 180) else 120) * 2)


def test_new_paper_format_centers_content_at_true_100_percent_instead_of_automatic_fit():
    source = illustrated_pdf(0)
    result = resize_pdf(source, Options(page_size="A4", scale=100))
    page = pdf_pages(result)[0]
    assert (float(page.mediabox.width), float(page.mediabox.height)) == pytest.approx((210 * 72 / 25.4, 297 * 72 / 25.4))
    actual = render(result, scale=2)
    expected = render(source, scale=2)
    left = round((actual.width - expected.width) / 2)
    top = round((actual.height - expected.height) / 2)
    actual_content = actual.crop((left, top, left + expected.width, top + expected.height))
    # Fractional centring can shift edge antialiasing by one subpixel. Inner
    # quadrant colour centres are independent of that rounding.
    for x, y in [(20, 15), (140, 15), (20, 95), (140, 95)]:
        assert actual_content.getpixel((x * 2, y * 2)) == expected.getpixel((x * 2, y * 2))
    matrix = next(arguments for arguments, operator in page.get_contents().operations if operator == b"cm")
    assert list(matrix[:4]) == [1, 0, 0, 1]
    assert "VECTOR TEXT" in page.extract_text()


def test_resize_50_percent_scales_content_without_scaling_the_paper():
    source = illustrated_pdf(0)
    result = resize_pdf(source, Options(page_size="KEEP", scale=50))
    actual = render(result, scale=2)
    assert actual.size == (320, 240)
    difference = ImageChops.difference(actual, Image.new("RGB", actual.size, "white"))
    assert difference.getbbox() == (80, 60, 240, 180)


@pytest.mark.parametrize("dpi", [72, 144, 300])
@pytest.mark.parametrize("rotation", [0, 90])
def test_png_dimensions_pixels_rotation_and_dpi_metadata(dpi, rotation):
    source = illustrated_pdf(rotation)
    result, extension = raster_images(source, Options(dpi=dpi))
    assert extension == "png"
    actual = Image.open(io.BytesIO(result))
    expected = render(source, scale=dpi / 72)
    assert actual.size == expected.size
    assert actual.info["dpi"] == pytest.approx((dpi, dpi), abs=.03)
    assert ImageChops.difference(actual.convert("RGB"), expected).getbbox() is None


def test_png_physical_userunit_and_multi_page_selection_order_are_preserved():
    source = unit_pdf(NumberObject(2))
    data, extension = raster_images(source, Options(dpi=72))
    assert extension == "png" and Image.open(io.BytesIO(data)).size == (320, 240)
    source = sample_pdf([["FIRST"], ["SECOND"], ["THIRD"]])
    data, extension = raster_images(source, Options(dpi=72, pages="3,1"))
    assert extension == "zip"
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        assert archive.namelist() == ["Seite-3.png", "Seite-1.png"]
        for index, name in [(2, "Seite-3.png"), (0, "Seite-1.png")]:
            image = Image.open(io.BytesIO(archive.read(name))).convert("RGB")
            assert ImageChops.difference(image, render(source, index=index, scale=1)).getbbox() is None


def test_raster_budget_is_validated_before_any_render(monkeypatch):
    monkeypatch.setattr(operations, "MAX_RASTER_PIXELS", 100)
    with pytest.raises(ValueError, match="gross"):
        raster_images(sample_pdf(), Options(dpi=300))


@pytest.mark.parametrize("values", [
    {"angle": 17}, {"left": float("nan")}, {"scale": 0}, {"scale": float("inf")},
    {"dpi": 1200}, {"languages": []}, {"crop_box": [0, 0, 1, float("nan")]}, {"endpoint": "unexpected"},
])
def test_invalid_options_never_reach_the_processor(values):
    with pytest.raises(ValidationError):
        Options.model_validate(values)


def test_native_capabilities_and_text_conversion_need_no_engine():
    assert all(tool["available"] and tool["engine"] == "native" for tool in capabilities())
    source = sample_pdf([["LOCAL TEXT"]])
    text, extension = process(None, "pdf-to-text", [PdfFile("test.pdf", source)], Options())
    assert extension == "txt" and "LOCAL TEXT" in text.decode("utf-8")


def test_images_to_pdf_keeps_alpha_white_and_multiple_images():
    first = Image.new("RGBA", (144, 72), (255, 0, 0, 0))
    second = Image.new("RGB", (72, 144), "blue")
    inputs = []
    for image in [first, second]:
        output = io.BytesIO()
        image.save(output, format="PNG")
        inputs.append(PdfFile("image.png", output.getvalue()))
    result, extension = process(None, "images-to-pdf", inputs, Options(dpi=144))
    assert extension == "pdf" and len(pdf_pages(result)) == 2
    assert (float(pdf_pages(result)[0].mediabox.width), float(pdf_pages(result)[0].mediabox.height)) == (72, 36)
    assert render(result, scale=1).getpixel((20, 20)) == (255, 255, 255)


def test_native_process_api_validates_options_and_uses_session_without_core(native_api):
    client, headers, _ = native_api
    files = [("files", ("test.pdf", sample_pdf([["ONE"], ["TWO"]])))]
    assert client.post(API + "/process/split", files=files).status_code == 403
    assert client.post(API + "/process/split", files=files, headers={**headers, "Origin": "https://evil.example"}).status_code == 403
    assert client.post(API + "/process/split", files=files, headers=headers, data={"options": "{bad"}).status_code == 400
    assert client.post(API + "/process/ocr", files=files, headers=headers).status_code == 404
    response = client.post(API + "/process/pdf-to-images", files=files, headers=headers, data={"options": json.dumps({"pages": "2", "dpi": 72})})
    assert response.status_code == 200 and response.headers["content-type"] == "image/png"
    assert response.headers["cache-control"] == "no-store"
