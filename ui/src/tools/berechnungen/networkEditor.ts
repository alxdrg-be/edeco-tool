import type { NetworkDocument, NetworkNode, NetworkNodeKind, NetworkOrientation } from "./networkTypes.ts";

export const NETWORK_COORDINATE_LIMIT = 100_000;

const KINDS: NetworkNodeKind[] = ["source", "transformer", "distribution", "protection", "load"];
const identifier = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const values = (value: unknown): value is Record<string, string> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.entries(value).every(([key, v]) => /^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(key) && typeof v === "string" && v.length <= 256));

/** Structural import validation deliberately preserves invalid numeric inputs for editing. */
export function parseNetworkDocument(value: unknown): NetworkDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Keine gültige Netzplan-Datei.");
  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 || typeof candidate.name !== "string" || candidate.name.length > 120 || !Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges)) throw new Error("Netzplan-Version oder Dokumentstruktur nicht unterstützt.");
  if (candidate.orientation !== undefined && !["horizontal", "vertical"].includes(String(candidate.orientation))) throw new Error("Unbekannte Zeichenrichtung im Netzplan.");
  if (candidate.nodes.length > 150 || candidate.edges.length > 250) throw new Error("Der Netzplan überschreitet 150 Bauteile oder 250 Leitungen.");
  const ids = new Set<string>();
  for (const node of candidate.nodes) {
    if (!node || typeof node !== "object" || !identifier(node.id) || ids.has(node.id) || !KINDS.includes(node.kind) || typeof node.label !== "string" || node.label.length > 100 || !Number.isFinite(node.x) || !Number.isFinite(node.y) || Math.abs(node.x) > NETWORK_COORDINATE_LIMIT || Math.abs(node.y) > NETWORK_COORDINATE_LIMIT || !values(node.values)) throw new Error("Ungültiges Bauteil im Netzplan.");
    ids.add(node.id);
  }
  const edgeIds = new Set<string>();
  for (const edge of candidate.edges) {
    if (!edge || typeof edge !== "object" || !identifier(edge.id) || edgeIds.has(edge.id) || !ids.has(edge.from) || !ids.has(edge.to) || !values(edge.values)) throw new Error("Ungültige Leitung oder fehlendes Anschluss-Bauteil.");
    edgeIds.add(edge.id);
  }
  return JSON.parse(JSON.stringify(candidate)) as NetworkDocument;
}

export interface NetworkHistory { present: NetworkDocument; past: NetworkDocument[]; future: NetworkDocument[] }
export type NetworkHistoryAction = { type: "commit" | "live" | "reset"; document: NetworkDocument } | { type: "checkpoint" | "undo" | "redo" };
export const networkHistory = (document: NetworkDocument): NetworkHistory => ({ present: document, past: [], future: [] });
export function networkHistoryReducer(state: NetworkHistory, action: NetworkHistoryAction): NetworkHistory {
  if (action.type === "reset") return networkHistory(action.document);
  if (action.type === "live") return { ...state, present: action.document };
  if (action.type === "checkpoint") return { ...state, past: [...state.past, state.present].slice(-60), future: [] };
  if (action.type === "commit") {
    if (JSON.stringify(state.present) === JSON.stringify(action.document)) return state;
    return { present: action.document, past: [...state.past, state.present].slice(-60), future: [] };
  }
  if (action.type === "undo" && state.past.length) return { present: state.past[state.past.length - 1], past: state.past.slice(0, -1), future: [state.present, ...state.future] };
  if (action.type === "redo" && state.future.length) return { present: state.future[0], past: [...state.past, state.present].slice(-60), future: state.future.slice(1) };
  return state;
}

/** A radial tree is laid out by leaf slots; disconnected components remain visible. */
export function networkOrientation(document: NetworkDocument): NetworkOrientation {
  if (document.orientation) return document.orientation;
  const nodes = new Map(document.nodes.map(node => [node.id, node]));
  let dx = 0, dy = 0;
  for (const edge of document.edges) {
    const from = nodes.get(edge.from), to = nodes.get(edge.to);
    if (from && to) { dx += Math.abs(to.x - from.x); dy += Math.abs(to.y - from.y); }
  }
  if (!dx && !dy && document.nodes.length > 1) {
    dx = Math.max(...document.nodes.map(node => node.x)) - Math.min(...document.nodes.map(node => node.x));
    dy = Math.max(...document.nodes.map(node => node.y)) - Math.min(...document.nodes.map(node => node.y));
  }
  return dy > dx ? "vertical" : "horizontal";
}

export function arrangeNetwork(document: NetworkDocument, orientation: NetworkOrientation = networkOrientation(document)): NetworkDocument {
  const outgoing = new Map<string, string[]>();
  for (const edge of document.edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  const children = new Set(document.edges.map(edge => edge.to));
  const positions = new Map<string, { x: number; y: number }>();
  const visiting = new Set<string>();
  const leafStep = orientation === "horizontal" ? 230 : 280;
  let leaf = 0;
  function place(id: string, depth: number): number {
    if (positions.has(id)) return orientation === "horizontal" ? positions.get(id)!.y : positions.get(id)!.x;
    if (visiting.has(id)) return 80 + leaf++ * leafStep;
    visiting.add(id);
    const descendants = (outgoing.get(id) ?? []).filter(child => !visiting.has(child));
    const xs = descendants.map(child => place(child, depth + 1));
    const x = xs.length ? xs.reduce((sum, n) => sum + n, 0) / xs.length : 80 + leaf++ * leafStep;
    positions.set(id, orientation === "horizontal" ? { x: 70 + depth * 280, y: x } : { x, y: 70 + depth * 230 }); visiting.delete(id); return x;
  }
  for (const node of document.nodes.filter(node => !children.has(node.id))) place(node.id, 0);
  for (const node of document.nodes) if (!positions.has(node.id)) place(node.id, 0);
  return { ...document, orientation, nodes: document.nodes.map(node => ({ ...node, ...positions.get(node.id)! })) };
}

/** A free input may attach to a nearby upstream output. Existing inputs are never rewired. */
export function findAttachmentParent(document: NetworkDocument, position: {x:number;y:number}, kind: NetworkNodeKind, excludeId?:string): NetworkNode | undefined {
  if (kind === "source" || excludeId && document.edges.some(edge => edge.to === excludeId)) return;
  const horizontal = networkOrientation(document) === "horizontal";
  const descendants = new Set<string>();
  const queue = excludeId ? [excludeId] : [];
  while(queue.length) { const id = queue.pop()!; if(descendants.has(id)) continue; descendants.add(id); queue.push(...document.edges.filter(edge=>edge.from===id).map(edge=>edge.to)); }
  return document.nodes.filter(node => {
    if(node.kind === "load" || node.id === excludeId || descendants.has(node.id)) return false;
    const along = horizontal ? position.x-node.x-208 : position.y-node.y-132;
    const across = horizontal ? Math.abs(position.y-node.y) : Math.abs(position.x-node.x);
    return along >= 25 && along <= 210 && across <= (horizontal ? 260 : 320);
  }).sort((a,b) => {
    const distance = (node:NetworkNode) => horizontal ? Math.hypot(position.x-node.x-208,position.y-node.y) : Math.hypot(position.x-node.x,position.y-node.y-132);
    return distance(a)-distance(b);
  })[0];
}

export function nextNetworkPosition(document:NetworkDocument, parent?:NetworkNode):{x:number;y:number} {
  const horizontal=networkOrientation(document)==="horizontal";
  let x=parent ? parent.x+(horizontal?280:0) : 70;
  let y=parent ? parent.y+(horizontal?0:230) : 80;
  for(let i=0;i<150&&document.nodes.some(node=>Math.abs(node.x-x)<228&&Math.abs(node.y-y)<195);i++) {
    if(horizontal)y+=230;else x+=280;
  }
  return {x:Math.min(NETWORK_COORDINATE_LIMIT,x),y:Math.min(NETWORK_COORDINATE_LIMIT,y)};
}
