/** Port geometry never determines the HE height of a device. */
export function rackPortGrid(portCount: number): { number: number; column: number; row: number; columns: number; rows: number }[] {
  if (!Number.isInteger(portCount) || portCount < 1 || portCount > 288) return [];
  const columns = portCount <= 24 ? portCount : 24;
  const rows = Math.ceil(portCount / columns);
  return Array.from({ length: portCount }, (_, index) => ({ number: index + 1, column: index % columns, row: Math.floor(index / columns), columns, rows }));
}

/** Keep the cabinet partly in view. The padding shrinks with the zoom so a fitted rack can still sit centred. */
export function limitRackViewport<T extends { x: number; y: number; scale: number }>(
  view: T, rack: { widthMm: number; heightMm: number }, size: { width: number; height: number },
): T {
  if (!(size.width > 0) || !(size.height > 0) || !(view.scale > 0)) return view;
  const viewW = size.width / view.scale, viewH = size.height / view.scale;
  const padX = Math.min(rack.widthMm * .45, 180 / view.scale), padY = Math.min(rack.heightMm * .25, 180 / view.scale);
  let minX = -viewW + padX, maxX = rack.widthMm - padX;
  if (minX > maxX) { const mid = (rack.widthMm - viewW) / 2; minX = mid; maxX = mid; }
  let minY = -viewH + padY, maxY = rack.heightMm - padY;
  if (minY > maxY) { const mid = (rack.heightMm - viewH) / 2; minY = mid; maxY = mid; }
  return { ...view, x: Math.min(maxX, Math.max(minX, view.x)), y: Math.min(maxY, Math.max(minY, view.y)) };
}

export function readRackDragProfile(raw: string): string | null {
  if (!raw || raw.length > 1024) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("profileId" in value)) return null;
    const id = (value as { profileId: unknown }).profileId;
    return typeof id === "string" && id.length > 0 && id.length < 200 ? id : null;
  } catch { return null; }
}
