import assert from "node:assert/strict";
import test from "node:test";
import { checkNetwork, networkCalculationKey, networkReviewPDF, reviewIsCurrent, NETWORK_CHECK_REVISION, type NetworkReview } from "./networkReview.ts";
import { createDefaultNetwork, createNetworkEdge, createNetworkNode, calculateNetwork } from "./networkModel.ts";
import type { NetworkDocument } from "./networkTypes.ts";

const stamp = "2026-11-02T10:30:00.000Z";
const clone = <T>(value: T): T => structuredClone(value);

test("an explicit check captures a current fresh model result with its revision and time", () => {
  const document = createDefaultNetwork(), review = checkNetwork(document, stamp);
  assert.equal(review.checkedAt, stamp); assert.equal(review.revision, NETWORK_CHECK_REVISION);
  assert.equal(review.key, networkCalculationKey(document)); assert.equal(reviewIsCurrent(review, document), true);
  assert.deepEqual(review.result, calculateNetwork(document));
  assert.notEqual(review.document, document); assert.notEqual(review.result, calculateNetwork(document));
  assert.equal(reviewIsCurrent(undefined, document), false);
  assert.throws(() => checkNetwork(document, ""), /Prüfzeitpunkt/);
});

test("snapshot data is deep-copied and deep-frozen, never edited through the live document", () => {
  const document = createDefaultNetwork(), review = checkNetwork(document, stamp), power = review.result.totalPowerKW;
  assert.ok(Object.isFrozen(review) && Object.isFrozen(review.document) && Object.isFrozen(review.document.nodes));
  assert.ok(Object.isFrozen(review.document.nodes[0].values) && Object.isFrozen(review.result.edges[0].checks));
  document.nodes.find(node => node.kind === "load")!.values.power = "30";
  document.edges[0].values.area = "16"; document.name = "Änderung";
  assert.equal(review.result.totalPowerKW, power); assert.equal(review.document.name, "Neues Netzprojekt");
  assert.equal(review.document.edges[0].values.area, "2.5");
  assert.throws(() => { review.document.nodes[0].values.maxCurrent = "800"; }, TypeError);
  assert.throws(() => { review.result.edges[0].checks.push("gefälscht"); }, TypeError);
  assert.equal(reviewIsCurrent(review, document), false);
});

test("moving and changing orientation do not invalidate the physical check", () => {
  const document = createDefaultNetwork(), review = checkNetwork(document, stamp), changed = clone(document);
  changed.orientation = "vertical";
  changed.nodes.forEach((node, index) => { node.x = index * 50 - 40; node.y = 1000 + index * 250; });
  assert.equal(networkCalculationKey(changed), review.key);
  assert.equal(reviewIsCurrent(review, changed), true);
});

test("canonical keys ignore record and graph array order but retain the source reactance x", () => {
  const document = createDefaultNetwork(), changed = clone(document);
  changed.nodes.reverse(); changed.edges.reverse();
  changed.nodes.forEach(node => { node.values = Object.fromEntries(Object.entries(node.values).reverse()); });
  assert.equal(networkCalculationKey(document), networkCalculationKey(changed));
  changed.nodes.find(node => node.kind === "source")!.values.x = "0.1";
  assert.notEqual(networkCalculationKey(document), networkCalculationKey(changed), "only position x is excluded; source.values.x is physical");
});

test("cable, current, topology, labels and project name changes make the previous report stale", () => {
  const document = createDefaultNetwork(), review = checkNetwork(document, stamp);
  const modifications: ((doc: NetworkDocument) => void)[] = [
    doc => { doc.edges[0].values.length = "40"; },
    doc => { doc.edges[0].values.area = "16"; },
    doc => { doc.nodes[0].values.maxCurrent = "125"; },
    doc => { doc.nodes.find(node => node.kind === "load")!.values.power = "10"; },
    doc => { doc.edges[0].to = "load"; },
    doc => { doc.edges.push(createNetworkEdge("new", "source", "load")); },
    doc => { doc.nodes[0].label = "Einspeisung Süd"; },
    doc => { doc.name = "Projekt Süd"; },
  ];
  for (const modify of modifications) { const changed = clone(document); modify(changed); assert.equal(reviewIsCurrent(review, changed), false); }
  assert.equal(reviewIsCurrent({ ...review, revision: "older-model" }, document), false);
  const tamperedSnapshot = clone(review); tamperedSnapshot.document.nodes[0].values.maxCurrent = "630";
  assert.equal(reviewIsCurrent(tamperedSnapshot, document), false, "matching key string cannot hide a changed snapshot");
});

test("a checked invalid graph stays current as a failed report without zero-valued numerical results", () => {
  const document = createDefaultNetwork(); document.edges = [];
  const review = checkNetwork(document, stamp);
  assert.equal(review.result.valid, false); assert.equal(reviewIsCurrent(review, document), true);
  const report = networkReviewPDF(review);
  assert.match(report.status, /Nicht berechenbar/); assert.ok(!report.status.includes("entspricht NIN"));
  assert.ok(report.results.length >= 1);
  assert.ok(report.results.some(row => String(row.value).includes("Keine Leitungsverbindungen")));
  assert.ok(!report.results.some(row => /Aussenleiter|Spannungsfall|Verbraucherleistung|Ik,max|Ik,min/.test(row.label)));
  assert.ok(report.results.every(row => typeof row.value !== "number"));
  assert.ok(!report.results.some(row => /(^|\s)0\s*(A|kW|V|%|kA)/.test(String(row.value))));
  assert.match(report.formula, /Keine numerischen Ergebnisse/);
  assert.ok(report.notes?.some(note => note.includes("keine vollständige NIN-Konformitätserklärung")));
});

test("current overloaded checks export actual failed values and their causes rather than an approval", () => {
  const document = createDefaultNetwork(); document.nodes[0].values.maxCurrent = "6";
  const review = checkNetwork(document, stamp), report = networkReviewPDF(review, { id: "project-id", number: "1498", name: "Schulhaus" });
  assert.equal(review.result.valid, true); assert.equal(review.result.tone, "error");
  assert.match(report.title, /Prüfbericht · Netzplaner/); assert.match(report.norm, /NIN 2025/);
  assert.match(report.status, /Bedingung ist verletzt/);
  assert.ok(report.results.some(row => String(row.value).includes("Anschlussstrom überschritten")));
  assert.ok(report.results.some(row => row.label.includes("Stärkster Aussenleiter") && String(row.value).endsWith(" A")));
  assert.ok(report.inputs.some(row => row.label === "Projekt" && row.value === "1498 · Schulhaus"));
  assert.ok(report.inputs.some(row => row.label === "Projekt-ID" && row.value === "project-id"));
  assert.ok(report.inputs.some(row => row.label.includes("Prüfzeitpunkt") && String(row.value).includes("11:30:00")), "Swiss time must be CET for this check time");
  for (const edge of document.edges) assert.ok(report.inputs.some(row => row.label.includes(`[${edge.id}]`) && row.label.includes("Leitungslänge")));
  assert.ok(report.formula.includes("I_L1/L2/L3"));
});

test("PDF uses the frozen check values after live edits and lists every current field", () => {
  const document = createDefaultNetwork(), review = checkNetwork(document, stamp);
  document.nodes[0].values.maxCurrent = "800"; document.edges[0].values.length = "999";
  const report = networkReviewPDF(review);
  assert.ok(report.inputs.some(row => row.label.includes("Anschlussstrom") && row.value === "160 A"));
  assert.ok(report.inputs.some(row => row.label.includes("[line-1]") && row.label.includes("Leitungslänge") && row.value === "25 m"));
  assert.ok(!report.inputs.some(row => row.value === "999 m" || row.value === "800 A"));
  for (const node of review.document.nodes) for (const key of Object.keys(node.values)) {
    const rows = report.inputs.filter(row => row.label.includes(`[${node.id}]`));
    assert.ok(rows.length >= Object.keys(node.values).length, `${node.id}/${key}: fields must not disappear from the checked snapshot`);
  }
});

test("missing or malformed stored results produce an explicit nonnumeric failed report", () => {
  const review = checkNetwork(createDefaultNetwork(), stamp);
  const missing = { ...review, result: undefined } as unknown as NetworkReview;
  assert.equal(reviewIsCurrent(missing, createDefaultNetwork()), false);
  const missingReport = networkReviewPDF(missing);
  assert.match(missingReport.status, /Prüfergebnis fehlt/); assert.ok(missingReport.results.length >= 1);
  assert.ok(missingReport.results.every(row => typeof row.value !== "number"));
  const malformed = clone(review); malformed.result.maxDropPercent = Infinity;
  const malformedReport = networkReviewPDF(malformed);
  assert.match(malformedReport.status, /Nicht berechenbar/);
  assert.ok(!JSON.stringify(malformedReport).includes("Infinity"));
  const corruptEdge = clone(review); corruptEdge.result.edges[0].currents = undefined as unknown as [number, number, number];
  assert.match(networkReviewPDF(corruptEdge).status, /Nicht berechenbar/);
  const unchecked = networkReviewPDF(undefined);
  assert.match(unchecked.status, /Nicht geprüft/); assert.ok(unchecked.results.length >= 1);
});

test("input omissions and unknown element types remain printable in a failed check", () => {
  const document = createDefaultNetwork(); document.nodes[0].values.r = "";
  const review = checkNetwork(document, stamp), report = networkReviewPDF(review);
  assert.equal(review.result.valid, false);
  assert.ok(report.inputs.some(row => row.label.includes("Quellwiderstand") && row.value === "Leer – nicht eingegeben"));
  const unknown = createDefaultNetwork(); unknown.nodes.push({ ...createNetworkNode("load", "unknown", 0, 0), kind: "__proto__" } as unknown as typeof unknown.nodes[number]);
  assert.doesNotThrow(() => networkReviewPDF(checkNetwork(unknown, stamp)));
});
