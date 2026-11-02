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
export interface ChargingGridInput { id: string; label: string; amps: string; groups: StationGroupInput[]; mode?:ChargingMode|"inherit"; factorMode?:"group"|"manual"|"curve"; factor?:string; userClass?:"residents"|"visitors"|"transit" }
export interface ChargingStation {
  id: string; label: string; groupId: string; kind: ChargingKind; phase: 1 | 2 | 3 | null;
  nominalKW: number; assignedKW: number; acInputKW: number; efficiency: number;
  minimumKW: number; active: boolean; factor: number; requested: boolean;
}
export interface ChargingGridResult {
  id: string; label: string; amps: number; mode?:ChargingMode; assignedKW: number; acInputKW: number; installedKW: number;
  phases: [number,number,number]; grossPhases?:[number,number,number]; netInputKW?:number; sourceKW?:number; overload: boolean; activeCount: number; waitingCount: number; stations: ChargingStation[];
}
export interface ChargingNetworkResult {
  houseAmps: number; houseKW: number; reserveKW: number; mode: ChargingMode;
  installedKW: number; assignedKW: number; acInputKW: number; availableACKW: number;
  housePhases: [number,number,number]; strongestPhaseCurrent: number;
  overload: boolean; reserveExceeded: boolean; activeCount: number; waitingCount: number; grids: ChargingGridResult[];
  factorBasis: string; minimumBasis: string;
  operatingHours:number; vehicleConsumption:number; deliveredEnergyKWh:number; rangeKm:number;
  sourcePotentialKW:number; sourceKW:number; sourceConnection:string; sourceLimited:boolean;
  grossHouseACKW:number; netHouseACKW:number; importEnergyKWh:number; exportEnergyKWh:number; grossHousePhases:[number,number,number];
}
export const CHARGING_KINDS = [{ value:"ac1", label:"AC 1~ · 230 V" },{ value:"ac3", label:"AC 3~ · 400 V" },{ value:"dc", label:"DC · AC-Aufnahme über η" }] as const;
export const CHARGING_POWER_CHOICES: Record<ChargingKind, number[]> = { ac1:[3.7,7.4], ac3:[11,22], dc:[50,100,150,350] };
export const GRID_AMP_CHOICES = [25,35,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3000];
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
    return { id,label,amps:typeof grid.amps === "number" ? String(grid.amps) : grid.amps as string,groups,...(grid.mode===undefined?{}:{mode:choose<ChargingMode|"inherit">(grid.mode,["inherit","none","static","dynamic"],"Grid-Lastmanagement")}),...(grid.factorMode===undefined?{}:{factorMode:choose<"group"|"manual"|"curve">(grid.factorMode,["group","manual","curve"],"Grid-Faktorgrundlage")}),...(grid.factor===undefined?{}:{factor:grid.factor as string}),...(grid.userClass===undefined?{}:{userClass:grid.userClass as "residents"|"visitors"|"transit"}) };
  });
}
/** Mixed-grid budget with phase constraints. The activation order is explicit input order. */
export function calculateChargingNetwork(input: Inputs): ChargingNetworkResult {
  const houseAmps = numeric(input.house,"Hausanschluss",10000), reserveKW = numeric(input.reserve,"Gebäudereserve",100000,true), mode = choose(input.mode,["none","static","dynamic"],"Lastmanagement");
  const houseKW = houseAmps * AC3_KW_PER_A, reserveCurrent = reserveKW / AC3_KW_PER_A;
  const optional=(key:string,fallback:string,label:string,max:number,zero=false)=>numeric(input[key]===undefined?fallback:input[key],label,max,zero);
  const operatingHours=optional("chargingHours","10","Ladebetrieb pro Tag",24),vehicleConsumption=optional("chargingConsumption","15","Fahrzeugverbrauch",1000);
  const pv=optional("chargingPV","0","PV-Nennleistung",100000,true),battery=optional("chargingBattery","0","Nutzbare Speicherenergie pro Tag",1e8,true);
  const sourcePotentialKW=.7*pv+battery/operatingHours;
  const sourceConnection=input.chargingSourceConnection??"house";
  const sourceSpecifications=parseChargingGrids(input.grids),sourceGrid=sourceConnection==="house"?undefined:sourceSpecifications.find(grid=>grid.id===sourceConnection);
  if(sourceConnection!=="house"&&!sourceGrid)throw new Error("PV-/Speicheranschluss einem vorhandenen Grid oder dem Hausanschluss zuordnen.");
  // Balanced simultaneous-source assumption. Limiting the source to the selected
  // connection rating is deliberately conservative for reverse power flow.
  const sourceKW=Math.min(sourcePotentialKW,houseKW,sourceGrid?numeric(sourceGrid.amps,"Grid-Vorsicherung",10000)*AC3_KW_PER_A:houseKW),sourceCurrent=sourceKW/AC3_KW_PER_A;
  const sourceLimited=sourceKW<sourcePotentialKW-TOL,availableACKW=Math.max(0,houseKW-reserveKW+sourceKW);
  const specifications = parseChargingGrids(input.grids), coefficients: [number,number,number][] = [], stations: ChargingStation[] = [], gridIndices: number[] = [],stationUncapped:boolean[]=[];
  const grids: ChargingGridResult[] = specifications.map((grid,gridIndex) => {
    const gridMode=grid.mode&&grid.mode!=="inherit"?grid.mode:mode;
    const amps = numeric(grid.amps,`${grid.label} Vorsicherung`,10000), nominalPhases: [number,number,number] = [0,0,0];
    let pointIndex = 0;
    const requestedPerPower=new Map<string,number>();
    const gridStations: ChargingStation[] = [];
    for (const group of grid.groups) {
      const count = numeric(group.count,`${grid.label} · Anzahl`,1000,true);
      if (!Number.isInteger(count)) throw new Error(`${grid.label}: ganze Anzahl Ladepunkte eingeben.`);
      if (stations.length + count > 2000) throw new Error("Das gemischte Modell unterstützt höchstens 2000 Ladepunkte pro Rechenstand.");
      const power = numeric(group.power,`${grid.label} · Ladeleistung`,5000);
      const efficiency = group.kind === "dc" ? numeric(group.efficiency,`${grid.label} · DC-Wirkungsgrad`,1) : 1;
      const uncapped=gridMode==="none"||grid.mode==="static";
      const minimum = !uncapped && count > 0 ? numeric(group.minimum,`${grid.label} · Projekt-Mindestleistung`,power) : 0;
      const perGridFactor=grid.factorMode!==undefined&&grid.factorMode!=="group";
      let factor = 1;
      if (gridMode === "static" && count > 0) {
        const perGrid=perGridFactor;
        const factorMode = choose(perGrid?grid.factorMode:group.factorMode,["manual","curve"],"Faktorgrundlage");
        if (factorMode === "manual") factor = numeric(perGrid?grid.factor:group.factor,`${grid.label} · Leistungsanteil`,1,true);
        else {
          const curveCount=perGrid?grid.groups.filter(other=>other.kind===group.kind&&Number(String(other.power).replace(',','.'))===power).reduce((sum,other)=>sum+numeric(other.count,`${grid.label} · Gruppenanzahl`,1000,true),0):count;
          const userClass=choose(perGrid?grid.userClass:group.userClass,["residents","visitors","transit"],"Anwenderklasse");
          const observed = publishedEVFactor(userClass,curveCount,power,!CHARGING_POWER_CHOICES[group.kind].includes(power));
          if (observed === null) throw new Error(`${group.label}: für diese Anwenderklasse und Ladeleistung ist keine veröffentlichte Referenzkurve hinterlegt. Manuellen Faktor wählen.`);
          factor = observed;
        }
      }
      let requestedCount = gridMode === "static" ? Math.ceil(count * factor) : count;
      if(gridMode==="static"&&perGridFactor){
        const groupKey=`${group.kind}:${power}`;
        if(!requestedPerPower.has(groupKey)){
          const sameCount=grid.groups.filter(other=>other.kind===group.kind&&Number(String(other.power).replace(',','.'))===power).reduce((sum,other)=>sum+numeric(other.count,`${grid.label} · Gruppenanzahl`,1000,true),0);
          requestedPerPower.set(groupKey,Math.ceil(sameCount*factor));
        }
        requestedCount=Math.min(count,requestedPerPower.get(groupKey)!);
        requestedPerPower.set(groupKey,requestedPerPower.get(groupKey)!-requestedCount);
      }
      for (let point = 0; point < count; point++) {
        const phaseIndex = group.kind === "ac1" ? group.phase === "auto" ? nominalPhases.indexOf(Math.min(...nominalPhases)) : Number(group.phase)-1 : null;
        const coeff: [number,number,number] = phaseIndex === null ? [1/(efficiency*AC3_KW_PER_A),1/(efficiency*AC3_KW_PER_A),1/(efficiency*AC3_KW_PER_A)] : [0,0,0];
        if (phaseIndex !== null) coeff[phaseIndex] = 1 / .230;
        for (let phase=0;phase<3;phase++) nominalPhases[phase] += coeff[phase] * power;
        const station: ChargingStation = { id:`${grid.id}/${group.id}/${point+1}`, label:`${group.label} · ${point+1}`, groupId:group.id,kind:group.kind,phase:phaseIndex === null ? null : phaseIndex+1 as 1|2|3,nominalKW:power,assignedKW:0,acInputKW:0,efficiency,minimumKW:minimum,active:false,factor,requested:point < requestedCount };
        stations.push(station);gridStations.push(station);coefficients.push(coeff);gridIndices.push(gridIndex);stationUncapped.push(uncapped);pointIndex++;
      }
    }
    return { id:grid.id,label:grid.label,amps,mode:gridMode,assignedKW:0,acInputKW:0,installedKW:gridStations.reduce((sum,p)=>sum+p.nominalKW,0),phases:sourceConnection===grid.id?[-sourceCurrent,-sourceCurrent,-sourceCurrent]:[0,0,0],sourceKW:sourceConnection===grid.id?sourceKW:0,overload:false,activeCount:0,waitingCount:0,stations:gridStations };
  });
  if (!stations.length) throw new Error("Mindestens einen Ladepunkt erfassen.");
  const housePhases: [number,number,number] = [reserveCurrent-sourceCurrent,reserveCurrent-sourceCurrent,reserveCurrent-sourceCurrent];
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
      limits.push({spare:grid.amps*AC3_KW_PER_A-grid.acInputKW+(grid.sourceKW??0),rate:own.reduce((sum,index)=>sum+1/stations[index].efficiency,0),members:own});
      for(let phase=0;phase<3;phase++) limits.push({spare:grid.amps-grid.phases[phase],rate:own.reduce((sum,index)=>sum+coefficients[index][phase],0),members:own.filter(index=>coefficients[index][phase]>0)});
    }
    return limits.filter(limit=>limit.rate>0);
  };
  // Unmanaged branches retain full demand and consume capacity before managed
  // branches. Their overload remains visible; no global cap hides their load.
  stations.forEach((station,index)=>{if(stationUncapped[index]&&station.requested){station.active=true;addPower(index,station.nominalKW);}});
  {
    // Lowest-priority points wait if their project minimum cannot fit. Different phases may still fit.
    stations.forEach((station,index)=>{
      if(stationUncapped[index]||!station.requested)return;
      const headroom=Math.min(...constraints([index]).map(limit=>Math.max(0,limit.spare)/limit.rate));
      if(headroom+TOL>=station.minimumKW){station.active=true;addPower(index,station.minimumKW);}
    });
    let eligible=stations.flatMap((station,index)=>!stationUncapped[index]&&station.active&&station.assignedKW<station.nominalKW-TOL?[index]:[]);
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
  for(const grid of grids){
    grid.activeCount=grid.stations.filter(station=>station.active).length;grid.waitingCount=grid.stations.length-grid.activeCount;
    grid.netInputKW=grid.acInputKW-(grid.sourceKW??0);grid.grossPhases=grid.phases.map(current=>current+(grid.sourceKW??0)/AC3_KW_PER_A) as [number,number,number];
    grid.overload=grid.phases.some(current=>Math.abs(current)>grid.amps+TOL)||Math.abs(grid.netInputKW)>grid.amps*AC3_KW_PER_A+TOL;
  }
  const installedKW=stations.reduce((sum,p)=>sum+p.nominalKW,0), assignedKW=stations.reduce((sum,p)=>sum+p.assignedKW,0), strongestPhaseCurrent=Math.max(...housePhases.map(Math.abs)), reserveExceeded=reserveKW>houseKW+sourceKW+TOL;
  const deliveredEnergyKWh=assignedKW*operatingHours,rangeKm=deliveredEnergyKWh/vehicleConsumption*100,grossHouseACKW=reserveKW+houseChargingKW,netHouseACKW=grossHouseACKW-sourceKW,grossHousePhases=housePhases.map(current=>current+sourceCurrent) as [number,number,number];
  return {houseAmps,houseKW,reserveKW,mode,operatingHours,vehicleConsumption,deliveredEnergyKWh,rangeKm,sourcePotentialKW,sourceKW,sourceConnection,sourceLimited,grossHouseACKW,netHouseACKW,grossHousePhases,importEnergyKWh:Math.max(0,netHouseACKW)*operatingHours,exportEnergyKWh:Math.max(0,-netHouseACKW)*operatingHours,installedKW,assignedKW,acInputKW:houseChargingKW,availableACKW,housePhases,strongestPhaseCurrent,overload:reserveExceeded||houseChargingKW>availableACKW+TOL||strongestPhaseCurrent>houseAmps+TOL||grids.some(grid=>grid.overload),reserveExceeded,activeCount:stations.filter(p=>p.active).length,waitingCount:stations.filter(p=>!p.active).length,grids,factorBasis:specifications.some(grid=>grid.mode&&grid.mode!=="inherit"||grid.factorMode&&grid.factorMode!=="group")?`Grid-Modi individuell; manuelle Faktoren oder ${EV_FACTOR_BASIS}. Unbegrenzte und explizit statische Grids zuerst, dynamische Grids im verbleibenden gemeinsamen Haus-/Phasenbudget; aktive Punkte nach Eingabereihenfolge.`:mode === "static" ? `${EV_FACTOR_BASIS}; Aktivierung je Gruppe ceil(n × k)` : mode === "none" ? "Ohne Lastmanagement · alle Punkte aktiv, k = 1" : "Dynamisches gemischtes Budgetmodell · aktive Punkte nach Eingabereihenfolge",minimumBasis:"Mindestleistung je Gruppe ist eine explizite Projektannahme, kein automatisch bestimmter Normwert."};
}

export interface DepotUnitInput { id:string; label:string; grid:string; gridAmps:string; modules:string; modulePower:string; efficiency:string; powerBasis?:"ac"|"dc"; mode?:ChargingMode|"inherit";factor?:string }
export interface DepotPointInput { id:string; label:string; unitId:string; ports:string; connector:"CCS"|"MCS"; power:string; factor:string; minimum?:string }
export interface DepotUnitResult { id:string;label:string;grid:string;gridAmps:number;modules:number;modulePower:number;efficiency:number;powerBasis?:"ac"|"dc";mode?:ChargingMode;factor?:number;capacityDC:number;demandDC:number;assignedDC:number;acInputKW:number;overload:boolean }
export interface DepotPointResult { id:string;label:string;unitId:string;ports:number;connector:"CCS"|"MCS";nominalKW:number;factor:number;demandDC:number;assignedDC:number;perPortKW:number;activePorts?:number;waitingPorts?:number;minimumKW?:number }
export interface DepotNetworkResult { houseAmps:number;houseKW:number;reserveKW:number;mode:ChargingMode;allocation?:"project"|"reference";activeCount?:number;waitingCount?:number;availableACKW:number;acInputKW:number;assignedDC:number;demandDC:number;lossKW:number;overload:boolean;units:DepotUnitResult[];points:DepotPointResult[];grids:{label:string;amps:number;mode?:ChargingMode;acInputKW:number;overload:boolean}[] }
export const DEPOT_MODULE_POWER_CHOICES=[30,40,50,60,75,90,100,120,150,200,300,400,500,600,1000];
export const DEPOT_POINT_POWER_CHOICES:Record<"CCS"|"MCS",number[]>={CCS:[50,75,100,150,200,300,350,400,600],MCS:[500,750,1000,1500,2000,3000]};
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
export function calculateDepotNetwork(input:Inputs):DepotNetworkResult {
  const houseAmps=numeric(input.feed,"AC-Einspeisung",10000),reserveKW=numeric(input.reserve,"Gebäudereserve",100000,true),mode=choose(input.mode,["none","static","dynamic"],"Lastmanagement");
  const allocation=choose(input.depotAllocation??"project",["project","reference"],"Depot-Zuteilung"),reference=allocation==="reference",houseKW=houseAmps*AC3_KW_PER_A,availableACKW=Math.max(0,houseKW-reserveKW);
  const globalMinimumRaw=input.depotMinimum??"50";
  const unitInputs=parseDepotUnits(input.depotUnits),pointInputs=parseDepotPoints(input.depotPoints);
  const units:DepotUnitResult[]=unitInputs.map(unit=>{
    const modules=numeric(unit.modules,`${unit.label} · Module`,100);if(!Number.isInteger(modules))throw new Error(`${unit.label}: ganze Modulzahl eingeben.`);
    const modulePower=numeric(unit.modulePower,`${unit.label} · Modulleistung`,2000),efficiency=numeric(unit.efficiency,`${unit.label} · Wirkungsgrad`,1),gridAmps=numeric(unit.gridAmps,`${unit.grid} · Vorsicherung`,10000),powerBasis=choose(unit.powerBasis??"dc",["ac","dc"],"Leistungsbezug der Power Unit");
    const unitMode=choose(unit.mode&&unit.mode!=="inherit"?unit.mode:mode,["none","static","dynamic"],"Grid-Lastmanagement");
    const factor=reference&&unitMode==="static"?numeric(unit.factor??input.depotReferenceFactor??"1","Statischer Gridfaktor",1,true):1;
    return{id:unit.id,label:unit.label,grid:unit.grid,gridAmps,modules,modulePower,efficiency,powerBasis,mode:unitMode,factor,capacityDC:modules*modulePower*(powerBasis==="ac"?efficiency:1),demandDC:0,assignedDC:0,acInputKW:0,overload:false};
  });
  const globalMinimum=reference&&units.some(unit=>unit.mode==="dynamic")?numeric(globalMinimumRaw,"DC-Mindestleistung",5000):0;
  const points:DepotPointResult[]=pointInputs.map(point=>{
    const unit=units.find(unit=>unit.id===point.unitId);if(!unit)throw new Error(`${point.label}: zugeordnete Power Unit fehlt. Die Zuordnung wird nicht automatisch ersetzt.`);
    const ports=numeric(point.ports,`${point.label} · Abgabepunkte`,1000,true);if(!Number.isInteger(ports))throw new Error(`${point.label}: ganze Anzahl Abgabepunkte eingeben.`);
    const pointMode=unit.mode??mode;
    const nominalKW=numeric(point.power,`${point.label} · Punktleistung`,5000),factor=pointMode==="static"?(reference?unit.factor??1:numeric(point.factor,`${point.label} · Leistungsanteil`,1,true)):1;
    const minimumKW=reference&&pointMode==="dynamic"?Math.min(nominalKW,point.minimum===undefined||point.minimum===""?globalMinimum:numeric(point.minimum,`${point.label} · Mindestleistung`,nominalKW)):0;
    const demandDC=ports*nominalKW*(reference?1:factor);unit.demandDC+=demandDC;
    return{id:point.id,label:point.label,unitId:point.unitId,ports,connector:point.connector,nominalKW,factor,demandDC,assignedDC:0,perPortKW:0,...(reference?{activePorts:0,waitingPorts:ports,minimumKW}:{})};
  });
  if(!points.some(point=>point.ports>0))throw new Error("Mindestens einen DC-Abgabepunkt erfassen.");
  const portLists=units.map(unit=>points.filter(point=>point.unitId===unit.id).flatMap(point=>Array.from({length:point.ports},(_,index)=>({point,index,power:0,active:false}))));
  if(portLists.reduce((sum,list)=>sum+list.length,0)>10000)throw new Error("Das Depotmodell unterstützt höchstens 10'000 Abgabepunkte.");
  const eligible=portLists.map((list,index)=>{
    const sorted=[...list].sort((a,b)=>b.point.nominalKW-a.point.nominalKW);
    return reference&&units[index].mode==="static"?sorted.slice(0,Math.min(sorted.length,Math.max(0,Math.ceil(sorted.length*(units[index].factor??1)-1e-9)))):sorted;
  });
  const groupNames=[...new Set(units.map(unit=>unit.grid))];
  const grids=groupNames.map(label=>{const own=units.filter(unit=>unit.grid===label),amps=own[0].gridAmps;if(own.some(unit=>Math.abs(unit.gridAmps-amps)>TOL))throw new Error(`${label}: dieselbe Grid-Vorsicherung bei allen zugeordneten Power Units angeben.`);if(own.some(unit=>unit.mode!==own[0].mode))throw new Error(`${label}: Lastmanagement muss bei allen Power Units dieses Grids übereinstimmen.`);return{label,amps,mode:own[0].mode??mode,acInputKW:0,overload:false};});
  units.forEach((unit,index)=>{const demand=reference?eligible[index].reduce((sum,port)=>sum+port.point.nominalKW,0):unit.demandDC;unit.assignedDC=reference||unit.mode!=="none"?Math.min(demand,unit.capacityDC):demand;unit.acInputKW=unit.assignedDC/unit.efficiency;});
  // The explicit source-style static/unmanaged cases retain their configured
  // demand and warn on an AC overload; project mode keeps its former bounds.
  const isManaged=(unit:DepotUnitResult)=>unit.mode!=="none"&&(!reference||unit.mode==="dynamic");
  grids.forEach(grid=>{
    const own=units.filter(unit=>unit.grid===grid.label);if(!own.some(isManaged))return;
    const requested=own.reduce((sum,unit)=>sum+unit.acInputKW,0),scale=requested>0?Math.min(1,grid.amps*AC3_KW_PER_A/requested):1;
    own.forEach(unit=>{unit.assignedDC*=scale;unit.acInputKW*=scale;});
  });
  const fixedAC=units.filter(unit=>!isManaged(unit)).reduce((sum,unit)=>sum+unit.acInputKW,0),availableManaged=Math.max(0,availableACKW-fixedAC),managed=units.filter(isManaged);
  if(reference){
    const managedGrids=grids.filter(grid=>managed.some(unit=>unit.grid===grid.label)),weight=managedGrids.reduce((sum,grid)=>sum+Math.min(grid.amps,houseAmps)*AC3_KW_PER_A,0);
    managedGrids.forEach(grid=>{
      const own=managed.filter(unit=>unit.grid===grid.label),request=own.reduce((sum,unit)=>sum+unit.acInputKW,0),share=weight>0?availableManaged*Math.min(grid.amps,houseAmps)*AC3_KW_PER_A/weight:0,scale=request>0?Math.min(1,share/request):1;
      own.forEach(unit=>{unit.assignedDC*=scale;unit.acInputKW*=scale;});
    });
  }else{
    const requested=managed.reduce((sum,unit)=>sum+unit.acInputKW,0),scale=requested>0?Math.min(1,availableManaged/requested):1;
    managed.forEach(unit=>{unit.assignedDC*=scale;unit.acInputKW*=scale;});
  }
  if(reference)units.forEach((unit,index)=>{
    const list=eligible[index],budget=unit.assignedDC;
    let minimumSum=0;
    for(const port of list){const need=unit.mode==="dynamic"?port.point.minimumKW??globalMinimum:0;if(minimumSum+need<=budget+TOL){port.active=true;port.power=need;minimumSum+=need;}}
    // Equal water filling across active ports, capped at each nameplate. Waiters
    // receive exactly zero; if a true minimum cannot fit, no false active port.
    const active=list.filter(port=>port.active);let left=budget-minimumSum,open=active.filter(port=>port.power<port.point.nominalKW-TOL);
    while(open.length&&left>TOL){
      const level=Math.min(...open.map(port=>port.power)),lowest=open.filter(port=>port.power<=level+TOL),higher=open.filter(port=>port.power>level+TOL),next=higher.length?Math.min(...higher.map(port=>port.power))-level:Infinity;
      const increment=Math.min(left/lowest.length,...lowest.map(port=>port.point.nominalKW-port.power),next);
      if(increment<=TOL)break;
      lowest.forEach(port=>{port.power+=increment;});left-=increment*lowest.length;open=open.filter(port=>port.power<port.point.nominalKW-TOL);
    }
    for(const port of list)if(port.active){port.point.activePorts=(port.point.activePorts??0)+1;port.point.assignedDC+=port.power;}
    unit.assignedDC=list.reduce((sum,port)=>sum+port.power,0);unit.acInputKW=unit.assignedDC/unit.efficiency;
  });
  if(reference)points.forEach(point=>{point.waitingPorts=point.ports-point.activePorts!;point.perPortKW=point.activePorts?point.assignedDC/point.activePorts:0;});
  else points.forEach(point=>{const unit=units.find(unit=>unit.id===point.unitId)!;point.assignedDC=unit.demandDC>0?unit.assignedDC*point.demandDC/unit.demandDC:0;point.perPortKW=point.ports>0?point.assignedDC/point.ports:0;});
  units.forEach(unit=>{unit.overload=unit.assignedDC>unit.capacityDC+TOL||reference&&unit.mode==="none"&&unit.demandDC>unit.capacityDC*1.05+TOL;});
  grids.forEach(grid=>{grid.acInputKW=units.filter(unit=>unit.grid===grid.label).reduce((sum,unit)=>sum+unit.acInputKW,0);grid.overload=grid.acInputKW>grid.amps*AC3_KW_PER_A+TOL;});
  const acInputKW=units.reduce((sum,unit)=>sum+unit.acInputKW,0),assignedDC=units.reduce((sum,unit)=>sum+unit.assignedDC,0),demandDC=units.reduce((sum,unit)=>sum+unit.demandDC,0);
  return{houseAmps,houseKW,reserveKW,mode,allocation,...(reference?{activeCount:points.reduce((sum,p)=>sum+p.activePorts!,0),waitingCount:points.reduce((sum,p)=>sum+p.waitingPorts!,0)}:{}),availableACKW,acInputKW,assignedDC,demandDC,lossKW:acInputKW-assignedDC,overload:reserveKW>houseKW+TOL||acInputKW>availableACKW+TOL||units.some(unit=>unit.overload)||grids.some(grid=>grid.overload),units,points,grids};
}
/** Human-readable lists for the PDF; raw JSON is never used as report text. */
export function planningReportInputs(calculatorId:string,input:Inputs):{label:string;value:string}[]{
  if(calculatorId==="premium-ladekosten"&&input.costLayout==="contracts")return costReportInputs(input);
  if(calculatorId==="premium-pkw"&&input.layout==="modular") {
    const grids=parseChargingGrids(input.grids);
    return [{label:"PV-/Speicheranschluss",value:input.chargingSourceConnection===undefined||input.chargingSourceConnection==="house"?"Hausanschluss · vor den Grids":grids.find(grid=>grid.id===input.chargingSourceConnection)?.label??"Ungültige Grid-Zuordnung"},...grids.flatMap(grid=>{
      const effectiveMode=grid.mode&&grid.mode!=="inherit"?grid.mode:input.mode,factorMode=grid.factorMode??"group";
      const gridFactor=effectiveMode!=="static"?"":factorMode==="manual"?` · Gridfaktor k ${grid.factor}`:factorMode==="curve"?` · Referenzkurve Grid ${grid.userClass}`:" · Faktoren je Punktgruppe";
      return [{label:grid.label,value:`Vorsicherung ${grid.amps} A · LM ${effectiveMode}${gridFactor}`},...grid.groups.map(group=>{
        const groupFactor=effectiveMode==="static"&&factorMode==="group"?` · ${group.factorMode==="curve"?`Referenzkurve ${group.userClass}`:`k ${group.factor}`}`:"";
        const minimum=effectiveMode!=="none"&&grid.mode!=="static"?` · Mindestleistung ${group.minimum} kW`:"";
        return {label:`${grid.label} · ${group.label}`,value:`${group.count} × ${group.power} kW · ${group.kind.toUpperCase()}${group.kind==="ac1"?` · Phase ${group.phase}`:""}${group.kind==="dc"?` · η ${group.efficiency}`:""}${minimum}${groupFactor}`};
      })];
    })];
  }
  if(calculatorId==="premium-lkw"&&input.depotLayout==="modular"){
    const units=parseDepotUnits(input.depotUnits);
    return [...units.map(unit=>({label:`${unit.label} → ${unit.grid}`,value:`${unit.modules} × ${unit.modulePower} kW ${(unit.powerBasis??"dc").toUpperCase()} · η ${unit.efficiency} · Grid ${unit.gridAmps} A · LM ${unit.mode??"inherit"}${unit.factor!==undefined?` · k ${unit.factor}`:""}`})),...parseDepotPoints(input.depotPoints).map(point=>{
      const unit=units.find(unit=>unit.id===point.unitId),pointMode=unit?.mode&&unit.mode!=="inherit"?unit.mode:input.mode;
      return{label:point.label,value:`${point.ports} × ${point.power} kW ${point.connector} → ${point.unitId}${pointMode==="static"?` · k ${input.depotAllocation==="reference"?unit?.factor??input.depotReferenceFactor:point.factor}`:""}${input.depotAllocation==="reference"&&pointMode==="dynamic"?` · Mindestleistung ${point.minimum||input.depotMinimum} kW (gedeckelt durch Nennleistung)`:""}`};
    })];
  }
  return[];
}
