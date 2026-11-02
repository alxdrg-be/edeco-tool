"""Shared immutable JSON records: no database or write lock on an SMB share."""
import getpass
import hashlib
import json
import os
import re
import shutil
import socket
import uuid
import threading
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

TOOLS = {
    "netzplaner": "Netzplaner · NIN (Beta)",
    "blitzschutz": "Blitzschutz", "kabelberechnung": "Kabel-Spannungsfall", "emobilitaet": "E-Mobilität · Vorplanung",
    "nin-kabelrechner": "NIN-Kabelvorprüfung", "strombelastbarkeit": "Strombelastbarkeit",
    "kurzschlussstrom": "Kurzschlussstrom", "ls-schalter": "LS-Schalter", "potenzialausgleich": "Potenzialausgleich",
    "transformator": "Transformator", "motoranlauf": "Motoranlauf", "blindleistung": "Blindleistung",
    "verlustleistung": "Verlustleistung", "ohmsches-gesetz": "Ohmsches Gesetz", "beleuchtung": "Beleuchtung",
    "pva-rechner": "PV-Anlage", "brandlast": "Brandlast · Grundrechnung", "poe": "PoE · Leistung",
    "premium-brandmelder": "Brandmelder", "premium-selektivitaet": "Selektivität", "premium-pkw": "Ladegrid PKW",
    "premium-lkw": "Ladegrid LKW", "premium-ladekosten": "Ladeinfrastruktur-Kosten", "premium-sia2056": "SIA 2056 Energie",
    "premium-poe": "PoE-Streckenplaner", "premium-brandlast": "Brandlast Fluchtweg",
}


def now():
    return datetime.now(timezone.utc).isoformat()


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2).encode("utf-8")


def read_json(path, limit=2_000_000):
    with path.open("rb") as handle:
        data = handle.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Ablagedatei ist zu gross.")
    value = json.loads(data)
    if not isinstance(value, dict):
        raise ValueError("Ungültige Ablagedatei.")
    return value


def subpath(value):
    if not isinstance(value, str) or not value or len(value) > 180:
        raise ValueError("Bitte einen Unterordner angeben.")
    parts = value.replace("\\", "/").split("/")
    if len(parts) > 6 or any(not part or part in {".", ".."} or part.endswith((".", " "))
            or re.search(r'[<>:"|?*\x00-\x1f]', part) or re.match(r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", part, re.I) for part in parts):
        raise ValueError("Unterordner ohne Laufwerk, Sonderzeichen oder .. verwenden, z. B. Planung/Berechnungen.")
    return "/".join(parts)


def confined(root, *parts):
    path = root.joinpath(*parts)
    if not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Der Ablagepfad verlässt den eingestellten Ordner.")
    return path


def write_new(path, content):
    with path.open("xb") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())


class ArchiveStore:
    def __init__(self, home):
        self.home = home
        home.mkdir(parents=True, exist_ok=True)
        self.settings_path = home / "settings.json"
        self.lock = threading.RLock()

    def settings(self):
        data = read_json(self.settings_path, 10000) if self.settings_path.exists() else {"root": "", "subfolder": "Berechnungen", "revision": "0"}
        managed = bool(os.environ.get("EDECO_CALCULATIONS_ARCHIVE_ROOT"))
        if managed:
            data["root"] = os.environ["EDECO_CALCULATIONS_ARCHIVE_ROOT"]
            data["revision"] = hashlib.sha256(json_bytes({"root": data["root"], "subfolder": data["subfolder"]})).hexdigest()
        return {**data, "managed": managed, "configured": bool(data["root"]), "author": getpass.getuser()}

    def base(self, revision=None):
        settings = self.settings()
        if revision is not None and revision != settings["revision"]:
            raise FileExistsError("Ablageeinstellungen wurden geändert. Bitte erneut laden.")
        root = Path(settings["root"])
        if not settings["configured"] or not root.is_absolute() or not root.is_dir():
            raise OSError("Der Serverordner ist nicht eingerichtet oder nicht erreichbar. Es wird keine lokale Ersatzablage verwendet.")
        base = confined(root, *subpath(settings["subfolder"]).split("/"))
        return base

    def configure(self, root_value, folder, revision):
        with self.lock:
            return self._configure(root_value, folder, revision)

    def _configure(self, root_value, folder, revision):
        settings = self.settings()
        if revision != settings["revision"]:
            raise FileExistsError("Einstellungen wurden inzwischen geändert. Bitte erneut laden.")
        if settings["managed"]:
            raise ValueError("Der Ablagepfad wird zentral vorgegeben.")
        root = Path(root_value)
        if not root_value or not root.is_absolute() or not root.is_dir():
            raise ValueError("Bitte einen vorhandenen, erreichbaren Serverordner mit vollständigem Pfad angeben.")
        folder = subpath(folder)
        base = confined(root, *folder.split("/"))
        base.mkdir(parents=True, exist_ok=True)
        probe = confined(base, f".edeco-test-{uuid.uuid4()}.tmp")
        try:
            write_new(probe, b"edeco archive write check")
            if probe.read_bytes() != b"edeco archive write check":
                raise OSError("Schreibprüfung fehlgeschlagen.")
        finally:
            probe.unlink(missing_ok=True)
        value = {"root": str(root), "subfolder": folder, "revision": str(uuid.uuid4())}
        temporary = self.home / f".settings-{uuid.uuid4()}.tmp"
        try:
            write_new(temporary, json_bytes(value)); os.replace(temporary, self.settings_path)
        finally:
            temporary.unlink(missing_ok=True)
        return self.settings()

    def folder(self, key, revision=None, base=None):
        parts = key.split("/")
        if len(parts) != 3 or parts[0] not in TOOLS or not re.fullmatch(r"P-[A-Za-z0-9%_-]{1,500}", parts[1]):
            raise ValueError("Ungültiger Rechenstand.")
        if str(uuid.UUID(parts[2])) != parts[2]:
            raise ValueError("Ungültiger Rechenstand.")
        return confined(base if base is not None else self.base(revision), *parts)

    def save(self, body, attachment=None):
        base = self.base(body["config_revision"])
        canonical = unicodedata.normalize("NFC", body["project"]["number"].strip()).casefold()
        segment = quote(canonical, safe="-_").replace(".", "%2E")[:120]
        key = f"{body['tool_id']}/P-{segment}--{hashlib.sha256(canonical.encode()).hexdigest()[:16]}/{body['request_id']}"
        # Encode dots too, including reserved/trailing-dot project numbers on Windows.
        key = key.replace(".", "%2E")
        target = self.folder(key, base=base)
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = {key: value for key, value in body.items() if key not in {"config_revision"}}
        file_name, file_data = attachment if attachment else (None, None)
        fingerprint = hashlib.sha256(json_bytes(payload) + (file_data or b"")).hexdigest()
        if target.exists():
            current = self.read(key, target)
            if current["fingerprint"] != fingerprint:
                raise FileExistsError("Dieser Rechenstand besteht mit anderem Inhalt. Bitte als neuen Stand speichern.")
            return current
        stage = confined(base, f".pending-{uuid.uuid4()}")
        stage.mkdir(parents=False)
        try:
            created = now()
            record = {**payload, "key": key, "tool_name": TOOLS[body["tool_id"]], "created_at": created,
                      "computer": socket.gethostname(), "fingerprint": fingerprint, "review": "fachliche Prüfung offen",
                      "attachment": file_name, "attachment_sha256": hashlib.sha256(file_data).hexdigest() if file_data else None}
            data = json_bytes(record)
            if len(data) > 2_000_000:
                raise ValueError("Rechenstand ist zu gross.")
            write_new(stage / "berechnung.json", data)
            meta = {field: record[field] for field in ["key", "tool_id", "tool_name", "title", "project", "created_at", "author", "source", "attachment"]}
            meta["notes_preview"] = record["notes"][:180]
            write_new(stage / "meta.json", json_bytes(meta))
            write_new(stage / "pruefsumme.sha256", hashlib.sha256(data).hexdigest().encode("ascii"))
            if file_data:
                write_new(stage / file_name, file_data)
            (stage / "Notizen").mkdir()
            try:
                stage.rename(target)
            except OSError:
                if target.exists() and self.read(key, target)["fingerprint"] == fingerprint:
                    return self.read(key, target)
                raise
        finally:
            if stage.exists(): shutil.rmtree(stage)
        return self.read(key, target)

    def read(self, key, folder=None):
        folder = folder if folder is not None else self.folder(key)
        with confined(folder, "berechnung.json").open("rb") as handle:
            data = handle.read(2_000_001)
        if len(data) > 2_000_000 or hashlib.sha256(data).hexdigest() != confined(folder, "pruefsumme.sha256").read_text():
            raise ValueError("Rechenstand ist beschädigt oder nachträglich verändert.")
        record = json.loads(data)
        if record.get("key") != key:
            raise ValueError("Rechenstand passt nicht zum Ordner.")
        comments = []
        for path in sorted(confined(folder, "Notizen").glob("*.json"))[:300]:
            try: comments.append(read_json(confined(folder, "Notizen", path.name), 30000))
            except (OSError, ValueError): continue
        return {**record, "comments": sorted(comments, key=lambda item: item.get("created_at", "")), "path": str(folder)}

    def add_note(self, key, text, author, revision):
        folder = self.folder(key, revision)
        self.read(key, folder)
        target = confined(folder, "Notizen", f"{uuid.uuid4()}.json")
        temporary = target.with_suffix(".tmp")
        try:
            write_new(temporary, json_bytes({"text": text, "author": author, "created_at": now(), "computer": socket.gethostname()}))
            temporary.rename(target)
        finally:
            temporary.unlink(missing_ok=True)
        return self.read(key, folder)

    def list(self):
        if not self.settings()["configured"]:
            return {"items": [], "unreadable": 0, "truncated": False}
        base, items, unreadable, seen = self.base(), [], 0, 0
        for tool in TOOLS:
            tool_dir = confined(base, tool)
            if not tool_dir.is_dir(): continue
            for project_dir in tool_dir.iterdir():
                if not project_dir.is_dir() or not project_dir.name.startswith("P-"): continue
                for record_dir in project_dir.iterdir():
                    seen += 1
                    if seen > 3000: return {"items": sorted(items, key=lambda item: item["created_at"], reverse=True), "unreadable": unreadable, "truncated": True}
                    key = f"{tool}/{project_dir.name}/{record_dir.name}"
                    try:
                        folder = self.folder(key, base=base)
                        meta = read_json(confined(folder, "meta.json"), 20000)
                        if meta.get("key") != key or meta.get("tool_id") != tool or not isinstance(meta.get("project"), dict) or any(not isinstance(meta.get(field), str) for field in ["title", "created_at", "author", "source"]) or any(not isinstance(meta["project"].get(field), str) for field in ["number", "name"]): raise ValueError()
                        items.append(meta)
                    except (OSError, ValueError): unreadable += 1
        return {"items": sorted(items, key=lambda item: item["created_at"], reverse=True), "unreadable": unreadable, "truncated": False}
