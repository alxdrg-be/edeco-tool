"""Reversible floor selection for one legend, shared by preview and export.

The saved document keeps every entry. Filtering produces a separate view, so
switching floors never erases hand-written texts, grouping or symbol settings.
"""

from __future__ import annotations

from copy import deepcopy


def normalize_scope(value) -> dict:
    raw = value if isinstance(value, dict) else {}
    requested = raw.get("plan_ids")
    ids: list[int] = []
    if isinstance(requested, list):
        for value in requested[:10000]:
            if isinstance(value, bool):
                continue
            if isinstance(value, int) or (isinstance(value, str) and value.strip().isdigit()):
                number = int(value)
                if number > 0 and number not in ids:
                    ids.append(number)
        # An invalid, non-empty selection must not silently mean "all floors".
        if requested and not ids:
            ids = [-1]
    elif requested:
        ids = [-1]
    return {"plan_ids": ids,
            "only_present": raw.get("only_present") is True,
            "title_suffix": raw.get("title_suffix") is True,
            "filename_suffix": raw.get("filename_suffix") is True}


def selected_plan_ids(scope: dict) -> set[int] | None:
    """None means all; unknown explicit IDs remain an empty effective selection."""
    ids = normalize_scope(scope)["plan_ids"]
    return set(ids) if ids else None


def scope_label(scope: dict, plans: list[dict]) -> str:
    ids = set(normalize_scope(scope)["plan_ids"])
    return " + ".join(str(plan["name"]) for plan in plans if plan["id"] in ids)


def scoped_document(doc: dict, evaluation: dict, plans: list[dict]) -> dict:
    """Apply output-only presence filtering and the optional title suffix.

    Notes, line samples, custom text and deliberately kept entries survive. For
    combined apparatus, filter each original part separately and promote the
    first surviving part without changing the row identity.
    """
    out = deepcopy(doc)
    scope = normalize_scope(doc.get("scope"))
    member_keys: dict[str, set[str]] = {}
    for block in out.get("blocks") or []:
        for item in block.get("items") or []:
            if item.get("kind") != "symbol":
                continue
            for index, part in enumerate([item, *(item.get("parts") or [])]):
                # A source index, unlike a drawing key, distinguishes two
                # deliberately different rotations/colours of the same glyph.
                part["_source_part"] = index
                if not item.get("hidden") and part.get("family_key") and part.get("symbol_key"):
                    member_keys.setdefault(part["family_key"], set()).add(part["symbol_key"])
    if scope["only_present"] or scope["plan_ids"]:
        from .model import original_colors

        families = {row["family_key"]: row for row in evaluation["rows"] if row.get("total", 0) > 0}
        symbols = {row["symbol_key"]: row for row in evaluation["rows"] if row.get("total", 0) > 0}
        warnings = []
        palette_identity: set[tuple[str, str, int]] = set()
        for block in out.get("blocks") or []:
            for item in block.get("items") or []:
                by_key: dict[str, list[tuple[dict, tuple[str, ...]]]] = {}
                for part in [item, *(item.get("parts") or [])]:
                    if part.get("symbol_key"):
                        colors = tuple(sorted(original_colors(part.get("layer_colors"), part.get("color", ""))))
                        by_key.setdefault(part["symbol_key"], []).append((part, colors))
                for duplicates in by_key.values():
                    # A source palette normally updates with a reimport. Only
                    # a deliberately repeated identical glyph distinguished by
                    # different palettes uses that palette as part identity.
                    if len({colors for _, colors in duplicates if colors}) > 1:
                        palette_identity.update((block["id"], item["id"], part["_source_part"])
                                                for part, colors in duplicates if colors)

        def source_row(part: dict) -> dict | None:
            family = families.get(part.get("family_key")) or symbols.get(part.get("symbol_key"))
            if not family:
                return None
            members = family.get("symbol_variants")
            explicit = (len(member_keys.get(part.get("family_key"), set())) > 1
                        or part.get("symbol_key") != family.get("symbol_key"))
            if explicit and isinstance(members, list):
                member = next((member for member in members
                               if member.get("symbol_key") == part.get("symbol_key") and member.get("total", 0) > 0), None)
                # Explicit UP/AP rows or manual parts must use their own
                # presence and palette. A sole canonical family representative
                # deliberately retains the historical family-level fallback.
                return {**family, **member} if member else None
            return family

        def limit_colors(part: dict, item: dict, block: dict) -> bool:
            """Intersect a saved colour choice, never replace it with another one."""
            row = source_row(part)
            if not scope["plan_ids"] or not row:
                return True
            available = original_colors(row.get("layer_colors"))
            stored = original_colors(part.get("layer_colors"), part.get("color", ""))
            if not stored and not available:
                return True
            warning = {"block": block["id"], "item": item["id"],
                       "text": part.get("text", ""), "available_colors": available}
            if row.get("source_colors_complete") is False or not available:
                warnings.append({**warning, "kind": "unverified-source-colors",
                                 "message": "Quellfarben dieses Geschosses sind im älteren Import nicht vollständig belegt. Gespeicherte Farben bleiben sichtbar; für einen belegten Farbfilter den Plan erneut importieren."})
                return True
            requested = original_colors(part.get("visible_layer_colors"))
            # A consciously chosen monochrome colour applies to this apparatus
            # independently of its source palette, including logical parts.
            forced = bool(item.get("symbol_color"))
            explicit_palette = (block["id"], item["id"], part.get("_source_part", 0)) in palette_identity
            if stored and explicit_palette and not forced:
                intersection = [color for color in available if color in stored]
                if not intersection:
                    kept = bool(item.get("keep"))
                    warnings.append({**warning,
                                     "kind": "selected-colors-absent" if requested else "stored-colors-absent",
                                     "selected_colors": requested or stored,
                                     "message": ("Die gespeicherte Farbvariante kommt in den ausgewählten Geschossen nicht vor. "
                                                 + ("Die ausdrücklich beibehaltene Zeile behält ihre eigene Farbe."
                                                    if kept else "Sie wird ausgeblendet; die gespeicherte Farbe bleibt erhalten."))})
                    return kept
                available = intersection
            selected = [color for color in requested if color in available]
            if requested and not selected and not forced:
                warnings.append({**warning, "kind": "selected-colors-absent", "selected_colors": requested,
                                 "message": "Die gewählte Farbvariante kommt in den ausgewählten Geschossen nicht vor. Sie wird ausgeblendet; die gespeicherte Farbauswahl bleibt erhalten."})
                return bool(item.get("keep"))
            if requested and len(selected) < len(requested) and not forced:
                warnings.append({**warning, "kind": "selected-colors-partial", "selected_colors": requested,
                                 "message": "Nur ein Teil der gewählten Farbvarianten kommt in den ausgewählten Geschossen vor. Die Ausgabe zeigt diese Schnittmenge; die gespeicherte Auswahl bleibt erhalten."})
            part["layer_colors"] = available
            part["color"] = available[0]
            part.pop("visible_layer_colors", None)
            if selected:
                part["visible_layer_colors"] = selected
            return True

        blocks = []
        for block in out.get("blocks") or []:
            items = []
            for item in block.get("items") or []:
                if item.get("kind") != "symbol" or item.get("hidden"):
                    items.append(item)
                    continue
                parts = [item, *(item.get("parts") or [])]
                forced = item.get("symbol_color")
                remaining = [part for part in parts
                             if (not scope["only_present"] or item.get("keep") or source_row(part))
                             and limit_colors(part, item, block)]
                if not remaining:
                    continue
                if remaining[0] is not item:
                    first = remaining[0]
                    for key in ("family_key", "symbol_key", "text", "length_mm", "width_mm",
                                "symbol_factor", "rotation", "mirror", "color", "layer_colors",
                                "visible_layer_colors", "symbol_color"):
                        item.pop(key, None)
                    item.update(first)
                    if forced:
                        item["symbol_color"] = forced
                item.pop("parts", None)
                if len(remaining) > 1:
                    item["parts"] = remaining[1:]
                items.append(item)
            # No orphan heading after an absent apparatus group. An intentionally
            # empty section remains available in the editor's saved document.
            if items or not block.get("items"):
                block["items"] = items
                blocks.append(block)
        out["blocks"] = blocks
        out["_scope_color_warnings"] = warnings
    if scope["title_suffix"]:
        label = scope_label(scope, plans)
        if label and out.get("title"):
            out["title"]["text"] = " · ".join(x for x in (out["title"].get("text", ""), label) if x)
    return out


def scope_info(doc: dict | None, evaluation: dict, plans: list[dict],
               all_evaluation: dict | None = None) -> dict:
    """Three distinct counts, without treating unknown apparatus as known types."""
    scope = normalize_scope((doc or {}).get("scope"))
    known = {plan["id"] for plan in plans}
    wanted = scope["plan_ids"]
    effective = [plan["id"] for plan in plans if not wanted or plan["id"] in wanted]
    rows = [row for row in evaluation["rows"] if row.get("total", 0) > 0]
    unknown = sum(max(0, row.get("total", 0)) for row in evaluation.get("unknown", []))
    shown = scoped_document(doc, evaluation, plans) if doc else {"blocks": []}
    entries = [item for block in shown["blocks"] for item in block.get("items", [])
               if not item.get("hidden") and item.get("kind") != "gap"]
    all_rows = (all_evaluation or evaluation).get("rows", [])
    all_unknown = (all_evaluation or evaluation).get("unknown", [])
    choices = []
    for plan in plans:
        pid = plan["id"]
        amount = lambda row: (row.get("counts") or {}).get(pid, (row.get("counts") or {}).get(str(pid), 0))
        choices.append({"id": pid, "name": plan["name"],
                        "imported": bool(plan.get("current_version")),
                        "components": sum(max(0, amount(row)) for row in [*all_rows, *all_unknown]),
                        "symbol_types": sum(1 for row in all_rows if amount(row) > 0)})
    return {"plans": choices, "selected_plan_ids": effective,
            "missing_plan_ids": [pid for pid in wanted if pid not in known],
            "color_warnings": shown.get("_scope_color_warnings", [])[:50],
            "color_warning_count": len(shown.get("_scope_color_warnings", [])),
            "counts": {"components": sum(row["total"] for row in rows) + unknown,
                       "symbol_types": len(rows), "legend_rows": len(entries),
                       "unknown_components": unknown,
                       "manual_rows": sum(item.get("kind") != "symbol" for item in entries)},
            "rows": rows}
