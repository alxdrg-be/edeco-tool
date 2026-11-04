"""Real visible appearances and irreversible image-PDF redaction exports."""
import hashlib
import io
import json
from contextlib import closing

import pypdfium2 as pdfium
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, BooleanObject, DecodedStreamObject, DictionaryObject, NameObject, NumberObject, RectangleObject, TextStringObject

from edeco_toolbox.pdf_workshop import API
from edeco_toolbox.pdf_workshop import marks
from edeco_toolbox.pdf_workshop.marks import MarkRect, MarkStore, secure_redaction, visible_signature
from test_documents import sample_pdf


def appearance_png(color=(20, 110, 190, 255)):
    output = io.BytesIO()
    with Image.new("RGBA", (240, 80), color) as image:
        image.save(output, format="PNG")
    return output.getvalue()


def altered_pdf(data, rotation=0, unit=1, crop=False):
    reader = PdfReader(io.BytesIO(data))
    writer = PdfWriter()
    for original in reader.pages:
        page = writer.add_page(original)
        if rotation:
            page.rotate(rotation)
        page[NameObject("/UserUnit")] = NumberObject(unit)
        if crop:
            page.cropbox.lower_left = (20, 40)
            page.cropbox.upper_right = (550, 810)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def form_pdf(rotation=0):
    writer = PdfWriter()
    page = writer.add_blank_page(width=500, height=500)
    def dictionary(**items):
        return DictionaryObject({NameObject('/' + key): value for key, value in items.items()})
    font = writer._add_object(dictionary(Type=NameObject('/Font'), Subtype=NameObject('/Type1'), BaseFont=NameObject('/Helvetica')))
    resources = dictionary(Font=dictionary(F1=font))
    appearance = DecodedStreamObject()
    appearance.set_data(b'q 1 0 0 rg 0 0 280 60 re f BT /F1 20 Tf 0 0 0 rg 10 20 Td (VISIBLE FORM VALUE) Tj ET Q')
    appearance.update(dictionary(Type=NameObject('/XObject'), Subtype=NameObject('/Form'), BBox=RectangleObject([0, 0, 280, 60]), Resources=resources))
    field = dictionary(Type=NameObject('/Annot'), Subtype=NameObject('/Widget'), FT=NameObject('/Tx'), T=TextStringObject('important-field'),
                       V=TextStringObject('VISIBLE FORM VALUE'), Rect=RectangleObject([100, 100, 380, 160]), F=NumberObject(4),
                       DA=TextStringObject('/F1 20 Tf 0 g'), AP=dictionary(N=writer._add_object(appearance)))
    reference = writer._add_object(field)
    page[NameObject('/Annots')] = ArrayObject([reference])
    writer._root_object[NameObject('/AcroForm')] = dictionary(Fields=ArrayObject([reference]), DR=resources, NeedAppearances=BooleanObject(False))
    if rotation:
        page.rotate(rotation)
    output = io.BytesIO(); writer.write(output)
    return output.getvalue()


def render(data, page=0, scale=1):
    with pdfium.PdfDocument(data) as document:
        document.init_forms()
        with closing(document[page]) as sheet, closing(sheet.render(scale=scale)) as bitmap:
            return bitmap.to_pil().convert("RGB")


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
@pytest.mark.parametrize("crop", [False, True])
def test_visible_signature_stays_at_selected_visible_position_and_keeps_original_text(rotation, crop):
    source = altered_pdf(sample_pdf([["ORIGINAL VECTOR FIRST"], ["UNCHANGED SECOND"]]), rotation, 2, crop)
    digest = hashlib.sha256(source).hexdigest()
    position = MarkRect(page=1, x=.55, y=.6, width=.25, height=.12)
    output = visible_signature(source, appearance_png(), [position])
    reader = PdfReader(io.BytesIO(output))
    assert len(reader.pages) == 2
    assert "ORIGINAL VECTOR FIRST" in reader.pages[0].extract_text()
    assert "UNCHANGED SECOND" in reader.pages[1].extract_text()
    with render(output) as image:
        pixel = image.getpixel((round(image.width * .65), round(image.height * .65)))
        assert pixel[2] > 130 and pixel[1] > 70 and pixel[0] < 80
    assert hashlib.sha256(source).hexdigest() == digest
    assert reader.pages[1].rotation == rotation


def test_transparent_appearance_does_not_cover_existing_drawing():
    source = sample_pdf([["VISIBLE THROUGH A TRANSPARENT APPEARANCE"]])
    output = visible_signature(source, appearance_png((0, 0, 0, 0)), [MarkRect(page=1, x=0, y=0, width=1, height=1)])
    with render(source) as before, render(output) as after:
        assert before.tobytes() == after.tobytes()


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_signature_preserves_interactive_form_value_and_widget_position(rotation):
    source = form_pdf(rotation)
    output = visible_signature(source, appearance_png(), [MarkRect(page=1, x=.02, y=.02, width=.1, height=.05)])
    reader = PdfReader(io.BytesIO(output))
    assert reader.get_fields()['important-field']['/V'] == 'VISIBLE FORM VALUE'
    assert list(reader.pages[0]['/Annots'][0].get_object()['/Rect']) == [100, 100, 380, 160]
    assert reader.pages[0].rotation == rotation
    with render(source) as before, render(output) as after:
        def red_box(image):
            mask = Image.new('1', image.size)
            mask.putdata([r > 180 and g < 90 and b < 90 for r, g, b in image.getdata()])
            result = mask.getbbox(); mask.close(); return result
        assert red_box(before) is not None
        assert red_box(after) == red_box(before)


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_secure_redaction_preserves_visible_form_appearance_and_preview(rotation):
    source = form_pdf(rotation)
    with closing(MarkStore()) as store:
        uploaded = store.add(source, 'Form.pdf')
        preview = store.page_selection(uploaded['id'], 1)
    import base64
    with Image.open(io.BytesIO(base64.b64decode(preview['image'].split(',', 1)[1]))) as image:
        assert any(r > 180 and g < 90 and b < 90 for r, g, b in image.convert('RGB').getdata())
    output = secure_redaction(source, [MarkRect(page=1, x=.01, y=.01, width=.02, height=.02)], 150)
    with render(output) as image:
        assert sum(r > 180 and g < 90 and b < 90 for r, g, b in image.getdata()) > 1000
    assert not PdfReader(io.BytesIO(output)).get_fields()


def test_invalid_appearance_is_rejected_without_returning_an_unmarked_pdf():
    with pytest.raises(ValueError, match="Signaturbild"):
        visible_signature(sample_pdf(), b"not an image", [MarkRect(page=1, x=.1, y=.1, width=.3, height=.1)])


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_text_line_boxes_cover_actual_rotated_visible_print(rotation):
    source = altered_pdf(sample_pdf([["SELECT THIS SECRET LINE", "KEEP THIS OTHER LINE"]]), rotation, 2, True)
    with closing(MarkStore()) as store:
        uploaded = store.add(source, "Plan.pdf")
        result = store.page_selection(uploaded["id"], 1)
        line = next(line for line in result["lines"] if "SELECT THIS" in line["text"])
        assert 0 <= line["x"] < line["x"] + line["width"] <= 1
        assert 0 <= line["y"] < line["y"] + line["height"] <= 1
        with render(source) as image:
            box = (int(line["x"] * image.width), int(line["y"] * image.height),
                   int((line["x"] + line["width"]) * image.width), int((line["y"] + line["height"]) * image.height))
            pixels = image.crop(box)
            assert min(pixels.getextrema()[0]) < 120


def private_source():
    secret = "CONFIDENTIAL-CONTRACT-4738"
    reader = PdfReader(io.BytesIO(sample_pdf([[secret, "SAFE FIRST PAGE"], ["SAFE SECOND PAGE"]])))
    writer = PdfWriter()
    writer.append_pages_from_reader(reader)
    writer.add_metadata({"/Title": secret, "/Author": secret, "/Subject": secret})
    writer.add_attachment("private.txt", secret.encode())
    note = DictionaryObject({NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Text"),
                             NameObject("/Rect"): ArrayObject([NumberObject(20), NumberObject(20), NumberObject(30), NumberObject(30)]),
                             NameObject("/Contents"): TextStringObject(secret)})
    writer.pages[1][NameObject("/Annots")] = ArrayObject([writer._add_object(note)])
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue(), secret


def test_secure_redaction_removes_text_attachments_metadata_and_original_object_streams():
    source, secret = private_source()
    digest = hashlib.sha256(source).hexdigest()
    with closing(MarkStore()) as store:
        uploaded = store.add(source, "Private.pdf")
        line = next(value for value in store.page_selection(uploaded["id"], 1)["lines"] if secret in value["text"])
    selection = MarkRect(page=1, **{key: line[key] for key in ("x", "y", "width", "height")})
    output = secure_redaction(source, [selection], 150)
    reader = PdfReader(io.BytesIO(output))
    assert len(reader.pages) == 2
    assert all(not page.extract_text().strip() for page in reader.pages)
    assert not reader.attachments
    assert secret not in str(reader.metadata)
    assert secret.encode() not in output
    assert "/AcroForm" not in reader.trailer["/Root"]
    assert all("/Annots" not in page for page in reader.pages)
    with render(output) as image:
        pixel = image.getpixel((int((selection.x + selection.width / 2) * image.width), int((selection.y + selection.height / 2) * image.height)))
        assert max(pixel) < 15
    # Untouched pages retain their visible content, while their old resources do not survive.
    with render(source, 1) as before, render(output, 1) as after:
        assert before.size == after.size
        crop = (40, 40, 250, 70)
        assert min(before.crop(crop).getextrema()[0]) < 100
        assert min(after.crop(crop).getextrema()[0]) < 100
    assert hashlib.sha256(source).hexdigest() == digest


@pytest.mark.parametrize("rotation,unit", [(0, 1), (90, 2), (180, 1), (270, 2)])
def test_redaction_preserves_visible_physical_page_size(rotation, unit):
    source = altered_pdf(sample_pdf([["PRIVATE"]]), rotation, unit, True)
    with pdfium.PdfDocument(source) as document, closing(document[0]) as page:
        width, height = page.get_size()
    output = secure_redaction(source, [MarkRect(page=1, x=.1, y=.1, width=.2, height=.1)], 150)
    result = PdfReader(io.BytesIO(output))
    assert float(result.pages[0].mediabox.width) == pytest.approx(width * unit, abs=.001)
    assert float(result.pages[0].mediabox.height) == pytest.approx(height * unit, abs=.001)
    assert result.pages[0].rotation == 0


def test_redaction_pixel_preflight_rejects_before_any_render(monkeypatch):
    monkeypatch.setattr(marks, "MAX_REDACTION_PAGE_PIXELS", 10)
    def forbidden(*args, **kwargs):
        raise AssertionError("render started before pixel preflight")
    monkeypatch.setattr(pdfium.PdfPage, "render", forbidden)
    with pytest.raises(ValueError, match="150 DPI"):
        secure_redaction(sample_pdf(), [MarkRect(page=1, x=.1, y=.1, width=.2, height=.1)], 300)
    with pytest.raises(ValueError, match="zuschneiden"):
        secure_redaction(sample_pdf(), [MarkRect(page=1, x=.1, y=.1, width=.2, height=.1)], 150)


def test_total_redaction_budget_is_checked_for_every_page_before_render(monkeypatch):
    monkeypatch.setattr(marks, "MAX_REDACTION_TOTAL_PIXELS", 10_000_000)
    def forbidden(*args, **kwargs):
        raise AssertionError("A first page was rendered before the total document budget was checked")
    monkeypatch.setattr(pdfium.PdfPage, "render", forbidden)
    with pytest.raises(ValueError, match="kleinere Dokumente"):
        secure_redaction(sample_pdf(), [MarkRect(page=1, x=.1, y=.1, width=.2, height=.1)], 300)


def test_a0_plan_can_be_redacted_at_explicit_150_dpi():
    writer = PdfWriter()
    width, height = 841 * 72 / 25.4, 1189 * 72 / 25.4
    writer.add_blank_page(width=width, height=height)
    source = io.BytesIO(); writer.write(source)
    output = secure_redaction(source.getvalue(), [MarkRect(page=1, x=.2, y=.2, width=.2, height=.1)], 150)
    reader = PdfReader(io.BytesIO(output))
    assert float(reader.pages[0].mediabox.width) == pytest.approx(width, abs=.001)
    assert float(reader.pages[0].mediabox.height) == pytest.approx(height, abs=.001)
    assert not reader.pages[0].extract_text()
    with pytest.raises(ValueError, match="150 DPI"):
        secure_redaction(source.getvalue(), [MarkRect(page=1, x=.2, y=.2, width=.2, height=.1)], 300)


@pytest.fixture()
def client():
    app = FastAPI()
    def authorize(request, *, key=False):
        if request.headers.get("X-Edeco-Pdf") != "test-session":
            raise HTTPException(403, "session required")
    marks.register_marks(app, authorize)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        yield client


def test_api_requires_session_confirmation_and_valid_selections(client):
    root = API + "/mark-documents"
    assert client.post(root, files={"file": ("x.pdf", sample_pdf())}).status_code == 403
    headers = {"X-Edeco-Pdf": "test-session"}
    source = sample_pdf([["PRIVATE LINE"]])
    uploaded = client.post(root, headers=headers, files={"file": ("Plan.pdf", source)}).json()
    endpoint = root + "/" + uploaded["id"]
    assert client.get(endpoint + "/pages/1", headers=headers).status_code == 200
    assert client.get(endpoint + "/pages/2", headers=headers).status_code == 400
    position = {"page": 1, "x": .1, "y": .1, "width": .3, "height": .1}
    assert client.post(endpoint + "/redact", headers=headers, json={"positions": [position]}).status_code == 400
    assert client.post(endpoint + "/redact", headers=headers, json={"positions": [position], "confirmed": True, "dpi": 999}).status_code == 400
    response = client.post(endpoint + "/redact", headers=headers, json={"positions": [position], "confirmed": True, "dpi": 150})
    assert response.status_code == 200 and response.content.startswith(b"%PDF-")
    assert response.headers["X-Edeco-Redaction-Mode"] == "image-pdf"
    signature = client.post(endpoint + "/signature", headers=headers, files={"image": ("signature.png", appearance_png(), "image/png")}, data={"positions": json.dumps([position])})
    assert signature.status_code == 200 and signature.headers["Content-Type"] == "application/pdf"
    invalid = client.post(endpoint + "/signature", headers=headers, files={"image": ("signature.png", appearance_png(), "image/png")}, data={"positions": json.dumps([{**position, "x": .99}])})
    assert invalid.status_code == 400
    assert client.delete(endpoint, headers=headers).status_code == 204
    assert client.get(endpoint + "/pages/1", headers=headers).status_code == 404
