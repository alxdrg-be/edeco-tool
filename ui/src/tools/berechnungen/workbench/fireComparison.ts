import { number, validateResult, type CalculatorDefinition, type CalculationResult, type Field, type Inputs, type Tone } from "./types.ts";
import { calculateFireLoadPositions, fireLoadRowsToPositions, parseFireLoadRows, type FireLoadRow } from "./installation.ts";

const fmt=(value:number)=>value.toLocaleString("de-CH",{maximumFractionDigits:3});
const dynamic=[{key:"fireloadMode",values:["dynamic"]}];
const commonKeys=new Set(["routeType","route","limit"]);
const beforeExamples:readonly FireLoadRow[]=[
  {id:"fire-before-1",name:"Beispiel Kabelgruppe A · Bestand",mjPerMeter:"1.5",quantity:"20",length:"20",evidence:"open"},
  {id:"fire-before-2",name:"Beispiel Kabelgruppe B · Bestand",mjPerMeter:"2",quantity:"10",length:"20",evidence:"open"},
];
const afterExamples:readonly FireLoadRow[]=[
  {id:"fire-after-1",name:"Beispiel Kabelgruppe A · Planung",mjPerMeter:"1",quantity:"10",length:"20",evidence:"open"},
  {id:"fire-after-2",name:"Beispiel Kabelgruppe B · Planung",mjPerMeter:"1",quantity:"5",length:"20",evidence:"open"},
];

function numericMetric(result:CalculationResult,label:string):number {
  const value=result.metrics.find(metric=>metric.label===label)?.value;
  if(typeof value!=="number"||!Number.isFinite(value))throw new Error("Brandlast-Zwischenergebnis ist ungültig.");
  return value;
}
function evidenceText(row:FireLoadRow):string {
  return row.evidence==="critical"?"Kritisches Brandverhalten":row.evidence==="open"?"Nachweis offen":"Am Projekt dokumentiert · Freigabe separat";
}
function stateRows(label:string,result:CalculationResult,positions:readonly FireLoadRow[]):NonNullable<CalculationResult["rows"]> {
  return [
    {label:`${label} · Prüfung`,value:result.status.text},
    ...(result.rows??[]).map(row=>({...row,label:`${label} · ${row.label}`})),
    ...positions.map((row,index)=>({label:`${label} · ${row.name||`Position ${index+1}`} · Nachweis`,value:Number(row.quantity.replace(",","."))===0?"Keine Kabel dieser Position erfasst":evidenceText(row)})),
  ];
}

/** Keeps saved two-group models while new comparisons use independent user cable lists. */
export function createFireComparisonDefinition(legacy:CalculatorDefinition):CalculatorDefinition {
  const legacyFields=legacy.fields.map(field=>commonKeys.has(field.key)?{...field}:{...field,visibleWhen:[...(field.visibleWhen??[]),{key:"fireloadMode",values:["legacy"]}]});
  const rowsField=(key:string,label:string,defaults:readonly FireLoadRow[]):Field=>({key,label,default:JSON.stringify(defaults),kind:"text",group:label,visibleWhen:dynamic,help:"Eigene Kabelpositionen mit Herstellerwert, Anzahl, Länge und Nachweisstatus. Die voreingestellten Werte sind ausschliesslich manuelle Rechenbeispiele."});
  return {
    ...legacy,
    description:"Beliebig viele eigene Kabelpositionen vor und nach einer Sanierung vergleichen.",
    scope:"VKF BSR 14-15 Ziffer 5.2.1 / NIN 4.2.2.2.7 · eigene Kabelwerte, horizontaler Vergleich oder vertikale Mengenbilanz",
    fields:[
      {key:"fireloadMode",label:"Kabelerfassung",default:"dynamic",kind:"select",group:"Vergleich",options:[{value:"dynamic",label:"Getrennte Kabelpositionslisten vorher / nachher"},{value:"legacy",label:"Gespeicherter Vergleich zweier Kabelgruppen"}],help:"Neue Listen führen beide Zustände unabhängig. Gespeicherte Gruppenrechnungen bleiben im Bestandsmodus erreichbar."},
      ...legacyFields,
      rowsField("fireloadRows","Kabelbestand vorher",beforeExamples),
      rowsField("fireloadRowsAfter","Kabelbestand nachher",afterExamples),
    ],
    calculate(input:Inputs):CalculationResult {
      if(input.fireloadMode==="legacy")return validateResult(legacy.calculate(input));
      if(input.fireloadMode!=="dynamic")throw new Error("Eine gültige Kabelerfassung wählen.");
      if(!["horizontal","vertical"].includes(input.routeType))throw new Error("Eine gültige Fluchtwegart wählen.");
      const routeType=input.routeType as "horizontal"|"vertical",horizontal=routeType==="horizontal";
      const length=number(input,"route","Fluchtweglänge",0,100000);
      const limit=horizontal?number(input,"limit","Horizontaler Vergleichswert",0,1e6):null;
      const beforeRows=parseFireLoadRows(input.fireloadRows),afterRows=parseFireLoadRows(input.fireloadRowsAfter);
      const before=calculateFireLoadPositions(fireLoadRowsToPositions(beforeRows),length,routeType,limit??200);
      const after=calculateFireLoadPositions(fireLoadRowsToPositions(afterRows),length,routeType,limit??200);
      const beforeTotal=numericMetric(before,"Brandlast total"),afterTotal=numericMetric(after,"Brandlast total");
      const beforeDensity=numericMetric(before,"Brandlast bezogen auf Fluchtweg"),afterDensity=numericMetric(after,"Brandlast bezogen auf Fluchtweg");
      const beforeCount=numericMetric(before,"Kabel total"),afterCount=numericMetric(after,"Kabel total"),reduction=beforeTotal>0?(beforeTotal-afterTotal)/beforeTotal*100:null;
      const empty=beforeCount+afterCount===0,error=before.status.tone==="error"||after.status.tone==="error",open=before.status.tone==="warning"||after.status.tone==="warning";
      const tone:Tone=error?"error":empty?"neutral":!horizontal||open?"warning":"neutral";
      const text=empty?"Keine Kabel in beiden Zuständen erfasst; die leere Bilanz ist kein Ausführungsnachweis.":error?"Mindestens ein Zustand überschreitet die Vergleichsgrenze oder enthält kritisches Brandverhalten.":!horizontal?"Vertikaler Fluchtweg: beide Zustände als Mengenbilanz, ohne pauschale Grenzwertfreigabe.":open?"Mindestens ein Kabelnachweis ist offen; die numerische Reduktion bestätigt keine brandschutztechnische Freigabe.":"Beide Zahlenbilanzen liegen innerhalb der eingegebenen Vergleichsgrenze; lokale Brandlast, Nachweise und Anwendbarkeit separat bestätigen.";
      return validateResult({
        metrics:[
          {label:"Vorher",value:beforeDensity,unit:"MJ/m",tone:before.status.tone},
          {label:"Nachher",value:afterDensity,unit:"MJ/m",tone:after.status.tone},
          {label:"Reduktion",value:reduction??"–",unit:reduction===null?undefined:"%"},
          {label:"Brandlast vorher total",value:beforeTotal,unit:"MJ"},
          {label:"Brandlast nachher total",value:afterTotal,unit:"MJ"},
          {label:"Kabel vorher",value:beforeCount,unit:"Stk.",digits:0},
          {label:"Kabel nachher",value:afterCount,unit:"Stk.",digits:0},
        ],
        status:{tone,text},
        rows:[...stateRows("Vorher",before,beforeRows),...stateRows("Nachher",after,afterRows),...(limit===null?[]:[{label:"Horizontaler Vergleichswert",value:limit,unit:"MJ/m"}])],
        comparisons:limit===null?undefined:[{title:"Horizontaler Fluchtweg · Brandlast / Vergleichswert",unit:"MJ/m",items:[{label:"Vorher",actual:beforeDensity,target:limit},{label:"Nachher",actual:afterDensity,target:limit}]}],
        series:horizontal?undefined:[{label:"Vorher",value:beforeDensity},{label:"Nachher",value:afterDensity}],
        seriesLabel:"Brandlast beider Zustände bezogen auf die Fluchtweglänge",seriesUnit:"MJ/m",
        formula:`Q = Σ(Brandlast je Meter × Anzahl × Kabellänge); Q_vorher = ${fmt(beforeTotal)} MJ; Q_nachher = ${fmt(afterTotal)} MJ; q_vorher = ${fmt(beforeTotal)} / ${fmt(length)} = ${fmt(beforeDensity)} MJ/m; q_nachher = ${fmt(afterTotal)} / ${fmt(length)} = ${fmt(afterDensity)} MJ/m; ${reduction===null?"Reduktion bei leerem Ausgangsbestand nicht prozentual definiert":`Reduktion = (${fmt(beforeTotal)} − ${fmt(afterTotal)}) / ${fmt(beforeTotal)} × 100 = ${fmt(reduction)} %`}${limit===null?"; vertikal ohne Grenzwertvergleich":`; horizontaler Vergleich mit ${fmt(limit)} MJ/m`}.`,
        limitations:["Beide Zustände verwenden eigene Benutzerdaten. Ein dokumentierter Nachweisstatus ist eine Projekteingabe und wird nicht aus einem Kabelnamen oder einer angenommenen CPR-Klasse abgeleitet. Es wird keine Herstellerdatenbank eingebettet.","Die Bilanz zeigt Mittelwerte über die betrachtete Fluchtweglänge. Lokale Häufungen, Funktionserhalt, Abschottungen, Schutzverkleidungen und die konkrete VKF-Anwendbarkeit bleiben separat zu beurteilen. Vertikale Fluchtwege erhalten keine pauschale Grenzwertfreigabe.","Eine negative Reduktion bedeutet eine Zunahme. Bei leerem Ausgangsbestand wird keine prozentuale Reduktion berechnet."],
      });
    },
  };
}
