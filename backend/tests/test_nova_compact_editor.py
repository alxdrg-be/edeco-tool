"""Actual API/browser/export checks for compact legends and original plan colours."""
from contextlib import closing

import ezdxf
import pypdfium2 as pdfium
import pytest

from test_editor_navigation import editor, playwright  # noqa: F401
from test_phase3 import env  # noqa: F401


def general_template(path):
    doc = ezdxf.new("R2013")
    doc.units = 4
    ms = doc.modelspace()
    for text, y in (("Leitung von/nach OBEN", 55), ("UP-Abzweigdose Decke / Wand", 45), ("Farbcodes", 30)):
        ms.add_text(text, dxfattribs={"height": 2, "insert": (25, y), "color": 7})
    ms.add_line((3, 55.7), (18, 55.7), dxfattribs={"color": 7})
    ms.add_circle((3, 55.7), .7, dxfattribs={"color": 7})
    ms.add_lwpolyline([(3, 44.7), (7, 44.7), (7, 47.7), (3, 47.7)], close=True,
                      dxfattribs={"color": 7})
    ms.add_lwpolyline([(10, 44.7), (13, 44.7), (13, 47.7), (10, 47.7)], close=True,
                      dxfattribs={"color": 7})
    colors = [("Lichtinstallation", 0x0099FF), ("Kraftinstallation", 0xFF0000),
              ("Schwachstrominstallation", 0x993300), ("Telefonie", 0x00FF00),
              ("Multimedia / UKV", 0xFF00FF), ("Brandschutz/Brandmeldeanlage", 0xFF6600),
              ("Sicherheitsbeleuchtung", 0x00FF00), ("Erschliessungssysteme", 0xFFBF00),
              ("Audio und Video", 0xCC0099), ("BUS-Installation", 0x00FFFF)]
    for index, (text, color) in enumerate(colors):
        y = 20 - index * 4.55
        ms.add_text(text, dxfattribs={"height": 2, "insert": (25, y), "color": 7})
        ms.add_solid([(3, y), (12, y), (3, y + 1), (12, y + 1)], dxfattribs={"true_color": color})
    doc.saveas(path)
    return path


def test_full_layer_variants_general_key_and_compact_pdf_remain_editable(editor, tmp_path):
    page, _, client, (pid, _) = editor
    client.app.state.nova.company.set_legend_settings({"legend_general_path": str(general_template(tmp_path / "Allgemein.dxf"))})
    doc = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    item = next(it for block in doc["blocks"] for it in block["items"] if it["kind"] == "symbol")
    item.update(text="Schalter in zwei Planfarben", color="#0099ff", layer_colors=["#0099ff", "#ff0000"])
    doc["title"]["text"] = "Legende · Kompaktprüfung"
    doc["style"].update(compact_flow=False, columns=2)
    assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.reload()
    page.get_by_text("Browser A", exact=True).click()
    page.get_by_role("button", name="Legende", exact=True).click()
    page.locator("summary").filter(has_text="Ansicht").click()
    page.get_by_role("group", name="Ansicht", exact=True).get_by_role("button", name="Kompakt wie Vorlage", exact=True).click()
    hit = page.locator(f'.lg-hit[data-id="{item["id"]}"]')
    playwright.expect(hit).to_have_attribute("data-layer-variants", "true")
    playwright.expect(hit).to_have_attribute("stroke", "#e8590c")
    hit.click()
    outline = page.locator(".outline-item.has-layer-variants")
    playwright.expect(outline).to_contain_text("2 Farben")
    playwright.expect(outline.locator(".sym-icon")).to_have_count(2)
    page.get_by_role("button", name="Editor gross", exact=True).click()
    editor_view = page.get_by_role("dialog", name="Legendeneditor", exact=True)
    playwright.expect(editor_view.get_by_role("button", name="Zurück zu Projekten", exact=True)).to_be_visible()
    # Pop-up menus stay inside the enlarged dialog, including keyboard focus.
    editor_view.locator("summary").filter(has_text="Ansicht").click()
    view_menu = editor_view.get_by_role("group", name="Ansicht", exact=True)
    playwright.expect(view_menu).to_be_visible()
    page.keyboard.press("Tab")
    assert view_menu.evaluate("node => node.contains(document.activeElement)")
    page.keyboard.press("Escape")
    playwright.expect(view_menu).not_to_be_visible()
    playwright.expect(editor_view.locator("summary").filter(has_text="Ansicht")).to_be_focused()
    # Enlarging is an in-app view, with focus staying in the editor.
    for _ in range(8):
        page.keyboard.press("Tab")
        assert editor_view.evaluate("node => node.contains(document.activeElement)")
    page.locator(".legend-canvas").click(position={"x": 5, "y": 5})
    # A variant stays orange even after its item is no longer selected.
    playwright.expect(hit).to_have_attribute("stroke", "#e8590c")
    hit.click()
    page.get_by_role("button", name="Abschnittsfarbe", exact=True).click()
    playwright.expect(hit).not_to_have_attribute("data-layer-variants", "true")
    page.get_by_role("button", name="Layerfarben", exact=True).click()
    playwright.expect(hit).to_have_attribute("data-layer-variants", "true")

    # Use current UI state through the save endpoint, rather than a parallel hand-built model.
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    current = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    lay = client.post(f"/api/projects/{pid}/legend/layout", json={"doc": current}).json()
    variants = [prim for prim in lay["prims"] if prim["t"] == "symbol" and prim["id"] == item["id"]]
    assert len(variants) == 2
    assert {prim["color"] for prim in variants} == {"#0099ff", "#ff0000"}
    assert variants[0]["w"] == pytest.approx(variants[1]["w"])
    assert variants[0]["h"] == pytest.approx(variants[1]["h"])
    footer = next(prim for prim in lay["prims"] if prim["t"] == "text" and prim["text"] == "Farbcodes")
    section_top = min(prim["y"] for prim in lay["prims"] if prim["t"] == "hit" and prim["kind"] == "block")
    assert footer["y"] < section_top
    assert current["style"]["compact_flow"] is True and current["style"]["columns"] == 3
    assert next(prim for prim in lay["prims"] if prim["t"] == "grid" and prim["block"] == "general")["cols"] == 2
    assert next(prim for prim in lay["prims"] if prim["t"] == "grid" and prim["block"] == "general-colors")["cols"] == 5
    general = client.get(f"/api/projects/{pid}/legend/general").json()
    assert "#000000" in " ".join(row["svg"] for row in general["row_svgs"].values())

    artifacts = tmp_path / "nova-review"
    artifacts.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(artifacts / "01-editor-gross.png"))
    page.locator(".legend-canvas").click(position={"x": 5, "y": 5})
    with page.expect_download() as downloaded:
        page.get_by_role("button", name="PDF", exact=True).click()
    pdf_path = tmp_path / "Kompakt.pdf"
    downloaded.value.save_as(pdf_path)
    with pdfium.PdfDocument(pdf_path) as result, closing(result[0]) as pdf_page:
        assert len(result) == 1
        width, height = pdf_page.get_size()
        assert width * 25.4 / 72 == pytest.approx(210, abs=.2)
        assert height * 25.4 / 72 < 297
        with closing(pdf_page.render(scale=2)) as bitmap:
            bitmap.to_pil().save(artifacts / "02-pdf-export.png")
    page.get_by_role("button", name="Kompakt", exact=True).click()
    page.screenshot(path=str(artifacts / "03-editor-kompakt.png"))
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".legend-editor").evaluate("node => node.scrollWidth <= node.clientWidth")
    page.set_viewport_size({"width": 1440, "height": 1000})
    page.locator(".legend-editor").get_by_role("button", name="Zurück zu Projekten", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Deine Projekte", exact=True)).to_be_visible()
    stored = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    restored = next(it for block in stored["blocks"] for it in block["items"] if it["id"] == item["id"])
    assert restored["layer_colors"] == ["#0099ff", "#ff0000"]


def test_dragging_a_flowed_section_uses_original_item_indices(editor):
    page, _, client, (pid, _) = editor
    doc = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    doc["style"].update(compact_flow=True, columns=3)
    doc["blocks"] = [{"id": "flow", "title": "Fortlaufender Abschnitt", "items": [
        {"id": f"e{index}", "kind": "text", "text": f"Eintrag {index}"} for index in range(4)
    ]}]
    assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
    page.get_by_role("button", name="Gesamtliste", exact=False).click()
    page.get_by_role("button", name="Legende", exact=True).click()
    page.set_viewport_size({"width": 1600, "height": 1200})
    first = page.locator('[data-hit="item"][data-id="e0"]')
    last = page.locator('[data-hit="item"][data-id="e3"]')
    playwright.expect(last).to_be_visible()
    first.scroll_into_view_if_needed()
    start, target = first.bounding_box(), last.bounding_box()
    page.mouse.move(start["x"] + 8, start["y"] + start["height"] / 2)
    page.mouse.down()
    page.mouse.move(target["x"] + 8, target["y"] + target["height"] / 2, steps=8)
    page.wait_for_function("""() => [...document.querySelectorAll('g[data-entry]')]
        .some(node => (node.style.transition || '').includes('transform'))""")
    page.mouse.up()
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    stored = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert ["_" if item["kind"] == "gap" else item["id"] for item in stored["blocks"][0]["items"]] == ["_", "e1", "e2", "e0", "e3"]
