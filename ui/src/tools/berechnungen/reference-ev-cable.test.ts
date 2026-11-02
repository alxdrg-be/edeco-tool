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

test("EV: recorded static station counts and dynamic waiting state match the public reference cases", () => {
  const fixed = calculateEV({ ...base, count: "3", mode: "static", diversity: "0.5" });
  assert.equal(fixed.activeCount, 2);
  assert.equal(fixed.waitingCount, 1);
  assert.equal(fixed.allocated, 22);
  const dynamic = calculateEV({ ...base, house: "63", grid: "63", reserve: "10", minimumPower: "3.7" });
  assert.equal(dynamic.activeCount, 9);
  assert.equal(dynamic.waitingCount, 1);
  assert.ok(Math.abs(dynamic.perPoint - 3.738631150081745) < 1e-10);
  const singlePhase = calculateEV({ ...base, house: "125", grid: "63", reserve: "20", count: "4", power: "7.4", mode: "none" });
  assert.equal(singlePhase.allocated, 29.6);
  assert.equal(singlePhase.capacityOK, false);
  assert.ok(singlePhase.strongestPhaseCurrent > 63);
});

// Public class-curve asset fetched2026-11-02, SHA256
// 465e106df91db517a74bb1a954fa3b02be2af3d11ad5ccdb8d03bdb43c5d0765.
// Reference curves are observed program behaviour, not a verified licensed norm table.
test("EV: recorded public class curves and DC equivalent match their active-station results", () => {
  const residents = calculateEV({ ...base, mode: "static", factorMode: "reference", userClass: "residents" });
  assert.equal(residents.appliedFactor.toFixed(2), "0.32");
  assert.equal(residents.activeCount, 4);
  assert.equal(residents.waitingCount, 6);
  assert.equal(residents.allocated, 44);
  const visitors = calculateEV({ ...base, count: "5", mode: "static", factorMode: "reference", userClass: "visitors" });
  assert.equal(visitors.appliedFactor.toFixed(2), "0.51");
  assert.equal(visitors.activeCount, 3);
  assert.equal(visitors.allocated, 33);
  const transit = calculateEV({ ...base, house: "800", grid: "160", count: "20", power: "350", mode: "static", factorMode: "reference", userClass: "transit" });
  assert.equal(transit.appliedFactor.toFixed(2), "0.63");
  assert.equal(transit.activeCount, 13);
  assert.equal(transit.perPoint.toFixed(2), "8.53");
  assert.equal(transit.energyPerDay.toFixed(1), "1108.5");
});

test("EV: observed PV/storage connection cases match power, daily energy and ideal range", () => {
  const common = { ...base, hours: "10", consumption: "18", pv: "20", battery: "40" };
  const house = calculateEV({ ...common, sourceConnection: "house" });
  assert.equal(house.perPoint.toFixed(2), "8.66");
  assert.equal(house.energyPerDay.toFixed(1), "866.0");
  assert.equal(house.energyPerActive.toFixed(1), "86.6");
  assert.equal(Math.round(house.kmPerActive), 481);
  const grid = calculateEV({ ...common, sourceConnection: "grid" });
  assert.equal(grid.perPoint.toFixed(2), "9.89");
  assert.equal(grid.energyPerDay.toFixed(1), "988.5");
  assert.equal(grid.energyPerActive.toFixed(1), "98.9");
  assert.equal(Math.round(grid.kmPerActive), 549);
});

test("EV: unsupported published class/power combinations visibly use factor one and never invent a curve", () => {
  const result = calculateEV({ ...base, mode: "static", power: "7.4", factorMode: "reference", userClass: "visitors" });
  assert.equal(result.factorFallback, true);
  assert.equal(result.appliedFactor, 1);
  assert.equal(result.referenceFactor, null);
  const own = calculateEV({ ...base, mode: "static", power: "11", powerMode: "custom", factorMode: "reference", userClass: "visitors" });
  assert.equal(own.factorFallback, true);
  assert.throws(() => calculateEV({ ...base, mode: "static", factorMode: "reference", userClass: "unknown" }));
});
