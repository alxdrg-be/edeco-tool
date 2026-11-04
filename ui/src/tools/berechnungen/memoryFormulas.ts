import type { CalcResult } from "./calc.ts";
import type { FormulaId } from "./formulaCatalog.ts";

export interface MemoryFormulaField { key: string; label: string; unit: string; value: string; zero?: boolean; maximum?: number }
export interface MemoryFormulaResult { rows: { label: string; value: number; unit: string }[]; equation: string }
const f = (key: string, label: string, unit: string, value: string, zero = false, maximum?: number): MemoryFormulaField => ({ key, label, unit, value, zero, maximum });
export const MEMORY_FORMULA_IDS = ["leistung-1p", "leistung-3p", "leistungsdreieck", "leiterwiderstand", "leitwert", "widerstand-netzwerk", "kondensator-netzwerk", "stromdichte", "kapazitiv", "induktiv", "stern-dreieck", "beleuchtungsstaerke", "lichtstrom", "lampenanzahl", "energie", "energiekosten", "zaehlerleistung", "mechanische-energie", "umrechnung"] as const;
export type MemoryFormulaId = typeof MEMORY_FORMULA_IDS[number];
export const isMemoryFormula = (id: FormulaId): id is MemoryFormulaId => (MEMORY_FORMULA_IDS as readonly string[]).includes(id);

export function memoryFormulaFields(id: MemoryFormulaId, mode = "forward"): MemoryFormulaField[] {
  switch (id) {
    case "leistung-1p": case "leistung-3p": return [f("voltage", id === "leistung-3p" ? "Aussenleiterspannung" : "Spannung", "V", id === "leistung-3p" ? "400" : "230"), mode === "inverse" ? f("power", "Mechanische Nutzleistung", "W", "4000", true) : f("current", "Strom", "A", "10", true), f("cos", "Leistungsfaktor cos φ", "", "0.8", mode !== "inverse", 1), f("eta", "Wirkungsgrad η", "", "1", false, 1)];
    case "leistungsdreieck": return mode === "active-factor" ? [f("power", "Wirkleistung P", "W", "3000", true), f("cos", "Leistungsfaktor cos φ", "", "0.6", false, 1)]
      : mode === "reactive-angle" ? [f("reactive", "Blindleistung Q · Betrag", "var", "4000", true), f("angle", "Phasenwinkel · Betrag", "°", "53.130102354156", false, 90)]
      : [f("power", "Wirkleistung P", "W", "3000", true), f("reactive", "Blindleistung Q · Betrag", "var", "4000", true)];
    case "leiterwiderstand": return [f("rho", "Spezifischer Widerstand ρ · Projektwert", "Ω·mm²/m", "0.0175"), f("length", "Einfache Leiterlänge", "m", "50", true), f("area", "Leiterquerschnitt", "mm²", "2.5")];
    case "leitwert": return mode === "ratio" ? [f("voltage", "Spannung", "V", "10"), f("current", "Strom", "A", "2", true)] : [f("resistance", "Widerstand", "Ω", "5")];
    case "widerstand-netzwerk": return [f("first", "Widerstand R1", "Ω", "10"), f("second", "Widerstand R2", "Ω", "20")];
    case "kondensator-netzwerk": return [f("first", "Kapazität C1", "µF", "10"), f("second", "Kapazität C2", "µF", "20")];
    case "stromdichte": return [f("current", "Strom", "A", "16", true), f("area", "Leiterquerschnitt", "mm²", "2.5")];
    case "kapazitiv": return mode === "ratio" ? [f("voltage", "Spannung am Kondensator", "V", "230"), f("current", "Strom am idealen Kondensator", "A", "0.7225663103256524")]
      : [f("frequency", "Frequenz", "Hz", "50"), f("capacity", "Kapazität", "µF", "10"), f("voltage", "Spannung am Kondensator", "V", "230", true)];
    case "induktiv": return [f("frequency", "Frequenz", "Hz", "50"), f("inductance", "Induktivität", "H", "0.1"), f("voltage", "Spannung an idealer Spule", "V", "230", true)];
    case "stern-dreieck": return [f("voltage", mode.endsWith("inverse") ? "Strangspannung" : "Aussenleiterspannung", "V", "400"), f("current", mode.endsWith("inverse") ? "Strangstrom" : "Aussenleiterstrom der gewählten Schaltung", "A", "10", true)];
    case "beleuchtungsstaerke": return [f("flux", "Lichtstrom auf der Fläche", "lm", "30000", true), f("area", "Beleuchtete Fläche", "m²", "60")];
    case "lichtstrom": return [f("lux", "Mittlere Beleuchtungsstärke", "lx", "500", true), f("area", "Beleuchtete Fläche", "m²", "60"), f("eta", "Anlagenwirkungsgrad · Vorgabe", "", "0.5", false, 1)];
    case "lampenanzahl": return [f("flux", "Notwendiger Gesamtlichtstrom", "lm", "30000", true), f("eachFlux", "Lichtstrom je Lampe", "lm", "4000")];
    case "energie": return [mode === "inverse" ? f("energy", "Energie", "kWh", "2", true) : f("power", "Elektrische Leistung", "kW", "1", true), f("hours", "Zeit", "h", "2", mode !== "inverse")];
    case "energiekosten": return [f("tariff", "Arbeitspreis", "Rp/kWh", "25", true), f("power", "Elektrische Leistung", "kW", "2", true), f("hours", "Zeit", "h", "3", true)];
    case "zaehlerleistung": return [f("count", "Gezählte Umdrehungen / Impulse", "", "10", true), f("constant", "Zählerkonstante", "U/kWh", "1000"), f("seconds", "Messzeit", "s", "36")];
    case "mechanische-energie": return [f("mass", "Masse", "kg", "100", true), f("height", "Angehobene Höhe", "m", "3", true)];
    case "umrechnung": return [f("value", "Ausgangswert", mode === "ps-kw" ? "PS" : mode === "zoll-cm" ? "Zoll" : "kW", "1", true)];
  }
}

/** SI equations with explicit UI unit conversions; no normative limit tables. */
export function calculateMemoryFormula(id: MemoryFormulaId, values: Record<string, number>, mode = "forward"): CalcResult<MemoryFormulaResult> {
  const fail = (message: string): CalcResult<never> => ({ ok: false, message });
  if (!(MEMORY_FORMULA_IDS as readonly string[]).includes(id)) return fail("Eine vorhandene Formel wählen.");
  const modes = ["leistung-1p", "leistung-3p", "energie"].includes(id) ? ["forward", "inverse"] : ["leitwert", "kapazitiv"].includes(id) ? ["forward", "ratio"]
    : id === "leistungsdreieck" ? ["forward", "active-factor", "reactive-angle"]
    : id === "stern-dreieck" ? ["forward", "star", "delta", "star-inverse", "delta-inverse"] : id === "umrechnung" ? ["forward", "ps-kw", "zoll-cm"]
    : ["widerstand-netzwerk", "kondensator-netzwerk"].includes(id) ? ["forward", "series", "parallel"] : ["forward"];
  if (!modes.includes(mode)) return fail("Eine gültige Rechenart wählen.");
  for (const field of memoryFormulaFields(id, mode)) {
    const n = values[field.key];
    if (!Number.isFinite(n) || (field.zero ? n < 0 : n <= 0) || field.maximum !== undefined && n > field.maximum) return fail(`${field.label}: ${field.zero ? "Wert ab 0" : "Wert grösser als 0"}${field.maximum === undefined ? "" : ` bis ${field.maximum}`} erforderlich.`);
  }
  const rows: MemoryFormulaResult["rows"] = [], row = (label: string, value: number, unit: string) => rows.push({ label, value, unit });
  const v = values;
  let equation = "";
  switch (id) {
    case "leistung-1p": case "leistung-3p": {
      const phase = id === "leistung-3p" ? Math.sqrt(3) : 1;
      const current = mode === "inverse" ? v.power / (phase * v.voltage * v.cos * v.eta) : v.current;
      const inputPower = phase * v.voltage * current * v.cos;
      row("Elektrische Wirkleistung", inputPower, "W"); row("Mechanische Nutzleistung", inputPower * v.eta, "W"); row("Strom", current, "A");
      equation = `Pelektrisch = ${phase === 1 ? "U · I" : "√3 · ULL · I"} · cos φ; Pmechanisch = Pelektrisch · η. η = 1 für rein elektrische Wirkleistung.`;
      break;
    }
    case "leistungsdreieck": {
      const s = mode === "active-factor" ? v.power/v.cos : mode === "reactive-angle" ? v.reactive/Math.sin(v.angle*Math.PI/180) : Math.hypot(v.power,v.reactive);
      const p = mode === "reactive-angle" ? s*Math.cos(v.angle*Math.PI/180) : v.power;
      const q = mode === "active-factor" ? s*Math.sqrt(Math.max(0,1-v.cos*v.cos)) : v.reactive;
      row("Scheinleistung S",s,"VA"); if(s>0){row("Leistungsfaktor cos φ",p/s,"");row("Phasenwinkel · Betrag",Math.atan2(q,p)*180/Math.PI,"°");if(mode!=="forward"){row("Wirkleistung P",p,"W");row("Blindleistung Q · Betrag",q,"var");}}
      equation="S = √(P² + Q²) = P/cos φ = Q/sin φ. Winkel in Grad; bei P = Q = 0 bleibt der Leistungsfaktor unbestimmt.";break;
    }
    case "leiterwiderstand": row("Leiterwiderstand", v.rho * v.length / v.area, "Ω"); equation = "R = ρ · l/A. ρ muss zu Material und Temperatur passen; Hin-/Rückleiter getrennt berücksichtigen."; break;
    case "leitwert": row("Leitwert G", mode === "ratio" ? v.current / v.voltage : 1 / v.resistance, "S"); equation = mode === "ratio" ? "G = I/U." : "G = 1/R."; break;
    case "widerstand-netzwerk": row("Gesamtwiderstand", mode === "parallel" ? 1/(1/v.first+1/v.second) : v.first+v.second, "Ω"); equation = mode === "parallel" ? "Rgesamt = 1/(1/R1 + 1/R2)." : "Rgesamt = R1 + R2."; break;
    case "kondensator-netzwerk": row("Gesamtkapazität", mode === "series" ? 1/(1/v.first+1/v.second) : v.first+v.second, "µF"); equation = mode === "series" ? "Cgesamt = 1/(1/C1 + 1/C2)." : "Cgesamt = C1 + C2."; break;
    case "stromdichte": row("Stromdichte J", v.current / v.area, "A/mm²"); equation = "J = I/A. Daraus folgt keine zulässige Strombelastbarkeit oder Schutzfreigabe."; break;
    case "kapazitiv": { const x = mode === "ratio" ? v.voltage/v.current : 1 / (2 * Math.PI * v.frequency * v.capacity * 1e-6); row("Kapazitiver Blindwiderstand Xc", x, "Ω"); row("Strom · idealer Kondensator", v.voltage / x, "A"); equation = mode === "ratio" ? "Xc = U/I · Beträge am idealen Kondensator." : "Xc = 1/(2πfC) = 10⁶/(2πf · C[µF]); I = U/Xc."; break; }
    case "induktiv": { const x = 2 * Math.PI * v.frequency * v.inductance; row("Induktiver Blindwiderstand XL", x, "Ω"); row("Strom · ideale Spule", v.voltage / x, "A"); equation = "XL = 2πfL mit L in H; I = U/XL. Ohmsche Wicklungsverluste sind nicht enthalten."; break; }
    case "stern-dreieck": { const delta=mode.startsWith("delta"), inverse=mode.endsWith("inverse");
      row(inverse?"Aussenleiterspannung":"Strangspannung",inverse?(delta?v.voltage:v.voltage*Math.sqrt(3)):(delta?v.voltage:v.voltage/Math.sqrt(3)),"V");
      row(inverse?"Aussenleiterstrom":"Strangstrom",inverse?(delta?v.current*Math.sqrt(3):v.current):(delta?v.current/Math.sqrt(3):v.current),"A");
      equation=delta?"Dreieck: ULL = Ustr; ILL = √3 · Istr.":"Stern: ULL = √3 · Ustr; ILL = Istr. Symmetrische sinusförmige Schaltung; Motor-Typenschild separat prüfen.";break;
    }
    case "beleuchtungsstaerke": row("Mittlere Beleuchtungsstärke", v.flux / v.area, "lx"); equation = "E = Φ/A. Gleichmässig auf die Bezugsfläche verteilter Lichtstrom; kein Nachweis der Gleichmässigkeit."; break;
    case "lichtstrom": row("Notwendiger Lichtstrom", v.lux * v.area / v.eta, "lm"); equation = "Φ = E · A/η; η ist eine Projektvorgabe, keine automatische Norm-/LiTG-Zuordnung."; break;
    case "lampenanzahl": row("Lampenanzahl · aufgerundet", Math.ceil(v.flux / v.eachFlux), "Stk."); equation = "n = ceil(Φgesamt/Φje Lampe). Weitere Planungsfaktoren müssen im Gesamtlichtstrom enthalten sein."; break;
    case "energie": if (mode === "inverse") { row("Mittlere Leistung", v.energy / v.hours, "kW"); equation = "P[kW] = W[kWh]/t[h]."; } else { row("Energie", v.power * v.hours, "kWh"); row("Energie", v.power * v.hours * 3.6e6, "J"); equation = "W[kWh] = P[kW] · t[h]; 1 kWh = 3.6 MJ."; } break;
    case "energiekosten": { const rp = v.tariff * v.power * v.hours; row("Energie", v.power * v.hours, "kWh"); row("Energiekosten", rp, "Rp"); row("Energiekosten", rp / 100, "CHF"); equation = "K[Rp] = Tarif[Rp/kWh] · P[kW] · t[h]; CHF = Rp/100. Ohne Grund-/Leistungsgebühren."; break; }
    case "zaehlerleistung": row("Mittlere Wirkleistung", 3600 * v.count / (v.constant * v.seconds), "kW"); row("Gemessene Energie", v.count / v.constant, "kWh"); equation = "P[kW] = 3600 · n/(c[U/kWh] · t[s]). U bedeutet hier Umdrehungen/Impulse, nicht Volt."; break;
    case "mechanische-energie": row("Potenzielle Energie", v.mass * 9.81 * v.height, "J = N·m"); row("Potenzielle Energie", v.mass * 9.81 * v.height / 3600, "Wh"); equation = "W = m · g · h mit g = 9.81 m/s²; Ergebnis J = N·m, nicht nm."; break;
    case "umrechnung": if (mode === "ps-kw") { row("Leistung", v.value * 0.73549875, "kW"); equation = "1 metrische PS = 0.73549875 kW (im Merkblatt gerundet)."; } else if (mode === "zoll-cm") { row("Länge", v.value * 2.54, "cm"); equation = "1 Zoll = 2.54 cm exakt."; } else { row("Leistung", v.value / 0.73549875, "PS"); equation = "1 kW = 1/0.73549875 metrische PS (im Merkblatt gerundet)."; } break;
  }
  return rows.every(item => Number.isFinite(item.value)) ? { ok: true, value: { rows, equation } } : fail("Ergebnis ausserhalb des berechenbaren Zahlenbereichs; Eingaben und Einheiten prüfen.");
}
