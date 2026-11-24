"""Small shared tool metadata contract, also compiled into the React application."""

import json
from pathlib import Path


def definitions():
    value = json.loads((Path(__file__).with_name('resources') / 'tool_contract.json').read_text(encoding='utf-8'))
    if value.get('schema_version') != 1 or not isinstance(value.get('tools'), list):
        raise ValueError('Unbekannter Werkzeugvertrag')
    tools = value['tools']
    ids = [tool['id'] for tool in tools]
    if len(set(ids)) != len(ids) or any(not isinstance(name, str) or not name for name in ids):
        raise ValueError('Ungueltige Werkzeugkennungen')
    if any(type(tool.get(key)) is not bool for tool in tools for key in ('demo_eligible', 'demo_default', 'hidden_from_hub')):
        raise ValueError('Ungueltige Werkzeugeigenschaften')
    if any(tool['demo_default'] and not tool['demo_eligible'] for tool in tools):
        raise ValueError('Demo-Standard muss auswaehlbar sein')
    return tools


TOOL_DEFINITIONS = definitions()
DEMO_DEFAULTS = [tool['id'] for tool in TOOL_DEFINITIONS if tool['demo_default']]
DEMO_CHOICES = [tool['id'] for tool in TOOL_DEFINITIONS if tool['demo_eligible']]
