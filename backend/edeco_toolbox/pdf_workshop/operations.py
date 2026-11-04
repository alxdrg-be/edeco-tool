"""Native PDF operations behind the own tool views; advanced Core stays separate."""
from __future__ import annotations

import io
import json
import math
import re
import zipfile
from contextlib import closing
from typing import Literal

import pypdfium2 as pdfium
from fastapi import File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, StrictInt, ValidationError, model_validator
from pypdf import PageObject, PdfWriter, Transformation
from pypdf.errors import PyPdfError

from ..documents.extract import PDF_LOCK
from . import API
from .client import PdfFile
from .crop import MAX_PAGES, MAX_STORE_BYTES, MAX_UPLOAD_BYTES, NO_STORE, disposition, page_geometry
from .workbench import MAX_INPUTS, PageSelection, compose_pdf, open_pdf, read_pdf, validate_inputs, writer_bytes

TOOLS = ("organize", "split", "rotate", "resize", "images-to-pdf", "pdf-to-images", "pdf-to-text")
MAX_RASTER_PIXELS = 100_000_000
MAX_IMAGE_PIXELS = 50_000_000
MAX_IMAGE_EDGE = 32_767
PT_PER_MM = 72 / 25.4
PAPER = {name: (w * PT_PER_MM, h * PT_PER_MM) for name, w, h in [
    ("A0", 841, 1189), ("A1", 594, 841), ("A2", 420, 594), ("A3", 297, 420),
    ("A4", 210, 297), ("A5", 148, 210), ("A6", 105, 148),
]}
PAPER.update(LETTER=(612, 792), LEGAL=(612, 1008))


class Options(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pages: str = Field(default="all", max_length=1000)
    split_after: str = Field(default="", max_length=1000)
    angle: Literal[90, 180, 270] = 90
    page_size: Literal["A0", "A1", "A2", "A3", "A4", "A5", "A6", "LETTER", "LEGAL", "KEEP"] = "A4"
    scale: FiniteFloat = Field(default=100, gt=0, le=1000)
    orientation: Literal["PORTRAIT", "LANDSCAPE"] = "PORTRAIT"
    dpi: Literal[72, 144, 300] = 144
    split_mode: Literal["each", "custom"] = "each"
    # Accepted for the branch's shared Options payload. The crop editor and
    # advanced Core own these operations; they are not reimplemented here.
    top: FiniteFloat = Field(default=0, ge=0, le=1000)
    bottom: FiniteFloat = Field(default=0, ge=0, le=1000)
    left: FiniteFloat = Field(default=0, ge=0, le=1000)
    right: FiniteFloat = Field(default=0, ge=0, le=1000)
    crop_box: list[FiniteFloat] | None = Field(default=None, min_length=4, max_length=4)
    quality: StrictInt = Field(default=5, ge=1, le=9)
    languages: list[Literal["deu", "eng"]] = Field(default_factory=lambda: ["deu", "eng"], min_length=1, max_length=2)
    force_ocr: bool = False

    @model_validator(mode="after")
    def validate_shared_payload(self):
        if self.crop_box is not None:
            x0, y0, x1, y1 = self.crop_box
            if not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
                raise ValueError("Bitte einen gültigen Bereich innerhalb der Seite wählen.")
        if self.page_size == "KEEP":
            self.orientation = "PORTRAIT"
        return self


def selected_pages(value: str, count: int) -> list[int]:
    if not isinstance(value, str) or not 1 <= count <= MAX_PAGES or len(value) > 1000:
        raise ValueError("Bitte einen gültigen Seitenbereich auswählen.")
    if value.strip().lower() == "all":
        return list(range(1, count + 1))
    result = []
    for part in value.split(","):
        match = re.fullmatch(r"\s*(\d{1,5})(?:\s*-\s*(\d{1,5}))?\s*", part)
        if not match:
            raise ValueError("Seiten als Zahlen oder Bereiche angeben, z. B. 1,3-5.")
        start, end = int(match[1]), int(match[2] or match[1])
        if start < 1 or end < start or end > count:
            raise ValueError(f"Bitte nur Seiten von 1 bis {count} wählen.")
        result.extend(range(start, end + 1))
    return list(dict.fromkeys(result))


def capabilities(config=None):
    return [{"id": tool, "available": True, "engine": "native", "reason": ""} for tool in TOOLS]


def physical_unit(page) -> float:
    try:
        raw = page.get("/UserUnit", 1)
        if not isinstance(raw, (int, float)) or isinstance(raw, bool):
            raise ValueError
        value = float(raw)
    except (TypeError, ValueError):
        raise ValueError("Die physische Seiteneinheit ist ungültig.") from None
    if not math.isfinite(value) or not 0 < value <= 75000:
        raise ValueError("Die physische Seiteneinheit ist ungültig.")
    return value


def resize_pdf(data: bytes, options: Options) -> bytes:
    reader = open_pdf(data)
    if reader.trailer["/Root"].get("/AcroForm") or any(
            annotation.get_object().get("/Subtype") == "/Widget"
            for page in reader.pages for annotation in page.get("/Annots", [])):
        raise ValueError("Diese PDF enthält interaktive Formularfelder. Sichere zuerst mit „Abflachen“ eine eigene Kopie oder verwende die erweiterten Funktionen. Das Original bleibt unverändert.")
    if any(page.get("/Annots") for page in reader.pages):
        raise ValueError("Diese PDF enthält Anmerkungen oder Verknüpfungen. Die kompakte Formatänderung kann deren Positionen nicht zuverlässig erhalten. Erstelle bei Bedarf zuerst mit „Abflachen“ eine eigene Druckkopie.")
    writer = PdfWriter()
    working = PdfWriter()
    for original in reader.pages:
        # Keep the source page dictionary and contents pristine, including its
        # crop origin, intrinsic rotation and physical UserUnit.
        page = working.add_page(original)
        page.transfer_rotation_to_content()
        unit = physical_unit(page)
        box = page.cropbox
        width, height = float(box.width), float(box.height)
        if not all(math.isfinite(v) for v in (*box, width, height)) or min(width, height) <= 0:
            raise ValueError("Die PDF-Seite hat keinen gültigen sichtbaren Seitenrahmen.")
        target_w, target_h = ((width * unit, height * unit) if options.page_size == "KEEP" else PAPER[options.page_size])
        if options.page_size != "KEEP" and options.orientation == "LANDSCAPE":
            target_w, target_h = target_h, target_w
        if max(target_w, target_h) > 10_000_000:
            raise ValueError("Das gewählte Seitenformat ist zu gross.")
        scale = unit * options.scale / 100
        dx = (target_w - width * scale) / 2 - float(box.left) * scale
        dy = (target_h - height * scale) / 2 - float(box.bottom) * scale
        target = PageObject.create_blank_page(width=target_w, height=target_h)
        target.merge_transformed_page(page, Transformation().scale(scale).translate(dx, dy), expand=False)
        writer.add_page(target)
    return writer_bytes(writer)


def raster_images(data: bytes, options: Options) -> tuple[bytes, str]:
    reader = open_pdf(data)
    numbers = selected_pages(options.pages, len(reader.pages))
    units = {number: physical_unit(reader.pages[number - 1]) for number in numbers}
    images = []
    try:
        with PDF_LOCK, pdfium.PdfDocument(data) as document:
            document.init_forms()
            plan = []
            total_pixels = 0
            for number in numbers:
                with closing(document[number - 1]) as page:
                    width, height, _, _ = page_geometry(page)
                    scale = options.dpi / 72 * units[number]
                    pixels_w, pixels_h = math.ceil(width * scale), math.ceil(height * scale)
                    total_pixels += pixels_w * pixels_h
                    if max(pixels_w, pixels_h) > MAX_IMAGE_EDGE or total_pixels > MAX_RASTER_PIXELS:
                        raise ValueError("Die Bildausgabe ist zu gross. Weniger Seiten oder eine kleinere Auflösung wählen.")
                    plan.append((number, scale))
            # Validate the complete output budget before allocating a bitmap.
            for number, scale in plan:
                with closing(document[number - 1]) as page, closing(page.render(scale=scale, rev_byteorder=True)) as bitmap:
                    image = bitmap.to_pil().convert("RGB")
                    try:
                        output = io.BytesIO()
                        image.save(output, format="PNG", dpi=(options.dpi, options.dpi))
                        images.append((number, output.getvalue()))
                    finally:
                        image.close()
    except pdfium.PdfiumError:
        raise ValueError("Die PDF-Seiten konnten nicht als Bilder ausgegeben werden.") from None
    if len(images) == 1:
        return images[0][1], "png"
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for number, image in images:
            archive.writestr(f"Seite-{number}.png", image)
    return output.getvalue(), "zip"


def split_pdf(data: bytes, options: Options) -> bytes:
    reader = open_pdf(data)
    count = len(reader.pages)
    if options.split_after:
        cuts = selected_pages(options.split_after, count - 1)
    else:
        cuts = list(range(1, count)) if options.split_mode == "each" else []
    cuts = sorted(cuts)
    output = io.BytesIO()
    start = 0
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for index, end in enumerate(cuts + [count], 1):
            writer = PdfWriter()
            writer.append(reader, pages=list(range(start, end)), import_outline=False)
            archive.writestr(f"Teil-{index}.pdf", writer_bytes(writer))
            start = end
    return output.getvalue()


def images_to_pdf(files: list[PdfFile], options: Options) -> bytes:
    images = []
    total_pixels = 0
    try:
        for file in files:
            with Image.open(io.BytesIO(file.data)) as image:
                total_pixels += image.width * image.height
                if (image.format not in ("PNG", "JPEG") or image.width * image.height > MAX_IMAGE_PIXELS
                        or total_pixels > MAX_RASTER_PIXELS):
                    raise ValueError("Bitte PNG-/JPEG-Bilder mit höchstens 50 Megapixeln verwenden.")
                image.load()
                # Alpha is composited on paper white rather than converted to black.
                rgba = image.convert("RGBA")
                background = Image.new("RGB", image.size, "white")
                background.paste(rgba, mask=rgba.getchannel("A"))
                rgba.close()
                images.append(background)
        output = io.BytesIO()
        images[0].save(output, format="PDF", save_all=True, append_images=images[1:], resolution=options.dpi)
        return output.getvalue()
    finally:
        for image in images:
            image.close()


def process(client, tool: str, files: list[PdfFile], options: Options) -> tuple[bytes, str]:
    """The client argument preserves the branch adapter contract; no engine call."""
    validate_inputs(files)
    if tool not in TOOLS or (tool != "images-to-pdf" and len(files) != 1):
        raise ValueError("Bitte die passende Anzahl Dateien für dieses PDF-Werkzeug wählen.")
    if tool == "images-to-pdf":
        return images_to_pdf(files, options), "pdf"
    source = files[0]
    reader = open_pdf(source.data)
    if tool == "split":
        return split_pdf(source.data, options), "zip"
    if tool in ("rotate", "organize"):
        pages = selected_pages(options.pages, len(reader.pages))
        return compose_pdf(files, [PageSelection(file=0, page=n, rotation=options.angle if tool == "rotate" else 0) for n in pages]), "pdf"
    if tool == "resize":
        return resize_pdf(source.data, options), "pdf"
    if tool == "pdf-to-images":
        return raster_images(source.data, options)
    # Keep Unicode text local. A scanned page without a text layer is explained
    # explicitly; OCR remains an advanced Core workflow.
    text = "\n\n".join(reader.pages[n - 1].extract_text() or "" for n in selected_pages(options.pages, len(reader.pages)))
    if not text.strip():
        raise ValueError("Keine Textschicht gefunden. Bitte zuerst die Texterkennung (OCR) in den erweiterten PDF-Werkzeugen verwenden.")
    return text.encode("utf-8"), "txt"


def register_operations(app, authorize, config=None):
    @app.get(API + "/tools")
    def tools(request: Request):
        authorize(request)
        return {"tools": capabilities(config)}

    @app.post(API + "/process/{tool}")
    def run(request: Request, tool: str, files: list[UploadFile] = File(...), options: str = Form("{}")):
        authorize(request, key=True)
        try:
            if tool not in TOOLS:
                raise HTTPException(404, "Dieses Werkzeug bitte über die erweiterten PDF-Funktionen öffnen.")
            if len(options) > 20_000 or not 1 <= len(files) <= (MAX_INPUTS if tool == "images-to-pdf" else 1):
                raise ValueError("Bitte gültige Optionen und die passende Anzahl Dateien wählen.")
            settings = Options.model_validate(json.loads(options))
            inputs = []
            total = 0
            for upload in files:
                data = upload.file.read(MAX_UPLOAD_BYTES + 1) if tool == "images-to-pdf" else read_pdf(upload)
                if len(data) > MAX_UPLOAD_BYTES:
                    raise ValueError("Bitte höchstens 100 MB je Datei verwenden.")
                total += len(data)
                if total > MAX_STORE_BYTES:
                    raise ValueError("Bitte insgesamt höchstens 250 MB verwenden.")
                inputs.append(PdfFile(upload.filename or "Dokument", data))
            content, extension = process(None, tool, inputs, settings)
            if len(content) > MAX_STORE_BYTES:
                raise ValueError("Das Ergebnis ist zu gross. Bitte weniger Seiten gleichzeitig verarbeiten.")
            mime = {"pdf": "application/pdf", "zip": "application/zip", "png": "image/png", "txt": "text/plain; charset=utf-8"}[extension]
            return Response(content, media_type=mime, headers={
                **NO_STORE, "Content-Disposition": disposition(f"edeco-{tool}.{extension}"),
            })
        except (ValueError, ValidationError, PyPdfError, pdfium.PdfiumError, UnidentifiedImageError,
                Image.DecompressionBombError, OSError, SyntaxError) as exc:
            message = str(exc) if isinstance(exc, ValueError) and not isinstance(exc, ValidationError) else "Datei oder Optionen konnten nicht verarbeitet werden."
            raise HTTPException(400, message) from None
        finally:
            for file in files:
                file.file.close()
