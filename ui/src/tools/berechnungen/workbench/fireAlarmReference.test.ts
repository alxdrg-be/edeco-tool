import assert from 'node:assert/strict';
import test from 'node:test';
import { PLANNING } from './planning.ts';
import { defaults } from './types.ts';
import { fireDetectorTable } from './fireAlarmReference.ts';
const definition=PLANNING.find(d=>d.id==='premium-brandmelder')!;
const run=(patch:Record<string,string>={})=>definition.calculate({...defaults(definition),detectorBasis:'reference',...patch});
const values=(patch:Record<string,string>={})=>run(patch).metrics.slice(0,5).map(m=>m.value);

// Captured by authenticated Playwright on 2026-11-02 from actual inputs and
// lastResult, rather than deriving expected counts from this implementation.
// /premium/brandmelder-rechner.php; source /assets/ses-bma-2021.js.
test('authenticated reference cases cover normal room, slope, corridor and noise',()=>{
  assert.deepEqual(values(),[1,1,0,1,335]);
  assert.deepEqual(values({length:'40',width:'18'}),[12,2,0,1,895]);
  assert.deepEqual(values({length:'20',width:'10',detectorHeight:'6',detectorType:'heat',detectorSlope:'sloped'}),[5,1,0,1,515]);
  assert.deepEqual(values({length:'40',width:'2',detectorRoom:'korridor'}),[3,2,0,1,490]);
  assert.deepEqual(values({detectorNoise:'90',detectorManual:'11'}),[1,1,1,3,2110]);
});
test('unsupported heights and blanks produce no stale result',()=>{
  assert.throws(()=>run({detectorHeight:'12.01'}),/12 m/);
  assert.throws(()=>run({detectorType:'heat',detectorHeatClass:'A2',detectorHeight:'6.01'}),/6 m/);
  assert.throws(()=>run({detectorHeight:''}));
  assert.throws(()=>run({detectorUnitPrice:''}));
  assert.equal(fireDetectorTable(6,30,'smoke','sloped','A1').single,true);
  assert.equal(fireDetectorTable(6.01,30,'smoke','flat','A1').single,false);
});
test('vertical cases are quantities without a misleading rectangular room plan',()=>{
  const stairs=run({detectorRoom:'treppenhaus_offen',detectorHeight:'25',detectorStoreys:'8'});
  assert.deepEqual(stairs.metrics.slice(0,4).map(m=>m.value),[3,4,0,1]);
  assert.equal(stairs.diagram,undefined);
  const lift=run({detectorRoom:'liftschacht',detectorHeight:'45',detectorIndicators:'999'});
  assert.equal(lift.rows?.find(r=>r.label==='Raumanzeigelampen')?.value,0);
  assert.match(lift.status.text,/Ansaug/);
});
test('manual optical suppression in high noise never appears as a passed check',()=>{
  const r=run({detectorNoise:'90',detectorOptical:'no'});
  assert.equal(r.status.tone,'error');
  assert.match(r.status.text,/deaktiviert/);
});

test('unknown or missing basis never silently switches saved model semantics',()=>{
  assert.throws(()=>run({detectorBasis:'BROKEN'}),/gültige Auswahl/);
  const missing={...defaults(definition)};delete missing.detectorBasis;
  assert.throws(()=>definition.calculate(missing),/gültige Auswahl/);
});
