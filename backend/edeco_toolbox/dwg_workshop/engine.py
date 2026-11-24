"""Read one local DXF copy, preview modelspace, and apply the same layer rules to a copy."""

from pathlib import Path

import ezdxf
from ezdxf import units
from ezdxf.addons import acadctb
from ezdxf.addons.drawing import Frontend, RenderContext, config, layout, svg
from ezdxf.addons.drawing.properties import LayoutProperties
from ezdxf.math import BoundingBox2d

from .example import example_plan
from .profile import Profile

MAX_ENTITIES = 80_000
EXTERNAL = {"IMAGE", "PDFUNDERLAY", "DGNUNDERLAY", "DWFUNDERLAY"}


class PreviewFrontend(Frontend):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.draw_count = 0
        self.unhandled = set()

    def draw_entity(self, entity, properties):
        self.draw_count += 1
        if self.draw_count > MAX_ENTITIES or len(self.parent_stack) > 40:
            raise ValueError("Zu viele aufgelöste Elemente oder verschachtelte Blöcke für die Vorschau.")
        if entity.dxftype() in EXTERNAL:
            self.unhandled.add(entity.dxftype())
            return
        super().draw_entity(entity, properties)

    def skip_entity(self, entity, msg):
        if msg != "invisible":
            self.unhandled.add(entity.dxftype())


def _record(doc):
    backend = svg.SVGBackend()
    policy = config.Configuration(background_policy=config.BackgroundPolicy.WHITE, hatching_timeout=1,
                                  image_policy=config.ImagePolicy.IGNORE, proxy_graphic_policy=config.ProxyGraphicPolicy.IGNORE)
    # Do not resolve an external plot style table supplied by the source layout.
    context = RenderContext(doc, ctb=acadctb.new_ctb())
    model = doc.modelspace()
    paper = LayoutProperties.from_layout(model)
    paper.set_colors("#ffffff")
    frontend = PreviewFrontend(context, backend, config=policy)
    frontend.draw_layout(model, layout_properties=paper)
    return backend, frontend.unhandled


def _svg(backend, box):
    svg_text = backend.get_string(layout.Page(240, 160, layout.Units.mm, layout.Margins.all(5)),
                                  settings=layout.Settings(output_layers=False), render_box=box, xml_declaration=False)
    if len(svg_text.encode("utf-8")) > 5 * 1024 * 1024:
        raise ValueError("Vorschau zu umfangreich. Einen kleineren Modellausschnitt exportieren.")
    return svg_text


def _units(doc):
    code = doc.header.get("$INSUNITS", 0)
    labels = {0: "unbestimmt", units.MM: "mm", units.CM: "cm", units.M: "m", units.KM: "km", units.IN: "in", units.FT: "ft"}
    return labels.get(code, units.unit_name(code))


def _apply(doc, profile):
    stats = {"grey_layers": 0, "hidden_layers": 0, "wipeouts_removed": 0, "text_backgrounds_removed": 0}
    matches = {}
    for layer in doc.layers:
        name = layer.dxf.name.casefold()
        for rule in profile.rules:
            if rule.contains == "*" or rule.contains.casefold() in name:
                break
        else:
            continue
        matches[name] = rule
        if rule.action == "hide":
            layer.off()
            stats["hidden_layers"] += 1
        if rule.action == "grey":
            # The indexed colour also works in R12, which cannot store true colours.
            layer.color = 8
            if doc.dxfversion >= "AC1015":
                layer.rgb = (102, 108, 111)
            stats["grey_layers"] += 1
        if rule.lineweight_mm is not None and doc.dxfversion >= "AC1015":
            layer.dxf.lineweight = round(rule.lineweight_mm * 100)

    def style(entity):
        if not entity.dxf.is_supported("layer"):
            return
        rule = matches.get(entity.dxf.layer.casefold())
        if rule is None:
            return
        if rule.action == "grey":
            entity.dxf.color = 256  # BYLAYER, including elements with explicit true colours
            entity.dxf.discard("true_color")
            entity.dxf.discard("color_name")
        if rule.lineweight_mm is not None and doc.dxfversion >= "AC1015":
            entity.dxf.lineweight = -1

    # Includes modelspace and paperspace; shared nested definitions are visited exactly once.
    for block in doc.blocks:
        if block.block.is_xref or block.block.is_xref_overlay:
            continue
        for entity in list(block):
            kind = entity.dxftype()
            if profile.remove_wipeouts and kind == "WIPEOUT":
                block.delete_entity(entity)
                stats["wipeouts_removed"] += 1
                continue
            if profile.remove_text_backgrounds and kind == "MTEXT" and entity.dxf.get("bg_fill", 0) & 3:
                entity.set_bg_color(None, text_frame=bool(entity.dxf.get("bg_fill", 0) & 16))
                stats["text_backgrounds_removed"] += 1
            style(entity)
            if kind == "INSERT":
                for attribute in entity.attribs:
                    style(attribute)
    return stats


def run_job(operation: str, source: Path | None, profile: Profile, destination: Path):
    doc = ezdxf.readfile(source) if source else example_plan()
    if len(doc.entitydb) > MAX_ENTITIES:
        raise ValueError("Mehr als 80’000 DXF-Einträge. Bitte einen kleineren Teilplan öffnen.")
    layers = sorted((l.dxf.name for l in doc.layers), key=str.casefold)
    if len(layers) > 2048:
        raise ValueError("Mehr als 2’048 Layer. Bitte einen kleineren Teilplan öffnen.")
    if operation == "export":
        _apply(doc, profile)
        doc.saveas(destination)
        return None

    issues = []
    unresolved = sorted(block.name for block in doc.blocks if block.block.is_xref or block.block.is_xref_overlay)
    if unresolved:
        names = ", ".join(unresolved[:8]) + (" …" if len(unresolved) > 8 else "")
        references = "externe Referenz" if len(unresolved) == 1 else "externe Referenzen"
        issues.append(f"Vorschau unvollständig · {len(unresolved)} {references} nicht mitgeladen: {names}.")
    unit = _units(doc)
    if unit == "unbestimmt":
        issues.append("Die Zeichnung weist keine Längeneinheit aus. Einheit in Nova prüfen.")
    if doc.dxfversion < "AC1015" and any(rule.lineweight_mm is not None for rule in profile.rules):
        issues.append("Dieses DXF-Format unterstützt keine Layer-Linienstärken.")
    before, skipped_before = _record(doc)
    bounds = before.player().bbox()
    extent = {"width": bounds.size.x, "height": bounds.size.y} if bounds.has_data else None
    if bounds.has_data and max(bounds.size.x, bounds.size.y) > 0:
        box = BoundingBox2d((bounds.extmin, bounds.extmax))
        box.grow(max(bounds.size.x, bounds.size.y) * .03)
    else:
        box = BoundingBox2d(((0, 0), (1, 1)))
        issues.append("Im Modellbereich wurde keine sichtbare Plangeometrie gefunden.")
    before_svg = _svg(before, box)
    stats = _apply(doc, profile)
    after, skipped_after = _record(doc)
    skipped = sorted(skipped_before | skipped_after)
    if skipped:
        issues.append(f"Vorschau unvollständig · nicht dargestellte Elementtypen: {', '.join(skipped)}.")
    return {"before_svg": before_svg, "after_svg": _svg(after, box), "layers": layers,
            "unit": unit, "extent": extent, "stats": stats, "issues": issues}
