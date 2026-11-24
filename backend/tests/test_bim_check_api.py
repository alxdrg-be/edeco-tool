"""Lokale Sitzung, Modellwechsel und Bericht über die tatsächlich registrierten Routen."""

from collections import Counter
from io import BytesIO
import os
from urllib.parse import quote

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import load_workbook
import pytest

from edeco_toolbox.bim_check.api import PREFIX, register
from edeco_toolbox.local_security import register as secure
from test_bim_check_ifc import write_example
from test_bim_check_nova import write_book


@pytest.fixture
def client():
    if url := os.environ.get("EDECO_TEST_TOOLBOX_URL"):
        connection = httpx.Client(base_url=url, timeout=90, trust_env=False)
    else:
        app = FastAPI()
        secure(app)
        register(app)
        connection = TestClient(app, base_url="http://localhost")
    with connection:
        connection.get("/api/toolbox/session").raise_for_status()
        yield connection


def _send(client, route, filename, data):
    return client.post(PREFIX + route, files={"file": (filename, data)})


def test_import_inspect_check_export_and_close(client, tmp_path):
    path = tmp_path / "Abnahme.ifc"
    write_example(path)
    upload = _send(client, "/models", path.name, path.read_bytes())
    upload.raise_for_status()
    model = upload.json()
    route = f"/models/{model['id']}"
    try:
        assert model["source"] == "IFC"
        assert model["summary"]["rooms"] == 2
        room = next(e for e in model["elements"] if e["name"] == "Technik")
        assert room["polygons"] and room["area_m2"] == 24
        assert "psets" not in room and "meshes" not in model
        scene = client.get(PREFIX + route + "/scene")
        scene.raise_for_status()
        mesh = next(mesh for mesh in scene.json()["meshes"] if mesh["id"] == room["id"])
        assert mesh["kind"] == "room" and mesh["storey"] == room["storey"]
        assert len(set(mesh["positions"][2::3])) > 1 and len(mesh["indices"]) >= 12
        assert scene.content == client.get(PREFIX + route + "/scene").content
        # The in-browser IFC viewer reads the unchanged working copy.
        ifc = client.get(PREFIX + route + "/model.ifc")
        assert ifc.status_code == 200 and ifc.content == path.read_bytes()
        detail_path = PREFIX + route + "/elements/" + quote(room["id"], safe="")
        detail = client.get(detail_path).json()
        assert detail["psets"]["Firma_Raum"]["Nutzung"] == "Technik"
        assert client.get(PREFIX + route + "/report.xlsx").status_code == 409

        download = client.get(PREFIX + "/template.xlsx")
        download.raise_for_status()
        checked = _send(client, route + "/guide", "Vorgaben.xlsx", download.content)
        checked.raise_for_status()
        counts = Counter(row["status"] for row in checked.json()["rows"])
        assert counts["Fehlt"] and counts["OK"]
        previous = client.get(PREFIX + route + "/report.xlsx")
        assert previous.status_code == 200 and ".xlsx" in previous.headers["content-disposition"]
        with BytesIO(previous.content) as raw:
            workbook = load_workbook(raw, read_only=True)
            try:
                assert len(list(workbook["Prüfergebnisse"].values)) == sum(counts.values()) + 1
            finally:
                workbook.close()
        assert _send(client, route + "/guide", "Kaputt.xlsx", b"unvollstaendig").status_code == 422
        assert client.get(PREFIX + route + "/report.xlsx").content == previous.content
        assert _send(client, "/models", "Kein-Modell.ifc", b"text").status_code == 422
        assert client.get(detail_path).json() == detail
    finally:
        assert client.delete(PREFIX + route).status_code == 204
    assert client.get(detail_path).status_code == 404
    assert client.get(PREFIX + route + "/scene").status_code == 404
    assert client.get(PREFIX + route + "/model.ifc").status_code == 404


@pytest.mark.parametrize(("filename", "content", "code"), [
    ("Plan.n4d", b"nova", 415), ("Leer.ifc", b"", 422), ("Liste.xlsx", b"kein Excel", 422),
])
def test_unsuitable_model_upload_gives_local_error(client, filename, content, code):
    response = _send(client, "/models", filename, content)
    assert response.status_code == code
    assert isinstance(response.json()["detail"], str)


def test_large_interactive_results_are_bounded_in_utf8_bytes(tmp_path, monkeypatch):
    from edeco_toolbox.bim_check import storage
    monkeypatch.setattr(storage, "MAX_OUTPUT_BYTES", 4)
    with storage.json_output(tmp_path / "teilErgebnis.json") as write:
        write("ä")
        write("é")
        with pytest.raises(ValueError, match="Teilmodell"):
            write("L")


def test_scene_retry_keeps_room_and_only_caches_completed_geometry(tmp_path, monkeypatch):
    from edeco_toolbox.bim_check import api

    original = api._run_worker
    attempts = []

    def interrupt_first_render(operation, model_path, job, model_id, filename):
        if operation == "scene":
            attempts.append(model_id)
            if len(attempts) == 1:
                (job / "scene.json").write_text("partial", encoding="utf-8")
                raise api.HTTPException(422, "Testunterbrechung im Geometrieprozess")
        return original(operation, model_path, job, model_id, filename)

    monkeypatch.setattr(api, "_run_worker", interrupt_first_render)
    app = FastAPI()
    register(app)
    with TestClient(app) as local:
        path = tmp_path / "test.ifc"
        write_example(path)
        model = _send(local, "/models", path.name, path.read_bytes()).json()
        base = PREFIX + "/models/" + model["id"]
        try:
            assert not attempts
            assert local.get(base + "/scene").status_code == 422
            room = next(e for e in model["elements"] if e["ifc_class"] == "IfcSpace")
            assert local.get(base + "/elements/" + quote(room["id"], safe="")).status_code == 200
            first = local.get(base + "/scene")
            assert first.status_code == 200 and first.json()["meshes"]
            assert local.get(base + "/scene").content == first.content
            assert len(attempts) == 2
        finally:
            local.delete(base)


def test_nova_room_list_has_no_spatial_scene(client, tmp_path):
    path = write_book(tmp_path, [["Index", "Klasse", "Raumnummer", "Geschoss"],
                                 ["1", "Leuchte", "E1", "EG"]])
    upload = _send(client, "/models", path.name, path.read_bytes())
    upload.raise_for_status()
    model = upload.json()
    base = PREFIX + "/models/" + model["id"]
    try:
        assert model["summary"]["rooms"] == 1
        missing = client.get(base + "/scene")
        assert missing.status_code == 422 and "IFC-Modell" in missing.json()["detail"]
    finally:
        client.delete(base)
