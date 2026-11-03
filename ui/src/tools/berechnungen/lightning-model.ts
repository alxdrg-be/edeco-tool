export type LightningClass = "I" | "II" | "III";
export interface LightningInput { protection: LightningClass; perimeter: string; length: string; conductors: string; clearance: string }
export const FACTORS = { I: { hundredths: 8, spacing: 10 }, II: { hundredths: 6, spacing: 10 }, III: { hundredths: 4, spacing: 15 } };
export const SOURCE = "https://www.aflury.ch/de/fachwissen/trennungsabstand-rechner/";
export const LIGHTNING_REFERENCE = {
  page: SOURCE,
  iframe:"https://www.aflury.ch/fileadmin/Arthur_Flury_CH/Tools/Trennungsabstand-Rechner/2026_tool_trennungsabstand.html?lang=de",
  script:"https://www.aflury.ch/fileadmin/Arthur_Flury_CH/Tools/Trennungsabstand-Rechner/2026_tool_trennungsabstand.js",
  observed:"2026-11-02",
  sha256:"a6e63a9557a1e453620cf3b8bc1ef0d25afad43dffcf97365131ef5e73b35989",
} as const;
const UNIT = 1_000_000n;
function decimal(value: string, allowZero = false): bigint {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,6}(?:\.\d{1,6})?$/.test(normalized)) throw new Error("Längen als Zahl mit maximal sechs Nachkommastellen eingeben.");
  const [whole, fraction = ""] = normalized.split(".");
  const result = BigInt(whole) * UNIT + BigInt(fraction.padEnd(6, "0"));
  if ((!allowZero && result <= 0n) || result > 100000n * UNIT) throw new Error("Längen müssen grösser als 0 und höchstens 100’000 m sein.");
  return result;
}
export function calculateLightning(input: LightningInput) {
  const factor = FACTORS[input.protection];
  if (!Object.hasOwn(FACTORS, input.protection)) throw new Error("Blitzschutzklasse I, II oder III wählen.");
  const perimeter = decimal(input.perimeter), length = decimal(input.length);
  if (!/^\d{1,6}$/.test(input.conductors.trim()) || Number(input.conductors) < 2 || Number(input.conductors) > 100000) throw new Error("Anzahl Ableiter als ganze Zahl von 2 bis 100’000 eingeben.");
  const n = BigInt(input.conductors.trim());
  // Exact rational arithmetic: no extra centimetre due to binary float rounding.
  const numerator = BigInt(factor.hundredths) * perimeter * length;
  const denominator = BigInt(factor.spacing) * n * UNIT * UNIT;
  const centimetres = Number((numerator + denominator - 1n) / denominator);
  const minimum = Math.max(2, Number((perimeter + BigInt(factor.spacing) * UNIT - 1n) / (BigInt(factor.spacing) * UNIT)));
  const available = input.clearance.trim() ? decimal(input.clearance, true) : null;
  return { k: factor.hundredths / 100, spacing: factor.spacing,
    n0: Number(perimeter) / Number(UNIT) / factor.spacing, minimum, centimetres,
    metres: centimetres / 100, rawMetres: Number(numerator) / Number(denominator) / 100,
    conductorOK: Number(n) >= minimum,
    clearanceOK: available === null ? null : available * 100n >= BigInt(centimetres) * UNIT,
    availableMetres: available === null ? null : Number(available) / Number(UNIT) };
}
