"""Local session API for a shared folder chosen by the company's users."""
import json
from typing import Any, Literal
from uuid import UUID

from fastapi import File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from starlette.concurrency import run_in_threadpool

from ... import APP_VERSION
from ...paths import local_home
from ..projects.api import ProjectData
from ..projects.api import open_folder
from .store import ArchiveStore, TOOLS, confined

PREFIX = "/api/tools/berechnungsablage"


class Configuration(BaseModel):
    root: str = Field(min_length=1, max_length=1500)
    subfolder: str = Field(min_length=1, max_length=180)
    revision: str = Field(min_length=1, max_length=80)


class Project(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    id: str = Field(default="", max_length=80)
    number: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=180)

    @field_validator("number")
    @classmethod
    def number_valid(cls, value):
        return ProjectData.valid_number(value)


class Snapshot(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    request_id: UUID
    config_revision: str = Field(min_length=1, max_length=80)
    project: Project
    tool_id: str = Field(max_length=80)
    title: str = Field(min_length=1, max_length=180)
    author: str = Field(min_length=1, max_length=120)
    notes: str = Field(default="", max_length=10000)
    source: Literal["edeco", "premium-export"] = "edeco"
    document: dict[str, Any] = Field(default_factory=dict)

    @field_validator("tool_id")
    @classmethod
    def known_tool(cls, value):
        if value not in TOOLS:
            raise ValueError("Unbekannter Berechnungstyp.")
        return value


class Note(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    key: str = Field(min_length=1, max_length=800)
    text: str = Field(min_length=1, max_length=10000)
    author: str = Field(min_length=1, max_length=120)
    config_revision: str = Field(min_length=1, max_length=80)


class OpenFolder(BaseModel):
    """Open one record's folder, or the archive root without a key."""
    key: str | None = Field(default=None, max_length=800)


def register(app):
    store = ArchiveStore(local_home() / "calculation-archive")
    app.state.calculation_archive = store
    authorize = app.state.project_authorize

    def perform(action):
        try:
            return action()
        except FileExistsError as exc:
            raise HTTPException(409, str(exc)) from None
        except FileNotFoundError:
            raise HTTPException(404, "Der Rechenstand wurde nicht gefunden oder ist nicht mehr erreichbar.") from None
        except (ValueError, TypeError, RecursionError) as exc:
            raise HTTPException(400, str(exc) or "Ungültige Ablagedaten.") from None
        except OSError:
            raise HTTPException(503, "Serverablage nicht erreichbar oder keine Berechtigung. Bitte Verbindung und Schreibrechte prüfen; es wird nicht lokal ersatzweise gespeichert.") from None

    @app.get(PREFIX + "/state")
    def state(request: Request):
        authorize(request, False)
        return {"settings": perform(store.settings), "session_key": app.state.project_session, "tools": TOOLS}

    @app.post(PREFIX + "/settings")
    def configure(request: Request, body: Configuration):
        authorize(request)
        return perform(lambda: store.configure(body.root, body.subfolder, body.revision))

    @app.get(PREFIX + "/records")
    def records(request: Request):
        authorize(request)
        return perform(store.list)

    @app.post(PREFIX + "/records")
    def save(request: Request, body: Snapshot):
        authorize(request)
        payload = body.model_dump(mode="json")
        payload["app_version"] = APP_VERSION
        if payload["source"] != "edeco":
            raise HTTPException(400, "Externe Berechnungsexporte bitte über den Datei-Import ablegen.")
        return perform(lambda: store.save(payload))

    @app.get(PREFIX + "/record")
    def record(request: Request, key: str):
        authorize(request)
        return perform(lambda: store.read(key))

    @app.post(PREFIX + "/notes")
    def note(request: Request, body: Note):
        authorize(request)
        return perform(lambda: store.add_note(body.key, body.text, body.author, body.config_revision))

    @app.post(PREFIX + "/open-folder")
    def folder(request: Request, body: OpenFolder):
        authorize(request)
        key = body.key
        path = perform(lambda: store.folder(key) if key is not None else store.base())
        perform(lambda: open_folder(str(path)))
        return {"ok": True}

    @app.post(PREFIX + "/import")
    async def import_export(request: Request, metadata: str = Form(..., max_length=100000), file: UploadFile = File(...)):
        authorize(request)
        try:
            body = perform(lambda: Snapshot.model_validate_json(metadata))
            data = await file.read(25 * 1024 * 1024 + 1)
            if not data or len(data) > 25 * 1024 * 1024:
                raise HTTPException(400, "Bitte eine nicht leere PDF-/JSON-Datei mit höchstens 25 MB wählen.")
            filename = (file.filename or "").lower()
            if filename.endswith(".pdf") and data.lstrip().startswith(b"%PDF-"):
                name = "Original.pdf"
            elif filename.endswith(".json") and len(data) <= 2_000_000:
                parsed = perform(lambda: json.loads(data))
                if not isinstance(parsed, dict):
                    raise HTTPException(400, "JSON-Export muss ein Objekt enthalten.")
                name = "Original.json"
                body.document = parsed
            else:
                raise HTTPException(400, "Unterstützt werden PDF und JSON (JSON höchstens 2 MB).")
            payload = body.model_dump(mode="json")
            payload.update(source="premium-export", app_version=APP_VERSION)
            result = await run_in_threadpool(lambda: perform(lambda: store.save(payload, (name, data))))
            return result
        finally:
            await file.close()

    @app.get(PREFIX + "/attachment")
    def attachment(request: Request, key: str):
        authorize(request)
        record = perform(lambda: store.read(key))
        name = record.get("attachment")
        if name not in {"Original.pdf", "Original.json"}:
            raise HTTPException(404, "Kein Originalexport vorhanden.")
        path = perform(lambda: confined(store.folder(key), name))
        def read():
            with path.open("rb") as handle:
                return handle.read(25 * 1024 * 1024 + 1)
        data = perform(read)
        import hashlib
        if hashlib.sha256(data).hexdigest() != record.get("attachment_sha256"):
            raise HTTPException(400, "Der Originalexport wurde verändert oder ist beschädigt.")
        return Response(data, media_type="application/pdf" if name.endswith(".pdf") else "application/json",
                        headers={"Content-Disposition": f'attachment; filename="{name}"'})
