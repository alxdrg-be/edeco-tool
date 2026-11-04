import { test } from "node:test";
import assert from "node:assert/strict";
import { legendSourceSelection } from "./legendSourceSelection.ts";
import type { LegendItem } from "./legend.ts";

const item = { id: "combined", symbol_key: "up", parts: [{ symbol_key: "sensor" }] } as LegendItem;
test("a promoted floor-specific part opens its own source tab", () => {
  assert.deepEqual(legendSourceSelection(item, [{ t: "symbol", id: "combined", key: "sensor" }]), { visibleKey: "sensor", initialPart: 1, synthetic: false });
  assert.equal(item.symbol_key, "up");
});
test("an output-only AP variant never masquerades as an editable stored UP source", () => {
  assert.deepEqual(legendSourceSelection(item, [{ t: "symbol", id: "combined", key: "ap" }]), { visibleKey: "ap", initialPart: 0, synthetic: true });
  assert.equal(legendSourceSelection(item, []).synthetic, false);
  assert.equal(legendSourceSelection(item, [{ t: "symbol", id: "combined", key: "up", source_part: 99 }]).synthetic, true);
});
test("identical graphics use the original part index, never the first matching key", () => {
  const repeated = { ...item, parts: [{ symbol_key: "up" }] } as LegendItem;
  assert.equal(legendSourceSelection(repeated, [{ t: "symbol", id: "combined", key: "up", source_part: 1 }]).initialPart, 1);
  assert.equal(legendSourceSelection(repeated, [{ t: "symbol", id: "combined", key: "up" }]).synthetic, true);
  assert.equal(legendSourceSelection(repeated, [{ t: "symbol", id: "combined", key: "up", source_part: 99 }]).synthetic, true);
});
