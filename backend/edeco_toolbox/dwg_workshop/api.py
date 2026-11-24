"""Preview a local drawing or return a modified DXF in a separate download."""

import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import BoundedSemaphore

from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import ValidationError

from ..presentation import require_design_beta
from .profile import Profile

PREFIX = "/api/dwg-workshop"
MIB = 1024 * 1024
MAX_UPLOAD = 16 * MIB


def _write_source(file: UploadFile, directory: Path):
    if not (file.filename or "").casefold().endswith(".dxf"):
        raise HTTPException(415, "Bitte eine DXF-Datei wählen. DWG zuerst in Nova als DXF speichern.")
    if file.size is not None and file.size > MAX_UPLOAD:
        raise HTTPException(413, "DXF-Dateien bis 16 MiB werden unterstützt.")
    count = 0
    with (directory / "source.dxf").open("wb") as target:
        while chunk := file.file.read(MIB):
            count += len(chunk)
            if count > MAX_UPLOAD:
                raise HTTPException(413, "DXF-Dateien bis 16 MiB werden unterstützt.")
            target.write(chunk)
    if not count:
        raise HTTPException(422, "Die DXF-Datei ist leer.")


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

    def process(operation, file, profile):
        try:
            parsed = Profile.model_validate_json(profile)
        except ValidationError:
            raise HTTPException(422, "Büroprofil prüfen: Layerregeln und DXF-Linienstärken müssen gültig sein.") from None
        if not capacity.acquire(blocking=False):
            raise HTTPException(409, "Die DWG-Werkstatt verarbeitet bereits zwei Pläne. Bitte erneut versuchen.")
        try:
            with TemporaryDirectory(prefix="edeco-dxf-") as tmp:
                directory = Path(tmp)
                if file:
                    _write_source(file, directory)
                (directory / "profile.json").write_text(parsed.model_dump_json(), encoding="utf-8")
                _worker(operation, directory)
                preview = operation == "preview"
                result = directory / ("result.json" if preview else "result.dxf")
                if result.stat().st_size > 64 * MIB:
                    raise HTTPException(422, "Die Ausgabe überschreitet 64 MiB. Einen kleineren Teilplan wählen.")
                headers = {"Cache-Control": "no-store"}
                if not preview:
                    headers["Content-Disposition"] = 'attachment; filename="Plan_aufbereitet.dxf"'
                return Response(result.read_bytes(), media_type="application/json" if preview else "application/dxf", headers=headers)
        finally:
            capacity.release()

    @router.post("/preview")
    def preview(file: UploadFile | None = File(None), profile: str = Form("{}", max_length=64000)):
        return process("preview", file, profile)

    @router.post("/export")
    def export(file: UploadFile | None = File(None), profile: str = Form("{}", max_length=64000)):
        return process("export", file, profile)

    app.include_router(router)
