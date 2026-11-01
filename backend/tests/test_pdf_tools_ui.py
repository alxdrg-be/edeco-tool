"""Real local engine and actual downloads through every edeco PDF tool view."""
import io
import os
import zipfile
from contextlib import closing
from pathlib import Path
from urllib.parse import urlsplit

import pypdfium2 as pdfium
import pytest
from PIL import Image, ImageDraw, ImageFont

from test_documents import sample_pdf
from test_editor_navigation import launch_chromium

pytestmark = pytest.mark.skipif(not os.environ.get('EDECO_TEST_TOOLBOX_URL'), reason='Running local Toolbox required')


def scan_pdf():
    image = Image.new('RGB', (2480, 3508), 'white')
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 64)
    draw.text((180, 300), 'Electrical installation test report 2026', font=font, fill='black')
    draw.text((180, 450), 'Prüfbericht für elektrische Anlagen', font=font, fill='black')
    output = io.BytesIO(); image.save(output, format='PDF', resolution=300)
    return output.getvalue()


def pdf_text(data, number=0):
    with pdfium.PdfDocument(data) as document, closing(document[number]) as page, closing(page.get_textpage()) as text:
        return text.get_text_range()


def test_all_pdf_tool_views_create_valid_local_downloads():
    from playwright.sync_api import sync_playwright, expect
    plan = sample_pdf([['FIRST PLAN'], ['SECOND PLAN'], ['THIRD PLAN']])
    noise = Image.effect_noise((1200, 1600), 35).convert('RGB')
    image_pdf = io.BytesIO(); noise.save(image_pdf, format='PDF')
    png = io.BytesIO(); Image.new('RGB', (320, 240), 'red').save(png, format='PNG')
    png_two = io.BytesIO(); Image.new('RGB', (320, 240), 'blue').save(png_two, format='PNG')
    cases = [
        ('PDF trennen', 'split', plan), ('Seiten drehen', 'rotate', plan),
        ('PDF zuschneiden', 'crop', plan), ('Seitengrösse ändern', 'resize', plan),
        ('PDF komprimieren', 'compress', image_pdf.getvalue()), ('Bilder in PDF', 'images-to-pdf', png.getvalue()),
        ('PDF in Bilder', 'pdf-to-images', plan), ('Text extrahieren', 'pdf-to-text', plan),
        ('Texterkennung (OCR)', 'ocr', scan_pdf()),
    ]
    Path('output/ui-preview').mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = launch_chromium(p)
        page = browser.new_page(viewport={'width': 1440, 'height': 1100}, color_scheme='light')
        external, errors = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        def guard(route):
            target = urlsplit(route.request.url)
            if target.scheme in ('http', 'https') and target.hostname not in ('127.0.0.1', 'localhost'):
                external.append(route.request.url); route.abort()
            else:
                route.continue_()
        page.route('**/*', guard)
        page.goto(os.environ['EDECO_TEST_TOOLBOX_URL'])
        page.get_by_role('button', name='PDF-Werkstatt öffnen', exact=True).click()
        expect(page.get_by_role('button', name='Texterkennung (OCR)', exact=True)).to_be_enabled(timeout=180000)
        expect(page.locator('.pdf-tool-tile:not(:disabled)')).to_have_count(11)
        expect(page.get_by_text('Offline bereit', exact=True)).to_have_count(0)
        expect(page.locator('.tool-header').get_by_role('button', name='Info / Lizenzen', exact=True)).to_have_count(0)
        page.mouse.move(700, 40)
        page.screenshot(path='output/ui-preview/pdf-tools-home-light.png')
        page.get_by_role('button', name='Dunkler Modus', exact=True).click()
        page.screenshot(path='output/ui-preview/pdf-tools-home-dark.png')
        page.get_by_role('button', name='Heller Modus', exact=True).click()
        for title, tool, data in cases:
            page.get_by_role('button', name=title, exact=True).click()
            if tool == 'images-to-pdf':
                import base64
                page.get_by_label('Bilder hinzufügen', exact=True).evaluate('''(input, images) => {
                    const transfer = new DataTransfer();
                    images.forEach(([name, data]) => transfer.items.add(new File([Uint8Array.from(atob(data), c => c.charCodeAt(0))], name, {type: ''})));
                    if ([...transfer.files].some(file => file.type !== '')) throw new Error('Expected empty Explorer MIME types');
                    input.files = transfer.files; input.dispatchEvent(new Event('change', {bubbles: true}));
                }''', [['Rot.png', base64.b64encode(data).decode()], ['Blau.png', base64.b64encode(png_two.getvalue()).decode()]])
                page.get_by_role('button', name='Blau.png: Nach oben', exact=True).click()
            else:
                page.get_by_label('PDF hinzufügen', exact=True).set_input_files({'name': 'Projektplan.pdf', 'mimeType': 'application/pdf', 'buffer': data})
            run = page.get_by_role('button', name='Ergebnis erstellen', exact=True)
            expect(run).to_be_enabled(timeout=30000)
            if tool == 'split': page.get_by_label('Nach diesen Seiten trennen', exact=True).fill('1,2')
            if tool == 'rotate': page.get_by_label('Drehung', exact=True).select_option('270')
            if tool == 'crop':
                page.get_by_text('Ränder genau eingeben (mm)', exact=True).click()
                for label, value in [('Oben (mm)', '20'), ('Unten (mm)', '20'), ('Links (mm)', '10'), ('Rechts (mm)', '10')]:
                    page.get_by_label(label, exact=True).fill(value)
                page.screenshot(path='output/ui-preview/pdf-tool-crop.png')
            if tool == 'resize':
                page.get_by_label('Ausrichtung', exact=True).select_option('LANDSCAPE')
                page.get_by_label('Papierformat', exact=True).select_option('KEEP')
                expect(page.get_by_label('Ausrichtung', exact=True)).to_have_value('PORTRAIT')
                expect(page.get_by_label('Ausrichtung', exact=True)).to_be_disabled()
                page.get_by_label('Papierformat', exact=True).select_option('A3')
                page.get_by_label('Inhalt skalieren (%)', exact=True).fill('50')
            if tool == 'compress': page.get_by_label('Kompressionsstufe', exact=True).select_option('8')
            if tool == 'pdf-to-images': page.get_by_label('Seitenbereich', exact=True).fill('2-3')
            with page.expect_response(lambda response: response.url.endswith('/process/' + tool), timeout=180000) as processing:
                run.click()
            assert processing.value.status == 200, (tool, processing.value.text())
            link = page.get_by_role('link', name='Ergebnis herunterladen', exact=True)
            expect(link).to_be_visible(timeout=60000)
            with page.expect_download() as download:
                link.click()
            result = Path(download.value.path()).read_bytes()
            assert result, tool
            if tool == 'split':
                with zipfile.ZipFile(io.BytesIO(result)) as archive:
                    names = sorted(name for name in archive.namelist() if name.endswith('.pdf'))
                    assert len(names) == 3
                    for index, expected in enumerate(('FIRST', 'SECOND', 'THIRD')):
                        assert expected in pdf_text(archive.read(names[index]))
            elif tool == 'pdf-to-images':
                with zipfile.ZipFile(io.BytesIO(result)) as archive:
                    names = [name for name in archive.namelist() if name.endswith('.png')]
                    assert len(names) == 2
                    with Image.open(io.BytesIO(archive.read(names[0]))) as image:
                        assert image.size == (1190, 1684)
            elif tool == 'pdf-to-text':
                assert b'FIRST PLAN' in result and b'THIRD PLAN' in result
            else:
                with pdfium.PdfDocument(result) as document, closing(document[0]) as first:
                    expected_count = 2 if tool == 'images-to-pdf' else 1 if tool in ('compress', 'ocr') else 3
                    assert len(document) == expected_count, tool
                    if tool == 'rotate': assert first.get_size() == pytest.approx((842, 595), abs=.1)
                    if tool == 'crop': assert first.get_size() == pytest.approx((595 - 20 * 72 / 25.4, 842 - 40 * 72 / 25.4), abs=.1)
                    if tool == 'resize': assert first.get_size() == pytest.approx((841.89, 1190.55), abs=.1)
                    if tool == 'resize':
                        with pdfium.PdfDocument(plan) as original, closing(original[0]) as original_page, closing(original_page.get_textpage()) as original_text, closing(first.get_textpage()) as scaled_text:
                            before, after = original_text.get_charbox(0), scaled_text.get_charbox(0)
                            assert after[2] - after[0] == pytest.approx((before[2] - before[0]) * .5, abs=.1)
                    if tool == 'compress': assert len(result) < len(data)
                    with closing(first.render(scale=.25)) as bitmap:
                        assert bitmap.width > 0
                        if tool == 'images-to-pdf':
                            color = bitmap.to_pil().getpixel((bitmap.width // 2, bitmap.height // 2))
                            assert color[2] > 200 and color[0] < 20, color
                if tool == 'ocr':
                    assert 'Electrical installation' in pdf_text(result)
                    assert 'Prüfbericht' in pdf_text(result)
            if tool in ('ocr', 'resize', 'compress'):
                page.locator('.pdf-task').evaluate('(el) => {el.scrollTop=0;}')
                page.screenshot(path=f'output/ui-preview/pdf-tool-{tool}.png')
            page.get_by_role('button', name='← Alle PDF-Werkzeuge', exact=True).click()
            expect(page.get_by_role('alertdialog', name='Ergebnisse gespeichert?')).to_be_visible()
            page.get_by_role('button', name='Zur Werkzeugübersicht', exact=True).click()
            expect(page.locator('.pdf-tool-grid')).to_be_visible()
        assert not external, external
        assert not errors, errors
        browser.close()


def test_crop_action_handles_mixed_formats_rotations_and_selected_pages():
    import httpx
    from edeco_toolbox.pdf_workshop.client import PdfFile, StirlingClient
    with httpx.Client(base_url=os.environ['EDECO_TEST_TOOLBOX_URL'], trust_env=False, timeout=180) as browser:
        state = browser.get('/api/tools/pdf-werkstatt/state').json()
        engine = StirlingClient(os.environ['EDECO_TEST_TOOLBOX_URL'])
        engine.headers['Cookie'] = '; '.join(f'{key}={value}' for key, value in browser.cookies.items())
        rotated = PdfFile('Quer.pdf', sample_pdf([['ROTATED PLAN']], rotation=90))
        a3 = PdfFile('A3.pdf', engine.resize(PdfFile('Original.pdf', sample_pdf([['A3 PLAN']])), 'A3'))
        source = engine.merge([rotated, a3])
        for selection in ('all', '2'):
            response = browser.post('/api/tools/pdf-werkstatt/process/crop', headers={'X-Edeco-Pdf': state['session_key']},
                files={'files': ('Gemischte-Plaene.pdf', source)}, data={'options': __import__('json').dumps({'top': 5, 'bottom': 5, 'left': 10, 'right': 10, 'pages': selection})})
            assert response.status_code == 200, response.text
            with pdfium.PdfDocument(source) as before, pdfium.PdfDocument(response.content) as after:
                assert len(after) == 2
                for index in range(2):
                    with closing(before[index]) as old, closing(after[index]) as new:
                        width, height = old.get_size()
                        expected = (width - 20 * 72 / 25.4, height - 10 * 72 / 25.4) if selection == 'all' or index == 1 else (width, height)
                        assert new.get_size() == pytest.approx(expected, abs=.1)
                        with closing(new.render(scale=.5)) as bitmap:
                            image = bitmap.to_pil().convert('L')
                            assert image.getextrema()[0] < 150, 'Visible page contents disappeared during crop'
                            image.close()

@pytest.mark.skipif(not os.environ.get('EDECO_TEST_TOOLBOX_URL'), reason='Running local Toolbox required')
def test_visual_crop_and_split_controls_create_real_files():
    from playwright.sync_api import sync_playwright, expect
    with sync_playwright() as p:
        browser=launch_chromium(p)
        page=browser.new_page(viewport={'width':1400,'height':1000})
        page.goto(os.environ['EDECO_TEST_TOOLBOX_URL'])
        page.get_by_role('button',name='PDF-Werkstatt öffnen',exact=True).click()
        page.get_by_role('button',name='PDF zuschneiden',exact=True).click(timeout=90000)
        page.get_by_label('PDF hinzufügen',exact=True).set_input_files({'name':'Plan.pdf','mimeType':'application/pdf','buffer':sample_pdf([['FIRST PLAN'],['SECOND PLAN'],['THIRD PLAN']])})
        canvas=page.get_by_label('Zuschnittbereich aufziehen',exact=True)
        expect(canvas).to_be_visible()
        box=canvas.bounding_box()
        page.mouse.move(box['x']+box['width']*.1,box['y']+box['height']*.15)
        page.mouse.down();page.mouse.move(box['x']+box['width']*.9,box['y']+box['height']*.85,steps=8);page.mouse.up()
        page.screenshot(path='output/ui-preview/pdf-visual-crop.png')
        with page.expect_response(lambda r:r.url.endswith('/process/crop')) as response:
            page.get_by_role('button',name='Ergebnis erstellen',exact=True).click()
        assert response.value.status==200,response.value.text()
        with page.expect_download() as download:
            page.get_by_role('link',name='Ergebnis herunterladen',exact=True).click()
        with pdfium.PdfDocument(Path(download.value.path()).read_bytes()) as doc:
            assert len(doc)==3
            with closing(doc[0]) as first:
                width,height=first.get_size()
                assert abs(width-595*.8)<2 and abs(height-842*.7)<2,(width,height)
        page.get_by_role('button',name='← Alle PDF-Werkzeuge',exact=True).click()
        page.get_by_role('button',name='Zur Werkzeugübersicht',exact=True).click()
        page.get_by_role('button',name='PDF trennen',exact=True).click()
        page.get_by_label('PDF hinzufügen',exact=True).set_input_files({'name':'Plan.pdf','mimeType':'application/pdf','buffer':sample_pdf([['FIRST PLAN'],['SECOND PLAN'],['THIRD PLAN']])})
        expect(page.get_by_role('button',name='Nach Seite 1 trennen',exact=True)).to_be_visible()
        page.get_by_role('button',name='Alle zusammenlassen',exact=True).click()
        page.get_by_role('button',name='Nach Seite 2 trennen',exact=True).click()
        expect(page.get_by_role('button',name='Nach Seite 2 trennen',exact=True)).to_have_attribute('aria-pressed','true')
        page.screenshot(path='output/ui-preview/pdf-visual-split.png')
        with page.expect_response(lambda r:r.url.endswith('/process/split')) as response:
            page.get_by_role('button',name='Ergebnis erstellen',exact=True).click()
        assert response.value.status==200,response.value.text()
        with page.expect_download() as download:
            page.get_by_role('link',name='Ergebnis herunterladen',exact=True).click()
        with zipfile.ZipFile(io.BytesIO(Path(download.value.path()).read_bytes())) as archive:
            names=[name for name in archive.namelist() if name.endswith('.pdf')]
            assert len(names)==2
            with pdfium.PdfDocument(archive.read(names[0])) as first:
                assert len(first)==2
                for index,expected in enumerate(('FIRST PLAN','SECOND PLAN')):
                    with closing(first[index]) as pdf_page, closing(pdf_page.get_textpage()) as text:
                        assert expected in text.get_text_range()
            assert 'THIRD PLAN' in pdf_text(archive.read(names[1]))
        browser.close()
