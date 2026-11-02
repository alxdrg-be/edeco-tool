import { number, type Inputs } from './types.ts';
import { SIA_GROUPS, SIA_REFERENCE_CATEGORY } from './siaData.ts';
import { SIA_REFERENCE_CLIMATE, SIA_REFERENCE_GLZ, SIA_REFERENCE_GROUPS, SIA_REFERENCE_KCOR, SIA_REFERENCE_PV } from './siaReferenceData.ts';
import { calculateSIABalance, type SIAZoneInput } from './siaModel.ts';

export const siaReferenceKey = (zone:number,key:string) => `sia${zone===1?'':zone}${key}`;
const STANDBY_RATIO:Readonly<Record<string,number>> = {heating:.04,ventilation:.01,cooling:.03};

/** Dated provider profile calculation. No absent category/class becomes zero. */
export function calculateSIAReference(input:Inputs) {
  const climate=SIA_REFERENCE_CLIMATE[input.siaClimate];
  if(climate===undefined)throw Error('Eine veröffentlichte Klimaregion auswählen.');
  const metadata:{name:string;category:string;standbyKW:number;pvKWp:number;pvYearKWh:number;kcor:number;yearGlz:number}[]=[];
  const zones:SIAZoneInput[]=[];
  for(let index=1;index<=4;index++) {
    const get=(key:string)=>siaReferenceKey(index,key),building=input[get('Building')];
    if(building==='none')continue;
    const category=SIA_REFERENCE_CATEGORY[building];
    if(!category)throw Error(`Zone ${index}: gültige Nutzung auswählen.`);
    const area=number(input,get('RefArea'),`Zone ${index} · Nettofläche`,0,1e7,true);
    if(area===0)continue;
    const level=input[get('RefKcor')];
    if(!['min','mid','max'].includes(level))throw Error(`Zone ${index}: Kcor-Auswahl prüfen.`);
    const kcor=SIA_REFERENCE_KCOR[category][level as 'min'|'mid'|'max'];
    const yearGlz=input[get('RefGlz')]==='default'?SIA_REFERENCE_GLZ[category]:number(input,get('RefGlz'),`Zone ${index} · Jahresgleichzeitigkeit`,0,1,true);
    if(![.7,.8].includes(yearGlz))throw Error(`Zone ${index}: Jahresgleichzeitigkeit 0.7 oder 0.8 auswählen.`);
    let standbyKW=0;
    const consumers=SIA_GROUPS.map(group=>{
      const code=input[get(`Class_${group.id}`)],table=SIA_REFERENCE_GROUPS[group.id]?.[category];
      if(!table)throw Error(`Zone ${index}: kein veröffentlichtes Profil für ${category}.`);
      if(code==='keine'&&['devices','processes'].includes(group.id))return{groupId:group.id,powerDensity:0,energyDensity:0};
      const power=table.p[code],energy=table.e[code];
      const standby=table.sb?.[code]??(power===null||power===undefined?undefined:power*(STANDBY_RATIO[group.id]??0));
      if(typeof power!=='number'||typeof energy!=='number'||typeof standby!=='number')throw Error(`Zone ${index} · ${category} · ${group.label} ${code}: veröffentlichter Kennwert fehlt. Andere Klasse oder manuelle Rohkennwerte wählen.`);
      standbyKW+=standby*area*kcor/1000;
      return{groupId:group.id,powerDensity:power,energyDensity:energy};
    });
    const pvArea=number(input,get('RefPVArea'),`Zone ${index} · PV-Fläche`,0,1e7,true);
    const orientation=SIA_REFERENCE_PV[input[get('RefPVDirection')]];
    if(orientation===undefined)throw Error(`Zone ${index}: PV-Ausrichtung auswählen.`);
    const shade=number(input,get('RefShade'),`Zone ${index} · PV-Verschattung`,0,1);
    if(![1,.9,.75,.55].includes(shade))throw Error(`Zone ${index}: gültige Verschattungsstufe auswählen.`);
    const pvKWp=pvArea*.2,pvYearKWh=pvKWp*climate*orientation*shade*.8;
    const name=`Zone ${index} · ${category}`;
    zones.push({id:`reference-zone-${index}`,label:name,area,kcor,yearGlz,consumers});
    metadata.push({name,category,standbyKW,pvKWp,pvYearKWh,kcor,yearGlz});
  }
  if(!zones.length)throw Error('Mindestens eine Nutzungszone mit einer Nettofläche grösser als null erfassen.');
  // The provider displays production separately. Do not silently subtract all
  // PV production as self-consumption from the building's gross energy demand.
  const balance=calculateSIABalance({zones,pvYearKWh:0,pvSelfConsumptionPercent:0});
  return{balance,zones,metadata,standbyKW:metadata.reduce((sum,z)=>sum+z.standbyKW,0),pvKWp:metadata.reduce((sum,z)=>sum+z.pvKWp,0),pvYearKWh:metadata.reduce((sum,z)=>sum+z.pvYearKWh,0),kcorAverage:zones.reduce((sum,z)=>sum+z.kcor*z.area,0)/balance.area,yearGlzAverage:zones.reduce((sum,z)=>sum+z.yearGlz*z.area,0)/balance.area};
}
