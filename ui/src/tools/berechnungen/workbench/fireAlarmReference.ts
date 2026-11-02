import { integer, number, type CalculatorDefinition, type CalculationResult, type Field, type Inputs } from './types.ts';

/** Published calculator assumptions, not an independently checked SES table. */
export const FIRE_ALARM_REFERENCE = {
  url: 'https://www.elektro-rechner.ch/premium/brandmelder-rechner.php',
  dataUrl: 'https://www.elektro-rechner.ch/assets/ses-bma-2021.js',
  observed: '2026-11-02',
  sourceSha256: 'a8a7751c07ee2fcd6f43e8f485f1a29f20a52c85174cef62c71bdc3951394b51',
  scope: 'Authenticated published model: height/slope lookup, room/corridor/vertical counts, alarm groups and material costs. Full SES text not independently checked.',
} as const;
const options = (key:string,label:string,value:string,group:string,items:readonly (readonly [string,string])[],help:string):Field => ({key,label,default:value,group,kind:'select',options:items.map(([value,label])=>({value,label})),help});
const field = (key:string,label:string,value:string,unit:string,group:string,min=0,max=1e6):Field => ({key,label,default:value,unit,group,min,max,help:'Datierter veröffentlichter Referenzansatz. Eingaben und Anwendbarkeit am konkreten Projekt prüfen.'});
const num=(i:Inputs,key:string,label:string,max=1e6,zero=false)=>number(i,key,label,0,max,zero);
const pick=(i:Inputs,key:string,allowed:readonly string[])=>{if(!allowed.includes(i[key]))throw Error(`${key}: gültige Auswahl treffen.`);return i[key];};
export const FIRE_ROOM_TYPES = [
  ['buero','Büro / Wohnraum'],['lager','Lager (trocken)'],['produktion','Produktion / Werkstatt'],['technik','Technikraum / Server'],['korridor','Korridor / Fluchtweg (Breite ≤ 3 m)'],['treppenhaus_offen','Treppenhaus · offen'],['treppenhaus_geschl','Treppenhaus · geschlossen'],['liftschacht','Liftschacht'],['installationsschacht','Installationsschacht'],
] as const;
const verticalTypes = new Set(['treppenhaus_offen','treppenhaus_geschl','liftschacht','installationsschacht']);
export function fireDetectorTable(height:number,area:number,detector:string,slope:string,heatClass:string) {
  if (![height,area].every(Number.isFinite)||height<=0||area<=0)throw Error('Gültige Raumhöhe und Fläche eingeben.');
  if(!['smoke','heat'].includes(detector)||!['flat','sloped'].includes(slope)||!['A1','A2'].includes(heatClass))throw Error('Melder-/Deckenparameter prüfen.');
  if(detector==='smoke') {
    if(height>12)throw Error('Punktförmiger Rauchmelder über 12 m ausserhalb des veröffentlichten Tabellenansatzes; Sonderanwendung planen.');
    if(height<=6&&area<=30)return {area:30,spacing:10,single:true};
    if(area<=80)return {area:80,spacing:slope==='flat'?12:15,single:false};
    if(height<=6)return {area:slope==='flat'?60:90,spacing:slope==='flat'?10:16,single:false};
    return {area:slope==='flat'?80:110,spacing:slope==='flat'?12:18,single:false};
  }
  if(height>(heatClass==='A2'?6:7.5))throw Error(`Wärmemelder ${heatClass}: veröffentlichte Höhengrenze ${heatClass==='A2'?6:7.5} m überschritten; Sonderanwendung planen.`);
  return area<=30?{area:30,spacing:slope==='flat'?8:10,single:false}:{area:slope==='flat'?20:40,spacing:slope==='flat'?6:11,single:false};
}

/** Minimise rectangular cell count; explicitly preserve the true side dimensions. */
function referenceGrid(length:number,width:number,area:number,spacing:number) {
  let best={columns:0,rows:0,count:Infinity};
  const min=Math.max(1,Math.ceil(length/spacing-1e-9));
  for(let x=min;x<=min+400;x++) {
    const y=Math.max(1,Math.ceil(width/spacing-1e-9),Math.ceil(length*width/(x*area)-1e-9));
    if(x*y<best.count)best={columns:x,rows:y,count:x*y};
    if(x>=best.count)break;
  }
  if(!Number.isFinite(best.count)||best.count>10000)throw Error('Raumraster zu gross für diese Vorplanung.');
  if(length/(2*best.columns)<.5-1e-9||width/(2*best.rows)<.5-1e-9)throw Error('Das Raster unterschreitet 0.5 m Wandabstand; Sondergeometrie separat planen.');
  return best;
}

export function calculateFireAlarmReference(i:Inputs):CalculationResult {
  const length=num(i,'length','Raumlänge',10000),width=num(i,'width','Raumbreite',10000),height=num(i,'detectorHeight','Raumhöhe',1000),area=length*width;
  const room=pick(i,'detectorRoom',FIRE_ROOM_TYPES.map(v=>v[0])),detector=pick(i,'detectorType',['smoke','heat']),slope=pick(i,'detectorSlope',['flat','sloped']),heatClass=pick(i,'detectorHeatClass',['A1','A2']);
  const storeys=integer(i,'detectorStoreys','Geschosse',0,1000),noise=num(i,'detectorNoise','Grundschallpegel',150,true),manual=integer(i,'detectorManual','Handfeuermelder',0,10000,true),address=pick(i,'detectorAddress',['collective','addressed']),optical=pick(i,'detectorOptical',['auto','yes','no']);
  const vertical=verticalTypes.has(room),corridor=room==='korridor'&&width<=3+1e-9;
  const indicator=room==='liftschacht'?0:integer(i,'detectorIndicators','Raumanzeigelampen',0,10000,true);
  let count=0,horns=0,columns=0,rows=0,table:ReturnType<typeof fireDetectorTable>|undefined;
  if(vertical) {
    count=room==='liftschacht'?1:room==='treppenhaus_offen'?Math.max(1,Math.ceil(height/12)):storeys;
    horns=room==='treppenhaus_offen'?Math.max(1,Math.ceil(storeys/2)):room==='treppenhaus_geschl'?storeys:0;
  } else {
    table=fireDetectorTable(height,area,detector,slope,heatClass);
    if(corridor){columns=Math.max(1,Math.ceil(length/(detector==='smoke'?15:10)));rows=1;count=columns;}
    else if(table.single){columns=rows=count=1;}
    else {const grid=referenceGrid(length,width,table.area,table.spacing);({columns,rows,count}=grid);}
    horns=corridor?Math.max(1,Math.ceil(length/25)):Math.max(1,Math.ceil(area/400),Math.ceil(Math.max(length,width)/20));
  }
  const flash=(optical==='yes'||optical==='auto'&&noise>85)?horns:0,groupStoreys=vertical?1:storeys;
  const groupMax=address==='addressed'?32:20,groups=Math.max(1,Math.ceil(Math.ceil(count/groupStoreys)/groupMax)*groupStoreys+Math.ceil(manual/10));
  const prices=[['detectorUnitPrice','Brandmelder',count],['detectorHornPrice','Alarmierungshörner',horns],['detectorFlashPrice','Blitzleuchten',flash],['detectorManualPrice','Handfeuermelder',manual],['detectorIndicatorPrice','Raumanzeigelampen',indicator],['detectorGroupPrice','Meldergruppen',groups]] as const;
  const costs=prices.map(([key,label,count])=>({label,value:num(i,key,label+' · Preis',1e6,true)*count,unit:'CHF'}));
  const total=costs.reduce((s,r)=>s+r.value,0),recommendedNoise=Math.max(65,noise+10),special=room==='liftschacht'&&height>40;
  const unsafeOptical=optical==='no'&&noise>85;
  return {
    metrics:[{label:'Brandmelder',value:count,digits:0},{label:'Alarmierungshörner',value:horns,digits:0},{label:'Blitzleuchten',value:flash,digits:0},{label:'Meldergruppen',value:groups,digits:0},{label:'Materialkosten',value:total,unit:'CHF',digits:2},{label:'Empfohlener Pegel · Referenz',value:recommendedNoise,unit:'dB(A)'}],
    status:{tone:unsafeOptical||recommendedNoise>118?'error':'warning',text:unsafeOptical?'Optische Alarmierung manuell deaktiviert trotz Grundschall > 85 dB(A); Konzept prüfen.':recommendedNoise>118?'Empfohlener Pegel überschreitet 118 dB(A); akustisches Konzept separat prüfen.':special?'Liftschacht über 40 m: Sonderanwendung Ansaugrauchmeldung erforderlich; ein Symbol zählt keine Ansaugstellen.':'Datierter Referenzansatz für Mengen und Material. Keine automatische SES-/VKF-Freigabe.'},
    rows:[{label:'Raumfläche',value:area,unit:'m²'},...(table?[{label:'Veröffentlichte Maximalfläche',value:corridor?'Korridorregel':table.area,unit:corridor?undefined:'m²'},{label:'Veröffentlichter Achsabstand',value:corridor?(detector==='smoke'?15:10):table.spacing,unit:'m'}]:[]),{label:'Handfeuermelder',value:manual},{label:'Raumanzeigelampen',value:indicator},...costs],
    diagram:vertical?undefined:{kind:'room',length,width,columns,rows},
    formula:`Mengen: ${count} Melder, ${horns} Hörner, ${flash} Blitzleuchten; Gruppen = ceil(ceil(${count}/${groupStoreys})/${groupMax}) × ${groupStoreys} + ceil(${manual}/10) = ${groups}. Materialkosten = Σ(Anzahl × Einzelpreis) = ${total.toFixed(2)} CHF.`,
    limitations:[
      'Datenquelle: elektro-rechner.ch, SES-Bezug Ausgabe 01.07.2021, authentifiziert abgerufen 02.11.2026. Dies reproduziert veröffentlichte Rechenannahmen; Normtext und Anwendbarkeit wurden nicht unabhängig bestätigt.',
      'Hörnerzahl ist eine geometrische Näherung, kein akustischer Nachweis. Preise sind editierbare Materialannahmen ohne Montage. Gruppenbildung und Alarmierung benötigen das konkrete Anlagenkonzept.',
      ...(vertical?['Vertikaler Bereich: nur Mengenangaben. Eine rechteckige Raumgrafik wird hierfür bewusst nicht als Schachtplanung ausgegeben.']:[]),
      ...(room==='korridor'&&!corridor?['Korridor breiter als 3 m: normale Raumregel verwendet.']:[]),
      ...(special?['Ansaugklassen/Ansaugstellen, Melderempfindlichkeit und Detektionsnachweis separat planen.']:[]),
    ],
  };
}

export function createFireAlarmDefinition(manual:CalculatorDefinition):CalculatorDefinition {
  const reference=[{key:'detectorBasis',values:['reference']}];
  const fields:Field[]=[
    options('detectorRoom','Raumtyp','buero','Raum',FIRE_ROOM_TYPES,'Veröffentlichte Raum-/Sonderbereichsauswahl; tatsächliche Nutzung und Melderart prüfen.'),
    options('detectorType','Meldertyp','smoke','Raum',[['smoke','Rauchmelder'],['heat','Wärmemelder']],'Veröffentlichte Tabellenansätze; keine automatische Melderzulassung.'),
    field('detectorHeight','Raumhöhe','2.8','m','Raum',.01,1000),
    options('detectorSlope','Deckenneigung','flat','Raum',[['flat','Flach · ≤ 20°'],['sloped','Geneigt · > 20°']],'Neigungsgruppen der veröffentlichten Referenz.'),
    {...options('detectorHeatClass','Wärmemelderklasse','A1','Raum',[['A1','A1 · bis 7.5 m'],['A2','A2 · bis 6 m']],'Höhengrenzen des veröffentlichten Ansatzes.'),visibleWhen:[...reference,{key:'detectorType',values:['heat']}]},
    field('detectorStoreys','Anzahl Geschosse','1','Gesch.','Anlagentechnik',1,1000),
    options('detectorAddress','BMZ-Adressierung','collective','Anlagentechnik',[['collective','Kollektiv · max. 20/Gruppe'],['addressed','Adressiert · max. 32/Gruppe']],'Veröffentlichte Gruppenannahmen; Hersteller und Konzept separat prüfen.'),
    field('detectorNoise','Grundschallpegel','60','dB(A)','Anlagentechnik',0,150),
    options('detectorOptical','Optische Alarmierung','auto','Anlagentechnik',[['auto','Auto · nach Grundschall'],['yes','Ja · manuell'],['no','Nein']],'Automatik der Referenz: Grundschall über 85 dB(A).'),
    field('detectorManual','Handfeuermelder','0','Stk.','Anlagentechnik',0,10000),field('detectorIndicators','Raumanzeigelampen','1','Stk.','Anlagentechnik',0,10000),
    ...[['detectorUnitPrice','Preis Brandmelder','45'],['detectorHornPrice','Preis Alarmierungshorn','65'],['detectorFlashPrice','Preis Blitzleuchte','95'],['detectorManualPrice','Preis Handfeuermelder','120'],['detectorIndicatorPrice','Preis Raumanzeigelampe','45'],['detectorGroupPrice','Preis Meldergruppe','180']].map(([key,label,value])=>field(key,label,value,'CHF/Stk.','Materialkosten')),
  ];
  return {...manual,description:'Raumtyp, Höhe, Decke, Alarmierung, Gruppen und Materialkosten vorplanen.',scope:'SES-Bezug 01.07.2021 · datierte veröffentlichte Rechenannahmen oder manuelles Raster; fachliche Freigabe offen.',fields:[options('detectorBasis','Berechnungsgrundlage','reference','Grundlage',[['reference','Veröffentlichter Referenzansatz · 2026'],['manual','Manuelle geometrische Vorgaben']],'Die Referenzrechnung ist ein Zahlenabgleich, keine unabhängige Bestätigung der SES-Norm.'),...manual.fields.map(f=>['length','width'].includes(f.key)?f:{...f,visibleWhen:[...(f.visibleWhen??[]),{key:'detectorBasis',values:['manual']}]}),...fields.map(f=>({...f,visibleWhen:f.visibleWhen??reference}))],calculate(input){const basis=pick(input,'detectorBasis',['manual','reference']);return basis==='manual'?manual.calculate(input):calculateFireAlarmReference(input);}};
}
