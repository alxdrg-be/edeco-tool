import assert from "node:assert/strict";
import test from "node:test";
import { roomLabelAnchor } from "./planLabel.ts";
import type { Point } from "./model.ts";

function rect(x: number, y: number, width: number, height: number): Point[] {
  return [[x, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y]];
}

test("Raumnummer passt in den Innenkreis einer Raumfläche in SVG-Koordinaten", () => {
  assert.deepEqual(roomLabelAnchor([[rect(100, 200, 4, 8)]]), { x: 102, y: -204, radius: 2 });
});
test("Raumnummer liegt weder im Innenhof noch ausserhalb einer L-förmigen Kontur", () => {
  assert.equal(roomLabelAnchor([[rect(0, 0, 8, 8), rect(3, 3, 2, 2)]]), null);
  assert.equal(roomLabelAnchor([[[[0, 0], [5, 0], [5, 1], [1, 1], [1, 5], [0, 5]]]]), null);
});
