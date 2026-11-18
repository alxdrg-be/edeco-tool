"""Persisted revision, bounded API and local-session checks for distribution plans."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json
import sqlite3
from threading import Barrier

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from edeco_toolbox.local_security import register as secure
from edeco_toolbox.tools.verteiler_dispo.api import MAX_BODY_BYTES, PREFIX, register
from edeco_toolbox.tools.verteiler_dispo.models import DistributionDocument
from edeco_toolbox.tools.verteiler_dispo.store import Conflict, CorruptDocument, DistributionStore


def document():
    return {
        "schema_version": 1, "id": "uv-test", "name": "UV EG", "project_id": None,
        "project_number": "1294", "project_name": "Muster", "location": "EG", "author": "Test",
        "drawing_number": "UV-01", "schematic_ref": "", "index": "A", "date": "2026-11-15",
        "revision": 0, "system_profile_id": "free", "vnb_id": "none", "vnb_profile_version": "",
        "sources": [], "profiles": [{
            "id": "mcb", "name": "LS Platzhalter", "kind": "mcb", "manufacturer": "", "article": "",
            "width_mm": 18, "height_mm": 80, "depth_mm": None, "te": 1, "mounting": "din",
            "power_loss_w": None, "rated_current_a": None, "clearance_mm": 0,
            "source_ids": [], "geometry_status": "generic", "terminal_kind": "",
            "busbar_section_width_mm": None, "busbar_section_thickness_mm": None,
        }],
        "cabinet": {
            "id": "cabinet", "name": "UV 01", "kind": "UV", "manufacturer": "", "system": "Frei",
            "article": "", "width_mm": 500, "height_mm": 600, "depth_mm": 200,
            "inner_width_mm": 450, "inner_height_mm": 550, "usable_depth_mm": None,
            "color_outer": "#d6d8d5", "color_inner": "#eeeeee",
            "fields": [{"id": "field", "name": "Apparate", "role": "equipment", "sealed": False,
                        "x_mm": 0, "y_mm": 0, "width_mm": 450, "height_mm": 550}],
            "rails": [{"id": "rail", "field_id": "field", "name": "R1", "x_mm": 20, "y_mm": 80,
                       "z_mm": 0, "length_mm": 400, "te_pitch_mm": 18}],
            "placements": [{"id": "q1", "profile_id": "mcb", "rail_id": "rail", "field_id": "field",
                            "label": "Q1", "x_mm": 20, "y_mm": 80, "z_mm": 0, "rotation": 0,
                            "status": "planned", "source_circuit_id": None, "notes": ""}],
            "covers": [], "reserved_zones": [],
        },
        "ratings": {"rated_voltage_v": None, "rated_current_a": None, "ip_closed": "",
                    "ip_open_covered": "", "access_protection": "", "icw_ka": None,
                    "icw_duration_s": None, "ipk_ka": None, "icc_ka": None,
                    "protective_device_ref": "", "source_ids": [], "notes": ""},
    }


@pytest.fixture
def client(tmp_path):
    app = FastAPI()
    secure(app)
    register(app, tmp_path / "verteiler")
    with TestClient(app, base_url="http://127.0.0.1") as result:
        result.get(PREFIX + "/documents")
        yield result


def test_revision_history_survives_restart_and_conflicting_edits(tmp_path):
    first_store = DistributionStore(tmp_path)
    original = DistributionDocument.model_validate(document())
    first = first_store.save(original, 0)
    assert first["revision"] == first["document"]["revision"] == 1
    assert original.revision == 0  # Save does not mutate the caller's undo history.
    second_store = DistributionStore(tmp_path)
    assert second_store.get(original.id) == first
    changed = DistributionDocument.model_validate({**first["document"], "name": "UV neuer Stand"})
    second = second_store.save(changed, 1)
    assert second["revision"] == 2
    assert second_store.revision(original.id, 1)["document"]["name"] == "UV EG"
    assert [row["revision"] for row in second_store.history(original.id)] == [2, 1]
    with pytest.raises(Conflict):
        first_store.save(changed, 1)
    assert first_store.get(original.id) == second
    assert len(first_store.history(original.id)) == 2


def test_concurrent_first_saves_never_overwrite_each_other(tmp_path):
    a, b = DistributionStore(tmp_path), DistributionStore(tmp_path)
    barrier = Barrier(2)

    def save(store, name):
        value = DistributionDocument.model_validate({**document(), "name": name})
        barrier.wait(timeout=5)
        try:
            return store.save(value, 0)["document"]["name"]
        except Conflict:
            return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(save, a, "Fenster A")
        second = pool.submit(save, b, "Fenster B")
        results = [first.result(timeout=10), second.result(timeout=10)]
    assert results.count("conflict") == 1
    assert a.get("uv-test")["document"]["name"] in results
    assert len(a.history("uv-test")) == 1


def test_corrupt_or_future_database_is_not_silently_replaced(tmp_path):
    future = tmp_path / "future"
    future.mkdir()
    path = future / "dispositions.sqlite3"
    with sqlite3.connect(path) as db:
        db.execute("PRAGMA user_version=99")
    before = path.read_bytes()
    with pytest.raises(CorruptDocument, match="neuere"):
        DistributionStore(future)
    assert path.read_bytes() == before

    store = DistributionStore(tmp_path / "current")
    store.save(DistributionDocument.model_validate(document()), 0)
    with sqlite3.connect(store.path) as db:
        db.execute("UPDATE documents SET data=?", ('{"private":"DO-NOT-ECHO"}',))
    with pytest.raises(CorruptDocument, match="nicht verändert"):
        store.get("uv-test")


def test_future_module_database_does_not_break_host_startup(tmp_path):
    path = tmp_path / "dispositions.sqlite3"
    with sqlite3.connect(path) as db:
        db.execute("PRAGMA user_version=99")
    original = path.read_bytes()
    app = FastAPI()
    register(app, tmp_path)  # Registration itself must not open/change future data.

    @app.get("/other-tool")
    def other_tool():
        return {"ready": True}

    with TestClient(app) as client:
        assert client.get("/other-tool").json() == {"ready": True}
        failed = client.get(PREFIX + "/documents")
        assert failed.status_code == 500 and "nicht ersetzt" in failed.text
    assert path.read_bytes() == original


def test_api_save_conflict_read_history_and_id_mismatch(client):
    assert client.get(PREFIX + "/documents").json() == []
    created = client.put(PREFIX + "/documents/uv-test", json={"document": document(), "base_revision": 0})
    assert created.status_code == 201
    first = created.json()
    assert first["revision"] == 1
    assert client.get(PREFIX + "/documents/uv-test").json() == first
    assert client.get(PREFIX + "/documents").json()[0]["project_number"] == "1294"
    changed = {**first["document"], "name": "UV 01 nach Prüfung"}
    saved = client.put(PREFIX + "/documents/uv-test", json={"document": changed, "base_revision": 1})
    assert saved.status_code == 200 and saved.json()["revision"] == 2
    assert client.put(PREFIX + "/documents/uv-test", json={"document": changed, "base_revision": 1}).status_code == 409
    assert client.put(PREFIX + "/documents/other", json={"document": changed, "base_revision": 1}).status_code == 422
    assert len(client.get(PREFIX + "/documents/uv-test/revisions").json()) == 2
    assert client.get(PREFIX + "/documents/uv-test/revisions/1").json()["document"]["name"] == "UV EG"
    assert client.get(PREFIX + "/documents/missing").status_code == 404
    assert client.get(PREFIX + "/documents/uv-test/revisions/99").status_code == 404


def test_bounded_requests_validation_and_session_do_not_damage_saved_plan(client, monkeypatch):
    import edeco_toolbox.tools.verteiler_dispo.api as api

    first = client.put(PREFIX + "/documents/uv-test", json={"document": document(), "base_revision": 0}).json()
    private = {**document(), "name": "DO-NOT-ECHO", "schema_version": 2}
    invalid = client.put(PREFIX + "/documents/uv-test", json={"document": private, "base_revision": 0})
    assert invalid.status_code == 422 and "DO-NOT-ECHO" not in invalid.text
    bad_float = deepcopy(document())
    bad_float["cabinet"]["width_mm"] = float("nan")
    invalid = client.put(PREFIX + "/documents/uv-test", content=json.dumps({"document": bad_float, "base_revision": 0}), headers={"Content-Type": "application/json"})
    assert invalid.status_code == 422
    assert client.put(PREFIX + "/documents/uv-test", json={"document": document(), "base_revision": True}).status_code == 422
    monkeypatch.setattr(api, "MAX_BODY_BYTES", 100)
    assert client.put(PREFIX + "/documents/uv-test", content=b" " * 101).status_code == 413
    assert client.get(PREFIX + "/documents/uv-test").json() == first
    assert client.put(PREFIX + "/documents/uv-test", json={}, headers={"Origin": "https://foreign.invalid"}).status_code == 403
    client.cookies.clear()
    assert client.put(PREFIX + "/documents/uv-test", json={}).status_code == 403
    assert MAX_BODY_BYTES == 12 * 1024 * 1024


def test_real_catalog_defaults_analysis_and_import_are_consistent(client):
    catalog = client.get(PREFIX + "/catalog")
    assert catalog.status_code == 200 and len(catalog.json()["profiles"]) > 0
    for vnb_id in ("none", "iwb", "primeo", "ebl"):
        result = client.get(PREFIX + "/default", params={"vnb_id": vnb_id})
        assert result.status_code == 200
        doc = result.json()
        assert doc["revision"] == 0 and doc["vnb_id"] == vnb_id
        response = client.post(PREFIX + "/analysis", json={"document": doc})
        assert response.status_code == 200 and response.json()["document_hash"]
        imported = client.post(PREFIX + "/import", json={"document": doc})
        assert imported.status_code == 200 and imported.json()["document"] == doc
    assert client.get(PREFIX + "/default", params={"template_id": "missing"}).status_code == 404
    assert client.get(PREFIX + "/default", params={"vnb_id": "invented"}).status_code == 422


def test_canonical_preview_and_exports_keep_saved_data_and_safe_headers(client):
    doc = document()
    doc["name"] = 'UV "Muster" / Süd'
    preview = client.post(PREFIX + "/preview", json={"document": doc, "view": "front"})
    assert preview.status_code == 200 and "<svg" in preview.json()["svg"]
    for format, signature in (("json", b"{"), ("svg", b"<svg"), ("pdf", b"%PDF"), ("dxf", None), ("bom-csv", None), ("terminals-csv", None)):
        result = client.post(PREFIX + "/export", json={"document": doc, "format": format, "views": ["front", "internal"]})
        assert result.status_code == 200, result.text[:300]
        assert result.content
        if signature:
            assert result.content.lstrip().startswith(signature)
        assert result.headers["cache-control"] == "no-store"
        assert "attachment;" in result.headers["content-disposition"]
        assert result.headers["x-content-type-options"] == "nosniff"
    assert client.post(PREFIX + "/export", json={"document": doc, "format": "exe"}).status_code == 422
    assert client.get(PREFIX + "/documents").json() == []  # Export/preview is not an implicit save.
