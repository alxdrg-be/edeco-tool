"""Own distribution-board vectors in physical millimetres.

One scene feeds preview, SVG, DXF and PDF. Profiles are data, never executable
SVG or drawing scripts. Front/internal are projections of the same placements;
the front hides the installation under real cover polygons and cut-outs.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field, replace
from functools import lru_cache
from html import escape
from io import BytesIO, StringIO
import json
import math
from pathlib import Path
import re
import xml.etree.ElementTree as ET

from ..rack_dispo.svgpdf import _path_commands

INK = '#25363c'
MUTED = '#687b82'
ACCENT = '#017c92'
WARN = '#986500'
VIEW_NAMES = {'front': 'Mit Abdeckungen', 'internal': 'Einbauansicht'}
PAPERS = {'A4': (210.0, 297.0), 'A3': (420.0, 297.0)}


@dataclass
class Shape:
    kind: str
    x: float = 0
    y: float = 0
    w: float = 0
    h: float = 0
    text: str = ''
    stroke: str = INK
    fill: str = 'none'
    layer: str = 'VERTEILER'
    role: str = ''
    target: str = ''
    dashed: bool = False
    polygons: list[list[tuple[float, float]]] = field(default_factory=list)


@dataclass
class Scene:
    width: float
    height: float
    shapes: list[Shape]
    origin_x: float = 0
    origin_y: float = 0
    min_x: float = 0
    min_y: float = 0
    hits: list[dict] = field(default_factory=list)


def _data(document):
    if not hasattr(document, 'model_dump'):
        from .models import DistributionDocument
        document = DistributionDocument.model_validate(document)
    return document.model_dump(mode='json')


def _plain(value) -> str:
    return ' '.join(str(value or '').split())


def _number(value, unit='') -> str:
    return 'offen' if value is None else f'{value:g}{unit}'


@lru_cache(maxsize=1)
def _drawing_font():
    from ezdxf.fonts import fonts
    return fonts.make_font('Arial.ttf', 1.0)


def _text_width(text, size):
    # DXF TEXT heights are cap heights, not browser em sizes. Measuring with
    # the actual CAD font keeps PDF media boxes and title columns stable.
    return _drawing_font().text_width(text) * size


@lru_cache(maxsize=1)
def _em_factor():
    font = _drawing_font()
    cache = getattr(font, 'glyph_cache', None)
    if cache is not None and hasattr(cache, 'font') and hasattr(cache, 'font_measurements'):
        return cache.font['head'].unitsPerEm / cache.font_measurements.cap_height
    return 1.4


def _fit_length(text, width, size):
    low, high = 0, len(text)
    while low < high:
        middle = (low + high + 1) // 2
        if _text_width(text[:middle], size) * 1.025 <= width:
            low = middle
        else:
            high = middle - 1
    return low


def _fit(text: str, width: float, size: float) -> str:
    text = _plain(text)
    if _text_width(text, size) * 1.025 <= width:
        return text
    count = _fit_length(text, max(0, width - _text_width('…', size) * 1.025), size)
    return text[:count] + '…' if count else ''


def _wrap(text: str, width: float, size: float) -> list[str]:
    text = _plain(text)
    result = []
    while text:
        end = max(1, _fit_length(text, width, size))
        if end < len(text):
            split = text.rfind(' ', 0, end + 1)
            if split > end / 2:
                end = split
        result.append(text[:end])
        text = text[end:].lstrip()
    return result or ['']


def _subtract(rect, hole):
    x, y, w, h = rect
    a, b, c, d = hole
    left, top, right, bottom = max(x, a), max(y, b), min(x + w, a + c), min(y + h, b + d)
    if right <= left or bottom <= top:
        return [rect]
    out = [(x, y, w, top - y), (x, bottom, w, y + h - bottom),
           (x, top, left - x, bottom - top), (right, top, x + w - right, bottom - top)]
    return [part for part in out if part[2] > 1e-8 and part[3] > 1e-8]


def drawing_scene(document, view='front') -> Scene:
    if view not in VIEW_NAMES:
        raise ValueError('Unbekannte Verteileransicht.')
    doc = _data(document)
    cabinet = doc['cabinet']
    width, height = cabinet['width_mm'], cabinet['height_mm']
    ox, oy = 50 + (width - cabinet['inner_width_mm']) / 2, 50 + (height - cabinet['inner_height_mm']) / 2
    shapes = []

    def rect(x, y, w, h, fill='none', stroke=INK, layer='GEHAEUSE', role='', target='', dashed=False):
        shapes.append(Shape('rect', x, y, w, h, stroke=stroke, fill=fill, layer=layer, role=role, target=target, dashed=dashed))

    def line(x, y, w, h, stroke=MUTED, layer='MONTAGE', role='', target=''):
        shapes.append(Shape('line', x, y, w, h, stroke=stroke, layer=layer, role=role, target=target))

    def text(x, y, value, size=10, available=200, stroke=INK, role='label', target=''):
        shapes.append(Shape('text', x, y, available, size, text=_fit(value, available, size), stroke=stroke, layer='BESCHRIFTUNG', role=role, target=target))

    rect(50, 50, width, height, cabinet['color_outer'], role='cabinet')
    rect(ox, oy, cabinet['inner_width_mm'], cabinet['inner_height_mm'], cabinet['color_inner'], stroke=MUTED, role='installation-area')
    for part in cabinet['fields']:
        rect(ox + part['x_mm'], oy + part['y_mm'], part['width_mm'], part['height_mm'], stroke='#b5c0c4', layer='FELDER', role='field', target=part['id'], dashed=True)
    # Empty openings reveal a cavity and the real rear rail. Covers and their
    # explicit blanking pieces are painted later, never inferred from devices.
    if view == 'front':
        for cover in cabinet['covers']:
            if not cover['transparent']:
                for hole in cover['cutouts']:
                    rect(ox + hole['x_mm'], oy + hole['y_mm'], hole['width_mm'], hole['height_mm'],
                         fill='#6f7c81', stroke='#6f7c81', layer='OEFFNUNGEN', role='aperture-cavity', target=cover['id'])
    for rail in cabinet['rails']:
        rect(ox + rail['x_mm'], oy + rail['y_mm'] - 17.5, rail['length_mm'], 35,
             fill='#c3cbd0', stroke='#788c95', layer='SCHIENEN', role='rail' if view == 'internal' else 'front-rail', target=rail['id'])
        line(ox + rail['x_mm'], oy + rail['y_mm'] - 8, rail['length_mm'], 0, '#eef1f2')
        line(ox + rail['x_mm'], oy + rail['y_mm'] + 8, rail['length_mm'], 0, '#eef1f2')
    if view == 'internal':
        for zone in cabinet['reserved_zones']:
            rect(ox + zone['x_mm'], oy + zone['y_mm'], zone['width_mm'], zone['height_mm'], stroke=WARN,
                 layer='SPERRBEREICHE', role='reserved-zone', target=zone['id'], dashed=True)
            text(ox + zone['x_mm'] + 4, oy + zone['y_mm'] + 14, zone['name'], 9, max(1, zone['width_mm'] - 8), WARN)
    profiles = {profile['id']: profile for profile in doc['profiles']}
    hits = []
    # Positive z points backwards. Rear bodies must be painted first, and the
    # frontmost body's hit target must likewise be last. An import's array order
    # must not alter the visible mechanical arrangement.
    active_placements = sorted((placement for placement in cabinet['placements'] if placement['status'] != 'removed'),
                               key=lambda placement: (-placement['z_mm'], placement['id']))
    for placement in active_placements:
        profile = profiles[placement['profile_id']]
        w, h = profile['width_mm'], profile['height_mm']
        if placement['rotation'] in (90, 270):
            w, h = h, w
        x, y, kind = ox + placement['x_mm'], oy + placement['y_mm'], profile['kind']
        target = placement['id']
        hits.append({'id': target, 'x': x, 'y': y, 'width': w, 'height': h,
                     'x_mm': placement['x_mm'], 'y_mm': placement['y_mm'], 'label': placement['label'] or profile['name']})
        fill = '#bc783c' if kind == 'busbar' else '#edf0ee' if kind == 'terminal' else '#fcfcfa'
        terminal_function = profile['terminal_kind'].strip()
        documented_terminal = kind == 'terminal' and profile['geometry_status'] == 'documented' and bool(profile['source_ids'])
        pe_terminal = documented_terminal and re.match(r'^PE(?:\b|;)', terminal_function, re.I)
        n_terminal = documented_terminal and re.match(r'^N(?:\b|;)', terminal_function, re.I)
        if pe_terminal:
            fill = '#e5d95c'
        elif n_terminal:
            fill = '#8bc2dc'
        if kind == 'reserve':
            fill = '#f3f5f5'
        rect(x, y, w, h, fill=fill, layer='GERAETE', role='device-body', target=target, dashed=kind == 'reserve')

        def detail_rect(rx, ry, rw, rh, color, role):
            rect(rx, ry, rw, rh, fill=color, stroke='#66777e', layer='BEDIENUNG', role=role, target=target)

        # These are own, kind-specific technical silhouettes. Their details do
        # not claim the exact front moulding or terminal layout of an article.
        if kind == 'switch':
            cx, cy, radius = x + w / 2, y + h * .48, min(w * .22, h * .17)
            for n in range(24):
                a, b = n * math.tau / 24, (n + 1) * math.tau / 24
                ax, ay = cx + math.cos(a) * radius, cy + math.sin(a) * radius
                bx, by = cx + math.cos(b) * radius, cy + math.sin(b) * radius
                line(ax, ay, bx - ax, by - ay, '#4d5c63', 'BEDIENUNG', 'detail-switch-dial', target)
            # Broad neutral handle plus diagonal pointer remain recognisable
            # even when a preview shows a whole cabinet at reduced scale.
            detail_rect(cx - radius * .22, cy - radius * .75, radius * .44, radius * 1.5, '#34434a', 'detail-switch-handle')
            line(cx, cy, radius * .7, -radius * .7, '#182d36', 'BEDIENUNG', 'detail-switch-pointer', target)
            text(x + w * .12, y + h * .29, '0', min(6, w * .16), w * .2, role='detail-switch-mark', target=target)
            text(x + w * .78, y + h * .29, 'I', min(6, w * .16), w * .16, role='detail-switch-mark', target=target)
        elif kind == 'rcd':
            detail_rect(x + w * .12, y + h * .32, w * .22, h * .22, '#dce5e9', 'detail-rcd-test')
            text(x + w * .16, y + h * .48, 'T', min(11, w * .17), w * .16, role='detail-rcd-test-label', target=target)
            detail_rect(x + w * .51, y + h * .38, w * .32, h * .25, '#37464b', 'detail-rcd-toggle')
            detail_rect(x + w * .55, y + h * .42, w * .24, h * .045, '#9caeb6', 'detail-rcd-toggle-edge')
            text(x + w * .44, y + h * .3, 'RCD', min(7, w * .12), w * .5, role='detail-rcd-label', target=target)
        elif kind == 'mcb':
            detail_rect(x + w * .1, y + h * .33, w * .8, h * .36, '#dce2e4', 'detail-mcb-recess')
            detail_rect(x + w * .2, y + h * .42, w * .6, h * .23, '#34434a', 'detail-mcb-toggle')
            detail_rect(x + w * .24, y + h * .45, w * .52, h * .04, '#a8b6bd', 'detail-mcb-toggle-edge')
            text(x + w * .1, y + h * .3, 'LS', min(6, w * .3), w * .8, role='detail-mcb-label', target=target)
            for yy in (.09, .86):
                detail_rect(x + w * .25, y + h * yy, w * .5, h * .055, '#a6b3b8', 'detail-mcb-contact')
        elif kind == 'knx':
            detail_rect(x + w * .06, y + h * .23, w * .88, h * .43, '#f0f3f3', 'detail-knx-panel')
            text(x + w * .13, y + h * .43, 'KNX', min(11, w * .16), w * .76, role='detail-knx-label', target=target)
            # Neutral indicators are a silhouette, not an asserted channel count.
            for n in range(4):
                detail_rect(x + w * (.14 + n * .18), y + h * .54, w * .075, h * .055, '#61767f', 'detail-knx-indicator')
            for n in range(2):
                detail_rect(x + w * (.13 + n * .46), y + h * .8, w * .25, h * .08, '#82949a', 'detail-knx-connector')
        elif kind == 'terminal':
            if 'endhalter' in terminal_function.casefold():
                for yy in (.23, .42, .61, .8):
                    line(x + w * .15, y + h * yy, w * .7, 0, '#87999f', 'KLEMMEN', 'detail-terminal-endholder', target)
            else:
                for yy in (.28, .66):
                    detail_rect(x + w * .2, y + h * yy, w * .6, min(7, h * .13), '#66787f', 'detail-terminal-contact')
                    if 'schraub' in terminal_function.casefold():
                        line(x + w * .25, y + h * yy + min(3, h * .055), w * .5, 0, '#dce4e7', 'KLEMMEN', 'detail-terminal-screw', target)
            if pe_terminal:
                detail_rect(x + w * .08, y + h * .05, w * .22, h * .9, '#4b8b65', 'detail-terminal-pe')
        label = placement['label'] or profile['name']
        if w >= 12 and h >= 14:
            text(x + 2, y + min(13, h * .23), label, min(9, h * .17), max(1, w - 4), role='device-label', target=target)
    if view == 'front':
        # Positive z goes backwards. At the same plane the broad base panel is
        # painted before the smaller removable blanks; array order is irrelevant.
        for cover in sorted(cabinet['covers'], key=lambda item: (-item['z_mm'], -item['width_mm']*item['height_mm'], item['id'])):
            fill = cover['color']
            if cover['transparent']:
                # A transparent cover must not become an opaque white overlay.
                # Its outline indicates the panel without hiding the equipment.
                rect(ox + cover['x_mm'], oy + cover['y_mm'], cover['width_mm'], cover['height_mm'],
                     stroke='#7eacb8', layer='ABDECKUNGEN', role='transparent-cover', target=cover['id'], dashed=True)
                continue
            pieces = [(cover['x_mm'], cover['y_mm'], cover['width_mm'], cover['height_mm'])]
            for hole in cover['cutouts']:
                pieces = [piece for part in pieces for piece in _subtract(part, (hole['x_mm'], hole['y_mm'], hole['width_mm'], hole['height_mm']))]
                if len(pieces) > 4000:
                    raise ValueError('Zu viele überlagerte Abdeckungsausschnitte für die Zeichnung.')
            for x, y, w, h in pieces:
                rect(ox + x, oy + y, w, h, fill=fill, stroke=fill, layer='ABDECKUNGEN', role='cover-panel', target=cover['id'])
            rect(ox + cover['x_mm'], oy + cover['y_mm'], cover['width_mm'], cover['height_mm'],
                 stroke='#85979e', layer='ABDECKUNGEN', role='cover-outline', target=cover['id'])
            for hole in cover['cutouts']:
                rect(ox + hole['x_mm'], oy + hole['y_mm'], hole['width_mm'], hole['height_mm'],
                     stroke='#63777f', layer='ABDECKUNGEN', role='aperture-outline', target=cover['id'])
        # Captions belong on the front, not below the cover. Full BMKs and
        # device names remain in the appendix if a label strip is too short.
        for rail in cabinet['rails']:
            if any(not cover['transparent'] for cover in cabinet['covers']) and not any(hole['x_mm'] < rail['x_mm'] + rail['length_mm'] and
                       hole['x_mm'] + hole['width_mm'] > rail['x_mm'] and
                       hole['y_mm'] <= rail['y_mm'] <= hole['y_mm'] + hole['height_mm']
                       for cover in cabinet['covers'] for hole in cover['cutouts']):
                continue
            labels = [placement['label'] or profiles[placement['profile_id']]['name']
                      for placement in sorted(active_placements, key=lambda item: (item['x_mm'], item['y_mm'], item['z_mm'], item['id']))
                      if placement['rail_id'] == rail['id']]
            if labels:
                text(ox + rail['x_mm'], oy + max(16, rail['y_mm'] - 52),
                     f'{rail["name"]} · {", ".join(labels)}', 11, rail['length_mm'], role='front-row-label')
    # Real dimensions, without an assertion about any manufacturer or VNB approval.
    line(50, height + 75, width, 0, INK, 'BEMASSUNG')
    line(50, height + 65, 0, 20, INK, 'BEMASSUNG')
    line(width + 50, height + 65, 0, 20, INK, 'BEMASSUNG')
    text(50, height + 97, f'B {_number(width, " mm")} · H {_number(height, " mm")} · T {_number(cabinet["depth_mm"], " mm")}', 12, width, role='dimension-label')
    text(50, 30, f'{cabinet["name"]} · {VIEW_NAMES[view]}', 14, width, role='view-label')
    min_x = min([0, *[shape.x - 10 for shape in shapes]])
    min_y = min([0, *[shape.y - shape.h - 10 if shape.kind == 'text' else shape.y - 10 for shape in shapes]])
    max_x = max([width + 100, *[shape.x + shape.w + 10 for shape in shapes]])
    max_y = max([height + 120, *[shape.y + (0 if shape.kind == 'text' else shape.h) + 10 for shape in shapes]])
    if len(shapes) > 60000:
        raise ValueError('Zu viele Zeichenobjekte. Bitte die Disposition in kleinere Dokumente aufteilen.')
    return Scene(max_x - min_x, max_y - min_y, shapes, ox, oy, min_x, min_y, hits)


def _svg_shapes(shapes):
    out = []
    for shape in shapes:
        attrs = f'stroke="{shape.stroke}" stroke-width="0.5" fill="{shape.fill}" data-role="{escape(shape.role, quote=True)}"'
        if shape.target:
            attrs += f' data-body-placement-id="{escape(shape.target, quote=True)}"'
        if shape.dashed:
            attrs += ' stroke-dasharray="4 3"'
        if shape.kind == 'rect':
            out.append(f'<rect x="{shape.x:g}" y="{shape.y:g}" width="{shape.w:g}" height="{shape.h:g}" {attrs}/>')
        elif shape.kind == 'line':
            out.append(f'<line x1="{shape.x:g}" y1="{shape.y:g}" x2="{shape.x + shape.w:g}" y2="{shape.y + shape.h:g}" {attrs}/>')
        elif shape.kind == 'polygon':
            parts = ['M' + ' L'.join(f'{x:g} {y:g}' for x, y in polygon) + ' Z' for polygon in shape.polygons if polygon]
            out.append(f'<path d="{" ".join(parts)}" fill="{shape.fill}" stroke="none" fill-rule="evenodd" data-role="logo"/>')
        elif shape.kind == 'text':
            out.append(f'<text x="{shape.x:g}" y="{shape.y:g}" fill="{shape.stroke}" font-family="Arial,Helvetica,sans-serif" font-size="{shape.h * _em_factor():g}" data-role="{escape(shape.role, quote=True)}">{escape(shape.text)}</text>')
    return ''.join(out)


def preview_svg(document, view='front') -> str:
    scene = drawing_scene(document, view)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{scene.width:g}mm" height="{scene.height:g}mm" viewBox="{scene.min_x:g} {scene.min_y:g} {scene.width:g} {scene.height:g}" data-origin-x="{scene.origin_x:g}" data-origin-y="{scene.origin_y:g}" data-inner-x="{scene.origin_x:g}" data-inner-y="{scene.origin_y:g}" data-view="{view}">',
             f'<title>{escape(VIEW_NAMES[view])}</title>', '<desc>Masshaltige Planungszeichnung; offene Nachweise sind keine Normfreigabe.</desc>', _svg_shapes(scene.shapes)]
    for hit in scene.hits:
        parts.append(f'<g data-placement-id="{escape(hit["id"], quote=True)}" data-x-mm="{hit["x_mm"]:g}" data-y-mm="{hit["y_mm"]:g}" role="button" tabindex="0" aria-label="{escape(hit["label"], quote=True)}"><rect x="{hit["x"]:g}" y="{hit["y"]:g}" width="{hit["width"]:g}" height="{hit["height"]:g}" fill="transparent" stroke="none" pointer-events="all" data-role="placement-hitbox"/></g>')
    return ''.join(parts) + '</svg>'


@lru_cache(maxsize=1)
def _logo_polygons():
    """Flatten the shipped company vector into own polygons, never fetch an asset."""
    path = Path(__file__).resolve().parents[2] / 'pdf_workshop' / 'assets' / 'edeco-logo.svg'
    if not path.is_file():
        return []
    root = ET.fromstring(path.read_text(encoding='utf-8'))
    result = []
    for entity in root:
        kind = entity.tag.rsplit('}', 1)[-1]
        fill = '#ff8c00' if entity.get('class') == 'cls-4' else INK if entity.get('class') == 'cls-3' else ACCENT
        if kind == 'rect':
            x, y, w, h = [float(entity.get(key, 0)) for key in ('x', 'y', 'width', 'height')]
            result.append((fill, [[(x, y), (x + w, y), (x + w, y + h), (x, y + h)]]))
        elif kind == 'polygon':
            numbers = [float(n) for n in re.findall(r'-?(?:\d+\.?\d*|\.\d+)', entity.get('points', ''))]
            result.append((fill, [[(numbers[i], numbers[i + 1]) for i in range(0, len(numbers), 2)]]))
        elif kind == 'path':
            polygons, points, current = [], [], (0.0, 0.0)
            for command in _path_commands(entity.get('d', '')):
                if command[0] == 'M':
                    if points:
                        polygons.append(points)
                    current = (command[1], command[2])
                    points = [current]
                elif command[0] == 'L':
                    current = (command[1], command[2]); points.append(current)
                elif command[0] == 'C':
                    p0, p1, p2, p3 = current, command[1:3], command[3:5], command[5:7]
                    for step in range(1, 13):
                        t, u = step / 12, 1 - step / 12
                        points.append((u**3 * p0[0] + 3 * u*u*t * p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
                                       u**3 * p0[1] + 3 * u*u*t * p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]))
                    current = (p3[0], p3[1])
                elif command[0] == 'Z' and points:
                    polygons.append(points); points = []
            if points:
                polygons.append(points)
            result.append((fill, polygons))
    return result


def _append_logo(shapes, x, y, width=25):
    factor = width / 251.26
    for fill, polygons in _logo_polygons():
        shapes.append(Shape('polygon', fill=fill, layer='PLANKOPF', role='logo',
                            polygons=[[(x + px * factor, y + py * factor) for px, py in polygon] for polygon in polygons]))
    if not _logo_polygons():
        shapes.append(Shape('text', x, y + 6, width, 5, text='edeco', stroke=ACCENT, role='logo'))


def _rating_lines(doc):
    cabinet, rating = doc['cabinet'], doc['ratings']
    return [f'{cabinet["kind"]} · {cabinet["name"]} · {cabinet["manufacturer"] or "Fabrikat offen"} {cabinet["system"]}',
            f'B × H × T: {cabinet["width_mm"]:g} × {cabinet["height_mm"]:g} × {cabinet["depth_mm"]:g} mm · RAL aussen/innen: {cabinet.get("ral_outer") or "offen"} / {cabinet.get("ral_inner") or "offen"}',
            f'IP geschlossen: {rating["ip_closed"] or "offen"} · mit Abdeckung: {rating["ip_open_covered"] or "offen"} · Zugang: {rating["access_protection"] or "offen"}',
            f'Un {_number(rating["rated_voltage_v"], " V")} · In {_number(rating["rated_current_a"], " A")} · Icw {_number(rating["icw_ka"], " kA")} / {_number(rating["icw_duration_s"], " s")} · Ipk {_number(rating["ipk_ka"], " kA")}',
            f'Icc {_number(rating["icc_ka"], " kA")} · Schutzgerät: {rating["protective_device_ref"] or "offen"}',
            f'VNB: {doc["vnb_id"].upper()} · Ausgabe: {doc["vnb_profile_version"] or "offen"} · Elektrische Nachweise separat prüfen.']


def _sheet_scene(doc, view, paper, scale):
    w, h = PAPERS[paper]
    source = drawing_scene(doc, view)
    available_w, available_h = w - 20, h - 111
    if scale is None:
        denominator = next((v for v in (2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000) if source.width / v <= available_w and source.height / v <= available_h), None)
        if denominator is None:
            denominator = math.ceil(max(source.width / available_w, source.height / available_h))
    else:
        denominator = float(scale)
        if not math.isfinite(denominator) or denominator <= 0 or denominator > 10000:
            raise ValueError('Ungültiger Zeichnungsmassstab.')
        if source.width / denominator > available_w or source.height / denominator > available_h:
            raise ValueError('Der gewählte Massstab passt nicht auf das Blatt. Grössere Teilung oder Papierformat wählen.')
    shapes = []
    x0 = (w - source.width / denominator) / 2
    y0 = 26 + (available_h - source.height / denominator) / 2
    for shape in source.shapes:
        if shape.kind == 'text' and shape.h / denominator < 2:
            if shape.role == 'dimension-label':
                text_width = min(available_w, max(95, shape.w / denominator))
                center = x0 + (shape.x + shape.w / 2 - source.min_x) / denominator
                shapes.append(replace(shape, x=max(10, min(w - 10 - text_width, center - text_width / 2)),
                                      y=y0 + (shape.y - source.min_y) / denominator,
                                      w=text_width, h=2.35, text=_fit(shape.text, text_width, 2.35)))
            elif shape.role == 'front-row-label':
                text_width = shape.w / denominator
                shapes.append(replace(shape, x=x0 + (shape.x - source.min_x) / denominator,
                                      y=y0 + (shape.y - source.min_y) / denominator,
                                      w=text_width, h=2.2, text=_fit(shape.text, text_width, 2.2)))
            continue  # Full device labels are preserved in the legible appendix.
        shapes.append(replace(shape, x=x0 + (shape.x - source.min_x) / denominator,
                              y=y0 + (shape.y - source.min_y) / denominator,
                              w=shape.w / denominator, h=shape.h / denominator))

    def text(x, y, value, size=2.6, width=None, color=INK):
        shapes.append(Shape('text', x, y, width or w - x - 10, size, text=_fit(value, width or w - x - 10, size), stroke=color, layer='PLANKOPF', role='titleblock-text'))

    shapes.append(Shape('rect', 10, 9, w - 20, h - 19, stroke='#84969e', layer='PLANKOPF'))
    text(14, 17, f'Verteiler-Dispo · {doc["name"]}', 4, w - 28)
    text(14, 23, f'{VIEW_NAMES[view]} · {paper} · 1:{denominator:g} bei 100 % Druck · Gerätebezeichnungen im Anhang', 2.5, w - 28, ACCENT)
    tb = h - 72
    shapes.append(Shape('line', 10, tb, w - 20, 0, stroke='#84969e', layer='PLANKOPF'))
    _append_logo(shapes, 14, tb + 5, 28)
    text(49, tb + 8, f'{doc["project_number"] or "Projekt offen"} · {doc["project_name"]}', 3, w - 64)
    text(49, tb + 14, f'{doc["location"]} · Zeichnung: {doc["drawing_number"] or "offen"}', 2.5, w - 64)
    text(14, tb + 22, f'Schema: {doc["schematic_ref"] or "offen"} · Index: {doc["index"] or "-"} · {doc["date"]} · {doc["author"]}', 2.5, w - 28)
    for n, line in enumerate(_rating_lines(doc)):
        text(14, tb + 28 + n * 4.7, line, 2.35, w - 28, MUTED if n else INK)
    text(14, h - 13, f'ENTWURF · Revision {doc["revision"]} · Keine automatische Norm- oder Fertigungsfreigabe', 2.5, w - 28, WARN)
    return Scene(w, h, shapes), denominator


def _grouped_issues(issues):
    """Condense identical open/info explanations, never distinct conflicts.

    Actual/expected/source distinctions are part of the key. Every affected
    object stays listed, and every error/warning stays an independent entry.
    """
    groups = {}
    for index, original in enumerate(issues):
        issue = original.model_dump() if hasattr(original, 'model_dump') else original
        key = ('single', index)
        if issue['severity'] in ('open', 'info'):
            key = (issue['severity'], issue['code'], issue['explanation'],
                   issue.get('actual', ''), issue.get('expected', ''), tuple(issue.get('source_ids', [])))
        if key not in groups:
            groups[key] = {'issue': issue, 'targets': [], 'count': 0}
        group = groups[key]
        group['count'] += 1
        if issue['target_id'] not in group['targets']:
            group['targets'].append(issue['target_id'])
    return list(groups.values())


def _appendix_lines(doc):
    profiles = {profile['id']: profile for profile in doc['profiles']}
    placements = [placement for placement in doc['cabinet']['placements'] if placement['status'] != 'removed']
    lines = [('Geräte und dokumentierte Eigenschaften', 4)]
    by_profile = {}
    for placement in placements:
        by_profile.setdefault(placement['profile_id'], []).append(placement)
    for profile_id, devices in by_profile.items():
        profile = profiles[profile_id]
        names = ', '.join(placement['label'] or placement['id'] for placement in devices)
        lines.extend([(f'{len(devices)} × {profile["name"]} · {profile["manufacturer"] or "Eigenes Profil"} {profile["article"]}', 2.8),
                      (f'BMK: {names}', 2.6),
                      (f'B×H×T {profile["width_mm"]:g}×{profile["height_mm"]:g}×{_number(profile["depth_mm"])} mm · {_number(profile["te"], " TE")} · Verlust je Gerät {_number(profile["power_loss_w"], " W")}', 2.5),
                      (f'Quellen: {", ".join(profile["source_ids"]) or "offen"} · Geometrie: {profile["geometry_status"]}', 2.5)])
        for placement in devices:
            if placement['notes']:
                lines.append((f'Notiz {placement["label"] or placement["id"]}: {placement["notes"]}', 2.6))
    lines.extend([('', 2.5), ('Prüfhinweise und offene Nachweise', 4)])
    used_sources = set(doc['ratings']['source_ids'])
    for placement in placements:
        used_sources.update(profiles[placement['profile_id']]['source_ids'])
    for item in [*doc['cabinet']['covers'], *doc['cabinet']['reserved_zones']]:
        if item['source_id']:
            used_sources.add(item['source_id'])
    try:
        from .checks import analyze
        analysis = analyze(doc)
        issues = analysis['issues'] if isinstance(analysis, dict) else analysis.issues
        groups = _grouped_issues(issues)
        labels = {doc['cabinet']['id']: doc['cabinet']['name']}
        for collection in ('placements', 'rails', 'fields', 'covers', 'reserved_zones'):
            for item in doc['cabinet'][collection]:
                labels[item['id']] = item.get('label') or item.get('name') or item['id']
        lines.append((f'{len(issues)} Prüfeinträge, {len(groups)} getrennte Befunde; gleiche offene Nachweise sind gemeinsam aufgeführt.', 2.5))
        headings = {'profile-geometry-open': 'Gerätegeometrie nicht vollständig belegt.',
                    'device-depth-open': 'Gerätetiefen fehlen.',
                    'din-mounting-datum-open': 'Hersteller-Montagebezug offen.'}
        for group in groups:
            issue = group['issue']
            used_sources.update(issue.get('source_ids', []))
            title = headings.get(issue['code'], issue['message']) if group['count'] > 1 else issue['message']
            affected = ', '.join(labels.get(target, target) for target in group['targets'])
            lines.append((f'{issue["severity"].upper()} · {title} · Betrifft: {affected}', 2.7))
            lines.append((issue['explanation'], 2.6))
            if issue.get('actual') or issue.get('expected'):
                lines.append((f'Ist: {issue.get("actual") or "offen"} · Soll: {issue.get("expected") or "quellengebunden"}', 2.6))
    except ImportError:
        lines.append(('Prüfbericht nicht verfügbar; fachliche Nachweise bleiben offen.', 2.6))
    lines.extend([('', 2.5), ('Quellenstand', 4),
                  ('Verwendete Quellen; vollständige Links, Prüfsummen und Bibliotheksquellen bleiben im Dispo-JSON erhalten.', 2.5)])
    sources = {}
    for source in doc['sources']:
        if source['id'] not in used_sources:
            continue
        key = (source['issuer'], source['title'], source['edition'], source['pages'], source['sha256'] or source['url'])
        if key not in sources:
            sources[key] = {'source': source, 'ids': []}
        sources[key]['ids'].append(source['id'])
    for group in sources.values():
        source = group['source']
        lines.extend([(f'{", ".join(group["ids"])} · {source["issuer"]} · {source["title"]}', 2.5),
                      (f'Ausgabe {source["edition"]} · Abruf {source["checked_on"]} · S. {source["pages"] or "offen"} · SHA-256 {source["sha256"][:12] or "offen"}', 2.4)])
    return lines


def _appendix_scenes(doc, paper):
    w, h = PAPERS[paper]
    result, shapes, y = [], [], 25.0

    def finish():
        nonlocal shapes, y
        if len(result) >= 199:
            raise ValueError('Der Nachweisanhang ist zu gross. Bitte die Disposition in kleinere Dokumente aufteilen.')
        shapes.insert(0, Shape('text', 12, 15, w - 24, 4, text='Verteiler-Dispo · Geräte / Nachweise', layer='PLANKOPF'))
        shapes.append(Shape('text', 12, h - 12, w - 24, 2.5, text=f'Entwurf · Revision {doc["revision"]} · Angaben sind keine automatische Freigabe.', stroke=WARN, layer='PLANKOPF'))
        result.append(Scene(w, h, shapes))
        shapes, y = [], 25.0

    for value, size in _appendix_lines(doc):
        for line in _wrap(value, w - 26, size):
            if y + size + 4 > h - 22:
                finish()
            shapes.append(Shape('text', 13, y, w - 26, size, text=line, layer='BESCHRIFTUNG'))
            y += max(4.2, size * 1.55)
    if shapes:
        finish()
    return result


def _cad_scene(scene, *, page=False):
    import ezdxf
    cad = ezdxf.new('R2013')
    cad.units = 4
    cad.header['$INSUNITS'] = 4
    cad.header['$MEASUREMENT'] = 1
    cad.styles.get('Standard').dxf.font = 'Arial.ttf'
    msp = cad.modelspace()
    dx = -5 if page else 0
    y_top = scene.height - 5 if page else 0

    def xy(x, y):
        return x + dx, y_top - y

    for shape in scene.shapes:
        if shape.layer not in cad.layers:
            cad.layers.new(shape.layer)
        attrs = {'layer': shape.layer, 'true_color': int(shape.stroke[1:], 16), 'lineweight': 18}
        if shape.kind == 'rect':
            points = [xy(shape.x, shape.y), xy(shape.x + shape.w, shape.y), xy(shape.x + shape.w, shape.y + shape.h), xy(shape.x, shape.y + shape.h)]
            if shape.fill != 'none':
                hatch = msp.add_hatch(dxfattribs={'layer': shape.layer, 'true_color': int(shape.fill[1:], 16)})
                hatch.paths.add_polyline_path(points, is_closed=True)
            msp.add_lwpolyline(points, close=True, dxfattribs=attrs)
        elif shape.kind == 'line':
            msp.add_line(xy(shape.x, shape.y), xy(shape.x + shape.w, shape.y + shape.h), dxfattribs=attrs)
        elif shape.kind == 'polygon':
            hatch = msp.add_hatch(dxfattribs={'layer': shape.layer, 'true_color': int(shape.fill[1:], 16)})
            for polygon in shape.polygons:
                hatch.paths.add_polyline_path([xy(x, y) for x, y in polygon], is_closed=True, flags=0)
        elif shape.kind == 'text':
            msp.add_text(shape.text, dxfattribs={**attrs, 'insert': xy(shape.x, shape.y), 'height': shape.h, 'style': 'Standard'})
    return cad


def _csv(document, terminals=False):
    doc = _data(document)
    profiles = {profile['id']: profile for profile in doc['profiles']}
    rows = [['BMK', 'Bezeichnung', 'Hersteller', 'Artikel', 'Art', 'Breite mm', 'Höhe mm', 'Tiefe mm', 'TE', 'Verlustleistung W', 'x mm', 'y mm', 'z mm', 'Quelle', 'Geometriestand']]
    for placement in doc['cabinet']['placements']:
        profile = profiles[placement['profile_id']]
        if placement['status'] == 'removed' or terminals and profile['kind'] != 'terminal':
            continue
        rows.append([placement['label'], profile['name'], profile['manufacturer'], profile['article'], profile['terminal_kind'] if terminals else profile['kind'],
                     profile['width_mm'], profile['height_mm'], profile['depth_mm'], profile['te'], profile['power_loss_w'],
                     placement['x_mm'], placement['y_mm'], placement['z_mm'], ', '.join(profile['source_ids']), profile['geometry_status']])
    output = StringIO()
    writer = csv.writer(output, delimiter=';', quoting=csv.QUOTE_ALL, lineterminator='\r\n')
    for row in rows:
        safe = [("'" + value if re.match(r'^[\s\ufeff]*[=+\-@]|^[\t\r\n]', value) else value) if isinstance(value, str) else '' if value is None else value for value in row]
        writer.writerow(safe)
    return ('\ufeff' + output.getvalue()).encode('utf-8')


def export_bytes(document, format, views, paper='A4', scale=None):  # noqa: A002
    doc = _data(document)
    if format == 'json':
        return (json.dumps(doc, ensure_ascii=False, indent=2) + '\n').encode('utf-8'), 'application/json', 'json'
    if format in ('bom-csv', 'terminals-csv'):
        return _csv(doc, format == 'terminals-csv'), 'text/csv; charset=utf-8', 'csv'
    if format not in ('svg', 'pdf', 'dxf') or paper not in PAPERS:
        raise ValueError('Unbekanntes Ausgabeformat oder Papierformat.')
    views = list(dict.fromkeys(views))
    if not views or any(view not in VIEW_NAMES for view in views):
        raise ValueError('Mindestens eine gültige Ansicht auswählen.')
    if format == 'dxf':
        import ezdxf
        from ezdxf.addons import Importer
        result = ezdxf.new('R2013'); result.units = 4
        result.header['$INSUNITS'] = 4; result.header['$MEASUREMENT'] = 1
        offset = 0.0
        for view in views:
            scene = drawing_scene(doc, view)
            source = _cad_scene(scene)
            block = result.blocks.new(f'Verteiler_{view}')
            imp = Importer(source, result)
            imp.import_entities(source.modelspace(), target_layout=block); imp.finalize()
            result.modelspace().add_blockref(block.name, (offset, 0), dxfattribs={'xscale': 1, 'yscale': 1})
            offset += scene.width + 100
        output = StringIO(); result.write(output)
        return output.getvalue().encode('utf-8'), 'application/dxf', 'dxf'
    scenes = [_sheet_scene(doc, view, paper, scale)[0] for view in views]
    scenes += _appendix_scenes(doc, paper)
    if format == 'svg':
        w, h = PAPERS[paper]
        body = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:g}mm" height="{len(scenes) * (h + 10) - 10:g}mm" viewBox="0 0 {w:g} {len(scenes) * (h + 10) - 10:g}"><title>{escape(doc["name"])}</title>']
        for index, scene in enumerate(scenes):
            body.append(f'<g data-page="{index + 1}" transform="translate(0 {index * (h + 10):g})"><rect width="{w:g}" height="{h:g}" fill="white"/>')
            body.append(_svg_shapes(scene.shapes)); body.append('</g>')
        return (''.join(body) + '</svg>').encode('utf-8'), 'image/svg+xml', 'svg'
    from pypdf import PdfReader, PdfWriter
    from nova_legend.legend.pdf import build_pdf
    result = PdfWriter()
    for scene in scenes:
        page_pdf = build_pdf(_cad_scene(scene, page=True), scene.width - 10, scene.height - 10, doc['name'])
        result.add_page(PdfReader(BytesIO(page_pdf)).pages[0])
    result.add_metadata({'/Title': doc['name'], '/Author': doc['author'], '/Subject': 'Verteiler-Dispo · Entwurf · Nachweise offen oder separat dokumentiert'})
    output = BytesIO(); result.write(output)
    return output.getvalue(), 'application/pdf', 'pdf'
