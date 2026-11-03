"""Exercise voltage-factor selection and saved-calculation migration in the real UI."""
from __future__ import annotations

import json

from test_editor_navigation import choose_field, editor, env, playwright  # noqa: F401 - shared fixtures
from test_network_planner_ui import expect_review, open_network, review_network


def selected_tolerance(page, value):
    return page.locator(f'[data-field-key="voltageTolerance"] [data-choice-value="{value}"]')


def test_short_circuit_tolerance_updates_numbers_and_preserves_saved_legacy_model(editor):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1600, "height": 1100})
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Kurzschlussstrom öffnen", exact=True).click()
    tolerance = selected_tolerance(page, "plus10")
    playwright.expect(tolerance).to_have_attribute("aria-pressed", "true")
    maximum = page.locator(".wb-metric").filter(has_text="3~-Kurzschluss · Modell").locator("strong")
    playwright.expect(maximum).to_have_text("8.1 kA")
    foundations = page.locator(".wb-foundations")
    foundations.locator("summary").click()
    playwright.expect(foundations.locator("code")).to_contain_text("1.10 × 400")

    choose_field(page, "voltageTolerance", "plus6")
    playwright.expect(maximum).to_have_text("7.73 kA")
    playwright.expect(foundations.locator("code")).to_contain_text("1.05 × 400")

    # Simulate an existing local calculation from before the tolerance selector.
    page.evaluate("""() => {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('edeco.workbench.v1.kurzschlussstrom.'));
      if (keys.length !== 1) throw new Error('Expected one isolated saved short-circuit calculation');
      const saved = JSON.parse(localStorage.getItem(keys[0]));
      delete saved.input.voltageTolerance;
      localStorage.setItem(keys[0], JSON.stringify(saved));
    }""")
    page.reload()
    playwright.expect(selected_tolerance(page, "legacy")).to_have_attribute("aria-pressed", "true")
    playwright.expect(page.locator(".wb-status")).to_contain_text("Altstand mit cmax = 1.05 übernommen")
    playwright.expect(maximum).to_have_text("7.73 kA")
    choose_field(page, "voltageTolerance", "plus10")
    playwright.expect(maximum).to_have_text("8.1 kA")
    playwright.expect(page.locator(".wb-status")).not_to_contain_text("Altstand")


def legacy_breaker_network():
    """A 6.2-kA device passes the historical factor and fails the +10% case."""
    nodes = [
        {"id": "source", "kind": "source", "label": "Testquelle", "x": 80, "y": 100,
         "values": {"phases": "3", "voltage": "400", "maxCurrent": "160", "sourceMode": "impedance",
                    "r": "0.04", "x": "0", "loopKnown": "yes", "loopImpedance": "0.04", "limit": "4"}},
        {"id": "breaker", "kind": "protection", "label": "Schutz B16", "x": 360, "y": 100,
         "values": {"device": "LS", "curve": "B", "rated": "16", "icn": "6.2", "i2factor": "1.45"}},
        {"id": "load", "kind": "load", "label": "Testlast", "x": 640, "y": 100,
         "values": {"device": "general", "power": "5", "cosPhi": "1", "phases": "3", "phase": "L1", "diversity": "1"}},
    ]
    wire = {"length": "25", "material": "cu", "area": "2.5", "neutralArea": "same", "peArea": "same",
            "parallel": "1", "temperature": "55", "izMode": "manual", "iz": "20"}
    return {"version": 1, "name": "Spannungsfaktor-Prüffall", "orientation": "horizontal", "nodes": nodes,
            "edges": [{"id": "before", "from": "source", "to": "breaker", "values": {**wire, "length": "0.01", "area": "240", "iz": "100"}},
                      {"id": "after", "from": "breaker", "to": "load", "values": wire}]}


def test_network_tolerance_migration_and_breaker_threshold_are_visible_in_review(editor):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1200})
    open_network(page)
    page.get_by_role("button", name="Bauteil Einspeisung NS", exact=True).click()
    playwright.expect(selected_tolerance(page, "plus10")).to_have_attribute("aria-pressed", "true")

    page.locator(".np-file-input").set_input_files({
        "name": "historical-network.json", "mimeType": "application/json",
        "buffer": json.dumps(legacy_breaker_network()).encode(),
    })
    playwright.expect(page.get_by_label("Name des Netzplans", exact=True)).to_have_value("Spannungsfaktor-Prüffall")
    page.get_by_role("button", name="Bauteil Testquelle", exact=True).click()
    playwright.expect(selected_tolerance(page, "legacy")).to_have_attribute("aria-pressed", "true")
    review_network(page)
    issues = page.locator(".np-issue-list")
    playwright.expect(issues).to_contain_text("Altstand mit cmax = 1.05 übernommen")
    playwright.expect(issues).not_to_contain_text("Ausschaltvermögen am Gerät zu klein")

    page.get_by_role("button", name="Bauteil Testquelle", exact=True).click()
    choose_field(page, "voltageTolerance", "plus10")
    expect_review(page, "stale")
    playwright.expect(page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)).to_be_disabled()
    review_network(page)
    playwright.expect(issues).to_contain_text("Ausschaltvermögen am Gerät zu klein")
    playwright.expect(issues).not_to_contain_text("Altstand")

    page.get_by_role("button", name="Bauteil Testquelle", exact=True).click()
    choose_field(page, "voltageTolerance", "plus6")
    expect_review(page, "stale")
    review_network(page)
    playwright.expect(issues).not_to_contain_text("Ausschaltvermögen am Gerät zu klein")
