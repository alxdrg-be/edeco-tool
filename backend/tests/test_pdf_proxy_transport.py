"""Core startup must never receive a partial configuration or script as HTTP 200."""

import gzip

import httpx
import pytest

from edeco_toolbox.pdf_workshop import ROOT
from test_pdf_workshop import pdf_api, state  # noqa: F401


class InterruptedStream(httpx.AsyncByteStream):
    def __init__(self, prefix=b"partial"):
        self.prefix = prefix
        self.closed = False

    async def __aiter__(self):
        yield self.prefix
        raise httpx.RemoteProtocolError("peer closed connection without sending complete message body")

    async def aclose(self):
        self.closed = True


def test_proxy_read_only_requests_do_not_send_an_empty_chunked_body(pdf_api):
    client, app = pdf_api
    state(client)
    calls = []

    async def handler(request):
        calls.append(request.method)
        assert "transfer-encoding" not in request.headers
        assert await request.aread() == b""
        return httpx.Response(200, headers={"Content-Type": "application/json"}, stream=httpx.ByteStream(b"{}"))

    app.state.pdf_proxy_transport = httpx.MockTransport(handler)
    assert client.get(ROOT + "/api/v1/config/app-config").content == b"{}"
    assert client.head(ROOT + "/api/v1/config/app-config").content == b""
    assert calls == ["GET", "HEAD"]


@pytest.mark.parametrize("path,kind,payload", [
    ("api/v1/config/app-config", "application/json", b'{"language":"de-DE"}'),
    ("api/v1/config/endpoints-availability", "application/json", b'{"merge":true}'),
    ("assets/vendor-pdfium.js", "application/javascript", b'export const ready = true;'),
    ("assets/pdfium.wasm", "application/wasm", b"\x00asm\x01\x00\x00\x00" * 256),
])
def test_interrupted_frontend_read_retries_before_sending_success(pdf_api, path, kind, payload):
    client, app = pdf_api
    state(client)
    broken = InterruptedStream(payload[:5])
    calls = []

    async def handler(request):
        calls.append(request.url.path)
        return httpx.Response(200, headers={"Content-Type": kind},
                              stream=broken if len(calls) == 1 else httpx.ByteStream(payload))

    app.state.pdf_proxy_transport = httpx.MockTransport(handler)
    response = client.get(ROOT + "/" + path)
    assert response.status_code == 200 and response.content == payload
    assert response.headers["content-length"] == str(len(payload))
    assert calls == [ROOT + "/" + path] * 2
    assert broken.closed


def test_persistent_frontend_failure_is_a_complete_noncacheable_502(pdf_api):
    client, app = pdf_api
    state(client)
    streams = []

    async def handler(request):
        stream = InterruptedStream(b"broken script")
        streams.append(stream)
        return httpx.Response(200, headers={"Content-Type": "application/javascript"}, stream=stream)

    app.state.pdf_proxy_transport = httpx.MockTransport(handler)
    response = client.get(ROOT + "/assets/vendor-zip.js")
    assert response.status_code == 502
    assert response.headers["cache-control"] == "no-store"
    assert b"broken script" not in response.content
    assert len(streams) == 2 and all(stream.closed for stream in streams)


def test_buffered_encoded_asset_keeps_raw_bytes_and_head_range_metadata(pdf_api):
    client, app = pdf_api
    state(client)
    payload = b"\x00asm\x01\x00\x00\x00" * 1024
    packed = gzip.compress(payload)
    calls = []

    async def handler(request):
        calls.append(request)
        if request.method == "HEAD":
            return httpx.Response(200, headers={"Content-Type": "application/wasm", "Content-Length": str(len(packed)),
                                               "Content-Encoding": "gzip", "ETag": '"pdfium"'}, stream=httpx.ByteStream(b""))
        if request.headers.get("range"):
            return httpx.Response(206, headers={"Content-Type": "application/wasm", "Content-Range": f"bytes 0-7/{len(payload)}"},
                                  stream=httpx.ByteStream(payload[:8]))
        return httpx.Response(200, headers={"Content-Type": "application/wasm", "Content-Encoding": "gzip", "ETag": '"pdfium"'},
                              stream=httpx.ByteStream(packed))

    app.state.pdf_proxy_transport = httpx.MockTransport(handler)
    response = client.get(ROOT + "/assets/pdfium.wasm")
    assert response.content == payload and response.headers["content-encoding"] == "gzip"
    assert response.headers["content-length"] == str(len(packed))
    head = client.head(ROOT + "/assets/pdfium.wasm")
    assert head.content == b"" and head.headers["content-length"] == str(len(packed))
    ranged = client.get(ROOT + "/assets/pdfium.wasm", headers={"Range": "bytes=0-7"})
    assert ranged.status_code == 206 and ranged.content == payload[:8]
    assert ranged.headers["content-range"] == f"bytes 0-7/{len(payload)}"
    assert len(calls) == 3


def test_encoded_html_retry_decodes_before_branding_and_recomputes_length(pdf_api):
    client, app = pdf_api
    state(client)
    packed = gzip.compress(b"<html><head><title>Core</title></head><body>Core UI</body></html>")
    broken = InterruptedStream(packed[:5])
    calls = []

    async def handler(request):
        calls.append(request.url.path)
        return httpx.Response(200, headers={"Content-Type": "text/html", "Content-Encoding": "gzip"},
                              stream=broken if len(calls) == 1 else httpx.ByteStream(packed))

    app.state.pdf_proxy_transport = httpx.MockTransport(handler)
    response = client.get(ROOT + "/")
    assert response.status_code == 200 and "Core UI" in response.text
    assert "edeco PDF-Werkstatt" in response.text and response.text.count("/edeco/bridge.js") == 1
    assert "content-encoding" not in response.headers
    assert response.headers["content-length"] == str(len(response.content))
    assert len(calls) == 2 and broken.closed


def test_frontend_response_budget_closes_without_replaying_or_leaking_partial_data(pdf_api, monkeypatch):
    from edeco_toolbox.pdf_workshop import api

    client, app = pdf_api
    state(client)
    monkeypatch.setattr(api, "MAX_FRONTEND_RESPONSE", 10)
    streams = []

    async def handler(request):
        stream = InterruptedStream(b"this asset already exceeds the complete response budget")
        streams.append(stream)
        return httpx.Response(200, headers={"Content-Type": "application/javascript"}, stream=stream)

    app.state.pdf_proxy_transport = httpx.MockTransport(handler)
    response = client.get(ROOT + "/assets/too-large.js")
    assert response.status_code == 502 and response.headers["cache-control"] == "no-store"
    assert b"this asset" not in response.content
    assert len(streams) == 1 and streams[0].closed


def test_processing_post_is_never_replayed_after_an_upstream_body_failure(pdf_api):
    client, app = pdf_api
    state(client)
    calls = []
    broken = InterruptedStream(b"%PDF-1.7\n")

    async def handler(request):
        calls.append(await request.aread())
        return httpx.Response(200, headers={"Content-Type": "application/pdf"}, stream=broken)

    app.state.pdf_proxy_transport = httpx.MockTransport(handler)
    with pytest.raises(httpx.RemoteProtocolError):
        client.post(ROOT + "/api/v1/general/merge-pdfs", content=b"uploaded PDF bytes")
    assert calls == [b"uploaded PDF bytes"] and broken.closed
