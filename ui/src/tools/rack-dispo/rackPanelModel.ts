import type { DeviceProfile, ProfileKind } from './types';

export interface NumberRules { min?: number; max?: number; integer?: boolean; nullable?: boolean }
export type ParsedNumber = { valid: true; value: number | null } | { valid: false; message: string };

/** Drawing colours are project presentation data, not a planning/check status. */
export function panelDrawingFill(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

/** Empty dimensions are unknown; a temporary empty field must never become zero. */
export function parsePlanningNumber(text: string, rules: NumberRules = {}): ParsedNumber {
  const normalized = text.trim().replace(',', '.');
  if (!normalized) return rules.nullable === false
    ? { valid: false, message: 'Bitte einen Wert eingeben.' }
    : { valid: true, value: null };
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return { valid: false, message: 'Bitte eine gültige Zahl eingeben.' };
  const value = Number(normalized);
  if (!Number.isFinite(value)) return { valid: false, message: 'Bitte eine endliche Zahl eingeben.' };
  if (rules.integer && !Number.isInteger(value)) return { valid: false, message: 'Bitte eine ganze Zahl eingeben.' };
  if (rules.min !== undefined && value < rules.min) return { valid: false, message: `Mindestens ${rules.min}.` };
  if (rules.max !== undefined && value > rules.max) return { valid: false, message: `Höchstens ${rules.max}.` };
  return { valid: true, value };
}

export const profileKindLabels: Record<ProfileKind, string> = {
  patch: 'Patchpanel', switch: 'Switch', fiber: 'LWL', manager: 'Rangierung', shelf: 'Fachboden',
  blank: 'Blindpanel', ups: 'USV', pdu: 'Steckdosenleiste', earth: 'Potenzialausgleich', reserve: 'HE-Reserve', custom: 'Eigenes Gerät',
};

export function profileGroup(profile: DeviceProfile): 'Panels' | 'Aktiv' | 'Strom' | 'Zubehör' {
  if (profile.kind === 'patch' || profile.kind === 'fiber') return 'Panels';
  if (profile.kind === 'switch') return 'Aktiv';
  if (profile.kind === 'ups' || profile.kind === 'pdu' || profile.kind === 'earth') return 'Strom';
  return 'Zubehör';
}

export function profileSubtitle(profile: DeviceProfile): string {
  const height = profile.units === 0 ? '0 HE · seitlich / hinten' : `${profile.units} HE`;
  const ports = profile.portCount > 0 ? ` · ${profile.portCount} ${profile.medium === 'LWL' ? 'LWL-Anschlüsse' : profile.medium === 'RJ45' ? 'RJ45-Ports' : 'Anschlüsse'}` : '';
  return height + ports;
}

export function createPanelProfile(): DeviceProfile {
  return {
    id: `profile-${crypto.randomUUID()}`, name: 'Eigenes Patchpanel', kind: 'patch', units: 1,
    depthMm: null, inwardCableMm: null, outwardCableMm: null, weightKg: null, powerW: null, loadLimitKg: null,
    portCount: 24, medium: 'RJ45', manufacturer: '', article: '', source: '', verified: false,
  };
}
