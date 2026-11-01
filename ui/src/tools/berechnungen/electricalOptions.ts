/**
 * Discrete public UI choices inspected 2026-11-01, not normative lookup tables.
 * Sources: /Rechner/e-mobility-rechner.html (#inp-haus, #inp-grid, #inp-lp),
 * /Rechner/ls-schalter.html (#sel-ls, #sel-vor, #sel-icn) and
 * /Rechner/nin-kabelrechner.html (#sel-querschnitt), elektro-rechner.ch.
 * Displayed kW are calculated independently at 400 V / 3~ / cos φ = 1.
 * Device type, installation suitability and manufacturer approval are separate.
 */
export interface ElectricalOption { value: string; label: string }
export const ELECTRICAL_OPTIONS_SOURCES = [
  "https://www.elektro-rechner.ch/Rechner/e-mobility-rechner.html",
  "https://www.elektro-rechner.ch/Rechner/ls-schalter.html",
  "https://www.elektro-rechner.ch/Rechner/nin-kabelrechner.html",
] as const;

export const HOUSE_CURRENT_VALUES = [63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800] as const;
export const GRID_CURRENT_VALUES = [25, 35, 50, 63, 80, 100, 125, 160] as const;
export const LS_CURRENT_VALUES = [.5, 1, 1.6, 2, 3, 4, 6, 8, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125] as const;
export const UPSTREAM_CURRENT_VALUES = [10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000] as const;
export const NIN_SECTION_VALUES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630] as const;

const supplyOptions = (values: readonly number[]): ElectricalOption[] => values.map(value => ({
  value: String(value), label: `${value} A · ${(value * 400 * Math.sqrt(3) / 1000).toFixed(1)} kW · 3~`,
}));
const currentOptions = (values: readonly number[]): ElectricalOption[] => values.map(value => ({ value: String(value), label: `${value} A` }));
export const HOUSE_CURRENT_OPTIONS = supplyOptions(HOUSE_CURRENT_VALUES);
export const GRID_CURRENT_OPTIONS = supplyOptions(GRID_CURRENT_VALUES);
export const LS_CURRENT_OPTIONS = currentOptions(LS_CURRENT_VALUES);
export const UPSTREAM_CURRENT_OPTIONS = currentOptions(UPSTREAM_CURRENT_VALUES);
export const FEED_CURRENT_OPTIONS = supplyOptions(UPSTREAM_CURRENT_VALUES);
export const DEVICE_CURRENT_OPTIONS = currentOptions([...new Set<number>([...LS_CURRENT_VALUES, ...UPSTREAM_CURRENT_VALUES])].sort((a, b) => a - b));
export const AC_CHARGING_POWER_OPTIONS: ElectricalOption[] = [
  { value: "11", label: "11 kW · 3~ 400 V" },
  { value: "22", label: "22 kW · 3~ 400 V" },
];
export const LS_BREAKING_CAPACITY_OPTIONS: ElectricalOption[] = [3, 6, 10, 15, 25].map(value => ({ value: String(value), label: `${value} kA` }));
export const NIN_SECTION_OPTIONS: ElectricalOption[] = NIN_SECTION_VALUES.map(value => ({ value: String(value), label: `${value} mm²` }));

/** No dropdown for measured/load currents, Ik, correction factors or budgets. */
export function fieldOptions(calculatorId: string, key: string): readonly ElectricalOption[] | undefined {
  if (["emobilitaet", "premium-pkw"].includes(calculatorId) && key === "house") return HOUSE_CURRENT_OPTIONS;
  if ((calculatorId === "emobilitaet" && key === "grid") || (calculatorId === "premium-pkw" && ["grid1", "grid2"].includes(key))) return GRID_CURRENT_OPTIONS;
  if (calculatorId === "emobilitaet" && key === "power") return AC_CHARGING_POWER_OPTIONS;
  if (calculatorId === "premium-pkw" && ["power1", "power2"].includes(key)) return AC_CHARGING_POWER_OPTIONS;
  if (calculatorId === "premium-lkw" && key === "feed") return FEED_CURRENT_OPTIONS;
  if (calculatorId === "premium-selektivitaet" && /^rating[123]$/.test(key)) return DEVICE_CURRENT_OPTIONS;
  if (calculatorId === "ls-schalter" && key === "rated") return LS_CURRENT_OPTIONS;
  if (calculatorId === "ls-schalter" && key === "icn") return LS_BREAKING_CAPACITY_OPTIONS;
  if (calculatorId === "nin-kabelrechner" && key === "in") return DEVICE_CURRENT_OPTIONS;
  if (calculatorId === "nin-kabelrechner" && key === "area") return NIN_SECTION_OPTIONS;
  return undefined;
}

/** Existing saved project values stay explicit rather than being silently rounded. */
export function optionsWithProjectValue(options: readonly ElectricalOption[], current: string): ElectricalOption[] {
  if (options.some(option => option.value === current)) return [...options];
  return [{ value: current, label: current.trim() ? `${current} · gespeicherter Projektwert` : "Bitte wählen …" }, ...options];
}
