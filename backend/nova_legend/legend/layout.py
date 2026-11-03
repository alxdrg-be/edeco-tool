"""Place a legend document on its fixed grid.

One source of truth for the editor view and the DXF export. Output is a list
of drawing primitives in millimetres, x to the right, y downwards, on a sheet
of at most 200 mm width:

    rect      x, y, w, h, fill, stroke, role (header / background / border / general)
    text      x, y (baseline), size, text, bold, color
    symbol    id, key, family_key, length_mm, width_mm, cx, cy, scale, rot, w, h, layer
    line      x1, y1, x2, y2, color, style
    half      cx, cy, r, color            (AP note: half filled circle)
    hit       kind (item / block / section / general), block, id, x, y, w, h
    grid      block, x, y, w, h, row, cols, colw, axis, text   (placeholders of a section body)

Rules: sections span the full width with a coloured header bar; the area
behind the entries is paper unless the section switches a background on.
Entries fill 2 or 3 columns top to bottom. In every column of a section all
symbol centres sit on one vertical axis and all texts start on one vertical
text line right of the widest symbol. Every entry takes a whole number of grid
rows, so the entries sit exactly in the grid placeholders of their section.
The symbol and the first line of the text share the same horizontal middle;
further lines go downward. Text wraps inside its column; a row grows with its
text or symbol, so nothing overlaps the next entry or column. Symbols turn in steps of
90 degrees around their centre; texts stay horizontal.
"""

from __future__ import annotations

import math

from .linetypes import dash_array
from .model import DEFAULT_TEXT_SIZE, DEFAULT_TITLE_MM, entry_text, original_colors, section_style

LINE_FACTOR = 1.3            # line height relative to the text size
_NARROW = set("il.,;:|!'`Iíìj()[]/\\ ")
_WIDE = set("MWmw@%")


def text_width(text: str, size: float, bold: bool = False) -> float:
    """Approximate Arial width in mm."""
    w = 0.0
    for ch in text:
        if ch in _NARROW:
            w += 0.28
        elif ch in _WIDE:
            w += 0.83
        elif ch.isupper() or ch.isdigit():
            w += 0.64 if ch.isupper() else 0.56
        else:
            w += 0.52
    return w * size * (1.07 if bold else 1.0)


def wrap(text: str, size: float, width: float, bold: bool = False) -> list[str]:
    """Split a text into lines that fit ``width``. Long words are cut."""
    if width <= size:
        width = size
    lines: list[str] = []
    for para in (text or "").split("\n"):
        words = para.split()
        if not words:
            lines.append("")
            continue
        cur = ""
        for word in words:
            cand = f"{cur} {word}" if cur else word
            if text_width(cand, size, bold) <= width:
                cur = cand
                continue
            if cur:
                lines.append(cur)
            cur = word
            while text_width(cur, size, bold) > width and len(cur) > 1:
                cut = len(cur)
                while cut > 1 and text_width(cur[:cut], size, bold) > width:
                    cut -= 1
                lines.append(cur[:cut])
                cur = cur[cut:]
        lines.append(cur)
    return lines or [""]


SYMBOL_CLEARANCE = 0.5       # mm free above and below a symbol inside its grid rows
TEXT_CLEARANCE = 0.4
TILE_FACTOR = 3.6            # symbol tile side = text size × this × symbol scale
TILE_FILL = 0.90             # a drawing fills this share of its tile, so it never looks squeezed
# equal visual weight: a compact drawing (circle, square) covers this share of the area of
# a full 75 % square, a long narrow one grows until its longer side reaches 75 % of the tile
AREA_SHARE = 0.6
TILE_GAP = 0.45
SYMBOL_ZONE = 16.0           # enough room for readable pairs and line samples


def _clip_origin(focus: float, frac: float) -> float:
    """Left or bottom edge of a window that covers ``frac`` of the graphic.

    The window stays inside 0..1 and is centred on ``focus`` when that fits.
    ``focus`` and the result are fractions of the full box, from the left and
    from the bottom (drawing axes)."""
    if frac >= 1:
        return 0.0
    return min(max(float(focus) - frac / 2, 0.0), 1.0 - frac)


def _forced_color(item: dict) -> str:
    """A colour chosen for this one entry. Empty means the automatic colour."""
    raw = item.get("symbol_color") or ""
    if isinstance(raw, str) and len(raw) == 7 and raw.startswith("#"):
        return raw
    return ""


def symbol_tile(style: dict) -> float:
    """Side of the shared symbol tile in mm. It grows with the text size."""
    ts = max(float(style.get("text_size") or DEFAULT_TEXT_SIZE), 1.0)
    sc = max(float(style.get("symbol_scale") or 1.0), 0.2)
    return round(ts * TILE_FACTOR * sc, 3)


def entry_slot(style: dict, tile: float) -> float:
    """Row height. The tile sets it; a chosen line count can make every row taller."""
    cap = _line_cap(style)
    if not cap:
        return tile
    ts = float(style.get("text_size") or DEFAULT_TEXT_SIZE)
    return max(tile, cap * ts * LINE_FACTOR + TEXT_CLEARANCE)


def tile_frame(style: dict, colw: float) -> tuple[float, float, float, float]:
    """(tile, slot, axis, text_x) for equal tiles.

    Standard keeps the tile that follows the text size. Every other raster uses
    the chosen row height and the distance to the text, so the steps show on
    the sheet. The text stays clear of the symbol and keeps room in the column.
    """
    natural = min(symbol_tile(style), colw * 0.46)
    standard = style.get("grid", "standard") == "standard"
    row = float(style["row"])
    tile = natural if standard else min(natural, max(2.4, row - 0.4))
    zone = max(tile, min(max(12.0 if style.get("_flow") else SYMBOL_ZONE, tile * 2 + TILE_GAP), colw * 0.42))
    axis = 0.4 + zone / 2
    floor = 0.4 + zone + 1.2
    ceiling = max(floor, colw - max(14.0, float(style.get("text_size") or DEFAULT_TEXT_SIZE) * 5))
    text_x = min(max(float(style["text_offset"]), floor), ceiling)
    return tile, max(entry_slot(style, tile), 0 if standard else row), axis, text_x


def _anchor(size) -> tuple[float, float, float, float, float, float, bool]:
    """(x0, y0, x1, y1, ax, ay, engine) of a drawing in mm, Nova axes (y up).

    Horizontally the anchor is the insertion point (origin of the symbol) when it
    lies in the middle half of the drawing, otherwise the middle of the drawing
    (lines and some boxes have it at one end). Vertically it is always the middle,
    so the drawing fills its row. Old callers give only
    (width, height, engine): then the drawing is centred on its insertion point.
    """
    if len(size) == 3:
        w, h, engine = size
        return -w / 2, -h / 2, w / 2, h / 2, 0.0, 0.0, bool(engine)
    x0, y0, x1, y1, engine = size
    quarter = (x1 - x0) / 4
    ax = 0.0 if x0 + quarter - 1e-6 <= 0 <= x1 - quarter + 1e-6 else (x0 + x1) / 2
    ay = (y0 + y1) / 2          # vertically the drawing sits on the middle of its row
    return x0, y0, x1, y1, ax, ay, bool(engine)


def symbol_scale(size: tuple[float, float] | None, style: dict, engine: bool,
                 max_w: float | None = None) -> float:
    """Real size: the common scale for every symbol (engine symbols at the plan scale).
    No symbol is shrunk to fit a row: a tall symbol takes more grid rows, so equal scale
    means equal size. Only a symbol wider than ``max_w`` (half a column) is limited."""
    s = style["symbol_scale"] * (50.0 / style["plan_scale"] if engine else 1.0)
    if not size or size[0] <= 0 or max_w is None or size[0] * s <= max_w:
        return s
    return round(max_w / size[0], 4)


def _turn(left, right, up, down, rotation: int, mirror: bool = False):
    """Extents (left, right, up, down) around the anchor after mirroring (left-right)
    and turning counter-clockwise by any angle (steps of 45 degrees)."""
    if mirror:
        left, right = right, left
    a = math.radians(rotation % 360)
    c, s = math.cos(a), math.sin(a)
    xs, ys = [], []
    for x, y in ((-left, -down), (right, -down), (right, up), (-left, up)):
        xs.append(x * c - y * s)
        ys.append(x * s + y * c)
    r = lambda v: round(v, 9)  # noqa: E731 - keep exact values for 90 degree steps
    return r(-min(xs)), r(max(xs)), r(max(ys)), r(-min(ys))


def _symbol_box_real(item: dict, size, style: dict, max_w: float) -> dict:
    """Real size: extents around the insertion point on the symbol axis."""
    kind = item["kind"]

    def box(left, right, up, down, scale=1.0, ax=0.0, ay=0.0):
        return {"left": left, "right": right, "up": up, "down": down, "scale": scale, "ax": ax, "ay": ay}

    if kind == "symbol":
        rot = int(item.get("rotation") or 0)
        factor = float(item.get("symbol_factor") or 1.0)
        if size:
            x0, y0, x1, y1, ax, ay, engine = _anchor(size)
            left, right, up, down = _turn(ax - x0, x1 - ax, y1 - ay, ay - y0, rot, bool(item.get("mirror")))
            scale = symbol_scale((left + right, 2 * max(up, down)), style, engine, max_w) * factor
            return box(left * scale, right * scale, up * scale, down * scale, round(scale, 4), ax, ay)
        half = min(5.0 * style["symbol_scale"], style["row"] - SYMBOL_CLEARANCE) * factor / 2
        return box(half, half, half, half)
    factor = float(item.get("symbol_factor") or 1.0)
    if kind == "line":
        half = min(item["line_length"], style["text_offset"] * 2 - 2.4) / 2 * factor
        return box(half, half, 0.5, 0.5)
    if kind == "note":
        half = min(3.6, style["row"] - SYMBOL_CLEARANCE) / 2 * factor
        return box(half, half, half, half)
    return box(0.0, 0.0, 0.0, 0.0)


def _symbol_box(item: dict, size, style: dict, tile: float) -> dict:
    """Fit one drawing into the shared tile. The longer side fills the tile, the other
    side keeps its proportion, and the drawing is centred in the tile."""
    kind = item["kind"]

    def box(left, right, up, down, scale=1.0, ax=0.0, ay=0.0):
        return {"left": left, "right": right, "up": up, "down": down, "scale": scale, "ax": ax, "ay": ay}

    if kind == "symbol":
        rot = int(item.get("rotation") or 0)
        factor = float(item.get("symbol_factor") or 1.0)
        if size:
            x0, y0, x1, y1, _ax, _ay, _engine = _anchor(size)
            hw, hh = (x1 - x0) / 2, (y1 - y0) / 2
            left, right, up, down = _turn(hw, hw, hh, hh, rot, bool(item.get("mirror")))
            span, tall = left + right, up + down
            longest = max(span, tall, 1e-6)
            scale = tile * TILE_FILL / longest
            if style.get("normalize_size", True):
                # the same area for every drawing, never more than 75 % of the tile
                target = (tile * TILE_FILL) ** 2 * AREA_SHARE
                scale = min(scale, (target / max(span * tall, 1e-9)) ** 0.5)
            scale *= factor
            return box(span * scale / 2, span * scale / 2, tall * scale / 2, tall * scale / 2,
                       round(scale, 4), (x0 + x1) / 2, (y0 + y1) / 2)
        half = tile * TILE_FILL / 2 * factor
        return box(half, half, half, half, round(factor, 4))
    # the hint symbols fill the tile like a drawing (75 %), with their own size factor
    factor = float(item.get("symbol_factor") or 1.0)
    half = tile * TILE_FILL / 2 * factor
    if kind == "line":
        return box(half, half, 0.35, 0.35)
    if kind == "note":
        return box(half, half, half, half)
    return box(0.0, 0.0, 0.0, 0.0)


PART_GAP = 1.6      # mm between the symbols of a combined entry
PART_SIZE = 0.8     # each symbol of a combined entry is a bit smaller than a single one
PART_MARGIN = 1.0   # mm of free space left of the group and before the text


def _members(item: dict) -> list[tuple[dict, int, int]]:
    """Drawings with their logical part and original plan-colour variant.

    Colour variants repeat geometry; they never replace the meaning of ``parts``.
    An explicit monochrome override hides only these colour repetitions.
    """
    logical = [item] + [{**item, "parts": None, "layer_colors": None, **part}
                        for part in item.get("parts") or []]
    members = []
    for index, part in enumerate(logical):
        colors = original_colors(part.get("layer_colors"), part.get("color", "")) if not _forced_color(item) else []
        for variant, color in enumerate(colors or [part.get("color")]):
            members.append(({**part, "color": color}, index, variant))
    return members


def _combined_tiles(item: dict, sizes: dict, single, room: tuple[float, float, float], tile: float) -> dict:
    """Use a full tile for each drawing; wrap larger groups instead of shrinking."""
    axis, lo, hi = room
    members = _members(item)
    n = len(members)
    span = max(hi - lo, 1.0)
    side = min(float(tile), span)
    across = min(2, n, max(1, int((span + TILE_GAP + 1e-6) / (side + TILE_GAP))))
    frames, out_parts = [], []
    for i, (part, logical, variant) in enumerate(members):
        key = item["id"] if logical == 0 else f"{item['id']}#{logical}"
        box = single(part, sizes.get(key), side)
        largest = max(box["left"] + box["right"], box["up"] + box["down"])
        if largest > side:
            # Logical parts and colour variants each own a complete tile. A local
            # size factor must not make one part overpaint the neighbouring part.
            factor = side / largest
            box = {**box, **{key: box[key] * factor for key in ("left", "right", "up", "down")},
                   "scale": box["scale"] * factor}
        count = min(across, n - (i // across) * across)
        total = count * side + (count - 1) * TILE_GAP
        dx = -total / 2 + (i % across) * (side + TILE_GAP) + side / 2
        dy = (i // across) * (side + TILE_GAP)
        frames.append({"dx": round(dx, 4), "dy": round(dy, 4), "side": round(side, 4), "h": round(side, 4)})
        out_parts.append({"dx": round(dx, 4), "dy": round(dy, 4), "box": box, "part": part,
                          "logical": logical, "variant": variant})
    total = across * side + (across - 1) * TILE_GAP
    return {"left": total / 2, "right": total / 2,
            "up": side / 2, "down": side / 2 + ((n - 1) // across) * (side + TILE_GAP),
            "scale": out_parts[0]["box"]["scale"], "ax": out_parts[0]["box"]["ax"],
            "ay": out_parts[0]["box"]["ay"], "parts": out_parts, "frames": frames}


def _combined(item: dict, sizes: dict, single, room: tuple[float, float, float] | None = None,
              tile: float | None = None) -> dict:
    """Box of an entry. A combined entry (``parts``) puts its symbols side by side, each
    with its own size rule, the group centred on the symbol axis. ``room`` = (axis,
    left edge, right edge) of the symbol column: a group wider than that shrinks and
    moves so it never runs into the text. In tile mode each symbol gets its own square."""
    members = _members(item) if item["kind"] == "symbol" else []
    if tile and room and len(members) > 1:
        return _combined_tiles(item, sizes, single, room, tile)
    first = single(item, sizes.get(item["id"]))
    if len(members) < 2:
        return first
    indexed = []
    for part, logical, variant in members:
        key = item["id"] if logical == 0 else f"{item['id']}#{logical}"
        indexed.append((part, single(part, sizes.get(key)), logical, variant))
    members = [(part, box) for part, box, _logical, _variant in indexed]
    widths = [(b["left"] + b["right"]) * PART_SIZE for _p, b in members]
    total = sum(widths) + PART_GAP * (len(members) - 1)
    shrink = PART_SIZE
    if room is not None:
        axis, lo, hi = room
        lo, hi = lo + PART_MARGIN, hi - PART_MARGIN + 0.8
        room = (axis, lo, hi)
        if total > hi - lo:
            gaps = PART_GAP * (len(members) - 1)
            shrink = max(0.2, PART_SIZE * (hi - lo - gaps) / max(sum(widths), 1e-6))
    scaled = []
    for (part, b), w in zip(members, widths):
        if shrink != 1.0:
            b = {**b, "left": b["left"] * shrink, "right": b["right"] * shrink, "up": b["up"] * shrink,
                 "down": b["down"] * shrink, "scale": round(b["scale"] * shrink, 5)}
        scaled.append((part, b))
    total = sum(b["left"] + b["right"] for _p, b in scaled) + PART_GAP * (len(scaled) - 1)
    shift = 0.0
    if room is not None:
        axis, lo, hi = room
        centre = min(max(axis, lo + total / 2), hi - total / 2)
        shift = centre - axis
    x = -total / 2 + shift
    out_parts = []
    for (part, b), (_p, _b, logical, variant) in zip(scaled, indexed):
        out_parts.append({"dx": round(x + b["left"], 4), "box": b, "part": part,
                          "logical": logical, "variant": variant})
        x += b["left"] + b["right"] + PART_GAP
    return {"left": total / 2 - shift, "right": total / 2 + shift,
            "up": max(b["up"] for _p, b in scaled), "down": max(b["down"] for _p, b in scaled),
            "scale": scaled[0][1]["scale"], "ax": first["ax"], "ay": first["ay"], "parts": out_parts}


def _general_header(prims: list, x: float, y: float, inner: float, ts: float, section: dict) -> float:
    """Plain general-part heading and a fine rule, as in the company legend."""
    title = str(section.get("title") or "Allgemein").strip() or "Allgemein"
    hts = ts * float(section.get("title_scale") or 1.0)
    head_h = max(hts * LINE_FACTOR + 0.8, hts + 1.2)
    line = wrap(title, hts, inner - 2, True)[:1]
    prims.append({"t": "text", "x": round(x + 0.8, 3), "y": round(y + hts * 0.95, 3),
                  "size": round(hts, 3), "text": line[0], "bold": True, "color": section.get("text") or "#000000"})
    prims.append({"t": "rect", "x": x, "y": round(y + head_h - 0.15, 3), "w": inner, "h": 0.15,
                  "fill": "#b8bec4", "stroke": None, "role": "general-rule", "block": "general"})
    prims.append({"t": "hit", "kind": "general", "block": "general", "id": "general",
                  "x": x, "y": y, "w": inner, "h": head_h})
    return y + head_h


def _general_rows(general: dict, prims: list, x0: float, top: float, inner: float, cols: int,
                  style: dict, section: dict | None = None, *, header: bool = True,
                  padding: float = 0.0, grid_id: str = "general") -> float:
    """Place the general part on the same grid as the legend: one tile, the same
    text size, the same gap. A heading is only text and sits on the bottom line of
    its grid cell. Returns the bottom edge."""
    ts = float(style["text_size"])
    if header:
        top = _general_header(prims, x0, top, inner, ts, section or {})
    top += padding
    colw = (inner - 2 * padding) / cols
    _base_tile, _base_slot, axis, text_x = tile_frame(style, colw)
    # The general key is compact independently of the apparatus grid. A custom
    # millimetre raster is an explicit user choice and remains untouched.
    compact = style if style.get("grid") == "custom" else {**style, "grid": "custom", "row": 5.0}
    tile, slot, _axis, _text_x = tile_frame(compact, colw)
    gap = max(0.0, float(style.get("entry_gap") or 0.0))
    cap = _line_cap(style)
    side = tile * TILE_FILL
    # one scale for all symbols of the general part, as in the drawing: a typical symbol
    # fills the tile, a double symbol (ceiling / wall) keeps its width beside it
    dims = sorted(float(r.get("gh") or 0) for r in general["rows"]
                  if r.get("picture") == "symbol" and not r.get("heading"))
    dims = [d for d in dims if d > 0]
    common = side / dims[len(dims) // 2] if dims else 1.0
    # A shared symbol zone gives general rows the same text line as the sections.
    # A wide pair may limit its own scale, but must never shrink every other row.
    room_w = 2 * (axis - 0.4)
    rows = []
    for r in general["rows"]:
        heading = bool(r.get("heading"))
        size = ts * max(0.5, min(3.0, float(r.get("text_scale") or 1.0)))
        width = colw - 1.6 if heading else colw - text_x - 0.8
        lines = wrap(r["text"], size, width, heading)
        if cap and not heading:
            lines = lines[:cap] or [""]
            h = slot
        else:
            h = max(slot, len(lines) * size * LINE_FACTOR + TEXT_CLEARANCE)
        factor = max(0.3, min(4.0, float(r.get("symbol_factor") or 1.0)))
        if not heading and factor > 1 and r.get("picture") not in ("swatch", None):
            h = max(h, slot * factor)
        rows.append((r, lines, size, h))
    total = sum(h for *_a, h in rows) + gap * max(0, len(rows) - cols)
    target = total / cols
    columns: list[list] = [[]]
    used = 0.0
    for i, item in enumerate(rows):
        nxt = rows[i + 1] if i + 1 < len(rows) else None
        h = item[3]
        full = used + h > target + 0.01 and columns[-1] and len(columns) < cols
        heading_last = item[0].get("heading") and nxt and used + h + nxt[3] > target + 0.01 and len(columns) < cols
        if (full or heading_last) and columns[-1]:
            columns.append([])
            used = 0.0
        columns[-1].append(item)
        used += h + gap
    bottom = top
    for c, chunk in enumerate(columns):
        cx = x0 + padding + c * colw
        cy = top
        for i, (r, lines, size, h) in enumerate(chunk):
            mid = cy + h / 2
            shown = lines or [r["text"]]
            row_lh = size * LINE_FACTOR
            if r.get("heading"):
                # top, middle or bottom of the grid cell (default: on the bottom line)
                place = r.get("text_place") or "bottom"
                if place == "top":
                    base = cy + size * 0.9
                elif place == "middle":
                    base = mid - (len(shown) - 1) * row_lh / 2 + size * 0.32
                else:
                    base = cy + h - 0.7 - (len(shown) - 1) * row_lh
                for j, line in enumerate(shown):
                    prims.append({"t": "text", "x": round(cx + 0.8, 3), "y": round(base + j * row_lh, 3),
                                  "size": round(size, 3), "text": line, "bold": True, "color": "#000000"})
            else:
                factor = max(0.3, min(4.0, float(r.get("symbol_factor") or 1.0)))
                gw, gh = float(r.get("gw") or 0.0), float(r.get("gh") or 0.0)
                rot = int(r.get("rotation") or 0) % 360
                if r.get("picture") == "library":
                    # a row added from the symbol library: the Nova symbol, sized like the project symbols
                    drawing = r.get("size")
                    box = _symbol_box({"kind": "symbol", "rotation": rot, "symbol_factor": factor,
                                       "mirror": False}, tuple(drawing) if drawing else None, style, tile)
                    sx = cx + axis
                    prims.append({"t": "symbol", "id": r["id"], "key": r["symbol_key"],
                                  "family_key": r.get("family_key"), "length_mm": None, "width_mm": None,
                                  "cx": round(sx, 3), "cy": round(mid, 3), "scale": box["scale"], "rot": rot,
                                  "ax": round(box["ax"], 4), "ay": round(box["ay"], 4), "mirror": False,
                                  "x0": round(sx - box["left"], 3), "y0": round(mid - box["up"], 3),
                                  "w": round(box["left"] + box["right"], 3), "h": round(box["up"] + box["down"], 3),
                                  "layer": "", "hatch_off": False, "fill_off": False,
                                  "color": "#000000", "flat": False, "general": True})
                elif r.get("picture") == "swatch":
                    # one chip per colour, the same size in every row, text beside it
                    shrink = factor if factor < 1 else 1.0
                    w = min(tile * 0.92, colw * 0.42) * shrink
                    hgt = min(tile * 0.38, max(1.3, ts * 0.95)) * shrink
                    prims.append({"t": "rect", "x": round(cx + axis - w / 2, 3), "y": round(mid - hgt / 2, 3),
                                  "w": round(w, 3), "h": round(hgt, 3), "fill": r.get("swatch") or "#9aa0a6",
                                  "stroke": None, "role": "swatch"})
                elif r.get("gw") is not None and (gw > 0 or gh > 0):
                    line_row = r.get("picture") == "line" or (r.get("picture") != "symbol" and gh <= 0.35)
                    if line_row:
                        # one sample of the stroke, as long as the symbol tile, so the line type
                        # reads next to the symbols of the other sections
                        length = room_w * TILE_FILL
                        scale = length / max(gw, 1e-6)
                        w, hgt = length, max(0.5, gh * scale)
                        prims.append({"t": "grow", "row": r["id"], "x": round(cx + axis - w / 2, 3),
                                      "y": round(mid - hgt / 2, 3), "w": round(w, 3), "h": round(hgt, 3),
                                      "k": round(scale, 5), "rot": 0})
                    elif r.get("picture") == "symbol":
                        # the whole symbol at the common scale of the general part; only a symbol
                        # that does not fit the row (height) or the symbol column (width) shrinks
                        view_h = max(h - 0.4, side)
                        fit = common * factor
                        fit = min(fit, view_h / max(gh, 1e-6), room_w / max(gw, 1e-6))
                        w, hgt = gw * fit, gh * fit
                        # centred on the symbol axis; a wide symbol starts at the cell edge
                        left = cx + axis - w / 2
                        prims.append({"t": "grow", "row": r["id"], "x": round(left, 3),
                                      "y": round(mid - hgt / 2, 3), "w": round(w, 3), "h": round(hgt, 3),
                                      "k": round(fit, 5), "rot": rot})
                    else:
                        # the bulky part (the symbol) fills the same tile as the project symbols.
                        # a long stroke beside it is cut at the tile, so it cannot shrink the symbol
                        gw, gh = gw or 0.35, gh or 0.35
                        wide = gw > gh * 1.6
                        basis = gh if wide else max(gw, gh, 1e-6)
                        scale = side / basis * factor
                        full_w, full_h = gw * scale, gh * scale
                        # the window is the tile: the symbol stays as large as the project
                        # symbols, and a stroke that runs past the tile is cut off
                        view = min(tile * 0.92, max(slot - 0.4, side))
                        show_w, show_h = min(full_w, view), min(full_h, view)
                        focus = r.get("focus") or [0.5, 0.5]
                        fx = _clip_origin(float(focus[0]), show_w / full_w)
                        fy = _clip_origin(float(focus[1]), show_h / full_h)
                        prims.append({"t": "grow", "row": r["id"], "x": round(cx + axis - show_w / 2, 3),
                                      "y": round(mid - show_h / 2, 3), "w": round(show_w, 3), "h": round(show_h, 3),
                                      "full_w": round(full_w, 3), "full_h": round(full_h, 3),
                                      "fx": round(fx, 4), "fy": round(fy, 4),
                                      "k": round(scale, 5), "rot": rot})
                base = mid - (len(shown) - 1) * row_lh / 2 + size * 0.32
                for j, line in enumerate(shown):
                    prims.append({"t": "text", "x": round(cx + text_x, 3), "y": round(base + j * row_lh, 3),
                                  "size": round(size, 3), "text": line, "bold": False, "color": "#000000"})
            prims.append({"t": "hit", "kind": "general-row", "block": "general", "id": r["id"],
                          "x": round(cx, 3), "y": round(cy, 3), "w": round(colw, 3), "h": round(h, 3)})
            cy += h
            if gap and i < len(chunk) - 1:
                cy += gap
        bottom = max(bottom, cy)
    height = bottom - top
    prims.append({"t": "grid", "block": grid_id, "x": x0 + padding, "y": top, "slot": slot, "gap": gap,
                  "tile": tile, "w": inner - 2 * padding, "h": height, "row": slot + gap, "cols": cols, "colw": colw,
                  "axis": axis, "text": text_x})
    prims.append({"t": "rect", "x": x0, "y": top, "w": inner, "h": height, "fill": None, "stroke": None,
                  "role": "general", "fit": 1.0, "rows": True})
    return bottom + padding


def _general_parts(general: dict) -> tuple[dict, dict | None]:
    """Move the named colour-code group below all apparatus sections.

    Row identities and their order within each group stay unchanged for editing
    and DXF export; a filled duct is never mistaken for the colour-key group.
    """
    body, colors = [], []
    in_colors = False
    for row in general.get("rows") or []:
        if row.get("heading"):
            label = str(row.get("text") or "").strip().casefold()
            in_colors = label.startswith(("farbcode", "farblegende", "farbschlüssel"))
        (colors if in_colors else body).append(row)
    return {**general, "rows": body}, ({**general, "rows": colors} if colors else None)


def _color_rows(general: dict, prims: list, x: float, top: float, inner: float,
                style: dict, padding: float) -> float:
    """Compact colour key: up to five columns, filled downwards in pairs."""
    rows = general.get("rows") or []
    if not rows:
        return top
    size = max(1.6, min(2.3, float(style["text_size"]) * 0.78))
    width = inner - 2 * padding
    columns = min(5, len(rows), max(1, int(width / 36.0)))
    colw = width / columns
    per_col = math.ceil(len(rows) / columns)
    sample, offset, gap = 7.0, 9.0, 0.6
    chunks = [rows[index * per_col:(index + 1) * per_col] for index in range(columns)]
    lines = {row["id"]: wrap(str(row.get("text") or "").replace("/", "/ "),
                             size * float(row.get("text_scale") or 1), colw - offset - 0.8)
             for row in rows}
    heights = []
    for index in range(per_col):
        heights.append(max([3.5] + [len(lines[chunk[index]["id"]]) * size *
                                   float(chunk[index].get("text_scale") or 1) * LINE_FACTOR + 0.7
                                   for chunk in chunks if index < len(chunk)]))
    start = top + padding
    for column, chunk in enumerate(chunks):
        cx, cy = x + padding + column * colw, start
        for index, row in enumerate(chunk):
            height = heights[index]
            text_size = size * float(row.get("text_scale") or 1)
            shown = lines[row["id"]]
            middle = cy + height / 2
            color = row.get("swatch") or (row.get("colors") or ["#9aa0a6"])[0]
            prims.append({"t": "rect", "x": round(cx + 0.8, 3), "y": round(middle - 0.325, 3),
                          "w": sample, "h": 0.65, "fill": color, "stroke": None, "role": "swatch"})
            baseline = middle - (len(shown) - 1) * text_size * LINE_FACTOR / 2 + text_size * 0.32
            for number, line in enumerate(shown):
                prims.append({"t": "text", "x": round(cx + offset, 3),
                              "y": round(baseline + number * text_size * LINE_FACTOR, 3),
                              "size": round(text_size, 3), "text": line, "bold": False, "color": "#000000"})
            prims.append({"t": "hit", "kind": "general-row", "block": "general", "id": row["id"],
                          "x": round(cx, 3), "y": round(cy, 3), "w": colw, "h": height})
            cy += height + gap
    height = sum(heights) + gap * max(0, per_col - 1)
    prims.append({"t": "grid", "block": "general-colors", "x": x + padding, "y": start,
                  "slot": min(heights), "gap": gap, "tile": sample, "w": width, "h": height,
                  "row": min(heights) + gap, "cols": columns, "colw": colw,
                  "axis": 0.8 + sample / 2, "text": offset})
    return start + height + padding


def _flow_blocks(blocks: list[dict], style: dict, sizes: dict, prims: list,
                 x: float, top: float, inner: float, columns: int) -> float:
    """Balance ordered apparatus sections through columns, splitting only at rows.

    The document's section and item identities stay unchanged. A continuation
    title is presentation only; cells retain their original visible-item index
    for drag/drop, selection and editing.
    """
    gutter = 2.5
    column_width = (inner - gutter * (columns - 1)) / columns
    flow_style = {**style, "_flow": True}
    if style.get("grid") != "custom":
        flow_style.update(grid="custom", row=5.0, text_offset=12.0)
    ts, row = float(style["text_size"]), float(flow_style["row"])
    gap = max(0.0, float(style.get("section_gap") or 0))
    entry_gap = max(0.0, float(style.get("entry_gap") or 0))
    measured = []
    for block in blocks:
        visible = [item for item in block["items"] if not item.get("hidden")]
        sample = []
        height = _block({**block, "items": visible}, flow_style, sizes, sample,
                        0, 0, column_width, 1, ts, row)
        cells = [prim for prim in sample if prim["t"] == "cell"]
        heights = [float(cell["h"]) for cell in cells]
        overhead = max(0.0, height - sum(heights) - entry_gap * max(0, len(heights) - 1))
        measured.append((block, visible, heights, overhead))
    if not measured:
        return top

    def pack(capacity):
        column, used, result = 0, 0.0, []
        heights_by_column = [0.0] * columns
        for number, (_block_doc, _items, heights, overhead) in enumerate(measured):
            offset = 0
            while offset < len(heights):
                if column >= columns:
                    return None
                before = gap if used else 0.0
                available = capacity - used - before - overhead
                count, body = 0, 0.0
                while offset + count < len(heights):
                    addition = heights[offset + count] + (entry_gap if count else 0)
                    if body + addition > available + 1e-6:
                        break
                    body += addition
                    count += 1
                if not count:
                    column, used = column + 1, 0.0
                    continue
                result.append((number, column, offset, count, used + before))
                used += before + overhead + body
                heights_by_column[column] = used
                offset += count
                if offset < len(heights):
                    column, used = column + 1, 0.0
        return result, heights_by_column

    total = sum(sum(heights) + overhead + entry_gap * max(0, len(heights) - 1)
                for _block_doc, _items, heights, overhead in measured) + gap * max(0, len(measured) - 1)
    low = max([total / columns] + [overhead + max(heights) for _b, _i, heights, overhead in measured])
    high = max(low, total)
    for _ in range(28):
        middle = (low + high) / 2
        if pack(middle) is None:
            low = middle
        else:
            high = middle
    packed = pack(math.ceil(high * 100) / 100 + 0.01) or pack(total + 1)
    if packed is None:
        raise ValueError("Die Legendenabschnitte konnten nicht vollständig angeordnet werden.")
    fragments, _heights = packed
    bottom = top
    for number, column, offset, count, used in fragments:
        block, items, _row_heights, _overhead = measured[number]
        chunk = {**block, "items": items[offset:offset + count]}
        if offset:
            chunk["title"] = (block.get("title") or "") + " (Fortsetzung)"
        fragment = []
        end = _block(chunk, flow_style, sizes, fragment,
                     x + column * (column_width + gutter), top + used, column_width, 1, ts, row)
        for primitive in fragment:
            if primitive["t"] == "cell":
                primitive["index"] += offset
            if primitive["t"] in ("grid", "cell"):
                primitive["flow_column"] = column
        prims.extend(fragment)
        bottom = max(bottom, end)
    return bottom


def layout(doc: dict, sizes: dict | None = None, general: dict | None = None,
           only_block: str | None = None, include_general: bool = True) -> dict:
    """Place everything. ``sizes`` maps an item id to (x0, y0, x1, y1, engine) of its
    drawing in mm at scale 1 around its insertion point (or the older (width, height, engine)). ``general`` is {"w", "h"} of the locked part in mm (already fitted)."""
    sizes = sizes or {}
    include_general = include_general and doc.get("general_on", True) is not False
    style = doc["style"]
    ts = style["text_size"]
    row = style["row"]
    margin = style["margin"]
    gap = max(0.0, float(style.get("section_gap") or 0.0))
    width = max(80.0, min(style["width"], 210.0))
    inner = width - 2 * margin
    cols = 3 if style["columns"] >= 3 else 2
    prims: list[dict] = []
    y = margin

    title = doc.get("title") or {}
    text = str(title.get("text", "")).strip()
    if text and not only_block:
        own = float(title.get("size_mm") or 0)
        # 0 means the legend never chose a title height
        tts = own if own > 0 else DEFAULT_TITLE_MM
        framed = bool(title.get("border_on"))
        pad = 1.5 if framed else 0.0          # room between the title and its border
        top = y
        y += pad
        for line in wrap(text, tts, inner - 2 * pad, True):
            prims.append({"t": "text", "x": margin + pad, "y": y + tts, "size": tts, "text": line, "bold": True,
                          "color": title.get("color") or "#000000",
                          "font": title.get("font") or style.get("font") or "Arial"})
            y += tts * LINE_FACTOR
        y += pad
        if framed:
            prims.append({"t": "rect", "x": margin, "y": top, "w": inner, "h": y - top, "fill": None,
                          "stroke": title.get("border") or "#000000", "role": "border", "block": "title"})
        prims.append({"t": "hit", "kind": "title", "block": None, "id": "title",
                      "x": margin, "y": top, "w": inner, "h": y - top})
        y += row * 0.5

    section = doc.get("general_section") or {}
    general_body, footer = _general_parts(general) if general and general.get("rows") else (general, None)
    pad = next((float(b["style"]["padding"]) for b in doc["blocks"]
                if not only_block or b["id"] == only_block), float(section_style(None)["padding"]))
    if general_body and include_general and general_body.get("rows"):
        y = _general_rows(general_body, prims, margin, y, inner, 2, style, section, padding=pad)
    elif general_body and include_general and general_body.get("h") and not footer:
        # no readable text column: the drawing stays whole, under the category bar
        y = _general_header(prims, margin, y, inner, ts, section)
        fit = min(1.0, inner / general["w"]) if general.get("w") else 1.0
        gw, gh = general["w"] * fit, general["h"] * fit
        prims.append({"t": "rect", "x": margin, "y": y, "w": gw, "h": gh, "fill": None, "stroke": None,
                      "role": "general", "fit": round(fit, 5)})
        prims.append({"t": "hit", "kind": "general", "block": "general", "id": "general",
                      "x": margin, "y": y, "w": gw, "h": gh})
        y += gh + row * 0.5

    if footer and include_general:
        y += gap
        footer_rows = footer["rows"]
        if footer_rows and footer_rows[0].get("heading"):
            # The palette title spans both columns. Every first colour chip then
            # begins on the same row instead of one column starting at title level.
            heading = footer_rows[0]
            size = ts * max(0.5, min(3.0, float(heading.get("text_scale") or 1.0)))
            lines = wrap(heading["text"], size, inner - 2 * pad - 1.6, True)
            height = max(row * 0.65, len(lines) * size * LINE_FACTOR + 0.6)
            position = heading.get("text_place") or "bottom"
            if position == "top":
                baseline = y + size * 0.9
            elif position == "middle":
                baseline = y + height / 2 - (len(lines) - 1) * size * LINE_FACTOR / 2 + size * 0.32
            else:
                baseline = y + height - 0.7 - (len(lines) - 1) * size * LINE_FACTOR
            for index, line in enumerate(lines):
                prims.append({"t": "text", "x": round(margin + pad + 0.8, 3),
                              "y": round(baseline + index * size * LINE_FACTOR, 3),
                              "size": round(size, 3), "text": line, "bold": True, "color": "#000000"})
            prims.append({"t": "hit", "kind": "general-row", "block": "general", "id": heading["id"],
                          "x": margin + pad, "y": y, "w": inner - 2 * pad, "h": height})
            prims.append({"t": "rect", "x": margin, "y": round(y + height + 0.05, 3),
                          "w": inner, "h": 0.15, "fill": "#b8bec4", "stroke": None,
                          "role": "general-rule", "block": "general-colors"})
            y += height + 0.25
            footer_rows = footer_rows[1:]
        if footer_rows:
            footer_data = {**footer, "rows": footer_rows}
            if all(row.get("picture") == "swatch" for row in footer_rows):
                y = _color_rows(footer_data, prims, margin, y, inner, style, pad)
            else:
                # Non-colour custom content keeps its original drawing and editor
                # controls instead of being silently converted into a colour chip.
                y = _general_rows(footer_data, prims, margin, y, inner, cols, style, section,
                                  header=False, padding=pad, grid_id="general-colors")

    if style.get("compact_flow"):
        visible_blocks = [block for block in doc["blocks"] if not only_block or block["id"] == only_block]
        if visible_blocks:
            if general_body or footer:
                y += max(3.0, ts * 1.5)
            y = _flow_blocks(visible_blocks, style, sizes, prims, margin, y, inner, cols)
    else:
        first = True
        under_general = bool(general_body and include_general and
                             (general_body.get("rows") or (general_body.get("h") and not footer)))
        for block in doc["blocks"]:
            if only_block and block["id"] != only_block:
                continue
            if not first:
                y += gap
            first = False
            # the project's own «Allgemein» entries go on below the general part, without a
            # second «Allgemein» bar
            continued = under_general and block.get("category_id") == "allgemein"
            y = _block(block, style, sizes, prims, margin, y, inner, cols, ts, row, continued)


    height = max(math.ceil((y + margin) * 10) / 10, 2 * margin + row)
    if style.get("frame_on"):
        # border round the whole legend, in the middle of the margin
        prims.append({"t": "rect", "x": margin / 2, "y": margin / 2, "w": width - margin, "h": height - margin,
                      "fill": None, "stroke": style.get("frame") or "#000000", "role": "border", "block": "frame"})
    return {"width": width, "height": height, "prims": prims}


def _block(block, style, sizes, prims, x0, y, inner, cols, ts, row, continued: bool = False) -> float:
    st = block["style"]
    pad = st["padding"]
    flow = bool(style.get("_flow"))
    hts = ts * float(block.get("title_scale") or 1.0) * (0.85 if flow else 1.0)
    head_h = 0.0 if continued else max(hts * 1.15 + 0.8, hts + 1.2)
    top = y
    body: list[dict] = []
    colw = (inner - 2 * pad) / cols
    items = [it for it in block["items"] if not it.get("hidden")]
    cap = _line_cap(style)
    gap_mm = max(0.0, float(style.get("entry_gap") or 0.0))
    real = style.get("symbol_size", "real") != "tile"
    if real:
        # real size: insertion points on one axis, texts right of the widest part,
        # every entry takes whole rows of the chosen grid
        off = style["text_offset"]
        boxes = {it["id"]: _combined(it, sizes, lambda part, size: _symbol_box_real(part, size, style, colw / 2))
                 for it in items}
        axis = max([off * 0.4] + [boxes[it["id"]]["left"] + 0.3 for it in items])
        text_x = max([off] + [axis + boxes[it["id"]]["right"] + 1.2 for it in items])
        fixed = None
    else:
        # equal tiles: every drawing fills one tile sized from the text.
        # a raster other than Standard uses the chosen row height and text distance
        tile, fixed, axis, text_x = tile_frame(style, colw)
        def tile_box(part, size, side=tile, even=True):
            # a combined symbol fills its own cell; the shared area rule would
            # leave it looking small inside the narrower tile
            used = style if even else {**style, "normalize_size": False}
            box = _symbol_box(part, size, used, side)
            if part["kind"] == "line":
                half = (text_x - 1.6) * TILE_FILL / 2 * float(part.get("symbol_factor") or 1.0)
                box = {**box, "left": half, "right": half}
            available = max(1.0, text_x - 1.6)
            width = box["left"] + box["right"]
            if width > available:
                factor = available / width
                box = {**box, **{key: box[key] * factor for key in ("left", "right", "up", "down")},
                       "scale": box["scale"] * factor}
            return box

        # the pair fills the normal tile, it does not reach into the text column
        boxes = {it["id"]: _combined(it, sizes, tile_box, (axis, 0.4, text_x - 1.2), tile)
                 for it in items}
    per_col = math.ceil(len(items) / cols) if items else 0
    col_heights = []
    # every place of the grid is a cell (also the empty ones): the editor drops entries
    # into cells; index = position in the list of shown entries (gaps included)
    cells: list[dict] = []
    empty_h = row if fixed is None else fixed
    for c in range(cols):
        cx0 = x0 + pad + c * colw
        cy = top + head_h + pad
        chunk = items[c * per_col:(c + 1) * per_col]
        for i in range(max(per_col, 1)):
            index = c * per_col + i if per_col else c
            item = chunk[i] if i < len(chunk) else None
            if item is not None and item["kind"] != "gap":
                h = _entry(item, boxes[item["id"]], body, block, cx0, cy, colw, ts, row, axis, text_x, st,
                           fixed, cap, (bool(style.get("hatch_off")), bool(style.get("fill_off"))))
            else:
                h = empty_h
            cells.append({"t": "cell", "block": block["id"], "index": index,
                          "id": item["id"] if item is not None else None,
                          "empty": item is None or item["kind"] == "gap",
                          "x": round(cx0, 3), "y": round(cy, 3), "w": round(colw, 3), "h": round(h, 3)})
            if item is not None:
                cy += h
                if gap_mm and i < len(chunk) - 1:
                    cy += gap_mm
            else:
                cy += h + gap_mm
        used = [cell for cell in cells[-max(per_col, 1):] if cell["index"] < len(items)]
        col_heights.append((used[-1]["y"] + used[-1]["h"] - (top + head_h + pad)) if used else 0.0)
    body_h = max(col_heights or [0.0]) if items else row
    total_h = head_h + pad + body_h + pad
    frames = None
    if not real:
        frames = []
        grid_top = top + head_h + pad
        for cell in cells:
            if cell["y"] > grid_top + body_h - 0.05:
                continue
            box = boxes.get(cell["id"]) if cell.get("id") else None
            custom = (box or {}).get("frames")
            # a wrapped line may lengthen the row downward; the tile stays on the
            # one-line middle, together with the first line of the description
            mid = cell["y"] + max(fixed / 2, (box or {}).get("up", 0.0)) if cell["h"] > fixed + 0.05 else cell["y"] + cell["h"] / 2
            if custom:
                for fr in custom:
                    side = fr["side"]
                    hgt = fr.get("h", side)
                    frames.append({"x": round(cell["x"] + axis + fr["dx"] - side / 2, 3),
                                   "y": round(mid + fr.get("dy", 0.0) - hgt / 2, 3),
                                   "w": round(side, 3), "h": round(hgt, 3)})
            else:
                frames.append({"x": round(cell["x"] + axis - tile / 2, 3),
                               "y": round(mid - tile / 2, 3), "w": tile, "h": tile})
    prims.append({"t": "grid", "block": block["id"], "x": x0 + pad, "y": top + head_h + pad,
                  "slot": row if fixed is None else fixed, "gap": gap_mm,
                  "tile": None if real else tile, "frames": frames,
                  "w": inner - 2 * pad, "h": body_h, "row": (row if fixed is None else fixed) + gap_mm,
                  "cols": cols, "colw": colw,
                  "axis": axis, "text": text_x})
    if st.get("background_on"):
        prims.append({"t": "rect", "x": x0, "y": top, "w": inner, "h": total_h, "fill": st["background"],
                      "stroke": None, "role": "background", "block": block["id"]})
    prims.append({"t": "hit", "kind": "section", "block": block["id"], "id": block["id"],
                  "x": x0, "y": top, "w": inner, "h": total_h})
    if head_h:
        if flow:
            prims.append({"t": "rect", "x": x0 + pad, "y": top + 0.25, "w": 0.8, "h": max(1.8, hts),
                          "fill": st["header"], "stroke": None, "role": "header-marker", "block": block["id"]})
            prims.append({"t": "rect", "x": x0 + pad, "y": top + head_h - 0.15,
                          "w": inner - 2 * pad, "h": 0.12, "fill": st["header"],
                          "stroke": None, "role": "header-rule", "block": block["id"]})
        else:
            prims.append({"t": "rect", "x": x0, "y": top, "w": inner, "h": head_h, "fill": st["header"],
                          "stroke": None, "role": "header", "block": block["id"]})
        title_lines = wrap(block["title"] or "", hts, inner - 2 * pad - (2 if flow else 1), True)[:1]
        prims.append({"t": "text", "x": x0 + pad + (1.6 if flow else 0.5),
                      "y": top + head_h / 2 + hts * 0.36, "size": hts,
                      "text": title_lines[0], "bold": True, "color": st["text"] if flow else st["header_text"]})
    prims.extend(body)
    prims.extend(cells)
    if st["border_on"]:
        prims.append({"t": "rect", "x": x0, "y": top, "w": inner, "h": total_h, "fill": None,
                      "stroke": st["border"], "role": "border", "block": block["id"]})
    if head_h:
        prims.append({"t": "hit", "kind": "block", "block": block["id"], "id": block["id"],
                      "x": x0, "y": top, "w": inner, "h": head_h})
    return top + total_h


def _line_cap(style: dict) -> int:
    """1–3 reserves that many text lines and one row height. 0 keeps the automatic height."""
    try:
        n = int(style.get("text_lines") or 0)
    except (TypeError, ValueError):
        return 0
    return n if n in (1, 2, 3) else 0


def _entry(item, box, out, block, cx0, cy, colw, ts, row, axis, text_x, st,
           fixed_h: float | None = None, lines_n: int = 0, fills_off: tuple[bool, bool] = (False, False)) -> float:
    """Draw one entry at the top of its slot, return the slot height."""
    kind = item["kind"]
    its = ts * float(item.get("text_scale") or 1.0)
    lh = its * LINE_FACTOR
    tx = cx0 + text_x
    lines = wrap(entry_text(item) if item.get("parts") else item["text"], its, cx0 + colw - tx - 0.8)
    if lines_n:
        # a chosen line count: extra lines are dropped
        reserve = lines_n
        lines = lines[:reserve] or [""]
    else:
        # automatic: a long text wraps and its row grows, nothing is cut off
        reserve = len(lines) or 1
    if fixed_h is None:
        # real size: whole rows of the grid, room for the text and for the symbol
        # whose insertion point sits on the middle of the row
        sym_h = 2 * max(box["up"], box["down"])
        need = max(reserve * lh + TEXT_CLEARANCE, sym_h + SYMBOL_CLEARANCE if sym_h else 0.0)
        h = row * max(1, math.ceil(need / row - 1e-3))
        mid = cy + h / 2
        # the text block stays centred on the symbol
        base = mid - (reserve - 1) * lh / 2 + its * 0.32
    else:
        # The first line of every entry shares the baseline of a one-line row.
        # Further lines go downward. The row keeps its height while they fit,
        # and grows only when a longer text needs the room below that line.
        middle_offset = max(fixed_h / 2, box["up"])
        mid = cy + middle_offset
        base = mid + its * 0.32
        if lines_n:
            h = fixed_h
        else:
            bottom = (base - cy) + (reserve - 1) * lh + its * 0.15
            h = fixed_h if bottom <= fixed_h else bottom
        h = max(h, middle_offset + box["down"])
        limit = cy + h - (reserve - 1) * lh - its * 0.1
        if base > limit:
            base = limit
    sx = cx0 + axis
    w = box["left"] + box["right"]
    # symbol_color paints this one entry in one colour. Otherwise a symbol keeps the
    # plan colour of its row, or the section colour, and a real hue in the drawing stays.
    section_color = st.get("symbol") or "#000000"
    forced = _forced_color(item)
    paint = forced or (item.get("color") or section_color if kind == "symbol" else section_color)
    if kind == "symbol":
        # a combined entry draws each of its symbols at its own place, side by side
        members = box.get("parts") or [{"dx": 0.0, "box": box, "part": item}]
        for k, m in enumerate(members):
            part, b = m["part"], m["box"]
            px = sx + m["dx"]
            py = mid + m.get("dy", 0.0)
            colour = forced or (part.get("color") or item.get("color") or section_color)
            prim = {"t": "symbol", "id": item["id"], "key": part["symbol_key"], "family_key": part["family_key"],
                    "length_mm": part["length_mm"], "width_mm": part["width_mm"],
                    "cx": round(px, 3), "cy": round(py, 3), "scale": b["scale"], "rot": part.get("rotation", 0),
                    "ax": round(b["ax"], 4), "ay": round(b["ay"], 4), "mirror": bool(part.get("mirror")),
                    "x0": round(px - b["left"], 3), "y0": round(py - b["up"], 3),
                    "w": round(b["left"] + b["right"], 3), "h": round(b["up"] + b["down"], 3),
                    "layer": block.get("layer") or "",
                    "hatch_off": fills_off[0], "fill_off": fills_off[1],
                    "color": colour, "flat": bool(forced)}
            if len(members) > 1:
                prim["part"] = m.get("logical", k)
                prim["variant"] = m.get("variant", 0)
            out.append(prim)
    elif kind == "line":
        out.append({"t": "line", "dash": dash_array(item["line_style"], box["left"] + box["right"]),
                    "x1": round(sx - box["left"], 3), "x2": round(sx + box["right"], 3),
                    "y1": round(mid, 3), "y2": round(mid, 3), "color": paint, "style": item["line_style"],
                    "layer": block.get("layer") or "", "item": item["id"]})
    elif kind == "note":
        out.append({"t": "half", "cx": round(sx, 3), "cy": round(mid, 3), "r": round(w / 2, 3), "color": paint,
                    "item": item["id"]})
    for i, line in enumerate(lines):
        out.append({"t": "text", "x": round(tx, 3), "y": round(base + i * lh, 3), "size": round(its, 3),
                    "text": line, "bold": False, "color": st["text"], "item": item["id"]})
    out.append({"t": "hit", "kind": "item", "block": block["id"], "id": item["id"],
                "x": cx0, "y": cy, "w": colw, "h": h})
    return h
