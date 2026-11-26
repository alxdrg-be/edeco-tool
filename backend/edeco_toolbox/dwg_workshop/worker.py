"""Disposable process for CPU-intensive DXF rendering and export."""

import json
from pathlib import Path
import sys


def main(argv):
    if len(argv) != 2 or argv[0] not in {"preview", "export"}:
        return 2
    operation, raw_directory = argv
    directory = Path(raw_directory)
    try:
        from .engine import run_job
        from .profile import Profile

        source = directory / "source.dxf"
        profile = Profile.model_validate_json((directory / "profile.json").read_bytes())
        result = run_job(operation, source if source.is_file() else None, profile, directory / "result.dxf")
        if result is not None:
            (directory / "result.json").write_text(json.dumps(result, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    except (ValueError, ArithmeticError, RecursionError) as exc:
        error = str(exc) if type(exc) is ValueError and str(exc).startswith(
            ("Zu viele", "Mehr als", "Vorschau zu umfangreich")
        ) else "Diese DXF-Datei konnte nicht vollständig gelesen oder dargestellt werden."
        (directory / "error.txt").write_text(error, encoding="utf-8")
        return 2
    except Exception:  # DXF parsers and native geometry may raise several format-specific exceptions
        (directory / "error.txt").write_text("Die Arbeitskopie konnte nicht verarbeitet werden. "
                                             "Bitte die Quelldatei auf Lesbarkeit prüfen.", encoding="utf-8")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
