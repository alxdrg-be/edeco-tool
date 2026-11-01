"""Validated actions for the edeco tool views, using the bundled Core engine."""
import io
import json
import os
import re
import tempfile
import time
import zipfile
from contextlib import closing
from itertools import groupby
from pathlib import Path
from typing import Literal

import pypdfium2 as pdfium
from fastapi import File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..documents.extract import PDF_LOCK
from ..paths import local_home
from . import API
from .client import Crop, PdfFile, StirlingClient
from .runtime import runtime_root
from .workbench import read_pdf
from .winjob import JobProcess

TOOLS = ('organize', 'split', 'rotate', 'crop', 'resize', 'compress', 'images-to-pdf', 'pdf-to-images', 'pdf-to-text', 'ocr')


class Options(BaseModel):
    model_config = ConfigDict(extra='forbid')
    pages: str = Field(default='all', max_length=1000)
    split_after: str = Field(default='', max_length=1000)
    angle: Literal[90, 180, 270] = 90
    top: float = Field(default=0, ge=0, le=1000, allow_inf_nan=False)
    bottom: float = Field(default=0, ge=0, le=1000, allow_inf_nan=False)
    left: float = Field(default=0, ge=0, le=1000, allow_inf_nan=False)
    right: float = Field(default=0, ge=0, le=1000, allow_inf_nan=False)
    page_size: Literal['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'LETTER', 'LEGAL', 'KEEP'] = 'A4'
    scale: float = Field(default=100, gt=0, le=1000, allow_inf_nan=False)
    orientation: Literal['PORTRAIT', 'LANDSCAPE'] = 'PORTRAIT'
    quality: int = Field(default=5, ge=1, le=9)
    dpi: Literal[72, 144, 300] = 144
    languages: list[Literal['deu', 'eng']] = Field(default=['deu', 'eng'], min_length=1, max_length=2)
    force_ocr: bool = False


def selected_pages(value, count):
    if value.strip().lower() == 'all':
        return list(range(1, count + 1))
    result = []
    for part in value.split(','):
        match = re.fullmatch(r'\s*(\d+)(?:\s*-\s*(\d+))?\s*', part)
        if not match:
            raise ValueError('Seiten als Zahlen oder Bereiche angeben, z. B. 1,3-5.')
        start, end = int(match[1]), int(match[2] or match[1])
        if start < 1 or end < start or end > count:
            raise ValueError(f'Bitte nur Seiten von 1 bis {count} wählen.')
        result.extend(range(start, end + 1))
    return list(dict.fromkeys(result))


def capabilities(config):
    root = config.runtime.root if config.runtime else runtime_root()
    base = bool(config.runtime and config.runtime.health()['ready'] and
                all((root / name).is_file() for name in ('java/bin/java.exe', 'stirling.jar')))
    return [{'id': tool, 'available': base and all((root / name).is_file() for name in (
        ('qpdf/bin/qpdf.exe',) if tool in ('compress', 'crop', 'resize') else
        ('tesseract/tesseract.exe', 'tesseract/tessdata/deu.traineddata', 'tesseract/tessdata/eng.traineddata') if tool == 'ocr' else ())),
        'reason': 'Benötigt die vollständige, gestartete Offline-PDF-Laufzeit.'} for tool in TOOLS]


def normalize_rotation(source):
    """Bake display rotation into vector contents before PDFBox layout operations."""
    sessions = local_home() / 'pdf-workshop' / 'sessions'
    sessions.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='layout-', dir=sessions) as folder:
        work = Path(folder).resolve()
        if not work.is_relative_to(sessions.resolve()):
            raise ValueError('Ungültiges temporäres Arbeitsverzeichnis.')
        (work / 'input.pdf').write_bytes(source.data)
        process = JobProcess([str(runtime_root() / 'qpdf/bin/qpdf.exe'), '--flatten-rotation', str(work / 'input.pdf'), str(work / 'output.pdf')],
                             cwd=work, env=os.environ.copy(), log=work / 'qpdf.log')
        try:
            deadline = time.monotonic() + 60
            while process.poll() is None and time.monotonic() < deadline:
                time.sleep(.02)
            if process.poll() not in (0, 3) or not (work / 'output.pdf').is_file():
                raise ValueError('Die Seitenausrichtung konnte nicht für die Verarbeitung vorbereitet werden.')
            return PdfFile(source.name, (work / 'output.pdf').read_bytes())
        finally:
            process.close()


def page_geometry(source):
    with PDF_LOCK, pdfium.PdfDocument(source.data) as document:
        if not 1 <= len(document) <= 100:
            raise ValueError('Bitte ein PDF mit 1 bis 100 Seiten verwenden.')
        geometry = []
        for index in range(len(document)):
            with closing(document[index]) as page:
                width, height = page.get_size()
                if not 0 < width < 200000 or not 0 < height < 200000:
                    raise ValueError('Ungültige Seitenabmessungen.')
                geometry.append((width, height, page.get_rotation()))
        return geometry


def process(client, tool, files, options):
    if tool == 'images-to-pdf':
        return client.operation('convert/img/pdf', files, {'fitOption': 'fillPage', 'colorType': 'color', 'autoRotate': 'false'}), 'pdf'
    source = files[0]
    geometry = page_geometry(source)
    if tool in ('crop', 'resize') and any(rotation for _, _, rotation in geometry):
        source = normalize_rotation(source)
        geometry = page_geometry(source)
    count = len(geometry)
    if tool == 'split':
        cuts = selected_pages(options.split_after, count - 1) if options.split_after else list(range(1, count))
        result = source.data if not cuts else client.request_result('general/split-pages', [source], {'pageNumbers': ','.join(map(str, cuts))})
        if result.startswith(b'%PDF-'):
            output = io.BytesIO()
            with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
                archive.writestr('Seite-1.pdf', result)
            result = output.getvalue()
        return result, 'zip'
    if tool == 'rotate':
        return client.operation('general/rotate-pdf', [source], {'angle': str(options.angle)}), 'pdf'
    if tool == 'crop':
        selected = selected_pages(options.pages, count)
        mm = 72 / 25.4
        for number in selected:
            width, height, _ = geometry[number - 1]
            if (options.left + options.right) * mm >= width or (options.top + options.bottom) * mm >= height:
                raise ValueError(f'Die Ränder sind für Seite {number} zu gross.')
        parts = []
        for key, group in groupby(range(count), lambda index: (geometry[index], index + 1 in selected)):
            (width, height, _), crop = key
            indices = list(group)
            part = source if len(indices) == count else PdfFile('Seiten.pdf', client.operation('general/rearrange-pages', [source], {'pageNumbers': ','.join(str(index + 1) for index in indices), 'customMode': 'CUSTOM'}))
            if crop:
                part = PdfFile('Seiten.pdf', client.crop(part, Crop(options.left * mm, options.bottom * mm,
                    width - (options.left + options.right) * mm, height - (options.top + options.bottom) * mm)))
            parts.append(part)
        return (parts[0].data if len(parts) == 1 else client.merge(parts)), 'pdf'
    if tool == 'resize':
        # Core's scaleFactor multiplies an automatic fit-to-page factor. Cancel
        # that fit so the edeco percentage always means actual content scaling.
        mm = 72 / 25.4
        paper = {'A0': (841 * mm, 1189 * mm), 'A1': (594 * mm, 841 * mm), 'A2': (420 * mm, 594 * mm),
                 'A3': (297 * mm, 420 * mm), 'A4': (210 * mm, 297 * mm), 'A5': (148 * mm, 210 * mm),
                 'A6': (105 * mm, 148 * mm), 'LETTER': (612, 792), 'LEGAL': (612, 1008)}
        parts = []
        for (width, height, _), group in groupby(range(count), lambda index: geometry[index]):
            indices = list(group)
            part = source if len(indices) == count else PdfFile('Seiten.pdf', client.operation('general/rearrange-pages', [source], {'pageNumbers': ','.join(str(index + 1) for index in indices), 'customMode': 'CUSTOM'}))
            target_width, target_height = (width, height) if options.page_size == 'KEEP' else paper[options.page_size]
            if options.page_size != 'KEEP' and options.orientation == 'LANDSCAPE':
                target_width, target_height = target_height, target_width
            fit = min(target_width / width, target_height / height)
            data = client.operation('general/scale-pages', [part], {'pageSize': options.page_size, 'orientation': options.orientation, 'scaleFactor': str(options.scale / 100 / fit)})
            parts.append(PdfFile('Seiten.pdf', data))
        return (parts[0].data if len(parts) == 1 else client.merge(parts)), 'pdf'
    if tool == 'compress':
        return client.operation('misc/compress-pdf', [source], {'optimizeLevel': str(options.quality), 'linearize': 'false', 'normalize': 'false'}), 'pdf'
    if tool == 'pdf-to-images':
        selection = selected_pages(options.pages, count)
        if sum(geometry[number - 1][0] * geometry[number - 1][1] * (options.dpi / 72) ** 2 for number in selection) > 100_000_000:
            raise ValueError('Die Bildausgabe ist zu gross. Weniger Seiten oder eine kleinere Auflösung wählen.')
        result = client.raster_images(source, options.dpi, ','.join(map(str, selection)))
        return result, 'zip' if result.startswith(b'PK') else 'png'
    if tool == 'pdf-to-text':
        result = client.request_result('convert/pdf/text', [source], {'outputFormat': 'txt'})
        if not result.strip():
            raise ValueError('Keine Textschicht gefunden. Bitte zuerst die Texterkennung (OCR) verwenden.')
        return result, 'txt'
    if tool == 'ocr':
        return client.ocr(source, tuple(options.languages), force=options.force_ocr), 'pdf'
    raise ValueError('Dieses Werkzeug ist nicht verfügbar.')


def register_operations(app, authorize, config):
    @app.get(API + '/tools')
    def tools(request: Request):
        authorize(request)
        return {'tools': capabilities(config)}

    @app.post(API + '/process/{tool}')
    def run(request: Request, tool: str, files: list[UploadFile] = File(...), options: str = Form('{}')):
        authorize(request, key=True)
        try:
            capability = next((item for item in capabilities(config) if item['id'] == tool), None)
            if not capability or tool == 'organize':
                raise HTTPException(404, 'Unbekanntes PDF-Werkzeug.')
            if not capability['available']:
                raise HTTPException(409, capability['reason'])
            settings = Options.model_validate(json.loads(options))
            if not 1 <= len(files) <= (20 if tool == 'images-to-pdf' else 1):
                raise ValueError('Bitte die passende Anzahl Dateien wählen.')
            inputs = []
            for upload in files:
                if tool == 'images-to-pdf':
                    data = upload.file.read(100 * 1024 * 1024 + 1)
                    if len(data) > 100 * 1024 * 1024:
                        raise ValueError('Bitte höchstens 100 MB je Bild verwenden.')
                    with Image.open(io.BytesIO(data)) as image:
                        if image.format not in ('PNG', 'JPEG') or image.width * image.height > 50_000_000:
                            raise ValueError('Bitte PNG-/JPEG-Bilder mit höchstens 50 Megapixeln verwenden.')
                        mime = Image.MIME[image.format]
                        image.verify()
                else:
                    data, mime = read_pdf(upload), 'application/pdf'
                inputs.append(PdfFile(upload.filename or 'Dokument', data, mime))
            if sum(len(file.data) for file in inputs) > 250 * 1024 * 1024:
                raise ValueError('Bitte insgesamt höchstens 250 MB verwenden.')
            client = StirlingClient(config.url, config.api_key, engine_secret=config.runtime.secret if config.runtime else '')
            content, extension = process(client, tool, inputs, settings)
            valid = content.lstrip().startswith(b'%PDF-') if extension == 'pdf' else content.startswith(b'PK\x03\x04') if extension == 'zip' else content.startswith(b'\x89PNG\r\n') if extension == 'png' else not content.lstrip().startswith((b'<html', b'<!DOCTYPE', b'%PDF-', b'PK\x03\x04'))
            if not valid:
                raise ValueError('Der PDF-Dienst hat kein gültiges Ergebnis geliefert.')
            if extension == 'txt':
                content.decode('utf-8')
            mime = {'pdf': 'application/pdf', 'zip': 'application/zip', 'png': 'image/png', 'txt': 'text/plain; charset=utf-8'}[extension]
            return Response(content, media_type=mime, headers={'Content-Disposition': f'attachment; filename="edeco-{tool}.{extension}"', 'Cache-Control': 'no-store'})
        except (ValueError, ValidationError, pdfium.PdfiumError, UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
            raise HTTPException(400, str(exc) if isinstance(exc, ValueError) and not isinstance(exc, ValidationError) else 'Datei oder Optionen konnten nicht verarbeitet werden.') from None
        finally:
            for file in files:
                file.file.close()
