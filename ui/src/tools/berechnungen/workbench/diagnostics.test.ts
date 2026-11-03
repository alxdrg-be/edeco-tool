import test from "node:test";
import assert from "node:assert/strict";
import { CALCULATORS } from "./definitions.ts";
import { defaults, InputError, number, type Inputs } from "./types.ts";
import { errorDiagnostics, resultDiagnostics } from "./diagnostics.ts";
import { RowInputError, propertyForLabel } from "./inputDiagnostics.ts";

const definition = (id: string) => CALCULATORS.find(item => item.id === id)!;
function evaluate(id: string, edit: Inputs = {}) {
  const d = definition(id), input = { ...defaults(d), ...edit };
  const result = d.calculate(input);
  return { d, input, result, diagnostics: resultDiagnostics(d, input, result) };
}
function failure(id: string, input: Inputs) {
  const d = definition(id);
  let caught: unknown;
  try { d.calculate(input); } catch (error) { caught = error; }
  assert.ok(caught instanceof Error, `${id} should reject invalid input`);
  return { caught, diagnostics: errorDiagnostics(d, input, caught) };
}

test("all 22 workbench models expose current explanation data without changing inputs", () => {
  assert.equal(CALCULATORS.length, 22);
  for (const d of CALCULATORS) {
    const input = Object.freeze(defaults(d)), before = JSON.stringify(input), result = d.calculate(input);
    const diagnostics = resultDiagnostics(d, input, result);
    assert.equal(JSON.stringify(input), before, d.id);
    for (const item of diagnostics) { assert.ok(item.message, d.id); assert.ok(item.required, d.id); assert.notEqual(item.tone, "ok", d.id); }
  }
});

test("numeric validation retains the exact field, entered value and inclusive boundary", () => {
  assert.equal(number({ x: "0" }, "x", "Wert", 0, 100, true), 0);
  assert.throws(() => number({ x: "" }, "x", "Wert", 0, 100), error => error instanceof InputError && error.field === "x" && error.actual === "leer" && error.required.includes("100"));
  const d = definition("ls-schalter"), input = { ...defaults(d), ikMin: "" };
  const { diagnostics } = failure(d.id, input);
  assert.equal(diagnostics[0].targets?.[0].field, "ikMin");
  assert.match(diagnostics[0].required!, /200.?000/);
});

test("conflicting LS load and I2 constraints do not invent a feasible current", () => {
  const { diagnostics } = evaluate("ls-schalter", { rated: "25", load: "13", iz: "20", i2factor: "5" });
  const capacity = diagnostics.find(item => item.id === "overload-capacity")!;
  assert.match(capacity.required!, /kein Nennstrombereich/);
  assert.match(capacity.required!, /86\.206896|86,206896/);
  assert.deepEqual(capacity.targets?.map(item => item.field), ["iz", "rated", "i2factor"]);
  assert.match(capacity.action!, /nur ändern.*belegt/);
});

test("Ib above In targets the device and load, rather than suggesting Iz alone", () => {
  const { diagnostics } = evaluate("ls-schalter", { rated: "16", load: "20", iz: "100" });
  const load = diagnostics.find(item => item.id === "overload-load")!;
  assert.deepEqual(load.targets?.map(item => item.field), ["rated", "load"]);
  assert.match(load.message, /allein/);
});

test("parallel NIN guide uses corrected total Iz and its actual manual inputs", () => {
  const { diagnostics } = evaluate("nin-kabelrechner", { tableMode: "manual", parallel: "3", area: "95", ib: "80", in: "125", iz0: "50", temperature: "0.87", grouping: "0.8", i2factor: "1.6" });
  const issue = diagnostics.find(item => item.id === "overload-capacity")!;
  assert.match(issue.actual!, /104\.4|104,4/);
  assert.ok(issue.targets?.some(target => target.field === "iz0"));
  assert.ok(!issue.targets?.some(target => target.field === "ambient"));
});

test("documented LS backup is judged against effective capacity, magnetic check stays separate", () => {
  const { diagnostics } = evaluate("ls-schalter", { backupMode: "documented", backupLimit: "25", backupReference: "Manufacturer pair coordination XYZ", ikMax: "20", ikMin: "60" });
  assert.ok(!diagnostics.some(item => item.id === "breaker-breaking"));
  assert.ok(diagnostics.some(item => item.id === "breaker-magnetic"));
});

test("same-labelled selectivity stages navigate to the actual second row and length", () => {
  const d = definition("premium-selektivitaet"), input = defaults(d), rows = JSON.parse(input.selectivityStages);
  rows[0].name = rows[1].name = "Gleiches Gerät"; rows[1].length = "";
  input.selectivityStages = JSON.stringify(rows);
  const { caught, diagnostics } = failure(d.id, input);
  assert.ok(caught instanceof RowInputError);
  assert.deepEqual(diagnostics[0].targets?.map(({ field, rowId, property }) => ({ field, rowId, property })), [{ field: "selectivityStages", rowId: rows[1].id, property: "length" }]);
});

test("selectivity pair limit explains actual Ik and points at that pair's source", () => {
  const d = definition("premium-selektivitaet"), input = defaults(d), rows = JSON.parse(input.selectivityStages);
  rows[1].pairLimitKA = "0.01"; rows[1].pairReference = "Original manufacturer pair table";
  input.selectivityStages = JSON.stringify(rows);
  const issues = resultDiagnostics(d, input, d.calculate(input)), issue = issues.find(item => item.id === `selectivity-pair-${rows[1].id}`)!;
  assert.ok(issue); assert.equal(issue.targets?.[0].rowId, rows[1].id);
  assert.equal(issue.targets?.[1].property, "pairReference");
  assert.match(issue.required!, /darf nicht frei erhöht/);
});

test("same-labelled cost rows retain exact failing row and hardware property", () => {
  const d = definition("premium-ladekosten"), input = defaults(d), rows = JSON.parse(input.costRows);
  rows[0].label = rows[1].label = "Gleiches Ladegerät"; rows[1].hardware = "";
  input.costRows = JSON.stringify(rows);
  const { diagnostics } = failure(d.id, input);
  assert.equal(diagnostics[0].targets?.[0].rowId, rows[1].id);
  assert.equal(diagnostics[0].targets?.[0].property, "hardware");
});

test("charging group minimum above its real power targets the actual group without replacing power", () => {
  const d = definition("premium-pkw"), input = defaults(d), grids = JSON.parse(input.grids);
  grids[1].groups[0].minimum = "12"; grids[1].groups[0].power = "11";
  input.grids = JSON.stringify(grids); const before = input.grids;
  const { diagnostics } = failure(d.id, input);
  assert.equal(diagnostics[0].targets?.[0].rowId, `${grids[1].id}/${grids[1].groups[0].id}`);
  assert.equal(diagnostics[0].targets?.[0].property, "minimum");
  assert.match(diagnostics[0].required!, /11/); assert.equal(input.grids, before);
});

test("charging reserve explanation uses the same simultaneous source budget as the model", () => {
  const { result, diagnostics } = evaluate("premium-pkw", { house: "25", reserve: "30", chargingPV: "10", chargingBattery: "0" });
  assert.ok(result.chargingNetwork?.reserveExceeded);
  const issue = diagnostics.find(item => item.id === "charging-reserve")!;
  assert.match(issue.actual!, /30 kW Reserve − 7 kW Quelle = 23 kW netto/);
  assert.ok(issue.required!.includes((result.chargingNetwork!.houseKW + 7).toLocaleString("de-CH", { maximumFractionDigits: 3 })));
  assert.match(issue.action!, /ohne PV bleibt separat/);
});

test("PoE blank second section points at its own length despite identical names", () => {
  const d = definition("premium-poe"), input = defaults(d), rows = JSON.parse(input.poeSegments);
  rows.push({ ...rows[0], id: "second", length: "" }); input.poeSegments = JSON.stringify(rows);
  const { diagnostics } = failure(d.id, input);
  assert.equal(diagnostics[0].targets?.[0].rowId, "second");
  assert.equal(diagnostics[0].targets?.[0].property, "length");
});

test("PoE physical length and electrical budget remain independent checks", () => {
  const d = definition("premium-poe"), input = defaults(d), rows = JSON.parse(input.poeSegments);
  rows[0].length = "110"; input.poeSegments = JSON.stringify(rows);
  const issues = resultDiagnostics(d, input, d.calculate(input));
  assert.ok(issues.some(item => item.id === "poe-physical"));
  assert.ok(issues.some(item => item.id === "poe-electrical"));
});

test("SIA blank consumer cell identifies zone and specific group column", () => {
  const d = definition("premium-sia2056"), input = { ...defaults(d), siaMode: "manual" }, rows = JSON.parse(input.siaZones);
  rows[0].consumers[2].energyDensity = ""; input.siaZones = JSON.stringify(rows);
  const { diagnostics } = failure(d.id, input);
  assert.equal(diagnostics[0].targets?.[0].rowId, rows[0].id);
  assert.equal(diagnostics[0].targets?.[0].property, `${rows[0].consumers[2].groupId}.energyDensity`);
});

test("critical fire evidence remains a failure even under the numerical MJ/m limit", () => {
  const d = definition("brandlast"), input = defaults(d), rows = JSON.parse(input.fireloadRows);
  rows[0].evidence = "critical"; input.fireloadRows = JSON.stringify(rows);
  const result = d.calculate(input), issues = resultDiagnostics(d, input, result);
  assert.ok(issues.some(item => item.id.startsWith("fire-critical")));
  assert.ok(!issues.some(item => item.id.startsWith("fire-budget")));
});

test("hidden fire variant B is not validated or linked while single variant is active", () => {
  const { diagnostics } = evaluate("premium-brandlast", { comparisonEnabled: "no", fireloadRowsAfter: "broken" });
  assert.ok(!diagnostics.some(item => item.targets?.some(target => target.field === "fireloadRowsAfter")));
});

test("row property labels resolve the intended field rather than the first input", () => {
  assert.equal(propertyForLabel("costRows", "Kostenposition · Beschaffung (CHF/LP)"), "hardware");
  assert.equal(propertyForLabel("selectivityStages", "Paargrenze zur vorgelagerten Stufe (kA, optional)"), "pairLimitKA");
  assert.equal(propertyForLabel("selectivityStages", "Hersteller, Geräte und Tabellenquelle"), "pairReference");
  assert.equal(propertyForLabel("grids", "Grid 2, Gruppe 1 · Projekt-Mindestleistung (kW)"), "minimum");
});

test("narrow feasible current interval keeps both limits at a common useful precision", () => {
  const { diagnostics } = evaluate("ls-schalter", { rated: "2", load: "0.99996", iz: "1.00004", i2factor: "1.45" });
  const text = diagnostics.find(item => item.id === "overload-capacity")!.required!;
  assert.match(text, /0\.99996 A ≤ Iₙ ≤ 1\.00004 A/);
  assert.doesNotMatch(text, /kein Nennstrombereich/);
});

test("floating-point-equal LS current limits describe a boundary instead of an inverted or impossible range", () => {
  const edit = { load: "20", iz: "19.999999999999996", i2factor: "1.45" };
  const { diagnostics } = evaluate("ls-schalter", { ...edit, rated: "25" });
  const issue = diagnostics.find(item => item.id === "overload-capacity")!;
  assert.match(issue.required!, /numerisch gleiche Grenze Iₙ ≈ 20 A/);
  assert.doesNotMatch(issue.required!, /kein Nennstrombereich|20 A ≤ Iₙ ≤/);
  const accepted = evaluate("ls-schalter", { ...edit, rated: "20" });
  assert.equal(accepted.result.rows!.find(row => row.label === "Überlastbedingungen")!.value, "erfüllt");
  assert.ok(!accepted.diagnostics.some(item => item.id.startsWith("overload-")));
  const insufficient = evaluate("ls-schalter", { ...edit, iz: "19.99999", rated: "25" });
  assert.match(insufficient.diagnostics.find(item => item.id === "overload-capacity")!.required!, /kein Nennstrombereich/);
});

test("group identifiers reused in separate grids retain the owning grid in their target", () => {
  const d = definition("premium-pkw"), input = defaults(d), grids = JSON.parse(input.grids);
  grids[0].groups[0].id = grids[1].groups[0].id = "same-group";
  grids[1].groups[0].power = ""; input.grids = JSON.stringify(grids);
  const { diagnostics } = failure(d.id, input);
  assert.equal(diagnostics[0].targets?.[0].rowId, `${grids[1].id}/same-group`);
  assert.equal(diagnostics[0].targets?.[0].property, "power");
});
