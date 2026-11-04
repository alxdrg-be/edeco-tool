import assert from 'node:assert/strict';
import test from 'node:test';
import { INSTALLATION } from './installation.ts';
import { defaults, type Inputs } from './types.ts';

// Fresh authenticated browser observations, 2026-11-02. These are numerical
// comparisons with the published calculators, not independent norm approval.
const calculate=(id:string,patch:Inputs)=>{
  const definition=INSTALLATION.find(d=>d.id===id)!;
  return definition.calculate({...defaults(definition),...patch});
};

test('fresh NIN B1/B2 construction cases reproduce the observed 36/34 A',()=>{
  // /Rechner/nin-kabelrechner.html: Cu6, PVC70,3loaded,30°C,no grouping.
  assert.equal(calculate('nin-kabelrechner',{conductorKind:'single',method:'B1',area:'6'}).metrics[0].value,36);
  assert.equal(calculate('nin-kabelrechner',{conductorKind:'multi',method:'B2',area:'6'}).metrics[0].value,34);
});

test('fresh PA6mm² source case raises only HPA/FE when external lightning protection is enabled',()=>{
  // /Rechner/potenzialausgleich.html: phase6,PEN6,EPA0. HPA/ÖPA/PE/FE
  // observed: without LPS6/4/6/6; with LPS10/4/6/10.
  const result=(lps:string)=>calculate('potenzialausgleich',{phase:'6',pen:'6',lps});
  const values=(lps:string)=>result(lps).series!.map(item=>item.value);
  // Native series order: HPA,PE,ÖPA,FE.
  assert.deepEqual(values('no'),[6,6,4,6]);
  assert.deepEqual(values('yes'),[10,6,4,10]);
});
