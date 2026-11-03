"""Sample actual SVG positions so smooth updates cannot regress to instant jumps."""
from __future__ import annotations

import re

from test_editor_navigation import editor, env, playwright  # noqa: F401 - shared isolated fixtures


def cable_endpoint(page):
    curve = page.locator('svg[aria-label^="Leitungsmodell:"] path[stroke-width="3"][fill="none"]')
    return float(re.search(r"L745 ([\d.]+)", curve.get_attribute("d"))[1])


def test_cable_geometry_interpolates_cancels_and_respects_reduced_motion(editor):
    page, _, _, _ = editor
    page.emulate_media(reduced_motion="no-preference")
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    page.get_by_role("button", name="Kabelberechnung öffnen", exact=True).click()
    current = page.get_by_label("Laststrom I (A)", exact=True)
    playwright.expect(current).to_be_enabled()
    current.fill("16")
    page.wait_for_timeout(320)
    start = cable_endpoint(page)
    target = 315 + (start - 315) * 2

    current.fill("32")
    page.wait_for_timeout(70)
    between = cable_endpoint(page)
    assert start < between < target, (start, between, target)
    page.wait_for_timeout(280)
    assert abs(cable_endpoint(page) - target) < .001

    # A new input replaces the in-flight target rather than finishing an old one.
    current.fill("8")
    page.wait_for_timeout(40)
    current.fill("48")
    page.wait_for_timeout(310)
    target48 = 315 + (start - 315) * 3
    assert abs(cable_endpoint(page) - target48) < .001

    current.fill("")
    playwright.expect(page.locator('svg[aria-label^="Leitungsmodell:"]')).to_have_count(0)
    neutral = page.locator('svg[aria-label="Leitungsmodell ohne gültiges Berechnungsergebnis"]')
    playwright.expect(neutral).to_be_visible()
    assert neutral.locator(".lab-svg-wire").count() == 0

    page.emulate_media(reduced_motion="reduce")
    # Let the preference event reach React, then verify the next edit is immediate.
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(resolve))")
    current.fill("16")
    assert abs(cable_endpoint(page) - start) < .001
    current.fill("32")
    assert abs(cable_endpoint(page) - target) < .001
