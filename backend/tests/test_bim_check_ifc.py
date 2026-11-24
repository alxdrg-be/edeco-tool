"""Synthetic IFC with measured room quantities, an explicit boundary and a real courtyard."""

import json
from dataclasses import asdict

import ifcopenshell
import pytest
from shapely.geometry import Polygon

from edeco_toolbox.bim_check.ifc import parse_ifc


def write_example(path, schema="IFC4"):
    f = ifcopenshell.file(schema=schema)

    def root(kind, **fields):
        return f.create_entity(kind, GlobalId=ifcopenshell.guid.new(), **fields)

    def axes(x, y, z):
        return f.createIfcAxis2Placement3D(f.createIfcCartesianPoint((x, y, z)))

    def ring(points):
        return f.createIfcPolyline([f.createIfcCartesianPoint(point) for point in [*points, points[0]]])

    def prop(name, value):
        return f.createIfcPropertySingleValue(Name=name, NominalValue=value)

    def props(target, name, members):
        pset = root("IfcPropertySet", Name=name, HasProperties=members)
        root("IfcRelDefinesByProperties", RelatedObjects=[target], RelatingPropertyDefinition=pset)

    origin = axes(0., 0., 0.)
    context = f.createIfcGeometricRepresentationContext(None, "Model", 3, 0.00001, origin)
    # Body subcontexts inherit their dimension from the parent via the EXPRESS schema.
    body_context = f.create_entity("IfcGeometricRepresentationSubContext", ContextIdentifier="Body",
                                   ContextType="Model", ParentContext=context, TargetView="MODEL_VIEW")
    dimensions = f.createIfcUnitAssignment([
        f.createIfcSIUnit(UnitType="LENGTHUNIT", Prefix="MILLI", Name="METRE"),
        f.createIfcSIUnit(UnitType="AREAUNIT", Name="SQUARE_METRE"),
        f.createIfcSIUnit(UnitType="VOLUMEUNIT", Name="CUBIC_METRE"),
    ])
    project = root("IfcProject", Name="Test", RepresentationContexts=[context], UnitsInContext=dimensions)
    building = root("IfcBuilding", Name="Haus A")
    floor = root("IfcBuildingStorey", Name="EG")
    upstairs = root("IfcBuildingStorey", Name="1. OG")
    other = root("IfcSpace", Name="1.02", LongName="Sitzung")
    pos = f.createIfcLocalPlacement(None, axes(10000., 20000., 0.))
    outside = ring([(0., 0.), (8000., 0.), (8000., 4000.), (0., 4000.)])
    inside = ring([(2000., 1000.), (2000., 3000.), (6000., 3000.), (6000., 1000.)])
    profile = f.createIfcArbitraryProfileDefWithVoids("AREA", None, outside, [inside])
    solid = f.createIfcExtrudedAreaSolid(profile, origin, f.createIfcDirection((0., 0., 1.)), 3000.)
    rep = f.createIfcShapeRepresentation(body_context, "Body", "SweptSolid", [solid])
    space = root("IfcSpace", Name="E.01", LongName="Technik", ObjectPlacement=pos,
                 Representation=f.createIfcProductDefinitionShape(None, None, [rep]))
    for parent, children in [(project, [building]), (building, [floor, upstairs]), (floor, [space]), (upstairs, [other])]:
        root("IfcRelAggregates", RelatingObject=parent, RelatedObjects=children)
    wall = root("IfcWall", Name="Trennwand")
    root("IfcRelContainedInSpatialStructure", RelatedElements=[wall], RelatingStructure=floor)
    for room in (space, other):
        root("IfcRelSpaceBoundary", RelatingSpace=room, RelatedBuildingElement=wall,
             PhysicalOrVirtualBoundary="PHYSICAL", InternalOrExternalBoundary="INTERNAL")

    outlet = root("IfcBuildingElementProxy", Name="Dose")
    root("IfcRelContainedInSpatialStructure", RelatedElements=[outlet], RelatingStructure=space)
    props(space, "Pset_SpaceCommon", [prop("IsExternal", f.createIfcBoolean(False))])
    props(space, "Firma_Raum", [prop("Nutzung", f.createIfcLabel("Technik")), prop("Leer", None)])
    switch_type = root("IfcBuildingElementProxyType", Name="Steckdosentyp",
                       HasPropertySets=[root("IfcPropertySet", Name="Firma_Geraet", HasProperties=[
                           prop("Polzahl", f.createIfcInteger(3)), prop("Index", f.createIfcLabel("A"))])])
    root("IfcRelDefinesByType", RelatedObjects=[outlet], RelatingType=switch_type)
    props(outlet, "Firma_Geraet", [prop("Index", f.createIfcLabel("B"))])

    # Make the local area unit square millimetres to exercise squared SI prefixes.
    area = f.createIfcQuantityArea(Name="NetFloorArea", AreaValue=24_000_000.,
                                  Unit=f.createIfcSIUnit(UnitType="AREAUNIT", Prefix="MILLI", Name="SQUARE_METRE"))
    volume = f.createIfcQuantityVolume(Name="NetVolume", VolumeValue=72.)
    gross = f.createIfcQuantityArea(Name="GrossFloorArea", AreaValue=32.)
    qto = root("IfcElementQuantity", Name="BaseQuantities" if schema == "IFC2X3" else "Qto_SpaceBaseQuantities",
               Quantities=[gross, area, volume])
    root("IfcRelDefinesByProperties", RelatedObjects=[space], RelatingPropertyDefinition=qto)
    f.write(str(path))


@pytest.mark.parametrize("schema", ["IFC2X3", "IFC4"])
def test_aggregate_rooms_properties_relationships_and_world_footprints(tmp_path, schema):
    path = tmp_path / "Räume.ifc"
    write_example(path, schema)
    model = parse_ifc(path)
    json.dumps(asdict(model), allow_nan=False)
    rooms = [p for p in model.elements if p.ifc_class == "IfcSpace"]
    assert len(rooms) == 2
    first, second = sorted(rooms, key=lambda p: p.name, reverse=True)
    assert (first.number, first.name, first.storey) == ("E.01", "Technik", "EG")
    assert (second.number, second.name, second.storey) == ("1.02", "Sitzung", "1. OG")
    assert first.area_m2 == pytest.approx(24)
    assert first.volume_m3 == 72
    assert second.area_m2 is None and second.volume_m3 is None and second.polygons == []
    assert len(first.polygons) == 1
    outer, hole = first.polygons[0]
    poly = Polygon(outer, [hole])
    assert poly.is_valid and poly.area == pytest.approx(24)
    assert poly.bounds == pytest.approx((10, 20, 18, 24))
    assert first.psets["Pset_SpaceCommon"]["IsExternal"] is False
    assert first.psets["Firma_Raum"] == {"Nutzung": "Technik", "Leer": None}
    assert first.attributes["LongName"] == "Technik"
    wall = next(p for p in model.elements if p.name == "Trennwand")
    assert set(wall.room_ids) == {r.id for r in rooms} and wall.storey == "EG"
    outlet = next(p for p in model.elements if p.name == "Dose")
    assert outlet.room_ids == [first.id] and outlet.storey == "EG"
    assert outlet.psets["Firma_Geraet"] == {"Polzahl": 3, "Index": "B"}
    assert "IfcElement" in outlet.classes
    assert model.source == "Räume.ifc" and any("ohne darstellbare Kontur" in w for w in model.warnings)


def test_incomplete_file_with_duplicate_guids_and_no_units_is_still_inspectable(tmp_path):
    path = tmp_path / "Teilmodell.ifc"
    f = ifcopenshell.file(schema="IFC4")
    guid = ifcopenshell.guid.new()
    a = f.createIfcSpace(GlobalId=guid, Name="A")
    f.createIfcSpace(GlobalId=guid, Name="B")
    quantity = f.createIfcQuantityArea(Name="NetFloorArea", AreaValue=12345.)
    qto = f.createIfcElementQuantity(GlobalId=ifcopenshell.guid.new(), Name="Qto_SpaceBaseQuantities", Quantities=[quantity])
    f.createIfcRelDefinesByProperties(GlobalId=ifcopenshell.guid.new(), RelatedObjects=[a], RelatingPropertyDefinition=qto)
    f.write(str(path))
    result = parse_ifc(path)
    assert len(result.elements) == len({p.id for p in result.elements}) == 2
    assert result.elements[0].area_m2 is None
    assert result.elements[0].psets["Qto_SpaceBaseQuantities"]["NetFloorArea"] == 12345.
    assert any("GlobalId" in w for w in result.warnings)


def test_non_ifc_and_empty_model_produce_actionable_errors(tmp_path):
    path = tmp_path / "falsch.ifc"
    path.write_bytes(b"kein STEP")
    with pytest.raises(ValueError, match="STEP"):
        parse_ifc(path)
    ifcopenshell.file().write(str(path))
    with pytest.raises(ValueError, match="keine lesbaren"):
        parse_ifc(path)


def test_2d_curve_only_footprint_and_missing_end_marker(tmp_path):
    path = tmp_path / "Grundriss.ifc"
    write_example(path)
    f = ifcopenshell.open(path)
    room = next(r for r in f.by_type("IfcSpace") if r.Name == "E.01")
    rep = room.Representation.Representations[0]
    profile = rep.Items[0].SweptArea
    rep.RepresentationIdentifier = "FootPrint"
    rep.RepresentationType = "Curve2D"
    rep.Items = [profile.OuterCurve, *profile.InnerCurves]
    f.write(str(path))
    result = parse_ifc(path)
    first = next(r for r in result.elements if r.number == "E.01")
    outer, hole = first.polygons[0]
    assert Polygon(outer, [hole]).area == pytest.approx(24)
    assert Polygon(outer).bounds == pytest.approx((10, 20, 18, 24))
    path.write_bytes(path.read_bytes().replace(b"END-ISO-10303-21;", b""))
    # Some parser releases reject truncation and some return a usable partial model.
    try:
        result = parse_ifc(path)
    except ValueError as exc:
        assert "STEP" in str(exc)
    else:
        assert any("unvollständig" in w for w in result.warnings)


def test_ifc4_multiple_property_sets_per_relation_preserve_prior_sets(tmp_path):
    path = tmp_path / "Definitionsmenge.ifc"
    write_example(path)
    f = ifcopenshell.open(path)
    room = next(r for r in f.by_type("IfcSpace") if r.Name == "E.01")
    extra = []
    for name in ["Campus", "Brandschutz"]:
        prop = f.createIfcPropertySingleValue(Name="id", NominalValue=f.createIfcLabel(name))
        extra.append(f.createIfcPropertySet(GlobalId=ifcopenshell.guid.new(), Name=name, HasProperties=[prop]))
    f.createIfcRelDefinesByProperties(GlobalId=ifcopenshell.guid.new(), RelatedObjects=[room],
        RelatingPropertyDefinition=f.create_entity("IfcPropertySetDefinitionSet", tuple(extra)))
    f.write(str(path))
    psets = next(item.psets for item in parse_ifc(path).elements if item.number == "E.01")
    assert psets["Campus"]["id"] == "Campus"
    assert psets["Brandschutz"]["id"] == "Brandschutz"
    assert psets["Firma_Raum"]["Nutzung"] == "Technik"


@pytest.mark.parametrize("mode", ["fehlt", "falsche Dimension"])
def test_no_guess_of_world_scale_for_missing_or_invalid_length_unit(tmp_path, mode):
    path = tmp_path / "Einheiten.ifc"
    write_example(path)
    f = ifcopenshell.open(path)
    units = f.by_type("IfcProject")[0].UnitsInContext
    if mode == "fehlt":
        units.Units = [u for u in units.Units if u.UnitType != "LENGTHUNIT"]
    else:
        next(u for u in units.Units if u.UnitType == "LENGTHUNIT").Name = "SQUARE_METRE"
    f.write(str(path))
    result = parse_ifc(path)
    room = next(item for item in result.elements if item.number == "E.01")
    assert room.polygons == []
    assert room.area_m2 == pytest.approx(24) and room.volume_m3 == pytest.approx(72)
    assert any("Längeneinheit" in w for w in result.warnings)
