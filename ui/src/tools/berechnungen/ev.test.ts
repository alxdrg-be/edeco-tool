import assert from "node:assert/strict";
import test from "node:test";
import { calculateEV, type EVInput } from "./ev-model.ts";
const base: EVInput = { house:"160",grid:"125",reserve:"30",count:"10",power:"11",mode:"dynamic",diversity:"1" };
test("AC budget accounts for both grid and house reserve, dynamic allocation conserves power",()=>{
  const r=calculateEV(base), factor=Math.sqrt(3)*400/1000;
  assert.ok(Math.abs(r.available-(160*factor-30))<1e-9);
  assert.equal(r.installed,110);assert.equal(r.limited,true);
  assert.ok(r.allocated<=r.gridKW && r.allocated+30<=r.houseKW+1e-9);
  assert.ok(Math.abs(r.perPoint*10-r.allocated)<1e-9);
});
test("no load management always uses factor one, static factor is explicit",()=>{
  const noLM=calculateEV({...base,mode:"none",diversity:"0.2"});
  assert.equal(noLM.appliedFactor,1);assert.equal(noLM.requested,110);assert.equal(noLM.capacityOK,false);
  const fixed=calculateEV({...base,mode:"static",diversity:"0.5"});
  assert.equal(fixed.requested,55);assert.equal(fixed.allocated,55);
});
test("invalid values block results, exhausted budget remains visibly zero",()=>{
  for(const patch of [{count:"2.5"},{grid:"200"},{power:"0"},{reserve:"-1"},{house:""}])assert.throws(()=>calculateEV({...base,...patch}));
  const empty=calculateEV({...base,reserve:"200"});assert.equal(empty.available,0);assert.equal(empty.perPoint,0);assert.equal(empty.reserveExceeded,true);
});
