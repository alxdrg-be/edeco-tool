import assert from "node:assert/strict";
import test from "node:test";
import { calculateCable, type CableInput } from "./engineering.ts";
import { cableAssumptions, cableReport } from "./cableReport.ts";

const input: CableInput = { phases: "3", material: "cu", length: "45", current: "17.6", area: "4", cosPhi: "0.9", voltage: "400", limit: "4" };

test("cable report and saved assumptions follow the actual calculation basis", () => {
  for (const [basis, temperature] of [["iec", 55], ["nin-program", 20]] as const) {
    const values = { ...input, cosPhi: "0.9", basis };
    const result = calculateCable(values);
    const report = cableReport(values, result);
    const temperatureInput = report.inputs.find(item => item.label === "Leitertemperatur")!;
    assert.ok(temperatureInput.value.startsWith(`${temperature} °C`));
    assert.ok(report.formula?.includes(`θ = ${temperature} °C`));
    assert.equal(cableAssumptions(result.temperature).temperature, temperature);
    if (basis === "nin-program") {
      assert.equal(result.r55, result.r20);
      assert.ok(!JSON.stringify(report).includes("55 °C"));
      assert.ok(report.notes?.some(note => note.includes("ausgewählte Referenzfälle")));
    }
  }
});

test("a chosen voltage-drop budget remains a project value rather than a normative approval", () => {
  const values = { ...input, cosPhi: "0.9", limit: "3" };
  const report = cableReport(values, calculateCable(values));
  assert.equal(report.inputs.find(item => item.label === "Spannungsfall-Budget")?.value, "3 % · Projektvorgabe");
  assert.ok(report.notes?.some(note => note.includes("nicht nachgewiesen")));
});
