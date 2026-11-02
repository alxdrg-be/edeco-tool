import test from 'node:test';
import assert from 'node:assert/strict';
import { createSIADefinition, siaReportInputs } from './siaDefinition.ts';
import { calculateSIAReference } from './siaReference.ts';
import { SIA_BROWSER_FIXTURES } from './siaReferenceFixtures.ts';
import { SIA_REFERENCE_GROUPS, SIA_REFERENCE_SOURCE } from './siaReferenceData.ts';
import { defaults, validateResult, type CalculatorDefinition, type Inputs } from './types.ts';

const legacy:CalculatorDefinition={id:'premium-sia2056',title:'Legacy',source:'',description:'',scope:'',fields:[],calculate:()=>({metrics:[{label:'Legacy',value:1}],status:{tone:'neutral',text:'Legacy'},formula:'legacy',limitations:[]})};
const definition=createSIADefinition(legacy);
const base=():Inputs=>({...defaults(definition),siaMode:'automatic'});
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<=Math.max(1e-8,Math.abs(expected)*1e-12),`${actual} != ${expected}`);

for(const fixture of SIA_BROWSER_FIXTURES) test(`SIA authenticated browser fixture: ${fixture.name}`,()=>{
  const input={...base(),...fixture.input},data=calculateSIAReference(input),b=data.balance;
  const actual={powerKW:b.powerKW,energyKWh:b.energyKWh,powerDensity:b.powerDensity,energyDensity:b.energyDensity,standbyKW:data.standbyKW,pvKWp:data.pvKWp,pvYearKWh:data.pvYearKWh,kcorAverage:data.kcorAverage,yearGlzAverage:data.yearGlzAverage};
  for(const key of Object.keys(fixture.expected) as (keyof typeof actual)[])close(actual[key],fixture.expected[key]);
  validateResult(definition.calculate(input));
});

test('SIA reference provides all four zonal menus, climate and classes without claiming normative certification',()=>{
  for(const z of ['', '2', '3', '4']) {
    assert.equal(definition.fields.find(f=>f.key===`sia${z}Building`)?.options?.length,17);
    assert.equal(definition.fields.filter(f=>f.key.startsWith(`sia${z}Class_`)).length,7);
    assert.equal(definition.fields.find(f=>f.key===`sia${z}RefPVDirection`)?.options?.length,6);
  }
  assert.equal(Object.keys(SIA_REFERENCE_GROUPS).length,7);
  for(const table of Object.values(SIA_REFERENCE_GROUPS))assert.equal(Object.keys(table).length,16);
  assert.equal(SIA_REFERENCE_SOURCE.sha256.length,64);
  const result=definition.calculate(base());
  assert.equal(result.status.tone,'warning');
  assert.ok(result.limitations.some(text=>text.includes('kein SIA-Konformitätsnachweis')));
});

test('SIA Food L source gap, invalid class and missing active fields never produce substitute results',()=>{
  assert.throws(()=>calculateSIAReference({...base(),siaBuilding:'retail-food',siaClass_devices:'l'}),/Kennwert fehlt/);
  assert.throws(()=>calculateSIAReference({...base(),siaClass_lighting:'keine'}),/Kennwert fehlt/);
  assert.throws(()=>calculateSIAReference({...base(),siaRefArea:''}),/Nettofläche/);
  assert.throws(()=>calculateSIAReference({...base(),siaRefGlz:'0.5'}),/0.7 oder 0.8/);
  assert.throws(()=>calculateSIAReference({...base(),siaBuilding:'none'}),/Mindestens eine Nutzungszone/);
});

test('SIA profile PV production stays separate from gross energy and raw standby is not double-counted',()=>{
  const original=calculateSIAReference(base()),pv=calculateSIAReference({...base(),siaRefPVArea:'100',siaRefPVDirection:'sued45'});
  close(original.balance.energyKWh,pv.balance.energyKWh);
  close(original.balance.powerKW,pv.balance.powerKW);
  close(pv.balance.netEnergyKWh,pv.balance.energyKWh);
  assert.ok(pv.pvYearKWh>0);
  const rows=siaReportInputs({...base(),siaRefPVArea:'100'});
  assert.ok(rows.some(row=>row.label==='Datenquelle'&&row.value===SIA_REFERENCE_SOURCE.url));
  assert.equal(rows.filter(row=>row.value.includes('W/m² roh;')).length,7);
});
