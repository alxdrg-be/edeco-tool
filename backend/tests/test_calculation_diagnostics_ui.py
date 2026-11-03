"""Actual calculator error explanations reveal their own editable input/row."""
from __future__ import annotations

import json
import re

from test_editor_navigation import choose_field, editor, env, playwright  # noqa: F401

WORKBENCH_IDS = [
    "kurzschlussstrom", "transformator", "motoranlauf", "blindleistung", "verlustleistung",
    "ohmsches-gesetz", "beleuchtung", "nin-kabelrechner", "strombelastbarkeit", "ls-schalter",
    "potenzialausgleich", "pva-rechner", "brandlast", "poe", "premium-pkw", "premium-lkw",
    "premium-brandmelder", "premium-selektivitaet", "premium-ladekosten", "premium-sia2056",
    "premium-poe", "premium-brandlast",
]


def leave_nova(page):
    page.set_viewport_size({"width": 1500, "height": 1100})
    page.emulate_media(reduced_motion="reduce")
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()


def open_workbench(page, calculator_id):
    page.evaluate("id => { location.hash = 'rechner/' + id; }", calculator_id)
    playwright.expect(page.locator(".wb-controls")).to_be_visible()
    page.wait_for_function("""prefix => Object.keys(localStorage).some(key => key.startsWith(prefix))""",
                           arg=f"edeco.workbench.v1.{calculator_id}.")
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_enabled()


def disclose(locator):
    locator.evaluate("el => { for (let p=el.parentElement;p;p=p.parentElement) if(p.tagName==='DETAILS') p.open=true; }")


def open_structure(page):
    page.get_by_role("button", name=re.compile(r"^Struktur bearbeiten")).click()


def seed_rows(page, calculator_id, key, mutate):
    prefix = f"edeco.workbench.v1.{calculator_id}."
    saved = page.evaluate("prefix => { const key=Object.keys(localStorage).find(k=>k.startsWith(prefix)); return {key,value:JSON.parse(localStorage.getItem(key))}; }", prefix)
    rows = json.loads(saved["value"]["input"][key])
    mutate(rows)
    saved["value"]["input"][key] = json.dumps(rows)
    page.evaluate("saved => localStorage.setItem(saved.key,JSON.stringify(saved.value))", saved)
    page.reload()
    playwright.expect(page.locator(".wb-controls")).to_be_visible()
    return rows


def test_every_workbench_explains_a_real_invalid_input_and_reveals_that_field(editor):
    page, _, _, _ = editor
    leave_nova(page)
    reviewed = []
    for calculator_id in WORKBENCH_IDS:
        open_workbench(page, calculator_id)
        if calculator_id == "potenzialausgleich":
            choose_field(page, "paMode", "manual")
        candidates = page.locator('.wb-controls input[data-field-key][inputmode="decimal"]:not([disabled])')
        repaired = False
        for index in range(candidates.count()):
            probe = candidates.nth(index)
            original = probe.input_value()
            if not original.strip():
                continue
            disclose(probe)
            probe.fill("")
            if page.locator('.wb-results .calc-diagnostic[data-diagnostic-id="invalid-input"]').count() == 0:
                probe.fill(original)
                continue
            issue = page.locator('.wb-results .calc-diagnostic[data-diagnostic-id="invalid-input"]')
            playwright.expect(issue).to_be_visible()
            playwright.expect(issue.locator("dt", has_text="Erforderlich")).to_be_visible()
            assert issue.locator("dd").last.inner_text().strip()
            field_key = probe.get_attribute("data-field-key")
            group = probe.locator("xpath=ancestor::details[1]")
            group.evaluate("el => { el.open=false; }")
            issue.locator(".calc-diagnostic-links button").first.click()
            playwright.expect(probe).to_be_visible()
            playwright.expect(probe).to_be_focused()
            playwright.expect(probe).to_have_value("")
            probe.fill(original)
            playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_enabled()
            reviewed.append((calculator_id, field_key))
            repaired = True
            break
        assert repaired, f"No consumed editable field was reviewed for {calculator_id}"
    assert len(reviewed) == 22


def test_selectivity_same_named_second_stage_error_reveals_its_own_length(editor):
    page, _, _, _ = editor
    leave_nova(page)
    open_workbench(page, "premium-selektivitaet")
    def mutate(rows):
        rows[0]["name"] = rows[1]["name"] = "Gleiche Sicherung"
    rows = seed_rows(page, "premium-selektivitaet", "selectivityStages", mutate)
    open_structure(page)
    row = page.locator(f'[data-diagnostic-field="selectivityStages"][data-diagnostic-row="{rows[1]["id"]}"]')
    field = row.get_by_label("Zuleitung · einfache Länge (m)", exact=True)
    disclose(field)
    field.fill("")
    page.locator(".wb-position-editor").evaluate("el => { el.open=false; }")
    issue = page.locator('[data-diagnostic-id="invalid-input"]')
    issue.locator(".calc-diagnostic-links button").click()
    playwright.expect(field).to_be_focused()
    playwright.expect(field).to_have_value("")
    first = page.locator(f'[data-diagnostic-field="selectivityStages"][data-diagnostic-row="{rows[0]["id"]}"]').get_by_label("Zuleitung · einfache Länge (m)", exact=True)
    playwright.expect(first).to_have_value(rows[0]["length"])


def test_cost_position_and_poe_segment_errors_open_exact_custom_rows_on_mobile(editor):
    page, _, _, _ = editor
    leave_nova(page)
    cases = [
        ("premium-ladekosten", "costRows", "hardware", "Gleiche Kostenposition · Beschaffung (CHF/LP)"),
        ("premium-poe", "poeSegments", "length", "Abschnitt 2 · Physische Länge (m)"),
    ]
    for calculator_id, key, prop, label in cases:
        open_workbench(page, calculator_id)
        def mutate(rows):
            if len(rows) == 1:
                rows.append({**rows[0], "id": "duplicate-name-second"})
            if key == "costRows":
                rows[0]["label"] = rows[1]["label"] = "Gleiche Kostenposition"
        rows = seed_rows(page, calculator_id, key, mutate)
        open_structure(page)
        row = page.locator(f'[data-diagnostic-field="{key}"][data-diagnostic-row="{rows[1]["id"]}"]')
        field = row.get_by_label(label, exact=True)
        disclose(field)
        field.fill("")
        page.locator(".wb-position-editor").evaluate("el => { el.open=false; }")
        page.set_viewport_size({"width": 390, "height": 844})
        issue = page.locator('[data-diagnostic-id="invalid-input"]')
        issue.locator(".calc-diagnostic-links button").first.click()
        playwright.expect(field).to_be_visible()
        playwright.expect(field).to_be_focused()
        playwright.expect(field).to_have_value("")
        assert page.locator(".lab-main").evaluate("el => el.scrollWidth <= el.clientWidth + 1")
        field.fill(rows[1][prop])
        page.set_viewport_size({"width": 1500, "height": 1100})


def test_legacy_calculators_explain_and_focus_their_own_empty_input(editor):
    page, _, _, _ = editor
    leave_nova(page)
    for calculator_id, field_key, label in [
        ("kabelberechnung", "length", "Leitungslänge L (m)"),
        ("blitzschutz", "length", "Leitungsweg A (m)"),
        ("emobilitaet", "hours", "Betriebszeit (h/Tag)"),
    ]:
        page.evaluate("id => { location.hash='rechner/'+id; }", calculator_id)
        field = page.get_by_label(label, exact=True)
        playwright.expect(field).to_be_attached()
        disclose(field)
        original = field.input_value()
        field.fill("")
        group = field.locator("xpath=ancestor::details[1]")
        if group.count():
            group.evaluate("el => { el.open=false; }")
        issue = page.locator('.legacy-calculation-guidance [data-diagnostic-id="legacy-invalid-input"]')
        playwright.expect(issue).to_be_visible()
        issue.locator("summary").click()
        issue.locator(".calc-diagnostic-links button").first.click()
        playwright.expect(field).to_be_focused()
        assert field.evaluate("el => el.closest('[data-field-key],[data-diagnostic-field-key]').dataset.fieldKey || el.closest('[data-diagnostic-field-key]').dataset.diagnosticFieldKey") == field_key
        playwright.expect(field).to_have_value("")
        field.fill(original)


def test_failed_ls_condition_shows_real_constraints_and_updates_without_editing_inputs(editor, tmp_path):
    page, _, _, _ = editor
    leave_nova(page)
    open_workbench(page, "ls-schalter")
    choose_field(page, "rated", "25")
    factor = page.locator('input[data-field-key="i2factor"]')
    disclose(factor)
    factor.fill("5")
    issue = page.locator('[data-diagnostic-id="overload-capacity"]')
    issue.locator("summary").click()
    playwright.expect(issue).to_contain_text("kein Nennstrombereich")
    playwright.expect(issue).to_contain_text("86.206896")
    issue.get_by_role("button", name="Zur Eingabe: Korrigierte Strombelastbarkeit Iz", exact=True).click()
    field = page.locator('input[data-field-key="iz"]')
    playwright.expect(field).to_be_focused()
    playwright.expect(field).to_have_value("20")
    page.screenshot(path=str(tmp_path / "ls-diagnostic-real-current-values.png"), full_page=True)
    factor.fill("1.45")
    field.fill("100")
    playwright.expect(issue).to_have_count(0)
    # Separate magnetic limitation is not silently converted to a full approval.
    playwright.expect(page.locator('[data-diagnostic-id="breaker-magnetic"]')).to_be_visible()


def test_sia_consumer_and_fire_variant_b_reveal_the_actual_nested_cell(editor):
    page, _, _, _ = editor
    leave_nova(page)
    open_workbench(page, "premium-sia2056")
    choose_field(page, "siaMode", "manual")
    open_structure(page)
    field = page.locator('[data-diagnostic-field="siaZones"] input[data-diagnostic-property="devices.energyDensity"]').first
    disclose(field)
    field.fill("")
    page.locator(".wb-position-editor").evaluate("el => { el.open=false; }")
    issue = page.locator('[data-diagnostic-id="invalid-input"]')
    issue.locator(".calc-diagnostic-links button").click()
    playwright.expect(field).to_be_focused()
    playwright.expect(field).to_have_value("")
    field.fill("30")
    open_workbench(page, "premium-brandlast")
    choose_field(page, "comparisonEnabled", "yes")
    open_structure(page)
    row = page.locator('[data-diagnostic-field="fireloadRowsAfter"]').first
    field = row.locator('label[data-diagnostic-label]').filter(has_text="Länge je Kabel").locator("input")
    disclose(field)
    field.fill("")
    page.locator(".wb-position-editor").evaluate("el => { el.open=false; }")
    page.locator('[data-diagnostic-id="invalid-input"] .calc-diagnostic-links button').click()
    playwright.expect(field).to_be_focused()
    playwright.expect(field).to_have_value("")
