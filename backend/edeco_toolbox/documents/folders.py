"""Explicit, read-only folder import into the user's local document library."""
import json
import os
import stat
import threading
from pathlib import Path

from .extract import MAX_BYTES


class FolderSource:
    def __init__(self, store):
        self.store = store
        self.file = store.home / 'folder.json'
        self.lock = threading.Lock()

    def read(self):
        try:
            return json.loads(self.file.read_text(encoding='utf-8'))
        except FileNotFoundError:
            return {'path': '', 'recursive': True, 'files': {}, 'owned': []}

    def write(self, data):
        temporary = self.file.with_suffix('.tmp')
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        temporary.replace(self.file)

    def public(self):
        data = self.read()
        return {key: data.get(key) for key in ('path', 'recursive', 'last_sync')} | {'linked_files': len(data.get('files', {}))}

    def configure(self, path, recursive):
        if not self.lock.acquire(blocking=False):
            raise ValueError('Die Ordneraktualisierung läuft noch.')
        try:
            data = self.read()
            if path:
                root = Path(path.strip().strip('"'))
                if not root.is_absolute() or not root.is_dir():
                    raise ValueError(r'Bitte einen erreichbaren absoluten Ordnerpfad angeben, z. B. \\SERVER\Unterlagen.')
                # Never read the library's own copies back into itself.
                root = root.resolve()
                if root == self.store.home.resolve() or root in self.store.home.resolve().parents or self.store.home.resolve() in root.parents:
                    raise ValueError('Bitte einen Dokumentordner ausserhalb des Toolbox-Datenordners wählen.')
                path = str(root)
            if path != data.get('path'):
                data = {'path': path, 'files': {}, 'owned': []}
            data['recursive'] = recursive
            self.write(data)
            return self.public()
        finally:
            self.lock.release()

    def sync(self):
        if not self.lock.acquire(blocking=False):
            raise ValueError('Die Ordneraktualisierung läuft noch.')
        try:
            return self._sync()
        finally:
            self.lock.release()

    def _sync(self):
        from datetime import datetime, timezone
        data = self.read()
        if not data.get('path'):
            raise ValueError('Bitte zuerst einen Dokumentordner verbinden.')
        root = Path(data['path'])
        if not root.is_dir():
            raise ValueError('Der Ordner ist nicht erreichbar. Lokale Dokumentkopien bleiben erhalten.')
        candidates, entries, total = [], 0, 0
        def linked(path):
            info = path.lstat()
            return stat.S_ISLNK(info.st_mode) or bool(getattr(info, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 1024))
        def failed(error):
            raise ValueError('Ein Unterordner ist nicht lesbar. Bitte die Zugriffsrechte prüfen.') from error
        for directory, folders, names in os.walk(root, followlinks=False, onerror=failed):
            entries += len(folders) + len(names)
            if entries > 5000:
                raise ValueError('Bitte einen kleineren Unterordner mit höchstens 5000 Einträgen wählen.')
            folders[:] = [name for name in sorted(folders) if data.get('recursive') and not linked(Path(directory) / name)]
            for name in sorted(names):
                path = Path(directory) / name
                if path.suffix.lower() not in ('.pdf', '.txt', '.md') or linked(path) or not path.is_file():
                    continue
                if not path.resolve().is_relative_to(root.resolve()):
                    continue
                length = path.stat().st_size
                if length > MAX_BYTES:
                    raise ValueError(f'{name}: maximal 100 MB. Bitte einen kleineren Unterordner verwenden.')
                total += length
                candidates.append(path)
                if len(candidates) > 200 or total > 250 * 1024 * 1024:
                    raise ValueError('Pro Ordner sind höchstens 200 Dokumente und 250 MB vorgesehen. Bitte einen Unterordner wählen.')
        previous = data.get('files', {})
        current, errors, added, unchanged = {}, [], 0, 0
        owned = set(data.get('owned', []))
        available = {doc['id'] for doc in self.store.list()}
        budget = 0
        for path in candidates:
            relative = path.relative_to(root).as_posix()
            try:
                remaining = 250 * 1024 * 1024 - budget
                if remaining <= 0:
                    raise ValueError('Gesamtgrösse überschritten; bitte einen kleineren Ordner wählen.')
                with path.open('rb') as stream:
                    content = stream.read(min(MAX_BYTES, remaining) + 1)
                budget += len(content)
                if len(content) > MAX_BYTES or budget > 250 * 1024 * 1024:
                    raise ValueError('Dateien sind während der Aktualisierung gewachsen; bitte erneut prüfen.')
                result = self.store.add(content, path.name, title=relative, edition='Ordnerimport')
                identifier = result['document']['id']
                current[relative] = identifier
                if not result['duplicate']:
                    owned.add(identifier)
                if previous.get(relative) == identifier:
                    unchanged += 1
                else:
                    added += 1
            except (ValueError, OSError) as error:
                errors.append(f'{relative}: {error}')
                if previous.get(relative) in available:
                    current[relative] = previous[relative]
        active = set(current.values())
        # Persist links first. Never remove manually imported duplicate documents.
        data.update(files=current, owned=sorted(owned), last_sync=datetime.now(timezone.utc).isoformat())
        self.write(data)
        removed = 0
        for identifier in owned - active:
            try:
                if identifier in available:
                    self.store.remove(identifier)
                    removed += 1
                owned.discard(identifier)
            except OSError:
                errors.append('Eine alte lokale Dokumentkopie konnte nicht entfernt werden.')
        data['owned'] = sorted(owned)
        self.write(data)
        return {'folder': self.public(), 'documents': self.store.list(), 'added': added,
                'unchanged': unchanged, 'removed': removed, 'errors': errors}
