import assert from "node:assert/strict";
import test from "node:test";
import { calculateNetwork, createDefaultNetwork, createNetworkEdge, createNetworkNode } from "./networkModel.ts";
import { networkHistory, networkHistoryReducer } from "./networkEditor.ts";
import { checkNetwork, reviewIsCurrent } from "./networkReview.ts";
import { buildNetworkCheckpoints } from "./networkCheckpoints.ts";
import { applyNetworkVariant, networkVariantFields, networkVariantIsCurrent, previewNetworkVariant } from "./networkVariants.ts";

test("variant recalculates the whole branched network without changing the original or another same-labelled line", () => {
  const document = createDefaultNetwork();
  const secondLoad = createNetworkNode("load", "second-load");
  secondLoad.label = document.nodes[3].label;
  document.nodes.push(secondLoad);
  document.edges.push(createNetworkEdge("second-line", "ls", secondLoad.id));
  const original = structuredClone(document);
  const preview = previewNetworkVariant(document, { kind: "edge", id: "line-3", field: "area", value: "10" });
  assert.deepEqual(document, original);
  assert.equal(preview.afterDocument.edges.find(edge => edge.id === "line-3")?.values.area, "10");
  assert.equal(preview.afterDocument.edges.find(edge => edge.id === "second-line")?.values.area, original.edges.find(edge => edge.id === "second-line")?.values.area);
  assert.equal(preview.after.edges.length, document.edges.length);
  assert.deepEqual(preview.after, calculateNetwork(preview.afterDocument));
  assert.notEqual(preview.after.edges.find(edge => edge.id === "line-3")?.cumulativeDropPercent, preview.before.edges.find(edge => edge.id === "line-3")?.cumulativeDropPercent);
  preview.afterDocument.edges[0].values.length = "99";
  assert.deepEqual(document, original);
});

test("proof fields and unsupported device changes cannot be manufactured through a variant", () => {
  const document = createDefaultNetwork();
  assert.throws(() => previewNetworkVariant(document, { kind: "edge", id: "line-3", field: "iz", value: "1000" }));
  assert.throws(() => previewNetworkVariant(document, { kind: "node", id: "source", field: "loopKnown", value: "yes" }));
  assert.throws(() => previewNetworkVariant(document, { kind: "node", id: "ls", field: "i2factor", value: "1" }));
  assert.throws(() => previewNetworkVariant(document, { kind: "node", id: "ls", field: "curve", value: "invented" }));
  assert.throws(() => previewNetworkVariant(document, { kind: "edge", id: "missing", field: "area", value: "10" }));
  assert.deepEqual(networkVariantFields(document, { kind: "node", id: "source" }), []);
});

test("an invalid candidate remains a preview and cannot enter the current network", () => {
  const document = createDefaultNetwork(), original = structuredClone(document);
  const preview = previewNetworkVariant(document, { kind: "edge", id: "line-3", field: "length", value: "not-a-number" });
  assert.equal(preview.after.valid, false);
  assert.throws(() => applyNetworkVariant(document, preview), /ungültige Eingaben/);
  assert.deepEqual(document, original);
});

test("any changed network input invalidates an old preview and preserves later edits", () => {
  const document = createDefaultNetwork();
  const preview = previewNetworkVariant(document, { kind: "edge", id: "line-3", field: "area", value: "10" });
  const changed = structuredClone(document);
  changed.nodes[3].values.power = "9";
  assert.equal(networkVariantIsCurrent(changed, preview), false);
  assert.throws(() => applyNetworkVariant(changed, preview), /erneut prüfen/);
  assert.equal(changed.nodes[3].values.power, "9");
  assert.equal(changed.edges[2].values.area, document.edges[2].values.area);
});

test("applying a current preview retains canvas moves and produces one undoable change with a new review", () => {
  const document = createDefaultNetwork();
  const preview = previewNetworkVariant(document, { kind: "edge", id: "line-3", field: "area", value: "10" });
  const moved = structuredClone(document);
  moved.nodes[2].x = 2000;
  moved.orientation = "vertical";
  assert.equal(networkVariantIsCurrent(moved, preview), true);
  const candidate = applyNetworkVariant(moved, preview);
  assert.equal(candidate.nodes[2].x, 2000);
  assert.equal(candidate.orientation, "vertical");
  let history = networkHistory(moved);
  history = networkHistoryReducer(history, { type: "commit", document: candidate });
  const review = checkNetwork(history.present);
  assert.equal(reviewIsCurrent(review, history.present), true);
  history = networkHistoryReducer(history, { type: "undo" });
  assert.deepEqual(history.present, moved);
  assert.equal(reviewIsCurrent(review, history.present), false);
  history = networkHistoryReducer(history, { type: "redo" });
  assert.deepEqual(history.present, candidate);
});

test("a characteristic trial does not invent missing loop data or manufacturer proofs", () => {
  const document = createDefaultNetwork();
  document.nodes[2].values.curve = "C";
  const preview = previewNetworkVariant(document, { kind: "node", id: "ls", field: "curve", value: "B" });
  assert.equal(document.nodes[2].values.curve, "C");
  assert.equal(preview.afterDocument.nodes[2].values.curve, "B");
  assert.ok(preview.after.issues.some(issue => issue.code === "loop_open"));
  const checkpoints = buildNetworkCheckpoints(preview.afterDocument, preview.after);
  assert.equal(checkpoints.find(check => check.id === "coordination")?.status, "open");
  assert.equal(checkpoints.find(check => check.id === "disconnection")?.status, "open");
});
