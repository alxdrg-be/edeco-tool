"""UI-independent controller: delegates every PDF operation to Stirling's API."""

from dataclasses import dataclass
import math
from pathlib import Path
from typing import Sequence

import httpx

from . import ROOT
from .config import service_url


@dataclass(frozen=True)
class PdfFile:
    name: str
    data: bytes

    @classmethod
    def read(cls, path: Path):
        return cls(path.name, path.read_bytes())


@dataclass(frozen=True)
class Crop:
    """PDF points, bottom-left origin; 72 points = 1 inch (Stirling 3.2.2)."""
    x: float
    y: float
    width: float
    height: float
    pages: str = "all"


class StirlingClient:
    def __init__(self, url: str, api_key: str = "", *, transport=None, engine_secret=""):
        self.url = service_url(url) + ROOT
        self.headers = {"X-API-KEY": api_key} if api_key else {}
        if engine_secret:
            self.headers['X-Edeco-Engine'] = engine_secret
        self.transport = transport

    def health(self):
        try:
            with httpx.Client(timeout=5, headers=self.headers, transport=self.transport, follow_redirects=False, trust_env=False) as client:
                response = client.get(self.url + "/api/v1/info/status")
            response.raise_for_status()
            data = response.json()
            if not isinstance(data, dict) or data.get("status") != "UP":
                raise ValueError("Stirling-PDF ist noch nicht bereit.")
            return {"ready": True, "version": data.get("version", ""), "message": "Stirling-PDF ist verbunden."}
        except (httpx.HTTPError, ValueError, TypeError):
            return {"ready": False, "version": "", "message": "Stirling-PDF ist nicht erreichbar. Bitte den lokalen Dienst oder Firmenserver starten und die Adresse prüfen."}

    def operation(self, endpoint: str, files: Sequence[PdfFile], fields: dict, *, pdf=True) -> bytes:
        if not files or len(files) > 100 or sum(len(file.data) for file in files) > 250 * 1024 * 1024:
            raise ValueError("Bitte 1 bis 100 Dateien mit insgesamt höchstens 250 MB verwenden.")
        uploads = [("fileInput", (Path(file.name.replace("\\", "/")).name, file.data, "application/pdf")) for file in files]
        try:
            with httpx.Client(timeout=httpx.Timeout(300, connect=10), headers=self.headers,
                              transport=self.transport, follow_redirects=False, trust_env=False) as client:
                response = client.post(self.url + "/api/v1/" + endpoint, files=uploads, data=fields)
            response.raise_for_status()
        except httpx.HTTPError:
            raise ValueError("Stirling-PDF konnte die Verarbeitung nicht abschliessen. Bitte Verbindung, Eingaben und verfügbare Werkzeuge prüfen.") from None
        if pdf and not response.content.lstrip().startswith(b"%PDF-"):
            raise ValueError("Stirling-PDF hat keine fertige PDF-Datei geliefert.")
        if not pdf and not response.content.startswith((b"PK\x03\x04", b"\x89PNG\r\n")):
            raise ValueError("Stirling-PDF hat keine PNG-/ZIP-Bildausgabe geliefert.")
        return response.content

    def merge(self, files: Sequence[PdfFile]) -> bytes:
        if len(files) < 2:
            raise ValueError("Zum Zusammenfügen mindestens zwei PDFs wählen.")
        return self.operation("general/merge-pdfs", files,
                              {"sortType": "orderProvided", "removeCertSign": "true", "generateToc": "false"})

    def crop(self, file: PdfFile, area: Crop) -> bytes:
        if (not all(math.isfinite(value) for value in (area.x, area.y, area.width, area.height))
                or min(area.width, area.height) <= 0 or min(area.x, area.y) < 0):
            raise ValueError("Bitte ein gültiges Zuschneiderechteck verwenden.")
        return self.operation("general/crop", [file], {"x": str(area.x), "y": str(area.y),
                              "width": str(area.width), "height": str(area.height), "pageNumbers": area.pages,
                              "autoCrop": "false", "removeDataOutsideCrop": "true"})

    def resize(self, file: PdfFile, page_size="A4", scale_factor=1.0, orientation="PORTRAIT") -> bytes:
        if page_size not in {"A0", "A1", "A2", "A3", "A4", "A5", "A6", "LETTER", "LEGAL", "KEEP"} or not math.isfinite(scale_factor) or not 0 < scale_factor <= 10:
            raise ValueError("Ungültiges Seitenformat oder Skalierung.")
        if orientation not in {"PORTRAIT", "LANDSCAPE"}:
            raise ValueError("Ungültige Seitenausrichtung.")
        return self.operation("general/scale-pages", [file], {"pageSize": page_size,
                              "scaleFactor": str(scale_factor), "orientation": orientation})

    def ocr(self, file: PdfFile, languages=("deu", "eng"), *, force=False) -> bytes:
        if not languages or any(not language.isalpha() for language in languages):
            raise ValueError("Bitte gültige OCR-Sprachkürzel verwenden.")
        return self.operation("misc/ocr-pdf", [file], {"languages": ",".join(languages),
                              "ocrType": "force-ocr" if force else "skip-text", "ocrRenderType": "sandwich",
                              "sidecar": "false", "deskew": "true", "rotatePages": "false",
                              "clean": "false", "cleanFinal": "false", "removeImagesAfter": "false"})

    def raster_images(self, file: PdfFile, dpi=300, pages="all") -> bytes:
        """PNG/ZIP export at a specified DPI. Vector page scaling has no DPI."""
        if not isinstance(dpi, int) or not 72 <= dpi <= 600:
            raise ValueError("Für die Bildausgabe bitte 72 bis 600 DPI wählen.")
        return self.operation("convert/pdf/img", [file], {"dpi": str(dpi), "pageNumbers": pages,
                              "imageFormat": "png", "singleOrMultiple": "multiple", "colorType": "color"}, pdf=False)

    def stamp(self, file: PdfFile, text="ENTWURF") -> bytes:
        return self.operation("security/add-watermark", [file], {"watermarkType": "text", "watermarkText": text,
                              "alphabet": "roman", "fontSize": "30", "rotation": "35", "opacity": "0.25",
                              "widthSpacer": "100", "heightSpacer": "100", "customColor": "#c26279",
                              "convertPDFToImage": "false"})
