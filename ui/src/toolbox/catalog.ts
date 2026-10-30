export interface ToolInfo {
  id: string;
  title: string;
  description: string;
  category: string;
  symbol: string;
  color: string;
  status: "available" | "awaiting-source" | "planned";
}

/** Add metadata here and a matching component loader in modules.ts. */
export const TOOLS: readonly ToolInfo[] = [
  { id: "nova-legenden", title: "NOVA-Legenden", category: "Elektroplanung", symbol: "NL", color: "petrol",
    description: "Pläne importieren, Symbole zuordnen und elektrische Legenden erstellen.", status: "available" },
  { id: "bim2steiger", title: "BIM2STEIGER", category: "BIM", symbol: "B2S", color: "blue",
    description: "Die Einbindung des Programms wird vorbereitet.", status: "awaiting-source" },
  { id: "berechnungen", title: "Berechnungstool", category: "Elektroplanung", symbol: "∑", color: "violet",
    description: "Platz für kommende Berechnungen in der Elektroplanung.", status: "planned" },
  { id: "blitzschutz", title: "Blitzschutz", category: "Elektroplanung", symbol: "ϟ", color: "orange",
    description: "Ein eigener Arbeitsbereich für zukünftige Blitzschutz-Werkzeuge.", status: "planned" },
  { id: "dateien-umbenennen", title: "Dateien umbenennen", category: "Dateien", symbol: "Aa", color: "green",
    description: "Dateinamen künftig nach gemeinsamen Regeln bearbeiten.", status: "planned" },
];

export function filterTools(query: string, category: string): readonly ToolInfo[] {
  const words = query.toLocaleLowerCase("de-CH").trim().split(/\s+/).filter(Boolean);
  return TOOLS.filter(tool => (category === "Alle" || tool.category === category) &&
    words.every(word => `${tool.title} ${tool.description} ${tool.category}`.toLocaleLowerCase("de-CH").includes(word)));
}
