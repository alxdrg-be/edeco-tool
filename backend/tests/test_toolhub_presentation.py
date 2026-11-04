"""Presentation mode persists without trusting client-side role claims."""

from __future__ import annotations

import json

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from edeco_toolbox.local_security import register as register_security
from edeco_toolbox.presentation import DEMO_TOOLS, LEGACY_DEMO_TOOLS, PREFIX, PresentationBody, PresentationStore, is_admin


def body(snapshot, **changes):
    value = {key: snapshot[key] for key in ("revision", "demo_enabled", "demo_tools", "admins")}
    return PresentationBody.model_validate({**value, **changes})


def test_windows_names_match_case_insensitively_and_respect_explicit_domain():
    assert is_admin("EDECO\\ADUERGER", ["aduerger"])
    assert is_admin("edeco\\nstrauss", ["EDECO\\NSTRAUSS"])
    assert not is_admin("OTHER\\nstrauss", ["EDECO\\nstrauss"])
    assert not is_admin("", ["aduerger"])
    assert not is_admin("edeco\\someone", ["aduerger", "nstrauss"])


def test_defaults_and_demo_scope_survive_restart(tmp_path):
    store = PresentationStore(tmp_path, ("EDECO\\aduerger", True))
    initial = store.snapshot()
    assert initial["admins"] == ["aduerger", "nstrauss"]
    assert initial["demo_tools"] == DEMO_TOOLS
    assert initial["is_admin"] and initial["can_manage"] and not initial["demo_enabled"]
    saved = store.save(body(initial, demo_enabled=True))
    assert saved["revision"] != "0"
    assert PresentationStore(tmp_path, ("EDECO\\nstrauss", True)).snapshot()["demo_enabled"]
    assert json.loads(store.path.read_text())["demo_tools"] == DEMO_TOOLS


def test_legacy_default_adds_memory_without_get_writes_and_explicit_opt_out_survives(tmp_path):
    store = PresentationStore(tmp_path, ("EDECO\\aduerger", True))
    legacy = {"revision": "legacy-default", "demo_enabled": True,
              "demo_tools": list(LEGACY_DEMO_TOOLS), "admins": ["aduerger", "nstrauss"]}
    store.path.write_text(json.dumps(legacy), encoding="utf-8")
    original = store.path.read_bytes()
    migrated = store.snapshot()
    assert migrated["demo_tools"] == DEMO_TOOLS and migrated["demo_enabled"]
    assert migrated["revision"] != legacy["revision"]
    assert store.path.read_bytes() == original
    with pytest.raises(HTTPException) as stale:
        store.save(body(legacy))
    assert stale.value.status_code == 409
    store.save(body(migrated, demo_tools=list(LEGACY_DEMO_TOOLS)))
    stored = json.loads(store.path.read_text())
    assert stored["schema_version"] == 2
    assert PresentationStore(tmp_path, ("EDECO\\nstrauss", True)).snapshot()["demo_tools"] == LEGACY_DEMO_TOOLS


def test_reduced_legacy_demo_selection_is_preserved(tmp_path):
    store = PresentationStore(tmp_path, ("EDECO\\aduerger", True))
    legacy = {"revision": "deliberate-selection", "demo_enabled": True,
              "demo_tools": ["nova-legenden", "pdf-werkzeuge"], "admins": ["aduerger"]}
    store.path.write_text(json.dumps(legacy), encoding="utf-8")
    original = store.path.read_bytes()
    snapshot = store.snapshot()
    assert snapshot["demo_tools"] == legacy["demo_tools"]
    assert snapshot["revision"] == legacy["revision"]
    assert store.path.read_bytes() == original


def test_unknown_preferences_version_is_preserved(tmp_path):
    store = PresentationStore(tmp_path, ("EDECO\\aduerger", True))
    raw = {**body(store.snapshot()).model_dump(), "schema_version": 99}
    store.path.write_text(json.dumps(raw), encoding="utf-8")
    original = store.path.read_bytes()
    with pytest.raises(HTTPException) as failure:
        store.snapshot()
    assert failure.value.status_code == 500
    assert store.path.read_bytes() == original


def test_non_admin_cannot_write_or_invent_client_role(tmp_path):
    store = PresentationStore(tmp_path, ("EDECO\\someone", True))
    initial = store.snapshot()
    assert not initial["can_manage"] and not initial["is_admin"]
    with pytest.raises(HTTPException) as failure:
        store.save(body(initial, demo_enabled=True))
    assert failure.value.status_code == 403
    assert not store.path.exists()
    with pytest.raises(ValueError):
        PresentationBody.model_validate({**body(initial).model_dump(), "is_admin": True})


def test_admin_cannot_remove_own_access_but_linux_development_stays_editable(tmp_path):
    store = PresentationStore(tmp_path, ("EDECO\\aduerger", True))
    with pytest.raises(HTTPException) as failure:
        store.save(body(store.snapshot(), admins=["nstrauss"]))
    assert failure.value.status_code == 400
    developer = PresentationStore(tmp_path, ("agent", False))
    assert developer.snapshot()["can_manage"]
    developer.save(body(developer.snapshot(), demo_enabled=True))


@pytest.mark.parametrize("selection", [["pdf-werkzeuge"], ["nova-legenden", "bim2steiger"]])
def test_invalid_demo_scope_is_rejected_without_overwriting_config(tmp_path, selection):
    store = PresentationStore(tmp_path, ("EDECO\\aduerger", True))
    with pytest.raises(HTTPException) as failure:
        store.save(body(store.snapshot(), demo_tools=selection))
    assert failure.value.status_code == 400
    assert not store.path.exists()


def test_stale_save_does_not_overwrite_newer_preferences(tmp_path):
    store = PresentationStore(tmp_path, ("EDECO\\aduerger", True))
    initial = store.snapshot()
    saved = store.save(body(initial, demo_enabled=True))
    with pytest.raises(HTTPException) as failure:
        store.save(body(initial, demo_enabled=False))
    assert failure.value.status_code == 409
    assert store.snapshot()["revision"] == saved["revision"]
    assert not list(tmp_path.glob("*.tmp"))


def test_corrupt_config_is_preserved_and_not_silently_reset(tmp_path):
    path = tmp_path / "presentation.json"
    path.write_text("{broken", encoding="utf-8")
    with pytest.raises(HTTPException) as failure:
        PresentationStore(tmp_path, ("agent", False)).snapshot()
    assert failure.value.status_code == 500
    assert path.read_text() == "{broken"


def test_api_requires_loopback_session_and_checks_server_identity(tmp_path, monkeypatch):
    from edeco_toolbox import presentation
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path))
    monkeypatch.setattr(presentation, "windows_identity", lambda: ("EDECO\\someone", True))
    app = FastAPI()
    register_security(app)
    presentation.register(app)
    with TestClient(app, base_url="http://127.0.0.1:8765") as client:
        snapshot = client.get(PREFIX).json()
        payload = body(snapshot, demo_enabled=True).model_dump()
        assert client.put(PREFIX, json=payload).status_code == 403
        app.state.presentation.identity = "EDECO\\aduerger"
        client.cookies.clear()
        assert client.put(PREFIX, json=payload).status_code == 403
        assert client.get(PREFIX).status_code == 200
        assert client.put(PREFIX, headers={"Origin": "https://evil.example"}, json=payload).status_code == 403
        response = client.put(PREFIX, json=payload)
        assert response.status_code == 200 and response.json()["demo_enabled"]
        assert response.headers["Cache-Control"] == "no-store"
