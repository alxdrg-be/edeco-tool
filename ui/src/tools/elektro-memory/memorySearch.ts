import type { MemoryEntry, MemoryTopic } from "./types";

export type MemoryFilter = "all" | "formulas" | "reference" | "basics";

/** Keep print furniture in source documentation, not in the digital reference. */
export function referenceMemoryTopics(topics: MemoryTopic[]): MemoryTopic[] {
  return topics.flatMap(sourceTopic => {
    const topic = { ...sourceTopic, entries: sourceTopic.entries.filter(entry => entry.presentation !== "source-note") };
    // A shared source page is not a reason to combine unrelated digital topics.
    if (topic.id === "em-emergency") return [
      { ...topic, title: "Nothilfe bei Stromunfällen", summary: "Eigenschutz, Alarmierung und Erste-Hilfe-Merkpunkte.", entries: topic.entries.filter(entry => entry.id !== "em-p02-asbestos") },
      { ...topic, id: "em-asbestos", title: "Asbest in älteren Gebäuden", summary: "Gefährdung bei Arbeiten an älteren Baustoffen erkennen.", entries: topic.entries.filter(entry => entry.id === "em-p02-asbestos") },
    ];
    if (topic.id === "em-spd-conduits") return [
      { ...topic, title: "Überspannungsschutz", summary: "Auswahl von Überspannungsschutzgeräten als Quellenreferenz.", entries: topic.entries.filter(entry => entry.id !== "em-p11-conduit-fill") },
      { ...topic, id: "em-conduits", title: "Installationsrohre und Rohrbelegung", summary: "Leiterbelegung und Rohrdimensionen nachschlagen.", entries: topic.entries.filter(entry => entry.id === "em-p11-conduit-fill") },
    ];
    return [topic];
  }).filter(topic => topic.entries.length > 0);
}
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
