import type { LegendItem } from "./legend";

/** A filtered combination may display a later stored part as its visible head. */
export function legendSourceSelection(item: LegendItem, prims: readonly { t: string; id?: string; key?: string; source_part?: number | null }[]) {
  const drawing = prims.find(prim => prim.t === "symbol" && prim.id === item.id);
  const visibleKey = drawing?.key;
  const sources = [item, ...(item.parts ?? [])];
  const matches = visibleKey ? sources.flatMap((part, index) => part.symbol_key === visibleKey ? [index] : []) : [0];
  const sourcePart = drawing?.source_part != null
    ? Number.isInteger(drawing.source_part) && sources[drawing.source_part]?.symbol_key === visibleKey ? drawing.source_part : -1
    : matches.length === 1 ? matches[0] : -1;
  return { visibleKey, initialPart: Math.max(0, sourcePart), synthetic: sourcePart < 0 };
}
