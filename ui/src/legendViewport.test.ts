import test from "node:test";
import assert from "node:assert/strict";
import { clampLegendZoom, fitLegendZoom, legendItemColors, legendLayerColors } from "./legendViewport.ts";
import { combineItems, detachPart, makeItem, sectionStyle, splitItem, type LegendDoc } from "./legend.ts";

test("legend fitting follows actual content height, including short and long sheets", () => {
  assert.equal(fitLegendZoom(200, 80, 800, 400, "page"), 4);
  assert.equal(fitLegendZoom(200, 800, 800, 400, "page"), 0.5);
  assert.equal(fitLegendZoom(200, 800, 800, 400, "width"), 4);
  assert.equal(clampLegendZoom(Infinity), 4);
  assert.equal(clampLegendZoom(0), 0.5);
});

test("original colours are distinct and stable independently of a monochrome override", () => {
  const item = { color: "#0099FF", layer_colors: ["#FF0000", "#0099ff", "invalid"], symbol_color: "#000000" };
  assert.deepEqual(legendLayerColors(item), ["#ff0000", "#0099ff"]);
  assert.deepEqual(legendItemColors({ ...item, parts: [{ color: "#00ff00" }] }), ["#ff0000", "#0099ff", "#00ff00"]);
});

test("combining and separating retains every part's source layer colours", () => {
  const a = makeItem({ id: "a", kind: "symbol", symbol_key: "one", text: "One", color: "#ff0000", layer_colors: ["#ff0000", "#0099ff"] });
  const b = makeItem({ id: "b", kind: "symbol", symbol_key: "two", text: "Two", color: "#00ff00", layer_colors: ["#00ff00", "#ffff00"] });
  const doc = { blocks: [{ id: "block", items: [a, b], style: sectionStyle(null) }] } as LegendDoc;
  const combined = combineItems(doc, { block: "block", item: "a" }, { block: "block", item: "b" });
  assert.deepEqual(combined.blocks[0].items[0].layer_colors, a.layer_colors);
  assert.deepEqual(combined.blocks[0].items[0].parts?.[0].layer_colors, b.layer_colors);
  for (const restored of [splitItem(combined, "block", "a"), detachPart(combined, "block", "a", 0)]) {
    assert.deepEqual(restored.blocks[0].items[0].layer_colors, a.layer_colors);
    assert.deepEqual(restored.blocks[0].items[1].layer_colors, b.layer_colors);
  }
});
