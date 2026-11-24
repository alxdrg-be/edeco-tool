"""Den That-Open-IFC-Viewer im BIM-Check mit einem echten IFC und Regelwerk bedienen."""

import ifcopenshell
import openpyxl

from test_bim_check_3d_ui import write_pavillon
from test_documents_local_ui import documents_browser  # noqa: F401
from test_editor_navigation import env, playwright  # noqa: F401


def add_luminaires(path):
    """Nova exportiert Elektro-Objekte oft als Proxy. Vier Leuchten im Obergeschoss."""
    model = ifcopenshell.open(str(path))
    context = model.by_type("IfcGeometricRepresentationContext")[0]
    storey = next(s for s in model.by_type("IfcBuildingStorey") if s.Name == "Obergeschoss")
    up = model.createIfcDirection((0., 0., 1.))
    origin = model.createIfcAxis2Placement3D(model.createIfcCartesianPoint((0., 0., 0.)))
    lights = []
    for number, (x, y) in enumerate([(2, 2), (4, 6), (9, 2.5), (9, 7)], 1):
        body = model.createIfcExtrudedAreaSolid(model.createIfcRectangleProfileDef("AREA", None, None, 1.2, .3), origin, up, .08)
        shape = model.createIfcShapeRepresentation(context, "Body", "SweptSolid", [body])
        placement = model.createIfcLocalPlacement(storey.ObjectPlacement,
                                                  model.createIfcAxis2Placement3D(model.createIfcCartesianPoint((float(x), float(y), 2.9))))
        lights.append(model.create_entity("IfcBuildingElementProxy", GlobalId=ifcopenshell.guid.new(), Name=f"Leuchte L{number}",
                                          ObjectPlacement=placement, Representation=model.createIfcProductDefinitionShape(None, None, [shape])))
    model.create_entity("IfcRelContainedInSpatialStructure", GlobalId=ifcopenshell.guid.new(), RelatingStructure=storey, RelatedElements=lights)
    model.write(str(path))


def write_rules(path):
    book = openpyxl.Workbook()
    sheet = book.active
    sheet.append(["Regel-ID", "IFC-Klasse", "PSet", "Attribut", "Pflichtfeld"])
    sheet.append(["R1", "IfcWall", "Firma_Bauteil", "Brandschutz", "Ja"])
    book.save(path)


def test_ifc_viewer_groups_status_section_measure_and_pick(documents_browser, tmp_path):
    page, *_ = documents_browser
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.set_viewport_size({"width": 1366, "height": 900})
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="BIM-Check & Raum-Viewer öffnen", exact=True).click()
    guide = page.get_by_role("region", name="IFC-Prüfung in vier Schritten")
    playwright.expect(guide).to_contain_text("Modell öffnen")
    model = tmp_path / "Pavillon-West.ifc"
    write_pavillon(model)
    add_luminaires(model)
    page.get_by_label("Modell oder Raumliste importieren", exact=True).set_input_files(model)
    playwright.expect(page.get_by_role("heading", name="Pavillon-West.ifc")).to_be_visible(timeout=30_000)
    rules = tmp_path / "Regeln.xlsx"
    write_rules(rules)
    page.get_by_label("Excel-Regelwerk importieren", exact=True).set_input_files(rules)
    playwright.expect(page.get_by_role("button", name="Prüfbericht herunterladen")).to_be_visible(timeout=30_000)
    playwright.expect(guide).to_contain_text("Befunde klären")

    # The guide opens the viewer directly in status colours.
    guide.get_by_role("button", name="Prüfstatus im Viewer").click()
    canvas = page.locator(".iv-canvas")
    if not page.evaluate("!!document.createElement('canvas').getContext('webgl2')"):
        return
    playwright.expect(canvas).to_have_attribute("data-state", "ready", timeout=60_000)
    bar = page.get_by_label("Sichtbare Bauteilgruppen")
    playwright.expect(bar).to_contain_text("Räume6")
    playwright.expect(bar).to_contain_text("Wände8")
    playwright.expect(bar).to_contain_text("Installationen4")
    playwright.expect(page.get_by_role("button", name="Prüfstatus", exact=True)).to_have_attribute("aria-pressed", "true")
    playwright.expect(page.get_by_label("Legende Prüfstatus")).to_contain_text("Fehlt")

    page.get_by_role("button", name="IFC-Farben", exact=True).click()
    page.get_by_role("combobox", name="Geschoss", exact=True).select_option(value="floor:Obergeschoss")
    page.get_by_role("button", name="Schnitt", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Schnitt", exact=True)).to_have_attribute("aria-pressed", "true")
    page.get_by_role("button", name="Schnitt", exact=True).click()

    page.get_by_role("button", name="Messen", exact=True).click()
    box = canvas.bounding_box()
    readout = page.locator(".iv-readout")
    for points in (((.45, .6), (.55, .6)), ((.4, .5), (.6, .55)), ((.48, .45), (.52, .65))):
        for x, y in points:
            page.mouse.click(box["x"] + box["width"] * x, box["y"] + box["height"] * y)
            page.wait_for_timeout(300)
        if "Abstand" in readout.inner_text():
            break
    playwright.expect(readout).to_contain_text("Abstand")
    page.get_by_role("button", name="Messen", exact=True).click()

    inspector = page.get_by_role("complementary", name="Attribut-Inspektor")
    for x, y in ((.5, .55), (.45, .6), (.55, .6), (.5, .5), (.4, .55), (.6, .5)):
        page.mouse.click(box["x"] + box["width"] * x, box["y"] + box["height"] * y)
        page.wait_for_timeout(400)
        if inspector.is_visible():
            break
    playwright.expect(inspector).to_be_visible()
    page.get_by_role("button", name="Isolieren", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Isolieren", exact=True)).to_have_attribute("aria-pressed", "true")
    assert not errors
