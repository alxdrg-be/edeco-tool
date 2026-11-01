"""Preview floor labels and download renamed copies; never mutate source files."""

import hmac
import io
import json
import re
import secrets
import zipfile
from contextlib import closing
from urllib.parse import urlsplit

import pypdfium2 as pdfium
from fastapi import File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from ...documents.extract import PDF_LOCK

PREFIX = "/api/tools/dateien-umbenennen"
MAX_FILE = 30 * 1024 * 1024
MAX_TOTAL = 150 * 1024 * 1024


def floors(text: str) -> list[str]:
    # Underscores/hyphens are separators in the company naming convention.
    text = re.sub(r"[_-]", " ", text.upper())
    found = set()
    for match in re.finditer(r"\b(OG|UG)\s*0*(\d{1,2})\b|\b(\d{1,2})\s*\.?\s*(OG|UG|OBERGESCHOSS|UNTERGESCHOSS)\b|\b(OBERGESCHOSS|UNTERGESCHOSS)\s*0*(\d{1,2})\b", text):
        a, b, c, d, e, f = match.groups()
        kind, number = (a, b) if a else (d, c) if c else (e, f)
        kind = {"OBERGESCHOSS": "OG", "UNTERGESCHOSS": "UG"}.get(kind, kind)
        found.add(f"{kind}{int(number):02}")
    if re.search(r"\b(?:EG\s*00|EG|ERDGESCHOSS)\b", text):
        found.add("EG00")
    return sorted(found)


def inspect_pdf(name: str, data: bytes) -> dict:
    named = floors(name.rsplit(".", 1)[0])
    inside, note = [], ""
    try:
        with PDF_LOCK, pdfium.PdfDocument(data) as doc:
            texts = []
            for index in range(min(len(doc), 5)):
                with closing(doc[index]) as page, closing(page.get_textpage()) as text:
                    texts.append(text.get_text_range()[:100_000])
        inside = floors("\n".join(texts))
        if not any(text.strip() for text in texts):
            note = "Kein lesbarer PDF-Text. Bei Scans Geschoss selbst prüfen."
    except pdfium.PdfiumError:
        note = "PDF nicht lesbar oder geschützt. Geschoss selbst prüfen."
    candidates = sorted(set(named + inside))
    source = "Dateiname und PDF" if named and inside else "Dateiname" if named else "PDF-Text" if inside else "Keine Fundstelle"
    if len(candidates) > 1:
        note = "Mehrere Geschosse gefunden. Bitte das gewünschte Geschoss wählen."
    elif not candidates and not note:
        note = "Kein Geschoss erkannt. Bitte eintragen."
    return {"floor": candidates[0] if len(candidates) == 1 else "", "candidates": candidates,
            "source": source, "note": note}


def validate_names(names: list[str]):
    seen = set()
    for name in names:
        if (not name or len(name) > 180 or not name.lower().endswith(".pdf")
                or re.search(r'[<>:"/\\|?*\x00-\x1f]', name) or name.endswith((" ", "."))
                or re.match(r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", name, re.I)):
            raise ValueError("Bitte gültige PDF-Dateinamen mit höchstens 180 Zeichen verwenden.")
        key = name.casefold()
        if key in seen:
            raise ValueError("Mehrere Dateien haben denselben neuen Namen. Bitte die Vorschau korrigieren.")
        seen.add(key)


def register(app):
    session = secrets.token_urlsafe(32)

    def authorize(request, key=True):
        host = request.headers.get("host", "")
        origin = request.headers.get("origin")
        if (urlsplit("http://" + host).hostname not in {"localhost", "127.0.0.1"}
                or origin and origin != "http://" + host
                or key and not hmac.compare_digest(request.headers.get("X-Edeco-Rename", "").encode(), session.encode())):
            raise HTTPException(403, "Dateien bitte direkt in der Toolbox öffnen.")

    @app.get(PREFIX + "/state")
    def state(request: Request):
        authorize(request, False)
        return {"session_key": session}

    @app.post(PREFIX + "/inspect")
    async def inspect(request: Request, file: UploadFile = File(...)):
        authorize(request)
        try:
            data = await file.read(MAX_FILE + 1)
            if not data or len(data) > MAX_FILE or not (file.filename or "").lower().endswith(".pdf"):
                raise HTTPException(400, "Bitte PDFs mit höchstens 30 MB je Datei wählen.")
            return await run_in_threadpool(inspect_pdf, file.filename, data)
        finally:
            await file.close()

    @app.post(PREFIX + "/export")
    async def export(request: Request, files: list[UploadFile] = File(...), names: str = Form(...)):
        authorize(request)
        try:
            try:
                targets = json.loads(names)
                if (not isinstance(targets, list) or len(targets) != len(files) or not 1 <= len(files) <= 100
                        or any(not isinstance(name, str) for name in targets)):
                    raise ValueError("Bitte 1 bis 100 Dateien mit passenden Namen wählen.")
                validate_names(targets)
            except (ValueError, TypeError) as exc:
                raise HTTPException(400, str(exc)) from None
            output, total = io.BytesIO(), 0
            with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
                for upload, name in zip(files, targets):
                    data = await upload.read(MAX_FILE + 1)
                    total += len(data)
                    if not data or len(data) > MAX_FILE or total > MAX_TOTAL:
                        raise HTTPException(400, "Höchstens 30 MB je PDF und insgesamt 150 MB verwenden.")
                    if not data.lstrip().startswith(b"%PDF-"):
                        raise HTTPException(400, "Eine Datei ist keine PDF-Datei.")
                    archive.writestr(name, data)
            return Response(output.getvalue(), media_type="application/zip",
                            headers={"Content-Disposition": 'attachment; filename="edeco-planlieferung.zip"'})
        finally:
            for upload in files:
                await upload.close()
