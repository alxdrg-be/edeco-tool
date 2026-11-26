"""Preview a local drawing or return a modified DXF in a separate download."""

import os
from contextlib import contextmanager
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import BoundedSemaphore

from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import ValidationError

from nova_legend import config
from nova_legend.importer.dwg import ConversionFailed, ConverterMissing, convert_dwg_to_dxf

from ..presentation import require_design_beta
from .batch import MIB, MAX_DRAWING_OUTPUT, batch_download
from .profile import Profile

PREFIX = "/api/dwg-workshop"
MAX_UPLOAD = 16 * MIB


def _oda_converter(request: Request) -> str:
    nova = getattr(request.app.state, "nova", None)
    return config.resolve_oda_converter(nova.settings.oda_path if nova else "")


def _write_source(file: UploadFile, directory: Path, request: Request) -> str | None:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".dwg", ".dxf"}:
        raise HTTPException(415, "Bitte eine DWG- oder DXF-Datei wählen.")
    if file.size is not None and file.size > MAX_UPLOAD:
        raise HTTPException(413, "Pro DWG- oder DXF-Datei sind bis zu 16 MiB möglich.")
    count = 0
    source = directory / ("source" + suffix)
    with source.open("wb") as target:
        while chunk := file.file.read(MIB):
            count += len(chunk)
            if count > MAX_UPLOAD:
                raise HTTPException(413, "Pro DWG- oder DXF-Datei sind bis zu 16 MiB möglich.")
            target.write(chunk)
    if not count:
        raise HTTPException(422, "Die Zeichnungsdatei ist leer.")
    if suffix == ".dxf":
        return

    with source.open("rb") as drawing:
        signature = drawing.read(6)
    if len(signature) != 6 or not signature.startswith(b"AC"):
        raise HTTPException(415, "Die Datei hat keine erkennbare DWG-Kennung.")
    oda = _oda_converter(request)
    if not oda:
        raise HTTPException(503, "Für DWG den ODA File Converter auf diesem PC installieren. "
                                 "Die Werkstatt erkennt ihn im Standardordner Programme/ODA automatisch.")
    # Preserve the newer drawing model for R2018+ instead of downgrading it for the layer cleanup.
    version = "ACAD2018" if signature[2:].isdigit() and signature >= b"AC1032" else "ACAD2013"
    try:
        converted = convert_dwg_to_dxf(source, oda, directory, version=version, timeout=45)
    except subprocess.TimeoutExpired:
        raise HTTPException(422, "Die DWG-Konvertierung dauerte länger als 45 Sekunden.") from None
    except ConverterMissing:
        raise HTTPException(503, "Der lokale ODA File Converter ist nicht verfügbar. Installation prüfen.") from None
    except ConversionFailed as exc:
        raise HTTPException(422, str(exc)) from None
    except (OSError, RuntimeError):
        raise HTTPException(422, "Der ODA File Converter konnte diese DWG nicht in DXF umwandeln.") from None
    if converted.stat().st_size > MAX_DRAWING_OUTPUT:
        raise HTTPException(422, "Die konvertierte Zeichnung überschreitet 64 MiB. Einen kleineren Teilplan wählen.")
    release = " " + signature.decode("ascii") if signature[2:].isdigit() else ""
    return (f"DWG{release} → DXF R{version.removeprefix('ACAD')} · "
            "ODA-Prüfung und Reparatur beim Einlesen aktiviert.")


def _worker(operation, directory):
    if getattr(sys, "frozen", False):
        command = [sys.executable, "--dwg-workshop-worker"]
    else:
        command = [sys.executable, "-m", "edeco_toolbox.dwg_workshop.worker"]
    env = os.environ.copy()
    env["PYTHONPATH"] = os.pathsep.join([str(Path(__file__).resolve().parents[2]), env.get("PYTHONPATH", "")])
    try:
        result = subprocess.run([*command, operation, str(directory)], env=env, timeout=45, stdin=subprocess.DEVNULL,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False,
                                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except subprocess.TimeoutExpired:
        raise HTTPException(422, "Die DXF-Verarbeitung dauerte länger als 45 Sekunden. Einen kleineren Teilplan öffnen.") from None
    if result.returncode:
        path = directory / "error.txt"
        message = path.read_text(encoding="utf-8") if path.is_file() else "Die DXF-Verarbeitung wurde abgebrochen."
        raise HTTPException(422, message)


def register(app: FastAPI):
    router = APIRouter(prefix=PREFIX, tags=["dwg-workshop"], dependencies=[Depends(require_design_beta)])
    capacity = BoundedSemaphore(2)

    @contextmanager
    def job(profile):
        try:
            parsed = Profile.model_validate_json(profile)
        except ValidationError:
            raise HTTPException(422, "Büroprofil prüfen: Layerregeln und DXF-Linienstärken müssen gültig sein.") from None
        if not capacity.acquire(blocking=False):
            raise HTTPException(409, "Die DWG-Werkstatt verarbeitet bereits zwei Aufträge. Bitte erneut versuchen.")
        try:
            yield parsed
        finally:
            capacity.release()

    def run(operation, request, file, directory, profile):
        source_note = _write_source(file, directory, request) if file else None
        (directory / "profile.json").write_text(profile.model_dump_json(), encoding="utf-8")
        _worker(operation, directory)
        return source_note

    def process(operation, file, profile, request):
        with job(profile) as parsed, TemporaryDirectory(prefix="edeco-cad-") as tmp:
            directory = Path(tmp)
            run(operation, request, file, directory, parsed)
            preview = operation == "preview"
            result = directory / ("result.json" if preview else "result.dxf")
            if result.stat().st_size > MAX_DRAWING_OUTPUT:
                raise HTTPException(422, "Die Ausgabe überschreitet 64 MiB. Einen kleineren Teilplan wählen.")
            headers = {"Cache-Control": "no-store"}
            if not preview:
                headers["Content-Disposition"] = 'attachment; filename="Plan_aufbereitet.dxf"'
            return Response(result.read_bytes(), media_type="application/json" if preview else "application/dxf", headers=headers)

    @router.get("/capabilities")
    def capabilities(request: Request):
        return {"dwg_available": bool(_oda_converter(request))}

    @router.post("/preview")
    def preview(request: Request, file: UploadFile | None = File(None), profile: str = Form("{}", max_length=64000)):
        return process("preview", file, profile, request)

    @router.post("/export")
    def export(request: Request, file: UploadFile | None = File(None), profile: str = Form("{}", max_length=64000)):
        return process("export", file, profile, request)

    @router.post("/batch")
    def batch(request: Request, files: list[UploadFile] = File(...), profile: str = Form("{}", max_length=64000)):
        with job(profile) as parsed:
            def export_drawing(file, directory):
                return run("export", request, file, directory, parsed)

            return batch_download(files, parsed, export_drawing)

    app.include_router(router)
