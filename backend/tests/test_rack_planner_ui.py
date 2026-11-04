"""Exercise rack placement, port persistence and real exports in the shared UI."""

from __future__ import annotations

import csv
import json
import os
from pathlib import Path
import re
import socket
import threading
import time

import pytest
import uvicorn

from edeco_toolbox.app import create_app
from test_editor_navigation import launch_chromium, playwright
from test_phase3 import env  # noqa: F401 - isolated backend data and preferences


@pytest.fixture()
def rack_ui(env):
    client, _ = env
    default_ui = Path(__file__).resolve().parents[2] / "ui" / "dist"
    ui = Path(os.environ.get("NOVA_TEST_UI_DIR", os.environ.get("EDECO_TEST_UI_DIR", default_ui)))
    if not (ui / "index.html").is_file():
        pytest.skip("Build the UI before browser tests")
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    served = create_app(client.app.state.nova, ui_dir=ui)
    client.app.state.toolhub_presentation = served.state.presentation
    server = uvicorn.Server(uvicorn.Config(served, log_level="error"))
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started:
        if not thread.is_alive() or time.monotonic() > deadline:
            raise RuntimeError("Rack test API did not start")
        time.sleep(.02)
    try:
        with playwright.sync_playwright() as pw:
            browser = launch_chromium(pw)
            page = browser.new_page(viewport={"width": 1440, "height": 1000})
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(f"http://127.0.0.1:{sock.getsockname()[1]}")
            page.get_by_role("button", name="Rack-Dispo öffnen", exact=True).click()
            playwright.expect(page.locator(".rack-planner")).to_be_visible()
            yield page, client
            assert not errors
            browser.close()
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()


def rack_document():
    """Known project data, independent of the library's generic example values."""
    profiles = []
    for profile_id, name, kind, depth, ports, power in (
        ("patch24", "Prüfpanel 24 Ports", "patch", 150, 24, 0),
        ("manager", "Prüf-Rangierpanel", "manager", 100, 0, 0),
        ("switch24", "Prüfswitch 24 Ports", "switch", 300, 24, 75),
    ):
        profiles.append({
            "id": profile_id, "name": name, "kind": kind, "units": 1,
            "depthMm": depth, "inwardCableMm": 30, "outwardCableMm": 40,
            "weightKg": 2, "powerW": power, "loadLimitKg": None,
            "portCount": ports, "medium": "RJ45" if ports else "none",
            "manufacturer": "Prüfdaten", "article": "", "source": "Browser-Referenzfall",
            "verified": True,
        })
    placements = []
    for placement_id, profile_id, he in (("patch1", "patch24", 40), ("manager1", "manager", 39), ("switch1", "switch24", 38)):
        placements.append({
            "id": placement_id, "rackId": "r1", "profileId": profile_id,
            "label": profiles[len(placements)]["name"], "startUnit": he,
            "side": "front", "status": "planned", "delivery": "open", "montage": "open",
            "notes": "", "supportedById": None, "zeroStartMm": None,
            "zeroHeightMm": None, "zeroInwardOffsetMm": None,
        })
    ports = [
        {"placementId": placement_id, "number": number, "label": "", "target": "",
         "outlet": "", "room": "", "state": "unknown"}
        for placement_id in ("patch1", "switch1") for number in range(1, 25)
    ]
    return {
        "version": 1, "name": "Rack Browser-Referenzfall", "projectNumber": "1294",
        "room": "Technik", "author": "Prüfung", "index": "A", "date": "2026-11-04",
        "racks": [{"id": "r1", "label": "0.3 UKV", "units": 42, "widthMm": 800,
                   "heightMm": 2100, "depthMm": 1000, "usableDepthMm": 700,
                   "frontDoorClearanceMm": 50, "rearDoorClearanceMm": 60,
                   "weightLimitKg": 500, "powerBudgetW": 1000, "room": "Technik", "notes": ""}],
        "profiles": profiles, "placements": placements, "ports": ports,
    }


def import_rack(page, document, name="rack-test.edeco-rack.json", *, confirm=True):
    payload = {"name": name, "mimeType": "application/json", "buffer": json.dumps(document).encode("utf-8")}
    if confirm:
        with page.expect_event("dialog") as confirmation:
            page.locator("[data-rack-import]").set_input_files(payload)
        assert "aktuelle Entwurf wird ersetzt" in confirmation.value.message
        confirmation.value.accept()
    else:
        page.locator("[data-rack-import]").set_input_files(payload)


def saved_document(page, tmp_path):
    with page.expect_download() as output:
        page.get_by_role("button", name="JSON speichern", exact=True).click()
    path = tmp_path / output.value.suggested_filename
    output.value.save_as(path)
    return json.loads(path.read_text(encoding="utf-8"))


def set_rack_theme(page, theme):
    page.evaluate("theme => { document.documentElement.dataset.theme=theme; localStorage.setItem('nova-legenden-theme',theme); window.dispatchEvent(new Event('edeco-theme-change')); }", theme)
    label = "Heller Modus" if theme == "dark" else "Dunkler Modus"
    playwright.expect(page.get_by_role("button", name=label, exact=True)).to_be_visible()


def test_ports_survive_view_changes_reload_and_json_export(rack_ui, tmp_path):
    page, _ = rack_ui
    import_rack(page, rack_document())
    panel = page.locator('[data-rack-placement="patch1"]')
    playwright.expect(panel).to_be_visible()
    panel.click()
    page.get_by_role("tab", name="Portliste", exact=True).click()
    target = page.get_by_label("Port 1 Ziel", exact=True)
    playwright.expect(target).to_be_visible()
    target.fill("Büro Nord / Arbeitsplatz 1")
    target.press("Tab")
    outlet = page.get_by_label("Port 1 Dose", exact=True)
    outlet.fill("RJ45-01.01")
    outlet.press("Tab")
    page.get_by_label("Port 1 Raum", exact=True).fill("2.14")
    page.get_by_label("Port 1 Raum", exact=True).press("Tab")
    page.get_by_label("Port 1 Status", exact=True).select_option("occupied")
    page.get_by_role("button", name="Rückseite", exact=True).click()
    page.get_by_role("button", name="Vorderseite", exact=True).click()
    document = saved_document(page, tmp_path)
    ports = [row for row in document["ports"] if row["placementId"] == "patch1"]
    assert len(ports) == 24
    port = next(row for row in ports if row["number"] == 1)
    assert port["target"] == "Büro Nord / Arbeitsplatz 1"
    assert port["outlet"] == "RJ45-01.01"
    assert port["room"] == "2.14"
    assert port["state"] == "occupied"
    page.reload()
    playwright.expect(page.locator(".rack-planner")).to_be_visible()
    restored = saved_document(page, tmp_path)
    assert restored["ports"] == document["ports"]
    assert restored["placements"] == document["placements"]


def test_invalid_import_preserves_current_rack_and_unknown_values(rack_ui, tmp_path):
    page, _ = rack_ui
    document = rack_document()
    document["profiles"][0]["depthMm"] = None
    document["racks"][0]["usableDepthMm"] = None
    import_rack(page, document)
    playwright.expect(page.locator('[data-rack-placement="patch1"]')).to_be_visible()
    before = saved_document(page, tmp_path)
    assert before["profiles"][0]["depthMm"] is None
    assert before["racks"][0]["usableDepthMm"] is None
    invalid = rack_document()
    invalid["placements"][0]["rackId"] = "nicht-vorhanden"
    import_rack(page, invalid, "ungueltig.json", confirm=False)
    playwright.expect(page.get_by_role("alert").filter(has_text="Rack")).to_be_visible()
    assert saved_document(page, tmp_path) == before


def test_generic_24_port_panel_can_be_added_without_catalogue_requests(rack_ui, tmp_path):
    page, _ = rack_ui
    requests = []
    page.on("request", lambda request: requests.append(request.url))
    page.locator('[data-rack-profile="generic-patch24"]').get_by_role("button", name="Patchpanel · 24 Ports · 1 HE einsetzen", exact=True).click()
    document = saved_document(page, tmp_path)
    placement = next(row for row in document["placements"] if row["profileId"] == "generic-patch24")
    profile = next(row for row in document["profiles"] if row["id"] == placement["profileId"])
    assert profile["units"] == 1
    assert profile["portCount"] == 24
    assert profile["depthMm"] is None
    assert profile["verified"] is False
    page.get_by_role("tab", name="Portliste", exact=True).click()
    playwright.expect(page.locator(".rd-port-table tbody tr")).to_have_count(24)
    # Empty ports may be stored sparsely; a real edit must survive in the file.
    target = page.get_by_label("Port 1 Ziel", exact=True)
    target.fill("Raum 24")
    target.press("Tab")
    saved = saved_document(page, tmp_path)
    assert next(row for row in saved["ports"] if row["placementId"] == placement["id"] and row["number"] == 1)["target"] == "Raum 24"
    with page.expect_download() as output:
        page.get_by_role("button", name="CSV exportieren", exact=True).click()
    path = tmp_path / output.value.suggested_filename
    output.value.save_as(path)
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle, delimiter=";"))
    assert len(rows) == 25
    assert [int(row[3]) for row in rows[1:]] == list(range(1, 25))
    assert not [url for url in requests if "bim2steiger" in url or "steiger2bim" in url]


def test_source_drawing_colours_survive_theme_selection_and_error_highlighting(rack_ui, tmp_path):
    page, _ = rack_ui
    document = rack_document()
    document["racks"][0]["metadata"] = {"drawingFill": "#c6d9f1"}
    document["profiles"][0]["metadata"] = {"drawingFill": "#ffeb99"}
    import_rack(page, document)
    panel = page.locator('[data-rack-placement="patch1"]')
    playwright.expect(panel).to_be_visible()

    def fills():
        return page.evaluate("""() => {
          const fill=selector=>getComputedStyle(document.querySelector(selector)).fill;
          return {rack:fill('.rd-cabinet-shell'),patch:fill('[data-rack-placement="patch1"] .rd-device-body'),manager:fill('[data-rack-placement="manager1"] .rd-device-body'),switch:fill('[data-rack-placement="switch1"] .rd-device-body')};
        }""")

    set_rack_theme(page, "light")
    source = fills()
    assert source == {"rack": "rgb(198, 217, 241)", "patch": "rgb(255, 235, 153)",
                      "manager": "rgb(255, 255, 255)", "switch": "rgb(255, 255, 255)"}
    glyph = page.locator('[data-rack-placement="manager1"] .rd-device-glyph path').first
    assert glyph.evaluate("el => getComputedStyle(el).stroke") == "rgb(34, 34, 34)"
    panel.click()
    playwright.expect(panel.locator(".rd-selection-ring")).to_be_visible()
    assert fills() == source
    # Use the actual application control, including its stored theme preference.
    page.get_by_role("button", name="Dunkler Modus", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Heller Modus", exact=True)).to_be_visible()
    assert fills() == source
    assert glyph.evaluate("el => getComputedStyle(el).stroke") == "rgb(34, 34, 34)"
    he = page.locator('[data-rack-field="startUnit"] input')
    he.fill("39")
    he.press("Tab")
    playwright.expect(panel).to_have_attribute("data-tone", "error")
    assert fills() == source
    assert glyph.evaluate("el => getComputedStyle(el).stroke") == "rgb(34, 34, 34)"
    saved = saved_document(page, tmp_path)
    assert saved["racks"][0]["metadata"]["drawingFill"] == "#c6d9f1"
    assert next(profile for profile in saved["profiles"] if profile["id"] == "patch24")["metadata"]["drawingFill"] == "#ffeb99"
    import_rack(page, rack_document())
    defaults = fills()
    assert defaults["patch"] == defaults["manager"] == defaults["switch"] == "rgb(255, 255, 255)"
    frame = [int(value) for value in re.findall(r"\d+", defaults["rack"])]
    assert len(frame) == 3 and 150 <= min(frame) <= max(frame) < 250 and max(frame) - min(frame) <= 10
    page.get_by_role("button", name="Heller Modus", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Dunkler Modus", exact=True)).to_be_visible()
    assert fills() == defaults


def test_collision_reports_the_actual_devices_and_jumps_to_the_editable_he(rack_ui, tmp_path):
    page, _ = rack_ui
    import_rack(page, rack_document())
    page.locator('[data-rack-placement="patch1"]').click()
    he = page.locator('[data-rack-field="startUnit"] input')
    he.fill("39")
    he.press("Tab")
    document = saved_document(page, tmp_path)
    assert next(row for row in document["placements"] if row["id"] == "patch1")["startUnit"] == 39
    page.get_by_role("tab", name=re.compile("^Prüfung")).click()
    collision = page.locator('[data-rack-issue="unit-collision"]')
    playwright.expect(collision).to_contain_text("Prüfpanel 24 Ports")
    playwright.expect(collision).to_contain_text("Prüf-Rangierpanel")
    collision.locator("summary").click()
    playwright.expect(collision).to_contain_text("Vorderseite")
    collision.get_by_role("button", name="Zur Eingabe", exact=True).click()
    playwright.expect(he).to_be_focused()
    playwright.expect(he).to_have_value("39")
    he.fill("37")
    he.press("Tab")
    page.get_by_role("tab", name=re.compile("^Prüfung")).click()
    playwright.expect(page.locator('[data-rack-issue="unit-collision"]')).to_have_count(0)


def test_drag_preview_blocks_a_collision_then_snaps_to_the_requested_free_he(rack_ui, tmp_path):
    page, _ = rack_ui
    import_rack(page, rack_document())
    source = page.locator('[data-rack-profile="patch24"] .rd-library-device')
    zone = page.locator('[data-rack-dropzone="true"]')
    transfer = page.evaluate_handle("() => new DataTransfer()")
    source.dispatch_event("dragstart", {"dataTransfer": transfer})
    occupied = page.locator('.rd-he-row[data-he="39"] rect').bounding_box()
    pointer = {"dataTransfer": transfer, "clientX": occupied["x"] + occupied["width"] / 2,
               "clientY": occupied["y"] + occupied["height"] / 2}
    zone.dispatch_event("dragover", pointer)
    playwright.expect(page.locator(".rd-drop-feedback.is-error")).to_contain_text("Prüf-Rangierpanel")
    zone.dispatch_event("drop", pointer)
    source.dispatch_event("dragend", {"dataTransfer": transfer})
    playwright.expect(page.get_by_role("alert")).to_contain_text("Prüf-Rangierpanel")
    assert len(saved_document(page, tmp_path)["placements"]) == 3
    page.get_by_role("button", name="Meldung schliessen", exact=True).click()
    source.dispatch_event("dragstart", {"dataTransfer": transfer})
    free = page.locator('.rd-he-row[data-he="37"] rect').bounding_box()
    pointer = {"dataTransfer": transfer, "clientX": free["x"] + free["width"] / 2,
               "clientY": free["y"] + free["height"] / 2}
    zone.dispatch_event("dragover", pointer)
    playwright.expect(page.locator(".rd-drop-feedback")).to_contain_text("HE 37")
    zone.dispatch_event("drop", pointer)
    source.dispatch_event("dragend", {"dataTransfer": transfer})
    document = saved_document(page, tmp_path)
    assert len(document["placements"]) == 4
    added = next(row for row in document["placements"] if row["id"] not in {"patch1", "manager1", "switch1"})
    assert added["startUnit"] == 37
    assert added["side"] == "front"


def test_issue_targets_open_the_profile_and_the_correct_rack_limit(rack_ui):
    page, _ = rack_ui
    document = rack_document()
    document["profiles"][0]["depthMm"] = None
    document["racks"][0]["weightLimitKg"] = 5
    import_rack(page, document)
    page.get_by_role("tab", name=re.compile("^Prüfung")).click()
    depth = page.locator('[data-rack-issue="device-depth-open"]')
    depth.locator("summary").click()
    depth.get_by_role("button", name="Zur Eingabe", exact=True).click()
    profile = page.get_by_role("dialog", name="Geräteprofil bearbeiten", exact=True)
    playwright.expect(profile).to_be_visible()
    field = profile.locator('[data-rack-field="depthMm"] input')
    playwright.expect(field).to_be_focused()
    playwright.expect(field).to_have_value("")
    field.fill("160")
    profile.get_by_role("button", name="Profil übernehmen", exact=True).click()
    playwright.expect(profile).not_to_be_visible()
    page.get_by_role("tab", name=re.compile("^Prüfung")).click()
    playwright.expect(page.locator('[data-rack-issue="device-depth-open"]')).to_have_count(0)
    weight = page.locator('[data-rack-issue="rack-weight"]')
    weight.locator("summary").click()
    weight.get_by_role("button", name="Zur Eingabe", exact=True).click()
    limit = page.locator('[data-rack-field="weightLimitKg"] input')
    playwright.expect(limit).to_be_focused()
    playwright.expect(limit).to_have_value("5")
    limit.fill("10")
    limit.press("Tab")
    page.get_by_role("tab", name=re.compile("^Prüfung")).click()
    playwright.expect(page.locator('[data-rack-issue="rack-weight"]')).to_have_count(0)


def test_removed_device_can_be_restored_without_losing_its_ports(rack_ui, tmp_path):
    page, _ = rack_ui
    document = rack_document()
    document["ports"][0]["target"] = "Bleibt beim Reaktivieren erhalten"
    import_rack(page, document)
    placement = page.locator('[data-rack-placement="patch1"]')
    placement.click()
    page.locator('[data-rack-field="status"] select').select_option("removed")
    playwright.expect(placement).to_have_count(0)
    page.get_by_role("tab", name="Liste", exact=True).click()
    page.get_by_text("Entfallene Geräte", exact=True).click()
    page.locator(".rd-bom details").get_by_role("button", name=re.compile("Prüfpanel 24 Ports")).click()
    page.locator('[data-rack-field="status"] select').select_option("planned")
    playwright.expect(placement).to_be_visible()
    restored = saved_document(page, tmp_path)
    port = next(row for row in restored["ports"] if row["placementId"] == "patch1" and row["number"] == 1)
    assert port["target"] == "Bleibt beim Reaktivieren erhalten"


def test_pdf_export_contains_both_views_of_the_current_rack(rack_ui, tmp_path):
    from pypdf import PdfReader

    page, _ = rack_ui
    import_rack(page, rack_document())
    playwright.expect(page.locator('[data-rack-placement="patch1"]')).to_be_visible()
    page.get_by_role("button", name="Exportieren", exact=True).click()
    with page.expect_download() as output:
        page.get_by_role("button", name="PDF exportieren", exact=True).click()
    path = tmp_path / output.value.suggested_filename
    output.value.save_as(path)
    document = PdfReader(path)
    assert len(document.pages) == 4  # Drawing and readable device/issue appendix per view.
    texts = [pdf_page.extract_text() for pdf_page in document.pages]
    assert all("0.3 UKV" in text for text in texts)
    assert "Vorderansicht" in texts[0]
    assert "Rückansicht" in texts[2]
    assert "Prüfpanel 24 Ports" in texts[1]
    assert all(abs(float(pdf_page.mediabox.width) - 595.28) < 1 for pdf_page in document.pages)
    handoff = page.get_by_role("button", name="An PDF-Werkstatt", exact=True)
    playwright.expect(handoff).to_be_visible()
    page.get_by_label("Export-Ansichten", exact=True).select_option("front")
    playwright.expect(handoff).to_have_count(0)
    page.get_by_label("Export-Ansichten", exact=True).select_option("both")
    playwright.expect(handoff).to_be_visible()


def test_rack_workspace_layout_and_document_zoom(rack_ui):
    page, _ = rack_ui
    import_rack(page, rack_document())
    playwright.expect(page.locator('[data-rack-placement="patch1"]')).to_be_visible()
    capture = os.environ.get("RACK_SCREENSHOT_DIR")
    for theme, width, height in (("light", 1440, 1000), ("dark", 1440, 1000), ("dark", 1100, 800)):
        page.set_viewport_size({"width": width, "height": height})
        set_rack_theme(page, theme)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f"Rack workspace overflows at {width}px"
        if capture:
            directory = Path(capture)
            directory.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(directory / f"rack-{theme}-{width}.png"), full_page=True, animations="disabled")
            layout = page.locator(".rd-rack-svg").evaluate("""svg => {
              const box = el => { const r=el.getBoundingClientRect(); return {text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height}; };
              return {dimensions:[...svg.querySelectorAll('.rd-canvas-dimensions text')].map(box),he:[...svg.querySelectorAll('.rd-he-row text')].map(box)};
            }""")
            (directory / f"rack-layout-{theme}-{width}.json").write_text(json.dumps(layout, indent=2), encoding="utf-8")
    # Ctrl-wheel is reserved for the document, never the whole application.
    before = page.locator(".toolhub-header").bounding_box()
    canvas = page.locator("[data-rack-dropzone]")
    zoom = canvas.get_attribute("data-rack-zoom")
    canvas.hover()
    page.keyboard.down("Control")
    page.mouse.wheel(0, -250)
    page.keyboard.up("Control")
    playwright.expect(canvas).not_to_have_attribute("data-rack-zoom", zoom)
    after = page.locator(".toolhub-header").bounding_box()
    assert abs(before["height"] - after["height"]) < 1
    assert page.evaluate("window.visualViewport.scale") == 1


def test_rack_is_available_normally_but_does_not_expand_the_presentation(rack_ui):
    from edeco_toolbox.presentation import PresentationBody

    page, client = rack_ui
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    playwright.expect(page.get_by_role("button", name="Rack-Dispo öffnen", exact=True)).to_be_visible()
    store = client.app.state.toolhub_presentation
    policy = store.snapshot()
    store.save(PresentationBody(
        revision=policy["revision"], demo_enabled=True,
        demo_tools=policy["demo_tools"], admins=policy["admins"],
    ))
    page.reload()
    playwright.expect(page.get_by_role("button", name="NOVA-Legenden öffnen", exact=True)).to_be_visible()
    playwright.expect(page.get_by_role("button", name="Rack-Dispo öffnen", exact=True)).to_have_count(0)
    playwright.expect(page.get_by_role("button", name="PDF-Werkstatt öffnen", exact=True)).to_be_visible()
    playwright.expect(page.get_by_role("button", name="Elektro-Memory öffnen", exact=True)).to_be_visible()


TEXT_AUDIT = """() => {
  const root=document.querySelector('.rack-planner'),svg=root.querySelector('.rd-rack-svg'),vp=root.querySelector('[data-rack-dropzone]');
  const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
  const inter=(a,b)=>({x:Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),y:Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)});
  const overlaps=(a,b)=>{const v=inter(a,b);return v.x>1&&v.y>1;};
  const clip=(r,v)=>{const x=Math.max(r.x,v.x),y=Math.max(r.y,v.y);return{x,y,width:Math.max(0,Math.min(r.x+r.width,v.x+v.width)-x),height:Math.max(0,Math.min(r.y+r.height,v.y+v.height)-y)};};
  const viewport=rect(vp),controls=rect(root.querySelector('.rd-canvas-controls'));
  const texts=[...svg.querySelectorAll('text')].map(el=>({text:el.textContent,kind:el.getAttribute('class')||'HE',...clip(rect(el),viewport)})).filter(r=>r.width>1&&r.height>1);
  const pairs=[];
  for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++)if(overlaps(texts[i],texts[j]))pairs.push({a:texts[i],b:texts[j],intersection:inter(texts[i],texts[j])});
  const controlsOverlaps=texts.filter(t=>overlaps(t,controls));
  const shell=rect(svg.querySelector('.rd-cabinet-shell'));
  const captions=[...svg.querySelectorAll('.rd-cabinet-brand,.rd-cabinet-base')].map(el=>({text:el.textContent,...rect(el)})).filter(t=>t.x<shell.x-1||t.x+t.width>shell.x+shell.width+1);
  const library=[];
  for(const card of root.querySelectorAll('.rd-library-device')){
    const bound=rect(card),strong=card.querySelector('.rd-device-title strong'),small=card.querySelector('.rd-device-title small');
    if(strong&&small&&overlaps(rect(strong),rect(small)))library.push({reason:'title/subtitle overlap',text:strong.textContent});
    for(const el of [strong,small].filter(Boolean)){const r=rect(el);if(r.x<bound.x-1||r.x+r.width>bound.x+bound.width+1)library.push({reason:'outside card',text:el.textContent,rect:r,bound});}
  }
  const header=[];
  for(const parent of root.querySelectorAll('.toolhub-header,.rd-planbar')){
    const children=[...parent.children].map(el=>({text:el.getAttribute('aria-label')||el.textContent.trim().slice(0,80),...rect(el)})).filter(r=>r.width>1&&r.height>1);
    for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++)if(overlaps(children[i],children[j]))header.push({a:children[i],b:children[j]});
  }
  const sizing=[...root.querySelectorAll('.rd-canvas-wrap,.rd-canvas-panel,.rd-canvas-caption,.rd-canvas-caption>span,.rd-canvas-caption svg,.rd-canvas-viewport,.rd-canvas-toolbar')].map(el=>{const c=getComputedStyle(el);return{class:el.getAttribute('class'),...rect(el),display:c.display,flex:c.flex,flexDirection:c.flexDirection,computedHeight:c.height,minHeight:c.minHeight,maxHeight:c.maxHeight,alignItems:c.alignItems};});
  return {width:innerWidth,height:innerHeight,zoom:vp.dataset.rackZoom,viewport,controls,texts,pairs,controlsOverlaps,captions,library,header,sizing};
}"""


def audit_rack_text(page, name):
    """Measure rendered text, including rotated dimensions, rather than source coordinates."""
    layout = page.evaluate(TEXT_AUDIT)
    capture = os.environ.get("RACK_SCREENSHOT_DIR")
    if capture:
        directory = Path(capture)
        directory.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(directory / f"{name}.png"), full_page=True, animations="disabled")
        (directory / f"{name}.json").write_text(json.dumps(layout, indent=2), encoding="utf-8")
    minimum = 260 if layout["width"] <= 850 else 120
    assert layout["viewport"]["height"] >= minimum, f"Drawing viewport collapsed in {name}: {layout['sizing']}"
    assert len(layout["texts"]) >= 10, f"Rack text is missing in {name}: {layout['sizing']}"
    assert not layout["pairs"], f"SVG text overlap in {name}: {layout['pairs'][:3]}"
    assert not layout["controlsOverlaps"], f"Controls cover rack text in {name}: {layout['controlsOverlaps']}"
    assert not layout["captions"], f"Cabinet captions exceed its width in {name}: {layout['captions']}"
    assert not layout["library"], f"Library text does not fit in {name}: {layout['library']}"
    assert not layout["header"], f"Header actions overlap in {name}: {layout['header']}"


def center_rack_device(page, placement_id):
    """Pan through the visible drawing controls; do not mutate device coordinates."""
    controls = page.locator(".rd-canvas-controls")
    controls.get_by_role("button", name="Zeichnung verschieben", exact=True).click()
    for _ in range(12):
        viewport = page.locator("[data-rack-dropzone]").bounding_box()
        device = page.locator(f'[data-rack-placement="{placement_id}"]').bounding_box()
        delta = viewport["y"] + viewport["height"] / 2 - device["y"] - device["height"] / 2
        if abs(delta) < 3:
            break
        step = max(-viewport["height"] * .5, min(viewport["height"] * .5, delta))
        x = viewport["x"] + viewport["width"] * .8
        y = viewport["y"] + viewport["height"] * (.25 if step > 0 else .75)
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x, y + step, steps=6)
        page.mouse.up()
    controls.get_by_role("button", name="Auswählen", exact=True).click()


def test_rack_text_layout_at_working_sizes(rack_ui):
    page, _ = rack_ui
    import_rack(page, rack_document())
    playwright.expect(page.locator('[data-rack-placement="patch1"]')).to_be_visible()
    for width, height, theme in ((1440, 1000, "light"), (1440, 1000, "dark"), (1100, 800, "dark"), (960, 900, "light"), (768, 900, "dark")):
        page.set_viewport_size({"width": width, "height": height})
        set_rack_theme(page, theme)
        page.get_by_role("button", name="Ganzes Rack einpassen", exact=True).click()
        audit_rack_text(page, f"rack-fit-{theme}-{width}")
    for width in (1440, 1100):
        page.set_viewport_size({"width": width, "height": 1000})
        page.get_by_role("button", name="Ganzes Rack einpassen", exact=True).click()
        page.locator('[data-rack-placement="patch1"]').click()
        page.locator(".rd-zoom-value").click()
        playwright.expect(page.locator("[data-rack-dropzone]")).to_have_attribute("data-rack-zoom", "100")
        center_rack_device(page, "patch1")
        page.get_by_role("tab", name="Portliste", exact=True).click()
        playwright.expect(page.get_by_label("Port 1 Ziel", exact=True)).to_be_visible()
        audit_rack_text(page, f"rack-selected-100pct-{width}")
    if os.environ.get("RACK_SCREENSHOT_DIR"):
        # User-facing evidence uses the actual neutral example and full library,
        # in addition to the independent, reproducible three-device fixture.
        page.get_by_text("Bedienung & Grundlagen", exact=True).click()
        page.once("dialog", lambda confirmation: confirmation.accept())
        page.get_by_role("button", name="Beispiel laden", exact=True).click()
        playwright.expect(page.locator(".rd-document-name")).to_contain_text("Beispiel")
        page.get_by_text("Bedienung & Grundlagen", exact=True).click()
        page.locator(".rd-library-pane").evaluate("el => {el.scrollTop=0;}")
        for width in (1440, 1100):
            page.set_viewport_size({"width": width, "height": 1000})
            theme = "light" if width == 1440 else "dark"
            set_rack_theme(page, theme)
            page.get_by_role("button", name="Ganzes Rack einpassen", exact=True).click()
            audit_rack_text(page, f"rack-beispiel-fit-{theme}-{width}")
            selected = page.locator('[data-rack-placement][data-unit-start="40"][data-side="front"]').first
            selected.click()
            placement_id = selected.get_attribute("data-rack-placement")
            page.locator(".rd-zoom-value").click()
            center_rack_device(page, placement_id)
            page.get_by_role("tab", name="Portliste", exact=True).click()
            audit_rack_text(page, f"rack-beispiel-100pct-{width}")
