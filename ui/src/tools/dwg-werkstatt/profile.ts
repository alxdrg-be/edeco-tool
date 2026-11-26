export type LayerAction = "keep" | "grey" | "hide";
export interface LayerRule { contains: string; action: LayerAction; lineweight_mm?: number | null }
export interface Profile { rules: LayerRule[]; remove_wipeouts: boolean; remove_text_backgrounds: boolean; audit_dxf?: boolean }
export interface NamedProfile { name: string; profile: Profile }

export const standard: NamedProfile = {
  name: "edeco Standard",
  profile: {
    rules: [
      { contains: "A_WAND", action: "grey", lineweight_mm: .35 },
      { contains: "A_TUER", action: "grey", lineweight_mm: .18 },
      { contains: "A_FENSTER", action: "grey", lineweight_mm: .18 },
      { contains: "A_MOEB", action: "hide" }, { contains: "A_EINR", action: "hide" },
      { contains: "A_SCHRAFF", action: "hide" }, { contains: "A_TEXT", action: "grey", lineweight_mm: .13 },
    ],
    remove_wipeouts: true, remove_text_backgrounds: true, audit_dxf: false,
  },
};

export const auditOnly: NamedProfile = {
  name: "Nur CAD-Struktur prüfen",
  profile: { rules: [], remove_wipeouts: false, remove_text_backgrounds: false, audit_dxf: true },
};

export const weights = [0, .05, .09, .13, .15, .18, .20, .25, .30, .35, .40, .50, .53, .60, .70, .80, .90, 1, 1.06, 1.2, 1.4, 1.58, 2, 2.11];

export function validProfile(profile: unknown): profile is Profile {
  if (typeof profile !== "object" || profile === null) return false;
  const p = profile as Partial<Profile>;
  return typeof p.remove_wipeouts === "boolean" && typeof p.remove_text_backgrounds === "boolean"
    && (p.audit_dxf === undefined || typeof p.audit_dxf === "boolean")
    && Array.isArray(p.rules) && p.rules.length <= 128 && p.rules.every(rule => rule
      && typeof rule.contains === "string" && rule.contains.trim().length > 0 && rule.contains.length <= 255
      && ["grey", "hide", "keep"].includes(rule.action) && (rule.lineweight_mm == null || weights.includes(rule.lineweight_mm)));
}

export function parseProfiles(raw: string | null): NamedProfile[] {
  if (!raw) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries) || entries.some(entry => !entry || typeof entry.name !== "string"
    || !entry.name.trim() || entry.name.length > 70 || entry.name === standard.name || !validProfile(entry.profile))
    || new Set(entries.map(entry => entry.name)).size !== entries.length) {
    throw new Error("Die gespeicherten CAD-Profile konnten nicht gelesen werden.");
  }
  return entries;
}
