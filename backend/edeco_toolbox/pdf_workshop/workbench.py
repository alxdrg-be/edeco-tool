"""Small edeco workspace API; document editing stays in the local Stirling Core."""
import base64
import io
import json
from contextlib import closing
from itertools import groupby

import pypdfium2 as pdfium
from fastapi import File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field, ValidationError

from ..documents.extract import PDF_LOCK
from . import API
from .client import PdfFile, StirlingClient


class PageSelection(BaseModel):
    file: int = Field(ge=0, le=19)
    page: int = Field(ge=1, le=100)
    rotation: int = Field(default=0)


def read_pdf(file):
    data = file.file.read(100 * 1024 * 1024 + 1)
    if len(data) > 100 * 1024 * 1024 or not data.lstrip().startswith(b'%PDF-'):
        raise ValueError('Bitte eine PDF-Datei mit höchstens 100 MB verwenden.')
    return data


def register_workbench(app, authorize, config):
    @app.post(API + '/inspect')
    def inspect(request: Request, file: UploadFile = File(...)):
        authorize(request, key=True)
        try:
            data = read_pdf(file)
            pages = []
            with PDF_LOCK, pdfium.PdfDocument(data) as document:
                if not 1 <= len(document) <= 100:
                    raise ValueError('Bitte höchstens 100 Seiten pro PDF verwenden.')
                for index in range(len(document)):
                    with closing(document[index]) as page:
                        width, height = page.get_size()
                        with closing(page.render(scale=360 / max(width, height))) as bitmap:
                            image = bitmap.to_pil()
                            output = io.BytesIO()
                            image.save(output, format='PNG')
                            image.close()
                        pages.append({'number': index + 1, 'width': width, 'height': height,
                                      'thumbnail': 'data:image/png;base64,' + base64.b64encode(output.getvalue()).decode()})
            return {'pages': pages}
        except (ValueError, pdfium.PdfiumError):
            raise HTTPException(400, 'Das PDF konnte nicht geöffnet werden. Bitte eine unverschlüsselte, gültige PDF mit höchstens 100 Seiten und 100 MB wählen.') from None
        finally:
            file.file.close()

    @app.post(API + '/compose')
    def compose(request: Request, files: list[UploadFile] = File(...), pages: str = Form(...)):
        authorize(request, key=True)
        try:
            raw = json.loads(pages)
            if not isinstance(raw, list) or not 1 <= len(raw) <= 100 or not 1 <= len(files) <= 20:
                raise ValueError('Bitte 1 bis 100 Seiten aus höchstens 20 PDFs wählen.')
            selection = [PageSelection.model_validate(item) for item in raw]
            originals = [PdfFile(file.filename or 'Dokument.pdf', read_pdf(file)) for file in files]
            if sum(len(file.data) for file in originals) > 250 * 1024 * 1024:
                raise ValueError('Bitte insgesamt höchstens 250 MB verwenden.')
            with PDF_LOCK:
                counts = []
                for file in originals:
                    with pdfium.PdfDocument(file.data) as document:
                        counts.append(len(document))
            for item in selection:
                if item.file >= len(originals) or item.page > counts[item.file] or item.rotation not in (0, 90, 180, 270):
                    raise ValueError('Ungültige Seitenauswahl oder Drehung.')
            client = StirlingClient(config.url, config.api_key,
                                    engine_secret=config.runtime.secret if config.runtime else '')
            parts = []
            for (file_index, rotation), group in groupby(selection, lambda item: (item.file, item.rotation)):
                numbers = ','.join(str(item.page) for item in group)
                data = client.operation('general/rearrange-pages', [originals[file_index]],
                                        {'pageNumbers': numbers, 'customMode': 'CUSTOM'})
                if rotation:
                    data = client.operation('general/rotate-pdf', [PdfFile('Seiten.pdf', data)], {'angle': str(rotation)})
                parts.append(PdfFile('Seiten.pdf', data))
            result = parts[0].data if len(parts) == 1 else client.merge(parts)
            return Response(result, media_type='application/pdf',
                            headers={'Content-Disposition': 'attachment; filename="edeco-Zusammenstellung.pdf"', 'Cache-Control': 'no-store'})
        except (ValueError, ValidationError, pdfium.PdfiumError) as exc:
            raise HTTPException(400, str(exc) if isinstance(exc, ValueError) and not isinstance(exc, ValidationError)
                                else 'Die Seitenauswahl konnte nicht verarbeitet werden.') from None
        finally:
            for file in files:
                file.file.close()
