import type { CalculationResult, Inputs } from "./types.ts";
import { fireLoadRowsToPositions, parseFireLoadRows, type FireLoadPosition } from "./installation.ts";

/** Ten schematic places, two trays of five. The count itself stays in the text. */
export const ESCAPE_SLOT_COUNT = 10;
export const ESCAPE_EMPTY_TEXT = "Noch keine Kabel im Fluchtweg";
export const escapeCountLabel = (count: number) => `${count.toLocaleString("de-CH")} Kabel erfasst`;

export type EscapeTone = "ok" | "warning" | "error" | "neutral";
export type EscapeCableTone = Exclude<EscapeTone, "neutral">;

export interface EscapeCable {
  name: string;
  quantity: number;
  tone: EscapeCableTone;
}

export interface EscapeRouteState {
  id: "single" | "before" | "after";
  label: string;
  count: number;
  countLabel: string;
  shown: number;
  density: number | null;
  limit: number | null;
  lengthLabel: string;
  horizontal: boolean;
  exceeded: boolean;
  cables: EscapeCable[];
  slots: Array<EscapeCableTone | null>;
  summary: EscapeTone;
  headline: string;
  empty: boolean;
}

const formatMj = (value: number) => value.toLocaleString("de-CH", { maximumFractionDigits: 1 });

function metric(result: CalculationResult, label: string): number | null {
  const value = result.metrics.find(item => item.label === label)?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function whole(raw: string | undefined): number {
  if (!raw) return 0;
  const value = Number(raw.replace(",", "."));
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function finite(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Green only when the route is horizontal, under the entered limit, and the cable proof is documented. */
export function escapeCableTone(evidence: FireLoadPosition["evidence"], approvable: boolean, exceeded: boolean): EscapeCableTone {
  if (evidence === "critical" || exceeded) return "error";
  if (evidence !== "documented" || !approvable) return "warning";
  return "ok";
}

export function placeEscapeSlots(cables: readonly EscapeCable[], slotCount = ESCAPE_SLOT_COUNT): Array<EscapeCableTone | null> {
  const slots: Array<EscapeCableTone | null> = Array.from({ length: slotCount }, () => null);
  let index = 0;
  for (const cable of cables) {
    for (let drawn = 0; drawn < cable.quantity && index < slotCount; drawn += 1) slots[index++] = cable.tone;
  }
  return slots;
}

function readPositions(raw: string | undefined): FireLoadPosition[] | null {
  if (!raw) return null;
  try {
    return fireLoadRowsToPositions(parseFireLoadRows(raw));
  } catch {
    return null;
  }
}

function buildState(options: {
  id: EscapeRouteState["id"];
  label: string;
  count: number | null;
  density: number | null;
  limit: number | null;
  lengthLabel: string;
  horizontal: boolean;
  positions: FireLoadPosition[] | null;
  fallback: EscapeTone;
}): EscapeRouteState {
  const limit = options.horizontal ? options.limit : null;
  const density = options.density;
  const exceeded = limit !== null && density !== null && density > limit + 1e-9;
  const approvable = options.horizontal && limit !== null && density !== null && !exceeded;
  const source = (options.positions ?? []).filter(position => position.quantity > 0);
  const summed = source.reduce((sum, position) => sum + position.quantity, 0);
  const count = options.count ?? summed;
  let cables: EscapeCable[] = source.map(position => ({
    name: position.name,
    quantity: position.quantity,
    tone: escapeCableTone(position.evidence, approvable, exceeded),
  }));
  if (!cables.length && count > 0) {
    const tone: EscapeCableTone = options.fallback === "error" || exceeded ? "error" : options.fallback === "ok" && approvable ? "ok" : "warning";
    cables = [{ name: "Erfasste Kabel", quantity: count, tone }];
  }
  const slots = placeEscapeSlots(cables);
  const summary: EscapeTone = count === 0 ? "neutral" : exceeded || cables.some(cable => cable.tone === "error") ? "error" : cables.some(cable => cable.tone === "warning") ? "warning" : "ok";
  const value = density === null ? "–" : formatMj(density);
  return {
    id: options.id,
    label: options.label,
    count,
    countLabel: escapeCountLabel(count),
    shown: slots.filter(slot => slot !== null).length,
    density,
    limit,
    lengthLabel: options.lengthLabel,
    horizontal: options.horizontal,
    exceeded,
    cables,
    slots,
    summary,
    headline: limit === null ? `${value} MJ/m` : `${value} / ${formatMj(limit)} MJ/m`,
    empty: count === 0,
  };
}

/** Picture of an already calculated fire load. Does not recompute the sum. */
export function escapeRouteStates(calculatorId: string, input: Inputs, result: CalculationResult): EscapeRouteState[] {
  if (calculatorId !== "brandlast" && calculatorId !== "premium-brandlast") return [];
  const premium = calculatorId === "premium-brandlast";
  const legacy = input.fireloadMode === "legacy";
  const horizontal = premium ? input.routeType !== "vertical" : input.route !== "vertical";
  const length = finite(premium ? input.route : input.length);
  const lengthLabel = length !== null && length > 0 ? `L = ${formatMj(length)} m` : "Länge prüfen";
  const limit = finite(input.limit);
  const fallback: EscapeTone = result.status.tone === "ok" || result.status.tone === "error" || result.status.tone === "warning" ? result.status.tone : "neutral";
  const shared = { limit, lengthLabel, horizontal, fallback };

  if (premium && legacy) {
    const evidence: FireLoadPosition["evidence"] = input.basis === "documented" ? "documented" : "open";
    const group = (prefix: "countBefore" | "countAfter", name: string): FireLoadPosition[] => [1, 2].map(index => ({
      name: `${name} ${index}`, mjPerMeter: 0, quantity: whole(input[`${prefix}${index}`]), length: 0, evidence,
    }));
    return [
      buildState({ ...shared, id: "before", label: "Vorher", count: whole(input.countBefore1) + whole(input.countBefore2), density: metric(result, "Vorher"), positions: group("countBefore", "Gruppe") }),
      buildState({ ...shared, id: "after", label: "Nachher", count: whole(input.countAfter1) + whole(input.countAfter2), density: metric(result, "Nachher"), positions: group("countAfter", "Gruppe") }),
    ];
  }

  if (premium && input.comparisonEnabled !== "no") {
    return [
      buildState({ ...shared, id: "before", label: "Vorher", count: metric(result, "Kabel vorher"), density: metric(result, "Vorher"), positions: readPositions(input.fireloadRows) }),
      buildState({ ...shared, id: "after", label: "Nachher", count: metric(result, "Kabel nachher"), density: metric(result, "Nachher"), positions: readPositions(input.fireloadRowsAfter) }),
    ];
  }

  const positions = legacy
    ? [1, 2, 3].map(line => ({
      name: `Position ${line}`,
      mjPerMeter: 0,
      quantity: whole(input[`n${line}`]),
      length: 0,
      evidence: (input.proof === "documented" || input.proof === "critical" ? input.proof : "open") as FireLoadPosition["evidence"],
    }))
    : readPositions(input.fireloadRows);
  return [buildState({
    ...shared,
    id: "single",
    label: "Erfasster Bestand",
    count: metric(result, "Kabel total"),
    density: metric(result, "Brandlast bezogen auf Fluchtweg"),
    positions,
  })];
}
