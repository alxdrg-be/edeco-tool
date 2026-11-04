"""Own, vector-only rack drawings in real millimetres.

All three formats use the same scene. The cabinet envelope and the 482.6 mm
mounting face are intentionally different. Y is measured downwards for layout;
the DXF adapter converts it to ordinary Cartesian CAD coordinates.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from html import escape
from io import BytesIO, StringIO
import math
import re

from .model import ExportRequest, HE_MM, PANEL_WIDTH_MM

INK = "#222222"
ACCENT = "#007f96"
MUTED = "#7b8b91"
WARN = "#a76100"
STATUS_LABELS = {"planned": "Geplant", "existing": "Bestand", "removed": "Entfallen"}
WORK_LABELS = {"open": "Offen", "ordered": "Bestellt", "delivered": "Geliefert", "done": "Erledigt", "not-required": "Nicht erforderlich"}
SIDE_LABELS = {"front": "Vorderseite", "rear": "Rückseite", "zero-left": "0-HE-Zone links", "zero-right": "0-HE-Zone rechts", "zero-rear": "0-HE-Zone rückwärtig"}


def drawing_fill(record, default: str) -> str:
    """Drawing colours are source/project data, independent of the UI theme."""
    value = (record.metadata or {}).get("drawingFill")
    return value.lower() if isinstance(value, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", value) else default


def drawing_ink(fill: str) -> str:
    """Same source-fill contrast calculation as the rack canvas palette."""
    rgb = [int(fill[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4 for channel in rgb]
    luminance = sum(channel * weight for channel, weight in zip(linear, (.2126, .7152, .0722), strict=True))
    return INK if luminance >= .213 else "#ffffff"


def plain(value: str) -> str:
    """One-line captions never become XML, PDF operators, CAD fields or links."""
    return " ".join(value.split())


def short(value: str, width: float, height: float) -> str:
    value = plain(value)
    # One full em per glyph is deliberately conservative (including CJK and
    # wide W/M captions), rather than assuming every imported name is narrow.
    maximum = max(1, int(width / (height * 1.05)))
    return value if len(value) <= maximum else value[: max(0, maximum - 1)] + "…"


@dataclass
class Shape:
    kind: str
    x: float
    y: float
    width: float = 0
    height: float = 0
    text: str = ""
    color: str = INK
    fill: str = "none"
    layer: str = "RACK"
    role: str = ""
    dashed: bool = False


@dataclass
class Scene:
    width: float
    height: float
    title: str
    rack_id: str
    view: str
    shapes: list[Shape] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def rect(self, x, y, width, height, **kwargs):
        self.shapes.append(Shape("rect", x, y, width, height, **kwargs))

    def line(self, x, y, x2, y2, **kwargs):
        self.shapes.append(Shape("line", x, y, x2 - x, y2 - y, **kwargs))

    def caption(self, x, y, text, size=25, width=450, **kwargs):
        self.shapes.append(Shape("text", x, y, width, size, short(text, width, size), **kwargs))


def _rack_warnings(rack, active, profiles):
    """Geometry and known nameplate totals only; no installation approval.

    Missing data remain explicit. A front/rear clearance cannot be inferred
    from the cabinet's outer dimension or from a neighbouring catalogue item.
    """
    warnings = []
    devices = [(placement, profiles[placement.profileId]) for placement in active if profiles[placement.profileId].kind != "reserve"]
    if rack.usableDepthMm is not None and rack.usableDepthMm > rack.depthMm:
        warnings.append("Nutzbare Einbautiefe ist grösser als die Gehäusetiefe; Herstellerangaben prüfen.")
    if rack.usableDepthMm is not None:
        known_depth = rack.usableDepthMm + (rack.frontDoorClearanceMm or 0) + (rack.rearDoorClearanceMm or 0)
        if known_depth > rack.depthMm:
            warnings.append(f"Bereits bekannte Innen-/Türabstände {known_depth:g} mm überschreiten die Gehäusetiefe {rack.depthMm:g} mm.")
    for placement, profile in devices:
        name = placement.label or profile.name
        if placement.side.startswith("zero-"):
            if placement.zeroInwardOffsetMm is None or profile.depthMm is None:
                warnings.append(f"{name}: Tiefenlage/Abmessung des 0-HE-Zubehörs ist offen.")
            elif rack.usableDepthMm is not None:
                if placement.zeroInwardOffsetMm + profile.depthMm + (profile.inwardCableMm or 0) > rack.usableDepthMm:
                    warnings.append(f"{name}: 0-HE-Zubehör überschreitet die nutzbare Einbautiefe.")
                if profile.inwardCableMm is None:
                    warnings.append(f"{name}: Innerer Kabelraum des 0-HE-Zubehörs ist offen.")
                if placement.side == "zero-rear" and (profile.outwardCableMm is None or rack.rearDoorClearanceMm is None):
                    warnings.append(f"{name}: Rückwärtiger Tür-/Kabelraum des 0-HE-Zubehörs ist offen.")
                elif placement.side == "zero-rear" and profile.outwardCableMm > rack.rearDoorClearanceMm:
                    warnings.append(f"{name}: Rückwärtiger Kabelraum überschreitet den Türfreiraum.")
            warnings.append(f"{name}: Seitliche Befestigung, freie Breite und Kabelführung separat prüfen.")
            continue
        if profile.depthMm is None or profile.inwardCableMm is None:
            warnings.append(f"{name}: Geräte- oder innerer Kabelraum ist offen.")
        elif rack.usableDepthMm is not None and profile.depthMm + profile.inwardCableMm > rack.usableDepthMm:
            warnings.append(f"{name}: {profile.depthMm + profile.inwardCableMm:g} mm Gerät/Kabelraum überschreiten {rack.usableDepthMm:g} mm Einbautiefe.")
        clearance = rack.frontDoorClearanceMm if placement.side == "front" else rack.rearDoorClearanceMm
        if clearance is None or profile.outwardCableMm is None:
            warnings.append(f"{name}: Tür-/Patchkabelfreiraum ist offen.")
        elif profile.outwardCableMm > clearance:
            warnings.append(f"{name}: {profile.outwardCableMm:g} mm Kabelraum benötigen mehr als {clearance:g} mm Türfreiraum.")
    pair_findings = 0

    def pair_warning(message):
        nonlocal pair_findings
        pair_findings += 1
        if pair_findings <= 100:
            warnings.append(message)

    def overlaps(start, size, other_start, other_size):
        return size > 0 and other_size > 0 and start < other_start + other_size and other_start < start + size

    for index, (left, left_profile) in enumerate(devices):
        for right, right_profile in devices[index + 1:]:
            left_zero = left.side.startswith("zero-")
            right_zero = right.side.startswith("zero-")
            if left_zero or right_zero:
                if left_zero and right_zero:
                    if left.side != right.side or any(value is None for value in [left.zeroStartMm, left.zeroHeightMm, left.zeroInwardOffsetMm, left_profile.depthMm, right.zeroStartMm, right.zeroHeightMm, right.zeroInwardOffsetMm, right_profile.depthMm]):
                        continue
                    if overlaps(left.zeroStartMm, left.zeroHeightMm, right.zeroStartMm, right.zeroHeightMm) and overlaps(left.zeroInwardOffsetMm, left_profile.depthMm + (left_profile.inwardCableMm or 0), right.zeroInwardOffsetMm, right_profile.depthMm + (right_profile.inwardCableMm or 0)):
                        pair_warning(f"{left.label or left_profile.name} / {right.label or right_profile.name}: 0-HE-Höhen-/Tiefenkollision in derselben Zone.")
                    continue
                zero, zp, mounted, mp = (left, left_profile, right, right_profile) if left_zero else (right, right_profile, left, left_profile)
                if zero.side != "zero-rear" or any(value is None for value in [zero.zeroStartMm, zero.zeroHeightMm, zero.zeroInwardOffsetMm, zp.depthMm, rack.usableDepthMm, mp.depthMm, mp.inwardCableMm]):
                    continue
                inward = mp.depthMm + mp.inwardCableMm
                mount_start = 0 if mounted.side == "front" else rack.usableDepthMm - inward
                if overlaps(zero.zeroStartMm, zero.zeroHeightMm, (mounted.startUnit - 1) * HE_MM, mp.units * HE_MM) and overlaps(zero.zeroInwardOffsetMm, zp.depthMm + (zp.inwardCableMm or 0), mount_start, inward):
                    pair_warning(f"{zero.label or zp.name} / {mounted.label or mp.name}: 0-HE-Zubehör überschneidet den Geräte-/Kabelraum.")
                continue
            if right.side not in ("front", "rear") or right.side == left.side:
                continue
            overlaps = left.startUnit < right.startUnit + right_profile.units and right.startUnit < left.startUnit + left_profile.units
            if not overlaps:
                continue
            values = [left_profile.depthMm, left_profile.inwardCableMm, right_profile.depthMm, right_profile.inwardCableMm, rack.usableDepthMm]
            if all(value is not None for value in values) and sum(values[:4]) <= rack.usableDepthMm:
                continue
            names = f"{left.label or left_profile.name} / {right.label or right_profile.name}"
            if any(value is None for value in values):
                pair_warning(f"{names}: Front-/Rückseitenabstand ist ohne vollständige Tiefen-/Kabeldaten offen.")
            elif sum(values[:4]) > rack.usableDepthMm:
                pair_warning(f"{names}: Front-/Rückseiten-Tiefenkollision ({sum(values[:4]):g} > {rack.usableDepthMm:g} mm).")
    if pair_findings > 100:
        warnings.append(f"{pair_findings - 100} weitere Tiefen-Konfliktpaare; interaktiven Prüfbericht verwenden.")
    for field, limit, label, unit in [("weightKg", rack.weightLimitKg, "Gewicht", "kg"), ("powerW", rack.powerBudgetW, "Leistung", "W")]:
        known = sum(getattr(profile, field) for _, profile in devices if getattr(profile, field) is not None)
        missing = sum(getattr(profile, field) is None for _, profile in devices)
        if missing:
            warnings.append(f"{label}: {known:g} {unit} bekannt, {missing} Geräteangabe(n) offen; keine vollständige Bilanz.")
        if limit is None:
            warnings.append(f"{label}: Rack-Grenze/Budget ist offen.")
        elif known > limit:
            warnings.append(f"{label}: Bereits bekannte Summe {known:g} {unit} überschreitet {limit:g} {unit}.")
    for placement, profile in devices:
        if profile.kind != "shelf":
            continue
        supported = [profiles[item.profileId] for item in active if item.supportedById == placement.id]
        if not supported:
            continue
        name = placement.label or profile.name
        if profile.loadLimitKg is None or any(item.weightKg is None for item in supported):
            warnings.append(f"{name}: Fachbodentraglast oder Gerätegewicht ist offen.")
        elif sum(item.weightKg for item in supported) > profile.loadLimitKg:
            warnings.append(f"{name}: Aufgelegte Geräte überschreiten die dokumentierte Fachbodentraglast.")
    warnings.append("USV-Autonomie, Stromkreis/Absicherung, Wärmeabfuhr, Erdungsanschluss und Normen separat nachweisen.")
    return warnings


def scenes(request: ExportRequest) -> list[Scene]:
    profiles = {profile.id: profile for profile in request.document.profiles}
    result = []
    for rack in request.selected_racks():
        active = [placement for placement in request.document.placements if placement.rackId == rack.id and placement.status != "removed"]
        for view in request.views:
            # Large enough even when a physically implausible cabinet is narrower
            # than the 19-inch frame: show the conflict instead of scaling it away.
            diagram_width = max(rack.widthMm, PANEL_WIDTH_MM + 80)
            rail_height = rack.units * HE_MM
            diagram_height = max(rack.heightMm, rail_height + 80)
            left, top = 100.0, 70.0
            rail_x = left + (diagram_width - PANEL_WIDTH_MM) / 2
            rail_top = top + max(0, (rack.heightMm - rail_height) / 2)
            rail_bottom = rail_top + rail_height
            scene = Scene(diagram_width + 700, diagram_height + 185, rack.label, rack.id, view)
            scene.warnings.extend(_rack_warnings(rack, active, profiles))
            cabinet_fill = drawing_fill(rack, "#cccccc")
            cabinet_ink = drawing_ink(cabinet_fill)
            scene.rect(left, top, rack.widthMm, rack.heightMm, color=cabinet_ink, fill=cabinet_fill, layer="CABINET", role="cabinet")
            scene.rect(rail_x, rail_top, PANEL_WIDTH_MM, rail_height, fill="#ffffff", layer="MOUNTING_FIELD", role="mounting-field")
            for x in (rail_x, rail_x + PANEL_WIDTH_MM):
                scene.line(x, rail_top, x, rail_bottom, layer="MOUNTING_19IN")
            scene.caption(left, 35, f"{rack.label} · {'Vorderansicht' if view == 'front' else 'Rückansicht'}", size=30, width=diagram_width, color=ACCENT, layer="LABELS")
            for unit in range(1, rack.units + 1):
                y = rail_bottom - unit * HE_MM
                scene.line(rail_x - 10, y, rail_x + PANEL_WIDTH_MM + 10, y, color="#c7d0d3", layer="HE_GRID")
                scene.caption(rail_x - 75, y + HE_MM * .68, str(unit), size=25, width=60, color=cabinet_ink, layer="HE_LABELS")
            scene.caption(left, top + diagram_height + 45, f"Gehäuse {rack.widthMm:g} × {rack.heightMm:g} × {rack.depthMm:g} mm · {rack.units} HE", size=25, width=diagram_width + 450, layer="LABELS")
            scene.caption(left, top + diagram_height + 80, "Montagebreite 482.6 mm · 1 HE = 44.45 mm · HE 1 unten", size=23, width=diagram_width + 450, layer="LABELS")
            if rack.widthMm < PANEL_WIDTH_MM or rack.heightMm < rail_height:
                scene.warnings.append("Gehäuse und HE-/19-Zoll-Raster passen geometrisch nicht zusammen.")
            if rack.usableDepthMm is None:
                scene.warnings.append("Nutzbare Einbautiefe ist offen; Gehäusetiefe ersetzt sie nicht.")
            occupied = {}
            for placement in active:
                profile = profiles[placement.profileId]
                face_fill = drawing_fill(profile, "#ffffff")
                face_ink = drawing_ink(face_fill)
                if placement.side.startswith("zero-"):
                    # Left/right are as viewed from the front; the rear view is
                    # mirrored. Unknown positions remain in the open list.
                    if profile.units != 0:
                        scene.warnings.append(f"{placement.label or profile.name}: HE-Profil ist einer 0-HE-Zone zugeordnet; Montageart prüfen.")
                    if placement.zeroStartMm is None or placement.zeroHeightMm is None:
                        scene.warnings.append(f"{placement.label or profile.name}: 0-HE-Position/Höhe ist offen; nicht als platziert gezeichnet.")
                        continue
                    if placement.side == "zero-rear" and view != "rear":
                        continue
                    on_left = placement.side == "zero-left"
                    if view == "rear":
                        on_left = not on_left
                    x = left + 15 if on_left else left + rack.widthMm - 45
                    if placement.side == "zero-rear":
                        x = left + rack.widthMm - 85
                    y = rail_bottom - placement.zeroStartMm - placement.zeroHeightMm
                    scene.rect(x, y, 25, placement.zeroHeightMm, color=face_ink, fill=face_fill, layer="ZERO_HE", role="zero-he")
                    if y < rail_top or y + placement.zeroHeightMm > rail_bottom:
                        scene.warnings.append(f"{placement.label or profile.name}: 0-HE-Zubehör liegt ausserhalb des Montagefelds.")
                    continue
                if placement.side != view:
                    continue
                if profile.units == 0:
                    scene.warnings.append(f"{placement.label or profile.name}: 0-HE-Zubehör liegt im HE-Raster; Montageart prüfen.")
                    continue
                first, last = placement.startUnit, placement.startUnit + profile.units - 1
                y = rail_bottom - last * HE_MM
                height = profile.units * HE_MM
                collision = any(unit in occupied for unit in range(first, last + 1))
                if collision:
                    scene.warnings.append(f"{placement.label or profile.name}: überlagerter HE-Bereich; Belegung prüfen.")
                for unit in range(first, last + 1):
                    occupied[unit] = placement.id
                if last > rack.units:
                    scene.warnings.append(f"{placement.label or profile.name}: reicht bis HE {last}, Rack hat {rack.units} HE.")
                    # Preserve the actual position and enlarge the scene rather
                    # than clipping, moving or hiding the out-of-range object.
                    if y < 0:
                        scene.warnings.append("Bauteil oberhalb des Zeichenbereichs; HE-Lage zusätzlich in der Stückliste prüfen.")
                is_reserve = profile.kind == "reserve"
                color = "#d52940" if collision or last > rack.units else face_ink
                scene.rect(rail_x, y, PANEL_WIDTH_MM, height, color=color, fill=face_fill, dashed=is_reserve, layer="RESERVE" if is_reserve else "DEVICES", role="reserve" if is_reserve else "device")
                label = placement.label or profile.name
                scene.line(rail_x + PANEL_WIDTH_MM + 5, y + height / 2, left + diagram_width + 25, y + height / 2, color=MUTED, layer="LEADERS")
                scene.caption(left + diagram_width + 35, y + height / 2 + 8, label, size=25, width=435, color=INK, layer="DEVICE_LABELS")
                if profile.portCount and not is_reserve:
                    columns = min(24, profile.portCount)
                    rows = math.ceil(profile.portCount / columns)
                    gap = min(3.0, (height - 4) / (rows * 3))
                    port_width = (PANEL_WIDTH_MM - 40) / columns - gap
                    port_height = min(17.0, (height - 4) / rows - gap)
                    for port_number in range(1, profile.portCount + 1):
                        row, column = divmod(port_number - 1, columns)
                        px = rail_x + 20 + column * (port_width + gap)
                        py = y + (height - rows * (port_height + gap)) / 2 + row * (port_height + gap)
                        scene.rect(px, py, port_width, port_height, color=face_ink, layer=f"PORTS_{profile.medium}", role="port")
                elif profile.kind not in ("reserve", "blank"):
                    scene.caption(rail_x + 20, y + height / 2 + 8, profile.name, size=min(25, height * .5), width=PANEL_WIDTH_MM - 40, color=face_ink, layer="DEVICE_FACE")
                if not profile.verified:
                    scene.warnings.append(f"{label}: Geräteprofil/Quelle ist nicht bestätigt.")
            # Retain all geometry for invalid HE ranges. This is a visible
            # planning error, not a reason to quietly crop a PDF/SVG export.
            minimum_y = min([0.0, *[shape.y for shape in scene.shapes]])
            if minimum_y < 0:
                shift = -minimum_y + 30
                for shape in scene.shapes:
                    shape.y += shift
                scene.height += shift
            if len(scene.warnings) > 200:
                scene.warnings = [*scene.warnings[:200], f"{len(scene.warnings) - 200} weitere Hinweise; vollständigen interaktiven Prüfbericht verwenden."]
            result.append(scene)
    return result


def svg_bytes(request: ExportRequest) -> bytes:
    drawings = scenes(request)
    width = max(scene.width for scene in drawings)
    # Each warning has its own line and is never laid on top of equipment.
    heights = [scene.height + 75 + 30 * len(set(scene.warnings)) for scene in drawings]
    height = sum(heights) + 100
    output = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width:g}mm" height="{height:g}mm" viewBox="0 0 {width:g} {height:g}">', '<title>Rack-Dispo · Vorplanung</title>', '<desc>Eigene Vektorzeichnung in Millimetern. Keine Ausführungs- oder Normfreigabe.</desc>', f'<rect width="{width:g}" height="{height:g}" fill="white"/>']
    offset = 40.0
    for scene, scene_height in zip(drawings, heights, strict=True):
        output.append(f'<g transform="translate(0 {offset:g})" data-rack-id="{escape(scene.rack_id, quote=True)}" data-view="{scene.view}">')
        for shape in scene.shapes:
            attrs = f'stroke="{shape.color}" stroke-width="1.6" fill="{shape.fill}" data-role="{shape.role}"'
            if shape.dashed:
                attrs += ' stroke-dasharray="10 7"'
            if shape.kind == "rect":
                output.append(f'<rect x="{shape.x:g}" y="{shape.y:g}" width="{shape.width:g}" height="{shape.height:g}" {attrs}/>')
            elif shape.kind == "line":
                output.append(f'<line x1="{shape.x:g}" y1="{shape.y:g}" x2="{shape.x + shape.width:g}" y2="{shape.y + shape.height:g}" {attrs}/>')
            else:
                output.append(f'<text x="{shape.x:g}" y="{shape.y:g}" fill="{shape.color}" font-size="{shape.height:g}" font-family="sans-serif">{escape(shape.text)}</text>')
        output.append(f'<text x="100" y="{scene.height + 20:g}" fill="{WARN}" font-size="25" font-family="sans-serif">Vorplanung · Quellen, Kollisionen und offene Nachweise prüfen.</text>')
        for index, warning in enumerate(dict.fromkeys(scene.warnings)):
            output.append(f'<text x="100" y="{scene.height + 55 + index * 30:g}" fill="{WARN}" font-size="21" font-family="sans-serif">{escape(short(warning, width - 150, 21))}</text>')
        output.append("</g>")
        offset += scene_height
    output.append("</svg>")
    return "\n".join(output).encode("utf-8")


def dxf_bytes(request: ExportRequest) -> bytes:
    import ezdxf
    from ezdxf import bbox

    cad = ezdxf.new("R2013")
    cad.units = 4  # millimetres, never the paper drawing scale
    cad.header["$INSUNITS"] = 4
    cad.header["$MEASUREMENT"] = 1
    model = cad.modelspace()
    offset = 0.0
    for scene in scenes(request):
        for shape in scene.shapes:
            if shape.layer not in cad.layers:
                cad.layers.new(shape.layer, dxfattribs={"color": 7})
            attrs = {"layer": shape.layer, "true_color": int(shape.color[1:], 16), "lineweight": 18}
            x, y = shape.x + offset, -shape.y
            if shape.kind == "rect":
                points = [(x, y), (x + shape.width, y), (x + shape.width, y - shape.height), (x, y - shape.height)]
                if shape.fill != "none":
                    hatch = model.add_hatch(dxfattribs={"layer": shape.layer, "true_color": int(shape.fill[1:], 16)})
                    hatch.paths.add_polyline_path(points, is_closed=True)
                model.add_lwpolyline(points, close=True, dxfattribs=attrs)
            elif shape.kind == "line":
                model.add_line((x, y), (x + shape.width, y - shape.height), dxfattribs=attrs)
            else:
                # TEXT content is escaped by ezdxf and has no external entity,
                # XREF, image, hyperlink, arbitrary style or input DXF payload.
                model.add_text(shape.text, dxfattribs={**attrs, "insert": (x, y), "height": shape.height, "style": "Standard"})
        model.add_text("VORPLANUNG - CAD 1:1 IN MM - KEINE AUSFUEHRUNGSFREIGABE", dxfattribs={"insert": (offset + 100, -scene.height - 35), "height": 23, "layer": "LABELS"})
        row = 0
        for warning in dict.fromkeys(scene.warnings):
            for line in _wrap(warning, max(1, int((scene.width - 150) / (23 * 1.05)))):
                model.add_text(line, dxfattribs={"insert": (offset + 100, -scene.height - 80 - row * 32), "height": 23, "layer": "LABELS"})
                row += 1
        offset += scene.width + 150
    extents = bbox.extents(model, fast=True)
    if extents.has_data:
        # ezdxf refreshes header extents from the model layout on write.
        model.dxf.extmin = extents.extmin
        model.dxf.extmax = extents.extmax
        cad.header["$EXTMIN"] = extents.extmin
        cad.header["$EXTMAX"] = extents.extmax
    stream = StringIO()
    cad.write(stream)
    return stream.getvalue().encode("utf-8")


PT_MM = 72 / 25.4


def _color(value: str) -> str:
    return " ".join(f"{int(value[index:index + 2], 16) / 255:.4f}" for index in (1, 3, 5))


def _pdf_text(ops, x, y, text, size=9, color=INK):
    # A hexadecimal string cannot break out into PDF drawing operators.
    encoded = plain(text).encode("cp1252", errors="replace").hex()
    ops.append(f"{_color(color)} rg BT /F1 {size:g} Tf 1 0 0 1 {x * PT_MM:g} {y * PT_MM:g} Tm <{encoded}> Tj ET")


def _paper_page(writer, ops):
    from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

    page = writer.add_blank_page(width=210 * PT_MM, height=297 * PT_MM)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica"), NameObject("/Encoding"): NameObject("/WinAnsiEncoding")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    stream = DecodedStreamObject()
    stream.set_data("\n".join(ops).encode("ascii"))
    page[NameObject("/Contents")] = writer._add_object(stream)


def _wrap(text, limit=60):
    # Hard-wrap a single long token too, so imported article strings cannot run
    # off the paper. No caption silently disappears outside a viewport.
    text = plain(text)
    result = []
    while len(text) > limit:
        end = text.rfind(" ", 0, limit + 1)
        end = end if end > limit // 2 else limit
        result.append(text[:end])
        text = text[end:].lstrip()
    return [*result, text] if text else result or [""]


def pdf_bytes(request: ExportRequest) -> bytes:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_metadata({"/Title": request.document.name, "/Author": request.document.author, "/Subject": "Rack-Dispo · Vorplanung · keine Ausführungsfreigabe"})
    for scene in scenes(request):
        ops = ["1 J 1 j"]
        denominator = next((scale for scale in (5, 10, 20, 25, 50, 100, 200, 500, 1000) if scene.width / scale <= 190 and scene.height / scale <= 234), None)
        if denominator is None:
            denominator = math.ceil(max(scene.width / 190, scene.height / 234) / 100) * 100
        _pdf_text(ops, 10, 283, short(f"Rack-Dispo · {scene.title}", 185, 14 / PT_MM), 14)
        _pdf_text(ops, 10, 276, short(f"{request.document.projectNumber or 'Projekt offen'} · {request.document.room} · Index {request.document.index or '-'} · {request.document.date}", 190, 8 / PT_MM), 8)
        _pdf_text(ops, 10, 269, f"{'Vorderansicht' if scene.view == 'front' else 'Rückansicht'} · Massstab 1:{denominator} bei 100 % Druck · A4", 8, ACCENT)
        x_offset, y_top = 10.0, 259.0
        for shape in scene.shapes:
            x = x_offset + shape.x / denominator
            y = y_top - shape.y / denominator
            ops.append(f"{_color(shape.color)} RG .5 w")
            if shape.kind == "rect":
                ops.append("[3 2] 0 d" if shape.dashed else "[] 0 d")
                if shape.fill != "none":
                    ops.append(f"{_color(shape.fill)} rg")
                ops.append(f"{x * PT_MM:g} {(y - shape.height / denominator) * PT_MM:g} {shape.width / denominator * PT_MM:g} {shape.height / denominator * PT_MM:g} re {'B' if shape.fill != 'none' else 'S'}")
            elif shape.kind == "line":
                ops.append(f"[] 0 d {x * PT_MM:g} {y * PT_MM:g} m {(x + shape.width / denominator) * PT_MM:g} {(y - shape.height / denominator) * PT_MM:g} l S")
            else:
                size = max(6, shape.height / denominator * PT_MM)
                text = short(shape.text, shape.width / denominator, size / PT_MM)
                _pdf_text(ops, x, y, text, size, shape.color)
        _pdf_text(ops, 10, 24, "Vorplanung · Geräte- und Quellenangaben prüfen. Keine Ausführungs- oder Normfreigabe.", 8, WARN)
        _pdf_text(ops, 10, 18, "Offene Werte sind unbekannt. Gehäusetiefe ist keine bestätigte Einbautiefe.", 7)
        warning_count = len(set(scene.warnings))
        _pdf_text(ops, 10, 12, f"{warning_count} Hinweis(e) zu dieser Ansicht. Vollständige Hinweise und Geräte im Anhang.", 7)
        _paper_page(writer, ops)
        # Full labels and all open findings remain readable in A4, independently
        # of the drawing scale and a very dense rack. This also avoids clipped
        # multi-line captions inside one-HE faces.
        profiles = {profile.id: profile for profile in request.document.profiles}
        lines = [*_wrap(f"{scene.title} · {'Vorderansicht' if scene.view == 'front' else 'Rückansicht'} · Geräte und Hinweise"), ""]
        rack = next(rack for rack in request.document.racks if rack.id == scene.rack_id)
        if rack.notes.strip():
            lines.extend(_wrap(f"Rack-Notiz: {rack.notes}"))
            lines.append("")
        for placement in request.document.placements:
            if placement.rackId != scene.rack_id or placement.status == "removed":
                continue
            profile = profiles[placement.profileId]
            if placement.side != scene.view and not placement.side.startswith("zero-"):
                continue
            if placement.side == "zero-rear" and scene.view != "rear":
                continue
            position = f"HE {placement.startUnit}–{placement.startUnit + profile.units - 1}" if profile.units else f"0 HE · {SIDE_LABELS[placement.side]} · Position {'offen' if placement.zeroStartMm is None else str(placement.zeroStartMm) + ' mm'}"
            lines.extend(_wrap(f"{position} · {placement.label or profile.name} · {profile.portCount} Ports · {STATUS_LABELS[placement.status]}"))
            lines.extend(_wrap(f"  Lieferung: {WORK_LABELS[placement.delivery]} · Montage: {WORK_LABELS[placement.montage]}"))
            if placement.notes.strip():
                lines.extend(_wrap(f"  Geräte-Notiz: {placement.notes}"))
            if profile.manufacturer or profile.article:
                lines.extend(_wrap(f"  Hersteller/Artikel: {profile.manufacturer} {profile.article}"))
            lines.extend(_wrap(f"  Quelle: {profile.source or 'offen'} · {'bestätigt' if profile.verified else 'nicht bestätigt'}"))
        lines.extend(["", "Hinweise (keine automatische Freigabe):"])
        for warning in dict.fromkeys(scene.warnings):
            lines.extend(_wrap("• " + warning))
        if not scene.warnings:
            lines.append("Keine Zeichenhinweise. Tiefen-, Last-, Schutz- und Normnachweise separat prüfen.")
        for first in range(0, len(lines), 54):
            appendix = []
            _pdf_text(appendix, 10, 283, "Rack-Dispo · Geräte / Hinweise", 13)
            for index, line in enumerate(lines[first:first + 54]):
                _pdf_text(appendix, 10, 273 - index * 4.6, line, 9)
            _pdf_text(appendix, 10, 12, "Vorplanung · Originaldaten bleiben unverändert · keine Ausführungsfreigabe", 8, WARN)
            _paper_page(writer, appendix)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def _csv_value(value):
    # Excel must not evaluate imported room/target/article labels as formulas.
    value = "" if value is None else str(value)
    return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value


def csv_bytes(request: ExportRequest, ports: bool) -> bytes:
    stream = StringIO(newline="")
    writer = csv.writer(stream, delimiter=";", lineterminator="\r\n")
    racks = {rack.id: rack for rack in request.selected_racks()}
    profiles = {profile.id: profile for profile in request.document.profiles}
    active = {placement.id: placement for placement in request.document.placements if placement.rackId in racks and placement.status != "removed" and (placement.side in request.views or placement.side.startswith("zero-")) and (placement.side != "zero-rear" or "rear" in request.views)}
    if ports:
        writer.writerow(["Rack", "Gerät", "Medium", "Port", "Beschriftung", "Ziel", "Dose", "Raum", "Stand"])
        rows = {(row.placementId, row.number): row for row in request.document.ports}
        for placement in active.values():
            profile = profiles[placement.profileId]
            for number in range(1, profile.portCount + 1):
                row = rows.get((placement.id, number))
                writer.writerow(map(_csv_value, [racks[placement.rackId].label, placement.label or profile.name, profile.medium, number, row.label if row else "", row.target if row else "", row.outlet if row else "", row.room if row else "", row.state if row else "unknown"]))
    else:
        writer.writerow(["Rack", "Gerät", "Hersteller", "Artikel", "Anzahl", "HE", "Seite", "Stand", "Lieferung", "Montage", "Quelle", "Profil bestätigt", "Tiefe mm", "Gewicht kg", "Leistung W"])
        for placement in active.values():
            profile = profiles[placement.profileId]
            if profile.kind == "reserve":
                continue
            writer.writerow(map(_csv_value, [racks[placement.rackId].label, placement.label or profile.name, profile.manufacturer, profile.article, 1, profile.units, placement.side, placement.status, placement.delivery, placement.montage, profile.source, "ja" if profile.verified else "nein", profile.depthMm, profile.weightKg, profile.powerW]))
    return ("\ufeff" + stream.getvalue()).encode("utf-8")


def filename(request: ExportRequest) -> str:
    base = re.sub(r"[^a-zA-Z0-9_-]+", "-", request.document.name).strip("-")[:80] or "Rack-Dispo"
    suffix = {"ports-csv": "-Ports.csv", "bom-csv": "-Stueckliste.csv"}.get(request.format, "." + request.format)
    return base + suffix
