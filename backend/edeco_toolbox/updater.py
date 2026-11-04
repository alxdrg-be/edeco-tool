"""Common release updater. Authentication stays in memory; only checked assets run."""

import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from . import APP_VERSION, BUILD
from .paths import local_home

REPOSITORY = "alxdrg-be/edeco-tool"
API = f"https://api.github.com/repos/{REPOSITORY}"
RELEASES_URL = f"https://github.com/{REPOSITORY}/releases"
MAX_SETUP = 1900 * 1024 * 1024  # Bundled PDF engine; keep below GitHub's 2 GiB asset limit.
log = logging.getLogger(__name__)


def version_key(tag: str) -> tuple[int, ...]:
    match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)-build\.(\d+)", tag)
    if not match:
        raise ValueError("Unbekannte Toolbox-Versionskennung")
    return tuple(map(int, match.groups()))


def github_credential() -> str | None:
    """Reuse supported CLI/environment/Git sign-ins without opening a login prompt."""
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    gh = shutil.which("gh")
    if gh:
        try:
            result = subprocess.run([gh, "auth", "token", "--hostname", "github.com"],
                                    capture_output=True, text=True, timeout=5, creationflags=flags)
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except (OSError, subprocess.TimeoutExpired):
            pass
    git = shutil.which("git")
    if git:
        try:
            result = subprocess.run(
                [git, "credential", "fill"],
                input=f"protocol=https\nhost=github.com\npath={REPOSITORY}.git\n\n",
                capture_output=True, text=True, timeout=5, creationflags=flags,
                env={**os.environ, "GIT_TERMINAL_PROMPT": "0", "GCM_INTERACTIVE": "never"})
            values = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
            if result.returncode == 0:
                return values.get("password")
        except (OSError, subprocess.TimeoutExpired):
            pass
    return None


class ReleaseRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        target = urlsplit(newurl)
        if (target.scheme != "https" or target.username or target.password or target.port not in (None, 443)
                or target.hostname not in {"api.github.com", "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com"}):
            raise ValueError("Unbekanntes Downloadziel")
        redirected = super().redirect_request(request, fp, code, msg, headers, newurl)
        if redirected and target.hostname != "api.github.com":
            redirected.remove_header("Authorization")
        return redirected


def download_verified(response, target: Path, digest: str, size: int,
                      progress: Callable[[int, int], None] | None = None) -> None:
    checksum, written, created = hashlib.sha256(), 0, False
    try:
        with target.open("xb") as stream:
            created = True
            if progress:
                progress(0, size)
            while chunk := response.read(1024 * 1024):
                written += len(chunk)
                if written > size or written > MAX_SETUP:
                    raise ValueError("Download ist grösser als angekündigt")
                checksum.update(chunk)
                stream.write(chunk)
                if progress:
                    progress(written, size)
        if written != size or not hmac.compare_digest(checksum.hexdigest(), digest):
            raise ValueError("Die Prüfsumme des Setups stimmt nicht. Installation abgebrochen.")
    except Exception:
        if created:
            target.unlink(missing_ok=True)
        raise


def launch_setup(target: Path, install_dir: Path) -> None:
    """An independent waiter releases all old files before the silent setup starts."""
    quote = lambda value: "'" + str(value).replace("'", "''") + "'"
    arguments = ["/SILENT", "/SUPPRESSMSGBOXES", "/NORESTART", f"/DIR={install_dir}"]
    script = (f"Wait-Process -Id {os.getpid()} -ErrorAction SilentlyContinue; "
              f"Start-Process -FilePath {quote(target)} -ArgumentList {quote(subprocess.list2cmdline(arguments))}")
    command = ["powershell.exe", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script]
    import ctypes
    result = ctypes.windll.shell32.ShellExecuteW(
        None, "open", command[0], subprocess.list2cmdline(command[1:]), str(target.parent), 0)
    if result <= 32:
        raise OSError("Der Update-Assistent konnte nicht gestartet werden.")


class UpdateManager:
    def __init__(self, home: Path | None = None):
        self.home = home or local_home()
        self.session_key = secrets.token_urlsafe(32)
        self.lock = threading.Lock()
        self.packaged = bool(getattr(sys, "frozen", False))
        self.installed = self.packaged and sys.platform == "win32" and any(Path(sys.executable).parent.glob("unins*.exe"))
        self.desktop = False
        self.asset = None
        self.token = None
        self.pending = None
        self.state = {"status": "unchecked", "message": "Noch nicht geprüft.", "checked_at": None}
        try:
            self.automatic = json.loads((self.home / "updates.json").read_text(encoding="utf-8")).get("automatic", True) is not False
        except (OSError, ValueError, AttributeError):
            self.automatic = True

    def public(self):
        return {**self.state, "current": f"v{APP_VERSION}-build.{BUILD}", "packaged": self.packaged,
                "installed": self.installed, "automatic": self.automatic, "release_url": RELEASES_URL,
                "session_key": self.session_key,
                "can_install": bool(self.desktop and self.installed and self.asset and self.state["status"] == "available")}

    def preferences(self, automatic: bool):
        self.home.mkdir(parents=True, exist_ok=True)
        target = self.home / "updates.json"
        temporary = target.with_suffix(".tmp")
        temporary.write_text(json.dumps({"automatic": automatic}), encoding="utf-8")
        temporary.replace(target)
        self.automatic = automatic
        return self.public()

    def _request(self, url: str, binary: bool = False):
        if not (url == API + "/releases/latest" or re.fullmatch(re.escape(API) + r"/releases/assets/\d+", url)):
            raise ValueError("Unbekannte Updatequelle")
        headers = {"Accept": "application/octet-stream" if binary else "application/vnd.github+json",
                   "User-Agent": "edeco-Toolbox-Updater", "X-GitHub-Api-Version": "2022-11-28"}
        if self.token:
            headers["Authorization"] = "Bearer " + self.token
        return build_opener(ReleaseRedirect()).open(Request(url, headers=headers), timeout=30)

    def _apply_release(self, release):
        self.asset = None
        tag = release["tag_name"]
        latest = version_key(tag)
        current = version_key(f"v{APP_VERSION}-build.{BUILD}")
        if release.get("draft") or release.get("prerelease"):
            raise ValueError("Kein freigegebener Toolbox-Build")
        if release.get("html_url") != RELEASES_URL + "/tag/" + tag:
            raise ValueError("Unbekannte Releasequelle")
        expected_name = f"edeco-Toolbox-Setup-{'.'.join(map(str, latest[:3]))}.exe"
        assets = [a for a in release.get("assets", []) if a.get("name") == expected_name and a.get("state") == "uploaded"]
        if len(assets) == 1:
            asset = assets[0]
            digest = re.fullmatch(r"sha256:([a-f0-9]{64})", asset.get("digest") or "")
            if (digest and re.fullmatch(re.escape(API) + r"/releases/assets/\d+", asset.get("url", ""))
                    and isinstance(asset.get("size"), int) and 0 < asset["size"] <= MAX_SETUP):
                self.asset = {"name": expected_name, "url": asset["url"], "sha256": digest[1], "size": asset["size"]}
        available = latest > current
        message = "Ein Toolhub-Update ist verfügbar." if available else "Der Toolhub ist aktuell."
        if available and not self.asset:
            message = "Neue Version verfügbar. Ein eindeutig geprüftes Setup fehlt; bitte die Release-Seite öffnen."
        elif available and not self.installed:
            message = "Neue Version verfügbar. Für diesen Quellcode- oder portablen Start die Release-Seite öffnen."
        return {"status": "available" if available else "current", "message": message,
                "latest": tag, "notes": str(release.get("body") or "")[:20000], "checked_at": None}

    def check(self):
        if not self.lock.acquire(blocking=False):
            raise ValueError("Eine Updateaktion läuft bereits.")
        try:
            if self.pending:
                return self.public()
            self.token = github_credential()
            try:
                with self._request(API + "/releases/latest") as response:
                    content = response.read(2_000_001)
                    if len(content) > 2_000_000:
                        raise ValueError("Updateantwort ist zu gross")
                    self.state = self._apply_release(json.loads(content))
            except HTTPError as exc:
                self.asset = None
                self.state = {"status": "unavailable", "message": (
                    "Das private Repository benötigt eine GitHub-Anmeldung mit Lesezugriff. "
                    "Vorhandene GitHub-CLI-/Git-Anmeldung verwenden oder die Releases im angemeldeten Browser öffnen."
                    if exc.code in (401, 403, 404) else "GitHub ist derzeit nicht erreichbar. Bitte später erneut prüfen.")}
            except (URLError, OSError, ValueError, KeyError, TypeError, AttributeError):
                self.asset = None
                self.state = {"status": "unavailable", "message": "Updateprüfung fehlgeschlagen. Internetverbindung prüfen oder die Release-Seite öffnen."}
            self.state["checked_at"] = datetime.now(timezone.utc).isoformat()
            return self.public()
        finally:
            self.lock.release()

    def install(self, shutdown):
        if not self.installed or not self.desktop:
            raise ValueError("Updates werden nur im installierten Windows-Programm gestartet.")
        if not self.lock.acquire(blocking=False):
            raise ValueError("Eine Updateaktion läuft bereits.")
        folder = None
        started = False
        try:
            if self.pending or not self.asset or self.state["status"] != "available":
                raise ValueError("Zuerst ein verfügbares Update prüfen.")
            asset = dict(self.asset)
            folder = Path(tempfile.mkdtemp(prefix="edeco-Toolbox-Update-"))
            if shutil.disk_usage(folder).free < asset['size'] * 4:
                raise ValueError('Für Download und Entpacken des Offline-Pakets ist zu wenig freier Speicher verfügbar. Bitte mindestens 6 GB freigeben.')
            target = folder / asset["name"]
            started = True

            def progress(written, total):
                verifying = written == total
                self.state = {**self.state, "status": "verifying" if verifying else "downloading",
                              "message": "Download vollständig. Prüfsumme wird geprüft …" if verifying else "Update wird heruntergeladen …",
                              "downloaded_bytes": written, "total_bytes": total,
                              "progress": round(100 * written / total, 1)}

            progress(0, asset["size"])
            with self._request(asset["url"], binary=True) as response:
                download_verified(response, target, asset["sha256"], asset["size"], progress)
            self.pending = (target, asset["sha256"], asset["size"])
            self.state = {**self.state, "status": "installing", "message": "Setup geprüft. Der Toolhub schliesst sich und startet nach dem Update neu."}

            def close():
                time.sleep(.8)  # Let the HTTP response reach the window first.
                try:
                    shutdown()
                except Exception:
                    self.pending = None
                    self.state = {**self.state, "status": "unavailable", "message": "Bitte den Toolhub schliessen und das Setup über Releases starten."}
                    log.exception("Toolbox window could not close for update")

            threading.Thread(target=close, daemon=True).start()
            return self.public()
        except Exception:
            if folder:
                shutil.rmtree(folder, ignore_errors=True)
            if started:
                self.state = {**self.state, "status": "available", "progress": 0,
                              "downloaded_bytes": 0,
                              "message": "Das Update konnte nicht vorbereitet werden. Bitte erneut versuchen."}
            raise
        finally:
            self.lock.release()

    def launch_pending(self):
        if not self.pending:
            return
        target, digest, size = self.pending
        # Check again after closing the window, before scheduling execution.
        with target.open('rb') as stream:
            actual_digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if target.stat().st_size != size or not hmac.compare_digest(actual_digest, digest):
            raise ValueError("Das vorbereitete Setup wurde verändert.")
        launch_setup(target, Path(sys.executable).parent)
        self.pending = None
