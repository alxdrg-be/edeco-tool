"""Local page inspection and composition; source files remain untouched."""
from __future__ import annotations

import base64
import io
import json
import math
from contextlib import closing

import pypdfium2 as pdfium
from fastapi import File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, StrictInt, ValidationError, field_validator
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PyPdfError

from ..documents.extract import PDF_LOCK
from . import API
from .client import PdfFile
from .crop import MAX_PAGES, MAX_STORE_BYTES, MAX_UPLOAD_BYTES, NO_STORE, disposition, page_geometry

MAX_INPUTS = 20
MAX_INSPECT_PAGES = 100
THUMBNAIL_EDGE = 360


class PageSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    file: StrictInt = Field(ge=0, lt=MAX_INPUTS)
    page: StrictInt = Field(ge=1, le=MAX_PAGES)
    rotation: StrictInt = 0

    @field_validator("rotation")
    @classmethod
    def quarter_turn(cls, value):
        if value not in (0, 90, 180, 270):
            raise ValueError("Bitte eine Drehung von 0, 90, 180 oder 270 Grad wählen.")
        return value


def read_pdf(upload: UploadFile) -> bytes:
    data = upload.file.read(MAX_UPLOAD_BYTES + 1)
    if not data or len(data) > MAX_UPLOAD_BYTES or not data.lstrip().startswith(b"%PDF-"):
        raise ValueError("Bitte eine gültige PDF-Datei mit höchstens 100 MB verwenden.")
    return data


def open_pdf(data: bytes, *, max_pages=MAX_PAGES) -> PdfReader:
    """Reject protected and invalid documents before any editing or rendering."""
    if not data or len(data) > MAX_UPLOAD_BYTES or not data.lstrip().startswith(b"%PDF-"):
        raise ValueError("Bitte eine gültige PDF-Datei mit höchstens 100 MB verwenden.")
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            raise ValueError("Das PDF ist geschützt. Bitte zuerst mit dem passenden Passwort entsperren.")
        if not 1 <= len(reader.pages) <= max_pages:
            raise ValueError(f"Bitte eine PDF mit 1 bis {max_pages} Seiten verwenden.")
        return reader
    except PyPdfError:
        raise ValueError("Das PDF konnte nicht gelesen werden. Bitte eine gültige, unverschlüsselte PDF wählen.") from None


def validate_inputs(files: list[PdfFile]):
    if not 1 <= len(files) <= MAX_INPUTS or sum(len(file.data) for file in files) > MAX_STORE_BYTES:
        raise ValueError("Bitte höchstens 20 PDFs mit insgesamt höchstens 250 MB verwenden.")


def writer_bytes(writer: PdfWriter) -> bytes:
    class BoundedOutput(io.BytesIO):
        def write(self, data):
            if self.tell() + len(data) > MAX_STORE_BYTES:
                raise ValueError("Das Ergebnis ist zu gross. Bitte weniger Seiten gleichzeitig verarbeiten.")
            return super().write(data)

    output = BoundedOutput()
    writer.write(output)
    if output.tell() > MAX_STORE_BYTES:
        raise ValueError("Das Ergebnis ist zu gross. Bitte weniger Seiten gleichzeitig verarbeiten.")
    return output.getvalue()


def inspect_pdf(data: bytes) -> dict:
    reader = open_pdf(data, max_pages=MAX_INSPECT_PAGES)
    pages = []
    try:
        with PDF_LOCK, pdfium.PdfDocument(data) as document:
            document.init_forms()
            if len(document) != len(reader.pages):
                raise ValueError("Die PDF-Seitenstruktur ist widersprüchlich.")
            for index in range(len(document)):
                with closing(document[index]) as page:
                    width, height, crop, rotation = page_geometry(page)
                    with closing(page.render(scale=THUMBNAIL_EDGE / max(width, height), rev_byteorder=True)) as bitmap:
                        image = bitmap.to_pil().convert("RGB")
                        try:
                            output = io.BytesIO()
                            image.save(output, format="PNG")
                        finally:
                            image.close()
                    raw_unit = reader.pages[index].get("/UserUnit", 1)
                    try:
                        if not isinstance(raw_unit, (int, float)) or isinstance(raw_unit, bool):
                            raise ValueError
                        unit = float(raw_unit)
                        if not math.isfinite(unit) or not 0 < unit <= 75000:
                            unit = None
                    except (TypeError, ValueError):
                        unit = None
                    pages.append({
                        "number": index + 1, "page": index + 1, "width": width, "height": height,
                        # PDFium's direct MediaBox accessor does not resolve
                        # inherited boxes; pypdf's flattened page tree does.
                        "rotation": rotation, "media_box": [float(v) for v in reader.pages[index].mediabox], "crop_box": list(crop),
                        "user_unit": unit,
                        "thumbnail": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii"),
                    })
    except pdfium.PdfiumError:
        raise ValueError("Das PDF konnte nicht dargestellt werden. Bitte eine gültige, unverschlüsselte PDF wählen.") from None
    return {"pages": pages, "page_count": len(pages), "page_unit": "pdf_canvas"}


def compose_pdf(files: list[PdfFile], selection: list[PageSelection]) -> bytes:
    validate_inputs(files)
    if not 1 <= len(selection) <= MAX_PAGES:
        raise ValueError("Bitte 1 bis 2000 Seiten auswählen.")
    readers = [open_pdf(file.data) for file in files]
    if any(item.file >= len(readers) or item.page > len(readers[item.file].pages) for item in selection):
        raise ValueError("Die Seitenauswahl enthält eine nicht vorhandene Datei oder Seite.")
    writer = PdfWriter()
    if len(readers) > 1:
        for index, reader in enumerate(readers, 1):
            if reader.get_fields():
                reader.add_form_topname(f"source_{index}")
    for item in selection:
        # append retains the selected pages' form-field catalogue as well as
        # their visible widgets. Separate calls keep repeated pages independent.
        writer.append(readers[item.file], pages=[item.page - 1], import_outline=False)
        page = writer.pages[-1]
        if item.rotation:
            page.rotate(item.rotation)
    return writer_bytes(writer)


def register_workbench(app, authorize, config=None):
    @app.post(API + "/inspect")
    def inspect(request: Request, file: UploadFile = File(...)):
        authorize(request, key=True)
        try:
            return Response(json.dumps(inspect_pdf(read_pdf(file))), media_type="application/json", headers=NO_STORE)
        except (ValueError, PyPdfError, pdfium.PdfiumError) as exc:
            raise HTTPException(400, str(exc) if isinstance(exc, ValueError) else "Das PDF konnte nicht geöffnet werden.") from None
        finally:
            file.file.close()

    @app.post(API + "/compose")
    def compose(request: Request, files: list[UploadFile] = File(...), pages: str = Form(...)):
        authorize(request, key=True)
        try:
            if len(pages) > 200_000:
                raise ValueError("Die Seitenauswahl ist zu gross.")
            raw = json.loads(pages)
            if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_PAGES or not 1 <= len(files) <= MAX_INPUTS:
                raise ValueError("Bitte 1 bis 2000 Seiten aus höchstens 20 PDFs auswählen.")
            selected = [PageSelection.model_validate(item) for item in raw]
            originals = []
            total = 0
            for file in files:
                data = read_pdf(file)
                total += len(data)
                if total > MAX_STORE_BYTES:
                    raise ValueError("Bitte insgesamt höchstens 250 MB verwenden.")
                originals.append(PdfFile(file.filename or "Dokument.pdf", data))
            data = compose_pdf(originals, selected)
            return Response(data, media_type="application/pdf", headers={
                **NO_STORE, "Content-Disposition": disposition("edeco-Zusammenstellung.pdf"),
            })
        except (ValueError, ValidationError, PyPdfError, pdfium.PdfiumError) as exc:
            message = str(exc) if isinstance(exc, ValueError) and not isinstance(exc, ValidationError) else "Bitte gültige Seiten und Drehungen auswählen."
            raise HTTPException(400, message) from None
        finally:
            for file in files:
                file.file.close()
