"""Same-origin integration of Stirling's complete UI, plus company workflows."""

import hmac
import html
import json
import os
import re
import secrets
import sys
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from fastapi import File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from pydantic import BaseModel, Field

from . import API, ROOT
from .client import PdfFile, StirlingClient
from .config import Configuration
from .crop import register_crop
from .operations import register_operations
from .workbench import register_workbench
from .runtime import PdfRuntime, runtime_root

ASSETS = Path(__file__).parent / "assets"
MAX_UPLOAD = 250 * 1024 * 1024
HOP_HEADERS = {"host", "connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade", "proxy-authorization", "proxy-authenticate"}


class Connection(BaseModel):
    service_url: str = Field(max_length=1000)


def register(app):
    config = Configuration()
    if getattr(sys, 'frozen', False) or os.environ.get('EDECO_PDF_RUNTIME'):
        config.runtime = PdfRuntime()
    session_key = secrets.token_urlsafe(32)
    app.state.pdf_workshop = config
    proxy_client = None

    def get_proxy_client():
        nonlocal proxy_client
        if proxy_client is None:
            proxy_client = httpx.AsyncClient(timeout=httpx.Timeout(300, connect=10), follow_redirects=False, trust_env=False,
                                             transport=getattr(app.state, "pdf_proxy_transport", None),
                                             limits=httpx.Limits(max_connections=30, max_keepalive_connections=20))
        return proxy_client

    async def close_proxy():
        if proxy_client is not None:
            await proxy_client.aclose()

    previous_lifespan = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(application):
        async with previous_lifespan(application) as lifecycle_state:
            if config.runtime:
                config.runtime.start()
            try:
                yield lifecycle_state
            finally:
                await close_proxy()
                if config.runtime:
                    config.runtime.close()

    app.router.lifespan_context = lifespan

    def cookie_name(request):
        return f"edeco_pdf_session_{request.url.port or 80}"

    def authorize(request: Request, *, key=False, cookie=False):
        host = request.headers.get("host", "")
        origin = request.headers.get("origin")
        valid = urlsplit("http://" + host).hostname in {"127.0.0.1", "localhost"} and (not origin or origin == "http://" + host)
        value = request.headers.get("X-Edeco-Pdf", "") if key else request.cookies.get(cookie_name(request), "")
        if not valid or ((key or cookie) and not hmac.compare_digest(value.encode(), session_key.encode())):
            raise HTTPException(403, "Die PDF-Werkstatt bitte direkt in der Toolbox öffnen.")

    register_crop(app, authorize)
    register_workbench(app, authorize, config)
    register_operations(app, authorize, config)

    @app.get(API + "/state")
    def state(request: Request):
        authorize(request)
        response = Response(json.dumps({**config.public(), "session_key": session_key}), media_type="application/json")
        response.set_cookie(cookie_name(request), session_key, httponly=True, samesite="strict", path=ROOT,
                            secure=request.url.scheme == "https")
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.post(API + "/connection")
    def connect(request: Request, body: Connection):
        authorize(request, key=True)
        try:
            config.save(body.service_url)
            return {**config.public(), **StirlingClient(config.url, config.api_key).health()}
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from None

    @app.post(API + "/check")
    def check(request: Request):
        authorize(request, key=True)
        if config.runtime:
            return config.runtime.health()
        return StirlingClient(config.url, config.api_key).health()

    @app.get(API + '/licenses', response_class=HTMLResponse)
    def licenses(request: Request):
        authorize(request)
        root = runtime_root()
        text = (root / 'NOTICE.html').read_text(encoding='utf-8') if (root / 'NOTICE.html').is_file() else '<h1>Info / Lizenzen</h1><p>Stirling PDF Core 3.2.2 · MIT · Copyright Stirling PDF Inc.</p>'
        return HTMLResponse(text, headers={'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"})

    @app.get(API + '/licenses/{name}')
    def license_file(request: Request, name: str):
        authorize(request)
        folder = runtime_root() / 'licenses'
        target = folder / name
        if Path(name).name != name or not target.is_file():
            raise HTTPException(404)
        from fastapi.responses import FileResponse
        return FileResponse(target, filename=name)

    @app.post(API + "/workflows/{profile_id}")
    def workflow(request: Request, profile_id: str, file: UploadFile = File(...)):
        authorize(request, key=True)
        profile = next((item for item in config.company.get("workflows", []) if item.get("id") == profile_id), None)
        if not profile:
            raise HTTPException(404, "Dieser Firmenablauf ist nicht eingerichtet.")
        data = file.file.read(100 * 1024 * 1024 + 1)
        if len(data) > 100 * 1024 * 1024 or not data.lstrip().startswith(b"%PDF-"):
            raise HTTPException(400, "Bitte eine PDF-Datei mit höchstens 100 MB verwenden.")
        folder = Path(profile.get("target_folder", ""))
        if not profile.get("target_folder") or not folder.is_absolute() or not folder.is_dir():
            raise HTTPException(409, "Der vorgegebene Zielordner ist nicht erreichbar. Bitte das Netzlaufwerk prüfen.")
        try:
            if profile.get("stamp"):
                data = StirlingClient(config.url, config.api_key, engine_secret=config.runtime.secret if config.runtime else '').stamp(PdfFile(file.filename or "Dokument.pdf", data), str(profile["stamp"])[:100])
            stem = Path((file.filename or "Dokument.pdf").replace("\\", "/")).stem
            stem = re.sub(r"[^\w .-]", "_", stem)[:100].strip(" .") or "Dokument"
            target = folder / f"{stem}_Entwurf_{datetime.now():%Y%m%d-%H%M%S}_{secrets.token_hex(3)}.pdf"
            with target.open("xb") as output:
                output.write(data)
            return {"ok": True, "filename": target.name, "path": str(target)}
        except (ValueError, OSError):
            raise HTTPException(409, "Der Firmenablauf konnte nicht abgeschlossen werden. Bitte Dienst und Zielordner prüfen.") from None
        finally:
            file.file.close()

    async def proxy(request: Request, path: str = ""):
        authorize(request, cookie=True)
        if config.runtime and not config.runtime.health()['ready']:
            raise HTTPException(503, config.runtime.message)
        if path == "edeco/theme.css":
            css = (ASSETS / "theme.css").read_text(encoding="utf-8").replace("__EDECO_ACCENT__", config.public()["accent"])
            return Response(css, media_type="text/css", headers={"Cache-Control": "no-store"})
        if path == "edeco/bridge.js":
            return Response((ASSETS / "bridge.js").read_text(encoding="utf-8"), media_type="application/javascript", headers={"Cache-Control": "no-store"})
        if path == 'edeco/offline-options.json':
            target = runtime_root() / 'offline-options.json'
            return Response(target.read_bytes() if config.runtime and target.is_file() else b'[]', media_type='application/json')
        if path == "edeco/logo.svg" or path.startswith('assets/wordmark-') and path.endswith('.svg') or path.startswith("modern-logo/") and path.split("/")[-1] in {
                "StirlingPDFLogoBlackText.svg", "StirlingPDFLogoGreyText.svg", "StirlingPDFLogoWhiteText.svg", "logo-tooltip.svg"}:
            logo = (ASSETS / "edeco-logo.svg").read_text(encoding="utf-8")
            if "White" in path or request.query_params.get("theme") == "dark":
                logo = logo.replace("currentColor", "#ffffff")
            return Response(logo, media_type="image/svg+xml")
        try:
            length = int(request.headers.get("content-length", "0"))
        except ValueError:
            raise HTTPException(400, "Ungültige Dateigrösse.") from None
        if length > MAX_UPLOAD:
            raise HTTPException(413, "Bitte höchstens 250 MB pro Verarbeitung übertragen.")
        if any(part in {".", ".."} for part in path.split("/")) or "\\" in path:
            raise HTTPException(400, "Ungültiger Dienstpfad.")
        target = config.url + ROOT + "/" + path
        headers = {key: value for key, value in request.headers.items()
                   if key.lower() not in HOP_HEADERS | {"origin", "referer", "accept-encoding", "cookie"}
                   and not key.lower().startswith("x-edeco-")}
        # The local Toolbox session must never be forwarded to the service.
        remote_cookies = "; ".join(part.strip() for part in request.headers.get("cookie", "").split(";")
                                   if part.strip() and not part.strip().split("=", 1)[0].lower().startswith("edeco_"))
        headers["cookie"] = remote_cookies
        headers["accept-encoding"] = "identity"
        headers["origin"] = config.url
        if config.runtime:
            headers['X-Edeco-Engine'] = config.runtime.secret
        if config.api_key:
            headers["X-API-KEY"] = config.api_key
        client = get_proxy_client()
        try:
            async def body():
                total = 0
                async for chunk in request.stream():
                    total += len(chunk)
                    if total > MAX_UPLOAD:
                        raise ValueError("Die Verarbeitung überschreitet 250 MB.")
                    yield chunk
            upstream_request = client.build_request(request.method, target, params=request.query_params,
                                                    headers=headers, content=body())
            upstream = await client.send(upstream_request, stream=True)
        except (httpx.HTTPError, ValueError):
            return HTMLResponse("<h2>Stirling-PDF ist nicht erreichbar.</h2><p>Bitte über die Toolbox die Verbindung prüfen.</p>", status_code=502)
        response_headers = {key: value for key, value in upstream.headers.items()
                            if key.lower() not in HOP_HEADERS | {"content-length"}}
        if "location" in response_headers:
            location = response_headers["location"]
            if location.startswith(config.url + "/"):
                response_headers["location"] = location[len(config.url):]
            elif location.startswith(("http://", "https://", "//")):
                await upstream.aclose()
                raise HTTPException(502, "Eine Weiterleitung zu einem anderen Dienst wurde nicht geöffnet.")
        if "text/html" in upstream.headers.get("content-type", ""):
            raw = await upstream.aread()
            await upstream.aclose()
            text = raw.decode("utf-8")
            title = html.escape(config.public()["title"])
            text = re.sub(r"<title>.*?</title>", lambda _: f"<title>{title}</title>", text, flags=re.S)
            offline = '<script>window.edecoOffline=true;</script>' if config.runtime else ''
            additions = offline + f'<link rel="stylesheet" href="{ROOT}/edeco/theme.css"><script src="{ROOT}/edeco/bridge.js"></script>'
            text = text.replace("</head>", additions + "</head>")
            response_headers.pop("content-encoding", None)
            response_headers["Cache-Control"] = "no-store"
            if config.runtime:
                response_headers['Content-Security-Policy'] = "default-src 'self' blob: data:; connect-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
            return HTMLResponse(text, status_code=upstream.status_code, headers=response_headers)
        async def stream():
            try:
                async for chunk in upstream.aiter_raw():
                    yield chunk
            finally:
                await upstream.aclose()
        return StreamingResponse(stream(), status_code=upstream.status_code, headers=response_headers)

    app.add_api_route(ROOT + "/", proxy, methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
    app.add_api_route(ROOT + "/{path:path}", proxy, methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
