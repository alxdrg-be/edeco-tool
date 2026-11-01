"""Own PDF workspace against a running local host, with public browser traffic blocked."""
import os
from pathlib import Path
from urllib.parse import urlsplit

import pytest

from test_documents import sample_pdf


def assert_button_contrast(page):
    import re
    def luminance(color):
        channels = [float(value) / 255 for value in re.findall(r'[\d.]+', color)[:3]]
        return sum(weight * (value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4)
                   for weight, value in zip((.2126, .7152, .0722), channels))
    for button in page.locator('.pdf-workshop .btn').all():
        if button.is_visible():
            colors = button.evaluate('(el) => {const s=getComputedStyle(el); return [s.color,s.backgroundColor];}')
            values = sorted(luminance(color) for color in colors)
            ratio = (values[1] + .05) / (values[0] + .05)
            assert ratio >= 4.5, (button.inner_text(), colors, ratio)


@pytest.mark.skipif(not os.environ.get('EDECO_TEST_TOOLBOX_URL'), reason='Running packaged Toolbox required')
def test_packaged_workshop_preview_merge_branding_and_licenses():
    from playwright.sync_api import sync_playwright, expect
    from test_editor_navigation import launch_chromium
    url = os.environ['EDECO_TEST_TOOLBOX_URL']
    with sync_playwright() as playwright:
        browser = launch_chromium(playwright)
        page = browser.new_page(viewport={'width': 1400, 'height': 1000}, color_scheme='light')
        external = []
        def guard(route):
            target = urlsplit(route.request.url)
            if target.scheme in ('http', 'https') and target.hostname not in ('127.0.0.1', 'localhost'):
                external.append(route.request.url); route.abort()
            else:
                route.continue_()
        page.route('**/*', guard)
        page.goto(url)
        # The real packaged modules share one header, logo and theme control.
        colors = {'light': [], 'dark': []}
        for title in ('NOVA-Legenden', 'BIM2STEIGER', 'Dokumenten-Assistent'):
            page.get_by_role('button', name=title + ' öffnen', exact=True).click()
            expect(page.locator('.tool-header')).to_be_visible()
            expect(page.get_by_role('img', name='edeco ag', exact=True)).to_have_count(1)
            if title == 'NOVA-Legenden':
                expect(page.get_by_role('heading', name='Deine Projekte', exact=True)).to_be_visible()
            if page.get_by_role('button', name='Heller Modus', exact=True).is_visible():
                page.get_by_role('button', name='Heller Modus', exact=True).click()
            for mode in ('dark', 'light'):
                page.get_by_role('button', name='Dunkler Modus' if mode == 'dark' else 'Heller Modus', exact=True).click()
                expect(page.locator('html')).to_have_attribute('data-theme', mode)
                colors[mode].append(page.locator('.tool-header-title').evaluate('(el) => getComputedStyle(el).color'))
                if title == 'BIM2STEIGER':
                    bim = page.frame_locator("iframe[title='BIM2STEIGER']")
                    expect(bim.locator('html')).to_have_attribute('data-theme', mode)
                    expect(bim.locator('.brand-group')).to_be_hidden()
            if title == 'BIM2STEIGER':
                expect(bim.locator('#homeView')).to_be_visible()
                bim_frame = next(child for child in page.frames if '/tools/bim2steiger/' in child.url)
                bim_frame.wait_for_function('window.edecoToolbox && pendingToolRequests === 0')
            page.get_by_role('button', name='← Zur Toolbox', exact=True).click()
            expect(page.get_by_role('button', name=title + ' öffnen', exact=True)).to_be_visible()
        page.get_by_role('button', name='PDF-Werkstatt öffnen', exact=True).click()
        expect(page.get_by_role('button', name='PDFs organisieren', exact=True)).to_be_enabled(timeout=180000)
        page.get_by_role('button', name='Info / Lizenzen', exact=True).click()
        info = page.frame_locator("iframe[title='Info / Lizenzen']")
        expect(info.get_by_role('heading', name='edeco PDF-Werkstatt · Info / Lizenzen')).to_be_visible()
        expect(info.get_by_role('link', name='java-source.tar.gz', exact=True)).to_be_visible()
        page.get_by_role('button', name='Info schliessen', exact=True).click()
        page.get_by_role('button', name='PDFs organisieren', exact=True).click()
        expect(page.get_by_role('heading', name='Jedes PDF hat seinen Platz.')).to_be_visible()
        expect(page.get_by_role('img', name='edeco ag', exact=True)).to_have_count(1)
        Path('output/ui-preview').mkdir(parents=True, exist_ok=True)
        page.screenshot(path='output/ui-preview/edeco-pdf-rows-empty.png')
        for mode in ('dark', 'light'):
            page.get_by_role('button', name='Dunkler Modus' if mode == 'dark' else 'Heller Modus', exact=True).click()
            assert_button_contrast(page)
            colors[mode].append(page.locator('.tool-header-title').evaluate('(el) => getComputedStyle(el).color'))
            assert len(set(colors[mode])) == 4, colors
        picker = page.get_by_label('PDF-Dateien hinzufügen', exact=True)
        picker.set_input_files([
            {'name': 'Elektroplanung.pdf', 'mimeType': 'application/pdf', 'buffer': sample_pdf([['FIRST PLAN', 'Projekt Sonnenhof - Elektroplanung'], ['REMOVE THIS PAGE']])},
            {'name': 'Pruefprotokoll.pdf', 'mimeType': 'application/pdf', 'buffer': sample_pdf([['SECOND PLAN', 'Projekt Sonnenhof - Pruefprotokoll']])},
        ])
        cards = page.locator('.pdf-page-card')
        expect(cards).to_have_count(3)
        expect(page.locator('.pdf-document-row')).to_have_count(2)
        expect(page.get_by_role('heading', name='Elektroplanung.pdf', exact=True)).to_be_visible()
        expect(page.get_by_role('heading', name='Pruefprotokoll.pdf', exact=True)).to_be_visible()
        for thumbnail in page.locator('.pdf-page-card img').all():
            assert thumbnail.evaluate('(img) => img.complete && img.naturalWidth > 100')
        expect(page.locator('.pdf-page-card[aria-pressed="true"]')).to_have_count(0)
        page.screenshot(path='output/ui-preview/edeco-pdf-rows-neutral.png')
        page.get_by_role('button', name='Pruefprotokoll.pdf, Position 1: Pruefprotokoll.pdf, Seite 1', exact=True).click()
        row = page.get_by_role('region', name='Pruefprotokoll.pdf', exact=True)
        selected_card = row.locator('.pdf-page-card[aria-pressed="true"]')
        expect(selected_card).to_have_css('border-top-color', row.evaluate('(el) => getComputedStyle(el).borderLeftColor'))
        expect(selected_card).to_have_css('background-color', page.locator('.pdf-source.is-current').evaluate('(el) => getComputedStyle(el).backgroundColor'))
        page.get_by_role('button', name='Dunkler Modus', exact=True).click()
        page.wait_for_timeout(200)
        page.locator('.pdf-page-workspace').evaluate('(el) => { el.scrollTop = 0; }')
        page.screenshot(path='output/ui-preview/edeco-pdf-rows-dark.png')
        page.get_by_role('button', name='Heller Modus', exact=True).click()
        page.get_by_role('button', name='Pruefprotokoll.pdf: Reihe nach oben', exact=True).click()
        expect(page.locator('.pdf-document-row').first.get_by_role('heading')).to_have_text('Pruefprotokoll.pdf')
        page.get_by_role('button', name='↶ Rückgängig', exact=True).click()
        second_row = page.get_by_role('region', name='Pruefprotokoll.pdf', exact=True)
        second_row.get_by_role('button', name='PDF erstellen', exact=True).click()
        expect(page.locator('.pdf-result strong')).to_contain_text('1 Seite')
        with page.expect_download() as single_download:
            page.get_by_role('link', name='PDF herunterladen', exact=True).click()
        import pypdfium2 as pdfium
        from contextlib import closing
        with pdfium.PdfDocument(single_download.value.path()) as single:
            assert len(single) == 1
            with closing(single[0]) as single_page, closing(single_page.get_textpage()) as text:
                assert 'SECOND PLAN' in text.get_text_range()
        page.get_by_role('button', name='Pruefprotokoll.pdf, Position 1: Pruefprotokoll.pdf, Seite 1', exact=True).drag_to(cards.first)
        expect(cards.first).to_have_attribute('aria-label', 'Elektroplanung.pdf, Position 1: Pruefprotokoll.pdf, Seite 1')
        expect(cards.first.locator('.pdf-page-origin')).to_have_text('PDF 2 · S. 1')
        first_row = page.get_by_role('region', name='Elektroplanung.pdf', exact=True)
        expect(cards.first).to_have_css('border-top-color', first_row.evaluate('(el) => getComputedStyle(el).borderLeftColor'))
        page.get_by_role('button', name='↻ Drehen', exact=True).click()
        expect(cards.first).to_contain_text('90° gedreht')
        page.get_by_role('button', name='Elektroplanung.pdf, Position 3: Elektroplanung.pdf, Seite 2', exact=True).click()
        page.get_by_role('button', name='Entfernen', exact=True).click()
        expect(cards).to_have_count(2)
        page.get_by_role('button', name='↶ Rückgängig', exact=True).click()
        expect(cards).to_have_count(3)
        page.get_by_role('button', name='Elektroplanung.pdf, Position 3: Elektroplanung.pdf, Seite 2', exact=True).click()
        page.get_by_role('button', name='Entfernen', exact=True).click()
        page.get_by_role('button', name='Elektroplanung.pdf, Position 1: Pruefprotokoll.pdf, Seite 1', exact=True).click()
        page.get_by_role('button', name='Elektroplanung.pdf, Position 2: Elektroplanung.pdf, Seite 1', exact=True).click(modifiers=['Control'])
        expect(page.locator('.pdf-page-card[aria-pressed="true"]')).to_have_count(2)
        page.get_by_role('button', name='＋ Neue Zusammenstellung', exact=True).click()
        expect(page.get_by_role('region', name='Neue Zusammenstellung 1.pdf', exact=True).locator('.pdf-page-card')).to_have_count(2)
        page.get_by_role('button', name='↶ Rückgängig', exact=True).click()
        expect(page.locator('.pdf-document-row')).to_have_count(2)
        page.get_by_label('Miniaturen', exact=True).fill('210')
        expect(cards.first).to_have_css('width', '210px')
        page.get_by_label('Dateiname', exact=True).fill('Projekt Sonnenhof - Freigabe')
        with page.expect_response(lambda response: response.url.endswith('/api/tools/pdf-werkstatt/compose'), timeout=90000) as processing:
            page.get_by_role('button', name='↓ PDF erstellen', exact=True).click()
        assert processing.value.status == 200, processing.value.text()
        expect(page.get_by_role('link', name='PDF herunterladen', exact=True)).to_be_visible()
        with page.expect_download() as download:
            page.get_by_role('link', name='PDF herunterladen', exact=True).click()
        assert download.value.suggested_filename == 'Projekt Sonnenhof - Freigabe.pdf'
        import pypdfium2 as pdfium
        from contextlib import closing
        with pdfium.PdfDocument(download.value.path()) as doc:
            assert len(doc) == 2
            with closing(doc[0]) as first, closing(first.get_textpage()) as text:
                assert 'SECOND PLAN' in text.get_text_range()
                assert first.get_size() == (842, 595)
            with closing(doc[1]) as second, closing(second.get_textpage()) as text:
                assert 'FIRST PLAN' in text.get_text_range()
                assert 'REMOVE' not in text.get_text_range()
        page.locator('.pdf-page-workspace').evaluate('(el) => { el.scrollTop = 0; }')
        page.screenshot(path='output/ui-preview/edeco-pdf-rows-result-light.png')
        page.get_by_role('button', name='← Zur Toolbox', exact=True).click()
        expect(page.get_by_role('alertdialog', name='Ergebnisse gespeichert?')).to_be_visible()
        page.get_by_role('button', name='Zur Toolbox wechseln', exact=True).click()
        expect(page.get_by_role('heading', name='Ein Ort. Deine Werkzeuge.')).to_be_visible()
        assert not external, external
        browser.close()

@pytest.mark.skipif(not os.environ.get('EDECO_TEST_TOOLBOX_URL'), reason='Running local Toolbox required')
def test_cross_row_selection_deletion_undo_and_only_used_uploads():
    from playwright.sync_api import sync_playwright, expect
    from test_editor_navigation import launch_chromium
    with sync_playwright() as playwright:
        browser = launch_chromium(playwright)
        page = browser.new_page(viewport={'width': 1400, 'height': 1100})
        page.add_init_script('''window.pdfUploads = []; const originalFetch = window.fetch.bind(window);
            window.fetch = (url, options) => {
                if (String(url).endsWith('/compose') && options?.body instanceof FormData)
                    window.pdfUploads.push(options.body.getAll('files').map(file => file.name));
                return originalFetch(url, options);
            };''')
        page.goto(os.environ['EDECO_TEST_TOOLBOX_URL'])
        page.get_by_role('button', name='PDF-Werkstatt öffnen', exact=True).click()
        page.get_by_role('button', name='PDFs organisieren', exact=True).click(timeout=90000)
        picker = page.get_by_label('PDF-Dateien hinzufügen', exact=True)
        picker.set_input_files([
            {'name': 'Alpha.pdf', 'mimeType': 'application/pdf', 'buffer': sample_pdf([['ALPHA ONE'], ['ALPHA TWO']])},
            {'name': 'Beta.pdf', 'mimeType': 'application/pdf', 'buffer': sample_pdf([['BETA ONE'], ['BETA TWO']])},
        ])
        a = page.get_by_role('region', name='Alpha.pdf', exact=True)
        b = page.get_by_role('region', name='Beta.pdf', exact=True)
        expect(b.locator('.pdf-page-card')).to_have_count(2)
        a.locator('.pdf-page-card').first.click()
        b.locator('.pdf-page-card').last.click(modifiers=['Control'])
        page.get_by_role('button', name='Seite nach vorne', exact=True).click()
        expect(a.locator('.pdf-page-card')).to_have_count(2)
        expect(b.locator('.pdf-page-card').first).to_have_attribute('aria-label', 'Beta.pdf, Position 1: Beta.pdf, Seite 2')
        page.get_by_role('button', name='Seite nach hinten', exact=True).click()
        expect(b.locator('.pdf-page-card').first).to_have_attribute('aria-label', 'Beta.pdf, Position 1: Beta.pdf, Seite 1')
        b.locator('.pdf-page-card').last.drag_to(a.locator('.pdf-row-drop'))
        expect(a.locator('.pdf-page-card')).to_have_count(3)
        expect(a.locator('.pdf-page-card').first).to_have_attribute('aria-label', 'Alpha.pdf, Position 1: Alpha.pdf, Seite 1')
        expect(a.locator('.pdf-page-card').nth(1)).to_have_attribute('aria-label', 'Alpha.pdf, Position 2: Alpha.pdf, Seite 2')
        expect(b.locator('.pdf-page-card')).to_have_count(1)
        b.locator('.pdf-page-card').first.click()
        target = page.get_by_label('Zielreihe', exact=True)
        target.focus(); target.press('Home'); target.press('ArrowDown'); target.press('Enter')
        page.get_by_role('button', name='Auswahl verschieben', exact=True).focus()
        page.keyboard.press('Enter')
        expect(a.locator('.pdf-page-card')).to_have_count(4)
        expect(b.locator('.pdf-page-card')).to_have_count(0)
        page.get_by_role('button', name='Beta.pdf: Dokument entfernen', exact=True).click()
        expect(page.locator('.pdf-document-row')).to_have_count(1)
        page.get_by_role('button', name='Alpha.pdf: Dokument entfernen', exact=True).click()
        expect(page.locator('.pdf-source')).to_have_count(0)
        page.get_by_role('button', name='↶ Rückgängig', exact=True).click()
        expect(a.locator('.pdf-page-card')).to_have_count(4)
        # Undo restores both original files, even though Beta's former row was removed.
        expect(page.locator('.pdf-source')).to_have_count(2)
        with page.expect_response(lambda response: response.url.endswith('/compose')) as result:
            a.get_by_role('button', name='PDF erstellen', exact=True).click()
        assert result.value.status == 200
        assert page.evaluate('window.pdfUploads.at(-1)') == ['Alpha.pdf', 'Beta.pdf']
        page.get_by_role('button', name='Alpha.pdf: Dokument entfernen', exact=True).click()
        picker.set_input_files({'name': 'Gamma.pdf', 'mimeType': 'application/pdf', 'buffer': sample_pdf([['GAMMA ONLY']])})
        expect(page.locator('.pdf-page-card')).to_have_count(1)
        expect(page.locator('.pdf-source')).to_have_count(1)
        expect(page.locator('.pdf-document-row')).to_have_count(1)
        page.locator('.pdf-page-card').click()
        page.get_by_role('button', name='Entfernen', exact=True).click()
        expect(page.locator('.pdf-source')).to_have_count(0)
        page.get_by_role('button', name='↶ Rückgängig', exact=True).click()
        expect(page.locator('.pdf-source')).to_have_count(1)
        with page.expect_response(lambda response: response.url.endswith('/compose')) as result:
            page.get_by_role('region', name='Gamma.pdf', exact=True).get_by_role('button', name='PDF erstellen', exact=True).click()
        assert result.value.status == 200
        assert page.evaluate('window.pdfUploads.at(-1)') == ['Gamma.pdf']
        page.screenshot(path='output/ui-preview/pdf-review-fixed.png')
        browser.close()
