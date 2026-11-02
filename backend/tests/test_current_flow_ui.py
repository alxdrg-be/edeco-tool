"""Motion follows computed power paths, never device ratings or missing inputs."""
from __future__ import annotations

from test_editor_navigation import choose_card, editor, env, named_cards, playwright  # noqa: F401


def test_ev_flow_stops_for_waiting_invalid_and_reduced_motion_and_reverses_known_export(editor):
    page, _, _, _ = editor
    page.emulate_media(reduced_motion="no-preference")
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="E-Mobilität · AC-Vorplanung öffnen", exact=True).click()
    count = page.get_by_label("Anzahl Ladepunkte", exact=True)
    playwright.expect(count).to_be_enabled()
    choose_card(named_cards(page, "Hausanschluss (A)"), "125")
    choose_card(named_cards(page, "Grid-Vorsicherung (A)"), "63")
    choose_card(named_cards(page, "Ladeleistung je Punkt (kW)"), "11")
    page.get_by_label("Gebäudereserve (kW)", exact=True).fill("20")
    count.fill("3")
    choose_card(named_cards(page, "Lastmanagement"), "static")
    choose_card(named_cards(page, "Faktorgrundlage"), "manual")
    page.get_by_label("Gleichzeitigkeitsfaktor k (statisch)", exact=True).fill("0.5")
    active = page.locator('.ev-schema-point[data-active="true"]')
    waiting = page.locator('.ev-schema-point[data-state="waiting"]')
    playwright.expect(active).to_have_count(2)
    playwright.expect(waiting).to_have_count(1)
    assert active.locator(".lab-current-flow").count() == 4
    assert waiting.locator(".lab-current-flow").count() == 0
    row_bus = page.get_by_test_id("schema-grid-bus").first
    assert "lab-current-flow" in row_bus.locator('[data-flow-column="0"]').get_attribute("class")
    assert "lab-current-flow" in row_bus.locator('[data-flow-column="1"]').get_attribute("class")
    assert not row_bus.locator('[data-flow-column="2"]').get_attribute("class")
    moving = page.get_by_test_id("schema-grid-feed")
    assert moving.evaluate("el => getComputedStyle(el).animationName") != "none"
    first_offset = moving.evaluate("el => getComputedStyle(el).strokeDashoffset")
    page.wait_for_timeout(100)
    assert moving.evaluate("el => getComputedStyle(el).strokeDashoffset") != first_offset
    # A second row containing only waiting points also leaves the trunk below row 1 static.
    count.fill("6")
    assert "lab-current-flow" in moving.get_attribute("class")
    assert not page.locator('.ev-schema-svg [data-flow-row="1"]').get_attribute("class")
    count.fill("3")

    # A known local source at the Grid reverses the net branch, while points charge.
    page.locator("summary").filter(has_text="PV & Speicher").click()
    page.get_by_label("PV-Leistung (kWp) · optional, leer = 0", exact=True).fill("60")
    choose_card(named_cards(page, "PV / Speicher angeschlossen am"), "grid")
    assert "lab-current-flow-reverse" in page.get_by_test_id("schema-house-feed").get_attribute("class")
    assert "lab-current-flow-reverse" not in moving.get_attribute("class")

    page.emulate_media(reduced_motion="reduce")
    page.wait_for_function("[...document.querySelectorAll('.lab-current-flow')].every(el => getComputedStyle(el).animationName === 'none')")
    count.fill("")
    playwright.expect(page.locator(".ev-schema .lab-current-flow")).to_have_count(0)


def test_network_flow_requires_valid_nonzero_branch_current(editor):
    page, _, _, _ = editor
    page.get_by_role("button", name="← Zur Toolbox", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Netzplaner (Beta) öffnen", exact=True).click()
    playwright.expect(page.get_by_label("Name des Netzplans", exact=True)).to_be_enabled()
    playwright.expect(page.locator(".np-edge .lab-current-flow")).to_have_count(3)
    page.locator('[data-edge-id="line-3"] .np-edge-hit').click(force=True)
    length = page.locator('[data-network-field="length"]')
    length.fill("")
    playwright.expect(page.locator(".np-edge .lab-current-flow")).to_have_count(0)
    length.fill("25")
    playwright.expect(page.locator(".np-edge .lab-current-flow")).to_have_count(3)
    # Removing the only load leaves no calculated active branch.
    page.locator('.np-node[data-kind="load"]').click()
    page.keyboard.press("Delete")
    playwright.expect(page.locator(".np-edge .lab-current-flow")).to_have_count(0)
