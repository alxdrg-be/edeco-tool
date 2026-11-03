"""Embedded production UI with public browser traffic blocked, against the real EXE."""
import os
import json
from contextlib import contextmanager, closing
from pathlib import Path
from urllib.parse import urlsplit

import pytest

from test_documents import sample_pdf


@contextmanager
def capture_pdf_ui_failure(page):
    """Keep the actual Windows frame/asset failure, rather than only a timeout."""
    trace = {"console": [], "page_errors": [], "request_failures": [], "asset_responses": []}
    page.on('console', lambda message: trace['console'].append({'level': message.type, 'text': message.text}))
    page.on('pageerror', lambda error: trace['page_errors'].append(str(error)))
    page.on('requestfailed', lambda request: trace['request_failures'].append({'url': request.url, 'error': request.failure}))

    def response_seen(response):
        if response.status >= 400 or any(part in response.url.lower() for part in ('pdfium', 'pdfjs', 'worker', '.wasm', '.woff', 'cmaps')):
            trace['asset_responses'].append({'url': response.url, 'status': response.status,
                                             'type': response.headers.get('content-type', '')})

    page.on('response', response_seen)
    try:
        yield
    except Exception as exc:
        folder = Path('output') / 'pdf-packaged-failure'
        folder.mkdir(parents=True, exist_ok=True)
        trace['exception'] = repr(exc)
        trace['frames'] = []
        try:
            page.screenshot(path=str(folder / 'page.png'), full_page=True)
        except Exception as screenshot_error:
            trace['screenshot_error'] = repr(screenshot_error)
        for index, frame in enumerate(page.frames):
            if '/tools/pdf-werkstatt' not in frame.url:
                continue
            item = {'url': frame.url}
            try:
                (folder / f'core-frame-{index}.html').write_text(frame.content(), encoding='utf-8')
                item['render_state'] = frame.evaluate('''() => ({
                  viewport:{width:innerWidth,height:innerHeight,visibility:document.visibilityState},
                  images:[...document.images].map(node=>({alt:node.alt,complete:node.complete,width:node.naturalWidth,height:node.naturalHeight,rect:node.getBoundingClientRect().toJSON(),src:node.src.slice(0,160)})),
                  canvases:[...document.querySelectorAll('canvas')].map(node=>({width:node.width,height:node.height,rect:node.getBoundingClientRect().toJSON()})),
                  views:[...document.querySelectorAll('label[for$="-fileEditor"],label[for$="-viewer"]')].map(node=>({for:node.htmlFor,active:node.dataset.active,text:node.textContent})),
                  preferences:Object.fromEntries(Object.entries(localStorage).filter(([key])=>/view|thumb|sidebar|pdfjs|worker/i.test(key)&&!/auth|token|secret|session/i.test(key)))
                })''')
            except Exception as frame_error:
                item['capture_error'] = repr(frame_error)
            trace['frames'].append(item)
        (folder / 'diagnostics.json').write_text(json.dumps(trace, ensure_ascii=False, indent=2), encoding='utf-8')
        raise


def exercise_native_default_merge(page):
    """Exercise the actual EXE's default page editor before entering Core."""
    from playwright.sync_api import expect
    import pypdfium2 as pdfium
    native = page.locator('.pdf-native-workspace:not([hidden])')
    expect(native.get_by_role('heading', name='Seiten zusammenstellen', exact=True)).to_be_visible()
    expect(page.locator('.pdf-embedded-workspace')).to_be_hidden()
    native.get_by_label('PDF-Dateien hinzufügen', exact=True).set_input_files([
        {'name': 'Plan-A.pdf', 'mimeType': 'application/pdf', 'buffer': sample_pdf([['FIRST PLAN']])},
        {'name': 'Plan-B.pdf', 'mimeType': 'application/pdf', 'buffer': sample_pdf([['SECOND PLAN']])},
    ])
    expect(native.locator('.pdf-page-card')).to_have_count(2)
    for image in native.locator('.pdf-page-card img').all():
        expect(image).to_be_visible()
        expect(image).to_have_js_property('complete', True)
        assert image.evaluate('node => node.naturalWidth > 200')
    with page.expect_response(lambda response: response.request.method == 'POST' and response.url.endswith('/api/tools/pdf-werkstatt/compose'), timeout=60000) as processing:
        native.get_by_role('button', name='↓ PDF erstellen', exact=True).click()
    assert processing.value.status == 200
    assert processing.value.headers.get('content-type', '').split(';', 1)[0] == 'application/pdf'
    expect(native.get_by_role('link', name='PDF herunterladen', exact=True)).to_be_visible()
    Path('output').mkdir(exist_ok=True)
    target = Path('output') / 'pdf-packaged-native-merge.pdf'
    with page.expect_download() as downloaded:
        native.get_by_role('link', name='PDF herunterladen', exact=True).click()
    downloaded.value.save_as(target)
    with pdfium.PdfDocument(target) as result:
        assert len(result) == 2
        for index, expected in enumerate(('FIRST PLAN', 'SECOND PLAN')):
            with closing(result[index]) as sheet, closing(sheet.get_textpage()) as text:
                assert expected in text.get_text_range()


def exercise_tool_first_drop_and_native_crop(page):
    """Shared real-Core contract, also exercised locally against the locked image."""
    from playwright.sync_api import expect
    import pypdfium2 as pdfium
    frame = page.frame_locator("iframe[title='Stirling-PDF · edeco PDF-Werkstatt']")
    Path('output').mkdir(exist_ok=True)
    page.get_by_role('button', name='Werkzeugauswahl', exact=True).click()
    # A real drag into the catalogue must wait for a tool and hand the file
    # into Core without browser navigation or resetting the open library.
    transfer = page.evaluate_handle('''bytes => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], 'Abgelegter Plan.pdf', {type:'application/pdf'}));
      return transfer;
    }''', list(sample_pdf([['QUEUED VECTOR PLAN']])))
    for event in ('dragenter', 'dragover', 'drop'):
        page.locator('.pdf-tool-home').dispatch_event(event, {'dataTransfer': transfer})
    expect(page.get_by_role('status').filter(has_text='Eine PDF ist bereit')).to_be_visible()
    expect(page.get_by_role('heading', name='Was möchtest du mit deinem PDF tun?', exact=True)).to_be_visible()
    page.locator('[data-pdf-tool="read"]').click()
    expect(frame.get_by_text('Abgelegter Plan.pdf', exact=True).first).to_be_visible(timeout=30000)
    rendered = frame.locator('canvas:visible, img[src^="blob:"]:visible').first
    expect(rendered).to_be_visible(timeout=30000)
    assert rendered.evaluate('node => node.getBoundingClientRect().height > 100')
    expect(frame.locator('.edeco-settings-control')).to_be_hidden()
    # The inner Core crop action must open the same full-size native editor,
    # carrying the single imported PDF instead of showing Core's old modal.
    page.get_by_role('button', name='Werkzeugauswahl', exact=True).click()
    page.get_by_role('button', name='Alle Funktionen', exact=True).click()
    frame.locator('[data-tour="tool-button-crop"]').click()
    expect(page.locator('.pdf-embedded-workspace')).to_be_hidden()
    expect(page.get_by_role('img', name='PDF-Seite 1 von Abgelegter Plan.pdf', exact=True)).to_be_visible(timeout=30000)
    page.get_by_label('Rand links (mm)', exact=True).fill('5')
    with page.expect_download() as cropped:
        page.get_by_role('button', name='Zuschneiden & speichern', exact=True).click()
    cropped.value.save_as('output/pdf-packaged-native-crop.pdf')
    with pdfium.PdfDocument('output/pdf-packaged-native-crop.pdf') as result:
        assert len(result) == 1


@pytest.mark.skipif(not os.environ.get('EDECO_TEST_TOOLBOX_URL'), reason='Running packaged Toolbox required')
def test_packaged_workshop_preview_merge_branding_and_licenses():
    from playwright.sync_api import sync_playwright, expect
    from test_editor_navigation import launch_chromium
    url = os.environ['EDECO_TEST_TOOLBOX_URL']
    with sync_playwright() as playwright:
        browser = launch_chromium(playwright)
        page = browser.new_page(viewport={'width': 1400, 'height': 1000}, color_scheme='light')
        with capture_pdf_ui_failure(page):
            external = []
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
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
                expect(page.get_by_role('img', name='edeco Toolhub', exact=True)).to_have_count(1)
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
                page.get_by_role('button', name='Zum Toolhub', exact=True).click()
                expect(page.get_by_role('button', name=title + ' öffnen', exact=True)).to_be_visible()
            page.get_by_role('button', name='PDF-Werkstatt öffnen', exact=True).click()
            expect(page.get_by_role('heading', name='Was möchtest du mit deinem PDF tun?', exact=True)).to_be_visible()
            expect(page.get_by_text('Offline bereit · auf diesem Computer')).to_be_visible(timeout=180000)
            expect(page.locator('[data-pdf-tool="merge"]')).to_have_attribute("aria-disabled", "false")
            expect(page.locator('.pdf-embedded-workspace')).to_be_hidden()
            page.locator('[data-pdf-tool="merge"]').click()
            exercise_native_default_merge(page)
            # The tile now opens the integrated document rows. Core remains an
            # explicit advanced workflow, including its real bundled PDF.js assets.
            page.get_by_role('button', name='Erweiterte Funktionen', exact=True).click()
            frame = page.frame_locator("iframe[title='Stirling-PDF · edeco PDF-Werkstatt']")
            picker = frame.locator('input[type=file]').first
            picker.wait_for(state='attached', timeout=60000)
            expect(page.get_by_role('img', name='edeco Toolhub', exact=True)).to_have_count(1)
            expect(frame.locator('.sui-logo').first).to_be_hidden()
            expect(frame.locator('.sui-brandmark').first).to_be_hidden()
            for mode in ('dark', 'light'):
                page.get_by_role('button', name='Dunkler Modus' if mode == 'dark' else 'Heller Modus', exact=True).click()
                expect(frame.locator('html')).to_have_attribute('data-edeco-theme', mode)
                colors[mode].append(page.locator('.tool-header-title').evaluate('(el) => getComputedStyle(el).color'))
                assert len(set(colors[mode])) == 4, colors
            expect(frame.get_by_text('PDF mit Zeitstempel', exact=True)).to_have_count(0)
            # The native editor hands its original Files to Core. Select the
            # thumbnail workspace explicitly; Core can also retain a Viewer mode.
            frame.get_by_text('Plan-B.pdf', exact=True).first.wait_for(timeout=30000)
            frame.locator('label[for$="-fileEditor"]').click()
            # Rendered page thumbnails exercise the actual bundled PDF.js/worker/WASM assets.
            preview = frame.get_by_alt_text('Vorschau von Plan-A.pdf', exact=True).first
            expect(preview).to_be_visible(timeout=30000)
            expect(preview).to_have_js_property('complete', True)
            assert preview.evaluate('(img) => img.naturalWidth > 0')
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
            expect(rendered_page).to_have_js_property('complete', True)
            assert rendered_page.evaluate('(img) => img.naturalWidth > 200')
            Path('output').mkdir(exist_ok=True)
            page.screenshot(path='output/pdf-packaged-workshop.png', full_page=True)
            page.get_by_role('button', name='Info / Lizenzen', exact=True).click()
            info = page.frame_locator("iframe[title='Info / Lizenzen']")
            expect(info.get_by_role('heading', name='edeco PDF-Werkstatt · Info / Lizenzen')).to_be_visible()
            expect(info.get_by_role('link', name='java-source.tar.gz', exact=True)).to_be_visible()
            page.get_by_role('button', name='Info schliessen', exact=True).click()
            exercise_tool_first_drop_and_native_crop(page)
            assert not errors, errors
            assert not external, external
            browser.close()
