import type { LegendDoc, LegendStyle } from "./legend";

/** Document view coordinates. These values never enter the exported legend. */
export const LEGEND_ZOOM_BASE = 4;
export const LEGEND_ZOOM_MIN = 0.5;
export const LEGEND_ZOOM_MAX = 16;

export function clampLegendZoom(value: number): number {
  return Math.max(LEGEND_ZOOM_MIN, Math.min(LEGEND_ZOOM_MAX, Number.isFinite(value) ? value : LEGEND_ZOOM_BASE));
}

export function fitLegendZoom(width: number, height: number, availableWidth: number, availableHeight: number, mode: "width" | "page"): number {
  const horizontal = Math.max(1, availableWidth) / Math.max(1, width);
  return clampLegendZoom(mode === "width" ? horizontal : Math.min(horizontal, Math.max(1, availableHeight) / Math.max(1, height)));
}

export interface LayerColorSource { color?: string; layer_colors?: string[]; visible_layer_colors?: string[] }

/** Original plan colours are metadata; a manual monochrome override is separate. */
export function legendLayerColors(item: LayerColorSource): string[] {
  return [...new Set([...(item.layer_colors ?? []), item.color ?? ""].filter(color => /^#[0-9a-f]{6}$/i.test(color)).map(color => color.toLowerCase()))];
}

export function legendItemColors(item: LayerColorSource & { parts?: LayerColorSource[] }): string[] {
  return [...new Set([item, ...(item.parts ?? [])].flatMap(legendLayerColors))];
}

/** Filter repetitions of this drawing, keeping its original source palette. */
export function legendVisibleLayerColors(item: LayerColorSource): string[] {
  const originals = legendLayerColors(item);
  const chosen = new Set((item.visible_layer_colors ?? []).map(color => color.toLowerCase()).filter(color => originals.includes(color)));
  return chosen.size ? originals.filter(color => chosen.has(color)) : originals;
}

/** Each semantic part keeps its own colour choice; a parent never filters it. */
export function legendVisibleItemColors(item: LayerColorSource & { parts?: LayerColorSource[] }): string[] {
  return [...new Set([item, ...(item.parts ?? [])].flatMap(legendVisibleLayerColors))];
}

/** An explicit, undoable preset. Merely opening an old legend never applies it. */
export function compactLegendStyle(style: LegendStyle): LegendStyle {
  return { ...style, compact_flow: true, columns: 3, grid: "dicht", row: 6, text_offset: 8,
    text_size: 2.8, symbol_scale: 1, symbol_size: "tile", normalize_size: true,
    entry_gap: 0, section_gap: 0, text_lines: 0, pdf_lines: "proportional" };
}

/** Explicit preset also replaces the former default accent, never custom colours. */
export function compactLegendDocument(doc: LegendDoc): LegendDoc {
  const general = doc.general_section;
  const oldAccent = general?.header?.toLowerCase();
  const accent = !oldAccent || ["#808080", "#1c7ed6"].includes(oldAccent) ? "#007f91" : general!.header;
  return { ...doc, style: { ...compactLegendStyle(doc.style), margin: 5 },
    blocks: doc.blocks.map(block => ({ ...block, style: { ...block.style, padding: 1.2 } })), general_section: {
    title: "Allgemein", header_text: "#ffffff", text: "#000000", title_scale: 1,
    ...general, header: accent,
  } };
}

/** Optional denser layout; the content still determines the exported height. */
export function a4CompactLegendDocument(doc: LegendDoc): LegendDoc {
  const compact = compactLegendDocument(doc);
  return { ...compact, style: { ...compact.style, columns: 4, text_size: 2.6, margin: 3.5, width: 200,
    pdf_lines: "proportional" },
    title: { ...compact.title, size_mm: 4.5 },
    blocks: compact.blocks.map(block => ({ ...block, style: { ...block.style, padding: 0.5 } })),
  };
}
