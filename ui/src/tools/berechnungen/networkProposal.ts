import { numeric } from "./engineering.ts";
import type { NetworkDocument, NetworkNode } from "./networkTypes.ts";

const RATINGS = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000];
const GENERIC_LABELS = new Set([
  "Einspeisung NS", "Unterverteilung", "Zähler", "Hausanschluss HAK", "Hausanschlusskasten HAK", "Sammelschiene",
  "Schutzorgan", "LS-Schalter", "NH-Sicherung", "Leistungsschalter", "FI / RCD", "FI-LS / RCBO", "Motorschutz", "Lastschalter",
]);
const AUTO_LABEL = /^(LS \S+|FI\/LS \S+|FI \d+ A|NH \d+ A|MCCB \d+ A|Motorschutz \d+ A|Schalter \d+ A|Einspeisung \d+ A|UV \d+ A|Zähler \d+ A|HAK \d+ A|Schiene \d+ A)$/;

type Complex = { re: number; im: number };
type Triple = [Complex, Complex, Complex];
const angles = [0, -2 * Math.PI / 3, 2 * Math.PI / 3];
const rotate = (phase: number): Complex => ({ re: Math.cos(angles[phase]), im: Math.sin(angles[phase]) });
const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const magnitude = (value: Complex) => Math.hypot(value.re, value.im);
const zero = (): Triple => [{ re: 0, im: 0 }, { re: 0, im: 0 }, { re: 0, im: 0 }];

export interface NetworkProposal {
  document: NetworkDocument;
  changes: { nodeId: string; label: string; field: string; from: string; to: string; ampere: number }[];
  notes: string[];
}

/** Smallest listed device current that can carry the calculated load current. Nothing above 2000 A is invented. */
export function nextStandardRating(ampere: number): string | null {
  if (!Number.isFinite(ampere) || ampere < 0) return null;
  const rating = RATINGS.find(value => value + 1e-6 >= ampere);
  return rating === undefined ? null : String(rating);
}

function proposedLabel(node: NetworkNode, rated: string): string | null {
  const device = node.values.device ?? "";
  if (node.kind === "source") return `Einspeisung ${rated} A`;
  if (node.kind === "protection") {
    if (device === "LS") return `LS ${node.values.curve || ""}${rated}`;
    if (device === "RCBO") return `FI/LS ${node.values.curve || ""}${rated}`;
    if (device === "RCD") return `FI ${rated} A`;
    if (device === "NH") return `NH ${rated} A`;
    if (device === "MCCB") return `MCCB ${rated} A`;
    if (device === "MOTOR") return `Motorschutz ${rated} A`;
    if (device === "SWITCH") return `Schalter ${rated} A`;
  }
  if (node.kind === "distribution") {
    if (device === "meter") return `Zähler ${rated} A`;
    if (device === "hak") return `HAK ${rated} A`;
    if (device === "busbar") return `Schiene ${rated} A`;
    return `UV ${rated} A`;
  }
  return null;
}

function replaceLabel(label: string): boolean {
  return GENERIC_LABELS.has(label) || AUTO_LABEL.test(label);
}

/** Drop invented sizing values. Lengths, known powers and the chosen device types stay. */
export function networkSkeleton(document: NetworkDocument): NetworkDocument {
  const next = structuredClone(document);
  for (const node of next.nodes) {
    if (node.kind === "source") {
      node.values.maxCurrent = "";
      node.values.r = "";
      node.values.x = "";
      node.values.ik = "";
      node.values.loopImpedance = "";
      node.values.loopKnown = "no";
    } else if (node.kind === "distribution" || node.kind === "protection") node.values.rated = "";
  }
  for (const edge of next.edges) {
    edge.values.area = "";
    edge.values.iz = "";
    edge.values.izMode = "open";
  }
  return next;
}

/**
 * Propose rated currents from known load power only.
 * Cable section, Iz, short-circuit data and device curves are left untouched.
 */
export function proposeNetworkRatings(document: NetworkDocument): NetworkProposal {
  const next = structuredClone(document);
  const notes = ["Empfohlene Nennströme: kleinster Listenwert ab dem Betriebsstrom der bekannten Leistung. Querschnitt, Iz, Ik, Quellenimpedanz, Kennlinie und Ausschaltvermögen bleiben unverändert und sind kein NIN-Nachweis."];
  const sources = next.nodes.filter(node => node.kind === "source");
  if (sources.length !== 1) {
    notes.push("Genau eine Einspeisung ist nötig. Es wurde nichts gesetzt.");
    return { document, changes: [], notes };
  }
  const source = sources[0];
  const system = source.values.phases;
  const voltage = source.values.voltage;
  if ((system !== "3" || voltage !== "400") && (system !== "1" || voltage !== "230")) {
    notes.push("Das Modell kennt 400 V dreiphasig oder 230 V einphasig. Die Einspeisung zuerst so wählen.");
    return { document, changes: [], notes };
  }
  const nominal = system === "3" ? 400 : 230;
  const byId = new Map(next.nodes.map(node => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  for (const edge of next.edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  const seen = new Set<string>();
  function demand(id: string): { currents: Triple; gap: string | null } {
    if (seen.has(id)) return { currents: zero(), gap: "Ring" };
    seen.add(id);
    const node = byId.get(id);
    if (!node) return { currents: zero(), gap: id };
    let currents = zero();
    let gap: string | null = null;
    if (node.kind === "load") {
      try {
        const power = numeric(node.values.power ?? "", node.label || "Leistung", 0, 1e6);
        const cos = numeric(node.values.cosPhi ?? "", "Leistungsfaktor", 0, 1);
        const factor = numeric(node.values.diversity ?? "1", "Gleichzeitigkeit", 0, 1, true);
        const connection = node.values.phases;
        if (connection !== "1" && connection !== "3") throw new Error("Anschluss");
        if (system === "1" && connection === "3") throw new Error("Phasen");
        const powerKW = power * factor;
        const perPhase = connection === "3" ? powerKW * 1000 / (Math.sqrt(3) * nominal * cos) : powerKW * 1000 / (230 * cos);
        const phi = Math.acos(cos);
        const base = { re: perPhase * cos, im: -perPhase * Math.sin(phi) };
        if (connection === "1") {
          const phase = ["L1", "L2", "L3"].indexOf(node.values.phase);
          if (phase < 0 || (system === "1" && phase !== 0)) throw new Error("Leiter");
          currents[phase] = mul(base, rotate(phase));
        } else currents = [0, 1, 2].map(phase => mul(base, rotate(phase))) as Triple;
      } catch {
        gap = node.label || node.id;
      }
    }
    for (const child of outgoing.get(id) ?? []) {
      const down = demand(child);
      currents = currents.map((value, index) => add(value, down.currents[index])) as Triple;
      if (down.gap) gap = gap ?? down.gap;
    }
    seen.delete(id);
    return { currents, gap };
  }
  const changes: NetworkProposal["changes"] = [];
  const gaps = new Set<string>();
  for (const node of next.nodes) {
    if (node.kind !== "source" && node.kind !== "protection" && node.kind !== "distribution") continue;
    const load = demand(node.id);
    if (load.gap) { gaps.add(load.gap); continue; }
    const ampere = Math.max(...load.currents.map(magnitude));
    if (!(ampere > 0)) { gaps.add(`${node.label}: keine aktive Last`); continue; }
    const rated = nextStandardRating(ampere);
    if (!rated) { gaps.add(`${node.label}: ${ampere.toLocaleString("de-CH", { maximumFractionDigits: 1 })} A liegt über 2000 A`); continue; }
    const field = node.kind === "source" ? "maxCurrent" : "rated";
    const from = node.values[field] ?? "";
    if (from === rated) continue;
    node.values[field] = rated;
    const label = proposedLabel(node, rated);
    if (label && replaceLabel(node.label)) node.label = label;
    changes.push({ nodeId: node.id, label: node.label, field, from, to: rated, ampere });
  }
  if (!changes.length) notes.push("Kein Nennstrom geändert.");
  else notes.push(`${changes.length} Nennstrom${changes.length === 1 ? "" : "werte"} gesetzt: ${changes.map(change => `${change.label} ${change.to} A`).join(", ")}.`);
  for (const gap of gaps) {
    if (gap === "Ring") notes.push("Ein Ring lässt sich aus der Last nicht eindeutig zuordnen. An diesem Zweig wurde nichts gesetzt.");
    else if (gap.endsWith("keine aktive Last")) notes.push(`${gap}.`);
    else notes.push(`${gap}: Leistung, Leistungsfaktor oder Anschluss fehlt. Davor wurde nichts gesetzt.`);
  }
  return { document: changes.length ? next : document, changes, notes };
}
