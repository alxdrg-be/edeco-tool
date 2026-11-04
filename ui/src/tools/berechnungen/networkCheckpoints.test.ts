import test from "node:test";
import assert from "node:assert/strict";
import { calculateNetwork, createDefaultNetwork } from "./networkModel.ts";
import { buildNetworkCheckpoints, summarizeNetworkCheckpoints } from "./networkCheckpoints.ts";

test("eleven checkpoint rows distinguish calculated model conditions from unimplemented proofs", () => {
  const document = createDefaultNetwork(), result = calculateNetwork(document);
  const rows = buildNetworkCheckpoints(document, result);
  assert.equal(rows.length, 11);
  assert.equal(new Set(rows.map(row => row.id)).size, 11);
  assert.equal(rows.find(row => row.id === "conductors")!.status, "passed");
  assert.equal(rows.find(row => row.id === "voltage-drop")!.status, "passed");
  for (const id of ["inductance", "pen", "coordination", "disconnection", "cable-short-circuit", "rcd-sockets"]) {
    const row = rows.find(row => row.id === id)!;
    assert.equal(row.status, "open", id); assert.ok(row.required);
  }
  assert.equal(summarizeNetworkCheckpoints(rows).status, "open");
});

test("actual overload and path-drop failures attach the original exact-object issues", () => {
  const document = createDefaultNetwork(); document.edges.at(-1)!.values.iz = "15";
  document.nodes.find(node => node.kind === "source")!.values.limit = "0.1";
  const result = calculateNetwork(document), rows = buildNetworkCheckpoints(document, result);
  const overload = rows.find(row => row.id === "overcurrent")!, drop = rows.find(row => row.id === "voltage-drop")!;
  assert.equal(overload.status, "failed"); assert.equal(drop.status, "failed");
  assert.ok(overload.issues.some(issue => issue.code === "in_iz" && issue.edgeId === document.edges.at(-1)!.id));
  assert.ok(overload.issues.every(issue => result.issues.includes(issue)));
  assert.equal(summarizeNetworkCheckpoints(rows).status, "failed");
});

test("invalid or empty networks never create passed checkpoints from absent numerical data", () => {
  const document = { version: 1 as const, name: "Leer", nodes: [], edges: [] };
  const rows = buildNetworkCheckpoints(document, calculateNetwork(document));
  assert.ok(rows.every(row => row.status !== "passed"));
  assert.equal(rows.find(row => row.id === "conductors")!.status, "failed");
});

test("a socket and a recorded30mA RCD still require applicability, time and earthing proof", () => {
  const document = createDefaultNetwork();
  document.nodes.find(node => node.kind === "load")!.values.device = "socket";
  Object.assign(document.nodes.find(node => node.kind === "protection")!.values, { device: "RCBO", tripCurrent: "30" });
  const rows = buildNetworkCheckpoints(document, calculateNetwork(document)), row = rows.find(row => row.id === "rcd-sockets")!;
  assert.equal(row.status, "open"); assert.match(row.summary, /^1 Steckdosen/);
  assert.ok(row.issues.some(issue => issue.code === "rcd_proof"));
});

test("NH does not inherit a passing Icn check from LS-only model support", () => {
  const document = createDefaultNetwork(); document.nodes.find(node => node.kind === "protection")!.values.device = "NH";
  const rows = buildNetworkCheckpoints(document, calculateNetwork(document));
  assert.equal(rows.find(row => row.id === "breaking")!.status, "open");
});

test("checkpoint presentation does not change inputs or numerical results", () => {
  const document = createDefaultNetwork(), result = calculateNetwork(document), before = JSON.stringify({ document, result });
  buildNetworkCheckpoints(document, result);
  assert.equal(JSON.stringify({ document, result }), before);
});
