from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from edeco_toolbox.app import create_app
from edeco_toolbox.tools.projects.api import PREFIX
from edeco_toolbox.tools.projects.store import Conflict, ProjectStore
from test_phase3 import env  # noqa: F401


def data(number="1498", **changes):
    return dict(number=number, name="Neubau Musterstrasse", address="Musterstrasse 1", folder=r"X:\Projekte\1498",
                notes="", archived=False, contacts=[], documents=[], **changes)


def test_project_ids_selection_and_references_survive_restart_and_conflicting_edits(tmp_path):
    store = ProjectStore(tmp_path)
    body = data()
    body["contacts"] = [{"name": "Testkontakt", "role": "Bauleitung", "company": "Firma", "email": "test@example.invalid", "phone": "123"}]
    body["documents"] = [{"id": "plan", "title": "Grundriss", "path": r"X:\Projekte\1498\Plan.pdf", "added_at": "forged"}]
    first = store.save(deepcopy(body))
    store.select(first["id"])
    restarted = ProjectStore(tmp_path)
    assert restarted.snapshot()["active_id"] == first["id"]
    assert restarted.get(first["id"])["contacts"] == body["contacts"]
    assert first["documents"][0]["added_at"] != "forged"
    changed = deepcopy(body)
    changed["number"] = "1498-A"
    second = restarted.save(changed, first["id"], first["version"])
    assert second["id"] == first["id"] and second["version"] == 2
    assert second["documents"][0]["added_at"] == first["documents"][0]["added_at"]
    with pytest.raises(Conflict, match="inzwischen"):
        store.save(body, first["id"], first["version"])
    assert store.get(first["id"])["number"] == "1498-A"
    with pytest.raises(Conflict, match="vergeben"):
        store.save(data("1498-a"))
    changed["archived"] = True
    archived = store.save(changed, first["id"], second["version"])
    assert store.snapshot()["active_id"] is None
    with pytest.raises(Conflict, match="Archivierte"):
        store.select(first["id"])
    changed["archived"] = False
    store.save(changed, first["id"], archived["version"])
    store.select(first["id"])
    assert store.snapshot()["active_id"] == first["id"]


def test_project_api_authorization_validation_and_folder_open_only_uses_saved_path(env, monkeypatch, tmp_path):
    from edeco_toolbox.tools.projects import api as hub_api
    original, _ = env
    app = create_app(original.app.state.nova)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        state = client.get(PREFIX + "/state").json()
        headers = {"X-Edeco-Projects": state["session_key"]}
        assert client.post(PREFIX + "/projects", json=data()).status_code == 403
        assert client.post(PREFIX + "/projects", json=data(), headers={**headers, "Origin": "https://other.invalid"}).status_code == 403
        assert client.get(PREFIX + "/state", headers={"Origin": "https://other.invalid"}).status_code == 403
        for field, value in [("number", " "), ("name", ""), ("folder", "relative/path"), ("number", "1498/other")]:
            body = data(); body[field] = value
            assert client.post(PREFIX + "/projects", json=body, headers=headers).status_code == 422
        body = data(); body["folder"] = str(tmp_path)
        created = client.post(PREFIX + "/projects", json=body, headers=headers)
        assert created.status_code == 201
        project = created.json()
        pid = project["id"]
        assert client.get(PREFIX + "/state").json()["active_id"] == pid
        assert client.post(PREFIX + "/selection", json={"project_id": pid}, headers=headers).status_code == 200
        assert client.post(PREFIX + "/selection", json={"project_id": "missing"}, headers=headers).status_code == 404
        opened = []
        monkeypatch.setattr(hub_api, "open_folder", lambda path: opened.append(path))
        assert client.post(f"{PREFIX}/projects/{pid}/open-folder", headers=headers, json={"folder": "/other"}).status_code == 200
        assert opened == [str(tmp_path)]
        assert client.post(f"{PREFIX}/projects/{pid}/open-folder").status_code == 403
        updated = client.put(f"{PREFIX}/projects/{pid}", json={**body, "name": "Neuer Name", "version": project["version"]}, headers=headers)
        assert updated.status_code == 200
        assert client.put(f"{PREFIX}/projects/{pid}", json={**body, "version": project["version"]}, headers=headers).status_code == 409
        assert client.post(PREFIX + "/projects", json=body, headers=headers).status_code == 409
        # Creating central metadata does not create or replace a Nova project.
        assert original.get("/api/projects").json()["items"] == []


def test_open_folder_checks_reachability_before_launching(tmp_path, monkeypatch):
    from edeco_toolbox.tools.projects import api as hub_api
    launches = []
    monkeypatch.setattr(hub_api.sys, "platform", "linux")
    monkeypatch.setattr(hub_api.subprocess, "Popen", lambda command, **kwargs: launches.append(command))
    hub_api.open_folder(str(tmp_path))
    assert launches == [["xdg-open", str(tmp_path)]]
    with pytest.raises(ValueError, match="nicht erreichbar"):
        hub_api.open_folder(str(tmp_path / "missing"))
    with pytest.raises(ValueError):
        hub_api.open_folder("relative")
    assert len(launches) == 1
