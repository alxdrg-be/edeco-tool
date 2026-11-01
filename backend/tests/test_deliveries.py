import hashlib
import io
import json
import uuid
import zipfile

from fastapi.testclient import TestClient

from edeco_toolbox.app import create_app
from edeco_toolbox.tools.projects.store import ProjectStore
from test_documents import sample_pdf
from test_phase3 import env  # noqa: F401


def test_delivery_contains_unchanged_pdfs_lists_and_a_persistent_idempotent_audit(env):
    original, tmp = env
    app = create_app(original.app.state.nova)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        state = client.get("/api/tools/projektzentrale/state").json()
        headers = {"X-Edeco-Projects": state["session_key"]}
        project = client.post("/api/tools/projektzentrale/projects", headers=headers, json={"number": "1498", "name": "Test"}).json()
        name = "1498_E-G-APP-OG02-C-50.pdf"
        manifest = dict(request_id=str(uuid.uuid4()), project_id=project["id"], project_version=project["version"], recipient="=HYPERLINK(1)",
                        delivery_date="2026-11-01", title="Lieferung <Test>", notes="<script>test</script>",
                        plans=[dict(filename=name, floor="OG02", plan_type="APP", index="C", scale="50")])
        pdf = sample_pdf([["2. OG"]])

        def prepare(body=manifest, data=pdf, auth=headers):
            return client.post("/api/tools/planlieferung/prepare", headers=auth, data={"manifest": json.dumps(body)}, files=[("files", ("original.pdf", data))])

        assert prepare(auth={}).status_code == 403
        result = prepare()
        assert result.status_code == 200
        with zipfile.ZipFile(io.BytesIO(result.content)) as archive:
            assert archive.read(name) == pdf
            assert archive.namelist() == [name, "Planliste.csv", "Planliste.html", "Planliste.json"]
            proof = json.loads(archive.read("Planliste.json"))
            assert proof["plans"][0]["sha256"] == hashlib.sha256(pdf).hexdigest()
            assert "'=HYPERLINK(1)" in archive.read("Planliste.csv").decode("utf-8-sig")
            assert "<script>test" not in archive.read("Planliste.html").decode()
        assert prepare().status_code == 200
        store = ProjectStore(app.state.project_hub.path.parent)
        records = store.snapshot()["deliveries"]
        assert len(records) == 1 and records[0]["sent_at"] is None
        assert prepare({**manifest, "recipient": "Other"}).status_code == 409
        delivery_id = records[0]["id"]
        assert client.post(f"/api/tools/planlieferung/{delivery_id}/sent").status_code == 403
        assert client.post(f"/api/tools/planlieferung/{delivery_id}/sent", headers=headers).status_code == 200
        sent_at = store.snapshot()["deliveries"][0]["sent_at"]
        assert sent_at
        client.post(f"/api/tools/planlieferung/{delivery_id}/sent", headers=headers)
        assert store.snapshot()["deliveries"][0]["sent_at"] == sent_at
        assert prepare({**manifest, "request_id": str(uuid.uuid4())}, data=b"not pdf").status_code == 400
        assert len(store.snapshot()["deliveries"]) == 1
        changed = client.put(f"/api/tools/projektzentrale/projects/{project['id']}", headers=headers, json={**project, "name": "Changed"}).json()
        assert changed["version"] == 2
        assert prepare({**manifest, "request_id": str(uuid.uuid4())}).status_code == 409
        assert len(store.snapshot()["deliveries"]) == 1
