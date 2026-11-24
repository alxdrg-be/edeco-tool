"""Explicit OS folder opening shared by tools; paths must already be reachable."""

import os
import subprocess
import sys
from pathlib import Path


def open_folder(value):
    path = Path(value)
    if not value or not path.is_absolute() or not path.is_dir():
        raise ValueError("Der Projektordner ist auf diesem PC nicht erreichbar. Bitte Pfad und Netzlaufwerk prüfen.")
    if sys.platform == "win32":
        os.startfile(str(path))
    elif sys.platform == "darwin":
        subprocess.Popen(["open", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        subprocess.Popen(["xdg-open", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
