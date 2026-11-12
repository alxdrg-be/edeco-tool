"""Real reference tools: distinctive socket fronts, IP states and accessible explanations."""

import re

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_electro_memory_ui import open_chapter, open_memory


def open_reference(page, chapter):
    open_memory(page)
    open_chapter(page, chapter)


def test_socket_fronts_preserve_contact_shapes_and_show_selected_type(editor, tmp_path):
    page = editor[0]
    open_reference(page, "RCD, Schutzorgane & Stecksysteme")
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
    open_reference(page, "IP-Schutz & Kennzeichen")
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


def test_bath_zones_ik_lookup_and_ppe_caveats(editor, tmp_path):
    page = editor[0]
    open_reference(page, "Badewanne & Dusche")
    zones = page.locator("#memory-entry-em-p12-bath-zones")
    playwright.expect(zones.get_by_role("img")).to_have_attribute("aria-label", re.compile("Bereich 1 über der Wanne bis 2,25 m"))
    zones.get_by_role("button", name="Dusche ohne Wanne · Grundriss", exact=True).click()
    playwright.expect(zones.get_by_role("img")).to_have_attribute("aria-label", re.compile("1,2 m ab Wasserauslass"))
    playwright.expect(zones).to_contain_text("2,25 m ab Boden")
    playwright.expect(page.locator("#memory-entry-em-p12-bath-equipment")).to_contain_text("12 V AC / 30 V DC SELV")
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.screenshot(path=str(tmp_path / "memory-bath-zones.png"), full_page=True)
    open_chapter(page, "Messpraxis & Prüfungen")
    final = page.locator("#memory-entry-em-p06-disconnection-04s")
    final.get_by_role("group", name="Nennstrom wählen").get_by_role("button", name="16", exact=True).click()
    playwright.expect(final.locator("tr.is-picked")).to_contain_text("121")
    playwright.expect(final.locator("tr.is-dimmed").first).to_be_visible()
    open_chapter(page, "Sicherheitsregeln & PSA")
    ppe = page.locator("#memory-entry-em-p03-arc-ppe-levels")
    playwright.expect(ppe).to_contain_text("Arbeitsabstand")
    playwright.expect(ppe).to_contain_text("keine Schutzklasse oder Kleidungsfreigabe")
    playwright.expect(ppe).not_to_contain_text("Kurzarm zulässig")
    playwright.expect(page.locator("#memory-entry-em-p03-five-electrical-rules ol li")).to_have_count(5)
