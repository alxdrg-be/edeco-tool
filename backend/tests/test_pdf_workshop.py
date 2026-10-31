"""Stirling adapter, same-origin proxy and company-controlled output profiles."""

import json

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from edeco_toolbox.pdf_workshop import API, ROOT
from edeco_toolbox.pdf_workshop.api import register
from edeco_toolbox.pdf_workshop.client import Crop, PdfFile, StirlingClient
from edeco_toolbox.pdf_workshop.config import service_url
from test_documents import sample_pdf


@pytest.fixture
def pdf_api(tmp_path, monkeypatch):
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path))
    monkeypatch.delenv("EDECO_STIRLING_URL", raising=False)
    monkeypatch.delenv("EDECO_PDF_COMPANY_CONFIG", raising=False)
    app = FastAPI(); register(app)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        yield client, app


def state(client):
    value = client.get(API + "/state").json()
    return value, {"X-Edeco-Pdf": value["session_key"]}


def test_connection_and_embedded_ui_require_same_origin_and_session(pdf_api):
    client, _ = pdf_api
    assert client.get(ROOT + "/").status_code == 403
    assert client.get(API + "/state", headers={"Host": "evil.example"}).status_code == 403
    assert client.get(API + "/state", headers={"Origin": "https://evil.example"}).status_code == 403
    value, headers = state(client)
    assert value["title"] == "edeco PDF-Werkstatt"
    assert client.post(API + "/connection", json={"service_url": "http://pdf-server:8088"}).status_code == 403
    assert client.post(API + "/connection", json={"service_url": "http://pdf-server:8088"}, headers={**headers, "Origin": "https://evil.example"}).status_code == 403
    assert client.get(ROOT + "/edeco/theme.css").status_code == 200
    assert "__EDECO_ACCENT__" not in client.get(ROOT + "/edeco/theme.css").text
    assert client.get(ROOT + "/edeco/logo.svg").headers["content-type"].startswith("image/svg+xml")


def test_proxy_preserves_stirling_page_and_streams_files_without_forwarding_local_cookie(pdf_api):
    client, app = pdf_api
    state(client)
    calls = []
    async def handler(request):
        calls.append(request.url.path)
        assert "edeco_pdf_session" not in request.headers.get("Cookie", "")
        assert request.url.path.startswith(ROOT + "/")
        if request.url.path.endswith("test.pdf"):
            return httpx.Response(200, headers={"Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="test.pdf"'}, stream=httpx.ByteStream(sample_pdf()))
        return httpx.Response(200, text='<html><head><title>Stirling</title></head><body>Original Stirling UI</body></html>', headers={"Content-Type": "text/html"})
    app.state.pdf_proxy_transport = httpx.MockTransport(handler)
    page = client.get(ROOT + "/")
    assert page.status_code == 200 and "Original Stirling UI" in page.text
    assert "edeco PDF-Werkstatt" in page.text and "/edeco/bridge.js" in page.text and "/edeco/theme.css" in page.text
    pdf = client.get(ROOT + "/test.pdf")
    assert pdf.content == sample_pdf() and pdf.headers["content-disposition"].endswith('"test.pdf"')
    assert len(calls) == 2


def test_proxy_blocks_cross_origin_and_external_redirects(pdf_api):
    client, app = pdf_api
    state(client)
    app.state.pdf_proxy_transport = httpx.MockTransport(lambda request: httpx.Response(302, headers={"Location": "https://outside.example/"}))
    assert client.get(ROOT + "/", headers={"Origin": "https://outside.example"}).status_code == 403
    assert client.get(ROOT + "/").status_code == 502


def test_company_workflow_only_writes_approved_folder_and_never_overwrites(pdf_api, tmp_path, monkeypatch):
    client, app = pdf_api
    _, headers = state(client)
    folder = tmp_path / "Entwurf"; folder.mkdir()
    app.state.pdf_workshop.company = {"workflows": [{"id": "draft", "title": "Als Entwurf ablegen", "target_folder": str(folder), "stamp": "ENTWURF"}]}
    calls = []
    def stamp(self, file, text):
        calls.append(text); return file.data
    monkeypatch.setattr(StirlingClient, "stamp", stamp)
    for _ in range(2):
        result = client.post(API + "/workflows/draft", headers=headers, files={"file": ("../Plan.pdf", sample_pdf())})
        assert result.status_code == 200 and result.json()["ok"]
    assert len(list(folder.glob("Plan_Entwurf_*.pdf"))) == 2 and calls == ["ENTWURF", "ENTWURF"]
    assert client.post(API + "/workflows/missing", headers=headers, files={"file": ("a.pdf", sample_pdf())}).status_code == 404
    assert client.post(API + "/workflows/draft", headers=headers, files={"file": ("a.pdf", b"not pdf")}).status_code == 400


def test_managed_company_url_cannot_be_replaced_from_ui(pdf_api):
    client, app = pdf_api
    app.state.pdf_workshop.company = {"service_url": "http://pdf-server:8088", "accent": "bad CSS;"}
    value, headers = state(client)
    assert value["managed"] and value["accent"] == "#c26279"
    assert client.post(API + "/connection", headers=headers, json={"service_url": "http://other:8088"}).status_code == 400


@pytest.mark.parametrize("url", ["file:///etc/passwd", "http://user:password@server", "http://server/?key=secret", "http://server:bad", "http://server/other"])
def test_service_url_rejects_credential_leaks_and_non_service_urls(url):
    with pytest.raises(ValueError):
        service_url(url)


def test_controller_delegates_three_operations_to_stirling_instead_of_rewriting_pdf_logic():
    operations = []
    def handler(request):
        operations.append(request.url.path)
        assert request.headers["X-API-KEY"] == "test-key"
        assert b'filename="scan.pdf"' in request.content
        return httpx.Response(200, content=sample_pdf(), headers={"Content-Type": "application/pdf"})
    client = StirlingClient("http://pdf-server:8088", "test-key", transport=httpx.MockTransport(handler))
    file = PdfFile("scan.pdf", sample_pdf())
    assert client.merge([file, file]).startswith(b"%PDF-")
    assert client.crop(file, Crop(10, 20, 200, 300)).startswith(b"%PDF-")
    assert client.resize(file, "A3").startswith(b"%PDF-")
    assert client.ocr(file).startswith(b"%PDF-")
    assert operations == [ROOT + "/api/v1/" + name for name in ["general/merge-pdfs", "general/crop", "general/scale-pages", "misc/ocr-pdf"]]


def test_controller_rejects_invalid_input_and_non_pdf_responses():
    client = StirlingClient("http://pdf-server:8088", transport=httpx.MockTransport(lambda r: httpx.Response(200, text="Login required")))
    file = PdfFile("a.pdf", sample_pdf())
    for action in [lambda: client.merge([file]), lambda: client.crop(file, Crop(0, 0, -1, 4)),
                   lambda: client.resize(file, "wrong"), lambda: client.ocr(file, languages=()),
                   lambda: client.merge([file, file]), lambda: client.raster_images(file, 900)]:
        with pytest.raises(ValueError):
            action()
