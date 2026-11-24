"""Den geführten Listenvergleich im BIM-Check mit zwei Nova-Ständen bedienen."""

from openpyxl import Workbook

from test_bim_check_compare import HEAD
from test_documents_local_ui import documents_browser  # noqa: F401
from test_editor_navigation import env, playwright  # noqa: F401


def save(path, rows):
    book = Workbook()
    sheet = book.active
    sheet.append(HEAD)
    for row in rows:
        sheet.append(row)
    book.save(path)
    return path


def test_guided_list_comparison(documents_browser, tmp_path):
    page, *_ = documents_browser
    page.set_viewport_size({"width": 1366, "height": 900})
    old = save(tmp_path / "1138_alt.xlsx", [
        ["A1", "Bauteil", "Leuchte", "EG", "0.01", "Büro", "Licht", "Etappe_x", "L1"],
        ["A2", "Bauteil", "Steckdose", "EG", "0.01", "Büro", "Kraft", "Etappe_x", "K1"],
        ["A3", "Bauteil", "Melder", "OG", "1.01", "Flur", "BMA", "Etappe_x", None],
    ])
    new = save(tmp_path / "1138_neu.xlsx", [
        ["A1", "Bauteil", "Leuchte", "EG", "0.01", "Büro", "Licht", "Etappe_2", "L1"],
        ["A2", "Bauteil", "Steckdose", "EG", "0.01", "Büro", "Kraft", "Etappe_x", "K2"],
        ["A4", "Bauteil", "Leuchte", "OG", "1.02", "Lager", "Licht", "Etappe_x", None],
    ])
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="BIM-Check & Raum-Viewer öffnen", exact=True).click()
    page.get_by_label("Modell oder Raumliste importieren", exact=True).set_input_files(new)
    playwright.expect(page.get_by_role("heading", name="1138_neu.xlsx")).to_be_visible(timeout=30_000)
    page.get_by_role("button", name="Listen vergleichen", exact=True).click()
    panel = page.get_by_role("region", name="Nova-Listen vergleichen")
    playwright.expect(panel).to_contain_text("Wähle jetzt die ältere Nova-Liste")
    page.get_by_label("Älteren Stand der Nova-Liste wählen").set_input_files(old)
    playwright.expect(panel).to_contain_text("1138_alt.xlsx", timeout=30_000)
    table = panel.get_by_role("table")
    # A1 changed only its Baustatus and is hidden by default.
    playwright.expect(table).to_contain_text("Schaltkreis: K1 → K2")
    playwright.expect(table).not_to_contain_text("Etappe_2")
    page.get_by_label("Im Vergleich suchen").fill("")
    panel.get_by_role("checkbox").uncheck()
    playwright.expect(table).to_contain_text("Baustatus: Etappe_x → Etappe_2")
    panel.get_by_role("button", name="1 entfernt").click()
    playwright.expect(table).to_contain_text("fehlt im aktuellen Stand")
    panel.get_by_role("button", name="1 entfernt").click()
    table.get_by_role("button", name="Steckdose").click()
    playwright.expect(page.get_by_role("complementary", name="Attribut-Inspektor")).to_contain_text("K2")
    with page.expect_download() as download:
        panel.get_by_role("button", name="Bericht als Excel speichern").click()
    assert download.value.suggested_filename == "Nova-Listenvergleich.xlsx"
    playwright.expect(panel.get_by_role("list", name="Ablauf")).to_contain_text("Bericht speichern")
