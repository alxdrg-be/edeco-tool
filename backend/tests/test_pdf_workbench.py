"""Native page operations against real PDFs, without a running Core service."""
import base64
import hashlib
import io
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image, ImageChops
from pydantic import ValidationError
from pypdf import PdfReader, PdfWriter

from edeco_toolbox.pdf_workshop import API
from edeco_toolbox.pdf_workshop import workbench
from edeco_toolbox.pdf_workshop.api import register
from edeco_toolbox.pdf_workshop.client import PdfFile, StirlingClient
from edeco_toolbox.pdf_workshop.workbench import PageSelection, compose_pdf, inspect_pdf, open_pdf
from test_documents import sample_pdf
from test_pdf_crop import illustrated_pdf, render, unit_pdf
from pypdf.generic import NumberObject


@pytest.fixture
def native_api(tmp_path, monkeypatch):
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path))
    monkeypatch.delenv("EDECO_PDF_RUNTIME", raising=False)
    app = FastAPI()
    register(app)
    # Every native operation must work when the external engine is unavailable.
    monkeypatch.setattr(StirlingClient, "operation", lambda *a, **kw: pytest.fail("Native operation contacted Core"))
    with TestClient(app, base_url="http://127.0.0.1") as client:
        key = client.get(API + "/state").json()["session_key"]
        yield client, {"X-Edeco-Pdf": key}, app


def test_compose_reorders_multiple_inputs_extracts_and_duplicates_without_linking_rotation():
    first = sample_pdf([["FIRST"], ["SECOND"], ["DELETE ME"]])
    second = sample_pdf([["OTHER FILE"]])
    hashes = [hashlib.sha256(data).hexdigest() for data in (first, second)]
    result = compose_pdf([PdfFile("a.pdf", first), PdfFile("b.pdf", second)], [
        PageSelection(file=1, page=1), PageSelection(file=0, page=2, rotation=90),
        PageSelection(file=0, page=1), PageSelection(file=0, page=2, rotation=270),
    ])
    output = PdfReader(io.BytesIO(result))
    assert [page.extract_text().strip() for page in output.pages] == ["OTHER FILE", "SECOND", "FIRST", "SECOND"]
    assert [page.rotation for page in output.pages] == [0, 90, 0, 270]
    assert hashes == [hashlib.sha256(data).hexdigest() for data in (first, second)]


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_inspect_thumbnail_matches_actual_rotated_visible_page_and_reports_boxes(rotation):
    source = illustrated_pdf(rotation, inherited=True)
    info = inspect_pdf(source)
    page = info["pages"][0]
    assert info["page_count"] == 1 and page["number"] == 1
    assert page["rotation"] == rotation and page["user_unit"] == 1
    assert page["media_box"] == [10, 20, 210, 180]
    assert page["crop_box"] == [30, 40, 190, 160]
    assert (page["width"], page["height"]) == ((160, 120) if rotation in (0, 180) else (120, 160))
    thumbnail = Image.open(io.BytesIO(base64.b64decode(page["thumbnail"].split(",", 1)[1]))).convert("RGB")
    expected = render(source, scale=360 / 160)
    assert thumbnail.size == expected.size
    assert ImageChops.difference(thumbnail, expected).getbbox() is None


def test_inspect_distinguishes_physical_user_unit_from_canvas_width():
    page = inspect_pdf(unit_pdf(NumberObject(2)))["pages"][0]
    assert page["user_unit"] == 2 and page["width"] == 160


@pytest.mark.parametrize("values", [
    {"file": -1, "page": 1}, {"file": 0, "page": 0}, {"file": True, "page": 1},
    {"file": 0, "page": "1"}, {"file": 0, "page": 1, "rotation": 45},
    {"file": 0, "page": 1, "rotation": False}, {"file": 0, "page": 1, "path": "x"},
])
def test_strict_page_selection_rejects_coercions_and_unexpected_fields(values):
    with pytest.raises(ValidationError):
        PageSelection.model_validate(values)


@pytest.mark.parametrize("password", ["secret", ""])
def test_encrypted_inputs_require_explicit_unlock_even_with_an_empty_password(password):
    writer = PdfWriter()
    writer.add_blank_page(72, 72)
    writer.encrypt(password)
    output = io.BytesIO()
    writer.write(output)
    with pytest.raises(ValueError, match="geschützt"):
        inspect_pdf(output.getvalue())


@pytest.mark.parametrize("data", [b"not pdf", b"%PDF-1.7\ntruncated", b""])
def test_corrupt_inputs_are_explained_as_invalid_pdfs(data):
    with pytest.raises(ValueError):
        open_pdf(data)


def test_inspect_limit_is_checked_before_thumbnail_rendering():
    writer = PdfWriter()
    for _ in range(101):
        writer.add_blank_page(10, 10)
    output = io.BytesIO()
    writer.write(output)
    with pytest.raises(ValueError, match="100"):
        inspect_pdf(output.getvalue())


def test_native_routes_share_session_and_origin_guards_and_return_no_store(native_api):
    client, headers, _ = native_api
    files = {"file": ("Plan.pdf", sample_pdf([["ONE PAGE"]]))}
    assert client.post(API + "/inspect", files=files).status_code == 403
    assert client.post(API + "/inspect", files=files, headers={**headers, "Origin": "https://evil.example"}).status_code == 403
    assert client.post(API + "/inspect", files=files, headers={**headers, "Host": "evil.example"}).status_code == 403
    response = client.post(API + "/inspect", files=files, headers=headers)
    assert response.status_code == 200 and response.json()["page_count"] == 1
    assert response.headers["cache-control"] == "no-store"
    result = client.post(API + "/compose", headers=headers, files=[("files", ("Plan.pdf", sample_pdf()))],
                         data={"pages": json.dumps([{"file": 0, "page": 1, "rotation": 90}])})
    assert result.status_code == 200 and result.content.startswith(b"%PDF-")
    assert result.headers["cache-control"] == "no-store"
    assert PdfReader(io.BytesIO(result.content)).pages[0].rotation == 90


@pytest.mark.parametrize("selection", ["not JSON", "{}", "[]", '[{"file":1,"page":1}]', '[{"file":0,"page":2}]', '[{"file":0,"page":1,"rotation":NaN}]'])
def test_compose_api_rejects_invalid_json_indices_empty_and_nonfinite_selection(native_api, selection):
    client, headers, _ = native_api
    response = client.post(API + "/compose", headers=headers, files=[("files", ("a.pdf", sample_pdf([["ONE PAGE"]])))], data={"pages": selection})
    assert response.status_code == 400


def test_writer_enforces_output_budget_during_serialization(monkeypatch):
    writer = PdfWriter()
    writer.add_blank_page(72, 72)
    monkeypatch.setattr(workbench, "MAX_STORE_BYTES", 100)
    with pytest.raises(ValueError, match="gross"):
        workbench.writer_bytes(writer)
