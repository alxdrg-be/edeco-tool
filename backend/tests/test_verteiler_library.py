"""Company templates are read-only inputs; only validated local snapshots activate."""

from copy import deepcopy
import hashlib
import json

import pytest

from edeco_toolbox.tools.verteiler_dispo.catalog import build_document, get_catalog
from edeco_toolbox.tools.verteiler_dispo.library import MAX_LIBRARY_BYTES, ProfileLibrary
from edeco_toolbox.tools.verteiler_dispo.store import Conflict


def pack():
    doc = build_document('uv-basic', 'iwb')
    doc.update(id='company-uv', name='Firmenstandard UV', project_id='old-project',
               project_number='1294', project_name='Nur altes Projekt', location='Altbau',
               author='Alt', drawing_number='1294-UV', schematic_ref='1294-S', index='C')
    doc['cabinet']['placements'][0]['source_circuit_id'] = 'old-circuit'
    source = {'id': 'firma:source-1', 'issuer': 'Firmenstandard', 'title': 'Interne Geometrievorgabe',
              'url': '', 'edition': '1', 'checked_on': '2026-11-15', 'sha256': '', 'pages': '', 'notes': ''}
    profile = {**doc['profiles'][0], 'id': 'firma:custom', 'name': 'Eigener Baustein',
               'source_ids': [source['id']], 'geometry_status': 'generic'}
    return {'schema_version': 1, 'sources': [source], 'profiles': [profile], 'documents': [doc]}


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    return path.read_bytes()


def activated(tmp_path):
    source = tmp_path / 'company.json'
    raw = write(source, pack())
    library = ProfileLibrary(tmp_path / 'local')
    library.configure(str(source), '0')
    status = library.reload()
    assert not status['error']
    return library, source, raw, status


def test_status_is_read_only_and_source_is_never_written(tmp_path):
    home = tmp_path / 'local'
    library = ProfileLibrary(home)
    assert library.status()['revision'] == '0'
    assert not home.exists()
    source = tmp_path / 'company.json'
    raw = write(source, pack())
    modified = source.stat().st_mtime_ns
    library.configure(str(source), '0')
    status = library.reload()
    assert source.read_bytes() == raw
    assert source.stat().st_mtime_ns == modified
    assert status['using_cache'] and not status['offline']
    assert status['profiles_count'] == status['templates_count'] == 1
    assert status['sha256'] == hashlib.sha256(raw).hexdigest()


def test_merging_and_template_creation_never_modify_factory_or_stored_snapshots(tmp_path):
    library, _, _, _ = activated(tmp_path)
    base = get_catalog()
    before = deepcopy(base)
    merged = library.merge_catalog(base)
    assert base == before
    assert any(item['id'] == 'firma:custom' for item in merged['profiles'])
    assert any(item['id'] == 'firma:company-uv' for item in merged['templates'])
    a = library.build_document('firma:company-uv', 'iwb', build_document)
    b = library.build_document('firma:company-uv', 'iwb', build_document)
    assert a['id'] != b['id'] and a['revision'] == b['revision'] == 0
    assert a['name'] == 'Firmenstandard UV' and a['vnb_id'] == 'iwb'
    assert a['project_id'] is None
    assert all(a[key] == '' for key in ('project_number', 'project_name', 'location', 'author', 'drawing_number', 'schematic_ref', 'index'))
    assert all(p['source_circuit_id'] is None for p in a['cabinet']['placements'])
    a['profiles'][0]['name'] = 'Changed only here'
    assert library.build_document('firma:company-uv', 'iwb', build_document)['profiles'][0]['name'] != 'Changed only here'


@pytest.mark.parametrize('mutate', [
    lambda data: data.update(schema_version=99),
    lambda data: data.update(schema_version=True),
    lambda data: data['profiles'].append(deepcopy(data['profiles'][0])),
    lambda data: data['documents'].append(deepcopy(data['documents'][0])),
    lambda data: data['profiles'][0].update(id='mcb'),
    lambda data: data['profiles'][0].update(source_ids=['firma:missing']),
    lambda data: data['documents'][0]['cabinet']['placements'][0].update(profile_id='missing'),
    lambda data: data.update(script='not allowed'),
])
def test_invalid_update_preserves_previous_cache_and_usable_templates(tmp_path, mutate):
    library, source, raw, previous = activated(tmp_path)
    changed = pack()
    mutate(changed)
    write(source, changed)
    failed = library.reload()
    assert failed['error'] and failed['sha256'] == previous['sha256']
    assert failed['using_cache']
    assert (library.cache_home / f"{previous['sha256']}.json").read_bytes() == raw
    assert library.build_document('firma:company-uv', 'none', build_document)['name'] == 'Firmenstandard UV'


def test_unreachable_server_keeps_cached_library_after_restart(tmp_path):
    library, source, _, previous = activated(tmp_path)
    source.unlink()
    restarted = ProfileLibrary(library.home)
    assert restarted.status()['using_cache']
    result = restarted.reload()
    assert result['offline'] and result['using_cache'] and result['sha256'] == previous['sha256']
    assert result['error']
    assert restarted.build_document('firma:company-uv', 'iwb', build_document)['vnb_id'] == 'iwb'


def test_oversize_duplicate_json_keys_and_invalid_encoding_do_not_replace_cache(tmp_path):
    library, source, _, previous = activated(tmp_path)
    for data in (b' ' * (MAX_LIBRARY_BYTES + 1), b'{"schema_version":1,"schema_version":1}', b'\xff\xfe'):
        source.write_bytes(data)
        result = library.reload()
        assert result['error'] and result['sha256'] == previous['sha256'] and result['using_cache']


def test_cache_hash_and_future_settings_are_checked_without_deleting_files(tmp_path):
    library, source, _, previous = activated(tmp_path)
    cache = library.cache_home / f"{previous['sha256']}.json"
    cache.write_text('{}')
    status = library.status()
    assert status['error'] and not status['using_cache'] and cache.read_text() == '{}'
    assert library.merge_catalog(get_catalog()) == get_catalog()
    assert library.reload()['using_cache']  # An explicit valid source reload repairs the local cache.
    raw = json.dumps({'schema_version': 99}).encode()
    library.settings_path.write_bytes(raw)
    assert library.status()['revision'] == 'unreadable'
    with pytest.raises(ValueError, match='nicht ersetzt'):
        library.configure(str(source), '0')
    assert library.settings_path.read_bytes() == raw


def test_settings_conflict_disable_and_changed_path_are_explicit(tmp_path):
    library, source, raw, previous = activated(tmp_path)
    second = ProfileLibrary(library.home)
    with pytest.raises(Conflict):
        second.configure(str(source), '0')
    pending = library.configure(str(tmp_path / 'other.json'), previous['revision'])
    assert pending['needs_reload'] and pending['using_cache']
    assert pending['cached_path'] == str(source)
    failed = library.reload()
    assert failed['offline'] and failed['sha256'] == previous['sha256']
    disabled = library.configure('', failed['revision'])
    assert not disabled['configured'] and not disabled['using_cache']
    assert library.merge_catalog(get_catalog()) == get_catalog()
    assert source.read_bytes() == raw
    assert (library.cache_home / f"{previous['sha256']}.json").exists()


def test_unsafe_or_ambiguous_paths_are_not_accepted(tmp_path):
    library = ProfileLibrary(tmp_path / 'local')
    for value in ('relative.json', 'https://example.test/templates.json', '../settings.json', str(tmp_path / 'company.py'),
                  'bad\x00.json', str(library.settings_path), str(library.cache_home / 'entry.json')):
        with pytest.raises(ValueError):
            library.configure(value, '0')
    assert library.status()['revision'] == '0'


def test_operator_selection_uses_a_copy_and_preserves_frozen_source_versions(tmp_path):
    library, _, _, _ = activated(tmp_path)
    original = library.build_document('firma:company-uv', 'iwb', build_document)
    different = library.build_document('firma:company-uv', 'ebl', build_document)
    assert different['vnb_id'] == 'ebl' and 'Firmen-Snapshot' in different['vnb_profile_version']
    assert different['sources'] == original['sources']
    plain = library.build_document('firma:company-uv', 'none', build_document)
    assert plain['vnb_id'] == 'none' and not plain['vnb_profile_version']
    assert library.build_document('uv-basic', 'primeo', build_document)['vnb_id'] == 'primeo'
    with pytest.raises(KeyError):
        library.build_document('firma:missing', 'iwb', build_document)
