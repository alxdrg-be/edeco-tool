import assert from "node:assert/strict";
import test from "node:test";
import { calculateNetwork, createNetworkEdge, createNetworkNode } from "./networkModel.ts";
import { buildNetworkDiagnostics, networkBound, networkDiagnosticId, networkInterval } from "./networkDiagnostics.ts";
import type { NetworkDocument, NetworkIssue } from "./networkTypes.ts";

function project(): NetworkDocument {
  const source = createNetworkNode("source", "source"), protector = createNetworkNode("protection", "nh"), load = createNetworkNode("load", "load");
  Object.assign(source.values, { phases: "1", voltage: "230", sourceMode: "ideal", loopKnown: "yes", loopImpedance: "0.04" });
  Object.assign(protector.values, { device: "NH", rated: "25", i2factor: "5" });
  protector.label = "NH-Sicherung";
  Object.assign(load.values, { phases: "1", phase: "L1", power: "2.4", cosPhi: "1" });
  const feed = createNetworkEdge("feed", "source", "nh"), final = createNetworkEdge("final", "nh", "load");
  Object.assign(feed.values, { area: "16", length: "1", iz: "100" });
  return { version: 1, name: "Fehlerhilfe", nodes: [source, protector, load], edges: [feed, final] };
}
const diagnostics = (document: NetworkDocument) => buildNetworkDiagnostics(document, calculateNetwork(document));
const find = (document: NetworkDocument, code: string, edge = "final") => {
  const diagnostic = diagnostics(document).find(item => item.issue.code === code && (!edge || item.issue.edgeId === edge));
  assert.ok(diagnostic, `Missing ${code} at ${edge}`);
  return diagnostic;
};

test("25 A NH with factor5, Iz20 and2.4kW1phase explains no feasible In instead of recommending5.8A", () => {
  const document = project(), diagnostic = find(document, "i2_iz");
  assert.match(diagnostic.required!, /Kein gemeinsamer In-Bereich/);
  assert.match(diagnostic.required!, /mindestens 10\.44 A/);
  assert.match(diagnostic.required!, /höchstens 5\.8 A/);
  assert.match(diagnostic.required!, /mindestens Iz = 86\.21 A/);
  assert.match(diagnostic.action!, /Nur den Nennstrom zu senken reicht/);
  assert.ok(diagnostic.targets!.some(target => target.rowId === "node:nh" && target.field === "rated"));
  assert.ok(diagnostic.targets!.some(target => target.rowId === "edge:final" && target.field === "iz"));
});

test("one protection interval includes all downstream lines but stops at the next overcurrent device", () => {
  const document = project();
  document.nodes[1].values.i2factor = "1.45";
  const second = createNetworkNode("protection", "second"), load = createNetworkNode("load", "tiny");
  Object.assign(second.values, { device: "NH", rated: "1", i2factor: "1.45" });
  Object.assign(load.values, { phases: "1", phase: "L1", power: ".23".replace(/^\./, "0."), cosPhi: "1" });
  const entry = createNetworkEdge("second-feed", "nh", "second"), small = createNetworkEdge("small", "second", "tiny");
  entry.values.iz = "100"; small.values.iz = "1";
  document.nodes.push(second, load); document.edges.push(entry, small);
  const diagnostic = find(document, "in_iz");
  assert.match(diagnostic.required!, /11\.44 A ≤ In ≤ 20 A/);
  assert.doesNotMatch(diagnostic.required!, /In ≤ 1 A/);
});

test("parallel guidance uses total Iz once and returns the required input per circuit", () => {
  const document = project();
  Object.assign(document.edges[1].values, { parallel: "2", iz: "10" });
  const diagnostic = find(document, "i2_iz");
  assert.match(diagnostic.actual!, /Iz dieser Leitung = 20 A/);
  assert.match(diagnostic.required!, /86\.21 A insgesamt/);
  assert.match(diagnostic.required!, /43\.11 A je parallelem Kreis \(2 Kreise\)/);
});

test("Ib above In does not claim that raising Iz alone repairs the protection", () => {
  const document = project();
  Object.assign(document.nodes[1].values, { rated: "16", i2factor: "1.45" });
  document.nodes[2].values.power = "6.9"; document.edges[1].values.iz = "100";
  const diagnostic = find(document, "ib_in");
  assert.match(diagnostic.action!, /Ein höheres Iz allein behebt Ib > In nicht/);
  assert.deepEqual(diagnostic.targets![0], { rowId: "node:nh", field: "rated", label: "Schutzorgan · In" });
  assert.match(diagnostic.required!, /30 A ≤ In ≤ 100 A/);
});

test("same neutral section with comma input targets shared Iz rather than the hidden N-Iz input", () => {
  const document = project();
  document.nodes[2].values.power = "9.2";
  Object.assign(document.edges[1].values, { area: "2,5", neutralArea: "2.5", neutralIz: "1" });
  const diagnostic = find(document, "neutral_iz");
  assert.equal(diagnostic.issue.field, "iz");
  assert.equal(diagnostic.targets![0].field, "iz");
  assert.match(diagnostic.action!, /denselben Iz-Wert/);
  assert.match(diagnostic.required!, /mindestens 40 A insgesamt/);
});

test("same-labelled devices retain distinct typed identities and exact input targets", () => {
  const document = project(), second = createNetworkNode("protection", "second");
  Object.assign(second.values, { device: "NH", rated: "25", i2factor: "5" }); second.label = "NH-Sicherung";
  const load = createNetworkNode("load", "load2"); Object.assign(load.values, document.nodes[2].values);
  const feed = createNetworkEdge("feed2", "source", "second"), final = createNetworkEdge("final2", "second", "load2");
  document.nodes.push(second, load); document.edges.push(feed, final);
  const first = find(document, "i2_iz"), next = find(document, "i2_iz", "final2");
  assert.notEqual(first.id, next.id);
  assert.ok(first.targets!.some(target => target.rowId === "node:nh"));
  assert.ok(next.targets!.some(target => target.rowId === "node:second"));
  assert.ok(!first.targets!.some(target => target.rowId === "node:second"));
});

test("diagnostic identity is stable when current values and translated wording change", () => {
  const issue: NetworkIssue = { tone: "error", code: "i2_iz", text: "Old", nodeId: "b", edgeId: "a", relatedNodeId: "p", field: "iz", data: { actual: 100 } };
  assert.equal(networkDiagnosticId(issue), networkDiagnosticId({ ...issue, text: "New", data: { actual: 200 } }));
  assert.notEqual(networkDiagnosticId(issue), networkDiagnosticId({ ...issue, relatedNodeId: "other" }));
  const document = project(), before = find(document, "i2_iz"); document.edges[1].values.iz = "21";
  const after = find(document, "i2_iz");
  assert.equal(before.id, after.id); assert.notEqual(before.message, after.message); assert.notEqual(before.actual, after.actual);
});

test("independent structural errors on one object retain distinct diagnostic identities", () => {
  const document = project();
  Object.assign(document.nodes[1], { kind: "unsupported", label: { wrong: "label" }, x: NaN, values: null });
  const result = calculateNetwork(document);
  assert.equal(result.valid, false);
  const guidance = buildNetworkDiagnostics(document, result);
  assert.equal(guidance.length, 4);
  assert.deepEqual(new Set(guidance.map(item => item.issue.code)), new Set(["node_kind", "node_label", "node_position", "node_values"]));
  assert.equal(new Set(guidance.map(item => item.id)).size, guidance.length);
  assert.ok(guidance.every(item => item.title === "nh"));
  assert.ok(guidance.every(item => item.targets![0].rowId === "node:nh"));
  const byCode = new Map(guidance.map(item => [item.issue.code, item.id]));
  document.nodes[1].label = "Wieder gültig";
  const after = diagnostics(document);
  assert.equal(after.length, 3);
  assert.ok(after.every(item => item.id === byCode.get(item.issue.code)));
});

test("repeated malformed identities do not produce duplicate global diagnostic keys", () => {
  const document = project();
  document.nodes.push({ ...document.nodes[1] }, { ...document.nodes[1] });
  const guidance = diagnostics(document);
  assert.equal(guidance.filter(item => item.issue.code === "node_identity").length, 1);
  assert.equal(new Set(guidance.map(item => item.id)).size, guidance.length);
});

test("unknown Iz leaves the upper In limit open instead of claiming an infeasible range", () => {
  const document = project();
  Object.assign(document.nodes[1].values, { rated: "6", i2factor: "1.45" });
  document.edges[1].values.izMode = "open";
  const diagnostic = diagnostics(document).find(item => item.issue.code === "device_current" && item.issue.nodeId === "nh");
  assert.ok(diagnostic);
  assert.match(diagnostic.required!, /Bereich ist noch nicht bestimmbar/);
  assert.match(diagnostic.required!, /Leitungsnachweise sind offen/);
  assert.match(diagnostic.required!, /Für die Last benötigt In mindestens 10\.44 A/);
  assert.doesNotMatch(diagnostic.required!, /Kein gemeinsamer In-Bereich/);
  assert.doesNotMatch(diagnostic.action!, /Nur den Nennstrom zu senken reicht/);
});

test("RCDs and switches receive rating guidance without being treated as overcurrent protectors", () => {
  for (const device of ["RCD", "SWITCH"]) {
    const document = project();
    Object.assign(document.nodes[1].values, { device, rated: "16" });
    document.nodes[2].values.power = "6.9";
    document.edges[1].values.iz = "100";
    const diagnostic = diagnostics(document).find(item => item.issue.code === "device_current" && item.issue.nodeId === "nh");
    assert.ok(diagnostic);
    assert.match(diagnostic.actual!, /30 A Last gegenüber 16 A Gerätenennstrom/);
    assert.match(diagnostic.required!, /mindestens 30 A/);
    assert.doesNotMatch(diagnostic.required!, /In-Bereich|I₂/);
    assert.ok(diagnostic.targets!.some(target => target.rowId === "node:nh" && target.field === "rated"));
    assert.ok(diagnostics(document).some(item => item.issue.code === "protection_missing" && item.issue.edgeId === "final"));
  }
});

test("invalid numbers, choices and unsupported sections point at their exact field and preserve invalid state", () => {
  const cases: ["node" | "edge", string, string, string][] = [["edge", "length", "", "length"], ["edge", "parallel", "1.5", "parallel"], ["edge", "peArea", "3", "peArea"], ["node", "phase", "L3", "phase"], ["node", "cosPhi", "0", "cosPhi"]];
  for (const [kind, key, input, expected] of cases) {
    const document = project();
    (kind === "node" ? document.nodes[2] : document.edges[1]).values[key] = input;
    const result = calculateNetwork(document);
    assert.equal(result.valid, false, key); assert.deepEqual(result.edges, []);
    const diagnostic = buildNetworkDiagnostics(document, result)[0];
    assert.equal(diagnostic.issue.code, "input", key); assert.equal(diagnostic.targets![0].field, expected, key);
    assert.equal(diagnostic.targets![0].rowId, kind === "node" ? "node:load" : "edge:final", key);
    assert.ok(diagnostic.required);
  }
});

test("unknown source loop stays an open proof without an invented impedance", () => {
  const document = project(); document.nodes[0].values.loopKnown = "no";
  const diagnostic = find(document, "loop_open");
  assert.match(diagnostic.required!, /Dokumentierter L–PE-Quellenanteil/);
  assert.doesNotMatch(diagnostic.required!, /\d/);
  assert.deepEqual(diagnostic.targets!.map(target => [target.rowId, target.field]), [["node:source", "loopKnown"], ["node:source", "loopImpedance"]]);
  assert.equal(calculateNetwork(document).edges[1].ikMinKA, null);
});

test("missing protection distinguishes a HAK distribution from an actual fuse", () => {
  const document = project();
  document.nodes[1].kind = "distribution"; document.nodes[1].values.device = "hak";
  const diagnostic = find(document, "protection_missing");
  assert.match(diagnostic.action!, /HAK ist in diesem Modell nur ein Verteilungselement/);
  assert.ok(diagnostic.targets!.some(target => target.rowId === "node:nh"));
});

test("manufacturer and coordination limitations are explanations, never fabricated repair values", () => {
  const document = project(), before = JSON.stringify(document);
  const diagnostic = diagnostics(document).find(item => item.issue.code === "manufacturer_proof")!;
  assert.ok(diagnostic);
  assert.match(diagnostic.required!, /Geräte-\/Herstellernachweis/);
  assert.match(diagnostic.action!, /nicht durch einen frei gewählten Zahlenwert/);
  assert.equal(JSON.stringify(document), before);
});

test("magnetic failure states the actual model loop bound and targets the actual device and wire", () => {
  const document = project();
  Object.assign(document.nodes[1].values, { device: "LS", rated: "25", curve: "D", i2factor: "1.45" });
  document.nodes[0].values.loopImpedance = "1";
  const diagnostic = find(document, "magnetic");
  const bound = .95 * 230 / (20 * 25);
  assert.match(diagnostic.required!, new RegExp(`${networkBound(bound, "down")} Ω`));
  assert.match(diagnostic.actual!, /gesamte Fehlerschleife/);
  assert.ok(diagnostic.targets!.some(target => target.rowId === "node:nh" && target.field === "curve"));
  assert.ok(diagnostic.targets!.some(target => target.rowId === "edge:final" && target.field === "peArea"));
  assert.match(diagnostic.action!, /keine verbindliche Abschaltzeit/);
});

test("idle branches never recommend entering a zero fuse rating", () => {
  const document = project(); document.nodes[2].values.diversity = "0";
  const diagnostic = find(document, "i2_iz");
  assert.match(diagnostic.required!, /0 A < In/);
  assert.doesNotMatch(diagnostic.required!, /0 A ≤ In/);
  const idle = find(document, "idle_branch");
  assert.match(idle.required!, /kein Mindeststrom wird erfunden/);
});

test("directed display bounds remain conservative, nonzero and noninverted at narrow numeric ranges", () => {
  for (const [lower, upper] of [[10.434782608695652, 20], [1.23456789, 1.234567891], [14.5, 14.5], [8.2e-14, 8.3e-14], [Number.MIN_VALUE, Number.MIN_VALUE]]) {
    const interval = networkInterval(lower, upper); assert.ok(interval);
    assert.ok(Number(interval.lower) >= lower); assert.ok(Number(interval.upper) <= upper);
    assert.ok(Number(interval.upper) > 0); assert.ok(Number(interval.lower) <= Number(interval.upper));
  }
  assert.equal(networkInterval(10.434782608695652, 5.8), null);
  assert.equal(networkBound(9.999, "up"), "9.999");
  assert.equal(networkBound(5.8, "down"), "5.8");
  for (const number of [Number.MIN_VALUE, 1e-323, 1e-320, Number.MAX_VALUE, 9.9995, .099995]) {
    const lower = Number(networkBound(number, "down")), upper = Number(networkBound(number, "up"));
    assert.ok(Number.isFinite(lower) && Number.isFinite(upper));
    assert.ok(lower > 0 && lower <= number && upper >= number);
  }
});

test("floating-point-equal Ib and In boundaries are marked as numerical rather than falsely infeasible", () => {
  const document = project();
  Object.assign(document.nodes[0].values, { phases: "3", voltage: "400" });
  Object.assign(document.nodes[1].values, { rated: "25", i2factor: "1.45" });
  Object.assign(document.nodes[2].values, { phases: "3", power: "6.969772449657162", cosPhi: "0.503" });
  const before = calculateNetwork(document);
  assert.ok(before.edges[1].current > 20 && before.edges[1].current - 20 < 1e-12);
  const diagnostic = find(document, "in_iz");
  assert.match(diagnostic.required!, /Numerisch gleiche Modellgrenze: 20 A ≤ In ≤ 20 A/);
  assert.doesNotMatch(diagnostic.required!, /Kein gemeinsamer In-Bereich|20\.01 A/);
  document.nodes[1].values.rated = "20";
  const after = calculateNetwork(document);
  assert.equal(after.valid, true);
  assert.ok(!after.issues.some(issue => ["ib_iz", "in_iz", "i2_iz", "ib_in", "device_current"].includes(issue.code || "")));
  document.nodes[1].values.i2factor = "5";
  const conventional = find(document, "i2_iz");
  assert.doesNotMatch(conventional.action!, /Ein höheres Iz allein behebt Ib > In nicht/);
  document.edges[1].values.iz = "69";
  assert.ok(!calculateNetwork(document).issues.some(issue => ["ib_iz", "in_iz", "i2_iz", "ib_in", "device_current"].includes(issue.code || "")));
});
