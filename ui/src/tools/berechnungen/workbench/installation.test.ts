import assert from "node:assert/strict";
import test from "node:test";
import { INSTALLATION, calculateFireLoadPositions, createFireLoadRow, parseFireLoadRows, type FireLoadPosition } from "./installation.ts";
import { lookupPublishedIz, publishedAreas, publishedTemperatureFactor, publishedGroupingFactor, POE_CABLE_REFERENCES, publishedMinimumFeedRp, publishedPvGrant } from "./referenceInstallationData.ts";
import { defaults, type Inputs, type CalculationResult } from "./types.ts";
const definition = (id: string) => { const found=INSTALLATION.find(d=>d.id===id);assert.ok(found);return found; };
const calculate = (id: string, patch: Inputs={}) => { const d=definition(id);return d.calculate({...defaults(d),...(id==="strombelastbarkeit"&&patch.tableMode==="manual"?{circuits:"2"}:{}),...patch}); };
const projectPV = (patch:Inputs={}) => calculate("pva-rechner",{roof:"manual",modulePreset:"manual",tariffPreset:"manual",feedPreset:"manual",grantMode:"manual",headlineBasis:"net",...patch});
const metric = (r: CalculationResult, label: string) => { const m=r.metrics.find(m=>m.label===label);assert.ok(m);return m.value; };
const near=(actual:unknown,expected:number,tolerance=1e-9)=>{assert.equal(typeof actual,"number");assert.ok(Math.abs((actual as number)-expected)<tolerance,`${actual} vs ${expected}`);};

test("installation catalogue has seven functional independent definitions and finite default results",()=>{
  assert.equal(INSTALLATION.length,7);assert.equal(new Set(INSTALLATION.map(d=>d.id)).size,7);
  for(const d of INSTALLATION){const r=d.calculate(defaults(d));assert.ok(r.metrics.length>=3,d.id);assert.ok(r.formula&&r.limitations.length,d.id);assert.ok(d.source.startsWith("https://www.elektro-rechner.ch/"));for(const m of r.metrics)if(typeof m.value==="number")assert.ok(Number.isFinite(m.value),`${d.id}: ${m.label}`);assert.throws(()=>d.calculate({...defaults(d),[d.fields[0].key]:""}),d.id);}
});

test("NIN table calculation applies correction factors and checks both overload inequalities",()=>{
  const r=calculate("nin-kabelrechner",{tableMode:"manual"});near(metric(r,"Korrigierte Strombelastbarkeit Iz"),34.8);assert.equal(r.status.tone,"ok");
  assert.equal(calculate("nin-kabelrechner",{tableMode:"manual",in:"40"}).status.tone,"error");
  assert.equal(calculate("nin-kabelrechner",{tableMode:"manual",i2factor:"2"}).status.tone,"error");
  assert.equal(calculate("nin-kabelrechner",{tableMode:"manual",ib:"40"}).status.tone,"error");
  assert.throws(()=>calculate("nin-kabelrechner",{tableMode:"manual",grouping:"1.01"}));
  assert.throws(()=>calculate("nin-kabelrechner",{tableMode:"manual",method:"unknown"}));
});

test("parallel circuit budget conserves the entered equal current split",()=>{
  const r=calculate("strombelastbarkeit",{tableMode:"manual"});near(metric(r,"Gesamt-Iz"),374);near(metric(r,"Iz je Stromkreis"),187);near(metric(r,"Betriebsstrom je Kreis"),125);assert.equal(r.status.tone,"ok");
  assert.equal(calculate("strombelastbarkeit",{tableMode:"manual",load:"400"}).status.tone,"error");
  assert.throws(()=>calculate("strombelastbarkeit",{tableMode:"manual",circuits:"1.5"}));
});

test("LS test distinguishes breaking capacity, overload and conservative magnetic trigger check",()=>{
  const ok=calculate("ls-schalter");assert.equal(ok.status.tone,"ok");assert.equal(metric(ok,"Magnetischer Auslösebereich"),"48–80");
  assert.equal(calculate("ls-schalter",{curve:"C"}).status.tone,"warning");
  assert.equal(calculate("ls-schalter",{icn:"1"}).status.tone,"error");
  assert.equal(calculate("ls-schalter",{iz:"12"}).status.tone,"error");
  assert.throws(()=>calculate("ls-schalter",{ikMin:"6000"}));
  assert.throws(()=>calculate("ls-schalter",{curve:"X"}));
  assert.ok(ok.limitations.some(text=>text.includes("Kein Selektivitäts")));
});

test("bonding uses explicit Swiss HPA table input and separate additional-PA relation",()=>{
  const r=calculate("potenzialausgleich",{paMode:"manual"});assert.equal(metric(r,"Haupt-PA aus den Eingaben"),10);assert.equal(metric(r,"Zusätzlicher PA"),10);
  assert.equal(metric(calculate("potenzialausgleich",{paMode:"manual",pe:"16",hpaTable:"6",lps:"yes"}),"Haupt-PA aus den Eingaben"),10);
  assert.equal(metric(calculate("potenzialausgleich",{paMode:"manual",connection:"bodies"}),"Zusätzlicher PA"),16);
  assert.equal(metric(calculate("potenzialausgleich",{paMode:"manual",pe:"6",hpaTable:"6",minimum:"4"}),"Zusätzlicher PA"),4);
  assert.throws(()=>calculate("potenzialausgleich",{paMode:"manual",pe:"631"}));
});

test("PV finance agrees with a closed-form constant-yield case, including payback and LCOE",()=>{
  const r=projectPV({sizing:"area",area:"100",usable:"100",efficiency:"20",yield:"1000",orientation:"100",cost:"1000",grant:"0",self:"50",tariff:"0.3",feed:"0.1",om:"0",degradation:"0",years:"10",discount:"0"});
  near(metric(r,"Anlageleistung · STC"),20);near(metric(r,"Jahresertrag · Jahr 1"),20);near(metric(r,"Nettoinvestition"),20000);near(metric(r,"Amortisation"),5);near(metric(r,"Diskontierte Gestehungskosten"),10);near(metric(r,"Kapitalwert"),20000);assert.equal(r.series?.length,10);
  assert.throws(()=>projectPV({grant:"1000000"}));
  assert.throws(()=>projectPV({years:"2.5"}));
  assert.equal(projectPV({tariff:"0",feed:"0"}).status.tone,"warning");
  const degraded=projectPV({degradation:"1"});assert.ok(degraded.series![24].value<degraded.series![0].value);
});

test("brandload sums partial cable lengths and never approves vertical or undocumented routes",()=>{
  const r=calculate("brandlast",{fireloadMode:"legacy"});near(metric(r,"Brandlast total"),315);near(metric(r,"Brandlast bezogen auf Fluchtweg"),31.5);assert.equal(metric(r,"Kabel total"),15);assert.equal(r.status.tone,"warning");
  assert.equal(calculate("brandlast",{fireloadMode:"legacy",proof:"documented"}).status.tone,"ok");
  assert.equal(calculate("brandlast",{fireloadMode:"legacy",proof:"critical"}).status.tone,"error");
  assert.equal(calculate("brandlast",{fireloadMode:"legacy",proof:"documented",route:"vertical"}).status.tone,"warning");
  assert.equal(calculate("brandlast",{fireloadMode:"legacy",proof:"documented",limit:"20"}).status.tone,"error");
  assert.throws(()=>calculate("brandlast",{fireloadMode:"legacy",n1:"1",q1:"0"}));
  const empty=calculate("brandlast",{fireloadMode:"legacy",n1:"0",n2:"0",n3:"0"});near(metric(empty,"Brandlast total"),0);
});

test("PoE parallel-pair model conserves energy and explicit current cap",()=>{
  const r=calculate("poe",{cable:"manual",type:"manual",voltage:"50",power:"50",circuits:"2",maxCurrent:"1",length:"100",resistance:"10",temperature:"20",connector:"0"});
  near(metric(r,"Leistung am Endgerät"),45);near(metric(r,"Kabel-/Kontaktverlust"),5);near(metric(r,"Spannung am Endgerät"),45);near(metric(r,"DC-Spannungsfall"),10);
  const limited=calculate("poe",{cable:"manual",type:"manual",voltage:"50",power:"100",circuits:"1",maxCurrent:"0.5",length:"100",resistance:"10",temperature:"20",connector:"0"});
  near(metric(limited,"Leistung am Endgerät"),22.5);near(metric(limited,"Kabel-/Kontaktverlust"),2.5);assert.equal(limited.status.tone,"warning");
  const hotter=calculate("poe",{cable:"manual",temperature:"70"}),cooler=calculate("poe",{cable:"manual",temperature:"20"});assert.ok(Number(metric(hotter,"Kabel-/Kontaktverlust"))>Number(metric(cooler,"Kabel-/Kontaktverlust")));
  assert.throws(()=>calculate("poe",{cable:"manual",length:"10000",resistance:"100"}));
  assert.throws(()=>calculate("poe",{cable:"manual",type:"manual",circuits:"3"}));
});


test("NIN documents the selected core count and parallel Iz without inventing automatic table values", () => {
  const r=calculate("nin-kabelrechner",{tableMode:"manual",parallel:"2",arrangement:"unlaid",area:"16",cores:"2",iz0:"50",temperature:"0.87",grouping:"0.8"});
  near(metric(r,"Korrigierte Strombelastbarkeit Iz"),69.6);
  assert.equal(r.status.tone,"warning");
  assert.match(r.status.text,/5\.2\.3\.7/);
  assert.match(r.formula,/50 × 0.87 × 0.8 × 2 = 69.6 A/);
  assert.throws(()=>calculate("nin-kabelrechner",{tableMode:"manual",cores:"4"}));
  assert.throws(()=>calculate("nin-kabelrechner",{tableMode:"manual",parallel:""}));
  assert.throws(()=>calculate("nin-kabelrechner",{tableMode:"manual",area:"2.6"}));
});

test("ampacity really applies k_temp and labels its manual E/F data", () => {
  const r=calculate("strombelastbarkeit",{tableMode:"manual",temperature:"0.9"});
  near(metric(r,"Iz je Stromkreis"),168.3);
  near(metric(r,"Gesamt-Iz"),336.6);
  assert.match(r.formula,/k_temp/);
  assert.match(r.formula,/220 × 0.9 × 0.85/);
  assert.ok(definition("strombelastbarkeit").fields.find(field=>field.key==="method")?.options?.some(option=>option.value==="E"));
  assert.throws(()=>calculate("strombelastbarkeit",{tableMode:"manual",temperature:""}));
  assert.throws(()=>calculate("strombelastbarkeit",{tableMode:"manual",area:"96"}));
});

test("K/Z assumptions never become an LS–LS selectivity or unproven NH backup approval", () => {
  for(const [curve,range] of [["K","128–224"],["Z","32–48"]]) {
    const r=calculate("ls-schalter",{curve,ikMin:"1000"});
    assert.equal(metric(r,"Magnetischer Auslösebereich"),range);
    assert.equal(r.status.tone,"warning");
    assert.match(r.status.text,/Herstellerannahme/);
    assert.equal(r.rows?.find(row=>row.label==="NH-Backup")?.value,"Kein belegter Backup-Wert");
    assert.match(String(r.rows?.find(row=>row.label==="LS–LS")?.value),/nicht nachgewiesen/);
  }
});

test("PV whole-module sizing floors the usable count and direct power ignores hidden geometric fields", () => {
  const r=projectPV({sizing:"modules",area:"101",usable:"100",moduleArea:"2",efficiency:"20"});
  near(metric(r,"Anlageleistung · STC"),20);
  assert.match(String(r.rows?.find(row=>row.label==="Leistungsansatz")?.value),/50 ganze Module/);
  assert.match(r.formula,/floor\(101 × 1 \/ 2\) = 50/);
  const direct=projectPV({sizing:"power",power:"12.5",area:"",usable:"",efficiency:"",moduleArea:""});
  near(metric(direct,"Anlageleistung · STC"),12.5);
  assert.throws(()=>projectPV({sizing:"modules",moduleArea:""}));
  assert.throws(()=>projectPV({sizing:"modules",area:"1",moduleArea:"2",usable:"100"}));
  assert.throws(()=>projectPV({sizing:"power",power:""}));
  assert.equal(metric(projectPV({tariff:"0",feed:"0"}),"Amortisation"),"über 25 Jahre");
});

test("PoE uses the selected type's PD minimum instead of a universal 37-V test", () => {
  for(const [type,circuits,minimum] of [["1","1",37],["2","1",42.5],["3","2",42.5],["4","2",41.1]] as const) {
    const r=calculate("poe",{cable:"manual",type,circuits});
    near(r.rows?.find(row=>row.label==="PD-Mindestspannung")?.value,minimum);
    assert.match(String(r.rows?.find(row=>row.label==="Ausgewählter Typ")?.value),new RegExp(`Typ ${type}`));
  }
  const lowType4=calculate("poe",{cable:"manual",type:"4",voltage:"48",power:"90",circuits:"2",maxCurrent:"1",length:"90",resistance:"8.5",temperature:"20",connector:"0"});
  near(metric(lowType4,"Spannung am Endgerät"),40.828125);
  assert.equal(lowType4.status.tone,"error");
  assert.match(lowType4.status.text,/41.1 V/);
  assert.equal(calculate("poe",{cable:"manual",length:"101"}).status.tone,"error");
  assert.equal(calculate("poe",{cable:"manual",type:"2",circuits:""}).rows?.find(row=>row.label==="Speisende Paargruppen")?.value,1);
  assert.throws(()=>calculate("poe",{cable:"manual",type:""}));
  assert.throws(()=>calculate("poe",{cable:"manual",resistance:""}));
});


test("published Cu Iz snapshot covers the actual method/isolation/core combination and leaves gaps null", () => {
  const config={material:"cu" as const,isolation:"pvc" as const,cores:3 as const,method:"B1"};
  near(lookupPublishedIz({...config,area:16}),68);
  near(lookupPublishedIz({...config,method:"B2",area:16}),62);
  near(lookupPublishedIz({...config,cores:2,method:"A1",area:1.5}),14.5);
  near(lookupPublishedIz({...config,cores:2,method:"A2",area:1.5}),14);
  near(lookupPublishedIz({...config,isolation:"xlpe",method:"E",area:16}),100);
  near(lookupPublishedIz({...config,isolation:"xlpe",method:"F",area:400}),823);
  assert.equal(lookupPublishedIz({...config,method:"F",area:16}),null);
  assert.equal(lookupPublishedIz({...config,method:"D1",area:16}),null);
  assert.equal(lookupPublishedIz({...config,area:2.6}),null);
  assert.equal(publishedAreas({...config,method:"E"}).at(-1),300);
  assert.equal(publishedAreas({...config,method:"F"})[0],25);
});

test("automatic NIN factors distinguish ground, air and lightly loaded grouping", () => {
  near(publishedTemperatureFactor("pvc",30,"D"),.89);
  near(publishedTemperatureFactor("pvc",30,"B2"),1);
  near(publishedGroupingFactor(2,"D"),.75);
  near(publishedGroupingFactor(2,"B2"),.8);
  assert.equal(publishedGroupingFactor(7,"D"),null);
  assert.equal(publishedTemperatureFactor("pvc",65,"B2"),null);
  const r=calculate("nin-kabelrechner",{tableMode:"published",method:"B1",area:"16",ambient:"40",groupingMode:"included",groupCount:"4",lightlyLoaded:"1",parallel:"2"});
  near(metric(r,"Korrigierte Strombelastbarkeit Iz"),82.824);
  assert.equal(r.rows?.find(row=>row.label==="Wirksame Häufungszahl")?.value,3);
  assert.match(r.formula,/68 × 0.87 × 0.7 × 2/);
  const two=calculate("nin-kabelrechner",{tableMode:"published",method:"B1",area:"16",cores:"2",ambient:"30"});
  near(metric(two,"Korrigierte Strombelastbarkeit Iz"),76);
  assert.throws(()=>calculate("nin-kabelrechner",{tableMode:"published",method:"F",area:"16"}));
  assert.throws(()=>calculate("nin-kabelrechner",{tableMode:"published",method:"D",groupingMode:"included",groupCount:"7",lightlyLoaded:"0"}));
  assert.throws(()=>calculate("nin-kabelrechner",{tableMode:"published",groupingMode:"included",groupCount:"3",lightlyLoaded:"3"}));
  assert.throws(()=>calculate("nin-kabelrechner",{tableMode:"published",ambient:""}));
});

test("automatic NIN inverse search returns the least supported section without largest-size fallback", () => {
  const r=calculate("nin-kabelrechner",{tableMode:"published",search:"section",method:"B2",isolation:"pvc",cores:"3",ib:"50",in:"50",ambient:"30",area:""});
  near(metric(r,"Gefundener Querschnitt"),16);
  near(metric(r,"Korrigierte Strombelastbarkeit Iz"),62);
  assert.ok(r.rows?.some(row=>row.label==="Verlegeart B1 · 16 mm²"&&row.value==="68 A"));
  assert.throws(()=>calculate("nin-kabelrechner",{tableMode:"published",search:"section",ib:"10000",in:"10000"}));
});

test("automatic tray presets use E/F base data and the actual PVC/XLPE/CFW grouping row", () => {
  const e=calculate("strombelastbarkeit",{tableMode:"published",type:"xlpe",method:"E",area:"70",ambient:"30",circuits:"2",base:"",temperature:"",grouping:""});
  near(metric(e,"Iz je Stromkreis"),216.48);
  near(metric(e,"Gesamt-Iz"),432.96);
  const f=calculate("strombelastbarkeit",{tableMode:"published",type:"pvc",method:"F",area:"70",circuits:"3"});
  near(metric(f,"Gesamt-Iz"),531.36);
  const cfw=calculate("strombelastbarkeit",{tableMode:"published",type:"cfw",method:"E",area:"95",circuits:"2"});
  near(metric(cfw,"Gesamt-Iz"),600.78);
  assert.throws(()=>calculate("strombelastbarkeit",{tableMode:"published",type:"cfw",ambient:"40"}));
  assert.throws(()=>calculate("strombelastbarkeit",{tableMode:"published",type:"xlpe",method:"F",area:"16"}));
});

test("published bonding derives PE/HPA from phase, checks PEN, and keeps the additional-PA connection case", () => {
  const r=calculate("potenzialausgleich",{paMode:"published",phase:"50",pen:"16",epa:"6",pe:"",hpaTable:"",minimum:""});
  near(metric(r,"Haupt-PA aus den Eingaben"),16);
  near(metric(r,"Massgebender Schutzleiter PE"),25);
  near(metric(r,"Zusätzlicher PA"),16);
  near(metric(r,"Funktionserdung · Referenzansatz"),16);
  assert.equal(r.status.tone,"warning");
  const bodies=calculate("potenzialausgleich",{paMode:"published",phase:"50",pen:"25",connection:"bodies"});
  near(metric(bodies,"Zusätzlicher PA"),25);
  const lps=calculate("potenzialausgleich",{paMode:"published",phase:"4",pen:"4",lps:"yes"});
  near(metric(lps,"Haupt-PA aus den Eingaben"),10);
  near(metric(lps,"Zusätzlicher PA"),4);
  assert.throws(()=>calculate("potenzialausgleich",{paMode:"published",phase:"150"}));
  assert.throws(()=>calculate("potenzialausgleich",{paMode:"published",pen:""}));
  near(metric(calculate("potenzialausgleich",{paMode:"manual",hpaTable:"40"}),"Haupt-PA aus den Eingaben"),50);
});

test("LS upstream and circuit-class changes keep manufacturer's time/coordination evidence explicit", () => {
  const distributed=calculate("ls-schalter",{circuitType:"distribution",curve:"C",ikMin:"120"});
  assert.equal(distributed.status.tone,"warning");
  assert.match(String(distributed.rows?.find(row=>row.label==="Abschaltzeit · TN-Planungsansatz")?.value),/5 s.*Herstellerkennlinie/);
  assert.match(String(distributed.rows?.find(row=>row.label==="Magnetisches Ansprechen möglich")?.value),/80 A erreicht/);
  const backed=calculate("ls-schalter",{ikMax:"20",upstreamType:"nh",upstream:"125",backupMode:"documented",backupLimit:"25",backupReference:"Hersteller / Serie / Tabelle / Bedingungen"});
  near(metric(backed,"Ausschaltreserve"),5);
  assert.equal(backed.status.tone,"warning");
  assert.match(backed.status.text,/manuell dokumentierte/);
  assert.throws(()=>calculate("ls-schalter",{backupMode:"documented",backupReference:""}));
  assert.throws(()=>calculate("ls-schalter",{backupMode:"documented",upstreamType:"ls",backupReference:"Tabelle"}));
  assert.throws(()=>calculate("ls-schalter",{circuitType:""}));
});

test("public PoE presets choose wire resistance and homogeneous design RP without reading hidden manual budgets", () => {
  assert.equal(POE_CABLE_REFERENCES.length,10);
  const r=calculate("poe",{type:"2",cable:"cat6-s-awg23",voltage:"48",length:"80",temperature:"20",connector:"0",power:"",circuits:"",maxCurrent:"",resistance:""});
  near(metric(r,"Spannung am Endgerät"),44.875);
  assert.equal(r.rows?.find(row=>row.label==="RP-Kategorie · Referenzansatz")?.value,"RP2");
  for(const [type,expected] of [["1","RP1"],["2","RP2"],["3","RP2"],["4","RP3"]]) {
    assert.equal(calculate("poe",{type,cable:"cat6a-s-awg23"}).rows?.find(row=>row.label==="RP-Kategorie · Referenzansatz")?.value,expected);
  }
  assert.throws(()=>calculate("poe",{type:"2",cable:"unknown"}));
});

test("PV reference roof/module/tariff choices compute the published flat-roof and pitched-roof cases", () => {
  const flat=calculate("pva-rechner");
  near(metric(flat,"Anlageleistung · STC"),27.64125);
  near(metric(flat,"Jahresertrag · Jahr 1"),26.991680625);
  near(metric(flat,"Gestehungskosten · nominal"),9.238171853111831);
  assert.match(String(flat.rows?.find(row=>row.label==="Leistungsansatz")?.value),/63 ganze Module/);
  const pitched=calculate("pva-rechner",{sizing:"modules",roof:"pitched",area:"150",modulePreset:"22.5-1.95",direction:"south",tilt:"30"});
  near(metric(pitched,"Anlageleistung · STC"),30.27375);
  near(metric(pitched,"Jahresertrag · Jahr 1"),31.7874375);
  const east=calculate("pva-rechner",{sizing:"modules",roof:"pitched",area:"150",modulePreset:"22.5-1.95",direction:"eastwest",tilt:"20"});
  near(metric(east,"Jahresertrag · Jahr 1"),31.7874375*.8*.95);
  assert.throws(()=>calculate("pva-rechner",{roof:"pitched",tilt:"31"}));
  assert.throws(()=>calculate("pva-rechner",{tariffPreset:"unknown"}));
  assert.throws(()=>calculate("pva-rechner",{feedPreset:"manual",feed:""}));
});

test("dated PV minimum-feed and EIV models obey published boundaries and keep their reference stand visible", () => {
  near(publishedMinimumFeedRp(29.9,true),6);
  near(publishedMinimumFeedRp(60,true),3);
  near(publishedMinimumFeedRp(60,false),6.2);
  near(publishedPvGrant(35,"mounted",true,false,false).total,12300);
  near(publishedPvGrant(35,"integrated",true,false,false).total,13650);
  near(publishedPvGrant(125,"mounted",true,false,false).total,38050);
  near(publishedPvGrant(125,"mounted",false,false,false).total,56250);
  near(publishedPvGrant(1.5,"mounted",true,false,false).total,0);
  const r=calculate("pva-rechner",{sizing:"power",power:"60",feedPreset:"minimum",grantSelf:"yes"});
  assert.match(String(r.rows?.find(row=>row.label==="Bezug / Einspeisung")?.value),/29.1 \/ 3 Rp/);
  assert.ok(r.limitations.some(text=>text.includes("01.01.2026")));
});

test("PV existing-plant age and storage remain separate and reject empty required inputs", () => {
  const existing=projectPV({sizing:"existing",power:"10",historicalCost:"22000",commissionedYear:"2020",valuationYear:"2026",yield:"1000",self:"50",tariff:"0.3",feed:"0.1",om:"0",degradation:"0"});
  assert.equal(existing.rows?.find(row=>row.label==="Alter im Bewertungsjahr")?.value,6);
  near(existing.rows?.find(row=>row.label==="Bisheriger kumulierter Nettoertrag")?.value,12000);
  const storage=projectPV({sizing:"power",power:"10",yield:"1000",self:"30",tariff:"0.3",feed:"0.1",battery:"yes",batteryCapacity:"10",batteryCycles:"250",batteryCost:"10000",batteryEfficiency:"90",batteryDegradation:"0",batteryYears:"10",discount:"0"});
  near(storage.rows?.find(row=>row.label==="Zusätzlicher Eigenverbrauch · einfacher Ansatz")?.value,2500);
  near(storage.rows?.find(row=>row.label==="Mehrnutzen Speicher pro Jahr")?.value,500);
  near(storage.rows?.find(row=>row.label==="Diskontierter LCOS")?.value,10000/22500*100);
  assert.throws(()=>calculate("pva-rechner",{sizing:"existing",historicalCost:""}));
  assert.throws(()=>calculate("pva-rechner",{sizing:"existing",commissionedYear:"2030",valuationYear:"2026"}));
  assert.throws(()=>calculate("pva-rechner",{battery:"yes",batteryCapacity:""}));
});


test("the shared fire-load engine handles more than three user positions and keeps vertical results separate", () => {
  const positions:FireLoadPosition[]=[[3,10,10],[.5,5,6],[1.2,2,4],[.2,3,5],[7,1,1]].map(([mjPerMeter,quantity,length],index)=>({name:`Kabel ${index+1}`,mjPerMeter,quantity,length,evidence:"documented"}));
  const result=calculateFireLoadPositions(positions,10,"horizontal");
  near(metric(result,"Brandlast total"),334.6);
  near(metric(result,"Brandlast bezogen auf Fluchtweg"),33.46);
  near(metric(result,"Kabel total"),21);
  assert.equal(result.status.tone,"ok");
  assert.equal(result.rows?.length,5);
  const vertical=calculateFireLoadPositions(positions,10,"vertical");
  assert.equal(vertical.status.tone,"warning");
  assert.equal(vertical.series?.length,1);
  assert.equal(calculateFireLoadPositions(positions.map((row,index)=>index?row:{...row,evidence:"critical"}),10,"horizontal").status.tone,"error");
  assert.throws(()=>calculateFireLoadPositions([{...positions[0],quantity:1.5}],10,"horizontal"));
  assert.throws(()=>calculateFireLoadPositions([{...positions[0],mjPerMeter:NaN}],10,"horizontal"));
  assert.throws(()=>calculateFireLoadPositions(positions,0,"horizontal"));
});


test("dynamic fire rows preserve stable IDs, accept editing blanks and reject invalid computation without fallback", () => {
  const row=createFireLoadRow("row-new");
  const editing=parseFireLoadRows(JSON.stringify([row]),true);
  assert.equal(editing[0].id,"row-new");
  assert.equal(editing[0].mjPerMeter,"");
  assert.throws(()=>parseFireLoadRows(JSON.stringify([row])));
  const rows=[{...row,name:"Eigenes Kabel",mjPerMeter:"2,5",quantity:"4",length:"8",evidence:"documented"}];
  const r=calculate("brandlast",{fireloadMode:"dynamic",fireloadRows:JSON.stringify(rows),n1:"",q1:"",l1:"",proof:""});
  near(metric(r,"Brandlast total"),80);
  near(metric(r,"Brandlast bezogen auf Fluchtweg"),8);
  assert.equal(r.status.tone,"ok");
  const empty=calculate("brandlast",{fireloadMode:"dynamic",fireloadRows:"[]"});
  near(metric(empty,"Brandlast total"),0);
  assert.equal(empty.status.tone,"neutral");
  assert.throws(()=>parseFireLoadRows(JSON.stringify([rows[0],rows[0]]),true));
  assert.throws(()=>parseFireLoadRows(JSON.stringify([{...rows[0],quantity:4}]),true));
  assert.throws(()=>parseFireLoadRows(JSON.stringify([{...rows[0],quantity:"1.5"}])));
  assert.throws(()=>parseFireLoadRows("broken"));
  assert.throws(()=>calculate("brandlast",{fireloadMode:"dynamic",fireloadRows:JSON.stringify([row])}));
});
