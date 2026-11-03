"""Exercise the integrated, vector-based Memory and the shared formula engine."""
import re

from test_editor_navigation import editor, playwright  # noqa: F401
from test_phase3 import env  # noqa: F401


def open_memory(page):
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Elektro-Memory öffnen", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Elektro-Memory", exact=True)).to_be_visible()


def test_memory_exposes_all_source_pages_and_clear_source_corrections(editor, tmp_path):
    page = editor[0]
    open_memory(page)
    assert page.locator(".memory-topic-card").count() == 16  # 13 source topics + 3 independent basics
    page.locator(".memory-source-info > summary").click()
    playwright.expect(page.locator(".memory-source-info")).to_contain_text("16/16 Seiten erfasst")
    playwright.expect(page.locator(".memory-source-info")).to_contain_text("25 Formeleinträge")
    page.locator(".memory-source-info > summary").click()
    page.set_viewport_size({"width": 1440, "height": 1050})
    page.screenshot(path=str(tmp_path / "memory-overview.png"), full_page=True)
    page.get_by_role("heading", name="RCD, Sicherungen und LS", exact=True).click()
    page.locator(".memory-entry > summary").filter(has_text="RCD-Typen A, F, B und B+").click()
    entry = page.locator("#memory-entry-em-p07-rcd-types")
    playwright.expect(entry).to_contain_text("Typ A erfasst sinusförmige Wechsel- und pulsierende Gleichfehlerströme")
    playwright.expect(entry.locator(".memory-correction > div")).not_to_be_visible()
    entry.locator(".memory-correction > summary").click()
    playwright.expect(entry.locator(".memory-correction > div")).to_contain_text("keine allgemeine Erfassung glatter Gleichfehlerströme")
    page.screenshot(path=str(tmp_path / "memory-reference-correction.png"), full_page=True)


def test_memory_search_opens_the_exact_formula_and_preserves_values_between_tabs(editor, tmp_path):
    page = editor[0]
    open_memory(page)
    page.get_by_role("searchbox", name="Elektro-Memory durchsuchen", exact=True).fill("Zählerkonstante")
    page.get_by_role("heading", name="Formeln und Einheiten", exact=True).click()
    playwright.expect(page.locator(".memory-entry")).to_have_count(1)
    page.locator(".memory-entry > summary").click()
    entry = page.locator("#memory-entry-em-p16-meter-power")
    playwright.expect(entry.locator(".memory-equation")).to_contain_text("3600")
    playwright.expect(entry.locator(".memory-equation sub")).to_have_count(4)
    entry.get_by_role("button", name="Mit Werten berechnen", exact=True).click()
    selector = page.get_by_role("combobox", name="Formel wählen", exact=True)
    playwright.expect(selector).to_have_value("zaehlerleistung")
    time = page.get_by_role("textbox", name="Messzeit in s", exact=True)
    time.fill("72")
    playwright.expect(page.locator(".calc-results")).to_contain_text("0.500 kW")
    page.screenshot(path=str(tmp_path / "memory-calculator-valid.png"), full_page=True)
    page.get_by_role("tab", name="Nachschlagen", exact=True).click()
    playwright.expect(entry).to_be_visible()
    page.get_by_role("tab", name="Formelrechner", exact=True).click()
    playwright.expect(time).to_have_value("72")
    page.get_by_role("textbox", name="Zählerkonstante in U/kWh", exact=True).fill("0")
    playwright.expect(page.locator(".calc-status")).to_contain_text("Zählerkonstante")
    playwright.expect(page.locator(".calc-results")).to_have_count(0)
    page.screenshot(path=str(tmp_path / "memory-calculator-input-guidance.png"), full_page=True)


def test_memory_basics_use_vectors_and_stay_inside_a_small_dark_window(editor, tmp_path):
    page = editor[0]
    open_memory(page)
    page.get_by_role("button", name="Grundlagen", exact=True).click()
    playwright.expect(page.locator(".memory-topic-card")).to_have_count(3)
    page.get_by_role("heading", name="Gleich-, Wechsel- & Drehstrom", exact=True).click()
    page.locator(".memory-entry > summary").filter(has_text="Wirk-, Blind- und Scheinleistung").click()
    playwright.expect(page.get_by_role("img", name=re.compile("Leistungsdreieck:"))).to_be_visible()
    assert page.locator(".memory-main img, .memory-main canvas").count() == 0
    page.get_by_role("button", name="Dunkler Modus", exact=True).click()
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".electro-memory").evaluate("el => el.scrollWidth <= el.clientWidth")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.screenshot(path=str(tmp_path / "memory-mobile-dark-vector.png"), full_page=True)
    page.set_viewport_size({"width": 1440, "height": 1050})
    page.screenshot(path=str(tmp_path / "memory-dark-vector.png"), full_page=True)
