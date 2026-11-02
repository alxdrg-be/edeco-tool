import assert from "node:assert/strict";
import test from "node:test";
import { defaults, type CalculationResult, type Inputs } from "./types.ts";
import { FUNDAMENTALS } from "./fundamentals.ts";

const MANUAL_FIXTURE_MODES: Record<string, Record<string, string>> = {
  motoranlauf: { inputMode: "power", efficiencyMode: "manual", checkIz: "off" },
  verlustleistung: { durationMode: "annual" },
  beleuchtung: { luxMode: "manual", luminaire: "manual", etaMode: "manual" },
};
function calculate(id: string, patch: Inputs = {}) {
  const definition = FUNDAMENTALS.find(item => item.id === id)!;
  return definition.calculate({ ...defaults(definition), ...MANUAL_FIXTURE_MODES[id], ...patch });
}
function metric(result: CalculationResult, label: string): number {
  const value = result.metrics.find(item => item.label === label)?.value;
  assert.equal(typeof value, "number", label);
  return value as number;
}
function row(result: CalculationResult, label: string): number {
  const value = result.rows?.find(item => item.label === label)?.value;
  assert.equal(typeof value, "number", label);
  return value as number;
}
function close(actual: number, expected: number, tolerance = 1e-9) { assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`); }

test("all seven fundamental workbenches return finite default engineering values and Swiss references", () => {
  assert.equal(FUNDAMENTALS.length, 7);
  for (const definition of FUNDAMENTALS) {
    assert.match(definition.source, /^https:\/\/www\.elektro-rechner\.ch\/Rechner\//);
    const result = definition.calculate(defaults(definition));
    assert.ok(result.metrics.length >= 3);
    for (const item of [...result.metrics, ...(result.rows ?? [])]) if (typeof item.value === "number") assert.ok(Number.isFinite(item.value), `${definition.id}: ${item.label}`);
    assert.ok(result.formula.length > 20 && result.limitations.length >= 3);
  }
});

test("transformer currents preserve apparent power and short-circuit ratio in both systems", () => {
  const t = calculate("transformator", { kva: "250", u1: "20000", u2: "400", uk: "4", idle: "1", load: "80" });
  const i2 = metric(t, "Sekundär-Nennstrom"), i1 = row(t, "Primär-Nennstrom");
  close(Math.sqrt(3) * 400 * i2, 250000);
  close(Math.sqrt(3) * 20000 * i1, 250000);
  close(metric(t, "Kurzschluss · starres Netz") * 1000, i2 * 25);
  close(row(t, "Primärer Leerlaufstrom"), i1 / 100);
  close(row(t, "Sekundärer Laststrom"), .8 * i2);
  const single = calculate("transformator", { phase: "1", kva: "1", u1: "230", u2: "24" });
  close(metric(single, "Sekundär-Nennstrom"), 1000 / 24);
  assert.equal(calculate("transformator", { load: "120" }).status.tone, "warning");
});

test("short-circuit model adds source impedance and warmer loop resistance without claiming norm extrema", () => {
  const base = calculate("kurzschlussstrom"), upstream = calculate("kurzschlussstrom", { networkR: "20", networkX: "10" });
  assert.ok(metric(upstream, "3~-Kurzschluss · Modell") < metric(base, "3~-Kurzschluss · Modell"));
  assert.ok(metric(upstream, "L–PE-Schleife · Modell") < metric(base, "L–PE-Schleife · Modell"));
  const cold = calculate("kurzschlussstrom", { temperature: "20" }), hot = calculate("kurzschlussstrom", { temperature: "100" });
  assert.ok(metric(hot, "L–PE-Schleife · Modell") < metric(cold, "L–PE-Schleife · Modell"));
  close(metric(hot, "3~-Kurzschluss · Modell"), metric(cold, "3~-Kurzschluss · Modell"));
  assert.match(base.status.text, /kein normativer/);
  assert.throws(() => calculate("kurzschlussstrom", { material: "al", area: "1.5" }));
});

test("motor input is mechanical power; efficiency and ideal star-start factors affect current correctly", () => {
  const inputs = { kw: String(Math.sqrt(3) * 400 * 10 / 1000), voltage: "400", efficiency: "1", cos: "1", multiplier: "6" };
  const direct = calculate("motoranlauf", inputs), star = calculate("motoranlauf", { ...inputs, method: "star" });
  close(metric(direct, "Motor-Nennstrom"), 10);
  close(metric(direct, "Anlaufstrom · Annahme"), 60);
  close(metric(star, "Anlaufstrom · Annahme"), 20);
  const lowerEfficiency = calculate("motoranlauf", { ...inputs, efficiency: "0.8" });
  close(metric(lowerEfficiency, "Motor-Nennstrom"), 12.5);
  assert.throws(() => calculate("motoranlauf", { efficiency: "0" }));
});

test("compensation preserves active power and applies the explicitly assumed I-squared loss reduction", () => {
  const r = calculate("blindleistung", { kw: "100", before: "0.8", after: "1", lossPct: "2", hours: "2000", price: "0.25" });
  close(metric(r, "Erforderliche Kompensation"), 75);
  close(row(r, "Scheinleistung vorher"), 125);
  close(row(r, "Scheinleistung nachher"), 100);
  close(row(r, "Leitungsverlust-Ersparnis"), 1440);
  close(metric(r, "Verlustkosten-Ersparnis · Annahme"), 360);
  close(metric(calculate("blindleistung", { before: "0.95", after: "0.95" }), "Erforderliche Kompensation"), 0);
  const reached = calculate("blindleistung", { before: "0.95", after: "0.8" });
  close(metric(reached, "Erforderliche Kompensation"), 0);
  close(metric(reached, "Stromreduktion"), 0);
  close(row(reached, "Angesetzter Leistungsfaktor nachher"), 0.95);
  assert.match(reached.status.text, /Ziel bereits erreicht/);
  assert.throws(() => calculate("blindleistung", { hours: "8761" }));
});

test("line losses use phase conductor count and parallel paths while conserving annual energy", () => {
  const patch = { system: "3", material: "cu", area: "2.5", current: "10", length: "100", parallel: "1", temperature: "20", hours: "1000", price: "0.25" };
  const r = calculate("verlustleistung", patch), parallel = calculate("verlustleistung", { ...patch, parallel: "2" });
  close(row(r, "Widerstand je Aussenleiterpfad"), .741);
  close(metric(r, "Ohmsche Verlustleistung"), 222.3);
  close(row(r, "Energieverluste"), 222.3);
  close(metric(r, "Kosten der Verluste"), 55.575);
  close(metric(parallel, "Ohmsche Verlustleistung"), metric(r, "Ohmsche Verlustleistung") / 2);
  close(metric(parallel, "Spannungsfall · cos φ = 1"), metric(r, "Spannungsfall · cos φ = 1") / 2);
  const dc = calculate("verlustleistung", { ...patch, system: "dc", voltage: "230" });
  close(metric(dc, "Ohmsche Verlustleistung"), 148.2);
  close(row(dc, "Spannungsfall"), 14.82);
  assert.equal(dc.status.tone, "error");
});

test("Ohm's law pairs produce one consistent DC solution and balanced AC uses line voltage", () => {
  for (const known of ["ui", "ur", "ir", "pu", "pi", "pr"]) {
    const r = calculate("ohmsches-gesetz", { system: "dc", known, voltage: "24", current: "2", impedance: "12", power: "48" });
    close(metric(r, "Spannung"), 24); close(metric(r, "Strom"), 2); close(metric(r, "Widerstand R"), 12); close(metric(r, "Wirkleistung"), 48);
  }
  const ac = calculate("ohmsches-gesetz", { system: "3", known: "pu", voltage: "400", power: "10000", cos: "0.8" });
  close(metric(ac, "Strom"), 10000 / (Math.sqrt(3) * 400 * .8));
  close(row(ac, "Scheinleistung"), 12500);
  close(row(ac, "Blindleistung · Betrag"), 7500);
  const fromZ = calculate("ohmsches-gesetz", { system: "3", known: "pr", power: "240", impedance: "10", cos: "0.8" });
  close(metric(fromZ, "Strom"), Math.sqrt(10));
});

test("lighting uses exactly ceil for its minimum and only fills whole rows when explicitly selected", () => {
  const r = calculate("beleuchtung");
  const n = metric(r, "Leuchtenanzahl"), diagram = r.diagram;
  assert.ok(diagram?.kind === "room");
  assert.equal(n, diagram.count);
  assert.ok(n <= diagram.columns * diagram.rows);
  assert.equal(n, row(r, "Leuchten rechnerisch, aufgerundet"));
  const full = calculate("beleuchtung", { layout: "full" });
  assert.equal(metric(full, "Leuchtenanzahl"), row(r, "Vollständiges Raster · optional"));
  assert.equal(metric(full, "Installierte Leistung"), row(r, "Vollständiges Raster · optional") * 40);
  close(metric(r, "Installierte Leistung"), n * 40);
  assert.ok(metric(r, "Mittlere Beleuchtungsstärke · Modell") >= 500);
  const narrow = calculate("beleuchtung", { length: "30", width: "1", lux: "1", lumen: "100000" });
  assert.equal(metric(narrow, "Leuchtenanzahl"), 1);
  assert.throws(() => calculate("beleuchtung", { height: "0.8", plane: "0.8" }));
  assert.throws(() => calculate("beleuchtung", { maintenance: "0" }));
});

test("empty, negative and non-finite required engineering values are rejected", () => {
  const keys: Record<string, string> = { kurzschlussstrom: "voltage", transformator: "kva", motoranlauf: "kw", blindleistung: "kw", verlustleistung: "current", "ohmsches-gesetz": "voltage", beleuchtung: "lumen" };
  for (const definition of FUNDAMENTALS) for (const bad of ["", "-1", "NaN", "Infinity"]) {
    assert.throws(() => calculate(definition.id, { [keys[definition.id]]: bad }), `${definition.id} accepts ${bad}`);
  }
});


test("AC loss voltage drop includes cos phi and reactance while the thermal loss stays I squared R", () => {
  const patch = { system: "3", material: "cu", area: "10", current: "32", length: "80", parallel: "1", temperature: "55", voltage: "400", cos: "0.85" };
  const r = calculate("verlustleistung", patch);
  close(row(r, "Spannungsfall"), Math.sqrt(3) * 32 * (.16653732 * .85 + .008 * Math.sqrt(1 - .85 ** 2)));
  close(metric(r, "Ohmsche Verlustleistung"), 3 * 32 ** 2 * .16653732);
  const unity = calculate("verlustleistung", { ...patch, cos: "1" });
  close(metric(r, "Ohmsche Verlustleistung"), metric(unity, "Ohmsche Verlustleistung"));
  assert.notEqual(row(r, "Spannungsfall"), row(unity, "Spannungsfall"));
  assert.match(r.formula, /0.85/);
  assert.match(r.limitations.join(" "), /X′.*Richtwert/);
  assert.throws(() => calculate("verlustleistung", { cos: "" }));
  assert.throws(() => calculate("verlustleistung", { cos: "1.01" }));
  assert.doesNotThrow(() => calculate("verlustleistung", { system: "dc", cos: "" }));
  const budget = FUNDAMENTALS.find(item => item.id === "verlustleistung")!.fields.find(item => item.key === "budget")!;
  assert.match(budget.options!.find(item => item.value === "4")!.label, /NIN 5.2.5.1/);
  assert.match(budget.options!.find(item => item.value === "3")!.label, /Projektwert/);
});

test("short-circuit c factors and conservative warm magnitude sum remain explicit model assumptions", () => {
  const r = calculate("kurzschlussstrom");
  close(row(r, "Spannungsfaktor c_max · Modell"), 1.05);
  close(row(r, "Spannungsfaktor c_min · Modell"), .95);
  close(metric(r, "3~-Kurzschluss · Modell"), 7.729090730864311);
  close(metric(r, "L–PE-Schleife · Modell"), 2.6849624032193047);
  close(row(r, "Schleifenimpedanz im Modell"), row(r, "Quellenimpedanz · Betrag") + row(r, "Warme L–PE-Schleife · Betrag"));
  assert.match(r.status.text, /keine garantierte Schranke/);
  assert.match(r.limitations.join(" "), /keine garantierte Untergrenze/);
  assert.match(r.formula, /1.05 × 400/);
  assert.throws(() => calculate("kurzschlussstrom", { temperature: "" }));
  const single = calculate("kurzschlussstrom", { voltage: "230", kva: "250" });
  const expectedR = 2 * 1.15 * 25 / 1000, expectedX = .04 * 230 ** 2 / 250000 + 2 * .096 * 25 / 1000;
  close(metric(single, "L–N-Kurzschluss · Modell"), 1.05 * 230 / Math.hypot(expectedR, expectedX) / 1000);
});

test("motor standard choices and additional start models keep assumptions and manual Iz evidence explicit", () => {
  const def = FUNDAMENTALS.find(item => item.id === "motoranlauf")!;
  assert.equal(def.fields.find(item => item.key === "kw")!.kind, "select");
  assert.ok(def.fields.find(item => item.key === "kw")!.options!.some(item => item.value === "7.5"));
  const direct = calculate("motoranlauf"), nominal = metric(direct, "Motor-Nennstrom");
  const soft = calculate("motoranlauf", { method: "soft", multiplier: "" });
  const vfd = calculate("motoranlauf", { method: "vfd", multiplier: "" });
  close(metric(soft, "Anlaufstrom · Annahme"), 3 * nominal);
  close(metric(vfd, "Anlaufstrom · Annahme"), 1.2 * nominal);
  assert.match(def.fields.find(item => item.key === "method")!.options!.find(item => item.value === "vfd")!.label, /Annahme/);
  assert.throws(() => calculate("motoranlauf", { checkIz: "on", iz: "" }));
  assert.equal(calculate("motoranlauf", { checkIz: "on", iz: "1" }).status.tone, "error");
  assert.match(calculate("motoranlauf", { checkIz: "on", iz: "20" }).status.text, /Iz ≥ I_N erfüllt/);
  assert.match(direct.status.text, /nicht geprüft/);
});

test("lighting's simplified eta is labelled and invalid assumptions never produce a substitute count", () => {
  const def = FUNDAMENTALS.find(item => item.id === "beleuchtung")!;
  assert.match(def.fields.find(item => item.key === "utilisation")!.label, /Vereinfachter Raumwirkungsgrad/);
  const r = calculate("beleuchtung");
  assert.match(r.limitations.join(" "), /kein LiTG-/);
  assert.match(r.formula, /ceil\(500 × 80/);
  assert.throws(() => calculate("beleuchtung", { utilisation: "" }));
  assert.throws(() => calculate("beleuchtung", { utilisation: "1.1" }));
  assert.throws(() => calculate("beleuchtung", { layout: "unknown" }));
});

test("motor presets, direct-current mode, MSS overflow and automatic cable choice stay explicit", () => {
  const preset = calculate("motoranlauf", { efficiencyMode: "preset", checkIz: "auto", kw: "75", method: "vfd", isolation: "xlpe", methodIz: "E", efficiency: "" });
  close(row(preset, "Verwendeter Wirkungsgrad"), .95);
  assert.equal(row(preset, "Automatisch gewählter Querschnitt"), 35);
  close(row(preset, "Iz des gewählten Querschnitts"), 158);
  assert.equal(preset.rows!.find(item => item.label === "MSS-Grössenempfehlung")!.value, "keine bis 125 A");
  assert.match(preset.status.text, /über.*125 A/);
  const manual = calculate("motoranlauf", { inputMode: "current", nominalCurrent: "100", kw: "", efficiency: "", checkIz: "auto", isolation: "pvc", methodIz: "B2", method: "star" });
  close(metric(manual, "Motor-Nennstrom"), 100);
  close(metric(manual, "Anlaufstrom · Annahme"), 200);
  close(row(manual, "Automatisch gewählter Querschnitt"), 50);
  close(row(manual, "Iz des gewählten Querschnitts"), 118);
  close(row(manual, "MSS-Grössenempfehlung"), 100);
  const overflow = calculate("motoranlauf", { inputMode: "current", nominalCurrent: "1000", checkIz: "auto" });
  assert.equal(overflow.status.tone, "error");
  assert.equal(overflow.rows!.find(item => item.label === "Automatisch gewählter Querschnitt")!.value, "keiner bis 300 mm²");
  assert.throws(() => calculate("motoranlauf", { efficiencyMode: "preset", kw: "9" }));
  assert.throws(() => calculate("motoranlauf", { inputMode: "current", nominalCurrent: "" }));
  assert.throws(() => calculate("motoranlauf", { checkIz: "auto", isolation: "invalid" }));
});

test("lighting catalogue and empirical room mode never masquerade as a LiTG table", () => {
  const def = FUNDAMENTALS.find(item => item.id === "beleuchtung")!;
  assert.equal(def.fields.find(item => item.key === "luminaire")!.options!.length, 20);
  const defaultsResult = def.calculate(defaults(def));
  close(metric(defaultsResult, "Leuchtenanzahl"), 18);
  close(metric(defaultsResult, "Installierte Leistung"), 648);
  close(row(defaultsResult, "Verwendeter Raumwirkungsgrad η · vereinfacht"), .6585858585858586);
  close(row(defaultsResult, "Betriebsstrom bei 230 V"), 648 / 230);
  assert.match(defaultsResult.limitations.join(" "), /kein LiTG-/);
  for (const preset of def.fields.find(item => item.key === "luminaire")!.options!.filter(item => item.value !== "manual")) {
    const r = calculate("beleuchtung", { luminaire: preset.value, etaMode: "room", luxMode: "500", lumen: "", watts: "", utilisation: "" });
    assert.ok(metric(r, "Leuchtenanzahl") > 0);
    assert.equal(r.diagram?.kind === "room" && r.diagram.count, metric(r, "Leuchtenanzahl"));
  }
  assert.throws(() => calculate("beleuchtung", { luminaire: "unknown" }));
  assert.throws(() => calculate("beleuchtung", { etaMode: "room", reflectance: "" }));
  assert.throws(() => calculate("beleuchtung", { etaMode: "room", reflectance: "1.01" }));
  assert.throws(() => calculate("beleuchtung", { luxMode: "invalid" }));
});

test("loss calendar duration multiplies exactly and zero operating hours remain zero", () => {
  const r = calculate("verlustleistung", { durationMode: "calendar", dailyHours: "8", days: "250", years: "3", hours: "" });
  close(row(r, "Betriebsstunden total"), 6000);
  close(row(r, "Energieverluste total"), 971.0490816);
  close(metric(r, "Gesamtkosten im Zeitraum"), 242.7622704);
  close(row(r, "Kleinster Querschnitt für das Spannungsfallbudget"), 1.5);
  const zero = calculate("verlustleistung", { durationMode: "calendar", dailyHours: "0", days: "250", years: "3" });
  close(metric(zero, "Gesamtkosten im Zeitraum"), 0);
  assert.throws(() => calculate("verlustleistung", { durationMode: "calendar", dailyHours: "" }));
  assert.throws(() => calculate("verlustleistung", { durationMode: "calendar", dailyHours: "25" }));
  assert.throws(() => calculate("verlustleistung", { durationMode: "calendar", days: "0" }));
  assert.throws(() => calculate("verlustleistung", { years: "0" }));
  assert.throws(() => calculate("verlustleistung", { area: "300" }));
});

test("short source modes and additional stress indicators do not turn model assumptions into proofs", () => {
  const direct = calculate("kurzschlussstrom", { sourceMode: "impedance", sourceImpedance: "25.6", kva: "", uk: "", trafos: "" });
  assert.equal(metric(direct, "3~-Kurzschluss · Modell").toFixed(3), "6.042");
  assert.equal(row(direct, "Stossstrom · Näherung").toFixed(2), "9.10");
  assert.equal(row(direct, "Thermischer I√t-Ansatz · 0.1 s").toFixed(3), "1.911");
  assert.match(direct.limitations.join(" "), /Näherungswerte/);
  const preset = calculate("kurzschlussstrom", { sourceMode: "preset", sourcePreset: "800", uk: "", kva: "", trafos: "2" });
  close(row(preset, "Trafo-Reaktanz im Modell"), 6);
  assert.throws(() => calculate("kurzschlussstrom", { sourceMode: "impedance", sourceImpedance: "" }));
  assert.throws(() => calculate("kurzschlussstrom", { sourceMode: "preset", sourcePreset: "999" }));
});

test("transformer nameplate uk override, AC phase angle and compensation placement preserve the equations", () => {
  const t = calculate("transformator", { ukMode: "manual", ukManual: "5.5", uk: "" });
  assert.equal(metric(t, "Kurzschluss · starres Netz").toFixed(3), "6.561");
  close(row(t, "Kurzschlussspannung bezogen auf U₂"), 22);
  assert.throws(() => calculate("transformator", { ukMode: "manual", ukManual: "" }));
  const reactive = calculate("ohmsches-gesetz", { system: "3", known: "ui", voltage: "400", current: "16", cos: "0" });
  close(row(reactive, "Phasenwinkel φ"), 90);
  close(metric(reactive, "Wirkleistung"), 0);
  close(row(reactive, "Blindleistung · Betrag"), Math.sqrt(3) * 400 * 16);
  assert.throws(() => calculate("ohmsches-gesetz", { system: "3", known: "pu", cos: "0" }));
  const a = calculate("blindleistung", { compensationLocation: "individual" }), b = calculate("blindleistung", { compensationLocation: "central" });
  close(metric(a, "Erforderliche Kompensation"), metric(b, "Erforderliche Kompensation"));
  assert.notEqual(a.rows![0].value, b.rows![0].value);
  assert.throws(() => calculate("blindleistung", { compensationLocation: "invalid" }));
});

test("parallel loss paths preserve the entered section and show the installation caveat below 70 square millimetres Cu", () => {
  const r = calculate("verlustleistung", { material: "cu", area: "16", parallel: "2", current: "16" });
  assert.equal(r.status.tone, "warning");
  assert.match(r.status.text, /NIN 5.2.3.7/);
  close(row(r, "Effektiver Leiterquerschnitt je Phase"), 32);
  close(row(r, "Widerstand je Aussenleiterpfad"), 1.15 * (1 + .00393 * 35) * .025 / 2);
});
