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

export interface LayerColorSource { color?: string; layer_colors?: string[] }

/** Original plan colours are metadata; a manual monochrome override is separate. */
export function legendLayerColors(item: LayerColorSource): string[] {
  return [...new Set([...(item.layer_colors ?? []), item.color ?? ""].filter(color => /^#[0-9a-f]{6}$/i.test(color)).map(color => color.toLowerCase()))];
}

export function legendItemColors(item: LayerColorSource & { parts?: LayerColorSource[] }): string[] {
  return [...new Set([item, ...(item.parts ?? [])].flatMap(legendLayerColors))];
}
