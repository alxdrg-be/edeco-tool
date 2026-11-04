export const NATIVE_PAGE_TOOLS = new Set(["multiTool", "merge", "rotate", "removePages", "extractPages", "reorganizePages"]);
export const isPdfSource = (file: { name: string; type: string }) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
export const isImageSource = (file: { name: string; type: string }) => ["image/png", "image/jpeg"].includes(file.type) || /\.(png|jpe?g)$/i.test(file.name);
export type NativeTaskId = "split" | "resize" | "pdf-to-images" | "pdf-to-text" | "images-to-pdf";
export const NATIVE_TASKS: Record<NativeTaskId, { title: string; description: string }> = {
  split: { title: "PDF teilen", description: "Trennstellen direkt zwischen den Seiten setzen." },
  resize: { title: "Seitengrösse ändern", description: "Papierformat und Inhaltsmassstab unabhängig einstellen." },
  "pdf-to-images": { title: "PDF in PNG", description: "Seiten mit 72, 144 oder 300 DPI ausgeben." },
  "pdf-to-text": { title: "PDF in Text", description: "Vorhandenen Text als UTF-8-Datei speichern." },
  "images-to-pdf": { title: "Bilder in PDF", description: "PNG und JPEG als geordnete PDF-Seiten zusammenstellen." },
};

/** No permissive parseInt: invalid or out-of-document input stays invalid. */
export function nativePageNumbers(value: string, count: number): number[] | null {
  if (value.trim().toLowerCase() === "all") return Array.from({ length: count }, (_, index) => index + 1);
  if (!value.trim()) return [];
  const result = new Set<number>();
  for (const chunk of value.split(",")) {
    const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(chunk);
    if (!match) return null;
    const start = Number(match[1]), end = Number(match[2] || match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end > count) return null;
    for (let number = start; number <= end; number++) result.add(number);
  }
  return [...result];
}

export function nativeSplitCuts(value: string, count: number, each: boolean): number[] | null {
  if (each) return Array.from({ length: Math.max(0, count - 1) }, (_, index) => index + 1);
  return nativePageNumbers(value, Math.max(0, count - 1));
}

export function toggleNativeCut(cuts: readonly number[], number: number): string {
  return (cuts.includes(number) ? cuts.filter(cut => cut !== number) : [...cuts, number]).sort((a, b) => a - b).join(",");
}
