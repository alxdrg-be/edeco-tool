import { RESISTANCE_20, REACTANCE, numeric } from "./engineering.ts";
import { LEGACY_VOLTAGE_WARNING, shortCircuitVoltageFactors, VOLTAGE_TOLERANCE_HELP, VOLTAGE_TOLERANCE_OPTIONS } from "./voltageFactors.ts";
import type { Field } from "./workbench/types.ts";
import type { NetworkDocument, NetworkEdge, NetworkEdgeResult, NetworkIssue, NetworkNode, NetworkNodeKind, NetworkNodeResult, NetworkResult, NetworkTone } from "./networkTypes.ts";

/** «Wie NIN-Programm» rechnet den Spannungsfall bei 20 °C und ignoriert die Leitertemperatur. */
export function networkDropIgnoresEdgeTemperature(calcBasis: string): boolean {
  return calcBasis === "nin-program";
}
const n = (key: string, label: string, value: string, unit = "", help = ""): Field => ({ key, label, default: value, unit, help });
const s = (key: string, label: string, value: string, choices: (string | [string, string])[], help = ""): Field => ({ key, label, default: value, kind: "select", help, options: choices.map(option => Array.isArray(option) ? { value: option[0], label: option[1] } : { value: option, label: option }) });
const visible = (field: Field, key: string, values: string[]): Field => ({ ...field, visibleWhen: [{ key, values }] });
const sections = Object.keys(RESISTANCE_20.cu);
const ratings = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000].map(String);
export const NETWORK_NODE_LABELS: Record<NetworkNodeKind, string> = { source: "Einspeisung NS", transformer: "Transformator", distribution: "Unterverteilung", protection: "Schutzorgan", load: "Verbraucher" };
export const NETWORK_NODE_FIELDS: Record<NetworkNodeKind, Field[]> = {
  source: [
    s("phases", "Netzsystem", "3", [["3", "3~ 400/230 V"], ["1", "1~ 230 V"]]),
    s("voltage", "Bemessungsspannung", "400", [["400", "400 V · Aussenleiter"], ["230", "230 V · L–N"]]),
    s("voltageTolerance", "Spannungstoleranz für Ik,max", "plus10", VOLTAGE_TOLERANCE_OPTIONS, VOLTAGE_TOLERANCE_HELP),
    s("maxCurrent", "Verfügbarer Anschlussstrom", "160", ratings, "Stromgrenze je Aussenleiter; keine automatische Netzbetreiberfreigabe."),
    s("sourceMode", "Vorgelagerte Quelle", "impedance", [["impedance", "R und X vorgegeben"], ["ik", "Ik,max am Einspeisepunkt"], ["ideal", "Ideal · Vorimpedanz 0"]], "Alle Quellwerte auf die Niederspannungsseite beziehen. Das Ik-Modell nimmt für den unbekannten R/X-Anteil reine Reaktanz an."),
    visible(n("r", "Quellwiderstand R", "0.01", "Ω"), "sourceMode", ["impedance"]),
    visible(n("x", "Quellreaktanz X", "0.015", "Ω"), "sourceMode", ["impedance"]),
    visible(n("ik", "Maximaler Ik am Einspeisepunkt", "10", "kA", "Bereits maximaler Quellenstrom. Der Faktor cmax wird bei der Rückrechnung von Z berücksichtigt und nicht nochmals auf den eingegebenen Strom aufgeschlagen."), "sourceMode", ["ik"]),
    s("loopKnown", "L–PE-Quellenimpedanz dokumentiert", "no", [["no", "Nicht bekannt · Ikmin bleibt offen"], ["yes", "Als Projektwert vorgegeben"]]),
    visible(n("loopImpedance", "L–PE-Quellenimpedanz", "0.03", "Ω", "Vorgegebener Quellenanteil der Fehlerschleife; kein Ersatz für gemessene Netz- und Nullsystemdaten."), "loopKnown", ["yes"]),
    s("calcBasis", "Rechenbasis", "iec", [["iec", "Vorsichtig · IEC 60909"], ["nin-program", "Wie NIN-Programm (Electrosuisse)"]], "Vorsichtig: Spannungsfall bei der Leitertemperatur jeder Leitung (Standard 55 °C), Ik,min mit cmin 0.95 × 230 V. Wie NIN-Programm: Spannungsfall bei 20 °C, Ik,min mit der Betriebsspannung Ub / √3 ohne cmin. Die vorsichtige Basis ergibt höhere Spannungsfälle und tiefere Ik,min."),
    visible(n("operatingVoltage", "Betriebsspannung Ub", "420", "V", "Aussenleiterspannung im Betrieb, wie im NIN-Programm unter Ub erfasst. Nur für die Rechenbasis «Wie NIN-Programm»."), "calcBasis", ["nin-program"]),
    s("limit", "Spannungsfall bis zur Last", "4", [["4", "4 % · NIN 5.2.5.1"], ["3", "3 % · Projektwert"]], "Das Budget gilt für den gesamten Strompfad, nicht getrennt je Leitung."),
  ],
  transformer: [n("kva", "Nennleistung", "100", "kVA"), s("uk", "Kurzschlussspannung uₖ", "4", [["4", "4 %"], ["6", "6 %"]], "Typenschildwert. Der Trafo wird im NS-Ersatznetz als reine Reaktanz modelliert.")],
  distribution: [s("device", "Verteilungselement", "uv", [["uv", "Unterverteiler UV"], ["busbar", "Sammelschiene"], ["meter", "Zähler"], ["hak", "Hausanschlusskasten HAK"]]), s("rated", "Dokumentierter Nennstrom", "125", ratings)],
  protection: [
    s("device", "Schutz- / Schaltgerät", "LS", [["LS", "LS-Schalter"], ["NH", "NH gG"], ["MCCB", "Leistungsschalter"], ["RCD", "FI / RCD"], ["RCBO", "LS + FI / RCBO"], ["MOTOR", "Motorschutz"], ["SWITCH", "Schalter"]]),
    visible(s("curve", "Magnetische Charakteristik", "B", [["B", "B · 3–5 × In"], ["C", "C · 5–10 × In"], ["D", "D · 10–20 × In"], ["K", "K · 8–14 × In · Herstellerannahme"], ["Z", "Z · 2–3 × In · Herstellerannahme"]]), "device", ["LS", "RCBO"]),
    s("rated", "Nennstrom In", "16", ratings),
    visible(s("icn", "Ausschaltvermögen", "6", ["3", "6", "10", "15", "25", "36", "50", "70", "100"], "Am konkreten Gerät dokumentieren; keine automatische Back-up-Zuordnung."), "device", ["LS", "RCBO", "MCCB"]),
    visible(n("i2factor", "Dokumentierter Prüfstromfaktor I₂/In", "1.45", "", "Zum konkreten Schutzorgan gehörenden Prüfstromfaktor vorgeben."), "device", ["LS", "RCBO", "MCCB", "NH", "MOTOR"]),
    visible(s("tripCurrent", "Bemessungsdifferenzstrom IΔn", "30", ["10", "30", "100", "300", "500", "1000"], "mA. Abschaltzeit, Netzsystem und Erdungswiderstand werden nicht automatisch nachgewiesen."), "device", ["RCD", "RCBO"]),
    visible(s("timeDelayed", "Zeitverzögerung", "no", [["no", "Unverzögert"], ["yes", "Selektiv / Typ S · dokumentiert"]]), "device", ["RCD", "RCBO"]),
    visible(s("rcdType", "RCD-Typ", "offen", [["offen", "Nicht belegt"], ["AC", "Typ AC"], ["A", "Typ A"], ["F", "Typ F"], ["B", "Typ B"], ["A-6mA", "Typ A oder F mit 6 mA DC"]], "Keine Freigabe. Der Typ muss zur Anlage passen. Bei Ladepunkten bleibt der DC-Schutz ein offener Nachweis."), "device", ["RCD", "RCBO"]),
  ],
  load: [
    s("device", "Verbrauchertyp", "general", [["general", "Allgemeiner Verbraucher"], ["motor", "Motor"], ["socket", "Steckdose"], ["light", "Leuchte"], ["heater", "Heizung"], ["fan", "Ventilator"], ["cooker", "Herd"], ["ev", "Ladepunkt"]]),
    n("power", "Elektrische Wirkleistung", "6.9", "kW", "Elektrische Aufnahmeleistung. Bei Motoren mechanische Leistung vorher mit dem Wirkungsgrad umrechnen."),
    n("cosPhi", "Induktiver Leistungsfaktor cos φ", "0.95"),
    s("phases", "Anschluss", "3", [["3", "3~ · symmetrisch"], ["1", "1~ · L–N"]]),
    visible(s("phase", "Aussenleiter", "L1", ["L1", "L2", "L3"]), "phases", ["1"]),
    n("diversity", "Eigener Gleichzeitigkeitsanteil", "1", "", "Manueller Anteil 0 bis 1. Keine automatische SIA-Zuordnung."),
  ],
};
export const NETWORK_EDGE_FIELDS: Field[] = [
  n("length", "Einfache Leitungslänge", "25", "m"),
  s("material", "Leitermaterial", "cu", [["cu", "Kupfer"], ["al", "Aluminium · ab 10 mm²"]]),
  s("area", "Aussenleiterquerschnitt", "2.5", sections.map(value => [value, `${value} mm²`])),
  s("neutralArea", "Neutralleiterquerschnitt", "same", [["same", "Wie Aussenleiter"], ...sections.map(value => [value, `${value} mm²`] as [string, string])], "Neutralleiter und Aussenleiter werden mit demselben Material modelliert."),
  s("peArea", "Schutzleiterquerschnitt", "same", [["same", "Wie Aussenleiter"], ...sections.map(value => [value, `${value} mm²`] as [string, string])], "Schutzleiter und Aussenleiter werden mit demselben Material modelliert; gemischte Cu-/Al-Pfade sind nicht abgebildet."),
  { ...n("neutralIz", "Korrigiertes Iz je Neutralleiterkreis", "20", "A", "Bei abweichendem N-Querschnitt eigene korrigierte Strombelastbarkeit belegen."), visibleWhen: [{ key: "neutralArea", values: sections }, { key: "izMode", values: ["manual"] }] },
  n("parallel", "Identische parallele Leiter je Phase", "1", "Stk."),
  n("temperature", "Leitertemperatur für Spannungsfall", "55", "°C", "Bei «Vorsichtig» gilt dieser Wert. Bei «Wie NIN-Programm» gilt fest 20 °C; der gespeicherte Wert bleibt erhalten. Ik,min bleibt 80 °C."),
  n("thermalK", "Dokumentierter k-Faktor", "", "A√s/mm²", "Nur ein belegter Wert. Leer lassen, wenn kein Nachweis vorliegt. Es wird kein Normwert eingesetzt."),
  n("thermalSeconds", "Dokumentierte Einwirkzeit", "", "s", "Zeit für k²·S² ≥ I²·t am Aussenleiter. Leer lassen, wenn kein Beleg vorliegt."),
  s("izMode", "Strombelastbarkeit Iz", "manual", [["manual", "Dokumentierten Wert vorgeben"], ["open", "Ungeprüft"]]),
  visible(n("iz", "Korrigiertes Iz je parallelem Kreis", "20", "A", "Wert inklusive zutreffender Temperatur-/Häufungsfaktoren; keine automatische Normtabellenwahl."), "izMode", ["manual"]),
];

export function createNetworkNode(kind: NetworkNodeKind, id: string, x = 0, y = 0): NetworkNode {
  return { id, kind, label: NETWORK_NODE_LABELS[kind], x, y, values: Object.fromEntries(NETWORK_NODE_FIELDS[kind].map(field => [field.key, field.default])) };
}
export function createNetworkEdge(id: string, from: string, to: string): NetworkEdge {
  return { id, from, to, values: Object.fromEntries(NETWORK_EDGE_FIELDS.map(field => [field.key, field.default])) };
}
export function createDefaultNetwork(): NetworkDocument {
  const nodes = [createNetworkNode("source", "source", 80, 100), createNetworkNode("distribution", "uv", 350, 100), createNetworkNode("protection", "ls", 620, 100), createNetworkNode("load", "load", 890, 100)];
  nodes[2].label = "LS B16"; nodes[3].label = "Verbraucher 6.9 kW";
  return { version: 1, name: "Neues Netzprojekt", nodes, edges: [createNetworkEdge("line-1", "source", "uv"), createNetworkEdge("line-2", "uv", "ls"), createNetworkEdge("line-3", "ls", "load")] };
}

type Complex = { re: number; im: number };
type Triple = [Complex, Complex, Complex];
function computedFinite(value: number, label = "Netzberechnung"): number {
  if (!Number.isFinite(value)) throw new Error(`${label}: Rechenergebnis ausserhalb des berechenbaren Zahlenbereichs. Eingaben prüfen.`);
  return value;
}
function computedPositive(value: number, label: string): number {
  computedFinite(value, label);
  if (!(value > 0)) throw new Error(`${label}: Rechenergebnis unterhalb der berechenbaren Genauigkeit. Eingaben prüfen.`);
  return value;
}
const c = (re = 0, im = 0): Complex => ({ re: computedFinite(re, "Komplexe Netzgrösse"), im: computedFinite(im, "Komplexe Netzgrösse") });
const add = (a: Complex, b: Complex) => c(a.re + b.re, a.im + b.im);
const mul = (a: Complex, b: Complex) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const magnitude = (a: Complex) => computedFinite(Math.hypot(a.re, a.im), "Betrag einer Netzgrösse");
const zero = (): Triple => [c(), c(), c()];
const phases = [0, -2 * Math.PI / 3, 2 * Math.PI / 3];
const rotate = (phase: number) => c(Math.cos(phases[phase]), Math.sin(phases[phase]));
const fmt = (value: number, digits = 3) => value.toLocaleString("de-CH", { maximumFractionDigits: digits });
const tol = 1e-9;
const worst = (a: NetworkTone, b: NetworkTone): NetworkTone => (["neutral", "ok", "warning", "error"].indexOf(a) > ["neutral", "ok", "warning", "error"].indexOf(b) ? a : b);

export class NetworkInputError extends Error {
  field: string;
  required: string;
  constructor(field: string, message: string, required: string) {
    super(message);
    this.name = "NetworkInputError";
    this.field = field;
    this.required = required;
  }
}
function read(values: Record<string, string>, key: string, label: string, max = 1e9, allowZero = false): number {
  const required = `Endliche Zahl ${allowZero ? "ab 0" : "grösser als 0"} bis ${fmt(max)}.`;
  if (typeof values[key] !== "string") throw new NetworkInputError(key, `${label}: Zahl eingeben.`, required);
  try { return numeric(values[key], label, 0, max, allowZero); }
  catch (error) { throw new NetworkInputError(key, error instanceof Error ? error.message : `${label}: Zahl eingeben.`, required); }
}
function choice(values: Record<string, string>, key: string, valid: string[], label: string): string {
  if (!valid.includes(values[key])) throw new NetworkInputError(key, `${label}: gültigen Listenwert wählen.`, `Einen der vorhandenen Listenwerte wählen: ${valid.join(", ")}.`);
  return values[key];
}
function whole(values: Record<string, string>, key: string, label: string, max: number) {
  const value = read(values, key, label, max); if (!Number.isInteger(value)) throw new NetworkInputError(key, `${label}: ganze Zahl eingeben.`, `Ganze Zahl von 1 bis ${max}.`); return value;
}
function invalid(issues: NetworkIssue[]): NetworkResult {
  return { valid: false, tone: "error", status: "Netz nicht berechenbar. Verbindungen und Eingaben prüfen.", issues, nodes: [], edges: [], totalPowerKW: 0, maxCurrent: 0, maxDropPercent: 0, formula: "Kein Ergebnis bei unvollständigem oder ungültigem Netz.", assumptions: [] };
}
interface Demand { currents: Triple; powerKW: number; singlePhase: boolean; connectedPhases: [boolean, boolean, boolean] }
interface Wire {
  edge: NetworkEdge; zCold: Complex; zWarm: Complex; zDrop: Complex; zNeutral: Complex; zLoop: Complex;
  length: number; area: number; neutralArea: number; parallel: number; iz: number | null; neutralIz: number | null; temperature: number;
}
interface Path { cold: Complex; loopWires: Complex; transformerX: number; drop: Triple; protector?: NetworkNode; rcdDc?: string }

/** Original steady-state radial TN model. It never certifies an entire NIN installation. */
function calculateNetworkModel(document: NetworkDocument): NetworkResult {
  const issues: NetworkIssue[] = [];
  const structuralKeys = new Set<string>();
  const problem = (text: string, nodeId?: string, edgeId?: string, code = "structure", field = "") => {
    const key = JSON.stringify([code, nodeId || "", edgeId || "", field]);
    if (!structuralKeys.has(key)) { issues.push({ tone: "error", text, nodeId, edgeId, code, field }); structuralKeys.add(key); }
  };
  if (!document || document.version !== 1 || typeof document.name !== "string" || !Array.isArray(document.nodes) || !Array.isArray(document.edges)) return invalid([{ tone: "error", code: "project_format", text: "Ungültiges Netzprojektformat. Erwartet wird Version 1 mit Namen, Elementliste und Leitungsliste. Eine mit diesem Netzplaner gespeicherte JSON-Datei laden." }]);
  if (document.nodes.length > 500 || document.edges.length > 1000) return invalid([{ tone: "error", code: "project_limits", text: "Maximal 500 Elemente und 1000 Leitungen im Projektmodell." }]);
  const nodeById = new Map<string, NetworkNode>();
  for (const node of document.nodes) {
    if (!node || typeof node.id !== "string" || !node.id || nodeById.has(node.id)) { problem("Element-IDs müssen vorhanden und eindeutig sein.", undefined, undefined, "node_identity"); continue; }
    if (!Object.hasOwn(NETWORK_NODE_FIELDS, node.kind)) problem("Unbekannter Elementtyp.", node.id, undefined, "node_kind");
    if (typeof node.label !== "string" || node.label.length > 300) problem("Elementbeschriftung ist ungültig. Eine Bezeichnung mit höchstens 300 Zeichen eintragen.", node.id, undefined, "node_label");
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) problem("Elementposition ist ungültig. x und y müssen endliche Zahlen sein. Das Element neu auf der Fläche ablegen.", node.id, undefined, "node_position");
    if (!node.values || typeof node.values !== "object") problem("Elementeigenschaften fehlen.", node.id, undefined, "node_values");
    nodeById.set(node.id, node);
  }
  if (issues.some(issue => issue.tone === "error")) return invalid(issues);
  const sources = document.nodes.filter(node => node?.kind === "source");
  if (sources.length !== 1) problem("Genau eine NS-Einspeisung ist erforderlich; Mehrfacheinspeisung wird nicht modelliert.", undefined, undefined, "source_count");
  if (!document.edges.length) problem("Keine Leitungsverbindungen vorhanden. Elemente vor der Berechnung verbinden.", undefined, undefined, "no_edges");
  const outgoing = new Map<string, NetworkEdge[]>(), incoming = new Map<string, NetworkEdge>(), edgeIds = new Set<string>();
  for (const edge of document.edges) {
    if (!edge || typeof edge.id !== "string" || !edge.id || typeof edge.from !== "string" || typeof edge.to !== "string" || edgeIds.has(edge.id)) { problem("Leitungs-IDs müssen vorhanden und eindeutig sein.", undefined, undefined, "edge_identity"); continue; }
    edgeIds.add(edge.id);
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) { problem("Eine Leitung verweist auf ein fehlendes Element.", undefined, edge.id, "edge_missing_node"); continue; }
    if (edge.from === edge.to) problem("Ein Element kann nicht mit sich selbst verbunden sein.", edge.from, edge.id, "self_edge");
    if (incoming.has(edge.to)) problem("Mehrere Einspeisepfade an einem Element: nur radiale Netze sind unterstützt.", edge.to, edge.id, "multiple_paths");
    incoming.set(edge.to, edge);
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }
  if (sources[0] && incoming.has(sources[0].id)) problem("Die Einspeisung darf keine eingehende Leitung haben.", sources[0].id, undefined, "source_incoming");
  const visiting = new Set<string>(), visited = new Set<string>(), order: NetworkNode[] = [];
  function visit(id: string) {
    if (visiting.has(id)) { problem("Geschlossener Ring / Zyklus gefunden. Das Modell benötigt ein radiales Netz.", id, undefined, "cycle"); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const edge of outgoing.get(id) ?? []) visit(edge.to);
    visiting.delete(id); visited.add(id); const node = nodeById.get(id); if (node) order.push(node);
  }
  if (sources[0]) visit(sources[0].id);
  for (const node of document.nodes) if (!visited.has(node.id)) problem("Element ist nicht mit der Einspeisung verbunden.", node.id, undefined, "disconnected");
  if (!document.nodes.some(node => node.kind === "load")) problem("Mindestens ein Verbraucher ist erforderlich.", undefined, undefined, "no_load");
  for (const node of document.nodes) if (node.kind === "load" && (outgoing.get(node.id)?.length ?? 0)) problem("Ein Verbraucher ist ein Endpunkt und kann keine weitere Verteilung speisen.", node.id, undefined, "load_not_endpoint");
  if (issues.some(issue => issue.tone === "error")) return invalid(issues);

  const source = sources[0];
  let activeInputContext: { nodeId?: string; edgeId?: string } = { nodeId: source.id };
  const invalidAtCurrentObject = (error: unknown) => invalid([{
    tone: "error", text: error instanceof Error ? error.message : "Ungültige Netzparameter. Die markierte Eingabe als endliche Zahl im zulässigen Bereich eintragen.", ...activeInputContext,
    code: error instanceof NetworkInputError ? "input" : "arithmetic",
    field: error instanceof NetworkInputError ? error.field : "",
    data: error instanceof NetworkInputError ? { required: error.required } : undefined,
  }]);
  let ninProgram = false, ikMinVoltage = .95 * 230;
  let system: string, nominalVoltage: number, cMax: number, voltageTolerance: string, maxCurrent: number, budget: number, sourceZ: Complex, sourceLoop: number | null;
  const demands = new Map<string, Demand>(), wires = new Map<string, Wire>();
  const rated = new Map<string, number>(), device = new Map<string, string>(), transformer = new Map<string, { x: number; kva: number; rated: number }>();
  try {
    system = choice(source.values, "phases", ["1", "3"], "Netzsystem");
    nominalVoltage = read(source.values, "voltage", "Bemessungsspannung", 1000);
    if (nominalVoltage !== (system === "3" ? 400 : 230)) throw new NetworkInputError("voltage", "Das NS-Modell verwendet 400 V für 3~ beziehungsweise 230 V für 1~.", system === "3" ? "400 V für das ausgewählte Drehstromnetz." : "230 V für das ausgewählte Einphasennetz.");
    let voltageFactors: ReturnType<typeof shortCircuitVoltageFactors>;
    try { voltageFactors = shortCircuitVoltageFactors(source.values.voltageTolerance); }
    catch (error) { throw new NetworkInputError("voltageTolerance", error instanceof Error ? error.message : "Ungültige Spannungstoleranz.", "Eine vorhandene Spannungstoleranz wählen."); }
    cMax = voltageFactors.cMax; voltageTolerance = voltageFactors.label;
    if (voltageFactors.legacy) issues.push({ tone: "warning", nodeId: source.id, text: LEGACY_VOLTAGE_WARNING, code: "legacy_voltage", field: "voltageTolerance" });
    // Saved networks without a basis keep the conservative IEC calculation.
    if (source.values.calcBasis !== undefined) ninProgram = networkDropIgnoresEdgeTemperature(choice(source.values, "calcBasis", ["iec", "nin-program"], "Rechenbasis"));
    if (ninProgram) ikMinVoltage = read(source.values, "operatingVoltage", "Betriebsspannung Ub", 1000) / Math.sqrt(3);
    maxCurrent = read(source.values, "maxCurrent", "Anschlussstrom", 10000);
    budget = read(source.values, "limit", "Gesamtes Spannungsfallbudget", 20);
    const mode = choice(source.values, "sourceMode", ["impedance", "ik", "ideal"], "Quellenmodell");
    sourceZ = mode === "ideal" ? c() : mode === "ik" ? c(0, cMax * nominalVoltage / ((system === "3" ? Math.sqrt(3) : 1) * read(source.values, "ik", "Maximaler Ik der Einspeisung", 1000) * 1000)) : c(read(source.values, "r", "Quellwiderstand", 1000, true), read(source.values, "x", "Quellreaktanz", 1000, true));
    sourceLoop = choice(source.values, "loopKnown", ["yes", "no"], "L–PE-Quelldaten") === "yes" ? read(source.values, "loopImpedance", "L–PE-Quellenimpedanz", 1000, true) : null;
    for (const node of document.nodes) {
      activeInputContext = { nodeId: node.id };
      if (node.kind === "transformer") {
        if (system === "1") throw new NetworkInputError("kva", "Der Transformator ist als symmetrisches 3~-NS-Ersatzmodell ausgeführt.", "Den Transformator nur im dreiphasigen NS-Ersatznetz einsetzen; Netzstruktur prüfen.");
        const kva = read(node.values, "kva", "Trafo-Nennleistung", 100000), uk = read(node.values, "uk", "Trafo-Kurzschlussspannung", 100);
        transformer.set(node.id, { x: computedPositive(uk / 100 * nominalVoltage ** 2 / (kva * 1000), "Trafo-Reaktanz"), kva, rated: computedPositive(kva * 1000 / (Math.sqrt(3) * nominalVoltage), "Trafo-Nennstrom") });
      }
      if (node.kind === "distribution") {
        choice(node.values, "device", ["uv", "busbar", "meter", "hak"], "Verteilungselement");
        rated.set(node.id, read(node.values, "rated", "Verteilungs-Nennstrom", 10000));
      }
      if (node.kind === "protection") {
        const type = choice(node.values, "device", ["LS", "NH", "MCCB", "RCD", "RCBO", "MOTOR", "SWITCH"], "Schutzorgan"); device.set(node.id, type);
        rated.set(node.id, read(node.values, "rated", "Schutzorgan-Nennstrom", 10000));
        if (["LS", "RCBO"].includes(type)) choice(node.values, "curve", ["B", "C", "D", "K", "Z"], "Charakteristik");
        if (["LS", "RCBO", "MCCB"].includes(type)) read(node.values, "icn", "Ausschaltvermögen", 1000);
        if (["LS", "RCBO", "MCCB", "NH", "MOTOR"].includes(type)) read(node.values, "i2factor", "Prüfstromfaktor", 10);
        if (["RCD", "RCBO"].includes(type)) {
          read(node.values, "tripCurrent", "Bemessungsdifferenzstrom", 10000); choice(node.values, "timeDelayed", ["yes", "no"], "RCD-Verzögerung");
          const rcdType = node.values.rcdType ?? "offen";
          if (!["offen", "AC", "A", "F", "B", "A-6mA"].includes(rcdType)) throw new NetworkInputError("rcdType", "RCD-Typ: gültigen Listenwert wählen.", "Nicht belegt, AC, A, F, B oder A/F mit 6 mA DC wählen.");
        }
      }
    }
    for (const edge of document.edges) {
      activeInputContext = { edgeId: edge.id };
      if (!edge.values || typeof edge.values !== "object") throw new Error("Leitungseigenschaften fehlen.");
      const v = edge.values, length = read(v, "length", "Leitungslänge", 100000), material = choice(v, "material", ["cu", "al"], "Leitermaterial") as "cu" | "al";
      const area = read(v, "area", "Aussenleiterquerschnitt", 240), parallel = whole(v, "parallel", "Parallele Leiter", 100), temperature = read(v, "temperature", "Leitertemperatur", 150, true);
      const peArea = v.peArea === "same" ? area : read(v, "peArea", "PE-Querschnitt", 240), neutralArea = v.neutralArea === "same" ? area : read(v, "neutralArea", "Neutralleiterquerschnitt", 240);
      const table = RESISTANCE_20[material], alpha = material === "cu" ? .00393 : .00403;
      for (const [key, section] of [["area", area], ["peArea", peArea], ["neutralArea", neutralArea]] as const) if (!Object.hasOwn(table, String(section)) || !Object.hasOwn(REACTANCE, String(section))) throw new NetworkInputError(key, `${material === "al" ? "Aluminium ab 10 mm²" : "Kupfer"}: belegten Querschnitt mit R′ und X′ wählen.`, `Einen belegten ${material === "al" ? "Aluminiumquerschnitt ab 10 mm²" : "Kupferquerschnitt"} aus der Liste wählen.`);
      const path = (section: number, temp: number) => c(computedPositive(table[String(section)] * (1 + alpha * (temp - 20)) * length / (1000 * parallel), "Leiterwiderstand"), computedPositive(REACTANCE[String(section)] * length / (1000 * parallel), "Leiterreaktanz"));
      const zCold = system === "1" ? add(path(area, 20), path(neutralArea, 20)) : path(area, 20), zWarm = path(area, 80), zDrop = path(area, ninProgram ? 20 : temperature), zNeutral = path(neutralArea, ninProgram ? 20 : temperature), zLoop = add(zWarm, path(peArea, 80));
      const iz = choice(v, "izMode", ["manual", "open"], "Iz-Grundlage") === "manual" ? read(v, "iz", "Dokumentiertes Iz je Kreis", 100000) * parallel : null;
      const neutralIz = iz === null ? null : neutralArea === area ? iz : read(v, "neutralIz", "Dokumentiertes Iz je Neutralleiterkreis", 100000) * parallel;
      wires.set(edge.id, { edge, zCold, zWarm, zDrop, zNeutral, zLoop, area, neutralArea, parallel, length, iz, neutralIz, temperature: ninProgram ? 20 : temperature });
    }
    for (const node of order) {
      activeInputContext = { nodeId: node.id };
      let currents = zero(), powerKW = 0, singlePhase = false;
      const connectedPhases: [boolean, boolean, boolean] = [false, false, false];
      if (node.kind === "load") {
        choice(node.values, "device", ["general", "motor", "socket", "light", "heater", "fan", "cooker", "ev"], "Verbrauchertyp");
        const power = read(node.values, "power", "Verbraucher-Wirkleistung", 1e6), cos = read(node.values, "cosPhi", "Leistungsfaktor", 1), factor = read(node.values, "diversity", "Gleichzeitigkeitsanteil", 1, true);
        const connection = choice(node.values, "phases", ["1", "3"], "Verbraucheranschluss");
        if (system === "1" && connection === "3") throw new NetworkInputError("phases", "Ein 3~-Verbraucher kann nicht aus einem 1~-Netz gespeist werden.", "Einphasigen Verbraucheranschluss wählen oder die tatsächliche dreiphasige Einspeisung modellieren.");
        powerKW = factor === 0 ? 0 : computedPositive(power * factor, "Verbraucherleistung");
        const phi = Math.acos(cos), perPhaseCurrent = connection === "3" ? powerKW * 1000 / (Math.sqrt(3) * nominalVoltage * cos) : powerKW * 1000 / (230 * cos);
        const base = c(powerKW === 0 ? 0 : computedPositive(perPhaseCurrent * cos, "Wirkstromanteil"), -perPhaseCurrent * Math.sin(phi));
        if (connection === "1") {
          const phase = ["L1", "L2", "L3"].indexOf(choice(node.values, "phase", ["L1", "L2", "L3"], "Aussenleiter"));
          if (system === "1" && phase !== 0) throw new NetworkInputError("phase", "Im 1~-Netz ist nur L1 verfügbar.", "Im ausgewählten Einphasennetz L1 wählen.");
          currents[phase] = mul(base, rotate(phase)); singlePhase = true; connectedPhases[phase] = true;
        } else { currents = [0, 1, 2].map(phase => mul(base, rotate(phase))) as Triple; connectedPhases.fill(true); }
      }
      for (const edge of outgoing.get(node.id) ?? []) {
        const child = demands.get(edge.to)!;
        currents = currents.map((value, index) => add(value, child.currents[index])) as Triple;
        powerKW = computedFinite(powerKW + child.powerKW, "Verbraucherleistung"); singlePhase ||= child.singlePhase;
        for (let phase = 0; phase < 3; phase++) connectedPhases[phase] ||= child.connectedPhases[phase];
      }
      if (currents.some(value => !Number.isFinite(value.re) || !Number.isFinite(value.im))) throw new Error("Netzstrom ausserhalb des berechenbaren Bereichs. Leistungsfaktor und Leistung prüfen.");
      currents.forEach(magnitude);
      demands.set(node.id, { currents, powerKW, singlePhase, connectedPhases });
    }
  } catch (error) { return invalidAtCurrentObject(error); }

  const sourceDemand = demands.get(source.id)!;
  const nodes: NetworkNodeResult[] = [], edges: NetworkEdgeResult[] = [];
  const nodeResultById = new Map<string, NetworkNodeResult>();
  function record(tone: NetworkTone, text: string, nodeId?: string, edgeId?: string, details: Partial<NetworkIssue> = {}) {
    issues.push({ tone, text, nodeId, edgeId, ...details });
    if (nodeId && nodeResultById.has(nodeId)) { const result = nodeResultById.get(nodeId)!; result.tone = worst(result.tone, tone); result.checks.push(text); }
  }
  if (sourceDemand.powerKW === 0) record("warning", "Der Gleichzeitigkeitsansatz ergibt keine aktive Last; keine Anlagenfreigabe aus einem Leerergebnis.", source.id, undefined, { code: "no_active_load", field: "", data: { actual: 0 } });
  const supplyCurrent = Math.max(...sourceDemand.currents.map(magnitude));
  if (supplyCurrent > maxCurrent! + tol) record("error", `Anschlussstrom überschritten: ${fmt(supplyCurrent)} A > ${fmt(maxCurrent!)} A.`, source.id, undefined, { code: "source_current", field: "maxCurrent", data: { actual: supplyCurrent, limit: maxCurrent! } });
  const nominalPhase = system! === "3" ? nominalVoltage! / Math.sqrt(3) : nominalVoltage!;
  const projection = (value: Complex, phase: number) => mul(value, c(Math.cos(phases[phase]), -Math.sin(phases[phase]))).re;
  function walk(node: NetworkNode, inherited: Path) {
    activeInputContext = { nodeId: node.id };
    const demand = demands.get(node.id)!, current = Math.max(...demand.currents.map(magnitude));
    const result: NetworkNodeResult = { id: node.id, powerKW: demand.powerKW, current, tone: "ok", checks: [] };
    nodes.push(result); nodeResultById.set(node.id, result);
    const local: Path = { ...inherited, drop: inherited.drop.map(value => c(value.re, value.im)) as Triple };
    const trafo = transformer.get(node.id);
    if (trafo) {
      local.cold = add(local.cold, c(0, trafo.x)); local.transformerX = computedFinite(local.transformerX + trafo.x, "Aufsummierte Trafo-Reaktanz");
      local.drop = local.drop.map((value, phase) => add(value, mul(c(0, trafo.x), demand.currents[phase]))) as Triple;
      if (current > trafo.rated + tol) record("error", `Trafo-Nennstrom überschritten: ${fmt(current)} A > ${fmt(trafo.rated)} A.`, node.id, undefined, { code: "transformer_current", field: "kva", data: { actual: current, limit: trafo.rated, requiredKva: current * (Math.sqrt(3) * nominalVoltage! / 1000) } });
      if (demand.singlePhase) record("warning", "Unsymmetrische Trafolast: Nullsystem und Schaltgruppe sind im NS-Ersatzmodell nicht geprüft.", node.id, undefined, { code: "transformer_unbalanced", field: "" });
    }
    if (rated.has(node.id) && current > rated.get(node.id)! + tol) record("error", `Gerätenennstrom überschritten: ${fmt(current)} A > ${fmt(rated.get(node.id)!)} A.`, node.id, undefined, { code: "device_current", field: "rated", data: { actual: current, limit: rated.get(node.id)! } });
    const type = device.get(node.id);
    if (type) {
      if (["LS", "RCBO", "MCCB"].includes(type)) {
        const icn = read(node.values, "icn", "Ausschaltvermögen", 1000), z = magnitude(local.cold), prospective = shortCircuitKA(nominalVoltage!, system === "3" ? Math.sqrt(3) : 1, z, cMax!);
        if (prospective === null) record("warning", "Ausschaltvermögen nicht geprüft: keine endliche Quellenimpedanz am Gerät.", node.id, undefined, { code: "icn_open", field: "icn", relatedNodeId: source.id });
        else if (icn < prospective - tol) record("error", `Ausschaltvermögen am Gerät zu klein: ${fmt(icn)} kA < ${fmt(prospective)} kA.`, node.id, undefined, { code: "icn", field: "icn", data: { actual: icn, required: prospective } });
        else result.checks.push(`Icn ${fmt(icn)} kA ≥ Ik,max ${fmt(prospective)} kA am Einbauort.`);
      }
      if (["RCD", "RCBO"].includes(type)) {
        const rcdType = node.values.rcdType ?? "offen";
        const typeNote = rcdType === "offen" ? "" : ` Typ ${rcdType} ist erfasst und nicht freigegeben.`;
        record("warning", `RCD ${node.values.tripCurrent} mA: Abschaltzeit, Erdungsbedingungen und Zeitselektivität bleiben ungeprüft.${typeNote}`, node.id, undefined, { code: "rcd_proof", field: "tripCurrent", data: { actual: node.values.tripCurrent } });
        if (rcdType === "B" || rcdType === "A-6mA") local.rcdDc = rcdType;
      }
      if (["NH", "MCCB", "MOTOR"].includes(type)) record("warning", "Gerätekennlinie und Abschaltzeit sind ohne konkrete Herstellerdaten nicht nachgewiesen.", node.id, undefined, { code: "manufacturer_proof", field: "device" });
      if (["K", "Z"].includes(node.values.curve) && ["LS", "RCBO"].includes(type)) record("warning", "K-/Z-Band ist eine Herstellerannahme und am Gerät zu belegen.", node.id, undefined, { code: "curve_proof", field: "curve" });
      if (!["RCD", "SWITCH"].includes(type)) {
        if (local.protector) record("warning", "Mehrstufiger Schutz: Selektivität / Back-up benötigen passende Herstellerdaten.", node.id, undefined, { code: "coordination_proof", field: "device", relatedNodeId: local.protector.id });
        local.protector = node;
      }
    }
    if (node.kind === "load" && node.values.device === "ev") record("warning", local.rcdDc ? `Ladepunkt: RCD-Typ ${local.rcdDc} ist im Pfad erfasst. Abschaltzeit und DC-Schutz bleiben ohne Freigabe.` : "Ladepunkt: kein belegter DC-Fehlerstromschutz (Typ B oder Typ A/F mit 6 mA) im Pfad. Keine Freigabe.", node.id, undefined, { code: "rcd_dc_open", field: "device" });
    for (const edge of outgoing.get(node.id) ?? []) {
      activeInputContext = { edgeId: edge.id };
      const wire = wires.get(edge.id)!, downstream = demands.get(edge.to)!, currents = downstream.currents.map(magnitude) as [number, number, number];
      const amperes = Math.max(...currents), neutral = downstream.currents.reduce(add, c());
      const edgeDrops = downstream.currents.map(value => add(mul(wire.zDrop, value), mul(wire.zNeutral, neutral))) as Triple;
      const cumulative = local.drop.map((value, phase) => add(value, edgeDrops[phase])) as Triple;
      // Electrical connection remains present when a consumer is switched off.
      // Its terminal voltage therefore retains the drop caused by other branches.
      const connected = downstream.connectedPhases.some(Boolean) ? downstream.connectedPhases : [true, system === "3", system === "3"];
      const connectedPhases = connected.flatMap((isConnected, phase) => isConnected ? [phase] : []);
      const reference = downstream.singlePhase ? 230 : nominalPhase;
      const volts = Math.max(...connectedPhases.map(phase => projection(edgeDrops[phase], phase)), 0);
      const totalVolts = Math.max(...connectedPhases.map(phase => projection(cumulative[phase], phase)), 0);
      const percent = volts / reference * 100, totalPercent = totalVolts / reference * 100;
      const minProjectedVoltage = Math.min(...connectedPhases.map(phase => projection(cumulative[phase], phase)));
      const cold = add(local.cold, wire.zCold), loopWires = add(local.loopWires, wire.zLoop), zCold = magnitude(cold);
      const ikMax = shortCircuitKA(nominalVoltage!, system === "3" ? Math.sqrt(3) : 1, zCold, cMax!);
      const loopZ = sourceLoop! === null ? null : computedFinite(sourceLoop! + local.transformerX + magnitude(loopWires), "L–PE-Schleifenimpedanz");
      const ikMin = loopZ !== null && loopZ > 0 ? computedFinite(ikMinVoltage / loopZ / 1000, "Ik,min-Modell") : null;
      let tone: NetworkTone = "ok"; const checks: string[] = [];
      const check = (severity: NetworkTone, text: string, code: string, field = "", data: Record<string, string | number> = {}, relatedNodeId = local.protector?.id) => {
        tone = worst(tone, severity); checks.push(text); record(severity, text, edge.to, edge.id, { code, field, data, relatedNodeId });
      };
      if (!local.protector) check("warning", "Für diesen Abschnitt ist kein Überstromschutzorgan im vorgelagerten Netz modelliert.", "protection_missing", "", { from: edge.from });
      if (downstream.powerKW === 0) check("warning", "Dieser Zweig hat keine aktive Verbraucherlast; der Betriebsstrom ist 0 A.", "idle_branch", "", { actual: 0 });
      if (minProjectedVoltage < -tol) check("warning", "Unsymmetrische Last erzeugt im Modell eine Neutralpunktverschiebung mit Spannungsanhebung auf einem Aussenleiter; Spannungsgrenzen gesondert prüfen.", "neutral_shift", "neutralArea");
      if (totalPercent > budget! + tol) check("error", `Spannungsfall im gesamten Pfad ${fmt(totalPercent)} % > ${fmt(budget!)} %.` , "drop_budget", "area", { actual: totalPercent, limit: budget! }, source.id);
      else if (totalPercent >= .9 * budget!) check("warning", `Gesamter Spannungsfall nahe Budget: ${fmt(totalPercent)} % / ${fmt(budget!)} %.` , "drop_near", "area", { actual: totalPercent, limit: budget! }, source.id);
      else checks.push(`Spannungsfall bis hier ${fmt(totalPercent)} % ≤ ${fmt(budget!)} %.`);
      if (totalPercent >= 100) check("error", "Spannungsfall erreicht die Bemessungsspannung; lineares Lastmodell ausserhalb des gültigen Bereichs.", "drop_model_limit", "length", { actual: totalPercent });
      if (wire.iz === null) check("warning", "Strombelastbarkeit Iz ist nicht dokumentiert; Leitungsüberlastschutz bleibt offen.", "iz_open", "izMode");
      else {
        if (amperes > wire.iz + tol) check("error", `Betriebsstrom ${fmt(amperes)} A > dokumentiertes Iz ${fmt(wire.iz)} A.`, "ib_iz", "iz", { actual: amperes, limit: wire.iz, parallel: wire.parallel });
        if (wire.neutralIz !== null && magnitude(neutral) > wire.neutralIz + tol) check("error", `Neutralleiterstrom ${fmt(magnitude(neutral))} A > vorgegebenes N-Iz ${fmt(wire.neutralIz)} A; Neutralleiter separat dimensionieren.`, "neutral_iz", wire.neutralArea === wire.area ? "iz" : "neutralIz", { actual: magnitude(neutral), limit: wire.neutralIz, parallel: wire.parallel });
        const protector = local.protector;
        if (protector) {
          const inA = rated.get(protector.id)!, factor = read(protector.values, "i2factor", "Prüfstromfaktor", 10);
          const protectionData = { actual: amperes, iz: wire.iz, rated: inA, factor, parallel: wire.parallel };
          if (inA > wire.iz + tol) check("error", `Schutznennstrom ${fmt(inA)} A > Iz ${fmt(wire.iz)} A.`, "in_iz", "iz", protectionData);
          if (factor * inA > 1.45 * wire.iz + tol) check("error", `I₂ ${fmt(factor * inA)} A > 1.45 × Iz ${fmt(1.45 * wire.iz)} A.`, "i2_iz", "iz", protectionData);
          if (amperes > inA + tol) check("error", `Betriebsstrom ${fmt(amperes)} A > Schutznennstrom ${fmt(inA)} A.`, "ib_in", "rated", protectionData);
        }
      }
      const thermalK = (edge.values.thermalK ?? "").trim(), thermalSeconds = (edge.values.thermalSeconds ?? "").trim();
      if (thermalK || thermalSeconds) {
        if (!thermalK || !thermalSeconds) check("warning", "Kurzschlussfestigkeit: k-Faktor und Einwirkzeit gemeinsam belegen oder beide leer lassen.", "cable_thermal_incomplete", thermalK ? "thermalSeconds" : "thermalK");
        else if (ikMax === null) check("warning", "Kurzschlussfestigkeit offen: Ik,max am Abschnitt ist nicht bestimmt.", "cable_thermal_open", "thermalK");
        else {
          const kFactor = read(edge.values, "thermalK", "Dokumentierter k-Faktor", 1000), seconds = read(edge.values, "thermalSeconds", "Dokumentierte Einwirkzeit", 10000);
          const current = ikMax * 1000 / wire.parallel, capacity = kFactor * kFactor * wire.area * wire.area, stress = current * current * seconds;
          if (capacity + tol < stress) check("error", `k²·S² ${fmt(capacity)} < I²·t ${fmt(stress)} für den Aussenleiter. N und PE sind damit nicht nachgewiesen.`, "cable_thermal", "thermalK", { capacity, stress, current, area: wire.area, seconds });
          else checks.push(`k²·S² ${fmt(capacity)} ≥ I²·t ${fmt(stress)} für den Aussenleiter. N und PE sind damit nicht nachgewiesen.`);
        }
      }
      if (ikMin === null) check("warning", "Ik,min-Modell offen: dokumentierte L–PE-Quellenimpedanz fehlt oder ist unbestimmt.", "loop_open", "loopKnown", {}, source.id);
      else if (local.protector && ["LS", "RCBO"].includes(device.get(local.protector.id)!)) {
        const high: Record<string, number> = { B: 5, C: 10, D: 20, K: 14, Z: 3 }, upper = high[local.protector.values.curve] * rated.get(local.protector.id)!;
        if (ikMin * 1000 < upper - tol) check("error", `Oberer Magnetauslöser ${fmt(upper)} A wird vom Ik,min-Modell ${fmt(ikMin * 1000)} A nicht erreicht.`, "magnetic", "curve", { actual: ikMin * 1000, required: upper, loop: loopZ!, maxLoop: .95 * 230 / upper, source: source.id });
        else checks.push(`Ik,min-Modell ${fmt(ikMin * 1000)} A ≥ oberer Magnetauslöser ${fmt(upper)} A; verbindliche Abschaltzeit separat prüfen.`);
      }
      const formula = `I_L1/L2/L3 = ${currents.map(value => fmt(value)).join(" / ")} A; I_N = ${fmt(magnitude(neutral))} A. Z_Leiter,${fmt(wire.temperature, 0)}°C = ${fmt(wire.zDrop.re, 6)} + j${fmt(wire.zDrop.im, 6)} Ω. ΔU_L–N = Projektion(Z_L · I_L + Z_N · ΣI_L) = ${fmt(volts)} V = ${fmt(percent)} %. Pfad bis hier: ${fmt(totalPercent)} % (Budget ${fmt(budget!)} %). ${ikMax === null ? "Ik,max nicht bestimmt." : `Ik,max,Modell = ${cMax!.toFixed(2)} · U / (f · |Z_Quelle + ΣZ_Leitung + ΣZ_Trafo|) = ${fmt(ikMax)} kA.`} ${ikMin === null ? "Ik,min mangels L–PE-Quelldaten nicht bestimmt." : `Ik,min,Modell = ${ninProgram ? `Ub/√3 = ${fmt(ikMinVoltage)} V` : "0.95 × 230"} / (${fmt(sourceLoop!, 6)} + ${fmt(local.transformerX, 6)} + ${fmt(magnitude(loopWires), 6)}) / 1000 = ${fmt(ikMin)} kA.`}`;
      edges.push({ id: edge.id, currents, current: amperes, neutralCurrent: magnitude(neutral) <= amperes * 1e-12 ? 0 : magnitude(neutral), powerKW: downstream.powerKW, dropVolts: volts, dropPercent: percent, cumulativeDropPercent: totalPercent, iz: wire.iz, ikMaxKA: ikMax, ikMinKA: ikMin, tone, checks, formula });
      walk(nodeById.get(edge.to)!, { ...local, cold, loopWires, drop: cumulative });
    }
  }
  try { walk(source, { cold: sourceZ!, loopWires: c(), transformerX: 0, drop: zero() }); }
  catch (error) { return invalidAtCurrentObject(error); }
  // Source-level issues precede its result object; merge them once the traversal exists.
  for (const issue of issues) if (issue.nodeId && nodeResultById.has(issue.nodeId)) {
    const result = nodeResultById.get(issue.nodeId)!; result.tone = worst(result.tone, issue.tone); if (!result.checks.includes(issue.text)) result.checks.push(issue.text);
  }
  const tone = issues.reduce<NetworkTone>((value, issue) => worst(value, issue.tone), "ok");
  const maxDropPercent = Math.max(0, ...edges.map(edge => edge.cumulativeDropPercent));
  return {
    valid: true, tone,
    status: tone === "error" ? "Mindestens eine eingegebene Modellbedingung ist verletzt." : tone === "warning" ? "Modell berechnet; offene Nachweise und Hinweise beachten." : "Die geprüften Modellbedingungen sind eingehalten; keine vollständige NIN-Freigabe.",
    issues, nodes, edges, totalPowerKW: sourceDemand.powerKW, maxCurrent: supplyCurrent, maxDropPercent,
    formula: `P_gesamt = Σ(P_Verbraucher × eigener Anteil) = ${fmt(sourceDemand.powerKW)} kW. Ströme werden je Aussenleiter als komplexe Grössen addiert; stärkster Aussenleiter ${fmt(supplyCurrent)} A. Grösster aufsummierter Spannungsfall ${fmt(maxDropPercent)} % / ${fmt(budget!)} %.`,
    assumptions: [
      "Radiales NS-TN-Ersatznetz mit genau einer Einspeisung. Keine Ringe, Mehrfacheinspeisung oder Spannungsumsetzung zwischen mehreren Ebenen.",
      "3~ bei 400 V, 1~ bei 230 V; induktive sinusförmige Lasten mit Stromansatz an der Bemessungsspannung. Leistungsangaben sind Verbraucherlasten; Leitungsverluste werden nicht auf die Betriebsströme zurückgeführt. Keine iterative Lastflussrechnung oder Oberschwingungen.",
      "Spannungsfall als Längsprojektion der komplexen Leiter- und Neutralleiterspannung; sämtliche vorgeschalteten Abschnitte werden mitgeführt. Die Spannung am Einspeisepunkt ist vorgegeben; die vorgelagerte Quellenimpedanz wird nur für Kurzschlusswerte verwendet.",
      "SN-EN-60228-bezogene veröffentlichte R′₂₀-Werte; Cu α = 0.00393/K, Al α = 0.00403/K. X′ ist ein Richtwert. Aussenleiter, N und PE haben innerhalb einer Leitung dasselbe Material. Parallele Leiter werden als identisch und gleichmässig belastet betrachtet.",
      `Ik,max mit kaltem Leiter und cmax = ${cMax!.toFixed(2)} für ${voltageTolerance!}. Ein eingegebener maximaler Quellenstrom wird mit demselben Faktor in die Quellenimpedanz zurückgerechnet, ohne zweiten Aufschlag. Ik,min-Modell mit 80 °C, ${ninProgram ? `Rechenbasis «Wie NIN-Programm»: Ub/√3 = ${fmt(ikMinVoltage)} V ohne cmin, Spannungsfall bei 20 °C` : "cmin = 0.95 × 230 V (vorsichtige Basis)"} und vorgegebener L–PE-Quelle. Trafo als reine NS-bezogene Reaktanz; keine Nullsystem-/Schaltgruppenstudie, keine garantierte Schranke oder vollständige IEC-60909-Studie.`,
      "Iz, Prüfstromfaktoren und Gerätewerte sind dokumentierte Projekteingaben. Herstellerkennlinien, verbindliche Abschaltzeiten, Selektivität, RCD-Erdungsbedingungen und vollständige NIN-Anwendbarkeit bleiben separat zu prüfen.",
      ...(ninProgram ? ["Ik,min addiert die Beträge von Quelle und warmer Schleife. In acht gedruckten Vergleichsfällen liegt das bis 6.3 % unter dem gedruckten Wert. Die Addition bleibt unverändert."] : []),
    ],
  };
}


function shortCircuitKA(voltage: number, systemFactor: number, impedance: number, cMax: number): number | null {
  if (impedance === 0) return null;
  const denominator = computedPositive(systemFactor * impedance, "Kurzschlussimpedanz");
  return computedFinite(cMax * voltage / denominator / 1000, "Ik,max-Modell");
}
function checkResultNumbers(value: unknown): void {
  if (typeof value === "number") computedFinite(value);
  else if (value !== null && typeof value === "object") Object.values(value).forEach(checkResultNumbers);
}

/** Invalid arithmetic never escapes as Infinity, NaN or JSON-null replacement values. */
export function calculateNetwork(document: NetworkDocument): NetworkResult {
  try {
    const result = calculateNetworkModel(document);
    checkResultNumbers(result);
    return result;
  } catch (error) {
    return invalid([{ tone: "error", code: "arithmetic", text: error instanceof Error ? error.message : "Netzberechnung ausserhalb des berechenbaren Zahlenbereichs." }]);
  }
}
