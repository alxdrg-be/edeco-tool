import test from "node:test";
import assert from "node:assert/strict";
import { calculateLightning, type LightningInput } from "./lightning-model.ts";
const base: LightningInput = { protection: "III", perimeter: "60", length: "10", conductors: "4", clearance: "" };
// Reconfirmed by actual browser execution of the Arthur-Flury iframe on
// 2026-11-02. Delivered client script SHA-256 a6e63a9557a1e453620cf3b8bc1ef0d25afad43dffcf97365131ef5e73b35989.
// Values below are the source's displayed result and minimum n, not rederived
// from the native calculateLightning implementation. No norm text is certified.
test("published Swiss reference cases and separate minimum conductor count", () => {
  for (const [protection, perimeter, length, conductors, s, minimum] of [
    ["I", "20", "3", "2", .24, 2], ["II", "40", "5", "4", .3, 4],
    ["III", "60", "10", "4", .4, 4], ["III", "61", "10", "5", .33, 5],
    ["III", "10", "3", "2", .04, 2],
  ] as const) {
    const result = calculateLightning({ ...base, protection, perimeter, length, conductors });
    assert.equal(result.metres, s); assert.equal(result.minimum, minimum);
  }
  const tooFew = calculateLightning({ ...base, conductors: "2" });
  assert.equal(tooFew.metres, .8); assert.equal(tooFew.conductorOK, false);
});
test("exact centimetre rounding, decimal comma and clearance checks", () => {
  assert.equal(calculateLightning({ ...base, protection: "II", perimeter: "20", length: "4,5", conductors: "2" }).metres, .27);
  assert.equal(calculateLightning({ ...base, clearance: "0,4" }).clearanceOK, true);
  assert.equal(calculateLightning({ ...base, clearance: "0.399999" }).clearanceOK, false);
  assert.equal(calculateLightning(base).clearanceOK, null);
});
test("invalid, missing and nonfinite inputs never produce results", () => {
  for (const patch of [{ perimeter: "" }, { length: "-1" }, { length: "0" }, { length: "Infinity" }, { length: "1e4" }, { length: "100001" }, { conductors: "1" }, { conductors: "2.5" }, { clearance: "-1" }]) assert.throws(() => calculateLightning({ ...base, ...patch }));
});
test("fresh actual Flury browser cases match class-dependent decimal inputs and conductor warnings",()=>{
  for(const [protection,perimeter,length,conductors,metres,minimum,conductorOK] of [
    ["I","98.5","12.345","12",.82,10,true],
    ["II","123.45","8.75","7",.93,13,false],
    ["III","88.2","7.1","6",.28,6,true],
  ] as const) {
    const result=calculateLightning({...base,protection,perimeter,length,conductors});
    assert.equal(result.metres,metres);assert.equal(result.minimum,minimum);assert.equal(result.conductorOK,conductorOK);
  }
});
test("an exact centimetre boundary does not acquire the reference's floating-point extra centimetre",()=>{
  // Actual reference browser: classI, U20m, A7m, n2 displayed0.57m.
  // Exact decimal expression .08×7×(20/10/2) equals .56m. The provider's
  // Math.ceil(binaryFloat*100) adds a spurious centimetre at this boundary.
  // Native rational rounding intentionally retains the exact56cm result.
  const result=calculateLightning({...base,protection:"I",perimeter:"20",length:"7",conductors:"2"});
  assert.equal(result.centimetres,56);assert.equal(result.metres,.56);
});
