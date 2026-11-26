import io
from zipfile import ZipFile

import ezdxf
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from edeco_toolbox.dwg_workshop import batch
from edeco_toolbox.dwg_workshop.api import register
from edeco_toolbox.presentation import DesignBetaBody, PresentationStore


ENDPOINT = "/api/dwg-workshop/batch"


@pytest.fixture
def client(tmp_path):
    app = FastAPI()
    app.state.presentation = PresentationStore(tmp_path, identity=("aduerger", True))
    app.state.presentation.save_design_beta(DesignBetaBody(enabled=True))
    register(app)
    with TestClient(app) as client:
        yield client


def test_batch_handles_bad_plans_and_preserves_lage_in_both_copies(client, tmp_path):
    doc = ezdxf.new("R2013", units=ezdxf.units.M)
    doc.header["$INSBASE"] = (600200, 215010, 3)
    doc.layers.new("Möbel")
    doc.modelspace().add_line((600200, 215010, 3), (600205, 215010, 3), dxfattribs={"layer": "Möbel"})
    src = tmp_path / "geschoss.dxf"
    doc.saveas(src)
    data = src.read_bytes()
    response = client.post(ENDPOINT, files=[
        ("files", ("../EG.dxf", data)), ("files", ("Defekt.dxf", b"broken")),
        ("files", ("eg.DXF", data))], data={"profile": '{"audit_dxf":true,"rules":[{"contains":"Möbel","action":"hide"}]}'})
    assert response.status_code == 200
    assert (response.headers["X-DWG-Succeeded"], response.headers["X-DWG-Failed"]) == ("2", "1")
    with ZipFile(io.BytesIO(response.content)) as archive:
        outputs = ["Zeichnungen/EG.dxf", "Zeichnungen/eg (2).dxf"]
        assert archive.namelist() == [*outputs, "Stapelprotokoll.txt"]
        for index, entry in enumerate(outputs):
            copy = tmp_path / f"copy-{index}.dxf"
            copy.write_bytes(archive.read(entry))
            result = ezdxf.readfile(copy)
            assert result.units == ezdxf.units.M
            assert result.header["$INSBASE"] == (600200, 215010, 3)
            assert result.layers.get("Möbel").is_off()
            assert result.modelspace().query("LINE").first.dxf.start == (600200, 215010, 3)
        report = archive.read("Stapelprotokoll.txt").decode("utf-8-sig")
        assert "2 von 3" in report and "Defekt.dxf" in report and "Fehlgeschlagen" in report
        assert "DXF-Reparaturen" in report and "Layer ausgeblendet: 1" in report
        assert "($INSBASE, X/Y/Z): 600200.0, 215010.0, 3.0" in report


def test_all_failed_returns_report_and_rejects_beyond_limits(client, monkeypatch):
    file = ("files", ("plan.pdf", b"1234"))
    response = client.post(ENDPOINT, files=[file])
    assert response.headers["X-DWG-Succeeded"] == "0"
    with ZipFile(io.BytesIO(response.content)) as archive:
        assert archive.namelist() == ["Stapelprotokoll.txt"]
    assert client.post(ENDPOINT, files=[file] * 25).status_code == 413
    monkeypatch.setattr(batch, "MAX_INPUT", 7)
    assert client.post(ENDPOINT, files=[file, file]).status_code == 413
    client.app.state.presentation.save_design_beta(DesignBetaBody(enabled=False))
    assert client.post(ENDPOINT, files=[file]).status_code == 403
