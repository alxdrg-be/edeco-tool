import assert from "node:assert/strict";
import test from "node:test";
import { PLANNING, roomGrid, sharePower } from "./planning.ts";
import { defaults, type Inputs } from "./types.ts";

const definition = (id: string) => { const value = PLANNING.find(c => c.id === id); assert.ok(value, id); return value; };
const run = (id: string, patch: Inputs = {}) => { const d = definition(id); return d.calculate({ ...defaults(d), ...patch }); };
const close = (actual: number | string, expected: number) => { assert.equal(typeof actual, "number"); assert.ok(Math.abs(Number(actual) - expected) <= Math.max(1, Math.abs(expected)) * 1e-9, `${actual} != ${expected}`); };

test("all eight planning tools have functional finite default calculations and source/scope", () => {
  assert.equal(PLANNING.length, 8);
  assert.equal(new Set(PLANNING.map(d => d.id)).size, 8);
  for (const d of PLANNING) {
    const r = d.calculate(defaults(d));
    assert.ok(d.source.startsWith("https://www.elektro-rechner.ch/"));
    assert.ok(d.scope.length > 20);
    assert.ok(r.metrics.length >= 3 && r.formula.length > 30 && r.limitations.length);
    for (const metric of r.metrics) if (typeof metric.value === "number") assert.ok(Number.isFinite(metric.value), `${d.id}: ${metric.label}`);
    for (const item of r.series ?? []) assert.ok(Number.isFinite(item.value) && (item.secondary === undefined || Number.isFinite(item.secondary)));
  }
});

test("two-grid allocation conserves budget and each branch cap, including inactive branch", () => {
  const shares = sharePower(30, [80, 80], [10, 100]);
  close(shares[0], 10 / 3); close(shares[1], 80 / 3);
  assert.ok(shares[0] <= 10 && shares[1] <= 100);
  close(shares.reduce((s, v) => s + v, 0), 30);
  assert.deepEqual(sharePower(0, [80, 80], [10, 100]), [0, 0]);
  const oneGrid = run("premium-pkw", { count2: "0" });
  close(oneGrid.metrics[2].value, 63 * Math.sqrt(3) * 400 / 1000);
  close(oneGrid.metrics[3].value, 6);
  assert.equal(oneGrid.charging?.grids[1].count, 0);
  close(oneGrid.charging!.grids[0].assigned, 63 * Math.sqrt(3) * 400 / 1000);
});

test("AC grid planner never silently limits no-LM demand and ignores static factor outside static mode", () => {
  const raw = run("premium-pkw", { mode: "none", factor: "0.1" });
  close(raw.metrics[2].value, 110); assert.equal(raw.status.tone, "error");
  const managed = run("premium-pkw", { mode: "static", factor: "0.2" });
  close(managed.metrics[2].value, 22);
  const dynamic = run("premium-pkw", { factor: "0.1" });
  close(dynamic.metrics[2].value, 160 * Math.sqrt(3) * 400 / 1000 - 30);
  const exhausted = run("premium-pkw", { reserve: "200" });
  close(exhausted.metrics[2].value, 0); assert.equal(exhausted.status.tone, "error");
  assert.throws(() => run("premium-pkw", { count1: "0", count2: "0" }));
  assert.throws(() => run("premium-pkw", { grid1: "200" }));
});

test("depot converts AC to DC once and constrains both units and charging demand", () => {
  const unitLimited = run("premium-lkw");
  close(unitLimited.metrics[1].value, 300); close(unitLimited.metrics[2].value, 50);
  close(unitLimited.metrics[3].value, 300 / .97 - 300);
  const feedLimited = run("premium-lkw", { feed: "100", reserve: "0" });
  close(feedLimited.metrics[1].value, 100 * Math.sqrt(3) * 400 / 1000 * .97);
  const requestLimited = run("premium-lkw", { factor: "0.1" });
  close(requestLimited.metrics[1].value, 45);
  close(run("premium-lkw", { reserve: "1000" }).metrics[1].value, 0);
  assert.throws(() => run("premium-lkw", { efficiency: "1.01" }));
});

test("room raster independently satisfies area and corner-distance constraints", () => {
  for (const [length, width, area, radius] of [[10, 8, 60, 5], [30, 20, 25, 3], [6, 4, 100, 10], [2, 50, 20, 4]]) {
    const grid = roomGrid(length, width, area, radius);
    assert.ok(length * width / grid.count <= area + 1e-9);
    assert.ok(Math.hypot(length / (2 * grid.columns), width / (2 * grid.rows)) <= radius + 1e-9);
    assert.equal(grid.columns * grid.rows, grid.count);
  }
  const single = roomGrid(6, 4, 100, 10); assert.equal(single.count, 1);
  const result = run("premium-brandmelder");
  assert.equal(result.status.tone, "warning");
  assert.ok(result.diagram?.kind === "room");
  assert.throws(() => run("premium-brandmelder", { radius: "0" }));
});

test("selectivity uses documented pair current limits rather than nominal current ratios", () => {
  const unknown = run("premium-selektivitaet");
  assert.equal(unknown.status.tone, "warning"); assert.match(unknown.status.text, /Herstellerbeleg/);
  const failed = run("premium-selektivitaet", { rating1: "10000", ik2: "6.01", basis: "documented", reference: "Herstellerkombination, Tabelle A, Ausgabe 2026" });
  assert.equal(failed.status.tone, "error"); close(failed.metrics[1].value, -.01);
  const boundary = run("premium-selektivitaet", { ik2: "6", ik3: "3", basis: "documented" });
  assert.equal(boundary.metrics[0].value, "2 / 2");
  assert.equal(boundary.status.tone, "warning");
  assert.doesNotMatch(boundary.status.text, /vollständig selektiv/i);
  assert.throws(() => run("premium-selektivitaet", { reference: " " }));
});

test("15-year cost bars sum exactly to total, replacement occurs once, revenue stays separate", () => {
  const r = run("premium-ladekosten");
  close(r.metrics[0].value, 170300); close(r.metrics[1].value, 113400); close(r.metrics[2].value, 56900);
  assert.equal(r.series?.length, 15);
  close(r.series!.reduce((s, point) => s + point.value + (point.secondary ?? 0), 0), 170300);
  close(r.series![0].value, 59600); close(r.series![9].value, 10800); close(r.series![8].value, 0);
  const noReplacement = run("premium-ladekosten", { replacementYear: "0" });
  close(noReplacement.metrics[0].value, 159500);
  assert.throws(() => run("premium-ladekosten", { replacementYear: "16" }));
  assert.throws(() => run("premium-ladekosten", { points: "1.5" }));
});

test("SIA zone energy and simultaneous demand are distinct, PV offset cannot exceed demand", () => {
  const r = run("premium-sia2056");
  close(r.metrics[0].value, 8.4); close(r.metrics[1].value, 6.72); close(r.metrics[2].value, 15120); close(r.metrics[3].value, 12120);
  const lowerDemand = run("premium-sia2056", { sim1: "0.1", sim2: "0.1", sim3: "0.1" });
  close(lowerDemand.metrics[2].value, 15120);
  close(run("premium-sia2056", { pv: "100000", self: "100" }).metrics[3].value, 0);
  assert.throws(() => run("premium-sia2056", { area1: "0", area2: "0", area3: "0" }));
  assert.throws(() => run("premium-sia2056", { hours1: "8761" }));
});

test("PoE equivalent segments retain physical identity and report an exceeded manual limit", () => {
  const r = run("premium-poe");
  close(r.metrics[0].value, 80); close(r.metrics[1].value, 85); close(r.metrics[2].value, 15);
  const exceeded = run("premium-poe", { maximum: "80" });
  close(exceeded.metrics[2].value, -5); assert.equal(exceeded.status.tone, "error");
  const inactiveFirst = run("premium-poe", { length1: "0" });
  assert.ok(inactiveFirst.diagram?.kind === "chain");
  assert.equal(inactiveFirst.diagram.nodes[1].label, "Kabelsegment 2");
  assert.throws(() => run("premium-poe", { length1: "0", length2: "0", length3: "0" }));
});

test("brandload keeps MJ/m cable separate from MJ/m escape route and calculates before-after", () => {
  const r = run("premium-brandlast");
  close(r.metrics[0].value, 50); close(r.metrics[1].value, 15); close(r.metrics[2].value, 70); close(r.metrics[3].value, 300);
  const doubledRoute = run("premium-brandlast", { route: "40" });
  close(doubledRoute.metrics[0].value, 25); close(doubledRoute.metrics[3].value, 300);
  const failure = run("premium-brandlast", { limit: "10" });
  assert.equal(failure.status.tone, "error");
  const noBefore = run("premium-brandlast", { countBefore1: "0", countBefore2: "0" });
  assert.equal(noBefore.metrics[2].value, "–");
  assert.throws(() => run("premium-brandlast", { route: "0" }));
  assert.throws(() => run("premium-brandlast", { length1: "0" }));
  assert.throws(() => run("premium-brandlast", { specificBefore1: "0" }));
  assert.throws(() => run("premium-brandlast", { specificAfter1: "0" }));
  const inactive = run("premium-brandlast", { countBefore1: "0", countAfter1: "0", length1: "0", specificBefore1: "0", specificAfter1: "0" });
  close(inactive.metrics[0].value, 20);
});
