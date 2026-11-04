"""OCR/compression workspace: real Core processing and local text-layer evidence.

Counts describe the searchable text actually present in the returned PDF. They
are deliberately not a claim that OCR recognised every word correctly.
"""
from __future__ import annotations

import io
import json
import math
import re
from contextlib import closing
from typing import Literal

import pypdfium2 as pdfium
from fastapi import File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, ValidationError
from pypdf import PdfReader
from pypdf.errors import PyPdfError

from ..documents.extract import MAX_TEXT, PDF_LOCK
from . import API
from .client import PdfFile, StirlingClient
from .crop import MAX_STORE_BYTES, NO_STORE, disposition, page_geometry, safe_filename
from .workbench import MAX_INSPECT_PAGES, inspect_pdf, open_pdf, read_pdf

MAX_MATCHES = 2000
WORD = re.compile(r"[^\W_]+(?:[’'\-][^\W_]+)*", re.UNICODE)


class ProcessingOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    languages: list[Literal["deu", "eng"]] = Field(default_factory=lambda: ["deu", "eng"], min_length=1, max_length=2)
    force_ocr: StrictBool = False
    quality: StrictInt = Field(default=5, ge=1, le=9)


def text_statistics(data: bytes) -> dict:
    """Count Unicode words in the PDF text layer, including pre-existing text."""
    if not data or len(data) > MAX_STORE_BYTES:
        raise ValueError("Die PDF-Ausgabe ist leer oder überschreitet 250 MB.")
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            raise ValueError("Das PDF ist geschützt. Bitte zuerst mit dem passenden Passwort entsperren.")
        if not 1 <= len(reader.pages) <= MAX_INSPECT_PAGES:
            raise ValueError("Die kompakte Ansicht unterstützt 1 bis 100 Seiten. Für grössere PDFs bitte „Erweiterte Funktionen“ verwenden.")
        pages = []
        total_chars = 0
        with PDF_LOCK, pdfium.PdfDocument(data) as document:
            if len(document) != len(reader.pages):
                raise ValueError("Die PDF-Seitenstruktur ist widersprüchlich.")
            signatures = pdfium.raw.FPDF_GetSignatureCount(document)
            for index in range(len(document)):
                with closing(document[index]) as page, closing(page.get_textpage()) as text_page:
                    if total_chars + text_page.count_chars() > MAX_TEXT:
                        raise ValueError("Das PDF enthält zu viel Text. Bitte kleinere Dokumente verwenden.")
                    text = text_page.get_text_range()
                    total_chars += len(text)
                    if total_chars > MAX_TEXT:
                        raise ValueError("Das PDF enthält zu viel Text. Bitte kleinere Dokumente verwenden.")
                    pages.append({"number": index + 1, "words": len(WORD.findall(text)), "has_text": bool(text.strip())})
        return {"page_count": len(pages), "pages_with_text": sum(page["has_text"] for page in pages), "signatures": signatures,
                "word_count": sum(page["words"] for page in pages), "text_pages": pages}
    except (pdfium.PdfiumError, PyPdfError):
        raise ValueError("Die Textschicht des PDFs konnte nicht gelesen werden.") from None


def size_statistics(before: int, after: int) -> dict:
    if before <= 0 or after <= 0:
        raise ValueError("Für den Grössenvergleich sind zwei nicht leere Dateien nötig.")
    difference = before - after
    return {"input_bytes": before, "output_bytes": after, "saved_bytes": difference,
            "saved_percent": round(difference * 100 / before, 2)}


def normalised_rect(box, bbox, rotation: int) -> list[float]:
    """PDF text coordinates -> rotated visible page, origin at top left."""
    left, bottom, right, top = bbox
    width, height = right - left, top - bottom

    def point(x, y):
        if rotation == 90:
            return (y - bottom) / height, (x - left) / width
        if rotation == 180:
            return (right - x) / width, (y - bottom) / height
        if rotation == 270:
            return (top - y) / height, (right - x) / width
        return (x - left) / width, (top - y) / height

    x0, y0, x1, y1 = box
    corners = [point(x, y) for x, y in ((x0, y0), (x0, y1), (x1, y0), (x1, y1))]
    xs, ys = zip(*corners)
    return [max(0, min(1, min(xs))), max(0, min(1, min(ys))),
            max(0, min(1, max(xs))), max(0, min(1, max(ys)))]


def search_text(data: bytes, query: str) -> dict:
    query = query.strip()
    if not query or len(query) > 200 or "\x00" in query:
        raise ValueError("Bitte einen Suchtext mit 1 bis 200 Zeichen eingeben.")
    open_pdf(data, max_pages=MAX_INSPECT_PAGES)
    matches = []
    examined = total_chars = 0
    try:
        with PDF_LOCK, pdfium.PdfDocument(data) as document:
            for index in range(len(document)):
                with closing(document[index]) as page, closing(page.get_textpage()) as text_page:
                    total_chars += text_page.count_chars()
                    if total_chars > MAX_TEXT:
                        raise ValueError("Das PDF enthält zu viel Text. Bitte kleinere Dokumente verwenden.")
                    _, _, bbox, rotation = page_geometry(page)
                    with closing(text_page.search(query, match_case=False, match_whole_word=False)) as searcher:
                        while (match := searcher.get_next()) is not None:
                            examined += 1
                            start, count = match
                            rectangles = []
                            for number in range(text_page.count_rects(start, count)):
                                raw = text_page.get_rect(number)
                                if not all(math.isfinite(value) for value in raw):
                                    continue
                                rect = normalised_rect(raw, bbox, rotation)
                                if rect[2] > rect[0] and rect[3] > rect[1]:
                                    rectangles.append(rect)
                            # Text outside the visible cropbox is not a visible match.
                            if rectangles:
                                matches.append({"page": index + 1, "rects": rectangles})
                            if len(matches) >= MAX_MATCHES or examined >= MAX_MATCHES * 5:
                                return {"query": query, "matches": matches, "truncated": True}
        return {"query": query, "matches": matches, "truncated": False}
    except pdfium.PdfiumError:
        raise ValueError("Die PDF-Textsuche konnte nicht ausgeführt werden.") from None


def process_document(client: StirlingClient, tool: str, source: PdfFile, options: ProcessingOptions) -> tuple[bytes, dict]:
    before = text_statistics(source.data)
    if tool == "ocr":
        data = client.ocr(source, tuple(dict.fromkeys(options.languages)), force=options.force_ocr)
    elif tool == "compress":
        data = client.operation("misc/compress-pdf", [source], {"optimizeLevel": str(options.quality),
                                                               "linearize": "false", "normalize": "false"})
    else:
        raise ValueError("Dieses Werkzeug wird hier nicht unterstützt.")
    after = text_statistics(data)
    if after["page_count"] != before["page_count"]:
        raise ValueError("Die Verarbeitung hat die Seitenzahl verändert. Bitte die erweiterten PDF-Werkzeuge verwenden.")
    return data, {**after, **size_statistics(len(source.data), len(data)),
                  "input_words": before["word_count"], "input_pages_with_text": before["pages_with_text"]}


def register_processing(app, authorize, config):
    @app.post(API + "/processing/inspect")
    def inspect(request: Request, file: UploadFile = File(...)):
        authorize(request, key=True)
        try:
            data = read_pdf(file)
            statistics = text_statistics(data)
            return Response(json.dumps({**inspect_pdf(data), **statistics}), media_type="application/json", headers=NO_STORE)
        except (ValueError, PyPdfError, pdfium.PdfiumError) as exc:
            raise HTTPException(400, str(exc) if isinstance(exc, ValueError) else "Das PDF konnte nicht geöffnet werden.") from None
        finally:
            file.file.close()

    @app.post(API + "/processing/search")
    def search(request: Request, file: UploadFile = File(...), query: str = Form(..., max_length=200)):
        authorize(request, key=True)
        try:
            return Response(json.dumps(search_text(read_pdf(file), query)), media_type="application/json", headers=NO_STORE)
        except (ValueError, PyPdfError, pdfium.PdfiumError) as exc:
            raise HTTPException(400, str(exc) if isinstance(exc, ValueError) else "Die PDF-Suche ist fehlgeschlagen.") from None
        finally:
            file.file.close()

    @app.post(API + "/processing/{tool}")
    def run(request: Request, tool: str, file: UploadFile = File(...), options: str = Form("{}")):
        authorize(request, key=True)
        try:
            if tool not in {"ocr", "compress"}:
                raise HTTPException(404, "Dieses Verarbeitungswerkzeug ist nicht verfügbar.")
            if len(options) > 2000:
                raise ValueError("Die Einstellungen sind zu umfangreich.")
            settings = ProcessingOptions.model_validate(json.loads(options))
            if config.runtime and not config.runtime.health().get("ready"):
                raise HTTPException(409, "Die lokale PDF-Engine startet noch. Bitte kurz warten.")
            client = StirlingClient(config.url, config.api_key,
                                   engine_secret=config.runtime.secret if config.runtime else "",
                                   transport=getattr(app.state, "pdf_processing_transport", None))
            source = PdfFile(safe_filename(file.filename or "Dokument.pdf"), read_pdf(file))
            data, statistics = process_document(client, tool, source, settings)
            stem = source.name.rsplit(".", 1)[0][:130] or "Dokument"
            name = stem + ("_durchsuchbar.pdf" if tool == "ocr" else "_komprimiert.pdf")
            return Response(data, media_type="application/pdf", headers={**NO_STORE,
                            "Content-Disposition": disposition(name),
                            "X-Edeco-Pdf-Statistics": json.dumps(statistics, separators=(",", ":"))})
        except (ValueError, ValidationError, PyPdfError, pdfium.PdfiumError) as exc:
            message = str(exc) if isinstance(exc, ValueError) and not isinstance(exc, ValidationError) else "Bitte gültige PDF-Einstellungen wählen."
            raise HTTPException(400, message) from None
        finally:
            file.file.close()
