import type { DeviceProfile } from './types.ts';
/** Neutral drawing profiles. Generic HE values are editable; no manufacturer dimensions are asserted. */
const generic = (id: string, name: string, kind: DeviceProfile['kind'], units: number, portCount = 0,
  medium: DeviceProfile['medium'] = 'none'): DeviceProfile => ({
  id, name, kind, units, depthMm: null, inwardCableMm: null, outwardCableMm: null,
  weightKg: null, powerW: null, loadLimitKg: null, portCount, medium,
  manufacturer: '', article: '', source: 'Neutrale Zeichnungsvorlage; Masse und Herstellerangaben vor Verwendung prüfen.', verified: false,
});
export const DEFAULT_PROFILES: readonly DeviceProfile[] = [
  generic('generic-patch24', 'Patchpanel · 24 Ports · 1 HE', 'patch', 1, 24, 'RJ45'),
  generic('generic-patch48-hd', 'Patchpanel · 48 Ports · 1 HE HD', 'patch', 1, 48, 'RJ45'),
  generic('generic-patch48-2u', 'Patchpanel · 48 Ports · 2 HE', 'patch', 2, 48, 'RJ45'),
  generic('generic-switch24', 'Switch · 24 Ports · 1 HE', 'switch', 1, 24, 'RJ45'),
  generic('generic-switch48', 'Switch · 48 Ports · 1 HE', 'switch', 1, 48, 'RJ45'),
  generic('generic-fiber24', 'LWL-Panel · 24 Positionen · 1 HE', 'fiber', 1, 24, 'LWL'),
  generic('generic-fiber48', 'LWL-Panel · 48 Positionen · 1 HE', 'fiber', 1, 48, 'LWL'),
  generic('generic-manager', 'Rangierpanel · 1 HE', 'manager', 1),
  generic('generic-shelf', 'Fachboden · 1 HE', 'shelf', 1),
  generic('generic-blank', 'Blindplatte · 1 HE', 'blank', 1),
  generic('generic-ups', 'USV · 3 HE (Beispiel)', 'ups', 3),
  generic('generic-pdu', 'Vertikale Steckdosenleiste · 0 HE', 'pdu', 0),
  generic('generic-earth', 'Potenzialausgleich · 0 HE', 'earth', 0),
  generic('generic-reserve', 'Freihaltereserve · 1 HE', 'reserve', 1),
];
export function createDefaultProfiles(): DeviceProfile[] { return DEFAULT_PROFILES.map(profile => ({ ...profile })); }
export const PROFILE_KIND_LABELS: Record<DeviceProfile['kind'], string> = {
  patch: 'Patchpanels', switch: 'Switches', fiber: 'LWL', manager: 'Kabelführung', shelf: 'Fachböden',
  blank: 'Blindplatten', ups: 'USV', pdu: 'Strom', earth: 'Potenzialausgleich', reserve: 'Reserve', custom: 'Eigene Geräte',
};
