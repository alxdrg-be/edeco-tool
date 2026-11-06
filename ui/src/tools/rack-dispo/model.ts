import { createDefaultProfiles } from './catalog.ts';
import { isZeroSide, unitRangesOverlap } from './geometry.ts';
import { DOCUMENT_LIMITS, HE_MM, PANEL_WIDTH_MM } from './types.ts';
import type { DeviceProfile, DocumentAnalysis, JsonValue, KnownTotal, MountSide, MutationResult, Placement,
  PlacementDraft, PortBreakdown, PortRow, Rack, RackAnalysis, RackDocument, RackIssue, ValidationResult } from './types.ts';

export function newId(prefix = 'rack'): string { return `${prefix}-${crypto.randomUUID()}`; }
export function createRack(overrides: Partial<Rack> = {}): Rack {
  return { id: newId(), label: 'Rack 1', units: 42, widthMm: 800, heightMm: 2100, depthMm: 1000,
    usableDepthMm: null, frontDoorClearanceMm: null, rearDoorClearanceMm: null,
    weightLimitKg: null, powerBudgetW: null, room: '', notes: '', ...overrides };
}
export function createProfile(overrides: Partial<DeviceProfile> = {}): DeviceProfile {
  return { id: newId('profile'), name: 'Eigenes Gerät', kind: 'custom', units: 1, depthMm: null,
    inwardCableMm: null, outwardCableMm: null, weightKg: null, powerW: null, loadLimitKg: null,
    portCount: 0, medium: 'none', manufacturer: '', article: '', source: '', verified: false, ...overrides };
}
export function createEmptyDocument(): RackDocument {
  return { version: 1, name: 'Rack-Disposition', room: '', author: '', index: '', date: new Date().toISOString().slice(0, 10),
    racks: [createRack()], profiles: createDefaultProfiles(), placements: [], ports: [] };
}
export function createPlacement(draft: PlacementDraft, overrides: Partial<Placement> = {}): Placement {
  return { id: newId('device'), rackId: draft.rackId, profileId: draft.profileId, label: draft.label ?? '',
    startUnit: draft.startUnit, side: draft.side, status: 'planned', delivery: 'open', montage: 'open', notes: '',
    supportedById: null, zeroStartMm: null, zeroHeightMm: null, zeroInwardOffsetMm: null, ...overrides };
}
export function createExampleDocument(): RackDocument {
  const doc = createEmptyDocument();
  doc.name = 'Beispiel · UKV-Rack';
  doc.metadata = { example: true, source: 'Eigener Musteraufbau; keine Übernahme der Gerätepositionen aus den Projektplänen.' };
  doc.racks[0].label = '0.3 · UKV (Beispiel)';
  doc.racks[0].notes = '42 HE / 800 × 2100 × 1000 mm als Projektbeispiel. Nutzbare Tiefe, Gerätedaten und Einbauabstände sind offen.';
  doc.profiles.push(createProfile({ id: 'example-reserve4', name: 'USV-Ausbaureserve · 4 HE', kind: 'reserve', units: 4 }));
  const rackId = doc.racks[0].id;
  const equipment: [string, number, string, MountSide][] = [
    ['generic-fiber24', 42, 'LWL-Panel', 'front'], ['generic-patch24', 40, 'Patchpanel 24 Ports', 'front'],
    ['generic-manager', 39, 'Rangierpanel', 'front'], ['generic-switch24', 38, 'Switch 24 Ports', 'front'],
    ['generic-shelf', 5, 'Fachboden', 'front'], ['example-reserve4', 1, 'Freihalten · USV (Beispiel)', 'front'],
    ['generic-pdu', 1, 'PDU · Rückseite, Lage offen', 'zero-rear'], ['generic-earth', 1, 'Potenzialausgleich · Anschluss offen', 'zero-left'],
  ];
  doc.placements = equipment.map(([profileId, startUnit, label, side]) => createPlacement({ rackId, profileId, startUnit, label, side }));
  return doc;
}

const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const profileKinds = ['patch', 'switch', 'fiber', 'manager', 'shelf', 'blank', 'ups', 'pdu', 'earth', 'reserve', 'custom'];
const sides = ['front', 'rear', 'zero-left', 'zero-right', 'zero-rear'];
const workStates = ['open', 'ordered', 'delivered', 'done', 'not-required'];
/** Structural validation deliberately accepts geometric conflicts so a saved plan can be reopened and repaired. */
export function validateDocument(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!object(value)) return { valid: false, errors: ['Die Datei enthält kein Rack-Dokument.'] };
  const str = (v: unknown, path: string, max: number = DOCUMENT_LIMITS.text, optional = false) => {
    if (optional && v === undefined) return;
    if (typeof v !== 'string' || v.length > max) errors.push(`${path}: Text mit höchstens ${max} Zeichen erwartet.`);
  };
  const num = (v: unknown, path: string, min: number, max: number, nullable = false, integer = false) => {
    if (nullable && v === null) return;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v)))
      errors.push(`${path}: ${integer ? 'Ganzzahl' : 'Zahl'} zwischen ${min} und ${max}${nullable ? ' oder null' : ''} erwartet.`);
  };
  const en = (v: unknown, path: string, values: string[]) => { if (typeof v !== 'string' || !values.includes(v)) errors.push(`${path}: Ungültige Auswahl.`); };
  let jsonNodes = 0;
  const json = (v: unknown, depth = 0): boolean => {
    if (++jsonNodes > 100000 || depth > 10) return false;
    if (v === null || typeof v === 'boolean') return true;
    if (typeof v === 'string') return v.length <= 10000;
    if (typeof v === 'number') return Number.isFinite(v);
    if (Array.isArray(v)) return v.length <= 1000 && v.every(item => json(item, depth + 1));
    if (object(v)) return Object.keys(v).length <= 1000 && Object.entries(v).every(([key, val]) => key.length <= 120 && !['__proto__', 'constructor', 'prototype'].includes(key) && json(val, depth + 1));
    return false;
  };
  const metadata = (v: unknown, path: string) => { if (v !== undefined && (!object(v) || !json(v))) errors.push(`${path}: Ungültige oder zu umfangreiche Zusatzdaten.`); };
  const keys = (v: Record<string, unknown>, allowed: string[], path: string) => {
    for (const key of Object.keys(v)) if (!allowed.includes(key)) errors.push(`${path}.${key}: Unbekanntes Feld; Zusatzdaten gehören in metadata.`);
  };
  keys(value, ['version', 'name', 'projectId', 'projectNumber', 'room', 'author', 'index', 'date', 'racks', 'profiles', 'placements', 'ports', 'metadata'], 'document');
  const arrays: Record<string, unknown[]> = {};
  for (const [key, max] of Object.entries(DOCUMENT_LIMITS)) {
    if (key === 'text') continue;
    if (!Array.isArray(value[key]) || (value[key] as unknown[]).length > max) errors.push(`${key}: Liste mit höchstens ${max} Einträgen erwartet.`);
    else arrays[key] = value[key] as unknown[];
  }
  if (arrays.racks?.length === 0) errors.push('racks: Mindestens ein Rack ist erforderlich.');
  if (value.version !== 1) errors.push('Nicht unterstützte Rack-Dateiversion; erwartet wird Version 1.');
  for (const key of ['name', 'room', 'author', 'index', 'date']) str(value[key], key);
  str(value.projectId, 'projectId', 120, true); str(value.projectNumber, 'projectNumber', 120, true); metadata(value.metadata, 'metadata');
  if (errors.length) return { valid: false, errors };
  const allIds = new Set<string>();
  const ids = (v: unknown, path: string) => {
    str(v, path, 120);
    if (typeof v === 'string') {
      if (!v.trim() || allIds.has(v)) errors.push(`${path}: Leere oder doppelte ID.`);
      allIds.add(v);
    }
  };
  for (const [i, raw] of arrays.racks.entries()) {
    const p = `racks[${i}]`; if (!object(raw)) { errors.push(`${p}: Objekt erwartet.`); continue; }
    keys(raw, ['id', 'label', 'units', 'widthMm', 'heightMm', 'depthMm', 'usableDepthMm', 'frontDoorClearanceMm', 'rearDoorClearanceMm', 'weightLimitKg', 'powerBudgetW', 'room', 'notes', 'metadata'], p);
    ids(raw.id, `${p}.id`); for (const key of ['label', 'room', 'notes']) str(raw[key], `${p}.${key}`);
    num(raw.units, `${p}.units`, 1, 60, false, true);
    for (const key of ['widthMm', 'heightMm', 'depthMm']) num(raw[key], `${p}.${key}`, 0.001, 100000);
    for (const key of ['usableDepthMm', 'frontDoorClearanceMm', 'rearDoorClearanceMm']) num(raw[key], `${p}.${key}`, 0, 100000, true);
    num(raw.weightLimitKg, `${p}.weightLimitKg`, 0, 1e6, true); num(raw.powerBudgetW, `${p}.powerBudgetW`, 0, 1e7, true); metadata(raw.metadata, `${p}.metadata`);
  }
  for (const [i, raw] of arrays.profiles.entries()) {
    const p = `profiles[${i}]`; if (!object(raw)) { errors.push(`${p}: Objekt erwartet.`); continue; }
    keys(raw, ['id', 'name', 'kind', 'units', 'depthMm', 'inwardCableMm', 'outwardCableMm', 'weightKg', 'powerW', 'loadLimitKg', 'portCount', 'medium', 'manufacturer', 'article', 'source', 'verified', 'metadata'], p);
    ids(raw.id, `${p}.id`); for (const key of ['name', 'manufacturer', 'article', 'source']) str(raw[key], `${p}.${key}`);
    en(raw.kind, `${p}.kind`, profileKinds); num(raw.units, `${p}.units`, 0, 60, false, true);
    for (const key of ['depthMm', 'inwardCableMm', 'outwardCableMm']) num(raw[key], `${p}.${key}`, 0, 100000, true);
    for (const key of ['weightKg', 'loadLimitKg']) num(raw[key], `${p}.${key}`, 0, 1e6, true);
    num(raw.powerW, `${p}.powerW`, 0, 1e7, true); num(raw.portCount, `${p}.portCount`, 0, 288, false, true);
    en(raw.medium, `${p}.medium`, ['RJ45', 'LWL', 'none']); if (typeof raw.verified !== 'boolean') errors.push(`${p}.verified: Wahrheitswert erwartet.`);
    metadata(raw.metadata, `${p}.metadata`);
  }
  for (const [i, raw] of arrays.placements.entries()) {
    const p = `placements[${i}]`; if (!object(raw)) { errors.push(`${p}: Objekt erwartet.`); continue; }
    keys(raw, ['id', 'rackId', 'profileId', 'label', 'startUnit', 'side', 'status', 'delivery', 'montage', 'notes', 'supportedById', 'zeroStartMm', 'zeroHeightMm', 'zeroInwardOffsetMm', 'metadata'], p);
    ids(raw.id, `${p}.id`); str(raw.rackId, `${p}.rackId`, 120); str(raw.profileId, `${p}.profileId`, 120);
    for (const key of ['label', 'notes']) str(raw[key], `${p}.${key}`);
    num(raw.startUnit, `${p}.startUnit`, 1, 60, false, true); en(raw.side, `${p}.side`, sides);
    en(raw.status, `${p}.status`, ['planned', 'existing', 'removed']); en(raw.delivery, `${p}.delivery`, workStates); en(raw.montage, `${p}.montage`, workStates);
    if (raw.supportedById !== null) str(raw.supportedById, `${p}.supportedById`, 120);
    for (const key of ['zeroStartMm', 'zeroHeightMm', 'zeroInwardOffsetMm']) num(raw[key], `${p}.${key}`, 0, 100000, true);
    metadata(raw.metadata, `${p}.metadata`);
  }
  for (const [i, raw] of arrays.ports.entries()) {
    const p = `ports[${i}]`; if (!object(raw)) { errors.push(`${p}: Objekt erwartet.`); continue; }
    keys(raw, ['placementId', 'number', 'label', 'target', 'outlet', 'room', 'state', 'metadata'], p);
    str(raw.placementId, `${p}.placementId`, 120); num(raw.number, `${p}.number`, 1, 288, false, true);
    for (const key of ['label', 'target', 'outlet', 'room']) str(raw[key], `${p}.${key}`);
    en(raw.state, `${p}.state`, ['unknown', 'not-built', 'built', 'occupied']); metadata(raw.metadata, `${p}.metadata`);
  }
  if (errors.length) return { valid: false, errors };
  const doc = value as unknown as RackDocument;
  const racks = new Map(doc.racks.map(r => [r.id, r])); const profiles = new Map(doc.profiles.map(p => [p.id, p]));
  const placements = new Map(doc.placements.map(p => [p.id, p]));
  for (const p of doc.placements) {
    if (!racks.has(p.rackId)) errors.push(`${p.id}: Rack fehlt.`);
    if (!profiles.has(p.profileId)) errors.push(`${p.id}: Geräteprofil fehlt.`);
    if (p.supportedById !== null) {
      const support = placements.get(p.supportedById);
      if (!support || support.id === p.id || support.rackId !== p.rackId || profiles.get(support.profileId)?.kind !== 'shelf') errors.push(`${p.id}: Ungültiger tragender Fachboden.`);
    }
  }
  const portKeys = new Set<string>();
  for (const p of doc.ports) {
    const placement = placements.get(p.placementId); const capacity = placement ? profiles.get(placement.profileId)?.portCount : undefined;
    if (capacity === undefined || p.number > capacity) errors.push(`${p.placementId}, Port ${p.number}: Gerät oder Portposition fehlt.`);
    const key = `${p.placementId}:${p.number}`; if (portKeys.has(key)) errors.push(`${key}: Doppelte Portzeile.`); portKeys.add(key);
  }
  if (errors.length) return { valid: false, errors };
  try { return { valid: true, errors: [], document: structuredClone(doc) }; }
  catch { return { valid: false, errors: ['Dokument enthält nicht speicherbare Zusatzdaten.'] }; }
}
export function normalizeImport(value: unknown): RackDocument {
  const result = validateDocument(value);
  if (!result.valid || !result.document) throw new Error(result.errors.slice(0, 6).join('\n'));
  return result.document;
}
export function portRows(doc: RackDocument, placementId?: string): PortRow[] {
  const stored = new Map(doc.ports.map(row => [`${row.placementId}:${row.number}`, row]));
  const profiles = new Map(doc.profiles.map(profile => [profile.id, profile]));
  return doc.placements.filter(p => p.status !== 'removed' && profiles.get(p.profileId)?.kind !== 'reserve' && (!placementId || p.id === placementId)).flatMap(p =>
    Array.from({ length: profiles.get(p.profileId)?.portCount ?? 0 }, (_, i) => stored.get(`${p.id}:${i + 1}`) ??
      { placementId: p.id, number: i + 1, label: '', target: '', outlet: '', room: '', state: 'unknown' as const }));
}
export function updatePort(doc: RackDocument, row: PortRow): RackDocument {
  const placement = doc.placements.find(p => p.id === row.placementId);
  const profile = doc.profiles.find(p => p.id === placement?.profileId);
  if (!profile || !Number.isInteger(row.number) || row.number < 1 || row.number > profile.portCount) return doc;
  return { ...doc, ports: [...doc.ports.filter(p => !(p.placementId === row.placementId && p.number === row.number)), { ...row }] };
}

const total = (profiles: DeviceProfile[], field: 'weightKg' | 'powerW'): KnownTotal => {
  const missing = profiles.filter(p => p[field] === null).length;
  return { known: profiles.reduce((sum, p) => sum + (p[field] ?? 0), 0), missing, complete: missing === 0 };
};
export function analyzeRacks(doc: RackDocument): DocumentAnalysis {
  const profiles = new Map(doc.profiles.map(p => [p.id, p]));
  const allIssues: RackIssue[] = [];
  const rowsByPlacement = new Map<string, PortRow[]>();
  for (const row of doc.ports) { const rows = rowsByPlacement.get(row.placementId) ?? []; rows.push(row); rowsByPlacement.set(row.placementId, rows); }
  const analyses = doc.racks.map((rack): RackAnalysis => {
    const issues: RackIssue[] = [];
    const add = (code: string, severity: RackIssue['severity'], message: string, explanation: string,
      placementIds: string[] = [], field?: string, actual?: number, limit?: number) => {
      const id = `${rack.id}:${code}:${[...placementIds].sort().join(':')}`;
      if (!issues.some(i => i.id === id)) issues.push({ id, code, severity, message, explanation, rackId: rack.id, placementIds, field, actual, limit });
    };
    const entries = doc.placements.filter(p => p.rackId === rack.id && p.status !== 'removed')
      .flatMap(placement => { const profile = profiles.get(placement.profileId); return profile ? [{ placement, profile }] : []; });
    const devices = entries.filter(e => e.profile.kind !== 'reserve');
    if (rack.units * HE_MM > rack.heightMm) add('case-height', 'error', 'HE-Raster passt nicht in die Gehäusehöhe.', `${rack.units} × 44,45 mm benötigen ${rack.units * HE_MM} mm ohne Rahmen.`, [], 'heightMm', rack.heightMm, rack.units * HE_MM);
    if (rack.widthMm < PANEL_WIDTH_MM) add('case-width', 'error', 'Das Gehäuse ist schmaler als eine 19-Zoll-Front.', '19 Zoll entsprechen 482,6 mm; Hersteller-Montagefreiheit zusätzlich prüfen.', [], 'widthMm', rack.widthMm, PANEL_WIDTH_MM);
    if (rack.usableDepthMm !== null && rack.usableDepthMm > rack.depthMm) add('usable-depth', 'error', 'Nutzbare Tiefe ist grösser als das Gehäuse.', 'Den Abstand zwischen den Montageebenen aus dem Herstellerplan übernehmen.', [], 'usableDepthMm', rack.usableDepthMm, rack.depthMm);
    if (rack.usableDepthMm !== null) {
      const depthMinimum = rack.usableDepthMm + (rack.frontDoorClearanceMm ?? 0) + (rack.rearDoorClearanceMm ?? 0);
      if (depthMinimum > rack.depthMm) add('case-depth-sum', 'error', 'Die angegebenen Innenabstände passen nicht in die Gehäusetiefe.', 'Abstand zwischen den Montageebenen plus die bekannten Türabstände darf die äussere Gehäusetiefe nicht überschreiten. Unbekannte Abstände bestätigen keine freie Resttiefe.', [], 'usableDepthMm', depthMinimum, rack.depthMm);
    }
    if (devices.some(e => !isZeroSide(e.placement.side)) && rack.usableDepthMm === null) add('rack-depth-open', 'open', 'Nutzbare Einbautiefe ist offen.', 'Die Gehäuse-Aussentiefe ist kein Nachweis des freien Abstands zwischen den Montageebenen.', [], 'usableDepthMm');
    const occupied = new Set<number>(); const front = new Set<number>(); const rear = new Set<number>(); const reserved = new Set<number>();
    for (const { placement: p, profile: pr } of entries) {
      const name = p.label || pr.name;
      if (isZeroSide(p.side)) {
        if (pr.units !== 0) add('mounting-zero', 'error', `${name}: Profil ist kein 0-HE-Zubehör.`, 'Für den seitlichen Einbau ein Profil mit 0 HE verwenden.', [p.id], 'units', pr.units, 0);
        if (p.zeroStartMm === null || p.zeroHeightMm === null || p.zeroInwardOffsetMm === null || pr.depthMm === null)
          add('zero-location-open', 'open', `${name}: 0-HE-Einbauraum ist offen.`, 'Zone, Höhe und Tiefenlage mit Herstellerzeichnung prüfen. 0 HE belegt keine HE der Front; seitliche Kabelführung und Befestigung bleiben separat zu prüfen.', [p.id], 'zeroInwardOffsetMm');
        if (p.zeroStartMm !== null && p.zeroHeightMm !== null && p.zeroStartMm + p.zeroHeightMm > rack.units * HE_MM)
          add('zero-height', 'error', `${name}: Höhe liegt ausserhalb des Montagefelds.`, '0-HE-Unterkante und Zubehörhöhe innerhalb des HE-Montagefelds angeben.', [p.id], 'zeroHeightMm', p.zeroStartMm + p.zeroHeightMm, rack.units * HE_MM);
        if (p.zeroHeightMm === 0) add('zero-height-empty', 'error', `${name}: Zubehörhöhe muss positiv sein.`, 'Eine gemessene Höhe eintragen oder den Wert als offen lassen.', [p.id], 'zeroHeightMm');
        if (p.zeroInwardOffsetMm !== null && pr.depthMm !== null && rack.usableDepthMm !== null) {
          const end = p.zeroInwardOffsetMm + pr.depthMm + (pr.inwardCableMm ?? 0);
          if (end > rack.usableDepthMm) add('zero-depth', 'error', `${name}: 0-HE-Einbauraum liegt ausserhalb der Montageebenen.`, 'Die Tiefenlage wird ab der vorderen Montageebene gemessen. Für Zubehör ausserhalb dieses Raums ist ein eigener Hersteller-Einbaunachweis nötig.', [p.id], 'zeroInwardOffsetMm', end, rack.usableDepthMm);
        }
        if (rack.usableDepthMm === null || pr.inwardCableMm === null) add('zero-depth-open', 'open', `${name}: 0-HE-Tiefenprüfung offen.`, 'Abstand zwischen den Montageebenen und inneren Kabelraum erfassen. Eine offene Angabe ist keine Kollisionsfreigabe.', [p.id], 'inwardCableMm');
        if (p.side === 'zero-rear') {
          if (pr.outwardCableMm === null || rack.rearDoorClearanceMm === null) add('door-clearance-open', 'open', `${name}: Rückseitiger Tür-/Kabelraum offen.`, 'Den äusseren Kabelraum gegen den Abstand von der hinteren Montageebene zur Tür prüfen.', [p.id], 'outwardCableMm');
          else if (pr.outwardCableMm > rack.rearDoorClearanceMm) add('door-clearance', 'error', `${name}: Rückseitiger Kabelraum vor der Tür reicht nicht.`, 'Kabel-/Steckerraum oder Herstelleranordnung anpassen.', [p.id], 'outwardCableMm', pr.outwardCableMm, rack.rearDoorClearanceMm);
        }
        if (p.side !== 'zero-rear') add('zero-side-open', 'open', `${name}: Seitliche Montagefreiheit prüfen.`, 'Die linke/rechte Zone wird dargestellt; freie Breite, Montagepunkte und Kabelwege sind nicht aus der HE-Belegung ableitbar.', [p.id]);
        continue;
      }
      if (pr.units < 1) add('mounting-rack', 'error', `${name}: 0-HE-Profil liegt im HE-Raster.`, 'Das Zubehör einer seitlichen oder rückwärtigen 0-HE-Zone zuordnen.', [p.id], 'side');
      if (!Number.isInteger(p.startUnit) || p.startUnit < 1 || p.startUnit + pr.units - 1 > rack.units)
        add('unit-bounds', 'error', `${name}: Gerät liegt ausserhalb des HE-Rasters.`, `Unterkante muss zwischen HE 1 und HE ${Math.max(1, rack.units - pr.units + 1)} liegen.`, [p.id], 'startUnit', p.startUnit, rack.units - pr.units + 1);
      for (let u = Math.max(1, p.startUnit); u < Math.min(rack.units + 1, p.startUnit + pr.units); u++) {
        if (pr.kind === 'reserve') reserved.add(u); else { occupied.add(u); (p.side === 'front' ? front : rear).add(u); }
      }
      if (pr.kind === 'reserve') continue;
      if (pr.depthMm === null || pr.inwardCableMm === null) add('device-depth-open', 'open', `${name}: Geräte- oder Kabeltiefe fehlt.`, 'Gehäusetiefe des Geräts plus nötigen Kabelbiegeraum hinter dem Gerät erfassen; fehlende Angaben werden nicht als 0 mm gewertet.', [p.id], 'depthMm');
      else if (rack.usableDepthMm !== null && pr.depthMm + pr.inwardCableMm > rack.usableDepthMm)
        add('device-depth', 'error', `${name}: Einbautiefe reicht nicht.`, 'Gerätetiefe plus innerer Kabelraum muss in den Abstand zwischen den Montageebenen passen.', [p.id], 'depthMm', pr.depthMm + pr.inwardCableMm, rack.usableDepthMm);
      const clearance = p.side === 'front' ? rack.frontDoorClearanceMm : rack.rearDoorClearanceMm;
      if (pr.outwardCableMm === null || clearance === null) add('door-clearance-open', 'open', `${name}: Tür-/Patchkabelfreiraum ist offen.`, 'Kabelraum vor der Montageebene mit dem freien Abstand zur jeweiligen Tür vergleichen.', [p.id], 'outwardCableMm');
      else if (pr.outwardCableMm > clearance) add('door-clearance', 'error', `${name}: Kabelraum vor der Tür reicht nicht.`, 'Mehr Abstand zur Tür vorsehen oder geeignete Kabel-/Steckerausführung nachweisen.', [p.id], 'outwardCableMm', pr.outwardCableMm, clearance);
    }
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]; const b = entries[j]; const ids = [a.placement.id, b.placement.id];
      const aZero = isZeroSide(a.placement.side); const bZero = isZeroSide(b.placement.side);
      if (aZero || bZero) {
        // Only a fully located 0-HE accessory in the rear equipment corridor can produce a definite collision.
        if (aZero && bZero) {
          if (a.placement.side !== b.placement.side || a.placement.zeroStartMm === null || a.placement.zeroHeightMm === null || b.placement.zeroStartMm === null || b.placement.zeroHeightMm === null) continue;
          const vertical = unitRangesOverlap(a.placement.zeroStartMm, a.placement.zeroHeightMm, b.placement.zeroStartMm, b.placement.zeroHeightMm);
          if (vertical && a.placement.zeroInwardOffsetMm !== null && b.placement.zeroInwardOffsetMm !== null && a.profile.depthMm !== null && b.profile.depthMm !== null && unitRangesOverlap(a.placement.zeroInwardOffsetMm, a.profile.depthMm + (a.profile.inwardCableMm ?? 0), b.placement.zeroInwardOffsetMm, b.profile.depthMm + (b.profile.inwardCableMm ?? 0)))
            add('zero-collision', 'error', `${a.placement.label || a.profile.name} und ${b.placement.label || b.profile.name} überschneiden sich.`, 'Zwei vollständig verortete 0-HE-Körper belegen denselben Höhen- und Tiefenraum derselben Zone.', ids);
          continue;
        }
        const zero = aZero ? a : b; const mounted = aZero ? b : a;
        if (zero.placement.side !== 'zero-rear' || mounted.profile.kind === 'reserve' || zero.placement.zeroStartMm === null || zero.placement.zeroHeightMm === null || zero.placement.zeroInwardOffsetMm === null || zero.profile.depthMm === null || rack.usableDepthMm === null || mounted.profile.depthMm === null || mounted.profile.inwardCableMm === null) continue;
        const vertical = unitRangesOverlap(zero.placement.zeroStartMm, zero.placement.zeroHeightMm, (mounted.placement.startUnit - 1) * HE_MM, mounted.profile.units * HE_MM);
        const inward = mounted.profile.depthMm + mounted.profile.inwardCableMm;
        const mountedStart = mounted.placement.side === 'front' ? 0 : rack.usableDepthMm - inward;
        if (vertical && unitRangesOverlap(zero.placement.zeroInwardOffsetMm, zero.profile.depthMm + (zero.profile.inwardCableMm ?? 0), mountedStart, inward))
          add('zero-equipment-collision', 'error', '0-HE-Zubehör kollidiert mit einem Gerät.', 'Die dokumentierte Tiefenlage des rückwärtigen Zubehörs überschneidet den Gerät-/Kabelraum im selben Höhenbereich.', ids);
        continue;
      }
      if (!unitRangesOverlap(a.placement.startUnit, a.profile.units, b.placement.startUnit, b.profile.units)) continue;
      if (a.placement.side === b.placement.side) add('unit-collision', 'error', `${a.placement.label || a.profile.name} und ${b.placement.label || b.profile.name}: HE doppelt belegt.`, `Die HE-Bereiche überlappen auf der ${a.placement.side === 'front' ? 'Vorderseite' : 'Rückseite'}. Gerät oder Freihaltereserve verschieben.`, ids, 'startUnit');
      else if (a.profile.kind !== 'reserve' && b.profile.kind !== 'reserve') {
        if ([a.profile.depthMm, a.profile.inwardCableMm, b.profile.depthMm, b.profile.inwardCableMm, rack.usableDepthMm].some(v => v === null))
          add('opposite-depth-open', 'open', 'Vorder- und Rückgerät: gemeinsame Tiefe offen.', 'Gleiche HE sind erst geprüft, wenn beide Geräte- und inneren Kabeltiefen sowie der Abstand zwischen den Montageebenen bekannt sind.', ids);
        else {
          const used = a.profile.depthMm! + a.profile.inwardCableMm! + b.profile.depthMm! + b.profile.inwardCableMm!;
          if (used > rack.usableDepthMm!) add('depth-collision', 'error', `${a.placement.label || a.profile.name} und ${b.placement.label || b.profile.name}: Tiefenkollision.`, 'Die beiden Geräte-/Kabelräume benötigen zusammen mehr als den Abstand zwischen den Montageebenen.', ids, 'depthMm', used, rack.usableDepthMm!);
        }
      }
    }
    const weight = total(devices.map(e => e.profile), 'weightKg'); const power = total(devices.map(e => e.profile), 'powerW');
    if (devices.length && rack.weightLimitKg === null) add('weight-limit-open', 'open', 'Dokumentierte Rack-Traglast fehlt.', 'Die bekannte Gewichtssumme allein ist keine Traglastprüfung. Den freigegebenen Herstellerwert eintragen.', [], 'weightLimitKg');
    if (devices.length && rack.powerBudgetW === null) add('power-budget-open', 'open', 'Dokumentiertes Wirkleistungsbudget fehlt.', 'Die W-Summe kann ohne Budget nicht bewertet werden. Zuleitung, USV und Wärmeabfuhr benötigen eigene Nachweise.', [], 'powerBudgetW');
    if (weight.missing) add('weight-open', 'open', `Gewicht: ${weight.missing} Geräteangaben fehlen.`, 'Die Summe zeigt nur bekannte Eigengewichte. Zubehör, Kabel und montierte Geräte vollständig berücksichtigen.', [], 'weightKg');
    if (rack.weightLimitKg !== null && weight.known > rack.weightLimitKg) add('rack-weight', 'error', 'Bekanntes Gesamtgewicht überschreitet die Rack-Traglast.', 'Eine geringere Belegung oder ein Rack mit dokumentierter höherer Traglast vorsehen.', devices.map(e => e.placement.id), 'weightLimitKg', weight.known, rack.weightLimitKg);
    if (power.missing) add('power-open', 'open', `Leistung: ${power.missing} Geräteangaben fehlen.`, 'Die bekannte Wirkleistungssumme ist keine vollständige Zuleitungs-, USV- oder Kühlungsprüfung. VA-Werte dürfen nicht direkt mit W verglichen werden.', [], 'powerW');
    if (rack.powerBudgetW !== null && power.known > rack.powerBudgetW) add('rack-power', 'error', 'Bekannte Wirkleistung überschreitet das dokumentierte Budget.', 'Verbraucher reduzieren oder Versorgung separat dimensionieren; USV-Scheinleistung in VA ist kein W-Budget.', devices.map(e => e.placement.id), 'powerBudgetW', power.known, rack.powerBudgetW);
    for (const { placement, profile } of devices) {
      if (profile.kind === 'earth') add('bonding-open', 'open', 'Potenzialausgleich: Anschlussnachweis offen.', 'Die Platzierung eines Symbols bestätigt weder Verbindung noch Querschnitt oder Durchgängigkeit.', [placement.id]);
      if (placement.supportedById !== null) {
        const support = entries.find(e => e.placement.id === placement.supportedById);
        if (!support || support.profile.kind !== 'shelf') add('support-missing', 'error', 'Zugeordneter tragender Fachboden fehlt.', 'Einen aktiven Fachboden in diesem Rack zuordnen.', [placement.id], 'supportedById');
      }
      if (profile.kind !== 'shelf') continue;
      const supported = devices.filter(e => e.placement.supportedById === placement.id);
      if (!supported.length) continue;
      const payload = total(supported.map(e => e.profile), 'weightKg');
      if (profile.loadLimitKg === null || payload.missing) add('shelf-load-open', 'open', `${placement.label || profile.name}: Nutzlastprüfung offen.`, 'Dokumentierte Fachboden-Nutzlast und Eigengewichte aller zugeordneten Geräte erfassen.', [placement.id, ...supported.map(e => e.placement.id)], 'loadLimitKg');
      if (profile.loadLimitKg !== null && payload.known > profile.loadLimitKg) add('shelf-load', 'error', `${placement.label || profile.name}: Nutzlast überschritten.`, 'Die Summe der zugeordneten Gerätegewichte überschreitet die dokumentierte Fachboden-Nutzlast; Fachboden-Eigengewicht zählt nur in der Rack-Summe.', [placement.id, ...supported.map(e => e.placement.id)], 'loadLimitKg', payload.known, profile.loadLimitKg);
    }
    const rows = devices.flatMap(e => rowsByPlacement.get(e.placement.id) ?? []);
    const capacity = devices.reduce((sum, e) => sum + e.profile.portCount, 0);
    const portGroups = new Map<string, PortBreakdown>();
    for (const { placement, profile } of devices) {
      if (!profile.portCount) continue;
      const key = `${profile.kind}:${profile.medium}`;
      const group = portGroups.get(key) ?? { kind: profile.kind, medium: profile.medium, capacity: 0, built: 0, occupied: 0, unknown: 0 };
      const deviceRows = rowsByPlacement.get(placement.id) ?? [];
      group.capacity += profile.portCount; group.built += deviceRows.filter(r => r.state === 'built' || r.state === 'occupied').length;
      group.occupied += deviceRows.filter(r => r.state === 'occupied').length; group.unknown += profile.portCount - deviceRows.filter(r => r.state !== 'unknown').length;
      portGroups.set(key, group);
    }
    const freeUnits = Math.max(0, rack.units - new Set([...occupied, ...reserved]).size);
    const severityOrder = { error: 0, warning: 1, open: 2 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    const analysis: RackAnalysis = { rackId: rack.id, objects: devices.length, usedUnits: occupied.size, reservedUnits: reserved.size, freeUnits,
      frontUsedUnits: front.size, rearUsedUnits: rear.size, zeroObjects: devices.filter(e => isZeroSide(e.placement.side)).length,
      portCapacity: capacity, portsBuilt: rows.filter(r => r.state === 'built' || r.state === 'occupied').length,
      portsOccupied: rows.filter(r => r.state === 'occupied').length, portsUnknown: capacity - rows.filter(r => r.state !== 'unknown').length, portBreakdown: [...portGroups.values()], weight, power, issues };
    allIssues.push(...issues); return analysis;
  });
  return { racks: analyses, issues: allIssues };
}

function mutation(doc: RackDocument, ids: string[]): MutationResult {
  const affectedRacks = new Set(doc.placements.filter(p => ids.includes(p.id)).map(p => p.rackId));
  const issues = analyzeRacks(doc).issues.filter(issue => issue.placementIds.some(id => ids.includes(id)) || (!issue.placementIds.length && affectedRacks.has(issue.rackId)));
  const severityOrder = { error: 0, warning: 1, open: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return { document: doc, placementIds: ids, issues, accepted: !issues.some(i => i.severity === 'error') };
}
export function addPlacement(doc: RackDocument, draft: PlacementDraft): MutationResult {
  if (!doc.racks.some(r => r.id === draft.rackId) || !doc.profiles.some(p => p.id === draft.profileId)) return { document: doc, placementIds: [], issues: [], accepted: false };
  const p = createPlacement(draft);
  return mutation({ ...doc, placements: [...doc.placements, p] }, [p.id]);
}
export function movePlacements(doc: RackDocument, ids: string[], delta: number): MutationResult {
  if (!Number.isInteger(delta)) return { document: doc, placementIds: [], issues: [], accepted: false };
  const candidate = { ...doc, placements: doc.placements.map(p => ids.includes(p.id) && !isZeroSide(p.side) ? { ...p, startUnit: p.startUnit + delta } : p) };
  return mutation(candidate, ids);
}
function slotFree(doc: RackDocument, rackId: string, profile: DeviceProfile, side: MountSide, start: number): boolean {
  return !doc.placements.some(p => p.rackId === rackId && p.side === side && p.status !== 'removed' &&
    unitRangesOverlap(start, profile.units, p.startUnit, doc.profiles.find(pr => pr.id === p.profileId)?.units ?? 0));
}
/** Adjacent slot above first, then directly below, then the nearest gap in either direction. */
export function copyStart(doc: RackDocument, rackId: string, profileId: string, side: MountSide, origin: number): number | null {
  const rack = doc.racks.find(r => r.id === rackId), profile = doc.profiles.find(p => p.id === profileId);
  if (!rack || !profile) return null;
  if (isZeroSide(side)) return profile.units === 0 ? 1 : null;
  if (profile.units < 1) return null;
  const max = Math.max(0, rack.units - profile.units + 1), ordered: number[] = [];
  const push = (start: number) => { if (start >= 1 && start <= max && !ordered.includes(start)) ordered.push(start); };
  push(origin + profile.units); push(origin - profile.units);
  for (let step = 1; step <= rack.units; step++) { push(origin - step); push(origin + step); }
  return ordered.find(start => slotFree(doc, rackId, profile, side, start)) ?? null;
}
export function findFreeStart(doc: RackDocument, rackId: string, profileId: string, side: MountSide, preferred = 1): number | null {
  const rack = doc.racks.find(r => r.id === rackId); const profile = doc.profiles.find(p => p.id === profileId);
  if (!rack || !profile) return null;
  if (isZeroSide(side)) return profile.units === 0 ? 1 : null;
  if (profile.units < 1) return null;
  const starts = Array.from({ length: Math.max(0, rack.units - profile.units + 1) }, (_, i) => i + 1);
  starts.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b);
  return starts.find(start => !doc.placements.some(p => p.rackId === rackId && p.side === side && p.status !== 'removed' &&
    unitRangesOverlap(start, profile.units, p.startUnit, doc.profiles.find(pr => pr.id === p.profileId)?.units ?? 0))) ?? null;
}
export function duplicatePlacements(doc: RackDocument, ids: string[]): MutationResult {
  let candidate = doc; const created: string[] = []; const copied = new Map<string, string>();
  for (const p of doc.placements.filter(p => ids.includes(p.id) && p.status !== 'removed')) {
    const profile = doc.profiles.find(pr => pr.id === p.profileId);
    if (!profile) continue;
    const startUnit = copyStart(candidate, p.rackId, p.profileId, p.side, p.startUnit);
    if (startUnit === null) return { document: doc, placementIds: [], accepted: false, issues: [{
      id: `${p.rackId}:copy-space:${p.id}`, code: 'copy-space', severity: 'error', rackId: p.rackId, placementIds: [p.id], field: 'startUnit',
      message: `${p.label || profile.name}: kein freier Platz zum Kopieren.`,
      explanation: 'Die Kopie sucht zuerst direkt darüber und danach direkt darunter. Auf dieser Seite ist keine gleich hohe Lücke frei.',
    }] };
    const clone: Placement = { ...p, id: newId('device'), startUnit, label: `${p.label || profile.name} · Kopie`, supportedById: null };
    copied.set(p.id, clone.id); created.push(clone.id);
    candidate = { ...candidate, placements: [...candidate.placements, clone] };
  }
  candidate = { ...candidate, placements: candidate.placements.map(p => created.includes(p.id) ? { ...p, supportedById: copied.get(doc.placements.find(original => copied.get(original.id) === p.id)?.supportedById ?? '') ?? null } : p) };
  // Deliberately do not copy port destinations: a new panel cannot silently claim the same outlets.
  return mutation(candidate, created);
}
export function removePlacements(doc: RackDocument, ids: string[]): RackDocument {
  return { ...doc, placements: doc.placements.filter(p => !ids.includes(p.id)).map(p => p.supportedById && ids.includes(p.supportedById) ? { ...p, supportedById: null } : p), ports: doc.ports.filter(p => !ids.includes(p.placementId)) };
}
export function copyRack(doc: RackDocument, rackId: string): RackDocument {
  const rack = doc.racks.find(r => r.id === rackId); if (!rack) return doc;
  const clone: Rack = { ...structuredClone(rack), id: newId(), label: `${rack.label} · Kopie` };
  const copied = new Map(doc.placements.filter(p => p.rackId === rackId).map(p => [p.id, newId('device')]));
  const placements = doc.placements.filter(p => p.rackId === rackId).map(p => ({ ...structuredClone(p), id: copied.get(p.id)!, rackId: clone.id, supportedById: p.supportedById ? copied.get(p.supportedById) ?? null : null }));
  // Geometry/status are copied as a template; physical port destinations and labels are not duplicated.
  return { ...doc, racks: [...doc.racks, clone], placements: [...doc.placements, ...placements] };
}
export function documentToJson(doc: RackDocument): string { return JSON.stringify(normalizeImport(doc), null, 2); }
export function importDocumentJson(text: string): RackDocument {
  if (text.length > 20_000_000) throw new Error('Rack-Datei ist zu gross (höchstens 20 MB).');
  return normalizeImport(JSON.parse(text) as JsonValue);
}
