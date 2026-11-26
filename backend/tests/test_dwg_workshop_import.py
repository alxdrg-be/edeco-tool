from pathlib import Path
import subprocess
from types import SimpleNamespace

import ezdxf
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from edeco_toolbox.dwg_workshop import api
from edeco_toolbox.presentation import DesignBetaBody, PresentationStore
from nova_legend import config


@pytest.fixture
def workshop(tmp_path):
    app = FastAPI()
    store = PresentationStore(tmp_path, identity=("aduerger", True))
    app.state.presentation = store
    app.state.nova = SimpleNamespace(settings=config.Settings(oda_path="configured-locally"))
    api.register(app)
    with TestClient(app) as client:
        yield client, store


def test_converter_capability_uses_local_settings_and_requires_beta(workshop, monkeypatch):
    client, store = workshop
    url = "/api/dwg-workshop/capabilities"
    assert client.get(url).status_code == 403
    store.save_design_beta(DesignBetaBody(enabled=True))
    monkeypatch.setattr(config, "resolve_oda_converter", lambda path: "converter" if path == "configured-locally" else "")
    assert client.get(url).json() == {"dwg_available": True}
    monkeypatch.setattr(config, "resolve_oda_converter", lambda _path: "")
    assert client.get(url).json() == {"dwg_available": False}
    response = client.post("/api/dwg-workshop/export", files={"file": ("OG01.DWG", b"AC1027test")})
    assert response.status_code == 503 and "ODA File Converter" in response.json()["detail"]


def test_dwg_preview_and_export_use_converted_source_and_keep_coordinates(workshop, monkeypatch, tmp_path):
    client, store = workshop
    store.save_design_beta(DesignBetaBody(enabled=True))
    monkeypatch.setattr(config, "resolve_oda_converter", lambda _path: "local-converter")
    source_dirs = []

    def convert(source, exe, output_dir, *, version, timeout):
        assert exe == "local-converter" and timeout == 45
        assert source.name == "source.dwg" and source.read_bytes() == b"AC1032test"
        assert version == "ACAD2018"
        source_dirs.append(source.parent)
        doc = ezdxf.new("R2013", units=ezdxf.units.M)
        doc.modelspace().add_line((615123, 267456), (615133, 267461))
        target = output_dir / "source.dxf"
        doc.saveas(target)
        return target

    monkeypatch.setattr(api, "convert_dwg_to_dxf", convert)
    upload = {"file": (r"C:\Pläne\OG01.DWG", b"AC1032test", "application/octet-stream")}
    preview = client.post("/api/dwg-workshop/preview", files=upload)
    assert preview.status_code == 200, preview.text
    assert preview.json()["extent"] == {"width": 10, "height": 5}
    download = client.post("/api/dwg-workshop/export", files=upload)
    assert download.status_code == 200 and "attachment" in download.headers["content-disposition"]
    local = tmp_path / "drawing.dxf"
    local.write_bytes(download.content)
    line = ezdxf.readfile(local).modelspace().query("LINE").first
    assert tuple(line.dxf.start) == (615123, 267456, 0)
    assert len(set(source_dirs)) == 2 and not any(path.exists() for path in source_dirs)


def test_rejects_oversize_invalid_or_timed_out_upload(workshop, monkeypatch):
    client, store = workshop
    store.save_design_beta(DesignBetaBody(enabled=True))
    monkeypatch.setattr(config, "resolve_oda_converter", lambda _path: "local-converter")
    monkeypatch.setattr(api, "MAX_UPLOAD", 12)
    calls = []

    def timeout_converter(source, *_args, **_kwargs):
        calls.append(source)
        raise subprocess.TimeoutExpired("ODA", 45)

    monkeypatch.setattr(api, "convert_dwg_to_dxf", timeout_converter)
    for content, code in ((b"AC1027" + bytes(10), 413), (b"not a DWG", 415), (b"AC1027test", 422)):
        response = client.post("/api/dwg-workshop/preview", files={"file": ("floor.dwg", content)})
        assert response.status_code == code
    assert "45 Sekunden" in response.json()["detail"]
    assert len(calls) == 1 and not calls[0].exists()


@pytest.mark.parametrize(("returncode", "generated", "detail"), [
    (5, b"partial DXF", "Code 5"),
    (0, b"", "keine lesbare DXF-Datei"),
    (0, None, "keine lesbare DXF-Datei"),
])
def test_failed_or_empty_conversion_cannot_feed_dxf_worker(workshop, monkeypatch, returncode, generated, detail):
    from nova_legend.importer import dwg

    client, store = workshop
    store.save_design_beta(DesignBetaBody(enabled=True))
    monkeypatch.setattr(config, "resolve_oda_converter", lambda _path: "local-converter")
    monkeypatch.setattr(config, "validate_oda_converter", lambda path: path)

    def fake_oda(command, **_kwargs):
        assert command[3:] == ["ACAD2013", "DXF", "0", "1", "source.dwg"]
        if generated is not None:
            (Path(command[2]) / "source.dxf").write_bytes(generated)
        return SimpleNamespace(returncode=returncode)

    monkeypatch.setattr(dwg.subprocess, "run", fake_oda)
    monkeypatch.setattr(api, "_worker", lambda *_args: pytest.fail("Beschädigte Konverterausgabe angenommen"))
    response = client.post("/api/dwg-workshop/export", files={"file": ("Plan.dwg", b"AC1027test")})
    assert response.status_code == 422 and detail in response.json()["detail"]


def test_real_oda_dwg_upload_when_converter_is_installed(workshop, tmp_path):
    from nova_legend.legend.export import dxf_to_dwg

    converter = config.find_oda_converter()
    if not converter:
        pytest.skip("Benötigt den ODA File Converter im lokalen Windows-Installationsordner")
    client, store = workshop
    store.save_design_beta(DesignBetaBody(enabled=True))
    doc = ezdxf.new("R2013")
    doc.modelspace().add_line((50100, 20200), (50105, 20210))
    source = tmp_path / "Grundriss.dxf"
    doc.saveas(source)
    output = tmp_path / "dwg"
    output.mkdir()
    dwg = dxf_to_dwg(source, converter, output)
    preview = client.post("/api/dwg-workshop/preview", files={"file": (dwg.name, dwg.read_bytes())})
    assert preview.status_code == 200, preview.text
    assert preview.json()["extent"] == {"width": 5, "height": 10}
