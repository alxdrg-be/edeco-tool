"""Convert the Toolhub's own rack sheet SVG into vector PDF operators.

The program draws each A4 sheet once (React, millimetre viewBox). The PDF is
made from exactly that markup, so screen preview and export cannot drift
apart. Only the small SVG subset the sheet uses is accepted: groups with
translate/scale/matrix transforms, rect, line, polyline, polygon, circle,
path (M L H V C S Z, absolute and relative) and single-line text. Anything
else (scripts, images, external references, entities) is rejected or ignored;
nothing is fetched and no markup reaches the PDF unescaped.
"""

from __future__ import annotations

import math
import re
import xml.etree.ElementTree as ET

PT_MM = 72 / 25.4
SVG_NS = "{http://www.w3.org/2000/svg}"
MAX_SVG_BYTES = 4 * 1024 * 1024
MAX_ELEMENTS = 60000

# Helvetica advance widths (1/1000 em) for WinAnsi 32..126. Other glyphs use 556.
_HELVETICA = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
              556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
              667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
              556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584]
_HELVETICA_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
                   556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
                   667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
                   611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584]
_SPECIAL = {"×": 584, "·": 278, "–": 556, "—": 1000, "„": 333, "“": 333, "”": 333, "″": 333, "°": 400, "²": 333, "³": 333, "…": 1000,
            "ä": 556, "ö": 556, "ü": 556, "Ä": 667, "Ö": 778, "Ü": 722, "é": 556, "è": 556, "à": 556, "ç": 500, "²": 333}
_NAMED_COLOURS = {"white": "#ffffff", "black": "#000000", "none": "none", "transparent": "none"}


class SheetError(ValueError):
    """The sheet uses markup outside the supported, safe subset."""


def text_width_mm(text: str, size_mm: float, bold: bool = False) -> float:
    table = _HELVETICA_BOLD if bold else _HELVETICA
    total = 0
    for char in text:
        code = ord(char)
        total += table[code - 32] if 32 <= code <= 126 else _SPECIAL.get(char, 556)
    return total / 1000 * size_mm


def _colour(value: str | None, current: str) -> str | None:
    if value is None:
        return None
    value = value.strip().lower()
    if value == "currentcolor":
        value = current
    value = _NAMED_COLOURS.get(value, value)
    if value == "none":
        return "none"
    if re.fullmatch(r"#[0-9a-f]{3}", value):
        value = "#" + "".join(c * 2 for c in value[1:])
    if re.fullmatch(r"#[0-9a-f]{6}", value):
        return value
    return None


def _on_paper(value: str | None, opacity: float) -> str | None:
    if value in (None, "none") or opacity >= 1:
        return value
    mixed = [round(int(value[i:i + 2], 16) * opacity + 255 * (1 - opacity)) for i in (1, 3, 5)]
    return "#" + "".join(f"{channel:02x}" for channel in mixed)


def _rgb(value: str) -> str:
    return " ".join(f"{int(value[i:i + 2], 16) / 255:.4f}" for i in (1, 3, 5))


def _num(value, default=0.0) -> float:
    if value is None or value == "":
        return default
    match = re.match(r"\s*(-?[\d.]+(?:e-?\d+)?)", str(value))
    if not match:
        return default
    number = float(match.group(1))
    if not math.isfinite(number):
        raise SheetError("Ungültige Zahl im Planblatt.")
    return number


def _multiply(a, b):
    a1, b1, c1, d1, e1, f1 = a
    a2, b2, c2, d2, e2, f2 = b
    return (a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1)


def _transform(value: str | None):
    matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
    if not value:
        return matrix
    for name, args in re.findall(r"(translate|scale|matrix|rotate)\s*\(([^)]*)\)", value):
        nums = [float(n) for n in re.findall(r"-?[\d.]+(?:e-?\d+)?", args)]
        if name == "translate":
            step = (1, 0, 0, 1, nums[0], nums[1] if len(nums) > 1 else 0)
        elif name == "scale":
            step = (nums[0], 0, 0, nums[1] if len(nums) > 1 else nums[0], 0, 0)
        elif name == "matrix" and len(nums) == 6:
            step = tuple(nums)
        elif name == "rotate":
            angle = math.radians(nums[0])
            cos, sin = math.cos(angle), math.sin(angle)
            step = (cos, sin, -sin, cos, 0, 0)
            if len(nums) == 3:
                step = _multiply(_multiply((1, 0, 0, 1, nums[1], nums[2]), step), (1, 0, 0, 1, -nums[1], -nums[2]))
        else:
            continue
        matrix = _multiply(matrix, step)
    return matrix


def _path_commands(d: str):
    """Absolute M/L/C/Z segments from an SVG path (M L H V C S Z, both cases)."""
    tokens = re.findall(r"[MmLlHhVvCcSsZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?", d)
    result, index, command = [], 0, None
    x = y = start_x = start_y = 0.0
    last_control = None

    def take(count):
        nonlocal index
        values = [float(v) for v in tokens[index:index + count]]
        if len(values) != count:
            raise SheetError("Unvollständiger Pfad im Planblatt.")
        index += count
        return values

    while index < len(tokens):
        token = tokens[index]
        if re.fullmatch(r"[A-Za-z]", token):
            command = token
            index += 1
            if command in "Zz":
                result.append(("Z",))
                x, y = start_x, start_y
                last_control = None
                continue
        if command is None:
            raise SheetError("Pfad ohne Befehl im Planblatt.")
        relative = command.islower()
        upper = command.upper()
        if upper == "M":
            nx, ny = take(2)
            x, y = (x + nx, y + ny) if relative else (nx, ny)
            start_x, start_y = x, y
            result.append(("M", x, y))
            command = "l" if relative else "L"
            last_control = None
        elif upper == "L":
            nx, ny = take(2)
            x, y = (x + nx, y + ny) if relative else (nx, ny)
            result.append(("L", x, y))
            last_control = None
        elif upper == "H":
            (nx,) = take(1)
            x = x + nx if relative else nx
            result.append(("L", x, y))
            last_control = None
        elif upper == "V":
            (ny,) = take(1)
            y = y + ny if relative else ny
            result.append(("L", x, y))
            last_control = None
        elif upper in "CS":
            if upper == "C":
                x1, y1, x2, y2, nx, ny = take(6)
                if relative:
                    x1, y1, x2, y2 = x + x1, y + y1, x + x2, y + y2
            else:
                x2, y2, nx, ny = take(4)
                if relative:
                    x2, y2 = x + x2, y + y2
                x1, y1 = (2 * x - last_control[0], 2 * y - last_control[1]) if last_control else (x, y)
            if relative:
                nx, ny = x + nx, y + ny
            result.append(("C", x1, y1, x2, y2, nx, ny))
            last_control = (x2, y2)
            x, y = nx, ny
        else:
            raise SheetError(f"Pfadbefehl {command} wird im Planblatt nicht unterstützt.")
    return result


def _local(tag: str) -> str:
    return tag[len(SVG_NS):] if tag.startswith(SVG_NS) else tag


def _style_attrs(element) -> dict:
    attrs = dict(element.attrib)
    for item in (element.get("style") or "").split(";"):
        if ":" in item:
            key, value = item.split(":", 1)
            attrs[key.strip()] = value.strip()
    return attrs


def _encode_text(text: str) -> str:
    return " ".join(text.split()).encode("cp1252", errors="replace").hex()


def sheet_ops(svg: str) -> list[str]:
    """PDF content-stream operators for one A4 sheet (viewBox in mm)."""
    if len(svg.encode("utf-8")) > MAX_SVG_BYTES:
        raise SheetError("Planblatt ist zu gross.")
    if re.search(r"<!(DOCTYPE|ENTITY)", svg, re.IGNORECASE):
        raise SheetError("Planblatt enthält unzulässige Deklarationen.")
    try:
        root = ET.fromstring(svg)
    except ET.ParseError as error:
        raise SheetError("Planblatt ist kein gültiges SVG.") from error
    if _local(root.tag) != "svg":
        raise SheetError("Planblatt ist kein SVG.")
    box = [float(v) for v in (root.get("viewBox") or "0 0 210 297").split()]
    if len(box) != 4 or box[2] <= 0 or box[3] <= 0:
        raise SheetError("Planblatt ohne gültige viewBox.")
    # PDF user space: millimetres from the lower-left corner, then scaled to pt.
    page = (210 / box[2], 0.0, 0.0, -297 / box[3], -box[0] * 210 / box[2], 297 + box[1] * 297 / box[3])
    ops: list[str] = ["1 J 1 j"]
    count = 0

    def stroke_fill(attrs, transform):
        fill, stroke = _on_paper(attrs["fill"], attrs["opacity"]), _on_paper(attrs["stroke"], attrs["opacity"])
        width = attrs["stroke-width"] * math.sqrt(abs(transform[0] * transform[3] - transform[1] * transform[2]))
        dash = attrs["stroke-dasharray"]
        parts = []
        if fill not in (None, "none"):
            parts.append(f"{_rgb(fill)} rg")
        if stroke not in (None, "none"):
            parts.append(f"{_rgb(stroke)} RG {max(width, 0.02) * PT_MM:.4f} w")
            scale = math.sqrt(abs(transform[0] * transform[3] - transform[1] * transform[2])) * PT_MM
            parts.append(f"[{' '.join(f'{v * scale:.3f}' for v in dash)}] 0 d" if dash else "[] 0 d")
        has_fill, has_stroke = fill not in (None, "none"), stroke not in (None, "none")
        operator = ("B*" if attrs["fill-rule"] == "evenodd" else "B") if has_fill and has_stroke else ("f*" if attrs["fill-rule"] == "evenodd" else "f") if has_fill else "S" if has_stroke else "n"
        return parts, operator

    def point(transform, x, y):
        a, b, c, d, e, f = transform
        return (a * x + c * y + e) * PT_MM, (b * x + d * y + f) * PT_MM

    def emit_path(attrs, transform, segments):
        parts, operator = stroke_fill(attrs, transform)
        if operator == "n":
            return
        body = []
        for segment in segments:
            if segment[0] == "M":
                body.append("%.3f %.3f m" % point(transform, segment[1], segment[2]))
            elif segment[0] == "L":
                body.append("%.3f %.3f l" % point(transform, segment[1], segment[2]))
            elif segment[0] == "C":
                p1, p2, p3 = point(transform, *segment[1:3]), point(transform, *segment[3:5]), point(transform, *segment[5:7])
                body.append("%.3f %.3f %.3f %.3f %.3f %.3f c" % (*p1, *p2, *p3))
            else:
                body.append("h")
        ops.append("q " + " ".join(parts) + " " + " ".join(body) + " " + operator + " Q")

    def walk(element, inherited, transform):
        nonlocal count
        count += 1
        if count > MAX_ELEMENTS:
            raise SheetError("Planblatt enthält zu viele Elemente.")
        tag = _local(element.tag)
        if tag in ("script", "foreignObject", "image", "use", "style", "a"):
            raise SheetError(f"Element {tag} ist im Planblatt nicht zulässig.")
        if tag in ("title", "desc", "defs", "metadata"):
            return
        raw = _style_attrs(element)
        attrs = dict(inherited)
        if "color" in raw:
            attrs["color"] = _colour(raw["color"], inherited["color"]) or inherited["color"]
        for key in ("fill", "stroke"):
            if key in raw:
                value = _colour(raw[key], attrs["color"])
                if value is not None:
                    attrs[key] = value
        if "stroke-width" in raw:
            attrs["stroke-width"] = _num(raw["stroke-width"], attrs["stroke-width"])
        if "stroke-dasharray" in raw:
            value = raw["stroke-dasharray"].strip()
            attrs["stroke-dasharray"] = [] if value in ("", "none") else [_num(v) for v in re.split(r"[\s,]+", value) if v]
        for key in ("font-size",):
            if key in raw:
                attrs[key] = _num(raw[key], attrs[key])
        for key in ("text-anchor", "font-weight", "fill-rule"):
            if key in raw:
                attrs[key] = raw[key].strip()
        if raw.get("display") == "none" or raw.get("visibility") == "hidden":
            return
        if "opacity" in raw:
            # No transparency groups: blend towards the white paper instead.
            attrs["opacity"] = attrs["opacity"] * max(0.0, min(1.0, _num(raw["opacity"], 1.0)))
        local = _multiply(transform, _transform(element.get("transform"))) if tag != "svg" or element is not root else transform
        if tag in ("svg", "g"):
            if tag == "svg" and element is not root:
                local = _multiply(local, (1, 0, 0, 1, _num(element.get("x")), _num(element.get("y"))))
            for child in element:
                walk(child, attrs, local)
        elif tag == "rect":
            x, y, w, h = (_num(element.get(k)) for k in ("x", "y", "width", "height"))
            if w > 0 and h > 0:
                emit_path(attrs, local, [("M", x, y), ("L", x + w, y), ("L", x + w, y + h), ("L", x, y + h), ("Z",)])
        elif tag == "line":
            x1, y1, x2, y2 = (_num(element.get(k)) for k in ("x1", "y1", "x2", "y2"))
            emit_path({**attrs, "fill": "none"}, local, [("M", x1, y1), ("L", x2, y2)])
        elif tag in ("polyline", "polygon"):
            values = [float(v) for v in re.findall(r"-?[\d.]+(?:e-?\d+)?", element.get("points") or "")]
            pairs = list(zip(values[0::2], values[1::2]))
            if len(pairs) >= 2:
                segments = [("M", *pairs[0]), *[("L", *p) for p in pairs[1:]]]
                if tag == "polygon":
                    segments.append(("Z",))
                emit_path(attrs, local, segments)
        elif tag == "circle":
            cx, cy, r = (_num(element.get(k)) for k in ("cx", "cy", "r"))
            if r > 0:
                k = 0.5523 * r
                emit_path(attrs, local, [("M", cx + r, cy), ("C", cx + r, cy + k, cx + k, cy + r, cx, cy + r), ("C", cx - k, cy + r, cx - r, cy + k, cx - r, cy),
                                         ("C", cx - r, cy - k, cx - k, cy - r, cx, cy - r), ("C", cx + k, cy - r, cx + r, cy - k, cx + r, cy), ("Z",)])
        elif tag == "path":
            segments = _path_commands(element.get("d") or "")
            if segments:
                emit_path(attrs, local, segments)
        elif tag == "text":
            text = "".join(element.itertext())
            fill = _on_paper(attrs["fill"], attrs["opacity"]) if attrs["fill"] not in (None, "none") else None
            if not text.strip() or fill is None:
                return
            size = attrs["font-size"]
            bold = attrs["font-weight"] in ("bold", "600", "650", "700", "800", "900")
            width = text_width_mm(" ".join(text.split()), size, bold)
            x, y = _num(element.get("x")), _num(element.get("y"))
            anchor = attrs["text-anchor"]
            x -= width if anchor == "end" else width / 2 if anchor == "middle" else 0
            a, b, c, d, e, f = local
            px, py = point(local, x, y)
            scale = math.hypot(a, b)
            rotation = (a / scale, b / scale, c / scale if scale else 0, d / scale if scale else 1)
            font = "/F2" if bold else "/F1"
            # Text matrix keeps glyphs upright even though SVG y points down.
            ops.append(f"q {_rgb(fill)} rg BT {font} {size * scale * PT_MM:.3f} Tf {rotation[0]:.4f} {rotation[1]:.4f} {-rotation[2]:.4f} {-rotation[3]:.4f} {px:.3f} {py:.3f} Tm <{_encode_text(text)}> Tj ET Q")

    base = {"fill": "#000000", "stroke": "none", "stroke-width": 1.0, "stroke-dasharray": [], "color": "#000000", "font-size": 16.0,
            "text-anchor": "start", "font-weight": "normal", "fill-rule": "nonzero", "opacity": 1.0}
    walk(root, base, page)
    return ops
