"""Local-session protected project metadata and explicit folder opening."""

import hmac
import secrets
import sqlite3
from urllib.parse import urlsplit

from fastapi import HTTPException, Request

from ...folders import open_folder as open_folder
from ...paths import local_home
from .models import ProjectData, ProjectUpdate, Selection
# Preserve existing model imports while their definitions live outside the API.
from .models import (
    Contact as Contact,
    Document as Document,
    Short as Short,
    absolute_path as absolute_path,
)
from .store import Conflict, ProjectStore

PREFIX = "/api/tools/projektzentrale"


def register(app):
    store = ProjectStore(local_home() / "projects")
    session = secrets.token_urlsafe(32)
    app.state.project_hub = store

    def authorize(request, key=True):
        host = request.headers.get("host", "")
        origin = request.headers.get("origin")
        if (urlsplit("http://" + host).hostname not in {"localhost", "127.0.0.1"}
                or origin and origin != "http://" + host
                or key and not hmac.compare_digest(request.headers.get("X-Edeco-Projects", "").encode(), session.encode())):
            raise HTTPException(403, "Projekte bitte direkt in der Toolbox öffnen.")

    def perform(action):
        try:
            return action()
        except KeyError:
            raise HTTPException(404, "Das Projekt wurde nicht gefunden.") from None
        except Conflict as exc:
            raise HTTPException(409, str(exc)) from None
        except sqlite3.OperationalError:
            raise HTTPException(503, "Die Projektdaten konnten nicht geschrieben oder gelesen werden. Bitte Speicherort prüfen und erneut versuchen.") from None
        except (ValueError, OSError) as exc:
            raise HTTPException(400, str(exc)) from None

    app.state.project_authorize = authorize
    app.state.project_session = session
    app.state.project_perform = perform

    @app.get(PREFIX + "/state")
    def state(request: Request):
        authorize(request, False)
        return {**perform(store.snapshot), "session_key": session}

    @app.post(PREFIX + "/projects", status_code=201)
    def create(request: Request, body: ProjectData):
        authorize(request)
        return perform(lambda: store.save(body.model_dump()))

    @app.put(PREFIX + "/projects/{project_id}")
    def update(request: Request, project_id: str, body: ProjectUpdate):
        authorize(request)
        return perform(lambda: store.save(body.model_dump(exclude={"version"}), project_id, body.version))

    @app.post(PREFIX + "/selection")
    def select(request: Request, body: Selection):
        authorize(request)
        perform(lambda: store.select(body.project_id))
        return perform(store.snapshot)

    @app.post(PREFIX + "/projects/{project_id}/open-folder")
    def folder(request: Request, project_id: str):
        authorize(request)
        perform(lambda: open_folder(store.get(project_id)["folder"]))
        return {"ok": True}
