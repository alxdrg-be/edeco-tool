"""Render NOVA's plain dash patterns without rewriting their CAD definitions."""

from copy import deepcopy
from io import BytesIO

import ezdxf
from ezdxf.lldxf.tags import Tags
from ezdxf.lldxf.types import DXFTag
from pypdf import PdfReader
import pytest

from nova_legend.legend.general import _svg
from nova_legend.legend.pdf import build_pdf


def drawing(pattern):
    doc = ezdxf.new("R2013", units=4)
    length = sum(abs(value) for value in pattern)
    doc.linetypes.add("NOVA_SAMPLE", pattern=[length, *pattern])
    block = doc.blocks.new("UP_LEITUNG")
    block.add_spline([(0, 0), (12, 3), (24, 0)], dxfattribs={
        "linetype": "NOVA_SAMPLE", "ltscale": .175})
    doc.modelspace().add_blockref("UP_LEITUNG", (0, 4))
    return doc


def empty_shape_flags(doc):
    linetype = doc.linetypes.get("NOVA_SAMPLE")
    tags = []
    for tag in linetype.pattern_tags.tags:
        if tag.code == 74:
            tags.extend([DXFTag(74, 4), DXFTag(75, 0), DXFTag(340, "0")])
        else:
            tags.append(tag)
    linetype.pattern_tags.tags = Tags(tags)
    assert linetype.pattern_tags.is_complex_type()
    assert not linetype.simplified_line_pattern()


@pytest.mark.parametrize("pattern", [
    [12.7, -6.35],
    [12.7, -6.35, 0., -6.35],
    [12.7, -6.35, 0., -6.35, 0., -6.35],
])
def test_svg_and_pdf_preserve_dashes_and_original_cad_definition(pattern, tmp_path):
    canonical = drawing(pattern)
    imported = deepcopy(canonical)
    empty_shape_flags(imported)
    linetype = imported.linetypes.get("NOVA_SAMPLE")
    before = list(linetype.pattern_tags.tags)
    source = tmp_path / "Firmenvorlage.dxf"
    imported.saveas(source)
    source_bytes = source.read_bytes()

    # Both render paths must produce the same actual curves/dashes as the
    # equivalent native simple pattern, including nested SPLINE entities.
    canonical_svg = _svg(canonical, 30, 10)
    assert canonical_svg and _svg(imported, 30, 10) == canonical_svg
    expected = PdfReader(BytesIO(build_pdf(canonical, 30, 10))).pages[0]
    actual = PdfReader(BytesIO(build_pdf(imported, 30, 10))).pages[0]
    operators = expected.get_contents().get_data()
    assert operators.count(b" m ") > 3  # Separate dash segments, not one solid curve.
    assert actual.get_contents().get_data() == operators
    assert list(linetype.pattern_tags.tags) == before
    assert linetype.pattern_tags.is_complex_type()
    assert source.read_bytes() == source_bytes


def test_real_shape_definition_is_not_simplified_by_renderers():
    doc = drawing([12.7, -6.35])
    empty_shape_flags(doc)
    linetype = doc.linetypes.get("NOVA_SAMPLE")
    linetype.pattern_tags.tags = Tags(
        DXFTag(tag.code, 1 if tag.code == 75 else tag.value)
        for tag in linetype.pattern_tags.tags)
    before = list(linetype.pattern_tags.tags)
    # Actual symbol/shape patterns remain unsupported by ezdxf; they must not
    # silently turn into a different dash pattern or alter the source document.
    _svg(doc, 30, 10)
    build_pdf(doc, 30, 10)
    assert list(linetype.pattern_tags.tags) == before
    assert linetype.pattern_tags.is_complex_type()
