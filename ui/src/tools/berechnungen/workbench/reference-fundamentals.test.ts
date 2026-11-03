/**
 * Independent reference fixtures captured 2026-11-01 from the public pages below.
 * The actual client calc()/calcAC() was executed from downloaded HTML in an
 * isolated Node VM with minimal DOM stubs. Only valid examples were used;
 * validation helpers were stubbed, so these fixtures validate arithmetic only.
 * No third-party script is stored in this repository. Expected values below
 * are the reference's own displayed/rounded outputs, not formulas mirrored
 * from the edeco implementation. Download hashes bind the observations.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { FUNDAMENTALS } from "./fundamentals.ts";
import { defaults, type CalculationResult } from "./types.ts";

export const REFERENCE_PROVENANCE = {
  transformator: { url: "https://www.elektro-rechner.ch/Rechner/transformator.html", sha256: "e7d4f4cf821ee6c7e93b5f9d328e25a7189760e43429b8c0630b65025be9eb61" },
  motoranlauf: { url: "https://www.elektro-rechner.ch/Rechner/motoranlauf.html", sha256: "82fa3cdf184a80b22190f8ae42b19729da3ddf6fb99d407b5a6636ce3953fb2e" },
  blindleistung: { url: "https://www.elektro-rechner.ch/Rechner/blindleistung.html", sha256: "7d1669181658b6156cc8225b3ef2778d9c9514e4254b9c711648f9cd297d51ca" },
  verlustleistung: { url: "https://www.elektro-rechner.ch/Rechner/verlustleistung.html", sha256: "e6c8ed8ee5e32de633f6dd12d917e8420ff3282a915cf9f7fb8e39d57a4c56cb" },
  "ohmsches-gesetz": { url: "https://www.elektro-rechner.ch/Rechner/ohmsches-gesetz.html", sha256: "457fe9b31ae9f40c4cccceafd241d31c508ea54be5ce444cc12f05731ec43535" },
  beleuchtung: { url: "https://www.elektro-rechner.ch/Rechner/beleuchtung.html", sha256: "4e535e5b70d0e18899c8e1d71de897e50cd153de231edda81a0995f5bebe6e90" },
  kurzschlussstrom: { url: "https://www.elektro-rechner.ch/Rechner/kurzschlussstrom.html", sha256: "2d7b87c24dfc5d700dc362dfbbf61cf73fba67dfaab14860d9b68abd9eab838f" },
};
const run = (id: string, patch: Record<string, string> = {}) => {
  const definition = FUNDAMENTALS.find(item => item.id === id)!;
  return definition.calculate({ ...defaults(definition), ...patch });
};
function metric(result: CalculationResult, label: string) { return Number(result.metrics.find(item => item.label === label)!.value); }
function row(result: CalculationResult, label: string) { return Number(result.rows!.find(item => item.label === label)!.value); }

test("executed reference: transformer 250/630kVA cases match all common electrical results", () => {
  for (const [input, expected] of [
    [{ kva: "250", u1: "20000", u2: "400", uk: "4", idle: "1", load: "80" }, { i2: "360.8", ik: "9.021", i1: "7.22", idle: "0.07", load: "288.7", z: "25.60" }],
    [{ kva: "630", u1: "16000", u2: "420", uk: "6", idle: "1.2", load: "100" }, { i2: "866.0", ik: "14.434", i1: "22.73", idle: "0.27", load: "866.0", z: "16.80" }],
  ] as const) {
    const r = run("transformator", input);
    assert.equal(metric(r, "Sekundär-Nennstrom").toFixed(1), expected.i2);
    assert.equal(metric(r, "Kurzschluss · starres Netz").toFixed(3), expected.ik);
    assert.equal(row(r, "Primär-Nennstrom").toFixed(2), expected.i1);
    assert.equal(row(r, "Primärer Leerlaufstrom").toFixed(2), expected.idle);
    assert.equal(row(r, "Sekundärer Laststrom").toFixed(1), expected.load);
    assert.equal((row(r, "Kurzschlussimpedanz, U₂-seitig") * 1000).toFixed(2), expected.z);
  }
});

test("executed reference: motor 7.5kW IE3 eta0.904 direct/star cases match without importing a motor catalogue", () => {
  const direct = run("motoranlauf", { efficiency: "0.904" });
  assert.equal(metric(direct, "Motor-Nennstrom").toFixed(1), "14.1");
  assert.equal(metric(direct, "Anlaufstrom · Annahme").toFixed(1), "84.5");
  assert.equal(row(direct, "Scheinleistung bei Nennlast").toFixed(2), "9.76");
  const star = run("motoranlauf", { efficiency: "0.904", method: "star" });
  assert.equal(metric(star, "Anlaufstrom · Annahme").toFixed(1), "28.2");
});

test("executed reference: compensation normal and already-reached target are numerically consistent", () => {
  const r = run("blindleistung", { kw: "100", before: "0.75", after: "0.95", phase: "3", voltage: "400", lossPct: "2", hours: "2000", price: "0.25" });
  assert.equal(metric(r, "Erforderliche Kompensation").toFixed(1), "55.3");
  assert.equal(metric(r, "Stromreduktion").toFixed(1), "40.5"); // reference uses a minus sign to denote reduction
  assert.equal(row(r, "Scheinleistung vorher").toFixed(1), "133.3");
  assert.equal(row(r, "Scheinleistung nachher").toFixed(1), "105.3");
  assert.equal(metric(r, "Verlustkosten-Ersparnis · Annahme").toFixed(0), "377");
  const reached = run("blindleistung", { before: "0.95", after: "0.8" });
  assert.equal(metric(reached, "Erforderliche Kompensation").toFixed(1), "0.0");
  assert.equal(metric(reached, "Stromreduktion").toFixed(1), "0.0");
  assert.equal(row(reached, "Scheinleistung vorher").toFixed(1), "105.3");
  assert.equal(row(reached, "Scheinleistung nachher").toFixed(1), "105.3");
  assert.match(reached.status.text, /Ziel bereits erreicht/);
});

test("executed reference: 3phase/1phase loss and equivalent annual duration match", () => {
  const r = run("verlustleistung", { system: "3", voltage: "400", area: "2.5", current: "16", length: "25", parallel: "1", hours: "2000", price: "0.25", temperature: "55", budget: "4" });
  assert.equal(metric(r, "Ohmsche Verlustleistung").toFixed(2), "161.84");
  assert.equal(row(r, "Spannungsfall").toFixed(3), "5.840");
  assert.equal(metric(r, "Spannungsfall · cos φ = 1").toFixed(2), "1.46");
  assert.equal(metric(r, "Kosten der Verluste").toFixed(2), "80.92");
  assert.equal(row(r, "Maximale einfache Länge aus Budget").toFixed(1), "68.5");
  const one = run("verlustleistung", { system: "1", voltage: "230", area: "70", parallel: "2", current: "100", length: "100", hours: "2500", price: "0.3", temperature: "55", budget: "4" });
  assert.equal(metric(one, "Ohmsche Verlustleistung").toFixed(2), "304.86");
  assert.equal(row(one, "Spannungsfall").toFixed(3), "3.049");
  assert.equal(metric(one, "Kosten der Verluste").toFixed(2), "228.65");
  assert.equal(row(one, "Maximale einfache Länge aus Budget").toFixed(1), "301.8");
});

test("executed reference: DC and balanced AC Ohm cases match common outputs", () => {
  const dc = run("ohmsches-gesetz", { system: "dc", known: "ui", voltage: "48", current: "2" });
  assert.equal(metric(dc, "Spannung"), 48);
  assert.equal(metric(dc, "Strom"), 2);
  assert.equal(metric(dc, "Widerstand R"), 24);
  assert.equal(metric(dc, "Wirkleistung"), 96);
  const resistance = run("ohmsches-gesetz", { system: "dc", known: "ur", voltage: "230", impedance: "23" });
  assert.equal(metric(resistance, "Strom"), 10);
  assert.equal(metric(resistance, "Wirkleistung"), 2300); // reference display2.30kW
  const ac = run("ohmsches-gesetz", { system: "3", known: "ui", voltage: "400", current: "16", cos: "0.85" });
  assert.equal((row(ac, "Scheinleistung") / 1000).toFixed(2), "11.09");
  assert.equal((metric(ac, "Wirkleistung") / 1000).toFixed(2), "9.42");
  assert.equal((row(ac, "Blindleistung · Betrag") / 1000).toFixed(2), "5.84");
});

test("executed reference: lighting common lumen minimum matches; complete-grid rounding stays explicitly separate", () => {
  // Reference room10×8×3m, plane0.8m, reflection0.5, MF0.8, panel4320lm/36W.
  // The reference derives eta_R=0.6585858585858586; edeco accepts this as a manual factor.
  const r = run("beleuchtung", { length: "10", width: "8", height: "3", plane: "0.8", lux: "500", lumen: "4320", watts: "36", utilisation: "0.6585858585858586", maintenance: "0.8", cos: "1" });
  assert.equal(row(r, "Leuchten rechnerisch, aufgerundet"), 18); // actual reference r-N
  assert.equal(row(r, "Raumindex").toFixed(2), "2.02");
  assert.equal(metric(r, "Leuchten im rechteckigen Raster"), 20); // own extra full-row constraint, not reference parity
  assert.match(r.formula, /volle Reihen/);
});

test("executed reference: short-circuit common cold impedance matches; source bound and TN model are not interchangeable", () => {
  const r = run("kurzschlussstrom"); // 630kVA/4%, 400V, Cu16mm²,25m,n=1
  assert.equal(metric(r, "Impedanz 3~-Pfad").toFixed(2), "31.37");
  // Actual source upper-bound displayed7.729kA includes c_max1.05, edeco model uses c=1.
  assert.equal((metric(r, "3~-Kurzschluss · Modell") * 1.05).toFixed(3), "7.729");
  assert.notEqual(metric(r, "L–PE-Schleife · Modell").toFixed(3), "2.685"); // source's conservative Ik_min
  assert.match(r.status.text, /kein normativer Ik-max-\/Ik-min-Nachweis/);
});
