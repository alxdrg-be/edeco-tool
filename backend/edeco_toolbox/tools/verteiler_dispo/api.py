"""Bounded local distribution-board API, protected by the host session middleware."""

from __future__ import annotations

from pathlib import Path
import re
import sqlite3
import threading
from typing import Annotated, Literal, TypeVar
import unicodedata
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from starlette.concurrency import run_in_threadpool

from ...paths import local_home
from .models import DistributionDocument
from .store import Conflict, CorruptDocument, DistributionStore

PREFIX = "/api/tools/verteiler-dispo"
MAX_BODY_BYTES = 12 * 1024 * 1024
View = Literal["front", "internal"]
Format = Literal["pdf", "svg", "dxf", "bom-csv", "terminals-csv", "json"]


class RequestBody(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)
    document: DistributionDocument


class SaveRequest(RequestBody):
    base_revision: int = Field(ge=0)


class PreviewRequest(RequestBody):
    view: View = "front"


class LibraryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    path: str = Field(max_length=1500)
    base_revision: str = Field(min_length=1, max_length=64)


class ExportRequest(RequestBody):
    format: Format
    views: Annotated[list[View], Field(min_length=1, max_length=2)] = ["front"]
    paper: Literal["A4", "A3"] = "A4"
    scale: float | None = Field(default=None, gt=0, le=100)

    @field_validator("views")
    @classmethod
    def unique_views(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("Jede Ansicht nur einmal auswählen.")
        return value


TBody = TypeVar("TBody", bound=BaseModel)


async def _body(request: Request, model: type[TBody]) -> TBody:
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > MAX_BODY_BYTES:
            raise HTTPException(413, "Verteiler-Dokument ist zu gross (maximal 12 MiB).")
        raw.extend(chunk)
    try:
        return model.model_validate_json(raw)
    except ValidationError as error:
        # Never echo an imported project or arbitrary error-context objects.
        details = [{"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
                   for item in error.errors(include_input=False)[:30]]
        raise HTTPException(422, details) from error


def _response(data, *, status_code: int = 200):
    return JSONResponse(data, status_code=status_code, headers={"Cache-Control": "no-store"})


def _file_name(document: DistributionDocument, extension: str) -> str:
    stem = document.drawing_number or document.name or "Verteiler-Dispo"
    stem = re.sub(r'[<>:"/\\|?*\x00-\x1f\x7f]+', "-", stem).strip(" .")[:100] or "Verteiler-Dispo"
    ascii_stem = unicodedata.normalize("NFKD", stem).encode("ascii", errors="ignore").decode() or "Verteiler-Dispo"
    return f'attachment; filename="{ascii_stem}.{extension}"; filename*=UTF-8\'\'{quote(stem + "." + extension, safe="")}'


def register(app: FastAPI, home: Path | None = None) -> None:
    data_home = home if home is not None else local_home() / "verteiler-dispo"
    from .library import ProfileLibrary
    library = ProfileLibrary(data_home)

    def can_manage_library() -> bool:
        presentation = getattr(app.state, "presentation", None)
        return bool(presentation and presentation.snapshot().get("can_manage"))

    def require_library_admin():
        if not can_manage_library():
            raise HTTPException(403, "Firmenvorlagen können nur die hinterlegten Administratoren ändern.")
    store_lock = threading.Lock()
    app.state.verteiler_store = None

    def store() -> DistributionStore:
        # A damaged/future module database must not prevent other Toolhub tools
        # from starting, or prevent exporting an unsaved recovery document.
        with store_lock:
            if app.state.verteiler_store is None:
                try:
                    app.state.verteiler_store = DistributionStore(data_home)
                except (CorruptDocument, sqlite3.DatabaseError, OSError) as error:
                    raise HTTPException(500, "Die Verteilerablage konnte nicht geöffnet werden. Die vorhandenen Daten wurden nicht ersetzt. Bitte die Ablage sichern und prüfen.") from error
            return app.state.verteiler_store

    @app.get(PREFIX + "/catalog", tags=["verteiler-dispo"])
    def catalog():
        from .catalog import get_catalog
        return _response(library.merge_catalog(get_catalog()))

    @app.get(PREFIX + "/default", tags=["verteiler-dispo"])
    def default(template_id: str = "uv-basic", vnb_id: Literal["none", "iwb", "primeo", "ebl"] = "none"):
        from .catalog import build_document
        try:
            value = library.build_document(template_id, vnb_id, build_document)
        except (KeyError, ValueError) as error:
            raise HTTPException(404, "Verteilervorlage nicht gefunden.") from error
        document = DistributionDocument.model_validate(value)
        return _response(document.model_dump(mode="json"))

    @app.get(PREFIX + "/library", tags=["verteiler-dispo"])
    def library_status():
        return _response({**library.status(), "can_manage": can_manage_library()})

    @app.put(PREFIX + "/library", tags=["verteiler-dispo"])
    async def configure_library(request: Request):
        require_library_admin()
        payload = await _body(request, LibraryRequest)
        try:
            return _response(library.configure(payload.path, payload.base_revision))
        except Conflict as error:
            raise HTTPException(409, str(error)) from error
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        except OSError as error:
            raise HTTPException(500, "Die Bibliothekseinstellung konnte nicht gespeichert werden. Der bestehende Stand bleibt erhalten.") from error

    @app.post(PREFIX + "/library/reload", tags=["verteiler-dispo"])
    async def reload_library():
        require_library_admin()
        try:
            return _response(await run_in_threadpool(library.reload))
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.get(PREFIX + "/documents", tags=["verteiler-dispo"])
    def documents():
        return _response(store().list())

    @app.get(PREFIX + "/documents/{document_id}", tags=["verteiler-dispo"])
    def get_document(document_id: str):
        try:
            return _response(store().get(document_id))
        except KeyError as error:
            raise HTTPException(404, "Verteiler nicht gefunden.") from error
        except CorruptDocument as error:
            raise HTTPException(500, str(error)) from error

    @app.put(PREFIX + "/documents/{document_id}", tags=["verteiler-dispo"])
    async def save_document(document_id: str, request: Request):
        payload = await _body(request, SaveRequest)
        if payload.document.id != document_id:
            raise HTTPException(422, "Dokument-ID und Ziel stimmen nicht überein.")
        try:
            saved = await run_in_threadpool(store().save, payload.document, payload.base_revision)
            return _response(saved, status_code=201 if payload.base_revision == 0 else 200)
        except Conflict as error:
            raise HTTPException(409, str(error)) from error

    @app.get(PREFIX + "/documents/{document_id}/revisions", tags=["verteiler-dispo"])
    def history(document_id: str):
        try:
            return _response(store().history(document_id))
        except KeyError as error:
            raise HTTPException(404, "Verteiler nicht gefunden.") from error

    @app.get(PREFIX + "/documents/{document_id}/revisions/{revision}", tags=["verteiler-dispo"])
    def previous_revision(document_id: str, revision: int):
        try:
            return _response(store().revision(document_id, revision))
        except KeyError as error:
            raise HTTPException(404, "Verteilerstand nicht gefunden.") from error
        except CorruptDocument as error:
            raise HTTPException(500, str(error)) from error

    @app.post(PREFIX + "/analysis", tags=["verteiler-dispo"])
    async def analysis(request: Request):
        from .checks import analyze
        payload = await _body(request, RequestBody)
        return _response(await run_in_threadpool(analyze, payload.document))

    @app.post(PREFIX + "/import", tags=["verteiler-dispo"])
    async def import_document(request: Request):
        from .checks import analyze
        payload = await _body(request, RequestBody)
        return _response({"document": payload.document.model_dump(mode="json"),
                          "analysis": await run_in_threadpool(analyze, payload.document)})

    @app.post(PREFIX + "/preview", tags=["verteiler-dispo"])
    async def preview(request: Request):
        from .render import preview_svg
        payload = await _body(request, PreviewRequest)
        return _response({"svg": await run_in_threadpool(preview_svg, payload.document, payload.view)})

    @app.post(PREFIX + "/export", tags=["verteiler-dispo"])
    async def export(request: Request):
        from .render import export_bytes
        payload = await _body(request, ExportRequest)
        try:
            data, media_type, extension = await run_in_threadpool(
                export_bytes, payload.document, payload.format, payload.views, payload.paper, payload.scale)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        if not data:
            raise HTTPException(500, "Der Verteiler-Export ist leer. Der gespeicherte Stand bleibt erhalten.")
        if extension not in {"pdf", "svg", "dxf", "csv", "json"}:
            raise HTTPException(500, "Ungültiges Exportformat.")
        return Response(data, media_type=media_type, headers={
            "Content-Disposition": _file_name(payload.document, extension), "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"})
