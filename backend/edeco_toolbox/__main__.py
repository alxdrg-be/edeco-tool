"""Toolbox desktop lifecycle, persistent browser profile and common updates."""

import argparse
import json
import logging
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn
import httpx

from nova_legend import config, dialogs
from nova_legend.__main__ import free_port

from . import APP_NAME, version_label
from .app import create_app
from .paths import local_home


def wait_until_up(url: str, timeout: float = 60.0) -> bool:
    deadline = time.monotonic() + timeout
    with httpx.Client(trust_env=False, timeout=2) as client:
        while time.monotonic() < deadline:
            try:
                if client.get(url + '/api/toolbox/status').status_code == 200:
                    return True
            except httpx.HTTPError:
                pass
            time.sleep(.3)
    return False


def desktop_profile(home: Path) -> Path:
    profile = home / "webview"
    profile.mkdir(parents=True, exist_ok=True)
    return profile


def preferred_port(home: Path) -> int:
    try:
        value = json.loads((home / "desktop.json").read_text(encoding="utf-8"))["port"]
        return value if isinstance(value, int) and 1024 <= value <= 65535 else 8765
    except (OSError, ValueError, KeyError, TypeError):
        return 8765


def save_port(home: Path, port: int):
    home.mkdir(parents=True, exist_ok=True)
    target = home / "desktop.json"
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps({"port": port}), encoding="utf-8")
    temporary.replace(target)


def probe_desktop(window, home: Path):
    """Exercise the real native renderer and React page, then close it for CI."""
    report = {"ok": False}
    try:
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if window.evaluate_js("Boolean(document.querySelector('.toolbox-header') && document.querySelectorAll('.toolbox-card').length === 10)"):
                report = {"ok": True, "tool_count": 10}
                break
            time.sleep(.25)
        if not report["ok"]:
            report["error"] = "Das native Fenster hat die Toolbox nicht gerendert."
        elif getattr(sys, 'frozen', False):
            report['ok'] = False
            window.evaluate_js("document.querySelector('button[aria-label=\"PDF-Werkstatt öffnen\"]').click()")
            deadline = time.monotonic() + 160
            while time.monotonic() < deadline:
                if window.evaluate_js("Boolean(document.querySelector('.pdf-stirling-frame')?.contentDocument?.querySelector('input[type=file]'))"):
                    report.update(ok=True, pdf_ready=True)
                    break
                time.sleep(.5)
            if not report['ok']:
                report['error'] = 'Die lokale PDF-Werkstatt wurde im nativen Fenster nicht bereit.'
    except Exception:
        logging.exception("Native desktop smoke test failed")
        report['ok'] = False
        report["error"] = "Fehler beim Rendern im nativen Fenster."
    finally:
        (home / "desktop-smoke.json").write_text(json.dumps(report), encoding="utf-8")
        window.destroy()


def main(argv=None):
    parser = argparse.ArgumentParser(prog="edeco_toolbox")
    parser.add_argument("--browser", action="store_true")
    parser.add_argument("--server", action="store_true")
    parser.add_argument("--port", type=int)
    parser.add_argument("--desktop-smoke-test", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    home = local_home()
    home.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s",
                        handlers=[logging.FileHandler(home / "toolbox.log", encoding="utf-8")]
                        + ([logging.StreamHandler()] if sys.stderr else []))
    port = free_port(args.port if args.port is not None else preferred_port(home))
    app = create_app()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_config=None))
    url = f"http://127.0.0.1:{port}"
    logging.info("%s auf %s", APP_NAME, url)
    if args.server:
        server.run()
        return 0
    save_port(home, port)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    if not wait_until_up(url):
        logging.error("Toolbox-Server startet nicht")
        return 1
    if not args.browser:
        try:
            import webview
        except ImportError:
            if args.desktop_smoke_test:
                logging.exception("Native renderer import failed")
                server.should_exit = True
                thread.join(timeout=10)
                return 1
            logging.warning("pywebview fehlt; öffne Browser")
        else:
            webview.settings["ALLOW_DOWNLOADS"] = True
            if getattr(sys, 'frozen', False):
                from .pdf_workshop.runtime import runtime_root
                webview.settings['WEBVIEW2_RUNTIME_PATH'] = str(runtime_root() / 'webview2')
                os.environ['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS'] = '--disable-background-networking --disable-component-update --disable-domain-reliability --no-pings'
            webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
            icon = config.resource_dir() / "packaging" / "toolbox.ico"
            window = webview.create_window(f"{APP_NAME} {version_label()}", url,
                                           width=1400, height=900, min_size=(900, 600))
            dialogs.attach(window)
            app.state.shutdown = window.destroy
            app.state.updates.desktop = True
            try:
                options = dict(private_mode=False, storage_path=str(desktop_profile(home)),
                               icon=str(icon) if icon.is_file() else None)
                if sys.platform == "win32":
                    options["gui"] = "edgechromium"
                if args.desktop_smoke_test:
                    (home / "desktop-smoke.json").unlink(missing_ok=True)
                    options["func"] = lambda: probe_desktop(window, home)
                webview.start(**options)
            except Exception:
                logging.exception("Toolbox window could not start")
                if not args.desktop_smoke_test and sys.platform == "win32":
                    import ctypes
                    ctypes.windll.user32.MessageBoxW(None,
                        "Das Toolbox-Fenster konnte nicht gestartet werden. Bitte das vollständige Setup verwenden.\n\n"
                        f"Fehlerprotokoll: {home / 'toolbox.log'}", APP_NAME, 0x10)
                return 1
            finally:
                server.should_exit = True
                thread.join(timeout=10)
            if args.desktop_smoke_test:
                report = home / "desktop-smoke.json"
                return 0 if report.is_file() and json.loads(report.read_text(encoding="utf-8")).get("ok") else 1
            app.state.updates.launch_pending()
            return 0
    webbrowser.open(url)
    try:
        while thread.is_alive():
            time.sleep(.3)
    except KeyboardInterrupt:
        server.should_exit = True
        thread.join(timeout=10)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
