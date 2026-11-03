import { RESISTANCE_20, REACTANCE } from "../engineering.ts";
import { integer, number, type CalculatorDefinition, type CalculationResult, type Field, type Inputs } from "./types.ts";

const source = (name: string) => `https://www.elektro-rechner.ch/Rechner/${name}.html`;
const f = (key: string, label: string, value: string, unit: string, help: string, group = "Parameter"): Field => ({ key, label, default: value, unit, help, group });
const select = (key: string, label: string, value: string, options: [string, string][], help: string, group = "Parameter"): Field => ({ key, label, default: value, kind: "select", options: options.map(([value, label]) => ({ value, label })), help, group });
const fix = (n: number, digits = 1) => n.toFixed(digits);
function choice(input: Inputs, key: string, allowed: string[]): string {
  const value = input[key];
  if (!allowed.includes(value)) throw new Error(`${key}: eine gültige Option wählen.`);
  return value;
}
function materialArea(input: Inputs) {
  const material = choice(input, "material", ["cu", "al"]) as "cu" | "al";
  const area = number(input, "area", "Querschnitt", 0, 240);
  const r20 = RESISTANCE_20[material][String(area)];
  if (r20 === undefined) throw new Error("Tabellierten Querschnitt wählen; Aluminium wird ab 10 mm² unterstützt.");
  return { material, area, r20, alpha: material === "cu" ? .00393 : .00403, x: REACTANCE[String(area)] };
}
const conductorFields: Field[] = [
  select("material", "Leitermaterial", "cu", [["cu", "Kupfer"], ["al", "Aluminium"]], "Widerstandstabelle nach der veröffentlichten Schweizer Referenz, SN EN 60228. Al ab 10 mm².", "Leitung"),
  select("area", "Leiterquerschnitt", "16", Object.keys(RESISTANCE_20.cu).map(a => [a, `${a} mm²`]), "Tabellierter Querschnitt eines Leiters, nicht die Summe paralleler Leiter.", "Leitung"),
  f("length", "Einfache Leitungslänge", "25", "m", "Einfacher Weg zwischen Quelle und Verbrauchsstelle.", "Leitung"),
  f("parallel", "Parallele Leiter je Phase", "1", "Stk.", "Gleichartige Leiter mit gleichmässiger Stromaufteilung. Ganze Zahl.", "Leitung"),
];

export function calculateShortCircuit(input: Inputs): CalculationResult {
  const voltage = number(input, "voltage", "Aussenleiterspannung", 0, 1000);
  const kva = number(input, "kva", "Trafoleistung", 0, 100000);
  const uk = number(input, "uk", "Kurzschlussspannung", 0, 30);
  const trafos = integer(input, "trafos", "Parallele Trafos", 0, 100);
  const networkR = number(input, "networkR", "Netzwiderstand", 0, 10000, true) / 1000;
  const networkX = number(input, "networkX", "Netzreaktanz", 0, 10000, true) / 1000;
  const length = number(input, "length", "Leitungslänge", 0, 100000), parallel = integer(input, "parallel", "Parallele Leiter", 0, 100);
  const temp = number(input, "temperature", "Temperatur für Schleifenmodell", 20, 150, true);
  const { r20, alpha, x } = materialArea(input);
  // Transformer impedance is deliberately modelled as reactance; this is an approximation.
  const transformerX = uk / 100 * voltage ** 2 / (kva * 1000 * trafos);
  const rLine = r20 * length / 1000 / parallel, xLine = x * length / 1000 / parallel;
  const rWarm = rLine * (1 + alpha * (temp - 20));
  const z3 = Math.hypot(networkR + rLine, networkX + transformerX + xLine);
  const zLoop = Math.hypot(networkR + 2 * rWarm, networkX + transformerX + 2 * xLine);
  const ik3 = voltage / Math.sqrt(3) / z3 / 1000, ikLoop = voltage / Math.sqrt(3) / zLoop / 1000;
  return {
    metrics: [{ label: "3~-Kurzschluss · Modell", value: ik3, unit: "kA", digits: 2 }, { label: "L–PE-Schleife · Modell", value: ikLoop, unit: "kA", digits: 2 }, { label: "Impedanz 3~-Pfad", value: z3 * 1000, unit: "mΩ", digits: 2 }],
    status: { tone: "warning", text: "Impedanz-Näherung; kein normativer Ik-max-/Ik-min-Nachweis." },
    formula: "Z_T ≈ j · (u_k / 100) · U² / (S · n_T); R_L = R′₂₀ · L / (1000 · n_L); I_k,3~ = U / (√3 · |Z_Quelle + Z_L|); I_L–PE ≈ (U / √3) / |Z_Quelle + 2 · Z_L,warm|.",
    limitations: ["Trafo als reine Reaktanz. Spannungsfaktoren, Toleranzen, Netzvorimpedanz und Nullsystemdaten werden nicht normativ bestimmt.", "Die L–PE-Näherung setzt einen gleich langen PE mit gleichem Material, Querschnitt und Parallelanteil wie den Aussenleiter voraus. Nur als vereinfachtes TN-Schleifenmodell anwendbar.", "X′ ist ein publizierter Richtwert, keine installationsspezifische Normtabelle. Ohne vorgelagerte Netzimpedanz kann der reale Fehlerstrom geringer sein.", "Schutzorgan, Abschaltzeit, Ausschaltvermögen, Stossstrom und thermische Kurzschlussfestigkeit sind nicht nachgewiesen. NIN und Netzbetreiberdaten am Projekt prüfen."],
    rows: [{ label: "Trafo-Reaktanz im Modell", value: transformerX * 1000, unit: "mΩ" }, { label: "Leitungswiderstand bei 20 °C", value: rLine * 1000, unit: "mΩ" }, { label: `Leitungswiderstand bei ${temp} °C`, value: rWarm * 1000, unit: "mΩ" }, { label: "Schleifenimpedanz im Modell", value: zLoop * 1000, unit: "mΩ" }],
    diagram: { kind: "chain", nodes: [{ label: "Transformator", value: `${kva} kVA`, detail: `u_k ${uk} % · ${trafos} parallel` }, { label: "Leitungsabschnitt", value: `${length} m`, detail: `R₂₀ ${fix(rLine * 1000, 2)} mΩ` }, { label: "Fehlerstelle", value: `${fix(ik3, 2)} kA`, detail: "symmetrischer 3~-Modellwert", tone: "warning" }] },
  };
}

export function calculateTransformer(input: Inputs): CalculationResult {
  const kva = number(input, "kva", "Nennleistung", 0, 100000), u1 = number(input, "u1", "Primärspannung", 0, 500000), u2 = number(input, "u2", "Sekundärspannung", 0, 500000);
  const uk = number(input, "uk", "Kurzschlussspannung", 0, 30), idle = number(input, "idle", "Leerlaufstromanteil", 0, 100, true), load = number(input, "load", "Auslastung", 0, 200, true);
  const phase = choice(input, "phase", ["1", "3"]), factor = phase === "3" ? Math.sqrt(3) : 1;
  const i1 = kva * 1000 / (factor * u1), i2 = kva * 1000 / (factor * u2), ik = i2 / (uk / 100) / 1000;
  return {
    metrics: [{ label: "Sekundär-Nennstrom", value: i2, unit: "A", digits: 1 }, { label: "Kurzschluss · starres Netz", value: ik, unit: "kA", digits: 2 }, { label: "Übersetzung U₁ / U₂", value: u1 / u2, digits: 2 }],
    status: { tone: load > 100 ? "warning" : "neutral", text: load > 100 ? "Eingegebene Auslastung über Nennleistung; thermische Zulässigkeit offen." : "Nennwerte aus Typenschilddaten; Kurzschlussstrom bei ideal starrer Einspeisung." },
    formula: `I₁N = S / (${phase === "3" ? "√3 · " : ""}U₁); I₂N = S / (${phase === "3" ? "√3 · " : ""}U₂); I_k ≈ I₂N · 100 / u_k; I₀ = I₁N · i₀ / 100; Z_k = (u_k / 100) · U₂² / S.`,
    limitations: ["Ideales ein- oder symmetrisches dreiphasiges Modell. Spannungen und u_k müssen zum gleichen Typenschild-Bezug gehören.", "Leerlaufstrom wird auf die Primärseite bezogen. Verluste, Spannungsregelung, Schaltgruppe und unsymmetrische Belastung werden nicht bestimmt.", "Der Kurzschlusswert setzt ein starres vorgelagertes Netz voraus und ist kein vollständiger Kurzschluss-/Schutzkonzeptnachweis nach Schweizer Planungsvorgaben."],
    rows: [{ label: "Primär-Nennstrom", value: i1, unit: "A" }, { label: "Primärer Leerlaufstrom", value: i1 * idle / 100, unit: "A" }, { label: "Sekundärer Laststrom", value: i2 * load / 100, unit: "A" }, { label: "Kurzschlussimpedanz, U₂-seitig", value: uk / 100 * u2 ** 2 / (kva * 1000), unit: "Ω" }],
    diagram: { kind: "chain", nodes: [{ label: "Primärseite", value: `${u1} V`, detail: `${fix(i1)} A Nennstrom` }, { label: "Transformator", value: `${kva} kVA`, detail: `u_k ${uk} %` }, { label: "Sekundärseite", value: `${u2} V`, detail: `${fix(i2)} A Nennstrom` }] },
  };
}

export function calculateMotor(input: Inputs): CalculationResult {
  const kw = number(input, "kw", "Mechanische Nennleistung", 0, 10000), voltage = number(input, "voltage", "Aussenleiterspannung", 0, 1000);
  const efficiency = number(input, "efficiency", "Motorwirkungsgrad", 0, 1), cos = number(input, "cos", "Leistungsfaktor", 0, 1), multiplier = number(input, "multiplier", "Direktanlauf-Stromfaktor", 0, 20);
  const method = choice(input, "method", ["direct", "star", "manual"]);
  const reduction = method === "star" ? 1 / 3 : method === "manual" ? number(input, "reduction", "Stromanteil gegenüber Direktanlauf", 0, 1) : 1;
  const nominal = kw * 1000 / (Math.sqrt(3) * voltage * efficiency * cos), start = nominal * multiplier * reduction;
  return {
    metrics: [{ label: "Motor-Nennstrom", value: nominal, unit: "A", digits: 1 }, { label: "Anlaufstrom · Annahme", value: start, unit: "A", digits: 1 }, { label: "Elektrische Nennleistung", value: kw / efficiency, unit: "kW", digits: 2 }],
    status: { tone: "warning", text: "Anlaufwerte beruhen auf den eingegebenen Motordaten und Faktoren." },
    formula: "I_N = P_mech / (√3 · U · η · cos φ); I_A = I_N · k_Direktanlauf · r. Idealer Sternanlauf: Leitungs-Anlaufstrom ungefähr ein Drittel des Direktanlaufs in Dreieck.",
    limitations: ["3~-Motor. Wirkungsgrad, cos φ und Anlaufstromfaktor vom Motorhersteller übernehmen; die Vorgaben sind änderbare Beispielannahmen.", "Stern-Dreieck setzt einen für die Netzspannung geeigneten Motor und geeignete Schaltung voraus. Das Modell bewertet weder Umschaltspitzen noch das verfügbare Anlaufmoment.", "Anlaufzeit, Spannungsrückwirkung, Motorschutz, Schutzorgane und Kabeldimensionierung werden nicht nachgewiesen. NIN und Netzbetreiberbedingungen sind gesondert zu prüfen."],
    rows: [{ label: "Direktanlauf-Faktor", value: multiplier }, { label: "Angewendeter Stromanteil", value: reduction }, { label: "Anlaufstrom / Nennstrom", value: multiplier * reduction }, { label: "Scheinleistung bei Nennlast", value: Math.sqrt(3) * voltage * nominal / 1000, unit: "kVA" }],
    series: [{ label: "Nennstrom", value: nominal }, { label: "Anlaufstrom", value: start }], seriesLabel: "Stromvergleich aus den eingegebenen Annahmen", seriesUnit: "A",
  };
}

export function calculateCompensation(input: Inputs): CalculationResult {
  const kw = number(input, "kw", "Wirkleistung", 0, 100000), before = number(input, "before", "Ist-Leistungsfaktor", 0, 1), requestedAfter = number(input, "after", "Soll-Leistungsfaktor", 0, 1);
  const alreadyReached = requestedAfter <= before, after = alreadyReached ? before : requestedAfter;
  const voltage = number(input, "voltage", "Nennspannung", 0, 1000), phase = choice(input, "phase", ["1", "3"]), factor = phase === "3" ? Math.sqrt(3) : 1;
  const hours = number(input, "hours", "Volllaststunden", 0, 8760, true), price = number(input, "price", "Strompreis", 0, 100, true), lossPct = number(input, "lossPct", "Angenommene Leitungsverluste vorher", 0, 100, true);
  const q1 = kw * Math.tan(Math.acos(before)), q2 = kw * Math.tan(Math.acos(after)), s1 = kw / before, s2 = kw / after;
  const i1 = s1 * 1000 / (factor * voltage), i2 = s2 * 1000 / (factor * voltage);
  const savedLoss = kw * lossPct / 100 * (1 - (i2 / i1) ** 2), energy = savedLoss * hours;
  return {
    metrics: [{ label: "Erforderliche Kompensation", value: q1 - q2, unit: "kvar", digits: 2 }, { label: "Stromreduktion", value: i1 - i2, unit: "A", digits: 1 }, { label: "Verlustkosten-Ersparnis · Annahme", value: energy * price, unit: "CHF/Jahr", digits: 0 }],
    status: { tone: "neutral", text: alreadyReached ? "Ziel bereits erreicht; keine kapazitive Kompensation erforderlich. Der Ist-Leistungsfaktor bleibt unverändert." : "Vergleich bei gleicher Wirkleistung; Verlustersparnis ist eine manuelle Modellannahme." },
    formula: "cos φ_nach = max(cos φ_Ist, cos φ_Ziel); Q_C = P · [tan(arccos(cos φ₁)) − tan(arccos(cos φ_nach))]; S = P / cos φ; I = S / (f · U), f = 1 oder √3; ΔP_V = P · p_V · [1 − (I₂ / I₁)²]; ΔE = ΔP_V · h.",
    limitations: ["Sinusförmige Grössen und unveränderte Wirkleistung. Oberschwingungen, Resonanz, Verdrosselung und Stufung einer Kompensationsanlage werden nicht ausgelegt.", "Der eingegebene Verlustanteil ist eine Projektannahme, kein Normwert. Nur die angenommene ohmsche Leitungsverlustersparnis wird bepreist.", "Keine Berechnung von Blindenergie-Tarifen, Netzentgelten oder garantierter Amortisation. Tatsächliche Tarif- und Messdaten des Schweizer Netzbetreibers separat prüfen."],
    rows: [{ label: "Eingegebener Ziel-Leistungsfaktor", value: requestedAfter }, { label: "Angesetzter Leistungsfaktor nachher", value: after }, { label: "Blindleistung vorher", value: q1, unit: "kvar" }, { label: "Blindleistung nachher", value: q2, unit: "kvar" }, { label: "Scheinleistung vorher", value: s1, unit: "kVA" }, { label: "Scheinleistung nachher", value: s2, unit: "kVA" }, { label: "Leitungsverlust-Ersparnis", value: energy, unit: "kWh/Jahr" }],
    series: [{ label: "Vorher", value: i1 }, { label: "Nachher", value: i2 }], seriesLabel: "Strom bei gleicher Wirkleistung", seriesUnit: "A",
  };
}

export function calculateLoss(input: Inputs): CalculationResult {
  const system = choice(input, "system", ["dc", "1", "3"]), voltage = number(input, "voltage", "Nennspannung", 0, 1000), current = number(input, "current", "Laststrom", 0, 100000);
  const length = number(input, "length", "Leitungslänge", 0, 100000), parallel = integer(input, "parallel", "Parallele Leiter", 0, 100), temperature = number(input, "temperature", "Leitertemperatur", 0, 150, true);
  const budget = number(input, "budget", "Spannungsfallbudget", 0, 20), hours = number(input, "hours", "Jahresbetriebsstunden", 0, 8760, true), price = number(input, "price", "Strompreis", 0, 100, true);
  const { r20, alpha } = materialArea(input), r = r20 * (1 + alpha * (temperature - 20)) * length / 1000 / parallel;
  const legs = system === "3" ? 3 : 2, voltageFactor = system === "3" ? Math.sqrt(3) : 2;
  const watts = legs * current ** 2 * r, delta = voltageFactor * current * r, percent = delta / voltage * 100;
  if (delta >= voltage) throw new Error("Modellgrenze: Spannungsfall erreicht die Nennspannung. Eingaben prüfen.");
  const kwh = watts * hours / 1000, good = percent <= budget + 1e-12;
  return {
    metrics: [{ label: "Ohmsche Verlustleistung", value: watts, unit: "W", digits: 1 }, { label: "Spannungsfall · cos φ = 1", value: percent, unit: "%", digits: 2, tone: good ? "ok" : "error" }, { label: "Kosten der Verluste", value: kwh * price, unit: "CHF/Jahr", digits: 0 }],
    status: { tone: good ? "ok" : "warning", text: good ? "Spannungsfall liegt innerhalb des eingegebenen Budgets." : "Spannungsfall überschreitet das eingegebene Budget." },
    formula: "R_Phase = R′₂₀ · [1 + α · (T − 20)] · L / (1000 · n); P_V = c · I² · R_Phase, c = 2 für DC/1~, c = 3 für 3~; ΔU = f · I · R_Phase, f = 2 bzw. √3; E_V = P_V · h / 1000.",
    limitations: ["Ohmsche Last beziehungsweise cos φ = 1. Keine Berücksichtigung von Reaktanz, Oberschwingungen, Unsymmetrie, Skineffekt oder temperaturabhängiger Erwärmung während des Betriebs.", "Die Leitertemperatur ist eine vorgegebene Annahme, kein thermischer Berechnungsnachweis. Bei Parallelleitern wird gleiche Stromaufteilung vorausgesetzt.", "Die Widerstandstabelle wird aus dem bereits dokumentierten Schweizer Spannungsfallmodell verwendet. Keine Strombelastbarkeits-, Verlegeart- oder Schutzorganprüfung; das Budget betrifft die gesamte relevante Strecke im Projekt."],
    rows: [{ label: "Widerstand je Aussenleiterpfad", value: r, unit: "Ω" }, { label: "Spannungsfall", value: delta, unit: "V" }, { label: "Energieverluste", value: kwh, unit: "kWh/Jahr" }, { label: "Maximale einfache Länge aus Budget", value: length * budget / percent, unit: "m" }, { label: "Spannungsfallbudget", value: budget, unit: "%" }],
  };
}

export function calculateOhm(input: Inputs): CalculationResult {
  const system = choice(input, "system", ["dc", "1", "3"]), known = choice(input, "known", ["ui", "ur", "ir", "pu", "pi", "pr"]);
  const factor = system === "3" ? Math.sqrt(3) : 1, cos = system === "dc" ? 1 : number(input, "cos", "Leistungsfaktor", 0, 1);
  const read = (key: string, label: string) => number(input, key, label, 0, 1e9);
  let voltage = 0, current = 0, impedance = 0;
  if (known === "ui") { voltage = read("voltage", "Spannung"); current = read("current", "Strom"); impedance = voltage / (factor * current); }
  if (known === "ur") { voltage = read("voltage", "Spannung"); impedance = read("impedance", "R / |Z| je Strang"); current = voltage / (factor * impedance); }
  if (known === "ir") { current = read("current", "Strom"); impedance = read("impedance", "R / |Z| je Strang"); voltage = factor * current * impedance; }
  if (known === "pu") { const power = read("power", "Wirkleistung"); voltage = read("voltage", "Spannung"); current = power / (factor * voltage * cos); impedance = voltage / (factor * current); }
  if (known === "pi") { const power = read("power", "Wirkleistung"); current = read("current", "Strom"); voltage = power / (factor * current * cos); impedance = voltage / (factor * current); }
  if (known === "pr") { const power = read("power", "Wirkleistung"); impedance = read("impedance", "R / |Z| je Strang"); current = Math.sqrt(power / (factor ** 2 * impedance * cos)); voltage = factor * current * impedance; }
  const apparent = factor * voltage * current, power = apparent * cos, reactive = apparent * Math.sqrt(Math.max(0, 1 - cos ** 2));
  return {
    metrics: [{ label: system === "3" ? "Aussenleiterspannung" : "Spannung", value: voltage, unit: "V", digits: 2 }, { label: "Strom", value: current, unit: "A", digits: 2 }, { label: system === "dc" ? "Widerstand R" : "Impedanz |Z| je Strang", value: impedance, unit: "Ω", digits: 2 }, { label: "Wirkleistung", value: power, unit: "W", digits: 1 }],
    status: { tone: "neutral", text: system === "dc" ? "Gleichstrommodell eines ohmschen Widerstands." : "Sinusförmiges AC-Modell; bei 3~ symmetrische Stern-Ersatzschaltung." },
    formula: "DC/1~: U = I · |Z|; 3~: U_LL = √3 · I_L · |Z_Strang|; S = f · U · I; P = S · cos φ; Q = S · sin φ. Bei DC gilt cos φ = 1 und |Z| = R.",
    limitations: ["Nur die ausgewählten zwei Eingangsgrössen werden verwendet. Die weiteren Zahlenfelder werden in diesem Modus nicht ausgewertet.", "Bei AC ist das Eingabefeld R / |Z| der Betrag der Impedanz, nicht allein der ohmsche Anteil R. Bei 3~ gilt ein symmetrisches Stern-Ersatzmodell mit U als Aussenleiterspannung.", "Keine nichtlinearen Verbraucher, Oberschwingungen oder unsymmetrischen Drehstromlasten. Schweizer Installations- und Schutzvorschriften werden hier nicht geprüft."],
    rows: [{ label: "Scheinleistung", value: apparent, unit: "VA" }, { label: "Blindleistung · Betrag", value: reactive, unit: "var" }, { label: "Ohmscher Anteil je Strang", value: impedance * cos, unit: "Ω" }, { label: "Leistungsfaktor", value: cos }],
  };
}

export function calculateLighting(input: Inputs): CalculationResult {
  const length = number(input, "length", "Raumlänge", 0, 1000), width = number(input, "width", "Raumbreite", 0, 1000), height = number(input, "height", "Montagehöhe", 0, 100);
  const plane = number(input, "plane", "Höhe der Nutzebene", 0, 100, true);
  if (height <= plane) throw new Error("Montagehöhe muss oberhalb der Nutzebene liegen.");
  const lux = number(input, "lux", "Zielbeleuchtungsstärke", 0, 100000), lumen = number(input, "lumen", "Lichtstrom je Leuchte", 0, 1000000), watts = number(input, "watts", "Leistung je Leuchte", 0, 100000);
  const utilisation = number(input, "utilisation", "Nutzungsfaktor", 0, 1), maintenance = number(input, "maintenance", "Wartungsfaktor", 0, 1), cos = number(input, "cos", "Leuchten-Leistungsfaktor", 0, 1);
  const area = length * width, exact = lux * area / (lumen * utilisation * maintenance), required = Math.ceil(exact);
  if (required > 100000) throw new Error("Mehr als 100000 Leuchten im Modell; Eingaben und Einheiten prüfen.");
  const columns = Math.min(required, Math.max(1, Math.ceil(Math.sqrt(required * length / width)))), rows = Math.ceil(required / columns), installed = columns * rows;
  const achieved = installed * lumen * utilisation * maintenance / area;
  return {
    metrics: [{ label: "Leuchten im rechteckigen Raster", value: installed, unit: "Stk.", digits: 0 }, { label: "Installierte Leistung", value: installed * watts, unit: "W", digits: 0 }, { label: "Mittlere Beleuchtungsstärke · Modell", value: achieved, unit: "lx", digits: 0 }],
    status: { tone: "warning", text: "Lichtstromverfahren zur Vorplanung; kein Nachweis von Gleichmässigkeit, Blendung oder Sicherheitsbeleuchtung." },
    formula: "n_rechnerisch = E_m · A / (Φ_Leuchte · η_N · MF); n_min = aufrunden(n_rechnerisch); rechteckiges Raster zusätzlich auf volle Reihen aufrunden; E_Modell = n_Raster · Φ_Leuchte · η_N · MF / A; k = L · B / [h_m · (L + B)].",
    limitations: ["Zielbeleuchtungsstärke, Nutzungs- und Wartungsfaktor sind projektspezifische Eingaben, keine automatisch ausgewählten Normwerte. Faktoren aus Planung und Herstellerdaten übernehmen.", "Das gleichmässige Raster ist ein Anordnungsvorschlag ohne Lichtstärkeverteilung. SN EN 12464-1 und die Schweizer SIA-/SLG-Vorgaben sind am Projekt gesondert zu prüfen.", "Keine photometrische Simulation, Gleichmässigkeit, UGR-, Farbwiedergabe-, Tageslicht- oder Notbeleuchtungsprüfung. Der gezeichnete Raum enthält keine belastbaren Lichtkegel oder Versorgungsradien.", "Betriebsstrom gilt vereinfacht für 230 V einphasig; Einschaltstrom, Treibereigenschaften und Phasenaufteilung werden nicht ausgelegt."],
    rows: [{ label: "Leuchten rechnerisch, aufgerundet", value: required, unit: "Stk." }, { label: "Raster", value: `${columns} × ${rows}` }, { label: "Raumfläche", value: area, unit: "m²" }, { label: "Raumindex", value: area / ((height - plane) * (length + width)) }, { label: "Leistungsdichte", value: installed * watts / area, unit: "W/m²" }, { label: "Betriebsstrom bei 230 V", value: installed * watts / (230 * cos), unit: "A" }],
    diagram: installed <= 200 ? { kind: "room", length, width, columns, rows } : undefined,
  };
}

export const FUNDAMENTALS: CalculatorDefinition[] = [
  {
    id: "kurzschlussstrom", title: "Kurzschlussstrom", description: "Trafo, Leitung und vereinfachte Fehlerschleife als Impedanz-Vorprüfung.", source: source("kurzschlussstrom"), scope: "3~-Fehler und L–PE-Näherung · kein normativer Schutz- oder Ik-min-Nachweis",
    fields: [f("voltage", "Aussenleiterspannung", "400", "V", "Spannung zwischen den Aussenleitern."), f("kva", "Trafo-Nennleistung je Trafo", "630", "kVA", "Typenschildleistung eines gleichartigen Transformators."), f("uk", "Trafo-Kurzschlussspannung", "4", "%", "Typenschildwert; im Modell als reine Reaktanz verwendet."), f("trafos", "Parallele Trafos", "1", "Stk.", "Anzahl identischer parallelbetriebener Trafos."), f("networkR", "Vorgelagerter Netzwiderstand", "0", "mΩ", "Auf die Niederspannungsseite bezogen. Null bedeutet nicht berücksichtigt, kein Netznachweis."), f("networkX", "Vorgelagerte Netzreaktanz", "0", "mΩ", "Auf die Niederspannungsseite bezogen. Null bedeutet nicht berücksichtigt."), ...conductorFields, f("temperature", "Leitertemperatur im Schleifenmodell", "70", "°C", "Manuelle Annahme für den warmen L–PE-Pfad; kein normativ ermittelter Maximalwert.", "Leitung")], calculate: calculateShortCircuit,
  },
  {
    id: "transformator", title: "Transformator", description: "Nennströme, Übersetzung und Kurzschluss-Näherung aus Typenschilddaten.", source: source("transformator"), scope: "Ideales Ein-/Drehstrommodell mit starrem vorgelagertem Netz",
    fields: [select("phase", "System", "3", [["3", "Drehstrom · 3~"], ["1", "Einphasig · 1~"]], "Bei 3~ werden Aussenleiterspannungen und gesamte Nennscheinleistung eingegeben."), f("kva", "Nennscheinleistung", "250", "kVA", "S_N gemäss Typenschild."), f("u1", "Primärspannung", "20000", "V", "Typenschild-Primärspannung."), f("u2", "Sekundärspannung im Leerlauf", "400", "V", "Typenschild-Sekundärspannung."), f("uk", "Kurzschlussspannung u_k", "4", "%", "Typenschildwert, keine automatische Grössentabelle."), f("idle", "Leerlaufstrom i₀", "1", "%", "Prozent des primären Nennstroms gemäss Hersteller."), f("load", "Auslastung", "80", "%", "Verhältnis zur Nennscheinleistung. Über 100 % ist keine Freigabe für Überlastbetrieb.")], calculate: calculateTransformer,
  },
  {
    id: "motoranlauf", title: "Motoranlauf", description: "Nenn- und Anlaufstrom mit expliziten Motor- und Anlauffaktoren vergleichen.", source: source("motoranlauf"), scope: "Symmetrischer 3~-Motor · Anlaufstrom-Näherung, keine Schutz-/Kabelauslegung",
    fields: [f("kw", "Mechanische Motor-Nennleistung", "7.5", "kW", "Abgegebene mechanische Leistung, nicht die elektrische Aufnahmeleistung."), f("voltage", "Aussenleiterspannung", "400", "V", "Spannung zwischen den Aussenleitern."), f("efficiency", "Motorwirkungsgrad η", "0.9", "", "Herstellerwert für den betrachteten Betriebspunkt; Beispielannahme."), f("cos", "Leistungsfaktor cos φ", "0.85", "", "Herstellerwert, nicht automatisch aus Motorleistung geschätzt."), f("multiplier", "Direktanlauf-Stromfaktor", "6", "× I_N", "Herstellerwert. Der Vorgabewert ist nur eine änderbare Beispielannahme."), select("method", "Anlaufmodell", "direct", [["direct", "Direktanlauf"], ["star", "Sternanlauf · idealisiert"], ["manual", "Manueller Stromanteil"]], "Sternanlauf reduziert den Leitungsanlaufstrom im Idealvergleich zum Dreieck-Direktanlauf auf ein Drittel."), f("reduction", "Manueller Stromanteil", "0.5", "", "Nur im manuellen Modus: Verhältnis gegenüber Direktanlauf aus Anlasser-/Herstellerdaten.")], calculate: calculateMotor,
  },
  {
    id: "blindleistung", title: "Blindleistung", description: "Kompensation, Stromreduktion und angenommene Verlustersparnis vergleichen.", source: source("blindleistung"), scope: "Sinusförmiges Leistungsdreieck · Verlustanteil und Tarif manuell",
    fields: [f("kw", "Wirkleistung", "100", "kW", "Unveränderte Wirkleistung vor und nach der Kompensation."), f("before", "Ist-Leistungsfaktor cos φ₁", "0.75", "", "Gemessener oder geplanter Ist-Wert."), f("after", "Soll-Leistungsfaktor cos φ₂", "0.95", "", "Ist der Zielwert bereits erreicht, wird keine Kompensation angesetzt; der Ist-Wert wird nicht verschlechtert."), select("phase", "System", "3", [["3", "Drehstrom · 3~"], ["1", "Einphasig · 1~"]], "Drehstrom wird symmetrisch betrachtet."), f("voltage", "Nennspannung", "400", "V", "Bei Drehstrom Aussenleiterspannung, bei 1~ Verbraucherspannung."), f("lossPct", "Leitungsverluste vorher · Annahme", "2", "% von P", "Manueller ohmscher Verlustanteil; 2 % ist kein Normwert und muss projektspezifisch belegt werden.", "Wirtschaftlichkeit"), f("hours", "Volllaststunden pro Jahr", "2000", "h", "Stunden mit der betrachteten Last, maximal 8760.", "Wirtschaftlichkeit"), f("price", "Arbeitspreis", "0.25", "CHF/kWh", "Nur Arbeitspreis für eingesparte Verluste, keine Blindenergie-/Netzentgelte.", "Wirtschaftlichkeit")], calculate: calculateCompensation,
  },
  {
    id: "verlustleistung", title: "Verlustleistung", description: "Ohmsche Leitungsverluste, Spannungsfall und jährliche Verlustkosten.", source: source("verlustleistung"), scope: "DC oder symmetrische AC-Last mit cos φ = 1 · kein Strombelastbarkeitsnachweis",
    fields: [select("system", "System", "3", [["dc", "Gleichstrom · 2 Leiter"], ["1", "Einphasig · 1~"], ["3", "Drehstrom · 3~"]], "AC-Spannungsfall wird für cos φ = 1 ohne Reaktanz gerechnet."), f("voltage", "Nennspannung", "400", "V", "Bei 3~ Aussenleiterspannung, sonst Hin-/Rückleiter-Spannung."), f("current", "Laststrom je Phase", "16", "A", "Bei Parallelleitern Gesamtstrom je Phase."), ...conductorFields.map(field => field.key === "area" ? { ...field, default: "2.5" } : field), f("temperature", "Angenommene Leitertemperatur", "55", "°C", "Manueller Betriebspunkt, kein berechneter Erwärmungsnachweis."), f("budget", "Spannungsfallbudget dieses Modells", "4", "%", "An das Projekt und vorgelagerte Abschnitte anpassen; keine zusätzliche Freigabe pro Teilstrecke."), f("hours", "Jahresbetriebsstunden", "2000", "h", "Betrachtete Laststunden, maximal 8760.", "Wirtschaftlichkeit"), f("price", "Arbeitspreis", "0.25", "CHF/kWh", "Projektspezifischer Schweizer Energietarif.", "Wirtschaftlichkeit")], calculate: calculateLoss,
  },
  {
    id: "ohmsches-gesetz", title: "Ohmsches Gesetz", description: "Zwei bekannte Grössen wählen und Spannung, Strom, Impedanz und Leistung berechnen.", source: source("ohmsches-gesetz"), scope: "DC oder sinusförmiges AC-Modell · 3~ als symmetrisches Stern-Ersatzmodell",
    fields: [select("system", "System", "dc", [["dc", "Gleichstrom"], ["1", "Einphasig · 1~"], ["3", "Drehstrom · 3~"]], "Bei DC rein ohmscher Widerstand. Bei AC wird der Betrag der Strangimpedanz berechnet."), select("known", "Bekannte Grössen", "ui", [["ui", "Spannung U + Strom I"], ["ur", "Spannung U + R / |Z|"], ["ir", "Strom I + R / |Z|"], ["pu", "Wirkleistung P + Spannung U"], ["pi", "Wirkleistung P + Strom I"], ["pr", "Wirkleistung P + R / |Z|"]], "Es werden ausschliesslich die ausgewählten zwei Werte und bei AC der Leistungsfaktor verwendet."), f("voltage", "Spannung U", "230", "V", "Nur in Modi mit U verwendet. Bei 3~ Aussenleiterspannung."), f("current", "Strom I", "10", "A", "Nur in Modi mit I verwendet. Bei 3~ Aussenleiterstrom."), f("impedance", "R / Betrag |Z| je Strang", "23", "Ω", "Nur in Modi mit R / |Z| verwendet. AC: Impedanzbetrag, nicht nur der ohmsche Anteil."), f("power", "Wirkleistung P gesamt", "2300", "W", "Nur in Modi mit P verwendet; bei 3~ Summe aller drei Stränge."), f("cos", "Leistungsfaktor cos φ", "1", "", "Bei AC berücksichtigt. Bei DC wird immer cos φ = 1 verwendet.")], calculate: calculateOhm,
  },
  {
    id: "beleuchtung", title: "Beleuchtung", description: "Leuchtenzahl und rechteckige Anordnung nach dem Lichtstromverfahren vorplanen.", source: source("beleuchtung"), scope: "Lichtstrom-Vorplanung · Ziel- und Nutzungsfaktoren manuell, keine photometrische Freigabe",
    fields: [f("length", "Raumlänge", "10", "m", "Lichte Raumlänge.", "Raum"), f("width", "Raumbreite", "8", "m", "Lichte Raumbreite.", "Raum"), f("height", "Montagehöhe der Leuchten", "3", "m", "Höhe der Leuchten über Boden, muss oberhalb der Nutzebene liegen.", "Raum"), f("plane", "Höhe der Nutzebene", "0.8", "m", "Projektspezifische Bezugsebene für den Raumindex.", "Raum"), f("lux", "Zielbeleuchtungsstärke E_m", "500", "lx", "Projektspezifisches Ziel aus dem Raum-/Nutzungskonzept; 500 lx ist nur die Beispielvorgabe.", "Leuchten"), f("lumen", "Lichtstrom je Leuchte", "4200", "lm", "Herstellerwert je vollständiger Leuchte.", "Leuchten"), f("watts", "Elektrische Leistung je Leuchte", "40", "W", "Leuchtenaufnahmeleistung inklusive Treiber.", "Leuchten"), f("utilisation", "Nutzungsfaktor η_N", "0.7", "", "Aus Leuchtendaten und Raumkonzept übernehmen; keine automatische Normtabelle.", "Leuchten"), f("maintenance", "Wartungsfaktor MF", "0.8", "", "Manuelle Projektannahme aus Wartungskonzept, nicht normativ automatisch bestimmt.", "Leuchten"), f("cos", "Leuchten-Leistungsfaktor", "0.95", "", "Für die vereinfachte 230-V-Betriebsstromberechnung.", "Leuchten")], calculate: calculateLighting,
  },
];

// Display only the two selected inputs; retained values remain available on mode changes.
const ohmDefinition = FUNDAMENTALS.find(item => item.id === "ohmsches-gesetz")!;
const ohmKnownModes: Record<string, string[]> = { voltage: ["ui", "ur", "pu"], current: ["ui", "ir", "pi"], impedance: ["ur", "ir", "pr"], power: ["pu", "pi", "pr"] };
for (const field of ohmDefinition.fields) {
  if (ohmKnownModes[field.key]) field.visibleWhen = [{ key: "known", values: ohmKnownModes[field.key] }];
  if (field.key === "cos") field.visibleWhen = [{ key: "system", values: ["1", "3"] }];
}
