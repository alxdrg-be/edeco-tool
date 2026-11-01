import io
import json
import zipfile

import pytest
from fastapi.testclient import TestClient

from edeco_toolbox.app import create_app
from edeco_toolbox.tools.file_rename.api import PREFIX, floors, inspect_pdf
from test_documents import sample_pdf
from test_phase3 import env  # noqa: F401


@pytest.mark.parametrize("text,expected", [
    ("1498_E-G-APP-OG02-C-50.pdf", ["OG02"]),
    ("Plan 2og.pdf", ["OG02"]), ("2. Obergeschoss", ["OG02"]),
    ("Obergeschoss 2", ["OG02"]), ("EG Erdgeschoss EG00", ["EG00"]),
    ("1. Untergeschoss / UG01", ["UG01"]), ("Boden 250 und BOG02", []),
    ("EG / 2. OG", ["EG00", "OG02"]),
])
def test_floor_notation_is_normalized_without_substring_guesses(text, expected):
    assert floors(text) == expected


def test_pdf_floor_conflict_is_never_silently_resolved():
    detected = inspect_pdf("Grundriss 2og.pdf", sample_pdf([["Erdgeschoss"]]))
    assert detected["floor"] == ""
    assert detected["candidates"] == ["EG00", "OG02"]
    assert "Mehrere" in detected["note"]
    assert inspect_pdf("Plan.pdf", sample_pdf([["2. Obergeschoss"]]))["floor"] == "OG02"
    assert inspect_pdf("Scan.pdf", sample_pdf([[""]]))["floor"] == ""


def test_api_protects_files_and_export_preserves_bytes_and_rejects_conflicts(env):
    original, _ = env
    with TestClient(create_app(original.app.state.nova), base_url="http://127.0.0.1") as client:
        state = client.get(PREFIX + "/state").json()
        headers = {"X-Edeco-Rename": state["session_key"]}
        pdf = sample_pdf([["2. OG"]])
        upload = {"file": ("Plan.pdf", pdf, "application/pdf")}
        assert client.post(PREFIX + "/inspect", files=upload).status_code == 403
        assert client.post(PREFIX + "/inspect", files=upload, headers={**headers, "Origin": "https://other.example"}).status_code == 403
        assert client.post(PREFIX + "/inspect", files=upload, headers=headers).json()["floor"] == "OG02"
        name = "1498_E-G-APP-OG02-C-50.pdf"
        result = client.post(PREFIX + "/export", headers=headers, files=[("files", ("Plan.pdf", pdf))], data={"names": json.dumps([name])})
        assert result.status_code == 200
        with zipfile.ZipFile(io.BytesIO(result.content)) as archive:
            assert archive.namelist() == [name]
            assert archive.read(name) == pdf
        for names in [["../escape.pdf"], ["CON.pdf"], ["no.txt"], [""], ["one.pdf", "ONE.pdf"]]:
            files = [("files", ("Plan.pdf", pdf)) for _ in names]
            response = client.post(PREFIX + "/export", headers=headers, files=files, data={"names": json.dumps(names)})
            assert response.status_code == 400
