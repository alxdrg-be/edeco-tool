from fastapi.testclient import TestClient

from edeco_toolbox.app import create_app
from test_phase3 import env  # noqa: F401


def test_update_actions_require_local_host_and_session_key(env, monkeypatch):
    original, _ = env
    app = create_app(original.app.state.nova)
    monkeypatch.setattr(app.state.updates, "check", lambda: app.state.updates.public())
    with TestClient(app, base_url="http://127.0.0.1") as client:
        state = client.get("/api/toolbox/updates").json()
        assert client.post("/api/toolbox/updates/check", json={}).status_code == 403
        headers = {"X-Edeco-Update": state["session_key"]}
        assert client.post("/api/toolbox/updates/check", json={}, headers={**headers, "Origin": "https://other.example"}).status_code == 403
        assert client.post("/api/toolbox/updates/check", json={}, headers=headers).status_code == 200
        saved = client.post("/api/toolbox/updates/preferences", json={"automatic": False}, headers=headers)
        assert saved.status_code == 200 and saved.json()["automatic"] is False
        assert client.post("/api/toolbox/updates/install", json={}, headers=headers).status_code == 400
    assert create_app(original.app.state.nova).state.updates.automatic is False
