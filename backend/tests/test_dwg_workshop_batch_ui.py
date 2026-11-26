"""The workshop exports valid drawings even when another selected drawing is unreadable."""

from zipfile import ZipFile

import ezdxf

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_toolhub_design_beta_ui import home


def test_import_select_preview_and_export_partial_batch(editor, tmp_path):
    page, *_ = editor
    home(page)
    # Earlier versions allowed using the new preset's name for a private profile.
    page.evaluate("""() => localStorage.setItem('edeco.dwg-werkstatt.bueroprofile.v1',
        JSON.stringify([{ name: 'Nur CAD-Struktur prüfen', profile: {
        rules: [], remove_wipeouts: true, remove_text_backgrounds: false } }]))""")
    page.get_by_role("button", name="DWG-Werkstatt öffnen", exact=True).click()
    profiles = page.get_by_role("combobox", name="Büroprofil auswählen")
    playwright.expect(profiles.get_by_role("option", name="Nur CAD-Struktur prüfen (eigenes Profil)")).to_have_count(1)
    profiles.select_option(label="Nur CAD-Struktur prüfen")
    pick = page.get_by_label("DWG- oder DXF-Pläne auswählen", exact=True)
    first = tmp_path / "Grundriss UG.dxf"
    drawing = ezdxf.new()
    drawing.header["$INSBASE"] = (123.4567, 29, 4)
    drawing.modelspace().add_line((100, 300), (1800, 5200))
    drawing.saveas(first)
    second = tmp_path / "Grundriss EG.DXF"
    drawing.saveas(second)
    damaged = tmp_path / "Defekt.dwg"
    damaged.write_text("Keine CAD-Zeichnung", encoding="ascii")

    pick.set_input_files([first, second, damaged])
    plans = page.get_by_role("combobox", name="Plan für die Vorschau")
    playwright.expect(plans.locator("option")).to_have_count(3)
    plans.select_option("1")
    playwright.expect(page.get_by_role("img", name="Vorher · Original")).to_be_visible(timeout=30_000)
    playwright.expect(page.get_by_text("Grundriss EG.DXF", exact=True)).to_be_visible()
    playwright.expect(page.get_by_text("Strukturfehler behoben", exact=True)).to_be_visible()
    playwright.expect(page.get_by_text("123.4567 / 29 / 4 ", exact=False)).to_be_visible()
    plans.select_option("2")
    playwright.expect(page.get_by_role("button", name="Erneut versuchen")).to_be_visible(timeout=30_000)

    batch = page.get_by_role("button", name="Stapel als DXF-ZIP speichern")
    with page.expect_download(timeout=60_000) as download:
        batch.click()
    with ZipFile(download.value.path()) as archive:
        assert len([name for name in archive.namelist() if name.lower().endswith(".dxf")]) == 2
    playwright.expect(page.get_by_text("2 von 3 Plänen als DXF ausgegeben.", exact=False)).to_be_visible()
    page.get_by_role("button", name="Gewählten Plan aus dem Stapel entfernen").click()
    playwright.expect(plans.locator("option")).to_have_count(2)
    playwright.expect(plans).to_have_value("1")
