"""Per-user Toolbox files live outside the installation and survive updates."""

import os
import sys
from pathlib import Path


def local_home() -> Path:
    if os.environ.get("EDECO_TOOLBOX_HOME"):
        return Path(os.environ["EDECO_TOOLBOX_HOME"])
    if os.environ.get("NOVA_LEGENDEN_HOME"):
        return Path(os.environ["NOVA_LEGENDEN_HOME"]) / "toolbox"
    if sys.platform == "win32":
        return Path(os.environ.get("LOCALAPPDATA", Path.home())) / "edeco-Toolbox"
    return Path.home() / ".local" / "share" / "edeco-Toolbox"
