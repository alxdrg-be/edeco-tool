"""The new company general source is an explicit, reversible choice, including its export."""
from copy import deepcopy
from contextlib import closing
from hashlib import sha256

import ezdxf
import pypdfium2 as pdfium
import pytest

from edeco_toolbox.documents.extract import PDF_LOCK
from nova_legend.legend import general
from test_phase3 import env  # noqa: F401
from test_editor_navigation import editor, playwright  # noqa: F401


def old_general(path):
    doc = ezdxf.new("R2013", units=4)
    for i in range(5):
        y = 40 - i * 7
        doc.modelspace().add_text(f"Eigene Leitung {i}", height=2).set_placement((25, y))
        doc.modelspace().add_line((0, y), (20, y))
    doc.saveas(path)
    return path


def test_bundled_general_contains_only_general_rows_and_all_source_color_codes():
    source, error = general.resolve_source(general.BUILTIN_SOURCE)
    assert source == general.BUILTIN_FILE and not error
    part = general.load(general.BUILTIN_SOURCE, 190, None)
    assert not part.error and part.source == general.BUILTIN_SOURCE
    assert len(part.rows) == 34
    codes = [r for r in part.rows if r.get("picture") == "swatch"]
    assert len(codes) == 12
    assert {r["swatch"].lower() for r in codes} == {
        "#0099ff", "#ff0000", "#993300", "#00ff00", "#ff00ff", "#0000ff",
        "#ffbf00", "#008000", "#804000", "#00ffff", "#cc0099", "#ff8000"}
    assert not any("Schalter, Schema" in r["text"] or "Steckdose, T13" in r["text"] for r in part.rows)


def test_preview_apply_restore_leave_original_file_and_saved_legend_intact(env):
    client, tmp = env
    path = old_general(tmp / "eigene-vorlage.dxf")
    original_hash = sha256(path.read_bytes()).hexdigest()
    state = client.app.state.nova
    settings = {"legend_general_path": str(path), "legend_general_rows": {"eigene leitung 0": {"text": "Eigen"}},
                "legend_general_extra": [{"id": "custom", "text": "Eigenes Symbol", "symbol_key": "custom"}],
                "legend_general_order": ["eigene leitung 1", "eigene leitung 0"]}
    state.company.set_legend_settings(settings)
    before = deepcopy(state.company.legend_settings())
    pid = client.post("/api/projects", json={"name": "Unverändert"}).json()["id"]
    stored = client.get(f"/api/projects/{pid}/legend").json()
    info = client.get("/api/company/general").json()
    assert info["source"] == str(path) and info["builtin"]["color_codes"] == 12
    assert not info["builtin"]["active"]
    preview = client.get("/api/company/general/builtin/preview")
    assert preview.status_code == 200 and preview.headers["content-type"] == "image/png"
    assert preview.content.startswith(b"\x89PNG")
    assert state.company.legend_settings() == before
    assert client.post("/api/company/general/builtin/apply", json={"expected_source": "stale"}).status_code == 409
    result = client.post("/api/company/general/builtin/apply", json={"expected_source": str(path)})
    assert result.status_code == 200, result.text
    assert result.json()["builtin"]["active"] and result.json()["builtin"]["can_restore"]
    assert len(result.json()["rows"]) == 34
    assert state.company.legend_settings()["legend_general_rows"] == {}
    assert state.company.legend_settings()["legend_general_previous"] == settings
    # Repeated apply must not overwrite the undo snapshot.
    assert client.post("/api/company/general/builtin/apply", json={"expected_source": general.BUILTIN_SOURCE}).status_code == 200
    assert state.company.legend_settings()["legend_general_previous"] == settings
    exported = client.get("/api/company/general/export/Allgemein.pdf?format=pdf")
    assert exported.status_code == 200, exported.text
    with PDF_LOCK, pdfium.PdfDocument(exported.content) as pdf, closing(pdf[0]) as page, closing(page.get_textpage()) as text:
        assert "Farbcodes" in text.get_text_range()
        assert "KNX" in text.get_text_range()
    result = client.post("/api/company/general/builtin/restore", json={"expected_source": general.BUILTIN_SOURCE})
    assert result.status_code == 200, result.text
    assert state.company.legend_settings() == before
    assert sha256(path.read_bytes()).hexdigest() == original_hash
    assert client.get(f"/api/projects/{pid}/legend").json() == stored


def test_general_template_admin_and_concurrent_source_guards(env):
    client, tmp = env
    state = client.app.state.nova
    state.company.set_legend_settings({"legend_admins": ["other-user"]})
    for action in ("apply", "restore"):
        assert client.post(f"/api/company/general/builtin/{action}", json={"expected_source": ""}).status_code == 403
    state.company.set_legend_settings({"legend_admins": []})
    assert client.post("/api/company/general/builtin/apply", json={"expected_source": ""}).status_code == 200
    state.company.set_legend_settings({"legend_general_path": "new-selection.dxf"})
    assert client.post("/api/company/general/builtin/restore", json={"expected_source": "new-selection.dxf"}).status_code == 409
    assert state.company.legend_settings()["legend_general_path"] == "new-selection.dxf"


def test_settings_preview_apply_and_restore_the_general_source(editor, tmp_path):
    page, _, client, _ = editor
    source = str(old_general(tmp_path / "alte-allgemeinvorlage.dxf"))
    client.app.state.nova.company.set_legend_settings({"legend_general_path": source})
    page.get_by_role("button", name="Einstellungen", exact=True).click()
    choice = page.get_by_role("region", name="edeco-Allgemeinvorlage", exact=True)
    playwright.expect(choice).to_contain_text("21 Zeilen · 12 Farbcodes")
    page.get_by_role("button", name="edeco-Allgemeinvorlage verwenden", exact=True).click()
    image = choice.get_by_role("img")
    playwright.expect(image).to_be_visible()
    page.wait_for_function("document.querySelector('.general-template-preview img')?.naturalWidth > 0")
    assert client.get("/api/company/general").json()["source"] == source
    choice.screenshot(path=str(tmp_path / "builtin-general-preview-in-settings.png"))
    page.get_by_role("button", name="Vorlage für NOVA übernehmen", exact=True).click()
    playwright.expect(choice).to_contain_text("edeco-Allgemeinvorlage aktiv")
    playwright.expect(page.get_by_role("textbox", name="Legende Allgemein", exact=True)).to_have_value(general.BUILTIN_SOURCE)
    assert client.get("/api/company/general").json()["source"] == general.BUILTIN_SOURCE
    page.get_by_role("button", name="Vorherige Vorlage wiederherstellen", exact=True).click()
    playwright.expect(page.get_by_role("textbox", name="Legende Allgemein", exact=True)).to_have_value(source)
    assert client.get("/api/company/general").json()["source"] == source
