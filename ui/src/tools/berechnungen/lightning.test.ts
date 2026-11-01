import test from "node:test";
import assert from "node:assert/strict";
import { calculateLightning, type LightningInput } from "./lightning.ts";
const base: LightningInput = { protection: "III", perimeter: "60", length: "10", conductors: "4", clearance: "" };
test("published Swiss reference cases and separate minimum conductor count", () => {
  for (const [protection, perimeter, length, conductors, s, minimum] of [
    ["I", "20", "3", "2", .24, 2], ["II", "40", "5", "4", .3, 4],
    ["III", "60", "10", "4", .4, 4], ["III", "61", "10", "5", .33, 5],
    ["III", "10", "3", "2", .04, 2],
  ] as const) {
    const result = calculateLightning({ ...base, protection, perimeter, length, conductors });
    assert.equal(result.metres, s); assert.equal(result.minimum, minimum);
  }
  const tooFew = calculateLightning({ ...base, conductors: "2" });
  assert.equal(tooFew.metres, .8); assert.equal(tooFew.conductorOK, false);
});
test("exact centimetre rounding, decimal comma and clearance checks", () => {
  assert.equal(calculateLightning({ ...base, protection: "II", perimeter: "20", length: "4,5", conductors: "2" }).metres, .27);
  assert.equal(calculateLightning({ ...base, clearance: "0,4" }).clearanceOK, true);
  assert.equal(calculateLightning({ ...base, clearance: "0.399999" }).clearanceOK, false);
  assert.equal(calculateLightning(base).clearanceOK, null);
});
test("invalid, missing and nonfinite inputs never produce results", () => {
  for (const patch of [{ perimeter: "" }, { length: "-1" }, { length: "0" }, { length: "Infinity" }, { length: "1e4" }, { length: "100001" }, { conductors: "1" }, { conductors: "2.5" }, { clearance: "-1" }]) assert.throws(() => calculateLightning({ ...base, ...patch }));
});
