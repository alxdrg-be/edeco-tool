"""Freshly audited PV details and optional fire-load variants in the actual UI."""
from __future__ import annotations

import json
from pathlib import Path

from test_editor_navigation import choose_field, editor, env, playwright  # noqa: F401


def open_calculator(page, tool_id):
    page.get_by_role('button', name='Zum Toolhub', exact=True).click()
    playwright.expect(page.locator('.toolbox-card')).to_have_count(10)
    page.evaluate('tool => { location.hash = `rechner/${tool}`; }', tool_id)
    playwright.expect(page.get_by_role('button', name='Ergebnis als JSON sichern', exact=True)).to_be_enabled()


def edit_number(page, key, value):
    field = page.locator(f'input[data-field-key="{key}"]')
    for summary in field.locator('xpath=ancestor::details[not(@open)]/summary').all():
        summary.click()
    field.fill(value)


def test_pv_extended_analysis_is_collapsed_reactive_and_removed_for_invalid_inputs(editor):
    page, _, _, _ = editor
    page.set_viewport_size({'width': 1500, 'height': 1100})
    open_calculator(page, 'pva-rechner')
    analysis = page.locator('.pv-analysis')
    playwright.expect(analysis).to_be_visible()
    assert analysis.get_attribute('open') is None
    playwright.expect(analysis.get_by_role('figure', name='Sensitivität der PV-Amortisation')).not_to_be_visible()
    analysis.locator('summary').click()
    playwright.expect(analysis.locator('[data-pv-sensitivity]')).to_have_count(5)
    playwright.expect(analysis).to_contain_text('−20 %: 15.7 Jahre')
    playwright.expect(analysis).to_contain_text('keine aktuelle Tarifauskunft oder Prognose')
    row = analysis.locator('[data-pv-sensitivity="buy"]')
    old_path = row.locator('path').first.get_attribute('d')
    edit_number(page, 'self', '50')
    playwright.expect(analysis).to_contain_text('−20 %: 12.5 Jahre')
    playwright.expect(row.locator('path').first).not_to_have_attribute('d', old_path)

    with page.expect_download() as downloading:
        page.get_by_role('button', name='Ergebnis als JSON sichern', exact=True).click()
    document = json.loads(Path(downloading.value.path()).read_text())
    assert len(document['result']['pvAnalysis']['scenarios']) == 5
    assert document['result']['pvAnalysis']['history'][-1]['year'] == 2026
    assert document['input']['self'] == '50'

    page.set_viewport_size({'width': 390, 'height': 844})
    assert page.locator('.engineering-lab').evaluate('el => el.scrollWidth <= el.clientWidth')
    edit_number(page, 'self', '')
    playwright.expect(page.locator('.pv-analysis')).to_have_count(0)
    actions = page.locator('.lab-export-actions')
    playwright.expect(actions).not_to_have_attribute('open', '')
    actions.locator('summary').click()
    playwright.expect(page.get_by_role('button', name='Ergebnis als JSON sichern', exact=True)).to_be_disabled()


def test_fire_variant_b_can_be_disabled_without_inventing_a_zero_state_or_losing_its_inputs(editor):
    page, _, _, _ = editor
    open_calculator(page, 'premium-brandlast')
    positions = page.locator('.wb-position-editor')
    positions.locator('summary').first.click()
    playwright.expect(positions.locator('.fireload-controls')).to_have_count(1)
    playwright.expect(page.locator('.wb-metrics')).not_to_contain_text('Nachher')
    choose_field(page, 'comparisonEnabled', 'yes')
    playwright.expect(positions.locator('.fireload-controls')).to_have_count(2)
    after = positions.locator('.fireload-controls').nth(1)
    after.get_by_label('Nachher · Position 1 · Brandlast je Kabel (MJ/m)', exact=True).fill('')
    playwright.expect(page.locator('.wb-results [role="alert"]')).to_be_visible()
    choose_field(page, 'comparisonEnabled', 'no')
    playwright.expect(positions.locator('.fireload-controls')).to_have_count(1)
    playwright.expect(page.get_by_role('button', name='Ergebnis als JSON sichern', exact=True)).to_be_enabled()
    playwright.expect(page.locator('.wb-metrics')).not_to_contain_text('Reduktion')
    with page.expect_download() as downloading:
        page.get_by_role('button', name='Ergebnis als JSON sichern', exact=True).click()
    document = json.loads(Path(downloading.value.path()).read_text())
    assert json.loads(document['input']['fireloadRowsAfter'])[0]['mjPerMeter'] == ''
    assert not any(item['label'] == 'Nachher' for item in document['result']['metrics'])
    choose_field(page, 'comparisonEnabled', 'yes')
    playwright.expect(page.locator('.wb-results [role="alert"]')).to_be_visible()
