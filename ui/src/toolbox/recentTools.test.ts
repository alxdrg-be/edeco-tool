import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecentTools } from './recentTools.ts';

test('damaged or manipulated recent history cannot create executable navigation targets', () => {
  for (const raw of ['{', 'null', '{}', '"hello"']) assert.deepEqual(parseRecentTools(raw), []);
  assert.deepEqual(parseRecentTools(JSON.stringify([
    { id: 'javascript:alert(1)', usedAt: 1 }, { id: '../other', usedAt: 2 },
    { id: 'nova-legenden', usedAt: '2026' }, { id: 'rack-dispo', usedAt: -1 }, null,
    { id: 'elektro-memory', usedAt: 4, ignored: 'value' },
  ])), [{ id: 'elektro-memory', usedAt: 4 }]);
});

test('recent history is deduplicated, ordered, and bounded', () => {
  const values = Array.from({ length: 12 }, (_, i) => ({ id: `tool-${i}`, usedAt: i }));
  const result = parseRecentTools(JSON.stringify([...values, values[4]]));
  assert.equal(result.length, 8);
  assert.equal(new Set(result.map(item => item.id)).size, 8);
  assert.equal(result[0].id, 'tool-11');
});
