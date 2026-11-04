"""Real catalogue and source images through the shared server, without a side process."""

import base64

from fastapi.testclient import TestClient

from edeco_toolbox.app import create_app
from test_phase3 import env  # noqa: F401

BASE = "/tools/bim2steiger"


def test_real_catalogue_and_negative_quantity_are_available_beside_nova(env):
    original, _ = env
    with TestClient(create_app(original.app.state.nova), base_url="http://127.0.0.1") as client:
        assert client.get("/api/status").status_code == 200
        meta = client.get(BASE + "/api/meta").json()
        assert meta["catalogue_articles"] == 11777
        assert any(a["number"] == "112001" for a in client.get(BASE + "/api/search?q=112001").json())
        detail = client.get(BASE + "/api/article?number=998123&va=048").json()
        assert detail["selected"]["va"] == "048"
        parts = client.get(BASE + "/api/expand?number=112002&va=00&quantity=2").json()
        assert next(p for p in parts if p["number"] == "2670")["quantity"] == -2
        assert client.get(BASE + "/images/112001.png").headers["content-type"] == "image/png"
        assert "bim2steiger-program.js" in client.get(BASE + "/bim2steiger.html").text
        assert client.get(BASE + "/api/source-status").json()["details_complete"]


def test_import_validation_aggregation_and_standalone_updates(env):
    original, _ = env
    with TestClient(create_app(original.app.state.nova), base_url="http://127.0.0.1") as client:
        assert client.get("/api/toolbox/session").status_code == 200
        valid = client.post(BASE + "/api/import", json={"filename": "test.csv", "text": "id;name;menge;einheit\na;Leuchte;1,5;Stk\n"})
        assert valid.status_code == 200
        assert valid.json()["elements"][0]["quantity"] == 1.5
        assert client.post(BASE + "/api/import", json={"filename": "test.ifc", "content_base64": "INVALID!"}).status_code == 400
        line = dict(number="112001", va="00", bkp="232.5", room="R1", unit="Stk", quantity=1)
        result = client.post(BASE + "/api/tender/aggregate", json={"lines": [line, line]}).json()
        assert len(result["lines"]) == 1 and result["lines"][0]["quantity"] == 2
        assert client.post(BASE + "/api/tender/elda", json={"lines": [], "project": "Test"}).status_code == 400
        data = client.post(BASE + "/api/tender/elda", json={"lines": [line], "project": "Test"})
        assert data.status_code == 200
        assert base64.b64decode(data.json()["content_base64"])
        assert client.get(BASE + "/api/updates").json()["managed_by_toolbox"]
        assert client.post(BASE + "/api/updates/install", json={}).status_code == 409
