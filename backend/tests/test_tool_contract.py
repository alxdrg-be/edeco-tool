from edeco_toolbox.presentation import DEMO_TOOLS, PresentationBody, PresentationStore
from edeco_toolbox.tool_contract import DEMO_CHOICES


def test_verteiler_can_be_selected_without_changing_existing_demo_defaults(tmp_path):
    store = PresentationStore(tmp_path, ('edeco\\aduerger', True))
    current = store.snapshot()
    assert current['demo_tools'] == DEMO_TOOLS
    assert 'verteiler-dispo' not in current['demo_tools']
    assert 'verteiler-dispo' in DEMO_CHOICES
    body = PresentationBody.model_validate({key: current[key] for key in ('revision', 'demo_enabled', 'demo_tools', 'admins')} | {'demo_tools': [*DEMO_TOOLS, 'verteiler-dispo']})
    store.save(body)
    assert PresentationStore(tmp_path, ('edeco\\aduerger', True)).snapshot()['demo_tools'] == [*DEMO_TOOLS, 'verteiler-dispo']
