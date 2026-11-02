import { integer, number, type Inputs, type SeriesItem } from "./types.ts";

export interface CostPointInput { id:string;label:string;preset?:string;kind:"ac"|"dc";count:string;commission:string;power:string;hardware:string;installation:string;basis:string;annualEnergy:string;replacement:string }
export interface CostBusinessResult { id:"V1"|"V2"|"V3"|"V4";label:string;selected:boolean;initial:number;replacement:number;capex:number;annual:number;opex:number;total:number;averagePerPointYear:number;series:SeriesItem[] }
export const COST_MODEL_OPTIONS=[{value:"V1",label:"V1 · Eigenständiger Betrieb"},{value:"V2",label:"V2 · Betriebscontracting"},{value:"V3",label:"V3 · Stations-Contracting"},{value:"V4",label:"V4 · Vollständiges Contracting"}] as const;
export const COST_POINT_PRESETS = [
  {id:"ac",label:"11–22 kW AC",kind:"ac",power:"11",hardware:"2000",installation:"750",basis:"2300",annualEnergy:"3500",replacement:"2750"},
  {id:"dc1",label:"22–80 kW DC",kind:"dc",power:"50",hardware:"25000",installation:"900",basis:"10300",annualEnergy:"25900",replacement:"25900"},
  {id:"dc2",label:"80–150 kW DC",kind:"dc",power:"150",hardware:"50000",installation:"1000",basis:"16400",annualEnergy:"39900",replacement:"51000"},
  {id:"dc3",label:">150 kW DC",kind:"dc",power:"350",hardware:"80000",installation:"1000",basis:"20800",annualEnergy:"86100",replacement:"81000"},
] as const;
export const COST_REFERENCE_CLASS_KW:Readonly<Record<string,number>>={ac:11,dc1:50,dc2:100,dc3:350};
export const COST_REFERENCE_USAGE:Readonly<Record<string,readonly number[]>>={ac:[1870,6600,3484.8],dc1:[26400,26400,21120],dc2:[39600,39600,42240],dc3:[79200,79200,147840]};
export const COST_REFERENCE_OBSERVATION = { url:"https://www.elektro-rechner.ch/premium/ladeinfrastruktur-kostenrechner.php", observed:"2026-11-02", verification:"Authenticated Playwright, 5 Basic/Advanced cases, 2026-11-02",sourceSha256:"35fb336456e2ad8248492baf57bacc90dccdbcd2baf0aa22d49ba976624337a0", scope:"Authentifizierter Clientcode 2026-11-02: Basic/Advanced, Klassenäquivalente, Basis im Startjahr, Nutzergruppen und LM-Ersatz; datierte Rechenannahmen, keine Vertrags-/Normfreigabe" } as const;
export function defaultCostRows():CostPointInput[]{return COST_POINT_PRESETS.map((preset,index)=>({...preset,id:`cost-${preset.id}`,preset:preset.id,count:index===0?"4":"0",commission:"1"}));}

const numeric=(value:unknown,label:string,max=1e9,zero=false)=>number({value:typeof value==="number"?String(value):typeof value==="string"?value:""},"value",label,0,max,zero);
export function parseCostRows(raw:string,editing=false):CostPointInput[]{
  let rows:unknown;try{rows=JSON.parse(raw);}catch{throw new Error("Kostenpositionen: gültige gespeicherte Liste erforderlich.");}
  if(!Array.isArray(rows)||!rows.length||rows.length>24)throw new Error("1 bis 24 Ladepunkt-Kostenpositionen erfassen.");
  const ids=new Set<string>();
  return rows.map((row,index)=>{if(!row||typeof row!=="object"||Array.isArray(row))throw new Error(`Kostenposition ${index+1}: gültige Daten erforderlich.`);const value=row as Record<string,unknown>;if(typeof value.id!=="string"||!value.id||ids.has(value.id))throw new Error("Kostenpositionen benötigen eindeutige IDs.");ids.add(value.id);if(typeof value.label!=="string"||(!editing&&!value.label.trim())||value.label.length>60)throw new Error("Kostenposition: Bezeichnung mit 1 bis 60 Zeichen eingeben.");if(!["ac","dc"].includes(String(value.kind)))throw new Error("Kostenposition: AC oder DC wählen.");return value as unknown as CostPointInput;});
}
/** Observed ownership/fee structure, using explicit project prices rather than hidden defaults. */
export function calculateChargingCosts(input:Inputs){
  const accounting=input.costAccounting??"project";
  if(!["project","reference"].includes(accounting))throw new Error("Kostenansatz auswählen.");
  const reference=accounting==="reference";
  const selected=input.costModel;if(!COST_MODEL_OPTIONS.some(option=>option.value===selected))throw new Error("Kostenmodell V1 bis V4 wählen.");
  const detail=input.costDetailMode;if(!["basic","advanced"].includes(detail))throw new Error("Basis- oder Detailkostenmodus wählen.");
  const years=integer(input,"years","Betrachtungsdauer",0,50),startYear=integer(input,"startYear","Startjahr",1899,2200),cycle=integer(input,"replacementCycle","Ersatz nach vollen Betriebsjahren",0,50,true),buy=number(input,"buyPrice","Netzstrompreis",0,100,true);
  let usage:number[]=[];
  if(reference&&detail==="advanced"){
    usage=["costRefFleet","costRefCommuters","costRefVisitors"].map(key=>number(input,key,"Nutzergruppenanteil",0,100,true)/100);
    if(Math.abs(usage.reduce((sum,value)=>sum+value,0)-1)>1e-9)throw new Error("Die Nutzergruppenanteile müssen zusammen 100 % ergeben.");
  }
  const rows=parseCostRows(input.costRows).map(row=>{
    const count=numeric(row.count,`${row.label} · Anzahl`,10000,true);if(!Number.isInteger(count))throw new Error(`${row.label}: ganze Ladepunktzahl eingeben.`);
    const commission=numeric(row.commission,`${row.label} · Inbetriebnahme-Betriebsjahr`,50);if(!Number.isInteger(commission))throw new Error(`${row.label}: ganzes Inbetriebnahme-Betriebsjahr eingeben.`);
    const preset=row.preset??"";
    if(reference&&!Object.hasOwn(COST_REFERENCE_CLASS_KW,preset))throw new Error("Im Referenzansatz jeder Position eine belegte Leistungskategorie zuweisen.");
    const referenceEnergy=reference&&detail==="advanced"?COST_REFERENCE_USAGE[preset].reduce((sum,value,index)=>sum+value*usage[index],0):null;
    return{...row,count,commission,equivalentPower:reference?COST_REFERENCE_CLASS_KW[preset]:numeric(row.power,`${row.label} · Nennleistung`,5000),power:numeric(row.power,`${row.label} · Nennleistung`,5000),hardware:numeric(row.hardware,`${row.label} · Beschaffung`,1e7,true),installation:numeric(row.installation,`${row.label} · Installation`,1e7,true),basis:detail==="basic"?numeric(row.basis,`${row.label} · Basisinfrastruktur`,1e8,true):0,annualEnergy:referenceEnergy??numeric(row.annualEnergy,`${row.label} · Jahresenergie`,1e8,true),replacement:reference?0:numeric(row.replacement,`${row.label} · Ersatz`,1e7,true)};
  });
  const included=rows.filter(row=>row.commission<=years),points=included.reduce((sum,row)=>sum+row.count,0);if(!points)throw new Error("Mindestens einen Ladepunkt innerhalb der Betrachtungsdauer in Betrieb nehmen.");
  const equivalent=included.reduce((sum,row)=>sum+row.count*row.equivalentPower/11,0),annualEnergy=included.reduce((sum,row)=>sum+row.count*row.annualEnergy,0),station=included.reduce((sum,row)=>sum+row.count*(row.hardware+row.installation),0),basicBasis=included.reduce((sum,row)=>sum+row.count*row.basis,0);
  let base=basicBasis,pvShare=0,pvTariff=0,referenceCapacity=0;
  if(detail==="advanced"){
    const connection=reference?0:number(input,"baseConnection","Netzanschlusskosten",0,1e9,true),contribution=reference?0:number(input,"networkContribution","Netzkostenbeitrag",0,1e9,true),meters=reference?0:number(input,"meterCost","Mess-/Verteilungskosten",0,1e8,true),length=number(input,"routeMetres","Trassenlänge",0,1e6,true),perMetre=number(input,"routeUnitPrice","Trassenpreis",0,1e5,true),lm=number(input,"loadManagementCost","Lastmanagement-Kosten",0,1e8,true),planning=number(input,"planningPercent","Projektierungsanteil",0,100,true);
    base=(connection+contribution+meters+length*perMetre+lm)*(1+planning/100);
    if(reference){
      const expansion=input.costRefNetworkExpansion;
      if(!["yes","no"].includes(expansion))throw new Error("Netzanschluss-Erweiterung auswählen.");
      referenceCapacity=equivalent*11*.96;
      const rate=number(input,"costRefContributionRate","Netzkostenbeitrag CHF/kVA",0,1e6,true),basic=number(input,"costRefConnectionBase","Anschluss-Grundbetrag",0,1e9,true),metres=number(input,"costRefConnectionMetres","Anschlussdistanz",0,1e6,true),perM=number(input,"costRefConnectionRate","Anschlusspreis je Meter",0,1e6,true),distribution=number(input,"costRefDistributionFixed","Zwischenverteilung",0,1e9,true);
      base=(length*perMetre+distribution+lm+(expansion==="yes"?referenceCapacity*rate+basic+metres*perM:0))*(1+planning/100);
    }
    pvShare=number(input,"costPVShare","PV-Anteil am Ladeenergiebedarf",0,100,true)/100;pvTariff=number(input,"costPVTariff","PV-Strompreis",0,100,true);
  }
  const backend=number(input,"backendMonthly","Backendgebühr",0,1e5,true),operation=number(input,"operationMonthly","Betriebscontracting",0,1e5,true),stationFee=number(input,"stationMonthly","Stations-Contracting",0,1e5,true),basisFee=number(input,"basisMonthly","Basis-Contracting",0,1e5,true),maintenance=number(input,"maintenanceEquivalent","Wartung je 11-kW-Äquivalent und Jahr",0,1e6,true),dcMaintenance=detail==="advanced"?number(input,"dcMaintenance","Zusätzliche DC-Wartung je Punkt und Jahr",0,1e6,true):0;
  const weightedTariff=(1-pvShare)*buy+pvShare*pvTariff,energyCost=annualEnergy*weightedTariff,maintenanceAnnual=reference&&detail==="advanced"?included.filter(row=>row.kind==="ac").reduce((sum,row)=>sum+row.count,0)*maintenance+included.filter(row=>row.kind==="dc").reduce((sum,row)=>sum+row.count,0)*dcMaintenance:equivalent*maintenance+included.filter(row=>row.kind==="dc").reduce((sum,row)=>sum+row.count,0)*dcMaintenance;
  const models:CostBusinessResult[]=COST_MODEL_OPTIONS.map(option=>{
    const ownStation=option.value==="V1"||option.value==="V2",ownBasis=option.value!=="V4",initial=(ownStation?station:0)+(ownBasis?base:0);
    const series=Array.from({length:years},(_,index)=>{
      const operatingYear=index+1,active=included.filter(row=>row.commission<=operatingYear),newRows=included.filter(row=>row.commission===operatingYear),activePoints=active.reduce((sum,row)=>sum+row.count,0),activeEquivalent=active.reduce((sum,row)=>sum+row.count*row.equivalentPower/11,0),activeDC=active.filter(row=>row.kind==="dc").reduce((sum,row)=>sum+row.count,0);
      const common=active.reduce((sum,row)=>sum+row.count*row.annualEnergy,0)*weightedTariff+(option.value==="V1"?(reference&&detail==="advanced"?active.filter(row=>row.kind==="ac").reduce((sum,row)=>sum+row.count,0):activeEquivalent)*maintenance+activeDC*dcMaintenance:0);
      const annual=common+(option.value==="V1"?12*activePoints*backend:12*activeEquivalent*operation)+(option.value==="V3"||option.value==="V4"?12*activeEquivalent*stationFee:0)+(option.value==="V4"?12*activeEquivalent*basisFee:0);
      const stationInvestment=ownStation?newRows.reduce((sum,row)=>sum+row.count*(row.hardware+row.installation),0):0,basisInvestment=ownBasis?(reference?(index===0?base:0):detail==="basic"?newRows.reduce((sum,row)=>sum+row.count*row.basis,0):index===0?base:0):0,replacement=ownStation&&cycle>0?active.reduce((sum,row)=>{const age=operatingYear-row.commission;return sum+((reference?age===cycle:age>0&&age%cycle===0)?row.count*(reference?row.hardware+row.installation:row.replacement):0);},0):0;
      const lmReplacement=reference&&detail==="advanced"&&ownBasis&&index===cycle&&cycle>0?number(input,"loadManagementCost","Lastmanagement-Kosten",0,1e8,true)/2:0;
      return{label:String(startYear+index),value:stationInvestment+basisInvestment+replacement+lmReplacement,secondary:annual};
    });
    const capex=series.reduce((sum,year)=>sum+year.value,0),opex=series.reduce((sum,year)=>sum+(year.secondary??0),0),total=capex+opex,annual=series[series.length-1].secondary??0;
    return{id:option.value,label:option.label,selected:option.value===selected,initial,replacement:capex-initial,capex,annual,opex,total,averagePerPointYear:total/points/years,series};
  });
  return{models,selected:models.find(model=>model.selected)!,points,equivalent,annualEnergy,station,basis:base,energyCost,weightedTariff,years,startYear,detail,cycle,maintenanceAnnual,accounting,referenceCapacity};
}

export function costReportInputs(input:Inputs):{label:string;value:string}[] {
  const reference=input.costAccounting==="reference",advanced=reference&&input.costDetailMode==="advanced";
  return parseCostRows(input.costRows).map(row=>{
    const annual=advanced?COST_REFERENCE_USAGE[row.preset??""]?.reduce((sum,value,index)=>sum+value*Number(input[["costRefFleet","costRefCommuters","costRefVisitors"][index]])/100,0):Number(row.annualEnergy);
    const annualText=annual===undefined||!Number.isFinite(annual)?"ungültiger Energieansatz":`${annual.toLocaleString("de-CH",{maximumFractionDigits:4})} kWh/(LP·a)${advanced?" aus Nutzergruppen":""}`;
    return {label:row.label,value:`${row.count} × ${row.power} kW ${row.kind.toUpperCase()}${reference?` · Referenzklasse ${row.preset} (${COST_REFERENCE_CLASS_KW[row.preset??""]} kW-äq)`:""} · Inbetriebnahme Betriebsjahr ${row.commission} · Beschaffung ${row.hardware} CHF/LP · Installation ${row.installation} CHF/LP · Basis ${input.costDetailMode==="basic"?`${row.basis} CHF/LP`:"separate Detailkosten"} · ${annualText} · Ersatz ${reference?`${Number(row.hardware)+Number(row.installation)} CHF/LP aus Beschaffung + Installation`:row.replacement+" CHF/LP"}`};
  });
}
