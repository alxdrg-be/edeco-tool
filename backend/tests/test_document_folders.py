from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from edeco_toolbox.documents.api import PREFIX, register
from edeco_toolbox.documents.folders import FolderSource
from edeco_toolbox.documents.store import DocumentStore


def test_folder_sync_updates_removes_and_never_changes_server_files(tmp_path):
    source = tmp_path / 'server'; source.mkdir()
    file = source / 'Plan.txt'; file.write_text('Schutzleiter vorher prüfen.', encoding='utf-8')
    store = DocumentStore(tmp_path / 'library'); folder = FolderSource(store)
    folder.configure(str(source), True)
    first = folder.sync(); identifier = first['documents'][0]['id']
    assert first['added'] == 1 and first['errors'] == []
    assert folder.sync()['unchanged'] == 1
    file.write_text('Aktualisierte Prüfung des Schutzleiters.', encoding='utf-8')
    changed = folder.sync()
    assert changed['added'] == 1 and changed['removed'] == 1
    assert len(store.list()) == 1 and store.list()[0]['id'] != identifier
    assert file.read_text(encoding='utf-8') == 'Aktualisierte Prüfung des Schutzleiters.'
    file.unlink()
    assert folder.sync()['removed'] == 1 and not store.list()


def test_folder_keeps_manual_duplicates_and_disconnected_copies(tmp_path):
    source = tmp_path / 'server'; source.mkdir()
    file = source / 'Manual.txt'; file.write_bytes(b'Electrical report')
    store = DocumentStore(tmp_path / 'library')
    manual = store.add(file.read_bytes(), 'Manual.txt')['document']['id']
    folder = FolderSource(store); folder.configure(str(source), True); folder.sync()
    file.unlink(); folder.sync()
    assert store.get(manual)
    file.write_bytes(b'New folder document'); folder.sync()
    folder.configure('', True)
    assert len(store.list()) == 2


def test_folder_failure_preserves_index_and_limits_scan(tmp_path):
    source = tmp_path / 'server'; source.mkdir()
    (source / 'Plan.txt').write_text('Valid text', encoding='utf-8')
    store = DocumentStore(tmp_path / 'library'); folder = FolderSource(store)
    folder.configure(str(source), True); folder.sync()
    source.rename(tmp_path / 'disconnected')
    with pytest.raises(ValueError, match='nicht erreichbar'):
        folder.sync()
    assert len(store.list()) == 1
    with pytest.raises(ValueError):
        folder.configure(str(tmp_path), True)
    source.mkdir()
    for index in range(201):
        (source / f'{index}.txt').write_text('text')
    with pytest.raises(ValueError, match='200 Dokumente'):
        folder.sync()
    assert len(store.list()) == 1


def test_folder_endpoints_require_session_and_allow_search(tmp_path, monkeypatch):
    monkeypatch.setenv('EDECO_TOOLBOX_HOME', str(tmp_path / 'home'))
    source = tmp_path / 'server'; source.mkdir()
    (source / 'Plan.txt').write_text('Vor Inbetriebnahme ist der Schutzleiter zu prüfen.', encoding='utf-8')
    app = FastAPI(); register(app)
    with TestClient(app, base_url='http://127.0.0.1') as client:
        assert client.get(PREFIX + '/folder').status_code == 403
        assert client.post(PREFIX + '/folder/sync').status_code == 403
        headers = {'X-Edeco-Documents': client.get(PREFIX + '/state').json()['session_key']}
        assert client.post(PREFIX + '/folder', headers=headers, json={'path': str(source)}).status_code == 200
        result = client.post(PREFIX + '/folder/sync', headers=headers).json()
        response = client.post(PREFIX + '/ask', headers=headers, json={'question': 'Schutzleiter', 'document_ids': [result['documents'][0]['id']]})
        assert response.status_code == 200 and response.json()['sources']
