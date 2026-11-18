import type { calculateCable, CableInput } from "./engineering.ts";
import type { CalculationPDFReport } from "./pdfExport.ts";

type CableResult = ReturnType<typeof calculateCable>;
const format = (value: number, digits = 2) => value.toLocaleString("de-CH", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function cableAssumptions(temperature: number) {
  return { temperature, reactance: "Richtwert, kein NIN-Normwert", scope: "Nur Spannungsfall eines Abschnitts" };
}

/** Report labels follow the calculated temperature; the model and its historic r55 key stay unchanged. */
export function cableReport(input: CableInput, result: CableResult, project?: { number: string; name: string } | null): CalculationPDFReport {
  return {
    title: "Kabel · Spannungsfall", norm: "NIN 2025 · 5.2.5.1 · SN EN 60228 · Spannungsfall-Vorprüfung",
    inputs: [
      { label: "Einfache Leitungslänge", value: `${input.length} m` },
      { label: "Querschnitt", value: `${input.area} mm² ${input.material === "cu" ? "Cu" : "Al"}` },
      { label: "Laststrom", value: `${input.current} A` },
      { label: "Netzart", value: `${input.phases}~ · ${input.voltage} V` },
      { label: "Leistungsfaktor cos φ", value: input.cosPhi },
      { label: "Spannungsfall-Budget", value: `${input.limit} % · Projektvorgabe` },
      { label: "Leitertemperatur", value: `${result.temperature} °C · ${input.basis === "nin-program" ? "Electrosuisse-Vergleichsmodus" : "CH-Referenzmodell"}` },
      { label: "Reaktanz X′", value: `${format(result.x, 3)} Ω/km · Richtwert` },
      ...(project ? [{ label: "Projekt", value: `${project.number} · ${project.name}` }] : []),
    ],
    results: [
      { label: "Spannungsfall", value: `${format(result.deltaU)} V · ${format(result.percent)} %` },
      { label: "Spannung am Verbraucher", value: `${format(result.endVoltage)} V` },
      { label: "Maximale Länge aus Budget", value: `${format(result.maxLength, 1)} m` },
    ],
    formula: `R′θ = R′₂₀ · [1 + α · (θ − 20)]; θ = ${result.temperature} °C\nΔU = f · L · I · (R′θ · cos φ + X′ · sin φ) / 1000\n= ${format(result.factor, 4)} × ${input.length} × ${input.current} × (${format(result.r55, 5)} × ${input.cosPhi} + ${format(result.x, 3)} × ${format(Math.sqrt(1 - result.cosPhi ** 2), 5)}) / 1000\n= ${format(result.deltaU, 4)} V = ${format(result.percent, 4)} %`,
    status: `Spannungsfall ${result.withinBudget ? result.percent >= .9 * result.limit ? "nahe an der Grenze" : "innerhalb" : "überschritten"} · Budget ${input.limit} %`,
    notes: [
      "Ein Leitungsabschnitt. Spannungsfälle bis zur letzten Last im Projekt summieren.",
      "X′ ist ein Richtwert. Strombelastbarkeit, Schutzorgane und Abschaltbedingungen werden nicht nachgewiesen.",
      ...(input.basis === "nin-program" ? ["Electrosuisse-Vergleich: ausgewählte Referenzfälle, keine vollständige Normfreigabe."] : []),
    ],
  };
}
