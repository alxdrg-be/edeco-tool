import { RESISTANCE_20, REACTANCE } from "../engineering.ts";
import { LEGACY_VOLTAGE_WARNING, shortCircuitVoltageFactors, VOLTAGE_TOLERANCE_HELP, VOLTAGE_TOLERANCE_OPTIONS } from "../voltageFactors.ts";
import { integer, number, type CalculatorDefinition, type CalculationResult, type Field, type Inputs } from "./types.ts";
import { approximateRoomUtilisation, luminairePreset, LUMINAIRE_PRESETS, LUX_PRESETS, motorPresetEfficiency, motorProtectionRating } from "./fundamentalsData.ts";
import { lookupPublishedIz, publishedAreas, INSTALLATION_REFERENCE, type PublishedIzConfig } from "./referenceInstallationData.ts";

const source = (name: string) => `https://www.elektro-rechner.ch/Rechner/${name}.html`;
const f = (key: string, label: string, value: string, unit: string, help: string, group = "Parameter"): Field => ({ key, label, default: value, unit, help, group });
const select = (key: string, label: string, value: string, options: [string, string][], help: string, group = "Parameter"): Field => ({ key, label, default: value, kind: "select", options: options.map(([value, label]) => ({ value, label })), help, group });
const fix = (n: number, digits = 1) => n.toLocaleString("de-CH", { maximumFractionDigits: digits });
export const TRANSFORMER_RATINGS_KVA = [25, 50, 100, 160, 250, 400, 630, 1000, 1600, 2000, 2500] as const;
export const MOTOR_RATINGS_KW = [.37, .55, .75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75] as const;
const ratedOptions = (values: readonly number[], unit: string): [string, string][] => values.map(value => [String(value), `${fix(value, 2)} ${unit}`]);
function choice(input: Inputs, key: string, allowed: string[]): string {
  const value = input[key];
  if (!allowed.includes(value)) throw new Error(`${key}: eine gültige Option wählen.`);
  return value;
}
function materialArea(input: Inputs, allowLossCu300 = false) {
  const material = choice(input, "material", ["cu", "al"]) as "cu" | "al";
  const area = number(input, "area", "Querschnitt", 0, allowLossCu300 ? 300 : 240);
  const r20 = RESISTANCE_20[material][String(area)] ?? (allowLossCu300 && material === "cu" && area === 300 ? .0601 : undefined);
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
  const voltage = Number(choice(input, "voltage", ["230", "400"]));
  const sourceMode = choice(input, "sourceMode", ["nameplate", "preset", "impedance"]);
  const kva = sourceMode === "nameplate" ? number(input, "kva", "Trafoleistung", 0, 100000) : sourceMode === "preset" ? Number(choice(input, "sourcePreset", ["100", "160", "250", "400", "630", "800", "1000", "1250", "1600", "2000", "2500"])) : null;
  const uk = sourceMode === "nameplate" ? number(input, "uk", "Kurzschlussspannung", 0, 30) : kva !== null ? kva <= 630 ? 4 : 6 : null;
  const trafos = sourceMode === "impedance" ? 1 : integer(input, "trafos", "Parallele Trafos", 0, 100);
  const networkR = number(input, "networkR", "Netzwiderstand", 0, 10000, true) / 1000;
  const networkX = number(input, "networkX", "Netzreaktanz", 0, 10000, true) / 1000;
  const length = number(input, "length", "Leitungslänge", 0, 100000), parallel = integer(input, "parallel", "Parallele Leiter", 0, 100);
  const temp = number(input, "temperature", "Temperatur für Schleifenmodell", 20, 150, true);
  const { r20, alpha, x } = materialArea(input);
  const transformerX = sourceMode === "impedance" ? number(input, "sourceImpedance", "Resultierende Quellenimpedanz", 0, 100000) / 1000 : uk! / 100 * (sourceMode === "preset" ? 400 : voltage) ** 2 / (kva! * 1000 * trafos);
  const rLine = r20 * length / 1000 / parallel, xLine = x * length / 1000 / parallel;
  const rWarm = rLine * (1 + alpha * (temp - 20));
  const maximumPaths = voltage === 230 ? 2 : 1;
  const z3 = Math.hypot(networkR + maximumPaths * rLine, networkX + transformerX + maximumPaths * xLine);
  const sourceMagnitude = Math.hypot(networkR, networkX + transformerX);
  const loopMagnitude = 2 * Math.hypot(rWarm, xLine), zLoop = sourceMagnitude + loopMagnitude;
  const voltageFactors = shortCircuitVoltageFactors(input.voltageTolerance);
  const { cMax, cMin } = voltageFactors, u0 = 230;
  const ik3 = cMax * voltage / (voltage === 230 ? 1 : Math.sqrt(3)) / z3 / 1000, ikLoop = cMin * u0 / zLoop / 1000;
  const totalR = networkR + maximumPaths * rLine, totalX = networkX + transformerX + maximumPaths * xLine;
  const peakFactor = 1.02 + .98 * Math.exp(-3 * totalR / totalX), peak = peakFactor * Math.sqrt(2) * ik3;
  const thermal = ik3 * Math.sqrt(.1);
  return {
    metrics: [{ label: voltage === 230 ? "L–N-Kurzschluss · Modell" : "3~-Kurzschluss · Modell", value: ik3, unit: "kA", digits: 2 }, { label: "L–PE-Schleife · Modell", value: ikLoop, unit: "kA", digits: 2 }, { label: voltage === 230 ? "Impedanz L–N-Pfad" : "Impedanz 3~-Pfad", value: z3 * 1000, unit: "mΩ", digits: 2 }],
    status: { tone: "warning", text: `${voltageFactors.legacy ? LEGACY_VOLTAGE_WARNING + " " : ""}Modell mit c_max = ${cMax.toFixed(2)} und c_min = 0.95; kein normativer Ik-max-/Ik-min-Nachweis und keine garantierte Schranke.` },
    formula: `Z_T ≈ j · (u_k / 100) · U² / (S · n_T); R_L = R′₂₀ · L / (1000 · n_L). I_k,max,Modell = ${cMax.toFixed(2)} × ${fix(voltage)} / (${voltage === 230 ? "1" : "√3"} × ${fix(z3, 6)} × 1000) = ${fix(ik3, 3)} kA. Z_min,Modell = |Z_Quelle| + 2|Z_L,warm| = ${fix(zLoop, 6)} Ω; I_L–PE,Modell = 0.95 × 230 / (${fix(zLoop, 6)} × 1000) = ${fix(ikLoop, 3)} kA (Umrechnung A → kA: /1000). κ ≈ 1.02 + 0.98 · exp(−3R/X) = ${fix(peakFactor, 4)}; i_p ≈ κ · √2 · I_k = ${fix(peak, 3)} kA. I√t = ${fix(ik3, 3)} × √0.1 = ${fix(thermal, 3)} kA√s.`,
    limitations: [`Trafo als reine Reaktanz. Spannungsfaktoren c_max ${cMax.toFixed(2)} und c_min 0.95; gewählte Netz-Spannungstoleranz: ${voltageFactors.label}. Für NS-Netze: +10 % → c_max 1.10, +6 % → c_max 1.05 nach IEC 60909-0. Die tatsächlichen Netzbetreiber-/Projektbedingungen prüfen; keine vollständige IEC-60909-Studie.`, "Die L–PE-Näherung setzt einen gleich langen PE mit gleichem Material, Querschnitt und Parallelanteil wie den Aussenleiter voraus. U₀ = 230 V; die vorgegebene Leitertemperatur ist eine Annahme. Nur als vereinfachtes TN-Schleifenmodell anwendbar.", "Für den warmen Pfad werden die Beträge von Quellen- und Schleifenimpedanz addiert. Fehlende Netzvorimpedanz, abweichender PE oder höhere reale Leitertemperatur können den tatsächlichen Fehlerstrom weiter senken; der Wert ist keine garantierte Untergrenze.", "X′ ist ein publizierter Richtwert. Stossstrom und I√t bei 0.1 s sind zusätzliche Näherungswerte; Schutzorgan, Abschaltzeit, Ausschaltvermögen und thermische Kurzschlussfestigkeit sind damit nicht nachgewiesen. NIN und Netzbetreiberdaten am Projekt prüfen."],
    rows: [{ label: "Gewählte Netz-Spannungstoleranz", value: voltageFactors.label }, { label: "Spannungsfaktor c_max · Modell", value: cMax }, { label: "Spannungsfaktor c_min · Modell", value: cMin }, { label: "Trafo-Reaktanz im Modell", value: transformerX * 1000, unit: "mΩ" }, { label: "Leitungswiderstand bei 20 °C", value: rLine * 1000, unit: "mΩ" }, { label: "Leitungsreaktanz · Richtwert", value: xLine * 1000, unit: "mΩ" }, { label: "Leitungsimpedanz · Betrag", value: Math.hypot(rLine, xLine) * 1000, unit: "mΩ" }, { label: `Leitungswiderstand bei ${temp} °C`, value: rWarm * 1000, unit: "mΩ" }, { label: "Quellenimpedanz · Betrag", value: sourceMagnitude * 1000, unit: "mΩ" }, { label: "Warme L–PE-Schleife · Betrag", value: loopMagnitude * 1000, unit: "mΩ" }, { label: "Schleifenimpedanz im Modell", value: zLoop * 1000, unit: "mΩ" }, { label: "Stossfaktor κ · Näherung", value: peakFactor }, { label: "Stossstrom · Näherung", value: peak, unit: "kA" }, { label: "Thermischer I√t-Ansatz · 0.1 s", value: thermal, unit: "kA√s" }],
    diagram: { kind: "chain", nodes: [{ label: sourceMode === "impedance" ? "Resultierende Quelle" : "Transformator", value: sourceMode === "impedance" ? `${fix(transformerX * 1000, 3)} mΩ` : `${kva} kVA`, detail: sourceMode === "impedance" ? "als Reaktanz modelliert" : `u_k ${uk} % · ${trafos} parallel` }, { label: "Leitungsabschnitt", value: `${length} m`, detail: `R₂₀ ${fix(rLine * 1000, 2)} mΩ` }, { label: "Fehlerstelle", value: `${fix(ik3, 2)} kA`, detail: voltage === 230 ? "L–N-Modellwert" : "symmetrischer 3~-Modellwert", tone: "warning" }] },
  };
}

export function calculateTransformer(input: Inputs): CalculationResult {
  const kva = number(input, "kva", "Nennleistung", 0, 100000), u1 = number(input, "u1", "Primärspannung", 0, 500000), u2 = number(input, "u2", "Sekundärspannung", 0, 500000);
  const ukMode = choice(input, "ukMode", ["preset", "manual"]);
  const uk = number(input, ukMode === "manual" ? "ukManual" : "uk", "Kurzschlussspannung", 0, 30), idle = number(input, "idle", "Leerlaufstromanteil", 0, 100, true), load = number(input, "load", "Auslastung", 0, 200, true);
  const phase = choice(input, "phase", ["1", "3"]), factor = phase === "3" ? Math.sqrt(3) : 1;
  const i1 = kva * 1000 / (factor * u1), i2 = kva * 1000 / (factor * u2), ik = i2 / (uk / 100) / 1000;
  // Same voltage factor as the short-circuit calculator, so both tools give the same Ik,max for the same transformer.
  const voltageFactors = shortCircuitVoltageFactors(input.voltageTolerance), ikMax = ik * voltageFactors.cMax;
  return {
    metrics: [{ label: "Sekundär-Nennstrom", value: i2, unit: "A", digits: 1 }, { label: "Kurzschluss · starres Netz", value: ik, unit: "kA", digits: 2 }, { label: "Übersetzung U₁ / U₂", value: u1 / u2, digits: 2 }, { label: "Ik,max mit c_max", value: ikMax, unit: "kA", digits: 2 }],
    status: { tone: load > 100 ? "warning" : "neutral", text: load > 100 ? "Eingegebene Auslastung über Nennleistung; thermische Zulässigkeit offen." : "Nennwerte aus Typenschilddaten; Kurzschlussstrom bei ideal starrer Einspeisung." },
    formula: `I₁N = S / (${phase === "3" ? "√3 · " : ""}U₁) = ${fix(i1, 3)} A. I₂N = ${fix(kva)} × 1000 / (${phase === "3" ? "√3 × " : ""}${fix(u2)}) = ${fix(i2, 3)} A. I_k = ${fix(i2, 3)} × 100 / ${fix(uk)} / 1000 = ${fix(ik, 3)} kA (c = 1, starres Netz). Z_k = (${fix(uk)} / 100) × ${fix(u2)}² / (${fix(kva)} × 1000) = ${fix(uk / 100 * u2 ** 2 / (kva * 1000), 6)} Ω.`,
    limitations: [`«Kurzschluss · starres Netz» ist I₂N / u_k ohne Spannungsfaktor. «Ik,max mit c_max» multipliziert mit c_max = ${voltageFactors.cMax.toFixed(2)} (${voltageFactors.label}); diesen Wert verwendet auch der Kurzschluss-Rechner für das Ausschaltvermögen.${voltageFactors.legacy ? " " + LEGACY_VOLTAGE_WARNING : ""}`, "Ideales ein- oder symmetrisches dreiphasiges Modell. Spannungen und u_k müssen zum gleichen Typenschild-Bezug gehören.", "Leerlaufstrom wird auf die Primärseite bezogen. Verluste, Spannungsregelung, Schaltgruppe und unsymmetrische Belastung werden nicht bestimmt.", "Der Kurzschlusswert setzt ein starres vorgelagertes Netz voraus und ist kein vollständiger Kurzschluss-/Schutzkonzeptnachweis nach Schweizer Planungsvorgaben."],
    rows: [{ label: "Primär-Nennstrom", value: i1, unit: "A" }, { label: "Primärer Leerlaufstrom", value: i1 * idle / 100, unit: "A" }, { label: "Sekundärer Laststrom", value: i2 * load / 100, unit: "A" }, { label: "Kurzschlussspannung bezogen auf U₂", value: uk * u2 / 100, unit: "V" }, { label: "Kurzschlussimpedanz, U₂-seitig", value: uk / 100 * u2 ** 2 / (kva * 1000), unit: "Ω" }],
    diagram: { kind: "chain", nodes: [{ label: "Primärseite", value: `${u1} V`, detail: `${fix(i1)} A Nennstrom` }, { label: "Transformator", value: `${kva} kVA`, detail: `u_k ${uk} %` }, { label: "Sekundärseite", value: `${u2} V`, detail: `${fix(i2)} A Nennstrom` }] },
  };
}

export function calculateMotor(input: Inputs): CalculationResult {
  const inputMode = choice(input, "inputMode", ["power", "current"]);
  const voltage = number(input, "voltage", "Aussenleiterspannung", 0, 1000), cos = number(input, "cos", "Leistungsfaktor", 0, 1);
  const kw = inputMode === "power" ? number(input, "kw", "Mechanische Nennleistung", 0, 10000) : null;
  const efficiencyMode = inputMode === "power" ? choice(input, "efficiencyMode", ["preset", "manual"]) : "unused";
  const efficiency = kw === null ? null : efficiencyMode === "preset" ? motorPresetEfficiency(kw) : number(input, "efficiency", "Motorwirkungsgrad", 0, 1);
  const nominal = kw === null ? number(input, "nominalCurrent", "Motor-Nennstrom", 0, 20000) : kw * 1000 / (Math.sqrt(3) * voltage * efficiency! * cos);
  const method = choice(input, "method", ["direct", "star", "soft", "vfd", "manual"]);
  const multiplier = ["soft", "vfd"].includes(method) ? 6 : number(input, "multiplier", "Direktanlauf-Stromfaktor", 0, 20);
  const reduction = method === "star" ? 1 / 3 : method === "manual" ? number(input, "reduction", "Stromanteil gegenüber Direktanlauf", 0, 1) : 1;
  const startFactor = method === "soft" ? 3 : method === "vfd" ? 1.2 : multiplier * reduction, start = nominal * startFactor;
  const checkIz = choice(input, "checkIz", ["off", "on", "auto"]);
  let iz: number | null = null, chosenArea: number | null = null, maxIz: number | null = null, installation = "nicht geprüft";
  if (checkIz === "on") iz = number(input, "iz", "Dokumentierte Strombelastbarkeit Iz", 0, 20000);
  if (checkIz === "auto") {
    const isolation = choice(input, "isolation", ["pvc", "xlpe"]) as "pvc" | "xlpe", method = choice(input, "methodIz", ["B1", "B2", "C", "D", "E"]);
    const config: PublishedIzConfig = { material: "cu", isolation, method, cores: 3 };
    const areas = publishedAreas(config).filter(area => area <= 300);
    if (!areas.length) throw new Error("Für diese Motorkabel-Kombination fehlen veröffentlichte Vergleichswerte.");
    chosenArea = areas.find(area => lookupPublishedIz({ ...config, area })! >= nominal - 1e-12) ?? null;
    iz = chosenArea === null ? null : lookupPublishedIz({ ...config, area: chosenArea });
    maxIz = lookupPublishedIz({ ...config, area: areas[areas.length - 1] });
    installation = `${isolation.toUpperCase()} / ${method} / 3 belastete Adern / Cu`;
  }
  const tooSmall = iz !== null && iz < nominal - 1e-9, noSection = checkIz === "auto" && chosenArea === null;
  const mss = motorProtectionRating(nominal), electricalKW = Math.sqrt(3) * voltage * nominal * cos / 1000;
  const time = method === "vfd" ? "1–30 s · einstellbare Annahme" : method === "soft" ? "3–30 s · Annahme" : "0.5–3 s · Annahme";
  const moment = method === "star" ? "ca. 60 % M_N · Annahme" : method === "soft" ? "30–70 % M_N · Annahme" : method === "vfd" ? "bis ca. 150 % M_N · Annahme" : method === "manual" ? "aus Herstellerdaten festlegen" : "ca. 180 % M_N · Annahme";
  return {
    metrics: [{ label: "Motor-Nennstrom", value: nominal, unit: "A", digits: 1 }, { label: "Anlaufstrom · Annahme", value: start, unit: "A", digits: 1 }, { label: "Elektrische Nennleistung", value: electricalKW, unit: "kW", digits: 2 }],
    status: { tone: tooSmall || noSection ? "error" : "warning", text: tooSmall ? "Eingetragene Strombelastbarkeit Iz liegt unter dem Motor-Nennstrom." : noSection ? "Kein veröffentlichter Querschnitt bis 300 mm² erreicht den Nennstrom; Einzelauslegung erforderlich." : mss === null ? "Motorstrom über der hinterlegten MSS-Reihe bis 125 A; kein zu kleines Gerät empfohlen." : iz !== null ? "Iz ≥ I_N erfüllt; Auswahl aus veröffentlichten Grundwerten. Korrekturen, Schutz-/Anlaufnachweise bleiben offen." : "Anlaufwerte sind Annahmen. Strombelastbarkeit Iz ist nicht geprüft." },
    formula: `I_N = P_mech / (√3 · U · η · cos φ). ${kw === null ? `I_N = ${fix(nominal, 3)} A nach Typenschild.` : `I_N = ${fix(kw, 3)} × 1000 / (√3 × ${fix(voltage)} × ${fix(efficiency!, 3)} × ${fix(cos, 3)}) = ${fix(nominal, 3)} A.`} I_A = I_N × k_A = ${fix(nominal, 3)} × ${fix(startFactor, 3)} = ${fix(start, 3)} A. ${iz === null ? noSection ? `Grösster veröffentlichter Iz = ${fix(maxIz!, 1)} A < I_N.` : "Iz-Vergleich nicht ausgewählt." : `Iz ${fix(iz)} A ≥ I_N ${fix(nominal, 3)} A: ${tooSmall ? "nein" : "ja"}.`}`,
    limitations: ["IE3-Vorgaben stammen aus dem veröffentlichten Referenzverhalten für 4-polige 50-Hz-Motoren; sie sind keine automatische Bestätigung des konkreten Motors. Typenschildwerte haben Vorrang. Anlauffaktoren, -moment und -dauer sind Annahmen.", `Automatische Querschnittssuche nur Cu, 3 belastete Adern, PVC/XLPE und B1/B2/C/D/E bis 300 mm². Die beobachteten Grundwerte (${INSTALLATION_REFERENCE.observed}) benötigen die zum Projekt passenden NIN-2025-Korrekturen; Temperatur, Häufung und abweichende Verlegung werden hier nicht automatisch berücksichtigt.`, "Die MSS-Stufe ist eine Grössenempfehlung, keine Gerätefreigabe. Der Überlastauslöser muss zum Motor-Nennstrom passen; die Stufe kann über Iz liegen. Kennlinie, Kurzschlusskoordination und Hersteller-Einstellbereich separat prüfen.", "Stern-Dreieck benötigt einen für Netz und Schaltung geeigneten Motor. Umschaltspitzen, verfügbares Moment, Netzrückwirkung und reale Anlaufzeit werden nicht nachgewiesen."],
    rows: [{ label: "Mechanische Nennleistung", value: kw === null ? "Nennstrom direkt vorgegeben" : kw, unit: kw === null ? undefined : "kW" }, { label: "Verwendeter Wirkungsgrad", value: efficiency === null ? "nicht verwendet" : efficiency }, { label: "Wirkungsgrad-Herkunft", value: efficiencyMode === "preset" ? "veröffentlichte IE3-Vorgabe · 4-polig, 50 Hz" : efficiencyMode === "manual" ? "manueller Typenschildwert" : "direkte Nennstromvorgabe" }, { label: "Direktanlauf-Faktor", value: ["soft", "vfd"].includes(method) ? "nicht verwendet" : multiplier }, { label: "Angewendeter Stromanteil", value: reduction }, { label: "Anlaufstrom / Nennstrom", value: startFactor }, { label: "Scheinleistung bei Nennlast", value: Math.sqrt(3) * voltage * nominal / 1000, unit: "kVA" }, { label: "Strombelastbarkeit Iz · manuell", value: checkIz === "on" ? iz! : "nicht manuell eingetragen", unit: checkIz === "on" ? "A" : undefined }, { label: "Automatisch gewählter Querschnitt", value: chosenArea === null ? checkIz === "auto" ? "keiner bis 300 mm²" : "nicht ausgewählt" : chosenArea, unit: chosenArea === null ? undefined : "mm² Cu" }, { label: "Iz des gewählten Querschnitts", value: checkIz === "auto" && iz !== null ? iz : "nicht ausgewählt", unit: checkIz === "auto" && iz !== null ? "A" : undefined }, { label: "Kabel-Grundwert", value: installation }, { label: "MSS-Grössenempfehlung", value: mss === null ? "keine bis 125 A" : mss, unit: mss === null ? undefined : "A" }, { label: "Anlaufdauer · Richtwert", value: time }, { label: "Anlaufmoment · Richtwert", value: moment }],
    series: [{ label: "Nennstrom", value: nominal }, { label: "Anlaufstrom", value: start }], seriesLabel: "Stromvergleich aus den eingegebenen Annahmen", seriesUnit: "A",
  };
}

export function calculateCompensation(input: Inputs): CalculationResult {
  const location = choice(input, "compensationLocation", ["not-set", "individual", "group", "central"]);
  const locationLabels: Record<string, string> = { "not-set": "nicht festgelegt", individual: "am einzelnen Verbraucher", group: "für eine Verbrauchergruppe", central: "zentral an der Verteilung" };
  const locationLabel = locationLabels[location];
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
    formula: `cos φ_nach = max(cos φ_Ist, cos φ_Ziel). Q_C = P · [tan(arccos(cos φ₁)) − tan(arccos(cos φ_nach))] = ${fix(kw)} × [tan(arccos(${fix(before, 3)})) − tan(arccos(${fix(after, 3)}))] = ${fix(q1 - q2, 3)} kvar. I_vorher = ${fix(s1, 3)} × 1000 / (${phase === "3" ? "√3 × " : ""}${fix(voltage)}) = ${fix(i1, 3)} A; I_nachher = ${fix(i2, 3)} A. ΔE = P · p_V · [1 − (I₂ / I₁)²] · h = ${fix(energy, 3)} kWh/Jahr.`,
    limitations: ["Sinusförmige Grössen und unveränderte Wirkleistung. Oberschwingungen, Resonanz, Verdrosselung und Stufung einer Kompensationsanlage werden nicht ausgelegt.", "Der eingegebene Verlustanteil ist eine Projektannahme, kein Normwert. Der dokumentierte Kompensationsort ändert diese Formel nicht; die reale Einsparung hängt vom tatsächlich entlasteten Leitungsabschnitt ab.", "Keine Berechnung von Blindenergie-Tarifen, Netzentgelten oder garantierter Amortisation. Tatsächliche Tarif- und Messdaten des Schweizer Netzbetreibers separat prüfen."],
    rows: [{ label: "Kompensationsort · Dokumentation", value: locationLabel }, { label: "Eingegebener Ziel-Leistungsfaktor", value: requestedAfter }, { label: "Angesetzter Leistungsfaktor nachher", value: after }, { label: "Blindleistung vorher", value: q1, unit: "kvar" }, { label: "Blindleistung nachher", value: q2, unit: "kvar" }, { label: "Scheinleistung vorher", value: s1, unit: "kVA" }, { label: "Scheinleistung nachher", value: s2, unit: "kVA" }, { label: "Leitungsverlust-Ersparnis", value: energy, unit: "kWh/Jahr" }],
    series: [{ label: "Vorher", value: i1 }, { label: "Nachher", value: i2 }], seriesLabel: "Strom bei gleicher Wirkleistung", seriesUnit: "A",
  };
}

export function calculateLoss(input: Inputs): CalculationResult {
  const system = choice(input, "system", ["dc", "1", "3"]), voltage = number(input, "voltage", "Nennspannung", 0, 1000), current = number(input, "current", "Laststrom", 0, 100000);
  const length = number(input, "length", "Leitungslänge", 0, 100000), parallel = integer(input, "parallel", "Parallele Leiter", 0, 100), temperature = number(input, "temperature", "Leitertemperatur", 0, 150, true);
  const budget = number(input, "budget", "Spannungsfallbudget", 0, 20), price = number(input, "price", "Strompreis", 0, 100, true);
  const durationMode = choice(input, "durationMode", ["annual", "calendar"]), years = number(input, "years", "Betrachtungsdauer", 0, 100);
  const dailyHours = durationMode === "calendar" ? number(input, "dailyHours", "Betriebsstunden pro Tag", 0, 24, true) : null;
  const days = durationMode === "calendar" ? integer(input, "days", "Betriebstage pro Jahr", 0, 365) : null;
  const hours = dailyHours === null ? number(input, "hours", "Jahresbetriebsstunden", 0, 8760, true) : dailyHours * days!;
  const cos = system === "dc" ? 1 : number(input, "cos", "Leistungsfaktor cos φ", 0, 1);
  const { material, area, r20, alpha, x } = materialArea(input, true), r = r20 * (1 + alpha * (temperature - 20)) * length / 1000 / parallel;
  const sin = Math.sqrt(Math.max(0, 1 - cos ** 2)), needsX = system !== "dc" && sin > 0;
  if (needsX && x === undefined) throw new Error("Für 300 mm² ist kein Reaktanz-Richtwert belegt. Dieser Querschnitt wird nur bei DC oder cos φ = 1 gerechnet; für andere AC-Lasten ist ein belegter X′-Wert erforderlich.");
  const reactance = system === "dc" || x === undefined ? 0 : x * length / 1000 / parallel;
  const legs = system === "3" ? 3 : 2, voltageFactor = system === "3" ? Math.sqrt(3) : 2;
  const watts = legs * current ** 2 * r, delta = voltageFactor * current * (r * cos + reactance * sin), percent = delta / voltage * 100;
  if (delta >= voltage) throw new Error("Modellgrenze: Spannungsfall erreicht die Nennspannung. Eingaben prüfen.");
  const kwh = watts * hours / 1000, totalHours = hours * years, totalKwh = kwh * years, good = percent <= budget + 1e-12;
  const parallelWarning = parallel > 1 && material === "cu" && area < 70;
  const lossR20 = material === "cu" ? { ...RESISTANCE_20.cu, "300": .0601 } : RESISTANCE_20.al;
  const recommended = Object.keys(lossR20).map(Number).sort((a,b) => a-b).find(area => {
    const rCandidate = lossR20[String(area)] * (1 + alpha * (temperature - 20)) * length / 1000 / parallel;
    if (needsX && REACTANCE[String(area)] === undefined) return false;
    const xCandidate = needsX ? REACTANCE[String(area)] * length / 1000 / parallel : 0;
    return voltageFactor * current * (rCandidate * cos + xCandidate * sin) <= voltage * budget / 100 + 1e-12;
  }) ?? null;
  return {
    metrics: [{ label: "Ohmsche Verlustleistung", value: watts, unit: "W", digits: 1 }, { label: cos === 1 ? "Spannungsfall · cos φ = 1" : "Spannungsfall · R/X und cos φ", value: percent, unit: "%", digits: 2, tone: good ? percent >= .9 * budget ? "warning" : "ok" : "error" }, { label: "Kosten der Verluste", value: kwh * price, unit: "CHF/Jahr", digits: 0 }, { label: "Gesamtkosten im Zeitraum", value: totalKwh * price, unit: "CHF", digits: 2 }],
    status: { tone: !good ? "error" : percent >= .9 * budget || parallelWarning ? "warning" : "ok", text: (!good ? "Spannungsfall überschreitet das eingegebene Budget." : percent >= .9 * budget ? "Spannungsfall liegt nahe an der eingegebenen Grenze." : "Spannungsfall liegt innerhalb des eingegebenen Budgets.") + (parallelWarning ? " Parallelleiter Cu unter 70 mm²: Anordnung nach NIN 5.2.3.7 prüfen; nicht verseilte Ausführung ist damit nicht freigegeben." : "") },
    formula: `P_V = c · I² · R_Phase; ΔU = f · I · (R_Phase · cos φ + X_Phase · sin φ).\nR_Phase = R′₂₀ · [1 + α · (T − 20)] · L / (1000 · n) = ${fix(r, 6)} Ω. P_V = ${legs} × ${fix(current)}² × ${fix(r, 6)} = ${fix(watts, 2)} W. ΔU = ${system === "3" ? "√3" : "2"} × ${fix(current)} × (${fix(r, 6)} × ${fix(cos, 3)} + ${fix(reactance, 6)} × ${fix(sin, 4)}) = ${fix(delta, 3)} V = ${fix(percent, 3)} %. h_gesamt = ${dailyHours === null ? `${fix(hours)} h/Jahr` : `${fix(dailyHours)} h/Tag × ${days} Tage/Jahr`} × ${fix(years, 2)} Jahre = ${fix(totalHours)} h. E_V = ${fix(watts, 2)} × ${fix(totalHours)} / 1000 = ${fix(totalKwh, 3)} kWh; Kosten = ${fix(totalKwh, 3)} × ${fix(price, 4)} = ${fix(totalKwh * price, 2)} CHF.`,
    limitations: ["Der AC-Spannungsfall berücksichtigt R · cos φ + X · sin φ bei induktiver sinusförmiger Last. X′ ist ein publizierter Richtwert, kein installationsspezifischer Normwert. Bei DC und cos φ = 1 wird X′ nicht benötigt; Cu 300 mm² verwendet den publizierten R′₂₀-Wert 0.0601 Ω/km.", "Die Leitertemperatur ist eine vorgegebene Annahme, kein thermischer Berechnungsnachweis. Bei Parallelleitern wird gleiche Stromaufteilung vorausgesetzt; Oberschwingungen, Unsymmetrie und Skineffekt bleiben unberücksichtigt.", "Der 4-%-Ansatz bezieht sich auf NIN 5.2.5.1 und die gesamte relevante Strecke; andere Budgets sind Projektwerte. Querschnittsempfehlung nur für das Spannungsfallbudget: belegte R/X-Paare bis 240 mm², Cu 300 mm² zusätzlich nur ohne benötigten X′-Anteil. Keine Strombelastbarkeits-, Verlegeart- oder Schutzorganfreigabe."],
    rows: [{ label: "Widerstand je Aussenleiterpfad", value: r, unit: "Ω" }, { label: "Widerstand des Spannungsfallpfads", value: system === "3" ? r : 2 * r, unit: "Ω" }, { label: "R′ bei Leitertemperatur", value: r20 * (1 + alpha * (temperature - 20)), unit: "Ω/km" }, { label: "Effektiver Leiterquerschnitt je Phase", value: area * parallel, unit: "mm²" }, { label: "Reaktanz je Aussenleiterpfad · Richtwert", value: reactance, unit: "Ω" }, { label: "Leistungsfaktor cos φ", value: cos }, { label: "Spannungsfall", value: delta, unit: "V" }, { label: "Energieverluste", value: kwh, unit: "kWh/Jahr" }, { label: "Betrachtungsdauer", value: years, unit: "Jahre" }, { label: "Betriebsstunden total", value: totalHours, unit: "h" }, { label: "Energieverluste total", value: totalKwh, unit: "kWh" }, { label: "Kleinster Querschnitt für das Spannungsfallbudget", value: recommended === null ? `keiner bis ${material === "cu" && !needsX ? 300 : 240} mm²` : recommended, unit: recommended === null ? undefined : "mm²" }, { label: "Maximale einfache Länge aus Budget", value: length * budget / percent, unit: "m" }, { label: "Spannungsfallbudget", value: budget, unit: "%" }],
    comparisons: [{ title: budget === 4 ? "Spannungsfall · 4 % nach NIN 5.2.5.1" : "Spannungsfall · Projektbudget", unit: "%", items: [{ label: "Spannungsfall", actual: percent, target: budget }] }],
  };
}

export function calculateOhm(input: Inputs): CalculationResult {
  const system = choice(input, "system", ["dc", "1", "3"]), known = choice(input, "known", ["ui", "ur", "ir", "pu", "pi", "pr"]);
  const factor = system === "3" ? Math.sqrt(3) : 1, cos = system === "dc" ? 1 : number(input, "cos", "Leistungsfaktor", 0, 1, true);
  if (cos === 0 && ["pu", "pi", "pr"].includes(known)) throw new Error("Bei cos φ = 0 lässt sich aus der Wirkleistung kein eindeutiger Strom oder Spannungswert bestimmen.");
  const read = (key: string, label: string, zero = false) => number(input, key, label, 0, 1e9, zero);
  let voltage = 0, current = 0, impedance = 0;
  if (known === "ui") { voltage = read("voltage", "Spannung", true); current = read("current", "Strom"); impedance = voltage / (factor * current); }
  if (known === "ur") { voltage = read("voltage", "Spannung", true); impedance = read("impedance", "R / |Z| je Strang"); current = voltage / (factor * impedance); }
  if (known === "ir") { current = read("current", "Strom", true); impedance = read("impedance", "R / |Z| je Strang"); voltage = factor * current * impedance; }
  if (known === "pu") { const power = read("power", "Wirkleistung"); voltage = read("voltage", "Spannung"); current = power / (factor * voltage * cos); impedance = voltage / (factor * current); }
  if (known === "pi") { const power = read("power", "Wirkleistung"); current = read("current", "Strom"); voltage = power / (factor * current * cos); impedance = voltage / (factor * current); }
  if (known === "pr") { const power = read("power", "Wirkleistung"); impedance = read("impedance", "R / |Z| je Strang"); current = Math.sqrt(power / (factor ** 2 * impedance * cos)); voltage = factor * current * impedance; }
  const apparent = factor * voltage * current, power = apparent * cos, reactive = apparent * Math.sqrt(Math.max(0, 1 - cos ** 2));
  return {
    metrics: [{ label: system === "3" ? "Aussenleiterspannung" : "Spannung", value: voltage, unit: "V", digits: 2 }, { label: "Strom", value: current, unit: "A", digits: 2 }, { label: system === "dc" ? "Widerstand R" : "Impedanz |Z| je Strang", value: impedance, unit: "Ω", digits: 2 }, { label: "Wirkleistung", value: power, unit: "W", digits: 1 }],
    status: { tone: "neutral", text: system === "dc" ? "Gleichstrommodell eines ohmschen Widerstands." : "Sinusförmiges AC-Modell; bei 3~ symmetrische Stern-Ersatzschaltung." },
    formula: `DC/1~: U = I · |Z|; 3~: U_LL = √3 · I_L · |Z_Strang|. U = ${system === "3" ? "√3 × " : ""}${fix(current, 4)} × ${fix(impedance, 4)} = ${fix(voltage, 4)} V. S = ${system === "3" ? "√3 × " : ""}${fix(voltage, 4)} × ${fix(current, 4)} = ${fix(apparent, 3)} VA. P = S × cos φ = ${fix(apparent, 3)} × ${fix(cos, 3)} = ${fix(power, 3)} W; Q = √(S² − P²) = ${fix(reactive, 3)} var.`,
    limitations: ["Nur die ausgewählten zwei Eingangsgrössen werden verwendet. Die weiteren Zahlenfelder werden in diesem Modus nicht ausgewertet.", "Bei AC ist das Eingabefeld R / |Z| der Betrag der Impedanz, nicht allein der ohmsche Anteil R. Bei 3~ gilt ein symmetrisches Stern-Ersatzmodell mit U als Aussenleiterspannung.", "Keine nichtlinearen Verbraucher, Oberschwingungen oder unsymmetrischen Drehstromlasten. Schweizer Installations- und Schutzvorschriften werden hier nicht geprüft."],
    rows: [{ label: "Scheinleistung", value: apparent, unit: "VA" }, { label: "Blindleistung · Betrag", value: reactive, unit: "var" }, { label: "Phasenwinkel φ", value: Math.acos(cos) * 180 / Math.PI, unit: "°" }, { label: "Ohmscher Anteil je Strang", value: impedance * cos, unit: "Ω" }, { label: "Leistungsfaktor", value: cos }],
  };
}

export function calculateLighting(input: Inputs): CalculationResult {
  const length = number(input, "length", "Raumlänge", 0, 1000), width = number(input, "width", "Raumbreite", 0, 1000), height = number(input, "height", "Montagehöhe", 0, 100);
  const plane = number(input, "plane", "Höhe der Nutzebene", 0, 100, true);
  if (height <= plane) throw new Error("Montagehöhe muss oberhalb der Nutzebene liegen.");
  const luxMode = choice(input, "luxMode", ["manual", ...LUX_PRESETS.map(String)]);
  const lux = luxMode === "manual" ? number(input, "lux", "Zielbeleuchtungsstärke", 0, 100000) : Number(luxMode);
  const lampChoice = choice(input, "luminaire", ["manual", ...LUMINAIRE_PRESETS.map(item => item.id)]);
  const lamp = lampChoice === "manual" ? null : luminairePreset(lampChoice);
  const lumen = lamp ? lamp.lumen : number(input, "lumen", "Lichtstrom je Leuchte", 0, 1000000), watts = lamp ? lamp.watts : number(input, "watts", "Leistung je Leuchte", 0, 100000);
  const etaMode = choice(input, "etaMode", ["manual", "room"]), area = length * width, roomIndex = area / ((height - plane) * (length + width));
  const reflectance = etaMode === "room" ? number(input, "reflectance", "Reflexionsannahme", 0, 1, true) : null;
  const utilisation = reflectance === null ? number(input, "utilisation", "Vereinfachter Raumwirkungsgrad", 0, 1) : approximateRoomUtilisation(roomIndex, reflectance);
  const maintenance = number(input, "maintenance", "Wartungsfaktor", 0, 1), cos = number(input, "cos", "Leuchten-Leistungsfaktor", 0, 1);
  const layout = choice(input, "layout", ["minimum", "full"]);
  const requiredFlux = lux * area / (utilisation * maintenance), exact = requiredFlux / lumen, required = Math.ceil(exact);
  if (required > 100000) throw new Error("Mehr als 100000 Leuchten im Modell; Eingaben und Einheiten prüfen.");
  const columns = Math.min(required, Math.max(1, Math.ceil(Math.sqrt(required * length / width)))), rows = Math.ceil(required / columns), fullGrid = columns * rows;
  const installed = layout === "full" ? fullGrid : required, achieved = installed * lumen * utilisation * maintenance / area;
  return {
    metrics: [{ label: "Leuchtenanzahl", value: installed, unit: "Stk.", digits: 0 }, { label: "Installierte Leistung", value: installed * watts, unit: "W", digits: 0 }, { label: "Mittlere Beleuchtungsstärke · Modell", value: achieved, unit: "lx", digits: 0 }],
    status: { tone: "warning", text: "Lichtstromverfahren zur Vorplanung; kein Nachweis von Gleichmässigkeit, Blendung oder Sicherheitsbeleuchtung." },
    formula: `n_min = ceil(E_m · A / (Φ_Leuchte · η · MF)) = ceil(${fix(lux)} × ${fix(area)} / (${fix(lumen)} × ${fix(utilisation, 6)} × ${fix(maintenance, 3)})) = ${required} Leuchten. ${layout === "full" ? `Gewählte volle Reihen: ${columns} × ${rows} = ${installed} Leuchten.` : `Gewählte Mindestanzahl: ${installed} Leuchten; kein zusätzliches Aufrunden auf volle Reihen.`} P = ${installed} × ${fix(watts)} = ${fix(installed * watts)} W. k = A / [h_m · (L + B)] = ${fix(roomIndex, 3)}. ${reflectance === null ? `η = ${fix(utilisation, 6)} manuell.` : `η ≈ min(0.85, 0.4 + 0.16 × ${fix(roomIndex, 6)} × (${fix(reflectance, 3)} + 0.3)) = ${fix(utilisation, 6)} (vereinfachte Annahme).`}`,
    limitations: ["η ist ein vereinfachter Raumwirkungsgrad und kein LiTG- oder Norm-Wirkungsgrad. Die Raumableitung verwendet eine veröffentlichte empirische Näherung mit Reflexionsannahme, keine photometrischen Tabellen. Manuelle Eingabe bleibt möglich.", "Leuchtenbeispiele enthalten beobachtete Leistungs-/Lichtstromwerte, keine freigegebene Herstellerprodukt-Datenbank. Die Luxauswahl ist eine Planungsvorgabe; sie wählt keine normativ bestätigte Raumnutzung. Hersteller- und Wartungsdaten am Projekt prüfen.", "Standard ist die mathematisch aufgerundete Mindestanzahl. Volle Rasterreihen sind optional. Die Zeichnung zeigt die gewählte Anzahl ohne reale Lichtverteilung, UGR-, Gleichmässigkeits-, Farbwiedergabe-, Tageslicht- oder Notbeleuchtungsnachweis.", "Betriebsstrom gilt für 230 V einphasig mit dem eingegebenen Leistungsfaktor. Einschaltstrom, Treiber und Phasenaufteilung werden nicht dimensioniert; Schweizer SN EN 12464-1-/SIA-/SLG-Vorgaben separat prüfen."],
    rows: [{ label: "Leuchtenbeispiel", value: lamp ? lamp.label : "manuelle Daten" }, { label: "Leistung je Leuchte", value: watts, unit: "W" }, { label: "Lichtstrom je Leuchte", value: lumen, unit: "lm" }, { label: "Leuchten-Lichtausbeute", value: lumen / watts, unit: "lm/W" }, { label: "Leuchten rechnerisch, aufgerundet", value: required, unit: "Stk." }, { label: "Vollständiges Raster · optional", value: fullGrid, unit: "Stk." }, { label: "Rasterplätze", value: `${columns} × ${rows}` }, { label: "Raumfläche", value: area, unit: "m²" }, { label: "Raumindex", value: roomIndex }, { label: "Verwendeter Raumwirkungsgrad η · vereinfacht", value: utilisation }, { label: "Erforderlicher Gesamtlichtstrom", value: requiredFlux, unit: "lm" }, { label: "Leistungsdichte", value: installed * watts / area, unit: "W/m²" }, { label: "Betriebsstrom bei 230 V", value: installed * watts / (230 * cos), unit: "A" }],
    diagram: { kind: "room", length, width, columns, rows, count: installed },
  };
}

export const FUNDAMENTALS: CalculatorDefinition[] = [
  {
    id: "kurzschlussstrom", title: "Kurzschlussstrom", description: "Trafo, Leitung und vereinfachte Fehlerschleife als Impedanz-Vorprüfung.", source: source("kurzschlussstrom"), scope: "NIN 2025 4.1.1.4 · 230/400-V-Modell, kein normativer Ik-min-/Ik-max-Nachweis",
    fields: [select("voltageTolerance", "Spannungstoleranz für Ik,max", "plus10", VOLTAGE_TOLERANCE_OPTIONS, VOLTAGE_TOLERANCE_HELP), select("sourceMode", "Quelle festlegen", "nameplate", [["nameplate", "Typenschildwerte S und u_k"], ["preset", "Trafo-Vorgabe · 400-V-Bezug"], ["impedance", "Resultierende Impedanz eingeben"]], "Die resultierende Impedanz wird als Reaktanz modelliert. Vorgelagerte Netz-R/X-Werte werden zusätzlich gerechnet."), select("sourcePreset", "Trafo-Vorgabe", "630", ratedOptions([100, 160, 250, 400, 630, 800, 1000, 1250, 1600, 2000, 2500], "kVA"), "400-V-Vorgabe: bis 630 kVA u_k = 4 %, ab 800 kVA u_k = 6 %. Kein Ersatz für Typenschilddaten."), f("sourceImpedance", "Resultierende Quellenimpedanz", "25.6", "mΩ", "Bereits resultierende Impedanz inklusive parallelbetriebener Quellen; die Trafoanzahl wird in diesem Modus nicht nochmals angewandt."), select("voltage", "Netzspannung", "400", [["400", "400 V · 3~"], ["230", "230 V · 1~"]], "Bei 230 V wird für den maximalen Modellstrom die L–N-Schleife mit zwei Leiterwegen gerechnet."), select("kva", "Trafo-Nennleistung je Trafo", "630", ratedOptions([100, 160, 250, 400, 630, 800, 1000, 1250, 1600, 2000, 2500], "kVA"), "Auswahl gebräuchlicher Typenschildleistungen; keine automatische Gerätedimensionierung."), select("uk", "Trafo-Kurzschlussspannung", "4", [["4", "4 %"], ["6", "6 %"]], "Gebräuchliche Typenschildwerte; im Modell als reine Reaktanz verwendet."), f("trafos", "Parallele Trafos", "1", "Stk.", "Anzahl identischer parallelbetriebener Trafos."), f("networkR", "Vorgelagerter Netzwiderstand", "0", "mΩ", "Auf die Niederspannungsseite bezogen. Null bedeutet nicht berücksichtigt, kein Netznachweis."), f("networkX", "Vorgelagerte Netzreaktanz", "0", "mΩ", "Auf die Niederspannungsseite bezogen. Null bedeutet nicht berücksichtigt."), ...conductorFields, f("temperature", "Leitertemperatur im Schleifenmodell", "80", "°C", "Manuelle Annahme für den warmen L–PE-Pfad; kein normativ ermittelter Maximalwert.", "Leitung")], calculate: calculateShortCircuit,
  },
  {
    id: "transformator", title: "Transformator", description: "Nennströme, Übersetzung und Kurzschluss-Näherung aus Typenschilddaten.", source: source("transformator"), scope: "SN EN 60076 · ideales Ein-/Drehstrommodell, Kurzschluss bei starrem Netz und c = 1",
    fields: [select("phase", "System", "3", [["3", "Drehstrom · 3~"], ["1", "Einphasig · 1~"]], "Bei 3~ werden Aussenleiterspannungen und gesamte Nennscheinleistung eingegeben."), select("kva", "Nennscheinleistung", "250", ratedOptions(TRANSFORMER_RATINGS_KVA, "kVA"), "Gebräuchliche Nennscheinleistungen; S_N des konkreten Typenschilds ist massgebend."), f("u1", "Primärspannung", "20000", "V", "Typenschild-Primärspannung."), f("u2", "Sekundärspannung im Leerlauf", "400", "V", "Typenschild-Sekundärspannung."), select("ukMode", "u_k eingeben", "preset", [["preset", "Gebräuchlichen Listenwert wählen"], ["manual", "Typenschildwert manuell"]], "Ein abweichender Typenschildwert kann direkt eingegeben werden."), f("ukManual", "Manueller Typenschildwert u_k", "4", "%", "Kurzschlussspannung aus dem konkreten Typenschild."), select("uk", "Kurzschlussspannung u_k", "4", [["4", "4 %"], ["6", "6 %"]], "Gebräuchliche Auswahl; Typenschildwert ist massgebend, keine automatische Grössenzuordnung."), f("idle", "Leerlaufstrom i₀", "1", "%", "Prozent des primären Nennstroms gemäss Hersteller."), f("load", "Auslastung", "80", "%", "Verhältnis zur Nennscheinleistung. Über 100 % ist keine Freigabe für Überlastbetrieb."), select("voltageTolerance", "Spannungstoleranz für Ik,max", "plus10", VOLTAGE_TOLERANCE_OPTIONS, VOLTAGE_TOLERANCE_HELP)], calculate: calculateTransformer,
  },
  {
    id: "motoranlauf", title: "Motoranlauf", description: "Nenn- und Anlaufstrom mit expliziten Motor- und Anlauffaktoren vergleichen.", source: source("motoranlauf"), scope: "NIN 2025 5.2.3 / SN EN 60204-1 · 3~-Motor, Anlauffaktoren als Annahme",
    fields: [select("inputMode", "Motor-Nennwert", "power", [["power", "Mechanische Nennleistung"], ["current", "Nennstrom vom Typenschild"]], "Direkt eingegebener Nennstrom benötigt keine geschätzte Motorleistung oder Effizienz."), f("nominalCurrent", "Motor-Nennstrom nach Typenschild", "15", "A", "Direkte Stromvorgabe; Leistung und Wirkungsgrad werden in diesem Modus nicht ausgewertet."), select("efficiencyMode", "Wirkungsgrad festlegen", "preset", [["preset", "IE3-Vorgabe · 4-polig, 50 Hz"], ["manual", "Manueller Typenschildwert"]], "Veröffentlichte Beispielwerte; keine Bestätigung der konkreten Energieeffizienzklasse."), select("kw", "Mechanische Motor-Nennleistung", "7.5", ratedOptions(MOTOR_RATINGS_KW, "kW"), "Gebräuchliche Leistungsauswahl; abgegebene mechanische Typenschildleistung, nicht die elektrische Aufnahmeleistung."), f("voltage", "Aussenleiterspannung", "400", "V", "Spannung zwischen den Aussenleitern."), f("efficiency", "Motorwirkungsgrad η", "0.9", "", "Herstellerwert für den betrachteten Betriebspunkt; Beispielannahme."), f("cos", "Leistungsfaktor cos φ", "0.85", "", "Herstellerwert, nicht automatisch aus Motorleistung geschätzt."), f("multiplier", "Direktanlauf-Stromfaktor", "6", "× I_N", "Herstellerwert. Der Vorgabewert ist nur eine änderbare Beispielannahme."), select("method", "Anlaufmodell", "direct", [["direct", "Direktanlauf · Vorgabe 6 × I_N"], ["star", "Stern-Dreieck · Vorgabe 2 × I_N"], ["soft", "Sanftanlauf · Annahme 3 × I_N"], ["vfd", "Frequenzumrichter · Annahme 1.2 × I_N"], ["manual", "Manueller Stromanteil"]], "Sternanlauf reduziert den Leitungsanlaufstrom im Idealvergleich zum Dreieck-Direktanlauf auf ein Drittel."), f("reduction", "Manueller Stromanteil", "0.5", "", "Nur im manuellen Modus: Verhältnis gegenüber Direktanlauf aus Anlasser-/Herstellerdaten."), select("checkIz", "Strombelastbarkeit vergleichen", "auto", [["auto", "Querschnitt aus veröffentlichten Grundwerten"], ["off", "Nicht geprüft"], ["on", "Dokumentierten Iz-Wert eingeben"]], "Automatik: Cu, 3 belastete Adern, bis 300 mm². Häufung und Temperaturkorrekturen müssen gesondert zum Projekt passen."), select("isolation", "Motorkabel-Isolation", "pvc", [["pvc", "PVC"], ["xlpe", "XLPE"]], "Isolation für die veröffentlichten Grundwerte."), select("methodIz", "Motorkabel-Verlegeart", "B2", [["B1", "B1"], ["B2", "B2"], ["C", "C"], ["D", "D"], ["E", "E"]], "Belegte Methoden für drei belastete Kupferadern. Keine automatische Bewertung der realen Verlegung."), f("iz", "Dokumentierte Strombelastbarkeit Iz", "", "A", "Nach allen Korrekturfaktoren aus NIN-/Herstellerdaten; ohne Beleg kein Kabelnachweis.")], calculate: calculateMotor,
  },
  {
    id: "blindleistung", title: "Blindleistung", description: "Kompensation, Stromreduktion und angenommene Verlustersparnis vergleichen.", source: source("blindleistung"), scope: "NIN 8.1.10.2.2.4 · Ziel-cos φ aus Netzbetreibervertrag, Verlustanteil manuell",
    fields: [select("compensationLocation", "Kompensationsort", "not-set", [["not-set", "Noch nicht festgelegt"], ["individual", "Einzelner Verbraucher"], ["group", "Verbrauchergruppe"], ["central", "Zentrale Verteilung"]], "Dokumentationsangabe. Wie in der Referenz verändert diese Auswahl die Kompensationsformel nicht; das reale Verlustmodell hängt von der Platzierung ab."), f("kw", "Wirkleistung", "100", "kW", "Unveränderte Wirkleistung vor und nach der Kompensation."), f("before", "Ist-Leistungsfaktor cos φ₁", "0.75", "", "Gemessener oder geplanter Ist-Wert."), f("after", "Soll-Leistungsfaktor cos φ₂", "0.95", "", "Ist der Zielwert bereits erreicht, wird keine Kompensation angesetzt; der Ist-Wert wird nicht verschlechtert."), select("phase", "System", "3", [["3", "Drehstrom · 3~"], ["1", "Einphasig · 1~"]], "Drehstrom wird symmetrisch betrachtet."), f("voltage", "Nennspannung", "400", "V", "Bei Drehstrom Aussenleiterspannung, bei 1~ Verbraucherspannung."), f("lossPct", "Leitungsverluste vorher · Annahme", "2", "% von P", "Manueller ohmscher Verlustanteil; 2 % ist kein Normwert und muss projektspezifisch belegt werden.", "Wirtschaftlichkeit"), f("hours", "Volllaststunden pro Jahr", "2000", "h", "Stunden mit der betrachteten Last, maximal 8760.", "Wirtschaftlichkeit"), f("price", "Arbeitspreis", "0.25", "CHF/kWh", "Nur Arbeitspreis für eingesparte Verluste, keine Blindenergie-/Netzentgelte.", "Wirtschaftlichkeit")], calculate: calculateCompensation,
  },
  {
    id: "verlustleistung", title: "Verlustleistung", description: "Ohmsche Leitungsverluste, Spannungsfall und jährliche Verlustkosten.", source: source("verlustleistung"), scope: "NIN 5.2.5.1 · AC-Spannungsfall mit R/X und cos φ, I²R-Verluste; keine Kabelauslegung",
    fields: [select("system", "System", "3", [["dc", "Gleichstrom · 2 Leiter"], ["1", "Einphasig · 1~"], ["3", "Drehstrom · 3~"]], "AC-Spannungsfall berücksichtigt cos φ und den Reaktanz-Richtwert; DC wird rein ohmsch gerechnet."), f("voltage", "Nennspannung", "400", "V", "Bei 3~ Aussenleiterspannung, sonst Hin-/Rückleiter-Spannung."), f("current", "Laststrom je Phase", "16", "A", "Bei Parallelleitern Gesamtstrom je Phase."), f("cos", "Leistungsfaktor cos φ", "1", "", "Induktive sinusförmige AC-Last; bei DC nicht verwendet."), ...conductorFields.map(field => field.key === "area" ? { ...field, default: "2.5" } : field), f("temperature", "Angenommene Leitertemperatur", "55", "°C", "Manueller Betriebspunkt, kein berechneter Erwärmungsnachweis."), select("budget", "Spannungsfallbudget dieses Modells", "4", [["4", "4 % · NIN 5.2.5.1"], ["3", "3 % · Projektwert"], ["1", "1 % · Projektwert"], ["5", "5 % · Projektwert"]], "Das Budget gilt für die gesamte relevante Strecke; vorgelagerte Abschnitte müssen berücksichtigt werden."), select("durationMode", "Betriebszeit eingeben", "calendar", [["calendar", "Stunden pro Tag und Tage pro Jahr"], ["annual", "Jahresbetriebsstunden direkt"]], "Beide Eingabearten ergeben Jahresstunden; anschliessend wird mit der Betrachtungsdauer multipliziert." , "Wirtschaftlichkeit"), f("dailyHours", "Betriebsstunden pro Tag", "24", "h/Tag", "0 bis 24 Stunden mit der betrachteten Last.", "Wirtschaftlichkeit"), f("days", "Betriebstage pro Jahr", "365", "Tage/Jahr", "1 bis 365 Tage; kein stiller Ersatz bei leerem Feld.", "Wirtschaftlichkeit"), f("years", "Betrachtungsdauer", "1", "Jahre", "Gesamte Kosten und Energieverluste für diesen Zeitraum; konstante Last und Tarife.", "Wirtschaftlichkeit"), f("hours", "Jahresbetriebsstunden", "2000", "h", "Direkte Jahresstunden, maximal 8760.", "Wirtschaftlichkeit"), f("price", "Arbeitspreis", "0.25", "CHF/kWh", "Projektspezifischer Schweizer Energietarif.", "Wirtschaftlichkeit")], calculate: calculateLoss,
  },
  {
    id: "ohmsches-gesetz", title: "Ohmsches Gesetz", description: "Zwei bekannte Grössen wählen und Spannung, Strom, Impedanz und Leistung berechnen.", source: source("ohmsches-gesetz"), scope: "Elektrotechnische Grundgleichungen · DC oder symmetrisches sinusförmiges AC-Modell",
    fields: [select("system", "System", "dc", [["dc", "Gleichstrom"], ["1", "Einphasig · 1~"], ["3", "Drehstrom · 3~"]], "Bei DC rein ohmscher Widerstand. Bei AC wird der Betrag der Strangimpedanz berechnet."), select("known", "Bekannte Grössen", "ui", [["ui", "Spannung U + Strom I"], ["ur", "Spannung U + R / |Z|"], ["ir", "Strom I + R / |Z|"], ["pu", "Wirkleistung P + Spannung U"], ["pi", "Wirkleistung P + Strom I"], ["pr", "Wirkleistung P + R / |Z|"]], "Es werden ausschliesslich die ausgewählten zwei Werte und bei AC der Leistungsfaktor verwendet."), f("voltage", "Spannung U", "230", "V", "Nur in Modi mit U verwendet. Bei 3~ Aussenleiterspannung."), f("current", "Strom I", "10", "A", "Nur in Modi mit I verwendet. Bei 3~ Aussenleiterstrom."), f("impedance", "R / Betrag |Z| je Strang", "23", "Ω", "Nur in Modi mit R / |Z| verwendet. AC: Impedanzbetrag, nicht nur der ohmsche Anteil."), f("power", "Wirkleistung P gesamt", "2300", "W", "Nur in Modi mit P verwendet; bei 3~ Summe aller drei Stränge."), f("cos", "Leistungsfaktor cos φ", "1", "", "Bei AC berücksichtigt. Bei DC wird immer cos φ = 1 verwendet.")], calculate: calculateOhm,
  },
  {
    id: "beleuchtung", title: "Beleuchtung", description: "Leuchtenzahl und rechteckige Anordnung nach dem Lichtstromverfahren vorplanen.", source: source("beleuchtung"), scope: "SN EN 12464-1 · Lichtstrom-Vorplanung, η vereinfacht; keine photometrische Freigabe",
    fields: [f("length", "Raumlänge", "10", "m", "Lichte Raumlänge.", "Raum"), f("width", "Raumbreite", "8", "m", "Lichte Raumbreite.", "Raum"), f("height", "Montagehöhe der Leuchten", "3", "m", "Höhe der Leuchten über Boden, muss oberhalb der Nutzebene liegen.", "Raum"), f("plane", "Höhe der Nutzebene", "0.8", "m", "Projektspezifische Bezugsebene für den Raumindex.", "Raum"), select("luxMode", "Zielbeleuchtungsstärke wählen", "500", [["manual", "Eigene Planungsvorgabe"], ...LUX_PRESETS.map(value => [String(value), `${value} lx · Planungsvorgabe`] as [string, string])], "Planungswerte ohne automatische Freigabe einer Raumnutzung.", "Leuchten"), f("lux", "Zielbeleuchtungsstärke E_m", "500", "lx", "Projektspezifisches Ziel aus dem Raum-/Nutzungskonzept; 500 lx ist nur die Beispielvorgabe.", "Leuchten"), select("luminaire", "Leuchtendaten", "0", [["manual", "Datenblatt manuell"], ...LUMINAIRE_PRESETS.map(item => [item.id, `${item.label} · ${item.watts} W / ${item.lumen} lm`] as [string, string])], "19 veröffentlichte Beispiele mit Leistungs- und Lichtstromdaten; keine Herstellerprodukt-Freigabe.", "Leuchten"), f("lumen", "Lichtstrom je Leuchte", "4200", "lm", "Herstellerwert je vollständiger Leuchte.", "Leuchten"), f("watts", "Elektrische Leistung je Leuchte", "40", "W", "Leuchtenaufnahmeleistung inklusive Treiber.", "Leuchten"), select("etaMode", "Raumwirkungsgrad festlegen", "room", [["room", "Aus Raumindex und Reflexion · Näherung"], ["manual", "Manueller Faktor"]], "Die Raumableitung ist eine empirische Vereinfachung, kein LiTG-Tabellenwert.", "Leuchten"), select("reflectance", "Reflexionsannahme", "0.5", [["0.3", "30 % · Annahme"], ["0.5", "50 % · Annahme"], ["0.7", "70 % · Annahme"]], "Ein einziger mittlerer Reflexionsansatz; keine Aufteilung nach Decke, Wand und Boden.", "Leuchten"), f("utilisation", "Vereinfachter Raumwirkungsgrad η", "0.7", "", "Manuelle Vereinfachung aus Leuchten- und Raumdaten; kein LiTG- oder Norm-Wirkungsgrad.", "Leuchten"), f("maintenance", "Wartungsfaktor MF", "0.8", "", "Manuelle Projektannahme aus Wartungskonzept, nicht normativ automatisch bestimmt.", "Leuchten"), f("cos", "Leuchten-Leistungsfaktor", "1", "", "Für die vereinfachte 230-V-Betriebsstromberechnung.", "Leuchten"), select("layout", "Anordnung", "minimum", [["minimum", "Mindestanzahl · mathematisch aufgerundet"], ["full", "Zusätzlich volle Rasterreihen"]], "Volle Reihen sind eine zusätzliche Planungsentscheidung und können die Anzahl erhöhen.")], calculate: calculateLighting,
  },
];

// Display only the two selected inputs; retained values remain available on mode changes.
const ohmDefinition = FUNDAMENTALS.find(item => item.id === "ohmsches-gesetz")!;
const ohmKnownModes: Record<string, string[]> = { voltage: ["ui", "ur", "pu"], current: ["ui", "ir", "pi"], impedance: ["ur", "ir", "pr"], power: ["pu", "pi", "pr"] };
for (const field of ohmDefinition.fields) {
  if (ohmKnownModes[field.key]) field.visibleWhen = [{ key: "known", values: ohmKnownModes[field.key] }];
  if (field.key === "cos") field.visibleWhen = [{ key: "system", values: ["1", "3"] }];
}

const lossCos = FUNDAMENTALS.find(item => item.id === "verlustleistung")!.fields.find(item => item.key === "cos")!;
lossCos.visibleWhen = [{ key: "system", values: ["1", "3"] }];
const motorDefinition = FUNDAMENTALS.find(item => item.id === "motoranlauf")!;
for (const field of motorDefinition.fields) {
  if (field.key === "reduction") field.visibleWhen = [{ key: "method", values: ["manual"] }];
  if (field.key === "multiplier") field.visibleWhen = [{ key: "method", values: ["direct", "star", "manual"] }];
  if (field.key === "iz") field.visibleWhen = [{ key: "checkIz", values: ["on"] }];
  if (field.key === "kw" || field.key === "efficiencyMode") field.visibleWhen = [{ key: "inputMode", values: ["power"] }];
  if (field.key === "nominalCurrent") field.visibleWhen = [{ key: "inputMode", values: ["current"] }];
  if (field.key === "efficiency") field.visibleWhen = [{ key: "inputMode", values: ["power"] }, { key: "efficiencyMode", values: ["manual"] }];
  if (field.key === "isolation" || field.key === "methodIz") field.visibleWhen = [{ key: "checkIz", values: ["auto"] }];
}
for (const field of FUNDAMENTALS.find(item => item.id === "kurzschlussstrom")!.fields) {
  if (field.key === "sourcePreset") field.visibleWhen = [{ key: "sourceMode", values: ["preset"] }];
  if (field.key === "sourceImpedance") field.visibleWhen = [{ key: "sourceMode", values: ["impedance"] }];
  if (field.key === "kva" || field.key === "uk") field.visibleWhen = [{ key: "sourceMode", values: ["nameplate"] }];
  if (field.key === "trafos") field.visibleWhen = [{ key: "sourceMode", values: ["nameplate", "preset"] }];
}
for (const field of FUNDAMENTALS.find(item => item.id === "transformator")!.fields) {
  if (field.key === "uk") field.visibleWhen = [{ key: "ukMode", values: ["preset"] }];
  if (field.key === "ukManual") field.visibleWhen = [{ key: "ukMode", values: ["manual"] }];
}
for (const field of FUNDAMENTALS.find(item => item.id === "verlustleistung")!.fields) {
  if (field.key === "area") field.options = [...(field.options ?? []), { value: "300", label: "300 mm² Cu · DC / cos φ = 1" }];
  if (field.key === "hours") field.visibleWhen = [{ key: "durationMode", values: ["annual"] }];
  if (field.key === "dailyHours" || field.key === "days") field.visibleWhen = [{ key: "durationMode", values: ["calendar"] }];
}
for (const field of FUNDAMENTALS.find(item => item.id === "beleuchtung")!.fields) {
  if (field.key === "lux") field.visibleWhen = [{ key: "luxMode", values: ["manual"] }];
  if (field.key === "lumen" || field.key === "watts") field.visibleWhen = [{ key: "luminaire", values: ["manual"] }];
  if (field.key === "utilisation") field.visibleWhen = [{ key: "etaMode", values: ["manual"] }];
  if (field.key === "reflectance") field.visibleWhen = [{ key: "etaMode", values: ["room"] }];
}
