/** Chapters of the digital Elektro-Memory, in the order of the printed E-Memory index. */
export interface MemoryChapter {
  id: string;
  number?: number;
  title: string;
  short: string;
  icon: "emergency" | "safety" | "testing" | "protection" | "earthing" | "bath" | "conduits" | "surge" | "ip" | "formulas" | "basics";
  /** Entry ids from the source catalogue and the basics, in reading order. */
  entries: string[];
  tool?: "sockets" | "ip";
}

export const MEMORY_CHAPTERS: MemoryChapter[] = [
  { id: "nothilfe", number: 1, title: "Nothilfe bei Stromunfällen", short: "Eigenschutz, Meldeschema, Erste Hilfe, Asbest", icon: "emergency",
    entries: ["em-p02-self-protection", "em-p02-electric-accident", "em-p02-emergency-report", "em-p02-first-aid", "em-p02-asbestos"] },
  { id: "sicherheit", number: 2, title: "Sicherheitsregeln & PSA", short: "5 + 5 Regeln, Schutzausrüstung, Arbeitsverfahren", icon: "safety",
    entries: ["em-p03-five-electrical-rules", "em-p03-five-vital-rules", "em-p03-arc-ppe-levels", "em-p04-ppe-components", "em-p04-work-method-tree"] },
  { id: "messen", number: 3, title: "Messpraxis & Prüfungen", short: "Sichtprüfung, Riso, Niederohm, Zs, Ik-Faustregeln", icon: "testing",
    entries: ["em-p05-inspection", "em-p05-test-sequence", "em-p05-low-ohm", "em-p05-insulation", "em-p05-loop-measurement", "em-p06-disconnection-5s", "em-p06-disconnection-04s"] },
  { id: "schutz", number: 4, title: "RCD, Schutzorgane & Stecksysteme", short: "RCD-Typen, LS, DIAZED, SN 441011", icon: "protection", tool: "sockets",
    entries: ["em-p07-rcd-types", "em-p07-rcd-matrix", "em-p08-rcd-applications", "em-p07-breaker-bcd", "em-p07-diazed-colors", "em-p07-socket-protection", "em-p15-connector-types", "em-p15-compatibility"] },
  { id: "erdung", number: 5, title: "Fundamenterder & Potenzialausgleich", short: "75 mm², 50 mm Beton, VA4, Querschnitte", icon: "earthing",
    entries: ["em-p09-foundation-earth", "em-p09-insulated-foundations", "em-p10-earthing-diagram", "em-p10-conductor-sizing"] },
  { id: "bad", number: 6, title: "Badewanne & Dusche", short: "Bereiche 0 · 1 · 2, Fadenmass, IP, SELV/PELV", icon: "bath",
    entries: ["em-p12-bath-zones", "em-p12-bath-ip", "em-p12-bath-equipment"] },
  { id: "leitungen", number: 7, title: "Leitungen, Rohre & Ausmass", short: "Kennfarben, Rohrbelegung M16–M63, Ausmass, IC", icon: "conduits",
    entries: ["em-p08-wire-colors", "em-p11-conduit-fill", "em-p13-length-examples", "em-p13-measurement-rules", "em-p13-work-report", "em-p13-installation-codes"] },
  { id: "ueberspannung", title: "Überspannungsschutz", short: "Auswahl der Ableiter im Wohnungsbau", icon: "surge", entries: ["em-p11-spd-flow"] },
  { id: "ip", title: "IP-Schutz & Kennzeichen", short: "IP-Decoder, Zusatzbuchstaben, Symbole", icon: "ip", tool: "ip",
    entries: ["em-p14-ip-first", "em-p14-ip-second", "em-p14-ip-letters", "em-p14-extra-symbols"] },
  { id: "formeln", title: "Formeln & Einheiten", short: "Formelscheibe und Formelsammlung", icon: "formulas",
    entries: ["em-p01-resistance", "em-p01-voltage", "em-p01-current", "em-p01-power", "em-p16-ohm", "em-p16-electric-power", "em-p16-energy-time",
      "em-p16-active-single", "em-p16-active-three", "em-p16-apparent-power", "em-p16-star", "em-p16-delta", "em-p16-conductor-resistance", "em-p16-conductance",
      "em-p16-current-density", "em-p16-capacitive-reactance", "em-p16-inductive-reactance", "em-p16-illuminance", "em-p16-required-flux", "em-p16-lamp-count",
      "em-p16-meter-power", "em-p16-energy-cost", "em-p16-mechanical-energy", "em-p16-unit-conversion", "em-p16-symbol-legend"] },
  { id: "grundlagen", title: "Grundlagen", short: "Einheiten, AC/DC, Reihe & Parallel", icon: "basics",
    entries: ["si-praefixe", "elektrische-einheiten", "leistung-energie-unterscheiden", "dc-ac", "dreiphasige-leistung", "leistungsdreieck-grundlagen", "widerstand-netzwerke", "kondensator-netzwerke"] },
];

export const EMERGENCY_CHAPTER = "nothilfe";
