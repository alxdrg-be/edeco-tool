import assert from "node:assert/strict";
import test from "node:test";
import { calculateSIABalance, createSIAZone, parseSIAZones, type SIAInput, type SIAZoneInput } from "./siaModel.ts";
import { SIA_AUTOMATIC_DATASET, SIA_BUILDING_TYPES, SIA_GROUPS, requireSIAAutomaticDataset } from "./siaData.ts";
import { createSIADefinition, siaReportInputs } from "./siaDefinition.ts";
import { defaults, validateResult, type CalculatorDefinition } from "./types.ts";

function zone(id: string, area = 1000, p = 46.2, e = 73.8): SIAZoneInput {
  const value = createSIAZone(id, id); value.area = area; value.kcor = .7; value.yearGlz = .8;
  value.consumers[0] = { groupId: "devices", powerDensity: p, energyDensity: e };
  return value;
}
const input = (zones = [zone("manual")]): SIAInput => ({ zones, pvYearKWh: 0, pvSelfConsumptionPercent: 50 });
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-12), `${actual} != ${expected}`);

test("SIA applies Kcor only to power and annual simultaneity only to raw energy", () => {
  // Explicitly entered illustrative raw densities; not a reconstructed SIA table.
  // Rounded observed provider aggregates cannot establish exact raw coefficients.
  const base = calculateSIABalance(input());
  close(base.rawPowerKW, 46.2); close(base.powerKW, 32.34);
  close(base.rawEnergyKWh, 73800); close(base.energyKWh, 59040);
  const powerOnly = zone("power"); powerOnly.kcor = .6;
  const changedPower = calculateSIABalance(input([powerOnly]));
  close(changedPower.powerKW, 27.72); close(changedPower.energyKWh, base.energyKWh);
  const energyOnly = zone("energy"); energyOnly.yearGlz = .5;
  const changedEnergy = calculateSIABalance(input([energyOnly]));
  close(changedEnergy.powerKW, base.powerKW); close(changedEnergy.energyKWh, 36900);
});

test("SIA groups and zone totals retain area weighting, rather than averaging densities", () => {
  const a = zone("A", 100, 10, 40), b = zone("B", 300, 30, 20);
  a.kcor = b.kcor = 1; a.yearGlz = b.yearGlz = 1;
  b.consumers[2] = { groupId: "lighting", powerDensity: 4, energyDensity: 6 };
  const result = calculateSIABalance(input([a, b]));
  close(result.area, 400); close(result.powerKW, 11.2); close(result.powerDensity, 28);
  close(result.energyKWh, 11800); close(result.energyDensity, 29.5);
  close(result.groups.find(group => group.groupId === "devices")!.powerDensity, 25);
  close(result.groups.find(group => group.groupId === "lighting")!.powerDensity, 3);
  close(result.groups.reduce((sum, group) => sum + group.energyDensity, 0), result.energyDensity);
});

test("SIA PV offset is capped by annual demand and does not alter gross charts or power", () => {
  const original = calculateSIABalance(input());
  const result = calculateSIABalance({ ...input(), pvYearKWh: 1e9, pvSelfConsumptionPercent: 100 });
  close(result.pvConsumedKWh, result.energyKWh); close(result.netEnergyKWh, 0);
  close(result.powerKW, original.powerKW); assert.deepEqual(result.groups, original.groups);
  const none = calculateSIABalance({ ...input(), pvYearKWh: 1e9, pvSelfConsumptionPercent: 0 });
  close(none.netEnergyKWh, original.energyKWh);
});

test("SIA manual targets compare each zone; partial targets do not fabricate a total target", () => {
  const a = zone("A", 100, 10, 10), b = zone("B", 300, 30, 20);
  a.powerTarget = 6; a.energyTarget = 8; b.powerTarget = 30;
  const partial = calculateSIABalance(input([a, b]));
  close(partial.powerTarget!, 24); assert.equal(partial.energyTarget, undefined);
  assert.equal(partial.zones[0].powerExceeded, true); assert.equal(partial.exceedsTargets, true);
  a.powerTarget = 0;
  assert.equal(calculateSIABalance(input([a])).zones[0].powerExceeded, true);
});

test("SIA explicit unused groups can be zero, while missing or duplicated group data is invalid", () => {
  const emptyValues = createSIAZone();
  const result = calculateSIABalance(input([emptyValues]));
  close(result.powerKW, 0); close(result.energyKWh, 0);
  assert.equal(result.groups.length, 7);
  const missing = zone("missing"); missing.consumers.pop();
  assert.throws(() => calculateSIABalance(input([missing])), /sieben Verbrauchergruppen/);
  const duplicate = zone("duplicate"); duplicate.consumers[1].groupId = "devices";
  assert.throws(() => calculateSIABalance(input([duplicate])), /genau einmal/);
});

test("SIA rejects empty zones, duplicate ids, nonfinite numbers and invalid factors", () => {
  assert.throws(() => calculateSIABalance(input([])), /Eine bis 20/);
  assert.throws(() => calculateSIABalance(input([zone("same"), zone("same")])), /eindeutig/);
  for (const patch of [{ area: 0 }, { kcor: -1 }, { yearGlz: 1.01 }, { area: NaN }, { powerTarget: Infinity }]) {
    assert.throws(() => calculateSIABalance(input([{ ...zone("invalid"), ...patch }])));
  }
  assert.throws(() => calculateSIABalance({ ...input(), pvSelfConsumptionPercent: 101 }));
});

test("SIA parser accepts decimal comma edits but never converts blank required cells to zero", () => {
  const editable = JSON.parse(JSON.stringify([zone("editable")])) as Record<string, unknown>[];
  editable[0].kcor = "0,6";
  close(parseSIAZones(JSON.stringify(editable))[0].kcor, .6);
  editable[0].kcor = "";
  assert.throws(() => parseSIAZones(JSON.stringify(editable)), /leere Felder sind keine Nullwerte/);
  assert.throws(() => parseSIAZones("{"), /nicht gelesen/);
  assert.throws(() => parseSIAZones("null"), /als Liste/);
});

const legacy: CalculatorDefinition = { id: "premium-sia2056", title: "Legacy", description: "", source: "", scope: "", fields: [{ key: "old", label: "Alte Eingabe", default: "12", help: "alt" }], calculate: i => ({ metrics: [{ label: "Alter Wert", value: Number(i.old) }], formula: "Alte Formel", limitations: [], status: { tone: "neutral", text: "Altes Ergebnis" } }) };
test("SIA definition keeps legacy calculation explicit and blocks absent automatic profiles", () => {
  const definition = createSIADefinition(legacy), initial = defaults(definition);
  const manual = validateResult(definition.calculate(initial));
  assert.equal(initial.siaMode, "manual"); assert.ok(manual.siaBreakdown);
  assert.equal(definition.calculate({ ...initial, siaMode: "legacy", old: "42" }).metrics[0].value, 42);
  assert.equal(SIA_AUTOMATIC_DATASET, null);
  assert.equal(SIA_BUILDING_TYPES.length, 17); assert.equal(SIA_GROUPS.length, 7);
  assert.throws(requireSIAAutomaticDataset, /Datensatzes fehlen/);
  assert.throws(() => definition.calculate({ ...initial, siaMode: "automatic", siaBuilding: "office" }), /keine Ersatzwerte/);
});

test("SIA report flattens seven raw groups and independent factors without hiding data in JSON", () => {
  const definition = createSIADefinition(legacy), initial = defaults(definition);
  const rows = siaReportInputs({ ...initial, siaZones: JSON.stringify([zone("Büro manuell")]) });
  assert.equal(rows.filter(row => row.value.includes("W/m² roh;")).length, 7);
  assert.ok(rows.some(row => row.label.includes("Kcor") && row.value === "0.7"));
  assert.ok(rows.some(row => row.label.includes("Jahresgleichzeitigkeit") && row.value === "0.8"));
  assert.equal(rows.some(row => row.value.includes('"consumers"')), false);
  assert.deepEqual(siaReportInputs({ ...initial, siaMode: "legacy" }), []);
});
