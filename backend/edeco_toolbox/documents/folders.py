"""Explicit read-only folder sources; only local indexed copies are managed."""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import threading

from .extract import MAX_BYTES
from .store import DocumentStore

MAX_FILES = 200
MAX_FOLDER_BYTES = 250 * 1024 * 1024
MAX_ENTRIES = 5000
MAX_STATE_BYTES = 8 * 1024 * 1024
KINDS = frozenset({".pdf", ".txt", ".md"})
DOCUMENT_ID = re.compile(r"^[0-9a-f]{32}$")
IS_WINDOWS = os.name == "nt"


class FolderBusyError(ValueError):
    pass


def _linked(info: os.stat_result) -> bool:
    return stat.S_ISLNK(info.st_mode) or bool(
        getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 1024))


def _same_file(left: os.stat_result, right: os.stat_result) -> bool:
    return (left.st_dev, left.st_ino) == (right.st_dev, right.st_ino)


def _plain_windows_path(value: str) -> str:
    if value.startswith("\\\\?\\UNC\\"):
        return "\\\\" + value[8:]
    return value[4:] if value.startswith("\\\\?\\") else value


def _relative(value: str) -> bool:
    path = PurePosixPath(value)
    return bool(value) and not path.is_absolute() and "\\" not in value and all(part not in {"", ".", ".."} for part in value.split("/"))


@dataclass(frozen=True)
class Candidate:
    relative: Path
    info: os.stat_result


def _check_directory(root: Path, relative: Path, expected: os.stat_result) -> None:
    path = root
    info = path.lstat()
    if _linked(info) or not stat.S_ISDIR(info.st_mode) or not _same_file(info, expected) or path.resolve(strict=True) != root:
        raise ValueError("Der verbundene Ordner wurde verändert. Bitte erneut verbinden.")
    for part in relative.parts:
        path = path / part
        info = path.lstat()
        if _linked(info) or not stat.S_ISDIR(info.st_mode):
            raise ValueError("Eine Verknüpfung oder ein veränderter Unterordner wurde nicht gelesen.")


def _windows_handle_path(descriptor: int) -> Path:
    """Resolve the opened handle, rather than trusting a path checked before open."""
    import ctypes
    from ctypes import wintypes
    import msvcrt

    function = ctypes.WinDLL("kernel32", use_last_error=True).GetFinalPathNameByHandleW
    function.argtypes = [wintypes.HANDLE, wintypes.LPWSTR, wintypes.DWORD, wintypes.DWORD]
    function.restype = wintypes.DWORD
    handle = msvcrt.get_osfhandle(descriptor)
    size = function(handle, None, 0, 0)
    if not 0 < size <= 32768:
        raise OSError("Der geöffnete Dateipfad konnte nicht geprüft werden.")
    buffer = ctypes.create_unicode_buffer(size + 1)
    copied = function(handle, buffer, len(buffer), 0)
    if not copied or copied >= len(buffer):
        raise OSError("Der geöffnete Dateipfad konnte nicht geprüft werden.")
    return Path(_plain_windows_path(buffer.value))


def _read_candidate(root: Path, candidate: Candidate, root_info: os.stat_result, allowance: int) -> bytes:
    """Use no-follow directory descriptors where supported; verify Windows handles."""
    relative = candidate.relative
    _check_directory(root, relative.parent, root_info)
    target = root / relative
    before = target.lstat()
    if _linked(before) or not stat.S_ISREG(before.st_mode) or not _same_file(before, candidate.info):
        raise ValueError("Die Datei wurde während der Aktualisierung verändert; die bisherige Kopie bleibt erhalten.")
    descriptors: list[int] = []
    flags = os.O_RDONLY | getattr(os, "O_BINARY", 0) | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_NOFOLLOW", 0)
    try:
        if os.open in os.supports_dir_fd and hasattr(os, "O_NOFOLLOW"):
            directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
            directory = os.open(root, directory_flags)
            descriptors.append(directory)
            if not _same_file(os.fstat(directory), root_info):
                raise ValueError("Der verbundene Ordner wurde während der Aktualisierung ausgetauscht.")
            for part in relative.parts[:-1]:
                directory = os.open(part, directory_flags, dir_fd=directory)
                descriptors.append(directory)
            descriptor = os.open(relative.name, flags, dir_fd=directory)
        else:
            descriptor = os.open(target, flags)
        descriptors.append(descriptor)
        opened = os.fstat(descriptor)
        if _linked(opened) or not stat.S_ISREG(opened.st_mode) or not _same_file(opened, candidate.info):
            raise ValueError("Eine ausgetauschte Datei oder Verknüpfung wurde nicht gelesen.")
        _check_directory(root, relative.parent, root_info)
        after = target.lstat()
        if _linked(after) or not _same_file(after, opened) or not target.resolve(strict=True).is_relative_to(root):
            raise ValueError("Die Datei liegt nicht mehr im verbundenen Ordner.")
        if IS_WINDOWS and not _windows_handle_path(descriptor).is_relative_to(root):
            raise ValueError("Der geöffnete Dateipfad liegt ausserhalb des verbundenen Ordners.")
        if opened.st_size > MAX_BYTES or opened.st_size > allowance:
            raise ValueError("Die Datei ist während der Aktualisierung gewachsen; bitte einen kleineren Ordner wählen.")
        with os.fdopen(descriptor, "rb", closefd=False) as stream:
            content = stream.read(min(MAX_BYTES, allowance) + 1)
        finished = os.fstat(descriptor)
        if (finished.st_size, finished.st_mtime_ns, finished.st_ctime_ns) != (opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns):
            raise ValueError("Die Datei wird gerade bearbeitet. Bitte die Aktualisierung danach erneut starten.")
        return content
    finally:
        for descriptor in reversed(descriptors):
            os.close(descriptor)


class FolderSource:
    def __init__(self, store: DocumentStore):
        self.store = store
        self.file = store.home / "folder.json"
        self.lock = threading.Lock()

    @contextmanager
    def operation(self):
        if not self.lock.acquire(blocking=False):
            raise FolderBusyError("Die Ordneraktualisierung läuft noch. Bitte kurz warten.")
        try:
            yield
        finally:
            self.lock.release()

    def read(self):
        try:
            with self.file.open("rb") as stream:
                content = stream.read(MAX_STATE_BYTES + 1)
        except FileNotFoundError:
            return {"path": "", "recursive": True, "files": {}, "owned": []}
        try:
            data = json.loads(content) if len(content) <= MAX_STATE_BYTES else None
            if not isinstance(data, dict) or not isinstance(data.get("path", ""), str):
                raise ValueError
            files = data.get("files", {})
            owned = data.get("owned", [])
            if not isinstance(files, dict) or not isinstance(owned, list):
                raise ValueError
            return {"path": data.get("path", ""), "recursive": data.get("recursive") is not False,
                    "last_sync": data.get("last_sync"),
                    "files": {key: value for key, value in files.items() if isinstance(key, str) and _relative(key)
                              and isinstance(value, str) and DOCUMENT_ID.fullmatch(value)},
                    "owned": [value for value in owned if isinstance(value, str) and DOCUMENT_ID.fullmatch(value)]}
        except (ValueError, UnicodeError, TypeError):
            raise ValueError("Die Ordnerkonfiguration ist nicht lesbar. Lokale Dokumentkopien bleiben erhalten.") from None

    def write(self, data):
        temporary = self.file.with_suffix(".tmp")
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.file)

    def public(self):
        data = self.read()
        return {key: data.get(key) for key in ("path", "recursive", "last_sync")} | {"linked_files": len(data["files"])}

    def configure(self, path: str, recursive: bool):
        with self.operation():
            path = path.strip()
            if path.startswith('"') and path.endswith('"'):
                path = path[1:-1]
            if not path:
                data = {"path": "", "recursive": bool(recursive), "files": {}, "owned": []}
            else:
                if "\x00" in path or path.startswith(("\\\\.\\", "\\\\?\\")):
                    raise ValueError("Bitte einen normalen absoluten Ordnerpfad oder eine Windows-Freigabe verwenden.")
                root = Path(path)
                if not root.is_absolute():
                    raise ValueError("Bitte einen absoluten Ordnerpfad oder eine Windows-Freigabe angeben.")
                try:
                    info = root.lstat()
                    if not stat.S_ISDIR(info.st_mode) or _linked(info):
                        raise OSError
                    root = root.resolve(strict=True)
                except OSError:
                    raise ValueError("Der Ordner ist nicht erreichbar oder eine Verknüpfung. Bitte Pfad und Leserechte prüfen.") from None
                storage = (self.store.home.resolve(), self.store.originals.resolve())
                if any(root == home or root in home.parents or home in root.parents for home in storage):
                    raise ValueError("Bitte einen Dokumentordner ausserhalb des Toolhub-Datenordners wählen.")
                data = self.read()
                if str(root) != data.get("path"):
                    data = {"path": str(root), "files": {}, "owned": []}
                data["recursive"] = bool(recursive)
            self.write(data)
            return self.public()

    def add_manual(self, content: bytes, filename: str, title: str = "", edition: str = ""):
        with self.operation():
            try:
                data = self.read()
            except (ValueError, OSError):
                # Invalid folder metadata cannot sync or delete anything. A
                # manual upload must still work, and disconnect keeps all copies.
                data = None
            result = self.store.add(content, filename, title, edition)
            identifier = result["document"]["id"]
            if data and identifier in data["owned"]:
                data["owned"].remove(identifier)
                self.write(data)
            return result

    def remove_document(self, identifier: str):
        with self.operation():
            self.store.remove(identifier)

    def _scan(self, root: Path, recursive: bool, root_info: os.stat_result):
        candidates, skipped, directories = [], [], [Path()]
        entries = total = 0
        while directories:
            relative = directories.pop()
            _check_directory(root, relative, root_info)
            with os.scandir(root / relative) as listing:
                for entry in listing:
                    entries += 1
                    if entries > MAX_ENTRIES:
                        raise ValueError("Bitte einen kleineren Unterordner mit höchstens 5000 Einträgen wählen.")
                    child = relative / entry.name
                    info = entry.stat(follow_symlinks=False)
                    if _linked(info):
                        skipped.append(child.as_posix())
                    elif stat.S_ISDIR(info.st_mode):
                        if recursive:
                            directories.append(child)
                    elif stat.S_ISREG(info.st_mode) and child.suffix.lower() in KINDS:
                        if info.st_size > MAX_BYTES:
                            raise ValueError(f"{entry.name}: höchstens 100 MB pro Datei. Bitte einen kleineren Unterordner wählen.")
                        total += info.st_size
                        candidates.append(Candidate(child, info))
                        if len(candidates) > MAX_FILES or total > MAX_FOLDER_BYTES:
                            raise ValueError("Pro Ordner höchstens 200 Dokumente und 250 MB. Bitte einen Unterordner wählen.")
        return sorted(candidates, key=lambda item: item.relative.as_posix()), skipped

    def sync(self):
        with self.operation():
            data = self.read()
            if not data.get("path"):
                raise ValueError("Bitte zuerst einen Dokumentordner verbinden.")
            root = Path(data["path"])
            try:
                root_info = root.lstat()
                candidates, skipped = self._scan(root, data["recursive"], root_info)
            except OSError:
                raise ValueError("Der Ordner ist nicht erreichbar oder nicht vollständig lesbar. Lokale Kopien bleiben erhalten.") from None
            previous = data["files"]
            owned = set(data["owned"])
            available = {document["id"] for document in self.store.list()}
            current = {name: identifier for name, identifier in previous.items() if identifier in available
                       and any(name == link or name.startswith(link + "/") for link in skipped)}
            errors = ([f"{len(skipped)} Verknüpfungen/Junctions wurden ausgelassen; frühere lokale Kopien bleiben erhalten."] if skipped else [])
            added = unchanged = budget = 0
            for candidate in candidates:
                relative = candidate.relative.as_posix()
                try:
                    allowance = MAX_FOLDER_BYTES - budget
                    if allowance <= 0:
                        raise ValueError("Die Gesamtgrösse wurde während der Aktualisierung überschritten.")
                    content = _read_candidate(root, candidate, root_info, allowance)
                    budget += len(content)
                    if len(content) > MAX_BYTES or budget > MAX_FOLDER_BYTES:
                        raise ValueError("Dateien sind während der Aktualisierung gewachsen; bitte erneut prüfen.")
                    result = self.store.add(content, candidate.relative.name, title=relative, edition="Ordnerimport")
                    identifier = result["document"]["id"]
                    current[relative] = identifier
                    if not result["duplicate"]:
                        owned.add(identifier)
                    if previous.get(relative) == identifier:
                        unchanged += 1
                    else:
                        added += 1
                except (ValueError, OSError) as error:
                    errors.append(f"{relative}: {error}")
                    if previous.get(relative) in available:
                        current[relative] = previous[relative]
            data.update(files=current, owned=sorted(owned), last_sync=datetime.now(timezone.utc).isoformat())
            self.write(data)
            removed = 0
            for identifier in owned - set(current.values()):
                try:
                    self.store.remove(identifier)
                    removed += 1
                except KeyError:
                    pass
                except OSError:
                    errors.append("Eine alte lokale Dokumentkopie konnte nicht entfernt werden.")
                    continue
                owned.discard(identifier)
            data["owned"] = sorted(owned)
            self.write(data)
            return {"folder": self.public(), "documents": self.store.list(), "added": added,
                    "unchanged": unchanged, "removed": removed, "errors": errors}
