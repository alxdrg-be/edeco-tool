"""Suggest a section or group for every symbol of the company's user stencil.

The stencil tabs are already sorted by trade (Leuchten, Schalter / Taster,
Brandmeldeanlagen ...). A tab gives the default; a few name rules correct entries
that sit in a mixed tab (Verteilungen / Dosen, Telefon / TV / UKV, Intrusionsanlagen)
or that Nova files in another number range (Deckenauslass in the sheet of the boxes).
"""

from __future__ import annotations

import re

# name of the entry -> category (first match wins, any tab)
ENTRY_RULES: list[tuple[str, str]] = [
    (r"tt83|amtsverteiler|hausübergabepunkt", "telefon"),
    (r"rj45|\boto\b|ukv|\bbep\b|wlan|dect|mm-steckdose|\brack\b", "edv"),
    (r"antenne|\btv\b|hdmi|cinch|vga|signalübergabe|video-verteiler", "tv"),
    (r"notlicht|notleucht|sicherheitsleucht|notbeleucht", "notleuchten"),
    (r"\brzl\b|rettungszeichen|fluchtweg", "rettungszeichen"),
    (r"\bhak\b|hausanschluss|\bhv\b|\buv\b|\bmmv\b|verteiler|wechselrichter", "verteiler"),
    (r"auslass", "licht"),
    (r"elektromagnetischer türöffner|kartenleser|zuko|biometrie|beschlagsleser|rfid|\bbatch\b|schlüsselkasten|schlüsseltresor",
     "zutritt"),
    (r"klingel|türöffner|sprechstelle|glocke", "gsa"),
    (r"pflegeruf|pans|infrarotempfänger decke", "pans"),
    (r"ladestation", "kraft"),
    (r"kamera|bildteiler|bildmelder", "einbruch"),
    (r"besetzt|summer", "alarm"),
    (r"stempeluhr|mutteruhr|\buhr\b", "uhren"),
    (r"dämmerung", "melder"),
    (r"\bco2\b|\bhzv\b", "hlks"),
    (r"abzweigdose|leerdose|anschlussdose|schlaufkasten|schalungsschoner|bodendose|unterflur|kanalzugdose", "dosen"),
]

# name of the tab -> default category (None: keep the automatic rule)
TAB_RULES: list[tuple[str, str | None]] = [
    (r"kombination", None),
    (r"flf|boden", None),
    (r"sicherheitsbeleuchtung|notlicht", "notleuchten"),
    (r"leuchte", "licht"),
    (r"schalter|taster", "schalter-schalter"),
    (r"steckdose", "steckdosen-steckdosen"),
    (r"kraft", "kraft"),
    (r"hlks|fühler", "hlks"),
    (r"sonnerie|gsa|sprech", "gsa"),
    (r"gebäudeautomation|knx|bus", "knx"),
    (r"brandmelde|\bbma\b", "bma"),
    (r"intrusion|einbruch", "einbruch"),
    (r"rufanlage|pans", "pans"),
    (r"erdung|blitz", "erdung"),
    (r"verteil|dosen", "dosen"),
    (r"telefon|ukv", "edv"),
    (r"schwachstrom", "alarm"),
]


def suggest(tab: str, name: str, known: set[str]) -> tuple[str | None, str]:
    """(category id, reason) for one stencil entry; None when the automatic rule stays."""
    low = (name or "").lower()
    for pattern, cat in ENTRY_RULES:
        if cat in known and re.search(pattern, low):
            return cat, f"Name «{pattern.split('|')[0].strip(chr(92) + 'b')}»"
    tab_low = (tab or "").lower()
    for pattern, cat in TAB_RULES:
        if re.search(pattern, tab_low):
            if cat is None or cat not in known:
                return None, "Registerkarte gemischt"
            return cat, f"Registerkarte «{tab}»"
    return None, "keine Regel"


def stencil_plan(sets, categories: list[dict], current) -> list[dict]:
    """One row per symbol family of the stencil: where it is now, where it should go.

    ``sets``: the stencil sets as read (with each entry's family key); ``current(fk)``
    gives the categories a family has today. A family that appears in several tabs is
    listed once, with its first tab."""
    known = {c["id"] for c in categories}
    title = {c["id"]: c["title"] for c in categories}
    parent = {c["id"]: c.get("parent") for c in categories}

    def top(cid: str) -> str:
        seen = set()
        while parent.get(cid) and cid not in seen:
            seen.add(cid)
            cid = parent[cid]
        return cid

    def label(cid: str | None) -> str:
        if not cid:
            return ""
        return f"{title.get(parent[cid], '')} › {title.get(cid, cid)}" if parent.get(cid) else title.get(cid, cid)

    rows: list[dict] = []
    seen: set[str] = set()
    for sset in sets:
        for tab in sset["tabs"]:
            for entry in tab["entries"]:
                fk = entry.get("family_key")
                if not fk or fk in seen:
                    continue
                seen.add(fk)
                now = list(current(fk) or [])
                cat, reason = suggest(tab["name"], entry["name"], known)
                if cat and now and reason.startswith("Registerkarte") and top(now[0]) == top(cat):
                    cat = now[0]       # right section already: keep its finer group (Taster, Melder)
                change = bool(cat) and (not now or now[0] != cat)
                rows.append({"family_key": fk, "tab": tab["name"], "name": entry["name"], "item": entry.get("item") or "",
                             "now": now[0] if now else "", "now_label": label(now[0] if now else None),
                             "suggestion": cat or "", "suggestion_label": label(cat), "reason": reason,
                             "change": change})
    return rows
