import assert from "node:assert/strict";
import test from "node:test";
import { calculateCable, type CableInput } from "./engineering.ts";
import { calculateEV, type EVInput } from "./ev-model.ts";
import { schemaState } from "./EVSchemaState.ts";

/**
 * Independent output fixtures from the actual downloaded public client calc()
 * functions, evaluated with valid inputs and a minimal DOM in an isolated VM.
 * Fetched 2026-11-01, sources and SHA-256:
 * https://www.elektro-rechner.ch/Rechner/spannungsfall.html
 * e223ae381c83941f31df88709372c669115c4ca0fe087ba5b9d342ade21adffa
 * https://www.elektro-rechner.ch/Rechner/e-mobility-rechner.html
 * 062263f11a64ee952bf34f3c723d076ab93cde2c8f799b61efa420772a96f074
 * Only observed values are retained; no provider implementation is included.
 */
test("cable: five actual reference outputs match for copper/aluminium, 1~/3~ and reactive drop", () => {
  const cases: { input: CableInput; du: string; percent: string; end: string; max: string; r: string }[] = [
    { input: { phases: "1", material: "cu", length: "25", current: "16", area: "2.5", cosPhi: "1", voltage: "230", limit: "4" }, du: "6.74", percent: "2.93", end: "223.3", max: "34.1", r: "8.429" },
    { input: { phases: "3", material: "cu", length: "80", current: "32", area: "10", cosPhi: "0.85", voltage: "400", limit: "4" }, du: "8.08", percent: "2.02", end: "391.9", max: "158.4", r: "2.082" },
    { input: { phases: "3", material: "al", length: "100", current: "63", area: "35", cosPhi: "0.9", voltage: "400", limit: "4" }, du: "10.15", percent: "2.54", end: "389.8", max: "157.6", r: "0.990" },
    { input: { phases: "1", material: "cu", length: "60", current: "16", area: "2.5", cosPhi: "0.85", voltage: "230", limit: "4" }, du: "13.87", percent: "6.03", end: "216.1", max: "39.8", r: "8.429" },
    { input: { phases: "3", material: "cu", length: "150", current: "250", area: "240", cosPhi: "0.8", voltage: "400", limit: "3" }, du: "7.38", percent: "1.84", end: "392.6", max: "243.9", r: "0.086" },
  ];
  for (const fixture of cases) {
    const r = calculateCable(fixture.input);
    assert.equal(r.deltaU.toFixed(2), fixture.du);
    assert.equal(r.percent.toFixed(2), fixture.percent);
    assert.equal(r.endVoltage.toFixed(1), fixture.end);
    assert.equal(r.maxLength.toFixed(1), fixture.max);
    assert.equal(r.r55.toFixed(3), fixture.r);
  }
});

const base: EVInput = { house: "160", grid: "125", reserve: "30", count: "10", power: "11", mode: "dynamic", diversity: "1" };
test("EV: comparable 3~ source cases match actual assigned kW, without copying unrelated SIA/phase logic", () => {
  const cases = [
    { input: base, perPoint: 8.085125168440815, allocated: 80.85125168440815 },
    { input: { ...base, house: "125", grid: "63", reserve: "20", count: "4" }, perPoint: 10.911920087683926, allocated: 43.647680350735705 },
    { input: { ...base, house: "125", grid: "63", reserve: "20", count: "4", mode: "none" as const }, perPoint: 11, allocated: 44 },
  ];
  for (const fixture of cases) {
    const r = calculateEV(fixture.input);
    assert.ok(Math.abs(r.perPoint - fixture.perPoint) < 1e-10);
    assert.ok(Math.abs(r.allocated - fixture.allocated) < 1e-10);
  }
});

test("EV: an exactly saturated managed budget stays yellow, not a false red from floating-point rounding", () => {
  const r = calculateEV(base);
  // The reference displays a red overload message with rounded '100%' in this exact saturation case.
  const state = schemaState({ houseKW: r.houseKW, reserveKW: 30, totalAssignedKW: r.allocated, gridKW: r.gridKW, gridAssignedKW: r.allocated, nominalPerPointKW: 11, assignedPerPointKW: r.perPoint, managed: true });
  assert.equal(state.house.tone, "normal");
  assert.equal(state.grid.tone, "limited");
  assert.equal(state.points.tone, "limited");
});

test("EV: switching away from static mode ignores an empty hidden planning factor", () => {
  assert.equal(calculateEV({ ...base, diversity: "" }).allocated, calculateEV(base).allocated);
  assert.equal(calculateEV({ ...base, mode: "none", diversity: "" }).allocated, 110);
  assert.throws(() => calculateEV({ ...base, mode: "static", diversity: "" }), /Planungsfaktor/);
});
