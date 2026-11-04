// Run: npm test  (Node 22, no extra packages)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHARGE_OPTIONS,
  NIN_VOLTAGE_DROP_LIMIT_PERCENT,
  chargeInstallation,
  equipotential,
  lighting,
  motor,
  ohmsAc,
  ohmsDc,
  powerLoss,
  reactiveCompensation,
  sectionForCurrent,
  shortCircuit,
  transformer,
  voltageDrop,
} from "./calc.ts";
import { R20_OHM_PER_KM } from "./conductors.ts";

function close(actual: number, expected: number) {
  const scale = Math.max(1, Math.abs(expected));
  assert.ok(Math.abs(actual - expected) <= 1e-6 * scale, `${actual} vs ${expected}`);
}

const cable = { material: "cu" as const, sectionMm2: 16, currentA: 16, lengthM: 50, cosPhi: 0.9, limitPercent: 4 };

test("voltage drop uses the three-phase formula, a 55 °C resistance and a capped bar", () => {
  const result = voltageDrop({ ...cable, phases: 3 });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  close(result.value.rPerKm, 1.15 * (1 + 0.00393 * 35));
  close(result.value.deltaUV, 1.6893864884750596);
  close(result.value.deltaUPercent, 0.42234662211876495);
  assert.equal(result.value.factor, "sqrt3");
  assert.equal(result.value.tone, "ok");
  assert.ok(result.value.barPercent < 100);

  const overloaded = voltageDrop({ ...cable, phases: 3, currentA: 100, lengthM: 100, sectionMm2: 1.5 });
  assert.equal(overloaded.ok, true);
  if (!overloaded.ok) return;
  assert.equal(overloaded.value.barPercent, 100);
  assert.equal(overloaded.value.tone, "over");
});

test("single-phase voltage drop uses 2 instead of √3", () => {
  const three = voltageDrop({ ...cable, phases: 3 });
  const one = voltageDrop({ ...cable, phases: 1 });
  assert.equal(three.ok && one.ok, true);
  if (!three.ok || !one.ok) return;
  assert.equal(one.value.factor, 2);
  close(one.value.deltaUV, 1.9507354877727847);
  close(one.value.deltaUV / three.value.deltaUV, 2 / Math.sqrt(3));
  assert.equal(one.value.unV, 230);
});

test("aluminium below 10 mm² and copper 300 mm² without X′ produce no voltage drop", () => {
  assert.equal(voltageDrop({ ...cable, phases: 3, material: "al", sectionMm2: 4 }).ok, false);
  assert.equal(R20_OHM_PER_KM.cu[300], 0.0601);
  assert.equal(voltageDrop({ ...cable, phases: 3, sectionMm2: 300 }).ok, false);
});

test("losses use the same resistance, include cos φ, and default to the 4 % NIN limit", () => {
  assert.equal(NIN_VOLTAGE_DROP_LIMIT_PERCENT, 4);
  const drop = voltageDrop({ ...cable, phases: 3 });
  const loss = powerLoss({ ...cable, phases: 3, parallel: 1, pricePerKwh: 0.25, hoursPerDay: 10, days: 200, years: 1 });
  assert.equal(drop.ok && loss.ok, true);
  if (!drop.ok || !loss.ok) return;
  close(loss.value.rPerKm, drop.value.rPerKm);
  close(loss.value.deltaUV, drop.value.deltaUV);
  close(loss.value.lossW, 50.234208);
  const parallel = powerLoss({ ...cable, phases: 3, parallel: 2, pricePerKwh: 0, hoursPerDay: 0, days: 0, years: 0 });
  assert.equal(parallel.ok, true);
  if (!parallel.ok) return;
  close(parallel.value.lossW, 50.234208 / 2);
});

test("short-circuit model uses the selected voltage tolerance without claiming guaranteed bounds", () => {
  const open = shortCircuit({
    unV: 400, apparentPowerVa: 250000, ukPercent: 4, material: "cu", sectionMm2: 16, lengthM: 0, parallel: 1,
  });
  assert.equal(open.ok, true);
  if (!open.ok) return;
  close(open.value.zkOhm, 0.0256);
  close(open.value.ikMaxA, 9923.207751696695);
  assert.match(open.value.ikMaxLabel, /Keine garantierte obere Schranke/);
  assert.match(open.value.ikMaxLabel, /IEC-60909-Studie/);
  assert.match(open.value.ikMinLabel, /keine garantierte untere Schranke/);

  const line = shortCircuit({
    unV: 400, apparentPowerVa: 250000, ukPercent: 4, material: "cu", sectionMm2: 16, lengthM: 20, parallel: 1,
  });
  assert.equal(line.ok, true);
  if (!line.ok) return;
  close(line.value.ikMaxA, 6760.970174597868 * 1.10 / 1.05);
  close(line.value.ikMinA, 2646.036115553497);
  assert.ok(line.value.ikMinA < line.value.ikMaxA);
});

test("transformer Ik is the rigid-grid value with c = 1", () => {
  const result = transformer({
    apparentPowerVa: 250000, primaryV: 20000, secondaryV: 400, ukPercent: 4, noLoadPercent: 1.5, loadPercent: 80,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  close(result.value.secondaryA, 360.8439182435161);
  close(result.value.shortCircuitA, 360.8439182435161 * 25);
  close(result.value.impedanceOhm, 0.0256);
  assert.equal(result.value.voltageFactor, 1);
  assert.match(result.value.ikLabel, /c = 1/);
});

test("reactive power is zero when the target cos φ is not higher", () => {
  const needed = reactiveCompensation({ activePowerW: 100000, cosBefore: 0.7, cosTarget: 0.95, unV: 400, phases: 3 });
  const enough = reactiveCompensation({ activePowerW: 100000, cosBefore: 0.95, cosTarget: 0.7, unV: 400, phases: 3 });
  assert.equal(needed.ok && enough.ok, true);
  if (!needed.ok || !enough.ok) return;
  close(needed.value.kvar, 69.15199560415441);
  assert.equal(enough.value.kvar, 0);
});

test("DC and AC ohm relations", () => {
  const dc = ohmsDc({ currentA: 2, resistanceOhm: 5 });
  assert.equal(dc.ok, true);
  if (!dc.ok) return;
  close(dc.value.voltageV, 10);
  close(dc.value.powerW, 20);
  const ac = ohmsAc({ phases: 3, voltageV: 400, currentA: 10, cosPhi: 0.8 });
  assert.equal(ac.ok, true);
  if (!ac.ok) return;
  close(ac.value.apparentVa, Math.sqrt(3) * 400 * 10);
  close(ac.value.activeW, ac.value.apparentVa * 0.8);
  close(ac.value.reactiveVar, ac.value.apparentVa * 0.6);
});

test("bounded published bonding model keeps its LPS assumption separate from additional bonding", () => {
  const small = equipotential({ phaseMm2: 6, penMm2: 6, lightningProtection: false });
  const lightning = equipotential({ phaseMm2: 6, penMm2: 6, lightningProtection: true });
  const feeder = equipotential({ phaseMm2: 95, penMm2: 50, lightningProtection: true });
  assert.equal(small.ok && lightning.ok && feeder.ok, true);
  if (!small.ok || !lightning.ok || !feeder.ok) return;
  assert.deepEqual(small.value, { hpaMm2: 6, peMm2: 6, opaMm2: 4, penTooSmall: false });
  assert.equal(lightning.value.hpaMm2, 10);
  assert.equal(lightning.value.opaMm2, small.value.opaMm2);
  assert.deepEqual(feeder.value, { hpaMm2: 16, peMm2: 50, opaMm2: 25, penTooSmall: false });
  const shortPen = equipotential({ phaseMm2: 50, penMm2: 16, lightningProtection: false });
  assert.equal(shortPen.ok, true);
  if (!shortPen.ok) return;
  assert.equal(shortPen.value.peMm2, 25);
  assert.equal(shortPen.value.penTooSmall, true);
});

test("motor current, fixed start factor and Iz ≥ In", () => {
  const result = motor({ powerW: 4000, cosPhi: 0.86, eta: 0.886, start: "direct", insulation: "PVC", method: "B2" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  close(result.value.currentA, 4000 / (Math.sqrt(3) * 400 * 0.86 * 0.886));
  assert.equal(result.value.factor, 6);
  close(result.value.startA, result.value.currentA * 6);
  assert.equal(result.value.section?.sectionMm2, 1.5);
  assert.ok((result.value.section?.izA ?? 0) >= result.value.currentA);
  assert.deepEqual(sectionForCurrent(20, "PVC", "B2"), { sectionMm2: 2.5, izA: 20 });
  assert.equal(sectionForCurrent(20.1, "PVC", "B2")?.sectionMm2, 4);
});

test("charging without load management keeps k = 1", () => {
  assert.deepEqual(CHARGE_OPTIONS.map((option) => [option.kw, option.phases]), [[3.7, 1], [7.4, 1], [11, 3], [22, 3]]);
  const result = chargeInstallation({
    count: 4, kwEach: 11, phases: 3, management: "none", siaClass: "bewohner", share: 0.2,
    hausA: 125, gridA: 63, connection: "haus", reserveKw: 0, pvKwp: 0, batteryKwh: 0, batteryHours: 8,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.k, 1);
  assert.equal(result.value.approximate, false);
  assert.equal(result.value.powerKw, 44);
  const managed = chargeInstallation({
    count: 5, kwEach: 11, phases: 3, management: "static", siaClass: "bewohner", share: 1,
    hausA: 125, gridA: 63, connection: "haus", reserveKw: 0, pvKwp: 0, batteryKwh: 0, batteryHours: 0,
  });
  assert.equal(managed.ok, true);
  if (!managed.ok) return;
  close(managed.value.k, 0.41956863534207073);
  assert.equal(managed.value.approximate, true);
  close(managed.value.powerKw, 5 * 11 * 0.41956863534207073);
});

test("lighting count is rounded up and the room index uses the mounting height", () => {
  const result = lighting({
    illuminanceLux: 500, lengthM: 10, widthM: 6, heightM: 3, workplaneM: 0.8,
    fluxLm: 4000, eta: 0.6, maintenance: 0.8, luminairePowerW: 32,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.count, 16);
  close(result.value.roomIndex, 60 / (2.2 * 16));
  close(result.value.currentA ?? 0, 16 * 32 / 230);
  assert.equal(lighting({
    illuminanceLux: 500, lengthM: 10, widthM: 6, heightM: 0.8, workplaneM: 0.8,
    fluxLm: 4000, eta: 0.6, maintenance: 0.8, luminairePowerW: null,
  }).ok, false);
});

test("runtime phase choices, finite values and integral parallel counts never silently default", () => {
  assert.equal(voltageDrop({...cable,phases:2 as never}).ok,false);
  assert.equal(voltageDrop({...cable,phases:3,parallel:1.5}).ok,false);
  assert.equal(voltageDrop({...cable,phases:3,material:"invalid" as never}).ok,false);
  assert.equal(voltageDrop({...cable,phases:3,currentA:1e308,lengthM:1e308}).ok,false);
  assert.equal(voltageDrop({...cable,phases:3,currentA:400,lengthM:500,sectionMm2:1.5}).ok,false);
  assert.equal(powerLoss({...cable,phases:3,parallel:1,pricePerKwh:.2,hoursPerDay:25,days:300,years:1}).ok,false);
});
test("short circuit plus6 is explicitly selectable while new plus10 cases use1.10", () => {
  const data={unV:400 as const,apparentPowerVa:250000,ukPercent:4,material:"cu" as const,sectionMm2:16,lengthM:0,parallel:1};
  const six=shortCircuit({...data,voltageTolerance:"plus6"}),ten=shortCircuit({...data,voltageTolerance:"plus10"});
  assert.ok(six.ok&&ten.ok);if(!six.ok||!ten.ok)return;
  close(six.value.ikMaxA,9472.152853892298);close(ten.value.ikMaxA/six.value.ikMaxA,1.10/1.05);
  close(six.value.ikMinA,ten.value.ikMinA);
});
test("ohm rejects inconsistent overspecification and invalid values instead of ignoring a field", () => {
  assert.equal(ohmsDc({voltageV:230,currentA:2,resistanceOhm:5}).ok,false);
  assert.equal(ohmsDc({voltageV:NaN,currentA:2,resistanceOhm:5}).ok,false);
  assert.equal(ohmsDc({voltageV:10,resistanceOhm:-5}).ok,false);
  assert.equal(ohmsDc({voltageV:1e308,currentA:1e308}).ok,false);
  assert.equal(ohmsAc({phases:2 as never,voltageV:400,currentA:10,cosPhi:.8}).ok,false);
});
test("all six DC input pairs reproduce the twelve Ohm power-wheel rearrangements", () => {
  const pairs=[{voltageV:12,currentA:2},{voltageV:12,resistanceOhm:6},{currentA:2,resistanceOhm:6},{powerW:24,voltageV:12},{powerW:24,currentA:2},{powerW:24,resistanceOhm:6}];
  for(const input of pairs){const result=ohmsDc(input);assert.ok(result.ok);if(!result.ok)continue;close(result.value.voltageV,12);close(result.value.currentA,2);close(result.value.resistanceOhm,6);close(result.value.powerW,24);}
  const root=ohmsDc({powerW:100,resistanceOhm:25});assert.ok(root.ok);if(root.ok){close(root.value.voltageV,50);close(root.value.currentA,2);}
  const zero=ohmsDc({powerW:0,resistanceOhm:10});assert.ok(zero.ok);if(zero.ok){assert.equal(zero.value.currentA,0);assert.equal(zero.value.voltageV,0);}
  for(const input of [{powerW:0,voltageV:230},{powerW:10,currentA:0},{powerW:0,currentA:0},{powerW:-1,resistanceOhm:10},{powerW:Infinity,resistanceOhm:10}])assert.equal(ohmsDc(input).ok,false);
});
test("bonding outside the published range and motor without a valid start model remain unavailable", () => {
  assert.equal(equipotential({phaseMm2:240,penMm2:120,lightningProtection:false}).ok,false);
  assert.equal(motor({powerW:4000,cosPhi:.8,eta:.9,start:"unknown" as never,insulation:"PVC",method:"B2"}).ok,false);
  assert.equal(motor({powerW:1e308,cosPhi:1e-308,eta:1e-308,start:"direct",insulation:"PVC",method:"B2"}).ok,false);
});
test("charging judges strongest phase rather than a falsely safe bulk-kW budget", () => {
  const base={count:1,kwEach:7.4,phases:1 as const,management:"none" as const,siaClass:"bewohner" as const,share:1,hausA:125,gridA:25,connection:"haus" as const,reserveKw:0,pvKwp:0,batteryKwh:0,batteryHours:8};
  const phase=chargeInstallation(base);assert.ok(phase.ok);if(!phase.ok)return;
  assert.ok(phase.value.powerKw<phase.value.availableKw);assert.equal(phase.value.tone,"over");close(phase.value.strongestPhaseA,7400/230);
  const pv=chargeInstallation({...base,count:4,kwEach:11,phases:3,gridA:16,connection:"grid",pvKwp:50});
  assert.ok(pv.ok);if(!pv.ok)return;assert.equal(pv.value.tone,"over");assert.ok(pv.value.reliefKw<=pv.value.gridKw);
  assert.equal(chargeInstallation({...base,hausA:16,gridA:16,reserveKw:12}).ok,false);
  assert.equal(chargeInstallation({...base,batteryKwh:10,batteryHours:0}).ok,false);
});
test("lighting tiny positive demand still needs one luminaire and negative workplane is invalid", () => {
  const base={illuminanceLux:1e-12,lengthM:1,widthM:1,heightM:3,workplaneM:0,fluxLm:4000,eta:1,maintenance:1,luminairePowerW:null};
  const small=lighting(base);assert.ok(small.ok);if(small.ok)assert.equal(small.value.count,1);
  assert.equal(lighting({...base,workplaneM:-1}).ok,false);
  assert.equal(lighting({...base,heightM:Infinity}).ok,false);
});
