import assert from "node:assert/strict";
import test from "node:test";
import { INSTALLATION } from "./installation.ts";
import { defaults, type CalculationResult, type Inputs } from "./types.ts";

/* Reference audit: public browser-delivered code retrieved 2026-11-01.
 * No provider implementation or normative catalogue is bundled here. The expected
 * numbers below were obtained from its calculation functions in an isolated JS
 * context. DOM/output plumbing and explicitly manual input data were supplied by
 * the audit harness. These compare arithmetic, not normative table selection.
 *
 * Sources and retrieved SHA-256:
 * /Rechner/nin-kabelrechner.html   1893aead40ecb010d64631c521c022d9902b990081079375838162d242008ba8
 * /Rechner/Strombelastbarkeit.html 9f043889248548d05975306395148e3393e564e358b32b983f1dfa5baf090e83
 * /Rechner/ls-schalter.html        fa5893414f1231d3497536807bc9543fc0cfc35f6153b6de1d099f8b1901a6fa
 * /Rechner/potenzialausgleich.html c1915c94cc26131d9341b83671b42dd0b6e8b243540d0f4b76aa95d60bad02d7
 * /Rechner/pva-rechner.html        b8ac93253238abf8facb5bfda3dbb36a19347a13294cfd8dc7fef9c52789e9ef
 * /Rechner/brandlast-fluchtweg.html c9a4b97305d76154925299b6d640eb3fb979d685de4d18811c2962625f046f05
 * /assets/poe-engine.js            211cb4eb84fa81f1e3fecfd0401eabc1a414d64a4e62822bc70d7a862e8396f9
 * Host for all paths: https://www.elektro-rechner.ch
 */
const run = (id: string, changes: Inputs = {}) => {
  const definition = INSTALLATION.find(item => item.id === id)!;
  return definition.calculate({ ...defaults(definition), ...changes });
};
function numeric(result: CalculationResult, label: string): number {
  const metric = result.metrics.find(item => item.label === label)!;
  assert.equal(typeof metric.value, "number", label);
  return metric.value as number;
}
const close = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

test("reference NIN correction kernel agrees when the same explicit table value and factors are entered", () => {
  // Reference calculate(): supplied Iz₀=50 A, kT=.87, kH=.8, n=1 → displayed34.8 A.
  // This deliberately does not purport to validate the provider's NIN catalogue.
  const r = run("nin-kabelrechner", { iz0: "50", temperature: "0.87", grouping: "0.8" });
  close(numeric(r, "Korrigierte Strombelastbarkeit Iz"), 34.8);
  assert.equal(r.status.tone, "ok");
});

test("parallel ampacity retains precision instead of copying the reference's intermediate integer rounding", () => {
  const one = run("strombelastbarkeit", { base: "246", temperature: "1", grouping: "1", circuits: "1" });
  close(numeric(one, "Gesamt-Iz"), 246);
  const two = run("strombelastbarkeit", { base: "246", temperature: "1", grouping: "0.88", circuits: "2" });
  // Website Strombelastbarkeit calc() rounds216.48 A to216 before ×2 →432 A.
  // Website nin-kabelrechner calculate() instead displays433 A for the same factors.
  // Our unrounded432.96 A is intentional and avoids early integer quantisation.
  close(numeric(two, "Iz je Stromkreis"), 216.48);
  close(numeric(two, "Gesamt-Iz"), 432.96);
  close(numeric(two, "Gesamt-Iz") - 432, .96);
});

test("B/C/D magnetic ranges match the public reference CF factors", () => {
  for (const [curve, rated, range] of [["B", "16", "48–80"], ["C", "20", "100–200"], ["D", "32", "320–640"]] as const) {
    const r = run("ls-schalter", { curve, rated, ikMin: "800" });
    assert.equal(r.metrics[0].value, range);
  }
  // Manufacturer-specific backup and selectivity tables are intentionally not inferred.
});

test("bonding matches source HPA/OPA results when equivalent manual PE and table entries are supplied", () => {
  for (const [pe, hpaTable, lps, hpa, additional] of [
    ["16", "10", "no", 10, 10], // source phase16/PEN16/noLPS
    ["25", "16", "yes", 16, 16], // source phase50/PEN25/LPS
    ["4", "6", "yes", 10, 4], // source phase4/PEN4/LPS
  ] as const) {
    const r = run("potenzialausgleich", { pe, hpaTable, lps, connection: "foreign", minimum: "4" });
    close(numeric(r, "Haupt-PA aus den Eingaben"), hpa);
    close(numeric(r, "Zusätzlicher PA"), additional);
  }
});

test("PV discounted cost, capital value and interpolated payback match source economics for equal assumptions", () => {
  const r = run("pva-rechner", { area: "100", usable: "100", efficiency: "20", yield: "1050", orientation: "100", cost: "2000", grant: "0", self: "40", tariff: "0.29", feed: "0.09", om: "1", degradation: "0.5", years: "25", discount: "3" });
  close(numeric(r, "Anlageleistung · STC"), 20);
  close(numeric(r, "Jahresertrag · Jahr 1"), 21);
  close(numeric(r, "Amortisation"), 13.053345385820549);
  close(numeric(r, "Diskontierte Gestehungskosten"), 13.527327119725403);
  close(numeric(r, "Kapitalwert"), 12056.704186021152);
  // Source uses whole-module floor rounding for a NEW plant. This case fixes an
  // equivalent20 kWp plant; native continuous area modelling is not a module layout.
});

test("fire-load sum matches reference calcVariante for mixed cable counts and partial lengths", () => {
  const r = run("brandlast", { length: "10", q1: "3", n1: "10", l1: "10", q2: "0.5", n2: "5", l2: "6", q3: "0", n3: "0", l3: "0" });
  close(numeric(r, "Brandlast total"), 315);
  close(numeric(r, "Brandlast bezogen auf Fluchtweg"), 31.5);
  close(numeric(r, "Kabel total"), 15);
  assert.equal(r.status.tone, "warning"); // arithmetic does not resolve missing CPR evidence
});

test("PoE DC power matches three source-engine cases at equal temperature and contact assumptions", () => {
  for (const [voltage, power, circuits, maxCurrent, length, resistance, pd, outV, loss] of [
    ["54", "25", "1", "0.6", "80", "9.38", 23.391632373113854, 50.525925925925925, 1.6083676268861455],
    ["48", "90", "2", "1", "90", "8.5", 76.552734375, 40.828125, 13.447265625],
    ["48", "13", "1", "0.35", "20", "9.38", 12.862394097222221, 47.49191666666667, .13760590277777776],
  ] as const) {
    const r = run("poe", { voltage, power, circuits, maxCurrent, length, resistance, temperature: "20", connector: "0" });
    close(numeric(r, "Leistung am Endgerät"), pd);
    close(numeric(r, "Spannung am Endgerät"), outV);
    close(numeric(r, "Kabel-/Kontaktverlust"), loss);
  }
  // The source explicitly marks its PoE power/current catalogue as provisional.
  // Matching that model is not an IEEE or RP certification.
});
