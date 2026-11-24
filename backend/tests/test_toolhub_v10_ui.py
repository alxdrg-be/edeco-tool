"""The shared shell must preserve editor guards and project associations."""

from test_editor_navigation import editor, env, playwright  # noqa: F401


def test_global_palette_and_options_respect_unsaved_project(editor):
    page, _, _, _ = editor
    page.get_by_role('button', name='Zum Toolhub', exact=True).click()
    page.get_by_role('button', name='Projektzentrale öffnen', exact=True).click()
    page.get_by_role('button', name='Neues Projekt', exact=True).click()
    page.get_by_label('Projektnummer', exact=True).fill('V10-guard')
    page.get_by_label('Projektname', exact=True).fill('Nicht verlieren')
    page.keyboard.press('Control+k')
    palette = page.get_by_role('dialog', name='Im Toolhub finden', exact=True)
    palette.get_by_role('searchbox').fill('Rack-Dispo')
    palette.get_by_role('button', name='Rack-Dispo', exact=True).click()
    prompt = page.get_by_role('alertdialog', name='Projektänderungen speichern?')
    playwright.expect(prompt).to_be_visible()
    prompt.get_by_role('button', name='Hier bleiben', exact=True).click()
    playwright.expect(page.get_by_label('Projektname', exact=True)).to_have_value('Nicht verlieren')
    page.get_by_role('navigation', name='Toolhub-Navigation').get_by_role('button', name='Optionen', exact=True).click()
    playwright.expect(prompt).to_be_visible()
    playwright.expect(page.get_by_role('dialog', name='Toolhub-Einstellungen')).not_to_be_visible()
    prompt.get_by_role('button', name='Verwerfen und weiter', exact=True).click()
    playwright.expect(page.get_by_role('dialog', name='Toolhub-Einstellungen')).to_be_visible()
    playwright.expect(page.locator('.project-editor')).not_to_be_attached()


def test_palette_memory_route_and_header_stay_visible(editor):
    page, _, _, _ = editor
    page.get_by_role('button', name='Zum Toolhub', exact=True).click()
    playwright.expect(page.locator('.hub-chrome-corner')).to_have_css('background-color', 'rgb(1, 124, 146)')
    assert page.locator('.hub-header-top').bounding_box()['height'] <= 49
    for width in (1440, 1024, 760, 390):
        page.set_viewport_size({'width': width, 'height': 900})
        mark = page.locator('.toolhub-brand-mark')
        playwright.expect(mark).to_be_visible()
        assert mark.evaluate('el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }')
        playwright.expect(page.locator('.hub-wordmark')).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.set_viewport_size({'width': 1440, 'height': 900})
    page.keyboard.press('Control+k')
    dialog = page.get_by_role('dialog', name='Im Toolhub finden')
    dialog.get_by_role('searchbox').fill('Badewanne')
    dialog.get_by_role('button', name='Badewanne & Dusche').click()
    playwright.expect(page.get_by_role('heading', name='Badewanne & Dusche', exact=True)).to_be_visible()
    for width in (1440, 1024, 760, 390):
        page.set_viewport_size({'width': width, 'height': 900})
        back = page.get_by_role('button', name='Zum Toolhub', exact=True)
        box = back.bounding_box()
        assert box and box['x'] >= 0 and box['x'] + box['width'] <= width
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
    page.keyboard.press('Control+k')
    search = page.get_by_role('dialog', name='Im Toolhub finden').get_by_role('searchbox')
    search.focus()
    page.keyboard.press('Control+f')
    playwright.expect(search).to_be_focused()
