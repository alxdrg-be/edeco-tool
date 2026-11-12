/** Units a formula field may be entered in. `factor` converts the chosen unit into the field's base unit. */
export interface UnitChoice { unit: string; factor: number }

const families: Record<string, UnitChoice[]> = {
  V: [{ unit: "V", factor: 1 }, { unit: "mV", factor: 1e-3 }, { unit: "kV", factor: 1e3 }],
  A: [{ unit: "A", factor: 1 }, { unit: "mA", factor: 1e-3 }, { unit: "kA", factor: 1e3 }],
  W: [{ unit: "W", factor: 1 }, { unit: "kW", factor: 1e3 }, { unit: "MW", factor: 1e6 }],
  kW: [{ unit: "kW", factor: 1 }, { unit: "W", factor: 1e-3 }, { unit: "MW", factor: 1e3 }],
  "Ω": [{ unit: "Ω", factor: 1 }, { unit: "mΩ", factor: 1e-3 }, { unit: "kΩ", factor: 1e3 }, { unit: "MΩ", factor: 1e6 }],
  "µF": [{ unit: "µF", factor: 1 }, { unit: "nF", factor: 1e-3 }, { unit: "mF", factor: 1e3 }],
  Hz: [{ unit: "Hz", factor: 1 }, { unit: "kHz", factor: 1e3 }],
  H: [{ unit: "H", factor: 1 }, { unit: "mH", factor: 1e-3 }],
  var: [{ unit: "var", factor: 1 }, { unit: "kvar", factor: 1e3 }],
  kWh: [{ unit: "kWh", factor: 1 }, { unit: "Wh", factor: 1e-3 }, { unit: "MWh", factor: 1e3 }],
  h: [{ unit: "h", factor: 1 }, { unit: "min", factor: 1 / 60 }],
  s: [{ unit: "s", factor: 1 }, { unit: "min", factor: 60 }, { unit: "h", factor: 3600 }],
  m: [{ unit: "m", factor: 1 }, { unit: "cm", factor: 1e-2 }, { unit: "km", factor: 1e3 }],
};

/** Choices for a base unit; a single entry means the unit is fixed. */
export function unitChoices(base: string): UnitChoice[] {
  return families[base] ?? [{ unit: base, factor: 1 }];
}

/** Value in the base unit, or null when the unit is unknown for this base. */
export function toBaseUnit(value: number, base: string, chosen: string): number | null {
  const choice = unitChoices(base).find(item => item.unit === chosen);
  return choice ? value * choice.factor : null;
}
