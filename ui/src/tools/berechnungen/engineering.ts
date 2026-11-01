/** Swiss voltage-drop model based on the published elektro-rechner.ch reference. */
export interface CableInput { phases: "1" | "3"; material: "cu" | "al"; length: string; current: string; area: string; cosPhi: string; voltage: string; limit: string }
export const RESISTANCE_20: Record<"cu" | "al", Record<string, number>> = {
  cu: { "1.5":12.1,"2.5":7.41,"4":4.61,"6":3.08,"10":1.83,"16":1.15,"25":.727,"35":.524,"50":.387,"70":.268,"95":.193,"120":.153,"150":.124,"185":.0991,"240":.0754 },
  al: { "10":3.08,"16":1.91,"25":1.20,"35":.868,"50":.641,"70":.443,"95":.320,"120":.253,"150":.206,"185":.164,"240":.125 },
};
export const REACTANCE: Record<string, number> = { "1.5":.115,"2.5":.110,"4":.107,"6":.104,"10":.100,"16":.096,"25":.092,"35":.089,"50":.086,"70":.083,"95":.080,"120":.079,"150":.078,"185":.077,"240":.075 };
export const CABLE_SOURCE = "https://www.elektro-rechner.ch/Rechner/spannungsfall.html";
export const NIN_SOURCE = "https://www.electrosuisse.ch/de/nin-2025/";
export function numeric(value: string, label: string, min: number, max: number, inclusive = false): number {
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) throw new Error(`${label}: gültige Zahl eingeben.`);
  const n = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(n) || (inclusive ? n < min : n <= min) || n > max) throw new Error(`${label}: ${inclusive ? "mindestens" : "grösser als"} ${min}, höchstens ${max}.`);
  return n;
}
export function calculateCable(input: CableInput) {
  if (!["1", "3"].includes(input.phases) || !Object.hasOwn(RESISTANCE_20, input.material)) throw new Error("Netzart und Material auswählen.");
  const length = numeric(input.length, "Länge", 0, 100000), current = numeric(input.current, "Strom", 0, 100000), area = numeric(input.area, "Querschnitt", 0, 240);
  const cosPhi = numeric(input.cosPhi, "cos φ", 0, 1), voltage = numeric(input.voltage, "Spannung", 0, 1000), limit = numeric(input.limit, "Budget", 0, 20);
  const table = RESISTANCE_20[input.material];
  if (!Object.hasOwn(table, String(area))) throw new Error(input.material === "al" ? "Aluminium: tabellierte Querschnitte ab 10 mm² wählen." : "Einen tabellierten Standardquerschnitt wählen.");
  const factor = input.phases === "1" ? 2 : Math.sqrt(3), temperature = 55, alpha = input.material === "cu" ? .00393 : .00403;
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
  const atArea = (a: number) => {
    const r55 = table[String(a)] * (1 + alpha * (temperature - 20));
    const x = REACTANCE[String(a)];
    return { r55, x, delta: factor * current * length * (r55 * cosPhi + x * sinPhi) / 1000 };
  };
  const { r55, x, delta: deltaU } = atArea(area), percent = deltaU / voltage * 100;
  if (deltaU >= voltage) throw new Error("Modellgrenze erreicht: Spannungsfall mindestens so gross wie die Bemessungsspannung.");
  const areas = Object.keys(table).map(Number).sort((a,b) => a-b);
  const recommendedArea = areas.find(a => atArea(a).delta / voltage * 100 <= limit + 1e-12) ?? null;
  const budgetVolts = voltage * limit / 100;
  return { length, current, area, cosPhi, voltage, limit, factor, temperature, r20: table[String(area)], r55, x, deltaU, percent,
    endVoltage: voltage - deltaU, withinBudget: percent <= limit + 1e-12, recommendedArea,
    maxLength: length * budgetVolts / deltaU };
}
