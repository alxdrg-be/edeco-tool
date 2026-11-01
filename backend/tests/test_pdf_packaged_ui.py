"""Embedded production UI with public browser traffic blocked, against the real EXE."""
import os
from pathlib import Path
from urllib.parse import urlsplit

import pytest

from test_documents import sample_pdf


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
            page.get_by_role('button', name='← Zur Toolbox', exact=True).click()
            expect(page.get_by_role('button', name=title + ' öffnen', exact=True)).to_be_visible()
        page.get_by_role('button', name='PDF-Werkstatt öffnen', exact=True).click()
        expect(page.get_by_text('Offline bereit · auf diesem Computer')).to_be_visible(timeout=180000)
        frame = page.frame_locator("iframe[title='Stirling-PDF · edeco PDF-Werkstatt']")
        picker = frame.locator('input[type=file]').first
        picker.wait_for(state='attached', timeout=60000)
        expect(page.get_by_role('img', name='edeco ag', exact=True)).to_have_count(1)
        expect(frame.locator('.sui-logo').first).to_be_hidden()
        expect(frame.locator('.sui-brandmark').first).to_be_hidden()
        for mode in ('dark', 'light'):
            page.get_by_role('button', name='Dunkler Modus' if mode == 'dark' else 'Heller Modus', exact=True).click()
            expect(frame.locator('html')).to_have_attribute('data-edeco-theme', mode)
            colors[mode].append(page.locator('.tool-header-title').evaluate('(el) => getComputedStyle(el).color'))
            assert len(set(colors[mode])) == 4, colors
        expect(frame.get_by_text('PDF mit Zeitstempel', exact=True)).to_have_count(0)
        picker.set_input_files([
            {'name': 'Plan-A.pdf', 'mimeType': 'application/pdf', 'buffer': sample_pdf([['FIRST PLAN']])},
            {'name': 'Plan-B.pdf', 'mimeType': 'application/pdf', 'buffer': sample_pdf([['SECOND PLAN']])},
        ])
        frame.get_by_text('Plan-B.pdf', exact=True).first.wait_for(timeout=30000)
        # Rendered page thumbnails exercise the actual bundled PDF.js/worker/WASM assets.
        preview = frame.get_by_alt_text('Vorschau von Plan-A.pdf', exact=True).first
        expect(preview).to_be_visible(timeout=30000)
        assert preview.evaluate('(img) => img.naturalWidth > 0')
        frame.get_by_text('Zusammenführen', exact=True).first.click()
        with page.expect_response(lambda response: response.url.endswith('/api/v1/general/merge-pdfs'), timeout=60000) as processing:
            frame.get_by_role('button', name='Zusammenführen (2 Dateien)', exact=True).click()
        assert processing.value.status == 200
        import pypdfium2 as pdfium
        with pdfium.PdfDocument(processing.value.body()) as doc:
            assert len(doc) == 2
        frame.get_by_text('merged_Plan-A.pdf', exact=True).first.wait_for(timeout=30000)
        frame.locator('label[for$="-viewer"]').click()
        rendered_page = frame.locator('img[src^="blob:"]').first
        expect(rendered_page).to_be_visible(timeout=30000)
        assert rendered_page.evaluate('(img) => img.naturalWidth > 200')
        Path('output').mkdir(exist_ok=True)
        page.screenshot(path='output/pdf-packaged-workshop.png', full_page=True)
        page.get_by_role('button', name='Info / Lizenzen', exact=True).click()
        info = page.frame_locator("iframe[title='Info / Lizenzen']")
        expect(info.get_by_role('heading', name='edeco PDF-Werkstatt · Info / Lizenzen')).to_be_visible()
        expect(info.get_by_role('link', name='java-source.tar.gz', exact=True)).to_be_visible()
        assert not external, external
        browser.close()
