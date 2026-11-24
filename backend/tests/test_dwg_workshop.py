from xml.etree import ElementTree as ET

import ezdxf
from ezdxf import units

from edeco_toolbox.dwg_workshop.engine import run_job
from edeco_toolbox.dwg_workshop.profile import Profile


def _paths(svg):
    return [p.attrib["d"] for p in ET.fromstring(svg).iter("{http://www.w3.org/2000/svg}path")]


def test_layer_profile_preserves_origin_and_original_drawing(tmp_path):
    doc = ezdxf.new("R2013", units=units.M)
    doc.layers.new("A_Wand")
    doc.layers.new("A_Moebel")
    wall = doc.modelspace().add_line((600212, 210010), (600220, 210010), dxfattribs={"layer": "A_Wand"})
    wall.rgb = (0, 180, 30)
    doc.modelspace().add_circle((600225, 210020), 1, dxfattribs={"layer": "A_Moebel"})
    source, output = tmp_path/"input.dxf", tmp_path/"copy.dxf"
    doc.saveas(source)
    source_bytes = source.read_bytes()
    profile = Profile(rules=[{"contains": "wand", "action": "grey", "lineweight_mm": .35},
                             {"contains": "*", "action": "hide"}])
    report = run_job("preview", source, profile, output)
    assert report["unit"] == "m"
    assert report["extent"] == {"width": 14, "height": 11}
    assert len(_paths(report["before_svg"])) == 2
    assert _paths(report["after_svg"]) == _paths(report["before_svg"])[:1]
    assert "#666c6f" in report["after_svg"]
    assert report["stats"]["grey_layers"] == 1

    run_job("export", source, profile, output)
    extracted = ezdxf.readfile(output)
    assert source.read_bytes() == source_bytes
    assert extracted.layers.get("A_Moebel").is_off()
    assert extracted.layers.get("A_Wand").dxf.lineweight == 35
    line = next(iter(extracted.modelspace().query("LINE")))
    assert line.rgb is None and line.dxf.color == 256
    assert tuple(line.dxf.start) == (600212, 210010, 0)


def test_sample_copy_removes_nested_masks_and_keeps_xref_pending(tmp_path):
    profile = Profile(remove_wipeouts=True, remove_text_backgrounds=True)
    result = run_job("preview", None, profile, tmp_path/"copy.dxf")
    assert result["stats"]["wipeouts_removed"] == result["stats"]["text_backgrounds_removed"] == 1
    assert result["unit"] == "mm"
    assert any("Fassade" in issue for issue in result["issues"])
    run_job("export", None, profile, tmp_path/"copy.dxf")
    copied = ezdxf.readfile(tmp_path/"copy.dxf")
    block = copied.blocks.get("Planvermerk")
    assert len(block.query("WIPEOUT")) == 0
    assert not next(iter(block.query("MTEXT"))).dxf.hasattr("bg_fill")
    assert copied.blocks.get("Fassade").block.is_xref


def test_workshop_api_requires_personal_beta_and_valid_dxf(tmp_path):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from edeco_toolbox.dwg_workshop.api import register
    from edeco_toolbox.presentation import DesignBetaBody, PresentationBody, PresentationStore

    app = FastAPI()
    admin = PresentationStore(tmp_path, identity=("aduerger", True))
    app.state.presentation = admin
    register(app)
    with TestClient(app) as client:
        endpoint = "/api/dwg-workshop/preview"
        export = "/api/dwg-workshop/export"
        for route in (endpoint, export):
            assert client.post(route).status_code == 403
        admin.save_design_beta(DesignBetaBody(enabled=True))
        app.state.presentation = PresentationStore(tmp_path, identity=("planer", True))
        for route in (endpoint, export):
            assert client.post(route).status_code == 403
        app.state.presentation = admin
        sample = client.post(endpoint)
        assert sample.status_code == 200, sample.text
        assert sample.json()["extent"]["width"] == 16000
        assert client.post(endpoint, files={"file": ("floor.dwg", b"DWG")}).status_code == 415
        assert client.post(endpoint, data={"profile": '{"rules":[{"contains":"A","action":"bad"}]}'}).status_code == 422
        assert client.post(endpoint, files={"file": ("floor.dxf", b"broken")}).status_code == 422
        download = client.post(export)
        assert download.status_code == 200 and "attachment" in download.headers["content-disposition"]
        local = tmp_path / "restored.dxf"
        local.write_bytes(download.content)
        assert ezdxf.readfile(local).modelspace().query("LINE")
        state = admin.snapshot()
        admin.save(PresentationBody(revision=state["revision"], admins=state["admins"],
                                    demo_tools=state["demo_tools"], demo_enabled=True))
        for route in (endpoint, export):
            assert client.post(route).status_code == 403
