"""Visible signature appearances and bounded page/text selection for redaction.

An appearance is an ordinary PDF image, never a certificate signature. Source
files stay in a private temporary store and are never overwritten.
"""
from __future__ import annotations

import base64
import io
import json
import math
from contextlib import asynccontextmanager, closing
from typing import Literal

import pypdfium2 as pdfium
from fastapi import Body, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageDraw, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, StrictInt, ValidationError, model_validator
from pypdf import PdfWriter, Transformation
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject, NumberObject

from ..documents.extract import PDF_LOCK
from . import API
from .crop import CropStore, MAX_RENDER_PIXELS, NO_STORE, disposition, page_geometry, page_user_units
from .workbench import open_pdf, writer_bytes

MAX_MARKS = 500
MAX_APPEARANCE_BYTES = 8 * 1024 * 1024
MAX_APPEARANCE_PIXELS = 8_000_000
MAX_REDACTION_PAGES = 100
MAX_REDACTION_PAGE_PIXELS = 40_000_000  # A0 at 150 DPI, A2 at 300 DPI.
MAX_REDACTION_TOTAL_PIXELS = 250_000_000


def init_visible_forms(document):
    if document.get_formtype() in (pdfium.raw.FORMTYPE_XFA_FULL, pdfium.raw.FORMTYPE_XFA_FOREGROUND):
        raise ValueError("XFA-Formulare werden hier nicht zuverlässig dargestellt. Bitte zuerst als normale PDF speichern.")
    # No JavaScript platform or form-event callbacks are supplied for rendering.
    document.init_forms(config=pdfium.raw.FPDF_FORMFILLINFO(version=2, xfa_disabled=True))


class MarkRect(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page: StrictInt = Field(ge=1, le=2000)
    x: FiniteFloat = Field(ge=0, lt=1)
    y: FiniteFloat = Field(ge=0, lt=1)
    width: FiniteFloat = Field(gt=0, le=1)
    height: FiniteFloat = Field(gt=0, le=1)

    @model_validator(mode="after")
    def inside_page(self):
        if self.x + self.width > 1.000001 or self.y + self.height > 1.000001:
            raise ValueError("Der gewählte Bereich muss innerhalb der PDF-Seite liegen.")
        return self


class RedactionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    positions: list[MarkRect] = Field(min_length=1, max_length=MAX_MARKS)
    dpi: Literal[150, 300] = 300
    confirmed: bool = False
    acknowledge_signatures: bool = False


def parse_marks(value: str, count: int) -> list[MarkRect]:
    if len(value) > 150_000:
        raise ValueError("Bitte höchstens 500 Bereiche gleichzeitig verwenden.")
    try:
        raw = json.loads(value)
        if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_MARKS:
            raise ValueError
        marks = [MarkRect.model_validate(item) for item in raw]
    except (ValueError, ValidationError):
        raise ValueError("Bitte gültige Bereiche innerhalb der PDF-Seiten wählen.") from None
    if any(mark.page > count for mark in marks):
        raise ValueError("Ein Bereich verweist auf eine nicht vorhandene PDF-Seite.")
    return marks


def image_pdf(image_data: bytes, width: float, height: float, rect: MarkRect):
    """A transparent RGB/alpha image XObject placed in visible PDF coordinates."""
    if not image_data or len(image_data) > MAX_APPEARANCE_BYTES:
        raise ValueError("Die Signaturdarstellung darf höchstens 8 MB gross sein.")
    try:
        with Image.open(io.BytesIO(image_data)) as source:
            if source.format != "PNG" or source.width * source.height > MAX_APPEARANCE_PIXELS:
                raise ValueError("Bitte eine PNG-Darstellung mit höchstens 8 Millionen Pixeln verwenden.")
            rgba = source.convert("RGBA")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ValueError("Das Signaturbild konnte nicht gelesen werden.") from None
    try:
        rgb = rgba.convert("RGB")
        alpha = rgba.getchannel("A")
        writer = PdfWriter()
        page = writer.add_blank_page(width=width, height=height)
        mask = DecodedStreamObject()
        mask.set_data(alpha.tobytes())
        mask.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Image"),
                     NameObject("/Width"): NumberObject(rgba.width), NameObject("/Height"): NumberObject(rgba.height),
                     NameObject("/ColorSpace"): NameObject("/DeviceGray"), NameObject("/BitsPerComponent"): NumberObject(8)})
        mask_ref = writer._add_object(mask.flate_encode())
        image = DecodedStreamObject()
        image.set_data(rgb.tobytes())
        image.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Image"),
                      NameObject("/Width"): NumberObject(rgba.width), NameObject("/Height"): NumberObject(rgba.height),
                      NameObject("/ColorSpace"): NameObject("/DeviceRGB"), NameObject("/BitsPerComponent"): NumberObject(8),
                      NameObject("/SMask"): mask_ref})
        image_ref = writer._add_object(image.flate_encode())
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/XObject"): DictionaryObject({NameObject("/SigImage"): image_ref})})
        content = DecodedStreamObject()
        content.set_data((f"q {rect.width * width:.8f} 0 0 {rect.height * height:.8f} "
                          f"{rect.x * width:.8f} {(1 - rect.y - rect.height) * height:.8f} cm /SigImage Do Q\n").encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(content)
        return writer, page
    finally:
        rgba.close()
        if "rgb" in locals():
            rgb.close()
        if "alpha" in locals():
            alpha.close()


def visible_signature(data: bytes, image_data: bytes, marks: list[MarkRect]) -> bytes:
    reader = open_pdf(data)
    form = reader.trailer["/Root"].get("/AcroForm")
    if form and "/XFA" in form.get_object():
        raise ValueError("XFA-Formulare bitte zuerst als normale PDF speichern.")
    if any(mark.page > len(reader.pages) for mark in marks):
        raise ValueError("Eine Signaturposition verweist auf eine nicht vorhandene Seite.")
    # An ordinary visible signature must retain the complete document catalogue,
    # including interactive fields and their existing appearance dictionaries.
    writer = PdfWriter(clone_from=reader)
    for index, page in enumerate(writer.pages, 1):
        selected = [mark for mark in marks if mark.page == index]
        if not selected:
            continue
        box = page.cropbox
        width, height = float(box.width), float(box.height)
        if not all(math.isfinite(value) for value in (*box, width, height)) or min(width, height) <= 0:
            raise ValueError("Die PDF-Seite hat keinen gültigen sichtbaren Seitenrahmen.")
        rotation = int(page.rotation or 0) % 360
        left, bottom = float(box.left), float(box.bottom)
        # Preserve the original page rotation and annotation rectangles. Normalising
        # /Rotate moves contents but pypdf does not move AcroForm/widget rectangles.
        matrices = {0: (1, 0, 0, 1, left, bottom),
                    90: (0, 1, -1, 0, left + width, bottom),
                    180: (-1, 0, 0, -1, left + width, bottom + height),
                    270: (0, -1, 1, 0, left, bottom + height)}
        if rotation not in matrices:
            raise ValueError("Diese Seitendrehung wird für Signaturdarstellungen nicht unterstützt.")
        visible_width, visible_height = (height, width) if rotation in (90, 270) else (width, height)
        for mark in selected:
            _, overlay = image_pdf(image_data, visible_width, visible_height, mark)
            page.merge_transformed_page(overlay, Transformation(ctm=matrices[rotation]), expand=False)
    return writer_bytes(writer)


def secure_redaction(data: bytes, positions: list[MarkRect], dpi: int = 300) -> bytes:
    """Fresh image-only PDF: no original content stream, resources or attachments.

    Every page is rebuilt deliberately. Copying unmarked page dictionaries could
    retain an unused image/Form resource containing a marked page's secret data.
    Black pixels are painted *after* annotations and form appearances are rendered.
    """
    if dpi not in (150, 300) or not 1 <= len(positions) <= MAX_MARKS:
        raise ValueError("Bitte gültige Bereiche und 150 oder 300 DPI auswählen.")
    reader = open_pdf(data, max_pages=MAX_REDACTION_PAGES)
    count = len(reader.pages)
    if any(position.page > count for position in positions):
        raise ValueError("Ein Bereich verweist auf eine nicht vorhandene PDF-Seite.")
    units = page_user_units(data, count)
    if any(unit is None for unit in units):
        raise ValueError("Die physische Seiteneinheit ist ungültig; das PDF kann nicht sicher neu aufgebaut werden.")
    writer = PdfWriter()
    with PDF_LOCK, pdfium.PdfDocument(data) as document:
        init_visible_forms(document)
        geometry, total_pixels = [], 0
        # Preflight all pages before rendering; no partial result or surprise DPI reduction.
        for index in range(count):
            with closing(document[index]) as page:
                width, height, _, _ = page_geometry(page)
            unit = units[index]
            physical_width, physical_height = width * unit, height * unit
            scale = dpi / 72 * unit
            pixel_width, pixel_height = math.ceil(width * scale), math.ceil(height * scale)
            pixels = pixel_width * pixel_height
            total_pixels += pixels
            if pixels > MAX_REDACTION_PAGE_PIXELS:
                message = "Bitte 150 DPI wählen oder die Seite vorher zuschneiden/verkleinern." if dpi == 300 else "Auch bei 150 DPI ist diese Seite zu gross. Bitte die Seite vorher zuschneiden oder auf ein kleineres Papierformat verkleinern."
                raise ValueError(f"Seite {index + 1} überschreitet die Grenze von 40 Millionen Pixeln. {message}")
            if total_pixels > MAX_REDACTION_TOTAL_PIXELS:
                hint = "150 DPI wählen oder das PDF" if dpi == 300 else "das PDF"
                raise ValueError(f"Die gesamte Bildausgabe überschreitet 250 Millionen Pixel. Bitte {hint} vorher in kleinere Dokumente aufteilen.")
            geometry.append((physical_width, physical_height, scale))
        for index, (width, height, scale) in enumerate(geometry):
            with closing(document[index]) as page, closing(page.render(scale=scale, draw_annots=True, rev_byteorder=True)) as bitmap:
                image = bitmap.to_pil().convert("RGB")
                try:
                    drawing = ImageDraw.Draw(image)
                    for position in positions:
                        if position.page != index + 1:
                            continue
                        # Two pixels around the selected edge cover antialiased glyph rims.
                        x0, y0 = max(0, math.floor(position.x * image.width) - 2), max(0, math.floor(position.y * image.height) - 2)
                        x1 = min(image.width, math.ceil((position.x + position.width) * image.width) + 2)
                        y1 = min(image.height, math.ceil((position.y + position.height) * image.height) + 2)
                        drawing.rectangle((x0, y0, x1, y1), fill="black")
                    # Encode only the already-redacted pixels, never an original image stream.
                    output = io.BytesIO()
                    image.save(output, format="JPEG", quality=94, subsampling=0)
                    stream = DecodedStreamObject()
                    stream.set_data(output.getvalue())
                    stream.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Image"),
                                   NameObject("/Width"): NumberObject(image.width), NameObject("/Height"): NumberObject(image.height),
                                   NameObject("/ColorSpace"): NameObject("/DeviceRGB"), NameObject("/BitsPerComponent"): NumberObject(8),
                                   NameObject("/Filter"): NameObject("/DCTDecode")})
                    image_ref = writer._add_object(stream)
                    target = writer.add_blank_page(width=width, height=height)
                    target[NameObject("/Resources")] = DictionaryObject({NameObject("/XObject"): DictionaryObject({NameObject("/PageImage"): image_ref})})
                    content = DecodedStreamObject()
                    content.set_data(f"q {width:.8f} 0 0 {height:.8f} 0 0 cm /PageImage Do Q\n".encode("ascii"))
                    target[NameObject("/Contents")] = writer._add_object(content)
                finally:
                    image.close()
    return writer_bytes(writer)


class MarkStore(CropStore):
    """Reuse the bounded lifetime and private files of the existing crop store."""
    def snapshot(self, document_id: str):
        with self._lock:
            document = self._get(document_id)
            return document.path.read_bytes(), document.public()

    def page_selection(self, document_id: str, page_number: int) -> dict:
        data, metadata = self.snapshot(document_id)
        if not 1 <= page_number <= metadata["page_count"]:
            raise ValueError("Diese PDF-Seite ist nicht vorhanden.")
        with PDF_LOCK, pdfium.PdfDocument(data) as document:
            init_visible_forms(document)
            with closing(document[page_number - 1]) as page:
                return self._page_selection(page, page_number)

    @staticmethod
    def _page_selection(page, page_number):
        width, height, _, _ = page_geometry(page)
        scale = min(1800 / width, 4096 / max(width, height), math.sqrt(MAX_RENDER_PIXELS / (width * height)))
        with closing(page.render(scale=scale, rev_byteorder=True)) as bitmap, closing(page.get_textpage()) as textpage:
            conversion = bitmap.get_posconv(page)
            lines = []
            limited = textpage.count_chars() > 200_000
            total_text = 0
            for index in range(min(textpage.count_rects(), 5000) if not limited else 0):
                box = textpage.get_rect(index)
                text = textpage.get_text_bounded(*box).strip()
                if not text:
                    continue
                total_text += len(text)
                if total_text > 200_000:
                    limited = True
                    break
                left, bottom, right, top = box
                corners = [conversion.to_bitmap(x, y) for x, y in ((left, bottom), (left, top), (right, bottom), (right, top))]
                xs, ys = zip(*corners)
                x, y = max(0, min(xs) / bitmap.width), max(0, min(ys) / bitmap.height)
                x1, y1 = min(1, max(xs) / bitmap.width), min(1, max(ys) / bitmap.height)
                if x1 > x and y1 > y:
                    lines.append({"id": index, "text": text[:3000], "x": x, "y": y, "width": x1 - x, "height": y1 - y})
            with bitmap.to_pil() as image:
                output = io.BytesIO()
                image.save(output, format="PNG")
        return {"page": page_number, "width": width, "height": height, "lines": lines, "text_limited": limited,
                "image": "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")}

def register_marks(app, authorize, config=None):
    store = MarkStore()
    app.state.pdf_marks = store
    previous_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(application):
        try:
            async with previous_lifespan(application) as value:
                yield value
        finally:
            store.close()

    app.router.lifespan_context = lifespan

    def missing():
        return HTTPException(404, "Die temporäre PDF ist nicht mehr vorhanden. Bitte erneut hinzufügen.")

    @app.post(API + "/mark-documents")
    def upload(request: Request, file: UploadFile = File(...)):
        authorize(request, key=True)
        try:
            return Response(json.dumps(store.add(file.file.read(100 * 1024 * 1024 + 1), file.filename or "Dokument.pdf")), media_type="application/json", headers=NO_STORE)
        except (ValueError, pdfium.PdfiumError) as exc:
            raise HTTPException(400, str(exc)) from None
        finally:
            file.file.close()

    @app.get(API + "/mark-documents/{document_id}/pages/{page_number}")
    def page(request: Request, document_id: str, page_number: int):
        authorize(request, key=True)
        try:
            return Response(json.dumps(store.page_selection(document_id, page_number)), media_type="application/json", headers=NO_STORE)
        except KeyError:
            raise missing() from None
        except (ValueError, pdfium.PdfiumError) as exc:
            raise HTTPException(400, str(exc)) from None

    @app.post(API + "/mark-documents/{document_id}/signature")
    def signature(request: Request, document_id: str, image: UploadFile = File(...), positions: str = Form(...), acknowledge_signatures: bool = Form(False)):
        authorize(request, key=True)
        try:
            data, metadata = store.snapshot(document_id)
            if metadata["signatures"] and not acknowledge_signatures:
                raise ValueError("Die Bearbeitung macht vorhandene Zertifikatssignaturen ungültig. Bitte den Hinweis bestätigen.")
            output = visible_signature(data, image.file.read(MAX_APPEARANCE_BYTES + 1), parse_marks(positions, metadata["page_count"]))
            name = metadata["name"].removesuffix(".pdf") + "_unterschrieben.pdf"
            return Response(output, media_type="application/pdf", headers={**NO_STORE, "Content-Disposition": disposition(name)})
        except KeyError:
            raise missing() from None
        except (ValueError, pdfium.PdfiumError) as exc:
            raise HTTPException(400, str(exc)) from None
        finally:
            image.file.close()

    @app.post(API + "/mark-documents/{document_id}/redact")
    def redact(request: Request, document_id: str, body: object = Body(...)):
        authorize(request, key=True)
        try:
            options = RedactionRequest.model_validate(body)
            if not options.confirmed:
                raise ValueError("Bitte den Bild-PDF-Modus und die geprüfte Auswahl vor dem Export bestätigen.")
            data, metadata = store.snapshot(document_id)
            if metadata["signatures"] and not options.acknowledge_signatures:
                raise ValueError("Die Bearbeitung macht vorhandene Zertifikatssignaturen ungültig. Bitte den Hinweis bestätigen.")
            output = secure_redaction(data, options.positions, options.dpi)
            name = metadata["name"].removesuffix(".pdf") + "_geschwaerzt.pdf"
            return Response(output, media_type="application/pdf", headers={**NO_STORE, "Content-Disposition": disposition(name),
                             "X-Edeco-Redaction-Mode": "image-pdf", "X-Edeco-Redaction-Dpi": str(options.dpi)})
        except KeyError:
            raise missing() from None
        except (ValueError, ValidationError, pdfium.PdfiumError) as exc:
            message = str(exc) if isinstance(exc, ValueError) and not isinstance(exc, ValidationError) else "Bitte gültige Bereiche und die Bestätigung für die Bild-PDF-Ausgabe angeben."
            raise HTTPException(400, message) from None

    @app.delete(API + "/mark-documents/{document_id}", status_code=204)
    def remove(request: Request, document_id: str):
        authorize(request, key=True)
        store.remove(document_id)
        return Response(status_code=204, headers=NO_STORE)
