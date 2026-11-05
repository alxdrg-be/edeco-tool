/** Pure layout rules of the A4 rack sheet. Shared by preview, PDF and SVG export. */
export const SHEET = { width: 210, height: 297, margin: 10, drawingTop: 38, drawingBottom: 222, infoTop: 226, titleTop: 252 } as const;
export const SHEET_SCALES = [5, 10, 15, 20, 25, 30, 40, 50] as const;

// Helvetica advance widths (1/1000 em), ASCII 32..126. Same table as the PDF writer.
const REGULAR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const SPECIAL: Record<string, number> = { "×": 584, "·": 278, "–": 556, "—": 1000, "„": 333, "“": 333, "”": 333, "″": 333, "°": 400, "²": 333, "³": 333, "…": 1000, "ä": 556, "ö": 556, "ü": 556, "Ä": 667, "Ö": 778, "Ü": 722, "é": 556, "è": 556, "à": 556, "ç": 500 };

export function textWidth(text: string, size: number, bold = false): number {
  const table = bold ? BOLD : REGULAR;
  let total = 0;
  for (const char of text) { const code = char.codePointAt(0)!; total += code >= 32 && code <= 126 ? table[code - 32] : SPECIAL[char] ?? 556; }
  return total / 1000 * size;
}

/** Word wrap by real Helvetica widths. A single long token is split, never cut off. */
export function wrapText(text: string, size: number, width: number, bold = false): string[] {
  const words = text.split(/\s+/).filter(Boolean), lines: string[] = [];
  let line = "";
  for (let word of words) {
    while (textWidth(word, size, bold) > width && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && textWidth(word.slice(0, cut), size, bold) > width) cut--;
      if (line) { lines.push(line); line = ""; }
      lines.push(word.slice(0, cut)); word = word.slice(cut);
    }
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size, bold) <= width) line = next; else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Largest common drawing scale (1:n) that fits the cabinet into the drawing area. */
export function sheetScale(widthMm: number, heightMm: number, maxWidth = 74, maxHeight: number = SHEET.drawingBottom - SHEET.drawingTop): number {
  return SHEET_SCALES.find(scale => widthMm / scale <= maxWidth && heightMm / scale <= maxHeight)
    ?? Math.ceil(Math.max(widthMm / maxWidth, heightMm / maxHeight) / 10) * 10;
}

export interface LabelInput { id: string; anchorY: number; lines: string[] }
export interface PlacedLabel extends LabelInput { y: number }
/** Labels keep the order of their devices and never overlap; they move down, then up if the column overflows. */
export function stackLabels(labels: LabelInput[], lineHeight: number, top: number, bottom: number): PlacedLabel[] {
  const sorted = [...labels].sort((a, b) => a.anchorY - b.anchorY);
  const placed: PlacedLabel[] = [];
  let cursor = top;
  for (const label of sorted) {
    const height = label.lines.length * lineHeight;
    const y = Math.max(cursor, label.anchorY - height / 2);
    placed.push({ ...label, y }); cursor = y + height + lineHeight * .25;
  }
  let limit = bottom;
  for (let index = placed.length - 1; index >= 0; index--) {
    const height = placed[index].lines.length * lineHeight;
    if (placed[index].y + height > limit) placed[index].y = limit - height;
    limit = placed[index].y - lineHeight * .25;
  }
  return placed;
}
