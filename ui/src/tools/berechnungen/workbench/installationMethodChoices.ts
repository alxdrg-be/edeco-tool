import type { Inputs } from './types.ts';

/** UI guidance over the existing published method keys; no additional rating data. */
export const NIN_INSTALLATION_METHODS: readonly {value:string;label:string;construction:'single'|'multi'|'shared'}[] = [
  {value:'A1',label:'A1 · Einadrig im Rohr · wärmegedämmte Wand',construction:'single'},
  {value:'A2',label:'A2 · Mehradriges Kabel im Rohr · wärmegedämmte Wand',construction:'multi'},
  {value:'B1',label:'B1 · Einadrig im Rohr · an Wand / Decke',construction:'single'},
  {value:'B2',label:'B2 · Mehradriges Kabel im Rohr · an Wand / Decke',construction:'multi'},
  {value:'C',label:'C · Kabel direkt an Wand / Decke',construction:'shared'},
  {value:'D',label:'D · Kabel direkt im Erdreich',construction:'shared'},
  {value:'E',label:'E · Mehradriges Kabel frei in Luft / auf Kabeltasse',construction:'multi'},
  {value:'F',label:'F · Einadrig frei in Luft · berührendes Dreieck',construction:'single'},
  {value:'F-eben',label:'F · Einadrig frei in Luft · eben / parallel',construction:'single'},
  {value:'G-h',label:'G · Einadrig mit Abstand · horizontal',construction:'single'},
  {value:'G-v',label:'G · Einadrig mit Abstand · vertikal',construction:'single'},
  {value:'D1',label:'D1 · Erdverlegung · nur manuelle Projektwerte',construction:'shared'},
  {value:'D2',label:'D2 · Erdverlegung · nur manuelle Projektwerte',construction:'shared'},
];

export function ninMethodOptions(construction='all'):{value:string;label:string}[] {
  if(!['all','single','multi'].includes(construction))throw Error('Einadrig, mehradrig oder die vollständige Bestandsansicht wählen.');
  return NIN_INSTALLATION_METHODS.filter(method=>construction==='all'||method.construction==='shared'||method.construction===construction).map(({value,label})=>({value,label}));
}

/** A deliberate construction change also makes its corresponding method visible. */
export function editNinInstallationInput(input:Inputs,key:string,value:string):Inputs {
  const next={...input,[key]:value};
  if(key!=='conductorKind'||value==='all')return next;
  const single:Record<string,string>={A2:'A1',B2:'B1',E:'F'};
  const multi:Record<string,string>={A1:'A2',B1:'B2',F:'E','F-eben':'E','G-h':'E','G-v':'E'};
  const mapping=value==='single'?single:value==='multi'?multi:null;
  if(!mapping)throw Error('Gültige Leiter-/Kabelbauart wählen.');
  return {...next,method:mapping[input.method]??input.method};
}
