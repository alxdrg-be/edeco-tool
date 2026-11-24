import type { Point, Polygons } from "./model";

function inside(x: number, y: number, ring: Point[]) {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) within = !within;
  }
  return within;
}

/** A label fits entirely inside this circle, including in a space with openings. */
export function roomLabelAnchor(polygons: Polygons) {
  let best: { x: number; y: number; radius: number } | null = null;
  for (const [outer, ...holes] of polygons) {
    if (!outer?.length) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of outer) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const x = (minX + maxX) / 2, y = (minY + maxY) / 2;
    if (!inside(x, y, outer) || holes.some(hole => inside(x, y, hole))) continue;
    let radius = Infinity;
    for (const ring of [outer, ...holes]) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[j], [bx, by] = ring[i];
        const dx = bx - ax, dy = by - ay, squaredLength = dx * dx + dy * dy;
        const t = squaredLength ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / squaredLength)) : 0;
        radius = Math.min(radius, Math.hypot(x - ax - t * dx, y - ay - t * dy));
      }
    }
    if (radius > (best?.radius ?? 0)) best = { x, y: -y, radius };
  }
  return best;
}
