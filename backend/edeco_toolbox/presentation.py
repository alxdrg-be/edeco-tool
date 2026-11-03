"""Local presentation preferences with roles derived from the process' OS identity.

These roles control settings and the Toolhub presentation; they are not a
replacement for Windows file permissions or a separate network authentication.
"""

from __future__ import annotations

import ctypes
import getpass
import json
import os
import sys
import threading
import uuid
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from .paths import local_home

DEFAULT_ADMINS = ["aduerger", "nstrauss"]
DEMO_TOOLS = ["nova-legenden", "berechnungen", "dateien-umbenennen", "pdf-werkzeuge"]
PREFIX = "/api/toolbox/presentation"


def windows_identity() -> tuple[str, bool]:
    """Read the account from Windows, never from a browser-supplied user name."""
    if sys.platform != "win32":
        return getpass.getuser(), False
    try:
        size = ctypes.c_ulong(512)
        value = ctypes.create_unicode_buffer(size.value)
        if ctypes.windll.secur32.GetUserNameExW(2, value, ctypes.byref(size)):
            return value.value, True
        size = ctypes.c_ulong(512)
        value = ctypes.create_unicode_buffer(size.value)
        if ctypes.windll.advapi32.GetUserNameW(value, ctypes.byref(size)):
            return value.value, True
    except (AttributeError, OSError):
        pass
    # Fail closed for configured Windows roles if the OS identity is unavailable.
    return "", True


def is_admin(identity: str, admins: list[str]) -> bool:
    account = identity.strip().casefold()
    short = account.rsplit("\\", 1)[-1]
    return any(name.strip().casefold() == account or
               "\\" not in name and name.strip().casefold() == short
               for name in admins) if account else False


class PresentationBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: str = Field(min_length=1, max_length=64)
    demo_enabled: bool
    demo_tools: list[str] = Field(min_length=1, max_length=4)
    admins: list[str] = Field(max_length=64)


class PresentationStore:
    def __init__(self, home: Path, identity: tuple[str, bool] | None = None):
        self.path = home / "presentation.json"
        self.identity, self.windows = identity if identity is not None else windows_identity()
        self.lock = threading.RLock()

    def read(self):
        if not self.path.exists():
            return {"revision": "0", "demo_enabled": False,
                    "demo_tools": list(DEMO_TOOLS), "admins": list(DEFAULT_ADMINS)}
        try:
            if self.path.stat().st_size > 20000:
                raise ValueError()
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            return self.validate(PresentationBody.model_validate(raw))
        except (ValueError, OSError, TypeError):
            raise HTTPException(500, "Die Toolhub-Einstellungen konnten nicht gelesen werden. Die vorhandene Datei wurde nicht verändert.") from None

    @staticmethod
    def validate(body: PresentationBody):
        names = list(dict.fromkeys(name.strip() for name in body.admins))
        if any(not name or len(name) > 160 or any(ord(char) < 32 or ord(char) == 127 for char in name) for name in names):
            raise HTTPException(400, "Bitte gültige Windows-Anmeldenamen eintragen.")
        if set(body.demo_tools) - set(DEMO_TOOLS) or "nova-legenden" not in body.demo_tools:
            raise HTTPException(400, "Im Demo-Modus bleibt NOVA-Legenden sichtbar; weitere Demo-Werkzeuge bitte aus der Auswahl wählen.")
        return {"revision": body.revision, "demo_enabled": body.demo_enabled,
                "demo_tools": [tool for tool in DEMO_TOOLS if tool in body.demo_tools], "admins": names}

    def snapshot(self):
        with self.lock:
            data = self.read()
            admin = is_admin(self.identity, data["admins"])
            return {**data, "identity": self.identity, "is_admin": admin,
                    "can_manage": admin or not data["admins"] or not self.windows,
                    "windows_roles": self.windows}

    def save(self, body: PresentationBody):
        with self.lock:
            current = self.snapshot()
            if not current["can_manage"]:
                raise HTTPException(403, "Diese Einstellungen können nur die hinterlegten Administratoren ändern.")
            if body.revision != current["revision"]:
                raise HTTPException(409, "Die Einstellungen wurden inzwischen geändert. Bitte neu laden.")
            value = self.validate(body)
            if self.windows and value["admins"] and not is_admin(self.identity, value["admins"]):
                raise HTTPException(400, "Bitte die eigene Windows-Anmeldung als Administrator beibehalten, damit du die Einstellungen weiter öffnen kannst.")
            value["revision"] = str(uuid.uuid4())
            self.path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.path.with_name(f".presentation-{uuid.uuid4()}.tmp")
            try:
                temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
                os.replace(temporary, self.path)
            finally:
                temporary.unlink(missing_ok=True)
            return self.snapshot()


def register(app):
    store = PresentationStore(local_home())
    app.state.presentation = store

    @app.get(PREFIX)
    def get_presentation():
        return JSONResponse(store.snapshot(), headers={"Cache-Control": "no-store"})

    @app.put(PREFIX)
    def put_presentation(body: PresentationBody):
        # The global loopback/session middleware protects this mutation before it
        # reaches the route; role checks happen in the store, on the server.
        return JSONResponse(store.save(body), headers={"Cache-Control": "no-store"})
