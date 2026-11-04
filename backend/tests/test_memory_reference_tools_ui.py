"""Real reference tools: distinctive socket fronts, IP states and accessible explanations."""

import re

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_electro_memory_ui import open_memory


def open_reference(page, title):
    open_memory(page)
    page.locator(".memory-reference-shortcuts").get_by_role("button", name=re.compile(title)).click()


def test_socket_fronts_preserve_contact_shapes_and_show_selected_type(editor, tmp_path):
    page = editor[0]
    open_reference(page, "Steckdosen erkennen")
    guide = page.get_by_role("region", name="Schweizer Steckdosen erkennen", exact=True)
    for kind, count, shape in [(13, 3, "round"), (23, 3, "rectangle"), (15, 5, "round"), (25, 5, "rectangle")]:
        front = guide.locator(f'[data-socket-type="{kind}"]')
        playwright.expect(front.locator(f'[data-contact="{shape}"]')).to_have_count(count)
        playwright.expect(front.locator("[data-contact]")).to_have_count(count)
    guide.get_by_role("button", name=re.compile("Typ 25")).click()
    playwright.expect(guide.locator(".memory-socket-result")).to_contain_text("3L + N + PE · 16 A / 250–400 V")
    trigger = guide.get_by_role("button", name="Steckdosentypen erklären", exact=True)
    trigger.click()
    dialog = page.get_by_role("dialog", name="Schweizer Steckdosentypen", exact=True)
    playwright.expect(dialog).to_be_visible()
    dialog.locator("summary").filter(has_text="Quelle und Stand").click()
    playwright.expect(dialog).to_contain_text("28.09.2025")
    page.keyboard.press("Escape")
    playwright.expect(dialog).to_have_count(0)
    playwright.expect(trigger).to_be_focused()
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
    page.screenshot(path=str(tmp_path / "memory-sockets.png"), full_page=True)
    page.get_by_role("button", name="Dunkler Modus", exact=True).click()
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
    page.screenshot(path=str(tmp_path / "memory-sockets-mobile-dark.png"), full_page=True)


def test_ip_decoder_differentiates_missing_and_zero_and_keeps_help_sections_independent(editor, tmp_path):
    page = editor[0]
    open_reference(page, "IP-Decoder")
    decoder = page.get_by_role("region", name="IP-Decoder", exact=True)
    code = decoder.get_by_label("Schutzart", exact=True)
    code.fill("IPX7")
    playwright.expect(decoder.get_by_role("button", name="Erste Kennziffer X erklären")).to_contain_text("Nicht angegeben")
    playwright.expect(decoder.locator(".memory-reference-callout")).to_contain_text("nicht automatisch IPX5 oder IPX6")
    water = decoder.get_by_role("button", name="Zweite Kennziffer 7 erklären", exact=True)
    water.click()
    dialog = page.get_by_role("dialog", name="IP-Schutzart verstehen", exact=True)
    playwright.expect(dialog).to_be_visible()
    # Native modal tab order includes the disclosure summaries, not just the close button.
    playwright.expect(dialog.get_by_role("button", name="Erklärung schliessen", exact=True)).to_be_focused()
    page.keyboard.press("Tab")
    playwright.expect(dialog.locator("summary").first).to_be_focused()
    first = dialog.locator("details").filter(has=page.locator("summary", has_text="Erste Kennziffer: Zugang und Fremdkörper"))
    second = dialog.locator("details").filter(has=page.locator("summary", has_text="Zweite Kennziffer: Wasser"))
    playwright.expect(second).to_have_attribute("open", "")
    first.locator("summary").click()
    playwright.expect(first).to_have_attribute("open", "")
    playwright.expect(second).to_have_attribute("open", "")
    dialog.get_by_role("button", name="Erklärung schliessen", exact=True).click()
    playwright.expect(water).to_be_focused()
    decoder.get_by_role("combobox", name="Erste IP-Kennziffer", exact=True).select_option("0")
    playwright.expect(code).to_have_value("IP07")
    playwright.expect(decoder.get_by_role("button", name="Erste Kennziffer 0 erklären")).to_contain_text("Kein Zugang-/Fremdkörperschutz")
    code.fill("IP69K")
    playwright.expect(code).to_have_attribute("aria-invalid", "true")
    playwright.expect(decoder.locator(".memory-ip-results")).to_have_count(0)
    code.fill("IP44")
    playwright.expect(code).to_have_attribute("aria-invalid", "false")
    page.set_viewport_size({"width": 390, "height": 844})
    decoder.get_by_role("button", name="IP-Schutzart erklären", exact=True).click()
    playwright.expect(dialog).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.screenshot(path=str(tmp_path / "memory-ip-panel-mobile.png"))


def test_bath_reference_does_not_draw_unverified_zones_and_favorite_survives_reload(editor, tmp_path):
    page = editor[0]
    open_reference(page, "Bad und Dusche")
    reference = page.get_by_role("region", name="Bad und Dusche: Geometrie und Quelle", exact=True)
    playwright.expect(reference).to_contain_text("Zonengeometrie: Normabgleich offen.")
    reference.get_by_role("button", name="Dusche ohne Tasse", exact=True).click()
    reference.get_by_role("checkbox", name="Feste Abtrennung anzeigen", exact=True).check()
    playwright.expect(reference.get_by_role("img")).to_have_attribute("aria-label", re.compile("Dusche ohne Tasse mit fester Abtrennung.*ohne normativ bestätigte Bereichsgrenzen"))
    assert reference.locator('[data-bath-zone]').count() == 0
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
    page.screenshot(path=str(tmp_path / "memory-bath-reference.png"), full_page=True)
    page.get_by_role("button", name="Als Favorit merken", exact=True).click()
    page.get_by_role("button", name="Alle Themen", exact=True).click()
    page.get_by_role("button", name="Favoriten (1)", exact=True).click()
    playwright.expect(page.locator(".memory-topic-card")).to_have_count(1)
    page.reload()
    page.get_by_role("button", name="Favoriten (1)", exact=True).click()
    playwright.expect(page.locator(".memory-topic-card")).to_have_count(1)
    playwright.expect(page.get_by_role("heading", name="Badewanne und Dusche", exact=True)).to_be_visible()
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.screenshot(path=str(tmp_path / "memory-favorites.png"), full_page=True)
    page.get_by_role("heading", name="Badewanne und Dusche", exact=True).click()
    page.get_by_role("combobox", name="Thema wechseln", exact=True).select_option("em-safety-rules")
    ppe = page.locator("#memory-entry-em-p03-arc-ppe-levels")
    ppe.locator("summary").first.click()
    playwright.expect(ppe).to_contain_text("Arbeitsabstand")
    playwright.expect(ppe).to_contain_text("keine Schutzklasse oder Kleidungsfreigabe")
    playwright.expect(ppe).not_to_contain_text("Kurzarm zulässig")
