"""Paths and per-user settings.

Two storage places:

* local data folder (per Windows user): settings.json and the library cache
  %LOCALAPPDATA%\\NOVA-Legenden  (Linux/macOS: ~/.local/share/NOVA-Legenden)
* company folder (shared, e.g. on T:): edeco ag-Legenden-firma.sqlite with
  categories and assignments that apply to everyone. Set in the settings page.

The environment variable NOVA_LEGENDEN_HOME overrides the local folder
(used by the tests).
"""

from __future__ import annotations

import getpass
import json
import os
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

APP_NAME = "NOVA-Legenden"
APP_VERSION = "0.1.0"
GITHUB_REPO = "Dobolino/NOVA-Legenden-Tool"


def build_number() -> int:
    """Build number written by the Windows build (0 = started from source)."""
    try:
        from ._build import BUILD
        return int(BUILD)
    except (ImportError, ValueError):
        return 0


# Folder searched for Nova datasets (.nzp). At edeco all datasets that are
# used live here; other folders (e.g. installer copies on T:) are not searched.
DATASET_SEARCH_ROOTS = [
    r"C:\Users\Public\Documents\Trimble\Warehouse",
]
DATASET_PATTERN = "*.nzp"


def dataset_summary(path: Path) -> tuple[str, int] | None:
    """(dataset id, number of symbols) for a Nova electrical dataset, else None.

    Electrical = DataFormat 'nova…_elo'. The Warehouse folder also holds HVAC and
    sanitary datasets; they are skipped.
    """
    import zipfile

    from .parser import tree

    try:
        with zipfile.ZipFile(path) as zf:
            attrs = tree.parse(zf.read("Set")).root.attrs
            if not attrs.get("DataFormat", "").endswith("_elo"):
                return None
            graphic = tree.parse(zf.read("Graphic")).root if "Graphic" in zf.namelist() else None
    except Exception:  # noqa: BLE001 - unreadable files are simply skipped
        return None
    count = sum(1 for g in graphic.find_all("GraphicItem") if g.get("Item")) if graphic else 0
    return attrs.get("ID", path.stem), count


def is_electrical_dataset(path: Path) -> bool:
    return dataset_summary(path) is not None


def local_home() -> Path:
    env = os.environ.get("NOVA_LEGENDEN_HOME")
    if env:
        path = Path(env)
    elif sys.platform == "win32":
        path = Path(os.environ.get("LOCALAPPDATA", Path.home())) / APP_NAME
    else:
        path = Path.home() / ".local" / "share" / APP_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def current_user() -> str:
    try:
        return getpass.getuser()
    except Exception:  # noqa: BLE001 - getuser can fail in odd environments
        return "unbekannt"


def resource_dir() -> Path:
    """Folder with bundled files (UI build). Works for source and PyInstaller."""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    return Path(__file__).resolve().parents[2]


# No firm path is shipped. Each company types its own folder in the settings.
# Empty means: projects stay on this computer, in the local data folder.
DEFAULT_PROJECTS_FOLDER = ""
COMPANY_DB_NAME = "edeco ag-Legenden-firma.sqlite"
LEGACY_COMPANY_DB_NAME = "firma.sqlite"


def resolve_company_db(folder: Path) -> Path:
    """Path of the shared company file.

    Older installs used firma.sqlite. If that file is still there and the new
    name is not, it is renamed once and then reused.
    """
    folder = Path(folder)
    current = folder / COMPANY_DB_NAME
    legacy = folder / LEGACY_COMPANY_DB_NAME
    if legacy.is_file() and not current.exists():
        try:
            legacy.rename(current)
        except OSError:
            return legacy
    return current


# Nova's stencil folder of this Windows user, per Nova version ({nova} = 19, 20 ...).
# A path of one company (for example an OneDrive folder) is not the default.
DEFAULT_STENCIL_FOLDER = r"%USERPROFILE%\Documents\Trimble\nova{nova}\Stencils"


@dataclass
class Settings:
    dataset_paths: list[str] = field(default_factory=list)
    company_folder: str = ""
    projects_folder: str = DEFAULT_PROJECTS_FOLDER
    nova_version: str = "19.2"
    oda_path: str = ""
    ui_theme: str = "system"          # "system", "light" or "dark" (this computer)
    update_channel: str = "stable"    # "stable": builds of main, "test": also development builds
    stencil_folder: str = DEFAULT_STENCIL_FOLDER   # Benutzerschablonen (this computer, this user)

    @property
    def company_db(self) -> Path:
        folder = Path(self.company_folder) if self.company_folder else local_home()
        return resolve_company_db(folder)


def settings_file() -> Path:
    return local_home() / "settings.json"


def load_settings() -> Settings:
    path = settings_file()
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            known = {k: v for k, v in data.items() if k in Settings.__dataclass_fields__}
            return Settings(**known)
        except (ValueError, TypeError):
            pass
    return Settings()


def save_settings(settings: Settings) -> None:
    path = settings_file()
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(asdict(settings), ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def find_datasets(roots: list[str] | None = None, max_depth: int = 7,
                  skip_ids: set[str] | None = None) -> list[str]:
    """Search the Nova folder for electrical datasets.

    Skips empty catalogues (no symbols), datasets whose id is in ``skip_ids``
    and further copies of a dataset that was already found.
    """
    found: list[str] = []
    seen: set[str] = set(skip_ids or ())
    for root in roots or DATASET_SEARCH_ROOTS:
        base = Path(root)
        if not base.is_dir():
            continue
        try:
            walk = sorted(os.walk(base), key=lambda w: w[0])
        except OSError:
            continue
        for dirpath, dirnames, filenames in walk:
            if len(Path(dirpath).relative_to(base).parts) >= max_depth:
                continue
            for name in sorted(filenames):
                path = Path(dirpath) / name
                if not path.match(DATASET_PATTERN):
                    continue
                summary = dataset_summary(path)
                if not summary or summary[1] == 0 or summary[0] in seen:
                    continue
                seen.add(summary[0])
                found.append(str(path))
    return found


ODA_PATH_MESSAGE = (
    "ODA File Converter bitte lokal im Standardordner Programme/ODA/ODAFileConverter… "
    "installieren. Netzwerkpfade und andere Programme werden nicht ausgeführt. "
    "Alternativ eine DXF-Datei verwenden."
)


class InvalidODAPath(ValueError):
    """A configured executable is not a trusted local converter installation."""


def _network_or_device_path(value: str) -> bool:
    # Check the spelling before any filesystem lookup, including on non-Windows
    # hosts. UNC and Win32 device paths must never trigger a network lookup.
    return value.replace("\\", "/").startswith("//")


def _nonlocal_drive(path: Path) -> bool:
    if sys.platform != "win32":
        return False
    import ctypes

    try:
        get_drive_type = ctypes.windll.kernel32.GetDriveTypeW
        get_drive_type.argtypes = [ctypes.c_wchar_p]
        get_drive_type.restype = ctypes.c_uint
        drive_type = get_drive_type(str(path.anchor))
    except (AttributeError, OSError, TypeError):
        return True
    # Reject mapped network drives, unknown drives and inaccessible roots.
    # DRIVE_REMOVABLE, DRIVE_FIXED and DRIVE_RAMDISK are local storage.
    return drive_type not in {2, 3, 6}


def _oda_installation_roots() -> list[Path]:
    roots: list[Path] = []
    for name in ("ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"):
        base = os.environ.get(name, "")
        if not base or _network_or_device_path(base):
            continue
        root = Path(base) / "ODA"
        if root.is_absolute() and not _nonlocal_drive(root) and root not in roots:
            roots.append(root)
    return roots


def _canonical_oda_root(root: Path) -> Path:
    program_root = root.parent.resolve(strict=True)
    installed_root = root.resolve(strict=True)
    if (installed_root.parent != program_root or installed_root.name.casefold() != "oda"
            or _network_or_device_path(str(installed_root)) or _nonlocal_drive(installed_root)):
        raise InvalidODAPath(ODA_PATH_MESSAGE)
    return installed_root


def validate_oda_converter(value: str | Path) -> str:
    """Allow only the installed converter in an OS-protected vendor directory.

    Neither a matching filename in a writable download folder nor a network
    executable is trusted. Revalidate at execution time so old settings and
    symlinks cannot bypass the installation boundary. Program Files roots come
    from the desktop process environment, never from an API request.
    """
    raw = str(value)
    if not raw or _network_or_device_path(raw):
        raise InvalidODAPath(ODA_PATH_MESSAGE)
    candidate = Path(raw)
    if (not candidate.is_absolute() or candidate.name.casefold() != "odafileconverter.exe"
            or _nonlocal_drive(candidate)):
        raise InvalidODAPath(ODA_PATH_MESSAGE)
    for root in _oda_installation_roots():
        try:
            # Reject arbitrary paths before resolving or checking their files.
            relative = candidate.relative_to(root)
            if len(relative.parts) != 2 or not relative.parts[0].casefold().startswith("odafileconverter"):
                continue
            installed_root = _canonical_oda_root(root)
            resolved = candidate.resolve(strict=True)
            actual = resolved.relative_to(installed_root)
            if (len(actual.parts) == 2 and actual.parts[0].casefold().startswith("odafileconverter")
                    and actual.parts[1].casefold() == "odafileconverter.exe"
                    and not _network_or_device_path(str(resolved)) and not _nonlocal_drive(resolved)
                    and resolved.is_file()):
                return str(resolved)
        except (OSError, RuntimeError, ValueError):
            continue
    raise InvalidODAPath(ODA_PATH_MESSAGE)


def find_oda_converter() -> str:
    """Return a validated standard ODA installation, or '' if not installed."""
    candidates: list[Path] = []
    for root in _oda_installation_roots():
        try:
            # Do not enumerate a vendor directory redirected outside Program Files.
            _canonical_oda_root(root)
            candidates.extend(root.glob("ODAFileConverter*/ODAFileConverter.exe"))
        except (OSError, RuntimeError, ValueError):
            continue
    for candidate in sorted(candidates, reverse=True):
        try:
            return validate_oda_converter(candidate)
        except InvalidODAPath:
            continue
    return ""


def resolve_oda_converter(configured: str = "") -> str:
    """Ignore unsafe legacy settings and rediscover only a trusted installation."""
    if configured:
        try:
            return validate_oda_converter(configured)
        except InvalidODAPath:
            pass
    return find_oda_converter()
