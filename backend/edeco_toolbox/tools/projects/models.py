"""Project request models and validation shared independently of HTTP routes."""

import re
from pathlib import Path, PureWindowsPath
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=180)]


def absolute_path(value):
    if value and ("\x00" in value or not (Path(value).is_absolute() or PureWindowsPath(value).is_absolute())):
        raise ValueError("Bitte einen absoluten Pfad verwenden, z. B. X:\\Projekte\\1498 oder einen UNC-Pfad.")
    return value


def valid_project_number(value):
    if re.search(r'[<>:"/\\|?*\x00-\x1f]', value) or value.endswith("."):
        raise ValueError("Die Projektnummer darf keine für Dateinamen ungültigen Zeichen enthalten.")
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
        return valid_project_number(value)

    @model_validator(mode="after")
    def unique_documents(self):
        if len({document.id for document in self.documents}) != len(self.documents):
            raise ValueError("Dokumentverweise müssen eindeutige IDs haben.")
        return self


class ProjectUpdate(ProjectData):
    version: int = Field(ge=1)


class Selection(BaseModel):
    project_id: str | None = Field(default=None, max_length=80)
