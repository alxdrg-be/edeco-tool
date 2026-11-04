"""Reversible legend abbreviations; original apparatus descriptions are never changed.

Rules operate on complete words in presentation text, not on technical codes,
measurements, source catalogue names or the saved item descriptions.
"""

from __future__ import annotations

import re

MODES = ("wrap", "warn", "abbreviate")
MAX_RULES = 100
_SPACE = re.compile(r"\s+")
_TECHNICAL = re.compile(r"(?:\d|[_/\\]|\b(?:[µμ]?[AVWΩ]|kW|kVA|VA|Hz|kHz|MHz|mm|cm|km|m|mm²|cm²|m²|mm2|cm2|m2|IP|IK|PE|PEN|N|L1|L2|L3)\b)", re.IGNORECASE)


def normalize_text_rules(value) -> dict:
    """Bound client values and retain disabled/invalid rows for their correction.

    Invalid technical-word replacements remain visible in the table, but are
    not executed. Missing rules retain the historical wrapping behaviour.
    """
    source = value if isinstance(value, dict) else {}
    mode = source.get("mode")
    rows = source.get("rules")
    rules, used = [], set()
    for index, raw in enumerate(rows[:MAX_RULES] if isinstance(rows, list) else []):
        if not isinstance(raw, dict):
            continue
        key = str(raw.get("id") or f"rule-{index + 1}")[:60]
        if key in used:
            key = f"rule-{index + 1}"
            while key in used:
                key += "-"
        used.add(key)
        rules.append({"id": key,
                      "long": _SPACE.sub(" ", str(raw.get("long") or "").strip())[:120],
                      "short": _SPACE.sub(" ", str(raw.get("short") or "").strip())[:80],
                      "scope": str(raw.get("scope") or "all")[:120],
                      "active": raw.get("active") is not False})
    return {"mode": mode if mode in MODES else "wrap", "rules": rules}


def rule_problem(rule: dict) -> str:
    """A bad rule is reported rather than silently changing a protected token."""
    long, short = rule.get("long", ""), rule.get("short", "")
    if not long or not short:
        return "Langform und Kurzform ausfüllen."
    if not any(ch.isalpha() for ch in long) or _TECHNICAL.search(long) or _TECHNICAL.search(short):
        return "Typcodes, Einheiten und Nummern bleiben geschützt; nur Wörter abkürzen."
    if len(short) >= len(long):
        return "Die Kurzform muss kürzer als die Langform sein."
    return ""


def abbreviate(text: str, rules: list[dict], category_id: str | None = None) -> str:
    """Apply each enabled rule once, in table order, at whole-word boundaries.

    Matching is case insensitive. A literal replacement function prevents
    backslash/group expansion in user-provided table cells. Replacements may
    not run across a paragraph boundary or inside a code such as T13.
    """
    result = text
    for rule in rules:
        if not rule.get("active", True) or rule_problem(rule):
            continue
        if rule.get("scope", "all") not in ("all", category_id):
            continue
        words = re.split(r"\s+", rule["long"])
        pattern = r"(?<![\w])" + r"[ \t]+".join(re.escape(word) for word in words) + r"(?![\w])"
        result = re.sub(pattern, lambda _match, replacement=rule["short"]: replacement,
                        result, flags=re.IGNORECASE)
    return result


def prepare_texts(doc: dict) -> dict:
    """Add render-only text to copies; never overwrite an item or logical part."""
    from .model import entry_text

    settings = normalize_text_rules(doc.get("text_rules"))
    if settings["mode"] == "wrap":
        return doc
    blocks = []
    for block in doc["blocks"]:
        items = []
        for item in block["items"]:
            source = entry_text(item)
            suggested = abbreviate(source, settings["rules"], block.get("category_id"))
            items.append({**item, "_text_source": source,
                          "_text_suggestion": suggested,
                          "_display_text": suggested if settings["mode"] == "abbreviate" else source,
                          "_text_mode": settings["mode"]})
        blocks.append({**block, "items": items})
    return {**doc, "blocks": blocks}
