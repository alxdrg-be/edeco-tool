/** Shared data contract for the native Swiss engineering workbenches. */
export type Inputs = Record<string, string>;
export type Tone = "ok" | "warning" | "error" | "neutral";
export interface Field {
  key: string;
  label: string;
  default: string;
  unit?: string;
  kind?: "number" | "select" | "text";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  group?: string;
  visibleWhen?: { key: string; values: string[] }[];
  help: string;
}
export interface Metric { label: string; value: number | string; unit?: string; digits?: number; tone?: Tone }
export interface SeriesItem { label: string; value: number; secondary?: number }
export interface DiagramNode { label: string; value: string; detail?: string; tone?: Tone }
export interface CalculationResult {
  metrics: Metric[];
  status: { tone: Tone; text: string };
  formula: string;
  limitations: string[];
  rows?: { label: string; value: number | string; unit?: string }[];
  series?: SeriesItem[];
  seriesLabel?: string;
  seriesUnit?: string;
  seriesLabels?: [string, string];
  comparisons?: { title: string; unit: string; items: { label: string; actual: number; target: number }[] }[];
  diagram?: { kind: "chain"; nodes: DiagramNode[] } | { kind: "room"; length: number; width: number; columns: number; rows: number; count?: number; radius?: number };
  charging?: { houseAmps: number; houseKW: number; reserveKW: number; totalAssignedKW: number; mode: "none" | "dynamic" | "static"; grids: { label: string; amps: number; assigned: number; count: number; power: number }[] };
  chargingNetwork?: import("./chargingGrid.ts").ChargingNetworkResult;
  depotNetwork?: import("./chargingGrid.ts").DepotNetworkResult;
  costModels?: import("./chargingCosts.ts").CostBusinessResult[];
  siaBreakdown?: import("./siaModel.ts").SIABalance;
  poeRoute?: import("./poeRoute.ts").PoeRouteResult;
  pvAnalysis?: import("./pvAnalysis.ts").PVAnalysis;
}
export interface CalculatorDefinition {
  id: string;
  title: string;
  description: string;
  source: string;
  scope: string;
  fields: Field[];
  calculate: (input: Inputs) => CalculationResult;
}

/** Identifies the real input without extracting a translated label from text. */
export class InputError extends Error {
  readonly field: string;
  readonly required: string;
  readonly actual: string;
  constructor(field: string, message: string, required: string, actual = "") {
    super(message); this.name = "InputError"; this.field = field; this.required = required; this.actual = actual;
  }
}

export function number(input: Inputs, key: string, label: string, min = 0, max = 1e9, allowZero = false): number {
  const raw = (input[key] ?? "").trim();
  const required = `${allowZero ? "Mindestens" : "Grösser als"} ${min.toLocaleString("de-CH")}, höchstens ${max.toLocaleString("de-CH")}. Dezimalkomma oder Dezimalpunkt sind möglich.`;
  if (!/^\d+(?:[.,]\d+)?$/.test(raw)) throw new InputError(key, `${label}: gültige Zahl eingeben.`, required, raw || "leer");
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || (allowZero ? value < min : value <= min) || value > max) throw new InputError(key, `${label}: ${allowZero ? "mindestens" : "grösser als"} ${min}, höchstens ${max}.`, required, raw);
  return value;
}
export function integer(input: Inputs, key: string, label: string, min = 0, max = 10000, allowZero = false): number {
  const n = number(input, key, label, min, max, allowZero);
  if (!Number.isInteger(n)) throw new InputError(key, `${label}: ganze Zahl eingeben.`, `Ganze Zahl ${allowZero ? "ab" : "grösser als"} ${min} bis ${max}.`, input[key]);
  return n;
}
export function defaults(definition: CalculatorDefinition): Inputs {
  return Object.fromEntries(definition.fields.map(field => [field.key, field.default]));
}

export function validateResult(result: CalculationResult): CalculationResult {
  function visit(value: unknown): void {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Rechenergebnis ausserhalb des darstellbaren Bereichs. Eingaben prüfen.");
    if (value && typeof value === "object") Object.values(value).forEach(visit);
  }
  visit(result);
  return result;
}
