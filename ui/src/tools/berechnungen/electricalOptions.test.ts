import assert from "node:assert/strict";
import test from "node:test";
import { HOUSE_CURRENT_VALUES, HOUSE_CURRENT_OPTIONS, GRID_CURRENT_VALUES, fieldOptions, optionsWithProjectValue } from "./electricalOptions.ts";

test("public reference house/grid device options are discrete and display computed 3~ power", () => {
  assert.deepEqual(HOUSE_CURRENT_VALUES, [63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800]);
  assert.deepEqual(GRID_CURRENT_VALUES, [25, 35, 50, 63, 80, 100, 125, 160]);
  assert.equal(HOUSE_CURRENT_OPTIONS[0].label, "63 A · 43.6 kW · 3~");
  assert.equal(fieldOptions("premium-pkw", "grid1")?.some(option => option.value === "63"), true);
  assert.equal(fieldOptions("ls-schalter", "icn")?.find(option => option.value === "6")?.label, "6 kA");
  assert.equal(fieldOptions("ls-schalter", "rated")?.some(option => option.value === "13"), true);
});

test("old nonstandard values are kept, while measured and continuous inputs remain free", () => {
  const options = optionsWithProjectValue(HOUSE_CURRENT_OPTIONS, "150");
  assert.deepEqual(options[0], { value: "150", label: "150 · gespeicherter Projektwert" });
  assert.equal(optionsWithProjectValue(HOUSE_CURRENT_OPTIONS, "160").length, HOUSE_CURRENT_OPTIONS.length);
  for (const [id, key] of [["ls-schalter", "load"], ["ls-schalter", "ikMin"], ["premium-selektivitaet", "ik1"], ["emobilitaet", "reserve"], ["strombelastbarkeit", "load"]]) assert.equal(fieldOptions(id, key), undefined);
  assert.deepEqual(fieldOptions("premium-pkw", "power1")?.map(option => option.value), ["11", "22"]);
});
