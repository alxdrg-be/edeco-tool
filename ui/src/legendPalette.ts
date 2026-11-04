/** CIEDE2000 is a visual similarity hint; it does not certify print or installation colours. */
export interface PaletteEntry { id: string; title: string; color: string }
export interface PaletteConflict { first: PaletteEntry; second: PaletteEntry; distance: number; duplicate: boolean }
type Lab = readonly [number, number, number];
const degrees = (radians: number) => radians * 180 / Math.PI;
const radians = (angle: number) => angle * Math.PI / 180;

export function colorLab(hex: string): Lab | null {
  if (!/^#[\da-f]{6}$/i.test(hex)) return null;
  const [r, g, b] = [1, 3, 5].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  const transform = (v: number) => v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116;
  const x = transform((.4124564 * r + .3575761 * g + .1804375 * b) / .95047);
  const y = transform(.2126729 * r + .7151522 * g + .072175 * b);
  const z = transform((.0193339 * r + .119192 * g + .9503041 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function deltaE2000([l1, a1, b1]: Lab, [l2, a2, b2]: Lab): number {
  const c1 = Math.hypot(a1, b1), c2 = Math.hypot(a2, b2), meanC = (c1 + c2) / 2;
  const g = .5 * (1 - Math.sqrt(meanC ** 7 / (meanC ** 7 + 25 ** 7)));
  const ap1 = (1 + g) * a1, ap2 = (1 + g) * a2;
  const cp1 = Math.hypot(ap1, b1), cp2 = Math.hypot(ap2, b2);
  const hue = (a: number, b: number) => a === 0 && b === 0 ? 0 : (degrees(Math.atan2(b, a)) + 360) % 360;
  const h1 = hue(ap1, b1), h2 = hue(ap2, b2);
  const dl = l2 - l1, dc = cp2 - cp1;
  let dh = h2 - h1;
  if (cp1 * cp2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(cp1 * cp2) * Math.sin(radians(dh / 2));
  const ml = (l1 + l2) / 2, mc = (cp1 + cp2) / 2;
  const mh = cp1 * cp2 === 0 ? h1 + h2 : Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2;
  const t = 1 - .17 * Math.cos(radians(mh - 30)) + .24 * Math.cos(radians(2 * mh)) + .32 * Math.cos(radians(3 * mh + 6)) - .20 * Math.cos(radians(4 * mh - 63));
  const sl = 1 + .015 * (ml - 50) ** 2 / Math.sqrt(20 + (ml - 50) ** 2);
  const sc = 1 + .045 * mc, sh = 1 + .015 * mc * t;
  const rt = -2 * Math.sqrt(mc ** 7 / (mc ** 7 + 25 ** 7)) * Math.sin(radians(60 * Math.exp(-(((mh - 275) / 25) ** 2))));
  return Math.sqrt((dl / sl) ** 2 + (dc / sc) ** 2 + (dH / sh) ** 2 + rt * (dc / sc) * (dH / sh));
}

export function paletteConflicts(entries: readonly PaletteEntry[], threshold = 10): PaletteConflict[] {
  const limit = Number.isFinite(threshold) ? Math.min(40, Math.max(1, threshold)) : 10;
  const valid = entries.map(entry => ({ entry, lab: colorLab(entry.color) })).filter((item): item is { entry: PaletteEntry; lab: Lab } => item.lab !== null);
  const issues: PaletteConflict[] = [];
  for (let i = 0; i < valid.length; i++) for (let j = i + 1; j < valid.length; j++) {
    const first = valid[i], second = valid[j], distance = deltaE2000(first.lab, second.lab);
    if (distance < limit) issues.push({ first: first.entry, second: second.entry, distance, duplicate: first.entry.color.toLowerCase() === second.entry.color.toLowerCase() });
  }
  return issues.sort((a, b) => a.distance - b.distance);
}

/** Paper-white contrast is a review aid for thin strokes, not a WCAG pass/fail for CAD drawings. */
export function paperContrast(hex: string): number | null {
  const lab = colorLab(hex);
  if (!lab) return null;
  const fy = (lab[0] + 16) / 116;
  const luminance = fy > 6 / 29 ? fy ** 3 : 3 * (6 / 29) ** 2 * (fy - 4 / 29);
  return 1.05 / (luminance + .05);
}
