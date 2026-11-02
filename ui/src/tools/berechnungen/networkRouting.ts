import type { NetworkEdge, NetworkNode, NetworkOrientation } from "./networkTypes.ts";

export const NETWORK_NODE_WIDTH = 208;
export const NETWORK_NODE_HEIGHT = 132;
export interface NetworkPoint { x: number; y: number }
export interface NetworkRoute { path: string; points: NetworkPoint[]; labelX: number; labelY: number; blocked: boolean }
interface Rectangle { left: number; top: number; right: number; bottom: number }
const point = (x: number, y: number): NetworkPoint => ({ x, y });

export function segmentHitsRectangle(a: NetworkPoint, b: NetworkPoint, box: Rectangle): boolean {
  if (a.x === b.x) return a.x > box.left && a.x < box.right && Math.max(a.y, b.y) > box.top && Math.min(a.y, b.y) < box.bottom;
  if (a.y === b.y) return a.y > box.top && a.y < box.bottom && Math.max(a.x, b.x) > box.left && Math.min(a.x, b.x) < box.right;
  return true;
}
function clean(points: NetworkPoint[]): NetworkPoint[] {
  const result: NetworkPoint[] = [];
  for (const p of points) {
    const last = result.at(-1), previous = result.at(-2);
    if (last && last.x === p.x && last.y === p.y) continue;
    if (last && previous && (last.x === previous.x && last.x === p.x || last.y === previous.y && last.y === p.y)) result.pop();
    result.push(p);
  }
  return result;
}
const length = (points: NetworkPoint[]) => points.reduce((sum, p, index) => index ? sum + Math.abs(p.x - points[index-1].x) + Math.abs(p.y - points[index-1].y) : 0, 0);

/** Deterministic orthogonal routes avoid component and annotation boxes. */
export function routeNetworkEdge(edge: NetworkEdge, nodes: ReadonlyMap<string, NetworkNode>, orientation: NetworkOrientation, index = 0, incoming: ReadonlySet<string> = new Set()): NetworkRoute | null {
  const from = nodes.get(edge.from), to = nodes.get(edge.to);
  if (!from || !to) return null;
  const horizontal = orientation === "horizontal", w = NETWORK_NODE_WIDTH, h = NETWORK_NODE_HEIGHT;
  const start = horizontal ? point(from.x+w, from.y+h/2) : point(from.x+w/2, from.y+h);
  const end = horizontal ? point(to.x, to.y+h/2) : point(to.x+w/2, to.y);
  const labelX = horizontal ? to.x + 20 : end.x < start.x - 20 ? end.x - 175 : end.x + 15;
  const labelY = horizontal ? to.y + h + 28 : to.y - 35;
  const obstacles = [...nodes.values()].filter(node => node.id !== edge.from && node.id !== edge.to).map(node => ({
    left: node.x - 7, right: node.x+w+7, top: node.y-7,
    bottom: node.y+h+7+(horizontal && incoming.has(node.id) ? 62 : 0),
  }));
  const clear = (points: NetworkPoint[]) => points.every((p, i) => !i || !obstacles.some(box => segmentHitsRectangle(points[i-1], p, box)));
  const candidates: NetworkPoint[][] = [];
  if (horizontal && end.x >= start.x+24) { const x = (start.x+end.x)/2; candidates.push([start, point(x,start.y), point(x,end.y), end]); }
  if (!horizontal && end.y >= start.y+24) { const y = (start.y+end.y)/2; candidates.push([start, point(start.x,y), point(end.x,y), end]); }
  const all = [...nodes.values()];
  const minX = Math.min(...all.map(node => node.x))-55-index%4*18, maxX = Math.max(...all.map(node => node.x+w))+55+index%4*18;
  const minY = Math.min(...all.map(node => node.y))-55-index%4*18, maxY = Math.max(...all.map(node => node.y+h+(horizontal && incoming.has(node.id) ? 62 : 0)))+70+index%4*18;
  for (const exit of [12, 22, 36]) {
    if (horizontal) for (const y of [minY,maxY]) candidates.push([start, point(start.x+exit,start.y), point(start.x+exit,y), point(end.x-exit,y), point(end.x-exit,end.y), end]);
    else for (const x of [minX,maxX]) candidates.push([start, point(start.x,start.y+exit), point(x,start.y+exit), point(x,end.y-exit), point(end.x,end.y-exit), end]);
  }
  const direct = candidates[0];
  const chosen = direct && clear(direct) ? direct : candidates.filter(clear).sort((a,b) => length(a)-length(b))[0];
  if (!chosen) return { path: "", points: [], labelX, labelY, blocked: true };
  const points = clean(chosen);
  return { path: points.map((p,i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(""), points, labelX, labelY, blocked: false };
}
