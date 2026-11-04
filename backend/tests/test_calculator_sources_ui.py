"""Keep source provenance accessible without repeating provider links in calculators."""
from __future__ import annotations

import re

import pytest

from test_editor_navigation import editor, env, playwright  # noqa: F401 - shared isolated fixtures


@pytest.mark.parametrize("tool_id,reference", [
    ("ls-schalter", "https://www.elektro-rechner.ch/Rechner/ls-schalter.html"),
    ("kabelberechnung", "https://www.elektro-rechner.ch/Rechner/spannungsfall.html"),
    ("emobilitaet", "https://www.elektro-rechner.ch/Rechner/e-mobility-rechner.html"),
    ("premium-brandmelder", "https://www.elektro-rechner.ch/premium/brandmelder-rechner.php"),
    ("brandlast", "https://www.elektro-rechner.ch/premium/data/kabel_brandlast.json"),
    ("premium-poe", "https://www.elektro-rechner.ch/assets/poe-engine.js"),
    ("premium-sia2056", "https://www.elektro-rechner.ch/premium/sia2056-rechner.php"),
])
def test_calculator_sources_are_in_collapsed_knowledge_section(editor, tool_id, reference):
    page, _, _, _ = editor
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.evaluate("tool => { location.hash = `rechner/${tool}`; }", tool_id)
    playwright.expect(page.get_by_role("button", name="Ergebnis als JSON sichern", exact=True)).to_be_enabled()
    playwright.expect(page.locator('a[href*="elektro-rechner.ch"]')).to_have_count(0)
    playwright.expect(page.locator(".lab-main")).not_to_contain_text("elektro-rechner.ch")

    page.get_by_role("button", name=re.compile(r"^Info: ")).first.click()
    dialog = page.get_by_role("dialog")
    playwright.expect(dialog).to_be_visible()
    playwright.expect(dialog.locator('a[href*="elektro-rechner.ch"]')).to_have_count(0)
    dialog.get_by_role("link", name="Im Wissens-Hub weiterlesen", exact=False).click()

    sources = page.locator(".knowledge-sources")
    playwright.expect(sources).to_be_visible()
    assert sources.get_attribute("open") is None
    reference_link = sources.locator(f'a[href="{reference}"]')
    playwright.expect(reference_link).not_to_be_visible()
    sources.locator("summary").click()
    playwright.expect(reference_link).to_be_visible()
    playwright.expect(sources).to_contain_text("Vergleichsdaten · elektro-rechner.ch")
    playwright.expect(sources).to_contain_text("kein unabhängig bestätigter Normnachweis")
