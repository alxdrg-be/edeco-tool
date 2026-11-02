"""Protect the loopback application, including its mounted tool applications.

Browser clients receive a port-scoped, HTTP-only, SameSite=Strict session cookie
on a trusted GET. Native clients may instead obtain the key from
``GET /api/toolbox/session`` and send ``X-Edeco-Session`` on mutations.
The key lives only in this application process; it is never a URL parameter.
"""

from __future__ import annotations

import hmac
import re
import secrets
from http.cookies import CookieError, SimpleCookie
from urllib.parse import urlsplit

from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


SESSION_HEADER = "X-Edeco-Session"
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
LOCAL_HOST = re.compile(r"^(127\.0\.0\.1|localhost)(?::([0-9]{1,5}))?$", re.I)
FORBIDDEN = "Die Anfrage bitte direkt in der lokalen edeco Toolbox ausführen."


class LocalSession:
    def __init__(self):
        self.key = secrets.token_urlsafe(32)

    def matches(self, value: str) -> bool:
        return hmac.compare_digest(value.encode("utf-8"), self.key.encode("ascii"))


def _one_header(scope: Scope, name: bytes) -> str | None:
    values = [value.decode("latin-1") for key, value in scope["headers"] if key.lower() == name]
    if len(values) > 1:
        raise ValueError("Doppelter sicherheitsrelevanter Header")
    return values[0] if values else None


def _request_origin(scope: Scope) -> tuple[str, str, int]:
    raw_host = _one_header(scope, b"host") or ""
    match = LOCAL_HOST.fullmatch(raw_host)
    if not match:
        raise ValueError("Unbekannter Host")
    scheme = {"ws": "http", "wss": "https"}.get(scope["scheme"], scope["scheme"])
    if scheme not in {"http", "https"}:
        raise ValueError("Unbekanntes Protokoll")
    port = int(match[2]) if match[2] else (443 if scheme == "https" else 80)
    if not 1 <= port <= 65535:
        raise ValueError("Ungültiger Port")
    return scheme, match[1].lower(), port


def _url_origin(raw: str, *, referer: bool = False) -> tuple[str, str, int]:
    parsed = urlsplit(raw)
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.username is not None or parsed.password is not None
            or (not referer and (parsed.path or parsed.query or parsed.fragment))):
        raise ValueError("Ungültige Herkunft")
    return parsed.scheme, parsed.hostname.lower(), parsed.port or (443 if parsed.scheme == "https" else 80)


def _cookie_value(scope: Scope, name: str) -> str:
    raw = "; ".join(value.decode("latin-1") for key, value in scope["headers"] if key.lower() == b"cookie")
    try:
        cookies = SimpleCookie(raw)
        return cookies[name].value if name in cookies else ""
    except CookieError:
        return ""


class LocalSecurityMiddleware:
    """No request-body buffering: large uploads and the PDF proxy stay streaming."""

    def __init__(self, app: ASGIApp, session: LocalSession):
        self.app = app
        self.session = session

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] not in {"http", "websocket"}:
            await self.app(scope, receive, send)
            return
        try:
            origin = _request_origin(scope)
            supplied_origin = _one_header(scope, b"origin")
            supplied_referer = _one_header(scope, b"referer")
            site = _one_header(scope, b"sec-fetch-site")
            if ((supplied_origin is not None and _url_origin(supplied_origin) != origin)
                    or (supplied_referer is not None and _url_origin(supplied_referer, referer=True) != origin)
                    or (site is not None and site not in {"same-origin", "none"})):
                raise ValueError("Fremde Herkunft")
            cookie_name = f"edeco_toolbox_session_{origin[2]}"
            cookie = _cookie_value(scope, cookie_name)
            key = _one_header(scope, b"x-edeco-session")
            authenticated = self.session.matches(cookie if key is None else key)
            unsafe = scope["type"] == "websocket" or scope["method"] not in SAFE_METHODS
            if unsafe and not authenticated:
                raise ValueError("Sitzung fehlt")
        except (ValueError, UnicodeError):
            if scope["type"] == "websocket":
                await send({"type": "websocket.close", "code": 1008})
            else:
                response = JSONResponse({"detail": FORBIDDEN}, status_code=403,
                                        headers={"Cache-Control": "no-store"})
                await response(scope, receive, send)
            return

        async def protected_send(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {name.lower() for name, _ in headers}
                for name, value in ((b"x-content-type-options", b"nosniff"),
                                    (b"x-frame-options", b"SAMEORIGIN"),
                                    (b"cross-origin-resource-policy", b"same-origin")):
                    if name not in present:
                        headers.append((name, value))
                if scope["method"] == "GET" and not self.session.matches(cookie):
                    value = f"{cookie_name}={self.session.key}; HttpOnly; Path=/; SameSite=Strict"
                    if origin[0] == "https":
                        value += "; Secure"
                    headers.append((b"set-cookie", value.encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, protected_send)


def register(app):
    session = LocalSession()
    app.state.local_session = session
    app.add_middleware(LocalSecurityMiddleware, session=session)

    @app.get("/api/toolbox/session")
    def local_session():
        return JSONResponse({"session_key": session.key}, headers={"Cache-Control": "no-store"})
