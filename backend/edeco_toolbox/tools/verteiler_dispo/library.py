"""Read-only company JSON library with an atomic, verified local snapshot.

Only settings and validated cache files are written below the module data home.
The selected company/server file is never changed. Stored project documents are
self-contained copies, so reloading this library cannot rewrite an old plan.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PureWindowsPath
import threading
from typing import Annotated, Callable, Literal
from uuid import uuid4

from pydantic import ConfigDict, Field, ValidationError, field_validator, model_validator

from .models import DeviceProfile, DistributionDocument, Record, SourceRef
from .store import Conflict

MAX_LIBRARY_BYTES = 2 * 1024 * 1024
MAX_SETTINGS_BYTES = 20 * 1024


class LibraryPack(Record):
    schema_version: Literal[1]
    sources: Annotated[list[SourceRef], Field(max_length=300)] = []
    profiles: Annotated[list[DeviceProfile], Field(max_length=500)] = []
    documents: Annotated[list[DistributionDocument], Field(max_length=100)] = []

    @field_validator('schema_version', mode='before')
    @classmethod
    def exact_version(cls, value):
        if type(value) is not int or value != 1:
            raise ValueError('Erwartet wird Firmenbibliothek-Dateiversion 1.')
        return value

    @model_validator(mode='after')
    def unique_records(self):
        for records in (self.sources, self.profiles, self.documents):
            ids = [record.id for record in records]
            if len(ids) != len(set(ids)):
                raise ValueError('Bibliothekseinträge benötigen eindeutige IDs.')
        if any(not record.id.startswith('firma:') for record in [*self.sources, *self.profiles]):
            raise ValueError('Eigene Quellen-/Profil-IDs beginnen mit firma:.')
        return self


class LibrarySettings(Record):
    model_config = ConfigDict(extra='forbid', strict=True)
    schema_version: Literal[1] = 1
    revision: Annotated[str, Field(min_length=1, max_length=64)] = '0'
    path: Annotated[str, Field(max_length=1500)] = ''
    sha256: Annotated[str, Field(pattern=r'^(?:[0-9a-f]{64})?$')] = ''
    cached_path: Annotated[str, Field(max_length=1500)] = ''
    loaded_at: Annotated[str, Field(max_length=80)] = ''

    @field_validator('schema_version', mode='before')
    @classmethod
    def exact_version(cls, value):
        if type(value) is not int or value != 1:
            raise ValueError('Unbekannte Einstellungsversion.')
        return value


def _unique_json(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Doppelte JSON-Schlüssel sind nicht erlaubt.')
        result[key] = value
    return result


def _invalid_constant(_value):
    raise ValueError('Nicht endliche JSON-Zahlen sind nicht erlaubt.')


def _read_json(raw: bytes):
    return json.loads(raw.decode('utf-8-sig'), object_pairs_hook=_unique_json,
                      parse_constant=_invalid_constant)


def _bounded_read(path: Path, limit: int) -> bytes:
    # Reading one bounded stream also covers a file that grows after stat().
    with path.open('rb') as stream:
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Die Firmenbibliothek ist zu gross (maximal 2 MiB).')
    return data


def _factory_catalog() -> dict:
    from .catalog import get_catalog
    return get_catalog()


def _validate_pack(raw: bytes, base: dict | None = None) -> LibraryPack:
    try:
        pack = LibraryPack.model_validate(_read_json(raw))
    except (ValidationError, ValueError, UnicodeError, TypeError, RecursionError) as error:
        raise ValueError('Die Firmenbibliothek enthält ungültige oder nicht unterstützte Daten. Dateiversion, eindeutige IDs und Quellen-/Objektverweise prüfen.') from error
    base = _factory_catalog() if base is None else base
    factory_sources = {item['id'] for item in base.get('sources', [])}
    factory_profiles = {item['id'] for item in base.get('profiles', [])}
    own_sources = {item.id for item in pack.sources}
    if own_sources & factory_sources or {item.id for item in pack.profiles} & factory_profiles:
        raise ValueError('Firmenprofile dürfen mitgelieferte Profile oder Quellen nicht überschreiben.')
    if {'firma:' + document.id for document in pack.documents} & {item['id'] for item in base.get('templates', [])}:
        raise ValueError('Eine Firmenvorlage darf keine mitgelieferte Vorlage überschreiben.')
    available_sources = own_sources | factory_sources
    if any(set(profile.source_ids) - available_sources for profile in pack.profiles):
        raise ValueError('Ein Firmenprofil verweist auf eine unbekannte Quelle.')
    return pack


class ProfileLibrary:
    def __init__(self, data_home: Path):
        self.home = Path(data_home)
        self.settings_path = self.home / 'library-settings.json'
        self.cache_home = self.home / 'library-cache'
        self._lock = threading.RLock()
        self._last_error = ''
        self._offline = False

    def _settings(self) -> LibrarySettings:
        if not self.settings_path.exists():
            return LibrarySettings()
        try:
            return LibrarySettings.model_validate(_read_json(_bounded_read(self.settings_path, MAX_SETTINGS_BYTES)))
        except (ValueError, OSError, UnicodeError, TypeError, RecursionError) as error:
            raise ValueError('Die Bibliothekseinstellungen konnten nicht gelesen werden. Die vorhandene Datei wurde nicht ersetzt.') from error

    @staticmethod
    def _atomic_write(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f'.{path.name}-{uuid4().hex}.tmp')
        try:
            with temporary.open('xb') as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)

    def _save_settings(self, settings: LibrarySettings) -> None:
        data = json.dumps(settings.model_dump(), ensure_ascii=False, indent=2).encode('utf-8')
        self._atomic_write(self.settings_path, data)

    def _cached(self, settings: LibrarySettings, base: dict | None = None) -> LibraryPack | None:
        if not settings.path or not settings.sha256:
            return None
        raw = _bounded_read(self.cache_home / f'{settings.sha256}.json', MAX_LIBRARY_BYTES)
        if hashlib.sha256(raw).hexdigest() != settings.sha256:
            raise ValueError('Die lokale Firmenbibliothek hat eine abweichende Prüfsumme. Sie wurde nicht verwendet oder ersetzt.')
        return _validate_pack(raw, base)

    def status(self) -> dict:
        with self._lock:
            try:
                settings = self._settings()
            except ValueError as error:
                return {'revision': 'unreadable', 'path': '', 'configured': False, 'sha256': '',
                        'loaded_at': '', 'cached_path': '', 'offline': False, 'using_cache': False,
                        'needs_reload': False, 'error': str(error), 'profiles_count': 0, 'templates_count': 0}
            error = self._last_error
            pack = None
            try:
                pack = self._cached(settings)
            except (OSError, ValueError) as cache_error:
                error = str(cache_error) if isinstance(cache_error, ValueError) else 'Der lokale Bibliotheksstand ist nicht erreichbar. Vorhandene Dateien bleiben erhalten.'
            needs_reload = bool(settings.path and settings.path != settings.cached_path)
            return {'revision': settings.revision, 'path': settings.path, 'configured': bool(settings.path),
                    'sha256': settings.sha256, 'loaded_at': settings.loaded_at, 'cached_path': settings.cached_path,
                    'offline': self._offline, 'using_cache': pack is not None, 'needs_reload': needs_reload,
                    'error': error, 'profiles_count': len(pack.profiles) if pack else 0,
                    'templates_count': len(pack.documents) if pack else 0}

    def configure(self, path: str, base_revision: str) -> dict:
        if not isinstance(path, str) or not isinstance(base_revision, str):
            raise ValueError('Pfad und Basisrevision müssen Text sein.')
        path = path.strip()
        if len(path) > 1 and path.startswith('"') and path.endswith('"'):
            path = path[1:-1]
        if len(path) > 1500 or '\x00' in path:
            raise ValueError('Der Bibliothekspfad ist ungültig oder zu lang.')
        if path and (not (Path(path).is_absolute() or PureWindowsPath(path).is_absolute())
                     or Path(path).suffix.lower() != '.json'):
            raise ValueError('Bitte einen absoluten Pfad zu einer JSON-Datei angeben, zum Beispiel einen UNC-Firmenpfad.')
        if path:
            candidate = Path(path).resolve()
            if candidate == self.settings_path.resolve() or candidate.is_relative_to(self.cache_home.resolve()):
                raise ValueError('Als Quelle bitte eine eigene Bibliotheksdatei wählen, nicht die internen Einstellungen oder Cache-Dateien.')
        with self._lock:
            current = self._settings()
            if current.revision != base_revision:
                raise Conflict('Die Bibliothekseinstellungen wurden inzwischen geändert. Bitte neu laden; deine Vorlage wurde nicht überschrieben.')
            updated = current.model_copy(update={'path': path, 'revision': str(uuid4())})
            self._save_settings(updated)
            self._last_error = ''
            self._offline = False
            return self.status()

    def reload(self) -> dict:
        with self._lock:
            settings = self._settings()
            if not settings.path:
                raise ValueError('Zuerst eine Firmenbibliothek-Datei auswählen und den Pfad speichern.')
            try:
                raw = _bounded_read(Path(settings.path), MAX_LIBRARY_BYTES)
                _validate_pack(raw)
                digest = hashlib.sha256(raw).hexdigest()
                self._atomic_write(self.cache_home / f'{digest}.json', raw)
                updated = settings.model_copy(update={'sha256': digest, 'cached_path': settings.path,
                                                       'loaded_at': datetime.now(timezone.utc).isoformat(),
                                                       'revision': str(uuid4())})
                self._save_settings(updated)
            except OSError:
                self._last_error = 'Die Firmenbibliothek ist nicht erreichbar oder konnte nicht lokal gesichert werden. Der bisherige geprüfte Bibliotheksstand bleibt erhalten.'
                self._offline = True
            except ValueError as error:
                self._last_error = str(error)
                self._offline = False
            else:
                self._last_error = ''
                self._offline = False
            return self.status()

    def merge_catalog(self, base_dict: dict) -> dict:
        with self._lock:
            result = deepcopy(base_dict)
            try:
                pack = self._cached(self._settings(), result)
            except (OSError, ValueError):
                return result
            if pack is None:
                return result
            result.setdefault('sources', []).extend(s.model_dump(mode='json') for s in pack.sources)
            result.setdefault('profiles', []).extend(p.model_dump(mode='json') for p in pack.profiles)
            result.setdefault('templates', []).extend(
                {'id': 'firma:' + d.id, 'name': d.name or d.cabinet.name,
                 'description': 'Firmenvorlage als eigener Dokumentstand; Quellen und Nachweise prüfen.',
                 'status': 'Firmenvorlage · Nachweise offen'} for d in pack.documents)
            return result

    def build_document(self, template_id: str, vnb_id: str,
                       base_builder: Callable[[str, str], dict]) -> dict:
        if not template_id.startswith('firma:'):
            return base_builder(template_id, vnb_id)
        if vnb_id not in ('none', 'iwb', 'primeo', 'ebl'):
            raise ValueError('Unbekannter Netzbetreiber.')
        with self._lock:
            pack = self._cached(self._settings())
            source = next((d for d in pack.documents if 'firma:' + d.id == template_id), None) if pack else None
            if source is None:
                raise KeyError('Firmenvorlage nicht gefunden.')
            data = source.model_dump(mode='json')
            data.update(id=str(uuid4()), revision=0, project_id=None, project_number='', project_name='',
                        location='', author='', drawing_number='', schematic_ref='', index='', date=date.today().isoformat())
            for placement in data['cabinet']['placements']:
                placement['source_circuit_id'] = None
            if vnb_id != data['vnb_id']:
                data['vnb_id'] = vnb_id
                data['vnb_profile_version'] = ''
                if vnb_id != 'none':
                    # Prefer the firm's frozen source snapshot. Selecting another
                    # operator must not silently rewrite existing source versions.
                    operator_sources = [s for s in data['sources'] if vnb_id in (s['id'] + ' ' + s['issuer']).lower()]
                    if operator_sources:
                        data['vnb_profile_version'] = 'Firmen-Snapshot: ' + operator_sources[0]['edition']
                    else:
                        base = base_builder('uv-basic', vnb_id)
                        existing = {s['id'] for s in data['sources']}
                        data['sources'].extend(s for s in base['sources'] if s['id'] not in existing
                                               and vnb_id in (s['id'] + ' ' + s['issuer']).lower())
                        data['vnb_profile_version'] = base['vnb_profile_version']
            return DistributionDocument.model_validate(data).model_dump(mode='json')
