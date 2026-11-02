import { number as readNumber, type CalculationResult, type Inputs } from './types.ts';
import { SELECTIVITY_CABLE_RX } from './selectivityCableData.ts';
import { LEGACY_VOLTAGE_WARNING, shortCircuitVoltageFactors } from '../voltageFactors.ts';

export const STAGE_DEVICES = [
  ['nh','NH gG/gL'],['ls_b','LS B'],['ls_c','LS C'],['ls_d','LS D'],['ls_k','LS K'],
  ['fi','FI / RCD'],['main','MCCB · thermisch-magnetisch'],['mccb','MCCB · elektronisch'],
] as const;
export const STAGE_CABLES = Object.keys(SELECTIVITY_CABLE_RX);
export interface SelectivityStage {
  id:string;name:string;type:string;rated:string;length:string;area:string;material:string;cable:string;system:string;
  delta:string;fiType:string;pairLimitKA:string;pairReference:string;
}
export function defaultSelectivityStages():SelectivityStage[] {
  return [
    {id:'stage-1',name:'Hausanschluss-Sicherung',type:'nh',rated:'250',length:'5',area:'150'},
    {id:'stage-2',name:'Unterverteilung UV1',type:'nh',rated:'100',length:'30',area:'50'},
    {id:'stage-3',name:'Endstromkreis K1',type:'ls_c',rated:'16',length:'40',area:'2.5'},
  ].map(s=>({...s,material:'Cu',cable:'NYY-J',system:s.id==='stage-3'?'3p':'5p',delta:'300',fiType:'A',pairLimitKA:'',pairReference:''}));
}
export function parseSelectivityStages(raw:string):SelectivityStage[] {
  let value:unknown;
  try{value=JSON.parse(raw);}catch{throw Error('Schutzstufen konnten nicht gelesen werden.');}
  if(!Array.isArray(value)||value.length<1||value.length>6)throw Error('Eine bis sechs Schutzstufen erfassen.');
  const keys=['id','name','type','rated','length','area','material','cable','system','delta','fiType','pairLimitKA','pairReference'] as const;
  const seen=new Set<string>();
  return value.map((v,index)=>{
    if(!v||typeof v!=='object'||keys.some(k=>typeof v[k]!=='string'))throw Error(`Stufe ${index+1}: unvollständige Angaben.`);
    if(!v.id||seen.has(v.id))throw Error('Schutzstufen benötigen eindeutige Kennungen.');
    seen.add(v.id);
    if(v.name.length>100||v.pairReference.length>500)throw Error('Bezeichnungen oder Quellenvermerk zu lang.');
    return Object.fromEntries(keys.map(k=>[k,v[k]])) as unknown as SelectivityStage;
  });
}
export interface StageCurrent { stage:SelectivityStage; ikMax:number; ikLoop:number|null; resistance:number;reactance:number }
export function selectivityStageCurrents(input:Inputs):StageCurrent[] {
  const stages=parseSelectivityStages(input.selectivityStages);
  if(!['400','230'].includes(input.supplyVoltage)||!['TN','TT','IT'].includes(input.earthing))throw Error('Gültige Netzspannung und Netzform wählen.');
  const factors=shortCircuitVoltageFactors(input.voltageTolerance);
  const single=input.supplyVoltage==='230',uPhase=single?230:400/Math.sqrt(3),ikSource=readNumber(input,'sourceIk','Kurzschlussstrom am Anschluss',0,1000)*1000;
  const z=factors.cMax*uPhase/(ikSource*(single?2:1)),x0=z/Math.sqrt(1.01);
  let r=.1*x0,x=x0,singlePath=single;
  return stages.map((stage,index)=>{
    const prefix=`Stufe ${index+1}`;
    const rated=readNumber(stage as unknown as Inputs,'rated',`${prefix}: Nennstrom`,0,100000);
    if(!rated||!STAGE_DEVICES.some(([id])=>id===stage.type)||!['Cu','Al'].includes(stage.material)||!['5p','4p','3p'].includes(stage.system))throw Error(`${prefix}: Auswahl prüfen.`);
    if(singlePath&&stage.system!=='3p')throw Error(`${prefix}: Ein dreiphasiger Abschnitt ist hinter einer einphasigen Einspeisung nicht möglich.`);
    if(stage.system==='3p')singlePath=true;
    const pair=SELECTIVITY_CABLE_RX[stage.cable]?.[stage.area];
    if(!pair)throw Error(`${prefix}: Kein belegtes R/X-Paar für diesen Kabeltyp und Querschnitt.`);
    const length=readNumber(stage as unknown as Inputs,'length',`${prefix}: Länge`,0,100000,true);
    r+=pair[0]*(stage.material==='Al'?1.63:1)*length/1000;
    x+=pair[1]*length/1000;
    const impedance=Math.hypot(r,x);
    if(stage.type==='fi'&&(!['10','30','100','300','500'].includes(stage.delta)||!['A','S','G','B'].includes(stage.fiType)))throw Error(`${prefix}: RCD-Auswahl prüfen.`);
    return {stage,ikMax:factors.cMax*uPhase/(impedance*(singlePath?2:1))/1000,ikLoop:input.earthing==='TN'?factors.cMin*uPhase/(2*impedance)/1000:null,resistance:r,reactance:x};
  });
}
export function calculateSelectivityStages(input:Inputs):CalculationResult {
  const factors=shortCircuitVoltageFactors(input.voltageTolerance);
  const nodes=selectivityStageCurrents(input);
  const pairs=nodes.slice(1).map((node,j)=>{
    const upper=nodes[j].stage,lower=node.stage,ratio=Number(upper.rated)/Number(lower.rated);
    if(lower.pairLimitKA.trim()) {
      const limit=readNumber(lower as unknown as Inputs,'pairLimitKA',`Paar ${j+1}→${j+2}: Herstellergrenze`,0,1000);
      if(!lower.pairReference.trim()||lower.pairReference.trim().length<8)throw Error(`Paar ${j+1}→${j+2}: konkrete Herstellerquelle zur Paargrenze angeben.`);
      if(upper.type==='fi'||lower.type==='fi')throw Error('Eine Paargrenze in kA ersetzt keinen RCD-Zeit-/Differenzstromnachweis.');
      const pass=node.ikMax<=limit+1e-9;
      return {tone:pass?'warning' as const:'error' as const,documented:pass,text:`Ik ${node.ikMax.toFixed(3)} kA ${pass?'≤':'>'} Paargrenze ${limit} kA · ${lower.pairReference}`};
    }
    let text='Hersteller-Koordinationstabelle erforderlich; Geräteart und Stromstaffelung allein reichen nicht.';
    if(upper.type==='nh'&&lower.type==='nh')text=`NH-Verhältnis ${ratio.toFixed(2)} ${ratio>=1.6?'≥':'<'} 1.6 als Staffelungshinweis; keine vollständige I²t-/Herstellerprüfung.`;
    if(upper.type==='fi'&&lower.type==='fi')text=`RCD: Differenzstromverhältnis ${(Number(upper.delta)/Number(lower.delta)).toFixed(2)}; vorgelagert Typ ${upper.fiType}. Strom- und Zeitstaffelung mit Herstellerdaten prüfen.`;
    if(upper.type==='fi'&&lower.type!=='fi')text='Vorgelagerter RCD kann bei Erdschluss vor dem nachgelagerten Überstromschutz auslösen. Keine Selektivität nachgewiesen.';
    return {tone:'warning' as const,documented:false,text};
  });
  const last=nodes[nodes.length-1],passes=pairs.filter(p=>p.documented).length;
  return {
    metrics:[{label:'Erfasste Schutzstufen',value:nodes.length},{label:'Ik am letzten Gerät · Modell',value:last.ikMax,unit:'kA',digits:3},{label:'L–PE-Schleifenstrom am Ende · Modell',value:last.ikLoop??'Netzform erfordert weitere Angaben',unit:last.ikLoop===null?undefined:'kA',digits:3},{label:'Paare innerhalb dokumentierter Grenze',value:`${passes} / ${pairs.length}`}],
    status:{tone:pairs.some(p=>p.tone==='error')?'error':'warning',text:pairs.some(p=>p.tone==='error')?'Eine dokumentierte Herstellergrenze wird überschritten.':factors.legacy?LEGACY_VOLTAGE_WARNING:'Kurzschlussmodell berechnet. Selektivität und Abschaltzeiten benötigen passende Herstellerdaten.'},
    rows:[{label:'Spannungstoleranz / cmax',value:`${factors.label} · ${factors.cMax.toFixed(2)}`},...nodes.flatMap((node,j)=>[{label:`Stufe ${j+1} · Ik max`,value:node.ikMax,unit:'kA'},{label:`Stufe ${j+1} · L–PE kalt, cmin`,value:node.ikLoop??'nicht ermittelt',unit:node.ikLoop===null?undefined:'kA'}]),...pairs.map((pair,j)=>({label:`Paar ${j+1} → ${j+2}`,value:pair.text}))],
    diagram:{kind:'chain',nodes:nodes.map((node,j)=>({label:node.stage.name||`Stufe ${j+1}`,value:`${STAGE_DEVICES.find(([id])=>id===node.stage.type)?.[1]} · ${node.stage.rated} A`,detail:`${node.stage.length} m · ${node.stage.area} mm² · Ik ${node.ikMax.toFixed(3)} kA`,tone:pairs[j-1]?.tone??'neutral'}))},
    formula:`ZQ = ${factors.cMax.toFixed(2)} · UPhase / (IkQuelle${input.supplyVoltage==='230'?' · 2':''}); RQ/XQ = 0.1; RΣ = RQ + Σ(R′ · L / 1000), XΣ = XQ + Σ(X′ · L / 1000); Ik = ${factors.cMax.toFixed(2)} · UPhase / (k · √(RΣ²+XΣ²)), k = 1 (3~) oder 2 (1~). L–PE bei TN: ${factors.cMin.toFixed(2)} · UPhase / (2 · |ZΣ|).`,
    limitations:[
      ...(factors.legacy?[LEGACY_VOLTAGE_WARNING]:[]),
      `cmax ${factors.cMax.toFixed(2)} für ${factors.label}. Der bereits maximale Quellenstrom wird mit demselben Faktor zurückgerechnet und erhält keinen zweiten Zuschlag.`,
      'R/X-Kabeldaten: datierter veröffentlichter Anbieterstand 02.11.2026; Cu 20 °C, Al-Widerstand als Faktor 1.63. Keine unabhängig bestätigte vollständige Norm-/Herstellertabelle.',
      'Das Kurzschlussmodell entspricht dem veröffentlichten kalten Pfadansatz. Der cmin-Schleifenwert bei 20 °C ist kein garantierter thermisch ungünstiger Ik-min-Nachweis. PE-Querschnitt wird gleich dem Phasenquerschnitt angenommen.',
      'TT und IT benötigen weitere Erdungs-/Isolationsangaben; L–PE-Schleifenstrom wird dort nicht aus einem TN-Modell vorgetäuscht.',
      'Die Referenz bewertet bestimmte Nennstromverhältnisse und generische Kennlinien als vollselektiv. Diese pauschale Freigabe wird nicht übernommen. D/K-/MCCB-Zeitkennlinien, Backup und konkrete Gerätekoordination sind nicht unabhängig belegt.',
      'Eine angegebene Hersteller-Paargrenze wird nur numerisch verglichen; richtige Geräte, Spannung, Polzahl und Gültigkeit der Quelle bleiben zu bestätigen.',
    ],
  };
}

/** Human-readable report entries; never expose the editor's raw JSON as a field. */
export function selectivityReportInputs(input:Inputs):{label:string;value:string}[] {
  if(input.selectivityMode!=='stages')return [];
  return parseSelectivityStages(input.selectivityStages).flatMap((s,index)=>[
    {label:`Stufe ${index+1} · ${s.name} · Schutzorgan`,value:`${STAGE_DEVICES.find(([id])=>id===s.type)?.[1]??s.type} · ${s.rated} A${s.type==='fi'?` · ${s.delta} mA · Typ ${s.fiType}`:''}`},
    {label:`Stufe ${index+1} · Zuleitung`,value:`${s.length} m · ${s.cable} · ${s.material} ${s.area} mm² · ${s.system==='3p'?'L/N/PE · 230 V':s.system==='4p'?'L1/L2/L3/PEN · 400 V':'L1/L2/L3/N/PE · 400 V'}`},
    ...(index>0&&s.pairLimitKA.trim()?[{label:`Paar ${index} → ${index+1} · dokumentierte Herstellergrenze`,value:`${s.pairLimitKA} kA · ${s.pairReference}`}]:[]),
  ]);
}
