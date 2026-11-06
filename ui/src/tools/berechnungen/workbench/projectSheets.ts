import { InputError, integer, number, type CalculatorDefinition, type CalculationResult, type Field, type Inputs } from "./types.ts";
import { withInputRow } from "./inputDiagnostics.ts";

const SOURCE = "edeco-arbeitsblatt:";
const f = (key: string, label: string, value: string, unit: string, group: string, help: string, extra: Partial<Field> = {}): Field => ({ key, label, default: value, unit, group, help, ...extra });
const select = (key: string, label: string, value: string, group: string, options: [string, string][], help: string): Field => ({ key, label, default: value, kind: "select", group, options: options.map(([value, label]) => ({ value, label })), help });
const fmt = (value: number, digits = 2) => value.toLocaleString("de-CH", { maximumFractionDigits: digits });
const cell = (raw: string, label: string, min: number, max: number, allowZero = false) => number({ value: raw }, "value", label, min, max, allowZero);
function signed(raw: string, label: string, min: number, max: number): number {
  const text = raw.trim().replace(",", ".");
  const required = `Von ${min.toLocaleString("de-CH")} bis ${max.toLocaleString("de-CH")}. Ein Minuszeichen ist erlaubt.`;
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) throw new InputError("value", `${label}: gültige Zahl eingeben.`, required, raw.trim() || "leer");
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max) throw new InputError("value", `${label}: von ${min} bis ${max}.`, required, raw.trim());
  return value;
}

function list(raw: string, label: string, maxItems: number): unknown[] {
  if (raw.length > 120000) throw new Error(`${label}: die Liste ist zu gross.`);
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`${label}: die Liste ist beschädigt.`); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > maxItems) throw new Error(`${label}: 1 bis ${maxItems} Einträge.`);
  return parsed;
}
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: Eintrag erwartet.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label}: Bezeichnung fehlt.`);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) throw new Error(`${label}: Bezeichnung mit 1 bis 80 Zeichen.`);
  return trimmed;
}
function identity(value: unknown, label: string, seen: Set<string>): string {
  if (typeof value !== "string" || !/^[\w-]{1,40}$/.test(value) || seen.has(value)) throw new Error(`${label}: jede Zeile braucht eine eigene Kennung.`);
  seen.add(value);
  return value;
}

export interface LoadRow { id: string; label: string; count: string; watts: string; diversity: string }
export interface LoadBoard { id: string; label: string; diversity: string; rows: LoadRow[] }
export interface LevelSegment { id: string; label: string; kind: "cable" | "device"; length: string; attenuation: string; gain: string }
export interface CostItem { id: string; group: string; code: string; label: string; quantity: string; price: string }

export function defaultLoadBoards(): LoadBoard[] {
  return [{ id: "board-1", label: "Verteilung", diversity: "1", rows: [{ id: "row-1", label: "Beispielverbraucher", count: "1", watts: "2000", diversity: "1" }] }];
}
export function defaultLevelSegments(): LevelSegment[] {
  return [
    { id: "seg-1", label: "Stammkabel", kind: "cable", length: "25", attenuation: "20", gain: "0" },
    { id: "seg-2", label: "Abzweiger", kind: "device", length: "0", attenuation: "0", gain: "-8" },
  ];
}
export function defaultCostItems(): CostItem[] {
  return [{ id: "item-1", group: "Allgemein", code: "231", label: "Beispielposition", quantity: "2", price: "1500" }];
}

export function parseLoadBoards(raw: string): LoadBoard[] {
  const seen = new Set<string>();
  return list(raw, "Verteilungen", 12).map((item, index) => withInputRow("loadBoards", { id: typeof record(item, "Verteilung").id === "string" ? String(record(item, "Verteilung").id) : `board-${index}` }, index, () => {
    const board = record(item, "Verteilung");
    const id = identity(board.id, "Verteilung", seen);
    const label = text(board.label, "Bezeichnung der Verteilung");
    const diversity = String(board.diversity ?? "");
    cell(diversity, "Gleichzeitigkeit der Verteilung", 0, 1, true);
    const rowsRaw = board.rows;
    if (!Array.isArray(rowsRaw) || rowsRaw.length < 1 || rowsRaw.length > 40) throw new Error("Bezeichnung: jede Verteilung braucht 1 bis 40 Verbraucher.");
    const rows = rowsRaw.map((rowItem, rowIndex) => withInputRow("loadBoards", { id: typeof record(rowItem, "Verbraucher").id === "string" ? String(record(rowItem, "Verbraucher").id) : `row-${rowIndex}` }, rowIndex, () => {
      const row = record(rowItem, "Verbraucher");
      const rowId = identity(row.id, "Verbraucher", seen);
      return {
        id: rowId,
        label: text(row.label, "Bezeichnung"),
        count: String(integer({ value: String(row.count ?? "") }, "value", "Anzahl", 0, 10000, true)),
        watts: String(cell(String(row.watts ?? ""), "Leistung", 0, 1e7, true)),
        diversity: String(cell(String(row.diversity ?? ""), "Gleichzeitigkeit", 0, 1, true)),
      };
    }));
    return { id, label, diversity: String(cell(diversity, "Gleichzeitigkeit der Verteilung", 0, 1, true)), rows };
  }));
}

export function parseLevelSegments(raw: string): LevelSegment[] {
  const seen = new Set<string>();
  return list(raw, "Streckenabschnitte", 24).map((item, index) => withInputRow("rtvSegments", { id: typeof record(item, "Abschnitt").id === "string" ? String(record(item, "Abschnitt").id) : `seg-${index}` }, index, () => {
    const row = record(item, "Abschnitt");
    const kind = row.kind === "cable" || row.kind === "device" ? row.kind : null;
    if (!kind) throw new Error("Bezeichnung: Abschnitt ist Kabel oder Gerät.");
    return {
      id: identity(row.id, "Abschnitt", seen),
      label: text(row.label, "Bezeichnung"),
      kind,
      length: String(kind === "cable" ? cell(String(row.length ?? ""), "Länge", 0, 5000) : 0),
      attenuation: String(kind === "cable" ? cell(String(row.attenuation ?? ""), "Dämpfung", 0, 100, true) : 0),
      gain: String(kind === "device" ? signed(String(row.gain ?? ""), "Pegeländerung", -80, 80) : 0),
    };
  }));
}

export function parseCostItems(raw: string): CostItem[] {
  const seen = new Set<string>();
  return list(raw, "Kostenpositionen", 80).map((item, index) => withInputRow("costItems", { id: typeof record(item, "Position").id === "string" ? String(record(item, "Position").id) : `item-${index}` }, index, () => {
    const row = record(item, "Position");
    return {
      id: identity(row.id, "Position", seen),
      group: text(row.group, "Gruppe"),
      code: text(row.code, "BKP"),
      label: text(row.label, "Bezeichnung"),
      quantity: String(cell(String(row.quantity ?? ""), "Menge", 0, 1e7, true)),
      price: String(cell(String(row.price ?? ""), "Einheitspreis", 0, 1e9, true)),
    };
  }));
}

function choice(input: Inputs, key: string, options: string[]) {
  if (!options.includes(input[key])) throw new Error("Bitte eine gültige Option wählen.");
  return input[key];
}

const loadBalance: CalculatorDefinition = {
  id: "leistungsbilanz",
  title: "Leistungsbilanz",
  description: "Verbraucher je Verteilung mit Menge, Leistung und Gleichzeitigkeit zusammenzählen.",
  source: `${SOURCE}leistungsbilanz`,
  scope: "Eigene Zusammenstellung aus Projekteingaben. Keine SIA-Tabelle, kein Anschlussgesuch und keine Leitungsdimensionierung.",
  fields: [
    f("loadBoards", "Verteilungen und Verbraucher", JSON.stringify(defaultLoadBoards()), "", "Verbraucher", "Liste der Verteilungen. Über die Struktur bearbeiten.", { kind: "text" }),
    select("system", "Anschluss", "3", "Strom", [["3", "3~ · 400 V"], ["1", "1~ · 230 V"]], "Der Strom gilt für die gleichzeitige Summenleistung, symmetrisch und mit dem eingegebenen Leistungsfaktor."),
    f("cosPhi", "Leistungsfaktor cos φ", "1", "", "Strom", "1 bedeutet reine Wirkleistung. Der Wert ist eine Projekteingabe.", { min: 0.01, max: 1, step: 0.01 }),
  ],
  calculate(input): CalculationResult {
    const boards = parseLoadBoards(input.loadBoards);
    const system = choice(input, "system", ["1", "3"]);
    const cos = number(input, "cosPhi", "Leistungsfaktor", 0, 1);
    const voltage = system === "3" ? 400 : 230;
    const detailed = boards.map(board => {
      const rows = board.rows.map(row => {
        const count = Number(row.count), watts = Number(row.watts), diversity = Number(row.diversity);
        const installed = count * watts / 1000;
        return { ...row, installed, simultaneous: installed * diversity };
      });
      const installed = rows.reduce((sum, row) => sum + row.installed, 0);
      const simultaneous = rows.reduce((sum, row) => sum + row.simultaneous, 0) * Number(board.diversity);
      return { ...board, rows, installed, simultaneous };
    });
    const installed = detailed.reduce((sum, board) => sum + board.installed, 0);
    const simultaneous = detailed.reduce((sum, board) => sum + board.simultaneous, 0);
    if (!(simultaneous > 0)) throw new Error("Mindestens ein Verbraucher mit Leistung und Gleichzeitigkeit über null.");
    const current = system === "3" ? simultaneous * 1000 / (Math.sqrt(3) * voltage * cos) : simultaneous * 1000 / (voltage * cos);
    return {
      metrics: [
        { label: "Installierte Leistung", value: installed, unit: "kW" },
        { label: "Gleichzeitige Leistung", value: simultaneous, unit: "kW" },
        { label: "Modellstrom am Anschluss", value: current, unit: "A" },
        { label: "Verteilungen", value: detailed.length, digits: 0 },
      ],
      status: { tone: "neutral", text: "Summe aus den eingegebenen Mengen, Leistungen und Gleichzeitigkeiten. Kein Anschlussentscheid." },
      rows: detailed.flatMap(board => [{ label: `${board.label} · gleichzeitig`, value: board.simultaneous, unit: "kW" }, ...board.rows.map(row => ({ label: `${board.label} · ${row.label}`, value: `${fmt(Number(row.count), 0)} × ${fmt(Number(row.watts), 0)} W × ${fmt(Number(row.diversity), 2)}` }))]),
      series: detailed.map(board => ({ label: board.label, value: board.simultaneous })),
      seriesLabel: "Gleichzeitige Leistung je Verteilung",
      seriesUnit: "kW",
      formula: `P_inst = Σ (Anzahl × Leistung); P_glz = Σ (Anzahl × Leistung × Gleichzeitigkeit Verbraucher × Gleichzeitigkeit Verteilung) = ${fmt(simultaneous)} kW. I = ${system === "3" ? `${fmt(simultaneous)} × 1000 / (√3 × ${voltage} × ${fmt(cos, 3)})` : `${fmt(simultaneous)} × 1000 / (${voltage} × ${fmt(cos, 3)})`} = ${fmt(current, 3)} A.`,
      limitations: ["Gleichzeitigkeiten sind Projekteingaben. Es wird keine SIA-2060- oder Wohnungsbau-Tabelle eingesetzt.", "Der Strom nimmt die ganze gleichzeitige Leistung am gewählten Anschluss an. Einphasige Verteilung auf L1, L2 und L3, Anlauf und Leitungen bleiben separat."],
    };
  },
};

export function annuityFactor(interestPercent: number, years: number): number {
  if (interestPercent === 0) return 1 / years;
  const interest = interestPercent / 100;
  return interest * (1 + interest) ** years / ((1 + interest) ** years - 1);
}

const zev: CalculatorDefinition = {
  id: "zev-gestehung",
  title: "ZEV-Gestehungskosten",
  description: "Jährliche Kapital- und Betriebskosten einer PV-Anlage auf den erwarteten Ertrag beziehen.",
  source: `${SOURCE}zev-gestehung`,
  scope: "Annuität der Investition plus jährliche Betriebskosten, geteilt durch den mittleren Jahresertrag. Kein ZEV-Tarifentscheid und keine historische Einspeisevergütung.",
  fields: [
    f("investment", "Investition", "20000", "CHF", "Anlage", "Erstellungskosten, die auf die Laufzeit verteilt werden. Beispielwert, kein Marktpreis."),
    f("years", "Laufzeit", "20", "Jahre", "Anlage", "Erwartete Betrachtungsdauer, höchstens 40 Jahre.", { min: 1, max: 40 }),
    f("interest", "Zinssatz", "0", "%", "Anlage", "0 ergibt die gleichmässige Aufteilung Investition / Laufzeit.", { min: 0, max: 20 }),
    f("opex", "Jährliche Betriebskosten", "100", "CHF/a", "Anlage", "Unterhalt, Zähler, Versicherung. 0 ist zulässig.", { min: 0 }),
    f("power", "Anlagenleistung", "10", "kWp", "Ertrag", "Installierte DC-Leistung."),
    f("yield", "Spezifischer Jahresertrag", "1000", "kWh/kWp", "Ertrag", "Erwarteter Ertrag im ersten Jahr, ohne Abzug. Kein Klimaregion-Standard."),
    f("performance", "Ertragsfaktor", "1", "", "Ertrag", "1 lässt den spezifischen Ertrag unverändert. Ein kleinerer Faktor ist eine eigene Abzugsannahme.", { min: 0.01, max: 1, step: 0.01 }),
    f("degradation", "Jährliche Degradation", "0", "%", "Ertrag", "0 lässt den Ertrag über die Laufzeit konstant. Der Mittelwert ist undiskontiert.", { min: 0, max: 5 }),
  ],
  calculate(input): CalculationResult {
    const investment = number(input, "investment", "Investition", 0, 1e9);
    const years = integer(input, "years", "Laufzeit", 1, 40, true);
    const interest = number(input, "interest", "Zinssatz", 0, 20, true);
    const opex = number(input, "opex", "Jährliche Betriebskosten", 0, 1e8, true);
    const power = number(input, "power", "Anlagenleistung", 0, 100000);
    const specific = number(input, "yield", "Spezifischer Jahresertrag", 0, 3000);
    const performance = number(input, "performance", "Ertragsfaktor", 0, 1);
    const degradation = number(input, "degradation", "Jährliche Degradation", 0, 5, true) / 100;
    const factor = annuityFactor(interest, years);
    const yieldFactor = degradation === 0 ? 1 : (1 - (1 - degradation) ** years) / (years * degradation);
    const energy = power * specific * performance * yieldFactor;
    const capital = investment * factor;
    const annual = capital + opex;
    const perKwh = annual / energy;
    return {
      metrics: [
        { label: "Gestehungskosten", value: perKwh * 100, unit: "Rp./kWh" },
        { label: "Jährliche Kosten", value: annual, unit: "CHF/a" },
        { label: "Mittlerer Jahresertrag", value: energy, unit: "kWh/a" },
        { label: "Annuitätsfaktor", value: factor, digits: 4 },
      ],
      status: { tone: "neutral", text: "Rechnerische Gestehungskosten aus den eingegebenen Kosten und dem Ertrag. Kein Tarif für die Teilnehmenden." },
      rows: [{ label: "Kapitalkosten pro Jahr", value: capital, unit: "CHF/a" }, { label: "Betriebskosten pro Jahr", value: opex, unit: "CHF/a" }, { label: "Ertragsfaktor über die Laufzeit", value: yieldFactor }],
      formula: `a = ${interest === 0 ? `1 / ${years}` : `${fmt(interest, 3)} % über ${years} Jahre`} = ${fmt(factor, 4)}. Kosten = ${fmt(investment)} × ${fmt(factor, 4)} + ${fmt(opex)} = ${fmt(annual)} CHF/a. Ertrag = ${fmt(power)} × ${fmt(specific)} × ${fmt(performance, 3)} × ${fmt(yieldFactor, 4)} = ${fmt(energy)} kWh/a. Gestehung = ${fmt(annual)} / ${fmt(energy)} = ${fmt(perKwh * 100, 2)} Rp./kWh.`,
      limitations: ["Der Ertrag wird nicht abgezinst. Eigenverbrauch, Rücklieferung, Messkosten je Teilnehmenden und Steuern sind nicht enthalten.", "Zinssatz, Laufzeit, Ertrag und Betriebskosten bleiben Projekteingaben. Alte Einspeisevergütungen werden nicht eingesetzt."],
    };
  },
};

const attenuation: CalculatorDefinition = {
  id: "rtv-daempfung",
  title: "RTV-Dämpfung",
  description: "Pegel einer Empfangsstrecke aus eigenen Kabel- und Gerätewerten weiterrechnen.",
  source: `${SOURCE}rtv-daempfung`,
  scope: "Pegelkette in dBµV. Kabeldämpfung und Gerätepegel sind Eingaben, keine hinterlegte Kabel- oder Netzbetreibertabelle.",
  fields: [
    f("startLevel", "Startpegel", "80", "dBµV", "Strecke", "Pegel am Anfang der betrachteten Strecke."),
    f("frequency", "Frequenzhinweis", "862 MHz", "", "Strecke", "Nur eine Beschriftung. Die Dämpfung wird nicht aus der Frequenz berechnet.", { kind: "text" }),
    f("rtvSegments", "Abschnitte", JSON.stringify(defaultLevelSegments()), "", "Strecke", "Kabel und Geräte der Reihe nach. Über die Struktur bearbeiten.", { kind: "text" }),
  ],
  calculate(input): CalculationResult {
    const start = number(input, "startLevel", "Startpegel", 0, 140, true);
    const note = (input.frequency ?? "").trim();
    if (!note || note.length > 40) throw new Error("Frequenzhinweis: kurze Beschriftung eingeben.");
    const segments = parseLevelSegments(input.rtvSegments);
    let level = start;
    const steps = segments.map(segment => {
      const delta = segment.kind === "cable" ? -Number(segment.length) * Number(segment.attenuation) / 100 : Number(segment.gain);
      level += delta;
      return { ...segment, delta, level };
    });
    const end = steps.at(-1)!.level;
    return {
      metrics: [
        { label: "Pegel am Ende", value: end, unit: "dBµV" },
        { label: "Pegeländerung", value: end - start, unit: "dB" },
        { label: "Abschnitte", value: steps.length, digits: 0 },
      ],
      status: { tone: "neutral", text: "Der Endpegel folgt nur aus dem Startpegel und den eingegebenen Abschnitten." },
      rows: steps.map(step => ({ label: step.label, value: `${fmt(step.delta)} dB → ${fmt(step.level)} dBµV` })),
      diagram: { kind: "chain", nodes: [{ label: "Start", value: `${fmt(start)} dBµV`, detail: note }, ...steps.map(step => ({ label: step.label, value: `${fmt(step.level)} dBµV`, detail: `${fmt(step.delta)} dB` }))] },
      formula: `P_Ende = ${fmt(start)} ${steps.map(step => `${step.delta >= 0 ? "+" : "−"} ${fmt(Math.abs(step.delta))}`).join(" ")} = ${fmt(end)} dBµV. Frequenzhinweis «${note}» geht nicht in die Rechnung ein.`,
      limitations: ["Es gibt keine hinterlegte Dämpfung bei 50 oder 862 MHz und keine Netzbetreiberpegel.", "Schirmung, Stecker, Temperatur und der zulässige Pegel an der Dose bleiben ausserhalb dieser Kette."],
    };
  },
};

const estimate: CalculatorDefinition = {
  id: "bkp-schaetzung",
  title: "BKP-Kostenschätzung",
  description: "Positionen mit Menge und eigenem Einheitspreis zur Schätzsumme addieren.",
  source: `${SOURCE}bkp-schaetzung`,
  scope: "Mengengerüst mal Projekteinheitspreis, mit einer selbst angegebenen Schätzbandbreite. Keine hinterlegten Marktpreise und kein Honorarnachweis.",
  fields: [
    f("costItems", "Positionen", JSON.stringify(defaultCostItems()), "", "Positionen", "BKP, Menge und Einheitspreis. Über die Struktur bearbeiten.", { kind: "text" }),
    f("accuracy", "Schätzbandbreite", "20", "%", "Summe", "Zum Beispiel 20 für eine Schätzung ±20 %. Der Prozentwert ist eine Angabe zur Genauigkeit, kein Normwert.", { min: 0, max: 50 }),
  ],
  calculate(input): CalculationResult {
    const items = parseCostItems(input.costItems);
    const accuracy = number(input, "accuracy", "Schätzbandbreite", 0, 50, true) / 100;
    const priced = items.map(item => ({ ...item, total: Number(item.quantity) * Number(item.price) }));
    const sum = priced.reduce((total, item) => total + item.total, 0);
    if (!(sum > 0)) throw new Error("Mindestens eine Position mit Menge und Preis über null.");
    const groups = new Map<string, number>();
    for (const item of priced) groups.set(item.group, (groups.get(item.group) ?? 0) + item.total);
    return {
      metrics: [
        { label: "Schätzsumme", value: sum, unit: "CHF" },
        { label: "Untere Bandbreite", value: sum * (1 - accuracy), unit: "CHF" },
        { label: "Obere Bandbreite", value: sum * (1 + accuracy), unit: "CHF" },
        { label: "Positionen", value: priced.length, digits: 0 },
      ],
      status: { tone: "neutral", text: "Summe der eingegebenen Positionen. Die Bandbreite ist die angegebene Schätzgenauigkeit." },
      rows: [...groups.entries()].map(([group, value]) => ({ label: group, value, unit: "CHF" })),
      series: [...groups.entries()].map(([label, value]) => ({ label, value })),
      seriesLabel: "Summe je Gruppe",
      seriesUnit: "CHF",
      formula: `Summe = Σ (Menge × Einheitspreis) = ${fmt(sum)} CHF. Bandbreite ±${fmt(accuracy * 100, 0)} % ergibt ${fmt(sum * (1 - accuracy))} bis ${fmt(sum * (1 + accuracy))} CHF.`,
      limitations: ["Einheitspreise stammen aus der Eingabe. Es sind keine Preislisten, Richtpreise oder alten Projektsummen hinterlegt.", "Die Bandbreite beschreibt nur die angegebene Schätzgenauigkeit. Sie ist keine Offerte und kein Honorarnachweis."],
    };
  },
};

export const SHEETS: CalculatorDefinition[] = [loadBalance, zev, attenuation, estimate];

export function sheetReportInputs(id: string, input: Inputs): { label: string; value: string }[] {
  if (id === "leistungsbilanz") return parseLoadBoards(input.loadBoards).flatMap(board => [{ label: `${board.label} · Gleichzeitigkeit`, value: board.diversity }, ...board.rows.map(row => ({ label: `${board.label} · ${row.label}`, value: `${row.count} × ${row.watts} W × ${row.diversity}` }))]);
  if (id === "rtv-daempfung") return parseLevelSegments(input.rtvSegments).map(segment => ({ label: segment.label, value: segment.kind === "cable" ? `${segment.length} m · ${segment.attenuation} dB/100 m` : `${segment.gain} dB` }));
  if (id === "bkp-schaetzung") return parseCostItems(input.costItems).map(item => ({ label: `${item.group} · ${item.code} ${item.label}`, value: `${item.quantity} × ${item.price} CHF` }));
  return [];
}
