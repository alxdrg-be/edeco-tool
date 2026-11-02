import type { CalculatorDefinition } from './types.ts';
import { calculateSelectivityStages, defaultSelectivityStages } from './selectivityStages.ts';

/** Add variable cable/device stages without changing archived three-stage models. */
export function withSelectivityStages(legacy:CalculatorDefinition):CalculatorDefinition {
  return {...legacy,fields:[
    {key:'selectivityMode',label:'Aufbau',default:'stages',kind:'select',group:'Grundlage',help:'Eine bis sechs Schutzstufen mit Zuleitung; gespeicherte ältere Vergleiche behalten ihr Dreistufenmodell.',options:[{value:'stages',label:'Variable Schutzstufen & Zuleitungen'},{value:'legacy',label:'Drei Stufen · bisheriger Paarvergleich'}]},
    {key:'supplyVoltage',label:'Nennspannung',default:'400',kind:'select',group:'Netz',help:'Einphasig kann kein nachgelagerter dreiphasiger Abgang entstehen.',options:[{value:'400',label:'400 / 230 V · Drehstrom'},{value:'230',label:'230 V · einphasig'}],visibleWhen:[{key:'selectivityMode',values:['stages']}]},
    {key:'sourceIk',label:'Kurzschlussstrom am Anschluss',default:'10',unit:'kA',group:'Netz',min:.01,max:1000,help:'Prospektiver Quellenstrom; vereinfachtes R/X-Verhältnis des Netzes 0.1.',visibleWhen:[{key:'selectivityMode',values:['stages']}]},
    {key:'earthing',label:'Netzform',default:'TN',kind:'select',group:'Netz',help:'Bei TT/IT wird ohne Erdungs-/Isolationsdaten kein L–PE-Strom berechnet.',options:[{value:'TN',label:'TN-S / TN-C-S'},{value:'TT',label:'TT'},{value:'IT',label:'IT'}],visibleWhen:[{key:'selectivityMode',values:['stages']}]},
    {key:'selectivityStages',label:'Schutzstufen',default:JSON.stringify(defaultSelectivityStages()),kind:'text',group:'Stufen',help:'Erweiterbare Schutzstufen mit unabhängigen Geräte- und Kabelangaben.'},
    ...legacy.fields.map(f=>({...f,visibleWhen:[{key:'selectivityMode',values:['legacy']},...(f.visibleWhen??[])]})),
  ],calculate(input){if(input.selectivityMode!==undefined&&!['stages','legacy'].includes(input.selectivityMode))throw Error('Gültigen Selektivitäts-Aufbau wählen.');return input.selectivityMode==='stages'?calculateSelectivityStages(input):legacy.calculate(input);}};
}
