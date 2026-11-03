import test from "node:test";
import assert from "node:assert/strict";
import { FORMULAS } from "./formulaCatalog.ts";
import { calculateMemoryFormula, MEMORY_FORMULA_IDS, memoryFormulaFields, type MemoryFormulaId } from "./memoryFormulas.ts";

function calculate(id: MemoryFormulaId, values: Record<string, number>, mode = "forward") {
  const result = calculateMemoryFormula(id, values, mode);
  assert.equal(result.ok, true, result.ok ? id : result.message);
  if (!result.ok) throw new Error(result.message);
  return result.value.rows;
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual-expected) <= Math.max(1,Math.abs(expected))*1e-10, `${actual} versus ${expected}`);

test("each PDF basic formula has a usable catalogue entry, finite example and strict blank/invalid validation", () => {
  for (const id of MEMORY_FORMULA_IDS) {
    assert.ok(FORMULAS.some(item=>item.id===id));
    const fields=memoryFormulaFields(id), values=Object.fromEntries(fields.map(field=>[field.key,Number(field.value)]));
    assert.ok(calculate(id,values).every(row=>Number.isFinite(row.value)));
    assert.equal(calculateMemoryFormula(id,{...values,[fields[0].key]:NaN}).ok,false,id);
    assert.equal(calculateMemoryFormula(id,{...values,[fields[0].key]:-1}).ok,false,id);
  }
});
test("mechanical useful power and electrical active power are distinct for both phase systems", () => {
  const one=calculate("leistung-1p",{voltage:230,current:10,cos:.8,eta:.9});
  close(one[0].value,1840);close(one[1].value,1656);
  const three=calculate("leistung-3p",{voltage:400,current:10,cos:.8,eta:.9});
  close(three[0].value,Math.sqrt(3)*400*10*.8);close(three[1].value,three[0].value*.9);
  close(calculate("leistung-3p",{voltage:400,power:three[1].value,cos:.8,eta:.9},"inverse")[2].value,10);
});
test("capacitor microfarads and inductor henries produce their SI reactances", () => {
  const c=calculate("kapazitiv",{frequency:50,capacity:10,voltage:230});
  close(c[0].value,318.3098861837907);close(c[1].value,.7225663103256524);
  const l=calculate("induktiv",{frequency:50,inductance:.1,voltage:230});
  close(l[0].value,31.41592653589793);close(l[1].value,7.321127382227186);
  close(calculate("kapazitiv",{voltage:230,current:2},"ratio")[0].value,115);
});
test("meter formula returns kW and costs convert Rappen to CHF exactly once", () => {
  const meter=calculate("zaehlerleistung",{count:10,constant:1000,seconds:36});
  assert.equal(meter[0].unit,"kW");close(meter[0].value,1);close(meter[1].value,.01);
  const costs=calculate("energiekosten",{tariff:25,power:2,hours:3});
  assert.deepEqual(costs.map(row=>[row.value,row.unit]),[[6,"kWh"],[150,"Rp"],[1.5,"CHF"]]);
});
test("mechanical energy uses Joule rather than the scan's ambiguous nm", () => {
  const energy=calculate("mechanische-energie",{mass:100,height:3});
  close(energy[0].value,2943);assert.equal(energy[0].unit,"J = N·m");close(energy[1].value,.8175);
});
test("star and delta distinguish line and winding current and voltage", () => {
  const star=calculate("stern-dreieck",{voltage:400,current:10},"star"),delta=calculate("stern-dreieck",{voltage:400,current:10},"delta");
  close(star[0].value,400/Math.sqrt(3));close(star[1].value,10);close(delta[0].value,400);close(delta[1].value,10/Math.sqrt(3));
  const inverseStar=calculate("stern-dreieck",{voltage:230,current:10},"star-inverse"),inverseDelta=calculate("stern-dreieck",{voltage:400,current:10},"delta-inverse");
  close(inverseStar[0].value,230*Math.sqrt(3));close(inverseStar[1].value,10);close(inverseDelta[0].value,400);close(inverseDelta[1].value,10*Math.sqrt(3));
});
test("light relationships preserve total flux, efficiency and upward integer lamp count", () => {
  close(calculate("beleuchtungsstaerke",{flux:30000,area:60})[0].value,500);
  close(calculate("lichtstrom",{lux:500,area:60,eta:.5})[0].value,60000);
  assert.equal(calculate("lampenanzahl",{flux:30000,eachFlux:4000})[0].value,8);
  assert.equal(calculate("lampenanzahl",{flux:1e-12,eachFlux:4000})[0].value,1);
});
test("resistance, conductance and current density have the correct units and ratios", () => {
  close(calculate("leiterwiderstand",{rho:.0175,length:50,area:2.5})[0].value,.35);
  close(calculate("leitwert",{resistance:5})[0].value,.2);close(calculate("leitwert",{voltage:10,current:2},"ratio")[0].value,.2);
  const density=calculate("stromdichte",{current:16,area:2.5})[0];close(density.value,6.4);assert.equal(density.unit,"A/mm²");
});
test("energy inverse and metric horsepower use consistent conversions", () => {
  const energy=calculate("energie",{power:2,hours:3});close(energy[0].value,6);close(energy[1].value,21.6e6);
  close(calculate("energie",{energy:6,hours:3},"inverse")[0].value,2);
  close(calculate("umrechnung",{value:1})[0].value,1/.73549875);close(calculate("umrechnung",{value:1},"ps-kw")[0].value,.73549875);close(calculate("umrechnung",{value:1},"zoll-cm")[0].value,2.54);
});
test("P/Q triangle avoids overflow-prone squaring and leaves zero-load power factor undefined", () => {
  const normal=calculate("leistungsdreieck",{power:3000,reactive:4000});close(normal[0].value,5000);close(normal[1].value,.6);
  const zero=calculate("leistungsdreieck",{power:0,reactive:0});assert.equal(zero.length,1);assert.equal(zero[0].value,0);
  assert.equal(calculateMemoryFormula("energie",{power:1e308,hours:1e308}).ok,false);
  assert.equal(calculateMemoryFormula("energie",{power:2,hours:3},"unknown").ok,false);
  close(calculate("leistungsdreieck",{power:3000,cos:.6},"active-factor")[0].value,5000);
  close(calculate("leistungsdreieck",{reactive:4000,angle:53.13010235415598},"reactive-angle")[0].value,5000);
});
test("ideal resistors and capacitors use opposite series/parallel relations", () => {
  close(calculate("widerstand-netzwerk",{first:10,second:20})[0].value,30);
  close(calculate("widerstand-netzwerk",{first:10,second:20},"parallel")[0].value,20/3);
  close(calculate("kondensator-netzwerk",{first:10,second:20},"series")[0].value,20/3);
  close(calculate("kondensator-netzwerk",{first:10,second:20},"parallel")[0].value,30);
});
