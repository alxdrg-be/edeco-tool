import assert from "node:assert/strict";
import test from "node:test";
import { calculateChargingNetwork, calculateDepotNetwork, defaultStationGroup, defaultChargingGrids, defaultDepotUnits, defaultDepotPoints, parseChargingGrids, planningReportInputs, type ChargingGridInput } from "./chargingGrid.ts";
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<=1e-7*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
const input=(grids:ChargingGridInput[],mode="dynamic",house="160",reserve="30")=>({house,reserve,mode,grids:JSON.stringify(grids)});
const depot=(patch:Record<string,string>={})=>calculateDepotNetwork({feed:"630",reserve:"50",mode:"dynamic",depotUnits:JSON.stringify(defaultDepotUnits()),depotPoints:JSON.stringify(defaultDepotPoints()),...patch});

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
  assert.equal(rows.length,4);assert.match(rows[1].value,/6 × 11 kW/);assert.ok(!rows.some(row=>row.value.includes("{\"")));
  const mapping=planningReportInputs("premium-lkw",{depotLayout:"modular",mode:"none",depotUnits:JSON.stringify(defaultDepotUnits()),depotPoints:JSON.stringify(defaultDepotPoints())});
  assert.equal(mapping.length,6);assert.match(mapping[3].value,/pu-1/);
});


test("different project minimums do not bias equal delivered power after both fit",()=>{
  const groups=[{...defaultStationGroup("low"),count:"1",power:"22",minimum:"1"},{...defaultStationGroup("high"),count:"1",power:"22",minimum:"10"}];
  const house="100",reserve=String(100*Math.sqrt(3)*.4-20);
  const r=calculateChargingNetwork(input([{id:"g",label:"Grid",amps:"100",groups}],"dynamic",house,reserve));
  close(r.assignedKW,20);close(r.grids[0].stations[0].assignedKW,10);close(r.grids[0].stations[1].assignedKW,10);
});
