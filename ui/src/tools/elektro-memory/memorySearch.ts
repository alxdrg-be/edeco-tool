import type { MemoryEntry, MemoryTopic } from "./types";

export type MemoryFilter = "all" | "formulas" | "reference" | "basics";
const normalized = (value: string) => value.toLocaleLowerCase("de-CH").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/µ/g, "u").replace(/φ/g, "phi");
const entryText = (entry: MemoryEntry) => [entry.title, entry.formula, entry.explanation, entry.correction,
  ...(entry.paragraphs ?? []), ...(entry.conditions ?? []), ...(entry.variables ?? []).flatMap(variable => [variable.symbol, variable.label, variable.unit]),
  ...(entry.table?.headers ?? []), ...(entry.table?.rows.flat() ?? []),
  ...(entry.referenceValues ?? []).flatMap(value => [value.quantity, value.sourceValue])].filter(Boolean).join(" ");

export function filterMemoryTopics(topics: MemoryTopic[], query: string, filter: MemoryFilter): MemoryTopic[] {
  const words = normalized(query).trim().split(/\s+/).filter(Boolean);
  return topics.filter(topic => {
    if (filter === "basics" && topic.group !== "basics") return false;
    if (filter === "formulas" && !topic.entries.some(entry => entry.kind === "formula")) return false;
    if (filter === "reference" && topic.group !== "reference") return false;
    const corpus = normalized([topic.title, topic.summary, ...topic.entries.map(entryText)].filter(Boolean).join(" "));
    return words.every(word => corpus.includes(word));
  });
}

/** Search opens the relevant entries, with the whole topic still one click away. */
export function filterMemoryEntries(topic: MemoryTopic, query: string): MemoryEntry[] {
  const words = normalized(query).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return topic.entries;
  const found = topic.entries.filter(entry => words.every(word => normalized(`${topic.title} ${entryText(entry)}`).includes(word)));
  return found.length ? found : topic.entries;
}

export function memoryPagesLabel(pages: number[]): string {
  return pages.length ? `PDF S. ${[...new Set(pages)].sort((a, b) => a - b).join(", ")}` : "Ergänzende Grundlagen";
}
