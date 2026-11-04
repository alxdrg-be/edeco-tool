"""Reversible display grouping of verified catalogue variants.

This does not rebuild library families, move company assignments or mutate a
stored legend.  A catalogue's part name and drawing name must agree after the
explicitly enabled variant tokens are removed.  Similar user text alone is
never sufficient.  Preview and export apply this same transformation.
"""

from __future__ import annotations

import re
import math
from collections import defaultdict
from copy import deepcopy

from ..library.families import LABEL_VARIANTS, ORIENTATION, SHEET_PAIRS

RULE_DEFAULTS = {
    "labels": True,
    "orientation": False,
    "count": False,
    "placement": False,
    "mounting": False,
    "poles": False,
    "schema": False,
    "angle": False,
}
RULE_NAMES = {
    "labels": "Beschriftung", "orientation": "Ausrichtung", "count": "Anzahl",
    "placement": "Decke / Wand", "mounting": "UP / AP", "poles": "Polzahl",
    "schema": "Schema", "angle": "Erfassungswinkel",
}
MAX_AUTO_SYMBOLS = 3
_TOKENS = {
    "labels": LABEL_VARIANTS,
    "orientation": ORIENTATION,
    "count": re.compile(r"(?<!\w)([123])\s*[-–]?\s*fach(?!\w)", re.I),
    "placement": re.compile(r"(?<!\w)(Decke|Wand)(?!\w)", re.I),
    "mounting": re.compile(r"(?<!\w)(UP|AP)(?!\w)", re.I),
    "poles": re.compile(r"(?<!\w)([1-9])\s*[-–]?\s*pol(?:ig)?(?!\w)", re.I),
    "schema": re.compile(r"(?<!\w)Schema\s*[:.]?\s*([0-9]{1,2})(?!\w)", re.I),
    "angle": re.compile(r"(?<![\w.])(?:90|180|270|360)\s*°(?!\w)", re.I),
}
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")
_GENERIC = {"apparat", "symbol", "bauteil", "gerät", "geraet", "variante"}


def normalize_variant_rules(value) -> dict:
    """Only actual booleans are accepted; strings cannot silently enable rules."""
    source = value if isinstance(value, dict) else {}
    return {key: source[key] if isinstance(source.get(key), bool) else default
            for key, default in RULE_DEFAULTS.items()}


def _get(value, key, default=None):
    return value.get(key, default) if isinstance(value, dict) else getattr(value, key, default)


def _tidy(text: str) -> str:
    text = re.sub(r"\(\s*\)", " ", text)
    text = re.sub(r"\s*[,;:]\s*", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" ,;-–()").casefold()


def _tokens(text: str, rules: dict) -> tuple[str, dict[str, tuple[str, ...]]]:
    values = {}
    for rule, pattern in _TOKENS.items():
        if not rules[rule]:
            continue
        hits = tuple(_tidy(m.group(0)) for m in pattern.finditer(text))
        if hits:
            values[rule] = hits
            text = pattern.sub(" ", text)
    return _tidy(text), values


def _sheet(sheet: str, mounting: bool) -> str:
    if not mounting:
        return sheet
    reverse = {ap: up for up, ap in SHEET_PAIRS.items()}
    return reverse.get(sheet, sheet)


def _catalogue_index(families) -> tuple[dict, dict]:
    symbols, owners = {}, {}
    values = families.values() if isinstance(families, dict) else (families or [])
    for family in values:
        for member in _get(family, "members", []) or []:
            key = _get(member, "key")
            if key:
                symbols[key] = member
                owners[key] = family
    return symbols, owners


def _candidate(item: dict, symbols: dict, owners: dict, rules: dict):
    if (item.get("kind") != "symbol" or item.get("hidden") or item.get("keep")
            or item.get("parts") or item.get("symbol_color")):
        return None
    symbol = symbols.get(item.get("symbol_key"))
    family = owners.get(item.get("symbol_key"))
    if not symbol or not family or not item.get("family_key"):
        return None
    if item["family_key"] != _get(family, "key"):
        return None
    dataset, sheet, code = (_get(symbol, field, "") for field in ("dataset", "sheet", "item"))
    if not dataset or not sheet or not code or not str(code).startswith(f"{sheet}-"):
        return None
    part, part_values = _tokens(_get(symbol, "part_name", "") or "", rules)
    name, name_values = _tokens(_get(symbol, "name", "") or "", rules)
    # A real catalogue function anchors the comparison, rather than user-entered
    # descriptions or a generic numeric drawing name.
    if len(part) < 3 or part in _GENERIC or not any(char.isalpha() for char in part):
        return None
    if not name:
        name = part
    values = {rule: (part_values.get(rule, ()), name_values.get(rule, ()))
              for rule in RULE_DEFAULTS}
    signature = (dataset, _sheet(str(sheet), rules["mounting"]), part, name,
                 item.get("text_scale", 1.0))
    return signature, values, symbol, family


def _part(item: dict) -> dict:
    keys = ("family_key", "symbol_key", "text", "length_mm", "width_mm", "symbol_factor",
            "rotation", "mirror", "color", "layer_colors", "visible_layer_colors",
            "_source_part", "_source_item", "_source_block")
    out = {key: deepcopy(item[key]) for key in keys if key in item}
    if item.get("id"):
        out.setdefault("_source_item", item["id"])
    return out


def _different_rules(candidates: list, rules: dict) -> list[str]:
    return [rule for rule, enabled in rules.items() if enabled
            and len({candidate[1][rule] for candidate in candidates}) > 1]


def _verified_mount_pair(first, other) -> bool:
    """Require Nova's documented UP/AP code pair and matching graphic ID."""
    if _get(first, "dataset") != _get(other, "dataset"):
        return False
    up, ap = (first, other) if _get(first, "mounting") == "UP" else (other, first)
    if _get(up, "mounting") != "UP" or _get(ap, "mounting") != "AP":
        return False
    sheet = str(_get(up, "sheet", ""))
    ap_sheet = SHEET_PAIRS.get(sheet)
    item = str(_get(up, "item", ""))
    graphic = _get(first, "graphic_id")
    return bool(ap_sheet and "-" in item
                and str(_get(ap, "item", "")) == f"{ap_sheet}-{item.split('-', 1)[1]}"
                and isinstance(graphic, str) and graphic.strip()
                and graphic == _get(other, "graphic_id"))


def _mount_note(info: dict, detail: str) -> None:
    note = f"UP/AP nicht eindeutig zuordenbar: {detail} Keine zweite Zeichnung ergänzt."
    if note not in info["notes"]:
        info["notes"].append(note)


def _member_snapshot(row: dict, symbol) -> dict | None:
    """A family-wide palette is never evidence for an individual mounting."""
    entries = row.get("symbol_variants")
    if not isinstance(entries, list):
        return None
    matches = [entry for entry in entries if isinstance(entry, dict)
               and entry.get("symbol_key") == _get(symbol, "key")
               and entry.get("mounting") == _get(symbol, "mounting")]
    if len(matches) != 1:
        return None
    entry = matches[0]
    total = entry.get("total")
    if (entry.get("source_colors_complete") is not True or isinstance(total, bool)
            or not isinstance(total, (int, float)) or not math.isfinite(total) or total <= 0):
        return None
    raw = entry.get("layer_colors")
    if not isinstance(raw, list) or not raw or any(not isinstance(color, str) or not _HEX.fullmatch(color)
                                                 or color.lower() == "#ffffff" for color in raw):
        return None
    return {**entry, "layer_colors": list(dict.fromkeys(color.lower() for color in raw))}


def _source_palette(part: dict, snapshot: dict, requested: list[str]) -> dict | None:
    available = snapshot["layer_colors"]
    selected = [color for color in requested if color in available] if requested else available
    if not selected:
        return None
    out = deepcopy(part)
    out["layer_colors"] = available
    out["color"] = selected[0]
    out.pop("visible_layer_colors", None)
    if len(selected) < len(available):
        out["visible_layer_colors"] = selected
    return out


def _mount_caption(text: str, mounting: str) -> str:
    """Keep an existing mounting label once, also after AP-only promotion."""
    pattern = _TOKENS["mounting"]
    found = {match.group(0).upper() for match in pattern.finditer(text)}
    if not found:
        return f"{text} {mounting}".strip()
    if len(found) == 1:
        return pattern.sub(mounting, text)
    # A deliberate free description mentioning both mountings is retained.
    return text


def _add_mount_variant(item: dict, candidate, row: dict | None, info: dict) -> None:
    """Render each proven UP/AP member in its own imported source colours.

    The family-wide palette or total UP/AP counts cannot establish which
    drawing had which colour.  Missing member evidence therefore leaves the
    saved representative unchanged, rather than inventing an AP appearance.
    """
    if not row or item.get("parts"):
        return
    present = row.get("mountings") or {}
    proven_mounts = {mount for mount in ("UP", "AP")
                     if not isinstance(present.get(mount), bool)
                     and isinstance(present.get(mount), (int, float))
                     and math.isfinite(present[mount]) and present[mount] > 0}
    if not proven_mounts:
        return
    _, _, symbol, family = candidate
    current = _get(symbol, "mounting")
    if current not in ("UP", "AP"):
        return
    own_snapshot = _member_snapshot(row, symbol) if current in proven_mounts else None
    if current in proven_mounts and (own_snapshot is None or own_snapshot["total"] != present[current]):
        _mount_note(info, "Die Quellfarben des vorhandenen Mitglieds sind nicht vollständig belegt.")
        return
    wanted = "AP" if current == "UP" else "UP"
    both_rules = dict(RULE_DEFAULTS, labels=True, mounting=True)
    current_part, _ = _tokens(_get(symbol, "part_name", "") or "", both_rules)
    current_name, _ = _tokens(_get(symbol, "name", "") or "", both_rules)
    matches = []
    for member in _get(family, "members", []) or []:
        if wanted not in proven_mounts or _get(member, "mounting") != wanted or not _verified_mount_pair(symbol, member):
            continue
        part, _ = _tokens(_get(member, "part_name", "") or "", both_rules)
        name, _ = _tokens(_get(member, "name", "") or "", both_rules)
        snapshot = _member_snapshot(row, member)
        if ((part, name) == (current_part, current_name) and snapshot is not None
                and snapshot["total"] == present[wanted]):
            matches.append((member, snapshot))
    if wanted in proven_mounts and len(matches) != 1:
        _mount_note(info, "Für die zweite Montageart fehlen eindeutiger Katalog- und Farbnachweis.")
        return
    member, other_snapshot = matches[0] if matches else (None, None)
    # The selected source-colour subset applies to the apparatus as a whole.
    # Intersect it separately for each verified member, instead of transferring
    # the UP selection or presentation transforms onto the AP symbol.
    requested = [color.lower() for color in item.get("visible_layer_colors") or []
                 if isinstance(color, str) and _HEX.fullmatch(color)]
    text = item.get("text", "").strip()
    own = _source_palette(item, own_snapshot, requested) if own_snapshot is not None else None
    if own:
        own["text"] = _mount_caption(text, current)
    extra = (_source_palette({"family_key": item["family_key"], "symbol_key": _get(member, "key"),
                              "text": wanted, "length_mm": None, "width_mm": None,
                              "symbol_factor": 1.0, "rotation": 0, "mirror": False,
                              "_source_part": -1}, other_snapshot, requested)
             if other_snapshot is not None else None)
    if own is None and extra is None:
        _mount_note(info, "Die gespeicherte Farbauswahl gehört zu keinem belegten Mitglied.")
        return
    if own is not None:
        item.clear()
        item.update(own)
        if extra is not None:
            item["parts"] = [extra]
            info["added_variants"] += 1
    else:
        # Preserve the selectable row identity while promoting the sole visible
        # member. Its own drawing starts at neutral local presentation values.
        identity = {key: item[key] for key in ("id", "kind", "text_scale", "hidden", "keep") if key in item}
        item.clear()
        item.update(identity)
        item.update(extra)
        item["text"] = _mount_caption(text, wanted)
    info["applied_rules"]["mounting"] += 1


def apply_variant_rules(doc: dict, *, families=None, rows=None) -> tuple[dict, dict]:
    """Return a display-only document and a transparent grouping report.

    At most three original symbols form a generated row. Existing manual
    combinations, explicit colours, retained entries and non-symbol separators
    remain untouched. Disabling a rule restores the original stored rows.
    """
    rules = normalize_variant_rules(doc.get("variant_rules"))
    view = deepcopy(doc)
    view["variant_rules"] = rules
    info = {"merged_rows": 0, "added_variants": 0, "applied_rules": dict.fromkeys(RULE_DEFAULTS, 0),
            "unmatched_rules": [], "groups": [], "notes": []}
    symbols, owners = _catalogue_index(families)
    by_family = {row.get("family_key"): row for row in rows or []}

    for block in view.get("blocks") or []:
        items = block.get("items") or []
        candidates = {item.get("id"): _candidate(item, symbols, owners, rules) for item in items}
        explicit = defaultdict(int)
        for item in items:
            if candidates.get(item.get("id")):
                explicit[item.get("family_key")] += 1
        explicit_families = {key for key, amount in explicit.items() if amount > 1}
        unverified = set()
        suppressed = set()
        # Existing UP/AP rows of one family must keep their own palettes too.
        # Scope may intentionally leave a saved family-wide colour collection
        # untouched; that is not a reason to draw every colour on each member.
        if rules["mounting"]:
            for item in items:
                candidate = candidates.get(item.get("id"))
                if not candidate or item.get("family_key") not in explicit_families:
                    continue
                row = by_family.get(item.get("family_key"))
                snapshot = _member_snapshot(row, candidate[2]) if row else None
                if snapshot is None:
                    unverified.add(item["id"])
                    _mount_note(info, "Den vorhandenen Mitgliedzeilen fehlen eigene belegte Quellfarben.")
                    continue
                requested = [color.lower() for color in item.get("visible_layer_colors") or []
                             if isinstance(color, str) and _HEX.fullmatch(color)]
                member = _source_palette(item, snapshot, requested)
                if member is None:
                    suppressed.add(item["id"])
                else:
                    item.clear()
                    item.update(member)
            items = [item for item in items if item.get("id") not in suppressed]
        # A note, line or a deliberate manual combination is a semantic divider.
        groups = defaultdict(list)
        segment = 0
        for item in items:
            candidate = candidates.get(item.get("id"))
            if candidate is None:
                segment += 1
                continue
            groups[(segment, candidate[0])].append(item)

        removed = set()
        for group in groups.values():
            if not 2 <= len(group) <= MAX_AUTO_SYMBOLS:
                continue
            different = _different_rules([candidates[item["id"]] for item in group], rules)
            if not different:
                continue
            if "mounting" in different and any(item["id"] in unverified for item in group):
                continue
            if "mounting" in different and any(
                not _verified_mount_pair(candidates[group[0]["id"]][2], candidates[item["id"]][2])
                for item in group[1:]
            ):
                continue
            head = group[0]
            head["parts"] = [_part(item) for item in group[1:]]
            removed.update(item["id"] for item in group[1:])
            info["merged_rows"] += len(group) - 1
            for rule in different:
                info["applied_rules"][rule] += 1
            info["groups"].append({"block": block["id"], "item": head["id"],
                                   "source_ids": [item["id"] for item in group], "rules": different})
        block["items"] = [item for item in items if item.get("id") not in removed]

        if rules["mounting"]:
            for item in block["items"]:
                candidate = candidates.get(item.get("id"))
                if candidate is not None and item.get("family_key") not in explicit_families:
                    _add_mount_variant(item, candidate, by_family.get(item.get("family_key")), info)

    info["unmatched_rules"] = [rule for rule, enabled in rules.items()
                               if enabled and not info["applied_rules"][rule]]
    if any(rule != "labels" for rule in info["unmatched_rules"]):
        info["notes"].append("Für einzelne aktive Regeln sind keine eindeutig belegten Varianten vorhanden. "
                             "Diese Einträge bleiben getrennt.")
    if rules["labels"] and not info["applied_rules"]["labels"]:
        info["notes"].append("Beschriftungsvarianten können bereits in der Bibliotheksfamilie zusammengefasst sein. "
                             "Bestehende Familien und Firmenzuordnungen bleiben erhalten.")
    return view, info
