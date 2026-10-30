"""Toolbox desktop lifecycle, persistent browser profile and common updates."""

import argparse
import json
import logging
import sys
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn

from nova_legend import config, dialogs
from nova_legend.__main__ import free_port, wait_until_up

from . import APP_NAME, version_label
from .app import create_app
from .paths import local_home


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


def main(argv=None):
    parser = argparse.ArgumentParser(prog="edeco_toolbox")
    parser.add_argument("--browser", action="store_true")
    parser.add_argument("--server", action="store_true")
    parser.add_argument("--port", type=int)
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
            logging.warning("pywebview fehlt; öffne Browser")
        else:
            webview.settings["ALLOW_DOWNLOADS"] = True
            webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
            icon = config.resource_dir() / "packaging" / "toolbox.ico"
            window = webview.create_window(f"{APP_NAME} {version_label()}", url,
                                           width=1400, height=900, min_size=(900, 600))
            dialogs.attach(window)
            app.state.shutdown = window.destroy
            app.state.updates.desktop = True
            try:
                webview.start(private_mode=False, storage_path=str(desktop_profile(home)),
                              icon=str(icon) if icon.is_file() else None)
            finally:
                server.should_exit = True
                thread.join(timeout=10)
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
