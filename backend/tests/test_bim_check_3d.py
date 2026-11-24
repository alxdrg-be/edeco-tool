"""Scene coordinates, cut-outs, room identity and graceful partial 3D coverage."""

import json

import ifcopenshell
import numpy as np
import pytest

from edeco_toolbox.bim_check import scene
from edeco_toolbox.bim_check.ifc import parse_ifc
from test_bim_check_ifc import write_example


def read_scene(path):
    target = path.with_suffix(".scene.json")
    scene.write_scene(path, target)
    return json.loads(target.read_text(encoding="utf-8"))


def add_structure(path):
    write_example(path)
    model = ifcopenshell.open(path)
    room = next(r for r in model.by_type("IfcSpace") if r.Name == "E.01")
    wall = model.by_type("IfcWall")[0]
    # Same mesh at another storey elevation; same GlobalId to exercise the
    # fallback that must lead from a 3D selection to the exact inspector object.
    wall.GlobalId = room.GlobalId
    wall.Representation = room.Representation
    placement = model.createIfcAxis2Placement3D(model.createIfcCartesianPoint((2600000000., 1200000000., 4200.)))
    wall.ObjectPlacement = model.createIfcLocalPlacement(None, placement)
    # Product with a perfectly valid shape that is outside the structural context.
    outlet = model.by_type("IfcBuildingElementProxy")[0]
    outlet.Representation = room.Representation
    outlet.ObjectPlacement = room.ObjectPlacement
    model.write(str(path))


def vertices_and_faces(mesh):
    vertices = np.array(mesh["positions"]).reshape(-1, 3)
    faces = np.array(mesh["indices"]).reshape(-1, 3)
    assert 0 <= faces.min() <= faces.max() < len(vertices)
    return vertices, faces


def test_mesh_uses_true_si_height_courtyard_placements_and_inspector_ids(tmp_path):
    path = tmp_path / "Baukörper.ifc"
    add_structure(path)
    original = {e.id: e for e in parse_ifc(path).elements}
    result = read_scene(path)
    assert result["schema_version"] == 1
    room, wall = result["meshes"]
    assert room["kind"] == "room" and wall["kind"] == "structure"
    assert room["id"].startswith("#") and wall["id"].startswith("#") and room["id"] != wall["id"]
    assert original[room["id"]].name == "Technik" and original[wall["id"]].name == "Trennwand"
    assert room["storey"] == wall["storey"] == "EG"
    verts, faces = vertices_and_faces(room)
    assert verts.min(axis=0) == pytest.approx((10, 20, 0))
    assert verts.max(axis=0) == pytest.approx((18, 24, 3))
    a, b, c = (verts - verts[0])[faces].transpose((1, 0, 2))
    # Real courtyard removes 8 m² from the 32 m² outer footprint.
    assert abs(np.einsum("ij,ij->", a, np.cross(b, c))) / 6 == pytest.approx(72)
    wall_verts, _ = vertices_and_faces(wall)
    assert wall_verts.min(axis=0) == pytest.approx((2600000., 1200000., 4.2), abs=1.e-7, rel=0)
    assert wall_verts.max(axis=0) == pytest.approx((2600008., 1200004., 7.2), abs=1.e-7, rel=0)
    assert any("Räume ohne darstellbaren 3D-Körper: 1" in w for w in result["warnings"])


@pytest.mark.parametrize("schema", ["IFC2X3", "IFC4"])
def test_space_with_2d_footprint_and_volume_has_no_invented_extrusion(tmp_path, schema):
    path = tmp_path / "Grundriss.ifc"
    write_example(path, schema=schema)
    model = ifcopenshell.open(path)
    room = next(r for r in model.by_type("IfcSpace") if r.Name == "E.01")
    rep = room.Representation.Representations[0]
    profile = rep.Items[0].SweptArea
    rep.RepresentationIdentifier = "FootPrint"
    rep.RepresentationType = "Curve2D"
    rep.Items = [profile.OuterCurve, *profile.InnerCurves]
    model.write(str(path))
    room_data = next(e for e in parse_ifc(path).elements if e.number == "E.01")
    assert room_data.polygons and room_data.volume_m3 == pytest.approx(72)
    result = read_scene(path)
    assert result["meshes"] == []
    assert any("Räume ohne darstellbaren 3D-Körper: 2" in w for w in result["warnings"])


def test_a_slanted_plan_is_not_a_volume():
    assert not scene._spans_three_dimensions(np.array([[10, 20, 30], [10, 24, 34], [16, 20, 36], [16, 24, 40.]]))
    assert scene._spans_three_dimensions(np.array([[10, 20, 30], [10, 24, 34], [16, 20, 36], [16, 24, 40.03]]))


def test_missing_length_unit_preserves_checks_without_guessing_scene_scale(tmp_path):
    path = tmp_path / "Nur-Attribute.ifc"
    write_example(path)
    model = ifcopenshell.open(path)
    units = model.by_type("IfcProject")[0].UnitsInContext
    units.Units = [unit for unit in units.Units if unit.UnitType != "LENGTHUNIT"]
    model.write(str(path))
    assert len(parse_ifc(path).elements) > 0
    result = read_scene(path)
    assert result["meshes"] == []
    assert any("Längeneinheit" in message for message in result["warnings"])


def test_room_is_kept_before_structural_mesh_when_budget_is_reached(tmp_path, monkeypatch):
    path = tmp_path / "Teilansicht.ifc"
    add_structure(path)
    meshes = read_scene(path)["meshes"]
    monkeypatch.setattr(scene, "MAX_TRIANGLES", len(meshes[0]["indices"]) // 3)
    limited = read_scene(path)
    assert limited["meshes"] == [meshes[0]]
    assert any("Darstellungsgrenze" in w for w in limited["warnings"])


def test_scene_reads_sub_contexts_without_the_express_parser(tmp_path, monkeypatch):
    # The Windows EXE ships no ifcopenshell.express. Derived attributes such as
    # CoordinateSpaceDimension on a sub-context would need it (build 70 and 72).
    import sys
    path = tmp_path / "Unterkontext.ifc"
    write_example(path)
    monkeypatch.setitem(sys.modules, "ifcopenshell.express", None)
    scene.write_scene(path, tmp_path / "scene.json")
    meshes = json.loads((tmp_path / "scene.json").read_text(encoding="utf-8"))["meshes"]
    assert any(mesh["kind"] == "room" for mesh in meshes)
