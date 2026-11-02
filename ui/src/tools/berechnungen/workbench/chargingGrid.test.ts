import assert from "node:assert/strict";
import test from "node:test";
import { calculateChargingNetwork, calculateDepotNetwork, defaultStationGroup, defaultChargingGrids, defaultDepotUnits, defaultDepotPoints, parseChargingGrids, planningReportInputs, type ChargingGridInput } from "./chargingGrid.ts";
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<=1e-7*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
const input=(grids:ChargingGridInput[],mode="dynamic",house="160",reserve="30")=>({house,reserve,mode,grids:JSON.stringify(grids)});
const depot=(patch:Record<string,string>={})=>calculateDepotNetwork({feed:"630",reserve:"50",mode:"dynamic",depotUnits:JSON.stringify(defaultDepotUnits()),depotPoints:JSON.stringify(defaultDepotPoints()),...patch});

test('authenticated one-grid unmanaged cases preserve 3-phase and 1-phase currents',()=>{
  // Actual source calcGrid(), 2026-11-02; same physical load and protection.
  const group={...defaultStationGroup(),kind:'ac3' as const,count:'4',power:'11'};
  const three=calculateChargingNetwork(input([{id:'g',label:'Grid',amps:'63',groups:[group]}],'none','125','20'));
  close(three.assignedKW,44);close(three.strongestPhaseCurrent-20/(Math.sqrt(3)*.4),63.50852961085884);
  assert.equal(three.activeCount,4);assert.equal(three.overload,true);
  const one=calculateChargingNetwork(input([{id:'g',label:'Grid',amps:'63',groups:[{...group,kind:'ac1' as const,count:'3',power:'7.4'}]}],'none','125','20'));
  close(one.assignedKW,22.2);close(one.grids[0].phases[0],32.17391304347826);assert.equal(one.activeCount,3);
});

test('PU AC nameplate and legacy DC output are distinct and efficiency applies exactly once',()=>{
  const unit={...defaultDepotUnits()[0],gridAmps:'630',modules:'2',modulePower:'150',efficiency:'0.97'};
  const point={...defaultDepotPoints()[0],ports:'2',power:'150'};
  const common={feed:'1000',reserve:'0',mode:'dynamic',depotPoints:JSON.stringify([point])};
  const legacy=calculateDepotNetwork({...common,depotUnits:JSON.stringify([unit])});
  close(legacy.units[0].capacityDC,300);close(legacy.assignedDC,300);close(legacy.acInputKW,300/.97);
  const ac=calculateDepotNetwork({...common,depotUnits:JSON.stringify([{...unit,powerBasis:'ac'}])});
  close(ac.units[0].capacityDC,291);close(ac.assignedDC,291);close(ac.acInputKW,300);
  assert.throws(()=>calculateDepotNetwork({...common,depotUnits:JSON.stringify([{...unit,powerBasis:'unknown'}])}),/Leistungsbezug/);
});

test('per-grid modes preserve unmanaged demand and allocate the remaining common capacity',()=>{
  const unmanaged={id:'raw',label:'Ungeregelt',amps:'125',mode:'none' as const,groups:[{...defaultStationGroup('raw'),count:'1',power:'22'}]};
  const managed={id:'lm',label:'Geregelt',amps:'125',mode:'dynamic' as const,groups:[{...defaultStationGroup('lm'),count:'6',power:'11',minimum:'3.7'}]};
  const r=calculateChargingNetwork(input([unmanaged,managed],'dynamic','125','20'));
  close(r.grids[0].assignedKW,22);
  close(r.acInputKW,125*Math.sqrt(3)*.4-20);
  close(r.grids.reduce((sum,g)=>sum+g.acInputKW,0),r.acInputKW);
  assert.equal(r.overload,false);
  const over=calculateChargingNetwork(input([{...unmanaged,groups:[{...unmanaged.groups[0],count:'10'}]},managed],'dynamic','125','20'));
  close(over.grids[0].assignedKW,220);close(over.grids[1].assignedKW,0);assert.equal(over.overload,true);
});

test('per-grid static factor aggregates identical powers before whole-point activation',()=>{
  const grid={id:'static',label:'Statisch',amps:'160',mode:'static' as const,factorMode:'manual' as const,factor:'0.4',groups:[{...defaultStationGroup('a'),count:'3',power:'11'},{...defaultStationGroup('b'),count:'3',power:'11'}]};
  const r=calculateChargingNetwork(input([grid],'none','400','0'));
  assert.equal(r.activeCount,3);assert.equal(r.waitingCount,3);close(r.assignedKW,33);
  assert.deepEqual(r.grids[0].stations.map(p=>p.requested),[true,true,true,false,false,false]);
  assert.throws(()=>calculateChargingNetwork(input([{...grid,factor:''}],'dynamic','400','0')),/Leistungsanteil/);
  const curve=calculateChargingNetwork(input([{...grid,factorMode:'curve',userClass:'residents'}],'dynamic','400','0'));
  assert.ok(curve.activeCount>0&&curve.activeCount<=6);assert.match(curve.factorBasis,/Grid-Modi/);
  const overload=calculateChargingNetwork(input([{...grid,amps:'63',factor:'1'}],'dynamic','63','0'));
  close(overload.assignedKW,66);assert.equal(overload.overload,true); // Static demand is never disguised by dynamic curtailment.
});

test('authenticated LKW source default agrees with explicit AC PUs and 50-kW activation',()=>{
  // Live rechneAlle(400,50), 2026-11-02: two PU groups of 300 kW AC,
  // respectively 2×350 and 1×350 kW ports, same630A grid, eta .97.
  const units=[{id:'a',label:'PU A',grid:'Grid',gridAmps:'630',modules:'2',modulePower:'150',powerBasis:'ac',efficiency:'0.97'},{id:'b',label:'PU B',grid:'Grid',gridAmps:'630',modules:'1',modulePower:'300',powerBasis:'ac',efficiency:'0.97'}];
  const points=[{id:'a',label:'A',unitId:'a',ports:'2',connector:'CCS',power:'350',factor:'1'},{id:'b',label:'B',unitId:'b',ports:'1',connector:'CCS',power:'350',factor:'1'}];
  const r=depot({feed:'400',reserve:'50',depotAllocation:'reference',depotMinimum:'50',depotUnits:JSON.stringify(units),depotPoints:JSON.stringify(points)});
  close(r.acInputKW,227.12812921102034);close(r.assignedDC,220.3142853346897);
  close(r.points[0].perPortKW,55.07857133367243);close(r.points[1].perPortKW,110.15714266734486);
  assert.equal(r.activeCount,3);assert.equal(r.waitingCount,0);
});

test('reference depot waits below a real minimum and conserves water-filled power',()=>{
  const units=[{...defaultDepotUnits()[0],gridAmps:'630',modules:'1',modulePower:'300',powerBasis:'dc'}];
  const points=[{...defaultDepotPoints()[0],ports:'4',power:'150'}];
  const limited=depot({feed:'250',reserve:'50',depotAllocation:'reference',depotMinimum:'50',depotUnits:JSON.stringify(units),depotPoints:JSON.stringify(points)});
  assert.equal(limited.activeCount,2);assert.equal(limited.waitingCount,2);
  assert.ok(limited.points[0].perPortKW>=50);close(limited.points[0].assignedDC,limited.assignedDC);
  const empty=depot({feed:'100',reserve:'50',depotAllocation:'reference',depotMinimum:'50',depotUnits:JSON.stringify(units),depotPoints:JSON.stringify(points)});
  assert.equal(empty.activeCount,0);assert.equal(empty.waitingCount,4);close(empty.assignedDC,0);close(empty.acInputKW,0);
  assert.throws(()=>depot({depotAllocation:'reference',depotMinimum:''}),/Mindestleistung/);
});

test('per-group DC minimums and static strongest-first selection remain explicit',()=>{
  const units=[{...defaultDepotUnits()[0],gridAmps:'630',modules:'1',modulePower:'300'}];
  const points=[{...defaultDepotPoints()[0],id:'a',ports:'1',power:'150',minimum:'100'},{...defaultDepotPoints()[0],id:'b',ports:'1',power:'100',minimum:'10'}];
  const r=depot({feed:'250',reserve:'50',depotAllocation:'reference',depotMinimum:'50',depotUnits:JSON.stringify(units),depotPoints:JSON.stringify(points)});
  assert.equal(r.activeCount,2);assert.ok(r.points[0].perPortKW>=100);assert.ok(r.points[1].perPortKW>=10);
  const fixed=depot({feed:'1000',reserve:'0',mode:'static',depotAllocation:'reference',depotReferenceFactor:'0.5',depotUnits:JSON.stringify(units),depotPoints:JSON.stringify(points)});
  assert.equal(fixed.activeCount,1);close(fixed.points[0].assignedDC,150);close(fixed.points[1].assignedDC,0);
});

test('house-connected PV increases house budget while the physical grid retains gross load limits',()=>{
  const grid={id:'g',label:'Grid',amps:'63',groups:[{...defaultStationGroup(),count:'8',power:'11'}]};
  const base=input([grid],'dynamic','63','20');
  const noPV=calculateChargingNetwork(base);
  const house=calculateChargingNetwork({...base,chargingPV:'20',chargingBattery:'20',chargingHours:'10',chargingConsumption:'20',chargingSourceConnection:'house'});
  close(house.sourceKW,16);close(house.assignedKW,noPV.assignedKW+16);
  assert.ok(house.grids[0].phases.every(current=>current<=63+1e-8));
  close(house.grids[0].netInputKW!,house.grids[0].acInputKW); // Generation is upstream of this grid.
  close(house.grossHouseACKW-house.sourceKW,house.netHouseACKW);
  close(house.deliveredEnergyKWh,house.assignedKW*10);close(house.rangeKm,house.deliveredEnergyKWh/20*100);
  const abundant=calculateChargingNetwork({...base,chargingPV:'1000',chargingSourceConnection:'house'});
  close(abundant.grids[0].acInputKW,63*Math.sqrt(3)*.4); // PV cannot remove the downstream fuse.
  assert.equal(abundant.sourceLimited,true);
});

test('generation behind an explicit grid offsets only its feeder and remains phase-conserving',()=>{
  const grids=[{id:'g',label:'Erzeuger-Grid',amps:'63',groups:[{...defaultStationGroup('g'),count:'8',power:'11'}]},{id:'other',label:'Anderes Grid',amps:'25',groups:[{...defaultStationGroup('other'),count:'2',power:'11'}]}];
  const r=calculateChargingNetwork({...input(grids,'dynamic','100','0'),chargingPV:'20',chargingSourceConnection:'g'});
  close(r.sourceKW,14);close(r.grids[0].acInputKW-r.sourceKW,r.grids[0].netInputKW!);
  close(r.grids[1].acInputKW,r.grids[1].netInputKW!);
  close(r.grids.reduce((sum,g)=>sum+g.acInputKW,0),r.acInputKW);
  for(let phase=0;phase<3;phase++){
    close(r.grids[0].grossPhases![phase]-14/(Math.sqrt(3)*.4),r.grids[0].phases[phase]);
    close(r.grids.reduce((sum,g)=>sum+g.phases[phase],0),r.housePhases[phase]);
  }
  assert.ok(r.grids.every(g=>g.phases.every(current=>Math.abs(current)<=g.amps+1e-8)));
  assert.throws(()=>calculateChargingNetwork({...input(grids),chargingSourceConnection:'deleted-grid'}),/vorhandenen Grid/);
});

test('signed reverse power, optional-field migration and source input validation are explicit',()=>{
  const grid={id:'g',label:'Grid',amps:'63',groups:[{...defaultStationGroup(),count:'1',power:'11'}]};
  const r=calculateChargingNetwork({...input([grid],'none','125','0'),chargingPV:'100',chargingHours:'10',chargingConsumption:'15'});
  close(r.netHouseACKW,-59);close(r.exportEnergyKWh,590);close(r.importEnergyKWh,0);
  assert.equal(r.overload,false);assert.ok(r.housePhases.every(current=>current<0));
  const inherited=calculateChargingNetwork(input([grid],'none','125','0'));
  close(inherited.sourceKW,0);close(inherited.operatingHours,10);close(inherited.vehicleConsumption,15);
  assert.throws(()=>calculateChargingNetwork({...input([grid]),chargingHours:''}),/Ladebetrieb/);
  assert.throws(()=>calculateChargingNetwork({...input([grid]),chargingHours:'0'}),/Ladebetrieb/);
  assert.throws(()=>calculateChargingNetwork({...input([grid]),chargingConsumption:'0'}),/Fahrzeugverbrauch/);
});

test('LKW per-grid fixed load consumes capacity before dynamic grids without hiding overload',()=>{
  const units=[{...defaultDepotUnits()[0],id:'fixed',grid:'Fest',gridAmps:'250',modules:'1',modulePower:'300',mode:'static',factor:'1'},{...defaultDepotUnits()[1],id:'dyn',grid:'Dynamisch',gridAmps:'250',modules:'1',modulePower:'300',mode:'dynamic'}];
  const points=[{...defaultDepotPoints()[0],id:'fixed',unitId:'fixed',ports:'1',power:'150'},{...defaultDepotPoints()[1],id:'dyn',unitId:'dyn',ports:'2',power:'150'}];
  const r=depot({feed:'400',reserve:'50',mode:'none',depotAllocation:'reference',depotMinimum:'50',depotUnits:JSON.stringify(units),depotPoints:JSON.stringify(points)});
  close(r.units[0].assignedDC,150);
  close(r.acInputKW,400*Math.sqrt(3)*.4-50);
  assert.equal(r.points[1].activePorts,1);assert.equal(r.points[1].waitingPorts,1);
  assert.equal(r.overload,false);
  const over=depot({feed:'100',reserve:'50',mode:'dynamic',depotAllocation:'reference',depotMinimum:'50',depotUnits:JSON.stringify(units),depotPoints:JSON.stringify(points)});
  close(over.units[0].assignedDC,150);close(over.units[1].assignedDC,0);assert.equal(over.overload,true);
});

test('LKW dynamic grids share remaining source capacity by configured grid ratings',()=>{
  const units=[{...defaultDepotUnits()[0],id:'a',grid:'A',gridAmps:'100',modules:'1',modulePower:'300',mode:'dynamic'},{...defaultDepotUnits()[1],id:'b',grid:'B',gridAmps:'200',modules:'1',modulePower:'300',mode:'dynamic'}];
  const points=[{...defaultDepotPoints()[0],id:'a',unitId:'a',ports:'1',power:'300'},{...defaultDepotPoints()[1],id:'b',unitId:'b',ports:'1',power:'300'}];
  const r=depot({feed:'250',reserve:'0',mode:'none',depotAllocation:'reference',depotMinimum:'1',depotUnits:JSON.stringify(units),depotPoints:JSON.stringify(points)});
  close(r.units[1].acInputKW,2*r.units[0].acInputKW);close(r.acInputKW,250*Math.sqrt(3)*.4);
  const inconsistent=[units[0],{...units[1],grid:'A',gridAmps:'100',mode:'none'}];
  assert.throws(()=>depot({depotAllocation:'reference',depotMinimum:'50',depotUnits:JSON.stringify(inconsistent),depotPoints:JSON.stringify(points)}),/Lastmanagement.*übereinstimmen/);
});

test("mixed 1~/3~/DC station groups keep AC/DC energy and phase identities",()=>{
  const groups=[{...defaultStationGroup("a"),kind:"ac1" as const,count:"3",power:"3.7"},{...defaultStationGroup("b"),kind:"ac3" as const,count:"2",power:"11"},{...defaultStationGroup("c"),kind:"dc" as const,count:"1",power:"50",efficiency:"0.95"}];
  const r=calculateChargingNetwork(input([{id:"g",label:"Gemischt",amps:"250",groups}],"none","400","0"));
  close(r.assignedKW,3*3.7+2*11+50);
  close(r.acInputKW,3*3.7+2*11+50/.95);
  const expected=3.7/.23+2*11/(Math.sqrt(3)*.4)+(50/.95)/(Math.sqrt(3)*.4);
  for(const current of r.housePhases)close(current,expected);
  assert.deepEqual(r.grids[0].stations.slice(0,3).map(point=>point.phase),[1,2,3]);
  assert.equal(r.overload,false);
});

test("manual single-phase concentration is limited by the real phase before total kW budget",()=>{
  const grid={id:"g",label:"Einphasig",amps:"63",groups:[{...defaultStationGroup(),kind:"ac1" as const,count:"3",power:"7.4",phase:"1" as const,minimum:"1.38"}]};
  const raw=calculateChargingNetwork(input([grid],"none","63","0"));
  close(raw.acInputKW,22.2);assert.equal(raw.overload,true);assert.ok(raw.housePhases[0]>63);
  const managed=calculateChargingNetwork(input([grid],"dynamic","63","0"));
  close(managed.housePhases[0],63);close(managed.assignedKW,63*.230);
  close(managed.housePhases[1],0);assert.equal(managed.overload,false);
});

test("activation has explicit minimums, zero-power waiting points and static ceil(n*k)",()=>{
  const grid={id:"g",label:"Grid",amps:"63",groups:[{...defaultStationGroup(),count:"10",minimum:"3.7"}]};
  const r=calculateChargingNetwork(input([grid],"dynamic","63","30"));
  assert.equal(r.activeCount,3);assert.equal(r.waitingCount,7);
  for(const station of r.grids[0].stations)assert.ok(station.active?station.assignedKW>=3.7-1e-8:station.assignedKW===0);
  const staticGrid={...grid,groups:[{...grid.groups[0],count:"3",factor:"0.5"}]};
  const fixed=calculateChargingNetwork(input([staticGrid],"static","160","0"));
  assert.equal(fixed.activeCount,2);assert.equal(fixed.waitingCount,1);close(fixed.assignedKW,22);
  assert.match(fixed.factorBasis,/ceil/);
});

test("multiple grids conserve the shared house budget and all local phase limits",()=>{
  const r=calculateChargingNetwork(input(defaultChargingGrids()));
  close(r.acInputKW,160*Math.sqrt(3)*.4-30);
  assert.equal(r.overload,false);
  for(const grid of r.grids){assert.ok(grid.phases.every(current=>current<=grid.amps+1e-8));close(grid.assignedKW,grid.stations.reduce((sum,p)=>sum+p.assignedKW,0));}
  assert.ok(r.housePhases.every(current=>current<=r.houseAmps+1e-8));
  const saturated=calculateChargingNetwork(input(defaultChargingGrids(),"dynamic","63","100"));
  assert.equal(saturated.activeCount,0);assert.equal(saturated.reserveExceeded,true);close(saturated.assignedKW,0);
});

test("DC conversion losses constrain both phase and power budgets exactly once",()=>{
  const grid={id:"g",label:"DC",amps:"100",groups:[{...defaultStationGroup(),kind:"dc" as const,count:"2",power:"50",efficiency:"0.9",minimum:"5"}]};
  const r=calculateChargingNetwork(input([grid],"dynamic","100","0"));
  close(r.acInputKW,100*Math.sqrt(3)*.4);close(r.assignedKW,r.acInputKW*.9);
  assert.equal(r.activeCount,2);assert.equal(r.overload,false);
});

test("malformed list, missing values and unavailable curves never produce a fallback result",()=>{
  assert.throws(()=>calculateChargingNetwork({...input(defaultChargingGrids()),grids:""}));
  const grids=defaultChargingGrids();grids[0].groups[0].count="";
  assert.throws(()=>calculateChargingNetwork(input(grids)),/Anzahl/);
  const curves=defaultChargingGrids();curves[0].groups[0]={...curves[0].groups[0],kind:"ac1",power:"3.7",userClass:"transit",factorMode:"curve"};
  assert.throws(()=>calculateChargingNetwork(input(curves,"static")),/keine veröffentlichte Referenzkurve/);
  const duplicate=defaultChargingGrids();duplicate[1].id=duplicate[0].id;
  assert.throws(()=>parseChargingGrids(JSON.stringify(duplicate)),/eindeutig/);
  const blank=defaultChargingGrids();blank[0].label="";
  assert.throws(()=>parseChargingGrids(JSON.stringify(blank)),/Bezeichnung/);
  assert.doesNotThrow(()=>parseChargingGrids(JSON.stringify(blank),true));
});

test("PU/dispenser topology conserves DC allocation and converts each PU once",()=>{
  const r=depot();close(r.assignedDC,300);close(r.acInputKW,300/.97);close(r.lossKW,300/.97-300);
  for(const unit of r.units){close(unit.assignedDC,100);close(unit.assignedDC,r.points.filter(point=>point.unitId===unit.id).reduce((sum,p)=>sum+p.assignedDC,0));}
  for(const point of r.points)close(point.perPortKW,50);
  const raw=depot({mode:"none"});close(raw.assignedDC,450);close(raw.acInputKW,450/.97);assert.equal(raw.overload,true);
});

test("shared depot grid and house caps preserve the configured PU assignments",()=>{
  const units=defaultDepotUnits().map(unit=>({...unit,grid:"Gemeinsam",gridAmps:"160"}));
  const r=depot({depotUnits:JSON.stringify(units)});
  close(r.acInputKW,160*Math.sqrt(3)*.4);assert.equal(r.grids.length,1);assert.equal(r.overload,false);
  for(const point of r.points)assert.ok(r.units.some(unit=>unit.id===point.unitId));
  const fewer=defaultDepotUnits().slice(0,1);
  assert.throws(()=>depot({depotUnits:JSON.stringify(fewer)}),/zugeordnete Power Unit fehlt/);
  assert.throws(()=>depot({depotPoints:"[]"}));
  units[0].gridAmps="125";
  assert.throws(()=>depot({depotUnits:JSON.stringify(units)}),/dieselbe Grid-Vorsicherung/);
});

test("report inputs flatten the exact station and PU mapping instead of raw JSON",()=>{
  const rows=planningReportInputs("premium-pkw",{...input(defaultChargingGrids()),layout:"modular"});
  assert.equal(rows.length,5);assert.ok(rows.some(row=>row.label==="PV-/Speicheranschluss"));assert.ok(rows.some(row=>/6 × 11 kW/.test(row.value)));assert.ok(!rows.some(row=>row.value.includes("{\"")));
  const mapping=planningReportInputs("premium-lkw",{depotLayout:"modular",mode:"none",depotUnits:JSON.stringify(defaultDepotUnits()),depotPoints:JSON.stringify(defaultDepotPoints())});
  assert.equal(mapping.length,6);assert.match(mapping[3].value,/pu-1/);
});

test('PKW report uses the effective grid mode and omits factors overridden at grid level',()=>{
  const group={...defaultStationGroup('p'),label:'Punktgruppe',factor:'0.4',factorMode:'manual' as const};
  const grid={id:'g',label:'Grid',amps:'125',mode:'static' as const,groups:[group]};
  const report=(value:ChargingGridInput,mode='dynamic')=>planningReportInputs('premium-pkw',{...input([value],mode),layout:'modular'});
  const own=report(grid);
  assert.match(own.find(row=>row.label==='Grid')!.value,/LM static/);
  assert.match(own.find(row=>row.label==='Grid · Punktgruppe')!.value,/k 0.4/);
  const manual=report({...grid,factorMode:'manual',factor:'0.75'});
  assert.match(manual.find(row=>row.label==='Grid')!.value,/Gridfaktor k 0.75/);
  assert.doesNotMatch(manual.find(row=>row.label==='Grid · Punktgruppe')!.value,/k 0.4|Referenzkurve/);
  const curve=report({...grid,factorMode:'curve',userClass:'visitors'});
  assert.match(curve.find(row=>row.label==='Grid')!.value,/Referenzkurve Grid visitors/);
  assert.doesNotMatch(curve.find(row=>row.label==='Grid · Punktgruppe')!.value,/k 0.4|Referenzkurve/);
  const dynamic=report({...grid,mode:'dynamic'},'static');
  assert.doesNotMatch(dynamic.find(row=>row.label==='Grid · Punktgruppe')!.value,/k 0.4|Referenzkurve/);
});


test("different project minimums do not bias equal delivered power after both fit",()=>{
  const groups=[{...defaultStationGroup("low"),count:"1",power:"22",minimum:"1"},{...defaultStationGroup("high"),count:"1",power:"22",minimum:"10"}];
  const house="100",reserve=String(100*Math.sqrt(3)*.4-20);
  const r=calculateChargingNetwork(input([{id:"g",label:"Grid",amps:"100",groups}],"dynamic",house,reserve));
  close(r.assignedKW,20);close(r.grids[0].stations[0].assignedKW,10);close(r.grids[0].stations[1].assignedKW,10);
});
