export type Part = "project" | "discipline" | "drawing" | "plan" | "floor" | "index" | "scale" | "date";
export interface NamingSettings {
  values: Record<Part, string>;
  enabled: Record<Part, boolean>;
  order: Part[];
}
export const PARTS: { key: Part; label: string; options: string[] }[] = [
  { key: "project", label: "Projektnummer", options: [] },
  { key: "discipline", label: "Fachbereich", options: ["E"] },
  { key: "drawing", label: "Darstellung", options: ["G"] },
  { key: "plan", label: "Planart", options: ["APP"] },
  { key: "floor", label: "Geschoss", options: ["EG00", "OG01", "OG02", "OG03", "UG01", "UG02"] },
  { key: "index", label: "Index", options: ["A", "B", "C", "D"] },
  { key: "scale", label: "Massstab", options: ["20", "50", "100", "200", "500"] },
  { key: "date", label: "Datum", options: [] },
];
export const DEFAULTS: NamingSettings = {
  values: { project: "", discipline: "E", drawing: "G", plan: "APP", floor: "", index: "C", scale: "50", date: "" },
  enabled: { project: true, discipline: true, drawing: true, plan: true, floor: true, index: true, scale: true, date: false },
  order: PARTS.map(p => p.key),
};
export function buildName(settings: NamingSettings, floor: string): string {
  const parts = settings.order.filter(key => settings.enabled[key]).map(key => ({
    key, value: (key === "floor" ? floor : settings.values[key]).trim(),
  }));
  return parts.map((part, index) => `${index ? parts[index - 1].key === "project" ? "_" : "-" : ""}${part.value}`).join("") + ".pdf";
}
export function nameIssue(name: string): string {
  if (!name.toLowerCase().endsWith(".pdf") || name.length <= 4) return "PDF-Dateiname fehlt.";
  if (name.length > 180 || /[<>:"/\\|?*\u0000-\u001f]/.test(name) || /[. ]$/.test(name)
    || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name)) return "Ungültiger Dateiname (maximal 180 Zeichen).";
  return "";
}
export function restoreSettings(raw: string | null): NamingSettings {
  try {
    const data = JSON.parse(raw || "null");
    const keys = PARTS.map(p => p.key);
    if (!data || keys.some(key => typeof data.values?.[key] !== "string" || typeof data.enabled?.[key] !== "boolean")
      || !Array.isArray(data.order) || data.order.length !== keys.length || new Set(data.order).size !== keys.length
      || data.order.some((key: Part) => !keys.includes(key))) return structuredClone(DEFAULTS);
    return data;
  } catch { return structuredClone(DEFAULTS); }
}
