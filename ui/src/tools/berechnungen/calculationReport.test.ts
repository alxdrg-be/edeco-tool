import assert from "node:assert/strict";
import test from "node:test";
import { workbenchReport, CALCULATION_NORMS, calculationNorm } from "./calculationReport.ts";
import { CALCULATORS } from "./workbench/definitions.ts";
import { defaults } from "./workbench/types.ts";

test('new reference modes are labelled by source scope, without mislabelling them as manual or certified',()=>{
  const sia=calculationNorm('premium-sia2056',{siaMode:'automatic'});
  assert.match(sia,/Referenzprofile/);assert.doesNotMatch(sia,/manuelle/);
  assert.match(calculationNorm('premium-brandmelder',{detectorBasis:'reference'}),/Mengen.*Material/);
  assert.match(calculationNorm('premium-ladekosten',{costAccounting:'reference'}),/Klassenansatz/);
  assert.match(calculationNorm('premium-selektivitaet',{selectivityMode:'stages'}),/Kabelpfad/);
});
import { fireCableSelection } from "./workbench/fireCableData.ts";

test('variable selectivity reports name each actual device and cable without raw JSON',()=>{
  const definition=CALCULATORS.find(item=>item.id==='premium-selektivitaet')!;
  const input=defaults(definition);
  const report=workbenchReport(definition,input,definition.calculate(input));
  assert.ok(report.inputs.some(row=>row.label.includes('Hausanschluss-Sicherung')&&row.value.includes('250 A')));
  assert.ok(report.inputs.some(row=>row.label==='Stufe 3 · Zuleitung'&&row.value.includes('40 m')&&row.value.includes('2.5 mm²')&&row.value.includes('230 V')));
  assert.ok(report.inputs.every(row=>!row.value.startsWith('[{')));
});

test("a calculation report contains the current result and only applicable mode inputs", () => {
  const definition = CALCULATORS.find(item => item.id === "ohmsches-gesetz")!;
  const input = { ...defaults(definition), system: "dc", known: "ui", voltage: "48", current: "2", power: "999999", impedance: "999999", cos: "" };
  const report = workbenchReport(definition, input, definition.calculate(input), "Motorraum prüfen", { number: "1498", name: "Schulhaus" });
  assert.equal(report.inputs.some(item => /cos|Wirkleistung|R \/ /.test(item.label)), false);
  assert.ok(report.results.some(item => item.value === "96 W"));
  assert.ok(report.results.some(item => item.value === "24 Ω"));
  assert.ok(report.notes.includes("Projektnotizen: Motorraum prüfen"));
  assert.ok(report.inputs.some(item => item.label === "Projekt" && item.value === "1498 · Schulhaus"));
  assert.ok(!JSON.stringify(report).includes("999999"));
});

test("every workbench report carries an explicit normative reference or planning assumption", () => {
  for (const definition of CALCULATORS) {
    const input = defaults(definition), report = workbenchReport(definition, input, definition.calculate(input));
    assert.ok(CALCULATION_NORMS[definition.id], definition.id);
    assert.ok(report.formula && report.status && report.inputs.length && report.results.length, definition.id);
    assert.ok(report.notes.length, definition.id);
  }
});

test("dynamic fire comparison reports both actual cable lists with distinct before/after context", () => {
  const definition = CALCULATORS.find(item => item.id === "premium-brandlast")!;
  const input = { ...defaults(definition), comparisonEnabled: "yes", fireloadRows: JSON.stringify([{ id: "before", name: "Kabel X", mjPerMeter: "2", quantity: "7", length: "10", evidence: "open" }]), fireloadRowsAfter: JSON.stringify([{ id: "after", name: "Kabel X", mjPerMeter: "1", quantity: "3", length: "10", evidence: "documented" }]) };
  const report = workbenchReport(definition, input, definition.calculate(input));
  assert.ok(report.inputs.some(row => row.label === "Vorher · Kabel X · Bestand" && row.value === "7 × 10 m · 2 MJ/m"));
  assert.ok(report.inputs.some(row => row.label === "Nachher · Kabel X · Bestand" && row.value === "3 × 10 m · 1 MJ/m"));
  assert.ok(report.inputs.every(row => !row.value.startsWith("[{")));
  assert.ok(report.results.some(row => row.label === "Kabel vorher" && row.value === "7 Stk."));
});

test("single fire variant reports A only and never reads the hidden saved B list",()=>{
  const definition=CALCULATORS.find(item=>item.id==="premium-brandlast")!;
  const input={...defaults(definition),comparisonEnabled:"no",fireloadRowsAfter:"not JSON"};
  const result=definition.calculate(input),report=workbenchReport(definition,input,result,"",null);
  assert.ok(report.inputs.some(row=>row.label.startsWith("Variante A · Kabelposition")));
  assert.ok(!report.inputs.some(row=>row.label.startsWith("Nachher · ")));
  assert.ok(!result.metrics.some(metric=>metric.label==="Reduktion"));
});

test("fire report preserves selected supplier/CPR provenance and effective critical status", () => {
  const definition=CALCULATORS.find(item=>item.id==="brandlast")!;
  const critical={id:"catalogue-critical",...fireCableSelection("bio-st-2x1.5-dca-s2-d2-a2"),quantity:"1",length:"10",evidence:"documented"};
  const supplier={id:"catalogue-supplier",...fireCableSelection("fe05c-2x1.5-cca-s1-d1-a1","Kablan"),quantity:"2",length:"10"};
  const input={...defaults(definition),fireloadRows:JSON.stringify([critical,supplier])};
  const report=workbenchReport(definition,input,definition.calculate(input));
  assert.ok(report.inputs.some(row=>row.label.includes("CPR")&&row.value==="Dca-s2,d2,a2"));
  assert.ok(report.inputs.some(row=>row.label.includes(critical.name)&&row.label.includes("Nachweisstatus")&&row.value==="Kritisches Brandverhalten"));
  assert.ok(report.inputs.some(row=>row.label.includes("Datenquelle")&&row.value.includes("ca.-Richtwert")));
  assert.ok(report.inputs.some(row=>row.label.includes("Lieferant")&&row.value.includes("Kablan · Artikel 109010202Cca")));
  assert.ok(report.inputs.some(row=>row.label.includes("Bestand")&&row.value.includes("0.57 MJ/m")));
});
