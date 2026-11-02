"""ASGI adapter for BIM2STEIGER's existing catalogue and quantity logic.

This is mounted below /tools/bim2steiger; Nova's API remains independent.
No second process, HTTP server, database copy or standalone updater is started.
"""

import base64
import binascii
import json
import logging
import sqlite3
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from bim2steiger import core
from bim2steiger.elda_export import export_messerli, titles_from_navigation
from bim2steiger.importers import import_model
from bim2steiger.rules import match_assignments

ROOT = Path(core.__file__).resolve().parent
MAX_IMPORT_FILE = 250_000_000
MAX_IMPORT_BODY = 360_000_000
log = logging.getLogger(__name__)


def create_app(root: Path = ROOT) -> FastAPI:
    app = FastAPI(title="BIM2STEIGER · edeco Toolhub")
    catalogue = core.Catalogue(root / "data" / "catalogue.sqlite")
    app.state.catalogue = catalogue
    version = json.loads((root / "version.json").read_text(encoding="utf-8"))

    def failure(message: str, status: int = 400):
        return JSONResponse({"error": message}, status_code=status)

    for error in (ValueError, KeyError, TypeError):
        app.add_exception_handler(error, lambda request, exc: failure(str(exc)))

    @app.exception_handler(sqlite3.DatabaseError)
    async def database_error(request, exc):
        log.error("BIM2STEIGER catalogue failure: %s", exc)
        return failure("Katalog konnte nicht gelesen werden. Datenbank prüfen.", 500)

    @app.get("/api/app")
    def application():
        return {"application": "BIM2STEIGER", "version": version,
                "start_page": "/tools/bim2steiger/bim2steiger.html", "managed_by_toolbox": True}

    @app.get("/api/meta")
    def meta():
        result = catalogue.metadata()
        result["editions"] = core.catalogue_editions(result.get("year") or 2026)
        return result

    @app.get("/api/catalogue")
    def navigation():
        return catalogue.navigation

    @app.get("/api/search")
    def search(q: str = "", kind: str = "all", limit: int = 60, va: str = ""):
        return catalogue.search(q, kind, limit, va)

    @app.get("/api/article")
    def article(number: str, va: str | None = None, recipe: str | None = None):
        return catalogue.article(number, va, recipe)

    @app.get("/api/expand")
    def expand(number: str, va: str = "", quantity: str = "1", recipe: str | None = None):
        return catalogue.expand(number, va, quantity, recipe)

    @app.get("/api/source-status")
    def sources():
        folder = root / "data" / "portal_capture"
        plan = json.loads((folder / "plan.json").read_text(encoding="utf-8")) if (folder / "plan.json").exists() else []
        details_plan = json.loads((folder / "details-plan.json").read_text(encoding="utf-8")) if (folder / "details-plan.json").exists() else []
        images = json.loads((root / "web" / "images" / "inventory.json").read_text(encoding="utf-8"))
        pages = len(list((folder / "pages").glob("*.json")))
        details = len(list((folder / "details").glob("*.json")))
        planned = sum(len(item["targets"]) for item in details_plan)
        return {"year": 2026, "catalogue_pages": pages, "planned_catalogue_pages": len(plan),
                "detail_variants": details, "planned_detail_variants": planned,
                "media_articles": len({item["number"] for item in images}),
                "media_files": len({item["file"] for item in images}),
                "catalogue_previews_complete": bool(plan) and pages == len(plan),
                "details_complete": bool(planned) and details == planned,
                "source": "https://digital.asteigerag.ch/dashboard"}

    def updates():
        return {"current": version, "status": "current", "installed": False,
                "message": "Updates werden gemeinsam für den edeco Toolhub bereitgestellt.",
                "can_install": False, "checked_at": None, "managed_by_toolbox": True}

    app.get("/api/updates")(updates)

    def handle_post(operation, body):
        if operation == "updates/check":
            return updates()
        if operation == "updates/install":
            return failure("Bitte den gesamten edeco Toolhub aktualisieren.", 409)
        if operation == "import":
            if body.get("content_base64"):
                try:
                    payload = base64.b64decode(body["content_base64"], validate=True)
                except (binascii.Error, ValueError):
                    raise ValueError("Die Datei konnte nicht gelesen werden.") from None
            else:
                payload = body.get("text", "")
            if len(payload) > MAX_IMPORT_FILE:
                return failure("Die Datei ist zu gross. Dateien bis 250 MB sind möglich.", 413)
            elements, warnings = import_model(body.get("filename", ""), payload)
            return {"elements": elements, "warnings": warnings}
        if operation == "tender/aggregate":
            return {"lines": core.aggregate_tender(body["lines"])}
        if operation == "rules/match":
            return match_assignments(body.get("elements") or [], body.get("rules") or [], catalogue)
        if operation == "tender/elda":
            data, warnings = export_messerli(
                body.get("lines") or [], project=body.get("project") or "",
                chapter_titles=titles_from_navigation(catalogue.navigation),
                catalogue_year=body.get("catalogue_year") or 2026, outline=body.get("outline") or [])
            return {"content_base64": base64.b64encode(data).decode("ascii"),
                    "warnings": warnings, "encoding": "cp850"}
        return failure("Unbekannte Schnittstelle", 404)

    @app.post("/api/{operation:path}")
    async def post(operation: str, request: Request):
        chunks, length = [], 0
        async for chunk in request.stream():
            length += len(chunk)
            if length > MAX_IMPORT_BODY:
                return failure("Die Datei ist zu gross. Dateien bis 250 MB sind möglich.", 413)
            chunks.append(chunk)
        body = json.loads(b"".join(chunks))
        if not isinstance(body, dict):
            return failure("Ein JSON-Objekt wird erwartet.")
        return await run_in_threadpool(handle_post, operation, body)

    app.mount("/", StaticFiles(directory=root / "web", html=True), name="bim2steiger-ui")
    return app
