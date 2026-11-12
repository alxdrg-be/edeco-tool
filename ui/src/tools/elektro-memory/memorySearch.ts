import type { MemoryEntry } from "./types";

const normalized = (value: string) => value.toLocaleLowerCase("de-CH").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/µ/g, "u").replace(/φ/g, "phi");
const entryText = (entry: MemoryEntry) => [entry.title, entry.formula, entry.explanation, entry.correction,
  ...(entry.paragraphs ?? []), ...(entry.conditions ?? []), ...(entry.variables ?? []).flatMap(variable => [variable.symbol, variable.label, variable.unit]),
  ...(entry.table?.headers ?? []), ...(entry.table?.rows.flat() ?? []),
  ...(entry.referenceValues ?? []).flatMap(value => [value.quantity, value.sourceValue])].filter(Boolean).join(" ");

/** Every word of the query must occur in the entry or its chapter title (accents and case ignored). */
export function memoryEntryMatches(entry: MemoryEntry, query: string, context = ""): boolean {
  const words = normalized(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const corpus = normalized(`${context} ${entryText(entry)}`);
  return words.every(word => corpus.includes(word));
}
