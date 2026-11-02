import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultNetwork, createNetworkEdge, createNetworkNode, calculateNetwork, NETWORK_NODE_FIELDS, NETWORK_EDGE_FIELDS } from "./networkModel.ts";
import { createFloorDistributionExample } from "./networkExamples.ts";
import type { NetworkDocument, NetworkNode } from "./networkTypes.ts";

const near = (actual: number, expected: number, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
function oneLoad(system: "1" | "3" = "3", loadValues: Record<string, string> = {}, wireValues: Record<string, string> = {}): NetworkDocument {
  const source = createNetworkNode("source", "s", 0, 0), load = createNetworkNode("load", "l", 300, 0);
  Object.assign(source.values, { phases: system, voltage: system === "3" ? "400" : "230", sourceMode: "ideal", loopKnown: "yes", loopImpedance: "0.04" });
  Object.assign(load.values, { phases: system, phase: "L1" }, loadValues);
  const edge = createNetworkEdge("e", source.id, load.id);
  Object.assign(edge.values, { iz: "100" }, wireValues);
  return { version: 1, name: "Prüffall", nodes: [source, load], edges: [edge] };
}
function added(doc: NetworkDocument, kind: NetworkNode["kind"], id: string) {
  const node = createNetworkNode(kind, id, 500, 0); doc.nodes.push(node); return node;
}

test("connected default is a finite open-proof model, never an installation certificate", () => {
  const doc = createDefaultNetwork(), result = calculateNetwork(doc);
  assert.equal(result.valid, true); assert.equal(result.edges.length, 3); assert.equal(result.nodes.length, 4);
  near(result.totalPowerKW, 6.9); near(result.maxCurrent, 10.483465414232679); near(result.maxDropPercent, 2.738028055585818);
  assert.equal(result.tone, "warning");
  assert.ok(result.edges.every(edge => edge.ikMinKA === null));
  assert.ok(result.assumptions.some(item => item.includes("keine garantierte Schranke")));
  assert.ok(!result.status.includes("entspricht NIN"));
  for (const edge of result.edges) for (const value of [edge.current, edge.neutralCurrent, edge.dropPercent, edge.cumulativeDropPercent]) assert.ok(Number.isFinite(value));
});

test("empty and unconnected diagrams yield no calculable result or false green zero", () => {
  const noEdges = createDefaultNetwork(); noEdges.edges = [];
  const result = calculateNetwork(noEdges);
  assert.equal(result.valid, false); assert.equal(result.tone, "error"); assert.deepEqual(result.edges, []);
  assert.ok(result.issues.some(issue => issue.text.includes("Keine Leitungsverbindungen")));
  assert.equal(calculateNetwork({ version: 1, name: "Leer", nodes: [], edges: [] }).valid, false);
  const disconnected = createDefaultNetwork(); added(disconnected, "load", "unconnected");
  assert.equal(calculateNetwork(disconnected).valid, false);
});

test("graph rejects cycles, self links, multiple feeds and multiple parents", () => {
  const cycle = createDefaultNetwork(); cycle.edges.push(createNetworkEdge("cycle", "load", "uv"));
  assert.equal(calculateNetwork(cycle).valid, false);
  const self = oneLoad(); self.edges.push(createNetworkEdge("self", "l", "l"));
  assert.equal(calculateNetwork(self).valid, false);
  const multiFeed = oneLoad(); const second = added(multiFeed, "source", "s2"); multiFeed.edges.push(createNetworkEdge("feed2", second.id, "l"));
  assert.equal(calculateNetwork(multiFeed).valid, false);
  const multiParent = createDefaultNetwork(); multiParent.edges.push(createNetworkEdge("parent2", "source", "load"));
  assert.equal(calculateNetwork(multiParent).valid, false);
});

test("dangling and duplicate IDs or malformed imported records are rejected", () => {
  const dangling = oneLoad(); dangling.edges[0].to = "missing";
  assert.equal(calculateNetwork(dangling).valid, false);
  const duplicate = oneLoad(); duplicate.nodes.push({ ...duplicate.nodes[1] });
  assert.equal(calculateNetwork(duplicate).valid, false);
  const duplicateEdge = oneLoad(); duplicateEdge.edges.push({ ...duplicateEdge.edges[0] });
  assert.equal(calculateNetwork(duplicateEdge).valid, false);
  assert.equal(calculateNetwork({ ...oneLoad(), nodes: [null] } as unknown as NetworkDocument).valid, false);
  const malformed = oneLoad(); malformed.nodes[0].values = null as unknown as Record<string, string>;
  assert.equal(calculateNetwork(malformed).valid, false);
});

test("strict numeric validation does not turn blank, zero, invalid sections or overflow into a replacement result", () => {
  for (const value of ["", "NaN", "Infinity", "-1", "0"]) {
    const doc = oneLoad(); doc.edges[0].values.length = value;
    assert.equal(calculateNetwork(doc).valid, false, value);
  }
  const area = oneLoad(); area.edges[0].values.area = "300";
  assert.equal(calculateNetwork(area).valid, false, "300 mm² has no verified X′ and must not be silently enabled");
  const al = oneLoad(); al.edges[0].values.material = "al"; al.edges[0].values.area = "2.5";
  assert.equal(calculateNetwork(al).valid, false);
  const overflow = oneLoad(); overflow.nodes[1].values.cosPhi = "0." + "0".repeat(319) + "1";
  assert.equal(calculateNetwork(overflow).valid, false);
  const parallel = oneLoad(); parallel.edges[0].values.parallel = "1.5";
  assert.equal(calculateNetwork(parallel).valid, false);
});

test("single-phase Cu source fixture reproduces 6.74 V and 2.93 percent with its neutral return", () => {
  const result = calculateNetwork(oneLoad("1", { power: "3.68", cosPhi: "1" }, { length: "25", area: "2.5", temperature: "55" }));
  assert.equal(result.valid, true);
  near(result.edges[0].current, 16); near(result.edges[0].neutralCurrent, 16);
  assert.equal(result.edges[0].dropVolts.toFixed(2), "6.74");
  assert.equal(result.edges[0].dropPercent.toFixed(2), "2.93");
});

test("balanced three-phase Cu fixture matches the independently audited 8.08 V / 2.02 percent case", () => {
  const power = Math.sqrt(3) * 400 * 32 * .85 / 1000;
  const result = calculateNetwork(oneLoad("3", { power: String(power), cosPhi: "0.85" }, { length: "80", area: "10", temperature: "55" }));
  assert.equal(result.valid, true); near(result.edges[0].current, 32); near(result.edges[0].neutralCurrent, 0);
  assert.equal((result.edges[0].dropVolts * Math.sqrt(3)).toFixed(2), "8.08");
  assert.equal(result.edges[0].dropPercent.toFixed(2), "2.02");
});

test("two serial sections each using three percent exceed the single four-percent path budget", () => {
  const doc = oneLoad("1", { power: "3.68", cosPhi: "1" });
  const r55PerKm = 7.41 * (1 + .00393 * 35), length = .03 * 230 / (2 * 16 * r55PerKm) * 1000;
  const bus = added(doc, "distribution", "bus"); doc.edges[0].to = bus.id; doc.edges[0].values.length = String(length);
  const next = createNetworkEdge("next", bus.id, "l"); Object.assign(next.values, { length: String(length), iz: "100" }); doc.edges.push(next);
  const result = calculateNetwork(doc);
  assert.equal(result.valid, true); near(result.edges[0].dropPercent, 3); near(result.edges[1].dropPercent, 3);
  near(result.edges[1].cumulativeDropPercent, 6); near(result.maxDropPercent, 6);
  assert.equal(result.edges[1].tone, "error"); assert.ok(result.issues.some(issue => /gesamten Pfad/.test(issue.text)));
});

test("branch feeder sums complex P/Q rather than currents or only active kW", () => {
  const doc = oneLoad("3", { power: "10", cosPhi: "1" });
  const bus = added(doc, "distribution", "bus"); doc.edges[0].to = bus.id;
  const first = createNetworkEdge("branch-a", bus.id, "l"), secondLoad = added(doc, "load", "load-b");
  Object.assign(secondLoad.values, { power: "5", cosPhi: "0.8" });
  const second = createNetworkEdge("branch-b", bus.id, secondLoad.id); doc.edges.push(first, second);
  const result = calculateNetwork(doc), feeder = result.edges.find(edge => edge.id === "e")!;
  assert.equal(result.valid, true); near(result.totalPowerKW, 15); near(feeder.powerKW, 15);
  near(feeder.current, Math.hypot(15000, 3750) / (Math.sqrt(3) * 400));
  const branchSum = result.edges.filter(edge => edge.id !== "e").reduce((sum, edge) => sum + edge.current, 0);
  assert.ok(feeder.current < branchSum - .1, "different power factors require phasor summation");
});

test("unbalanced single-phase loads expose strongest phase and neutral; balanced phases cancel neutral", () => {
  const doc = oneLoad("3", { phases: "1", power: "2.3", cosPhi: "1", phase: "L1" });
  const first = calculateNetwork(doc); assert.deepEqual(first.edges[0].currents, [10, 0, 0]); near(first.edges[0].neutralCurrent, 10);
  const bus = added(doc, "distribution", "bus"); doc.edges[0].to = bus.id; doc.edges.push(createNetworkEdge("l1", bus.id, "l"));
  for (const phase of ["L2", "L3"]) {
    const load = added(doc, "load", phase); Object.assign(load.values, { phases: "1", phase, power: "2.3", cosPhi: "1" });
    doc.edges.push(createNetworkEdge(`edge-${phase}`, bus.id, load.id));
  }
  const balanced = calculateNetwork(doc), feeder = balanced.edges.find(edge => edge.id === "e")!;
  feeder.currents.forEach(current => near(current, 10)); near(feeder.neutralCurrent, 0); near(balanced.totalPowerKW, 6.9);
});

test("smaller neutral requires its own Iz and cannot borrow the phase ampacity", () => {
  const doc = oneLoad("1", { power: "6.9", cosPhi: "1" }, { area: "10", neutralArea: "1.5", neutralIz: "15", iz: "100" });
  const result = calculateNetwork(doc);
  assert.equal(result.valid, true); assert.equal(result.edges[0].tone, "error");
  assert.ok(result.issues.some(issue => issue.text.includes("Neutralleiterstrom") && issue.text.includes("N-Iz 15")));
  doc.edges[0].values.neutralIz = "";
  assert.equal(calculateNetwork(doc).valid, false);
});

test("parallel identical sets divide impedance and add documented Iz exactly once", () => {
  const doc = oneLoad("1", { power: "3.68", cosPhi: "1" }, { iz: "20" });
  const single = calculateNetwork(doc); doc.edges[0].values.parallel = "2"; const parallel = calculateNetwork(doc);
  near(parallel.edges[0].current, single.edges[0].current); near(parallel.edges[0].dropPercent, single.edges[0].dropPercent / 2);
  near(parallel.edges[0].iz!, 40);
});

test("Ik,max uses cold cumulative impedance while warm L–PE min stays distinct and source-sensitive", () => {
  const doc = oneLoad("1", { power: "3.68", cosPhi: "1" }, { length: "25", area: "2.5" });
  const first = calculateNetwork(doc), e = first.edges[0];
  const coldLoop = 2 * 7.41 * 25 / 1000, reactanceLoop = 2 * .110 * 25 / 1000;
  near(e.ikMaxKA!, 1.05 * 230 / Math.hypot(coldLoop, reactanceLoop) / 1000);
  const warmLoop = Math.hypot(coldLoop * (1 + .00393 * 60), reactanceLoop);
  near(e.ikMinKA!, .95 * 230 / (.04 + warmLoop) / 1000);
  doc.nodes[0].values.loopImpedance = "0.2";
  assert.ok(calculateNetwork(doc).edges[0].ikMinKA! < e.ikMinKA!);
  doc.nodes[0].values.loopKnown = "no";
  assert.equal(calculateNetwork(doc).edges[0].ikMinKA, null);
});

test("source-mode Ik is converted at the feed and includes every following section", () => {
  const doc = oneLoad("3", { power: "10", cosPhi: "1" }, { length: "1", area: "240" });
  Object.assign(doc.nodes[0].values, { sourceMode: "ik", ik: "10" });
  const first = calculateNetwork(doc).edges[0].ikMaxKA!;
  assert.ok(first < 10 && first > 9.9, "entered Ik,max must not receive a second 1.05 multiplier");
  doc.edges[0].values.length = "100";
  assert.ok(calculateNetwork(doc).edges[0].ikMaxKA! < first);
});

test("breaker checks Icn at its own location and a low endpoint fault current separately", () => {
  const doc = oneLoad("3", { power: "5", cosPhi: "1" }, { area: "240", length: "1" });
  const breaker = added(doc, "protection", "b"); doc.edges[0].to = breaker.id;
  Object.assign(doc.nodes[0].values, { sourceMode: "ik", ik: "10", loopKnown: "yes", loopImpedance: "1" });
  const downstream = createNetworkEdge("after", breaker.id, "l"); Object.assign(downstream.values, { length: "100", area: "2.5", iz: "20" }); doc.edges.push(downstream);
  const result = calculateNetwork(doc);
  assert.equal(result.valid, true); assert.equal(result.tone, "error");
  assert.ok(result.issues.some(issue => issue.nodeId === "b" && issue.text.includes("Ausschaltvermögen")));
  assert.ok(result.issues.some(issue => issue.edgeId === "after" && issue.text.includes("Magnetauslöser")));
});

test("protection Iz and conventional trip current failures mark the actual affected edge", () => {
  const doc = createDefaultNetwork(), last = doc.edges.at(-1)!;
  last.values.iz = "15";
  const ratedFailure = calculateNetwork(doc); assert.equal(ratedFailure.edges.at(-1)!.tone, "error");
  assert.ok(ratedFailure.issues.some(issue => issue.edgeId === last.id && issue.text.includes("Schutznennstrom")));
  last.values.iz = "20"; doc.nodes.find(node => node.kind === "protection")!.values.i2factor = "2";
  const i2Failure = calculateNetwork(doc); assert.ok(i2Failure.issues.some(issue => issue.text.includes("I₂")));
});

test("source overload is retained on the source node and a failed calculation remains exportable as failed", () => {
  const doc = oneLoad("3", { power: "300", cosPhi: "1" }, { area: "240", iz: "1000" });
  const result = calculateNetwork(doc);
  assert.equal(result.valid, true); assert.equal(result.tone, "error"); assert.equal(result.nodes.find(node => node.id === "s")!.tone, "error");
  assert.ok(result.issues.some(issue => issue.nodeId === "s" && issue.text.includes("Anschlussstrom")));
});

test("transformer adds LV-referred impedance and flags winding overload without claiming voltage conversion", () => {
  const doc = oneLoad("3", { power: "10", cosPhi: "1" }, { length: "0.01", area: "240" });
  const tx = added(doc, "transformer", "tx"); Object.assign(tx.values, { kva: "250", uk: "4" }); doc.edges[0].to = tx.id;
  const output = createNetworkEdge("tx-output", tx.id, "l"); Object.assign(output.values, { length: "0.01", area: "240", iz: "100" }); doc.edges.push(output);
  const result = calculateNetwork(doc), end = result.edges.find(edge => edge.id === "tx-output")!;
  const x = .04 * 400 ** 2 / 250000 + 2 * .075 * .01 / 1000, r = 2 * .0754 * .01 / 1000;
  near(end.ikMaxKA!, 1.05 * 400 / (Math.sqrt(3) * Math.hypot(r, x)) / 1000);
  doc.nodes.find(node => node.id === "l")!.values.power = "300";
  assert.ok(calculateNetwork(doc).issues.some(issue => issue.nodeId === "tx" && issue.text.includes("Trafo-Nennstrom")));
});

test("RCD and cascading devices never manufacture a selectivity or earthing approval", () => {
  const doc = createDefaultNetwork(), protector = doc.nodes.find(node => node.kind === "protection")!;
  protector.values.device = "RCBO";
  const result = calculateNetwork(doc);
  assert.equal(result.valid, true); assert.ok(result.issues.some(issue => issue.text.includes("RCD") && issue.text.includes("ungeprüft")));
  const extra = added(doc, "protection", "second"); doc.edges.at(-1)!.to = extra.id; doc.edges.push(createNetworkEdge("last", extra.id, "load"));
  assert.ok(calculateNetwork(doc).issues.some(issue => issue.text.includes("Selektivität / Back-up")));
});

test("one-phase sources reject three-phase consumers and unavailable L2/L3 assignments", () => {
  assert.equal(calculateNetwork(oneLoad("1", { phases: "3" })).valid, false);
  assert.equal(calculateNetwork(oneLoad("1", { phase: "L2" })).valid, false);
});

test("a zero simultaneous load is a warning, not a vacuous green installation result", () => {
  const result = calculateNetwork(oneLoad("3", { diversity: "0" }));
  assert.equal(result.valid, true); near(result.totalPowerKW, 0); assert.equal(result.tone, "warning");
  assert.ok(result.issues.some(issue => issue.text.includes("keine aktive Last")));
});

test("field metadata offers equipment series and manual scope without arbitrary norm table values", () => {
  assert.ok(NETWORK_NODE_FIELDS.protection.find(field => field.key === "rated")?.options?.some(option => option.value === "16"));
  assert.ok(NETWORK_EDGE_FIELDS.find(field => field.key === "area")?.options?.some(option => option.value === "2.5"));
  assert.ok(!NETWORK_EDGE_FIELDS.find(field => field.key === "area")?.options?.some(option => option.value === "300"));
  assert.ok(NETWORK_EDGE_FIELDS.find(field => field.key === "iz")?.help.includes("keine automatische Normtabellenwahl"));
});

test("a standalone RCD or omitted protective device never becomes a complete overcurrent check", () => {
  const doc = oneLoad("3", { power: "5", cosPhi: "1" });
  assert.ok(calculateNetwork(doc).issues.some(issue => issue.text.includes("kein Überstromschutzorgan")));
  const rcd = added(doc, "protection", "rcd"); rcd.values.device = "RCD"; doc.edges[0].to = rcd.id;
  doc.edges.push(createNetworkEdge("after-rcd", rcd.id, "l"));
  const result = calculateNetwork(doc);
  assert.ok(result.issues.some(issue => issue.edgeId === "after-rcd" && issue.text.includes("kein Überstromschutzorgan")));
});

test("neutral displacement can raise a lightly loaded phase and is explicitly flagged", () => {
  const doc = oneLoad("3", { phases: "1", phase: "L1", power: "0.23", cosPhi: "1" });
  const bus = added(doc, "distribution", "bus"); doc.edges[0].to = bus.id; doc.edges.push(createNetworkEdge("l1", bus.id, "l"));
  for (const phase of ["L2", "L3"]) {
    const load = added(doc, "load", phase); Object.assign(load.values, { phases: "1", phase, power: "2.3", cosPhi: "1" });
    doc.edges.push(createNetworkEdge(`edge-${phase}`, bus.id, load.id));
  }
  const result = calculateNetwork(doc);
  near(result.edges.find(edge => edge.id === "e")!.neutralCurrent, 9);
  assert.ok(result.issues.some(issue => issue.text.includes("Neutralpunktverschiebung")));
});

test("finite input values cannot leak overflowed transformer/drop arithmetic as a valid result", () => {
  const tiny = "0." + "0".repeat(239) + "1";
  assert.equal(tiny.length, 242);
  assert.ok(Number.isFinite(Number(tiny)) && Number(tiny) > 0);
  const doc = oneLoad("3", { power: "6.9", cosPhi: tiny });
  const tx = added(doc, "transformer", "tx"); tx.values.kva = tiny;
  doc.edges[0].to = tx.id; doc.edges.push(createNetworkEdge("tx-load", tx.id, "l"));
  const result = calculateNetwork(doc);
  assert.equal(result.valid, false); assert.equal(result.tone, "error");
  assert.deepEqual(result.edges, []); assert.deepEqual(result.nodes, []);
  assert.ok(result.issues.some(issue => issue.text.includes("Zahlenbereich")));
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes("null"), "overflow must not turn into JSON null numeric placeholders");
  assert.ok(!serialized.includes("Infinity") && !serialized.includes("NaN"));
});

test("finite-range and underflow guards cover source conversion, line impedance and nonzero load products", () => {
  const sourceOverflow = oneLoad();
  Object.assign(sourceOverflow.nodes[0].values, { sourceMode: "ik", ik: "0." + "0".repeat(310) + "1" });
  assert.equal(calculateNetwork(sourceOverflow).valid, false);
  const lineUnderflow = oneLoad(); lineUnderflow.edges[0].values.length = "0." + "0".repeat(319) + "1";
  assert.equal(calculateNetwork(lineUnderflow).valid, false);
  const loadUnderflow = oneLoad("3", { power: "0." + "0".repeat(239) + "1", diversity: "0." + "0".repeat(239) + "1" });
  assert.equal(calculateNetwork(loadUnderflow).valid, false, "two positive factors must not silently become a zero load");
});

test("switched-off branch inherits upstream terminal drop on its connected phase", () => {
  const doc = oneLoad("1", { power: "3.68", cosPhi: "1" }, { length: "25", area: "2.5" });
  const bus = added(doc, "distribution", "bus"); doc.edges[0].to = bus.id;
  const active = createNetworkEdge("active", bus.id, "l"); active.values.length = "1";
  const off = added(doc, "load", "off"); Object.assign(off.values, { phases: "1", phase: "L1", power: "3.68", cosPhi: "1", diversity: "0" });
  const offLine = createNetworkEdge("off-line", bus.id, off.id); offLine.values.length = "1";
  doc.edges.push(active, offLine);
  const result = calculateNetwork(doc);
  assert.equal(result.valid, true);
  const feeder = result.edges.find(edge => edge.id === "e")!, activeResult = result.edges.find(edge => edge.id === "active")!, offResult = result.edges.find(edge => edge.id === "off-line")!;
  near(feeder.dropPercent, 2.93191147826087);
  near(offResult.current, 0); near(offResult.dropPercent, 0);
  near(offResult.cumulativeDropPercent, feeder.cumulativeDropPercent);
  near(activeResult.cumulativeDropPercent, feeder.dropPercent * 1.04);
});

test("idle branches retain their assigned phase, including a voltage rise from neutral displacement", () => {
  const doc = oneLoad("3", { phases: "1", phase: "L1", power: "3.68", cosPhi: "1" }, { length: "25", area: "2.5" });
  const bus = added(doc, "distribution", "bus"); doc.edges[0].to = bus.id;
  const active = createNetworkEdge("active", bus.id, "l"); active.values.length = "1";
  const off = added(doc, "load", "off-l2"); Object.assign(off.values, { phases: "1", phase: "L2", power: "3.68", cosPhi: "1", diversity: "0" });
  const offLine = createNetworkEdge("off-l2-line", bus.id, off.id); offLine.values.length = "1";
  doc.edges.push(active, offLine);
  const result = calculateNetwork(doc), offResult = result.edges.find(edge => edge.id === offLine.id)!;
  assert.equal(result.valid, true); near(offResult.current, 0);
  assert.ok(offResult.checks.some(text => text.includes("Spannungsanhebung")), "available L2 voltage reflects shared neutral despite zero L2 current");
  near(offResult.cumulativeDropPercent, 0, 1e-12);
});

test("tiny nonzero currents retain their neutral component instead of being rounded to a zero load", () => {
  const result = calculateNetwork(oneLoad("1", { power: "0.000000000023", cosPhi: "1" }));
  assert.equal(result.valid, true);
  const edge = result.edges[0];
  assert.ok(edge.current > 0 && edge.current < 1e-9);
  near(edge.neutralCurrent / edge.current, 1, 1e-12);
  assert.ok(edge.cumulativeDropPercent > 0);
  assert.ok(!result.issues.some(issue => issue.text.includes("keine aktive Last")));
});

test("numerical validation identifies the exact node even when several nodes share the same field", () => {
  const document = createDefaultNetwork(), extra = added(document, "load", "second-load");
  document.edges.push(createNetworkEdge("second-feed", "uv", extra.id));
  extra.values.cosPhi = "";
  const result = calculateNetwork(document);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].nodeId, extra.id);
  assert.equal(result.issues[0].edgeId, undefined);
  assert.match(result.issues[0].text, /Leistungsfaktor/);
  const source = createDefaultNetwork(); source.nodes[0].values.r = "";
  const sourceResult = calculateNetwork(source);
  assert.equal(sourceResult.issues[0].nodeId, "source");
  assert.equal(sourceResult.issues[0].edgeId, undefined);
});

test("numerical wire errors identify the failing edge without leaking a previous object context", () => {
  const document = createDefaultNetwork(); document.edges[1].values.length = "";
  const result = calculateNetwork(document);
  assert.equal(result.valid, false);
  assert.equal(result.issues[0].edgeId, "line-2");
  assert.equal(result.issues[0].nodeId, undefined);
  assert.match(result.issues[0].text, /Leitungslänge/);
  const nextDocument = createDefaultNetwork(); nextDocument.nodes[2].values.rated = "";
  const next = calculateNetwork(nextDocument);
  assert.equal(next.issues[0].nodeId, "ls");
  assert.equal(next.issues[0].edgeId, undefined);
});

test("computed overflow identifies the transformer or wire where arithmetic failed", () => {
  const tiny = "0." + "0".repeat(239) + "1";
  const withTransformer = oneLoad("3", { cosPhi: tiny });
  const transformer = added(withTransformer, "transformer", "small-transformer"); transformer.values.kva = tiny;
  withTransformer.edges[0].to = transformer.id; withTransformer.edges.push(createNetworkEdge("output", transformer.id, "l"));
  const nodeFailure = calculateNetwork(withTransformer);
  assert.equal(nodeFailure.valid, false);
  assert.equal(nodeFailure.issues[0].nodeId, transformer.id);
  assert.equal(nodeFailure.issues[0].edgeId, undefined);
  const wireFailureDocument = oneLoad("3", { power: "10", cosPhi: "0." + "0".repeat(305) + "1" }, { length: "100000", area: "1.5" });
  const edgeFailure = calculateNetwork(wireFailureDocument);
  assert.equal(edgeFailure.valid, false);
  assert.equal(edgeFailure.issues[0].edgeId, "e");
  assert.equal(edgeFailure.issues[0].nodeId, undefined);
  assert.match(edgeFailure.issues[0].text, /Zahlenbereich/);
});

function twoFloorHandExample(): NetworkDocument {
  const make = (kind: NetworkNode["kind"], id: string, label: string, values: Record<string, string> = {}) => {
    const node = createNetworkNode(kind, id, 0, 0);
    return { ...node, label, values: { ...node.values, ...values } };
  };
  const line = (id: string, from: string, to: string, length: string, area: string, iz: string) => {
    const edge = createNetworkEdge(id, from, to);
    return { ...edge, values: { ...edge.values, length, area, iz } };
  };
  return {
    version: 1, name: "Handrechnung · UV 1. OG und UV 2. OG",
    nodes: [
      make("source", "s", "Einspeisung", { loopKnown: "yes", loopImpedance: "0.03" }),
      make("distribution", "hv", "Hauptverteilung"),
      make("distribution", "uv1", "UV 1. OG", { rated: "63" }),
      make("distribution", "uv2", "UV 2. OG", { rated: "63" }),
      make("protection", "b1", "LS B16 · 1. OG"),
      make("protection", "b2", "LS B25 · 2. OG", { rated: "25" }),
      // At 400 V, these electrical powers with cos φ=1 correspond to 10 A / 20 A.
      make("load", "load1", "Last 1. OG", { power: "6.928203230275509", cosPhi: "1" }),
      make("load", "load2", "Last 2. OG", { power: "13.856406460551018", cosPhi: "1" }),
    ],
    edges: [
      line("trunk", "s", "hv", "10", "10", "50"),
      line("floor1", "hv", "uv1", "20", "6", "40"),
      line("floor2", "hv", "uv2", "30", "6", "40"),
      line("to-b1", "uv1", "b1", "1", "6", "40"),
      line("to-b2", "uv2", "b2", "1", "6", "40"),
      line("end1", "b1", "load1", "25", "2.5", "20"),
      line("end2", "b2", "load2", "20", "4", "32"),
    ],
  };
}

test("two floor distributions share their upstream current but retain independent branch drops", () => {
  const result = calculateNetwork(twoFloorHandExample());
  assert.equal(result.valid, true); assert.equal(result.nodes.length, 8); assert.equal(result.edges.length, 7);
  assert.ok(!result.issues.some(issue => issue.tone === "error"));
  near(result.totalPowerKW, 20.784609690826527); near(result.maxCurrent, 30);
  const edge = (id: string) => result.edges.find(item => item.id === id)!;
  const node = (id: string) => result.nodes.find(item => item.id === id)!;
  near(node("s").current, 30); near(node("hv").current, 30);
  near(node("uv1").current, 10); near(node("uv2").current, 20);
  near(edge("trunk").current, 30); near(edge("floor1").current, 10); near(edge("floor2").current, 20);
  result.edges.forEach(item => near(item.neutralCurrent, 0));
  // Hand values use R′55: Cu10=2.0817165, Cu6=3.503654,
  // Cu2.5=8.4292455 and Cu4=5.2441055 Ω/km. At cosφ=1,
  // ΔU_LN=I·R′55·L/1000 and percent=ΔU_LN/(400/√3)·100.
  near(edge("trunk").dropVolts, .62451495); near(edge("trunk").dropPercent, .270422905872);
  near(edge("floor1").dropPercent, .303425337007);
  near(edge("floor2").dropPercent, .910276011021);
  near(edge("end1").dropPercent, .912492592217);
  near(edge("end2").dropPercent, .908305716625);
  near(edge("end1").cumulativeDropPercent, 1.501512101946);
  near(edge("end2").cumulativeDropPercent, 2.119347167219);
  assert.equal(edge("end1").tone, "ok"); assert.equal(edge("end2").tone, "ok");
});

test("changing floor one updates the shared trunk and floor-two available voltage without changing floor-two current", () => {
  const document = twoFloorHandExample(), baseline = calculateNetwork(document);
  document.nodes.find(node => node.id === "load1")!.values.power = "27.712812921102035"; // 40 A at cosφ=1
  const changed = calculateNetwork(document);
  assert.equal(changed.valid, true); assert.equal(changed.tone, "error");
  const edge = (id: string) => changed.edges.find(item => item.id === id)!;
  const before = (id: string) => baseline.edges.find(item => item.id === id)!;
  near(changed.totalPowerKW, 41.569219381653056); near(changed.maxCurrent, 60);
  near(edge("trunk").current, 60); near(edge("floor1").current, 40);
  near(edge("floor2").current, 20); near(edge("end2").current, 20);
  near(edge("floor2").dropPercent, before("floor2").dropPercent);
  near(edge("end2").dropPercent, before("end2").dropPercent);
  near(edge("end2").ikMinKA!, before("end2").ikMinKA!);
  near(edge("end1").cumulativeDropPercent, 5.465202596041);
  near(edge("end2").cumulativeDropPercent, 2.389770073090);
  near(edge("end2").cumulativeDropPercent - before("end2").cumulativeDropPercent, .270422905872);
  assert.equal(edge("trunk").tone, "error", "60 A exceed the documented 50-A trunk capacity");
  assert.equal(edge("end1").tone, "error", "floor-one load exceeds its B16/20-A circuit and path budget");
  assert.equal(edge("end2").tone, "ok", "floor-two circuit remains within its own checks");
  assert.ok(changed.issues.some(issue => issue.edgeId === "trunk" && issue.text.includes("Iz 50")));
  assert.ok(changed.issues.some(issue => issue.edgeId === "end1" && issue.text.includes("gesamten Pfad")));
  assert.ok(!changed.issues.some(issue => issue.edgeId === "floor2" && issue.tone === "error"));
  assert.ok(!changed.issues.some(issue => issue.edgeId === "end2" && issue.tone === "error"));
});

test("the editor floor example has two reachable protected branches and its phasor sum is calculable", () => {
  const document = createFloorDistributionExample(), result = calculateNetwork(document);
  assert.equal(result.valid, true); assert.equal(result.nodes.length, 10); assert.equal(result.edges.length, 9);
  assert.ok(!result.issues.some(issue => issue.tone === "error"));
  near(result.totalPowerKW, 11.5);
  // P=11.5 kW, Q=6.9 kW·tan(arccos .95)=2.2679203257341555 kvar.
  // I=|P+jQ|/(√3·400)=16.918521815594474 A, not the sum of magnitudes.
  near(result.maxCurrent, 16.918521815594474);
  near(result.edges.find(edge => edge.id === "house-hv")!.current, 16.918521815594474);
  near(result.edges.find(edge => edge.id === "feed-uv-1")!.current, 10.483465414232679);
  near(result.edges.find(edge => edge.id === "feed-uv-2")!.current, 6.639528095680697);
  assert.ok(document.nodes.some(node => node.label === "UV 1. OG"));
  assert.ok(document.nodes.some(node => node.label === "UV 2. OG"));
});
