"""Loopback/session controls apply before APIs and mounted legacy applications."""

import pytest
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.testclient import TestClient

from edeco_toolbox.local_security import register
from test_phase3 import env  # noqa: F401 - isolated real application settings


@pytest.fixture
def secured_app():
    app = FastAPI()
    app.state.mutations = []
    register(app)

    @app.get("/", response_class=HTMLResponse)
    def home():
        return "<h1>Toolbox</h1>"

    @app.put("/api/settings")
    def settings(body: dict):
        app.state.mutations.append(body)
        return body

    child = FastAPI()

    @child.post("/api/import")
    def legacy_import(body: dict):
        app.state.mutations.append(body)
        return body

    app.mount("/tools/legacy", child)
    return app


@pytest.fixture
def client(secured_app):
    with TestClient(secured_app, base_url="http://127.0.0.1:8765") as browser:
        yield browser


@pytest.mark.parametrize("method,path", [("PUT", "/api/settings"), ("POST", "/tools/legacy/api/import")])
def test_mutations_require_session_including_mounted_tools(client, secured_app, method, path):
    assert client.request(method, path, json={"name": "blocked"}).status_code == 403
    assert secured_app.state.mutations == []
    response = client.get("/")
    assert response.status_code == 200
    cookie = response.headers["set-cookie"]
    assert "edeco_toolbox_session_8765=" in cookie
    assert "HttpOnly" in cookie and "SameSite=Strict" in cookie and "Path=/" in cookie
    assert "Domain=" not in cookie
    assert client.request(method, path, json={"name": "accepted"}).status_code == 200
    assert secured_app.state.mutations == [{"name": "accepted"}]


def test_native_client_may_use_session_header_without_cookie(client):
    response = client.get("/api/toolbox/session")
    assert response.headers["cache-control"] == "no-store"
    key = response.json()["session_key"]
    client.cookies.clear()
    assert client.put("/api/settings", json={}, headers={"X-Edeco-Session": key}).status_code == 200
    assert client.put("/api/settings", json={}, headers={"X-Edeco-Session": "wrong"}).status_code == 403


def test_explicit_wrong_header_does_not_fall_back_to_valid_cookie(client):
    client.get("/")
    assert client.put("/api/settings", json={}, headers={"X-Edeco-Session": "wrong"}).status_code == 403


@pytest.mark.parametrize("host", ["evil.example", "127.0.0.1.evil.example:8765", "localhost.evil.example", "127.0.0.2", "localhost:0", "localhost:65536", "localhost:bad", "user@localhost", "localhost."])
def test_rebinding_or_malformed_host_cannot_bootstrap(client, host):
    response = client.get("/api/toolbox/session", headers={"Host": host})
    assert response.status_code == 403
    assert "set-cookie" not in response.headers
    assert "session_key" not in response.text


def test_duplicate_host_is_rejected_before_api(client):
    response = client.get("/api/toolbox/session", headers=[("Host", "127.0.0.1:8765"), ("Host", "evil.example")])
    assert response.status_code == 403


@pytest.mark.parametrize("headers", [
    {"Origin": "https://evil.example"},
    {"Origin": "null"},
    {"Origin": "http://127.0.0.1:8766"},
    {"Origin": "http://localhost:8765"},
    {"Origin": "http://127.0.0.1:8765/forged"},
    {"Referer": "https://evil.example/attack"},
    {"Referer": "http://127.0.0.1:8766/other-app"},
    {"Sec-Fetch-Site": "cross-site"},
    {"Sec-Fetch-Site": "same-site"},
])
def test_foreign_page_cannot_bootstrap_or_mutate_even_with_valid_session(client, secured_app, headers):
    response = client.get("/api/toolbox/session", headers=headers)
    assert response.status_code == 403 and "set-cookie" not in response.headers
    client.get("/")
    response = client.put("/api/settings", json={"name": "blocked"}, headers=headers)
    assert response.status_code == 403
    assert secured_app.state.mutations == []


def test_same_origin_browser_requests_and_local_navigation_work(client):
    client.get("/", headers={"Sec-Fetch-Site": "none"})
    headers = {"Origin": "http://127.0.0.1:8765", "Referer": "http://127.0.0.1:8765/tools/page?view=one", "Sec-Fetch-Site": "same-origin"}
    response = client.put("/api/settings", json={"name": "accepted"}, headers=headers)
    assert response.status_code == 200
    assert response.headers["x-frame-options"] == "SAMEORIGIN"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["cross-origin-resource-policy"] == "same-origin"


def test_session_key_changes_on_restart_and_old_cookie_is_refreshed(secured_app):
    with TestClient(secured_app, base_url="http://127.0.0.1:8765") as first:
        old = first.get("/api/toolbox/session").json()["session_key"]
    restarted = FastAPI()
    register(restarted)

    @restarted.post("/api/change")
    def change():
        return {"ok": True}

    with TestClient(restarted, base_url="http://127.0.0.1:8765") as second:
        second.cookies.set("edeco_toolbox_session_8765", old)
        assert second.post("/api/change").status_code == 403
        fresh = second.get("/api/toolbox/session")
        assert fresh.json()["session_key"] != old
        assert "set-cookie" in fresh.headers
        assert second.post("/api/change").status_code == 200


def test_cookie_does_not_authenticate_another_port(secured_app):
    with TestClient(secured_app, base_url="http://127.0.0.1:8765") as browser:
        browser.get("/")
        assert browser.put("http://127.0.0.1:8766/api/settings", json={}).status_code == 403


def test_https_bootstrap_cookie_is_secure(secured_app):
    with TestClient(secured_app, base_url="https://localhost:8765") as browser:
        response = browser.get("/api/toolbox/session")
        assert "Secure" in response.headers["set-cookie"]
        assert browser.put("/api/settings", json={}).status_code == 200


def test_actual_toolbox_protects_nova_and_bim_without_disabling_the_tools(env):
    from edeco_toolbox.app import create_app

    original, tmp = env
    app = create_app(original.app.state.nova, ui_dir=tmp / "no-ui")
    # No lifespan is needed for these routes; the optional PDF engine is unrelated.
    client = TestClient(app, base_url="http://127.0.0.1:8765")
    try:
        initial_mode = original.app.state.nova.settings.ui_theme
        assert client.put("/api/settings/theme", json={"mode": "dark"}).status_code == 403
        assert original.app.state.nova.settings.ui_theme == initial_mode
        assert client.post("/tools/bim2steiger/api/tender/aggregate", json={"lines": []}).status_code == 403
        assert client.get("/api/toolbox/session", headers={"Host": "attacker.example:8765"}).status_code == 403
        assert client.get("/api/toolbox/session").status_code == 200
        assert client.put("/api/settings/theme", json={"mode": "dark"}).status_code == 200
        assert original.app.state.nova.settings.ui_theme == "dark"
        assert client.post("/tools/bim2steiger/api/tender/aggregate", json={"lines": []}).json() == {"lines": []}
    finally:
        client.close()
