import assert from "node:assert/strict";
import test from "node:test";
import { pvPayback, pvSensitivity, type PVFinancialScenario } from "./pvAnalysis.ts";
import { INSTALLATION } from "./installation.ts";
import { defaults } from "./types.ts";

const base: PVFinancialScenario = { investment: 46990.125, grant: 9950.85, basis: "gross", annualEnergy: 26991.680625, buyPrice: .291, feedPrice: .09, selfShare: .3, operatingShare: .01, degradation: .005, years: 25 };
const close = (actual: number | null, expected: number) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-10, `${actual} ≠ ${expected}`);

// Independent values read from the authenticated calculator on 2026-11-02,
// including expanded premium sensitivity. The 0%-self-consumption rejected
// source state was stale and is deliberately excluded from these fixtures.
test("fresh PV browser case reproduces all five plus/minus20 sensitivity pairs", () => {
  const analysis = pvSensitivity(base);
  close(analysis.basePayback, 13.574394706950386);
  const expected = {
    buy: [15.734345719465717, 11.937384431610976],
    investment: [10.483416252858671, 16.905221540165897],
    yield: [17.77993085865613, 10.982574006060961],
    self: [14.995289719794782, 12.400055131045473],
    feed: [15.066150489506015, 12.352194445545814],
  };
  for (const row of analysis.scenarios) {
    close(row.minus, expected[row.key][0]);
    close(row.plus, expected[row.key][1]);
  }
});

test("fresh expensive case retains no-payback outcomes rather than displaying zero years", () => {
  const analysis = pvSensitivity({ ...base, investment: 96744.375, selfShare: .5 });
  close(analysis.basePayback, 24.946477326094428);
  assert.equal(analysis.scenarios.find(row => row.key === "buy")!.minus, null);
  assert.equal(analysis.scenarios.find(row => row.key === "investment")!.plus, null);
  close(analysis.scenarios.find(row => row.key === "investment")!.minus, 18.66325194779377);
});

test("project changes to degradation, operating costs and selected capital basis affect every scenario", () => {
  const changed = { ...base, operatingShare: .02, degradation: .01, basis: "net" as const, years: 30 };
  const analysis = pvSensitivity(changed);
  close(analysis.basePayback, pvPayback(changed)!);
  close(analysis.scenarios.find(row => row.key === "investment")!.plus, pvPayback({ ...changed, investment: changed.investment * 1.2 })!);
  assert.notEqual(analysis.basePayback, pvSensitivity(base).basePayback);
  assert.equal(analysis.years, 30);
  assert.equal(analysis.basis, "net");
});

test("self-consumption is capped at100percent and a zero tariff has no invented return", () => {
  const high = pvSensitivity({ ...base, selfShare: .95 });
  close(high.scenarios.find(row => row.key === "self")!.plus, pvPayback({ ...base, selfShare: 1 })!);
  const none = pvSensitivity({ ...base, buyPrice: 0, feedPrice: 0 });
  assert.equal(none.basePayback, null);
  assert.ok(none.scenarios.every(row => row.minus === null && row.plus === null));
  assert.equal(pvPayback({ ...base, investment: 0 }), 0);
});

test("historical tariff observations are dated copies, never a mutable shared project series", () => {
  const a = pvSensitivity(base), b = pvSensitivity(base);
  assert.deepEqual(a.history[0], { year: 2020, buyRp: 20.5, feedRp: 9.5 });
  assert.deepEqual(a.history.at(-1), { year: 2026, buyRp: 29.1, feedRp: 9 });
  a.history[0].buyRp = 999;
  assert.equal(b.history[0].buyRp, 20.5);
});

test("invalid financial inputs fail rather than producing NaN chart coordinates", () => {
  for (const change of [{ investment: NaN }, { grant: Infinity }, { selfShare: 1.1 }, { years: 0 }, { degradation: 1 }, { annualEnergy: -1 }]) {
    assert.throws(() => pvSensitivity({ ...base, ...change }), /PV-Projektannahmen/);
  }
});

test("PV calculator keeps its current payback basis and exports sensitivity/history rows", () => {
  const definition=INSTALLATION.find(item=>item.id==="pva-rechner")!;
  for(const changes of [{},{headlineBasis:"net",grantMode:"manual",grant:"5000",om:"2",degradation:"1",years:"30"}]) {
    const input={...defaults(definition),...changes},result=definition.calculate(input);
    const main=result.metrics.find(metric=>metric.label==="Amortisation")!.value;
    if(typeof main==="number")close(result.pvAnalysis!.basePayback,main);
    else assert.equal(result.pvAnalysis!.basePayback,null);
    assert.equal(result.pvAnalysis!.scenarios.length,5);
    assert.equal(result.rows!.filter(row=>row.label.startsWith("Sensitivität")).length,5);
    assert.equal(result.rows!.filter(row=>row.label.startsWith("Tarifhistorie")).length,7);
  }
});

test("emissions are an optional explicit project assumption, including a valid zero factor",()=>{
  const definition=INSTALLATION.find(item=>item.id==="pva-rechner")!,input=defaults(definition);
  assert.ok(!definition.calculate(input).rows!.some(row=>row.label.startsWith("Vermiedene Emissionen")));
  const result=definition.calculate({...input,emissionMode:"project",emissionFactor:"128"});
  close(result.rows!.find(row=>row.label.startsWith("Vermiedene Emissionen"))!.value as number,3.45493512);
  const zero=definition.calculate({...input,emissionMode:"project",emissionFactor:"0"});
  assert.equal(zero.rows!.find(row=>row.label.startsWith("Vermiedene Emissionen"))!.value,0);
  assert.throws(()=>definition.calculate({...input,emissionMode:"project",emissionFactor:""}));
});
