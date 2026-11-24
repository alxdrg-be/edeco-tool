import test from 'node:test';
import assert from 'node:assert/strict';
import { contentKey, initialHistory, mergeSourceSnapshots, parseDocumentJson, parseNumber, profileSize, pushHistory, readDraft, snapToRail, travelHistory, withProfileSnapshot, writeDraft } from './documentStore.ts';
import type { DeviceProfile, DistributionDocument, SourceRef } from './types.ts';

const profile = { id: 'mcb', width_mm: 18, height_mm: 86, mounting: 'din' } as DeviceProfile;
const document = { schema_version: 1, id: 'doc', name: 'UV', revision: 0, profiles: [profile], cabinet: { rails: [{ id: 'r', x_mm: 20, y_mm: 100, z_mm: 15, te_pitch_mm: 18 }] } } as DistributionDocument;
test('history preserves the exact physical document and clears redo after a new edit', () => {
  const moved = { ...document, name: 'HV' };
  const history = pushHistory(initialHistory(document), moved);
  assert.equal(travelHistory(history, false).present, document);
  assert.equal(travelHistory(travelHistory(history, false), true).present, moved);
  assert.equal(pushHistory(travelHistory(history, false), { ...document, name: 'Other' }).future.length, 0);
  assert.equal(contentKey({ ...document, revision: 17 }), contentKey(document));
});
test('DIN snap uses the actual row pitch and origin, free parts retain millimetres', () => {
  assert.deepEqual(snapToRail(document, profile, 47, 92), { x_mm: 56, y_mm: 57, z_mm: 15, rail: document.cabinet.rails[0] });
  assert.deepEqual(snapToRail(document, { ...profile, mounting: 'free' }, 47.4, 92.3), { x_mm: 47, y_mm: 92, z_mm: 0, rail: null });
  assert.deepEqual(profileSize(profile, 90), { width: 86, height: 18 });
});
test('draft recovery preserves base revision and unknown data without defaulting it', () => {
  const draft = { document, baseRevision: 3, savedKey: contentKey(document) };
  assert.deepEqual(readDraft(writeDraft(draft)), draft);
  assert.throws(() => readDraft('{"version":2}'), /lesbar/);
  assert.throws(() => parseDocumentJson('{"schema_version":2}'), /Version 1/);
  assert.throws(() => parseDocumentJson('broken'), /gültiges JSON/);
  assert.throws(() => parseDocumentJson('{"schema_version":1,"id":"x","cabinet":{},"profiles":[{"depth_mm":1e309}]}'), /nicht endliche/);
});
test('numeric fields distinguish unknown, explicit zero and malformed input', () => {
  assert.equal(parseNumber('', true), null);
  assert.equal(parseNumber(''), undefined);
  assert.equal(parseNumber('0', true), 0);
  assert.equal(parseNumber('12,5'), 12.5);
  assert.equal(parseNumber('12mm'), undefined);
  assert.equal(parseNumber('Infinity'), undefined);
});
test('new library versions receive aliases without rewriting old device evidence', () => {
  const oldSource: SourceRef = { id: 'firma:shared', issuer: 'Firma', title: 'Geräteblatt', url: 'https://example.test/old.pdf', edition: '2025', checked_on: '2026-01-01', sha256: 'a'.repeat(64), pages: '1', notes: 'Alter Stand' };
  const fresh = { ...oldSource, edition: '2026', url: 'https://example.test/new.pdf', sha256: 'b'.repeat(64), notes: 'Neuer Stand' };
  const oldProfile = { ...profile, source_ids: [oldSource.id] };
  const original = { ...document, sources: [oldSource], profiles: [oldProfile] };
  const added = withProfileSnapshot(original, { ...oldProfile, id: 'firma:new-device' }, [fresh]);
  assert.equal(added.document.sources[0], oldSource);
  assert.equal(added.document.profiles[0], oldProfile);
  assert.deepEqual(oldProfile.source_ids, ['firma:shared']);
  assert.notEqual(added.profile.source_ids[0], oldSource.id);
  assert.equal(added.document.sources.find(source => source.id === added.profile.source_ids[0])?.sha256, fresh.sha256);
  assert.equal(original.sources.length, 1);
  const again = withProfileSnapshot(added.document, { ...oldProfile, id: 'firma:another-device' }, [fresh]);
  assert.equal(again.document.sources.length, 2);
  assert.deepEqual(again.profile.source_ids, added.profile.source_ids);
  const frozen = withProfileSnapshot(original, { ...oldProfile, width_mm: 99 }, [fresh]);
  assert.equal(frozen.document, original);
  assert.equal(frozen.profile.width_mm, oldProfile.width_mm);
});
test('explicit VNB source updates keep previous snapshots and reuse unchanged versions', () => {
  const source: SourceRef = { id: 'primeo:wv', issuer: 'Primeo', title: 'WV', url: 'https://example.test/wv.pdf', edition: '0526', checked_on: '2026-01-01', sha256: 'a'.repeat(64), pages: '2', notes: '' };
  assert.deepEqual(mergeSourceSnapshots([source], [{ ...source }]).sources, [source]);
  const result = mergeSourceSnapshots([source], [{ ...source, checked_on: '2026-02-01' }]);
  assert.equal(result.sources[0], source);
  assert.equal(result.sources.length, 2);
  assert.notEqual(result.remap.get(source.id), source.id);
});
