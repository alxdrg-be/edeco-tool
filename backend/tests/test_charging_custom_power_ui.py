"""Own charging powers remain editable, persisted and validated in the actual UI."""
from __future__ import annotations

import re

from test_editor_navigation import choose_card, editor, env, playwright  # noqa: F401 - shared isolated fixtures


def open_calculator(page, calculator_id):
    # Leave NOVA through its save/navigation contract before using calculator routes.
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    playwright.expect(page.locator(".toolbox-card")).to_have_count(8)
    page.evaluate("id => { location.hash = 'rechner/' + id; }", calculator_id)
    page.wait_for_function("""prefix => Object.keys(localStorage).some(key => key.startsWith(prefix))""",
                           arg="edeco.workbench.v1." + calculator_id + ".")
    open_structure(page)


def open_structure(page):
    page.get_by_role("button", name=re.compile(r"^Struktur bearbeiten")).click()


def saved_input(page, calculator_id):
    return page.evaluate("""prefix => {
      const key = Object.keys(localStorage).find(key => key.startsWith(prefix));
      return JSON.parse(localStorage.getItem(key)).input;
    }""", "edeco.workbench.v1." + calculator_id + ".")


def wait_saved_value(page, calculator_id, field, path, expected):
    page.wait_for_function("""args => {
      const key = Object.keys(localStorage).find(key => key.startsWith(args.prefix));
      if (!key) return false;
      let value = JSON.parse(JSON.parse(localStorage.getItem(key)).input[args.field]);
      for (const part of args.path) value = value[part];
      return value === args.expected;
    }""", arg={"prefix": "edeco.workbench.v1." + calculator_id + ".", "field": field,
               "path": path, "expected": expected})


def custom_power(page, label, value):
    root = page.get_by_role("group", name=label, exact=True).or_(
        page.get_by_role("combobox", name=label, exact=True))
    choose_card(root, "custom")
    field = page.get_by_role("textbox", name=label + " · eigener Wert (kW)", exact=True)
    field.fill(value)
    playwright.expect(field).to_have_value(value)
    return field


def test_pkw_custom_power_and_semantic_mode_survive_reload(editor):
    import json
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1600, "height": 1100})
    open_calculator(page, "premium-pkw")
    label = "Grid 1, Gruppe 1 · Nennleistung"
    field = custom_power(page, label, "17")
    wait_saved_value(page, "premium-pkw", "grids", [0, "groups", 0, "power"], "17")
    group = json.loads(saved_input(page, "premium-pkw")["grids"])[0]["groups"][0]
    assert group["power"] == "17" and group["powerMode"] == "custom"
    page.reload()
    open_structure(page)
    # Open the editor and grid disclosures without depending on the header wording.
    field = page.get_by_role("textbox", name=label + " · eigener Wert (kW)", exact=True)
    playwright.expect(field).to_be_attached()
    for summary in field.locator("xpath=ancestor::details[not(@open)]/summary").all():
        summary.click()
    playwright.expect(field).to_have_value("17")
    playwright.expect(field).to_be_visible()
    field.fill("11")  # Matching a standard power must retain explicit custom semantics.
    playwright.expect(field).to_be_visible()
    assert json.loads(saved_input(page, "premium-pkw")["grids"])[0]["groups"][0]["powerMode"] == "custom"
    field.fill("keine Zahl")
    playwright.expect(page.locator(".lab-error").filter(has_text="Ladeleistung")).to_be_visible()
    field.fill("")
    playwright.expect(page.locator(".lab-error").filter(has_text="Ladeleistung")).to_be_visible()
    field.fill("17")
    playwright.expect(page.locator(".lab-error").filter(has_text="Ladeleistung")).to_have_count(0)


def test_lkw_custom_module_and_dispenser_values_are_available_and_strict(editor):
    import json
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1600, "height": 1100})
    open_calculator(page, "premium-lkw")
    module = custom_power(page, "Power Unit 1 · Leistung je Modul", "137")
    point = custom_power(page, "Abgabepunktgruppe 1 · Leistung je Punkt", "412")
    wait_saved_value(page, "premium-lkw", "depotPoints", [0, "power"], "412")
    saved = saved_input(page, "premium-lkw")
    assert json.loads(saved["depotUnits"])[0]["modulePower"] == "137"
    assert json.loads(saved["depotPoints"])[0]["power"] == "412"
    module.fill("")
    playwright.expect(page.locator(".lab-error").filter(has_text="Modulleistung")).to_be_visible()
    module.fill("137")
    point.fill("keine Zahl")
    playwright.expect(page.locator(".lab-error").filter(has_text="Punktleistung")).to_be_visible()
    point.fill("412")
    page.reload()
    open_structure(page)
    for label, value in [("Power Unit 1 · Leistung je Modul", "137"), ("Abgabepunktgruppe 1 · Leistung je Punkt", "412")]:
        field = page.get_by_role("textbox", name=label + " · eigener Wert (kW)", exact=True)
        playwright.expect(field).to_be_attached()
        for summary in field.locator("xpath=ancestor::details[not(@open)]/summary").all():
            summary.click()
        playwright.expect(field).to_have_value(value)
        playwright.expect(field).to_be_visible()
