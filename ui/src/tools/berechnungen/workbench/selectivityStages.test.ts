import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSelectivityStages, defaultSelectivityStages, parseSelectivityStages, selectivityStageCurrents } from './selectivityStages.ts';
import { withSelectivityStages } from './selectivityDefinition.ts';
import type { CalculatorDefinition } from './types.ts';
const make=()=>({selectivityStages:JSON.stringify(defaultSelectivityStages()),supplyVoltage:'400',sourceIk:'10',earthing:'TN'});
test('authenticated reference cold path fixture 5m150 + 30m50 + 40m2.5 Cu',()=>{
  const currents=selectivityStageCurrents(make());
  // Captured rendered values from the authenticated page, 2026-11-02.
  assert.deepEqual(currents.map(c=>Number(c.ikMax.toFixed(2))),[9.82,7.96,.39]);
  assert.deepEqual(currents.map(c=>Number((Math.round(c.ikLoop!*1000)/1000).toFixed(2))),[4.45,3.6,.36]);
  assert.equal(calculateSelectivityStages(make()).status.tone,'warning');
});
test('variable stage count and explicit removal have no hidden extra stages',()=>{
  const stages=defaultSelectivityStages();
  assert.equal(selectivityStageCurrents({...make(),selectivityStages:JSON.stringify(stages.slice(0,1))}).length,1);
  assert.throws(()=>parseSelectivityStages('[]'),/Eine bis sechs/);
  assert.throws(()=>parseSelectivityStages(JSON.stringify([...stages,...stages])),/eindeutige/);
  const six=Array.from({length:6},(_,j)=>({...stages[2],id:`unique-${j}`}));
  assert.equal(parseSelectivityStages(JSON.stringify(six)).length,6);
  assert.throws(()=>parseSelectivityStages(JSON.stringify([...six,{...stages[2],id:'seven'}])),/Eine bis sechs/);
});
test('missing lengths, unlisted cable sections and invalid type never get substitutes',()=>{
  for(const edit of [{length:''},{cable:'CFW',area:'2.5'},{type:'unknown'}]){
    const stages=defaultSelectivityStages();stages[1]={...stages[1],...edit};
    assert.throws(()=>selectivityStageCurrents({...make(),selectivityStages:JSON.stringify(stages)}));
  }
});
test('single-phase path and earth topology stay explicit',()=>{
  assert.throws(()=>selectivityStageCurrents({...make(),supplyVoltage:'230'}),/dreiphasiger/);
  const stages=defaultSelectivityStages().map(s=>({...s,system:'3p'}));
  const result=selectivityStageCurrents({...make(),supplyVoltage:'230',selectivityStages:JSON.stringify(stages)});
  assert.ok(result[2].ikMax<result[0].ikMax);
  assert.ok(selectivityStageCurrents({...make(),earthing:'TT'}).every(n=>n.ikLoop===null));
  assert.ok(selectivityStageCurrents({...make(),earthing:'IT'}).every(n=>n.ikLoop===null));
});
test('increased cable impedance lowers model fault current',()=>{
  const stages=defaultSelectivityStages();stages[2]={...stages[2],length:'80'};
  assert.ok(selectivityStageCurrents({...make(),selectivityStages:JSON.stringify(stages)})[2].ikMax<selectivityStageCurrents(make())[2].ikMax);
  stages[2]={...stages[2],length:'40',material:'Al'};
  assert.ok(selectivityStageCurrents({...make(),selectivityStages:JSON.stringify(stages)})[2].ikMax<selectivityStageCurrents(make())[2].ikMax);
});
test('manufacturer limits require real description and do not fabricate RCD clearance',()=>{
  const stages=defaultSelectivityStages();stages[2]={...stages[2],pairLimitKA:'0.1',pairReference:'Manufacturer table exact devices at 400 V'};
  assert.equal(calculateSelectivityStages({...make(),selectivityStages:JSON.stringify(stages)}).status.tone,'error');
  stages[2].pairReference='';assert.throws(()=>calculateSelectivityStages({...make(),selectivityStages:JSON.stringify(stages)}),/Herstellerquelle/);
});
test('wrapping preserves pre-existing saved comparison when mode is absent',()=>{
  const legacy:CalculatorDefinition={id:'test',title:'test',description:'',source:'',scope:'',fields:[],calculate:()=>({metrics:[],status:{tone:'neutral',text:'legacy'},formula:'legacy',limitations:[]})};
  const wrapped=withSelectivityStages(legacy);
  assert.equal(wrapped.calculate({}).formula,'legacy');
  assert.equal(wrapped.fields[0].default,'stages');
  assert.throws(()=>wrapped.calculate({selectivityMode:'BROKEN'}),/Aufbau/);
});
