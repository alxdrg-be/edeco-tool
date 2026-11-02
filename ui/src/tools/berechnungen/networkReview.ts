import type { CalculationPDFReport } from "./pdfExport.ts";
import type { Field } from "./workbench/types.ts";
import type { NetworkDocument, NetworkEdge, NetworkNode, NetworkResult } from "./networkTypes.ts";
import { calculateNetwork, NETWORK_EDGE_FIELDS, NETWORK_NODE_FIELDS, NETWORK_NODE_LABELS } from "./networkModel.ts";
import { calculationFilename } from "./pdfDocument.ts";

/** Bump when the mathematical model or its checked conditions change. */
export const NETWORK_CHECK_REVISION = "edeco.network.check.v1";
export interface NetworkReview {
  readonly key: string;
  readonly revision: string;
  readonly checkedAt: string;
  /** The complete document/result are deep-frozen copies, never editor references. */
  readonly document: NetworkDocument;
  readonly result: NetworkResult;
}
export interface NetworkReviewProject { id?: string; number: string; name: string }

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function canonical(value: unknown, ancestors = new Set<object>()): unknown {
  if (typeof value === "number" && !Number.isFinite(value)) return { nonFiniteNumber: String(value) };
  if (value === undefined) return { undefinedValue: true };
  if (value === null || typeof value !== "object") return value;
  if (ancestors.has(value)) throw new Error("Das Netzprojekt enthält zyklische Daten und kann nicht geprüft werden.");
  ancestors.add(value);
  const result = Array.isArray(value) ? value.map(item => canonical(item, ancestors)) : Object.fromEntries(Object.keys(value).sort(compare).map(key => [key, canonical((value as Record<string, unknown>)[key], ancestors)]));
  ancestors.delete(value);
  return result;
}
const encoded = (value: unknown) => JSON.stringify(canonical(value));
function byIdThenContent(a: unknown, b: unknown) {
  const id = (value: unknown) => value !== null && typeof value === "object" && typeof (value as { id?: unknown }).id === "string" ? (value as { id: string }).id : "";
  return compare(id(a), id(b)) || compare(encoded(a), encoded(b));
}

/** All model inputs/topology/labels count; editor position and orientation do not. */
export function networkCalculationKey(document: NetworkDocument): string {
  const raw = document as unknown as Record<string, unknown>;
  if (raw === null || typeof raw !== "object") return encoded({ revision: NETWORK_CHECK_REVISION, document: raw });
  const physics = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "orientation"));
  if (Array.isArray(raw.nodes)) physics.nodes = raw.nodes.map(node => node !== null && typeof node === "object" ? Object.fromEntries(Object.entries(node).filter(([key]) => key !== "x" && key !== "y")) : node).sort(byIdThenContent);
  if (Array.isArray(raw.edges)) physics.edges = [...raw.edges].sort(byIdThenContent);
  return encoded({ revision: NETWORK_CHECK_REVISION, document: physics });
}
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
function validStamp(value: unknown): value is string { return typeof value === "string" && value.trim() !== "" && Number.isFinite(new Date(value).getTime()); }

export function checkNetwork(document: NetworkDocument, checkedAt = new Date().toISOString()): NetworkReview {
  if (!validStamp(checkedAt)) throw new Error("Ein gültiger Prüfzeitpunkt ist erforderlich.");
  const snapshot = structuredClone(document);
  const result = structuredClone(calculateNetwork(snapshot));
  return freezeDeep({ key: networkCalculationKey(snapshot), revision: NETWORK_CHECK_REVISION, checkedAt, document: snapshot, result });
}
export function reviewIsCurrent(review: NetworkReview | null | undefined, document: NetworkDocument): boolean {
  if (!review || review.revision !== NETWORK_CHECK_REVISION || !validStamp(review.checkedAt) || !review.result || typeof review.result.valid !== "boolean" || !Array.isArray(review.result.issues) || !Array.isArray(review.result.nodes) || !Array.isArray(review.result.edges) || !review.document) return false;
  if (review.result.valid && !isFiniteCalculatedResult(review.result)) return false;
  try { return review.key === networkCalculationKey(document) && review.key === networkCalculationKey(review.document); }
  catch { return false; }
}

const scope = [
  "Geprüft werden die im Bericht benannten Modellbedingungen und die eingegebenen Werte. Dieser Bericht ist keine vollständige NIN-Konformitätserklärung.",
  "Radiales NS-TN-Ersatznetz mit einer Einspeisung; 400 V dreiphasig / 230 V einphasig. Keine Ringe, Mehrfacheinspeisungen oder Berechnung mehrerer Spannungsebenen.",
  "Ströme an der Bemessungsspannung; keine iterative Lastflussrechnung. Strombelastbarkeiten und Gerätewerte sind dokumentierte Projekteingaben, keine automatisch bestätigten Normtabellen.",
  "Kurzschlusswerte sind kalte/warme Modellwerte unter den genannten Quell-/Leiterannahmen, keine garantierten Ik-min-/Ik-max-Schranken. Verbindliche Abschaltzeiten, RCD-Erdungsbedingungen und Selektivität sind separat zu prüfen.",
];
const formatted = (value: number, unit = "") => `${value.toLocaleString("de-CH", { maximumFractionDigits: 6 })}${unit ? ` ${unit}` : ""}`;
const entered = (value: unknown): string => typeof value === "string" ? value.trim() ? value : "Leer – nicht eingegeben" : value === undefined ? "Fehlt" : String(value);
const units: Record<string, string> = { maxCurrent: "A", rated: "A", icn: "kA", tripCurrent: "mA", area: "mm²", peArea: "mm²", neutralArea: "mm²" };
function fieldRows(context: string, values: Record<string, string>, fields: Field[]) {
  const keys = [...fields.filter(field => Object.hasOwn(values, field.key) || !field.visibleWhen?.some(rule => !rule.values.includes(values[rule.key]))).map(field => field.key), ...Object.keys(values).filter(key => !fields.some(field => field.key === key)).sort(compare)];
  return keys.map(key => {
    const field = fields.find(candidate => candidate.key === key), raw = values[key], option = field?.options?.find(item => item.value === raw);
    const inactive = field?.visibleWhen?.some(rule => !rule.values.includes(values[rule.key]));
    let value = option?.label ?? entered(raw);
    const unit = field?.unit || units[key];
    if (unit && /^\d+(?:[.,]\d+)?$/.test(value)) value += ` ${unit}`;
    return { label: `${context} · ${field?.label ?? key}${inactive ? " (in diesem Modus nicht verwendet)" : ""}`, value };
  });
}
function rowsForDocument(document: NetworkDocument | undefined) {
  const rows: { label: string; value: string }[] = [];
  if (!document) return rows;
  for (const node of Array.isArray(document.nodes) ? document.nodes : []) {
    if (!node || typeof node !== "object") { rows.push({ label: "Element", value: "Ungültige Elementstruktur" }); continue; }
    const context = `${typeof node.label === "string" && node.label.trim() ? node.label : "Element"} [${entered(node.id)}]`;
    rows.push({ label: `${context} · Typ`, value: Object.hasOwn(NETWORK_NODE_LABELS, node.kind) ? NETWORK_NODE_LABELS[node.kind] : entered(node.kind) });
    const values = node.values && typeof node.values === "object" ? node.values : {};
    rows.push(...fieldRows(context, values, Object.hasOwn(NETWORK_NODE_FIELDS, node.kind) ? NETWORK_NODE_FIELDS[node.kind] : []));
  }
  for (const edge of Array.isArray(document.edges) ? document.edges : []) {
    if (!edge || typeof edge !== "object") { rows.push({ label: "Leitung", value: "Ungültige Leitungsstruktur" }); continue; }
    const context = edgeLabel(edge, document.nodes);
    rows.push({ label: `${context} · Verbindung`, value: `${entered(edge.from)} → ${entered(edge.to)}` });
    const values = edge.values && typeof edge.values === "object" ? edge.values : {};
    rows.push(...fieldRows(context, values, NETWORK_EDGE_FIELDS));
  }
  return rows;
}
function nodeLabel(id: string, nodes: NetworkNode[] | undefined) { return (Array.isArray(nodes) ? nodes : []).find(node => node?.id === id)?.label || id; }
function edgeLabel(edge: NetworkEdge, nodes: NetworkNode[] | undefined) { return `${nodeLabel(edge.from, nodes)} → ${nodeLabel(edge.to, nodes)} [${edge.id}]`; }
function stampLabel(value: unknown) {
  return validStamp(value) ? new Intl.DateTimeFormat("de-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value)) : "Prüfzeitpunkt nicht dokumentiert";
}
function isFiniteCalculatedResult(result: NetworkResult | undefined): result is NetworkResult & { valid: true } {
  if (!result?.valid || !Array.isArray(result.nodes) || !Array.isArray(result.edges) || !Array.isArray(result.issues)) return false;
  const finite = (value: unknown): boolean => typeof value === "number" ? Number.isFinite(value) : value === null || typeof value !== "object" || Object.values(value).every(finite);
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value);
  const checks = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
  if (!result.nodes.every(node => node && typeof node.id === "string" && number(node.powerKW) && number(node.current) && checks(node.checks))) return false;
  if (!result.edges.every(edge => edge && typeof edge.id === "string" && Array.isArray(edge.currents) && edge.currents.length === 3 && edge.currents.every(number) && [edge.current, edge.neutralCurrent, edge.powerKW, edge.dropVolts, edge.dropPercent, edge.cumulativeDropPercent].every(number) && [edge.iz, edge.ikMaxKA, edge.ikMinKA].every(value => value === null || number(value)) && typeof edge.formula === "string" && checks(edge.checks))) return false;
  return typeof result.formula === "string" && typeof result.status === "string" && [result.totalPowerKW, result.maxCurrent, result.maxDropPercent].every(number) && finite(result);
}

/** Exports only the frozen check snapshot, including failed checks and their causes. */
export function networkReviewPDF(review: NetworkReview | null | undefined, project?: NetworkReviewProject | null): CalculationPDFReport {
  const document = review?.document, result = review?.result;
  const calculated = isFiniteCalculatedResult(result);
  const inputs = [
    { label: "Netzprojekt", value: entered(document?.name) },
    { label: "Prüfzeitpunkt · Europe/Zurich", value: stampLabel(review?.checkedAt) },
    { label: "Rechenmodell-Revision", value: entered(review?.revision) },
    ...(project ? [{ label: "Projekt", value: `${entered(project.number)} · ${entered(project.name)}` }, ...(project.id ? [{ label: "Projekt-ID", value: project.id }] : [])] : []),
    ...rowsForDocument(document),
  ];
  const status = !review ? "Nicht geprüft – es liegt kein Prüfstand vor." : !result ? "Nicht berechenbar – das gespeicherte Prüfergebnis fehlt." : !calculated ? "Nicht berechenbar – Eingaben, Verbindungen oder Prüfdaten sind ungültig." : result.tone === "error" ? "Modellprüfung: mindestens eine Bedingung ist verletzt." : result.tone === "warning" ? "Modellprüfung: Hinweise oder offene Nachweise vorhanden." : "Die aufgeführten Modellbedingungen sind eingehalten; vollständige NIN-Freigabe offen.";
  const results: { label: string; value: string | number }[] = [{ label: "Prüfergebnis", value: status }];
  const formulas: string[] = [];
  if (calculated) {
    results.push({ label: "Verbraucherleistung · ohne Rückführung der Leitungsverluste", value: formatted(result.totalPowerKW, "kW") }, { label: "Stärkster Aussenleiter an der Einspeisung", value: formatted(result.maxCurrent, "A") }, { label: "Grösster aufsummierter Spannungsfall", value: formatted(result.maxDropPercent, "%") });
    formulas.push(result.formula);
    for (const node of result.nodes) {
      const name = document ? nodeLabel(node.id, document.nodes) : node.id;
      results.push({ label: `${name} · Verbraucherleistung`, value: formatted(node.powerKW, "kW") }, { label: `${name} · stärkster Aussenleiter`, value: formatted(node.current, "A") });
      for (const check of node.checks) results.push({ label: `${name} · Bedingung / Hinweis`, value: check });
    }
    for (const edge of result.edges) {
      const inputEdge = document?.edges.find(candidate => candidate?.id === edge.id);
      const name = inputEdge && document ? edgeLabel(inputEdge, document.nodes) : edge.id;
      results.push({ label: `${name} · I L1 / L2 / L3`, value: `${edge.currents.map(current => formatted(current)).join(" / ")} A` }, { label: `${name} · Neutralleiterstrom`, value: formatted(edge.neutralCurrent, "A") }, { label: `${name} · Spannungsfall L–N im Abschnitt`, value: `${formatted(edge.dropVolts, "V")} / ${formatted(edge.dropPercent, "%")}` }, { label: `${name} · Spannungsfall gesamter Pfad`, value: formatted(edge.cumulativeDropPercent, "%") }, { label: `${name} · dokumentiertes Iz`, value: edge.iz === null ? "Offen – kein dokumentierter Wert" : formatted(edge.iz, "A") }, { label: `${name} · Ik,max-Modell`, value: edge.ikMaxKA === null ? "Offen – nicht bestimmt" : formatted(edge.ikMaxKA, "kA") }, { label: `${name} · Ik,min-Modell`, value: edge.ikMinKA === null ? "Offen – L–PE-Quelldaten fehlen oder sind unbestimmt" : formatted(edge.ikMinKA, "kA") });
      for (const check of edge.checks) results.push({ label: `${name} · Bedingung / Hinweis`, value: check });
      formulas.push(`${name}: ${edge.formula}`);
    }
  }
  for (const issue of Array.isArray(result?.issues) ? result.issues : []) {
    const context = issue.edgeId ? `Leitung ${issue.edgeId}` : issue.nodeId ? document ? nodeLabel(issue.nodeId, document.nodes) : issue.nodeId : "Netz";
    results.push({ label: `${context} · ${issue.tone === "error" ? "Fehler" : "Hinweis"}`, value: entered(issue.text) });
  }
  if (!calculated && result?.status) results.push({ label: "Berechnungsstatus", value: result.status });
  return {
    title: "Prüfbericht · Netzplaner",
    norm: "NIN 2025 · 5.2.5.1 / 4.3 · radiale NS-Modellprüfung · keine vollständige NIN-Freigabe",
    inputs, results, formula: calculated ? formulas.join("\n\n") : "Keine numerischen Ergebnisse: Für diesen Prüfstand konnte das Netz nicht berechnet werden.", status,
    notes: [...new Set([...scope, ...(calculated && Array.isArray(result.assumptions) ? result.assumptions : []), ...(review?.revision && review.revision !== NETWORK_CHECK_REVISION ? ["Historischer Prüfstand einer anderen Modellrevision; vor weiterer Verwendung neu prüfen."] : [])])],
    filename: calculationFilename("Prüfbericht Netzplaner", [document?.name ?? "Ungeprüft", validStamp(review?.checkedAt) ? review.checkedAt.slice(0, 10) : "ohne Prüfdatum"]),
  };
}
