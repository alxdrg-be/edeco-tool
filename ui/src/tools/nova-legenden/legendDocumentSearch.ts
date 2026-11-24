import { entryText, type LegendDoc, type Selection } from "./legend.ts";

export interface LegendSearchMatch {
  id: string;
  label: string;
  section: string;
  selection: NonNullable<Selection>;
}

/** Search the open legend only; hidden source entries must not look like visible output. */
export function findLegendEntries(doc: LegendDoc, query: string, generalRows: readonly { id: string; text: string }[] = [], visibleItemIds?: ReadonlySet<string>): LegendSearchMatch[] {
  const terms = query.trim().toLocaleLowerCase("de-CH").split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const matches = (text: string) => terms.every(term => text.toLocaleLowerCase("de-CH").includes(term));
  const rows: LegendSearchMatch[] = [];
  if (doc.title.text.trim() && matches(doc.title.text)) rows.push({ id: "title", label: doc.title.text, section: "Titel", selection: { type: "title" } });
  if (doc.general_on !== false) for (const row of generalRows) {
    const section = doc.general_section?.title || "Allgemein";
    if (matches(`${section} ${row.text}`)) rows.push({ id: `general:${row.id}`, label: row.text, section, selection: { type: "general-row", id: row.id } });
  }
  for (const block of doc.blocks) for (const item of block.items) {
    if (item.hidden || item.kind === "gap" || visibleItemIds && !visibleItemIds.has(item.id)) continue;
    const label = entryText(item);
    if (matches(`${block.title} ${label}`)) rows.push({ id: `item:${item.id}`, label, section: block.title, selection: { type: "item", block: block.id, item: item.id } });
  }
  return rows;
}
