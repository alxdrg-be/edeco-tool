/** Native tool identities are stable because shared records use them as folder keys. */
export const WORKBENCH_CATALOG = [
  ["nin-kabelrechner", "NIN-Kabelvorprüfung", "Leitungen & Schutz", "Betriebsstrom, Referenzbelastbarkeit und Schutzorgan vergleichen."],
  ["strombelastbarkeit", "Strombelastbarkeit", "Leitungen & Schutz", "Referenzstrom mit dokumentierten Korrekturfaktoren bewerten."],
  ["kurzschlussstrom", "Kurzschlussstrom", "Leitungen & Schutz", "Kurzschlussstrom aus dokumentierter Netzimpedanz berechnen."],
  ["ls-schalter", "LS-Schalter", "Leitungen & Schutz", "Auslösebereich anhand der gewählten Charakteristik vorprüfen."],
  ["potenzialausgleich", "Potenzialausgleich", "Leitungen & Schutz", "Dokumentierte Querschnittsvorgaben und vorhandene Leiter vergleichen."],
  ["transformator", "Transformator", "Leistung & Energie", "Nennstrom und vereinfachten Kurzschlussstrom bestimmen."],
  ["motoranlauf", "Motoranlauf", "Leistung & Energie", "Nennstrom und Anlaufverhältnisse nachvollziehbar berechnen."],
  ["blindleistung", "Blindleistung", "Leistung & Energie", "Kompensation mit Vorher-Nachher-Vergleich planen."],
  ["verlustleistung", "Verlustleistung", "Leistung & Energie", "Leitungsverluste, Energie und Kosten vorprüfen."],
  ["ohmsches-gesetz", "Ohmsches Gesetz", "Grundlagen & Räume", "Spannung, Strom, Widerstand und Leistung berechnen."],
  ["beleuchtung", "Beleuchtung", "Grundlagen & Räume", "Leuchtenanzahl mit explizitem Nutzungs- und Wartungsfaktor abschätzen."],
  ["pva-rechner", "PV-Anlage", "Leistung & Energie", "Leistung, Ertrag und Wirtschaftlichkeit aus Planungsannahmen abschätzen."],
  ["brandlast", "Brandlast · Grundrechnung", "Grundlagen & Räume", "Kabel-Brandlast für eine Strecke auf MJ/m beziehen."],
  ["poe", "PoE · Leistung", "Leitungen & Schutz", "Leistungsabgabe und Leitungsverluste zwischen PSE und PD berechnen."],
  ["premium-pkw", "Ladegrid PKW", "Ladeinfrastruktur", "Zwei Ladegrids am gemeinsamen Anschluss mit Lastmanagement vorplanen."],
  ["premium-lkw", "Ladegrid E-LKW", "Ladeinfrastruktur", "AC-Einspeisung, Wirkungsgrad und DC-Ladeleistung verknüpfen."],
  ["premium-brandmelder", "Brandmelder", "Grundlagen & Räume", "Raumraster mit dokumentierten Flächen- und Abstandsvorgaben vorplanen."],
  ["premium-selektivitaet", "Selektivität", "Leitungen & Schutz", "Schutzorganpaare gegen dokumentierte Herstellergrenzen vergleichen."],
  ["premium-ladekosten", "Ladeinfrastruktur-Kosten", "Ladeinfrastruktur", "Investitionen und Betrieb über eine wählbare Dauer vergleichen; Jahreszahlungen und Mittelwert getrennt."],
  ["premium-sia2056", "SIA 2056 · Zonenbilanz", "Leistung & Energie", "Leistungs- und Energiebilanz mit dokumentierten Zonenkennwerten aufbauen."],
  ["premium-poe", "PoE-Streckenplaner", "Leitungen & Schutz", "Mehrere Leitungssegmente mit expliziten Längenfaktoren bewerten."],
  ["premium-brandlast", "Brandlast Fluchtweg", "Grundlagen & Räume", "Ist-Zustand und Sanierungsannahme für die Kabel-Brandlast vergleichen."],
  ["leistungsbilanz", "Leistungsbilanz", "Leistung & Energie", "Verbraucher je Verteilung mit Menge, Leistung und Gleichzeitigkeit zusammenzählen."],
  ["zev-gestehung", "ZEV-Gestehungskosten", "Leistung & Energie", "Investition und Betrieb einer PV-Anlage auf den erwarteten Ertrag beziehen."],
  ["rtv-daempfung", "RTV-Dämpfung", "Leitungen & Schutz", "Pegel einer Empfangsstrecke aus eigenen Kabel- und Gerätewerten weiterrechnen."],
  ["bkp-schaetzung", "BKP-Kostenschätzung", "Kosten", "Positionen mit Menge und eigenem Einheitspreis zur Schätzsumme addieren."],
] as const;

export const WORKBENCH_TOOLS = WORKBENCH_CATALOG.map(([id, title, , description]) => ({
  id, title, description, category: "Berechnungen", symbol: "=", color: "blue",
  parentId: "berechnungen", status: "available" as const, developmentStatus: "in-progress" as const,
}));
export function calculationGroup(id: string): string {
  if (["blitzschutz", "kabelberechnung"].includes(id)) return "Leitungen & Schutz";
  if (id === "emobilitaet") return "Ladeinfrastruktur";
  return WORKBENCH_CATALOG.find(item => item[0] === id)?.[2] ?? "Weiteres";
}
