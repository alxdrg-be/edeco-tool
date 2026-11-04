import assert from 'node:assert/strict';
import test from 'node:test';
import { addPlacement, analyzeRacks, copyRack, createEmptyDocument, createExampleDocument, createPlacement,
  createProfile, documentToJson, duplicatePlacements, importDocumentJson, movePlacements, normalizeImport, portRows,
  removePlacements, updatePort, validateDocument } from './model.ts';
import { createDefaultProfiles } from './catalog.ts';
import { HE_MM, placementRect, rackGeometry, rawStartUnitFromY, startUnitFromY, unitRangesOverlap, unitTopY } from './geometry.ts';
import type { RackDocument } from './types.ts';

function fixture(): RackDocument {
  const doc = createEmptyDocument();
  doc.racks[0] = { ...doc.racks[0], usableDepthMm: 800, frontDoorClearanceMm: 70, rearDoorClearanceMm: 80 };
  doc.profiles = [createProfile({ id: 'known', name: 'Bekanntes Gerät', units: 2, depthMm: 300,
    inwardCableMm: 50, outwardCableMm: 50, weightKg: 10, powerW: 100, portCount: 24, medium: 'RJ45' })];
  return doc;
}
function placed(doc: RackDocument, id: string, startUnit: number, side: 'front' | 'rear' = 'front', profileId = 'known') {
  return createPlacement({ rackId: doc.racks[0].id, profileId, startUnit, side, label: id }, { id });
}
const codes = (doc: RackDocument) => analyzeRacks(doc).issues.map(i => i.code);

test('real mm geometry keeps HE 1 at the bottom and preserves equipment height', () => {
  const doc = fixture(); const rack = doc.racks[0]; const g = rackGeometry(rack); const p = placed(doc, 'one', 1);
  const rect = placementRect(rack, p, doc.profiles[0]);
  assert.equal(g.railHeightMm, 42 * 44.45); assert.equal(rect.height, 2 * 44.45);
  assert.equal(rect.y + rect.height, g.railBottomMm);
  assert.equal(startUnitFromY(rack, rect.y, 2), 1);
  assert.equal(rawStartUnitFromY(rack, unitTopY(rack, 43, 2), 2), 43);
  assert.equal(startUnitFromY(rack, unitTopY(rack, 43, 2), 2), 41);
});
test('24/48 port panels keep their explicit height; ports never determine HE', () => {
  const panels = createDefaultProfiles().filter(p => p.kind === 'patch');
  assert.deepEqual(panels.map(p => [p.portCount, p.units]), [[24, 1], [48, 1], [48, 2]]);
});
test('same-side overlap blocks the actual pair and never mutates the input', () => {
  const doc = fixture(); doc.placements.push(placed(doc, 'a', 10)); const before = JSON.stringify(doc);
  const result = addPlacement(doc, { rackId: doc.racks[0].id, profileId: 'known', startUnit: 11, side: 'front' });
  assert.equal(result.accepted, false); assert.equal(result.document.placements.length, 2); assert.equal(result.issues[0].severity, 'error');
  assert.equal(JSON.stringify(doc), before);
  assert(result.issues.some(i => i.code === 'unit-collision' && i.placementIds.includes('a')));
});
test('front and rear may share HE only when known combined inward depth fits', () => {
  const doc = fixture(); doc.placements = [placed(doc, 'front', 10), placed(doc, 'rear', 10, 'rear')];
  assert(!codes(doc).includes('depth-collision')); assert(!codes(doc).includes('opposite-depth-open'));
  doc.racks[0].usableDepthMm = 650;
  const issue = analyzeRacks(doc).issues.find(i => i.code === 'depth-collision');
  assert.equal(issue?.actual, 700); assert.equal(issue?.limit, 650);
  doc.profiles[0].inwardCableMm = null;
  assert(!codes(doc).includes('depth-collision')); assert(codes(doc).includes('opposite-depth-open'));
});
test('external depth never substitutes for unknown usable depth or unknown cable room', () => {
  const doc = fixture(); doc.placements = [placed(doc, 'a', 1)]; doc.racks[0].usableDepthMm = null;
  doc.profiles[0].inwardCableMm = null;
  assert(codes(doc).includes('rack-depth-open')); assert(codes(doc).includes('device-depth-open'));
});
test('front and rear door clearances are checked independently', () => {
  const doc = fixture(); doc.racks[0].frontDoorClearanceMm = 40;
  doc.placements = [placed(doc, 'front', 1), placed(doc, 'rear', 10, 'rear')];
  const issues = analyzeRacks(doc).issues.filter(i => i.code === 'door-clearance');
  assert.equal(issues.length, 1); assert.deepEqual(issues[0].placementIds, ['front']);
});
test('0 HE does not reserve front units and unknown position remains open', () => {
  const doc = fixture(); doc.profiles.push(createProfile({ id: 'pdu', kind: 'pdu', units: 0 }));
  doc.placements = [createPlacement({ rackId: doc.racks[0].id, profileId: 'pdu', startUnit: 1, side: 'zero-rear' }, { id: 'pdu1' })];
  const analysis = analyzeRacks(doc).racks[0];
  assert.equal(analysis.usedUnits, 0); assert.equal(analysis.freeUnits, 42); assert.equal(analysis.zeroObjects, 1);
  assert(analysis.issues.some(i => i.code === 'zero-location-open'));
});
test('fully located 0 HE checks depth boundaries, door cables and equipment collisions', () => {
  const doc = fixture(); doc.profiles.push(createProfile({ id: 'pdu', kind: 'pdu', units: 0, depthMm: 100,
    inwardCableMm: 0, outwardCableMm: 90, weightKg: 1, powerW: 0 }));
  const pdu = createPlacement({ rackId: doc.racks[0].id, profileId: 'pdu', startUnit: 1, side: 'zero-rear' },
    { id: 'pdu1', zeroStartMm: 0, zeroHeightMm: 1000, zeroInwardOffsetMm: 900 });
  doc.placements = [pdu]; assert(codes(doc).includes('zero-depth')); assert(codes(doc).includes('door-clearance'));
  pdu.zeroInwardOffsetMm = 200; doc.placements.push(placed(doc, 'front', 1));
  assert(codes(doc).includes('zero-equipment-collision'));
  assert.equal(analyzeRacks(doc).racks[0].usedUnits, 2);
});
test('reserve and removed equipment are separate from live objects/ports/weight', () => {
  const doc = fixture(); doc.profiles.push(createProfile({ id: 'reserve', kind: 'reserve', units: 4 }));
  doc.placements = [placed(doc, 'live', 10), { ...placed(doc, 'removed', 1), status: 'removed' }, placed(doc, 'reserve4', 20, 'front', 'reserve')];
  const a = analyzeRacks(doc).racks[0];
  assert.equal(a.objects, 1); assert.equal(a.usedUnits, 2); assert.equal(a.reservedUnits, 4); assert.equal(a.freeUnits, 36);
  assert.equal(a.weight.known, 10); assert.equal(a.portCapacity, 24);
});
test('capacity, built and occupied states stay distinct and patch/switch ports stay separate', () => {
  let doc = fixture(); doc.profiles[0].kind = 'patch';
  doc.profiles.push({ ...doc.profiles[0], id: 'switch', kind: 'switch' });
  doc.placements = [placed(doc, 'panel', 10), placed(doc, 'switch1', 5, 'front', 'switch')];
  const rows = portRows(doc, 'panel');
  doc = updatePort(doc, { ...rows[0], state: 'built' }); doc = updatePort(doc, { ...rows[1], state: 'occupied', target: 'PC1' });
  const a = analyzeRacks(doc).racks[0];
  assert.equal(a.portCapacity, 48); assert.equal(a.portsBuilt, 2); assert.equal(a.portsOccupied, 1);
  assert.deepEqual(a.portBreakdown.map(b => [b.kind, b.capacity, b.built]), [['patch', 24, 2], ['switch', 24, 0]]);
});
test('incomplete power/weight retains a known partial sum, never assumes unknown zero', () => {
  const doc = fixture(); doc.profiles.push(createProfile({ id: 'unknown' }));
  doc.placements = [placed(doc, 'known1', 1), placed(doc, 'unknown1', 10, 'front', 'unknown')];
  const a = analyzeRacks(doc).racks[0]; assert.deepEqual(a.weight, { known: 10, missing: 1, complete: false });
  assert.deepEqual(a.power, { known: 100, missing: 1, complete: false }); assert(codes(doc).includes('weight-open'));
  doc.racks[0].powerBudgetW = 50; assert(codes(doc).includes('rack-power'));
});
test('shelf payload excludes own shelf weight; rack weight counts each object once', () => {
  const doc = fixture(); doc.profiles.push(createProfile({ id: 'shelf', kind: 'shelf', units: 1, weightKg: 3, powerW: 0, loadLimitKg: 8 }));
  doc.placements = [placed(doc, 'shelf1', 1, 'front', 'shelf'), { ...placed(doc, 'server', 2), supportedById: 'shelf1' }];
  const a = analyzeRacks(doc).racks[0]; assert.equal(a.weight.known, 13);
  const issue = a.issues.find(i => i.code === 'shelf-load'); assert.equal(issue?.actual, 10); assert.equal(issue?.limit, 8);
});
test('import round trips metadata and preserves planning errors for repair', () => {
  const doc = fixture(); doc.metadata = { schemaVendor: 'edeco', nested: { keys: ['x', 3, null] } };
  doc.placements = [placed(doc, 'a', 1), placed(doc, 'b', 1)];
  const imported = importDocumentJson(documentToJson(doc)); assert.deepEqual(imported, doc); assert(codes(imported).includes('unit-collision'));
});
test('untrusted import rejects duplicate ids, references, nonfinite numbers and invalid ports', () => {
  const doc = fixture(); doc.placements = [placed(doc, 'a', 1)];
  const bad = structuredClone(doc); bad.racks[0].id = bad.profiles[0].id; assert.equal(validateDocument(bad).valid, false);
  const missing = structuredClone(doc); missing.placements[0].profileId = 'missing'; assert.throws(() => normalizeImport(missing));
  const nan = structuredClone(doc); nan.racks[0].depthMm = NaN; assert.equal(validateDocument(nan).valid, false);
  const extra = structuredClone(doc); extra.ports = [{ placementId: 'a', number: 25, label: '', target: '', outlet: '', room: '', state: 'built' }];
  assert.equal(validateDocument(extra).valid, false);
});
test('movement returns invalid preview without moving the original; deletion clears ports/support refs', () => {
  let doc = fixture(); doc.placements = [placed(doc, 'a', 1)]; doc = updatePort(doc, { ...portRows(doc)[0], state: 'occupied' });
  const move = movePlacements(doc, ['a'], -1); assert.equal(move.accepted, false); assert.equal(move.document.placements[0].startUnit, 0); assert.equal(doc.placements[0].startUnit, 1);
  const deleted = removePlacements(doc, ['a']); assert.equal(deleted.ports.length, 0); assert.equal(doc.ports.length, 1);
});
test('copying a rack or panel keeps source geometry but clears physical port destinations', () => {
  let doc = fixture(); doc.placements = [placed(doc, 'a', 1)]; doc = updatePort(doc, { ...portRows(doc)[0], state: 'occupied', outlet: '01.001' });
  const copied = copyRack(doc, doc.racks[0].id); assert.equal(copied.racks.length, 2); assert.equal(copied.ports.length, 1);
  const cloned = copied.placements.find(p => p.rackId !== doc.racks[0].id)!; assert.equal(portRows(copied, cloned.id)[0].state, 'unknown');
  const doubled = duplicatePlacements(doc, ['a']); assert.equal(doubled.accepted, true); assert.equal(doubled.document.ports.length, 1);
});
test('example follows panel, manager, switch and computed counts with explicitly open dimensions', () => {
  const doc = createExampleDocument(); assert.equal(validateDocument(doc).valid, true);
  const panel = doc.placements.find(p => p.label === 'Patchpanel 24 Ports')!;
  const manager = doc.placements.find(p => p.label === 'Rangierpanel')!;
  const sw = doc.placements.find(p => p.label === 'Switch 24 Ports')!;
  assert.equal(panel.startUnit, manager.startUnit + 1); assert.equal(manager.startUnit, sw.startUnit + 1);
  const a = analyzeRacks(doc).racks[0]; assert.equal(a.objects, 7); assert.equal(a.usedUnits, 5); assert.equal(a.reservedUnits, 4);
  assert(a.issues.some(i => i.severity === 'open')); assert(!a.issues.some(i => i.severity === 'error'));
  assert.equal(HE_MM, 44.45);
});

test('unknown schema fields fail early while unknown metadata remains reversible', () => {
  const doc = fixture();
  assert.equal(validateDocument({ ...doc, unexpected: 'x' }).valid, false);
  assert.equal(validateDocument({ ...doc, racks: [{ ...doc.racks[0], strayDimension: 10 }] }).valid, false);
  doc.metadata = { customFutureField: { note: 'a'.repeat(5000) } };
  assert.deepEqual(normalizeImport(doc).metadata, doc.metadata);
  assert.equal(validateDocument({ ...doc, racks: [] }).valid, false);
});

test('unknown rack limits stay open even when every device value is known', () => {
  const doc = fixture(); doc.placements = [placed(doc, 'known', 1)];
  assert(codes(doc).includes('weight-limit-open')); assert(codes(doc).includes('power-budget-open'));
  doc.racks[0].weightLimitKg = 100; doc.racks[0].powerBudgetW = 1000;
  assert(!codes(doc).includes('weight-limit-open')); assert(!codes(doc).includes('power-budget-open'));
});
test('touching mm boundaries do not become collisions through binary float rounding', () => {
  assert.equal(unitRangesOverlap(0, 3 * HE_MM, 133.35, HE_MM), false);
  assert.equal(unitRangesOverlap(0, 3 * HE_MM, 133.3, HE_MM), true);
  assert.equal(unitRangesOverlap(10, 0, 0, 20), false);
});

test('0 HE inward cable space participates in device and accessory collisions', () => {
  const doc = fixture();
  doc.profiles[0].depthMm = 500; doc.profiles[0].inwardCableMm = 0;
  doc.profiles.push(createProfile({ id: 'pdu', kind: 'pdu', units: 0, depthMm: 100, inwardCableMm: 300, outwardCableMm: 0, weightKg: 1, powerW: 0 }));
  const first = createPlacement({ rackId: doc.racks[0].id, profileId: 'pdu', startUnit: 1, side: 'zero-rear' },
    { id: 'pdu1', zeroStartMm: 0, zeroHeightMm: 100, zeroInwardOffsetMm: 0 });
  doc.placements = [first, placed(doc, 'rear', 1, 'rear')];
  assert(codes(doc).includes('zero-equipment-collision'));
  doc.placements = [first, { ...first, id: 'pdu2', zeroInwardOffsetMm: 300 }];
  assert(codes(doc).includes('zero-collision'));
});
test('contradictory interior depths are rejected by the mechanical check', () => {
  const doc = fixture(); doc.racks[0].frontDoorClearanceMm = 200; doc.racks[0].rearDoorClearanceMm = 200;
  assert(codes(doc).includes('case-depth-sum'));
});
