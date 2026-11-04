"""Large signature/redaction editors, real downloads and persistent user flow."""
import hashlib
import io
import os
from pathlib import Path

from PIL import Image
from pypdf import PdfReader
import pytest

from test_documents import sample_pdf
from test_pdf_entry_ui import drop_files, pdf_entry, playwright  # noqa: F401
from test_phase3 import env  # noqa: F401


def upload(page, data, name="Plan.pdf"):
    page.get_by_label("PDF hinzufügen", exact=True).set_input_files({"name": name, "mimeType": "application/pdf", "buffer": data})
    playwright.expect(page.get_by_role("img", name=f"PDF-Seite 1 von {name}", exact=True)).to_be_visible()


def artifact(tmp_path, name):
    folder = Path(os.environ.get("EDECO_PDF_MARK_ARTIFACTS", str(tmp_path / "pdf-marks")))
    folder.mkdir(parents=True, exist_ok=True)
    return str(folder / name)


def connect_core(page):
    state = page.request.get(page.url.split('#')[0].rstrip('/') + "/api/tools/pdf-werkstatt/state").json()
    result = page.evaluate("""async value => {
      const response=await fetch('/api/tools/pdf-werkstatt/connection',{method:'POST',headers:{'Content-Type':'application/json','X-Edeco-Pdf':value.key},body:JSON.stringify({service_url:value.url})});
      return {status:response.status,body:await response.json()};
    }""", {"key": state["session_key"], "url": os.environ["EDECO_TEST_CORE_URL"]})
    assert result["status"] == 200 and result["body"]["ready"]
    page.reload()


def test_visible_signature_logo_position_template_and_direct_download(pdf_entry, tmp_path):
    page = pdf_entry
    page.locator('[data-pdf-tool="sign"]').click()
    playwright.expect(page.get_by_role("heading", name="Unterschrift auf dem PDF platzieren", exact=True)).to_be_visible()
    source = sample_pdf([["FIRST VECTOR PAGE"], ["SECOND VECTOR PAGE"]])
    digest = hashlib.sha256(source).hexdigest()
    upload(page, source)
    assert page.locator('.pdf-mark-editor').bounding_box()['width'] > page.viewport_size['width'] * .9
    assert page.get_by_role('img', name='PDF-Seite 1 von Plan.pdf', exact=True).bounding_box()['height'] > 500
    image = io.BytesIO()
    with Image.new("RGB", (300, 160), (0, 120, 165)) as logo:
        logo.save(image, format="PNG")
    page.get_by_label("Signaturbild oder Logo hinzufügen", exact=True).set_input_files({"name": "logo.png", "mimeType": "image/png", "buffer": image.getvalue()})
    page.get_by_label("Name", exact=True).fill("Muster Planer")
    page.get_by_label("Ort", exact=True).fill("Basel")
    marker = page.get_by_role("img", name="Signaturdarstellung verschieben", exact=True)
    # Saving a template must not resize the paper under the pointer. Previously
    # a new status row shrank it by42px; its old signature centre hit blank paper.
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    before_paper = page.locator(".pdf-mark-paper").bounding_box()
    before_marker = marker.bounding_box()
    page.get_by_role("button", name="Vorlage merken", exact=True).click()
    saved = page.evaluate("localStorage.getItem('edeco-pdf-signature-appearance-v1')")
    assert "Muster Planer" in saved
    playwright.expect(page.get_by_role('status')).to_contain_text('Vorlage auf diesem Computer gespeichert.')
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    box = marker.bounding_box()
    paper = page.locator(".pdf-mark-paper").bounding_box()
    for key in ('x', 'y', 'width', 'height'):
        assert paper[key] == pytest.approx(before_paper[key], abs=.5)
        assert box[key] == pytest.approx(before_marker[key], abs=.5)
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down()
    page.mouse.move(paper["x"] + paper["width"] * .3, paper["y"] + paper["height"] * .5, steps=8)
    page.mouse.up()
    assert marker.evaluate("node=>parseFloat(node.style.left)") == pytest.approx(10, abs=1)
    after_drag = page.locator(".pdf-mark-paper").bounding_box()
    for key in ('x', 'y', 'width', 'height'):
        assert after_drag[key] == pytest.approx(paper[key], abs=.5)
    with page.expect_download() as downloaded:
        page.get_by_role("button", name="Unterschrift setzen & speichern", exact=True).click()
    target = tmp_path / downloaded.value.suggested_filename
    downloaded.value.save_as(target)
    result = PdfReader(target)
    assert len(result.pages) == 2
    assert "FIRST VECTOR PAGE" in result.pages[0].extract_text()
    assert "SECOND VECTOR PAGE" in result.pages[1].extract_text()
    assert result.pages[0]["/Resources"].get("/XObject")
    assert hashlib.sha256(source).hexdigest() == digest
    page.screenshot(path=artifact(tmp_path, "01-visible-signature.png"))
    previous = page.get_by_role("link", name="PDF erneut herunterladen", exact=True).get_attribute("href")
    page.route("**/mark-documents/*/signature", lambda route: route.fulfill(status=500, json={"detail": "Synthetischer Exportfehler"}), times=1)
    page.get_by_role("button", name="Unterschrift setzen & speichern", exact=True).click()
    playwright.expect(page.get_by_role("alert")).to_contain_text("Synthetischer Exportfehler")
    playwright.expect(page.get_by_role("link", name="PDF erneut herunterladen", exact=True)).to_have_attribute("href", previous)
    assert page.evaluate("url=>fetch(url).then(response=>response.ok)", previous)
    page.get_by_label("PDF hinzufügen", exact=True).set_input_files({"name": "broken.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-broken"})
    playwright.expect(page.get_by_role("alert")).not_to_contain_text("Synthetischer Exportfehler")
    playwright.expect(page.get_by_role("img", name="PDF-Seite 1 von Plan.pdf", exact=True)).to_be_visible()
    playwright.expect(page.get_by_role("link", name="PDF erneut herunterladen", exact=True)).to_have_attribute("href", previous)
    # Closing the document clears the side editor and its download, not the user's saved template.
    page.get_by_role("button", name="PDF schliessen", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Unterschrift auf dem PDF platzieren", exact=True)).to_be_visible()
    playwright.expect(page.locator(".pdf-mark-settings")).to_have_count(0)
    playwright.expect(page.get_by_role("link", name="PDF erneut herunterladen", exact=True)).to_have_count(0)
    upload(page, source)
    page.get_by_label("Name", exact=True).fill("")
    page.get_by_role("button", name="Vorlage laden", exact=True).click()
    playwright.expect(page.get_by_label("Name", exact=True)).to_have_value("Muster Planer")


def test_redaction_selects_real_text_and_requires_explicit_image_pdf_confirmation(pdf_entry, tmp_path):
    page = pdf_entry
    source = sample_pdf([["PRIVATE-CONTRACT-4738", "SAFE CONTENT"], ["SECOND PAGE"]])
    drop_files(page, [("Confidential.pdf", "application/pdf", source)])
    page.locator('[data-pdf-tool="redact"]').click()
    playwright.expect(page.get_by_role("img", name="PDF-Seite 1 von Confidential.pdf", exact=True)).to_be_visible()
    page.get_by_role("button", name="Textzeilen", exact=True).click()
    page.get_by_label("Text auf dieser Seite suchen", exact=True).fill("PRIVATE")
    line = page.get_by_role("button", name="Textzeile schwärzen: PRIVATE-CONTRACT-4738", exact=True)
    playwright.expect(line).to_be_visible()
    line.click()
    playwright.expect(page.get_by_role("button", name="Schwärzen & speichern", exact=True)).to_be_disabled()
    playwright.expect(page.get_by_text("Alle Seiten werden als Bild neu aufgebaut.", exact=False)).to_be_visible()
    page.get_by_label("Auflösung der geschwärzten PDF", exact=True).select_option("150")
    page.get_by_label("Auswahl geprüft; Bild-PDF ohne Textschicht erstellen.", exact=True).check()
    with page.expect_download() as downloaded:
        page.get_by_role("button", name="Schwärzen & speichern", exact=True).click()
    target = tmp_path / downloaded.value.suggested_filename
    downloaded.value.save_as(target)
    result = PdfReader(target)
    assert len(result.pages) == 2
    assert all(not sheet.extract_text().strip() for sheet in result.pages)
    assert b"PRIVATE-CONTRACT-4738" not in target.read_bytes()
    page.screenshot(path=artifact(tmp_path, "02-secure-redaction.png"))


def test_redaction_area_drag_zoom_and_mobile_layout(pdf_entry, tmp_path):
    page = pdf_entry
    page.locator('[data-pdf-tool="redact"]').click()
    upload(page, sample_pdf([["ONE PLAN"]]))
    paper = page.locator(".pdf-mark-paper").bounding_box()
    page.mouse.move(paper["x"] + paper["width"] * .1, paper["y"] + paper["height"] * .1)
    page.mouse.down()
    page.mouse.move(paper["x"] + paper["width"] * .4, paper["y"] + paper["height"] * .2, steps=6)
    page.mouse.up()
    playwright.expect(page.get_by_label("Vorgemerkter Schwärzungsbereich", exact=True)).to_have_count(1)
    viewport = page.locator(".pdf-mark-viewport")
    width = page.locator(".tool-header").bounding_box()["width"]
    viewport.focus()
    page.keyboard.press("Control++")
    page.wait_for_function("() => Number(document.querySelector('.pdf-mark-viewport').dataset.documentZoom)>1")
    assert page.locator(".tool-header").bounding_box()["width"] == width
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".pdf-mark-editor").evaluate("node=>node.scrollWidth<=node.clientWidth")
    page.screenshot(path=artifact(tmp_path, "03-redaction-mobile.png"), full_page=True)


@pytest.mark.skipif(not os.environ.get("EDECO_TEST_CORE_URL"), reason="Real local Core instance required")
def test_redacted_result_replaces_an_older_ocr_workspace_input(pdf_entry, tmp_path):
    page = pdf_entry
    connect_core(page)
    source = sample_pdf([["PRIVATE-ALPHA-4738", "PUBLIC INFORMATION"]])
    page.locator('[data-pdf-tool="ocr"]').click()
    page.get_by_label("PDF für Texterkennung oder Komprimierung öffnen", exact=True).set_input_files({"name": "Plan.pdf", "mimeType": "application/pdf", "buffer": source})
    playwright.expect(page.locator('.pdf-processing-file strong')).to_have_text('Plan.pdf')
    playwright.expect(page.get_by_role('button', name='Erkennen & herunterladen', exact=True)).to_be_enabled()
    page.get_by_role('button', name='Werkzeugauswahl', exact=True).click()
    page.locator('[data-pdf-tool="redact"]').click()
    playwright.expect(page.get_by_role('img', name='PDF-Seite 1 von Plan.pdf', exact=True)).to_be_visible()
    page.get_by_role('button', name='Textzeilen', exact=True).click()
    page.get_by_role('button', name='Textzeile schwärzen: PRIVATE-ALPHA-4738', exact=True).click()
    page.get_by_label('Auflösung der geschwärzten PDF', exact=True).select_option('150')
    page.get_by_label('Auswahl geprüft; Bild-PDF ohne Textschicht erstellen.', exact=True).check()
    with page.expect_download() as downloaded:
        page.get_by_role('button', name='Schwärzen & speichern', exact=True).click()
    path = tmp_path / downloaded.value.suggested_filename
    downloaded.value.save_as(path)
    assert not PdfReader(path).pages[0].extract_text()
    page.get_by_role('button', name='Werkzeugauswahl', exact=True).click()
    drop_files(page, [('Not-a-PDF.txt', 'text/plain', b'This must not restore the confidential original.')])
    playwright.expect(page.get_by_role('alert')).to_contain_text('Bitte PDF-Dateien ablegen')
    page.locator('[data-pdf-tool="ocr"]').click()
    processing = page.locator('.pdf-native-workspace:not([hidden]) .pdf-processing-workspace')
    playwright.expect(processing.locator('.pdf-processing-file strong')).to_have_text('Plan_geschwaerzt.pdf')
    processing.get_by_label('Im PDF suchen', exact=True).fill('PRIVATE')
    playwright.expect(processing.get_by_text('Keine Treffer in der Textschicht.', exact=False)).to_be_visible()
    page.get_by_role('button', name='Werkzeugauswahl', exact=True).click()
    page.locator('[data-pdf-tool="compress"]').click()
    compress = page.locator('.pdf-native-workspace:not([hidden]) .pdf-processing-workspace')
    playwright.expect(compress.locator('.pdf-processing-file strong')).to_have_text('Plan_geschwaerzt.pdf')


@pytest.mark.skipif(not os.environ.get("EDECO_TEST_CORE_URL"), reason="Real local Core instance required")
@pytest.mark.parametrize("save_first", [False, True])
def test_certificate_handoff_keeps_the_visible_appearance_in_the_real_core(pdf_entry, save_first):
    page = pdf_entry
    connect_core(page)
    page.locator('[data-pdf-tool="sign"]').click()
    upload(page, sample_pdf([["ORIGINAL BLACK TEXT"]]))
    png = io.BytesIO()
    with Image.new("RGB", (240, 80), (10, 80, 210)) as image:
        image.save(png, format="PNG")
    page.get_by_label("Signaturbild oder Logo hinzufügen", exact=True).set_input_files({"name": "logo.png", "mimeType": "image/png", "buffer": png.getvalue()})
    page.get_by_label("Name", exact=True).fill("Geprüfte Darstellung")
    if save_first:
        with page.expect_download():
            page.get_by_role("button", name="Unterschrift setzen & speichern", exact=True).click()
    page.get_by_role("button", name="Mit Zertifikat signieren", exact=True).click()
    core = page.frame_locator("iframe[title='Stirling-PDF · edeco PDF-Werkstatt']")
    playwright.expect(core.get_by_text('Plan_unterschrieben.pdf', exact=True).first).to_be_visible(timeout=30000)
    core.locator('label[for$="-fileEditor"]').click()
    thumbnail = core.get_by_alt_text('Vorschau von Plan_unterschrieben.pdf', exact=True).first
    playwright.expect(thumbnail).to_be_visible(timeout=30000)
    playwright.expect(thumbnail).to_have_js_property('complete', True)
    blue = thumbnail.evaluate("""node=>{const canvas=document.createElement('canvas');canvas.width=node.naturalWidth;canvas.height=node.naturalHeight;const c=canvas.getContext('2d');c.drawImage(node,0,0);const p=c.getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=0;i<p.length;i+=4)if(p[i]<50&&p[i+1]<130&&p[i+2]>170)count++;return count;}""")
    assert blue > 100, "The original black-only PDF must reach Core with its new blue visible signature."
