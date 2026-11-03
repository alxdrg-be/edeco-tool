"""Real rotated-page crops, vector retention, physical units and API boundaries."""

import hashlib
import io
import json
from contextlib import closing

import pypdfium2 as pdfium
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image, ImageChops
from pydantic import ValidationError
from pypdf import PdfReader, PdfWriter
from pypdf.generic import NameObject, NumberObject, TextStringObject

from edeco_toolbox.documents.extract import PDF_LOCK
from edeco_toolbox.pdf_workshop import API
from edeco_toolbox.pdf_workshop import crop as crop_module
from edeco_toolbox.pdf_workshop.api import register
from edeco_toolbox.pdf_workshop.crop import CropRect, CropRequest, CropStore, page_user_units
from test_documents import sample_pdf


def illustrated_pdf(rotation=0, inherited=False, shifted=True):
    """Independent raw PDF with visible quadrant marks, vectors and actual text."""
    media = "[10 20 210 180]" if shifted else "[0 0 200 160]"
    crop = "[30 40 190 160]" if shifted else "[20 20 180 140]"
    transform = "1 0 0 1 10 20 cm\n" if shifted else ""
    stream = (transform + "\n".join([
        "1 0 0 rg 20 20 80 60 re f", "0 1 0 rg 100 20 80 60 re f",
        "0 0 1 rg 20 80 80 60 re f", "1 0.7 0 rg 100 80 80 60 re f",
        "0 0 0 RG 2 w 25 25 m 170 130 l S",
        "0 0 0 rg BT /F1 10 Tf 55 95 Td (CROP VECTOR TEXT) Tj ET",
    ])).encode("ascii")
    geometry = f"/MediaBox {media} /CropBox {crop} /Rotate {rotation}"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Count 1 /Kids [4 0 R] {geometry if inherited else ''} >>".encode(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Type /Page /Parent 2 0 R {'' if inherited else geometry} /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>".encode(),
        f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream",
    ]
    output = bytearray(b"%PDF-1.7\n")
    offsets = [0]
    for index, value in enumerate(objects, 1):
        offsets.append(len(output))
        output.extend(f"{index} 0 obj\n".encode() + value + b"\nendobj\n")
    start = len(output)
    output.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010} 00000 n \n".encode())
    output.extend(f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode())
    return bytes(output)


def render(data, index=0, scale=3):
    with PDF_LOCK, pdfium.PdfDocument(data) as doc, closing(doc[index]) as page, closing(page.render(scale=scale)) as bitmap:
        return bitmap.to_pil().convert("RGB")


@pytest.fixture
def store():
    value = CropStore()
    yield value
    value.close()


@pytest.fixture
def crop_api(tmp_path, monkeypatch):
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path))
    monkeypatch.delenv("EDECO_PDF_RUNTIME", raising=False)
    app = FastAPI()
    register(app)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        key = client.get(API + "/state").json()["session_key"]
        yield client, {"X-Edeco-Pdf": key}, app


def upload(client, headers, data=None, name="Plan.pdf"):
    return client.post(API + "/crop-documents", headers=headers,
                       files={"file": (name, data if data is not None else sample_pdf(), "application/pdf")})


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
@pytest.mark.parametrize("inherited", [False, True])
def test_crop_matches_independent_visible_pixel_rectangle_for_each_rotation_and_inherited_box(store, rotation, inherited):
    original = illustrated_pdf(rotation, inherited)
    before = hashlib.sha256(original).hexdigest()
    added = store.add(original, "Quadrants.pdf")
    rect = CropRect(x=.125, y=.25, width=.625, height=.5)
    source = render(original)
    expected = source.crop((round(source.width * .125), round(source.height * .25),
                            round(source.width * .75), round(source.height * .75)))
    data, filename = store.crop(added["id"], CropRequest(pages="all", rect=rect))
    actual = render(data)
    assert actual.size == expected.size
    # PDFium's translated antialiasing can round an edge channel by one unit;
    # every pixel must otherwise match the independent visible-image crop.
    assert all(maximum <= 1 for _, maximum in ImageChops.difference(actual, expected).getextrema())
    assert filename == "Quadrants_zugeschnitten.pdf"
    # The crop changes page boxes only: original vectors and text layer survive.
    with PDF_LOCK, pdfium.PdfDocument(original) as source_doc, pdfium.PdfDocument(data) as crop_doc:
        with closing(source_doc[0]) as source_page, closing(crop_doc[0]) as crop_page, closing(crop_page.get_textpage()) as text:
            assert len(list(source_page.get_objects())) == len(list(crop_page.get_objects()))
            assert "VECTOR" in text.get_text_range()
    assert store._documents[added["id"]].path.read_bytes() == original
    assert hashlib.sha256(original).hexdigest() == before


def test_page_selection_keeps_other_pages_and_source_unchanged(store):
    original = sample_pdf([["FIRST PAGE"], ["SECOND PAGE"]])
    doc = store.add(original, "Grundriss.pdf")
    data, _ = store.crop(doc["id"], CropRequest(pages=[2], rect=CropRect(x=0, y=0, width=.5, height=.75)))
    with PDF_LOCK, pdfium.PdfDocument(data) as pdf:
        assert len(pdf) == 2
        with closing(pdf[0]) as first, closing(pdf[1]) as second:
            assert first.get_size() == (595, 842)
            assert second.get_size() == pytest.approx((297.5, 631.5))
    assert store._documents[doc["id"]].path.read_bytes() == original


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_preview_metadata_is_rotated_visible_page_not_media_size(store, rotation):
    doc = store.add(illustrated_pdf(rotation), "Page.pdf")
    page = doc["pages"][0]
    assert (page["width"], page["height"]) == ((160, 120) if rotation in (0, 180) else (120, 160))
    assert page["rotation"] == rotation
    assert page["user_unit"] == 1
    image = Image.open(io.BytesIO(store.preview(doc["id"], 1, 800)))
    assert image.width == 800
    assert image.width / image.height == pytest.approx(page["width"] / page["height"], abs=.002)


def unit_pdf(value):
    reader = PdfReader(io.BytesIO(illustrated_pdf()))
    writer = PdfWriter()
    writer.add_page(reader.pages[0])
    writer.pages[0][NameObject("/UserUnit")] = value
    result = io.BytesIO()
    writer.write(result)
    return result.getvalue()


def test_user_unit_is_reported_separately_from_pdfium_canvas_units(store):
    original = unit_pdf(NumberObject(2))
    doc = store.add(original, "Large plan.pdf")
    page = doc["pages"][0]
    assert page["user_unit"] == 2
    assert (page["width"], page["height"]) == (160, 120)
    cropped, _ = store.crop(doc["id"], CropRequest(rect=CropRect(x=0, y=0, width=.5, height=.5)))
    assert page_user_units(cropped, 1) == [2]


def test_bad_or_unreadable_physical_metadata_is_unknown_not_silently_one(store):
    assert page_user_units(b"not pdf", 1) == [None]
    assert page_user_units(illustrated_pdf(), 2) == [None, None]
    assert store.add(unit_pdf(TextStringObject("broken")), "Unknown unit.pdf")["pages"][0]["user_unit"] is None
    assert page_user_units(unit_pdf(NumberObject(-1)), 1) == [None]


def test_expiry_remove_cache_and_lifespan_cleanup(tmp_path):
    now = [0.0]
    value = CropStore(clock=lambda: now[0])
    doc = value.add(illustrated_pdf(), "Plan.pdf")
    path = value._documents[doc["id"]].path
    value.preview(doc["id"], 1, 800)
    assert value._cache_size > 0
    now[0] = crop_module.DOCUMENT_TTL + 1
    with pytest.raises(KeyError):
        value.preview(doc["id"], 1, 800)
    assert not path.exists()
    assert not value._cache and value._cache_size == 0
    next_doc = value.add(illustrated_pdf(), "Next.pdf")
    root = value._root
    value.remove(next_doc["id"])
    value.remove(next_doc["id"])
    value.close()
    value.close()
    assert not root.exists()


def test_api_works_without_java_preserves_unicode_filename_and_removes_temp_doc(crop_api):
    client, headers, app = crop_api
    response = upload(client, headers, name="../Übersicht Zürich.pdf")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    doc = response.json()
    assert doc["name"] == "Übersicht Zürich.pdf"
    assert doc["page_count"] == 2
    path = API + f'/crop-documents/{doc["id"]}'
    preview = client.get(path + "/pages/1?width=800", headers=headers)
    assert preview.status_code == 200
    assert preview.content.startswith(b"\x89PNG")
    cropped = client.post(path + "/crop", headers=headers, json={"pages": [1], "rect": {"x": 0, "y": 0, "width": .8, "height": .7}})
    assert cropped.status_code == 200
    assert cropped.headers["content-type"] == "application/pdf"
    assert "filename*=UTF-8''%C3%9Cbersicht%20Z%C3%BCrich_zugeschnitten.pdf" in cropped.headers["content-disposition"]
    assert client.delete(path, headers=headers).status_code == 204
    assert client.get(path + "/pages/1", headers=headers).status_code == 404
    assert not app.state.pdf_workshop.runtime


def test_every_crop_route_requires_session_and_same_origin(crop_api):
    client, headers, _ = crop_api
    assert upload(client, {}, name="a.pdf").status_code == 403
    assert upload(client, {**headers, "Origin": "https://evil.example"}).status_code == 403
    assert upload(client, {**headers, "Host": "evil.example"}).status_code == 403
    doc = upload(client, headers).json()
    path = API + f'/crop-documents/{doc["id"]}'
    assert client.get(path + "/pages/1").status_code == 403
    assert client.post(path + "/crop", json={"rect": {"x": 0, "y": 0, "width": 1, "height": 1}}).status_code == 403
    assert client.delete(path).status_code == 403


@pytest.mark.parametrize("rect", [
    {"x": -1, "y": 0, "width": 1, "height": 1},
    {"x": .8, "y": 0, "width": .4, "height": 1},
    {"x": 0, "y": 0, "width": 0, "height": 1},
    {"x": 0, "y": .9, "width": 1, "height": .2},
    {"x": 0, "y": 0, "width": 1, "height": 1, "rotation": 90},
])
def test_invalid_rectangles_never_crop(rect):
    with pytest.raises(ValidationError):
        CropRect.model_validate(rect)


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_json_has_safe_http_error(crop_api, bad):
    client, headers, _ = crop_api
    doc = upload(client, headers).json()
    body = json.dumps({"rect": {"x": 0, "y": 0, "width": bad, "height": 1}})
    response = client.post(API + f'/crop-documents/{doc["id"]}/crop', headers={**headers, "Content-Type": "application/json"}, content=body)
    assert response.status_code == 400
    assert "gültige" in response.json()["detail"]


@pytest.mark.parametrize("pages", [[], [0], [3], [1, 1], [True], [1.2]])
def test_bad_page_selection_is_rejected(crop_api, pages):
    client, headers, _ = crop_api
    doc = upload(client, headers).json()
    response = client.post(API + f'/crop-documents/{doc["id"]}/crop', headers=headers,
                           json={"pages": pages, "rect": {"x": 0, "y": 0, "width": 1, "height": 1}})
    assert response.status_code == 400


def test_size_document_page_render_limits_and_encrypted_files(store, monkeypatch):
    original = illustrated_pdf()
    for invalid in (b"", b"not pdf", b"%PDF-broken"):
        with pytest.raises(ValueError):
            store.add(invalid, "bad.pdf")
    monkeypatch.setattr(crop_module, "MAX_UPLOAD_BYTES", len(original) - 1)
    with pytest.raises(ValueError, match="100 MB"):
        store.add(original, "large.pdf")
    monkeypatch.setattr(crop_module, "MAX_UPLOAD_BYTES", len(original) * 100)
    monkeypatch.setattr(crop_module, "MAX_PAGES", 1)
    with pytest.raises(ValueError, match="2000"):
        store.add(sample_pdf(), "pages.pdf")
    monkeypatch.setattr(crop_module, "MAX_DOCUMENTS", 1)
    doc = store.add(original, "a.pdf")
    with pytest.raises(ValueError, match="Speicher"):
        store.add(original, "b.pdf")
    for width in (199, 4097):
        with pytest.raises(ValueError):
            store.preview(doc["id"], 1, width)
    with pytest.raises(ValueError):
        store.preview(doc["id"], 0, 800)
    with pytest.raises(ValueError, match="zu klein"):
        store.crop(doc["id"], CropRequest(rect=CropRect(x=0, y=0, width=.000001, height=1)))
    store.remove(doc["id"])
    writer = PdfWriter()
    writer.add_page(PdfReader(io.BytesIO(original)).pages[0])
    writer.encrypt("")
    encrypted = io.BytesIO()
    writer.write(encrypted)
    with pytest.raises(ValueError, match="geschützt"):
        store.add(encrypted.getvalue(), "protected.pdf")


def test_crop_store_is_closed_when_api_lifespan_ends(tmp_path, monkeypatch):
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path))
    app = FastAPI()
    register(app)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        headers = {"X-Edeco-Pdf": client.get(API + "/state").json()["session_key"]}
        doc = upload(client, headers).json()
        root = app.state.pdf_crop._root
        assert root.exists() and doc["id"] in app.state.pdf_crop._documents
    assert not root.exists()
