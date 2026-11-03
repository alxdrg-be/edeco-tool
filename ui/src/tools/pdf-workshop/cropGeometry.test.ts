import { test } from "node:test";
import assert from "node:assert/strict";
import { FULL_CROP, clampCrop, constrainCrop, cropMargins, cropPageRange, cropPoint,
  drawCrop, fitCropZoom, marginsCrop, moveCrop, resizeCrop } from "./cropGeometry.ts";

test("pointer coordinates follow actual sheet bounds after centering, zoom and scroll", () => {
  assert.deepEqual(cropPoint({ x: 250, y: 170 }, { left: 50, top: -30, width: 400, height: 800 }), { x: .5, y: .25 });
  assert.deepEqual(cropPoint({ x: -100, y: 900 }, { left: 0, top: 0, width: 400, height: 800 }), { x: 0, y: 1 });
});

test("drawing in reverse direction and moving preserve a bounded positive rectangle", () => {
  assert.deepEqual(drawCrop({ x: .8, y: .9 }, { x: .2, y: .1 }), { x: .2, y: .1, width: .6000000000000001, height: .8 });
  assert.deepEqual(moveCrop({ x: .2, y: .3, width: .4, height: .5 }, { x: 4, y: -5 }), { x: .6, y: 0, width: .4, height: .5 });
  assert.ok(clampCrop({ x: 2, y: -2, width: -1, height: NaN }).width > 0);
});

test("all eight handles change only their intended edges and stop before crossing", () => {
  const rect = { x: .2, y: .2, width: .6, height: .6 };
  assert.deepEqual(resizeCrop(rect, "n", { x: .1, y: .1 }), { x: .2, y: .30000000000000004, width: .6000000000000001, height: .5 });
  for (const handle of ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const) {
    const next = resizeCrop(rect, handle, { x: .1, y: .1 });
    assert.ok(next.x >= 0 && next.y >= 0 && next.width > 0 && next.height > 0);
    assert.ok(next.x + next.width <= 1 && next.y + next.height <= 1);
    if (!handle.includes("n") && !handle.includes("s")) assert.ok(Math.abs(next.height - rect.height) < 1e-8);
    if (!handle.includes("w") && !handle.includes("e")) assert.ok(Math.abs(next.width - rect.width) < 1e-8);
  }
  assert.ok(resizeCrop(rect, "nw", { x: 5, y: 5 }).width >= .000099);
});

test("physical A4 aspect uses the rotated page dimensions", () => {
  const landscape = { width: 842, height: 595 };
  const next = constrainCrop({ ...FULL_CROP }, 210 / 297, landscape);
  assert.ok(Math.abs(next.width * landscape.width / (next.height * landscape.height) - 210 / 297) < 1e-10);
  assert.equal(next.height, 1);
});

test("millimetre margins roundtrip independently of rotation and UserUnit scaling", () => {
  const page = { width: 420, height: 297 };
  const margins = { top: 10, bottom: 20, left: 30, right: 40 };
  const rect = marginsCrop(margins, page)!;
  for (const [name, value] of Object.entries(cropMargins(rect, page))) assert.ok(Math.abs(value - margins[name as keyof typeof margins]) < 1e-8);
  assert.equal(marginsCrop({ ...margins, left: 400 }, page), null);
  assert.equal(marginsCrop({ ...margins, top: NaN }, page), null);
  assert.equal(marginsCrop({ ...margins, right: -1 }, page), null);
});

test("fit entire page accounts for CSS point scaling and canvas padding", () => {
  const page = { width: 600, height: 900 }, viewport = { width: 1000, height: 800 };
  const zoom = fitCropZoom(page, viewport, "page");
  assert.ok(page.width * 96 / 72 * zoom <= viewport.width - 64 + 1e-8);
  assert.ok(page.height * 96 / 72 * zoom <= viewport.height - 64 + 1e-8);
  assert.ok(fitCropZoom(page, viewport, "width") > zoom);
});

test("page ranges accept comma/en dash, deduplicate, and reject nonexistent or reversed pages", () => {
  assert.deepEqual(cropPageRange("1, 3–5, 3", 6), [1, 3, 4, 5]);
  for (const value of ["", "0", "2-1", "1,", "7", "1-999999999", "1.5"]) assert.equal(cropPageRange(value, 6), null);
});
