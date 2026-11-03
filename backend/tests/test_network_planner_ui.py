"""Real editor interactions for the modular network planner, with an isolated API."""
from __future__ import annotations

import json
import re

from test_editor_navigation import editor, env, playwright  # noqa: F401 - shared fixtures


def open_network(page):
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Berechnungen öffnen", exact=True).click()
    playwright.expect(page.locator(".calc-tile")).to_have_count(26)
    page.get_by_role("button", name="Netzplaner (Beta) öffnen", exact=True).click()
    playwright.expect(page.get_by_label("Name des Netzplans", exact=True)).to_be_enabled()


def expect_review(page, state):
    playwright.expect(page.locator("[data-network-review-state]").first).to_have_attribute("data-network-review-state", state)


def review_network(page):
    page.locator("[data-network-review-state]").first.get_by_role("button", name="Berechnen & prüfen", exact=True).click()
    expect_review(page, "current")
    playwright.expect(page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)).to_be_enabled()


def test_network_editor_add_connect_drag_delete_undo_and_invalid_input(editor, tmp_path):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1300})
    open_network(page)
    playwright.expect(page.locator(".np-node")).to_have_count(4)
    playwright.expect(page.locator(".np-edge")).to_have_count(3)
    playwright.expect(page.get_by_label("Name des Netzplans", exact=True)).to_have_value("Beispielnetz · radial")
    pdf = page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)
    expect_review(page, "unchecked")
    playwright.expect(pdf).to_be_disabled()
    review_network(page)
    playwright.expect(page.get_by_role("tab", name="Prüfbericht", exact=True)).to_be_visible()
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    labels = page.locator(".np-network-svg text").evaluate_all("els => els.map(el => {const r=el.getBoundingClientRect();return {text:el.textContent,x:r.x,y:r.y,w:r.width,h:r.height}})")
    for index, a in enumerate(labels):
        for b in labels[index + 1:]:
            overlap_x = min(a["x"] + a["w"], b["x"] + b["w"]) - max(a["x"], b["x"])
            overlap_y = min(a["y"] + a["h"], b["y"] + b["h"]) - max(a["y"], b["y"])
            assert overlap_x <= 1 or overlap_y <= 1, f"Overlapping network labels: {a['text']} / {b['text']}"
    page.screenshot(path=str(tmp_path / "netzplaner-beispiel.png"), full_page=True)

    page.locator('[data-edge-id="line-3"] .np-edge-hit').click(force=True)
    length = page.locator('[data-network-field="length"]')
    playwright.expect(length).to_have_value("25")
    length.fill("")
    expect_review(page, "stale")
    playwright.expect(pdf).to_be_disabled()
    playwright.expect(page.get_by_role("button", name="Projektbezogen auf Server speichern", exact=True)).to_be_enabled()
    review_network(page)
    playwright.expect(page.locator(".np-network-status")).to_have_class(re.compile(r"\bnp-tone-error\b"))
    assert page.locator(".np-network-summary strong").all_text_contents() == ["–", "–", "–"]
    page.locator(".np-inspector").screenshot(path=str(tmp_path / "netzplaner-fehlerbericht.png"))
    # A diagnostic report is available after an explicit failed review.
    with page.expect_download() as failed_report:
        pdf.click()
    assert failed_report.value.path().read_bytes().startswith(b"%PDF-")
    # The review may switch to the report tab; reopen the selected line properties.
    page.get_by_role("tab", name="Eigenschaften", exact=True).click()
    length.fill("25")
    expect_review(page, "stale")
    playwright.expect(pdf).to_be_disabled()
    review_network(page)

    page.get_by_role("button", name="Leuchte hinzufügen", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(5)
    playwright.expect(pdf).to_be_disabled()
    page.get_by_role("button", name="Einspeisung NS: Ausgang verbinden", exact=True).click()
    page.get_by_role("button", name="Leuchte: Eingang verbinden", exact=True).click()
    playwright.expect(page.locator(".np-edge")).to_have_count(4)
    playwright.expect(pdf).to_be_disabled()
    review_network(page)
    page.get_by_role("button", name="Auswählen", exact=True).click()
    page.get_by_role("button", name="Bauteil Leuchte", exact=True).click()
    page.get_by_role("button", name="Ausgewähltes Element löschen", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(4)
    playwright.expect(page.locator(".np-edge")).to_have_count(3)
    page.get_by_role("button", name="Netzplan rückgängig", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(5)
    playwright.expect(page.locator(".np-edge")).to_have_count(4)
    page.get_by_role("button", name="Netzplan wiederholen", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(4)
    review_network(page)

    source = page.locator('[data-node-id="source"]')
    before = source.get_attribute("transform")
    box = source.bounding_box()
    page.mouse.move(box["x"] + box["width"] * .2, box["y"] + box["height"] * .4)
    page.mouse.down()
    page.mouse.move(box["x"] + box["width"] * .2 + 65, box["y"] + box["height"] * .4 + 25, steps=6)
    page.mouse.up()
    assert source.get_attribute("transform") != before
    expect_review(page, "current")
    playwright.expect(pdf).to_be_enabled()
    page.get_by_role("button", name="Netzplan rückgängig", exact=True).click()
    playwright.expect(source).to_have_attribute("transform", before)
    page.get_by_role("button", name="Anordnen", exact=True).click()
    expect_review(page, "current")
    page.get_by_role("button", name="Vertikal", exact=True).click()
    expect_review(page, "current")
    page.get_by_role("button", name="Anordnen", exact=True).click()
    expect_review(page, "current")
    page.get_by_role("button", name="Horizontal", exact=True).click()
    expect_review(page, "current")
    page.get_by_role("button", name="Anordnen", exact=True).click()
    expect_review(page, "current")
    playwright.expect(pdf).to_be_enabled()
    page.get_by_role("button", name="Netzplan vergrössern", exact=True).click()
    page.get_by_role("button", name="Netzplan vollständig einpassen", exact=True).click()
    page.screenshot(path=str(tmp_path / "netzplaner-verbunden.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.locator(".engineering-lab").evaluate("el => el.scrollWidth <= el.clientWidth")
    page.screenshot(path=str(tmp_path / "netzplaner-mobil.png"), full_page=True)
    # Resizing must bring the source into the smaller canvas instead of keeping an offscreen desktop pan offset.
    page.locator(".np-canvas-shell").scroll_into_view_if_needed()
    page.evaluate("() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))")
    mobile_canvas = page.locator(".np-canvas").bounding_box()
    mobile_source = page.locator('[data-node-id="source"]').bounding_box()
    assert mobile_canvas["x"] <= mobile_source["x"] < mobile_canvas["x"] + mobile_canvas["width"]
    assert mobile_canvas["y"] <= mobile_source["y"] < mobile_canvas["y"] + mobile_canvas["height"]
    page.locator(".np-canvas-shell").screenshot(path=str(tmp_path / "netzplaner-mobil-canvas.png"))


def test_network_json_import_roundtrip_and_actual_pdf(editor, tmp_path):
    import pypdfium2 as pdfium
    from contextlib import closing
    page, _, _, _ = editor
    open_network(page)
    review_network(page)
    with page.expect_download() as exported:
        page.get_by_role("button", name="Netzentwurf als JSON herunterladen", exact=True).click()
    original = json.loads(exported.value.path().read_bytes())
    assert original["schema"] == "edeco.network.v1" and len(original["network"]["nodes"]) == 4
    assert original["draft"] is False
    broken = json.loads(json.dumps(original))
    broken["network"]["nodes"].append(broken["network"]["nodes"][0])
    upload = page.locator('.np-file-input')
    upload.set_input_files({"name": "broken.json", "mimeType": "application/json", "buffer": json.dumps(broken).encode()})
    playwright.expect(page.locator(".np-editor-message")).to_contain_text("Ungültiges Bauteil")
    playwright.expect(page.locator(".np-node")).to_have_count(4)
    imported = json.loads(json.dumps(original))
    imported["network"]["name"] = "Schulhaus Variante B"
    imported["network"]["nodes"][-1]["values"]["power"] = "3"
    upload.set_input_files({"name": "variante.json", "mimeType": "application/json", "buffer": json.dumps(imported).encode()})
    playwright.expect(page.get_by_label("Name des Netzplans", exact=True)).to_have_value("Schulhaus Variante B")
    page.get_by_role("button", name="Netzplan rückgängig", exact=True).click()
    playwright.expect(page.get_by_label("Name des Netzplans", exact=True)).to_have_value("Beispielnetz · radial")
    page.get_by_role("button", name="Netzplan wiederholen", exact=True).click()
    playwright.expect(page.get_by_label("Name des Netzplans", exact=True)).to_have_value("Schulhaus Variante B")
    playwright.expect(page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)).to_be_disabled()
    review_network(page)
    page.get_by_label("Projektnotizen / Grundlagenverweis", exact=True).fill("Leitungslängen am Objekt verifizieren")
    expect_review(page, "current")
    with page.expect_download() as pending:
        page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True).click()
    pending.value.save_as(tmp_path / "Netzberechnung.pdf")
    with pdfium.PdfDocument(pending.value.path()) as document:
        assert len(document) >= 1
        with closing(document[0]) as first:
            width, height = first.get_size()
            assert abs(width - 595.276) < .1 and abs(height - 841.89) < .1
    page.get_by_role("button", name="Berechnungen", exact=True).click()
    page.get_by_role("button", name="Netzplaner (Beta) öffnen", exact=True).click()
    playwright.expect(page.get_by_label("Name des Netzplans", exact=True)).to_have_value("Schulhaus Variante B")
    playwright.expect(page.get_by_label("Projektnotizen / Grundlagenverweis", exact=True)).to_have_value("Leitungslängen am Objekt verifizieren")


def test_empty_network_is_not_a_pass_and_unfinished_draft_can_be_archived(editor, tmp_path):
    page, _, _, _ = editor
    base = page.url.rstrip("/")
    projects = page.request.get(base + "/api/tools/projektzentrale/state").json()
    created = page.request.post(base + "/api/tools/projektzentrale/projects", headers={"X-Edeco-Projects": projects["session_key"]}, data={"number": "1498", "name": "Schulhaus Netzplanung"})
    assert created.ok
    archive_api = base + "/api/tools/berechnungsablage"
    state = page.request.get(archive_api + "/state").json()
    headers = {"X-Edeco-Projects": state["session_key"]}
    folder = tmp_path / "server"
    folder.mkdir()
    configured = page.request.post(archive_api + "/settings", headers=headers, data={"root": str(folder), "subfolder": "Berechnungen", "revision": state["settings"]["revision"]})
    assert configured.ok
    open_network(page)
    page.get_by_role("button", name="Neu", exact=True).click()
    dialog = page.get_by_role("alertdialog", name="Leeres Netz anlegen?", exact=True)
    dialog.get_by_role("button", name="Leeres Netz anlegen", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(0)
    playwright.expect(page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)).to_be_disabled()
    review_network(page)
    playwright.expect(page.locator(".np-network-status")).to_have_class(re.compile(r"\bnp-tone-error\b"))
    assert "entspricht NIN" not in page.locator(".np-network-status").inner_text()
    page.get_by_label("Projektnotizen / Grundlagenverweis", exact=True).fill("Offener Entwurf, noch keine Leitungen")
    save = page.get_by_role("button", name="Projektbezogen auf Server speichern", exact=True)
    playwright.expect(save).to_be_enabled()
    save.click()
    dialog = page.get_by_role("dialog", name="Projektbezogen speichern", exact=True)
    playwright.expect(dialog.get_by_label("Ablage-Projektnummer", exact=True)).to_have_value("1498")
    dialog.get_by_label("Rechenstand-Bezeichnung", exact=True).fill("Offener Netzentwurf")
    dialog.get_by_role("button", name="Als neuen Stand speichern", exact=True).click()
    playwright.expect(dialog.get_by_role("status")).to_contain_text("Gemeinsam gespeichert")
    page.get_by_role("button", name="Information schliessen", exact=True).click()
    page.get_by_role("button", name="Beispiel laden", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(4)
    page.get_by_role("button", name="Gemeinsame Berechnungsablage öffnen", exact=True).click()
    page.locator(".archive-item").filter(has_text="Offener Netzentwurf").click()
    page.get_by_role("button", name="Eingaben laden & neu berechnen", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(0)
    playwright.expect(page.get_by_label("Projektnotizen / Grundlagenverweis", exact=True)).to_have_value("Offener Entwurf, noch keine Leitungen")
    records = page.request.get(archive_api + "/records", headers=headers).json()["items"]
    record = page.request.get(archive_api + "/record", headers=headers, params={"key": records[0]["key"]}).json()
    assert record["document"]["draft"] is True and record["document"]["network"]["nodes"] == []


def test_corrupt_local_network_is_preserved_until_an_explicit_new_document(editor):
    page, _, _, _ = editor
    page.evaluate("localStorage.setItem('edeco.network.v1.unassigned', '{broken')")
    open_network(page)
    playwright.expect(page.get_by_label("Name des Netzplans", exact=True)).to_have_value("Wiederherstellung prüfen")
    playwright.expect(page.locator(".np-recovery")).to_be_visible()
    assert page.evaluate("localStorage.getItem('edeco.network.v1.unassigned')") == "{broken"
    with page.expect_download() as pending:
        page.get_by_role("button", name="Unveränderte Altdaten herunterladen", exact=True).click()
    assert pending.value.path().read_text() == "{broken"
    playwright.expect(page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)).to_be_disabled()
    page.get_by_role("button", name="Beispiel laden", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(4)
    playwright.expect(page.locator(".np-recovery")).to_have_count(0)
    playwright.expect(page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)).to_be_disabled()
    review_network(page)
    assert json.loads(page.evaluate("localStorage.getItem('edeco.network.v1.unassigned')"))["network"]["name"] == "Beispielnetz · radial"


def test_palette_click_attaches_to_selected_bus_and_selects_the_new_cable(editor):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1300})
    open_network(page)
    review_network(page)
    page.locator('[data-node-id="uv"]').click()
    expect_review(page, "current")
    page.get_by_role("button", name="Steckdose hinzufügen", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(5)
    playwright.expect(page.locator(".np-edge")).to_have_count(4)
    expect_review(page, "stale")
    playwright.expect(page.get_by_role("button", name="Berechnung als PDF herunterladen", exact=True)).to_be_disabled()
    selected_cable = page.locator(".np-edge.np-selected[data-edge-id]")
    playwright.expect(selected_cable).to_have_count(1)
    playwright.expect(page.locator('[data-network-field="length"]')).to_have_value("25")
    page.locator('[data-network-field="length"]').fill("12")
    with page.expect_download() as pending:
        page.get_by_role("button", name="Netzentwurf als JSON herunterladen", exact=True).click()
    document = json.loads(pending.value.path().read_bytes())["network"]
    socket = next(node for node in document["nodes"] if node["kind"] == "load" and node["values"]["device"] == "socket")
    cable = next(edge for edge in document["edges"] if edge["id"] == selected_cable.get_attribute("data-edge-id"))
    assert cable["from"] == "uv" and cable["to"] == socket["id"]
    assert cable["values"]["length"] == "12"
    review_network(page)


def test_output_to_input_drag_connects_without_first_enabling_connection_mode(editor):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1300})
    open_network(page)
    # A load is an endpoint: adding beside it deliberately leaves a new branch unconnected.
    page.locator('[data-node-id="load"]').click()
    page.get_by_role("button", name="Leuchte hinzufügen", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(5)
    playwright.expect(page.locator(".np-edge")).to_have_count(3)
    light = page.get_by_role("button", name="Bauteil Leuchte", exact=True)
    light_id = light.get_attribute("data-node-id")
    output = page.get_by_role("button", name="Einspeisung NS: Ausgang verbinden", exact=True)
    target = page.get_by_role("button", name="Leuchte: Eingang verbinden", exact=True)
    output.scroll_into_view_if_needed()
    source_box, target_box = output.bounding_box(), target.bounding_box()
    assert source_box and target_box
    page.mouse.move(source_box["x"] + source_box["width"] / 2, source_box["y"] + source_box["height"] / 2)
    page.mouse.down()
    page.mouse.move(target_box["x"] + target_box["width"] / 2, target_box["y"] + target_box["height"] / 2, steps=12)
    page.mouse.up()
    playwright.expect(page.locator(".np-edge")).to_have_count(4)
    with page.expect_download() as pending:
        page.get_by_role("button", name="Netzentwurf als JSON herunterladen", exact=True).click()
    document = json.loads(pending.value.path().read_bytes())["network"]
    assert any(edge["from"] == "source" and edge["to"] == light_id for edge in document["edges"])
    expect_review(page, "unchecked")
    review_network(page)


def test_palette_drag_preview_and_drop_connect_a_clear_branch(editor, tmp_path):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1300})
    open_network(page)
    with page.expect_download() as pending:
        page.get_by_role("button", name="Netzentwurf als JSON herunterladen", exact=True).click()
    network = json.loads(pending.value.path().read_bytes())["network"]
    # One source leaves enough clear canvas space for a visible drop target.
    network["nodes"] = [network["nodes"][0]]
    network["edges"] = []
    page.locator(".np-file-input").set_input_files({"name": "einspeisung.json", "mimeType": "application/json", "buffer": json.dumps(network).encode()})
    canvas = page.locator(".np-canvas")
    canvas.scroll_into_view_if_needed()
    source = network["nodes"][0]
    drop = page.locator(".np-network-svg").evaluate("""(svg, p) => {
      const point = new DOMPoint(p.x+280+104,p.y+230+66).matrixTransform(svg.getScreenCTM());
      return {clientX:point.x,clientY:point.y};
    }""", source)
    transfer = page.evaluate_handle("new DataTransfer()")
    light = page.get_by_role("button", name="Leuchte hinzufügen", exact=True)
    light.dispatch_event("dragstart", {"dataTransfer": transfer})
    canvas.dispatch_event("dragover", {"dataTransfer": transfer, **drop})
    preview = page.locator('.np-placement-preview[data-attachment-parent="source"]')
    playwright.expect(preview).to_be_visible()
    playwright.expect(preview).to_contain_text("Anschluss: Einspeisung NS")
    canvas.screenshot(path=str(tmp_path / "netzplaner-drop-vorschau.png"))
    canvas.dispatch_event("drop", {"dataTransfer": transfer, **drop})
    light.dispatch_event("dragend", {"dataTransfer": transfer})
    playwright.expect(page.locator(".np-node")).to_have_count(2)
    playwright.expect(page.locator(".np-edge.np-selected")).to_have_count(1)
    playwright.expect(page.locator('[data-network-field="area"]')).to_be_visible()
    playwright.expect(page.locator(".np-placement-preview")).to_have_count(0)
    with page.expect_download() as saved:
        page.get_by_role("button", name="Netzentwurf als JSON herunterladen", exact=True).click()
    updated = json.loads(saved.value.path().read_bytes())["network"]
    assert updated["edges"][0]["from"] == "source"
    assert updated["edges"][0]["to"] == updated["nodes"][1]["id"]
    assert updated["nodes"][1]["x"] > source["x"]
    page.get_by_role("button", name="Bauteil Einspeisung NS", exact=True).click()
    page.get_by_role("button", name="Unterverteilung hinzufügen", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(3)
    playwright.expect(page.locator(".np-edge")).to_have_count(2)
    # Moving the connected light next to the new distribution must never rewire its existing input.
    light_node=page.get_by_role("button", name="Bauteil Leuchte", exact=True)
    light_node.scroll_into_view_if_needed()
    box=light_node.bounding_box()
    delta=page.locator(".np-network-svg").evaluate("svg=>svg.getScreenCTM().a*280")
    page.mouse.move(box["x"]+box["width"]*.4,box["y"]+box["height"]*.5)
    page.mouse.down()
    page.mouse.move(box["x"]+box["width"]*.4+delta,box["y"]+box["height"]*.5,steps=10)
    page.mouse.up()
    playwright.expect(page.locator(".np-edge")).to_have_count(2)
    with page.expect_download() as moved:
        page.get_by_role("button", name="Netzentwurf als JSON herunterladen", exact=True).click()
    after_move=json.loads(moved.value.path().read_bytes())["network"]
    light_id=updated["nodes"][1]["id"]
    assert next(edge for edge in after_move["edges"] if edge["to"]==light_id)["from"]=="source"
    page.get_by_role("button", name="Netzplan rückgängig", exact=True).click()
    page.get_by_role("button", name="Netzplan rückgängig", exact=True).click()
    page.get_by_role("button", name="Netzplan rückgängig", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(1)
    playwright.expect(page.locator(".np-edge")).to_have_count(0)


def test_two_floor_distributions_have_independent_branches_and_shared_trunk(editor, tmp_path):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 2200, "height": 1600})
    open_network(page)
    page.get_by_role("button", name="Beispiel: 2 Unterverteilungen", exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(10)
    playwright.expect(page.locator(".np-edge")).to_have_count(9)
    playwright.expect(page.locator(".np-canvas-heading")).to_contain_text("links → rechts")
    playwright.expect(page.get_by_role("button", name="Bauteil UV 1. OG", exact=True)).to_have_count(1)
    playwright.expect(page.get_by_role("button", name="Bauteil UV 2. OG", exact=True)).to_have_count(1)
    expect_review(page, "unchecked")
    playwright.expect(page.locator(".np-editor-message")).to_contain_text("Beispielwerte")
    page.get_by_role("button", name="Netzplan vollständig einpassen", exact=True).click()
    page.locator(".np-canvas-shell").screenshot(path=str(tmp_path / "netzplaner-zwei-uv-uebersicht.png"))
    page.set_viewport_size({"width":2200,"height":1900})
    page.locator(".engineering-lab").evaluate("el=>{el.scrollTop=0;}")
    page.screenshot(path=str(tmp_path / "netzplaner-zwei-uv-gesamt.png"),full_page=True)
    labels = page.locator(".np-network-svg text").evaluate_all("els=>els.map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,x:r.x,y:r.y,w:r.width,h:r.height}})")
    for index, a in enumerate(labels):
        for b in labels[index+1:]:
            overlap_x=min(a["x"]+a["w"],b["x"]+b["w"])-max(a["x"],b["x"])
            overlap_y=min(a["y"]+a["h"],b["y"]+b["h"])-max(a["y"],b["y"])
            assert overlap_x<=1 or overlap_y<=1, f"Overlapping branch labels: {a['text']} / {b['text']}"

    def snapshot():
        with page.expect_download() as pending:
            page.get_by_role("button", name="Netzentwurf als JSON herunterladen", exact=True).click()
        return json.loads(pending.value.path().read_bytes())

    before=snapshot()
    assert before["network"]["orientation"]=="horizontal"
    edges={edge["id"]:edge for edge in before["network"]["edges"]}
    assert edges["feed-uv-1"]["to"]=="uv-1" and edges["feed-uv-2"]["to"]=="uv-2"
    assert edges["feed-uv-1"]["values"]["length"]=="15"
    assert edges["feed-uv-2"]["values"]["length"]=="25"
    page.locator('[data-edge-id="feed-uv-1"] .np-edge-label').click()
    playwright.expect(page.locator('[data-network-field="area"] select')).to_have_value("10")
    page.locator('[data-edge-id="ls-load-1"] .np-edge-label').click()
    playwright.expect(page.locator('[data-network-field="area"] select')).to_have_value("2.5")
    page.locator('[data-node-id="load-1"]').click()
    page.locator('[data-network-field="power"]').fill("13.8")
    after=snapshot()
    first={edge["id"]:edge for edge in before["result"]["edges"]}
    changed={edge["id"]:edge for edge in after["result"]["edges"]}
    assert changed["house-hv"]["current"]>first["house-hv"]["current"]
    assert changed["ls-load-1"]["current"]>first["ls-load-1"]["current"]
    assert abs(changed["ls-load-2"]["current"]-first["ls-load-2"]["current"])<1e-10
    assert abs(changed["ls-load-2"]["dropPercent"]-first["ls-load-2"]["dropPercent"])<1e-10
    assert changed["ls-load-2"]["cumulativeDropPercent"]>first["ls-load-2"]["cumulativeDropPercent"]
    assert changed["ls-load-1"]["tone"]=="error"
    playwright.expect(page.locator('[data-edge-id="ls-load-1"]')).to_have_attribute("data-state","error")
    page.get_by_role("button", name="Netzplan vollständig einpassen", exact=True).click()
    page.locator(".np-canvas-shell").screenshot(path=str(tmp_path / "netzplaner-zwei-uv-fehler.png"))
    review_network(page)
    contexts=page.locator(".np-issue-context").all_text_contents()
    assert contexts and all(context.strip() for context in contexts)
    assert any("1. OG" in context for context in contexts)
    assert any("2. OG" in context for context in contexts)
    page.locator(".np-inspector").screenshot(path=str(tmp_path / "netzplaner-zwei-uv-pruefbericht.png"))
    page.get_by_role("button", name="Netzplan vergrössern", exact=True).click()
    page.get_by_role("button", name="Netzplan vergrössern", exact=True).click()
    page.locator(".np-canvas-shell").screenshot(path=str(tmp_path / "netzplaner-zwei-uv-detail.png"))



def test_deleting_a_node_during_wire_drag_keeps_editor_usable_and_undoable(editor):
    page,_,_,_=editor
    page.set_viewport_size({"width":1680,"height":1300})
    open_network(page)
    page.locator('[data-node-id="source"]').click()
    output=page.get_by_role("button",name="Einspeisung NS: Ausgang verbinden",exact=True)
    output.scroll_into_view_if_needed()
    box=output.bounding_box()
    x,y=box["x"]+box["width"]/2,box["y"]+box["height"]/2
    page.mouse.move(x,y)
    page.mouse.down()
    page.mouse.move(x+60,y-30,steps=4)
    playwright.expect(page.locator(".np-wire-preview")).to_have_count(1)
    page.keyboard.press("Delete")
    page.mouse.up()
    playwright.expect(page.locator(".np-network-svg")).to_have_count(1)
    playwright.expect(page.locator(".np-node")).to_have_count(3)
    playwright.expect(page.locator(".np-wire-preview")).to_have_count(0)
    page.get_by_role("button",name="Netzplan rückgängig",exact=True).click()
    playwright.expect(page.locator(".np-node")).to_have_count(4)
    playwright.expect(page.locator(".np-edge")).to_have_count(3)
    page.locator('[data-node-id="source"]').click()
    playwright.expect(page.locator('[data-network-field="maxCurrent"] select')).to_have_value("160")
