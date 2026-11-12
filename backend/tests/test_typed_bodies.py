"""Request bodies that used to be plain dicts are now checked models."""
from fastapi.testclient import TestClient

from edeco_toolbox.app import create_app
from edeco_toolbox.tools.calculation_archive import api as archive_api
from test_phase3 import env  # noqa: F401


def test_options_accept_known_switches_and_reject_other_values(env):
    client, _ = env
    assert client.put("/api/options", json={"merge_labels": False}).status_code == 200
    assert client.get("/api/options").json()["merge_labels"] is False
    assert client.put("/api/options", json={"merge_labels": "vielleicht"}).status_code == 422
    assert client.get("/api/options").json()["merge_labels"] is False
    unknown = client.put("/api/options", json={"unknown_switch": True, "legend_by_category": False})
    assert unknown.status_code == 200 and "unknown_switch" not in unknown.json()
    assert unknown.json()["legend_by_category"] is False and unknown.json()["merge_labels"] is False


def test_archive_open_folder_needs_session_and_a_text_key(env, monkeypatch):
    original, _ = env
    opened: list[str] = []
    monkeypatch.setattr(archive_api, "open_folder", opened.append)
    with TestClient(create_app(original.app.state.nova), base_url="http://127.0.0.1") as client:
        headers = {"X-Edeco-Projects": client.get(archive_api.PREFIX + "/state").json()["session_key"]}
        assert client.post(archive_api.PREFIX + "/open-folder", json={}).status_code == 403
        assert client.post(archive_api.PREFIX + "/open-folder", headers=headers, json={"key": 5}).status_code == 422
        assert client.post(archive_api.PREFIX + "/open-folder", headers=headers, json={"key": "x" * 801}).status_code == 422
    assert opened == []
