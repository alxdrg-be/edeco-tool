import assert from "node:assert/strict";
import test from "node:test";
import { calculateCable, type CableInput } from "./engineering.ts";
const base: CableInput = { phases: "1", material: "cu", length: "25", current: "16", area: "2.5", cosPhi: "1", voltage: "230", limit: "4" };
test("Swiss reference: R20 corrected to 55 degrees, full reactive formula", () => {
  const r = calculateCable(base);
  assert.ok(Math.abs(r.r55 - 7.41 * (1 + .00393 * 35)) < 1e-12);
  assert.ok(Math.abs(r.deltaU - 2 * 25 * 16 * 7.41 * (1 + .00393 * 35) / 1000) < 1e-12);
  assert.equal(r.temperature, 55); assert.equal(r.x, .110);
  const three = calculateCable({ ...base, phases: "3", voltage: "400", length: "80", current: "32", area: "10", cosPhi: "0.85" });
  const expected = Math.sqrt(3) * 80 * 32 * (1.83 * (1+.00393*35) * .85 + .100 * Math.sqrt(1-.85**2)) / 1000;
  assert.ok(Math.abs(three.deltaU - expected) < 1e-12);
});
test("budget-only recommendation includes reactance and Al table limits", () => {
  const r = calculateCable({ ...base, length: "60", cosPhi: "0,85" });
  assert.equal(r.withinBudget, false); assert.ok(r.recommendedArea && r.recommendedArea > 2.5);
  const candidate = calculateCable({ ...base, length: "60", cosPhi: "0.85", area: String(r.recommendedArea) });
  assert.equal(candidate.withinBudget, true);
  const al = calculateCable({ ...base, material: "al", area: "10" });
  assert.equal(al.r20, 3.08);
  assert.throws(() => calculateCable({ ...base, material: "al" }), /ab 10/);
});
test("bad inputs, unsupported sections and physically invalid model results stay blocked", () => {
  for (const patch of [{ length: "" }, { current: "-1" }, { current: "Infinity" }, { area: "3" }, { area: "0" }, { cosPhi: "0" }, { cosPhi: "1.1" }, { voltage: "0" }, { limit: "0" }, { length: "100000", current: "10000" }]) assert.throws(() => calculateCable({ ...base, ...patch }));
});
