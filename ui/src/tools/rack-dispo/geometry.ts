import { HE_MM, PANEL_WIDTH_MM } from './types.ts';
import type { DeviceProfile, Placement, PlacementRect, Rack, RackGeometry } from './types.ts';

export { HE_MM, PANEL_WIDTH_MM } from './types.ts';
/** The centred rail is a drawing convention, not a verified manufacturer's mounting position. */
export function rackGeometry(rack: Rack): RackGeometry {
  const railHeightMm = rack.units * HE_MM;
  const railTopMm = (rack.heightMm - railHeightMm) / 2;
  const railLeftMm = (rack.widthMm - PANEL_WIDTH_MM) / 2;
  return { widthMm: rack.widthMm, heightMm: rack.heightMm, railLeftMm,
    railRightMm: railLeftMm + PANEL_WIDTH_MM, railTopMm, railBottomMm: railTopMm + railHeightMm, railHeightMm };
}
export function unitTopY(rack: Rack, startUnit: number, units = 1): number {
  return rackGeometry(rack).railBottomMm - (startUnit - 1 + units) * HE_MM;
}
/** Pointer is the top-left equipment anchor. Does not conceal out-of-bounds previews. */
export function rawStartUnitFromY(rack: Rack, yMm: number, units = 1): number {
  return Math.round((rackGeometry(rack).railBottomMm - yMm) / HE_MM - units) + 1;
}
export function startUnitFromY(rack: Rack, yMm: number, units = 1): number {
  return Math.max(1, Math.min(rack.units - units + 1, rawStartUnitFromY(rack, yMm, units)));
}
export function isZeroSide(side: Placement['side']): boolean { return side.startsWith('zero-'); }
export function placementRect(rack: Rack, placement: Placement, profile: DeviceProfile): PlacementRect {
  const g = rackGeometry(rack);
  if (isZeroSide(placement.side)) {
    const width = Math.max(12, Math.min(36, (rack.widthMm - PANEL_WIDTH_MM) / 2 - 5));
    const x = placement.side === 'zero-right' ? g.railRightMm + 5
      : placement.side === 'zero-left' ? Math.max(0, g.railLeftMm - width - 5) : g.railRightMm - width;
    return { x, y: g.railBottomMm - (placement.zeroStartMm ?? 0) - (placement.zeroHeightMm ?? HE_MM * 4),
      width, height: placement.zeroHeightMm ?? HE_MM * 4 };
  }
  return { x: g.railLeftMm, y: unitTopY(rack, placement.startUnit, profile.units), width: PANEL_WIDTH_MM, height: profile.units * HE_MM };
}
export function unitRangesOverlap(aStart: number, aUnits: number, bStart: number, bUnits: number): boolean {
  const epsilon = 0.000001;
  return aUnits > 0 && bUnits > 0 && aStart < bStart + bUnits - epsilon && bStart < aStart + aUnits - epsilon;
}
export function portGrid(portCount: number): { columns: number; rows: number } {
  if (portCount <= 0) return { columns: 0, rows: 0 };
  const columns = Math.min(24, portCount);
  return { columns, rows: Math.ceil(portCount / columns) };
}
