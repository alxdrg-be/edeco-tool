import { normalizeImport, portRows } from './model.ts';
import type { RackDocument } from './types.ts';

export const RACK_DRAFT_KEY = 'edeco.rack-dispo.draft.v1';
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export interface RackHistory { past: RackDocument[]; present: RackDocument; future: RackDocument[] }
export const initialHistory = (document: RackDocument): RackHistory => ({ past: [], present: document, future: [] });
export function pushDocument(history: RackHistory, document: RackDocument): RackHistory {
  if (history.present === document || JSON.stringify(history.present) === JSON.stringify(document)) return history;
  const past = [...history.past, history.present].slice(-30);
  // Bound retained drafts as well as action count when port schedules are large.
  let characters = JSON.stringify(document).length;
  for (let i = past.length - 1; i >= 0; i--) {
    characters += JSON.stringify(past[i]).length;
    if (characters > 12 * 1024 * 1024) { past.splice(0, i + 1); break; }
  }
  return { past, present: document, future: [] };
}
export function travelHistory(history: RackHistory, direction: 'undo' | 'redo'): RackHistory {
  if (direction === 'undo') {
    const previous = history.past.at(-1);
    return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] } : history;
  }
  const next = history.future[0];
  return next ? { past: [...history.past, history.present], present: next, future: history.future.slice(1) } : history;
}
export function parseRackFile(text: string): RackDocument {
  if (new TextEncoder().encode(text).length > MAX_DOCUMENT_BYTES) throw new Error('Rack-Dateien dürfen höchstens 20 MB gross sein.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Die Datei enthält kein gültiges Rack-JSON. Der aktuelle Entwurf bleibt erhalten.'); }
  return normalizeImport(value);
}
export function safeFilename(value: string): string {
  const name = value.normalize('NFC').replace(/[\x00-\x1f<>:"/\\|?*]+/g, '-').replace(/[. ]+$/g, '').trim().slice(0, 110);
  return !name || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name) ? `Rack-${name || 'Dispo'}` : name;
}

/** Quoted semicolon CSV, UTF-8 BOM for Excel; untrusted cells cannot become formulas. */
export function rackCSV(rows: (string | number | null)[][]): string {
  const cell = (raw: string | number | null) => {
    let text = raw === null ? '' : String(raw);
    if (/^[\s\uFEFF]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
const portStates = { unknown: 'Unbekannt', 'not-built': 'Nicht ausgebaut', built: 'Ausgebaut', occupied: 'Belegt' };
export function portsCSV(document: RackDocument): string {
  const capacity = document.placements.reduce((sum, p) => sum + (p.status === 'removed' ? 0 : document.profiles.find(profile => profile.id === p.profileId)?.portCount ?? 0), 0);
  if (capacity > 24000) throw new Error('Die gesamte Portliste umfasst mehr als 24’000 Anschlüsse. Bitte den Plan vor dem CSV-Export in kleinere Rack-Dateien aufteilen.');
  const rows: (string | number | null)[][] = [['Rack', 'Gerät', 'Medium', 'Port', 'Beschriftung', 'Ziel', 'Dose', 'Raum', 'Status']];
  for (const port of portRows(document)) {
    const placement = document.placements.find(item => item.id === port.placementId && item.status !== 'removed');
    if (!placement) continue;
    const profile = document.profiles.find(item => item.id === placement.profileId);
    rows.push([document.racks.find(item => item.id === placement.rackId)?.label ?? '', placement.label, profile?.medium ?? '',
      port.number, port.label, port.target, port.outlet, port.room, portStates[port.state]]);
  }
  return rackCSV(rows);
}
export function bomCSV(document: RackDocument): string {
  const rows: (string | number | null)[][] = [['Rack', 'Profil', 'Hersteller', 'Artikel', 'Anzahl', 'HE je Gerät', 'Ports je Gerät', 'Medium', 'Gewicht je Gerät kg', 'Leistung je Gerät W', 'Daten bestätigt', 'Lieferung', 'Montage', 'Status']];
  const groups = new Map<string, { placement: RackDocument['placements'][number]; count: number }>();
  for (const placement of document.placements) {
    const profile = document.profiles.find(item => item.id === placement.profileId);
    if (placement.status === 'removed' || !profile || profile.kind === 'reserve') continue;
    const key = JSON.stringify([placement.rackId, placement.profileId, placement.delivery, placement.montage, placement.status]);
    const previous = groups.get(key);
    if (previous) previous.count++; else groups.set(key, { placement, count: 1 });
  }
  const work = { open: 'Offen', ordered: 'Bestellt', delivered: 'Geliefert', done: 'Erledigt', 'not-required': 'Nicht erforderlich' };
  for (const { placement, count } of groups.values()) {
    const profile = document.profiles.find(item => item.id === placement.profileId)!;
    rows.push([document.racks.find(item => item.id === placement.rackId)?.label ?? '', profile.name, profile.manufacturer, profile.article,
      count, profile.units, profile.portCount, profile.medium, profile.weightKg, profile.powerW, profile.verified ? 'Ja' : 'Nein',
      work[placement.delivery], work[placement.montage], placement.status === 'existing' ? 'Bestand' : 'Geplant']);
  }
  return rackCSV(rows);
}
