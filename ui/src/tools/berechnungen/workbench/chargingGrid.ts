import { costReportInputs } from "./chargingCosts.ts";
import { number, type Inputs } from "./types.ts";
import { publishedEVFactor, EV_FACTOR_BASIS } from "../EVdata.ts";

export type ChargingKind = "ac1" | "ac3" | "dc";
export type ChargingMode = "none" | "static" | "dynamic";
export interface StationGroupInput {
  id: string; label: string; kind: ChargingKind; count: string; power: string;
  phase: "auto" | "1" | "2" | "3"; efficiency: string; minimum: string;
  factorMode: "manual" | "curve"; factor: string; userClass: "residents" | "visitors" | "transit";
}
export interface ChargingGridInput { id: string; label: string; amps: string; groups: StationGroupInput[] }
export interface ChargingStation {
  id: string; label: string; groupId: string; kind: ChargingKind; phase: 1 | 2 | 3 | null;
  nominalKW: number; assignedKW: number; acInputKW: number; efficiency: number;
  minimumKW: number; active: boolean; factor: number; requested: boolean;
}
export interface ChargingGridResult {
  id: string; label: string; amps: number; assignedKW: number; acInputKW: number; installedKW: number;
  phases: [number,number,number]; overload: boolean; activeCount: number; waitingCount: number; stations: ChargingStation[];
}
export interface ChargingNetworkResult {
  houseAmps: number; houseKW: number; reserveKW: number; mode: ChargingMode;
  installedKW: number; assignedKW: number; acInputKW: number; availableACKW: number;
  housePhases: [number,number,number]; strongestPhaseCurrent: number;
  overload: boolean; reserveExceeded: boolean; activeCount: number; waitingCount: number; grids: ChargingGridResult[];
  factorBasis: string; minimumBasis: string;
}
export const CHARGING_KINDS = [{ value:"ac1", label:"AC 1~ · 230 V" },{ value:"ac3", label:"AC 3~ · 400 V" },{ value:"dc", label:"DC · AC-Aufnahme über η" }] as const;
export const CHARGING_POWER_CHOICES: Record<ChargingKind, number[]> = { ac1:[3.7,7.4], ac3:[11,22], dc:[50,150,350] };
export const GRID_AMP_CHOICES = [25,35,50,63,80,100,125,160,200,250,315,400,500,630,800];
const AC3_KW_PER_A = Math.sqrt(3) * .4;
const TOL = 1e-8;
const numeric = (value: unknown, label: string, max: number, zero = false) => number({ value: typeof value === "number" ? String(value) : typeof value === "string" ? value : "" }, "value", label, 0, max, zero);
const record = (value: unknown): value is Record<string,unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown, label: string, maximum = 60) => { if (typeof value !== "string" || !value.trim() || value.length > maximum) throw new Error(`${label}: Text mit 1 bis ${maximum} Zeichen eingeben.`); return value.trim(); };
function choose<T extends string>(value: unknown, allowed: readonly T[], label: string): T { if (!allowed.includes(value as T)) throw new Error(`${label}: gültige Auswahl treffen.`); return value as T; }
export function defaultStationGroup(id = "gruppe-1"): StationGroupInput {
  return { id, label:"Ladepunktgruppe", kind:"ac3", count:"4", power:"11", phase:"auto", efficiency:"0.95", minimum:"3.7", factorMode:"manual", factor:"1", userClass:"residents" };
}
export function defaultChargingGrids(): ChargingGridInput[] {
  return [{ id:"grid-1", label:"Grid 1", amps:"63", groups:[{ ...defaultStationGroup("gruppe-1"),count:"6" }] }, { id:"grid-2", label:"Grid 2", amps:"63", groups:[defaultStationGroup("gruppe-2")] }];
}
export function parseChargingGrids(raw: string, editing = false): ChargingGridInput[] {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("Ladegrids: gültige gespeicherte Liste erforderlich."); }
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) throw new Error("1 bis 12 Ladegrids erfassen.");
  const ids = new Set<string>();
  return value.map((grid,index) => {
    if (!record(grid) || !Array.isArray(grid.groups) || grid.groups.length < 1 || grid.groups.length > 16) throw new Error(`Grid ${index+1}: 1 bis 16 Punktgruppen erfassen.`);
    const id = text(grid.id,"Grid-ID"), label = editing && typeof grid.label === "string" ? grid.label : text(grid.label,"Grid-Bezeichnung");
    if (ids.has(id)) throw new Error("Grid-IDs müssen eindeutig sein."); ids.add(id);
    const groupIds = new Set<string>();
    const groups = grid.groups.map((group, j) => {
      if (!record(group)) throw new Error(`${label}, Gruppe ${j+1}: gültige Gruppe erforderlich.`);
      const groupId = text(group.id,"Gruppen-ID");
      if (groupIds.has(groupId)) throw new Error(`${label}: Gruppen-IDs müssen eindeutig sein.`); groupIds.add(groupId);
      return { ...group, id:groupId, label:editing && typeof group.label === "string" ? group.label : text(group.label,"Gruppenbezeichnung"), kind:choose(group.kind,["ac1","ac3","dc"],"Ladeart"), phase:choose(group.phase,["auto","1","2","3"],"Phasenwahl") } as unknown as StationGroupInput;
    });
    return { id,label,amps:typeof grid.amps === "number" ? String(grid.amps) : grid.amps as string,groups };
  });
}
/** Mixed-grid budget with phase constraints. The activation order is explicit input order. */
export function calculateChargingNetwork(input: Inputs): ChargingNetworkResult {
  const houseAmps = numeric(input.house,"Hausanschluss",10000), reserveKW = numeric(input.reserve,"Gebäudereserve",100000,true), mode = choose(input.mode,["none","static","dynamic"],"Lastmanagement");
  const houseKW = houseAmps * AC3_KW_PER_A, availableACKW = Math.max(0,houseKW-reserveKW), reserveCurrent = reserveKW / AC3_KW_PER_A;
  const specifications = parseChargingGrids(input.grids), coefficients: [number,number,number][] = [], stations: ChargingStation[] = [], gridIndices: number[] = [];
  const grids: ChargingGridResult[] = specifications.map((grid,gridIndex) => {
    const amps = numeric(grid.amps,`${grid.label} Vorsicherung`,10000), nominalPhases: [number,number,number] = [0,0,0];
    let pointIndex = 0;
    const gridStations: ChargingStation[] = [];
    for (const group of grid.groups) {
      const count = numeric(group.count,`${grid.label} · Anzahl`,1000,true);
      if (!Number.isInteger(count)) throw new Error(`${grid.label}: ganze Anzahl Ladepunkte eingeben.`);
      if (stations.length + count > 2000) throw new Error("Das gemischte Modell unterstützt höchstens 2000 Ladepunkte pro Rechenstand.");
      const power = numeric(group.power,`${grid.label} · Ladeleistung`,5000);
      const efficiency = group.kind === "dc" ? numeric(group.efficiency,`${grid.label} · DC-Wirkungsgrad`,1) : 1;
      const minimum = mode !== "none" && count > 0 ? numeric(group.minimum,`${grid.label} · Projekt-Mindestleistung`,power) : 0;
      let factor = 1;
      if (mode === "static" && count > 0) {
        const factorMode = choose(group.factorMode,["manual","curve"],"Faktorgrundlage");
        if (factorMode === "manual") factor = numeric(group.factor,`${grid.label} · Leistungsanteil`,1,true);
        else {
          const observed = publishedEVFactor(group.userClass,count,power,!CHARGING_POWER_CHOICES[group.kind].includes(power));
          if (observed === null) throw new Error(`${group.label}: für diese Anwenderklasse und Ladeleistung ist keine veröffentlichte Referenzkurve hinterlegt. Manuellen Faktor wählen.`);
          factor = observed;
        }
      }
      const requestedCount = mode === "static" ? Math.ceil(count * factor) : count;
      for (let point = 0; point < count; point++) {
        const phaseIndex = group.kind === "ac1" ? group.phase === "auto" ? nominalPhases.indexOf(Math.min(...nominalPhases)) : Number(group.phase)-1 : null;
        const coeff: [number,number,number] = phaseIndex === null ? [1/(efficiency*AC3_KW_PER_A),1/(efficiency*AC3_KW_PER_A),1/(efficiency*AC3_KW_PER_A)] : [0,0,0];
        if (phaseIndex !== null) coeff[phaseIndex] = 1 / .230;
        for (let phase=0;phase<3;phase++) nominalPhases[phase] += coeff[phase] * power;
        const station: ChargingStation = { id:`${grid.id}/${group.id}/${point+1}`, label:`${group.label} · ${point+1}`, groupId:group.id,kind:group.kind,phase:phaseIndex === null ? null : phaseIndex+1 as 1|2|3,nominalKW:power,assignedKW:0,acInputKW:0,efficiency,minimumKW:minimum,active:false,factor,requested:point < requestedCount };
        stations.push(station);gridStations.push(station);coefficients.push(coeff);gridIndices.push(gridIndex);pointIndex++;
      }
    }
    return { id:grid.id,label:grid.label,amps,assignedKW:0,acInputKW:0,installedKW:gridStations.reduce((sum,p)=>sum+p.nominalKW,0),phases:[0,0,0],overload:false,activeCount:0,waitingCount:0,stations:gridStations };
  });
  if (!stations.length) throw new Error("Mindestens einen Ladepunkt erfassen.");
  const housePhases: [number,number,number] = [reserveCurrent,reserveCurrent,reserveCurrent];
  let houseChargingKW = 0;
  const addPower = (index:number,power:number) => {
    const station = stations[index], grid=grids[gridIndices[index]], ac = power / station.efficiency;
    station.assignedKW += power;station.acInputKW += ac;grid.assignedKW += power;grid.acInputKW += ac;houseChargingKW += ac;
    for(let phase=0;phase<3;phase++){const current=coefficients[index][phase]*power;grid.phases[phase]+=current;housePhases[phase]+=current;}
  };
  const constraints = (members:number[]) => {
    const limits: { spare:number; rate:number; members:number[] }[] = [];
    const allRate = members.reduce((sum,index)=>sum+1/stations[index].efficiency,0);
    limits.push({spare:availableACKW-houseChargingKW,rate:allRate,members});
    for(let phase=0;phase<3;phase++) limits.push({spare:houseAmps-housePhases[phase],rate:members.reduce((sum,index)=>sum+coefficients[index][phase],0),members:members.filter(index=>coefficients[index][phase]>0)});
    for(let gridIndex=0;gridIndex<grids.length;gridIndex++) {
      const grid=grids[gridIndex], own=members.filter(index=>gridIndices[index]===gridIndex);
      if(!own.length)continue;
      limits.push({spare:grid.amps*AC3_KW_PER_A-grid.acInputKW,rate:own.reduce((sum,index)=>sum+1/stations[index].efficiency,0),members:own});
      for(let phase=0;phase<3;phase++) limits.push({spare:grid.amps-grid.phases[phase],rate:own.reduce((sum,index)=>sum+coefficients[index][phase],0),members:own.filter(index=>coefficients[index][phase]>0)});
    }
    return limits.filter(limit=>limit.rate>0);
  };
  if(mode === "none") stations.forEach((station,index)=>{station.active=true;addPower(index,station.nominalKW);});
  else {
    // Lowest-priority points wait if their project minimum cannot fit. Different phases may still fit.
    stations.forEach((station,index)=>{
      if(!station.requested)return;
      const headroom=Math.min(...constraints([index]).map(limit=>Math.max(0,limit.spare)/limit.rate));
      if(headroom+TOL>=station.minimumKW){station.active=true;addPower(index,station.minimumKW);}
    });
    let eligible=stations.flatMap((station,index)=>station.active&&station.assignedKW<station.nominalKW-TOL?[index]:[]);
    while(eligible.length){
      const level=Math.min(...eligible.map(index=>stations[index].assignedKW));
      const lowest=eligible.filter(index=>stations[index].assignedKW<=level+TOL);
      const higher=eligible.filter(index=>stations[index].assignedKW>level+TOL);
      const nextLevel=higher.length?Math.min(...higher.map(index=>stations[index].assignedKW))-level:Infinity;
      const limits=constraints(lowest), available=Math.min(...limits.map(limit=>Math.max(0,limit.spare)/limit.rate)), remaining=Math.min(...lowest.map(index=>stations[index].nominalKW-stations[index].assignedKW)), increment=Math.max(0,Math.min(available,remaining,nextLevel));
      lowest.forEach(index=>addPower(index,increment));
      const saturated=new Set(limits.filter(limit=>limit.spare-limit.rate*increment<=TOL).flatMap(limit=>limit.members));
      const next=eligible.filter(index=>stations[index].nominalKW-stations[index].assignedKW>TOL&&!saturated.has(index));
      if(increment<=TOL&&next.length===eligible.length)break;
      eligible=next;
    }
  }
  for(const grid of grids){grid.activeCount=grid.stations.filter(station=>station.active).length;grid.waitingCount=grid.stations.length-grid.activeCount;grid.overload=grid.phases.some(current=>current>grid.amps+TOL)||grid.acInputKW>grid.amps*AC3_KW_PER_A+TOL;}
  const installedKW=stations.reduce((sum,p)=>sum+p.nominalKW,0), assignedKW=stations.reduce((sum,p)=>sum+p.assignedKW,0), strongestPhaseCurrent=Math.max(...housePhases), reserveExceeded=reserveKW>houseKW+TOL;
  return {houseAmps,houseKW,reserveKW,mode,installedKW,assignedKW,acInputKW:houseChargingKW,availableACKW,housePhases,strongestPhaseCurrent,overload:reserveExceeded||houseChargingKW>availableACKW+TOL||strongestPhaseCurrent>houseAmps+TOL||grids.some(grid=>grid.overload),reserveExceeded,activeCount:stations.filter(p=>p.active).length,waitingCount:stations.filter(p=>!p.active).length,grids,factorBasis:mode === "static" ? `${EV_FACTOR_BASIS}; Aktivierung je Gruppe ceil(n × k)` : mode === "none" ? "Ohne Lastmanagement · alle Punkte aktiv, k = 1" : "Dynamisches gemischtes Budgetmodell · aktive Punkte nach Eingabereihenfolge",minimumBasis:"Mindestleistung je Gruppe ist eine explizite Projektannahme, kein automatisch bestimmter Normwert."};
}

export interface DepotUnitInput { id:string; label:string; grid:string; gridAmps:string; modules:string; modulePower:string; efficiency:string }
export interface DepotPointInput { id:string; label:string; unitId:string; ports:string; connector:"CCS"|"MCS"; power:string; factor:string }
export interface DepotUnitResult { id:string;label:string;grid:string;gridAmps:number;modules:number;modulePower:number;efficiency:number;capacityDC:number;demandDC:number;assignedDC:number;acInputKW:number;overload:boolean }
export interface DepotPointResult { id:string;label:string;unitId:string;ports:number;connector:"CCS"|"MCS";nominalKW:number;factor:number;demandDC:number;assignedDC:number;perPortKW:number }
export interface DepotNetworkResult { houseAmps:number;houseKW:number;reserveKW:number;mode:ChargingMode;availableACKW:number;acInputKW:number;assignedDC:number;demandDC:number;lossKW:number;overload:boolean;units:DepotUnitResult[];points:DepotPointResult[];grids:{label:string;amps:number;acInputKW:number;overload:boolean}[] }
export const DEPOT_MODULE_POWER_CHOICES=[30,40,50,60,75,100,150,200,300,400,500,600,1000];
export const DEPOT_POINT_POWER_CHOICES:Record<"CCS"|"MCS",number[]>={CCS:[50,75,100,150,200,300,350,400],MCS:[500,750,1000,1500,2000,3000]};
export function defaultDepotUnits():DepotUnitInput[]{return [1,2,3].map(index=>({id:`pu-${index}`,label:`Power Unit ${index}`,grid:`Grid ${index}`,gridAmps:"250",modules:"2",modulePower:"50",efficiency:"0.97"}));}
export function defaultDepotPoints():DepotPointInput[]{return [1,2,3].map(index=>({id:`dc-${index}`,label:`Abgabepunktgruppe ${index}`,unitId:`pu-${index}`,ports:"2",connector:"CCS",power:"75",factor:"1"}));}
export function parseDepotUnits(raw:string,editing=false):DepotUnitInput[]{
  let rows:unknown;try{rows=JSON.parse(raw);}catch{throw new Error("Power Units: gültige gespeicherte Liste erforderlich.");}
  if(!Array.isArray(rows)||!rows.length||rows.length>24)throw new Error("1 bis 24 Power Units erfassen.");
  const ids=new Set<string>();
  return rows.map((row,index)=>{if(!record(row))throw new Error(`Power Unit ${index+1}: gültige Daten erforderlich.`);const id=text(row.id,"PU-ID");if(ids.has(id))throw new Error("PU-IDs müssen eindeutig sein.");ids.add(id);return{...row,id,label:editing && typeof row.label==="string"?row.label:text(row.label,"PU-Bezeichnung"),grid:editing && typeof row.grid==="string"?row.grid:text(row.grid,"Grid-Bezeichnung")}as unknown as DepotUnitInput;});
}
export function parseDepotPoints(raw:string,editing=false):DepotPointInput[]{
  let rows:unknown;try{rows=JSON.parse(raw);}catch{throw new Error("DC-Abgabepunkte: gültige gespeicherte Liste erforderlich.");}
  if(!Array.isArray(rows)||!rows.length||rows.length>48)throw new Error("1 bis 48 DC-Abgabepunktgruppen erfassen.");
  const ids=new Set<string>();
  return rows.map((row,index)=>{if(!record(row))throw new Error(`Abgabepunktgruppe ${index+1}: gültige Daten erforderlich.`);const id=text(row.id,"Abgabegruppen-ID");if(ids.has(id))throw new Error("Abgabegruppen-IDs müssen eindeutig sein.");ids.add(id);return{...row,id,label:editing && typeof row.label==="string"?row.label:text(row.label,"Abgabegruppen-Bezeichnung"),unitId:text(row.unitId,"Zugeordnete PU"),connector:choose(row.connector,["CCS","MCS"],"Ladesystem")}as unknown as DepotPointInput;});
}
/** Explicit PU/dispenser topology; no hidden reassignment between Power Units. */
export function calculateDepotNetwork(input:Inputs):DepotNetworkResult{
  const houseAmps=numeric(input.feed,"AC-Einspeisung",10000),reserveKW=numeric(input.reserve,"Gebäudereserve",100000,true),mode=choose(input.mode,["none","static","dynamic"],"Lastmanagement"),houseKW=houseAmps*AC3_KW_PER_A,availableACKW=Math.max(0,houseKW-reserveKW);
  const unitInputs=parseDepotUnits(input.depotUnits),pointInputs=parseDepotPoints(input.depotPoints);
  const units:DepotUnitResult[]=unitInputs.map(unit=>{const modules=numeric(unit.modules,`${unit.label} · Module`,100);if(!Number.isInteger(modules))throw new Error(`${unit.label}: ganze Modulzahl eingeben.`);const modulePower=numeric(unit.modulePower,`${unit.label} · Modulleistung`,2000),efficiency=numeric(unit.efficiency,`${unit.label} · Wirkungsgrad`,1),gridAmps=numeric(unit.gridAmps,`${unit.grid} · Vorsicherung`,10000);return{id:unit.id,label:unit.label,grid:unit.grid,gridAmps,modules,modulePower,efficiency,capacityDC:modules*modulePower,demandDC:0,assignedDC:0,acInputKW:0,overload:false};});
  const points:DepotPointResult[]=pointInputs.map(point=>{const unit=units.find(unit=>unit.id===point.unitId);if(!unit)throw new Error(`${point.label}: zugeordnete Power Unit fehlt. Die Zuordnung wird nicht automatisch ersetzt.`);const ports=numeric(point.ports,`${point.label} · Abgabepunkte`,1000,true);if(!Number.isInteger(ports))throw new Error(`${point.label}: ganze Anzahl Abgabepunkte eingeben.`);const nominalKW=numeric(point.power,`${point.label} · Punktleistung`,5000),factor=mode==="static"?numeric(point.factor,`${point.label} · Leistungsanteil`,1,true):1,demandDC=ports*nominalKW*factor;unit.demandDC+=demandDC;return{id:point.id,label:point.label,unitId:point.unitId,ports,connector:point.connector,nominalKW,factor,demandDC,assignedDC:0,perPortKW:0};});
  if(!points.some(point=>point.ports>0))throw new Error("Mindestens einen DC-Abgabepunkt erfassen.");
  const groupNames=[...new Set(units.map(unit=>unit.grid))];
  const grids=groupNames.map(label=>{const own=units.filter(unit=>unit.grid===label),amps=own[0].gridAmps;if(own.some(unit=>Math.abs(unit.gridAmps-amps)>TOL))throw new Error(`${label}: dieselbe Grid-Vorsicherung bei allen zugeordneten Power Units angeben.`);return{label,amps,acInputKW:0,overload:false};});
  units.forEach(unit=>{unit.assignedDC=mode==="none"?unit.demandDC:Math.min(unit.demandDC,unit.capacityDC);unit.acInputKW=unit.assignedDC/unit.efficiency;});
  if(mode!=="none"){
    grids.forEach(grid=>{const own=units.filter(unit=>unit.grid===grid.label),requested=own.reduce((sum,unit)=>sum+unit.acInputKW,0),scale=requested>0?Math.min(1,grid.amps*AC3_KW_PER_A/requested):1;own.forEach(unit=>{unit.assignedDC*=scale;unit.acInputKW*=scale;});});
    const requested=units.reduce((sum,unit)=>sum+unit.acInputKW,0),scale=requested>0?Math.min(1,availableACKW/requested):1;
    units.forEach(unit=>{unit.assignedDC*=scale;unit.acInputKW*=scale;});
  }
  points.forEach(point=>{const unit=units.find(unit=>unit.id===point.unitId)!;point.assignedDC=unit.demandDC>0?unit.assignedDC*point.demandDC/unit.demandDC:0;point.perPortKW=point.ports>0?point.assignedDC/point.ports:0;});
  units.forEach(unit=>{unit.overload=unit.assignedDC>unit.capacityDC+TOL;});
  grids.forEach(grid=>{grid.acInputKW=units.filter(unit=>unit.grid===grid.label).reduce((sum,unit)=>sum+unit.acInputKW,0);grid.overload=grid.acInputKW>grid.amps*AC3_KW_PER_A+TOL;});
  const acInputKW=units.reduce((sum,unit)=>sum+unit.acInputKW,0),assignedDC=units.reduce((sum,unit)=>sum+unit.assignedDC,0),demandDC=units.reduce((sum,unit)=>sum+unit.demandDC,0);
  return{houseAmps,houseKW,reserveKW,mode,availableACKW,acInputKW,assignedDC,demandDC,lossKW:acInputKW-assignedDC,overload:reserveKW>houseKW+TOL||acInputKW>availableACKW+TOL||units.some(unit=>unit.overload)||grids.some(grid=>grid.overload),units,points,grids};
}
/** Human-readable lists for the PDF; raw JSON is never used as report text. */
export function planningReportInputs(calculatorId:string,input:Inputs):{label:string;value:string}[]{
  if(calculatorId==="premium-ladekosten"&&input.costLayout==="contracts")return costReportInputs(input);
  if(calculatorId==="premium-pkw"&&input.layout==="modular")return parseChargingGrids(input.grids).flatMap(grid=>[{label:grid.label,value:`Vorsicherung ${grid.amps} A`},...grid.groups.map(group=>({label:`${grid.label} · ${group.label}`,value:`${group.count} × ${group.power} kW · ${group.kind.toUpperCase()}${group.kind==="ac1"?` · Phase ${group.phase}`:""}${group.kind==="dc"?` · η ${group.efficiency}`:""} · Mindestleistung ${group.minimum} kW${input.mode==="static"?` · ${group.factorMode==="curve"?`Referenzkurve ${group.userClass}`:`k ${group.factor}`}`:""}`}))]);
  if(calculatorId==="premium-lkw"&&input.depotLayout==="modular")return [...parseDepotUnits(input.depotUnits).map(unit=>({label:`${unit.label} → ${unit.grid}`,value:`${unit.modules} × ${unit.modulePower} kW DC · η ${unit.efficiency} · Grid ${unit.gridAmps} A`})),...parseDepotPoints(input.depotPoints).map(point=>({label:point.label,value:`${point.ports} × ${point.power} kW ${point.connector} → ${point.unitId}${input.mode==="static"?` · k ${point.factor}`:""}`}))];
  return[];
}
