import type { DeviceProfile, DistributionDocument, Placement, Rail, SourceRef } from './types.ts';

export const DRAFT_KEY = 'edeco.verteiler-dispo.draft.v1';
export const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;
export interface History { past: DistributionDocument[]; present: DistributionDocument; future: DistributionDocument[] }
export interface Draft { document: DistributionDocument; baseRevision: number; savedKey: string }
export function initialHistory(document: DistributionDocument): History { return { past: [], present: document, future: [] }; }
export function contentKey(document: DistributionDocument): string { return JSON.stringify({ ...document, revision: 0 }); }
function sourceBodyKey(source: SourceRef): string {
  return JSON.stringify([source.issuer, source.title, source.url, source.edition, source.checked_on, source.sha256, source.pages, source.notes]);
}
/** A refreshed library must never rewrite the evidence already attached to old devices. */
export function mergeSourceSnapshots(existing: readonly SourceRef[], incoming: readonly SourceRef[]): { sources: SourceRef[]; remap: Map<string, string> } {
  const sources = [...existing], remap = new Map<string, string>();
  for (const source of incoming) {
    const current = sources.find(item => item.id === source.id);
    if (!current) { sources.push({ ...source }); remap.set(source.id, source.id); continue; }
    if (sourceBodyKey(current) === sourceBodyKey(source)) { remap.set(source.id, current.id); continue; }
    const prefix = `${Array.from(source.id).slice(0, 100).join('')}:stand:`;
    const matching = sources.find(item => item.id.startsWith(prefix) && sourceBodyKey(item) === sourceBodyKey(source));
    if (matching) { remap.set(source.id, matching.id); continue; }
    let suffix = 2;
    while (sources.some(item => item.id === prefix + suffix)) suffix++;
    const id = prefix + suffix;
    sources.push({ ...source, id }); remap.set(source.id, id);
  }
  return { sources, remap };
}
export function withProfileSnapshot(document: DistributionDocument, incoming: DeviceProfile, availableSources: readonly SourceRef[]): { document: DistributionDocument; profile: DeviceProfile } {
  const frozen = document.profiles.find(item => item.id === incoming.id);
  if (frozen) return { document, profile: frozen };
  const needed = availableSources.filter(source => incoming.source_ids.includes(source.id));
  for (const id of incoming.source_ids) if (!needed.some(source => source.id === id) && !document.sources.some(source => source.id === id)) throw new Error(`Die Quelle «${id}» des neuen Bauteils fehlt. Bitte die Bibliothek erneut laden.`);
  const merged = mergeSourceSnapshots(document.sources, needed);
  const profile = { ...incoming, source_ids: incoming.source_ids.map(id => merged.remap.get(id) ?? id) };
  return { document: { ...document, profiles: [...document.profiles, profile], sources: merged.sources }, profile };
}
export function pushHistory(history: History, document: DistributionDocument): History {
  return contentKey(history.present) === contentKey(document) ? history : { past: [...history.past, history.present].slice(-50), present: document, future: [] };
}
export function travelHistory(history: History, forward: boolean): History {
  if (forward) {
    const next = history.future[0];
    return next ? { past: [...history.past, history.present].slice(-50), present: next, future: history.future.slice(1) } : history;
  }
  const previous = history.past.at(-1);
  return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] } : history;
}
function assertSerializableNumbers(value: unknown) {
  const stack: [unknown, number][] = [[value, 0]];
  let count = 0;
  while (stack.length) {
    const [item, depth] = stack.pop()!;
    if (++count > 200_000 || depth > 64) throw new Error('Die Verteiler-Datei ist zu komplex oder zu tief verschachtelt.');
    if (typeof item === 'number' && !Number.isFinite(item)) throw new Error('Die Verteiler-Datei enthält eine nicht endliche Zahl.');
    if (item && typeof item === 'object') for (const child of Object.values(item)) stack.push([child, depth + 1]);
  }
}
/** The backend validates the complete contract before an imported draft replaces the current one. */
export function parseDocumentJson(text: string): DistributionDocument {
  if (new TextEncoder().encode(text).length > MAX_DOCUMENT_BYTES) throw new Error('Verteiler-Dateien dürfen höchstens 12 MiB gross sein.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Die Datei enthält kein gültiges JSON. Der offene Entwurf bleibt erhalten.'); }
  assertSerializableNumbers(value);
  const document = value as Partial<DistributionDocument> | null;
  if (!document || typeof document !== 'object' || document.schema_version !== 1 || typeof document.id !== 'string' || !document.id || !document.cabinet || !Array.isArray(document.profiles)) {
    throw new Error('Erwartet wird eine Verteiler-Datei in Version 1. Der offene Entwurf bleibt erhalten.');
  }
  return document as DistributionDocument;
}
export function readDraft(raw: string): Draft {
  if (new TextEncoder().encode(raw).length > MAX_DOCUMENT_BYTES) throw new Error('Der lokale Entwurf ist zu gross. Bitte zunächst als Datei sichern.');
  const data = JSON.parse(raw) as Partial<Draft> & { version?: unknown };
  if (!data || data.version !== 1 || !data.document || !Number.isInteger(data.baseRevision) || (data.baseRevision ?? -1) < 0 || typeof data.savedKey !== 'string') throw new Error('Der lokale Wiederherstellungsentwurf ist nicht lesbar.');
  assertSerializableNumbers(data.document);
  return { document: parseDocumentJson(JSON.stringify(data.document)), baseRevision: data.baseRevision as number, savedKey: data.savedKey };
}
export function writeDraft(value: Draft): string { return JSON.stringify({ version: 1, ...value }); }
export function profileSize(profile: DeviceProfile, rotation = 0) {
  return rotation % 180 ? { width: profile.height_mm, height: profile.width_mm } : { width: profile.width_mm, height: profile.height_mm };
}
export function snapToRail(document: DistributionDocument, profile: DeviceProfile, x: number, y: number, railId?: string | null): { x_mm: number; y_mm: number; z_mm: number; rail: Rail | null } {
  const rails = document.cabinet.rails;
  const explicit = railId ? rails.find(item => item.id === railId) : null;
  const centre = y + profile.height_mm / 2;
  const nearest = explicit ?? [...rails].sort((a, b) => Math.abs(a.y_mm - centre) - Math.abs(b.y_mm - centre))[0] ?? null;
  if (profile.mounting !== 'din' || !nearest) return { x_mm: Math.round(x), y_mm: Math.round(y), z_mm: 0, rail: null };
  const pitch = nearest.te_pitch_mm;
  return { x_mm: nearest.x_mm + Math.round((x - nearest.x_mm) / pitch) * pitch, y_mm: nearest.y_mm - profile.height_mm / 2, z_mm: nearest.z_mm, rail: nearest };
}
export function newPlacement(document: DistributionDocument, profile: DeviceProfile, id: string, x?: number, y?: number): Placement {
  const rail = profile.mounting === 'din' ? document.cabinet.rails[0] : null;
  const row = document.cabinet.placements.filter(p => p.status !== 'removed' && p.rail_id === rail?.id);
  const right = row.reduce((n, p) => {
    const old = document.profiles.find(item => item.id === p.profile_id);
    return old ? Math.max(n, p.x_mm + profileSize(old, p.rotation).width + old.clearance_mm) : n;
  }, rail?.x_mm ?? 20);
  const position = snapToRail(document, profile, x ?? right, y ?? rail?.y_mm ?? 20, rail?.id);
  return { id, profile_id: profile.id, rail_id: position.rail?.id ?? null, field_id: position.rail?.field_id ?? document.cabinet.fields[0]?.id ?? null,
    label: profile.name, x_mm: position.x_mm, y_mm: position.y_mm, z_mm: position.z_mm, rotation: 0, status: 'planned', source_circuit_id: null, notes: '' };
}
/** Numeric fields keep unknown values empty; partial/invalid edits never become zero. */
export function parseNumber(value: string, nullable = false): number | null | undefined {
  if (!value.trim()) return nullable ? null : undefined;
  if (!/^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/u.test(value.trim())) return undefined;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : undefined;
}
