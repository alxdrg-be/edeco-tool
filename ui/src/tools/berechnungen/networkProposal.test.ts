import assert from "node:assert/strict";
import test from "node:test";
import { calculateNetwork, createDefaultNetwork, createNetworkEdge, createNetworkNode } from "./networkModel.ts";
import { networkSkeleton, nextStandardRating, proposeNetworkRatings } from "./networkProposal.ts";
import type { NetworkDocument } from "./networkTypes.ts";

test("the recommended rating is the smallest listed current that covers the same model current", () => {
  const doc = createDefaultNetwork();
  const result = calculateNetwork(doc);
  const proposal = proposeNetworkRatings(doc);
  const source = proposal.document.nodes.find(node => node.kind === "source")!;
  const protection = proposal.document.nodes.find(node => node.kind === "protection")!;
  assert.equal(source.values.maxCurrent, nextStandardRating(result.maxCurrent));
  assert.equal(protection.values.rated, "13");
  assert.equal(protection.values.curve, "B");
  assert.equal(protection.label, "LS B13");
  assert.equal(doc.edges[0].values.area, proposal.document.edges[0].values.area);
  assert.equal(doc.nodes.find(node => node.kind === "load")!.values.power, "6.9");
  assert.match(proposal.notes[0], /kein NIN-Nachweis/);
});

test("two single-phase loads on one conductor add, loads on different conductors do not", () => {
  function pair(phaseA: string, phaseB: string): NetworkDocument {
    const source = createNetworkNode("source", "s", 0, 0);
    Object.assign(source.values, { phases: "3", voltage: "400", sourceMode: "ideal", loopKnown: "yes", loopImpedance: "0.04" });
    const uv = createNetworkNode("distribution", "uv", 0, 0);
    uv.label = "UV Wohnung";
    const a = createNetworkNode("load", "a", 0, 0), b = createNetworkNode("load", "b", 0, 0);
    Object.assign(a.values, { power: "2.3", cosPhi: "1", phases: "1", phase: phaseA, diversity: "1" });
    Object.assign(b.values, { power: "2.3", cosPhi: "1", phases: "1", phase: phaseB, diversity: "1" });
    const edges = [createNetworkEdge("su", "s", "uv"), createNetworkEdge("ua", "uv", "a"), createNetworkEdge("ub", "uv", "b")];
    for (const edge of edges) edge.values.iz = "40";
    return { version: 1, name: "Phasen", nodes: [source, uv, a, b], edges };
  }
  const same = pair("L1", "L1"), split = pair("L1", "L2");
  assert.equal(proposeNetworkRatings(same).document.nodes[1].values.rated, nextStandardRating(calculateNetwork(same).maxCurrent));
  assert.equal(proposeNetworkRatings(split).document.nodes[1].values.rated, "10");
  assert.equal(proposeNetworkRatings(same).document.nodes[1].label, "UV Wohnung");
  assert.ok(calculateNetwork(same).maxCurrent > calculateNetwork(split).maxCurrent);
});

test("a skeleton keeps lengths and known power and clears invented sizing", () => {
  const bare = networkSkeleton(createDefaultNetwork());
  assert.equal(bare.nodes.find(node => node.kind === "source")!.values.maxCurrent, "");
  assert.equal(bare.nodes.find(node => node.kind === "source")!.values.r, "");
  assert.equal(bare.nodes.find(node => node.kind === "source")!.values.loopKnown, "no");
  assert.equal(bare.nodes.find(node => node.kind === "protection")!.values.rated, "");
  assert.equal(bare.nodes.find(node => node.kind === "protection")!.values.curve, "B");
  assert.equal(bare.nodes.find(node => node.kind === "load")!.values.power, "6.9");
  assert.equal(bare.edges[0].values.length, "25");
  assert.equal(bare.edges[0].values.area, "");
  assert.equal(bare.edges[0].values.izMode, "open");
  const proposal = proposeNetworkRatings(bare);
  assert.equal(proposal.document.nodes.find(node => node.kind === "protection")!.values.rated, "13");
  assert.equal(proposal.document.edges[0].values.area, "");
  assert.equal(proposal.document.edges[0].values.length, "25");
});

test("a load without power blocks the rating in front of it", () => {
  const doc = createDefaultNetwork();
  doc.nodes.find(node => node.kind === "load")!.values.power = "";
  const proposal = proposeNetworkRatings(doc);
  assert.equal(proposal.changes.length, 0);
  assert.equal(proposal.document.nodes.find(node => node.kind === "protection")!.values.rated, "16");
  assert.match(proposal.notes.join(" "), /Leistung/);
});
