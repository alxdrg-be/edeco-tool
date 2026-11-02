import type { CalculationResult, CalculatorDefinition, Field, Inputs } from "./types.ts";
import { number } from "./types.ts";
import { SIA_BUILDING_TYPES, SIA_CONSUMER_CLASS_CODES, SIA_DATA_SOURCE, SIA_GROUPS, requireSIAAutomaticDataset } from "./siaData.ts";
import { calculateSIABalance, createSIAZone, parseSIAZones, type SIABalance } from "./siaModel.ts";

const sample = createSIAZone("manual-example", "Eigenes Rechenbeispiel");
sample.consumers[0] = { groupId: "devices", powerDensity: 20, energyDensity: 30 };
export const DEFAULT_SIA_ZONES = JSON.stringify([sample]);
const manual = [{ key: "siaMode", values: ["manual"] }];
const automatic = [{ key: "siaMode", values: ["automatic"] }];
const f = (key: string, label: string, value: string, unit: string, help: string): Field => ({ key, label, default: value, unit, help, group: "Manuelle Bilanz", visibleWhen: manual });
const format = (value: number, digits = 3) => value.toLocaleString("de-CH", { maximumFractionDigits: digits });

export interface SIAReportRow { label: string; value: string }
/** Flatten every entered cell for the PDF/report; never export only the hidden JSON field. */
export function siaReportInputs(input: Inputs): SIAReportRow[] {
  if (input.siaMode === "legacy") return [];
  const rows: SIAReportRow[] = [{ label: "Bilanzmodus", value: "Manuelle Rohkennwerte · keine automatische Normtabelle" }, { label: "Kennwertquelle", value: input.siaSource ?? "" }];
  for (const zone of parseSIAZones(input.siaZones)) {
    rows.push({ label: `${zone.label} · Fläche`, value: `${format(zone.area)} m²` }, { label: `${zone.label} · Leistungskorrektur Kcor`, value: format(zone.kcor) }, { label: `${zone.label} · Jahresgleichzeitigkeit`, value: format(zone.yearGlz) });
    for (const consumer of zone.consumers) rows.push({ label: `${zone.label} · ${SIA_GROUPS.find(group => group.id === consumer.groupId)?.label ?? consumer.groupId}`, value: `${format(consumer.powerDensity)} W/m² roh; ${format(consumer.energyDensity)} kWh/(m²·a) roh` });
    if (zone.powerTarget !== undefined) rows.push({ label: `${zone.label} · manuelles Leistungsziel`, value: `${format(zone.powerTarget)} W/m²` });
    if (zone.energyTarget !== undefined) rows.push({ label: `${zone.label} · manuelles Energieziel`, value: `${format(zone.energyTarget)} kWh/(m²·a)` });
  }
  rows.push({ label: "PV-Jahresertrag", value: `${input.siaPV} kWh/a` }, { label: "PV-Eigenverbrauchsanteil", value: `${input.siaPVSelf} %` });
  return rows;
}

export function siaManualResult(input: Inputs): CalculationResult & { siaBreakdown: SIABalance } {
  const reference = (input.siaSource ?? "").trim();
  if (!reference || reference.length > 2000) throw new Error("Quelle der Rohkennwerte mit 1 bis 2000 Zeichen dokumentieren.");
  const balance = calculateSIABalance({ zones: parseSIAZones(input.siaZones), pvYearKWh: number(input, "siaPV", "PV-Jahresertrag", 0, 1e12, true), pvSelfConsumptionPercent: number(input, "siaPVSelf", "PV-Eigenverbrauchsanteil", 0, 100, true) });
  const hasTargets = balance.zones.some(zone => zone.powerTarget !== undefined || zone.energyTarget !== undefined);
  return {
    siaBreakdown: balance,
    metrics: [
      { label: "Korrigierte Leistung", value: balance.powerKW, unit: "kW", digits: 2 },
      { label: "Jahresenergie vor PV", value: balance.energyKWh / 1000, unit: "MWh/a", digits: 2 },
      { label: "Flächengewichtete Leistungsdichte", value: balance.powerDensity, unit: "W/m²", digits: 2 },
      { label: "Flächengewichtete Energiekennzahl", value: balance.energyDensity, unit: "kWh/(m²·a)", digits: 2 },
      { label: "Netzenergie · Jahresmodell", value: balance.netEnergyKWh / 1000, unit: "MWh/a", digits: 2 },
      { label: "Bezugsfläche", value: balance.area, unit: "m²", digits: 1 },
    ],
    status: { tone: balance.exceedsTargets ? "error" : "warning", text: balance.exceedsTargets ? "Mindestens eine Zone überschreitet ein eingegebenes manuelles Ziel. Kein automatischer SIA-Nachweis." : hasTargets ? "Manuelle Ziele eingehalten. Kennwerte, Klassenzuordnung und Anwendbarkeit sind nicht automatisch geprüft." : "Bilanz aus manuell belegten Rohkennwerten. Automatische SIA-Profile sind mangels vollständigem Datensatz gesperrt." },
    formula: `Je Zone: P_roh = A × Σp_roh / 1000; P = P_roh × Kcor. E_roh = A × Σe_roh; E = E_roh × Jahresgleichzeitigkeit. Leistungskorrektur wirkt ausschliesslich auf P, Jahresgleichzeitigkeit ausschliesslich auf E. ${balance.zones.map(zone => `${zone.label}: P = ${format(zone.rawPowerKW)} × ${format(zone.kcor)} = ${format(zone.powerKW)} kW; E = ${format(zone.rawEnergyKWh)} × ${format(zone.yearGlz)} = ${format(zone.energyKWh)} kWh/a`).join("; ")}. Gesamt p = ${format(balance.powerKW)} × 1000 / ${format(balance.area)} = ${format(balance.powerDensity)} W/m²; e = ${format(balance.energyKWh)} / ${format(balance.area)} = ${format(balance.energyDensity)} kWh/(m²·a). Netzenergie = max(0, ${format(balance.energyKWh)} − ${format(balance.pvConsumedKWh)}) = ${format(balance.netEnergyKWh)} kWh/a.`,
    rows: [
      { label: "Rohleistung vor Kcor", value: balance.rawPowerKW, unit: "kW" },
      { label: "Rohenergie vor Jahresgleichzeitigkeit", value: balance.rawEnergyKWh, unit: "kWh/a" },
      ...balance.zones.flatMap(zone => [{ label: `${zone.label} · Leistung / Jahresenergie`, value: `${format(zone.powerKW)} kW / ${format(zone.energyKWh)} kWh/a` }, { label: `${zone.label} · spezifisch`, value: `${format(zone.powerDensity)} W/m² / ${format(zone.energyDensity)} kWh/(m²·a)` }]),
      { label: "PV im Jahresmodell angerechnet", value: balance.pvConsumedKWh, unit: "kWh/a" },
      ...(balance.powerTarget !== undefined ? [{ label: "Vollständig flächengewichtetes Leistungsziel", value: balance.powerTarget, unit: "W/m²" }] : []),
      ...(balance.energyTarget !== undefined ? [{ label: "Vollständig flächengewichtetes Energieziel", value: balance.energyTarget, unit: "kWh/(m²·a)" }] : []),
    ],
    comparisons: hasTargets ? [
      { title: "Leistungsdichte · manuelle Ziele", unit: "W/m²", items: balance.zones.flatMap(zone => zone.powerTarget !== undefined ? [{ label: zone.label, actual: zone.powerDensity, target: zone.powerTarget }] : []) },
      { title: "Energiekennzahl · manuelle Ziele", unit: "kWh/(m²·a)", items: balance.zones.flatMap(zone => zone.energyTarget !== undefined ? [{ label: zone.label, actual: zone.energyDensity, target: zone.energyTarget }] : []) },
    ].filter(comparison => comparison.items.length > 0) : undefined,
    limitations: [
      `Rohkennwertquelle: ${reference}. Beispielwerte sind eigene Rechenbeispiele, keine SIA-Katalogwerte.`,
      "Verbraucherklassen und 17 Nutzungsbezeichnungen sind als beobachtete Metadaten dokumentiert. Vollständige Leistungs- und Energietabellen wurden nicht verlässlich extrahiert; fehlende Profile liefern kein Ersatzresultat.",
      "Sieben Verbrauchergruppen je Zone. Rohleistung und Rohenergie werden unabhängig eingegeben; Energie wird nicht aus Leistung mal erfundenen Vollbenutzungsstunden abgeleitet. Kcor wirkt nur auf Leistung, Jahresgleichzeitigkeit nur auf Energie.",
      "Diagramme und Zielvergleiche verwenden die Bruttoenergie vor PV-Abzug. Der PV-Abzug ist eine begrenzte Jahresbilanz, kein Nachweis zeitlicher Eigenverbrauchsgleichzeitigkeit, Lastgänge oder Speicher.",
      "Manuelle Zielwerte sind keine automatische SIA-Klassifikation oder Normfreigabe. Teilweise eingegebene Zonenziele ergeben keinen vollständigen Gesamtzielwert.",
    ],
  };
}

export function createSIADefinition(legacy: CalculatorDefinition): CalculatorDefinition {
  return { ...legacy, title: "SIA 2056 · Verbraucherbilanz", description: "Sieben Verbrauchergruppen je Zone, getrennte Leistungs- und Energieansätze und gewichtete Bilanz.", source: SIA_DATA_SOURCE,
    scope: "SIA 2056 · manuelle Rohkennwerte. Leistung: Kcor; Jahresenergie: eigene Gleichzeitigkeit. Automatische Normprofile sind nicht verfügbar.",
    fields: [
      { key: "siaMode", label: "Berechnungsgrundlage", default: "manual", kind: "select", group: "Grundlage", options: [{ value: "manual", label: "Manuelle Rohkennwerte · sieben Gruppen" }, { value: "automatic", label: "Automatisches Normprofil · Datensatz fehlt" }, { value: "legacy", label: "Bisherige manuelle Zonenbilanz" }], help: "Die neue Bilanz trennt Leistungskorrektur und Jahresgleichzeitigkeit. Automatische Profile bleiben gesperrt, bis vollständige Rohkoeffizienten und Zuordnungen belegt sind. Bestehende Stände bleiben im bisherigen Modell." },
      { key: "siaSource", label: "Quelle der Rohkennwerte", default: "Eigenes Rechenbeispiel: 20 W/m² und 30 kWh/(m²·a) Geräte; keine SIA-Normwerte", kind: "text", group: "Manuelle Bilanz", visibleWhen: manual, help: "Normausgabe/Tabelle, Hersteller oder projektspezifische Annahme dokumentieren. Ein Quellenvermerk allein bestätigt keine fachliche Zuordnung." },
      { key: "siaZones", label: "Nutzungszonen und sieben Verbrauchergruppen", default: DEFAULT_SIA_ZONES, kind: "text", group: "Nutzungszonen", visibleWhen: manual, help: "Strukturierte Eingaben werden über die Zonentabelle bearbeitet. Rohleistung in W/m² und Rohenergie in kWh/(m²·a) getrennt erfassen; ungenutzte Gruppen explizit mit 0." },
      f("siaPV", "PV-Jahresertrag", "0", "kWh/a", "Manuelle Jahresannahme; die Bruttodiagramme bleiben unverändert."),
      f("siaPVSelf", "Anzurechnender PV-Eigenverbrauchsanteil", "50", "%", "Der Abzug wird auf die Jahresenergie begrenzt. Keine zeitaufgelöste Eigenverbrauchssimulation."),
      { key: "siaBuilding", label: "Beobachtete Nutzungsbezeichnung", default: "office", kind: "select", group: "Normprofil · Daten fehlen", visibleWhen: automatic, options: SIA_BUILDING_TYPES.map(([value, label]) => ({ value, label })), help: "Nur die Bezeichnungen wurden beobachtet. Die zugrunde liegenden Rohkennwerte sind nicht vollständig belegt; diese Auswahl erzeugt kein Ergebnis." },
      ...SIA_GROUPS.map((group): Field => ({ key: `siaClass_${group.id}`, label: `${group.label} · beobachteter Klassencode`, default: SIA_CONSUMER_CLASS_CODES[group.id][0], kind: "select", group: "Normprofil · Daten fehlen", visibleWhen: automatic, options: SIA_CONSUMER_CLASS_CODES[group.id].map(value => ({ value, label: value })), help: "Beobachtete Klassenkennung ohne hinterlegte Leistungs-/Energiewerte. Keine Zahlen werden aus gerundeten Anbieterergebnissen zurückgerechnet." })),
      ...legacy.fields.map(field => ({ ...field, visibleWhen: [...(field.visibleWhen ?? []), { key: "siaMode", values: ["legacy"] }] })),
    ],
    calculate(input) {
      if (input.siaMode === "automatic") requireSIAAutomaticDataset();
      if (input.siaMode === "legacy") {
        const result = legacy.calculate(input);
        return { ...result, status: { ...result.status, tone: result.status.tone === "error" ? "error" : "warning", text: `Bisherige manuelle Bilanz: ${result.status.text}` }, limitations: ["Unverändertes bisheriges Modell für gespeicherte Projektstände. Es verwendet andere Faktorbezüge als die neue getrennte Rohkennwertbilanz; kein identisches SIA-Referenzverfahren.", ...result.limitations] };
      }
      if (input.siaMode !== "manual") throw new Error("Berechnungsgrundlage auswählen.");
      return siaManualResult(input);
    },
  };
}
