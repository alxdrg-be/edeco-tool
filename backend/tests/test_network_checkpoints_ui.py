"""The eleven checklist rows show real failures and keep missing proofs open."""

import os
import re
from pathlib import Path

from test_documents_local_ui import documents_browser, env, playwright  # noqa: F401
from test_network_guidance_ui import example_document, import_document
from test_network_planner_ui import open_network, review_network


def test_eleven_model_checkpoints_show_green_red_and_open_without_global_approval(documents_browser):
    page, _, _, _, _ = documents_browser
    page.set_viewport_size({"width": 1680, "height": 1250})
    open_network(page)
    review_network(page)
    rows = page.locator("[data-network-checkpoint]")
    playwright.expect(rows).to_have_count(11)
    playwright.expect(page.locator('[data-network-checkpoint="conductors"]')).to_have_attribute("data-checkpoint-status", "passed")
    for key in ["pen", "inductance", "coordination", "disconnection", "cable-short-circuit", "rcd-sockets"]:
        row = page.locator(f'[data-network-checkpoint="{key}"]')
        playwright.expect(row).to_have_attribute("data-checkpoint-status", "open")
        row.locator(":scope > summary").click()
        playwright.expect(row.locator(".np-checkpoint-body")).to_be_visible()
        assert row.locator(".np-checkpoint-body").inner_text().strip()
        row.locator(":scope > summary").click()
    playwright.expect(page.locator("[data-checkpoint-overall]")).to_have_attribute("data-checkpoint-overall", "open")
    playwright.expect(page.locator(".np-network-status")).to_have_class(re.compile("np-tone-warning"))
    directory = os.environ.get("DOCUMENTS_REVIEW_DIR")
    if directory:
        path = Path(directory)
        path.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(path / "07-netzplaner-elf-pruefpunkte.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".np-inspector").evaluate("el => el.scrollWidth <= el.clientWidth + 1")


def test_red_overload_checkpoint_opens_exact_field_and_requires_a_new_check_after_edit(documents_browser):
    page, _, _, _, _ = documents_browser
    page.set_viewport_size({"width": 1680, "height": 1250})
    open_network(page)
    document = example_document(page)
    edge = document["edges"][-1]
    edge["values"]["iz"] = "15"
    document["nodes"][0]["values"]["limit"] = "0.1"
    import_document(page, document)
    review_network(page)
    overload = page.locator('[data-network-checkpoint="overcurrent"]')
    playwright.expect(overload).to_have_attribute("data-checkpoint-status", "failed")
    playwright.expect(page.locator('[data-network-checkpoint="voltage-drop"]')).to_have_attribute("data-checkpoint-status", "failed")
    overload.locator(":scope > summary").click()
    overload.get_by_role("button", name=re.compile("Schutznennstrom")).click()
    inspector = page.locator(".np-inspector")
    playwright.expect(inspector).to_have_attribute("data-network-selection", f'edge:{edge["id"]}')
    field = inspector.locator('[data-network-field="iz"]')
    playwright.expect(field).to_be_focused()
    playwright.expect(field).to_have_value("15")
    playwright.expect(inspector.locator(".np-active-diagnostic")).to_contain_text("Erforderlich")
    field.fill("20")
    playwright.expect(page.locator("[data-network-review-state]").first).to_have_attribute("data-network-review-state", "stale")
    review_network(page)
    playwright.expect(overload).to_have_attribute("data-checkpoint-status", "open")
    # The separate path-drop failure and missing proofs must not disappear.
    playwright.expect(page.locator('[data-network-checkpoint="voltage-drop"]')).to_have_attribute("data-checkpoint-status", "failed")
    playwright.expect(page.locator('[data-network-checkpoint="cable-short-circuit"]')).to_have_attribute("data-checkpoint-status", "open")
