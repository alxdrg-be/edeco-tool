"""Keep the rendered UI current when an update preserves the desktop profile."""

import os

from fastapi.testclient import TestClient

from edeco_toolbox import ui_cache
from edeco_toolbox.app import create_app
from test_phase3 import env  # noqa: F401


def test_ui_entries_do_not_reuse_an_old_conditional_response(env, tmp_path):
    original, _ = env
    ui = tmp_path / "ui"
    ui.mkdir()
    index = ui / "index.html"
    index.write_text("<title>old surface</title>", encoding="utf-8")
    before = index.stat()
    with TestClient(create_app(original.app.state.nova, ui_dir=ui), base_url="http://127.0.0.1") as client:
        cached = client.get("/")
        assert cached.status_code == 200
        assert "no-store" in cached.headers["cache-control"]
        index.write_text("<title>new surface</title>", encoding="utf-8")
        # A same-sized packaged file can retain the previous timestamp and ETag.
        os.utime(index, ns=(before.st_atime_ns, before.st_mtime_ns))
        for path in ("/", "/index.html", "/?ui=new-build"):
            response = client.get(path, headers={
                "If-None-Match": cached.headers["etag"],
                "If-Modified-Since": cached.headers["last-modified"],
            })
            assert response.status_code == 200
            assert "new surface" in response.text
            assert response.headers["cache-control"] == "no-store, max-age=0"


def test_desktop_entry_changes_with_build_and_commit_without_changing_origin(monkeypatch):
    origin = "http://127.0.0.1:8765"
    monkeypatch.setattr(ui_cache, "BUILD", 29)
    monkeypatch.setattr(ui_cache, "COMMIT", "old-commit")
    old = ui_cache.desktop_ui_url(origin)
    monkeypatch.setattr(ui_cache, "BUILD", 30)
    changed_build = ui_cache.desktop_ui_url(origin)
    monkeypatch.setattr(ui_cache, "COMMIT", "new-commit")
    changed_commit = ui_cache.desktop_ui_url(origin + "/")
    assert len({old, changed_build, changed_commit}) == 3
    assert all(url.startswith(origin + "/?ui=") for url in (old, changed_build, changed_commit))
    assert ui_cache.desktop_ui_url(origin) == changed_commit
