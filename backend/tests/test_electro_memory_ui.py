"""Exercise the integrated, vector-based Memory and the shared formula engine."""
import re

from test_editor_navigation import editor, playwright  # noqa: F401
from test_phase3 import env  # noqa: F401


def open_memory(page):
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Elektro-Memory öffnen", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Elektro-Memory", exact=True)).to_be_visible()


def open_chapter(page, title):
    page.locator(".memory-sidebar").get_by_role("button", name=re.compile(re.escape(title))).click()
    playwright.expect(page.locator(".memory-page-head h2")).to_have_text(title)


def test_memory_shows_all_chapters_and_clear_source_corrections(editor, tmp_path):
    page = editor[0]
    open_memory(page)
    sidebar = page.locator(".memory-sidebar")
    playwright.expect(sidebar.locator("nav button")).to_have_count(11)  # 7 E-Memory chapters + 4 further topics
    playwright.expect(sidebar.locator(".memory-chapter-icon").first).to_have_text("1")
    page.locator(".memory-source-info > summary").click()
    playwright.expect(page.locator(".memory-source-info")).to_contain_text("16/16 Seiten erfasst")
    playwright.expect(page.locator(".memory-source-info")).to_contain_text("25 Formeleinträge")
    page.locator(".memory-source-info > summary").click()
    open_chapter(page, "RCD, Schutzorgane & Stecksysteme")
    entry = page.locator("#memory-entry-em-p07-rcd-types")
    playwright.expect(entry).to_contain_text("Typ A erfasst sinusförmige Wechsel- und pulsierende Gleichfehlerströme")
    playwright.expect(entry.locator(".memory-correction")).to_be_visible()
    playwright.expect(entry.locator(".memory-correction")).to_contain_text("keine allgemeine Erfassung glatter Gleichfehlerströme")
    playwright.expect(entry.locator(".memory-rcd")).to_contain_text("0–20 kHz")
    playwright.expect(page.locator("#memory-entry-em-p07-diazed-colors .memory-swatch")).to_have_count(9)
    page.screenshot(path=str(tmp_path / "memory-rcd.png"), full_page=True)


def test_memory_search_spans_chapters_and_preserves_values_between_tabs(editor, tmp_path):
    page = editor[0]
    open_memory(page)
    page.get_by_role("searchbox", name="Elektro-Memory durchsuchen", exact=True).fill("Zählerkonstante")
    playwright.expect(page.locator(".memory-page-head h2")).to_contain_text("Treffer für «Zählerkonstante»")
    entry = page.locator("#memory-entry-em-p16-meter-power")
    playwright.expect(entry.locator(".memory-card-chapter")).to_have_text("Formeln & Einheiten")
    playwright.expect(entry.locator(".memory-equation")).to_contain_text("3600")
    playwright.expect(entry.locator(".memory-equation sub")).to_have_count(4)
    entry.get_by_role("button", name="Mit Werten berechnen", exact=True).click()
    playwright.expect(page.locator('.calc-formula-list [data-formula="zaehlerleistung"]')).to_have_attribute("aria-pressed", "true")
    time = page.get_by_role("textbox", name="Messzeit in s", exact=True)
    time.fill("72")
    playwright.expect(page.locator(".calc-results")).to_contain_text("0.500 kW")
    page.get_by_role("tab", name="Nachschlagen", exact=True).click()
    playwright.expect(entry).to_be_visible()
    page.get_by_role("tab", name="Formelrechner", exact=True).click()
    playwright.expect(time).to_have_value("72")
    page.get_by_role("textbox", name="Zählerkonstante in U/kWh", exact=True).fill("0")
    playwright.expect(page.locator(".calc-status")).to_contain_text("Zählerkonstante")
    playwright.expect(page.locator(".calc-results")).to_have_count(0)
    page.get_by_role("tab", name="Nachschlagen", exact=True).click()
    page.get_by_role("button", name="Suche leeren", exact=True).click()
    playwright.expect(page.locator(".memory-page-head h2")).not_to_contain_text("Treffer")


def test_memory_basics_use_vectors_and_stay_inside_a_small_dark_window(editor, tmp_path):
    page = editor[0]
    open_memory(page)
    open_chapter(page, "Grundlagen")
    playwright.expect(page.get_by_role("img", name=re.compile("Leistungsdreieck:"))).to_be_visible()
    assert page.locator(".memory-main img, .memory-main canvas").count() == 0
    page.get_by_role("button", name="Dunkler Modus", exact=True).click()
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".electro-memory").evaluate("el => el.scrollWidth <= el.clientWidth")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.screenshot(path=str(tmp_path / "memory-mobile-dark-vector.png"), full_page=True)
    page.set_viewport_size({"width": 1440, "height": 1050})
    page.screenshot(path=str(tmp_path / "memory-dark-vector.png"), full_page=True)


def test_chapter_survives_reload_emergency_jumps_to_first_aid_and_print_notes_stay_in_source(editor, tmp_path):
    page = editor[0]
    open_memory(page)
    open_chapter(page, "Leitungen, Rohre & Ausmass")
    playwright.expect(page.locator("#memory-entry-em-p08-wire-colors .memory-swatch").first).to_be_visible()
    playwright.expect(page.locator("#memory-entry-em-p01-ruler")).to_have_count(0)
    page.reload()
    playwright.expect(page.locator(".memory-page-head h2")).to_have_text("Leitungen, Rohre & Ausmass")
    page.get_by_role("button", name="Notfall · 144", exact=True).click()
    playwright.expect(page.locator(".memory-page-head h2")).to_have_text("Nothilfe bei Stromunfällen")
    playwright.expect(page.locator("#memory-entry-em-p02-first-aid")).to_contain_text("30 Thoraxkompressionen")
    playwright.expect(page.locator("#memory-entry-em-p02-emergency-report")).to_contain_text("Notruf 144")
    page.locator(".memory-source-info > summary").click()
    page.locator(".memory-source-print > summary").click()
    playwright.expect(page.locator(".memory-source-print")).to_contain_text("Aufgedrucktes Lineal")
    playwright.expect(page.locator(".memory-source-print")).to_contain_text("Quellstand und Impressum")
    page.locator(".memory-source-info > summary").click()
    page.set_viewport_size({"width": 1440, "height": 1050})
    page.screenshot(path=str(tmp_path / "memory-chapter-light.png"), full_page=True)
    page.get_by_role("button", name="Dunkler Modus", exact=True).click()
    page.screenshot(path=str(tmp_path / "memory-chapter-dark.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    playwright.expect(page.get_by_role("searchbox", name="Elektro-Memory durchsuchen", exact=True)).to_be_visible()
    page.screenshot(path=str(tmp_path / "memory-chapter-mobile.png"), full_page=True)
