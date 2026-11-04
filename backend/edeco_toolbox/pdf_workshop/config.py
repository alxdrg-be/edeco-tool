"""Per-user connection and optional company-managed branding/workflow profiles."""

import json
import os
import re
from pathlib import Path
from urllib.parse import urlsplit

from ..paths import local_home
from . import ROOT


def service_url(value: str) -> str:
    value = value.strip().rstrip("/")
    try:
        url = urlsplit(value)
        port = url.port
    except ValueError:
        raise ValueError("Bitte eine gültige Adresse des internen Stirling-Dienstes eintragen.") from None
    if (url.scheme not in {"http", "https"} or not url.hostname or url.username or url.password
            or url.query or url.fragment or url.path not in {"", ROOT} or (port is not None and port < 1)):
        raise ValueError("HTTP-/HTTPS-Adresse ohne Zugangsdaten verwenden, etwa http://PDF-SERVER:8088.")
    return f"{url.scheme}://{url.netloc}"


class Configuration:
    def __init__(self):
        self.runtime = None
        self.path = local_home() / "pdf-workshop" / "settings.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        company_path = os.environ.get("EDECO_PDF_COMPANY_CONFIG")
        self.company = self.read(Path(company_path)) if company_path else {}
        self.personal = self.read(self.path)
        self.api_key = os.environ.get("EDECO_STIRLING_API_KEY", "")

    @staticmethod
    def read(path):
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {}
        except (OSError, ValueError):
            return {}

    @property
    def managed(self):
        return bool(self.runtime or os.environ.get("EDECO_STIRLING_URL") or self.company.get("service_url"))

    @property
    def url(self):
        if self.runtime:
            return self.runtime.url or 'http://127.0.0.1:1'
        return service_url(os.environ.get("EDECO_STIRLING_URL") or self.company.get("service_url")
                           or self.personal.get("service_url") or "http://127.0.0.1:8088")

    def save(self, url):
        if self.runtime:
            raise ValueError("Diese installierte Ausgabe verwendet ihre mitgelieferte lokale PDF-Engine. Eine Firmenserver-Verbindung wird in einer separaten Serverinstallation eingerichtet.")
        if self.managed:
            raise ValueError("Die Verbindung wird von der Firma vorgegeben.")
        value = {"service_url": service_url(url)}
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(value), encoding="utf-8")
        temporary.replace(self.path)
        self.personal = value

    def public(self):
        accent = self.company.get("accent", "#c26279")
        if not isinstance(accent, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", accent):
            accent = "#c26279"
        return {"service_url": self.url, "managed": self.managed, "local": bool(self.runtime),
                "title": "edeco PDF-Werkstatt", "accent": accent,
                "workflows": [{"id": item["id"], "title": item.get("title", item["id"])}
                              for item in self.company.get("workflows", []) if isinstance(item, dict) and "id" in item]}
