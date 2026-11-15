/** Physical distribution-board document. Millimetres are authoritative; views are projections. */
export type CabinetView = 'front' | 'internal';
export type DeviceKind = 'switch' | 'rcd' | 'mcb' | 'knx' | 'terminal' | 'busbar' | 'custom' | 'reserve';
export interface SourceRef { id: string; issuer: string; title: string; url: string; edition: string; checked_on: string; sha256: string; pages: string; notes: string }
export interface Rect { x_mm: number; y_mm: number; width_mm: number; height_mm: number }
export interface Field extends Rect { id: string; name: string; role: 'equipment' | 'meter' | 'connection' | 'control' | 'spare'; sealed: boolean }
export interface Rail { id: string; field_id: string; name: string; x_mm: number; y_mm: number; z_mm: number; length_mm: number; te_pitch_mm: number }
export interface ReservedZone extends Rect { id: string; name: string; source_id: string | null }
export interface DeviceProfile {
  id: string; name: string; kind: DeviceKind; manufacturer: string; article: string;
  width_mm: number; height_mm: number; depth_mm: number | null; te: number | null;
  mounting: 'din' | 'plate' | 'free'; power_loss_w: number | null; rated_current_a: number | null;
  clearance_mm: number; source_ids: string[]; geometry_status: 'generic' | 'documented';
  terminal_kind: string; busbar_section_width_mm: number | null; busbar_section_thickness_mm: number | null;
}
export interface Placement {
  id: string; profile_id: string; rail_id: string | null; field_id: string | null; label: string;
  x_mm: number; y_mm: number; z_mm: number; rotation: 0 | 90 | 180 | 270;
  status: 'planned' | 'existing' | 'removed'; source_circuit_id: string | null; notes: string;
}
export interface Cover extends Rect { id: string; name: string; z_mm: number; material: string; thickness_mm: number | null; transparent: boolean; color: string; source_id: string | null; cutouts: Rect[] }
export interface Cabinet {
  id: string; name: string; kind: 'UV' | 'HV'; manufacturer: string; system: string; article: string;
  width_mm: number; height_mm: number; depth_mm: number; inner_width_mm: number; inner_height_mm: number; usable_depth_mm: number | null;
  color_outer: string; color_inner: string; ral_outer?: string; ral_inner?: string; fields: Field[]; rails: Rail[]; placements: Placement[]; covers: Cover[]; reserved_zones: ReservedZone[];
}
export interface Ratings {
  rated_voltage_v: number | null; rated_current_a: number | null; ip_closed: string; ip_open_covered: string; access_protection: string;
  icw_ka: number | null; icw_duration_s: number | null; ipk_ka: number | null; icc_ka: number | null;
  protective_device_ref: string; source_ids: string[]; notes: string;
}
export interface DistributionDocument {
  schema_version: 1; id: string; name: string; project_id: string | null; project_number: string; project_name: string;
  location: string; author: string; drawing_number: string; schematic_ref: string; index: string; date: string; revision: number;
  system_profile_id: string; vnb_id: 'none' | 'iwb' | 'primeo' | 'ebl'; vnb_profile_version: string;
  sources: SourceRef[]; profiles: DeviceProfile[]; cabinet: Cabinet; ratings: Ratings;
}
export interface Issue {
  id: string; code: string; severity: 'error' | 'warning' | 'open' | 'info'; message: string; explanation: string;
  target_id: string; field: string; actual: string; expected: string; source_ids: string[]; remedies: string[];
}
export interface Analysis { issues: Issue[]; occupied_te: number; free_te: number; known_loss_w: number; missing_loss_count: number; document_hash: string }
export interface TemplateSummary { id: string; name: string; description: string; status: string }
export interface VnbProfile { id: 'iwb' | 'primeo' | 'ebl'; name: string; edition: string; source_ids: string[]; notes: string[] }
export interface Catalog { sources: SourceRef[]; profiles: DeviceProfile[]; templates: TemplateSummary[]; vnb_profiles: VnbProfile[] }
export interface SavedDocument { document: DistributionDocument; revision: number; updated_at: string }
export interface DocumentSummary { id: string; name: string; project_number: string; revision: number; updated_at: string }
