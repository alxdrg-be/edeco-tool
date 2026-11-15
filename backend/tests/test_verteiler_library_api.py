import json
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from edeco_toolbox.local_security import register as register_security
from edeco_toolbox.tools.verteiler_dispo.api import PREFIX, register
from edeco_toolbox.tools.verteiler_dispo.catalog import build_document


def test_library_admin_scope_and_cached_company_template_survive_server_loss(tmp_path):
    app = FastAPI()
    register_security(app)
    role = {'can_manage': False}
    app.state.presentation = SimpleNamespace(snapshot=lambda: role)
    register(app, tmp_path / 'data')
    original = build_document('uv-empty', 'iwb')
    original.update(project_id='secret-project', project_name='Existing customer', project_number='OLD')
    source = tmp_path / 'company.json'
    source.write_text(json.dumps({'schema_version': 1, 'documents': [original]}))
    with TestClient(app, base_url='http://127.0.0.1:8765') as client:
        state = client.get(PREFIX + '/library').json()
        assert client.put(PREFIX + '/library', json={'path': str(source), 'base_revision': state['revision']}).status_code == 403
        role['can_manage'] = True
        configured = client.put(PREFIX + '/library', json={'path': str(source), 'base_revision': state['revision']})
        assert configured.status_code == 200
        loaded = client.post(PREFIX + '/library/reload').json()
        assert loaded['sha256'] and loaded['templates_count'] == 1
        assert 'firma:' + original['id'] in [t['id'] for t in client.get(PREFIX + '/catalog').json()['templates']]
        created = client.get(PREFIX + '/default', params={'template_id': 'firma:' + original['id'], 'vnb_id': 'iwb'}).json()
        assert created['id'] != original['id'] and created['revision'] == 0
        assert created['project_id'] is None and created['project_number'] == '' and created['project_name'] == ''
        source.unlink()
        failed = client.post(PREFIX + '/library/reload').json()
        assert failed['offline'] and failed['sha256'] == loaded['sha256']
        assert client.get(PREFIX + '/default', params={'template_id': 'firma:' + original['id'], 'vnb_id': 'iwb'}).status_code == 200
        assert client.put(PREFIX + '/library', json={'path': '', 'base_revision': 'stale'}).status_code == 409


def test_corrupt_library_settings_leave_stock_catalog_and_existing_file_intact(tmp_path):
    home = tmp_path / 'data'
    home.mkdir()
    settings = home / 'library-settings.json'
    settings.write_bytes(b'{invalid')
    app = FastAPI()
    register(app, home)
    with TestClient(app) as client:
        assert client.get(PREFIX + '/catalog').status_code == 200
        assert client.get(PREFIX + '/library').json()['error']
        assert settings.read_bytes() == b'{invalid'
