"""The optional A4 layout keeps native glyph size and persists real layout data."""

from contextlib import closing
from copy import deepcopy
from io import BytesIO, StringIO

import ezdxf
import pypdfium2 as pdfium
import pytest

from nova_legend.legend.layout import layout
from nova_legend.legend.export import build_dxf
from nova_legend.legend.model import normalize, normalize_style
from nova_legend.legend.pdf import build_pdf, scale_lineweights
from nova_legend.parser.geometry import Primitive, SymbolGeometry

from test_legend_compact_flow import flow_document, key
from test_phase2 import import_dxf, nova_like_dxf
from test_phase3 import env  # noqa: F401 - real isolated API and library


def a4_preset(doc):
    doc = deepcopy(doc)
    doc["style"].update(compact_flow=True, columns=4, grid="dicht", text_size=2.6,
                        margin=3.5, width=200, symbol_scale=1, symbol_size="tile",
                        normalize_size=True, text_lines=0, entry_gap=0, section_gap=0,
                        pdf_lines="proportional")
    doc["title"]["size_mm"] = 4.5
    for block in doc["blocks"]:
        block["style"]["padding"] = .5
    return normalize(doc)


@pytest.mark.parametrize("raw,expected", [(None, 5), (3.5, 3.5), (-10, 2), (100, 10), ("invalid", 5)])
def test_inner_margin_is_bounded_and_old_unset_style_keeps_five_mm(raw, expected):
    assert normalize_style({"margin": raw})["margin"] == expected
    assert normalize_style({})["margin"] == 5
    assert normalize_style({"columns": 4})["columns"] == 4


def test_a4_changes_density_without_scaling_native_apparatus_or_general_columns():
    original = flow_document(3, 24)
    original["title"]["text"] = "Synthetische Legende"
    sizes = {item["id"]: (-2, -2, 2, 2, False) for block in original["blocks"] for item in block["items"]}
    three = layout(original, sizes, key())
    compact = a4_preset(original)
    before = deepcopy(compact)
    four = layout(compact, sizes, key())
    assert compact == before
    three_symbols = {(p["id"], p.get("variant", 0)): p for p in three["prims"] if p["t"] == "symbol"}
    four_symbols = {(p["id"], p.get("variant", 0)): p for p in four["prims"] if p["t"] == "symbol"}
    assert three_symbols.keys() == four_symbols.keys()
    for identity, symbol in four_symbols.items():
        assert symbol["w"] == pytest.approx(three_symbols[identity]["w"])
        assert symbol["h"] == pytest.approx(three_symbols[identity]["h"])
    grids = [p for p in four["prims"] if p["t"] == "grid"]
    assert len({p["flow_column"] for p in grids if "flow_column" in p}) == 4
    assert next(p for p in grids if p["block"] == "general")["cols"] == 2
    assert next(p for p in grids if p["block"] == "general-colors")["cols"] == 5
    assert four["height"] < three["height"]
    assert original["style"]["columns"] == 3 and original["style"]["margin"] == 5


def test_four_columns_and_inner_margin_survive_api_save_reload_layout_and_exports(env):
    client, tmp = env
    pid = client.post("/api/projects", json={"name": "A4 regression"}).json()["id"]
    assert import_dxf(client, pid, nova_like_dxf(tmp / "source.dxf")).status_code == 200
    proposed = client.post(f"/api/projects/{pid}/legend/propose", json={}).json()["doc"]
    doc = a4_preset(proposed)
    assert client.put(f"/api/projects/{pid}/legend", json={"doc": doc}).status_code == 200
    restored = client.get(f"/api/projects/{pid}/legend").json()["legend"]["doc"]
    assert restored == doc
    placed = client.post(f"/api/projects/{pid}/legend/layout", json={"doc": restored}).json()
    assert restored["style"]["columns"] == 4 and restored["style"]["margin"] == 3.5
    assert min(p["x"] for p in placed["prims"] if p["t"] == "hit" and p["kind"] == "block") == 3.5
    dxf_response = client.get(f"/api/projects/{pid}/legend/export", params={"format": "dxf"})
    assert dxf_response.status_code == 200
    # DXF files use the host's line endings. Read like a real text file so
    # Windows CRLF is normalised before ezdxf's stream parser consumes tags.
    drawing = ezdxf.read(StringIO(dxf_response.text, newline=None))
    assert drawing.modelspace().query("INSERT")
    pdf_response = client.get(f"/api/projects/{pid}/legend/export", params={"format": "pdf"})
    assert pdf_response.status_code == 200
    with pdfium.PdfDocument(BytesIO(pdf_response.content)) as result, closing(result[0]) as page:
        width, height = page.get_size()
        assert width * 25.4 / 72 == pytest.approx(210, abs=.1)
        assert height * 25.4 / 72 == pytest.approx(placed["height"] + 10, abs=.1)
        assert height * 25.4 / 72 < 297


def test_scaled_print_contours_keep_a_small_unpainted_symbol_hole_readable():
    """Synthetic analogue of a small exit pictogram, without customer geometry.

    Both PDFs retain the same green fill, unpainted hole and source outlines.
    A physically fixed .25 mm outline consumes a .20 mm scaled hole; the
    compact preset's proportional mode keeps the hole open and printable.
    """
    def drawing():
        cad = ezdxf.new("R2013", units=4)
        symbol = cad.blocks.new("synthetic-pictogram")
        outer = [(-4, -2), (4, -2), (4, 2), (-4, 2)]
        inner = [(-.2, -1), (-.2, 1), (.2, 1), (.2, -1)]
        hatch = symbol.add_hatch(color=3)
        hatch.paths.add_polyline_path(outer, is_closed=True, flags=1)
        hatch.paths.add_polyline_path(inner, is_closed=True, flags=0)
        for points in (outer, inner):
            symbol.add_lwpolyline(points, close=True, dxfattribs={"color": 3, "lineweight": 25})
        cad.modelspace().add_blockref(symbol.name, (10, 10), dxfattribs={"xscale": .5, "yscale": .5})
        cad.nl_line_factors = {symbol.name: .5}
        return cad

    def white_in_hole(mode):
        with pdfium.PdfDocument(BytesIO(build_pdf(drawing(), 20, 20, lines=mode))) as pdf, closing(pdf[0]) as page:
            # 5 mm PDF margin + insertion point10 mm, on a30 mm high page.
            scale = 12
            with closing(page.render(scale=scale)) as bitmap:
                image = bitmap.to_pil().convert("RGB")
                pixel = round(15 * 72 / 25.4 * scale)
                return sum(min(image.getpixel((x, y))) > 220
                           for x in range(pixel - 2, pixel + 3)
                           for y in range(pixel - 2, pixel + 3))

    assert white_in_hole("original") == 0
    assert white_in_hole("proportional") >= 5


def test_repeated_apparatus_at_two_sizes_keeps_its_own_physical_line_weight():
    geo = SymbolGeometry(primitives=[Primitive("line", "0", data={
        "start": [0, 0], "end": [.004, 0]}, color="#0099ff")])
    symbols = [{"t": "symbol", "key": "same-apparatus", "scale": scale,
                "cx": x, "cy": 5, "ax": 0, "ay": 0, "color": "#0099ff"}
               for x, scale in [(5, .5), (15, 2), (25, .5)]]
    cad = build_dxf({"width": 40, "height": 10, "prims": symbols}, None, lambda _p: geo)
    instances = list(cad.modelspace().query("INSERT"))
    assert instances[0].dxf.name == instances[2].dxf.name
    assert instances[0].dxf.name != instances[1].dxf.name
    assert scale_lineweights(cad) == 2
    small = next(iter(cad.blocks.get(instances[0].dxf.name)))
    large = next(iter(cad.blocks.get(instances[1].dxf.name)))
    assert small.dxf.lineweight == 13
    assert large.dxf.lineweight == 50
