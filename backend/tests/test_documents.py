"""Real PDF extraction/rendering, persistent sources and grounded AI responses."""

import base64
import io
import json
import sys

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

from edeco_toolbox.documents import ai
from edeco_toolbox.documents.api import PREFIX, register
from edeco_toolbox.documents.store import DocumentStore


def sample_pdf(pages=None, rotation=0):
    """Synthetic test guideline, with an actual PDF text layer and coordinates."""
    pages = pages if pages is not None else [
        ["Test-Richtlinie, keine echte Norm", "Inhalt und Vorwort"],
        ["Pruefung der Anlage", "Vor Inbetriebnahme ist der Schutzleiter zu pruefen.",
         "Die Messergebnisse sind im Pruefprotokoll zu dokumentieren."]]
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b"", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    page_ids = []
    for lines in pages:
        page_id = len(objects) + 1
        page_ids.append(page_id)
        objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Rotate {rotation} /Resources << /Font << /F1 3 0 R >> >> /Contents {page_id+1} 0 R >>".encode())
        operators = ["BT /F1 12 Tf 50 780 Td 20 TL"]
        for index, line in enumerate(lines):
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            operators.append(("T* " if index else "") + f"({escaped}) Tj")
        operators.append("ET")
        stream = "\n".join(operators).encode("latin-1")
        objects.append(f"<< /Length {len(stream)} >>\nstream\n".encode() + stream + b"\nendstream")
    objects[1] = f"<< /Type /Pages /Count {len(page_ids)} /Kids [{' '.join(str(i)+' 0 R' for i in page_ids)}] >>".encode()
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, value in enumerate(objects, 1):
        offsets.append(len(output)); output.extend(f"{index} 0 obj\n".encode() + value + b"\nendobj\n")
    start = len(output)
    output.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        output.extend(f"{offset:010} 00000 n \n".encode())
    output.extend(f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode())
    return bytes(output)


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_pdf_source_page_lines_and_highlights_match_original_pixels(tmp_path, rotation):
    store = DocumentStore(tmp_path)
    document = store.add(sample_pdf(rotation=rotation), "test-richtlinie.pdf", edition="Testausgabe 2026")["document"]
    sources = store.search("Wie muss der Schutzleiter geprueft werden?", [document["id"]])
    assert len(sources) == 1
    source = sources[0]
    assert source["page"] == 2 and source["edition"] == "Testausgabe 2026"
    assert "Schutzleiter" in source["text"] and source["start_line"] == 1
    page = store.page(document["id"], 2)
    image = Image.open(io.BytesIO(base64.b64decode(page["image"].split(",", 1)[1]))).convert("RGB")
    for line in page["lines"]:
        left, top, right, bottom = line["box"]
        assert 0 <= left < right <= 1 and 0 <= top < bottom <= 1
        crop = image.crop((int(left * image.width), int(top * image.height), int(right * image.width), int(bottom * image.height)))
        assert min(channel[0] for channel in crop.getextrema()) < 150, "highlight must cover the real printed text"


def test_text_lines_selection_duplicates_and_delete_survive_restart(tmp_path):
    store = DocumentStore(tmp_path)
    first = store.add(b"Vorwort\n\nSchutzleiter pruefen.\n", "../pruefung.txt", edition="2025")["document"]
    second = store.add(b"Andere Aussage zum Schutzleiter.", "andere.txt", edition="2026")["document"]
    assert first["filename"] == "pruefung.txt"
    assert store.add(b"Vorwort\n\nSchutzleiter pruefen.\n", "kopie.txt")["duplicate"] is True
    store = DocumentStore(tmp_path)
    assert store.page(first["id"], 1)["lines"][2] == {"number": 3, "text": "Schutzleiter pruefen.", "box": None}
    assert [source["document_id"] for source in store.search("Schutzleiter", [first["id"]])] == [first["id"]]
    store.remove(first["id"])
    assert not store.search("Schutzleiter", [first["id"]])
    assert not (store.originals / f"{first['id']}.txt").exists()
    assert len(store.list()) == 1 and store.get(second["id"])["edition"] == "2026"


def test_scanned_pdf_is_reported_without_fabricating_text(tmp_path):
    store = DocumentStore(tmp_path)
    doc = store.add(sample_pdf([[]]), "scan.pdf")["document"]
    assert doc["empty_pages"] == doc["pages"] == 1
    assert store.search("Pruefung", [doc["id"]]) == []
    assert store.page(doc["id"], 1)["image"].startswith("data:image/png;base64,")


@pytest.mark.parametrize("filename,data", [("bad.pdf", b"not a PDF"), ("x.txt", b"a\0b"), ("x.exe", b"MZ"), ("leer.txt", b"")])
def test_invalid_documents_leave_no_originals_or_index(tmp_path, filename, data):
    store = DocumentStore(tmp_path)
    with pytest.raises(ValueError):
        store.add(data, filename)
    assert not store.list() and not list(store.originals.iterdir())


@pytest.fixture
def document_api(tmp_path, monkeypatch):
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path))
    monkeypatch.delenv("EDECO_AI_API_KEY", raising=False)
    app = FastAPI(); register(app)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        state = client.get(PREFIX + "/state").json()
        yield client, app, {"X-Edeco-Documents": state["session_key"]}


def test_api_requires_local_session_for_documents_questions_and_originals(document_api):
    client, _, headers = document_api
    file = {"file": ("test.txt", b"Schutzleiter pruefen.")}
    assert client.post(PREFIX + "/documents", files=file).status_code == 403
    assert client.get(PREFIX + "/state", headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.get(PREFIX + "/state", headers={"Host": "evil.example"}).status_code == 403
    response = client.post(PREFIX + "/documents", files=file, headers=headers)
    doc = response.json()["document"]
    assert client.get(PREFIX + f"/documents/{doc['id']}/file").status_code == 403
    assert client.get(PREFIX + f"/documents/{doc['id']}/file", headers=headers).content == b"Schutzleiter pruefen."
    assert client.post(PREFIX + "/ask", headers=headers, json={"question": "Schutzleiter", "document_ids": []}).status_code == 400
    assert client.post(PREFIX + "/ask", headers=headers, json={"question": "Schutzleiter", "document_ids": ["missing"]}).status_code == 400
    assert client.get(PREFIX + f"/documents/{doc['id']}/pages/500", headers=headers).status_code == 404


def test_no_evidence_never_contacts_ai_and_missing_key_keeps_sources(document_api, monkeypatch):
    client, app, headers = document_api
    doc = client.post(PREFIX + "/documents", files={"file": ("test.txt", b"Schutzleiter pruefen.")}, headers=headers).json()["document"]
    body = {"question": "Photovoltaik", "document_ids": [doc["id"]], "use_ai": True}
    def forbidden(*args):
        raise AssertionError("No evidence must not trigger a remote API request")
    with monkeypatch.context() as patch:
        patch.setattr(app.state.document_ai, "answer", forbidden)
        result = client.post(PREFIX + "/ask", json=body, headers=headers).json()
    assert result["sources"] == [] and result["blocks"] == []
    body["question"] = "Schutzleiter"
    result = client.post(PREFIX + "/ask", json=body, headers=headers).json()
    assert len(result["sources"]) == 1 and result["blocks"] == [] and "Verbindung" in result["message"]


def test_remote_ai_receives_only_retrieved_text_and_returns_validated_sources(tmp_path, monkeypatch):
    monkeypatch.delenv("EDECO_AI_API_KEY", raising=False)
    store = DocumentStore(tmp_path)
    doc = store.add(sample_pdf(), "test.pdf")["document"]
    sources = store.search("Schutzleiter", [doc["id"]])
    settings = ai.AISettings(tmp_path)
    public = settings.save(ai.DEFAULT_ENDPOINT, "test-model", "secret-test-key")
    assert public["has_key"] and "secret-test-key" not in json.dumps(public)
    assert "secret-test-key" not in settings.path.read_text()
    if sys.platform == "win32":
        assert ai.AISettings(tmp_path).key == "secret-test-key"
    else:
        assert ai.AISettings(tmp_path).key == ""
    def handler(request):
        payload = json.loads(request.content)
        context = json.loads(payload["messages"][1]["content"])
        assert request.headers["Authorization"] == "Bearer secret-test-key"
        assert context["sources"][0]["page"] == 2
        assert "Vorwort" not in request.content.decode() and "%PDF" not in request.content.decode()
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps({"blocks": [{
            "text": "Vor Inbetriebnahme ist der Schutzleiter zu prüfen.", "source_ids": ["S1"]}]})}}]})
    original = httpx.Client
    monkeypatch.setattr(ai.httpx, "Client", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    assert settings.answer("Was ist zu prüfen?", sources)[0]["source_ids"] == ["S1"]


@pytest.mark.parametrize("blocks", [[{"text": "Erfunden", "source_ids": ["S99"]}], [{"text": "Ohne Beleg", "source_ids": []}], [{"text": "Falsch", "source_ids": [None]}]])
def test_fabricated_or_missing_citations_are_rejected(blocks):
    with pytest.raises(ValueError):
        ai.validated_blocks({"blocks": blocks}, {"S1"})


@pytest.mark.parametrize("url", ["http://example.com/api", "https://user:secret@example.com/api", "https://example.com/?api_key=secret"])
def test_settings_reject_unencrypted_or_url_embedded_credentials(tmp_path, url):
    with pytest.raises(ValueError):
        ai.AISettings(tmp_path).save(url, "model", "key")


def test_free_shared_ollama_needs_no_key_and_sends_only_retrieved_excerpts(document_api, monkeypatch):
    client, _, headers = document_api
    doc = client.post(PREFIX + "/documents", files={"file": ("test.pdf", sample_pdf())}, headers=headers).json()["document"]
    saved = client.post(PREFIX + "/settings", json={"provider": "ollama", "endpoint": "http://ki-server:11434/api/chat", "model": "qwen3:4b"}, headers=headers).json()
    assert saved["configured"] is True and saved["has_key"] is False
    calls = []
    def handler(request):
        calls.append(request.url.path)
        assert "Authorization" not in request.headers
        if request.method == "GET":
            assert request.url.path == "/api/tags"
            return httpx.Response(200, json={"models": [{"name": "qwen3:4b"}]})
        payload = json.loads(request.content)
        assert payload["stream"] is False and payload["think"] is False and payload["format"] == "json"
        assert payload["model"] == "qwen3:4b"
        context = json.loads(payload["messages"][1]["content"])
        assert context["sources"][0]["page"] == 2
        assert "Vorwort" not in request.content.decode()
        return httpx.Response(200, json={"message": {"content": json.dumps({"blocks": [
            {"text": "Der Schutzleiter ist vor Inbetriebnahme zu prüfen.", "source_ids": ["S1"]}]})}})
    original = httpx.Client
    monkeypatch.setattr(ai.httpx, "Client", lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))
    checked = client.post(PREFIX + "/connection", headers=headers).json()
    assert checked["ok"] is True
    answer = client.post(PREFIX + "/ask", headers=headers, json={"question": "Schutzleiter", "document_ids": [doc["id"]], "use_ai": True}).json()
    assert answer["mode"] == "ai" and answer["blocks"][0]["source_ids"] == ["S1"]
    assert answer["sources"][0]["page"] == 2 and calls == ["/api/tags", "/api/chat"]


def test_changing_provider_or_server_does_not_forward_previous_api_key(tmp_path):
    settings = ai.AISettings(tmp_path)
    settings.save(ai.DEFAULT_ENDPOINT, "test-model", "private-key")
    changed = settings.save("http://192.168.1.30:11434/api/chat", "qwen3:4b", provider="ollama")
    assert changed["configured"] is True and changed["has_key"] is False


def test_ollama_server_rejects_public_plain_http_and_wrong_api_path(tmp_path):
    settings = ai.AISettings(tmp_path)
    for url in ("http://example.com/api/chat", "http://8.8.8.8/api/chat", "http://ki-server:11434/"):
        with pytest.raises(ValueError):
            settings.save(url, "qwen3:4b", provider="ollama")
