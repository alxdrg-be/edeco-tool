import contract from '../../../backend/edeco_toolbox/resources/tool_contract.json' with { type: 'json' };

export const TOOL_DEFINITIONS = contract.tools;
export const DEMO_DEFAULT_IDS = TOOL_DEFINITIONS.filter(tool => tool.demo_default).map(tool => tool.id);
export const DEMO_CHOICE_IDS = [...DEMO_DEFAULT_IDS, ...TOOL_DEFINITIONS.filter(tool => tool.demo_eligible && !DEMO_DEFAULT_IDS.includes(tool.id)).map(tool => tool.id)];
export function hiddenTool(id: string): boolean { return TOOL_DEFINITIONS.some(tool => tool.id === id && tool.hidden_from_hub); }
