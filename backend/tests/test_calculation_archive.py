import json
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from edeco_toolbox.app import create_app
from edeco_toolbox.tools.calculation_archive.api import PREFIX
from edeco_toolbox.tools.calculation_archive.store import ArchiveStore
from test_documents import sample_pdf
from test_phase3 import env  # noqa: F401


def payload(revision, **changes):
    body = {"request_id": str(uuid.uuid4()), "config_revision": revision, "project": {"id": "pc-a", "number": "1498", "name": "Testprojekt"},
            "tool_id": "blitzschutz", "title": "Dachaufbau A", "author": "Testperson", "notes": "Mindestabstand prüfen", "source": "edeco",
            "document": {"schema": "edeco.lightning.v1", "input": {"protection": "I", "perimeter": "20", "length": "3", "conductors": "2", "clearance": "0.3"}, "result": {"metres": .24}}}
    return {**body, **changes}


def test_two_independent_pcs_share_immutable_records_and_append_notes_concurrently(tmp_path):
    share = tmp_path / "share"; share.mkdir()
    a = ArchiveStore(tmp_path / "pc-a"); b = ArchiveStore(tmp_path / "pc-b")
    config_a = a.configure(str(share), "Planung/Berechnungen", "0")
    config_b = b.configure(str(share), "Planung/Berechnungen", "0")
    body = payload(config_a["revision"])
    first = a.save(body)
    assert first["project"]["number"] == "1498"
    assert "/blitzschutz/P-1498--" in first["path"].replace("\\", "/")
    assert b.list()["items"][0]["key"] == first["key"]
    assert a.save(body)["key"] == first["key"] and len(a.list()["items"]) == 1
    with pytest.raises(FileExistsError):
        a.save({**body, "notes": "Änderung"})
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda index: b.add_note(first["key"], f"Notiz {index}", "Kollege", config_b["revision"]), range(6)))
    reread = a.read(first["key"])
    assert len(reread["comments"]) == 6
    assert reread["document"] == body["document"]
    assert reread["notes"] == body["notes"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda index: a.save(payload(config_a["revision"], title=f"Stand {index}")), range(8)))
    assert len(b.list()["items"]) == 9
    assert not list((share / "Planung/Berechnungen").glob(".pending-*"))


def test_archive_api_requires_session_and_supports_pdf_import_integrity(env, tmp_path):
    original, _ = env
    share = tmp_path / "server"; share.mkdir()
    with TestClient(create_app(original.app.state.nova), base_url="http://127.0.0.1") as client:
        state = client.get(PREFIX + "/state").json()
        headers = {"X-Edeco-Projects": state["session_key"]}
        assert client.get(PREFIX + "/records").status_code == 403
        assert client.get(PREFIX + "/state", headers={"Origin": "https://other.invalid"}).status_code == 403
        config = client.post(PREFIX + "/settings", headers=headers, json={"root": str(share), "subfolder": "Berechnungen", "revision": "0"})
        assert config.status_code == 200
        revision = config.json()["revision"]
        assert client.post(PREFIX + "/settings", headers=headers, json={"root": str(share), "subfolder": "other", "revision": "0"}).status_code == 409
        body = payload(revision)
        saved = client.post(PREFIX + "/records", headers=headers, json=body)
        assert saved.status_code == 200, saved.text
        key = saved.json()["key"]
        assert client.get(PREFIX + "/record", headers=headers, params={"key": key}).json()["document"] == body["document"]
        assert client.get(PREFIX + "/record", headers=headers, params={"key": "../escape"}).status_code == 400
        assert client.post(PREFIX + "/notes", headers=headers, json={"key": key, "text": "Kollege prüft", "author": "Kollege", "config_revision": revision}).status_code == 200
        imported = payload(revision, tool_id="premium-pkw", source="premium-export", document={})
        pdf = sample_pdf([["Premium test export"]])
        response = client.post(PREFIX + "/import", headers=headers, data={"metadata": json.dumps(imported)}, files={"file": ("Report.pdf", pdf, "application/pdf")})
        assert response.status_code == 200, response.text
        downloaded = client.get(PREFIX + "/attachment", headers=headers, params={"key": response.json()["key"]})
        assert downloaded.content == pdf
        assert downloaded.headers["content-type"] == "application/pdf"
        assert client.post(PREFIX + "/records", headers=headers, json=imported).status_code == 400
        json_import = {**imported, "request_id": str(uuid.uuid4())}
        result = client.post(PREFIX + "/import", headers=headers, data={"metadata": json.dumps(json_import)}, files={"file": ("Data.json", b'{"input":{"n":4}}', "application/json")})
        assert result.status_code == 200 and result.json()["document"] == {"input": {"n": 4}}
        assert len(client.get(PREFIX + "/records", headers=headers).json()["items"]) == 3
        changed = share / "Berechnungen" / key / "berechnung.json"
        changed.write_text('{}')
        assert client.get(PREFIX + "/record", headers=headers, params={"key": key}).status_code == 400


def test_invalid_paths_offline_share_and_long_project_numbers_do_not_escape_or_fallback(tmp_path):
    share = tmp_path / "share"; share.mkdir()
    store = ArchiveStore(tmp_path / "local")
    for folder in ["../outside", "/outside", "a/../b", "C:\\folder", "CON", "a//b"]:
        with pytest.raises(ValueError): store.configure(str(share), folder, "0")
    config = store.configure(str(share), "Berechnungen", "0")
    record = store.save(payload(config["revision"], project={"id": "", "number": "ä" * 80, "name": "Langes Projekt"}))
    assert len(record["key"].split("/")[1]) < 255
    with pytest.raises(ValueError): store.read("blitzschutz/../../escape")
    outside = tmp_path / "outside"; outside.mkdir()
    (share / "Berechnungen/kabelberechnung").symlink_to(outside, target_is_directory=True)
    with pytest.raises(ValueError): store.save(payload(config["revision"], tool_id="kabelberechnung"))
    assert list(outside.iterdir()) == []
    share.rename(tmp_path / "offline-share")
    with pytest.raises(OSError, match="erreichbar"):
        store.save(payload(config["revision"]))
    assert not (tmp_path / "local/Berechnungen").exists()


def test_import_size_and_name_checks_do_not_publish_partial_entries(env, tmp_path):
    original, _ = env
    share = tmp_path / "share"; share.mkdir()
    with TestClient(create_app(original.app.state.nova), base_url="http://127.0.0.1") as client:
        state = client.get(PREFIX + "/state").json(); headers = {"X-Edeco-Projects": state["session_key"]}
        config = client.post(PREFIX + "/settings", headers=headers, json={"root": str(share), "subfolder": "Berechnungen", "revision": "0"}).json()
        body = payload(config["revision"], tool_id="premium-pkw", source="premium-export")
        for name, content in [("script.html", b"<script>bad</script>"), ("bad.pdf", b"not pdf"), ("scalar.json", b"[]"), ("bad.json", b"bad")]:
            result = client.post(PREFIX + "/import", headers=headers, data={"metadata": json.dumps(body)}, files={"file": (name, content)})
            assert result.status_code == 400
        assert client.get(PREFIX + "/records", headers=headers).json()["items"] == []


def test_all_native_calculator_ids_can_save_and_reload_shared_records(env, tmp_path):
    original, _ = env
    share = tmp_path / "native-server"
    share.mkdir()
    with TestClient(create_app(original.app.state.nova), base_url="http://127.0.0.1") as client:
        state = client.get(PREFIX + "/state").json()
        assert len(state["tools"]) == 25
        headers = {"X-Edeco-Projects": state["session_key"]}
        config = client.post(PREFIX + "/settings", headers=headers, json={"root": str(share), "subfolder": "Berechnungen", "revision": state["settings"]["revision"]}).json()
        for tool_id in state["tools"]:
            document = {"schema": "edeco.workbench.v1", "calculatorId": tool_id, "input": {"test": "documented"}, "result": {"test": 42}}
            saved = client.post(PREFIX + "/records", headers=headers, json=payload(config["revision"], tool_id=tool_id, document=document))
            assert saved.status_code == 200, (tool_id, saved.text)
            loaded = client.get(PREFIX + "/record", headers=headers, params={"key": saved.json()["key"]})
            assert loaded.json()["document"] == document
        assert len(client.get(PREFIX + "/records", headers=headers).json()["items"]) == 25
