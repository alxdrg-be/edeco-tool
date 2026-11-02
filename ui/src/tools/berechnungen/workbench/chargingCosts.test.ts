import assert from "node:assert/strict";
import test from "node:test";
import { calculateChargingCosts, defaultCostRows, parseCostRows } from "./chargingCosts.ts";
import { PLANNING } from "./planning.ts";
import { defaults } from "./types.ts";
const definition=PLANNING.find(definition=>definition.id==="premium-ladekosten")!;
const run=(patch:Record<string,string>={})=>calculateChargingCosts({...defaults(definition),...patch});
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<=1e-8*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);

test("four models allocate owned capital and monthly contracting fees independently",()=>{
  const r=run();assert.equal(r.models.length,4);close(r.points,4);close(r.equivalent,4);
  close(r.station,11000);close(r.basis,9200);close(r.energyCost,3500);close(r.maintenanceAnnual,100);
  const [v1,v2,v3,v4]=r.models;
  close(v1.initial,20200);close(v2.initial,20200);close(v3.initial,9200);close(v4.initial,0);
  close(v1.replacement,11000);close(v2.replacement,11000);close(v3.replacement,0);close(v4.replacement,0);
  close(v1.annual,3500+100+4*12*12.5);
  close(v2.annual,3500+4*12*20);
  close(v3.annual,3500+4*12*(20+30));
  close(v4.annual,3500+4*12*(20+30+20));
  for(const model of r.models){close(model.total,model.capex+model.annual*15);close(model.total,model.series.reduce((sum,year)=>sum+year.value+(year.secondary??0),0));}
});

test("11-kW equivalents differ from physical points and maintenance is annual",()=>{
  const rows=[{...defaultCostRows()[0],count:"1",power:"22",annualEnergy:"0",hardware:"0",installation:"0",basis:"0",replacement:"0"}];
  const r=run({costRows:JSON.stringify(rows),backendMonthly:"1",operationMonthly:"1",stationMonthly:"1",basisMonthly:"1",maintenanceEquivalent:"1",replacementCycle:"0"});
  close(r.points,1);close(r.equivalent,2);close(r.maintenanceAnnual,2);
  close(r.models[0].annual,2+12);close(r.models[1].annual,24);
  close(r.models[2].annual,48);close(r.models[3].annual,72);
  assert.match(definition.fields.find(field=>field.key==="maintenanceEquivalent")!.unit!,/Jahr/);
  assert.match(definition.fields.find(field=>field.key==="backendMonthly")!.unit!,/LP·Monat/);
});

test("advanced basis costs and PV tariff are explicit project arithmetic",()=>{
  const r=run({costDetailMode:"advanced",baseConnection:"1000",networkContribution:"200",meterCost:"100",routeMetres:"10",routeUnitPrice:"20",loadManagementCost:"500",planningPercent:"10",costPVShare:"40",costPVTariff:"0.1",dcMaintenance:"0"});
  close(r.basis,(1000+200+100+10*20+500)*1.1);
  close(r.weightedTariff,.6*.25+.4*.1);close(r.energyCost,14000*(.6*.25+.4*.1));
  assert.ok(r.models[3].initial===0);
});

test("replacement after eight completed years falls in year nine and is owned only",()=>{
  const r=run();close(r.models[0].series[7].value,0);close(r.models[0].series[8].value,11000);
  close(r.models[2].series[8].value,0);
  const five=run({years:"5"});assert.equal(five.models[0].series.length,5);close(five.models[0].replacement,0);
  const noReplacement=run({replacementCycle:"0"});close(noReplacement.models[0].replacement,0);
  const thirty=run({years:"30"});close(thirty.models[0].replacement,3*11000);
});

test("cost data are strict and unsupported empty inputs do not silently default",()=>{
  assert.throws(()=>run({costRows:""}));assert.throws(()=>run({costRows:"[]"}));assert.throws(()=>run({buyPrice:""}));
  assert.throws(()=>run({costModel:"V5"}));assert.throws(()=>run({maintenanceEquivalent:""}));
  const rows=defaultCostRows();rows[0].count="0";assert.throws(()=>run({costRows:JSON.stringify(rows)}),/Mindestens einen/);
  rows[0].count="1";rows[0].label="";assert.throws(()=>parseCostRows(JSON.stringify(rows)));assert.doesNotThrow(()=>parseCostRows(JSON.stringify(rows),true));
  const raw=defaultCostRows();raw[0].basis="";assert.throws(()=>run({costRows:JSON.stringify(raw)}));
  assert.doesNotThrow(()=>run({costDetailMode:"advanced",costRows:JSON.stringify(raw)}));
});

test("phased commissioning charges energy, fees and replacements only to the installed cohort",()=>{
  const rows=[{...defaultCostRows()[0],count:"1",commission:"3",hardware:"1000",installation:"500",basis:"100",annualEnergy:"1000",replacement:"1000"}];
  const r=run({costRows:JSON.stringify(rows),years:"5",replacementCycle:"2",backendMonthly:"0",operationMonthly:"0",stationMonthly:"0",basisMonthly:"0",maintenanceEquivalent:"0"});
  const first=r.models[0];close(first.series[0].value,0);close(first.series[0].secondary!,0);
  close(first.series[2].value,1600);close(first.series[2].secondary!,250);
  close(first.series[4].value,1000);close(first.capex,2600);close(first.opex,750);close(first.total,3350);
  close(r.models[2].capex,100);close(r.models[3].capex,0);
  rows[0].commission="";assert.throws(()=>run({costRows:JSON.stringify(rows)}));
});


test("observed Basic AC fixture matches all four totals and the complete V1 cashflow",()=>{
  // Browser observation 2026-11-02, same unmodified Basic input state:
  // https://agent.tinyfish.ai/runs/652c34c0-8ea0-4a8a-a39c-1c980921708c
  // 4 AC points in 2026, purchase2000 +installation750 +basis2300 perLP,
  // annual3500kWh/LP at.25, maintenance25/year/11eq, backend12.5/month/LP,
  // CT operation20/station30/basis20 permonth/11eq. No future cohorts.
  const r=run();
  assert.deepEqual(r.models.map(model=>model.total),[94200,98100,97700,102900]);
  close(r.models[0].capex,31200);close(r.models[0].opex,63000);close(r.models[0].averagePerPointYear,1570);
  close(r.models[1].capex,31200);close(r.models[1].opex,66900);close(r.models[1].averagePerPointYear,1635);
  for(let index=0;index<15;index++){close(r.models[0].series[index].value,index===0?20200:index===8?11000:0);close(r.models[0].series[index].secondary!,4200);}
});
