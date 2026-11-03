import type { CalculatorDefinition, CalculationResult, Inputs } from "./workbench/types.ts";
import { fieldOptions } from "./electricalOptions.ts";
import { planningReportInputs } from "./workbench/chargingGrid.ts";
import { siaReportInputs } from "./workbench/siaDefinition.ts";
import { poeRouteReportInputs } from "./workbench/poeRoute.ts";
import { fireloadReportInputs } from "./workbench/fireloadReport.ts";
import { selectivityReportInputs } from "./workbench/selectivityStages.ts";

/** The reference identifies the subject; it does not expand the implemented proof. */
export const CALCULATION_NORMS: Record<string, string> = {
  "nin-kabelrechner": "NIN 2025 · 5.2.3 · manuelle Tabellenwertprüfung",
  strombelastbarkeit: "NIN 2025 · 5.2.3 · manuelle Tabellenwertprüfung",
  kurzschlussstrom: "NIN · Kurzschluss-Modellwerte unter den angegebenen Annahmen",
  "ls-schalter": "IEC 60898-1 / IEC 60947-2 · NIN 4.3 und 5.3.3 · Vorprüfung",
  potenzialausgleich: "NIN 2025 · 5.4.3 / 5.4.4 · manuelle Tabellenwerte",
  transformator: "Drehstrom-Grundgleichungen · starres Netz, c = 1",
  motoranlauf: "IEC 60034 · NIN · Anlauffaktoren als Annahme",
  blindleistung: "Sinusförmige Wechsel-/Drehstromrechnung · Projektannahmen",
  verlustleistung: "SN EN 60228 · NIN 5.2.5.1 · Spannungsfall-Vorprüfung",
  "ohmsches-gesetz": "Elektrische Grundgleichungen · DC / 1~ / symmetrisch 3~",
  beleuchtung: "SN EN 12464-1 · vereinfachte Lichtstrom-Vorplanung",
  "pva-rechner": "PV-Ertrag und Wirtschaftlichkeit · Planungsannahmen",
  brandlast: "VKF BSR 14-15 · 5.2.1 · NIN 4.2.2.2.7 · Brandlastbilanz",
  poe: "IEEE 802.3 · PoE-Typ und DC-Budgetprüfung",
  "premium-pkw": "NIN 7.22 · stationäre AC/DC-Budgetplanung · Gleichzeitigkeit nach Eingabemodus",
  "premium-lkw": "NIN 7.22 · stationäre AC/DC-Budgetplanung",
  "premium-brandmelder": "SES-Richtlinie Brandmeldeanlagen / SN EN 54 · geometrische Vorplanung",
  "premium-selektivitaet": "NIN 5.3 / 5.3.6 · Hinweise und dokumentierte Herstellergrenzen",
  "premium-ladekosten": "Kostenplanung in CHF · manuelle Preise und Tarife",
  "premium-sia2056": "SIA 2056 · manuelle Zonen- und Zielwerte",
  "premium-poe": "IEEE 802.3 · EN 50173 / ISO/IEC 11801 · manuelle Streckenprüfung",
  "premium-brandlast": "VKF BSR 14-15 · 5.2.1 · NIN 4.2.2.2.7 · Brandlastbilanz",
};

export function calculationNorm(id: string, input: Inputs): string {
  if (id === 'premium-lkw' && input.depotAllocation === 'reference') return 'NIN 7.22-Bezug · stationäre AC/DC-Vorplanung mit expliziter Mindestleistung / Aktiv-Wartend';
  if (id === 'premium-sia2056' && input.siaMode === 'automatic') return 'SIA 2056-Bezug · veröffentlichte Referenzprofile 02.11.2026 · keine unabhängige Normfreigabe';
  if (id === 'premium-brandmelder' && input.detectorBasis === 'reference') return 'SES-Bezug 01.07.2021 · veröffentlichter Mengen-/Materialansatz 02.11.2026 · fachliche Freigabe offen';
  if (id === 'premium-ladekosten' && input.costAccounting === 'reference') return 'Kostenplanung in CHF · veröffentlichter Klassenansatz 02.11.2026 · editierbare Projektpreise';
  if (id === 'premium-selektivitaet' && input.selectivityMode === 'stages') return 'NIN 5.3 / 5.3.6 · Schutzstufen mit Kabelpfad-Modell · Hersteller-Nachweis offen';
  if (["nin-kabelrechner", "strombelastbarkeit"].includes(id)) return `NIN 2025 · 5.2.3 · ${input.tableMode === "published" ? "veröffentlichter Cu-Referenzdatensatz" : "manuelle Tabellenwertprüfung"}`;
  if (id === "potenzialausgleich") return `NIN 2025 · 5.4.3 / 5.4.4 · ${input.paMode === "published" ? "veröffentlichte Cu-Zuordnung" : "manuelle Tabellenwerte"}`;
  if (id === "premium-poe" && input.poeRouteMode === "published") return "EN 50173 / ISO/IEC 11801 · thermischer Referenzansatz, keine automatische Normfreigabe";
  return CALCULATION_NORMS[id] ?? "Dokumentierte Projektannahmen";
}

export function workbenchReport(definition: CalculatorDefinition, input: Inputs, result: CalculationResult, notes = "", project?: { number: string; name: string } | null) {
  const format = (value: number | string, unit?: string, digits = 3) => `${typeof value === "number" ? value.toLocaleString("de-CH", { maximumFractionDigits: digits }) : value}${unit ? ` ${unit}` : ""}`;
  return {
    title: definition.title,
    norm: calculationNorm(definition.id, input),
    inputs: [...definition.fields.filter(field => !["grids", "depotUnits", "depotPoints", "costRows", "siaZones", "poeSegments", "fireloadRows", "fireloadRowsAfter", "chargingSourceConnection", "selectivityStages"].includes(field.key) && (!field.visibleWhen || field.visibleWhen.every(condition => condition.values.includes(input[condition.key])))).map(field => {
      const options = field.options ?? fieldOptions(definition.id, field.key);
      const option = options?.find(option => option.value === input[field.key]);
      return { label: field.label, value: option?.label ?? format(input[field.key], field.unit) };
    }), ...planningReportInputs(definition.id, input), ...(definition.id === "premium-selektivitaet" ? selectivityReportInputs(input) : []), ...(definition.id === "premium-sia2056" ? siaReportInputs(input) : []), ...(definition.id === "premium-poe" ? poeRouteReportInputs(input) : []), ...(["brandlast", "premium-brandlast"].includes(definition.id) ? fireloadReportInputs(input) : []), ...(project ? [{ label: "Projekt", value: `${project.number} · ${project.name}` }] : [])],
    results: [...result.metrics.map(metric => ({ label: metric.label, value: format(metric.value, metric.unit, metric.digits ?? 3) })), ...(result.rows ?? []).map(row => ({ label: row.label, value: format(row.value, row.unit) }))],
    formula: result.formula,
    status: result.status.text,
    notes: [...result.limitations, ...(notes.trim() ? [`Projektnotizen: ${notes.trim()}`] : [])],
  };
}
