"""Extract PDF rectangles and text lines without executing embedded PDF content."""

import base64
import io
import threading
from contextlib import closing
from pathlib import Path

import pypdfium2 as pdfium

# PDFium must not be used concurrently, including across different documents.
PDF_LOCK = threading.RLock()
MAX_BYTES = 100 * 1024 * 1024
MAX_PAGES = 2000
MAX_TEXT = 8_000_000


def extract(data: bytes, kind: str) -> list[dict]:
    if not data or len(data) > MAX_BYTES:
        raise ValueError("Bitte eine nicht leere Datei mit höchstens 100 MB wählen.")
    if kind != "pdf":
        try:
            text = data.decode("utf-8-sig")
        except UnicodeError:
            raise ValueError("Textdateien bitte als UTF-8 speichern.") from None
        if "\x00" in text or len(text) > MAX_TEXT:
            raise ValueError("Die Textdatei enthält Binärdaten oder zu viel Text.")
        return [{"number": 1, "label": "", "lines": [
            {"number": i, "text": line, "box": None}
            for i, line in enumerate(text.splitlines(), 1)
        ]}]
    try:
        with PDF_LOCK, pdfium.PdfDocument(data) as doc:
            if not 0 < len(doc) <= MAX_PAGES:
                raise ValueError("PDF-Dateien mit 1 bis 2000 Seiten werden unterstützt.")
            pages, total = [], 0
            for index in range(len(doc)):
                with closing(doc[index]) as page, closing(page.get_textpage()) as textpage:
                    lines = []
                    for r in range(textpage.count_rects()):
                        box = textpage.get_rect(r)
                        text = textpage.get_text_bounded(*box).strip()
                        if not text:
                            continue
                        total += len(text)
                        if total > MAX_TEXT:
                            raise ValueError("Das PDF enthält zu viel Text. Bitte in kleinere Dokumente aufteilen.")
                        lines.append({"number": len(lines) + 1, "text": text, "box": list(box)})
                    pages.append({"number": index + 1, "label": doc.get_page_label(index), "lines": lines})
            return pages
    except pdfium.PdfiumError:
        raise ValueError("Das PDF konnte nicht gelesen werden. Bitte eine gültige, unverschlüsselte PDF-Datei wählen.") from None


def preview(path: Path, page_number: int, lines: list[dict]) -> str:
    """Render original page and convert PDF coordinates, including page rotation."""
    with PDF_LOCK, pdfium.PdfDocument(path) as doc, closing(doc[page_number - 1]) as page:
        width, height = page.get_size()
        if min(width, height) <= 0:
            raise ValueError("Diese PDF-Seite hat keine gültige Grösse.")
        with closing(page.render(scale=min(2, 1600 / max(width, height)))) as bitmap:
            conv = bitmap.get_posconv(page)
            for line in lines:
                left, bottom, right, top = line["box"]
                corners = [conv.to_bitmap(x, y) for x, y in (
                    (left, bottom), (left, top), (right, bottom), (right, top))]
                xs, ys = zip(*corners)
                line["box"] = [max(0, min(xs) / bitmap.width), max(0, min(ys) / bitmap.height),
                               min(1, max(xs) / bitmap.width), min(1, max(ys) / bitmap.height)]
            buffer = io.BytesIO()
            bitmap.to_pil().save(buffer, format="PNG")
            return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
