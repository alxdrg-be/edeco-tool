"""Temporary local crop previews and vector-preserving PDF page-box export.

Coordinates are normalised in the intrinsically rotated visible page, with the
origin at the top left. All PDFium operations use the shared process-wide lock.
The Java service is not needed for this document editor.
"""
from __future__ import annotations

import io
import json
import math
import re
import secrets
import tempfile
import threading
import time
import unicodedata
from collections import OrderedDict
from contextlib import asynccontextmanager, closing
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal
from urllib.parse import quote

import pypdfium2 as pdfium
from fastapi import Body, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, StrictInt, ValidationError, model_validator
from pypdf import PdfReader
from pypdf.generic import FloatObject, NumberObject

from ..documents.extract import PDF_LOCK
from . import API

MAX_UPLOAD_BYTES = 100 * 1024 * 1024
MAX_STORE_BYTES = 250 * 1024 * 1024
MAX_DOCUMENTS = 6
MAX_PAGES = 2000
MAX_RENDER_EDGE = 4096
MAX_RENDER_PIXELS = 12_000_000
MAX_CACHE_BYTES = 16 * 1024 * 1024
DOCUMENT_TTL = 30 * 60
NO_STORE = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}


class CropRect(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x: FiniteFloat = Field(ge=0, le=1)
    y: FiniteFloat = Field(ge=0, le=1)
    width: FiniteFloat = Field(gt=0, le=1)
    height: FiniteFloat = Field(gt=0, le=1)

    @model_validator(mode="after")
    def inside_page(self):
        if self.x + self.width > 1 + 1e-9 or self.y + self.height > 1 + 1e-9:
            raise ValueError("Der Ausschnitt muss vollständig innerhalb der sichtbaren PDF-Seite liegen.")
        return self


class CropRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pages: Literal["all"] | list[StrictInt] = Field(default="all")
    rect: CropRect


@dataclass
class CropDocument:
    id: str
    name: str
    path: Path
    size: int
    pages: list[dict]
    touched: float
    signatures: int = 0

    def public(self):
        return {"id": self.id, "name": self.name, "page_count": len(self.pages),
                "pages": self.pages, "signatures": self.signatures,
                "coordinate_system": "normalised-rotated-visible-page", "page_unit": "pdf_canvas"}


def safe_filename(value: str) -> str:
    name = value.replace("\\", "/").rsplit("/", 1)[-1]
    name = re.sub(r'[\x00-\x1f\x7f<>:"|?*]', "_", name).strip(" .")[:160]
    return name or "Dokument.pdf"


def crop_filename(value: str) -> str:
    return (Path(value).stem[:135].rstrip(" .") or "Dokument") + "_zugeschnitten.pdf"


def disposition(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    ascii_name = re.sub(r'[^A-Za-z0-9 ._()-]', "_", ascii_name) or "Dokument_zugeschnitten.pdf"
    return f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(name, safe="")}'


def page_user_units(data: bytes, page_count: int) -> list[float | None]:
    """Read physical units that PDFium does not expose; unknown is not one point."""
    unknown = [None] * page_count
    try:
        with PdfReader(io.BytesIO(data), strict=False) as reader:
            if len(reader.pages) != page_count:
                return unknown
            units = []
            for page in reader.pages:
                if "/UserUnit" not in page:
                    units.append(1.0)
                    continue
                raw = page["/UserUnit"].get_object()
                if not isinstance(raw, (FloatObject, NumberObject)):
                    units.append(None)
                    continue
                value = float(raw)
                units.append(value if math.isfinite(value) and 0 < value <= 75000 else None)
            return units
    except Exception:
        # Optional physical-scale metadata must not block valid PDFium crops.
        return unknown


def page_geometry(page) -> tuple[float, float, tuple[float, float, float, float], int]:
    width, height = page.get_size()
    bbox = tuple(page.get_bbox())
    rotation = page.get_rotation()
    if (rotation not in {0, 90, 180, 270} or len(bbox) != 4
            or not all(math.isfinite(value) for value in (width, height, *bbox))
            or min(width, height) <= 0 or max(width, height) > 10_000_000
            or bbox[2] <= bbox[0] or bbox[3] <= bbox[1]):
        raise ValueError("Diese PDF-Seite hat keinen gültigen sichtbaren Seitenrahmen.")
    return width, height, bbox, rotation


def original_cropbox(bbox: tuple[float, float, float, float], rotation: int,
                     rect: CropRect) -> tuple[float, float, float, float]:
    """Invert intrinsic page rotation, retaining nonzero visible-box origins."""
    left, bottom, right, top = bbox
    width, height = right - left, top - bottom
    x0, y0 = rect.x, rect.y
    x1, y1 = min(1, x0 + rect.width), min(1, y0 + rect.height)
    if rotation == 0:
        box = (left + x0 * width, top - y1 * height, left + x1 * width, top - y0 * height)
    elif rotation == 90:
        box = (left + y0 * width, bottom + x0 * height, left + y1 * width, bottom + x1 * height)
    elif rotation == 180:
        box = (right - x1 * width, bottom + y0 * height, right - x0 * width, bottom + y1 * height)
    elif rotation == 270:
        box = (right - y1 * width, top - x1 * height, right - y0 * width, top - x0 * height)
    else:
        raise ValueError("Diese Seitendrehung wird nicht unterstützt.")
    if min(box[2] - box[0], box[3] - box[1]) < .01:
        raise ValueError("Der Ausschnitt ist zu klein. Bitte einen grösseren Bereich wählen.")
    return box


class CropStore:
    def __init__(self, *, clock: Callable[[], float] = time.monotonic):
        self._directory = tempfile.TemporaryDirectory(prefix="edeco-pdf-crop-")
        self._root = Path(self._directory.name)
        self._clock = clock
        self._lock = threading.RLock()
        self._documents: dict[str, CropDocument] = {}
        self._cache: OrderedDict[tuple[str, int, int], bytes] = OrderedDict()
        self._cache_size = 0
        self._closed = False

    def _discard(self, document_id):
        document = self._documents.pop(document_id, None)
        if document:
            document.path.unlink(missing_ok=True)
        for key in list(self._cache):
            if key[0] == document_id:
                self._cache_size -= len(self._cache.pop(key))

    def _purge(self):
        for document_id, document in list(self._documents.items()):
            if self._clock() - document.touched >= DOCUMENT_TTL:
                self._discard(document_id)

    def _get(self, document_id):
        if self._closed:
            raise KeyError(document_id)
        self._purge()
        document = self._documents.get(document_id)
        if not document:
            raise KeyError(document_id)
        document.touched = self._clock()
        return document

    def add(self, data: bytes, filename: str):
        if not data or len(data) > MAX_UPLOAD_BYTES or not data.lstrip().startswith(b"%PDF-"):
            raise ValueError("Bitte eine gültige PDF-Datei mit höchstens 100 MB wählen.")
        with self._lock:
            if self._closed:
                raise ValueError("Die PDF-Sitzung wurde beendet. Bitte die Werkstatt neu öffnen.")
            self._purge()
            if len(self._documents) >= MAX_DOCUMENTS or sum(d.size for d in self._documents.values()) + len(data) > MAX_STORE_BYTES:
                raise ValueError("Der temporäre PDF-Speicher ist voll. Zuerst eine geöffnete PDF schliessen.")
            try:
                with PDF_LOCK, pdfium.PdfDocument(data) as doc:
                    if pdfium.raw.FPDF_GetSecurityHandlerRevision(doc) >= 0:
                        raise ValueError("Das PDF ist geschützt. Bitte zuerst mit dem passenden Passwort entsperren.")
                    if not 1 <= len(doc) <= MAX_PAGES:
                        raise ValueError("PDF-Dateien mit 1 bis 2000 Seiten werden unterstützt.")
                    pages = []
                    for index in range(len(doc)):
                        with closing(doc[index]) as page:
                            width, height, _, rotation = page_geometry(page)
                            pages.append({"page": index + 1, "width": width, "height": height, "rotation": rotation})
                    signatures = pdfium.raw.FPDF_GetSignatureCount(doc)
            except pdfium.PdfiumError:
                raise ValueError("Das PDF konnte nicht gelesen werden. Bitte eine gültige, unverschlüsselte PDF-Datei wählen.") from None
            for page, user_unit in zip(pages, page_user_units(data, len(pages)), strict=True):
                page["user_unit"] = user_unit
            document_id = secrets.token_urlsafe(24)
            path = self._root / (document_id + ".pdf")
            with path.open("xb") as output:
                output.write(data)
            try:
                path.chmod(0o600)
            except OSError:
                pass  # The temporary directory is already private to this OS user.
            document = CropDocument(document_id, safe_filename(filename), path, len(data), pages, self._clock(), signatures)
            self._documents[document_id] = document
            return document.public()

    def preview(self, document_id: str, page_number: int, width: int) -> bytes:
        if not 200 <= width <= MAX_RENDER_EDGE:
            raise ValueError("Die Vorschauweite muss zwischen 200 und 4096 Pixeln liegen.")
        with self._lock:
            document = self._get(document_id)
            if not 1 <= page_number <= len(document.pages):
                raise ValueError("Diese PDF-Seite ist nicht vorhanden.")
            cache_key = (document_id, page_number, width)
            if cache_key in self._cache:
                self._cache.move_to_end(cache_key)
                return self._cache[cache_key]
            try:
                with PDF_LOCK, pdfium.PdfDocument(document.path) as doc, closing(doc[page_number - 1]) as page:
                    page_width, page_height, _, _ = page_geometry(page)
                    scale = min(width / page_width, MAX_RENDER_EDGE / max(page_width, page_height),
                                math.sqrt(MAX_RENDER_PIXELS / (page_width * page_height)))
                    with closing(page.render(scale=scale, rev_byteorder=True)) as bitmap:
                        image = bitmap.to_pil().convert("RGB")
                        output = io.BytesIO()
                        image.save(output, format="PNG")
                        data = output.getvalue()
                        image.close()
            except pdfium.PdfiumError:
                raise ValueError("Die PDF-Seite konnte nicht dargestellt werden.") from None
            if len(data) <= MAX_CACHE_BYTES:
                self._cache[cache_key] = data
                self._cache_size += len(data)
                while self._cache_size > MAX_CACHE_BYTES:
                    _, removed = self._cache.popitem(last=False)
                    self._cache_size -= len(removed)
            return data

    def crop(self, document_id: str, body: CropRequest) -> tuple[bytes, str]:
        with self._lock:
            document = self._get(document_id)
            pages = list(range(1, len(document.pages) + 1)) if body.pages == "all" else body.pages
            if not pages or len(pages) > MAX_PAGES or len(set(pages)) != len(pages) or any(p < 1 or p > len(document.pages) for p in pages):
                raise ValueError("Bitte vorhandene PDF-Seiten ohne doppelte Seitennummern wählen.")
            try:
                with PDF_LOCK, pdfium.PdfDocument(document.path) as doc:
                    for number in pages:
                        with closing(doc[number - 1]) as page:
                            _, _, bbox, rotation = page_geometry(page)
                            page.set_cropbox(*original_cropbox(bbox, rotation, body.rect))
                    output = io.BytesIO()
                    doc.save(output)
                    data = output.getvalue()
            except pdfium.PdfiumError:
                raise ValueError("Der PDF-Ausschnitt konnte nicht exportiert werden.") from None
            return data, crop_filename(document.name)

    def remove(self, document_id: str):
        with self._lock:
            self._discard(document_id)

    def close(self):
        with self._lock:
            if not self._closed:
                self._closed = True
                self._documents.clear()
                self._cache.clear()
                self._cache_size = 0
                self._directory.cleanup()


def register_crop(app, authorize):
    store = CropStore()
    app.state.pdf_crop = store
    previous_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(application):
        try:
            async with previous_lifespan(application) as lifecycle_state:
                yield lifecycle_state
        finally:
            store.close()

    app.router.lifespan_context = lifespan

    def not_found():
        return HTTPException(404, "Die temporäre PDF ist nicht mehr vorhanden. Bitte die Datei erneut hinzufügen.")

    @app.post(API + "/crop-documents")
    def upload(request: Request, file: UploadFile = File(...)):
        authorize(request, key=True)
        try:
            data = file.file.read(MAX_UPLOAD_BYTES + 1)
            return Response(json.dumps(store.add(data, file.filename or "Dokument.pdf")),
                            media_type="application/json", headers=NO_STORE)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None
        finally:
            file.file.close()

    @app.get(API + "/crop-documents/{document_id}/pages/{page_number}")
    def preview(request: Request, document_id: str, page_number: int, width: int = 1800):
        authorize(request, key=True)
        try:
            return Response(store.preview(document_id, page_number, width), media_type="image/png", headers=NO_STORE)
        except KeyError:
            raise not_found() from None
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None

    @app.post(API + "/crop-documents/{document_id}/crop")
    def crop(request: Request, document_id: str, body: object = Body(...)):
        authorize(request, key=True)
        try:
            selection = CropRequest.model_validate(body)
        except ValidationError:
            # Avoid echoing non-finite JSON input through the HTTP error encoder.
            raise HTTPException(400, "Bitte gültige Seiten und einen Ausschnitt innerhalb der sichtbaren PDF-Seite wählen.") from None
        try:
            data, filename = store.crop(document_id, selection)
            return Response(data, media_type="application/pdf", headers={**NO_STORE, "Content-Disposition": disposition(filename)})
        except KeyError:
            raise not_found() from None
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None

    @app.delete(API + "/crop-documents/{document_id}", status_code=204)
    def remove(request: Request, document_id: str):
        authorize(request, key=True)
        store.remove(document_id)
        return Response(status_code=204, headers=NO_STORE)
