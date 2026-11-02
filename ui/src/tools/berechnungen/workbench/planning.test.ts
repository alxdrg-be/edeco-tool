import assert from "node:assert/strict";
import test from "node:test";
import { PLANNING, roomGrid, spacingRoomGrid, sharePower } from "./planning.ts";
import { defaults, type Inputs } from "./types.ts";

const definition = (id: string) => { const value = PLANNING.find(c => c.id === id); assert.ok(value, id); return value; };
const run = (id: string, patch: Inputs = {}) => { const d = definition(id); return d.calculate({ ...defaults(d), ...(id === "premium-pkw" ? { layout: "legacy" } : id === "premium-lkw" ? { depotLayout: "legacy" } : id === "premium-ladekosten" ? { costLayout: "legacy" } : id === "premium-sia2056" ? { siaMode: "legacy" } : id === "premium-poe" ? { poeRouteMode: "legacy" } : {}), ...patch }); };
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
  const requestLimited = run("premium-lkw", { mode: "static", factor: "0.1" });
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
  assert.throws(() => run("premium-brandmelder", { gridRule: "radius", radius: "0" }));
});

test("selectivity uses documented pair current limits rather than nominal current ratios", () => {
  const unknown = run("premium-selektivitaet");
  assert.equal(unknown.status.tone, "warning"); assert.match(unknown.status.text, /LS–LS.*nicht nachgewiesen/);
  const failed = run("premium-selektivitaet", { checkMode: "manufacturer", rating1: "10000", ik2: "6.01", basis: "documented", reference: "Herstellerkombination, Tabelle A, Ausgabe 2026" });
  assert.equal(failed.status.tone, "error"); close(failed.metrics[1].value, -.01);
  const boundary = run("premium-selektivitaet", { checkMode: "manufacturer", ik2: "6", ik3: "3", basis: "documented", reference: "Hersteller X/Y, Paar-Tabelle, 400 V, 2026" });
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
  close(run("premium-ladekosten", { replacementYear: "16" }).metrics[0].value, 159500);
  assert.throws(() => run("premium-ladekosten", { replacementYear: "51" }));
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

test("saved two-group brandload keeps MJ/m cable separate from MJ/m escape route and calculates before-after", () => {
  const legacy = (values: Record<string, string> = {}) => run("premium-brandlast", { fireloadMode: "legacy", ...values });
  const r = legacy();
  close(r.metrics[0].value, 50); close(r.metrics[1].value, 15); close(r.metrics[2].value, 70); close(r.metrics[3].value, 300);
  const doubledRoute = legacy({ route: "40" });
  close(doubledRoute.metrics[0].value, 25); close(doubledRoute.metrics[3].value, 300);
  const failure = legacy({ limit: "10" });
  assert.equal(failure.status.tone, "error");
  const noBefore = legacy({ countBefore1: "0", countBefore2: "0" });
  assert.equal(noBefore.metrics[2].value, "–");
  assert.throws(() => legacy({ route: "0" }));
  assert.throws(() => legacy({ length1: "0" }));
  assert.throws(() => legacy({ specificBefore1: "0" }));
  assert.throws(() => legacy({ specificAfter1: "0" }));
  const inactive = legacy({ countBefore1: "0", countAfter1: "0", length1: "0", specificBefore1: "0", specificAfter1: "0" });
  close(inactive.metrics[0].value, 20);
});

test("hidden static power fraction cannot invalidate other multi-grid modes", () => {
  close(run("premium-pkw", { mode:"dynamic", factor:"" }).metrics[2].value, Number(run("premium-pkw").metrics[2].value));
  close(run("premium-pkw", { mode:"none", factor:"" }).metrics[2].value, 110);
  assert.throws(() => run("premium-pkw", { mode:"static", factor:"" }));
});


test("LKW modes expose no-LM overload instead of silently curtailing demand", () => {
  const unregulated = run("premium-lkw", { mode: "none", factor: "" });
  close(unregulated.metrics[1].value, 450);
  close(unregulated.rows!.find(row => row.label === "AC-Aufnahme der Units")!.value, 450 / .97);
  assert.equal(unregulated.status.tone, "error");
  assert.match(unregulated.formula, /keine Begrenzung/);
  const dynamic = run("premium-lkw", { mode: "dynamic", factor: "" });
  close(dynamic.metrics[1].value, 300);
  assert.throws(() => run("premium-lkw", { mode: "static", factor: "" }));
  assert.match(definition("premium-lkw").fields.find(field => field.key === "efficiency")!.label, /Angenommener/);
  for (const key of ["unitPower", "postPower", "connector"]) assert.equal(definition("premium-lkw").fields.find(field => field.key === key)!.kind, "select");
});

test("detector axis spacing reproduces the observed simple room without mistaking spacing for radius", () => {
  const r = run("premium-brandmelder");
  close(r.metrics[0].value, 1);
  assert.ok(r.diagram?.kind === "room");
  assert.equal(r.diagram.columns, 1); assert.equal(r.diagram.rows, 1);
  assert.equal(r.diagram.radius, undefined);
  const legacy = run("premium-brandmelder", { gridRule: "radius", maxArea: "60", radius: "5" });
  close(legacy.metrics[0].value, 2);
  for (const [length, width] of [[10,8],[30,20],[4,50],[.8,10]]) {
    if (length < 1) { assert.throws(() => spacingRoomGrid(length,width,80,12,6,.5)); continue; }
    const grid = spacingRoomGrid(length,width,80,12,6,.5);
    assert.ok(length * width / grid.count <= 80 + 1e-9);
    assert.ok(length / grid.columns <= 12 + 1e-9 && width / grid.rows <= 12 + 1e-9);
    assert.ok(grid.wallX <= 6 + 1e-9 && grid.wallY <= 6 + 1e-9);
    assert.ok(grid.wallX >= .5 - 1e-9 && grid.wallY >= .5 - 1e-9);
  }
  assert.throws(() => run("premium-brandmelder", { maxSpacing: "" }));
  assert.throws(() => run("premium-brandmelder", { minWall: "7" }));
  assert.match(r.limitations.join(" "), /manuell|keine.*Abstandstabelle/i);
});

test("NH and RCD rules stay hints; LS pairs require explicit manufacturer evidence", () => {
  const nh = run("premium-selektivitaet", { type1:"NH", type2:"NH", type3:"NH", rating1:"160", rating2:"100", rating3:"63" });
  assert.match(String(nh.rows![0].value), /1.6 erfüllt/);
  assert.equal(nh.status.tone, "warning");
  const rcd = run("premium-selektivitaet", { type1:"RCD", type2:"RCD", delay1:"instant", delta1:"300", delta2:"100" });
  assert.match(String(rcd.rows![0].value), /Zeitselektivität nicht belegt/);
  const delayed = run("premium-selektivitaet", { type1:"RCD", type2:"RCD", delay1:"S", delay2:"instant", delta1:"300", delta2:"100" });
  assert.match(String(delayed.rows![0].value), /Typ S/);
  assert.equal(delayed.status.tone, "warning");
  assert.throws(() => run("premium-selektivitaet", { checkMode:"manufacturer" }), /dokumentierte Werte/);
  assert.throws(() => run("premium-selektivitaet", { checkMode:"manufacturer", basis:"documented", reference:"Hersteller A/B, 400 V", limit12:"" }));
});

test("cost duration controls sums and bars, without double-counting annualised capital", () => {
  const five = run("premium-ladekosten", { years:"5" });
  close(five.metrics[0].value, 59600 + 5 * 6660);
  assert.equal(five.series!.length, 5);
  close(five.rows!.find(row => row.label === "Ersatz im Zeitraum")!.value, 0);
  close(five.rows!.find(row => row.label === "Jahreskosten im Mittel")!.value, (59600 + 5 * 6660) / 5);
  const ten = run("premium-ladekosten", { years:"10" });
  close(ten.metrics[0].value, 59600 + 10 * 6660 + 10800);
  close(ten.series!.reduce((sum,item) => sum + item.value + (item.secondary ?? 0),0), Number(ten.metrics[0].value));
  assert.throws(() => run("premium-ladekosten", { years:"" }));
  assert.throws(() => run("premium-ladekosten", { years:"2" }));
  assert.match(ten.limitations[0], /tatsächliche jährliche Zahlungen/);
});

test("SIA target comparison keeps power, energy and area weighting separate", () => {
  const r = run("premium-sia2056", { benchmark:"on", targetPower1:"18", targetPower2:"10", targetPower3:"10", targetEnergy1:"40", targetEnergy2:"24", targetEnergy3:"24" });
  assert.equal(r.comparisons!.length, 2);
  assert.equal(r.comparisons![0].unit, "W/m²");
  assert.equal(r.comparisons![1].unit, "kWh/(m²·a)");
  close(r.comparisons![0].items[0].actual, 16);
  close(r.comparisons![1].items[0].actual, 36);
  assert.equal(r.series, undefined);
  close(r.metrics[4].value, 13.44);
  close(r.metrics[5].value, 30.24);
  close(r.rows!.find(row => row.label === "Flächengewichtetes Leistungsziel")!.value, 14.8);
  close(r.rows!.find(row => row.label === "Flächengewichtetes Energieziel")!.value, 33.6);
  assert.equal(r.status.tone, "warning");
  const tooLow = run("premium-sia2056", { benchmark:"on", targetPower1:"18", targetPower2:"10", targetPower3:"10", targetEnergy1:"30", targetEnergy2:"24", targetEnergy3:"24", pv:"100000", self:"100" });
  assert.equal(tooLow.status.tone, "error");
  close(tooLow.metrics[3].value, 0);
  close(tooLow.metrics[5].value, 30.24);
  assert.throws(() => run("premium-sia2056", { benchmark:"on" }), /Energieziel|Leistungsziel/);
  assert.doesNotThrow(() => run("premium-sia2056", { benchmark:"off", targetPower1:"", targetEnergy1:"" }));
});

test("PoE route has an explicit 20-degree model and a separate physical 100-m limit", () => {
  const r = run("premium-poe");
  assert.match(definition("premium-poe").scope, /IEEE 802.3/);
  assert.match(r.formula, /20°C/);
  assert.throws(() => run("premium-poe", { temperature:"45" }));
  const tooLong = run("premium-poe", { length1:"0", length2:"101", length3:"0", factor2:"0.5" });
  assert.equal(tooLong.status.tone, "error");
  assert.match(tooLong.status.text, /Physische Kanallänge über 100 m/);
  assert.throws(() => run("premium-poe", { maximum:"101" }));
});

test("vertical escape routes never inherit the horizontal 200-MJ/m comparison", () => {
  const r = run("premium-brandlast", { fireloadMode: "legacy", routeType:"vertical", limit:"" });
  assert.equal(r.status.tone, "warning");
  assert.match(r.status.text, /ohne 200-MJ\/m-Grenzwertvergleich/);
  assert.equal(r.rows!.some(row => /grenzwert/i.test(row.label)), false);
  close(r.metrics[3].value, 300);
  assert.equal(r.comparisons, undefined);
});
