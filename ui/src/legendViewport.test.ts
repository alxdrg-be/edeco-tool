import test from "node:test";
import assert from "node:assert/strict";
import { a4CompactLegendDocument, alignLegendSectionColors, clampLegendZoom, compactLegendDocument, compactLegendStyle, fitLegendZoom, legendItemColors, legendLayerColors, legendVisibleItemColors, legendVisibleLayerColors } from "./legendViewport.ts";
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
  const a = makeItem({ id: "a", kind: "symbol", symbol_key: "one", text: "One", color: "#ff0000", layer_colors: ["#ff0000", "#0099ff"], visible_layer_colors: ["#0099ff"] });
  const b = makeItem({ id: "b", kind: "symbol", symbol_key: "two", text: "Two", color: "#00ff00", layer_colors: ["#00ff00", "#ffff00"], visible_layer_colors: ["#ffff00"] });
  const doc = { blocks: [{ id: "block", items: [a, b], style: sectionStyle(null) }] } as LegendDoc;
  const combined = combineItems(doc, { block: "block", item: "a" }, { block: "block", item: "b" });
  assert.deepEqual(combined.blocks[0].items[0].layer_colors, a.layer_colors);
  assert.deepEqual(combined.blocks[0].items[0].parts?.[0].layer_colors, b.layer_colors);
  assert.deepEqual(combined.blocks[0].items[0].parts?.[0].visible_layer_colors, b.visible_layer_colors);
  for (const restored of [splitItem(combined, "block", "a"), detachPart(combined, "block", "a", 0)]) {
    assert.deepEqual(restored.blocks[0].items[0].layer_colors, a.layer_colors);
    assert.deepEqual(restored.blocks[0].items[1].layer_colors, b.layer_colors);
    assert.deepEqual(restored.blocks[0].items[0].visible_layer_colors, a.visible_layer_colors);
    assert.deepEqual(restored.blocks[0].items[1].visible_layer_colors, b.visible_layer_colors);
  }
});

test("a colour choice filters repetitions without removing semantic parts or source colours", () => {
  const first = { layer_colors: ["#0099ff", "#ff0000"], visible_layer_colors: ["#FF0000"],
    parts: [{ color: "#0099ff" }, { layer_colors: ["#00ff00", "#ffff00"], visible_layer_colors: ["#ffff00"] }] };
  assert.deepEqual(legendVisibleLayerColors(first), ["#ff0000"]);
  assert.deepEqual(legendVisibleItemColors(first), ["#ff0000", "#0099ff", "#ffff00"]);
  assert.deepEqual(first.layer_colors, ["#0099ff", "#ff0000"]);
  assert.deepEqual(legendVisibleLayerColors({ ...first, visible_layer_colors: [] }), first.layer_colors);
  assert.deepEqual(legendVisibleLayerColors({ ...first, visible_layer_colors: ["#123456"] }), first.layer_colors);
});

test("the explicit density preset repairs a large old raster and preserves sheet settings", () => {
  const original = Object.freeze({ font: "Calibri", text_size: 6, symbol_scale: 2.5, grid: "custom", row: 18,
    text_offset: 27, columns: 2, compact_flow: false, width: 180, margin: 5, plan_scale: 50,
    section_gap: 12, entry_gap: 8, text_lines: 3, frame_on: true, frame: "#ff0000", pdf_lines: "original" as const });
  const compact = compactLegendStyle(original);
  assert.equal(original.row, 18);
  assert.equal(original.compact_flow, false);
  assert.equal(compact.compact_flow, true);
  assert.equal(compact.columns, 3);
  assert.equal(compact.grid, "dicht");
  assert.equal(compact.row, 6);
  assert.equal(compact.text_size, 2.8);
  assert.equal(compact.symbol_scale, 1);
  assert.equal(compact.entry_gap, 0);
  assert.equal(compact.width, 180);
  assert.equal(compact.font, "Calibri");
  assert.equal(compact.frame, "#ff0000");
  assert.equal(compact.pdf_lines, "proportional");
  assert.equal(original.pdf_lines, "original");
});

test("the compact preset accents only former general defaults and preserves custom colours", () => {
  for (const header of ["#808080", "#1c7ed6", "#a13a51"]) {
    const doc = { style: { row: 18 }, general_section: { title: "Vorlage", header, title_scale: 1.2 },
      blocks: [{ id: "body", items: [{ color: "#808080", layer_colors: ["#ff0000", "#0099ff"] }] }] } as LegendDoc;
    const preset = compactLegendDocument(doc);
    assert.equal(preset.general_section?.header, header === "#a13a51" ? header : "#007f91");
    assert.equal(preset.general_section?.title, "Vorlage");
    assert.equal(preset.general_section?.title_scale, 1.2);
    assert.equal(doc.general_section?.header, header);
    assert.deepEqual(preset.blocks[0].items, doc.blocks[0].items);
    assert.equal(preset.blocks[0].style.padding, 1.2);
  }
});

test("A4 is an explicit four-column preset and reference density can be restored", () => {
  const doc = { style: { row: 18, width: 180, margin: 7 }, title: { text: "Unverändert", size_mm: 5 },
    blocks: [{ id: "body", style: { padding: 4, header: "#a13a51" },
      items: [{ id: "source", color: "#ff0000", layer_colors: ["#ff0000", "#0099ff"] }] }] } as LegendDoc;
  const a4 = a4CompactLegendDocument(doc);
  assert.equal(a4.style.columns, 4);
  assert.equal(a4.style.width, 200);
  assert.equal(a4.style.margin, 3.5);
  assert.equal(a4.style.text_size, 2.6);
  assert.equal(a4.style.symbol_fit, "corridor");
  assert.equal(a4.style.general_source_look, true);
  assert.equal(a4.style.pdf_lines, "proportional");
  assert.equal(a4.title.text, "Unverändert");
  assert.equal(a4.title.size_mm, 4.5);
  assert.equal(a4.blocks[0].style.padding, 0.5);
  assert.equal(a4.blocks[0].style.header, "#a13a51");
  assert.deepEqual(a4.blocks[0].items, doc.blocks[0].items);
  assert.equal(doc.style.width, 180);
  assert.equal(doc.blocks[0].style.padding, 4);
  const reference = compactLegendDocument(a4);
  assert.equal(reference.style.columns, 3);
  assert.equal(reference.style.text_size, 2.8);
  assert.equal(reference.style.margin, 5);
  assert.equal(reference.style.pdf_lines, "proportional");
  assert.equal(reference.blocks[0].style.padding, 1.2);
});

test("explicit section-colour alignment repairs a red light-switch heading without repainting glyphs", () => {
  const blue = makeItem({ id: "blue", text: "Schalter", symbol_key: "switch", family_key: "f", color: "#0099ff", layer_colors: ["#0099ff"] });
  const red = { ...blue, id: "red", color: "#ff0000", layer_colors: ["#ff0000"] };
  const doc = { style: {}, blocks: [{ id: "switches", style: sectionStyle("#ff0000"), items: [blue, { ...blue, id: "b2", symbol_color: "#000000" }, red] },
    { id: "mixed", style: sectionStyle("#993300"), items: [blue, red] }] } as LegendDoc;
  const source = structuredClone(doc);
  const aligned = alignLegendSectionColors(doc);
  assert.equal(aligned.blocks[0].style.header, "#0099ff");
  assert.deepEqual(aligned.blocks[0].items, source.blocks[0].items);
  assert.equal(aligned.blocks[1].style.header, "#993300");
  assert.deepEqual(doc, source);
});
