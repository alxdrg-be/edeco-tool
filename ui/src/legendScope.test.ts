import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LEGEND_SCOPE, toggleLegendFloor } from "./legendScope.ts";

test("first explicit floor choice filters the view; later toggles retain the user's presence choice", () => {
  const first = toggleLegendFloor(DEFAULT_LEGEND_SCOPE, 8, true);
  assert.deepEqual(first.plan_ids, [8]);
  assert.equal(first.only_present, true);
  const userChoice = { ...first, only_present: false };
  assert.deepEqual(toggleLegendFloor(userChoice, 10).plan_ids, [8, 10]);
  assert.equal(toggleLegendFloor(userChoice, 10).only_present, false);
  assert.deepEqual(toggleLegendFloor(userChoice, 8).plan_ids, []);
  assert.deepEqual(DEFAULT_LEGEND_SCOPE.plan_ids, []);
});
