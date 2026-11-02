import type { Inputs } from "./types.ts";

/** Preserve the meaning of saved manual inputs when new reference modes arrive. */
export function migrateWorkbenchInputs(id: string, currentDefaults: Inputs, saved: Record<string, unknown>): Inputs {
  for (const key of Object.keys(currentDefaults)) {
    if (Object.hasOwn(saved, key) && typeof saved[key] !== "string") throw new Error(`Gespeichertes Feld ${key}: Zeichenfolge erwartet.`);
  }
  const next = Object.fromEntries(Object.entries(currentDefaults).map(([key, value]) => [key, typeof saved[key] === "string" ? saved[key] : value])) as Inputs;
  const missing = (key: string, value: string) => { if (typeof saved[key] !== "string") next[key] = value; };
  if (id === "pva-rechner") { missing("sizing", "area"); missing("roof", "manual"); missing("tariffPreset", "manual"); missing("feedPreset", "manual"); missing("modulePreset", "manual"); missing("grantMode", "manual"); missing("headlineBasis", "net"); }
  if (id === "poe") { missing("type", "manual"); missing("cable", "manual"); }
  if (["nin-kabelrechner", "strombelastbarkeit"].includes(id)) missing("tableMode", "manual");
  if (id === "potenzialausgleich") missing("paMode", "manual");
  if (id === "motoranlauf") { missing("inputMode", "power"); missing("efficiencyMode", "manual"); missing("checkIz", "off"); }
  if (id === "beleuchtung") { missing("layout", "full"); missing("luminaire", "manual"); missing("etaMode", "manual"); missing("luxMode", "manual"); }
  if (id === "verlustleistung") missing("durationMode", "annual");
  if (id === "transformator") missing("ukMode", "preset");
  if (id === "kurzschlussstrom") { missing("sourceMode", "nameplate"); missing("voltageTolerance", "legacy"); }
  if (id === "premium-selektivitaet") missing("selectivityMode", "legacy");
  if (id === "premium-brandmelder") { missing("gridRule", "radius"); missing("detectorBasis", "manual"); }
  if (id === "premium-pkw") missing("layout", "legacy");
  if (id === "premium-lkw") missing("depotLayout", "legacy");
  if (id === "premium-ladekosten") missing("costLayout", "legacy");
  if (id === "premium-poe") missing("poeRouteMode", "legacy");
  if (id === "premium-ladekosten" && typeof saved.costRows === "string") {
    const rows: unknown = JSON.parse(saved.costRows);
    if (!Array.isArray(rows)) throw new Error("Gespeicherte Kostenpositionen: Liste erwartet.");
    next.costRows = JSON.stringify(rows.map(row => row && typeof row === "object" && !Array.isArray(row) && !Object.hasOwn(row, "commission") ? { ...row, commission: "1" } : row));
  }
  if (id === "premium-sia2056") missing("siaMode", "legacy");
  if (["brandlast", "premium-brandlast"].includes(id)) missing("fireloadMode", "legacy");
  return next;
}
