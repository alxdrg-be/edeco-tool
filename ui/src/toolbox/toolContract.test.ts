import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOLS } from './catalog.ts';
import { DEMO_CHOICE_IDS, DEMO_DEFAULT_IDS, TOOL_DEFINITIONS } from './toolContract.ts';

test('root tools have unique shared definitions and hidden tools retain their scope', () => {
  assert.equal(new Set(TOOL_DEFINITIONS.map(tool => tool.id)).size, TOOL_DEFINITIONS.length);
  assert.deepEqual(new Set(TOOLS.filter(tool => !tool.parentId).map(tool => tool.id)), new Set(TOOL_DEFINITIONS.map(tool => tool.id)));
  assert.equal(TOOLS.find(tool => tool.id === 'planlieferung')?.hiddenFromHub, true);
});

test('Verteiler is an explicit demo choice without changing the established default selection', () => {
  assert.deepEqual(DEMO_DEFAULT_IDS, ['nova-legenden', 'berechnungen', 'dateien-umbenennen', 'pdf-werkzeuge', 'elektro-memory', 'rack-dispo']);
  assert.ok(DEMO_CHOICE_IDS.includes('verteiler-dispo'));
  assert.ok(!DEMO_DEFAULT_IDS.includes('verteiler-dispo'));
});
