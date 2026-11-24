"""Eine tatsächliche IFC-Raumszene über die gemeinsame Werkzeugkachel bedienen."""

from pathlib import Path

import ifcopenshell

from test_documents_local_ui import documents_browser  # noqa: F401
from test_editor_navigation import env, playwright  # noqa: F401


def write_pavillon(path: Path):
    """Zwei versetzte Geschosse, sechs Raumkörper und zugehörige Tragstruktur."""
    model = ifcopenshell.file(schema="IFC4")

    def root(kind, **values):
        return model.create_entity(kind, GlobalId=ifcopenshell.guid.new(), **values)

    def axes(x=0, y=0, z=0):
        return model.createIfcAxis2Placement3D(model.createIfcCartesianPoint(tuple(map(float, (x, y, z)))))

    def placement(parent=None, x=0, y=0, z=0):
        return model.createIfcLocalPlacement(parent, axes(x, y, z))

    def aggregate(parent, children):
        root("IfcRelAggregates", RelatingObject=parent, RelatedObjects=children)

    origin = axes()
    context = model.createIfcGeometricRepresentationContext(None, "Model", 3, 1e-6, origin)
    units = model.createIfcUnitAssignment([
        model.createIfcSIUnit(UnitType=dim, Name=name)
        for dim, name in [("LENGTHUNIT", "METRE"), ("AREAUNIT", "SQUARE_METRE"), ("VOLUMEUNIT", "CUBIC_METRE")]
    ])
    project = root("IfcProject", Name="Testprojekt Pavillon", RepresentationContexts=[context], UnitsInContext=units)
    place = placement(None, 2611433.245, 1261512.765, 303.53)
    building = root("IfcBuilding", Name="Pavillon West", ObjectPlacement=place)
    aggregate(project, [building])
    up = model.createIfcDirection((0., 0., 1.))

    def box(kind, number, floor, xyz, dimensions, label=None):
        x, y, z = xyz
        width, depth, height = map(float, dimensions)
        profile = model.createIfcRectangleProfileDef("AREA", None, None, width, depth)
        body = model.createIfcExtrudedAreaSolid(profile, origin, up, height)
        shape = model.createIfcShapeRepresentation(context, "Body", "SweptSolid", [body])
        position = placement(floor.ObjectPlacement, x + width / 2, y + depth / 2, z)
        element = root(kind, Name=number, ObjectPlacement=position,
                       Representation=model.createIfcProductDefinitionShape(None, None, [shape]))
        if kind == "IfcSpace":
            element.LongName = label
            quantities = [
                model.createIfcQuantityArea(Name="NetFloorArea", AreaValue=width * depth),
                model.createIfcQuantityVolume(Name="NetVolume", VolumeValue=width * depth * height),
            ]
            qto = root("IfcElementQuantity", Name="Qto_SpaceBaseQuantities", Quantities=quantities)
            root("IfcRelDefinesByProperties", RelatingPropertyDefinition=qto, RelatedObjects=[element])
        return element

    storeys = []
    for name, elevation, width, depth, labels in [
        ("Erdgeschoss", 0., 18., 12., ["Werkstatt", "Lager", "Prüflabor"]),
        ("Obergeschoss", 3.65, 12., 9., ["Sitzung", "Atelier", "Büro"]),
    ]:
        floor = root("IfcBuildingStorey", Name=name, Elevation=elevation, ObjectPlacement=placement(place, z=elevation))
        storeys.append(floor)
        mid_x, mid_y, wall, h = width * .58, depth * .49, .22, 3.18
        room_parts = [
            (wall, wall, mid_x - wall, depth - 2 * wall),
            (mid_x + wall, wall, width - mid_x - 2 * wall, mid_y - wall),
            (mid_x + wall, mid_y + wall, width - mid_x - 2 * wall, depth - mid_y - 2 * wall),
        ]
        spaces = [box("IfcSpace", f"{name[0]}{i:02d}", floor, (x, y, 0), (w, d, h), label)
                  for i, ((x, y, w, d), label) in enumerate(zip(room_parts, labels, strict=True), 1)]
        aggregate(floor, spaces)
        structure = [
            box("IfcSlab", "Geschossdecke", floor, (-.24, -.24, -.25), (width + .48, depth + .48, .25)),
            box("IfcWall", "Nordwand", floor, (0, depth - wall, 0), (width, wall, h)),
            box("IfcWall", "Westwand", floor, (0, wall, 0), (wall, depth - 2 * wall, h)),
            box("IfcWall", "Trennwand West", floor, (mid_x, wall, 0), (wall, depth - 2 * wall, h)),
            box("IfcWall", "Trennwand Ost", floor, (mid_x + wall, mid_y, 0), (width - mid_x - 2 * wall, wall, h)),
            box("IfcBeam", "Fassadensturz", floor, (0, 0, h - .3), (width, wall, .3)),
        ]
        for x in (0, width / 2, width - .3):
            structure.append(box("IfcColumn", "Fassadenstütze", floor, (x, 0, 0), (.3, .3, h - .3)))
        root("IfcRelContainedInSpatialStructure", RelatingStructure=floor, RelatedElements=structure)
    aggregate(building, storeys)
    model.write(str(path))


def test_pick_space_and_filter_context_in_local_3d_view(documents_browser, tmp_path):
    page, _, _, _, requests = documents_browser
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="BIM-Check & Raum-Viewer öffnen", exact=True).click()
    path = tmp_path / "Pavillon-West.ifc"
    write_pavillon(path)
    page.get_by_label("Modell oder Raumliste importieren", exact=True).set_input_files(path)
    floor = page.get_by_role("combobox", name="Geschoss", exact=True)
    floor.select_option(value="")
    scene_button = page.get_by_role("button", name="3D", exact=True)
    assert not any(url.endswith("/scene") for url in requests)
    scene_button.click()
    canvas = page.get_by_role("img", name="3D-Modell mit IFC-Räumen und Gebäudestruktur")
    if not page.evaluate("!!document.createElement('canvas').getContext('webgl2')"):
        # The real workstation may only support the list and floor plan.
        playwright.expect(page.get_by_text("WebGL", exact=False).first).to_be_visible()
        page.get_by_role("button", name="Liste", exact=True).click()
        playwright.expect(page.get_by_role("table", name="Räume im Modell")).to_contain_text("Prüflabor")
        return

    playwright.expect(canvas).to_have_attribute("data-room-count", "6", timeout=30_000)
    playwright.expect(canvas).to_have_attribute("data-structure-count", "18")
    floor.select_option(value="floor:Obergeschoss")
    playwright.expect(canvas).to_have_attribute("data-room-count", "3")
    playwright.expect(canvas).to_have_attribute("data-structure-count", "9")
    walls = page.get_by_role("checkbox", name="Gebäudestruktur anzeigen")
    walls.uncheck()
    playwright.expect(canvas).to_have_attribute("data-structure-count", "0")
    search = page.get_by_role("searchbox", name="Räume suchen", exact=True)
    search.fill("Sitzung")
    playwright.expect(canvas).to_have_attribute("data-room-count", "1")
    page.get_by_role("button", name="3D-Modell einpassen", exact=True).click()
    bounds = canvas.bounding_box()
    inspector = page.get_by_role("complementary", name="Attribut-Inspektor")
    # Pick the projected solid itself, without relying on its screen position in a particular viewport.
    for x, y in ((.5, .5), (.4, .5), (.6, .5), (.4, .6), (.4, .4), (.3, .5), (.6, .4)):
        canvas.click(position={"x": bounds["width"] * x, "y": bounds["height"] * y})
        if inspector.is_visible():
            break
    playwright.expect(inspector).to_contain_text("Sitzung")
    playwright.expect(inspector).to_contain_text("Qto_SpaceBaseQuantities")
    walls.check()
    playwright.expect(canvas).to_have_attribute("data-structure-count", "9")
    page.get_by_role("button", name="Gewählten Raum einpassen", exact=True).click()
    playwright.expect(inspector).to_contain_text("Sitzung")
    assert sum(url.endswith("/scene") for url in requests) == 1
