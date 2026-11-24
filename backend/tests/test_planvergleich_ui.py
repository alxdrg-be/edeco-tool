"""Exercise the admin beta comparison from local PDF intake to exported results."""

import csv

from PIL import ImageChops
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_toolhub_design_beta_ui import home


def write_revision(path, wall_x):
    writer = PdfWriter()
    sheet = writer.add_blank_page(width=450, height=300)
    content = DecodedStreamObject()
    content.set_data(f"0 G 3 w 40 40 360 220 re S {wall_x} 40 m {wall_x} 190 l S".encode())
    sheet[NameObject("/Contents")] = writer._add_object(content)
    writer.add_blank_page(width=50, height=1000)
    writer.write(path)


def test_compare_registered_pages_review_and_export(editor, tmp_path):
    page, *_ = editor
    home(page)
    page.get_by_role("button", name="Planvergleich öffnen", exact=True).click()
    for i, label in enumerate(("Alter Stand als PDF", "Neuer Stand als PDF")):
        path = tmp_path / f"Revision-{i}.pdf"
        write_revision(path, 200 + i * 45)
        page.get_by_label(label).set_input_files(str(path))

    images = page.locator(".pc-paper img")
    playwright.expect(images).to_have_count(2)
    for x, y in ((0.10, 0.50), (0.90, 0.50), (0.50, 0.85)):
        for sheet in page.locator(".pc-paper").all():
            box = sheet.bounding_box()
            sheet.click(position={"x": int(box["width"] * x), "y": int(box["height"] * y)})
    page.get_by_label("Massstab alter Plan", exact=False).fill("100")
    page.once("dialog", lambda dialog: dialog.dismiss())
    page.get_by_label("Alter Stand Seite").select_option("2")
    playwright.expect(page.get_by_label("Alter Stand Seite")).to_have_value("1")
    page.get_by_role("button", name="Vergleichen", exact=True).click()
    page.get_by_role("button", name="Bereich 1", exact=True).click()
    page.get_by_label("Raum / Vermerk").fill("EG · Wand prüfen")
    page.get_by_role("checkbox", name="Bereich 1 gesichtet").check()
    playwright.expect(page.locator(".pc-region")).to_be_visible()

    with page.expect_download() as pdf:
        page.get_by_role("button", name="Vergleichs-PDF").click()
    pdf.value.save_as(tmp_path / "Export.pdf")
    exported = PdfReader(tmp_path / "Export.pdf")
    assert len(exported.pages) == 1
    # The input contains black walls only. The review frame and number are green.
    image = list(exported.pages[0].images)[0].image.convert("RGB")
    # Compare channels after cropping out the header and colour legend.
    red, green, blue = image.crop((0, 112, image.width, image.height)).split()
    green_dominance = ImageChops.darker(ImageChops.subtract(green, red), ImageChops.subtract(green, blue))
    assert green_dominance.getextrema()[1] > 20

    with page.expect_download() as report:
        page.get_by_role("button", name="Änderungsliste (CSV)").click()
    report.value.save_as(tmp_path / "Bereiche.csv")
    with (tmp_path / "Bereiche.csv").open(encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file, delimiter=";"))
    assert len(rows) >= 2
    assert rows[0]["Sichtprüfung"] == "Gesichtet"
    assert rows[0]["Raum / Vermerk"] == "EG · Wand prüfen"
    assert rows[0]["Alter Plan"] == "Revision-0.pdf"
    assert rows[0]["Neuer Plan"] == "Revision-1.pdf"
    assert rows[0]["Rastertoleranz (px)"] == "2"
    assert "im Gebäude (1:100)" in rows[0]["Lagekontrolle"]

    page.get_by_role("button", name="Ausrichtung", exact=True).click()
    page.get_by_label("Alter Stand Seite").select_option("2")
    playwright.expect(page.get_by_role("button", name="Vergleichen", exact=True)).to_be_disabled()
    # The report accommodates the title on narrow sheets without stretching the plan.
    page.get_by_label("Neuer Stand Seite").select_option("2")
    playwright.expect(images).to_have_count(2)
    for y in (0.10, 0.90):
        for sheet in page.locator(".pc-paper").all():
            box = sheet.bounding_box()
            sheet.click(position={"x": int(box["width"] / 2), "y": int(box["height"] * y)})
    page.get_by_role("button", name="Vergleichen", exact=True).click()
    with page.expect_download() as narrow:
        page.get_by_role("button", name="Vergleichs-PDF").click()
    narrow.value.save_as(tmp_path / "Schmal.pdf")
    narrow_page = PdfReader(tmp_path / "Schmal.pdf").pages[0]
    assert max(list(narrow_page.images)[0].image.size) < 2500

    page.get_by_role("button", name="Alter Stand schliessen").click()
    playwright.expect(images).to_have_count(0)
