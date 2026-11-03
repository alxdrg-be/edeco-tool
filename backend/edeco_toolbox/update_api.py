"""Local-only update controls shared by all Toolbox modules."""

import hmac
from urllib.parse import urlsplit

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .updater import UpdateManager


class UpdatePreferences(BaseModel):
    automatic: bool


def register(app):
    manager = UpdateManager()
    app.state.updates = manager

    def authorize(request: Request):
        host = request.headers.get("host", "")
        origin = request.headers.get("origin")
        if (urlsplit("http://" + host).hostname not in {"localhost", "127.0.0.1"}
                or (origin and origin != "http://" + host)
                or not hmac.compare_digest(request.headers.get("X-Edeco-Update", ""), manager.session_key)):
            raise HTTPException(403, "Updateaktion bitte direkt in der Toolbox ausführen.")

    @app.get("/api/toolbox/updates")
    def status():
        return JSONResponse(manager.public(), headers={"Cache-Control": "no-store"})

    @app.post("/api/toolbox/updates/check")
    def check(request: Request):
        authorize(request)
        try:
            return manager.check()
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None

    @app.post("/api/toolbox/updates/preferences")
    def preferences(request: Request, body: UpdatePreferences):
        authorize(request)
        try:
            return manager.preferences(body.automatic)
        except OSError:
            raise HTTPException(500, "Update-Einstellung konnte nicht gespeichert werden.") from None

    @app.post("/api/toolbox/updates/install")
    def install(request: Request):
        authorize(request)
        try:
            return manager.install(getattr(app.state, "shutdown", lambda: None))
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None
        except OSError:
            raise HTTPException(502, "Setup konnte nicht heruntergeladen werden. Bitte erneut versuchen.") from None
