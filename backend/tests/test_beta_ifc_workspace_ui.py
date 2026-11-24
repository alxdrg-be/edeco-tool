"""Der eigene Viewer teilt die geöffnete IFC-Sitzung mit dem BIM-Check."""

from test_editor_navigation import editor, env, playwright  # noqa: F401
from test_toolhub_design_beta_ui import home


def test_beta_ifc_opens_sample_filters_objects_and_reuses_model_for_check(editor, tmp_path):
    page, *_ = editor
    page.set_viewport_size({"width": 1366, "height": 768})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    imported = []
    page.on("request", lambda req: imported.append(req.url)
            if req.method == "POST" and req.url.endswith("/api/bim-check/models") else None)

    home(page)
    page.get_by_role("button", name="IFC-Viewer öffnen", exact=True).click()
    page.get_by_role("button", name="Beispiel öffnen").click()
    playwright.expect(page.get_by_role("heading", name="Pavillon-West.ifc")).to_be_visible(timeout=30_000)
    canvas = page.get_by_role("img", name="IFC-Modell in 3D")
    if page.evaluate("!!document.createElement('canvas').getContext('webgl2')"):
        playwright.expect(canvas).to_have_attribute("data-state", "ready", timeout=60_000)
    assert canvas.bounding_box()["height"] > 450
    assert not page.locator(".hub-rail").is_visible()
    header = page.locator(".toolhub-header").bounding_box()
    assert header["x"] + header["width"] <= page.viewport_size["width"] + 1
    playwright.expect(page.locator(".biv-foot")).to_contain_text("6 Räume · 2 Geschosse")
    page.screenshot(path=str(tmp_path / "IFC-Viewer-Gesamtmodell.png"))
    tree = page.get_by_role("complementary", name="Modellstruktur", exact=True)
    page.keyboard.press("h")
    playwright.expect(tree).to_be_hidden()
    page.keyboard.press("Control+f")
    search = tree.get_by_role("searchbox", name="Modell durchsuchen")
    playwright.expect(search).to_be_focused()
    tree.get_by_role("combobox", name="Geschoss").select_option("floor:Obergeschoss")
    search.fill("Atelier")
    tree.get_by_role("button", name="O02 · Atelier").click()
    inspector = page.get_by_role("complementary", name="Attribut-Inspektor", exact=True)
    playwright.expect(inspector).to_contain_text("Obergeschoss")
    playwright.expect(inspector).to_contain_text("Atelier")
    page.screenshot(path=str(tmp_path / "IFC-Viewer-Beta.png"))
    page.get_by_role("button", name="Im BIM-Check prüfen", exact=True).click()
    playwright.expect(page.get_by_role("heading", name="Modell prüfen", exact=True)).to_be_visible()
    page.get_by_role("button", name="Zurück zum IFC-Viewer", exact=False).click()
    playwright.expect(inspector).to_contain_text("Atelier")
    assert len(imported) == 1
    assert not errors
