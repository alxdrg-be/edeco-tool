import assert from "node:assert/strict";
import test from "node:test";
import { calculateEV, type EVInput } from "./ev-model.ts";
import { publishedEVFactor } from "./EVdata.ts";
const base: EVInput = { house:"160",grid:"125",reserve:"30",count:"10",power:"11",mode:"dynamic",diversity:"1" };
test("AC budget accounts for both grid and house reserve, dynamic allocation conserves power",()=>{
  const r=calculateEV(base), factor=Math.sqrt(3)*400/1000;
  assert.ok(Math.abs(r.available-(160*factor-30))<1e-9);
  assert.equal(r.installed,110);assert.equal(r.limited,true);
  assert.ok(r.allocated<=r.gridKW && r.allocated+30<=r.houseKW+1e-9);
  assert.ok(Math.abs(r.perPoint*10-r.allocated)<1e-9);
});
test("no load management always uses factor one, static factor is explicit",()=>{
  const noLM=calculateEV({...base,mode:"none",diversity:"0.2"});
  assert.equal(noLM.appliedFactor,1);assert.equal(noLM.requested,110);assert.equal(noLM.capacityOK,false);
  const fixed=calculateEV({...base,mode:"static",diversity:"0.5"});
  assert.equal(fixed.requested,55);assert.equal(fixed.allocated,55);
});
test("invalid values block results, exhausted budget remains visibly zero",()=>{
  for(const patch of [{count:"2.5"},{grid:"200"},{power:"0"},{reserve:"-1"},{house:""}])assert.throws(()=>calculateEV({...base,...patch}));
  const empty=calculateEV({...base,reserve:"200"});assert.equal(empty.available,0);assert.equal(empty.perPoint,0);assert.equal(empty.reserveExceeded,true);
});

test("static planning activates whole stations with ceiling instead of spreading n*k over every station", () => {
  const r = calculateEV({ ...base, count: "3", mode: "static", diversity: "0.5" });
  assert.equal(r.requestedActiveCount, 2);
  assert.equal(r.activeCount, 2);
  assert.equal(r.waitingCount, 1);
  assert.equal(r.requested, 22);
  assert.equal(r.allocated, 22);
  assert.deepEqual(r.pointPowers, [11, 11, 0]);
  const none = calculateEV({ ...base, count: "3", mode: "static", diversity: "0" });
  assert.equal(none.activeCount, 0);
  assert.equal(none.allocated, 0);
});

test("dynamic allocation has active and waiting stations with a configurable project minimum", () => {
  const r = calculateEV({ ...base, house: "63", grid: "63", reserve: "30", minimumPower: "3.7" });
  assert.equal(r.activeCount, 3);
  assert.equal(r.waitingCount, 7);
  assert.ok(r.perPoint >= r.minimumPower);
  assert.ok(Math.abs(r.allocated - r.available) < 1e-9);
  assert.ok(Math.abs(r.pointPowers.reduce((sum, power) => sum + power, 0) - r.allocated) < 1e-9);
  const lower = calculateEV({ ...base, house: "63", grid: "63", reserve: "30", minimumPower: "1.38" });
  assert.equal(lower.activeCount, 9);
  const insufficient = calculateEV({ ...base, house: "125", grid: "63", reserve: "83", minimumPower: "3.7" });
  assert.equal(insufficient.activeCount, 0);
  assert.equal(insufficient.waitingCount, 10);
  assert.equal(insufficient.allocated, 0);
});

test("single phase points rotate through L1 L2 L3 and check the strongest line rather than average kW", () => {
  const r = calculateEV({ ...base, house: "125", grid: "63", reserve: "0", count: "4", power: "7.4", mode: "none" });
  assert.equal(r.phases, 1);
  assert.deepEqual(r.pointPhases, [1, 2, 3, 1]);
  assert.ok(Math.abs(r.perPointCurrent - 7400 / 230) < 1e-9);
  assert.ok(Math.abs(r.phaseCurrents[0] - 2 * 7400 / 230) < 1e-9);
  assert.ok(Math.abs(r.phaseCurrents[1] - 7400 / 230) < 1e-9);
  assert.ok(r.allocated < r.available, "total kW alone would miss this phase overload");
  assert.equal(r.capacityOK, false);
  assert.equal(r.phaseCapacityOK, false);
  const smaller = calculateEV({ ...base, reserve: "0", count: "1", power: "3.7", mode: "none" });
  assert.equal(smaller.phases, 1);
  assert.ok(Math.abs(smaller.strongestPhaseCurrent - 3700 / 230) < 1e-9);
});

test("managed one phase allocation respects the phase budget and its project minimum", () => {
  const r = calculateEV({ ...base, house: "63", grid: "25", reserve: "0", count: "4", power: "7.4", minimumPower: "3.7" });
  assert.equal(r.activeCount, 3);
  assert.equal(r.waitingCount, 1);
  assert.ok(Math.abs(r.perPoint - 5.75) < 1e-9);
  assert.equal(r.phaseCapacityOK, true);
  for (const current of r.phaseCurrents) assert.ok(current <= 25 + 1e-9);
});

test("invalid dynamic minimum never gets replaced while hidden optional fields do not block another mode", () => {
  for (const minimumPower of ["", "NaN", "-1", "0", "12"]) assert.throws(() => calculateEV({ ...base, minimumPower }));
  assert.equal(calculateEV({ ...base, mode: "none", minimumPower: "", diversity: "" }).allocated, 110);
  assert.equal(calculateEV({ ...base, mode: "static", minimumPower: "", diversity: "0.5" }).allocated, 55);
});

test("PV and storage budgets preserve site energy without adding local generation twice", () => {
  const common = { ...base, hours: "10", consumption: "18", pv: "20", battery: "40" };
  const house = calculateEV({ ...common, sourceConnection: "house" });
  const grid = calculateEV({ ...common, sourceConnection: "grid" });
  assert.equal(house.generationKW, 18);
  assert.equal(house.batteryKW * house.hours, 40);
  assert.ok(grid.available > house.available, "generation at the UV is behind its upstream fuse");
  for (const result of [house, grid]) {
    assert.equal(result.energyPerDay, result.allocated * result.hours);
    assert.equal(result.energyPerActive, result.energyPerDay / result.activeCount);
    assert.ok(Math.abs(result.houseImportKW + result.generationKW - (30 + result.allocated + result.houseExportKW)) < 1e-9);
    assert.ok(Math.abs(result.houseImportKW * result.hours + result.generationEnergy - ((30 + result.allocated) * result.hours + result.houseExportKW * result.hours)) < 1e-8);
    assert.equal(result.phaseCapacityOK, true);
  }
  assert.ok(Math.abs(grid.gridImportKW - grid.allocated + grid.generationKW) < 1e-9);
});

test("absent new energy and factor fields preserve the original power calculation", () => {
  const old = calculateEV(base);
  const current = calculateEV({ ...base, hours: "10", consumption: "18", pv: "0", battery: "0", sourceConnection: "house", factorMode: "manual", chargerKind: "auto", powerMode: "preset" });
  assert.equal(old.allocated, current.allocated);
  assert.equal(old.available, current.available);
  assert.deepEqual(old.phaseCurrents, current.phaseCurrents);
});

test("DC presets are an explicit three-phase AC-equivalent and own powers can specify their connection", () => {
  const dc = calculateEV({ ...base, count: "1", power: "150", mode: "none" });
  assert.equal(dc.chargerKind, "dc");
  assert.equal(dc.phases, 3);
  assert.ok(Math.abs(dc.perPointCurrent - 150000 / (Math.sqrt(3) * 400)) < 1e-9);
  const custom = calculateEV({ ...base, count: "1", power: "5", chargerKind: "ac1", powerMode: "custom", mode: "none" });
  assert.equal(custom.chargerKind, "ac1");
  assert.ok(Math.abs(custom.perPointCurrent - 5000 / 230) < 1e-9);
});

test("reverse feed is checked by its actual phase-current magnitude", () => {
  const r = calculateEV({ ...base, house: "125", grid: "63", count: "1", mode: "static", diversity: "0", pv: "1000", battery: "0", sourceConnection: "house" });
  assert.equal(r.allocated, 0);
  assert.ok(r.houseExportKW > r.houseKW);
  assert.equal(r.phaseCapacityOK, false);
  assert.equal(r.capacityOK, false);
});

test("new energy fields validate inputs and optional blank generation explicitly means zero", () => {
  for (const patch of [{ hours: "" }, { hours: "0" }, { hours: "25" }, { consumption: "" }, { consumption: "0" }, { pv: "-1" }, { battery: "NaN" }, { sourceConnection: "elsewhere" }, { chargerKind: "bad" }]) {
    assert.throws(() => calculateEV({ ...base, ...patch } as EVInput));
  }
  const noGeneration = calculateEV({ ...base, pv: "", battery: "" });
  assert.equal(noGeneration.generationKW, 0);
  assert.equal(noGeneration.available, calculateEV(base).available);
});


test("published factor curve parameters retain observed class and small-count boundaries", () => {
  const observed = [
    ["residents", 1, 3.7, .8], ["residents", 50, 7.4, .16664911638029561],
    ["visitors", 20, 22, .20693812406210849], ["visitors", 3, 50, .8], ["visitors", 4, 50, .8043236815068234],
    ["transit", 3, 100, 1], ["transit", 4, 100, .982282591525052],
    ["transit", 3, 150, 1], ["transit", 4, 150, .9766807580461243],
    ["transit", 1, 350, 1], ["transit", 2, 350, .9725597672903273],
  ] as const;
  for (const [userClass, count, power, expected] of observed) assert.ok(Math.abs(publishedEVFactor(userClass, count, power)! - expected) < 1e-12);
  assert.throws(() => publishedEVFactor("residents", 101, 11), /höchstens 100/);
  assert.throws(() => publishedEVFactor("residents", 0, 11));
  assert.equal(publishedEVFactor("visitors", 5, 7.4), null);
});
