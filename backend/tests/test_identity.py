from edeco_toolbox import identity, presentation
from nova_legend import config


def test_identity_keeps_nova_short_labels_and_host_domain_matching(monkeypatch):
    monkeypatch.setattr(identity, 'windows_identity', lambda: ('EDECO\\aduerger', True))
    assert config.current_user() == 'aduerger'
    assert identity.is_admin('EDECO\\aduerger', ['aduerger'])
    assert not identity.is_admin('OTHER\\aduerger', ['EDECO\\aduerger'])
    assert presentation.is_admin is identity.is_admin


def test_missing_os_identity_cannot_invent_an_admin(monkeypatch):
    monkeypatch.setattr(identity, 'windows_identity', lambda: ('', True))
    assert config.current_user() == 'unbekannt'
    assert not identity.is_admin('', ['aduerger'])
