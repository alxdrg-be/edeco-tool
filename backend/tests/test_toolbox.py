"""Shared host: module data stays usable and legacy installers cannot replace it."""

from fastapi.testclient import TestClient

from edeco_toolbox.app import create_app
from nova_legend import updater
from test_phase3 import env  # noqa: F401


def test_shared_host_exposes_nova_api_before_static_files(env, tmp_path):
    original, _ = env
    ui = tmp_path / "ui"
    ui.mkdir()
    (ui / "index.html").write_text("<title>edeco Toolhub</title>")
    with TestClient(create_app(original.app.state.nova, ui_dir=ui), base_url="http://127.0.0.1") as client:
        assert client.get("/api/toolbox/status").json()["name"] == "edeco Toolhub"
        assert "edeco Toolhub" in client.get("/").text
        assert client.get("/api/status").json()["symbol_count"] > 0
        project = client.post("/api/projects", json={"name": "Toolbox"})
        assert project.status_code == 200
        assert original.get(f"/api/projects/{project.json()['id']}").status_code == 200


def test_nova_updates_never_contact_or_replace_standalone_program(env, monkeypatch):
    original, tmp = env

    def forbidden(*args, **kwargs):
        raise AssertionError("Standalone updater must not run inside the toolbox")

    monkeypatch.setattr(updater, "check", forbidden)
    with TestClient(create_app(original.app.state.nova, ui_dir=tmp / "no-ui"), base_url="http://127.0.0.1") as client:
        response = client.get("/api/update/check")
        assert response.status_code == 200
        assert response.json()["can_install"] is False
        assert client.post("/api/update/install").status_code == 409
