import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEmptyDocument, addPlacement, updatePort } from './model.ts';
import { bomCSV, initialHistory, parseRackFile, portsCSV, pushDocument, rackCSV, safeFilename, travelHistory } from './documentStore.ts';

test('CSV expands unknown port capacity, preserves actual room/outlet and excludes removed devices', () => {
  let doc = createEmptyDocument();
  const added = addPlacement(doc, { profileId: 'generic-patch24', rackId: doc.racks[0].id, startUnit: 40, side: 'front' });
  assert.ok(added.accepted); doc = added.document;
  assert.equal(doc.ports.length, 0, 'unconfigured ports are sparse');
  assert.equal(portsCSV(doc).trim().split('\r\n').length, 25);
  doc = updatePort(doc, { placementId: added.placementIds[0], number: 24, label: 'PP1-24', target: 'SW1-24', outlet: 'D.024', room: 'Büro', state: 'occupied' });
  assert.match(portsCSV(doc), /"24";"PP1-24";"SW1-24";"D\.024";"Büro";"Belegt"/);
  const removed = { ...doc, placements: doc.placements.map(p => ({ ...p, status: 'removed' as const })) };
  assert.equal(portsCSV(removed).trim().split('\r\n').length, 1);
  assert.equal(bomCSV(removed).trim().split('\r\n').length, 1);
});
test('CSV escapes separators and quotation marks and prevents Excel formula execution', () => {
  assert.equal(rackCSV([['=HYPERLINK("evil")', ' Raum;A', '+123', 'normal']]), '\uFEFF"\'=HYPERLINK(""evil"")";" Raum;A";"\'+123";"normal"\r\n');
  assert.match(rackCSV([['\t@SUM(1)', '\r=1']]), /'\t@SUM/);
});
test('implicit port rows respect the export limit before allocating a large list', () => {
  const doc = createEmptyDocument();
  doc.profiles[0].portCount = 288;
  doc.placements = Array.from({ length: 84 }, (_, i) => ({ id: `bulk-${i}`, rackId: doc.racks[0].id, profileId: doc.profiles[0].id, label: '', startUnit: 1,
    side: 'front', status: 'planned', delivery: 'open', montage: 'open', notes: '', supportedById: null, zeroStartMm: null, zeroHeightMm: null, zeroInwardOffsetMm: null }));
  assert.throws(() => portsCSV(doc), /24’000/);
});
test('undo and redo restore a whole rack and port snapshot and editing clears the redo branch', () => {
  const original = createEmptyDocument(), a = { ...original, name: 'Stand A' }, b = { ...a, name: 'Stand B' };
  const history = pushDocument(pushDocument(initialHistory(original), a), b);
  const back = travelHistory(history, 'undo');
  assert.equal(back.present, a); assert.equal(travelHistory(back, 'redo').present, b);
  assert.equal(pushDocument(back, { ...a, name: 'Variante C' }).future.length, 0);
  assert.equal(original.name, createEmptyDocument().name);
});
test('rack imports preserve null unknowns and reject incomplete or non-finite data before replacing any draft', () => {
  const doc = createEmptyDocument();
  assert.deepEqual(parseRackFile(JSON.stringify(doc)), doc);
  assert.equal(parseRackFile(JSON.stringify(doc)).racks[0].usableDepthMm, null);
  assert.throws(() => parseRackFile('{bad'), /gültiges Rack-JSON/);
  assert.throws(() => parseRackFile(JSON.stringify({ ...doc, version: 99 })));
  assert.throws(() => parseRackFile(JSON.stringify({ ...doc, racks: [{ ...doc.racks[0], units: '42' }] })));
});
test('file names are valid on Windows and never become relative paths', () => {
  assert.equal(safeFilename('../Rack: A/?'), '..-Rack- A-');
  assert.equal(safeFilename('CON'), 'Rack-CON');
  assert.equal(safeFilename(''), 'Rack-Dispo');
});
