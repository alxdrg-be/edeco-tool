import assert from "node:assert/strict";
import test from "node:test";
import { schemaState } from "./EVSchemaState.ts";
const base = { houseKW: 100, reserveKW: 10, totalAssignedKW: 60, gridKW: 70, gridAssignedKW: 60, nominalPerPointKW: 11, assignedPerPointKW: 10, managed: true };
test("managed throttling is yellow while the upstream house remains within budget", () => {
  const result = schemaState(base);
  assert.equal(result.house.tone, "normal");
  assert.equal(result.grid.tone, "limited");
  assert.equal(result.points.tone, "limited");
});
test("only the exceeded budgets turn red, independent of a neighbouring grid", () => {
  const houseOnly = schemaState({ ...base, totalAssignedKW: 95, managed: false, assignedPerPointKW: 11 });
  assert.equal(houseOnly.house.tone, "error");
  assert.equal(houseOnly.grid.tone, "normal");
  assert.equal(houseOnly.points.tone, "normal");
  const gridOnly = schemaState({ ...base, gridKW: 50, managed: false, assignedPerPointKW: 11 });
  assert.equal(gridOnly.house.tone, "normal");
  assert.equal(gridOnly.grid.tone, "error");
});
test("normal rated allocation and invalid inputs have distinct unambiguous states", () => {
  assert.equal(schemaState({ ...base, assignedPerPointKW: 11 }).grid.tone, "normal");
  assert.equal(schemaState(null).grid.tone, "unknown");
  assert.equal(schemaState({ ...base, houseKW: NaN }).house.tone, "unknown");
});
