/** Low-voltage voltage factors. Selecting a tolerance is not a full IEC 60909 study. */
export const VOLTAGE_TOLERANCE_OPTIONS: [string, string][] = [
  ["plus10", "+10 % · cmax 1.10"],
  ["plus6", "+6 % · cmax 1.05"],
  ["legacy", "Altstand · cmax 1.05 · Toleranz prüfen"],
];

export const VOLTAGE_TOLERANCE_HELP = "IEC 60909-0: Für NS-Netze mit oberer Spannungstoleranz +10 % wird cmax = 1.10 angesetzt, bei +6 % cmax = 1.05. Die zum Netz passende Toleranz anhand der Projekt-/Netzbetreiberdaten wählen. cmin bleibt 0.95. Altstände behalten ihren bisherigen Faktor, bis die Toleranz ausdrücklich festgelegt wird. Das ersetzt keine vollständige Kurzschlussstudie.";
export const LEGACY_VOLTAGE_WARNING = "Altstand mit cmax = 1.05 übernommen. Die Netz-Spannungstoleranz ist damit nicht bestätigt; für ein NS-Netz mit +10 % ausdrücklich auf cmax = 1.10 umstellen und Schutzwerte neu prüfen.";

export interface ShortCircuitVoltageFactors {
  cMax: number;
  cMin: number;
  label: string;
  legacy: boolean;
}

export function shortCircuitVoltageFactors(value: string | undefined): ShortCircuitVoltageFactors {
  // Missing values belong to previously saved calculations, never to a new default.
  if (value === undefined || value === "legacy") return { cMax: 1.05, cMin: .95, label: "Altstand · Netz-Spannungstoleranz offen", legacy: true };
  if (value === "plus10") return { cMax: 1.10, cMin: .95, label: "+10 %", legacy: false };
  if (value === "plus6") return { cMax: 1.05, cMin: .95, label: "+6 %", legacy: false };
  throw new Error("Spannungstoleranz: +10 %, +6 % oder den gekennzeichneten Altstand wählen.");
}
