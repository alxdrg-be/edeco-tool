import assert from "node:assert/strict";
import test from "node:test";
import { CALCULATORS } from "./definitions.ts";
import { defaults } from "./types.ts";
import { migrateWorkbenchInputs } from "./migrateInputs.ts";

test('saved detector and selectivity calculations retain their existing manual interpretation',()=>{
  const detector=migrateWorkbenchInputs('premium-brandmelder',{detectorBasis:'reference',gridRule:'spacing',radius:'5'},{radius:'4'});
  assert.equal(detector.detectorBasis,'manual');assert.equal(detector.gridRule,'radius');assert.equal(detector.radius,'4');
  const selectivity=migrateWorkbenchInputs('premium-selektivitaet',{selectivityMode:'stages',checkMode:'hint'},{checkMode:'manufacturer'});
  assert.equal(selectivity.selectivityMode,'legacy');assert.equal(selectivity.checkMode,'manufacturer');
  const explicit=migrateWorkbenchInputs('premium-brandmelder',{detectorBasis:'reference'},{detectorBasis:'reference'});
  assert.equal(explicit.detectorBasis,'reference');
});

const migrated = (id: string, saved: Record<string, unknown>) => {
  const definition = CALCULATORS.find(item => item.id === id)!;
  return { definition, input: migrateWorkbenchInputs(id, defaults(definition), saved) };
};

test("a saved manual ampacity calculation keeps its factors instead of switching to a published table", () => {
  const saved = { method: "B2", area: "6", ib: "32", in: "32", iz0: "50", temperature: "0.87", grouping: "0.8", i2factor: "1.45", parallel: "1", arrangement: "twisted" };
  const { definition, input } = migrated("nin-kabelrechner", saved);
  assert.equal(input.tableMode, "manual");
  const iz = definition.calculate(input).metrics.find(item => item.label === "Korrigierte Strombelastbarkeit Iz")!;
  assert.ok(Math.abs(Number(iz.value) - 34.8) < 1e-9);
});

test("old lighting and motor inputs retain their manually entered values and layout", () => {
  const motor = migrated("motoranlauf", { kw: "7.5", efficiency: "0.9", cos: "0.85" }).input;
  assert.equal(motor.efficiencyMode, "manual");
  assert.equal(motor.efficiency, "0.9");
  assert.equal(motor.inputMode, "power");
  assert.equal(motor.checkIz, "off");
  const light = migrated("beleuchtung", { utilisation: "0.7", lumen: "4200", watts: "40" }).input;
  assert.equal(light.layout, "full");
  assert.equal(light.etaMode, "manual");
  assert.equal(light.luminaire, "manual");
  assert.equal(light.luxMode, "manual");
});

test("legacy charging grids and PoE retain their previous interpretation", () => {
  assert.equal(migrated("premium-pkw", { count1: "3", power1: "11" }).input.layout, "legacy");
  assert.equal(migrated("premium-lkw", { units: "3" }).input.depotLayout, "legacy");
  assert.equal(migrated("poe", { resistance: "9.38" }).input.type, "manual");
  assert.equal(migrated("poe", { resistance: "9.38" }).input.cable, "manual");
  assert.equal(migrated("verlustleistung", { hours: "2000" }).input.durationMode, "annual");
});

test("explicit new modes stay selected and malformed stored values never become defaults silently", () => {
  assert.equal(migrated("premium-pkw", { layout: "modular" }).input.layout, "modular");
  assert.equal(migrated("beleuchtung", { etaMode: "room", layout: "minimum" }).input.etaMode, "room");
  assert.equal(migrated("motoranlauf", { kw: "" }).input.kw, "");
  assert.throws(() => migrated("motoranlauf", { kw: 7.5 }), /Zeichenfolge/);
});


test("saved short-circuit inputs retain cmax 1.05 until their voltage tolerance is confirmed", () => {
  const { definition, input } = migrated("kurzschlussstrom", { kva: "630", uk: "4" });
  assert.equal(input.voltageTolerance, "legacy");
  assert.match(definition.calculate(input).status.text, /Altstand/);
  assert.equal(defaults(definition).voltageTolerance, "plus10");
  assert.equal(migrated("kurzschlussstrom", { voltageTolerance: "plus10" }).input.voltageTolerance, "plus10");
  assert.equal(migrated("kurzschlussstrom", { voltageTolerance: "" }).input.voltageTolerance, "");
  assert.throws(() => migrated("kurzschlussstrom", { voltageTolerance: 1.1 }), /Zeichenfolge/);
});

test('saved variable selectivity stages retain their original voltage factor until explicitly changed',()=>{
  const {definition,input}=migrated('premium-selektivitaet',{selectivityMode:'stages',sourceIk:'10'});
  assert.equal(input.selectivityMode,'stages');assert.equal(input.voltageTolerance,'legacy');
  assert.equal(defaults(definition).voltageTolerance,'plus10');
  assert.match(definition.calculate(input).status.text,/Altstand/);
  assert.equal(migrated('premium-selektivitaet',{selectivityMode:'stages',voltageTolerance:'plus10'}).input.voltageTolerance,'plus10');
});

test("saved dynamic fire comparisons retain both states while new calculations start with one variant",()=>{
  const old=migrated("premium-brandlast",{fireloadMode:"dynamic",fireloadRows:"[]",fireloadRowsAfter:"[]"});
  assert.equal(old.input.comparisonEnabled,"yes");
  assert.equal(defaults(old.definition).comparisonEnabled,"no");
  assert.equal(migrated("premium-brandlast",{comparisonEnabled:"no"}).input.comparisonEnabled,"no");
  assert.equal(migrated("premium-brandlast",{comparisonEnabled:""}).input.comparisonEnabled,"");
});
