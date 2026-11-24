export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Alignment { a: number; b: number; x: number; y: number }
export interface Region { left: number; top: number; right: number; bottom: number }

// Maps new-page pixels into the reference frame of the old page.
export function alignPair(oldA: Point, oldB: Point, newA: Point, newB: Point): Alignment {
  const dx = newB.x - newA.x, dy = newB.y - newA.y;
  const u = oldB.x - oldA.x, v = oldB.y - oldA.y;
  const length2 = dx * dx + dy * dy;
  if (length2 < 64 || u * u + v * v < 64) throw new Error("Passpunkte A und B bitte weiter auseinander setzen.");
  const a = (dx * u + dy * v) / length2, b = (dx * v - dy * u) / length2;
  return { a, b, x: oldA.x - a * newA.x + b * newA.y, y: oldA.y - b * newA.x - a * newA.y };
}

export function transform(point: Point, t: Alignment): Point {
  return { x: t.a * point.x - t.b * point.y + t.x, y: t.b * point.x + t.a * point.y + t.y };
}

export function unionFrame(old: Size, newer: Size, map: Alignment) {
  const corners = [[0, 0], [newer.width, 0], [0, newer.height], [newer.width, newer.height]]
    .map(([x, y]) => transform({ x, y }, map));
  const left = Math.min(0, ...corners.map(p => p.x)), top = Math.min(0, ...corners.map(p => p.y));
  const right = Math.max(old.width, ...corners.map(p => p.x)), bottom = Math.max(old.height, ...corners.map(p => p.y));
  const scale = Math.min(1, 2200 / Math.max(right - left, bottom - top));
  return { left, top, scale, width: Math.ceil((right - left) * scale), height: Math.ceil((bottom - top) * scale) };
}

// Connected groups of changed tiles are visual hints for the planner.
export function groupTiles(hits: Uint8Array, width: number, height: number, tile: number): Region[] {
  const cols = Math.ceil(width / tile), rows = Math.ceil(height / tile);
  const visited = new Uint8Array(hits.length), regions: Region[] = [];
  for (let i = 0; i < hits.length; i++) {
    if (!hits[i] || visited[i]) continue;
    visited[i] = 1;
    const queue = [i];
    let left = cols, top = rows, right = 0, bottom = 0;
    for (let pos = 0; pos < queue.length; pos++) {
      const cell = queue[pos], x = cell % cols, y = Math.floor(cell / cols);
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let ny = Math.max(0, y - 1); ny <= Math.min(rows - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(cols - 1, x + 1); nx++) {
          const next = ny * cols + nx;
          if (hits[next] && !visited[next]) { visited[next] = 1; queue.push(next); }
        }
      }
    }
    regions.push({ left: left * tile / width, top: top * tile / height,
      right: Math.min(1, right * tile / width), bottom: Math.min(1, bottom * tile / height) });
  }
  return regions;
}

function inkStrength(rgba: Uint8ClampedArray) {
  const ink = new Uint8Array(rgba.length / 4);
  for (let k = 0; k < ink.length; k++) {
    const i = k * 4;
    ink[k] = 255 - Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
  }
  return ink;
}

function hasNearbyStroke(ink: Uint8Array, index: number, width: number, height: number, radius: number, strength: number) {
  const x = index % width, y = Math.floor(index / width);
  for (let row = Math.max(0, y - radius); row <= Math.min(height - 1, y + radius); row++) {
    for (let col = Math.max(0, x - radius); col <= Math.min(width - 1, x + radius); col++) {
      if ((row - y) ** 2 + (col - x) ** 2 <= radius ** 2 && ink[row * width + col] >= strength - 16) return true;
    }
  }
  return false;
}

export function colourDifference(old: Uint8ClampedArray, newer: Uint8ClampedArray, width: number, height: number, tolerance = 0) {
  const tile = 32, cols = Math.ceil(width / tile), hits = new Uint8Array(cols * Math.ceil(height / tile));
  const pixels = new Uint8ClampedArray(old.length);
  const oldInk = inkStrength(old), newInk = inkStrength(newer);
  const removed = [184, 33, 48], added = [25, 94, 204];
  for (let i = 0; i < old.length; i += 4) {
    const point = i / 4, before = oldInk[point], after = newInk[point];
    const delta = before - after;
    const shared = Math.min(before, after) * .52;
    const base = 255 - shared;
    if (Math.abs(delta) <= 16 || (tolerance > 0 &&
      hasNearbyStroke(delta > 0 ? newInk : oldInk, point, width, height, tolerance, Math.max(before, after)))) {
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255 - Math.max(before, after) * .52;
    } else {
      const color = delta > 0 ? removed : added;
      const opacity = Math.abs(delta) / 255;
      for (let channel = 0; channel < 3; channel++) pixels[i + channel] = base * (1 - opacity) + color[channel] * opacity;
      hits[Math.floor(Math.floor(point / width) / tile) * cols + Math.floor((point % width) / tile)] = 1;
    }
    pixels[i + 3] = 255;
  }
  return { pixels, regions: groupTiles(hits, width, height, tile) };
}
