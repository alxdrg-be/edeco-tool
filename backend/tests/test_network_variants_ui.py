"""Trial changes remain separate until explicit application in the real editor."""

import json

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_network_planner_ui import expect_review, open_network


def document_from_download(page):
    with page.expect_download() as download:
        page.get_by_role("button", name="Netzentwurf als JSON herunterladen", exact=True).click()
    return json.loads(download.value.path().read_text())["network"]


def open_line_variant(page):
    page.locator('[data-edge-id="line-3"] .np-edge-hit').click(force=True)
    panel = page.locator('[data-network-variant="edge:line-3"]')
    panel.locator(":scope > summary").click()
    return panel


def test_variant_preview_is_read_only_and_explicit_apply_has_current_review_and_undo(editor, tmp_path):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1100})
    open_network(page)
    original = document_from_download(page)
    panel = open_line_variant(page)
    panel.get_by_label("Variantenparameter", exact=True).select_option("area")
    panel.get_by_label("Wert der Variante", exact=True).select_option("10")
    panel.get_by_role("button", name="Gesamtes Netz als Variante prüfen", exact=True).click()
    comparison = panel.get_by_role("region", name="Variantenvergleich", exact=True)
    playwright.expect(comparison).to_contain_text("Gesamtnetz neu berechnet")
    playwright.expect(comparison).to_contain_text("Offene Kriterien")
    assert document_from_download(page) == original
    page.locator(".np-inspector").screenshot(path=str(tmp_path / "netzplan-variantenvergleich.png"))
    comparison.get_by_role("button", name="Variante übernehmen & neu prüfen", exact=True).click()
    changed = document_from_download(page)
    assert next(edge for edge in changed["edges"] if edge["id"] == "line-3")["values"]["area"] == "10"
    assert next(edge for edge in changed["edges"] if edge["id"] == "line-2") == next(
        edge for edge in original["edges"] if edge["id"] == "line-2"
    )
    expect_review(page, "current")
    page.get_by_role("button", name="Netzplan rückgängig", exact=True).click()
    assert document_from_download(page) == original
    expect_review(page, "stale")


def test_variant_rejects_stale_preview_and_does_not_apply_invalid_length(editor):
    page, _, _, _ = editor
    open_network(page)
    panel = open_line_variant(page)
    panel.get_by_label("Variantenparameter", exact=True).select_option("length")
    panel.get_by_label("Wert der Variante", exact=True).fill("10")
    panel.get_by_role("button", name="Gesamtes Netz als Variante prüfen", exact=True).click()
    comparison = panel.get_by_role("region", name="Variantenvergleich", exact=True)
    apply_button = comparison.get_by_role("button", name="Variante übernehmen & neu prüfen", exact=True)
    playwright.expect(apply_button).to_be_enabled()
    page.locator('[data-network-field="length"]').fill("30")
    playwright.expect(comparison).to_contain_text("Eingaben geändert")
    playwright.expect(apply_button).to_be_disabled()
    panel.get_by_label("Wert der Variante", exact=True).fill("-1")
    panel.get_by_role("button", name="Gesamtes Netz als Variante prüfen", exact=True).click()
    playwright.expect(comparison).to_contain_text("nicht berechenbar")
    playwright.expect(apply_button).to_be_disabled()
    actual = document_from_download(page)
    assert next(edge for edge in actual["edges"] if edge["id"] == "line-3")["values"]["length"] == "30"
