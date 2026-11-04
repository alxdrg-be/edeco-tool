"""Real text-layer evidence, rotated search geometry and bounded processing APIs."""
from contextlib import closing
import io
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient
import httpx
import pypdfium2 as pdfium
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject
import pytest

from edeco_toolbox.pdf_workshop.api import register
from edeco_toolbox.pdf_workshop.client import PdfFile, StirlingClient
from edeco_toolbox.pdf_workshop.processing import (ProcessingOptions, process_document, search_text,
                                                  size_statistics, text_statistics)
from test_documents import sample_pdf
from test_pdf_stirling_live import engine  # noqa: F401 - actual pinned Core/runtime fixture


def test_word_count_describes_existing_result_text_not_ocr_accuracy():
    source = sample_pdf([["Schutzleiter Pruefung Stromkreis-1 16"], ["Second approved page"]])
    value = text_statistics(source)
    assert value["word_count"] == 7
    assert value["page_count"] == value["pages_with_text"] == 2
    assert [page["words"] for page in value["text_pages"]] == [4, 3]
    writer = PdfWriter()
    writer.add_blank_page(width=300, height=400)
    output = io.BytesIO(); writer.write(output)
    assert text_statistics(output.getvalue())["word_count"] == 0
    assert text_statistics(output.getvalue())["pages_with_text"] == 0


@pytest.mark.parametrize("rotation", [0, 90, 180, 270])
def test_search_marks_align_with_actual_rotated_cropped_page_render(rotation):
    reader = PdfReader(io.BytesIO(sample_pdf([["Protective conductor test"], ["CONDUCTOR approved"]])))
    reader.pages[0].cropbox = RectangleObject([60, 710, 360, 820])
    reader.pages[0].rotate(rotation)
    writer = PdfWriter(); writer.append_pages_from_reader(reader)
    output = io.BytesIO(); writer.write(output)
    source = output.getvalue()
    matches = search_text(source, "conductor")
    assert [match["page"] for match in matches["matches"]] == [1, 2]
    with pdfium.PdfDocument(source) as document, closing(document[0]) as page, closing(page.get_textpage()) as text:
        with closing(text.search("conductor", match_case=False)) as search:
            start, count = search.get_next()
        assert text.count_rects(start, count) == 1
        left, bottom, right, top = text.get_rect(0)
        with closing(page.render(scale=2)) as bitmap:
            conversion = bitmap.get_posconv(page)
            points = [conversion.to_bitmap(x, y) for x, y in ((left, bottom), (left, top), (right, bottom), (right, top))]
            xs, ys = zip(*points)
            expected = [min(xs) / bitmap.width, min(ys) / bitmap.height, max(xs) / bitmap.width, max(ys) / bitmap.height]
    assert matches["matches"][0]["rects"][0] == pytest.approx(expected, abs=.006)


def test_no_match_and_bounded_unicode_search():
    source = sample_pdf([["SCHUTZLEITER"], ["Schutzleiter"]])
    assert len(search_text(source, "schutzleiter")["matches"]) == 2
    assert search_text(source, "missing")["matches"] == []
    for query in ("", " ", "x" * 201, "abc\x00"):
        with pytest.raises(ValueError):
            search_text(source, query)


def test_text_budget_is_checked_before_extracting_large_strings(monkeypatch):
    from edeco_toolbox.pdf_workshop import processing

    monkeypatch.setattr(processing, "MAX_TEXT", 5)
    source = sample_pdf([["More than five text characters"]])
    with pytest.raises(ValueError, match="zu viel Text"):
        text_statistics(source)
    with pytest.raises(ValueError, match="zu viel Text"):
        search_text(source, "text")


def test_size_comparison_is_signed_and_never_claims_growth_is_a_saving():
    assert size_statistics(1000, 750) == {"input_bytes": 1000, "output_bytes": 750, "saved_bytes": 250, "saved_percent": 25.0}
    assert size_statistics(1000, 1500)["saved_percent"] == -50.0
    assert size_statistics(1000, 1000)["saved_bytes"] == 0


@pytest.mark.parametrize("tool", ["ocr", "compress"])
def test_processing_keeps_original_and_reports_real_result_bytes_and_words(tool):
    original = sample_pdf([["OLD TEXT"]])
    result = sample_pdf([["SEARCHABLE NEW RESULT TEXT"]]) + b"\n" * 2000
    requests = []

    def core(request):
        requests.append(request)
        assert original in request.read()
        if tool == "ocr":
            assert request.url.path.endswith("misc/ocr-pdf")
            assert b"force-ocr" in request.read()
        else:
            assert request.url.path.endswith("misc/compress-pdf")
            assert b"optimizeLevel" in request.read()
        return httpx.Response(200, content=result, headers={"Content-Type": "application/pdf"})

    client = StirlingClient("http://engine:8080", transport=httpx.MockTransport(core))
    processed, stats = process_document(client, tool, PdfFile("source.pdf", original), ProcessingOptions(force_ocr=True))
    assert processed == result and len(requests) == 1
    assert stats["input_bytes"] == len(original) and stats["output_bytes"] == len(result)
    assert stats["saved_bytes"] == len(original) - len(result)
    assert stats["word_count"] == 4 and stats["input_words"] == 2
    assert original == sample_pdf([["OLD TEXT"]])


def test_unexpected_page_loss_is_not_presented_as_a_successful_result():
    client = StirlingClient("http://engine:8080", transport=httpx.MockTransport(lambda _request: httpx.Response(200, content=sample_pdf([["ONE"]]))))
    with pytest.raises(ValueError, match="Seitenzahl"):
        process_document(client, "compress", PdfFile("source.pdf", sample_pdf([["ONE"], ["TWO"]])), ProcessingOptions())


@pytest.fixture()
def processing_api(tmp_path, monkeypatch):
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path / "home"))
    monkeypatch.setenv("EDECO_STIRLING_URL", "http://engine:8080")
    app = FastAPI(); register(app)
    app.state.pdf_processing_transport = httpx.MockTransport(lambda _request: httpx.Response(200, content=sample_pdf([["FINAL SEARCHABLE TEXT"]])))
    with TestClient(app, base_url="http://127.0.0.1") as client:
        yield client, {"X-Edeco-Pdf": client.get("/api/tools/pdf-werkstatt/state").json()["session_key"]}


def test_processing_routes_require_session_and_clear_source_boundaries(processing_api):
    client, headers = processing_api
    root = "/api/tools/pdf-werkstatt/processing"
    source = sample_pdf([["SOURCE TEXT"]])
    for path in ("inspect", "search", "ocr", "compress"):
        assert client.post(root + "/" + path, files={"file": ("source.pdf", source)}, data={"query": "text"}).status_code == 403
    inspect = client.post(root + "/inspect", headers=headers, files={"file": ("source.pdf", source)})
    assert inspect.status_code == 200 and inspect.json()["word_count"] == 2
    assert inspect.headers["Cache-Control"] == "no-store"
    assert inspect.json()["pages"][0]["thumbnail"].startswith("data:image/png;base64,")
    search = client.post(root + "/search", headers=headers, files={"file": ("source.pdf", source)}, data={"query": "text"})
    assert search.status_code == 200 and len(search.json()["matches"]) == 1
    for options in ('{"quality": true}', '{"force_ocr": "yes"}', '{"languages": ["foo"]}', '{"unknown": 4}', "broken"):
        assert client.post(root + "/ocr", headers=headers, files={"file": ("source.pdf", source)}, data={"options": options}).status_code == 400
    result = client.post(root + "/ocr", headers=headers, files={"file": ("source.pdf", source)})
    assert result.status_code == 200 and result.content.startswith(b"%PDF-")
    assert result.headers["Content-Type"].startswith("application/pdf")
    assert json.loads(result.headers["X-Edeco-Pdf-Statistics"])["word_count"] == 3
    assert client.post(root + "/inspect", headers=headers, files={"file": ("bad.pdf", b"not PDF")}).status_code == 400


def test_live_ocr_reports_searchable_words_from_the_actual_result(engine):
    from PIL import Image, ImageDraw, ImageFont
    from pathlib import Path
    import os

    font_path = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts/arial.ttf" if os.name == "nt" else Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    image = Image.new("RGB", (1600, 2200), "white")
    drawing = ImageDraw.Draw(image)
    drawing.text((100, 220), "Protective conductor inspection complete", font=ImageFont.truetype(str(font_path), 50), fill="black")
    data = io.BytesIO(); image.save(data, format="PDF", resolution=200); image.close()
    source = data.getvalue()
    assert text_statistics(source)["word_count"] == 0
    result, stats = process_document(engine, "ocr", PdfFile("scan.pdf", source), ProcessingOptions())
    assert stats["word_count"] >= 4 and stats["pages_with_text"] == 1
    assert stats["input_words"] == 0 and stats["input_bytes"] == len(source) and stats["output_bytes"] == len(result)
    assert search_text(result, "conductor")["matches"]
    assert not search_text(source, "conductor")["matches"]


def test_live_compression_reports_actual_saved_bytes_and_keeps_page_content(engine):
    from PIL import Image

    image = Image.effect_noise((800, 1100), 35).convert("RGB")
    data = io.BytesIO(); image.save(data, format="PDF", resolution=100); image.close()
    source = data.getvalue()
    result, stats = process_document(engine, "compress", PdfFile("image.pdf", source), ProcessingOptions(quality=8))
    assert stats["saved_bytes"] == len(source) - len(result)
    assert stats["saved_bytes"] > 0
    assert stats["saved_percent"] == round(100 * (len(source) - len(result)) / len(source), 2)
    with pdfium.PdfDocument(result) as document, closing(document[0]) as page, closing(page.render(scale=.2)) as bitmap:
        assert bitmap.width > 0 and stats["page_count"] == len(document) == 1
