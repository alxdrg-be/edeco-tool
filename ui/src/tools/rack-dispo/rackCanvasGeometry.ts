/** Port geometry never determines the HE height of a device. */
export function rackPortGrid(portCount: number): { number: number; column: number; row: number; columns: number; rows: number }[] {
  if (!Number.isInteger(portCount) || portCount < 1 || portCount > 288) return [];
  const columns = portCount <= 24 ? portCount : 24;
  const rows = Math.ceil(portCount / columns);
  return Array.from({ length: portCount }, (_, index) => ({ number: index + 1, column: index % columns, row: Math.floor(index / columns), columns, rows }));
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
