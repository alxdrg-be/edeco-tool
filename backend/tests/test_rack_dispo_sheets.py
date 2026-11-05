"""Program-drawn A4 sheets: PDF and SVG come from the same markup as the preview."""

from io import BytesIO

from pypdf import PdfReader
import pytest

from edeco_toolbox.tools.rack_dispo.model import ExportRequest
from edeco_toolbox.tools.rack_dispo.render import pdf_bytes, svg_bytes
from edeco_toolbox.tools.rack_dispo.svgpdf import SheetError, sheet_ops, text_width_mm
from test_rack_dispo_exports import document

SHEET = ('<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297" font-family="Helvetica">'
         '<rect x="10" y="10" width="190" height="277" fill="none" stroke="#222222" stroke-width=".35"/>'
         '<g transform="translate(32 42) scale(0.0666667)"><rect x="0" y="0" width="800" height="2100" fill="#cccccc" stroke="#222222" stroke-width="4.5"/>'
         '<g color="#222222" fill="none" stroke="currentColor"><path d="M10 20h30v10H10Z"/><circle cx="5" cy="5" r="2"/></g></g>'
         '<text x="110" y="60" font-size="2.3" fill="#222222">Sämtliche Rangierpanel R&amp;M R171185 (L durch swisspro, M durch ICT Bauherr)</text>'
         '<text x="105" y="280" font-size="4.6" font-weight="bold" text-anchor="middle" fill="#222222">0.3 · UKV · Vorderansicht</text>'
         '<path d="M201.08,49.25c0-13.86,11.23-25.09,25.09-25.09s25.09,11.23,25.09,25.09h0Z" fill="#017c92" fill-rule="evenodd"/>'
         '</svg>')


def sheet_request(fmt="pdf", views=("front",), sheets=None):
    sheets = sheets if sheets is not None else [{"rackId": "rack-a", "view": view, "svg": SHEET} for view in views]
    return ExportRequest.model_validate({"document": document(), "views": list(views), "format": fmt, "sheets": sheets})


def test_pdf_pages_are_the_program_sheet_plus_one_appendix_per_rack():
    reader = PdfReader(BytesIO(pdf_bytes(sheet_request(views=("front", "rear")))))
    assert len(reader.pages) == 3  # two drawn views, one shared appendix
    first = reader.pages[0].extract_text()
    assert "Sämtliche Rangierpanel R&M R171185 (L durch swisspro, M durch ICT Bauherr)" in first  # never shortened
    assert "0.3 · UKV · Vorderansicht" in first
    appendix = reader.pages[2].extract_text()
    assert "Vorderansicht und Rückansicht" in appendix and "Panel A" in appendix
    assert "/XObject" not in reader.pages[0]["/Resources"]
    fonts = reader.pages[0]["/Resources"]["/Font"]
    assert {fonts[name].get_object()["/BaseFont"] for name in fonts} == {"/Helvetica", "/Helvetica-Bold"}


def test_sheet_geometry_is_scaled_from_mm_to_points():
    ops = "\n".join(sheet_ops(SHEET))
    # Outer frame: x 10 mm = 28.346 pt, y from bottom (297 - 10 - 277) mm = 28.346 pt.
    assert "28.346 813.543 m" in ops
    assert " c " in ops  # circle and logo curves stay vector curves
    assert "B*" in ops or "f*" in ops  # even-odd logo fill


def test_centred_and_bold_text_use_real_helvetica_widths():
    assert text_width_mm("Rangierpanel", 2.3) == pytest.approx(5.947 * 2.3)
    assert text_width_mm("WW", 10, bold=True) == pytest.approx(18.88)


@pytest.mark.parametrize("markup", [
    SHEET.replace("<rect", "<script>alert(1)</script><rect", 1),
    SHEET.replace("<rect", '<image href="http://example.invalid/x.png"/><rect', 1),
    '<!DOCTYPE svg [<!ENTITY a "aaaa">]>' + SHEET,
    SHEET.replace('d="M10 20h30v10H10Z"', 'd="M10 20 A5 5 0 0 1 20 20"'),
])
def test_unsupported_or_unsafe_markup_is_rejected(markup):
    with pytest.raises(SheetError):
        sheet_ops(markup)


def test_sheets_must_match_the_selected_rack_and_view():
    with pytest.raises(ValueError):
        sheet_request(views=("front",), sheets=[{"rackId": "rack-a", "view": "rear", "svg": SHEET}])


def test_svg_export_stacks_the_same_sheets():
    data = svg_bytes(sheet_request("svg", views=("front", "rear"))).decode()
    assert data.count('viewBox="0 0 210 297"') == 2
    assert "Sämtliche Rangierpanel R&amp;M R171185" in data
    assert 'height="604mm"' in data


def test_opacity_is_blended_towards_white_paper():
    markup = SHEET.replace('<path d="M10 20h30v10H10Z"/>', '<path d="M10 20h30v10H10Z" opacity=".5" stroke="#000000"/>')
    assert "0.5020 0.5020 0.5020 RG" in "\n".join(sheet_ops(markup))
