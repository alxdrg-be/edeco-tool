import ezdxf
from ezdxf import units

from edeco_toolbox.dwg_workshop import engine
from edeco_toolbox.dwg_workshop.profile import Profile


def test_opt_in_audit_repairs_a_copy_and_reports_an_unresolved_cycle(tmp_path):
    source = tmp_path / "Geschoss.dxf"
    doc = ezdxf.new("R2013", units=units.M)
    wall = doc.modelspace().add_line((600012, 210007), (600019, 210007),
                                     dxfattribs={"linetype": "FEHLENDER_STRICH"})
    doc.modelspace().add_line(wall.dxf.start, wall.dxf.end)
    doc.blocks.new("Kreisbezug").add_blockref("Kreisbezug", (0, 0))
    doc.saveas(source)
    source_bytes = source.read_bytes()
    output = tmp_path / "Arbeitskopie.dxf"

    unchanged = engine.run_job("export", source, Profile(), output)
    assert "audit_fixes" not in unchanged["stats"]
    assert ezdxf.readfile(output).entitydb[wall.dxf.handle].dxf.linetype == "FEHLENDER_STRICH"

    profile = Profile(audit_dxf=True)
    preview = engine.run_job("preview", source, profile, output)
    report = engine.run_job("export", source, profile, output)
    assert report["stats"] == preview["stats"]
    assert report["stats"]["audit_fixes"] == 1
    assert report["stats"]["audit_errors"] == 1
    assert any("fehlender_strich" in msg.lower() for msg in report["issues"])
    assert any("Kreisbezug" in msg and "offen" in msg for msg in report["issues"])
    assert report["unit"] == "m"
    assert source.read_bytes() == source_bytes
    restored = ezdxf.readfile(output)
    repaired_line = restored.entitydb[wall.dxf.handle]
    assert repaired_line.dxf.linetype == "BYLAYER"
    assert repaired_line.dxf.start == wall.dxf.start
    assert len(restored.modelspace().query("LINE")) == 2


def test_export_without_preview_keeps_paper_only_drawing_and_reports_unresolved_xref(tmp_path, monkeypatch):
    doc = ezdxf.new("R2013")
    doc.header["$INSUNITS"] = 0
    doc.add_xref_def(filename="Fassade.dwg", name="Fassade")
    doc.paperspace().add_line((0, 0), (12, 34))
    source, output = tmp_path / "Blatt.dxf", tmp_path / "Kopie.dxf"
    doc.saveas(source)

    def forbidden_preview(_):
        raise AssertionError("Export darf keine Vorschau voraussetzen")

    monkeypatch.setattr(engine, "_record", forbidden_preview)
    report = engine.run_job("export", source, Profile(audit_dxf=True), output)
    assert report["stats"]["audit_errors"] == 0
    assert any("keine Längeneinheit" in msg for msg in report["issues"])
    assert any("externe Referenz" in msg and "Fassade" in msg for msg in report["issues"])
    restored = ezdxf.readfile(output)
    assert len(restored.modelspace()) == 0
    assert restored.paperspace().query("LINE")[0].dxf.end == (12, 34, 0)
