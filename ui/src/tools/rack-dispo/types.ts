/** Independent rack planning document. Dimensions are millimetres; HE starts at 1 at the bottom. */
export const RACK_SCHEMA_VERSION = 1 as const;
export const HE_MM = 44.45;
export const PANEL_WIDTH_MM = 482.6;
export const DOCUMENT_LIMITS = { racks: 50, profiles: 300, placements: 2000, ports: 24000, text: 2000 } as const;
export type MountSide = 'front' | 'rear' | 'zero-left' | 'zero-right' | 'zero-rear';
export type PlacementStatus = 'planned' | 'existing' | 'removed';
export type ProfileKind = 'patch' | 'switch' | 'fiber' | 'manager' | 'shelf' | 'blank' | 'ups' | 'pdu' | 'earth' | 'reserve' | 'custom';
export type PortMedium = 'RJ45' | 'LWL' | 'none';
export type PortState = 'unknown' | 'not-built' | 'built' | 'occupied';
export type WorkState = 'open' | 'ordered' | 'delivered' | 'done' | 'not-required';
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface Rack {
  id: string; label: string; units: number; widthMm: number; heightMm: number; depthMm: number;
  usableDepthMm: number | null; frontDoorClearanceMm: number | null; rearDoorClearanceMm: number | null;
  weightLimitKg: number | null; powerBudgetW: number | null;
  room: string; notes: string; metadata?: Record<string, JsonValue>;
}
export interface DeviceProfile {
  id: string; name: string; kind: ProfileKind; units: number;
  depthMm: number | null; inwardCableMm: number | null; outwardCableMm: number | null;
  weightKg: number | null;
  /** Own active power demand in W; never UPS output rating or the sum of downstream loads. */
  powerW: number | null;
  /** Shelf payload limit; excludes the shelf's own weight. */
  loadLimitKg: number | null;
  portCount: number; medium: PortMedium; manufacturer: string; article: string;
  source: string; verified: boolean; metadata?: Record<string, JsonValue>;
}
export interface Placement {
  id: string; rackId: string; profileId: string; label: string; startUnit: number; side: MountSide;
  status: PlacementStatus; delivery: WorkState; montage: WorkState; notes: string;
  /** Optional shelf supporting this device; own weight remains counted only once. */
  supportedById: string | null;
  /** 0-HE accessories require manufacturer-specific vertical and depth positions. Never assumed clear. */
  /** Vertical offset from the bottom of the HE field, not the case floor. */
  zeroStartMm: number | null; zeroHeightMm: number | null;
  /** Body starts this far behind the FRONT mounting plane. */
  zeroInwardOffsetMm: number | null;
  metadata?: Record<string, JsonValue>;
}
export interface PortRow {
  placementId: string; number: number; label: string; target: string; outlet: string; room: string; state: PortState;
  metadata?: Record<string, JsonValue>;
}
export interface RackDocument {
  version: 1; name: string; projectId?: string; projectNumber?: string; room: string;
  author: string; index: string; date: string; racks: Rack[]; profiles: DeviceProfile[];
  placements: Placement[]; ports: PortRow[]; metadata?: Record<string, JsonValue>;
}
export type IssueSeverity = 'error' | 'warning' | 'open';
export interface RackIssue {
  id: string; code: string; severity: IssueSeverity; message: string; explanation: string;
  rackId: string; placementIds: string[]; field?: string;
  actual?: number; limit?: number;
}
export interface KnownTotal { known: number; missing: number; complete: boolean }
export interface PortBreakdown { kind: ProfileKind; medium: PortMedium; capacity: number; built: number; occupied: number; unknown: number }
export interface RackAnalysis {
  rackId: string; objects: number; usedUnits: number; reservedUnits: number; freeUnits: number;
  frontUsedUnits: number; rearUsedUnits: number; zeroObjects: number;
  /** All device ports; patch-panel outlets and switch ports must not be interpreted as the same capacity. */
  portCapacity: number; portsBuilt: number; portsOccupied: number; portsUnknown: number; portBreakdown: PortBreakdown[];
  weight: KnownTotal; power: KnownTotal; issues: RackIssue[];
}
export interface DocumentAnalysis { racks: RackAnalysis[]; issues: RackIssue[] }
export interface ValidationResult { valid: boolean; errors: string[]; document?: RackDocument }
export interface PlacementDraft { profileId: string; rackId: string; startUnit: number; side: MountSide; label?: string }
export interface MutationResult { document: RackDocument; placementIds: string[]; issues: RackIssue[]; accepted: boolean }
export interface RackGeometry {
  widthMm: number; heightMm: number; railLeftMm: number; railRightMm: number;
  railTopMm: number; railBottomMm: number; railHeightMm: number;
}
export interface PlacementRect { x: number; y: number; width: number; height: number }
