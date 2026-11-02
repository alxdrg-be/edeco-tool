import assert from "node:assert/strict";
import test from "node:test";
import { defaults, type CalculatorDefinition, type Inputs } from "./types.ts";
import { PLANNING } from "./planning.ts";
import { migrateWorkbenchInputs } from "./migrateInputs.ts";
import { POE_CABLE_REFERENCES } from "./referenceInstallationData.ts";
import { calculatePoeRoute, createPoeRouteDefinition, defaultPoeRouteSegment, parsePoeSegments, poeEquivalentLength, poeRouteReportInputs, referencePoeRise, type PoeRouteSegmentInput } from "./poeRoute.ts";

// Numerical fixtures from direct execution of the public linkLength()/rpCategory()
// API retrieved2026-11-01. Source https://www.elektro-rechner.ch/assets/poe-engine.js
// SHA256 211cb4eb84fa81f1e3fecfd0401eabc1a414d64a4e62822bc70d7a862e8396f9.
// These verify published reference behaviour, not the source's unconfirmed norm claims.
const legacy: CalculatorDefinition = { id: "premium-poe", title: "PoE-Streckenplaner", description: "", source: "", scope: "", fields: [], calculate() { return { metrics: [{ label: "Frühere Prüfung", value: 85 }], status: { tone: "warning", text: "Manuelle Vorprüfung" }, formula: "L × Faktor", limitations: [] }; } };
const definition = createPoeRouteDefinition(legacy);
const base = defaults(definition);
const run = (patch: Inputs = {}) => calculatePoeRoute({ ...base, ...patch });
const segments = (...rows: Partial<PoeRouteSegmentInput>[]) => JSON.stringify(rows.map((row, index) => ({ ...defaultPoeRouteSegment(`s-${index + 1}`), label: `Abschnitt ${index + 1}`, ...row })));
const close = (actual: number, expected: number, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);

test('authenticated three-segment planner cases match displayed source engine',()=>{
  // Actual /premium/poe-streckenplaner.php buildChannel() + PE.linkLength()
  // captured 2026-11-02: three Cat7A/s AWG22 sections, 40/30/20 m.
  const cable=POE_CABLE_REFERENCES.find(c=>c.label==='Cat7A/s (AWG22)')!;
  assert.ok(cable);
  const rows=()=>segments(
    {cableType:cable.id,numCables:'200',width:'200',ambient:'25',installCondition:'EF',length:'40'},
    {cableType:cable.id,numCables:'75',width:'100',ambient:'25',installCondition:'C',length:'30'},
    {cableType:cable.id,numCables:'24',width:'50',ambient:'25',installCondition:'B',length:'20'},
  );
  const common={poeClass:'D',poeRpCategory:'RP3',poeSegments:rows()};
  const standard=run(common);
  close(standard.physicalChannel,100);close(standard.electricalLength20,95.67798794025754);
  close(standard.weightedTemperature,33.173884193192904);close(standard.allowedLengthApprox,101.25983208781588);
  const cold=run({...common,poeRpCategory:'RP1',poeSegments:JSON.stringify(JSON.parse(rows()).map((row:PoeRouteSegmentInput)=>({...row,ambient:'10'})))});
  close(cold.electricalLength20,93.41086956521741);close(cold.weightedTemperature,11.5);close(cold.allowedLengthApprox,104);
  const hotRows=JSON.parse(rows());hotRows[0].ambient='40';
  const hot=run({...common,poeConnectors:'4',poePatchFactor:'2',poePatchShielding:'/u',poeSegments:JSON.stringify(hotRows)});
  close(hot.electricalLength20,102.60104580613216);close(hot.weightedTemperature,39.64874967937349);close(hot.referenceReserve,2.398954193867837);
});

test("PoE route default thermal, patch and electrical-length values match the public engine", () => {
  const r = run();
  close(r.physicalChannel, 90);
  close(r.electricalLength20, 96.6658286599785);
  close(r.referenceLimit, 104);
  close(r.referenceReserve, 7.3341713400214985);
  close(r.weightedTemperature, 28.70050425994136);
  close(r.allowedLengthApprox, 97.27730015653161);
  close(r.segments[0].temperature, 33.596665212475806);
  close(r.segments[1].geometry!, 2.0502310398682075);
  close(r.segments[1].thermalCorrection!, .8323680048198097);
  close(r.segments[1].rise, 3.541343627570964);
  close(r.segments[2].equivalent20, 7.59526370138);
});

test("mixed shielded/unshielded segments, four connectors and warm patch tails match the source", () => {
  const r = run({ poeRpCategory: "RP3", poeClass: "E", poeConnectors: "4", poePatchFactor: "2", poePatchTotal: "7.5", poePatchShielding: "/u", poeShieldPriority: "yes", poePatchAmbient: "30", poePatchBundle1: "48", poePatchBundle2: "2", poeSegments: segments({ cableType: "cat6a-u-awg23", numCables: "48", width: "60", ambient: "35", installCondition: "C", length: "70" }, { cableType: "cat7-s-awg22", numCables: "12", width: "100", ambient: "30", installCondition: "B", length: "10" }) });
  close(r.physicalChannel, 87.5);
  close(r.electricalLength20, 99.14020467730909);
  close(r.referenceLimit, 102);
  close(r.referenceReserve, 2.859795322690914);
  close(r.weightedTemperature, 41.59287121917941);
  close(r.allowedLengthApprox, 88.37842100936264);
  close(r.segments[0].temperature, 52.67522802541479);
  close(r.segments[1].equivalent20, 73.0078022202414);
  close(r.segments[2].equivalent20, 9.30152613192006);
  close(r.segments.at(-1)!.physicalLength, 2.5);
});

test("a cold RP1 source case keeps the 20-degree floor and exactly 100 physical metres", () => {
  const r = run({ poeRpCategory: "RP1", poeClass: "F", poeConnectors: "3", poePatchFactor: "1.2", poePatchTotal: "5", poePatchAmbient: "10", poeSegments: segments({ cableType: "cat7-s-awg22", numCables: "8", width: "100", ambient: "10", length: "95" }) });
  close(r.physicalChannel, 100);
  close(r.electricalLength20, 101);
  close(r.referenceLimit, 103);
  close(r.weightedTemperature, 10);
  close(r.allowedLengthApprox, 102);
  assert.equal(r.channelWithin, true);
  assert.equal(r.designCurrent, 0);
  assert.equal(r.segments[0].physicalLength, 2);
  assert.equal(r.segments.at(-1)!.physicalLength, 3);
});

test("109 electrical-model metres never override the physical 100-metre channel limit", () => {
  const input = { ...base, poeRpCategory: "RP1", poeClass: "D", poePatchFactor: "1.2", poePatchTotal: "5", poePatchAmbient: "20", poeSegments: segments({ length: "96", ambient: "20" }) };
  const r = calculatePoeRoute(input);
  assert.equal(r.referenceLimit, 109);
  assert.equal(r.physicalChannel, 101);
  assert.equal(r.referenceWithin, true);
  assert.equal(r.channelWithin, false);
  const output = definition.calculate(input);
  assert.equal(output.status.tone, "error");
  assert.match(output.status.text, /100 m/);
  assert.doesNotMatch(output.status.text, /normkonform/i);
});

test("RP mixture preserves active pairs and conductor RMS rather than averaging type numbers", () => {
  const rp2 = run({ poeRpMode: "mix", poeShare1: "0", poeShare2: "100", poeShare3: "0", poeShare4: "0" });
  close(rp2.effectiveCurrent!, .21213203435596426);
  assert.equal(rp2.rpCategory, "RP2");
  const mixed = run({ poeRpMode: "mix", poeShare1: "50", poeShare2: "0", poeShare3: "0", poeShare4: "50" });
  close(mixed.effectiveCurrent!, .36422005710833666);
  assert.equal(mixed.designCurrent, .499);
  assert.throws(() => run({ poeRpMode: "mix", poeShare1: "50", poeShare2: "100" }), /100 %/);
});

test("the thermal envelope matches observed values and rejects unproven geometry", () => {
  const cable = POE_CABLE_REFERENCES.find(row => row.id === "cat6a-s-awg23")!;
  close(referencePoeRise(16, 10000, cable, .2312, .499, false).rise, 1.3550610515903998);
  close(referencePoeRise(24, 10000, cable, .2312, .499, false).rise, 1.3551445063995102);
  assert.throws(() => referencePoeRise(42, 10000, cable, .2312, .499, false), /ausserhalb/);
  assert.throws(() => run({ poeSegments: segments({ numCables: "42", width: "10000" }) }), /ausserhalb/);
});

test("manual temperatures and documented cable data work without pretending a calibrated thermal model", () => {
  const r = run({ poeThermalMode: "manual", poePatchMode: "manual", poePatch1Length: "3", poePatch2Length: "7", poeSegments: segments({ cableType: "custom", evidence: "Projekt-Datenblatt A", temperature: "45", attenuation: "0.2", classFactor: "1" }) });
  close(r.segments[1].equivalent20, 84);
  assert.equal(r.segments[1].geometry, undefined);
  assert.equal(r.thermalMode, "manual");
  close(r.segments[0].physicalLength, 3);
  close(r.segments.at(-1)!.physicalLength, 7);
  assert.throws(() => run({ poeSegments: segments({ cableType: "custom", evidence: "Datenblatt" }) }), /manuell/);
  close(poeEquivalentLength(80, 50, .4, 1.05), 86.85714285714286);
  close(poeEquivalentLength(80, 10, .4, 1), 80);
});

test("empty, malformed and unsupported fields block the new route instead of producing defaults", () => {
  for (const patch of [{ poeSegments: "" }, { poeSegments: "[]" }, { poeClass: "bad" }, { poeConnectors: "5" }, { poePatchFactor: "1.3" }, { poePatchTotal: "" }, { poePatchBundle1: "2.5" }, { poePatchAmbient: "" }, { poeSegments: segments({ length: "" }) }, { poeSegments: segments({ width: "1" }) }, { poeSegments: segments({ cableType: "constructor" }) }, { poeClass: "FA", poeSegments: segments({ cableType: "cat5e-u-awg24" }) }]) assert.throws(() => run(patch));
  const blank = segments({ length: "" });
  assert.equal(parsePoeSegments(blank, true)[0].length, "", "editing an empty number must remain possible");
  assert.throws(() => calculatePoeRoute({ ...base, poeSegments: blank }));
});

test("legacy direct calls remain manual and PDF inputs flatten the actual segment fields", () => {
  assert.equal(definition.calculate({}).metrics[0].value, 85);
  assert.equal(definition.calculate({ poeRouteMode: "legacy" }).metrics[0].value, 85);
  const report = poeRouteReportInputs(base);
  assert.equal(report.length, 1);
  assert.match(report[0].value, /80 m/);
  assert.match(report[0].value, /24 Kabel/);
  const current = definition.calculate(base);
  assert.equal(current.status.tone, "warning");
  assert.match(current.limitations.join(" "), /unbestätigt/);
});


test("a real saved three-segment draft stays on the manual path during migration", () => {
  const current = PLANNING.find(item => item.id === "premium-poe")!;
  const saved = { length1: "5", factor1: "1.5", length2: "70", factor2: "1", length3: "5", factor3: "1.5", maximum: "100", basis: "assumed", reference: "Gespeicherte Projektannahme" };
  const migrated = migrateWorkbenchInputs(current.id, defaults(current), saved);
  assert.equal(migrated.poeRouteMode, "legacy");
  const output = current.calculate(migrated);
  assert.equal(output.metrics.find(metric => metric.label === "Physische Länge")!.value, 80);
  assert.equal(output.metrics.find(metric => metric.label === "Äquivalente Länge")!.value, 85);
  assert.equal(output.poeRoute, undefined);
});
