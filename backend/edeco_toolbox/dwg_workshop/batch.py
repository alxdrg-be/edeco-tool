"""Prepare a set of drawings offline, with a per-drawing record of the outcome."""

import json
import re
import unicodedata
from pathlib import Path
from tempfile import TemporaryDirectory, TemporaryFile
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

from .profile import Profile


MIB = 1024 * 1024
MAX_FILES = 24
MAX_INPUT = 128 * MIB
MAX_OUTPUT = 256 * MIB
MAX_DRAWING_OUTPUT = 64 * MIB
STAT_LABELS = {
    "grey_layers": "Layer grau",
    "hidden_layers": "Layer ausgeblendet",
    "wipeouts_removed": "Verdeckungsflächen entfernt",
    "text_backgrounds_removed": "Texthintergründe entfernt",
    "audit_fixes": "DXF-Reparaturen",
    "audit_errors": "Offene DXF-Fehler",
}


def _basename(filename: str) -> str:
    name = filename.replace("\\", "/").rsplit("/", 1)[-1]
    name = re.sub(r'[<>:"|?*\x00-\x1f\x7f]', "_", name).strip(" .")
    return unicodedata.normalize("NFC", name) or "Plan"


def _output_name(source_name: str, used: set[str]) -> str:
    stem = Path(source_name).stem[:145].strip(" .") or "Plan"
    if re.match(r"^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)", stem, flags=re.I):
        stem = "_" + stem
    name = f"{stem}.dxf"
    suffix = 2
    while name.casefold() in used:
        name = f"{stem} ({suffix}).dxf"
        suffix += 1
    used.add(name.casefold())
    return name


def _write_drawings(archive, files, profile, export_drawing):
    report = ["edeco DWG-Werkstatt · Stapelprotokoll",
              f"DXF-Prüfung und Reparatur: {'ein' if profile.audit_dxf else 'aus'}"]
    used = set()
    count = written_bytes = 0
    for upload in files:
        original = _basename(upload.filename or "")
        report.extend(["", f"Eingabe: {original}"])
        with TemporaryDirectory(prefix="edeco-cad-") as tmp:
            work = Path(tmp)
            try:
                source_note = export_drawing(upload, work)
                if source_note:
                    report.append(source_note)
                drawing = work / "result.dxf"
                size = drawing.stat().st_size
                if size > MAX_DRAWING_OUTPUT or written_bytes + size > MAX_OUTPUT:
                    raise HTTPException(422, "Ausgabelimit erreicht (64 MiB je DXF, 256 MiB je Plansatz).")
                result = json.loads((work / "result.json").read_text(encoding="utf-8"))
            except HTTPException as error:
                report.append(f"Fehlgeschlagen: {error.detail}")
                continue
            name = "Zeichnungen/" + _output_name(original, used)
            archive.write(drawing, name)
            count += 1
            written_bytes += size
            base = ", ".join(str(coord) for coord in result["insertion_base"])
            report.extend([f"Ausgabe: {name}", f"Zeichnungseinheit: {result['unit']}",
                           f"Zeichnungsbasispunkt ($INSBASE, X/Y/Z): {base}"])
            report.extend(f"{label}: {result['stats'][key]}" for key, label in STAT_LABELS.items()
                          if key in result["stats"])
            report.extend(f"Hinweis: {issue}" for issue in result["issues"])
    report.insert(1, f"{count} von {len(files)} Zeichnungen ausgegeben.")
    report.extend(["", "Beim Import in Nova das Zielprojekt und Geschoss wählen. Einheit und Lage "
                   "an bekannten Punkten kontrollieren. Externe Referenzen benötigen ihre Quelldateien "
                   "und gültige Pfade im Zielprojekt."])
    archive.writestr("Stapelprotokoll.txt", ("\r\n".join(report) + "\r\n").encode("utf-8-sig"))
    return count


def batch_download(files: list[UploadFile], profile: Profile, export_drawing):
    if len(files) > MAX_FILES:
        raise HTTPException(413, f"Höchstens {MAX_FILES} Zeichnungen pro Stapel wählen.")
    # Multipart uploads carry the size measured by the parser.
    if sum(upload.size or 0 for upload in files) > MAX_INPUT:
        raise HTTPException(413, "Die Eingabedateien überschreiten zusammen 128 MiB.")
    stream = TemporaryFile("w+b")
    try:
        with ZipFile(stream, "w", compression=ZIP_DEFLATED, compresslevel=3) as archive:
            succeeded = _write_drawings(archive, files, profile, export_drawing)
        length = stream.tell()
        stream.seek(0)
        return StreamingResponse(
            iter(lambda: stream.read(MIB), b""),
            media_type="application/zip",
            headers={"Cache-Control": "no-store", "Content-Length": str(length),
                     "Content-Disposition": 'attachment; filename="edeco-Plansatz.zip"',
                     "X-DWG-Succeeded": str(succeeded), "X-DWG-Failed": str(len(files) - succeeded)},
            background=BackgroundTask(stream.close),
        )
    except BaseException:
        stream.close()
        raise
