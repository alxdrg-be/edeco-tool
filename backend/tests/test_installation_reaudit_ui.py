"""Guided installation choices and the shared voltage-factor model in the real UI."""
from test_editor_navigation import editor, env, playwright, choose_field  # noqa: F401


def open_calculator(page, tool):
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.evaluate("tool => { location.hash = 'rechner/' + tool; }", tool)
    playwright.expect(page.locator(".wb-controls")).to_be_visible()
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_enabled()


def open_parent_disclosures(field):
    # Keep the ancestor query stable while opening each containing details.
    for detail in field.locator("xpath=ancestor::details").all():
        if detail.get_attribute("open") is None:
            detail.locator(":scope > summary").click()


def test_nin_guides_conductor_construction_and_preserves_saved_method(editor):
    page, _, _, _ = editor
    open_calculator(page, "nin-kabelrechner")
    method = page.locator('[data-field-key="method"]')
    playwright.expect(method).to_have_value("B2")
    assert "A1" not in method.locator("option").evaluate_all("els => els.map(e => e.value)")
    choose_field(page, "conductorKind", "single")
    playwright.expect(method).to_have_value("B1")
    playwright.expect(method).to_contain_text("Einadrig im Rohr")
    assert "B2" not in method.locator("option").evaluate_all("els => els.map(e => e.value)")
    playwright.expect(page.locator(".wb-metric").filter(has_text="Korrigierte Strombelastbarkeit Iz").locator("strong")).to_have_text("36 A")

    page.evaluate("""() => {
        const key='edeco.workbench.v1.nin-kabelrechner.unassigned';
        const saved=JSON.parse(localStorage.getItem(key));
        delete saved.input.conductorKind;
        saved.input.method='G-h'; saved.input.area='95';
        localStorage.setItem(key,JSON.stringify(saved));
    }""")
    page.reload()
    playwright.expect(method).to_have_value("G-h")
    playwright.expect(page.locator('[data-field-key="conductorKind"] button[data-choice-value="all"]')).to_have_attribute("aria-pressed", "true")
    playwright.expect(page.locator(".wb-metric").filter(has_text="Korrigierte Strombelastbarkeit Iz").locator("strong")).to_have_text("341 A")


def test_selectivity_uses_the_same_voltage_factor_for_its_actual_pair_limit(editor):
    page, _, _, _ = editor
    open_calculator(page, "premium-selektivitaet")
    stage = page.locator(".sel-stage-card").nth(2)
    limit = stage.get_by_label("Paargrenze zur vorgelagerten Stufe (kA, optional)", exact=True)
    open_parent_disclosures(limit)
    limit.fill("0.4")
    stage.get_by_label("Hersteller, Geräte und Tabellenquelle", exact=True).fill("Projektbeleg: konkrete Gerätepaarung, Tabelle bei 400 V")
    playwright.expect(page.locator(".wb-status")).to_contain_text("Herstellergrenze wird überschritten")
    choose_field(page, "voltageTolerance", "plus6")
    playwright.expect(page.locator(".wb-status")).to_have_class("wb-status wb-warning")
    playwright.expect(page.locator(".wb-status")).not_to_contain_text("Herstellergrenze wird überschritten")
    choose_field(page, "voltageTolerance", "plus10")
    playwright.expect(page.locator(".wb-status")).to_have_class("wb-status wb-error")
