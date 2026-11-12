import { LegendPrim } from "../../api";
import { GeneralSection, LegendDoc, LineStyle, SectionStyle } from "../../legend";

export const DASH: Record<LineStyle, string> = { solid: "", dashed: "2 1.2", dotted: "0.2 1", dashdot: "2 0.8 0.2 0.8" };

export const LINE_LABEL: Record<LineStyle, string> = { solid: "durchgezogen", dashed: "gestrichelt", dotted: "punktiert", dashdot: "Strich-Punkt" };

export const FREE_TEXT_HINT = "Freier Text ist ein Zusatztext in der Legende, kein Apparat. Er sitzt im Raster wie ein Eintrag und nutzt die gemeinsame Schriftgrösse.";

/** What is being dragged: an entry of the legend or a new symbol from the left lists. */
export type DragPayload =
  | { type: "move"; block: string; item: string }
  | { type: "add"; family_key: string | null; symbol_key: string; text: string; categories: string[] };

/** Where it lands: in front of `before` in `block` (null: at the end). */
export type DropTarget = { block: string; before: string | null; cell?: number };

/** Id of the entry a drop preview shows for a new symbol from the lists. */
export const DROP_ID = "__drop__";

/** Prims in drawing order, the ones of one entry (symbol, texts, hit area) together. */
export function groupByEntry(prims: LegendPrim[]): { item: string | null; prims: LegendPrim[] }[] {
  const out: { item: string | null; prims: LegendPrim[] }[] = [];
  const byItem = new Map<string, { item: string | null; prims: LegendPrim[] }>();
  for (const p of prims) {
    const item: string | undefined =
      p.t === "symbol" || (p.t === "hit" && p.kind === "item") ? p.id : p.t === "text" || p.t === "line" || p.t === "half" ? p.item : undefined;
    if (!item) {
      out.push({ item: null, prims: [p] });
      continue;
    }
    let g = byItem.get(item);
    if (!g) {
      g = { item, prims: [] };
      byItem.set(item, g);
      out.push(g);
    }
    g.prims.push(p);
  }
  return out;
}

/** Mix a colour with white (share 0 = colour, 1 = white). */
export function tint(color: string, share: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  return `#${[1, 3, 5]
    .map((i) => parseInt(color.slice(i, i + 2), 16))
    .map((c) => Math.round(c + (255 - c) * share).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function innerSvg(svg: string): string {
  const start = svg.indexOf(">") + 1;
  const end = svg.lastIndexOf("</svg>");
  return svg.slice(start, end > start ? end : undefined);
}

export type FieldFn = (apply: (d: LegendDoc, value: string) => LegendDoc) => {
  onFocus: () => void;
  onChange: (e: { target: { value: string } }) => void;
  onBlur: () => void;
};

export const COLOR_FIELDS: [keyof SectionStyle, string][] = [
  ["header", "Kopfleiste"],
  ["header_text", "Schrift Kopfleiste"],
  ["text", "Text"],
  ["symbol", "Linien und Hinweise"],
];

export function generalSectionOf(doc: LegendDoc): GeneralSection {
  return doc.general_section ?? { title: "Allgemein", header: "#007f91", header_text: "#ffffff", text: "#000000", title_scale: 1 };
}

export function formatStamp(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso || "");
  return m ? `${m[3]}.${m[2]}. ${m[4]}:${m[5]}` : "";
}
