"""Same-origin, session-protected access to the local document library."""

import hmac
import secrets
import threading
from typing import Literal
from urllib.parse import urlsplit

from fastapi import File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from ..paths import local_home
from .ai import AISettings
from .extract import MAX_BYTES
from .folders import FolderBusyError, FolderSource
from .store import DocumentStore

PREFIX = "/api/tools/dokumenten-assistent"


class Preferences(BaseModel):
    provider: Literal["ollama", "openai"] = "ollama"
    endpoint: str = Field(max_length=1000)
    model: str = Field(max_length=150)
    api_key: str = Field(default="", max_length=4096)
    clear_key: bool = False


class Question(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    document_ids: list[str] = Field(max_length=200)
    use_ai: bool = False


class FolderPreferences(BaseModel):
    path: str = Field(max_length=2000)
    recursive: bool = True


def register(app):
    home = local_home() / "documents"
    store = DocumentStore(home)
    settings = AISettings(home)
    folders = FolderSource(store)
    session_key = secrets.token_urlsafe(32)
    ai_lock = threading.Lock()
    app.state.documents = store
    app.state.document_ai = settings
    app.state.document_folders = folders

    def authorize(request: Request, require_key=True):
        host = request.headers.get("host", "")
        origin = request.headers.get("origin")
        if (urlsplit("http://" + host).hostname not in {"localhost", "127.0.0.1"}
                or (origin and origin != "http://" + host)
                or (require_key and not hmac.compare_digest(
                    request.headers.get("X-Edeco-Documents", "").encode(), session_key.encode()))):
            raise HTTPException(403, "Dokumente bitte direkt in der Toolbox öffnen.")

    @app.get(PREFIX + "/state")
    def state(request: Request):
        authorize(request, require_key=False)
        return {"documents": store.list(), "settings": settings.public(), "session_key": session_key}

    @app.get(PREFIX + "/folder")
    def folder_state(request: Request):
        authorize(request)
        try:
            return folders.public()
        except (ValueError, OSError) as exc:
            raise HTTPException(400, str(exc) if isinstance(exc, ValueError) else "Die lokale Ordnerkonfiguration ist nicht lesbar.") from None

    @app.post(PREFIX + "/folder")
    def folder_save(request: Request, body: FolderPreferences):
        authorize(request)
        try:
            return folders.configure(body.path, body.recursive)
        except FolderBusyError as exc:
            raise HTTPException(409, str(exc)) from None
        except (ValueError, OSError) as exc:
            raise HTTPException(400, str(exc) if isinstance(exc, ValueError) else "Der Ordner ist nicht lesbar. Bitte Pfad und Windows-Leserechte prüfen.") from None

    @app.post(PREFIX + "/folder/sync")
    def folder_sync(request: Request):
        authorize(request)
        if not ai_lock.acquire(blocking=False):
            raise HTTPException(409, "Bitte die laufende KI-Anfrage abwarten.")
        try:
            return folders.sync()
        except FolderBusyError as exc:
            raise HTTPException(409, str(exc)) from None
        except (ValueError, OSError) as exc:
            raise HTTPException(400, str(exc) if isinstance(exc, ValueError) else "Der Ordner ist nicht lesbar. Lokale Kopien bleiben erhalten.") from None
        finally:
            ai_lock.release()

    @app.post(PREFIX + "/settings")
    def preferences(request: Request, body: Preferences):
        authorize(request)
        if not ai_lock.acquire(blocking=False):
            raise HTTPException(409, "Bitte die laufende KI-Antwort abwarten.")
        try:
            return settings.save(body.endpoint, body.model, body.api_key, body.clear_key, body.provider)
        except (ValueError, OSError) as exc:
            raise HTTPException(400, str(exc)) from None
        finally:
            ai_lock.release()

    @app.post(PREFIX + "/connection")
    def connection(request: Request, body: Preferences | None = None):
        authorize(request)
        if not ai_lock.acquire(blocking=False):
            raise HTTPException(409, "Bitte die laufende KI-Anfrage abwarten.")
        try:
            return settings.check_connection(body.model_dump() if body is not None else None)
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None
        finally:
            ai_lock.release()

    @app.post(PREFIX + "/documents")
    async def upload(request: Request, file: UploadFile = File(...),
                     title: str = Form(default="", max_length=180), edition: str = Form(default="", max_length=160)):
        authorize(request)
        data = await file.read(MAX_BYTES + 1)
        await file.close()
        try:
            return await run_in_threadpool(folders.add_manual, data, file.filename or "", title, edition)
        except FolderBusyError as exc:
            raise HTTPException(409, str(exc)) from None
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None

    @app.delete(PREFIX + "/documents/{document_id}")
    def remove(request: Request, document_id: str):
        authorize(request)
        try:
            folders.remove_document(document_id)
        except FolderBusyError as exc:
            raise HTTPException(409, str(exc)) from None
        except KeyError:
            raise HTTPException(404, "Das Dokument wurde nicht gefunden.") from None
        except OSError:
            raise HTTPException(409, "Die Dokumentkopie konnte nicht entfernt werden. Bitte offene Downloads schliessen und erneut versuchen.") from None
        return {"ok": True}

    @app.get(PREFIX + "/documents/{document_id}/pages/{number}")
    def page(request: Request, document_id: str, number: int):
        authorize(request)
        try:
            return store.page(document_id, number)
        except KeyError:
            raise HTTPException(404, "Die Seite wurde nicht gefunden.") from None
        except (ValueError, OSError):
            raise HTTPException(400, "Die Originalseite konnte nicht geöffnet werden.") from None

    @app.get(PREFIX + "/documents/{document_id}/file")
    def original(request: Request, document_id: str):
        authorize(request)
        try:
            doc = store.get(document_id)
            return FileResponse(store.path(document_id), filename=doc["filename"],
                                media_type="application/pdf" if doc["kind"] == "pdf" else "text/plain")
        except KeyError:
            raise HTTPException(404, "Das Dokument wurde nicht gefunden.") from None

    @app.post(PREFIX + "/ask")
    def ask(request: Request, body: Question):
        authorize(request)
        ids = list(dict.fromkeys(body.document_ids))
        available = {doc["id"] for doc in store.list()}
        if not ids or any(identifier not in available for identifier in ids):
            raise HTTPException(400, "Bitte mindestens ein vorhandenes Dokument auswählen.")
        sources = store.search(body.question.strip(), ids)
        result = {"question": body.question, "sources": sources, "blocks": [], "mode": "search", "message": ""}
        if not sources:
            result["message"] = "Keine passende Fundstelle gefunden. Bitte andere Begriffe oder Dokumente wählen. Daraus lässt sich keine fachliche Antwort ableiten."
        elif body.use_ai:
            if not ai_lock.acquire(blocking=False):
                raise HTTPException(409, "Eine KI-Anfrage läuft bereits. Bitte kurz warten.")
            try:
                result["blocks"] = settings.answer(body.question, sources)
                result["mode"] = "ai"
                if not result["blocks"]:
                    result["message"] = "Die gefundenen Stellen reichen für eine belegte Antwort nicht aus. Bitte die Originale prüfen oder weitere Dokumente hinzufügen."
            except ValueError as exc:
                result["message"] = str(exc)
            finally:
                ai_lock.release()
        return result
