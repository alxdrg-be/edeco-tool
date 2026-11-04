export interface CropPoint { x: number; y: number }
export interface CropRect extends CropPoint { width: number; height: number }
export interface CropSize { width: number; height: number }
export interface CropMargins { top: number; bottom: number; left: number; right: number }
export type CropHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export const FULL_CROP: Readonly<CropRect> = { x: 0, y: 0, width: 1, height: 1 };
const MINIMUM = 0.0001;
const limit = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function clampCrop(rect: CropRect): CropRect {
  const width = limit(Number.isFinite(rect.width) ? rect.width : 1, MINIMUM, 1);
  const height = limit(Number.isFinite(rect.height) ? rect.height : 1, MINIMUM, 1);
  return { x: limit(Number.isFinite(rect.x) ? rect.x : 0, 0, 1 - width),
    y: limit(Number.isFinite(rect.y) ? rect.y : 0, 0, 1 - height), width, height };
}

/** Client coordinates account for document zoom, scrolling and a centred sheet. */
export function cropPoint(point: CropPoint, box: Pick<DOMRect, "left" | "top" | "width" | "height">): CropPoint {
  return { x: limit((point.x - box.left) / Math.max(box.width, 1), 0, 1),
    y: limit((point.y - box.top) / Math.max(box.height, 1), 0, 1) };
}

export function equalCrop(a: CropRect, b: CropRect): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.width - b.width) + Math.abs(a.height - b.height) < 1e-8;
}

export function drawCrop(start: CropPoint, end: CropPoint): CropRect {
  return clampCrop({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) });
}

export function moveCrop(rect: CropRect, delta: CropPoint): CropRect {
  return clampCrop({ ...rect, x: rect.x + delta.x, y: rect.y + delta.y });
}

export function resizeCrop(rect: CropRect, handle: CropHandle, delta: CropPoint): CropRect {
  let left = rect.x, right = rect.x + rect.width, top = rect.y, bottom = rect.y + rect.height;
  if (handle.includes("w")) left = limit(left + delta.x, 0, right - MINIMUM);
  if (handle.includes("e")) right = limit(right + delta.x, left + MINIMUM, 1);
  if (handle.includes("n")) top = limit(top + delta.y, 0, bottom - MINIMUM);
  if (handle.includes("s")) bottom = limit(bottom + delta.y, top + MINIMUM, 1);
  return clampCrop({ x: left, y: top, width: right - left, height: bottom - top });
}

/** Aspect is physical width / height, not a ratio of normalised coordinates. */
export function constrainCrop(rect: CropRect, aspect: number | null, page: CropSize): CropRect {
  if (!aspect || aspect <= 0 || !Number.isFinite(aspect)) return clampCrop(rect);
  const ratio = aspect * page.height / page.width;
  let width = rect.width, height = rect.height;
  if (width / height > ratio) width = height * ratio;
  else height = width / ratio;
  return clampCrop({ x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height });
}

export function cropMargins(rect: CropRect, page: CropSize): CropMargins {
  return { top: rect.y * page.height, bottom: Math.max(0, 1 - rect.y - rect.height) * page.height,
    left: rect.x * page.width, right: Math.max(0, 1 - rect.x - rect.width) * page.width };
}

export function marginsCrop(margins: CropMargins, page: CropSize): CropRect | null {
  if (![...Object.values(margins), page.width, page.height].every(Number.isFinite)
    || Object.values(margins).some(value => value < 0) || page.width <= 0 || page.height <= 0
    || margins.left + margins.right >= page.width || margins.top + margins.bottom >= page.height) return null;
  return clampCrop({ x: margins.left / page.width, y: margins.top / page.height,
    width: 1 - (margins.left + margins.right) / page.width, height: 1 - (margins.top + margins.bottom) / page.height });
}

export function fitCropZoom(page: CropSize, viewport: CropSize, mode: "page" | "width", padding = 64): number {
  const horizontal = Math.max(1, viewport.width - padding) / (page.width * 96 / 72);
  const vertical = Math.max(1, viewport.height - padding) / (page.height * 96 / 72);
  return Math.max(1e-9, mode === "width" ? horizontal : Math.min(horizontal, vertical));
}

export function cropPageRange(value: string, pageCount: number): number[] | null {
  if (!value.trim()) return null;
  const pages = new Set<number>();
  for (const part of value.split(",")) {
    const match = /^\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*$/.exec(part);
    if (!match) return null;
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first || last > pageCount) return null;
    for (let page = first; page <= last; page++) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}
