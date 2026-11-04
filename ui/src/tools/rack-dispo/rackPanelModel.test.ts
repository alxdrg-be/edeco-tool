import assert from 'node:assert/strict';
import test from 'node:test';
import { panelDrawingFill, parsePlanningNumber, profileGroup, profileSubtitle } from './rackPanelModel.ts';
import type { DeviceProfile } from './types.ts';

test('unknown dimensions stay null; zero is explicit and comma decimals are accepted', () => {
  assert.deepEqual(parsePlanningNumber('   '), { valid: true, value: null });
  assert.deepEqual(parsePlanningNumber('0', { min: 0 }), { valid: true, value: 0 });
  assert.deepEqual(parsePlanningNumber(' 44,45 ', { min: 0 }), { valid: true, value: 44.45 });
  assert.equal(parsePlanningNumber('', { nullable: false }).valid, false);
});

test('drawing colours accept only six-digit hex values and retain independent defaults', () => {
  assert.equal(panelDrawingFill('#FFCC00', '#ffffff'), '#ffcc00');
  for (const value of [undefined, null, '#fff', 'orange', 'url(https://example.com)', 0]) {
    assert.equal(panelDrawingFill(value, '#cccccc'), '#cccccc');
  }
  assert.equal(panelDrawingFill(undefined, '#ffffff'), '#ffffff');
});

test('reject invalid, out-of-range, and partial whole-HE values before committing', () => {
  for (const input of ['NaN', 'Infinity', '1e9', '0x10', '12px', '-', '1,2,3']) assert.equal(parsePlanningNumber(input, { min: 0 }).valid, false, input);
  assert.equal(parsePlanningNumber('-1', { min: 0 }).valid, false);
  assert.equal(parsePlanningNumber('61', { max: 60 }).valid, false);
  assert.equal(parsePlanningNumber('1.5', { integer: true }).valid, false);
  assert.deepEqual(parsePlanningNumber('24', { min: 1, max: 60, integer: true }), { valid: true, value: 24 });
});

test('library height, port capacity, medium and category stay independent', () => {
  const profile: DeviceProfile = { id: 'p24', name: 'Panel', kind: 'patch', units: 1, portCount: 24, medium: 'RJ45',
    depthMm: null, inwardCableMm: null, outwardCableMm: null, weightKg: null, powerW: null, loadLimitKg: null,
    manufacturer: '', article: '', source: '', verified: false };
  assert.equal(profileSubtitle(profile), '1 HE · 24 RJ45-Ports');
  assert.equal(profileSubtitle({ ...profile, units: 2, portCount: 48 }), '2 HE · 48 RJ45-Ports');
  assert.equal(profileSubtitle({ ...profile, kind: 'fiber', medium: 'LWL', portCount: 12 }), '1 HE · 12 LWL-Anschlüsse');
  assert.equal(profileSubtitle({ ...profile, units: 0, portCount: 0 }), '0 HE · seitlich / hinten');
  assert.equal(profileGroup(profile), 'Panels');
  assert.equal(profileGroup({ ...profile, kind: 'switch' }), 'Aktiv');
  assert.equal(profileGroup({ ...profile, kind: 'earth' }), 'Strom');
  assert.equal(profileGroup({ ...profile, kind: 'manager' }), 'Zubehör');
});
