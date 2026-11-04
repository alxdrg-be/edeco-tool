"""Exercise an old cached entry and a new build in the same persistent profile."""

import os
import socket
import threading
import time

import pytest
import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from edeco_toolbox import ui_cache

playwright = pytest.importorskip("playwright.sync_api")


def test_new_build_uses_current_ui_and_keeps_the_existing_browser_profile(tmp_path, monkeypatch):
    ui = tmp_path / "ui"
    assets = ui / "assets"
    assets.mkdir(parents=True)
    (assets / "previous.js").write_text("document.querySelector('h1').textContent='Previous UI';", encoding="utf-8")
    (assets / "current.js").write_text("document.querySelector('h1').textContent='Current UI';", encoding="utf-8")
    old_html = '<h1>Loading</h1><script src="/assets/previous.js"></script>'
    (ui / "index.html").write_text('<h1>Loading</h1><script src="/assets/current.js"></script>', encoding="utf-8")
    legacy = {"enabled": True}
    requests = []
    app = FastAPI()

    @app.middleware("http")
    async def old_installation(request, call_next):
        requests.append(str(request.url))
        if legacy["enabled"] and request.url.path == "/":
            return HTMLResponse(old_html, headers={"Cache-Control": "public, max-age=86400"})
        return await call_next(request)

    app.mount("/", ui_cache.CurrentUIFiles(directory=ui, html=True))
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    origin = f"http://127.0.0.1:{sock.getsockname()[1]}"
    server = uvicorn.Server(uvicorn.Config(app, log_level="error"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    profile = tmp_path / "existing-webview-profile"
    try:
        deadline = time.monotonic() + 10
        while not server.started:
            if not thread.is_alive() or time.monotonic() >= deadline:
                pytest.fail("The upgrade test server did not start")
            time.sleep(.02)
        with playwright.sync_playwright() as pw:
            launch = {"headless": True}
            if os.environ.get("NOVA_TEST_CHROMIUM"):
                launch["executable_path"] = os.environ["NOVA_TEST_CHROMIUM"]
            try:
                context = pw.chromium.launch_persistent_context(str(profile), **launch)
            except Exception:
                if os.environ.get("CI"):
                    raise
                pytest.skip("Chromium is unavailable locally")
            try:
                page = context.pages[0]
                page.goto(origin)
                playwright.expect(page.locator("h1")).to_have_text("Previous UI")
                page.evaluate("localStorage.setItem('saved-legend', 'keep-my-work')")
            finally:
                context.close()
            legacy["enabled"] = False
            monkeypatch.setattr(ui_cache, "BUILD", 30)
            monkeypatch.setattr(ui_cache, "COMMIT", "upgrade-test")
            entry = ui_cache.desktop_ui_url(origin)
            context = pw.chromium.launch_persistent_context(str(profile), **launch)
            try:
                page = context.pages[0]
                response = page.goto(entry)
                assert response.status == 200
                assert "no-store" in response.headers["cache-control"]
                playwright.expect(page.locator("h1")).to_have_text("Current UI")
                assert page.evaluate("localStorage.getItem('saved-legend')") == "keep-my-work"
                # Even if an installer left previous chunks, the new entry wins.
                assert (assets / "previous.js").is_file()
                assert entry in requests
            finally:
                context.close()
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()
