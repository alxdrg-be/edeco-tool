import type { MemoryTopic } from "./types";

const source = { label: "Ergänzende mathematische und elektrotechnische Grundlagen" };

export const BASIC_TOPICS: MemoryTopic[] = [
  { id: "einheiten-praefixe", title: "Einheiten & Präfixe", group: "basics", pages: [],
    summary: "Grössen richtig lesen, umrechnen und voneinander unterscheiden.", entries: [
      { id: "si-praefixe", title: "SI-Präfixe", kind: "reference", confidence: "verified", source,
        explanation: "Gross- und Kleinschreibung unterscheiden sich: M steht für Mega, m für Milli. Ein Präfix multipliziert die Einheit mit dem angegebenen Faktor.",
        table: { headers: ["Präfix", "Zeichen", "Faktor"], rows: [["Giga", "G", "10⁹"], ["Mega", "M", "10⁶"], ["Kilo", "k", "10³"], ["Milli", "m", "10⁻³"], ["Mikro", "µ", "10⁻⁶"], ["Nano", "n", "10⁻⁹"], ["Piko", "p", "10⁻¹²"]] } },
      { id: "elektrische-einheiten", title: "Elektrische Grössen und Einheiten", kind: "reference", confidence: "verified", source,
        table: { headers: ["Grösse", "Zeichen", "Einheit"], rows: [["Spannung", "U", "V · Volt"], ["Strom", "I", "A · Ampere"], ["Widerstand", "R", "Ω · Ohm"], ["Wirkleistung", "P", "W · Watt"], ["Scheinleistung", "S", "VA · Voltampere"], ["Blindleistung", "Q", "var"], ["Energie", "E", "J oder Wh"], ["Frequenz", "f", "Hz · Hertz"], ["Kapazität", "C", "F · Farad"], ["Induktivität", "L", "H · Henry"]] } },
      { id: "leistung-energie-unterscheiden", title: "Leistung und Energie unterscheiden", kind: "formula", confidence: "verified", source,
        formula: "E = P · t     ·     1 kWh = 3,6 MJ",
        explanation: "Leistung beschreibt die Energie pro Zeit. Bei konstanter Leistung ergibt die Multiplikation mit der Zeit die Energie. kW × h ergibt kWh; W × s ergibt J.",
        variables: [{ symbol: "E", label: "Energie", unit: "J / Wh / kWh" }, { symbol: "P", label: "Leistung", unit: "W / kW" }, { symbol: "t", label: "Zeit", unit: "s / h" }],
        conditions: ["Einheiten im Produkt passend wählen.", "Bei veränderlicher Leistung gilt E = ∫ P(t) dt."], calculatorFormulaId: "energie" },
    ] },
  { id: "gleich-wechsel-drehstrom", title: "Gleich-, Wechsel- & Drehstrom", group: "basics", pages: [],
    summary: "DC, Effektivwerte und symmetrische dreiphasige Systeme.", entries: [
      { id: "dc-ac", title: "Gleichstrom und Wechselstrom", kind: "diagram", confidence: "verified", source, diagram: "dc-ac",
        explanation: "Bei Gleichstrom bleibt die Stromrichtung gleich. Wechselstrom wechselt seine Richtung. Für sinusförmige Grössen gilt der Zusammenhang zwischen Effektivwert und Scheitelwert: Û = √2 · U und Î = √2 · I.",
        conditions: ["Der Faktor √2 gilt für einen reinen Sinus, nicht für beliebige Kurvenformen.", "In AC-Leistungsformeln sind U und I üblicherweise Effektivwerte."], calculatorFormulaId: "leistung-1p" },
      { id: "dreiphasige-leistung", title: "Leistung im symmetrischen Drehstromnetz", kind: "formula", confidence: "verified", source,
        formula: "S = √3 · U · I     P = √3 · U · I · cos φ",
        explanation: "U ist die Spannung zwischen zwei Aussenleitern. Die Formel beschreibt die gesamte dreiphasige Leistung bei symmetrischer sinusförmiger Belastung.",
        variables: [{ symbol: "U", label: "Aussenleiterspannung", unit: "V" }, { symbol: "I", label: "Aussenleiterstrom", unit: "A" }, { symbol: "P", label: "Gesamte Wirkleistung", unit: "W" }, { symbol: "S", label: "Gesamte Scheinleistung", unit: "VA" }],
        conditions: ["Bei unsymmetrischer Last die Phasen einzeln berechnen und die Wirkleistungen addieren.", "cos φ bezeichnet hier die Phasenverschiebung bei sinusförmigem Strom und sinusförmiger Spannung."], calculatorFormulaId: "leistung-3p" },
      { id: "leistungsdreieck-grundlagen", title: "Wirk-, Blind- und Scheinleistung", kind: "formula", confidence: "verified", source, diagram: "power-triangle",
        formula: "S² = P² + Q²     ·     cos φ = P / S",
        explanation: "P beschreibt die umgesetzte Wirkleistung, Q den periodischen Energieaustausch und S das Produkt der Effektivwerte von Spannung und Strom.",
        variables: [{ symbol: "P", label: "Wirkleistung", unit: "W" }, { symbol: "Q", label: "Blindleistung", unit: "var" }, { symbol: "S", label: "Scheinleistung", unit: "VA" }],
        conditions: ["Das einfache Leistungsdreieck gilt für sinusförmige Verhältnisse.", "Bei verzerrtem Strom umfasst der Leistungsfaktor λ = P / S auch den Verzerrungsanteil und ist allgemein nicht gleich cos φ."], calculatorFormulaId: "leistungsdreieck" },
    ] },
  { id: "reihe-parallel", title: "Reihe & Parallel", group: "basics", pages: [],
    summary: "Widerstände und Kondensatoren richtig zusammenfassen.", entries: [
      { id: "widerstand-netzwerke", title: "Widerstände in Reihe und parallel", kind: "formula", confidence: "verified", source, diagram: "resistors",
        formula: "Reihe: R = R₁ + R₂     Parallel: R = R₁ · R₂ / (R₁ + R₂)",
        explanation: "In Reihe fliesst derselbe Strom durch beide Widerstände. Parallel liegt an beiden dieselbe Spannung. Für beliebig viele parallele Widerstände gilt 1/R = 1/R₁ + 1/R₂ + … .",
        variables: [{ symbol: "R", label: "Gesamtwiderstand", unit: "Ω" }, { symbol: "R₁, R₂", label: "Einzelwiderstände", unit: "Ω" }],
        conditions: ["Positive ohmsche Widerstände; die kompakte Parallelformel gilt für genau zwei Widerstände.", "Bei n gleichen parallelen Widerständen ergibt sich R = R₁ / n."], calculatorFormulaId: "widerstand-netzwerk" },
      { id: "kondensator-netzwerke", title: "Kondensatoren in Reihe und parallel", kind: "formula", confidence: "verified", source,
        formula: "Parallel: C = C₁ + C₂     Reihe: 1/C = 1/C₁ + 1/C₂",
        explanation: "Die Kombination von idealen Kapazitäten verhält sich umgekehrt zur Kombination von ohmschen Widerständen: Parallel addieren sich die Kapazitäten, in Reihe addieren sich ihre Kehrwerte.",
        variables: [{ symbol: "C", label: "Gesamtkapazität", unit: "F" }, { symbol: "C₁, C₂", label: "Einzelkapazitäten", unit: "F" }],
        conditions: ["Ideale Bauteile mit positiver Kapazität.", "Zulässige Betriebsspannungen und eine mögliche ungleiche Spannungsaufteilung sind gesondert zu prüfen."], calculatorFormulaId: "kondensator-netzwerk" },
    ] },
];
