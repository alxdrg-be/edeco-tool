export interface ToolInfo {
  id: string;
  title: string;
  description: string;
  category: string;
  symbol: string;
  color: string;
  status: "available" | "awaiting-source" | "planned";
  developmentStatus?: "in-progress";
}

/** Planned tools need metadata only; register a loader when their implementation is ready. */
export const TOOLS: readonly ToolInfo[] = [
  { id: "nova-legenden", title: "NOVA-Legenden", category: "Elektroplanung", symbol: "NL", color: "petrol",
    description: "Pläne importieren, Symbole zuordnen und elektrische Legenden erstellen.", status: "available", developmentStatus: "in-progress" },
  { id: "bim2steiger", title: "BIM2STEIGER", category: "BIM", symbol: "B2S", color: "blue",
    description: "Steiger-Katalog durchsuchen, BIM-Objekte zuordnen und Ausschreibungen erstellen.", status: "available", developmentStatus: "in-progress" },
  { id: "dokumenten-assistent", title: "Dokumenten-Assistent", category: "Dokumente", symbol: "KI", color: "violet",
    description: "Dokumente durchsuchen, Fragen über eine KI-API beantworten und Quellen im Original markieren.", status: "available", developmentStatus: "in-progress" },
  { id: "dateien-umbenennen", title: "Dateien umbenennen", category: "Dateien", symbol: "Aa", color: "green",
    description: "Geplant: Dateien nach Regeln umbenennen, Änderungen vorher prüfen und rückgängig machen.", status: "planned" },
  { id: "pdf-werkzeuge", title: "PDF-Werkstatt", category: "Dateien", symbol: "PDF", color: "rose",
    description: "PDF-Dateien und Seiten mit Stirling-PDF zusammenführen, trennen, bearbeiten und konvertieren.", status: "available", developmentStatus: "in-progress" },
  { id: "projektzentrale", title: "Projektzentrale", category: "Projekte", symbol: "P", color: "petrol",
    description: "Geplant: Projektdaten, Kontakte, Ordner und zuletzt verwendete Dokumente gemeinsam verwalten.", status: "planned" },
  { id: "aenderungsbericht", title: "Änderungsbericht", category: "Projekte", symbol: "Δ", color: "orange",
    description: "Geplant: Projektstände vergleichen und Änderungen für einen Bericht nach PDF oder Excel exportieren.", status: "planned" },
  { id: "leistungsbilanz", title: "Leistungsbilanz", category: "Elektroplanung", symbol: "kW", color: "violet",
    description: "Geplant: Verbraucher erfassen, Leistungen mit Gleichzeitigkeitsfaktoren je Verteilung zusammenstellen.", status: "planned" },
  { id: "kabelberechnung", title: "Kabelberechnung", category: "Elektroplanung", symbol: "mm²", color: "blue",
    description: "Geplant: Leitungsquerschnitt, Spannungsfall und Verlegebedingungen mit nachvollziehbaren Grundlagen prüfen.", status: "planned" },
  { id: "anlagetool", title: "Anlagetool", category: "Elektroplanung", symbol: "A", color: "green",
    description: "Geplant: Anlagen, Verteilungen und Stromkreise strukturiert erfassen und dokumentieren.", status: "planned" },
];

export function filterTools(query: string, category: string): readonly ToolInfo[] {
  const words = query.toLocaleLowerCase("de-CH").trim().split(/\s+/).filter(Boolean);
  return TOOLS.filter(tool => (category === "Alle" || tool.category === category) &&
    words.every(word => `${tool.title} ${tool.description} ${tool.category}`.toLocaleLowerCase("de-CH").includes(word)));
}
