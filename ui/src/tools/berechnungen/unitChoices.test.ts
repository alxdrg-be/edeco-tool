import assert from "node:assert/strict";
import { test } from "node:test";
import { toBaseUnit, unitChoices } from "./unitChoices.ts";

const close = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) <= Math.abs(b) * 1e-12, `${a} != ${b}`);

test("prefixed units convert into the field's base unit", () => {
  close(toBaseUnit(230, "V", "V"), 230);
  close(toBaseUnit(30, "A", "mA"), 0.03);
  close(toBaseUnit(2.5, "W", "kW"), 2500);
  close(toBaseUnit(500, "kW", "W"), 0.5);
  close(toBaseUnit(470, "µF", "nF"), 0.47);
  close(toBaseUnit(1.2, "s", "min"), 72);
  close(toBaseUnit(30, "h", "min"), 0.5);
  close(toBaseUnit(15, "Ω", "mΩ"), 0.015);
});

test("unknown or fixed units stay as they are", () => {
  assert.deepEqual(unitChoices("mm²"), [{ unit: "mm²", factor: 1 }]);
  assert.equal(toBaseUnit(1, "V", "A"), null);
  assert.ok(unitChoices("V")[0].unit === "V" && unitChoices("kW")[0].unit === "kW", "the base unit comes first");
});
