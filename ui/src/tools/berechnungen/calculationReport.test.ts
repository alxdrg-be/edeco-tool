import assert from "node:assert/strict";
import test from "node:test";
import { workbenchReport, CALCULATION_NORMS } from "./calculationReport.ts";
import { CALCULATORS } from "./workbench/definitions.ts";
import { defaults } from "./workbench/types.ts";

test("a calculation report contains the current result and only applicable mode inputs", () => {
  const definition = CALCULATORS.find(item => item.id === "ohmsches-gesetz")!;
  const input = { ...defaults(definition), system: "dc", known: "ui", voltage: "48", current: "2", power: "999999", impedance: "999999", cos: "" };
  const report = workbenchReport(definition, input, definition.calculate(input), "Motorraum prüfen", { number: "1498", name: "Schulhaus" });
  assert.equal(report.inputs.some(item => /cos|Wirkleistung|R \/ /.test(item.label)), false);
  assert.ok(report.results.some(item => item.value === "96 W"));
  assert.ok(report.results.some(item => item.value === "24 Ω"));
  assert.ok(report.notes.includes("Projektnotizen: Motorraum prüfen"));
  assert.ok(report.inputs.some(item => item.label === "Projekt" && item.value === "1498 · Schulhaus"));
  assert.ok(!JSON.stringify(report).includes("999999"));
});

test("every workbench report carries an explicit normative reference or planning assumption", () => {
  for (const definition of CALCULATORS) {
    const input = defaults(definition), report = workbenchReport(definition, input, definition.calculate(input));
    assert.ok(CALCULATION_NORMS[definition.id], definition.id);
    assert.ok(report.formula && report.status && report.inputs.length && report.results.length, definition.id);
    assert.ok(report.notes.length, definition.id);
  }
});

test("dynamic fire comparison reports both actual cable lists with distinct before/after context", () => {
  const definition = CALCULATORS.find(item => item.id === "premium-brandlast")!;
  const input = { ...defaults(definition), fireloadRows: JSON.stringify([{ id: "before", name: "Kabel X", mjPerMeter: "2", quantity: "7", length: "10", evidence: "open" }]), fireloadRowsAfter: JSON.stringify([{ id: "after", name: "Kabel X", mjPerMeter: "1", quantity: "3", length: "10", evidence: "documented" }]) };
  const report = workbenchReport(definition, input, definition.calculate(input));
  assert.ok(report.inputs.some(row => row.label === "Vorher · Kabel X · Bestand" && row.value === "7 × 10 m · 2 MJ/m"));
  assert.ok(report.inputs.some(row => row.label === "Nachher · Kabel X · Bestand" && row.value === "3 × 10 m · 1 MJ/m"));
  assert.ok(report.inputs.every(row => !row.value.startsWith("[{")));
  assert.ok(report.results.some(row => row.label === "Kabel vorher" && row.value === "7 Stk."));
});
