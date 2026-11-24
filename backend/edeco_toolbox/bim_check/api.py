"""Lokaler Import und Prüfbericht; jede geöffnete Ansicht hat eine eigene Modell-ID."""

import json
import logging
import os
from contextlib import contextmanager
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import BoundedSemaphore, Lock
from time import monotonic
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, FastAPI, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from .storage import element_detail

PREFIX = "/api/bim-check"
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MIB = 1024 * 1024
log = logging.getLogger(__name__)


class ModelSessions:
    """Aktive Requests behalten die Referenz auf ihren Ordner bis zum Abschluss."""

    def __init__(self):
        self.entries: dict[str, tuple[TemporaryDirectory, float]] = {}
        self.lock = Lock()

    def add(self, model_id: str, directory: TemporaryDirectory) -> None:
        with self.lock:
            now = monotonic()
            self.entries = {key: entry for key, entry in self.entries.items() if now - entry[1] < 7200}
            if len(self.entries) >= 8:
                raise HTTPException(409, "Acht Modelle sind geöffnet. Bitte ein Modell schliessen.")
            self.entries[model_id] = (directory, now)

    def get(self, model_id: str) -> TemporaryDirectory:
        with self.lock:
            entry = self.entries.get(model_id)
            if not entry:
                raise HTTPException(404, "Das Modell ist nicht mehr geöffnet. Bitte erneut importieren.")
            self.entries[model_id] = (entry[0], monotonic())
            return entry[0]

    def close(self, model_id: str) -> None:
        with self.lock:
            self.entries.pop(model_id, None)


def _save_upload(file: UploadFile, target: Path, max_mib: int) -> None:
    limit = max_mib * MIB
    if file.size is not None and file.size > limit:
        raise HTTPException(413, f"Die Datei ist grösser als {max_mib} MiB.")
    size = 0
    with target.open("wb") as output:
        while block := file.file.read(MIB):
            size += len(block)
            if size > limit:
                raise HTTPException(413, f"Die Datei ist grösser als {max_mib} MiB.")
            output.write(block)
    if not size:
        raise HTTPException(422, "Die ausgewählte Datei ist leer.")


def _run_worker(operation: str, directory: Path, job: Path, model_id: str, filename: str) -> None:
    if getattr(sys, "frozen", False):
        command = [sys.executable, "--bim-check-worker"]
    else:
        command = [sys.executable, "-m", "edeco_toolbox.bim_check.worker"]
    env = os.environ.copy()
    env["PYTHONPATH"] = os.pathsep.join([str(Path(__file__).resolve().parents[2]), env.get("PYTHONPATH", "")])
    try:
        result = subprocess.run(
            [*command, operation, str(directory), str(job), model_id, filename],
            env=env, timeout=300, check=False, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(422, "Die Verarbeitung hat fünf Minuten überschritten. Einen Teilmodell-Export oder weniger Regeln verwenden.") from None
    if result.returncode:
        error = job / "error.json"
        if result.returncode == 2 and error.is_file():
            raise HTTPException(422, json.loads(error.read_text(encoding="utf-8")))
        crash = job / "crash.txt"
        log.warning("BIM-Verarbeitung %s beendet mit Code %d%s", operation, result.returncode,
                    ":\n" + crash.read_text(encoding="utf-8", errors="replace") if crash.is_file() else "")
        raise HTTPException(422, "Datei konnte nicht vollständig verarbeitet werden. Format und Daten prüfen oder ein Teilmodell importieren.")


def _download(data: bytes, filename: str) -> Response:
    return Response(data, media_type=XLSX, headers={
        "Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store",
    })


def register(app: FastAPI) -> None:
    router = APIRouter(prefix=PREFIX, tags=["bim-check"])
    sessions = ModelSessions()
    processor = BoundedSemaphore(1)
    report_io = Lock()

    @contextmanager
    def processing(*, wait: bool = False):
        if not processor.acquire(blocking=wait):
            raise HTTPException(409, "Eine BIM-Verarbeitung läuft bereits. Bitte nach Abschluss nochmals versuchen.")
        try:
            yield
        finally:
            processor.release()

    def prepare_model(file: UploadFile, filename: str, suffix: str, model_id: str, work: Path):
        with TemporaryDirectory(prefix="import-", dir=work) as temp:
            job = Path(temp)
            source = job / ("input" + suffix)
            _save_upload(file, source, 256 if suffix == ".ifc" else 64)
            _run_worker("ifc" if suffix == ".ifc" else "nova", work, job, model_id, filename)
            if suffix == ".ifc":
                source.replace(work / "model.ifc")
        return (work / "overview.json").read_bytes()

    @router.post("/models")
    async def import_model(request: Request, file: UploadFile):
        filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
        suffix = Path(filename).suffix.lower()
        if suffix not in {".ifc", ".xlsx"}:
            raise HTTPException(415, "Bitte eine IFC-Datei (.ifc) oder eine NOVA-Objektliste (.xlsx) wählen.")
        with processing():
            model_id = uuid4().hex
            directory = TemporaryDirectory(prefix="edeco-bim-modell-")
            try:
                overview = await run_in_threadpool(prepare_model, file, filename, suffix, model_id, Path(directory.name))
                if await request.is_disconnected():
                    directory.cleanup()
                    return Response(status_code=204)
                sessions.add(model_id, directory)
            except BaseException:
                directory.cleanup()
                raise
        return Response(overview, media_type="application/json", headers={"Cache-Control": "no-store"})

    @router.get("/models/{model_id}/scene")
    def scene(model_id: str):
        directory = sessions.get(model_id)
        work = Path(directory.name)
        cache = work / "scene.json"
        if not (work / "model.ifc").is_file():
            raise HTTPException(422, "Für die 3D-Ansicht wird ein IFC-Modell mit räumlicher Geometrie benötigt.")
        if not cache.is_file():
            # Two tabs (or reopening the view) can request the same scene while the native
            # worker is still tessellating. Publish only a completed scene, once per model.
            with processing(wait=True):
                if not cache.is_file():
                    with TemporaryDirectory(prefix="szene-", dir=work) as temp:
                        job = Path(temp)
                        _run_worker("scene", work, job, model_id, "")
                        (job / "scene.json").replace(cache)
        return Response(cache.read_bytes(), media_type="application/json", headers={"Cache-Control": "no-store"})

    @router.get("/models/{model_id}/model.ifc")
    def model_file(model_id: str):
        # Read-only copy for the in-browser IFC viewer. The original upload stays untouched.
        source = Path(sessions.get(model_id).name) / "model.ifc"
        if not source.is_file():
            raise HTTPException(422, "Für die 3D-Ansicht wird ein IFC-Modell benötigt.")
        return FileResponse(source, media_type="application/octet-stream", headers={"Cache-Control": "no-store"})

    @router.get("/models/{model_id}/elements/{element_id:path}")
    def inspect(model_id: str, element_id: str):
        directory = sessions.get(model_id)
        entry = element_detail(Path(directory.name), element_id)
        if entry is None:
            raise HTTPException(404, "Das Element wurde im geöffneten Modell nicht gefunden.")
        return entry

    @router.post("/models/{model_id}/guide")
    def check(model_id: str, file: UploadFile):
        filename = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
        if Path(filename).suffix.lower() != ".xlsx":
            raise HTTPException(415, "Bitte ein Excel-Regelwerk im Format .xlsx wählen.")
        directory = sessions.get(model_id)
        work = Path(directory.name)
        with processing(), TemporaryDirectory(prefix="pruefung-", dir=work) as temp:
            job = Path(temp)
            _save_upload(file, job / "input.xlsx", 64)
            _run_worker("check", work, job, model_id, filename)
            results = (job / "results.json").read_bytes()
            with report_io:
                (job / "report.xlsx").replace(work / "report.xlsx")
        return Response(results, media_type="application/json", headers={"Cache-Control": "no-store"})

    @router.get("/template.xlsx")
    def template(source: Literal["IFC", "NOVA"] = "IFC"):
        from .workbook import template_xlsx
        return _download(template_xlsx(source), f"BIM-Pruefregeln-{source}.xlsx")

    @router.get("/models/{model_id}/report.xlsx")
    def export(model_id: str):
        directory = sessions.get(model_id)
        try:
            with report_io:
                data = (Path(directory.name) / "report.xlsx").read_bytes()
        except FileNotFoundError:
            raise HTTPException(409, "Zuerst ein Excel-Regelwerk auf das Modell anwenden.") from None
        return _download(data, "BIM-Pruefbericht.xlsx")

    @router.delete("/models/{model_id}", status_code=204)
    def close(model_id: str):
        sessions.close(model_id)
        return Response(status_code=204)

    app.include_router(router)
