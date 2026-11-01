"""Local-session protected project metadata and explicit folder opening."""

import hmac
import os
import re
import secrets
import sqlite3
import subprocess
import sys
from pathlib import Path, PureWindowsPath
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

from ...paths import local_home
from .store import Conflict, ProjectStore

PREFIX = "/api/tools/projektzentrale"
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=180)]


def absolute_path(value):
    if value and ("\x00" in value or not (Path(value).is_absolute() or PureWindowsPath(value).is_absolute())):
        raise ValueError("Bitte einen absoluten Pfad verwenden, z. B. X:\\Projekte\\1498 oder einen UNC-Pfad.")
    return value


class Contact(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: Short
    role: Short = ""
    company: Short = ""
    email: str = Field(default="", max_length=254)
    phone: str = Field(default="", max_length=80)


class Document(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    id: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=180)
    path: str = Field(min_length=1, max_length=1500)
    added_at: str = Field(default="", max_length=80)
    _path = field_validator("path")(absolute_path)


class ProjectData(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    number: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=180)
    address: str = Field(default="", max_length=500)
    folder: str = Field(default="", max_length=1500)
    notes: str = Field(default="", max_length=10000)
    archived: bool = False
    contacts: list[Contact] = Field(default_factory=list, max_length=50)
    documents: list[Document] = Field(default_factory=list, max_length=100)
    _folder = field_validator("folder")(absolute_path)

    @field_validator("number")
    @classmethod
    def valid_number(cls, value):
        if re.search(r'[<>:"/\\|?*\x00-\x1f]', value) or value.endswith("."):
            raise ValueError("Die Projektnummer darf keine für Dateinamen ungültigen Zeichen enthalten.")
        return value

    @model_validator(mode="after")
    def unique_documents(self):
        if len({document.id for document in self.documents}) != len(self.documents):
            raise ValueError("Dokumentverweise müssen eindeutige IDs haben.")
        return self


class ProjectUpdate(ProjectData):
    version: int = Field(ge=1)


class Selection(BaseModel):
    project_id: str | None = Field(default=None, max_length=80)


def open_folder(value):
    path = Path(value)
    if not value or not path.is_absolute() or not path.is_dir():
        raise ValueError("Der Projektordner ist auf diesem PC nicht erreichbar. Bitte Pfad und Netzlaufwerk prüfen.")
    if sys.platform == "win32":
        os.startfile(str(path))
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        subprocess.Popen(["xdg-open", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


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
