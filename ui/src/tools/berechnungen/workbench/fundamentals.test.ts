import assert from "node:assert/strict";
import test from "node:test";
import { defaults, type CalculationResult, type Inputs } from "./types.ts";
import { FUNDAMENTALS } from "./fundamentals.ts";

function calculate(id: string, patch: Inputs = {}) {
  const definition = FUNDAMENTALS.find(item => item.id === id)!;
  return definition.calculate({ ...defaults(definition), ...patch });
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
  assert.throws(() => calculate("blindleistung", { before: "0.95", after: "0.8" }));
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
  assert.equal(dc.status.tone, "warning");
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

test("lighting rounds up a consistent grid and never presents less light than the target in its lumen model", () => {
  const r = calculate("beleuchtung");
  const n = metric(r, "Leuchten im rechteckigen Raster"), diagram = r.diagram;
  assert.ok(diagram?.kind === "room");
  assert.equal(n, diagram.columns * diagram.rows);
  assert.ok(n >= row(r, "Leuchten rechnerisch, aufgerundet"));
  close(metric(r, "Installierte Leistung"), n * 40);
  assert.ok(metric(r, "Mittlere Beleuchtungsstärke · Modell") >= 500);
  const narrow = calculate("beleuchtung", { length: "30", width: "1", lux: "1", lumen: "100000" });
  assert.equal(metric(narrow, "Leuchten im rechteckigen Raster"), 1);
  assert.throws(() => calculate("beleuchtung", { height: "0.8", plane: "0.8" }));
  assert.throws(() => calculate("beleuchtung", { maintenance: "0" }));
});

test("empty, negative and non-finite required engineering values are rejected", () => {
  const keys: Record<string, string> = { kurzschlussstrom: "voltage", transformator: "kva", motoranlauf: "kw", blindleistung: "kw", verlustleistung: "current", "ohmsches-gesetz": "voltage", beleuchtung: "lumen" };
  for (const definition of FUNDAMENTALS) for (const bad of ["", "-1", "NaN", "Infinity"]) {
    assert.throws(() => calculate(definition.id, { [keys[definition.id]]: bad }), `${definition.id} accepts ${bad}`);
  }
});
