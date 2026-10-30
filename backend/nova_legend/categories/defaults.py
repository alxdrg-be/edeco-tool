"""Default legend categories and the automatic assignment rules.

Layer names follow the objects in Legende_edeco20.n4d (sheet -> layer).

Finding from Phase 0: the number range of a catalogue code is the Nova
"Sheet" ID (Data/Sheet@ID) and the folder ID (Folder@ID). It is therefore a
reliable category key. Name patterns are only used as a fallback.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass
class Category:
    id: str
    title: str
    layer: str
    parent: str | None = None
    columns: int = 2
    spacing_mm: float = 4.55     # row pitch measured in Legende_edeco20.n4d
    sheets: list[str] = field(default_factory=list)


# Sections (no parent) are the parts of the full legend. Groups (with a parent) split a
# section for a themed legend, e.g. only «UKV» out of «Kommunikation». A symbol belongs
# to the group whose number range it has; the full legend shows it in the group's section.
DEFAULT_CATEGORIES: list[Category] = [
    Category("allgemein", "Allgemein", "E_Starkstrom", sheets=["9999", "Label_10", "Label_20", "E_Label_Z1", "ALLG"]),
    Category("leitungen", "Leitungen", "E_Leitung_Licht",
             sheets=["410", "Label_30", "Label_40", "Beschriftung_6_2", "GZLSym", "LeitungsVerw", "Tra1"]),
    Category("verteiler", "Verteiler und Stromquellen", "E_Starkstrom", sheets=["405", "420", "VT1"]),
    Category("licht", "Licht und Leuchten", "E_Licht",
             sheets=["130", "135", "140", "145", "Dialux", "Relux", "T5", "T8", "LB", "DL_EB", "DL_AP", "WL_EB",
                     "WL_AP", "BL_AP", "BL_UP", "geoL_AP", "geoL_EB", "geoWL_AP", "geoWL_EB", "geoBL_AP", "geoBL_EB"]),
    # emergency lighting stays a section of its own, never in «Licht»
    Category("fluchtweg", "Notbeleuchtung und Fluchtweg", "E_Fluchtwegleuchten"),
    Category("notleuchten", "Notleuchten", "E_Fluchtwegleuchten", parent="fluchtweg"),
    Category("rettungszeichen", "Rettungszeichen", "E_Fluchtwegleuchten", parent="fluchtweg", sheets=["165", "RZL0"]),
    Category("schalter", "Schalter und Taster", "E_Licht"),
    Category("schalter-schalter", "Schalter", "E_Licht", parent="schalter",
             sheets=["10", "20", "30", "40", "50", "60", "70", "80", "S_P0", "S_P1", "S_P2", "S_P3", "S_P8",
                     "S_P9", "S_KombGr1", "S_P10", "S_P11"]),
    Category("taster", "Taster", "E_Licht", parent="schalter"),
    Category("melder", "Melder", "E_Licht", parent="schalter"),
    Category("steckdosen", "Steckdosen und Dosen", "E_Licht"),
    Category("steckdosen-steckdosen", "Steckdosen", "E_Licht", parent="steckdosen",
             sheets=["90", "100", "50", "60", "S_KombGr1", "SD_5P0_UP", "SD_5P0_AP", "SD_3P0_UP", "SD_3P0_AP",
                     "SD_3P0_SZ", "SD_2P0_UP", "SD_2P0_AP", "VT2"]),  # Kombinationen Gr.I also in Schalter
    Category("dosen", "Dosen", "E_Licht", parent="steckdosen", sheets=["390", "400"]),
    Category("kraft", "Kraft und Elektrogeräte", "E_Starkstrom",
             sheets=["170", "EG_Anschluesse", "Hauswirtschaft", "Warmwasser", "EG_Antriebe", "Wandler"]),
    Category("schwachstrom", "Schwachstrom", "E_Schwachstrom"),
    Category("alarm", "Alarm und Signal", "E_Schwachstrom", parent="schwachstrom",
             sheets=["330", "S_P5", "AKSG", "OPSG"]),
    Category("uhren", "Uhren", "E_Uhren", parent="schwachstrom", sheets=["270", "UHR"]),
    Category("pans", "PANS und Krankenruf", "E_Schwachstrom_allgemein", parent="schwachstrom",
             sheets=["370", "380", "S_P4", "KHS", "KHS_A", "KHS_B", "KHS_C", "RKS"]),
    # Legendenbesprechung 09.10.2026: one section for UKV, Telefon, TV / Video and Gegensprechanlage
    Category("kommunikation", "Kommunikation", "E_EDV"),
    Category("edv", "UKV", "E_EDV", parent="kommunikation", sheets=["310", "320", "EDV"]),
    Category("telefon", "Telefon", "E_Telefon", parent="kommunikation", sheets=["250", "260", "FMA", "FMVT"]),
    Category("tv", "TV und Video", "E_RadioTV", parent="kommunikation", sheets=["290", "TV"]),
    Category("gsa", "Gegensprechanlage", "E_GSA", parent="kommunikation", sheets=["345", "346", "347", "GSA"]),
    Category("knx", "BUS-KNX", "E_BUS-KNX", sheets=["210", "220", "225", "KNX", "KNX_A", "KNX_B", "BUSKNX"]),
    Category("bma", "Brandmeldeanlage", "E_Brandmeldeanlagen", sheets=["230", "240", "S_P7", "BMA"]),
    Category("sicherheit", "Sicherheit", "E_Sicherheit"),
    Category("einbruch", "Einbruch", "E_Sicherheit", parent="sicherheit",
             sheets=["350", "360", "S_P6", "EMA", "SICHERHEIT"]),
    Category("zutritt", "Zutritt", "E_Sicherheit", parent="sicherheit"),
    Category("hlks", "Melder, Fühler, Sensoren (HLKS)", "E_HLKS", sheets=["110", "120", "HLK", "MEFUE"]),
    Category("erdung", "Blitzschutz und Erdung", "E_Starkstrom", sheets=["190", "200", "FE", "BS"]),
    Category("diverse", "Diverse", "E_Starkstrom", sheets=["101"]),
    Category("schema", "Schema Verteiler (Niederspannung)", "E_Starkstrom"),
]

# Whole datasets that go to one category when the sheet is unknown
DATASET_RULES: list[tuple[str, str]] = [
    ("Niederspannung_E", "schema"),   # distribution board schematics (FI, LS, ...)
]

# Name rules that win over the number range: emergency luminaires sit in the luminaire
# sheets of Nova, but the legend shows them apart from «Licht»
NAME_FIRST: list[tuple[str, str]] = [
    (r"\bnot(leucht|beleucht|licht)|handnotleucht|sicherheitsleucht|sicherheitsbeleucht", "notleuchten"),
    # Decken- / Wandauslass are luminaire outlets, even when Nova files them with the boxes
    (r"auslass", "licht"),
]

# Groups found by the name inside the section the number range gives
GROUP_NAME_RULES: list[tuple[str, str]] = [
    (r"taster|drücker", "taster"),
    (r"melder|sensor", "melder"),
    (r"zutritt|karten|biometrie|schloss|türöffner|batch|badge", "zutritt"),
    (r"sprechanlage|sprechstelle|klingel|türöffner", "gsa"),
    (r"^telefon\b|telefonapparat", "telefon"),
]

# Fallback rules on the symbol name (only used when the sheet is unknown)
NAME_RULES: list[tuple[str, str]] = [
    (r"brand|rauch|hitze|bma|handalarm", "bma"),
    (r"leuchte|lampe|downlight|scheinwerfer", "licht"),
    (r"flucht|rzl|rettungszeichen", "rettungszeichen"),
    (r"steckdose", "steckdosen-steckdosen"),
    (r"dose", "dosen"),
    (r"taster", "taster"),
    (r"schalter|dimmer", "schalter-schalter"),
    (r"knx|bus", "knx"),
    (r"telefon", "telefon"),
    (r"edv|rj45|daten|ukv|wlan|oto", "edv"),
    (r"tv|radio|antenne", "tv"),
    (r"sprechstelle|sprechanlage|türöffner|gsa", "gsa"),
    (r"uhr", "uhren"),
    (r"leitung|kanal|rohr", "leitungen"),
    (r"verteil|tableau", "verteiler"),
]


def categories_for(sheet: str) -> list[str]:
    """All categories that list this number range (a symbol may appear in several)."""
    return [cat.id for cat in DEFAULT_CATEGORIES if sheet in cat.sheets]


def category_for(sheet: str, name: str = "") -> tuple[str, str]:
    """Return (category_id, reason) for a symbol."""
    for pattern, cat_id in NAME_FIRST:
        if re.search(pattern, name.lower()):
            return cat_id, f"Namensmuster «{pattern}»"
    for cat in DEFAULT_CATEGORIES:
        if sheet in cat.sheets:
            return group_by_name(cat.id, name), f"Nummernkreis {sheet}"
    low = name.lower()
    for pattern, cat_id in NAME_RULES:
        if re.search(pattern, low):
            return cat_id, f"Namensmuster «{pattern}»"
    return "diverse", "keine Regel"


def section_of(cat_id: str, parents: dict[str, str | None]) -> str:
    """The section (top category) of a category or group."""
    seen = set()
    while parents.get(cat_id) and cat_id not in seen:
        seen.add(cat_id)
        cat_id = parents[cat_id]
    return cat_id


def group_by_name(cat_id: str, name: str, parents: dict[str, str | None] | None = None) -> str:
    """A name rule may move a symbol into another group of the same section
    («Taster» out of the sheet of the switches)."""
    if parents is None:
        parents = {c.id: c.parent for c in DEFAULT_CATEGORIES}
    low = (name or "").lower()
    for pattern, group in GROUP_NAME_RULES:
        if group in parents and section_of(group, parents) == section_of(cat_id, parents) and re.search(pattern, low):
            return group
    return cat_id
