import test from "node:test";
import assert from "node:assert/strict";
import { isImageSource, isPdfSource, nativePageNumbers, nativeSplitCuts, toggleNativeCut } from "./nativeTools.ts";

test("native file handoff accepts a known MIME type or the ordinary file extension", () => {
  assert.ok(isPdfSource({ name: "Plan", type: "application/pdf" }));
  assert.ok(isPdfSource({ name: "PLAN.PDF", type: "" }));
  assert.ok(isImageSource({ name: "Bild", type: "image/png" }));
  assert.ok(isImageSource({ name: "Bild.jpg", type: "application/octet-stream" }));
  assert.equal(isImageSource({ name: "Datei.txt", type: "text/plain" }), false);
});

test("page selections preserve explicit order and reject invalid/out-of-range input", () => {
  assert.deepEqual(nativePageNumbers("3,1-2,3", 4), [3, 1, 2]);
  assert.deepEqual(nativePageNumbers("all", 3), [1, 2, 3]);
  assert.deepEqual(nativePageNumbers("", 3), []);
  for (const invalid of ["0", "2-1", "5", "1x", "1,", "1e2", "Infinity"]) assert.equal(nativePageNumbers(invalid, 4), null);
});

test("visual split markers represent gaps after pages; an empty custom set keeps pages together", () => {
  assert.deepEqual(nativeSplitCuts("", 4, true), [1, 2, 3]);
  assert.deepEqual(nativeSplitCuts("", 4, false), []);
  assert.deepEqual(nativeSplitCuts("2", 4, false), [2]);
  assert.equal(nativeSplitCuts("4", 4, false), null);
  assert.equal(toggleNativeCut([1, 3], 2), "1,2,3");
  assert.equal(toggleNativeCut([1, 2, 3], 2), "1,3");
});
