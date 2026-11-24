"""Raumkontur, Attributprüfung und Excel-Ausgabe über den normalen Toolhub-Einstieg."""

import re

from openpyxl import load_workbook

from test_bim_check_ifc import write_example
from test_documents_local_ui import documents_browser  # noqa: F401
from test_editor_navigation import env, playwright  # noqa: F401


def test_room_selection_guide_and_excel_keep_the_same_object(documents_browser, tmp_path):
    page, *_ = documents_browser
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="BIM-Check & Raum-Viewer öffnen", exact=True).click()

    with page.expect_download() as template:
        page.get_by_text("Excel-Vorlage herunterladen", exact=True).click()
    guide_path = tmp_path / "Prüfregeln.xlsx"
    template.value.save_as(guide_path)

    model_path = tmp_path / "Prüfmodell.ifc"
    write_example(model_path)
    upload = page.get_by_label("Modell oder Raumliste importieren", exact=True)
    upload.set_input_files(model_path)
    plan = page.get_by_role("group", name="Grundriss mit auswählbaren Raumkonturen")
    floor = page.get_by_role("combobox", name="Geschoss", exact=True)
    floor.select_option(value="floor:1. OG")
    playwright.expect(plan).to_have_count(0)
    playwright.expect(page.get_by_role("table", name="Räume im Modell")).to_contain_text("Sitzung")
    floor.select_option(value="floor:EG")
    contour = plan.get_by_role("button", name=re.compile("Technik"))
    # The fixture has an opening. Clicking the centre of the bounding box could hit the hole.
    contour.focus()
    contour.press("Enter")
    inspector = page.get_by_role("complementary", name="Attribut-Inspektor")
    playwright.expect(inspector).to_contain_text("Pset_SpaceCommon")
    playwright.expect(inspector).to_contain_text("Firma_Raum")

    inspector.get_by_role("checkbox", name="Nur belegte Werte").check()
    inspector.get_by_role("searchbox", name="Eigenschaften durchsuchen").fill("IsExternal")
    # False ist ein ausgewiesener Boolescher Wert und muss auffindbar bleiben.
    playwright.expect(inspector.get_by_text("IsExternal", exact=True)).to_be_visible()

    page.get_by_label("Excel-Regelwerk importieren", exact=True).set_input_files(guide_path)
    page.get_by_role("button", name="Prüfergebnisse", exact=True).click()
    page.get_by_role("combobox", name="Status", exact=True).select_option(label="Fehlt")
    page.get_by_role("combobox", name="PSet", exact=True).select_option(label="Firma_Raum")
    page.get_by_role("combobox", name="Attribut", exact=True).select_option(label="Nutzung")
    findings = page.get_by_role("row").filter(has_text="Sitzung")
    playwright.expect(findings).to_have_count(1)
    findings.get_by_role("button").click()
    playwright.expect(inspector).to_contain_text("Sitzung")
    playwright.expect(inspector).to_contain_text("Nutzung")

    with page.expect_download() as exported:
        page.get_by_text("Prüfbericht herunterladen", exact=True).click()
    with exported.value.path().open("rb") as source:
        workbook = load_workbook(source, read_only=True, data_only=True)
        try:
            rows = list(workbook["Prüfergebnisse"].values)
            headers = rows[0]
            report = [dict(zip(headers, row, strict=True)) for row in rows[1:]]
            assert any(row["Bezeichnung"] == "Sitzung" and row["Status"] == "Fehlt"
                       and row["PSet"] == "Firma_Raum" and row["Attribut"] == "Nutzung" for row in report)
            assert any(row["Bezeichnung"] == "Technik" and row["Status"] == "OK" for row in report)
        finally:
            workbook.close()

    upload.set_input_files({"name": "Unvollständig.ifc", "mimeType": "application/octet-stream", "buffer": b"kein IFC"})
    playwright.expect(page.get_by_role("alert")).to_be_visible()
    playwright.expect(inspector).to_contain_text("Sitzung")
