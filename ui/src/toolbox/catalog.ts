import { WORKBENCH_TOOLS } from "../tools/berechnungen/workbench/catalog";
export interface ToolInfo {
  id: string;
  title: string;
  description: string;
  category: string;
  symbol: string;
  color: string;
  status: "available" | "awaiting-source" | "planned";
  developmentStatus?: "in-progress";
  parentId?: string;
}

/** Planned tools need metadata only; register a loader when their implementation is ready. */
export const TOOLS: readonly ToolInfo[] = [
  { id: "wissens-hub", title: "Wissens-Hub", category: "Berechnungen", parentId: "berechnungen", symbol: "W", color: "petrol",
    description: "Grundlagen, Formeln und Quellen für die Schweizer Elektroplanung mit direkten Verbindungen zu den Rechnern.", status: "available" },
  { id: "netzplaner", title: "Netzplaner · NIN (Beta)", category: "Berechnungen", symbol: "NET", color: "blue", parentId: "berechnungen",
    description: "Modulare Einlinienschemas mit Einspeisung, Verteilung, Schutzorganen, Lasten und abschnittsbezogenen Modellprüfungen.", status: "available", developmentStatus: "in-progress" },
  { id: "nova-legenden", title: "NOVA-Legenden", category: "Elektroplanung", symbol: "NL", color: "petrol",
    description: "Pläne importieren, Symbole zuordnen und elektrische Legenden erstellen.", status: "available", developmentStatus: "in-progress" },
  { id: "bim2steiger", title: "BIM2STEIGER", category: "BIM", symbol: "B2S", color: "blue",
    description: "Steiger-Katalog durchsuchen, BIM-Objekte zuordnen und Ausschreibungen erstellen.", status: "available", developmentStatus: "in-progress" },
  { id: "dokumenten-assistent", title: "Dokumenten-Assistent", category: "Dokumente", symbol: "KI", color: "violet",
    description: "Dokumente durchsuchen, Fragen über eine KI-API beantworten und Quellen im Original markieren.", status: "available", developmentStatus: "in-progress" },
  { id: "dateien-umbenennen", title: "Dateien umbenennen", category: "Dateien", symbol: "Aa", color: "green",
    description: "PDF-Namen mit Projektnummer, wählbaren Bausteinen und Geschosserkennung vorbereiten; benannte Kopien herunterladen.", status: "available", developmentStatus: "in-progress" },
  { id: "pdf-werkzeuge", title: "PDF-Werkstatt", category: "Dateien", symbol: "PDF", color: "rose",
    description: "PDF-Dateien und Seiten mit Stirling-PDF zusammenführen, trennen, bearbeiten und konvertieren.", status: "available", developmentStatus: "in-progress" },
  { id: "projektzentrale", title: "Projektzentrale", category: "Projekte", symbol: "P", color: "petrol",
    description: "Projektnummern, Kontakte, Ablageordner und Dokumentverweise verwalten; gemeinsames Projekt auswählen.", status: "available", developmentStatus: "in-progress" },
  { id: "aenderungsbericht", title: "Änderungsbericht", category: "Projekte", symbol: "Δ", color: "orange",
    description: "Geplant: Projektstände vergleichen und Änderungen für einen Bericht nach PDF oder Excel exportieren.", status: "planned" },
  { id: "planlieferung", title: "Planlieferungs-Assistent", category: "Projekte", symbol: "PL", color: "green",
    description: "PDFs prüfen und benennen, Planlisten erstellen und Lieferungen beim Projekt protokollieren.", status: "available", developmentStatus: "in-progress" },
  { id: "berechnungen", title: "Berechnungen", category: "Berechnungen", symbol: "=", color: "blue",
    description: "Schweizer Rechenhilfen für Leitungen, Schutz, Ladeinfrastruktur, Energie und Räume mit projektbezogener Ablage.", status: "available", developmentStatus: "in-progress" },
  { id: "blitzschutz", title: "Blitzschutz", category: "Berechnungen", symbol: "⚡", color: "orange", parentId: "berechnungen",
    description: "Trennungsabstand nach dem veröffentlichten Schweizer Verfahren berechnen und am Gebäude visualisieren. Fachliche Freigabe offen.", status: "available", developmentStatus: "in-progress" },
  { id: "emobilitaet", title: "E-Mobilität · AC-Vorplanung", category: "Berechnungen", symbol: "EV", color: "green", parentId: "berechnungen",
    description: "Ein- und dreiphasige AC-Vorplanung mit Gebäudereserve, aktiven/wartenden Punkten und Aussenleiterprüfung.", status: "available", developmentStatus: "in-progress" },
  { id: "berechnungsablage", title: "Gemeinsame Berechnungsablage", category: "Berechnungen", symbol: "A", color: "petrol", parentId: "berechnungen",
    description: "Rechenstände und Berechnungsexporte projektbezogen im Serverordner mit Notizen gemeinsam ablegen.", status: "available", developmentStatus: "in-progress" },
  ...WORKBENCH_TOOLS,
  { id: "leistungsbilanz", title: "Leistungsbilanz", category: "Berechnungen", symbol: "kW", color: "violet", parentId: "berechnungen",
    description: "Geplant: Verbraucher erfassen, Leistungen mit Gleichzeitigkeitsfaktoren je Verteilung zusammenstellen.", status: "planned" },
  { id: "kabelberechnung", title: "Kabelberechnung", category: "Berechnungen", symbol: "mm²", color: "blue", parentId: "berechnungen",
    description: "Schweizer Spannungsfall-Vorprüfung mit Leiterwiderständen bei 55 °C, Live-Leitungsmodell und Querschnittsvergleich.", status: "available", developmentStatus: "in-progress" },
  { id: "anlagetool", title: "Anlagetool", category: "Elektroplanung", symbol: "A", color: "green",
    description: "Geplant: Anlagen, Verteilungen und Stromkreise strukturiert erfassen und dokumentieren.", status: "planned" },
];

export function filterTools(query: string, category: string, parentId?: string): readonly ToolInfo[] {
  const words = query.toLocaleLowerCase("de-CH").trim().split(/\s+/).filter(Boolean);
  return TOOLS.filter(tool => tool.parentId === parentId && (category === "Alle" || tool.category === category) &&
    words.every(word => `${tool.title} ${tool.description} ${tool.category}`.toLocaleLowerCase("de-CH").includes(word)));
}
