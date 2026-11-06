"""The PR3 calculator is embedded in Memory and evaluates real input pairs/units."""

import os
from pathlib import Path

from test_documents_local_ui import documents_browser, env, playwright  # noqa: F401


def open_formulas(page):
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    playwright.expect(page.locator(".calc-tile")).to_have_count(29)
    page.get_by_role("button", name="Formelrechner öffnen", exact=True).click()
    playwright.expect(page.get_by_role("tab", name="Formelrechner", exact=True)).to_have_attribute("aria-selected", "true")
    playwright.expect(page.locator(".toolhub-header")).to_have_count(1)
    return page.locator("#memory-calculator-panel")


def test_every_formula_opens_inside_memory_without_replacing_the_existing_calculations(documents_browser):
    page, _, _, _, _ = documents_browser
    page.set_viewport_size({"width": 1500, "height": 1100})
    panel = open_formulas(page)
    chooser = panel.get_by_label("Formel wählen", exact=True)
    ids = chooser.locator("option").evaluate_all("options=>options.map(option=>option.value)")
    assert len(ids) == len(set(ids)) == 29
    for identifier in ids:
        chooser.select_option(identifier)
        playwright.expect(panel.locator(".calc-panel .calc-formula").first).to_be_visible()
        assert "NaN" not in panel.inner_text() and "Infinity" not in panel.inner_text()
        for explanation in panel.locator(".calc-info").all():
            playwright.expect(explanation).not_to_have_attribute("open", "")
        foundation = panel.locator(".calc-info").last
        foundation.locator(":scope > summary").click()
        playwright.expect(foundation).to_have_attribute("open", "")
        foundation.locator(":scope > summary").click()
    chooser.select_option("leistung-3p")
    directory = os.environ.get("DOCUMENTS_REVIEW_DIR")
    if directory:
        target = Path(directory)
        target.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(target / "09-memory-formelrechner.png"), full_page=True)


def test_ohm_supports_all_six_given_pairs_including_power_and_keeps_bad_input_visible(documents_browser):
    page, _, _, _, _ = documents_browser
    panel = open_formulas(page)
    panel.get_by_label("Formel wählen", exact=True).select_option("ohm")
    labels = {"u": ("Spannung in V", "12"), "i": ("Strom in A", "2"), "r": ("Widerstand in Ω", "6"), "p": ("Leistung in W", "24")}
    for pair in ["ui", "ur", "ir", "pu", "pi", "pr"]:
        panel.get_by_label("Gegebene Grössen", exact=True).select_option(pair)
        for key in pair:
            label, value = labels[key]
            panel.get_by_label(label, exact=True).fill(value)
        formula = panel.locator(".calc-formula")
        for expected in ["12.000 V", "2.000 A", "6.000 Ω", "24.00 W"]:
            playwright.expect(formula).to_contain_text(expected)
    panel.get_by_label("Leistung in W", exact=True).fill("abc")
    playwright.expect(panel.get_by_role("status")).to_contain_text("numerisch")
    playwright.expect(panel.locator(".calc-formula")).to_have_count(0)
    playwright.expect(panel.get_by_label("Leistung in W", exact=True)).to_have_value("abc")


def test_meter_microfarads_and_rappen_change_the_actual_results_and_fit_mobile(documents_browser):
    page, _, _, _, _ = documents_browser
    panel = open_formulas(page)
    chooser = panel.get_by_label("Formel wählen", exact=True)
    chooser.select_option("zaehlerleistung")
    playwright.expect(panel.locator(".calc-kpi").first).to_contain_text("1.000 kW")
    panel.get_by_label("Messzeit in s", exact=True).fill("72")
    playwright.expect(panel.locator(".calc-kpi").first).to_contain_text("0.500 kW")
    chooser.select_option("kapazitiv")
    playwright.expect(panel.locator(".calc-kpi").first).to_contain_text("318.310 Ω")
    panel.get_by_label("Kapazität in µF", exact=True).fill("20")
    playwright.expect(panel.locator(".calc-kpi").first).to_contain_text("159.155 Ω")
    panel.get_by_label("Kapazität in µF", exact=True).fill("0")
    playwright.expect(panel.get_by_role("status")).to_contain_text("grösser als 0")
    playwright.expect(panel.locator(".calc-kpi")).to_have_count(0)
    panel.get_by_label("Gesuchte Grösse / Rechenart", exact=True).select_option("ratio")
    panel.get_by_label("Strom am idealen Kondensator in A", exact=True).fill("2")
    playwright.expect(panel.locator(".calc-kpi").first).to_contain_text("115.000 Ω")
    chooser.select_option("stern-dreieck")
    panel.get_by_label("Gesuchte Grösse / Rechenart", exact=True).select_option("delta-inverse")
    playwright.expect(panel.locator(".calc-kpi").last).to_contain_text("17.321 A")
    chooser.select_option("energiekosten")
    playwright.expect(panel.locator(".calc-kpi").last).to_contain_text("1.500 CHF")
    panel.get_by_label("Arbeitspreis in Rp/kWh", exact=True).fill("50")
    playwright.expect(panel.locator(".calc-kpi").last).to_contain_text("3.000 CHF")
    page.set_viewport_size({"width": 390, "height": 844})
    assert panel.locator(".calc-tool").evaluate("element=>element.scrollWidth<=element.clientWidth+1")


def metric(page, label):
    return page.locator(".wb-metric").filter(has_text=label)


def test_added_office_sheets_calculate_from_entered_values(documents_browser, tmp_path):
    page, _, _, _, _ = documents_browser
    page.set_viewport_size({"width": 1500, "height": 1100})
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Leistungsbilanz öffnen", exact=True).click()
    playwright.expect(metric(page, "Gleichzeitige Leistung")).to_contain_text("2 kW")
    page.get_by_text("Verteilungen und Verbraucher bearbeiten", exact=False).click()
    page.get_by_label("Beispielverbraucher · Leistung", exact=True).fill("4000")
    page.get_by_label("Beispielverbraucher · Gleichzeitigkeit", exact=True).fill("0.5")
    playwright.expect(metric(page, "Gleichzeitige Leistung")).to_contain_text("2 kW")
    playwright.expect(metric(page, "Installierte Leistung")).to_contain_text("4 kW")
    page.screenshot(path=str(tmp_path / "leistungsbilanz.png"), full_page=True)
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="ZEV-Gestehungskosten öffnen", exact=True).click()
    playwright.expect(metric(page, "Gestehungskosten")).to_contain_text("11 Rp./kWh")
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="RTV-Dämpfung öffnen", exact=True).click()
    playwright.expect(metric(page, "Pegel am Ende")).to_contain_text("67 dBµV")
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="BKP-Kostenschätzung öffnen", exact=True).click()
    playwright.expect(metric(page, "Schätzsumme")).to_contain_text("CHF")
    page.screenshot(path=str(tmp_path / "bkp-schaetzung.png"), full_page=True)
