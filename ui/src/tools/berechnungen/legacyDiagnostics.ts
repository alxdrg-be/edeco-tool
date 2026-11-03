import type { Diagnostic } from "./DiagnosticDetails";
import { RESISTANCE_20, type CableInput } from "./engineering.ts";
import type { calculateCable } from "./engineering.ts";
import { FACTORS, type LightningInput, type calculateLightning } from "./lightning-model.ts";
import type { EVInput, calculateEV } from "./ev-model.ts";
import { EV_EXTENSION_DEFAULTS } from "./EVdata.ts";

const f = (value: number, unit = "") => `${value.toLocaleString("de-CH", { maximumFractionDigits: 4 })}${unit ? ` ${unit}` : ""}`;
const n = (value: string | undefined) => Number((value ?? "").replace(",", "."));
type Range = { field: string; label: string; min: number; max: number; zero?: boolean; integer?: boolean; optional?: boolean };
function invalid(input: Record<string, string | undefined>, range: Range): boolean {
  const raw = input[range.field]?.trim() ?? "";
  if (!raw && range.optional) return false;
  const value = n(raw);
  return !/^\d+(?:[.,]\d+)?$/.test(raw) || !Number.isFinite(value) || (range.zero ? value < range.min : value <= range.min) || value > range.max || Boolean(range.integer && !Number.isInteger(value));
}
function inputFailure(input: Record<string, string | undefined>, ranges: Range[], error: string, fallback: string[]): Diagnostic[] {
  const range = ranges.find(value => invalid(input, value));
  const fields = range ? [range.field] : fallback;
  return [{ id: "legacy-invalid-input", title: range ? `${range.label} prüfen` : "Eingabe oder Modellgrundlage prüfen", tone: "error", message: error,
    actual: range ? `${range.label}: ${input[range.field] || "leer"}` : fields.map(field => `${field}: ${input[field] || "leer"}`).join(" · "),
    required: range ? `${range.integer ? "Ganze Zahl; " : ""}${range.zero ? "mindestens" : "grösser als"} ${range.min}, höchstens ${range.max}.` : "Die im Hinweis genannte Daten- und Modellbedingung muss erfüllt sein.",
    action: "Prüfe die betroffene Eingabe anhand der tatsächlichen Ausführung. Der Rechner ersetzt keine Werte automatisch.", targets: fields.map(field => ({ field, label: ranges.find(value => value.field === field)?.label ?? field })) }];
}

export function cableDiagnostics(input: CableInput, result: ReturnType<typeof calculateCable> | null, error: string): Diagnostic[] {
  if (!result) {
    const ranges: Range[] = [{ field: "length", label: "Einfache Leitungslänge", min: 0, max: 100000 }, { field: "current", label: "Laststrom", min: 0, max: 100000 }, { field: "area", label: "Querschnitt", min: 0, max: 240 }, { field: "cosPhi", label: "Leistungsfaktor cos φ", min: 0, max: 1 }, { field: "voltage", label: "Bemessungsspannung", min: 0, max: 1000 }, { field: "limit", label: "Spannungsfallbudget", min: 0, max: 20 }];
    const badMaterial = !Object.hasOwn(RESISTANCE_20, input.material), badArea = !badMaterial && !Object.hasOwn(RESISTANCE_20[input.material], String(n(input.area)));
    return inputFailure(input as unknown as Record<string, string>, ranges, error, badMaterial ? ["material"] : badArea ? ["area", "material"] : /modellgrenze/i.test(error) ? ["length", "current", "area", "voltage"] : ["phases"]);
  }
  if (result.withinBudget) return [];
  return [{ id: "cable-voltage-budget", title: "Spannungsfallbudget überschritten", tone: "error", message: "Leitungslänge, Laststrom und Leiterimpedanz ergeben einen zu grossen Spannungsfall. Der Vergleich betrifft diesen Abschnitt; vorgelagerte Anteile müssen ebenfalls ins Projektbudget passen.",
    actual: `${f(result.percent, "%")} bei ${f(result.length, "m")} und ${f(result.area, "mm²")}`,
    required: `ΔU ≤ ${f(result.limit, "%")}. Die rechnerische Längengrenze beträgt rund ${f(result.maxLength, "m")}${result.recommendedArea ? `; der nächste tabellierte Querschnitt für dieses Spannungsfallmodell ist ${f(result.recommendedArea, "mm²")}` : "; kein hinterlegter Querschnitt erreicht dieses Budget"}.`,
    action: "Tatsächliche Leitungslänge und Last prüfen oder einen geeigneten Querschnitt dimensionieren. Die Querschnittsempfehlung prüft keine Strombelastbarkeit oder Schutzmassnahme.", targets: [{ field: "area", label: "Leiterquerschnitt" }, { field: "length", label: "Leitungslänge" }, { field: "current", label: "Laststrom" }, { field: "limit", label: "Projektbudget" }] }];
}

export function lightningDiagnostics(input: LightningInput, result: ReturnType<typeof calculateLightning> | null, error: string): Diagnostic[] {
  if (!result) {
    const ranges: Range[] = [{ field: "perimeter", label: "Gebäudeumfang", min: 0, max: 100000 }, { field: "length", label: "Leitungsweg", min: 0, max: 100000 }, { field: "conductors", label: "Ableiteranzahl", min: 2, max: 100000, zero: true, integer: true }, { field: "clearance", label: "Vorhandener Abstand", min: 0, max: 100000, zero: true, optional: true }];
    const invalidLength = ["perimeter", "length", "clearance"].find(field => (field !== "clearance" || input.clearance.trim()) && !/^\d{1,6}(?:[.,]\d{1,6})?$/.test(input[field as keyof LightningInput].trim()));
    return inputFailure(input as unknown as Record<string, string>, ranges, error, !Object.hasOwn(FACTORS, input.protection) ? ["protection"] : invalidLength ? [invalidLength] : ["conductors"]);
  }
  const out: Diagnostic[] = [];
  if (!result.conductorOK) out.push({ id: "lightning-conductors", title: "Ableiteranzahl unterschreitet das Minimum", tone: "error", message: "Das Schweizer Modell ermittelt die Mindestzahl aus Gebäudeumfang und Klassenabstand. Die Anzahl wird auf ganze Ableiter aufgerundet, mindestens zwei.", actual: `${input.conductors} Ableiter bei ${input.perimeter} m Umfang`, required: `n ≥ max(2, ceil(U / ${result.spacing} m)) = ${result.minimum} Ableiter.`, action: "Reale Ableiteranordnung und Gebäudeumfang prüfen. Eine höhere eingegebene Zahl bestätigt keine tatsächlich vorhandene Ausführung.", targets: [{ field: "conductors", label: "Ableiteranzahl" }, { field: "perimeter", label: "Gebäudeumfang" }] });
  if (result.clearanceOK === false) out.push({ id: "lightning-clearance", title: "Vorhandener Abstand ist zu klein", tone: "error", message: "Der kleinste vorhandene Abstand unterschreitet den im Schweizer Verfahren auf ganze Zentimeter aufgerundeten Trennungsabstand.", actual: f(result.availableMetres!, "m"), required: `Vorhandener Abstand d ≥ ${result.metres.toFixed(2)} m.`, action: "Tatsächlichen Abstand, Leitungsweg zum Potenzialausgleich und das Blitzschutzkonzept prüfen. Den Messwert nicht zur Freigabe erhöhen.", targets: [{ field: "clearance", label: "Vorhandener Abstand" }, { field: "length", label: "Leitungsweg" }] });
  if (result.clearanceOK === null) out.push({ id: "lightning-measurement", title: "Abstandsvergleich ist noch offen", tone: "neutral", message: "Ohne vorhandenen oder gemessenen Abstand wird kein bestandener Abstandsvergleich ausgegeben.", required: `Kleinsten tatsächlichen Abstand ermitteln und mit ${result.metres.toFixed(2)} m vergleichen.`, action: "Mess- beziehungsweise Planwert am Prüfpunkt ergänzen.", targets: [{ field: "clearance", label: "Vorhandener Abstand" }] });
  return out;
}

export function evDiagnostics(input: EVInput, result: ReturnType<typeof calculateEV> | null, error: string): Diagnostic[] {
  if (!result) {
    input = { minimumPower: "3.7", ...EV_EXTENSION_DEFAULTS, ...input };
    const ranges: Range[] = [{ field: "house", label: "Hausanschluss", min: 0, max: 1000 }, { field: "grid", label: "Grid-Vorsicherung", min: 0, max: 1000 }, { field: "reserve", label: "Gebäudereserve", min: 0, max: 1000, zero: true }, { field: "count", label: "Ladepunkte", min: 0, max: 1000, integer: true }, { field: "power", label: "Punktleistung", min: 0, max: 3000 }, { field: "hours", label: "Betriebszeit", min: 0, max: 24 }, { field: "consumption", label: "Fahrzeugverbrauch", min: 0, max: 1000 }, { field: "pv", label: "PV-Leistung", min: 0, max: 1e6, zero: true, optional: true }, { field: "battery", label: "Speicherenergie", min: 0, max: 1e6, zero: true, optional: true }, ...(input.mode === "dynamic" ? [{ field: "minimumPower", label: "Projekt-Mindestleistung", min: 0, max: 3000 }] : []), ...(input.mode === "static" && input.factorMode !== "reference" ? [{ field: "diversity", label: "Gleichzeitigkeitsfaktor", min: 0, max: 1, zero: true }] : [])];
    const fallback = /grid.vorsicherung.*hausanschluss/i.test(error) ? ["grid", "house"] : /mindestleistung.*punktleistung/i.test(error) ? ["minimumPower", "power"] : /höchstens 100 ladepunkte/i.test(error) ? ["count", "factorMode"] : /anwenderklasse/i.test(error) ? ["userClass"] : /pv.*speicher/i.test(error) ? ["sourceConnection"] : ["mode"];
    const out = inputFailure(input as unknown as Record<string, string>, ranges, error, fallback);
    if (/grid.vorsicherung.*hausanschluss/i.test(error)) { out[0].actual = `Grid ${input.grid} A > Haus ${input.house} A`; out[0].required = `Grid-Vorsicherung ≤ ${input.house} A bei diesem Hausanschluss.`; out[0].action = "Reale Vorsicherung und Anschlussauslegung prüfen. Eine grössere Hausanschluss-Eingabe ist keine technische Erweiterung."; }
    if (/mindestleistung.*punktleistung/i.test(error)) { out[0].actual = `${input.minimumPower} kW Mindestleistung > ${input.power} kW Punktleistung`; out[0].required = `0 < Projekt-Mindestleistung ≤ ${input.power} kW.`; }
    return out;
  }
  const out: Diagnostic[] = [];
  if (!result.phaseCapacityOK) {
    const house = result.strongestHousePhaseCurrent > n(input.house) + 1e-9, actual = house ? result.strongestHousePhaseCurrent : result.strongestGridPhaseCurrent, rating = n(input[house ? "house" : "grid"]);
    out.push({ id: "ev-phase-limit", title: `${house ? "Hausanschluss" : "Grid"}: Aussenleitergrenze überschritten`, tone: "error", message: "Für den Anschluss zählt der stärkste Aussenleiter einschliesslich Gebäudelast und möglicher Rückspeisung. Eine passende Gesamtleistung reicht allein nicht aus.", actual: `${f(actual, "A")} > ${f(rating, "A")}`, required: `Jeder betroffene Aussenleiter ≤ ${f(rating, "A")}.`, action: "Lasten, Phasenaufteilung, Erzeugung und Lastmanagement prüfen; den Anschluss nur nach realer Auslegung ändern.", targets: [{ field: house ? "house" : "grid", label: house ? "Hausanschluss" : "Grid-Vorsicherung" }, { field: "mode", label: "Lastmanagement" }, { field: "sourceConnection", label: "PV-/Speicheranschluss" }] });
  }
  if (input.mode === "none" && !result.capacityOK) out.push({ id: "ev-power-limit", title: "Unbegrenzter Ladebedarf überschreitet das Budget", tone: "error", message: "Ohne Lastmanagement bleibt der volle Ladebedarf sichtbar. Eine rechnerische Gleichzeitigkeit reduziert ihn in diesem Modus nicht.", actual: `${f(result.requested, "kW")} angefordert; ${f(result.available, "kW")} verfügbar`, required: "Bedarf innerhalb des Leistungsbudgets und aller Aussenleitergrenzen.", action: "Geeignetes Lastmanagement oder die reale Anschluss-/Ladeplanung prüfen.", targets: [{ field: "mode", label: "Lastmanagement" }, { field: "count", label: "Ladepunkte" }, { field: "power", label: "Punktleistung" }] });
  if (result.waitingCount && input.mode !== "none") out.push({ id: "ev-waiting", title: "Ladepunkte warten innerhalb des Lastmanagements", tone: "warning", message: "Punkte werden bewusst zurückgehalten, damit die aktiven Punkte das konfigurierte Mindestleistungs- und Phasenbudget einhalten. Dies ist keine automatische Freigabe der Anschlussplanung.", actual: `${result.activeCount} aktiv · ${result.waitingCount} wartend`, required: `Projekt-Mindestleistung ${f(result.minimumPower, "kW")} je aktivem Punkt im dynamischen Modus.`, action: "Betriebspriorität, Mindestleistung und verfügbare Anschlussreserve gemeinsam prüfen.", targets: [{ field: input.mode === "dynamic" ? "minimumPower" : "diversity", label: input.mode === "dynamic" ? "Projekt-Mindestleistung" : "Gleichzeitigkeitsfaktor" }] });
  if (result.factorFallback) out.push({ id: "ev-reference-open", title: "Keine passende veröffentlichte Referenzkurve", tone: "warning", message: "Für diese Klasse und Leistung ist keine Referenzkurve belegt. Das vorhandene Modell zeigt deshalb ausdrücklich den konservativen Faktor k = 1.", actual: `Klasse ${input.userClass} · ${input.power} kW · k = 1`, required: "Eine passende veröffentlichte Kombination oder ein manuell belegter Gleichzeitigkeitsfaktor.", action: "Anwenderklasse und Leistung prüfen oder einen eigenen Projektfaktor dokumentieren.", targets: [{ field: "userClass", label: "Anwenderklasse" }, { field: "factorMode", label: "Faktorgrundlage" }] });
  return out;
}
