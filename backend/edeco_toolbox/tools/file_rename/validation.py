"""Pure filename validation and upload limits shared by PDF-copy workflows."""

import re

MAX_FILE = 30 * 1024 * 1024
MAX_TOTAL = 150 * 1024 * 1024


def validate_names(names: list[str]):
    seen = set()
    for name in names:
        if (not name or len(name) > 180 or not name.lower().endswith(".pdf")
                or re.search(r'[<>:"/\\|?*\x00-\x1f]', name) or name.endswith((" ", "."))
                or re.match(r"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", name, re.I)):
            raise ValueError("Bitte gültige PDF-Dateinamen mit höchstens 180 Zeichen verwenden.")
        key = name.casefold()
        if key in seen:
            raise ValueError("Mehrere Dateien haben denselben neuen Namen. Bitte die Vorschau korrigieren.")
        seen.add(key)
