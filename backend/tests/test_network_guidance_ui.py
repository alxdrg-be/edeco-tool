"""Exact-object network guidance and document-only zoom, against the real UI."""
import json
from copy import deepcopy

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_network_planner_ui import open_network, review_network


def example_document(page):
    with page.expect_download() as saved:
        page.get_by_role("button", name="Netzentwurf als JSON herunterladen", exact=True).click()
    return json.loads(saved.value.path().read_text())["network"]


def import_document(page, document):
    page.locator(".np-files input[type=file]").set_input_files({
        "name": "Netztest.json", "mimeType": "application/json", "buffer": json.dumps(document).encode(),
    })
    playwright.expect(page.get_by_label("Name des Netzplans", exact=True)).to_have_value(document["name"])


def test_report_explains_incompatible_limits_and_focuses_exact_same_named_device(editor):
    page, _, _, _ = editor
    page.set_viewport_size({"width": 1680, "height": 1100})
    open_network(page)
    document = example_document(page)
    document["name"] = "Zwei gleich benannte Sicherungen"
    protector = next(node for node in document["nodes"] if node["id"] == "ls")
    protector["label"] = "NH-Sicherung"
    protector["values"].update(device="NH", rated="25", i2factor="5")
    load = next(node for node in document["nodes"] if node["kind"] == "load")
    load["values"].update(power="2.4", cosPhi="1", phases="1", phase="L1")
    other_protector, other_load = deepcopy(protector), deepcopy(load)
    other_protector.update(id="nh-other", y=400)
    other_load.update(id="load-other", y=400)
    other_load["values"].update(power="0.5", phase="L2")
    document["nodes"].extend([other_protector, other_load])
    previous = deepcopy(document["edges"][1]); previous.update(id="branch-in", to="nh-other")
    final = deepcopy(document["edges"][2]); final.update(id="branch-out", **{"from": "nh-other", "to": "load-other"})
    document["edges"].extend([previous, final])
    import_document(page, document)
    review_network(page)
    issue = page.locator('[data-network-issue*="network:i2_iz:line-3:"]')
    playwright.expect(issue).to_have_count(1)
    issue.locator(":scope > button").click()
    inspector = page.locator(".np-inspector")
    playwright.expect(inspector).to_have_attribute("data-network-selection", "edge:line-3")
    playwright.expect(inspector.locator('[data-network-field="iz"]')).to_be_focused()
    guide = inspector.locator(".np-active-diagnostic")
    playwright.expect(guide).to_contain_text("Kein gemeinsamer In-Bereich")
    playwright.expect(guide).to_contain_text("5.8 A")
    playwright.expect(guide).to_contain_text("86.21 A")
    guide.get_by_role("button", name="Zur Eingabe: Schutzorgan · In", exact=True).click()
    playwright.expect(inspector).to_have_attribute("data-network-selection", "node:ls")
    playwright.expect(inspector.locator('[data-network-field="rated"] select')).to_be_focused()
    # Navigating a diagnostic never changes values in either same-labelled device.
    assert example_document(page)["nodes"] == document["nodes"]
    guide.get_by_role("button", name="Zur Eingabe: Leitung · Iz", exact=True).click()
    inspector.locator('[data-network-field="iz"]').fill("90")
    playwright.expect(guide).to_contain_text("Dieser Hinweis ist im aktuellen Stand nicht mehr vorhanden")
    playwright.expect(page.locator(".np-network-status")).to_have_class(__import__("re").compile("np-tone-error"))


def test_live_invalid_input_routes_to_the_actual_field_without_substituting_values(editor):
    page, _, _, _ = editor
    open_network(page)
    page.locator('[data-edge-id="line-3"] .np-edge-hit').click(force=True)
    field = page.locator('[data-network-field="length"]')
    field.fill("")
    page.get_by_role("button", name="Fehler anzeigen", exact=True).click()
    playwright.expect(field).to_be_focused()
    playwright.expect(field).to_have_value("")
    guide = page.locator(".np-active-diagnostic")
    playwright.expect(guide).to_contain_text("Eingabe fehlt")
    playwright.expect(guide).to_contain_text("Erforderlich")
    field.fill("25")
    playwright.expect(guide).to_contain_text("Dieser Hinweis ist im aktuellen Stand nicht mehr vorhanden")


def test_app_zoom_guard_keeps_viewer_handlers_in_dynamic_nested_frames(editor):
    page, _, _, _ = editor
    result = page.evaluate("""async () => {
      const make = async doc => {
        const frame = doc.createElement('iframe');
        const ready = new Promise(resolve => frame.onload = resolve);
        frame.srcdoc = '<button>Viewer</button>'; doc.body.append(frame); await ready; return frame;
      };
      const outer = await make(document), inner = await make(outer.contentDocument);
      await new Promise(resolve => requestAnimationFrame(resolve));
      const probe = doc => {
        const target = doc.querySelector('button'); let local = 0;
        target.addEventListener('wheel', () => local++);
        const wheel = new doc.defaultView.WheelEvent('wheel', {ctrlKey:true,bubbles:true,cancelable:true});
        const copy = new doc.defaultView.KeyboardEvent('keydown', {key:'c',ctrlKey:true,bubbles:true,cancelable:true});
        const zoom = new doc.defaultView.KeyboardEvent('keydown', {key:'+',ctrlKey:true,bubbles:true,cancelable:true});
        target.dispatchEvent(wheel); target.dispatchEvent(copy); target.dispatchEvent(zoom);
        return {local,wheel:wheel.defaultPrevented,zoom:zoom.defaultPrevented,copy:copy.defaultPrevented};
      };
      const first = probe(inner.contentDocument);
      const ready = new Promise(resolve => inner.onload = resolve);
      inner.srcdoc = '<button>Other document</button>'; await ready;
      await new Promise(resolve => requestAnimationFrame(resolve));
      const navigated = probe(inner.contentDocument); outer.remove(); return {first,navigated};
    }""")
    expected = {"local": 1, "wheel": True, "zoom": True, "copy": False}
    assert result == {"first": expected, "navigated": expected}
