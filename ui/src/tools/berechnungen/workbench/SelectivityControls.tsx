import { Plus, Trash2 } from 'lucide-react';
import { ChoiceCards, Explanation } from '../LabUI';
import { optionsWithProjectValue } from '../electricalOptions';
import { SELECTIVITY_CABLE_RX } from './selectivityCableData';
import { defaultSelectivityStages, parseSelectivityStages, STAGE_DEVICES, type SelectivityStage } from './selectivityStages';
import type { Inputs } from './types';
import './selectivity-controls.css';

export default function SelectivityControls({input,onChange,disabled=false}:{input:Inputs;onChange:(key:string,value:string)=>void;disabled?:boolean}) {
  let stages:SelectivityStage[];
  try{stages=parseSelectivityStages(input.selectivityStages);}catch(e){return <p className="lab-error" role="alert">{(e as Error).message}</p>;}
  const save=(next:SelectivityStage[])=>onChange('selectivityStages',JSON.stringify(next));
  const edit=(id:string,key:keyof SelectivityStage,value:string)=>save(stages.map(s=>s.id===id?{...s,[key]:value}:s));
  return <section className="sel-stage-editor" aria-label="Schutzstufen und Zuleitungen"><div className="sel-stage-toolbar"><span>{stages.length} / 6 Stufen</span><button className="lab-open" disabled={disabled||stages.length>=6} onClick={()=>save([...stages,{...defaultSelectivityStages()[2],id:crypto.randomUUID(),name:`Stufe ${stages.length+1}`}])}><Plus size={15}/>Stufe hinzufügen</button></div>
    {stages.map((s,j)=><details className="sel-stage-card" key={s.id} open={j===0}><summary>{j+1}. {s.name||'Schutzstufe'} · {s.rated||'–'} A</summary><div className="sel-stage-fields">
      <label>Bezeichnung<input value={s.name} maxLength={100} disabled={disabled} onChange={e=>edit(s.id,'name',e.target.value)}/></label>
      <label>Nennstrom (A)<input value={s.rated} inputMode="decimal" maxLength={24} disabled={disabled} onChange={e=>edit(s.id,'rated',e.target.value)}/></label>
      <div className="sel-stage-wide"><span>Schutzorgan</span><ChoiceCards label={`Stufe ${j+1} · Schutzorgan`} value={s.type} options={STAGE_DEVICES.map(([value,label])=>({value,label}))} disabled={disabled} onChange={v=>edit(s.id,'type',v)}/></div>
      {s.type==='fi'&&<><div><span>Differenzstrom</span><ChoiceCards label={`Stufe ${j+1} · Differenzstrom`} value={s.delta} options={['10','30','100','300','500'].map(value=>({value,label:`${value} mA`}))} disabled={disabled} onChange={v=>edit(s.id,'delta',v)}/></div><div><span>FI-Typ</span><ChoiceCards label={`Stufe ${j+1} · FI-Typ`} value={s.fiType} options={['A','S','G','B'].map(value=>({value,label:`Typ ${value}`}))} disabled={disabled} onChange={v=>edit(s.id,'fiType',v)}/></div></>}
      <label>Zuleitung · einfache Länge (m)<input value={s.length} inputMode="decimal" maxLength={24} disabled={disabled} onChange={e=>edit(s.id,'length',e.target.value)}/></label>
      <div><span>Leitermaterial</span><ChoiceCards label={`Stufe ${j+1} · Material`} value={s.material} options={['Cu','Al'].map(value=>({value,label:value==='Cu'?'Kupfer':'Aluminium'}))} disabled={disabled} onChange={v=>edit(s.id,'material',v)}/></div>
      <div className="sel-stage-wide"><span>Kabeltyp</span><ChoiceCards label={`Stufe ${j+1} · Kabeltyp`} value={s.cable} options={Object.keys(SELECTIVITY_CABLE_RX).map(value=>({value,label:value}))} disabled={disabled} onChange={v=>edit(s.id,'cable',v)}/></div>
      <div className="sel-stage-wide"><span>Querschnitt</span><ChoiceCards label={`Stufe ${j+1} · Querschnitt`} value={s.area} options={optionsWithProjectValue(Object.keys(SELECTIVITY_CABLE_RX[s.cable]??{}).sort((a,b)=>Number(a)-Number(b)).map(value=>({value,label:`${value} mm²`})),s.area)} disabled={disabled} onChange={v=>edit(s.id,'area',v)}/></div>
      <div className="sel-stage-wide"><span>Leitersystem</span><ChoiceCards label={`Stufe ${j+1} · Leitersystem`} value={s.system} options={[{value:'5p',label:'5-polig · TN-S · 400 V'},{value:'4p',label:'4-polig · PEN · 400 V'},{value:'3p',label:'3-polig · L/N/PE · 230 V'}]} disabled={disabled} onChange={v=>edit(s.id,'system',v)}/></div>
      {j>0&&<div className="sel-stage-wide"><Explanation title="Hersteller-Paargrenze dokumentieren"><label>Paargrenze zur vorgelagerten Stufe (kA, optional)<input value={s.pairLimitKA} inputMode="decimal" maxLength={24} disabled={disabled} onChange={e=>edit(s.id,'pairLimitKA',e.target.value)}/></label><label>Hersteller, Geräte und Tabellenquelle<input value={s.pairReference} maxLength={500} disabled={disabled} onChange={e=>edit(s.id,'pairReference',e.target.value)}/></label></Explanation></div>}
    </div><button className="sel-stage-remove" disabled={disabled||stages.length===1} onClick={()=>save(stages.filter(row=>row.id!==s.id))}><Trash2 size={14}/>Stufe {j+1} entfernen</button></details>)}
  </section>;
}
