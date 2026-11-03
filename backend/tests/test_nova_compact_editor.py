"""Actual API/browser/export checks for compact legends and original plan colours."""
from contextlib import closing
from io import StringIO

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
    page.get_by_role("group", name="Ansicht", exact=True).get_by_role("button", name="Dichte wie Entwurf", exact=True).click()
    hit = page.locator(f'.lg-hit[data-id="{item["id"]}"]')
    playwright.expect(hit).to_have_attribute("data-layer-variants", "true")
    playwright.expect(hit).to_have_attribute("stroke", "#e8590c")
    hit.click()
    outline = page.locator(".outline-item.has-layer-variants")
    playwright.expect(outline).to_contain_text("2 Farben")
    playwright.expect(outline.locator(".sym-icon")).to_have_count(2)
    page.get_by_role("button", name="Editor gross öffnen", exact=True).click()
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
    # An occupied destination closes the old hole and inserts at its original
    # visible-item index. Empty-cell placement is checked separately in the
    # classic-raster regression; a continuation must not reset its index to zero.
    assert [item["id"] for item in stored["blocks"][0]["items"]] == ["e1", "e2", "e3", "e0"]


def reopen_first_editor(page):
    page.reload()
    page.get_by_text("Browser A", exact=True).click()
    page.get_by_role("button", name="Legende", exact=True).click()


@pytest.mark.parametrize("old_flow", [False, True])
def test_legacy_density_changes_only_through_explicit_undoable_preset(editor, old_flow):
    page, _, client, (pid, _) = editor
    doc = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    doc["style"].update(compact_flow=old_flow, columns=2, grid="custom", row=18,
                        text_size=4, text_offset=20, entry_gap=3, section_gap=12,
                        symbol_scale=2, symbol_size="real", normalize_size=False)
    original_blocks = doc["blocks"]
    assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
    reopen_first_editor(page)
    # Opening an old legend keeps its saved layout and makes the explicit action easy to find.
    playwright.expect(page.get_by_role("button", name="Kompakte Vorlage anwenden", exact=True)).to_be_visible()
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    saved = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert saved["style"]["row"] == 18 and saved["style"]["compact_flow"] is old_flow
    page.get_by_role("button", name="Kompakte Vorlage anwenden", exact=True).click()
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    compact = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert compact["style"]["row"] == 6 and compact["style"]["text_size"] == 2.8
    assert compact["style"]["columns"] == 3 and compact["style"]["compact_flow"] is True
    assert compact["style"]["symbol_size"] == "tile" and compact["style"]["symbol_scale"] == 1
    assert compact["style"]["section_gap"] == compact["style"]["entry_gap"] == 0
    assert compact["blocks"] == original_blocks
    page.get_by_role("button", name="Rückgängig", exact=True).click()
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    restored = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert restored["style"] == saved["style"]
    assert restored["blocks"] == original_blocks


def test_general_heading_accent_is_editable_without_a_filled_banner(editor, tmp_path):
    page, _, client, (pid, _) = editor
    client.app.state.nova.company.set_legend_settings({"legend_general_path": str(general_template(tmp_path / "Allgemein.dxf"))})
    reopen_first_editor(page)
    page.locator('[data-hit="general"]').click()
    accent = page.get_by_label("Akzentfarbe Allgemeinteil", exact=True)
    playwright.expect(accent).to_be_visible()
    accent.evaluate("""el => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '#12ab34');
        el.dispatchEvent(new Event('input', {bubbles: true}));
        el.dispatchEvent(new Event('change', {bubbles: true}));
    }""")
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    doc = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert doc["general_section"]["header"] == "#12ab34"
    lay = client.post(f"/api/projects/{pid}/legend/layout", json={"doc": doc}).json()
    accents = [p for p in lay["prims"] if p.get("block") == "general" and p.get("role") in ("general-marker", "general-rule")]
    assert {p["role"] for p in accents} == {"general-marker", "general-rule"}
    assert all(p["fill"] == "#12ab34" for p in accents)
    assert all(min(p["w"], p["h"]) < 1 for p in accents)


def test_a4_preset_is_explicit_persisted_and_undoable(editor):
    page, _, client, (pid, _) = editor
    original = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    page.locator("summary").filter(has_text="Ansicht").click()
    page.get_by_role("group", name="Ansicht", exact=True).get_by_role("button", name="A4 kompakt", exact=True).click()
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    a4 = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert a4["style"]["columns"] == 4 and a4["style"]["text_size"] == 2.6
    assert a4["style"]["margin"] == 3.5 and a4["style"]["width"] == 200
    assert a4["title"]["size_mm"] == 4.5
    assert [block["items"] for block in a4["blocks"]] == [block["items"] for block in original["blocks"]]
    assert all(block["style"]["padding"] == .5 for block in a4["blocks"])
    pdf_data = client.get(f"/api/projects/{pid}/legend/export", params={"format": "pdf"}).content
    with pdfium.PdfDocument(pdf_data) as pdf, closing(pdf[0]) as pdf_page:
        width, height = pdf_page.get_size()
        assert width * 25.4 / 72 == pytest.approx(210, abs=.2)
        assert height * 25.4 / 72 < 297
    page.locator(".legend-canvas").click(position={"x": 5, "y": 5})
    page.get_by_role("combobox", name="Legendenlayout", exact=True).select_option("compact")
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    reference = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert reference["style"]["columns"] == 3 and reference["style"]["margin"] == 5
    assert all(block["style"]["padding"] == 1.2 for block in reference["blocks"])
    page.get_by_role("button", name="Rückgängig", exact=True).click()
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    assert client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"] == a4
    page.get_by_role("button", name="Rückgängig", exact=True).click()
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    assert client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"] == original


def test_source_color_selection_survives_reload_and_export_without_losing_parts(editor):
    page, _, client, (pid, _) = editor
    doc = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    item = next(it for block in doc["blocks"] for it in block["items"] if it["kind"] == "symbol")
    item.update(text="UP Original", color="#0099ff", layer_colors=["#0099ff", "#ff0000"])
    item["parts"] = [{key: item[key] for key in ("family_key", "symbol_key", "length_mm", "width_mm", "symbol_factor", "rotation")} |
                     {"text": "AP kombiniert", "color": "#00aa00", "layer_colors": ["#00aa00", "#ff6600"]}]
    assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
    reopen_first_editor(page)
    page.set_viewport_size({"width": 1600, "height": 1100})
    page.locator(f'.lg-hit[data-id="{item["id"]}"]').click()
    choices = page.get_by_role("group", name="Farbvarianten Symbol 1", exact=True)
    choices.get_by_role("button", name="Nur Farbe B", exact=True).click()
    playwright.expect(choices.get_by_role("button", name="Nur Farbe B", exact=True)).to_have_attribute("aria-pressed", "true")
    playwright.expect(page.get_by_label("Symbolfarbe", exact=True)).to_have_value("#ff0000")
    page.get_by_role("tab", name="Text 2 / Symbol 2", exact=True).click()
    page.get_by_role("group", name="Farbvarianten Symbol 2", exact=True).get_by_role("button", name="Nur Farbe A", exact=True).click()
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    current = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    stored = next(it for block in current["blocks"] for it in block["items"] if it["id"] == item["id"])
    assert stored["layer_colors"] == ["#0099ff", "#ff0000"]
    assert stored["visible_layer_colors"] == ["#ff0000"]
    assert stored["parts"][0]["layer_colors"] == ["#00aa00", "#ff6600"]
    assert stored["parts"][0]["visible_layer_colors"] == ["#00aa00"]
    lay = client.post(f"/api/projects/{pid}/legend/layout", json={"doc": current}).json()
    prims = [p for p in lay["prims"] if p["t"] == "symbol" and p["id"] == item["id"]]
    assert [(p["part"], p["variant"], p["color"]) for p in prims] == [(0, 1, "#ff0000"), (1, 0, "#00aa00")]
    # The backend exports the UI's saved choice, not a separate demonstration model.
    exported = client.get(f"/api/projects/{pid}/legend/export", params={"format": "pdf", "general": False})
    assert exported.status_code == 200
    with pdfium.PdfDocument(exported.content) as pdf, closing(pdf[0]) as pdf_page:
        with closing(pdf_page.render(scale=3)) as bitmap:
            image = bitmap.to_pil().convert("RGB")
        rgb = image.tobytes()
        pixels = list(zip(rgb[0::3], rgb[1::3], rgb[2::3]))
        assert any(r > 180 and g < 90 and b < 90 for r, g, b in pixels)
        assert any(g > 100 and r < 90 and b < 90 for r, g, b in pixels)
    dxf = client.get(f"/api/projects/{pid}/legend/export", params={"format": "dxf", "general": False})
    assert dxf.status_code == 200
    drawing = ezdxf.read(StringIO(dxf.content.decode("utf-8")))
    assert drawing.modelspace().query("INSERT")
    reopen_first_editor(page)
    page.locator(f'.lg-hit[data-id="{item["id"]}"]').click()
    choices = page.get_by_role("group", name="Farbvarianten Symbol 1", exact=True)
    playwright.expect(choices.get_by_role("button", name="Nur Farbe B", exact=True)).to_have_attribute("aria-pressed", "true")
    choices.get_by_role("button", name="Alle", exact=True).click()
    page.get_by_role("button", name="Legende speichern", exact=True).click()
    all_doc = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    prims = [p for p in client.post(f"/api/projects/{pid}/legend/layout", json={"doc": all_doc}).json()["prims"]
             if p["t"] == "symbol" and p["id"] == item["id"]]
    assert len(prims) == 3
    assert {p["color"] for p in prims} == {"#0099ff", "#ff0000", "#00aa00"}
