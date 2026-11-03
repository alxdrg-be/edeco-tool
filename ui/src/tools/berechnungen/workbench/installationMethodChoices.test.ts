import assert from 'node:assert/strict';
import test from 'node:test';
import { editNinInstallationInput, ninMethodOptions } from './installationMethodChoices.ts';
import { INSTALLATION } from './installation.ts';
import { defaults } from './types.ts';
import { migrateWorkbenchInputs } from './migrateInputs.ts';

test('guided conductor selection retains shared methods and existing manual-earth choices',()=>{
  const single=ninMethodOptions('single'),multi=ninMethodOptions('multi');
  assert.ok(single.some(o=>o.value==='A1'&&o.label.includes('wärmegedämmte Wand')));
  assert.ok(!single.some(o=>['A2','B2','E'].includes(o.value)));
  assert.ok(multi.some(o=>o.value==='B2'&&o.label.includes('Mehradriges Kabel')));
  assert.ok(!multi.some(o=>['A1','B1','F','G-h'].includes(o.value)));
  for(const options of [single,multi])for(const key of ['C','D','D1','D2'])assert.ok(options.some(o=>o.value===key));
  assert.equal(ninMethodOptions('all').length,13);
  assert.throws(()=>ninMethodOptions('unknown'),/Einadrig/);
});

test('explicit conductor switches map corresponding methods without changing cable or load values',()=>{
  for(const [multi,single] of [['A2','A1'],['B2','B1'],['E','F']]){
    const old={method:multi,area:'16',ib:'32'};
    const changed=editNinInstallationInput(old,'conductorKind','single');
    assert.equal(changed.method,single);assert.equal(changed.area,'16');assert.equal(changed.ib,'32');
    assert.equal(editNinInstallationInput(changed,'conductorKind','multi').method,multi);
  }
  for(const method of ['C','D','D1','D2'])assert.equal(editNinInstallationInput({method},'conductorKind','single').method,method);
  assert.equal(editNinInstallationInput({method:'G-v'},'conductorKind','multi').method,'E');
  assert.equal(editNinInstallationInput({method:'invalid'},'conductorKind','single').method,'invalid');
});

test('new NIN calculations guide multi-core while saved method choices retain their numerical meaning',()=>{
  const definition=INSTALLATION.find(d=>d.id==='nin-kabelrechner')!,input=defaults(definition);
  assert.equal(input.conductorKind,'multi');assert.equal(input.method,'B2');
  const single=editNinInstallationInput(input,'conductorKind','single');
  assert.equal(single.method,'B1');
  assert.equal(definition.calculate(single).metrics[0].value,36);
  assert.throws(()=>definition.calculate({...input,method:'F'}),/passt nicht/);
  const saved={...input,method:'B1',area:'16'};delete saved.conductorKind;
  const restored=migrateWorkbenchInputs(definition.id,input,saved);
  assert.equal(restored.conductorKind,'all');assert.equal(restored.method,'B1');
  assert.equal(definition.calculate(restored).metrics[0].value,68);
});
