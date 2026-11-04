import assert from "node:assert/strict";
import test from "node:test";
import { WORKBENCH_CATALOG } from "./workbench/catalog.ts";
import { CALCULATOR_PURPOSE, calculatorPurpose } from "./purpose.ts";

test("every calculator page explains what it is for and what you need", () => {
  const ids = [...WORKBENCH_CATALOG.map(item => item[0]), "netzplaner", "kabelberechnung", "emobilitaet", "blitzschutz"];
  for (const id of ids) {
    const purpose = calculatorPurpose(id);
    assert.ok(purpose, `Erklärung fehlt: ${id}`);
    assert.ok(purpose.use.length > 20 && purpose.needs.length > 10, id);
    assert.doesNotMatch(`${purpose.use} ${purpose.needs}`, /[–—]/, `Gedankenstrich in ${id}`);
  }
  assert.equal(calculatorPurpose(undefined), undefined);
  assert.equal(calculatorPurpose("unbekannt"), undefined);
  assert.ok(Object.keys(CALCULATOR_PURPOSE).length >= ids.length);
});
