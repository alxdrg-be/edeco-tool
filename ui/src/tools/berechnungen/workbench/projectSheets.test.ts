import assert from "node:assert/strict";
import test from "node:test";
import { defaults } from "./types.ts";
import { SHEETS, annuityFactor, parseCostItems, parseLevelSegments, parseLoadBoards } from "./projectSheets.ts";

const run = (id: string, patch: Record<string, string> = {}) => {
  const definition = SHEETS.find(item => item.id === id)!;
  return definition.calculate({ ...defaults(definition), ...patch });
};
const metric = (id: string, label: string, patch?: Record<string, string>) => {
  const value = run(id, patch).metrics.find(item => item.label === label)?.value;
  assert.equal(typeof value, "number");
  return value as number;
};

test("the load schedule multiplies count, power and both diversity factors", () => {
  const boards = parseLoadBoards(JSON.stringify([{
    id: "hv", label: "HV", diversity: "0.5",
    rows: [
      { id: "a", label: "Herd", count: "1", watts: "8000", diversity: "1" },
      { id: "b", label: "Licht", count: "4", watts: "100", diversity: "0.5" },
    ],
  }]));
  assert.equal(boards[0].rows.length, 2);
  const result = run("leistungsbilanz", { loadBoards: JSON.stringify(boards), system: "3", cosPhi: "1" });
  const simultaneous = metric("leistungsbilanz", "Gleichzeitige Leistung", { loadBoards: JSON.stringify(boards), system: "3", cosPhi: "1" });
  assert.equal(simultaneous, (8000 + 4 * 100 * 0.5) / 1000 * 0.5);
  assert.equal(metric("leistungsbilanz", "Installierte Leistung", { loadBoards: JSON.stringify(boards) }), (8000 + 400) / 1000);
  const current = result.metrics.find(item => item.label === "Modellstrom am Anschluss")!.value as number;
  assert.ok(Math.abs(current - simultaneous * 1000 / (Math.sqrt(3) * 400)) < 1e-9);
  assert.throws(() => run("leistungsbilanz", { loadBoards: JSON.stringify([{ id: "hv", label: "HV", diversity: "0", rows: [{ id: "a", label: "Leer", count: "1", watts: "1000", diversity: "0" }] }]) }));
});

test("production cost is annuity plus operating cost divided by mean yield", () => {
  assert.equal(annuityFactor(0, 20), 0.05);
  const perKwh = metric("zev-gestehung", "Gestehungskosten");
  assert.ok(Math.abs(perKwh - 11) < 1e-9);
  const interest = annuityFactor(2, 25);
  const energy = 10 * 1000 * ((1 - 0.99 ** 25) / (25 * 0.01));
  const expected = ((20000 * interest) + 100) / energy * 100;
  const rated = metric("zev-gestehung", "Gestehungskosten", { interest: "2", years: "25", degradation: "1" });
  assert.ok(Math.abs(rated - expected) < 1e-8);
});

test("a level chain subtracts cable loss and applies the device change", () => {
  const segments = parseLevelSegments(JSON.stringify([
    { id: "seg-1", label: "Stammkabel", kind: "cable", length: "25", attenuation: "20", gain: "0" },
    { id: "seg-2", label: "Abzweiger", kind: "device", length: "0", attenuation: "0", gain: "-8" },
  ]));
  assert.equal(segments[1].kind, "device");
  assert.equal(metric("rtv-daempfung", "Pegel am Ende"), 80 - 25 * 20 / 100 - 8);
  assert.throws(() => parseLevelSegments("[{\"id\":\"seg-1\",\"label\":\"Kabel\",\"kind\":\"pipe\",\"length\":\"1\",\"attenuation\":\"1\",\"gain\":\"0\"}]"));
});

test("the estimate sums quantity times price and applies the stated band", () => {
  const items = parseCostItems(JSON.stringify([
    { id: "item-1", group: "Allgemein", code: "231", label: "Beispielposition", quantity: "2", price: "1500" },
    { id: "item-2", group: "Wohnung", code: "232", label: "Installation", quantity: "1", price: "500" },
  ]));
  assert.equal(items[1].group, "Wohnung");
  assert.equal(metric("bkp-schaetzung", "Schätzsumme", { costItems: JSON.stringify(items), accuracy: "20" }), 3500);
  assert.equal(metric("bkp-schaetzung", "Untere Bandbreite", { costItems: JSON.stringify(items), accuracy: "20" }), 2800);
  assert.equal(metric("bkp-schaetzung", "Obere Bandbreite", { costItems: JSON.stringify(items), accuracy: "20" }), 4200);
});
