import test from "node:test";
import assert from "node:assert/strict";
import { calculateCable, type CableInput } from "./engineering.ts";
import { calculateLightning, type LightningInput } from "./lightning-model.ts";
import { calculateEV, type EVInput } from "./ev-model.ts";
import { cableDiagnostics, lightningDiagnostics, evDiagnostics } from "./legacyDiagnostics.ts";

const cable: CableInput = { phases: "1", material: "cu", length: "25", current: "16", area: "2.5", cosPhi: "1", voltage: "230", limit: "4" };
const lightning: LightningInput = { protection: "III", perimeter: "60", length: "10", conductors: "4", clearance: "" };
const ev: EVInput = { house: "160", grid: "125", reserve: "30", count: "10", power: "11", mode: "dynamic", diversity: "1", minimumPower: "3.7" };

test("cable helper points to the exact empty field and preserves physical model limits", () => {
  const input = { ...cable, length: "" };
  const issues = cableDiagnostics(input, null, "Länge: gültige Zahl eingeben.");
  assert.equal(issues[0].targets?.[0].field, "length");
  assert.match(issues[0].required!, /100000/);
});
test("cable voltage failure uses the calculated length and tabulated section recommendation", () => {
  const input = { ...cable, length: "100" }, result = calculateCable(input), issue = cableDiagnostics(input, result, "")[0];
  assert.ok(!result.withinBudget); assert.match(issue.required!, new RegExp(String(result.recommendedArea)));
  assert.ok(issue.targets?.some(target => target.field === "area"));
  assert.match(issue.action!, /keine Strombelastbarkeit/);
});
test("unsupported aluminium uses the real area field, without changing the material", () => {
  const input = { ...cable, material: "al" as const, area: "2.5" }, before = JSON.stringify(input);
  const issues = cableDiagnostics(input, null, "Aluminium: tabellierte Querschnitte ab 10 mm² wählen.");
  assert.equal(issues[0].targets?.[0].field, "area"); assert.equal(JSON.stringify(input), before);
});
test("lightning uses ceiling for actual circumference and exact centimetre clearance", () => {
  const input = { ...lightning, perimeter: "61", conductors: "4", clearance: "0.01" }, result = calculateLightning(input), issues = lightningDiagnostics(input, result, "");
  assert.equal(result.minimum, 5);
  assert.match(issues.find(item => item.id === "lightning-conductors")!.required!, /5 Ableiter/);
  assert.match(issues.find(item => item.id === "lightning-clearance")!.required!, new RegExp(result.metres.toFixed(2)));
});
test("unmeasured lightning clearance stays open, not failed or approved", () => {
  const issues = lightningDiagnostics(lightning, calculateLightning(lightning), "");
  assert.equal(issues[0].tone, "neutral"); assert.equal(issues[0].targets?.[0].field, "clearance");
});
test("EV hierarchy identifies the real grid rating constraint even with retained legacy defaults", () => {
  const input = { ...ev, house: "63", grid: "125" };
  const issues = evDiagnostics(input, null, "Grid-Vorsicherung darf den Hausanschluss nicht überschreiten.");
  assert.deepEqual(issues[0].targets?.map(target => target.field), ["grid", "house"]);
  assert.match(issues[0].required!, /63 A/);
});
test("EV minimum cannot exceed configured power and does not invent a new rating", () => {
  const input = { ...ev, minimumPower: "12" };
  const issues = evDiagnostics(input, null, "Mindestleistung im Projektmodell darf die konfigurierte Punktleistung nicht überschreiten.");
  assert.equal(issues[0].targets?.[0].field, "minimumPower"); assert.match(issues[0].required!, /11 kW/);
});
test("managed EV waiting has its own explanation instead of a false failure", () => {
  const input = { ...ev, house: "25", grid: "25", reserve: "15" }, result = calculateEV(input), issues = evDiagnostics(input, result, "");
  assert.ok(result.waitingCount > 0);
  assert.equal(issues.find(item => item.id === "ev-waiting")?.tone, "warning");
});
