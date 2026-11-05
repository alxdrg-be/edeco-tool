import assert from "node:assert/strict";
import test from "node:test";
import { CALCULATORS } from "./definitions.ts";
import { WORKBENCH_CATALOG } from "./catalog.ts";
import { defaults, validateResult } from "./types.ts";

test("every registered native workbench has a working finite example and unique field keys", () => {
  assert.equal(CALCULATORS.length, 26);
  assert.deepEqual(CALCULATORS.map(item => item.id).sort(), WORKBENCH_CATALOG.map(item => item[0]).sort());
  for (const definition of CALCULATORS) {
    assert.match(definition.source, /^(https:\/\/www\.elektro-rechner\.ch\/|edeco-arbeitsblatt:)/);
    assert.equal(new Set(definition.fields.map(field => field.key)).size, definition.fields.length, definition.id);
    const result = validateResult(definition.calculate(defaults(definition)));
    assert.ok(result.metrics.length >= 2, definition.id);
    assert.ok(result.formula && result.limitations.length && definition.scope, definition.id);
    assert.doesNotThrow(() => JSON.stringify(result));
  }
});

test("non-finite results cannot be saved or exported by the common workbench", () => {
  const result = CALCULATORS[0].calculate(defaults(CALCULATORS[0]));
  result.metrics[0].value = Infinity;
  assert.throws(() => validateResult(result), /Rechenergebnis/);
});
