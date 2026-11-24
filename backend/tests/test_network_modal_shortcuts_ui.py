"""Global and archive dialogs must never edit the network behind them."""
import re

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_network_planner_ui import open_network


def test_network_shortcuts_pause_for_global_and_archive_dialogs_and_prevented_events(editor):
    page, _, _, _ = editor
    open_network(page)
    page.get_by_role("button", name="Allgemeine Last hinzufügen", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(5)
    selected = page.locator(".np-node.np-selected")
    selected_id = selected.get_attribute("data-node-id")
    assert selected_id
    selected = page.locator(f'.np-node[data-node-id="{selected_id}"]')
    connect = page.get_by_role("button", name="Leitungen verbinden", exact=True)

    def expect_unchanged():
        playwright.expect(page.locator(".np-node")).to_have_count(5)
        playwright.expect(page.locator(".np-edge")).to_have_count(3)
        playwright.expect(selected).to_have_class(re.compile(r"\bnp-selected\b"))
        playwright.expect(connect).to_have_attribute("aria-pressed", "false")

    def probe_dialog_shortcuts():
        for key in ("Delete", "Backspace", "Control+z", "Control+Shift+z", "Control+y", "c"):
            page.keyboard.press(key)
            expect_unchanged()

    selected.focus()
    page.keyboard.press("Control+k")
    search = page.get_by_role("dialog", name="Im Toolhub finden", exact=True)
    playwright.expect(search).to_be_visible()
    page.keyboard.press("ArrowDown")
    playwright.expect(search.locator(".hub-command-result:focus")).to_have_count(1)
    probe_dialog_shortcuts()
    page.keyboard.press("Escape")
    playwright.expect(search).not_to_be_visible()
    expect_unchanged()

    # This drawer is owned by LabShell, outside NetworkPlanner's own help state.
    # It exercises the network's modal guard independently of palette propagation.
    page.get_by_role("button", name="Projektbezogen auf Server speichern", exact=True).click()
    archive = page.get_by_role("dialog", name="Projektbezogen speichern", exact=True)
    playwright.expect(archive).to_be_visible()
    close = archive.get_by_role("button", name="Information schliessen", exact=True)
    close.focus()
    probe_dialog_shortcuts()
    close.click()
    playwright.expect(archive).not_to_be_visible()
    expect_unchanged()

    selected.focus()
    page.evaluate("""() => document.addEventListener('keydown', event => {
        if (event.key === 'Delete') event.preventDefault();
    }, {capture: true, once: true})""")
    page.keyboard.press("Delete")
    expect_unchanged()
    # Normal editing resumes immediately once dialogs are gone.
    page.keyboard.press("Delete")
    playwright.expect(page.locator(".np-node")).to_have_count(4)
    page.keyboard.press("Control+z")
    playwright.expect(page.locator(".np-node")).to_have_count(5)
    page.keyboard.press("Control+y")
    playwright.expect(page.locator(".np-node")).to_have_count(4)
    playwright.expect(page.locator(".np-edge")).to_have_count(3)
