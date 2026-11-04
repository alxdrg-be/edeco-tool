"""Optical weights retain proportions and fit the shared print corridor."""
import pytest

from nova_legend.legend.layout import _symbol_box
from nova_legend.legend.model import default_style, normalize_style


def drawn(size, weight="optical", factor=1):
    style = {**default_style(), "symbol_weight": weight}
    return _symbol_box({"kind": "symbol", "symbol_factor": factor}, (*size, False), style, 5, 13)


def test_optical_rectangles_share_area_but_keep_their_shapes():
    square, wide = drawn((0, 0, 1, 1)), drawn((0, 0, 3, 1))
    area = lambda box: (box["left"] + box["right"]) * (box["up"] + box["down"])  # noqa: E731
    assert area(square) == pytest.approx(area(wide))
    assert wide["right"] / wide["up"] == pytest.approx(3)
    # A small source drawing can grow; its engineering geometry is not edited.
    assert square["scale"] > 1


def test_flat_symbols_use_width_and_never_exceed_field_height():
    flat = drawn((0, 0, 30, 1))
    assert flat["left"] + flat["right"] == pytest.approx(13)
    assert flat["up"] + flat["down"] < 1
    assert flat["right"] / flat["up"] == pytest.approx(30)
    larger = drawn((0, 0, 30, 1), factor=1.2)
    assert larger["right"] == flat["right"]


def test_local_fine_adjustment_can_grow_optical_weight_up_to_boundary():
    original, larger = drawn((0, 0, 1, 1)), drawn((0, 0, 1, 1), factor=1.2)
    assert larger["scale"] > original["scale"]
    assert 2 * larger["up"] <= 4.5


def test_existing_corridor_weight_remains_unchanged_until_explicit_choice():
    assert normalize_style({})["symbol_weight"] == "fit"
    old = drawn((0, 0, 1, 1), "fit")
    assert old["left"] + old["right"] == pytest.approx(4.5)
    assert drawn((0, 0, 1, 1))["right"] < old["right"]
