export type SchemaTone = "normal" | "limited" | "error" | "unknown";
export interface SchemaSignal { tone: SchemaTone; label: string }
export interface EVSchemaState { house: SchemaSignal; grid: SchemaSignal; points: SchemaSignal }
export interface EVSchemaBudget {
  houseKW: number; reserveKW: number; totalAssignedKW: number;
  gridKW: number; gridAssignedKW: number;
  nominalPerPointKW: number; assignedPerPointKW: number; managed: boolean;
}

/** Budget colours describe the power model, never cable/protection compliance. */
export function schemaState(input: EVSchemaBudget | null): EVSchemaState {
  if (!input || Object.values(input).some(value => typeof value === "number" && !Number.isFinite(value))) {
    const unknown: SchemaSignal = { tone: "unknown", label: "Eingaben prüfen" };
    return { house: unknown, grid: unknown, points: unknown };
  }
  const tolerance = 1e-8;
  const houseOver = input.reserveKW + input.totalAssignedKW > input.houseKW + tolerance;
  const gridOver = input.gridAssignedKW > input.gridKW + tolerance;
  const pointOver = input.assignedPerPointKW > input.nominalPerPointKW + tolerance;
  const limited = input.managed && input.assignedPerPointKW < input.nominalPerPointKW - tolerance;
  return {
    house: { tone: houseOver ? "error" : "normal", label: houseOver ? "Hausbudget überschritten" : "Hausbudget eingehalten" },
    grid: { tone: gridOver ? "error" : limited ? "limited" : "normal", label: gridOver ? "Grid-Budget überschritten" : limited ? "Zuteilung begrenzt" : "Grid-Budget eingehalten" },
    points: { tone: pointOver ? "error" : limited ? "limited" : "normal", label: pointOver ? "Konfigurierte Punktleistung überschritten" : limited ? "Ladeleistung reduziert" : "Zuteilung innerhalb der Punktleistung" },
  };
}

export function signalColour(tone: SchemaTone): string {
  return tone === "error" ? "var(--alert)" : tone === "limited" ? "var(--wire)" : tone === "unknown" ? "var(--line-strong)" : "var(--accent)";
}
