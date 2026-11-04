import { NETWORK_EDGE_FIELDS, NETWORK_NODE_FIELDS, calculateNetwork } from "./networkModel.ts";
import { networkCalculationKey } from "./networkReview.ts";
import type { Field } from "./workbench/types.ts";
import type { NetworkDocument, NetworkResult } from "./networkTypes.ts";

export interface NetworkVariantSelection { kind: "node" | "edge"; id: string }
export interface NetworkVariantChange extends NetworkVariantSelection { field: string; value: string }
export interface NetworkVariantPreview {
  baseKey: string;
  change: NetworkVariantChange;
  beforeValue: string;
  beforeDocument: NetworkDocument;
  afterDocument: NetworkDocument;
  before: NetworkResult;
  after: NetworkResult;
}

/** Only project dimensions/device choices are trialled, never invented proof data. */
export function networkVariantFields(document: NetworkDocument, selection: NetworkVariantSelection): Field[] {
  if (selection.kind === "edge") {
    if (!document.edges.some(edge => edge.id === selection.id)) return [];
    return NETWORK_EDGE_FIELDS.filter(field => ["area", "peArea", "neutralArea", "length"].includes(field.key));
  }
  const node = document.nodes.find(node => node.id === selection.id);
  if (!node || node.kind !== "protection" || !["LS", "RCBO"].includes(node.values.device)) return [];
  return NETWORK_NODE_FIELDS.protection.filter(field => ["curve", "rated"].includes(field.key));
}

export function networkVariantValue(document: NetworkDocument, selection: NetworkVariantSelection, field: string): string {
  const item = selection.kind === "node" ? document.nodes.find(node => node.id === selection.id) : document.edges.find(edge => edge.id === selection.id);
  return item?.values[field] ?? "";
}

function changedDocument(document: NetworkDocument, change: NetworkVariantChange): NetworkDocument {
  const field = networkVariantFields(document, change).find(field => field.key === change.field);
  if (!field) throw new Error("Für dieses Element ist die gewählte Variantenprüfung nicht verfügbar.");
  if (typeof change.value !== "string" || change.value.length > 40 || !change.value.trim()) throw new Error("Einen gültigen Variantenwert eingeben.");
  if (field.options && !field.options.some(option => option.value === change.value)) throw new Error("Einen vorhandenen Listenwert wählen.");
  // Clone every nested value object: neither calculation nor later editing can
  // accidentally write into the current document through a preview reference.
  return {
    ...document,
    nodes: document.nodes.map(node => ({ ...node, values: { ...node.values, ...(change.kind === "node" && node.id === change.id ? { [change.field]: change.value } : {}) } })),
    edges: document.edges.map(edge => ({ ...edge, values: { ...edge.values, ...(change.kind === "edge" && edge.id === change.id ? { [change.field]: change.value } : {}) } })),
  };
}

/** A complete new network calculation, with no change to the live project. */
export function previewNetworkVariant(document: NetworkDocument, change: NetworkVariantChange): NetworkVariantPreview {
  const beforeValue = networkVariantValue(document, change, change.field);
  if (beforeValue === change.value) throw new Error("Der Variantenwert entspricht bereits dem aktuellen Wert.");
  const snapshot = structuredClone(document), candidate = changedDocument(snapshot, change);
  return { baseKey: networkCalculationKey(snapshot), change: { ...change }, beforeValue, beforeDocument: snapshot, afterDocument: candidate, before: calculateNetwork(snapshot), after: calculateNetwork(candidate) };
}

export function networkVariantIsCurrent(document: NetworkDocument, preview: NetworkVariantPreview): boolean {
  return preview.baseKey === networkCalculationKey(document);
}

/** Rebuild from the live document, retaining any canvas moves made since preview. */
export function applyNetworkVariant(document: NetworkDocument, preview: NetworkVariantPreview): NetworkDocument {
  if (!networkVariantIsCurrent(document, preview)) throw new Error("Die Eingaben wurden seit der Vorschau geändert. Variante erneut prüfen.");
  const candidate = changedDocument(document, preview.change);
  if (!calculateNetwork(candidate).valid) throw new Error("Die Variante enthält ungültige Eingaben. Vor der Übernahme berichtigen.");
  return candidate;
}
