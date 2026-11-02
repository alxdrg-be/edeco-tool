import assert from "node:assert/strict";
import test from "node:test";
import { createFireComparisonDefinition } from "./fireComparison.ts";
import { defaults, number, validateResult, type CalculatorDefinition, type CalculationResult, type Inputs } from "./types.ts";
import type { FireLoadRow } from "./installation.ts";

const legacy:CalculatorDefinition={
  id:"premium-brandlast",title:"Brandlast Fluchtweg · Vergleich",description:"Gespeicherte Gruppenrechnung",source:"https://www.elektro-rechner.ch/premium/brandlast-fluchtweg.php",scope:"VKF / NIN · manuelle Vorprüfung",
  fields:[
    {key:"routeType",label:"Fluchtwegart",default:"horizontal",kind:"select",options:[{value:"horizontal",label:"Horizontal"},{value:"vertical",label:"Vertikal"}],help:"Fluchtwegart"},
    {key:"route",label:"Fluchtweglänge",default:"20",unit:"m",help:"Bezugsstrecke"},
    {key:"limit",label:"Horizontaler Vergleichswert",default:"200",unit:"MJ/m",visibleWhen:[{key:"routeType",values:["horizontal"]}],help:"Anwendbarkeit separat prüfen"},
    {key:"countBefore1",label:"Gespeicherte Kabelanzahl",default:"20",help:"Bestandswert"},
    {key:"basis",label:"Grundlage",default:"assumed",kind:"text",help:"Bestandsvermerk"},
  ],
  calculate(input) {return {metrics:[{label:"Legacy-Zahl",value:number(input,"countBefore1","Anzahl",0,1000,true)}],status:{tone:"neutral",text:"Bestandsrechnung"},formula:`Bestand ${input.countBefore1}`,limitations:["Manuelle Bestandsdaten"]};},
};
const definition=createFireComparisonDefinition(legacy);
const calculate=(patch:Inputs={})=>definition.calculate({...defaults(definition),...patch});
const metric=(result:CalculationResult,label:string)=>{const value=result.metrics.find(item=>item.label===label)?.value;assert.notEqual(value,undefined,label);return value;};
const close=(value:unknown,expected:number)=>{assert.equal(typeof value,"number");assert.ok(Math.abs((value as number)-expected)<1e-9,`${value} != ${expected}`);};
const rows=(prefix:string,values:readonly (readonly [string,string,string])[],evidence:FireLoadRow["evidence"]="documented")=>JSON.stringify(values.map(([mjPerMeter,quantity,length],index)=>({id:`${prefix}-${index+1}`,name:`Kabel ${index+1}`,mjPerMeter,quantity,length,evidence})));

test("fresh comparisons preserve the calculator ID and hide independent legacy fields without mutating them",()=>{
  assert.equal(definition.id,"premium-brandlast");
  assert.equal(defaults(definition).fireloadMode,"dynamic");
  assert.equal(legacy.fields.find(field=>field.key==="countBefore1")?.visibleWhen,undefined);
  assert.deepEqual(definition.fields.find(field=>field.key==="countBefore1")?.visibleWhen,[{key:"fireloadMode",values:["legacy"]}]);
  assert.deepEqual(definition.fields.find(field=>field.key==="limit")?.visibleWhen,[{key:"routeType",values:["horizontal"]}]);
  assert.ok(definition.fields.find(field=>field.key==="fireloadRowsAfter"));
  const result=calculate();
  close(metric(result,"Vorher"),50);
  close(metric(result,"Nachher"),15);
  close(metric(result,"Kabel vorher"),30);
  close(metric(result,"Kabel nachher"),15);
  assert.equal(result.status.tone,"warning");
});

test("independent lists accept more than two positions and compare both horizontal states against the entered 200-MJ/m value",()=>{
  const before=rows("before",[["2","10","20"],["1","5","20"],["0.5","2","20"]]);
  const after=rows("after",[["1","5","20"],["0.5","2","20"],["0.25","4","20"]]);
  const result=calculate({fireloadRows:before,fireloadRowsAfter:after});
  close(metric(result,"Brandlast vorher total"),520);
  close(metric(result,"Brandlast nachher total"),140);
  close(metric(result,"Vorher"),26);
  close(metric(result,"Nachher"),7);
  close(metric(result,"Kabel vorher"),17);
  close(metric(result,"Kabel nachher"),11);
  close(metric(result,"Reduktion"),73.07692307692308);
  assert.deepEqual(result.comparisons?.[0].items,[{label:"Vorher",actual:26,target:200},{label:"Nachher",actual:7,target:200}]);
  assert.equal(result.status.tone,"neutral");
  assert.ok(result.rows?.some(row=>row.label.includes("Vorher · Kabel 3")));
  assert.ok(result.rows?.some(row=>row.label.includes("Nachher · Kabel 3")));
  assert.match(result.formula,/520 \/ 20 = 26 MJ\/m/);
  assert.match(result.formula,/140 \/ 20 = 7 MJ\/m/);
});

test("zero baseline and increased cable loads never create Infinity or an invented reduction",()=>{
  const empty=calculate({fireloadRows:"[]",fireloadRowsAfter:"[]"});
  assert.equal(empty.status.tone,"neutral");
  close(metric(empty,"Vorher"),0);
  assert.equal(metric(empty,"Reduktion"),"–");
  const added=calculate({fireloadRows:"[]",fireloadRowsAfter:rows("after",[["1","1","20"]])});
  assert.equal(metric(added,"Reduktion"),"–");
  validateResult(added);
  const increased=calculate({fireloadRows:rows("before",[["1","1","20"]]),fireloadRowsAfter:rows("after",[["2","1","20"]])});
  close(metric(increased,"Reduktion"),-100);
});

test("critical and open evidence remain visible even when the final average is below the comparison value",()=>{
  const documented=rows("after",[["1","1","20"]]);
  const critical=calculate({fireloadRows:rows("before",[["1","1","20"]],"critical"),fireloadRowsAfter:documented});
  assert.equal(critical.status.tone,"error");
  assert.ok(critical.rows?.some(row=>row.value==="Kritisches Brandverhalten"));
  const open=calculate({fireloadRows:rows("before",[["1","1","20"]],"open"),fireloadRowsAfter:documented});
  assert.equal(open.status.tone,"warning");
  const over=calculate({fireloadRows:rows("before",[["250","1","20"]]),fireloadRowsAfter:documented});
  assert.equal(over.status.tone,"error");
});

test("vertical comparison uses unrestricted quantities and two plain bars without a horizontal target",()=>{
  const result=calculate({routeType:"vertical",limit:"",fireloadRows:rows("before",[["500","2","20"]]),fireloadRowsAfter:rows("after",[["400","2","20"]])});
  assert.equal(result.status.tone,"warning");
  assert.equal(result.comparisons,undefined);
  assert.equal(result.series?.length,2);
  assert.deepEqual(result.series,[{label:"Vorher",value:1000},{label:"Nachher",value:800}]);
  assert.ok(!result.rows?.some(row=>row.label==="Horizontaler Vergleichswert"));
  assert.doesNotMatch(result.formula,/200/);
  close(metric(result,"Brandlast vorher total"),20000);
});

test("invalid rows and common numeric fields produce an error instead of another model or substitute value",()=>{
  const blank=JSON.stringify([{id:"a",name:"Kabel",mjPerMeter:"",quantity:"1",length:"20",evidence:"open"}]);
  assert.throws(()=>calculate({fireloadRows:blank}));
  assert.throws(()=>calculate({fireloadRowsAfter:"not JSON"}));
  assert.throws(()=>calculate({fireloadRowsAfter:JSON.stringify([{id:"a",name:"Kabel",mjPerMeter:"1",quantity:"1.5",length:"20",evidence:"open"}])}));
  assert.throws(()=>calculate({route:""}));
  assert.throws(()=>calculate({limit:""}));
  assert.throws(()=>calculate({fireloadMode:""}));
  assert.throws(()=>calculate({routeType:""}));
});

test("legacy calculation retains its original fields and ignores hidden new JSON lists",()=>{
  const input={...defaults(definition),fireloadMode:"legacy",countBefore1:"37",fireloadRows:"broken",fireloadRowsAfter:"broken"};
  assert.deepEqual(definition.calculate(input),legacy.calculate(input));
  assert.throws(()=>definition.calculate({...input,countBefore1:""}));
});
