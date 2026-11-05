import assert from "node:assert/strict";
import test from "node:test";
import { sheetScale, stackLabels, textWidth, wrapText } from "./sheetLayout.ts";

test("sheet scale fits 42 HE and 24 HE cabinets on A4", () => {
  assert.equal(sheetScale(800, 2100), 15);
  assert.equal(sheetScale(600, 1200), 10);
});

test("labels wrap by width and are never shortened", () => {
  const text = "Sämtliche Rangierpanel R&M R171185 (L durch swisspro, M durch ICT Bauherr)";
  const lines = wrapText(text, 2.3, 60);
  assert.equal(lines.join(" "), text);
  assert.ok(lines.every(line => textWidth(line, 2.3) <= 60));
  assert.ok(lines.length >= 2);
  assert.deepEqual(wrapText("R171863-sw-8-ABCDEFGHIJKLMNOPQRSTUVWXYZ", 3, 20).join(""), "R171863-sw-8-ABCDEFGHIJKLMNOPQRSTUVWXYZ");
});

test("stacked labels keep device order and never overlap", () => {
  const placed = stackLabels([{ id: "b", anchorY: 50, lines: ["B", "B2"] }, { id: "a", anchorY: 49, lines: ["A"] }, { id: "c", anchorY: 51, lines: ["C"] }], 3, 40, 200);
  assert.deepEqual(placed.map(item => item.id), ["a", "b", "c"]);
  for (let index = 1; index < placed.length; index++) assert.ok(placed[index].y >= placed[index - 1].y + placed[index - 1].lines.length * 3);
  const crowded = stackLabels(Array.from({ length: 5 }, (_, index) => ({ id: String(index), anchorY: 99, lines: ["x"] })), 3, 40, 100);
  assert.ok(crowded.at(-1)!.y + 3 <= 100);
});
