import assert from "node:assert/strict";
import test from "node:test";
import { INSTALLATION } from "./installation.ts";
import { defaults, type Inputs, type CalculationResult } from "./types.ts";
const definition = (id: string) => { const found=INSTALLATION.find(d=>d.id===id);assert.ok(found);return found; };
const calculate = (id: string, patch: Inputs={}) => { const d=definition(id);return d.calculate({...defaults(d),...patch}); };
const metric = (r: CalculationResult, label: string) => { const m=r.metrics.find(m=>m.label===label);assert.ok(m);return m.value; };
const near=(actual:unknown,expected:number,tolerance=1e-9)=>{assert.equal(typeof actual,"number");assert.ok(Math.abs((actual as number)-expected)<tolerance,`${actual} vs ${expected}`);};

test("installation catalogue has seven functional independent definitions and finite default results",()=>{
  assert.equal(INSTALLATION.length,7);assert.equal(new Set(INSTALLATION.map(d=>d.id)).size,7);
  for(const d of INSTALLATION){const r=d.calculate(defaults(d));assert.ok(r.metrics.length>=3,d.id);assert.ok(r.formula&&r.limitations.length,d.id);assert.ok(d.source.startsWith("https://www.elektro-rechner.ch/"));for(const m of r.metrics)if(typeof m.value==="number")assert.ok(Number.isFinite(m.value),`${d.id}: ${m.label}`);assert.throws(()=>d.calculate({...defaults(d),[d.fields.find(f=>!f.kind||f.kind==="number")!.key]:""}),d.id);}
});

test("NIN table calculation applies correction factors and checks both overload inequalities",()=>{
  const r=calculate("nin-kabelrechner");near(metric(r,"Korrigierte Strombelastbarkeit Iz"),34.8);assert.equal(r.status.tone,"ok");
  assert.equal(calculate("nin-kabelrechner",{in:"40"}).status.tone,"error");
  assert.equal(calculate("nin-kabelrechner",{i2factor:"2"}).status.tone,"error");
  assert.equal(calculate("nin-kabelrechner",{ib:"40"}).status.tone,"error");
  assert.throws(()=>calculate("nin-kabelrechner",{grouping:"1.01"}));
  assert.throws(()=>calculate("nin-kabelrechner",{method:"unknown"}));
});

test("parallel circuit budget conserves the entered equal current split",()=>{
  const r=calculate("strombelastbarkeit");near(metric(r,"Gesamt-Iz"),374);near(metric(r,"Iz je Stromkreis"),187);near(metric(r,"Betriebsstrom je Kreis"),125);assert.equal(r.status.tone,"ok");
  assert.equal(calculate("strombelastbarkeit",{load:"400"}).status.tone,"error");
  assert.throws(()=>calculate("strombelastbarkeit",{circuits:"1.5"}));
});

test("LS test distinguishes breaking capacity, overload and conservative magnetic trigger check",()=>{
  const ok=calculate("ls-schalter");assert.equal(ok.status.tone,"ok");assert.equal(metric(ok,"Magnetischer Auslösebereich"),"48–80");
  assert.equal(calculate("ls-schalter",{curve:"C"}).status.tone,"warning");
  assert.equal(calculate("ls-schalter",{icn:"1"}).status.tone,"error");
  assert.equal(calculate("ls-schalter",{iz:"12"}).status.tone,"error");
  assert.throws(()=>calculate("ls-schalter",{ikMin:"6000"}));
  assert.throws(()=>calculate("ls-schalter",{curve:"Z"}));
  assert.ok(ok.limitations.some(text=>text.includes("Kein Selektivitäts")));
});

test("bonding uses explicit Swiss HPA table input and separate additional-PA relation",()=>{
  const r=calculate("potenzialausgleich");assert.equal(metric(r,"Haupt-PA aus den Eingaben"),10);assert.equal(metric(r,"Zusätzlicher PA"),10);
  assert.equal(metric(calculate("potenzialausgleich",{pe:"16",hpaTable:"6",lps:"yes"}),"Haupt-PA aus den Eingaben"),10);
  assert.equal(metric(calculate("potenzialausgleich",{connection:"bodies"}),"Zusätzlicher PA"),16);
  assert.equal(metric(calculate("potenzialausgleich",{pe:"6",hpaTable:"6",minimum:"4"}),"Zusätzlicher PA"),4);
  assert.throws(()=>calculate("potenzialausgleich",{pe:"631"}));
});

test("PV finance agrees with a closed-form constant-yield case, including payback and LCOE",()=>{
  const r=calculate("pva-rechner",{area:"100",usable:"100",efficiency:"20",yield:"1000",orientation:"100",cost:"1000",grant:"0",self:"50",tariff:"0.3",feed:"0.1",om:"0",degradation:"0",years:"10",discount:"0"});
  near(metric(r,"Anlageleistung · STC"),20);near(metric(r,"Jahresertrag · Jahr 1"),20);near(metric(r,"Nettoinvestition"),20000);near(metric(r,"Amortisation"),5);near(metric(r,"Diskontierte Gestehungskosten"),10);near(metric(r,"Kapitalwert"),20000);assert.equal(r.series?.length,10);
  assert.throws(()=>calculate("pva-rechner",{grant:"1000000"}));
  assert.throws(()=>calculate("pva-rechner",{years:"2.5"}));
  assert.equal(calculate("pva-rechner",{tariff:"0",feed:"0"}).status.tone,"warning");
  const degraded=calculate("pva-rechner",{degradation:"1"});assert.ok(degraded.series![24].value<degraded.series![0].value);
});

test("brandload sums partial cable lengths and never approves vertical or undocumented routes",()=>{
  const r=calculate("brandlast");near(metric(r,"Brandlast total"),315);near(metric(r,"Brandlast bezogen auf Fluchtweg"),31.5);assert.equal(metric(r,"Kabel total"),15);assert.equal(r.status.tone,"warning");
  assert.equal(calculate("brandlast",{proof:"documented"}).status.tone,"ok");
  assert.equal(calculate("brandlast",{proof:"critical"}).status.tone,"error");
  assert.equal(calculate("brandlast",{proof:"documented",route:"vertical"}).status.tone,"warning");
  assert.equal(calculate("brandlast",{proof:"documented",limit:"20"}).status.tone,"error");
  assert.throws(()=>calculate("brandlast",{n1:"1",q1:"0"}));
  const empty=calculate("brandlast",{n1:"0",n2:"0",n3:"0"});near(metric(empty,"Brandlast total"),0);
});

test("PoE parallel-pair model conserves energy and explicit current cap",()=>{
  const r=calculate("poe",{voltage:"50",power:"50",circuits:"2",maxCurrent:"1",length:"100",resistance:"10",temperature:"20",connector:"0"});
  near(metric(r,"Leistung am Endgerät"),45);near(metric(r,"Kabel-/Kontaktverlust"),5);near(metric(r,"Spannung am Endgerät"),45);near(metric(r,"DC-Spannungsfall"),10);
  const limited=calculate("poe",{voltage:"50",power:"100",circuits:"1",maxCurrent:"0.5",length:"100",resistance:"10",temperature:"20",connector:"0"});
  near(metric(limited,"Leistung am Endgerät"),22.5);near(metric(limited,"Kabel-/Kontaktverlust"),2.5);assert.equal(limited.status.tone,"warning");
  const hotter=calculate("poe",{temperature:"70"}),cooler=calculate("poe",{temperature:"20"});assert.ok(Number(metric(hotter,"Kabel-/Kontaktverlust"))>Number(metric(cooler,"Kabel-/Kontaktverlust")));
  assert.throws(()=>calculate("poe",{length:"10000",resistance:"100"}));
  assert.throws(()=>calculate("poe",{circuits:"3"}));
});
