import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, ChevronDown, CircleAlert, CircleHelp, CircleX, GitBranch, LayoutGrid, Link2, MousePointer2, Plus, Redo2, Trash2, Undo2, X } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import { useProjectHub } from "../projektzentrale/projectHubState";
import { downloadBlob } from "../planlieferung/DeliveryHistory";
import { ChoiceCards, LabShell, type Help } from "./LabUI";
import { useDialogFocus } from "../../useDialogFocus";
import { consumeRestore, type ArchiveProject } from "./ablage/api";
import { optionsWithProjectValue } from "./electricalOptions";
import { NETWORK_EDGE_FIELDS, NETWORK_NODE_FIELDS, NETWORK_NODE_LABELS, calculateNetwork, createDefaultNetwork, createNetworkEdge, createNetworkNode, networkDropIgnoresEdgeTemperature } from "./networkModel";
import type { Field } from "./workbench/types";
import type { NetworkDocument, NetworkEdgeResult, NetworkIssue } from "./networkTypes";
import { createFloorDistributionExample } from "./networkExamples";
import { checkNetwork, reviewIsCurrent, networkReviewPDF, type NetworkReview } from "./networkReview";
import { NETWORK_COORDINATE_LIMIT, arrangeNetwork, findAttachmentParent, nextNetworkPosition, networkOrientation, networkHistory, networkHistoryReducer, parseNetworkDocument } from "./networkEditor";
import NetworkCanvas, { NetworkSymbol, type NetworkSelection, type PaletteItem } from "./NetworkCanvas";
import DiagnosticDetails, { type DiagnosticTarget } from "./DiagnosticDetails";
import { buildNetworkDiagnostics, networkDiagnosticId, type NetworkDiagnostic } from "./networkDiagnostics";
import { buildNetworkCheckpoints, summarizeNetworkCheckpoints, type NetworkCheckpoint } from "./networkCheckpoints";
import NetworkVariantPanel from "./NetworkVariantPanel";
import { applyNetworkVariant, type NetworkVariantPreview } from "./networkVariants";
import "./network-planner.css";
import "./network-checkpoints.css";

const NORM = "NIN 2025 · 5.2.3 / 5.2.5.1 / 4.3 · radiale Niederspannungs-Vorprüfung";
const format = (value: number | null, unit = "", digits = 2) => value === null || !Number.isFinite(value) ? "nicht ermittelt" : `${value.toLocaleString("de-CH", { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const exampleNetwork = () => ({ ...arrangeNetwork(createDefaultNetwork(), "horizontal"), name: "Beispielnetz · radial" });
const palette: { label: string; items: PaletteItem[] }[] = [
  { label: "Einspeisung", items: [{ kind: "source", label: "Einspeisung NS" }, { kind: "transformer", label: "Transformator" }, { kind: "distribution", device: "hak", label: "Hausanschluss HAK" }] },
  { label: "Schutz und Schalten", items: [{ kind: "protection", device: "NH", label: "NH-Sicherung" }, { kind: "protection", device: "LS", label: "LS-Schalter" }, { kind: "protection", device: "MCCB", label: "Leistungsschalter" }, { kind: "protection", device: "RCD", label: "FI / RCD" }, { kind: "protection", device: "RCBO", label: "FI-LS / RCBO" }, { kind: "protection", device: "MOTOR", label: "Motorschutz" }, { kind: "protection", device: "SWITCH", label: "Lastschalter" }] },
  { label: "Verteilung", items: [{ kind: "distribution", device: "uv", label: "Unterverteilung" }, { kind: "distribution", device: "meter", label: "Zähler" }, { kind: "distribution", device: "busbar", label: "Sammelschiene" }] },
  { label: "Verbraucher", items: [{ kind: "load", device: "motor", label: "Motor" }, { kind: "load", device: "socket", label: "Steckdose" }, { kind: "load", device: "light", label: "Leuchte" }, { kind: "load", device: "heater", label: "Heizung" }, { kind: "load", device: "cooker", label: "Herd" }, { kind: "load", device: "fan", label: "Ventilator" }, { kind: "load", device: "general", label: "Allgemeine Last" }] },
];

function visible(fields: Field[], values: Record<string, string>) {
  return fields.filter(field => !field.visibleWhen || field.visibleWhen.every(condition => condition.values.includes(values[condition.key])));
}
function Fields({ fields, values, onChange, locks }: { fields: Field[]; values: Record<string, string>; onChange: (key: string, value: string) => void; locks?: Record<string, { value: string; note: string }> }) {
  const shown = visible(fields, values), groups = Array.from(new Set(shown.map(field => field.group ?? "Bemessungswerte")));
  return <>{groups.map(group => <fieldset className="np-fieldset" key={group}><legend>{group}</legend>{shown.filter(field => (field.group ?? "Bemessungswerte") === group).map(field => {
    const lock = locks?.[field.key];
    return <div className="np-field" key={field.key}>
    <label htmlFor={`np-property-${field.key}`}>{field.label}{field.unit ? ` (${field.unit})` : ""}</label>
    {field.options ? <div data-network-field={field.key}><ChoiceCards id={`np-property-${field.key}`} fieldKey={field.key} label={field.label} options={optionsWithProjectValue(field.options, values[field.key] ?? "")} value={values[field.key] ?? ""} onChange={value => onChange(field.key, value)} /></div> : <input id={`np-property-${field.key}`} data-network-field={field.key} value={lock ? lock.value : values[field.key] ?? ""} readOnly={Boolean(lock)} aria-readonly={lock ? true : undefined} inputMode={field.kind === "text" ? "text" : "decimal"} autoComplete="off" maxLength={field.kind === "text" ? 120 : 40} onChange={event => { if (!lock) onChange(field.key, event.target.value); }} />}
    {(lock?.note || field.help) && <details className="np-field-help"><summary>ⓘ Erklärung</summary><p>{lock?.note ?? field.help}</p></details>}
  </div>;
  })}</fieldset>)}</>;
}
function EdgeMetrics({ edge }: { edge: NetworkEdgeResult }) {
  return <div className="np-edge-results"><h3>Berechnung dieses Abschnitts</h3><dl>
    <div><dt>Stärkster Aussenleiter</dt><dd>{format(edge.current, "A")}</dd></div>
    <div><dt>L1 / L2 / L3</dt><dd>{edge.currents.map(value => format(value, "A", 1)).join(" / ")}</dd></div>
    <div><dt>Neutralleiter</dt><dd>{format(edge.neutralCurrent, "A")}</dd></div>
    <div><dt>Spannungsfall Abschnitt</dt><dd>{format(edge.dropPercent, "%")}</dd></div>
    <div><dt>Spannungsfall bis hier</dt><dd>{format(edge.cumulativeDropPercent, "%")}</dd></div>
    <div><dt>Strombelastbarkeit Iz</dt><dd>{format(edge.iz, "A")}</dd></div>
    <div><dt>Ik kalt · Modell</dt><dd>{format(edge.ikMaxKA, "kA", 3)}</dd></div>
    <div><dt>Ik L–PE warm · Modell</dt><dd>{format(edge.ikMinKA, "kA", 3)}</dd></div>
  </dl><details><summary>Prüfbedingungen</summary><ul className="np-checks">{edge.checks.map((check, index) => <li key={index}>{check}</li>)}</ul></details><details className="np-calculation-details"><summary>Formel mit eingesetzten Zahlen</summary><code>{edge.formula}</code></details></div>;
}

function CheckpointOverview({ checkpoints, diagnostics, onExplain }: {
  checkpoints: NetworkCheckpoint[]; diagnostics: NetworkDiagnostic[]; onExplain: (diagnostic: NetworkDiagnostic) => void;
}) {
  const summary = summarizeNetworkCheckpoints(checkpoints);
  return <section className="np-checkpoints" aria-label="Prüfübersicht mit elf Kriterien">
    <h3>Prüfübersicht <span>11 Kriterien</span></h3>
    <p className="np-checkpoint-counts" data-checkpoint-overall={summary.status}>{summary.passed} im Modell erfüllt · {summary.failed} fehlerhaft · {summary.open} offen</p>
    {checkpoints.map(checkpoint => <details key={checkpoint.id} className={`np-checkpoint np-checkpoint-${checkpoint.status}`} data-network-checkpoint={checkpoint.id} data-checkpoint-status={checkpoint.status}>
      <summary>{checkpoint.status === "passed" ? <CheckCircle2 size={16} aria-hidden="true" /> : checkpoint.status === "failed" ? <CircleX size={16} aria-hidden="true" /> : <CircleHelp size={16} aria-hidden="true" />}<span>{checkpoint.title}</span><strong>{checkpoint.status === "passed" ? "Modell erfüllt" : checkpoint.status === "failed" ? "Fehler" : "Offen"}</strong><ChevronDown size={13} aria-hidden="true" /></summary>
      <div className="np-checkpoint-body"><p><strong>{checkpoint.summary}</strong></p><p>{checkpoint.detail}</p><p><span className="np-checkpoint-label">Grundlage / nächster Schritt</span>{checkpoint.required}</p>
        {checkpoint.issues.map(issue => { const diagnostic = diagnostics.find(item => item.id === networkDiagnosticId(issue)); return diagnostic ? <button key={diagnostic.id} type="button" className={`np-checkpoint-issue np-tone-${issue.tone}`} onClick={() => onExplain(diagnostic)}><CircleAlert size={14} aria-hidden="true" /><span>{issue.text}<small>Erklären und zur Eingabe →</small></span></button> : null; })}
      </div>
    </details>)}
    <p className="np-checkpoint-scope">Modellvorprüfung · offene Nachweise bleiben für die Fachprüfung sichtbar.</p>
  </section>;
}

function unwrapDocument(value: unknown): NetworkDocument {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (record.network) return unwrapDocument(record.network);
    if (record.document && typeof record.document === "object" && !Array.isArray(record.document)) return unwrapDocument(record.document);
  }
  const parsed = parseNetworkDocument(value); return { ...parsed, orientation: networkOrientation(parsed) };
}

function NewNetworkDialog({ cancel, confirm }: { cancel: () => void; confirm: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, cancel);
  return <div className="np-dialog-overlay" onClick={event => { if (event.target === event.currentTarget) cancel(); }}><div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="np-clear-title" tabIndex={-1} className="np-dialog"><h2 id="np-clear-title">Leeres Netz anlegen?</h2><p>Der aktuelle Entwurf bleibt über „Rückgängig“ erreichbar. Eine JSON-Kopie kannst du vorher mit „Entwurf sichern“ herunterladen.</p><div><button onClick={cancel}>Abbrechen</button><button onClick={confirm}>Leeres Netz anlegen</button></div></div></div>;
}

export default function NetworkPlanner(props: ToolProps) {
  const { hub, active, error: projectError } = useProjectHub();
  const [history, dispatch] = useReducer(networkHistoryReducer, undefined, () => networkHistory(exampleNetwork()));
  const document = history.present, orientation = networkOrientation(document);
  const [review, setReview] = useState<NetworkReview | null>(null);
  const currentReview = reviewIsCurrent(review, document), reviewState = !review ? "unchecked" : currentReview ? "current" : "stale";
  const [dragItem, setDragItem] = useState<PaletteItem | null>(null);
  const docRef = useRef(document); docRef.current = document;
  const [project, setProject] = useState<ArchiveProject | null>(null), [ready, setReady] = useState(false), [help, setHelp] = useState<Help | null>(null);
  const [selection, setSelection] = useState<NetworkSelection>(null), [tab, setTab] = useState<"properties" | "results">("properties");
  const [explainedIssue, setExplainedIssue] = useState<NetworkIssue | null>(null);
  const [fieldRequest, setFieldRequest] = useState<{ target: DiagnosticTarget; token: number } | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ selection: NetworkSelection; token: number } | undefined>();
  const inspectorRef = useRef<HTMLElement>(null), navigationToken = useRef(0);
  const [connectMode, setConnectMode] = useState(false), [connectFrom, setConnectFrom] = useState<string | null>(null), [viewToken, setViewToken] = useState(0);
  const [notes, setNotes] = useState(""), [message, setMessage] = useState(""), [storageError, setStorageError] = useState(""), [clearOpen, setClearOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false), [recovery, setRecovery] = useState<string | null>(null);
  const loaded = useRef(false), importInput = useRef<HTMLInputElement>(null);
  const localKey = `edeco.network.v1.${project?.id || project?.number || "unassigned"}`;
  const result = useMemo(() => {
    try { return calculateNetwork(document); }
    catch (error) { return { valid: false, tone: "error" as const, status: "Netz nicht berechenbar.", issues: [{ tone: "error" as const, text: error instanceof Error ? error.message : "Eingaben prüfen." }], nodes: [], edges: [], totalPowerKW: 0, maxCurrent: 0, maxDropPercent: 0, formula: "", assumptions: [] }; }
  }, [document]);
  const selectedNode = selection?.kind === "node" ? document.nodes.find(node => node.id === selection.id) : undefined;
  const selectedEdge = selection?.kind === "edge" ? document.edges.find(edge => edge.id === selection.id) : undefined;
  const selectedEdgeResult = selectedEdge ? result.edges.find(edge => edge.id === selectedEdge.id) : undefined;
  const diagnostics = useMemo(() => buildNetworkDiagnostics(document, result), [document, result]);
  const checkpoints = useMemo(() => buildNetworkCheckpoints(document, result), [document, result]);
  const checkpointSummary = summarizeNetworkCheckpoints(checkpoints);
  const displayTone = result.tone === "error" ? "error" : checkpointSummary.status === "open" ? "warning" : result.tone;
  const activeDiagnostic = explainedIssue ? diagnostics.find(item => item.id === networkDiagnosticId(explainedIssue)) : undefined;
  const selectedDiagnostics = diagnostics.filter(item => selection?.kind === "edge" ? item.issue.edgeId === selection.id : selection?.kind === "node" ? item.issue.nodeId === selection.id || item.issue.relatedNodeId === selection.id : false);
  const commit = useCallback((next: NetworkDocument) => dispatch({ type: "commit", document: next }), []);

  useEffect(() => {
    if (!fieldRequest || tab !== "properties") return;
    const { target } = fieldRequest;
    const expected = selection ? `${selection.kind}:${selection.id}` : "";
    if (target.rowId && expected !== target.rowId) return;
    const frame = requestAnimationFrame(() => {
      const inspector = inspectorRef.current;
      if (!inspector) return;
      const wrapper = target.field ? inspector.querySelector<HTMLElement>(`[data-network-field="${CSS.escape(target.field)}"]`) : inspector.querySelector<HTMLElement>(".np-selection-heading");
      if (wrapper) {
        let parent = wrapper.parentElement;
        while (parent && parent !== inspector) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
        if (!target.field) wrapper.tabIndex = -1;
        const control = !target.field || wrapper.matches("input,select,textarea,button") ? wrapper : wrapper.querySelector<HTMLElement>("select,input:not([type=hidden]),textarea,button[aria-pressed=true],button");
        wrapper.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        control?.focus({ preventScroll: true });
        wrapper.animate([{ outline: "2px solid var(--accent)", outlineOffset: "3px" }, { outline: "2px solid transparent", outlineOffset: "3px" }], { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1600 });
      }
      setFieldRequest(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [fieldRequest, tab, selection]);

  useEffect(() => {
    if (loaded.current || !hub && !projectError) return; loaded.current = true;
    const restore = consumeRestore("netzplaner"), chosen = restore?.project ?? (active ? { id: active.id, number: active.number, name: active.name } : null);
    setProject(chosen);
    let raw: string | null = null;
    try {
      raw = restore ? null : localStorage.getItem(`edeco.network.v1.${chosen?.id || chosen?.number || "unassigned"}`);
      const local = raw ? JSON.parse(raw) : null;
      const saved = restore?.document ?? local;
      if (saved) { dispatch({ type: "reset", document: unwrapDocument(saved) }); setNotes(restore?.notes ?? (typeof local?.notes === "string" ? local.notes : "")); setMessage("Gespeicherter Netzentwurf geladen. Live-Vorschau aktualisiert; für einen aktuellen Prüfbericht „Berechnen & prüfen“ wählen."); }
    } catch (error) {
      dispatch({ type: "reset", document: { version: 1, name: "Wiederherstellung prüfen", nodes: [], edges: [] } });
      setLoadFailed(true); setRecovery(raw ?? (restore ? JSON.stringify(restore.document, null, 2) : null));
      setMessage(`${error instanceof Error ? error.message : "Gespeicherter Netzplan konnte nicht geladen werden."} Autospeicherung pausiert; die vorhandenen Daten bleiben unverändert. Ein leeres Netz wird ohne Ersatzresultat angezeigt.`);
    }
    setReady(true); setViewToken(value => value + 1);
  }, [hub, active, projectError]);
  useEffect(() => {
    if (!ready || loadFailed) return;
    try { localStorage.setItem(localKey, JSON.stringify({ schema: "edeco.network.v1", network: document, notes })); setStorageError(""); }
    catch { setStorageError("Netzentwurf konnte nicht lokal gespeichert werden. Bitte JSON herunterladen."); }
  }, [document, notes, ready, localKey, loadFailed]);
  useEffect(() => {
    if (selection?.kind === "node" && !document.nodes.some(node => node.id === selection.id) || selection?.kind === "edge" && !document.edges.some(edge => edge.id === selection.id)) setSelection(null);
    if (connectFrom && !document.nodes.some(node => node.id === connectFrom)) setConnectFrom(null);
  }, [document, selection, connectFrom]);

  const removeSelected = useCallback(() => {
    if (!selection) return;
    const current = docRef.current;
    commit(selection.kind === "node" ? { ...current, nodes: current.nodes.filter(node => node.id !== selection.id), edges: current.edges.filter(edge => edge.from !== selection.id && edge.to !== selection.id) } : { ...current, edges: current.edges.filter(edge => edge.id !== selection.id) });
    setSelection(null); setMessage(selection.kind === "node" ? "Bauteil mit seinen Anschlussleitungen entfernt. Rückgängig bleibt möglich." : "Leitung entfernt. Rückgängig bleibt möglich.");
  }, [selection, commit]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (help || clearOpen) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); dispatch({ type: event.shiftKey ? "redo" : "undo" }); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); dispatch({ type: "redo" }); }
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); }
      else if (event.key === "Escape") { setConnectFrom(null); setConnectMode(false); setSelection(null); }
      else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "c") { setConnectMode(old => !old); setConnectFrom(null); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, [removeSelected, help, clearOpen]);

  function select(item: NetworkSelection, preserveExplanation = false) { if (!preserveExplanation) setExplainedIssue(null); setSelection(item); if (item) setTab("properties"); }
  function navigateDiagnostic(target: DiagnosticTarget) {
    const row = target.rowId || "";
    const item: NetworkSelection = row.startsWith("node:") ? { kind: "node", id: row.slice(5) } : row.startsWith("edge:") ? { kind: "edge", id: row.slice(5) } : null;
    if (!item || !(item.kind === "node" ? docRef.current.nodes.some(node => node.id === item.id) : docRef.current.edges.some(edge => edge.id === item.id))) return;
    select(item, true);
    const subject = item.kind === "node" ? docRef.current.nodes.find(node => node.id === item.id) : docRef.current.edges.find(edge => edge.id === item.id);
    const definitions = item.kind === "node" && subject && "kind" in subject ? NETWORK_NODE_FIELDS[subject.kind] : NETWORK_EDGE_FIELDS;
    const wanted = definitions?.find(field => field.key === target.field);
    const prerequisite = wanted?.visibleWhen?.find(rule => subject && !rule.values.includes(subject.values[rule.key]));
    const destination = prerequisite ? { ...target, field: prerequisite.key } : target;
    if (prerequisite) setMessage(`${wanted?.label || target.field} wird erst nach der passenden Auswahl bei ${definitions.find(field => field.key === prerequisite.key)?.label || prerequisite.key} sichtbar. Den tatsächlichen Projektzustand wählen; Werte werden nicht automatisch geändert.`);
    const token = ++navigationToken.current;
    setFocusRequest({ selection: item, token });
    setFieldRequest({ target: destination, token });
  }
  function explainDiagnostic(diagnostic: NetworkDiagnostic) {
    setTab("properties");
    setExplainedIssue(diagnostic.issue);
    const first = diagnostic.targets?.[0];
    if (first) navigateDiagnostic(first);
    else if (diagnostic.issue.edgeId) navigateDiagnostic({ field: "", rowId: `edge:${diagnostic.issue.edgeId}` });
    else if (diagnostic.issue.nodeId) navigateDiagnostic({ field: "", rowId: `node:${diagnostic.issue.nodeId}` });
  }
  function add(item: PaletteItem, position?: { x: number; y: number }, connectTo?: string) {
    const current = docRef.current;
    if (current.nodes.length >= 150) { setMessage("Maximal 150 Bauteile je Netzplan."); return; }
    const selectedParent = connectTo ? current.nodes.find(node => node.id === connectTo) : !position && selectedNode?.kind !== "load" ? selectedNode : undefined;
    const suggested = position ?? nextNetworkPosition(current, selectedParent);
    const x = Math.max(-NETWORK_COORDINATE_LIMIT, Math.min(NETWORK_COORDINATE_LIMIT, Math.round(suggested.x / 10) * 10)), y = Math.max(-NETWORK_COORDINATE_LIMIT, Math.min(NETWORK_COORDINATE_LIMIT, Math.round(suggested.y / 10) * 10));
    if (position && current.nodes.some(node=>Math.abs(node.x-x)<228&&Math.abs(node.y-y)<195)) {setMessage("Dieser Bereich ist belegt. Das Bauteil mit genügend Abstand neben dem vorgelagerten Ausgang ablegen.");return;}
    const parent = item.kind === "source" ? undefined : selectedParent ?? (position ? findAttachmentParent(current, { x, y }, item.kind) : undefined);
    if (parent && current.edges.length >= 250) {setMessage("Maximal 250 Leitungen je Netzplan. Zuerst eine vorhandene Leitung entfernen.");return;}
    const node = createNetworkNode(item.kind, uid("node"), Math.round(x / 10) * 10, Math.round(y / 10) * 10);
    node.label = item.label;
    if (item.device) node.values.device = item.device;
    if (item.kind === "protection" && ["NH", "MCCB", "MOTOR"].includes(item.device ?? "")) node.values.i2factor = "";
    if (item.kind === "load" && item.device === "light") { node.values.power = "0.1"; node.values.phases = "1"; node.values.cosPhi = "0.95"; }
    if (item.kind === "load" && item.device === "socket") { node.values.power = "2.3"; node.values.phases = "1"; node.values.cosPhi = "1"; }
    const edge = parent ? createNetworkEdge(uid("line"), parent.id, node.id) : null;
    commit({ ...current, nodes: [...current.nodes, node], edges: edge ? [...current.edges, edge] : current.edges });
    select(edge ? { kind: "edge", id: edge.id } : { kind: "node", id: node.id }); if (!position) setViewToken(value => value + 1);
    setMessage(edge ? "Bauteil automatisch mit eigener Leitung angefügt. Jetzt Länge, Leiterquerschnitt und Strombelastbarkeit der markierten Leitung festlegen." : "Bauteil hinzugefügt. Ausgang und Ziel-Eingang verbinden.");
  }
  function onPort(id: string, port: "input" | "output") {
    setConnectMode(true);
    const node = docRef.current.nodes.find(item => item.id === id);
    if (!node || port === "output" && node.kind === "load" || port === "input" && node.kind === "source") { setMessage("Für diese Verbindung einen vorhandenen Ausgang und einen Ziel-Eingang wählen."); return; }
    if (port === "output") { setConnectFrom(id); setMessage("Jetzt den Eingang des Zielbauteils wählen."); return; }
    if (!connectFrom) { setMessage("Zuerst den Ausgang des vorgelagerten Bauteils wählen."); return; }
    connectNodes(connectFrom, id);
  }
  function connectNodes(from: string, id: string) {
    const current = docRef.current;
    if(current.edges.length>=250){setMessage("Maximal 250 Leitungen je Netzplan.");return;}
    const parent = current.nodes.find(node => node.id === from), target = current.nodes.find(node => node.id === id);
    if (!parent || !target || parent.kind === "load" || target.kind === "source") return;
    if (from === id) { setMessage("Ein Bauteil kann nicht mit sich selbst verbunden werden."); return; }
    if (current.edges.some(edge => edge.from === from && edge.to === id)) { setMessage("Diese Verbindung ist bereits vorhanden."); return; }
    if (current.edges.some(edge => edge.to === id)) { setMessage("Dieses Bauteil hat bereits eine Einspeiseleitung. Im radialen Modell ist nur eine zulässig."); return; }
    const adjacency = new Map<string, string[]>(); for (const edge of current.edges) adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);
    const seen = new Set<string>(), queue = [id];
    while (queue.length) { const next = queue.pop()!; if (next === from) { setMessage("Diese Verbindung würde einen Ring bilden. Das Modell unterstützt radiale Netze."); return; } if (!seen.has(next)) { seen.add(next); queue.push(...(adjacency.get(next) ?? [])); } }
    const edge = createNetworkEdge(uid("line"), from, id); commit({ ...current, edges: [...current.edges, edge] });
    setConnectFrom(null); select({ kind: "edge", id: edge.id }); setMessage("Leitung verbunden. Länge, Querschnitt und Strombelastbarkeit prüfen.");
  }
  function changeValue(key: string, value: string) {
    const current = docRef.current;
    if (selectedNode) commit({ ...current, nodes: current.nodes.map(node => node.id === selectedNode.id ? { ...node, values: { ...node.values, [key]: value, ...(node.kind === "source" && key === "phases" ? { voltage: value === "1" ? "230" : "400" } : {}), ...(node.kind === "protection" && key === "device" ? { i2factor: ["LS", "RCBO"].includes(value) ? "1.45" : ["NH", "MCCB", "MOTOR"].includes(value) ? "" : node.values.i2factor } : {}) } } : node) });
    else if (selectedEdge) commit({ ...current, edges: current.edges.map(edge => edge.id === selectedEdge.id ? { ...edge, values: { ...edge.values, [key]: value } } : edge) });
  }
  function applyVariant(preview: NetworkVariantPreview) {
    try {
      const next = applyNetworkVariant(docRef.current, preview);
      commit(next);
      setReview(checkNetwork(next));
      setMessage("Variante bewusst übernommen und gesamtes Netz neu geprüft. Rückgängig bleibt möglich; offene Geräte- und Fachnachweise bleiben sichtbar.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Die Variante konnte nicht übernommen werden. Erneut prüfen."); }
  }
  function moveNode(id: string, x: number, y: number, stage: "start" | "move" | "end") {
    if (stage === "start") dispatch({ type: "checkpoint" });
    if (stage === "move") dispatch({ type: "live", document: { ...docRef.current, nodes: docRef.current.nodes.map(node => node.id === id ? { ...node, x, y } : node) } });
    if (stage === "end") {
      const current = docRef.current, node = current.nodes.find(item=>item.id===id);
      const parent = node && findAttachmentParent(current, {x,y}, node.kind, id);
      if(parent && current.edges.length < 250 && !current.nodes.some(item=>item.id!==id&&Math.abs(item.x-x)<228&&Math.abs(item.y-y)<195)) {
        const edge=createNetworkEdge(uid("line"),parent.id,id);
        dispatch({type:"live",document:{...current,edges:[...current.edges,edge]}});
        select({kind:"edge",id:edge.id}); setMessage("Freies Bauteil verbunden. Leitungslänge und Querschnitte jetzt festlegen.");
      }
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Netzplan-Dateien bis 2 MB werden unterstützt.");
      const data: unknown = JSON.parse(await file.text()), next = unwrapDocument(data); commit(next); setLoadFailed(false); setRecovery(null);
      setSelection(null); setConnectFrom(null); setConnectMode(false); setViewToken(value => value + 1); setMessage("Netzplan importiert. Live-Vorschau aktualisiert; für einen aktuellen Prüfbericht erneut prüfen.");
    } catch (error) { setMessage(`Import abgebrochen; der bisherige Entwurf bleibt unverändert. ${error instanceof Error ? error.message : "Netzplan konnte nicht importiert werden."}`); }
    if (importInput.current) importInput.current.value = "";
  }
  const archiveDocument = { schema: "edeco.network.v1", modelVersion: 1, network: document, project, result, draft: !currentReview || !result.valid, calculationValid: result.valid, conditionsMet: currentReview && result.tone === "ok", notes, source: "https://www.elektro-rechner.ch/planer", checkedReview: currentReview ? review : null, reviewState, scope: "Radiale Modellvorprüfung; keine vollständige NIN-Freigabe" };
  function exportDraft() { downloadBlob(new Blob([JSON.stringify(archiveDocument, null, 2)], { type: "application/json" }), `${document.name.replace(/[<>:"/\\|?*]/g, "-").trim() || "Netzplan"}.json`); }
  const checkedPDF = currentReview && review ? networkReviewPDF(review, project) : null;
  const pdfReport = checkedPDF ? {...checkedPDF,notes:[...(checkedPDF.notes??[]),...(notes.trim()?[`Projektnotizen: ${notes.trim()}`]:[])]} : null;
  function loadExample(next:NetworkDocument, message:string) {commit(next);setLoadFailed(false);setRecovery(null);setSelection(null);setConnectFrom(null);setConnectMode(false);setReview(null);setViewToken(value=>value+1);setMessage(message);}
  function runCheck() { setReview(checkNetwork(document)); setTab("results"); setMessage("Prüfbericht erstellt. Änderungen an Eingaben oder Verbindungen erfordern eine neue Prüfung."); }
  function issueContext(issue:NetworkIssue, network:NetworkDocument) {
    const edge=network.edges.find(edge=>edge.id===issue.edgeId);
    if(edge)return `${network.nodes.find(node=>node.id===edge.from)?.label??edge.from} → ${network.nodes.find(node=>node.id===edge.to)?.label??edge.to}`;
    return network.nodes.find(node=>node.id===issue.nodeId)?.label ?? "Netz / Eingaben";
  }
  const reviewDiagnostics = review ? buildNetworkDiagnostics(review.document, review.result) : [];
  const reviewCheckpoints = review ? buildNetworkCheckpoints(review.document, review.result) : [];
  return <LabShell {...props} knowledgeId="netzplaner" title="Netzplaner · NIN (Beta)" subtitle={`${NORM}${project ? ` · ${project.number} · ${project.name}` : ""}`} help={help} setHelp={setHelp} canExport={ready && currentReview} canArchive={ready} archive={{ toolId: "netzplaner", project, notes, document: archiveDocument }} pdfReport={pdfReport} exportData={exportDraft} reviewLabel="Radiales Modell · Fachprüfung offen">
    <div className="np-project-bar"><label>Netz / Projektname<input aria-label="Name des Netzplans" maxLength={120} value={document.name} disabled={!ready} onChange={event => commit({ ...document, name: event.target.value })} /></label><div className="np-project-context">{project ? <><strong>{project.number}</strong><span>{project.name}</span></> : <><strong>Ohne Projektzuordnung</strong><span>Entwurf wird lokal gespeichert</span></>}{props.onOpenTool && <button className="lab-open" onClick={() => props.onOpenTool?.("projektzentrale")}>Projektzentrale</button>}</div></div>
    <div className="np-editor-toolbar" role="toolbar" aria-label="Netzplan bearbeiten">
      <div className="np-toolbar-group"><button disabled={!ready} aria-pressed={!connectMode} onClick={() => { setConnectMode(false); setConnectFrom(null); }}><MousePointer2 size={16} />Auswählen</button><button disabled={!ready} aria-pressed={connectMode} onClick={() => { setConnectMode(old => !old); setConnectFrom(null); }} aria-label="Leitungen verbinden"><Link2 size={16} />Verbinden</button></div>
      <div className="np-toolbar-group"><button disabled={!history.past.length} onClick={() => dispatch({ type: "undo" })} aria-label="Netzplan rückgängig"><Undo2 size={16} /></button><button disabled={!history.future.length} onClick={() => dispatch({ type: "redo" })} aria-label="Netzplan wiederholen"><Redo2 size={16} /></button><button disabled={!ready || !document.nodes.length} onClick={() => { commit(arrangeNetwork(document)); setViewToken(value => value + 1); }}><LayoutGrid size={16} />Anordnen</button><button disabled={!ready} aria-pressed={orientation === "horizontal"} onClick={() => commit({ ...document, orientation: "horizontal" })}>Horizontal</button><button disabled={!ready} aria-pressed={orientation === "vertical"} onClick={() => commit({ ...document, orientation: "vertical" })}>Vertikal</button><button disabled={!selection} className="np-delete" onClick={removeSelected} aria-label="Ausgewähltes Element löschen"><Trash2 size={16} /></button></div>
      <div className="np-toolbar-group np-files"><input type="file" ref={importInput} accept="application/json,.json" className="np-file-input" onChange={event => void importFile(event.target.files?.[0])} /><button disabled={!ready} onClick={() => importInput.current?.click()}><ArrowUpFromLine size={16} />JSON laden</button><button disabled={!ready} onClick={exportDraft} aria-label="Netzentwurf als JSON herunterladen"><ArrowDownToLine size={16} />Entwurf sichern</button><button disabled={!ready} onClick={() => loadExample(exampleNetwork(), "Verbundenes Beispielnetz geladen. Werte und offene Nachweise am Projekt prüfen.")}>Beispiel laden</button><button disabled={!ready} onClick={() => loadExample(createFloorDistributionExample(), "Zwei parallele Unterverteilungen geladen. Iz und Geräteeinstellungen sind Beispielwerte; mit Verlegeart, Leitungsdaten und Herstellerangaben des Projekts ersetzen.")}>Beispiel: 2 Unterverteilungen</button><button disabled={!ready} onClick={() => setClearOpen(true)}><Plus size={16} />Neu</button></div>
    </div>
    <div className="np-check-bar" data-network-review-state={reviewState}><div><strong>{currentReview ? "Prüfbericht aktuell" : review ? "Prüfbericht veraltet" : "Noch nicht geprüft"}</strong><span>{review ? `Prüfung ${new Date(review.checkedAt).toLocaleString("de-CH")}${currentReview ? " · aktueller Eingabestand" : " · Eingaben geändert, erneut prüfen"}` : "Live-Vorschau aktiv · Prüfbericht und PDF nach expliziter Prüfung"}</span></div><button disabled={!ready} onClick={runCheck}><CheckCircle2 size={17} />Berechnen &amp; prüfen</button></div>
    <div className={`np-network-status np-tone-${displayTone}`} role="status">{displayTone === "error" ? <CircleAlert size={18} /> : displayTone === "warning" ? <CircleHelp size={18} /> : <CheckCircle2 size={18} />}<span><small>Live-Vorschau</small>{result.valid && result.tone === "ok" && checkpointSummary.open ? `Rechenwerte berechnet · ${checkpointSummary.open} Prüfpunkte offen.` : result.status}</span><button onClick={() => { const first = diagnostics.find(item => item.tone === "error") ?? diagnostics[0]; if (first) explainDiagnostic(first); else setTab("results"); }}>{result.tone === "error" ? "Fehler anzeigen" : `${result.edges.length} Abschnitte · Details`}</button></div>
    <div className="np-network-summary"><div><span>Verbraucherleistung</span><strong>{result.valid ? format(result.totalPowerKW, "kW") : "–"}</strong></div><div><span>Stärkster Aussenleiter</span><strong>{result.valid ? format(result.maxCurrent, "A") : "–"}</strong></div><div><span>Grösster Spannungsfall · ganzer Pfad</span><strong>{result.valid ? format(result.maxDropPercent, "%") : "–"}</strong></div></div>
    <div className="np-editor-grid" inert={!ready}>
      <aside className="np-palette" aria-label="Bauteilpalette"><header><h2>Bauteile</h2><span>Klicken oder hineinziehen</span></header>{palette.map(group => <details open key={group.label}><summary>{group.label}</summary><div>{group.items.map(item => <button key={`${item.kind}-${item.device ?? ""}`} type="button" draggable disabled={!ready} aria-label={`${item.label} hinzufügen`} onDragEnd={() => setDragItem(null)} onDragStart={event => { setDragItem(item); event.dataTransfer.setData("application/x-edeco-network-node", JSON.stringify(item)); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => add(item)}><svg viewBox="-42 -40 84 80" aria-hidden="true"><NetworkSymbol kind={item.kind} device={item.device} /></svg><span>{item.label}</span><Plus size={12} /></button>)}</div></details>)}</aside>
      <NetworkCanvas document={document} result={result} selection={selection} connectFrom={connectFrom} connectMode={connectMode} onSelect={select} onPort={onPort} onMove={moveNode} onDrop={(item, x, y) => { setDragItem(null); add(item, { x, y }); }} onConnect={connectNodes} dragItem={dragItem} orientation={orientation} resetViewToken={viewToken} focusRequest={focusRequest} />
      <aside ref={inspectorRef} className="np-inspector" data-network-selection={selection ? `${selection.kind}:${selection.id}` : undefined} aria-label="Netzplan-Eigenschaften und Ergebnisse"><div className="np-inspector-tabs" role="tablist" aria-label="Netzplanbereich"><button role="tab" aria-selected={tab === "properties"} onClick={() => setTab("properties")}>Eigenschaften</button><button role="tab" aria-selected={tab === "results"} onClick={() => setTab("results")}>Prüfbericht</button></div>
        {tab === "properties" ? <section role="tabpanel" aria-label="Eigenschaften">
          {explainedIssue && <div className="np-active-diagnostic" aria-label="Ausgewählte Fehlerhilfe"><button className="np-close-guidance" aria-label="Fehlerhilfe schliessen" onClick={() => setExplainedIssue(null)}><X size={15} /></button>{activeDiagnostic ? <DiagnosticDetails key={activeDiagnostic.id} diagnostic={activeDiagnostic} onNavigate={navigateDiagnostic} initiallyOpen /> : <p role="status">Dieser Hinweis ist im aktuellen Stand nicht mehr vorhanden. Weitere Fehler und offene Nachweise stehen in der Live-Auswertung; der gesamte Netzplan ist dadurch noch nicht freigegeben.</p>}</div>}
          {selection && <NetworkVariantPanel key={`${selection.kind}:${selection.id}`} document={document} selection={selection} onApply={applyVariant} />}

          {selectedNode ? <><div className="np-selection-heading"><span>{NETWORK_NODE_LABELS[selectedNode.kind]}</span><button aria-label="Auswahl aufheben" onClick={() => setSelection(null)}><X size={15} /></button></div><div className="np-field"><label htmlFor="np-node-name">Bezeichnung</label><input id="np-node-name" aria-label="Bauteilbezeichnung" value={selectedNode.label} maxLength={100} onChange={event => commit({ ...document, nodes: document.nodes.map(node => node.id === selectedNode.id ? { ...node, label: event.target.value } : node) })} /></div><Fields fields={NETWORK_NODE_FIELDS[selectedNode.kind]} values={selectedNode.values} onChange={changeValue} />{selectedNode.kind !== "load" && <button className="np-branch-add" onClick={() => add({ kind: "load", device: "general", label: "Neuer Abgang" }, undefined, selectedNode.id)}><GitBranch size={16} />Abgang mit Verbraucher hinzufügen</button>}<div className="np-guided-checks">{selectedDiagnostics.filter(item => item.id !== activeDiagnostic?.id).map(item => <DiagnosticDetails key={item.id} diagnostic={item} onNavigate={navigateDiagnostic} />)}</div><details><summary>Alle Prüfbedingungen</summary><div className="np-checks">{result.nodes.find(node => node.id === selectedNode.id)?.checks.map((check, index) => <p key={index}>{check}</p>)}</div></details></> : selectedEdge ? <><div className="np-selection-heading"><span>Leitung dimensionieren</span><button aria-label="Auswahl aufheben" onClick={() => setSelection(null)}><X size={15} /></button></div><p className="np-connection-title">{document.nodes.find(node => node.id === selectedEdge.from)?.label}<span>{orientation === "horizontal" ? "→" : "↓"}</span>{document.nodes.find(node => node.id === selectedEdge.to)?.label}</p><p className="np-cable-summary">{selectedEdge.values.length || "–"} m · {selectedEdge.values.material === "al" ? "Aluminium" : "Kupfer"} · L {selectedEdge.values.area || "–"} mm²<br />PE {(selectedEdge.values.peArea === "same" ? selectedEdge.values.area : selectedEdge.values.peArea)||"–"} mm² · N {(selectedEdge.values.neutralArea === "same" ? selectedEdge.values.area : selectedEdge.values.neutralArea)||"–"} mm²</p><Fields fields={NETWORK_EDGE_FIELDS} values={selectedEdge.values} onChange={changeValue} locks={networkDropIgnoresEdgeTemperature(document.nodes.find(node => node.kind === "source")?.values.calcBasis ?? "") ? { temperature: { value: "20", note: `Spannungsfall fest bei 20 °C, wie NIN-Programm. Gespeichert bleiben ${selectedEdge.values.temperature || "–"} °C und gelten wieder bei «Vorsichtig». Ik,min bleibt 80 °C.` } } : undefined} /><div className="np-guided-checks">{selectedDiagnostics.filter(item => item.id !== activeDiagnostic?.id).map(item => <DiagnosticDetails key={item.id} diagnostic={item} onNavigate={navigateDiagnostic} />)}</div>{selectedEdgeResult && <EdgeMetrics edge={selectedEdgeResult} />}</> : <div className="np-inspector-empty"><MousePointer2 size={28} /><h2>Bauteil oder Leitung wählen</h2><p>Hier bearbeitest du die Bemessungswerte und siehst die Prüfungen des ausgewählten Abschnitts.</p><ol><li>Bauteile hinzufügen.</li><li>Rechts neben einem Ausgang ablegen oder Ausgang zum Ziel-Eingang ziehen.</li><li>Leitungs- und Gerätedaten prüfen.</li></ol><p>Leere oder ungültige Eingaben ergeben keinen Ersatzwert.</p></div>}
        </section> : <section role="tabpanel" aria-label="Prüfbericht"><h2>Prüfbericht · {currentReview ? "aktueller Stand" : review ? "erneute Prüfung nötig" : "noch nicht erstellt"}</h2>
          {!currentReview ? <div className="np-review-prompt"><CircleAlert size={22}/><p>{review ? "Die Eingaben wurden seit der letzten Prüfung geändert. Der frühere Prüfbericht gilt für diesen Stand nicht mehr." : "„Berechnen & prüfen“ erstellt einen dokumentierten Prüfstand mit Fehlern, offenen Angaben und Ergebnissen."}</p><button className="np-branch-add" onClick={runCheck}>Berechnen &amp; prüfen</button></div> : review && <>
            <p className="np-inspector-intro">{new Date(review.checkedAt).toLocaleString("de-CH")} · {review.result.status}</p>
            <CheckpointOverview checkpoints={reviewCheckpoints} diagnostics={reviewDiagnostics} onExplain={explainDiagnostic} />
            {reviewDiagnostics.length ? <ul className="np-issue-list">{reviewDiagnostics.map(diagnostic=><li key={diagnostic.id} className={`np-tone-${diagnostic.tone}`} data-network-issue={diagnostic.id}><button onClick={()=>explainDiagnostic(diagnostic)} disabled={!diagnostic.targets?.length&&!diagnostic.issue.nodeId&&!diagnostic.issue.edgeId}><CircleAlert size={15}/><span><strong className="np-issue-context">{issueContext(diagnostic.issue,review.document)}</strong>{diagnostic.issue.text}</span></button><DiagnosticDetails diagnostic={diagnostic} onNavigate={navigateDiagnostic} /></li>)}</ul> : <p className="np-tone-ok">Keine zusätzlichen Hinweise im berechneten Modell.</p>}
            <h3>Geräte und Verbraucher</h3><div className="np-section-results">{review.document.nodes.map(node=>{const calculation=review.result.nodes.find(item=>item.id===node.id);return <div className={`np-review-item np-tone-${calculation?.tone??"neutral"}`} key={node.id}><button onClick={()=>select({kind:"node",id:node.id})}><span>{node.label}</span><strong>{calculation ? `${format(calculation.current,"A")} · ${format(calculation.powerKW,"kW")}` : "Nicht berechenbar · Eingaben prüfen"}</strong></button>{calculation?.checks.length ? <ul>{calculation.checks.map((check,index)=><li key={index}>{check}</li>)}</ul> : null}</div>;})}</div>
            <h3>Leitungen · Werte und Bedingungen</h3><div className="np-section-results">{review.document.edges.map(edge=>{const calculation=review.result.edges.find(item=>item.id===edge.id);return <div className={`np-review-item np-tone-${calculation?.tone??"neutral"}`} key={edge.id}><button onClick={()=>select({kind:"edge",id:edge.id})}><span>{review.document.nodes.find(node=>node.id===edge.from)?.label} → {review.document.nodes.find(node=>node.id===edge.to)?.label}</span><strong>{edge.values.length||"–"} m · {(edge.values.material??"–").toUpperCase()} {edge.values.area||"–"} mm²</strong></button>{calculation ? <EdgeMetrics edge={calculation}/> : <p>Nicht berechenbar. Die oben genannten Fehler und fehlenden Angaben zuerst korrigieren.</p>}</div>;})}</div>
            <details className="np-calculation-details"><summary>Formeln und Modellgrenzen</summary><code>{review.result.formula}</code><ul>{review.result.assumptions.map((assumption,index)=><li key={index}>{assumption}</li>)}</ul></details>
          </>}
        </section>}

      </aside>
    </div>
    {(message || storageError || projectError) && <p className={`np-editor-message${storageError ? " np-tone-error" : ""}`} role="status">{storageError || message || projectError}</p>}
    {loadFailed && <div className="np-recovery"><strong>Vorhandenen Entwurf zuerst sichern</strong><p>Die gespeicherte Datei wurde nicht überschrieben. Nach dem Sichern kannst du ein neues Netz anlegen oder eine gültige JSON-Datei laden.</p>{recovery && <button className="lab-open" onClick={() => downloadBlob(new Blob([recovery], { type: "application/json" }), "Netzplan-Wiederherstellung.json")}>Unveränderte Altdaten herunterladen</button>}</div>}
    <div className="np-notes"><label htmlFor="np-notes">Projektnotizen / Grundlagenverweis</label><textarea id="np-notes" value={notes} disabled={!ready} onChange={event => setNotes(event.target.value)} maxLength={10000} rows={2} placeholder="Netzdaten, Quellen und offene Punkte dokumentieren …" /><span>{loadFailed ? "Autospeicherung pausiert · vorhandener Entwurf bleibt erhalten" : ready ? storageError ? "Autospeicherung fehlgeschlagen · JSON-Kopie herunterladen" : "Entwurf lokal gespeichert · Serverablage über das Speichersymbol" : "Projekt und Entwurf werden geladen …"}</span></div>
    <details className="np-foundations"><summary>Normbezug, Rechenmodell und Bedienung</summary><div><p>Dieser Editor berechnet radiale Niederspannungsnetze. Knoten können frei angeordnet werden; ihre Verbindungen bestimmen den Stromweg. Ringschlüsse, mehrere Einspeisungen und fehlende Anschlüsse werden nicht still vereinfacht.</p><p>Leiterwiderstände: SN EN 60228. Spannungsfall: NIN 5.2.5.1, mit kumulierten Werten entlang des Pfads. Strombelastbarkeit und Schutzwerte benötigen passende Eingaben beziehungsweise belegte Tabellenwerte. Kurzschlussströme sind Modellwerte unter den angegebenen Randbedingungen.</p><p>Eine grüne Einzelprüfung bestätigt nur ihre Zahlenbedingung. Das Ergebnis bestätigt keine vollständige NIN-Konformität der Anlage. Fehlerstromschutz, Selektivität, Abschaltzeiten und Gerätekoordination benötigen die jeweils genannten Nachweise.</p><p>Bauteile lassen sich ziehen; freie Zeichenfläche ziehen verschiebt die Ansicht. Mausrad oder +/− zoomen, „Alles einpassen“ zeigt das Netz. <kbd>C</kbd> startet das Verbinden, <kbd>Esc</kbd> bricht es ab. <kbd>Entf</kbd> löscht die Auswahl, <kbd>Strg</kbd>+<kbd>Z</kbd> macht Änderungen rückgängig.</p></div></details>
    {clearOpen && <NewNetworkDialog cancel={() => setClearOpen(false)} confirm={() => { commit({ version: 1, name: "Neues Netz", orientation, nodes: [], edges: [] }); setLoadFailed(false); setRecovery(null); setSelection(null); setConnectFrom(null); setConnectMode(false); setClearOpen(false); setViewToken(value => value + 1); }} />}
  </LabShell>;
}
