import assert from "node:assert/strict";
import test from "node:test";
import { calculateCable } from "./engineering.ts";
import { calculateNetwork, createNetworkEdge, createNetworkNode } from "./networkModel.ts";
import type { NetworkDocument } from "./networkTypes.ts";

/**
 * Observed outputs of Electrosuisse "NIN 2025 Anlagenplanung" (reports printed
 * 05.11.2026, projects «Schreinerei mit Wohnung» and «Umbau Wohnhaus», Ub 420 V).
 * Only printed results are used; no program code or catalogue data is copied.
 * Findings: the program computes the voltage drop with conductors at 20 °C and
 * Ik,min with Ub/√3 (242.5 V) and conductors at 80 °C, without c_min.
 */

// Schreinerei: drop of one branch plus the printed upstream drop.
const drops: { name: string; phases: "1" | "3"; length: string; area: string; current: string; upstream: number; nin: number }[] = [
  { name: "Licht 15 m 1.5 mm²", phases: "1", length: "15", area: "1.5", current: "13", upstream: .17, nin: 2.22 },
  { name: "Licht 10 m 1.5 mm²", phases: "1", length: "10", area: "1.5", current: "13", upstream: .17, nin: 1.54 },
  { name: "Licht 8 m 1.5 mm²", phases: "1", length: "8", area: "1.5", current: "13", upstream: .17, nin: 1.26 },
  { name: "8.1 m 5x10 mm²", phases: "3", length: "8.1", area: "10", current: "27.4", upstream: .25, nin: .42 },
  { name: "9 m 5x6 mm²", phases: "3", length: "9", area: "6", current: "14.4", upstream: .25, nin: .42 },
  { name: "8.3 m 5x4 mm²", phases: "3", length: "8.3", area: "4", current: "16.5", upstream: .25, nin: .52 },
];
const drop = (row: typeof drops[number], basis: "iec" | "nin-program") => row.upstream + calculateCable({
  phases: row.phases, material: "cu", length: row.length, current: row.current, area: row.area, cosPhi: "1",
  voltage: row.phases === "1" ? "230" : "400", limit: "4", basis,
}).percent;

test("voltage drop: basis «Wie NIN-Programm» reproduces the printed NIN values", () => {
  for (const row of drops) assert.ok(Math.abs(drop(row, "nin-program") - row.nin) <= .011, `${row.name}: ${drop(row, "nin-program")} ≠ ${row.nin}`);
});
test("voltage drop: the conservative basis never shows a smaller drop than the NIN program", () => {
  for (const row of drops) assert.ok(drop(row, "iec") >= row.nin - .005, row.name);
});

// Umbau Wohnhaus: Ik,min 9048 A at the supply point; same physical source loop for both bases.
const SOURCE_LOOP = 420 / Math.sqrt(3) / 9048;
function ikMin(segments: [number, number][], basis: "iec" | "nin-program" | undefined): number {
  const source = createNetworkNode("source", "s", 0, 0);
  Object.assign(source.values, { phases: "3", voltage: "400", sourceMode: "ideal", loopKnown: "yes", loopImpedance: String(SOURCE_LOOP), calcBasis: basis, operatingVoltage: "420" });
  if (basis === undefined) delete source.values.calcBasis;
  const doc: NetworkDocument = { version: 1, name: "Umbau Wohnhaus", nodes: [source], edges: [] };
  let previous = source.id;
  segments.forEach(([length, area], index) => {
    const last = index === segments.length - 1, node = createNetworkNode(last ? "load" : "distribution", `n${index}`, 100 * (index + 1), 0);
    if (last) Object.assign(node.values, { phases: "1", phase: "L1", power: "1" });
    const edge = createNetworkEdge(`e${index}`, previous, node.id);
    Object.assign(edge.values, { length: String(length), area: String(area), iz: "100" });
    doc.nodes.push(node); doc.edges.push(edge); previous = node.id;
  });
  const result = calculateNetwork(doc);
  assert.ok(result.valid, JSON.stringify(result.issues.slice(0, 2)));
  return result.edges.find(edge => edge.id === `e${segments.length - 1}`)!.ikMinKA! * 1000;
}
const main: [number, number][] = [[10, 10], [10, 10]];
const shortCircuits: [string, [number, number][], number][] = [
  ["nach 10 m 10 mm²", [main[0]], 3557], ["nach 2 × 10 m 10 mm²", main, 2150], ["Geschirrspüler 4 m 1.5 mm²", [...main, [4, 1.5]], 1033],
  ["D20 15 m 6 mm²", [...main, [15, 6]], 1118], ["C13 11 m 1.5 mm²", [...main, [11, 1.5]], 539], ["UV 7 m 2.5 mm²", [...main, [1, 6], [7, 2.5]], 984],
  ["UV 15 m 1.5 mm²", [...main, [1, 6], [15, 1.5]], 418], ["UV 20 m 1.5 mm²", [...main, [1, 6], [20, 1.5]], 330],
];

test("Ik,min: basis «Wie NIN-Programm» stays within 7 % of the NIN program", () => {
  // Residual: the source loop is added as a magnitude, not as a complex impedance.
  for (const [name, segments, nin] of shortCircuits) {
    const ours = ikMin(segments, "nin-program");
    assert.ok(Math.abs(ours / nin - 1) <= .07, `${name}: ${ours.toFixed(0)} A vs ${nin} A`);
  }
});
test("Ik,min: the conservative basis is always below the NIN program", () => {
  for (const [name, segments, nin] of shortCircuits) assert.ok(ikMin(segments, "iec") < nin, name);
});
test("saved networks without a basis keep the conservative calculation", () => {
  assert.equal(createNetworkNode("source", "s", 0, 0).values.calcBasis, "iec");
  for (const [, segments] of shortCircuits) assert.equal(ikMin(segments, undefined), ikMin(segments, "iec"));
});
