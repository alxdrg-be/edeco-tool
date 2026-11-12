import test from "node:test";
import assert from "node:assert/strict";
import { isBrowserZoomKey } from "./appZoom.ts";

test("page zoom shortcuts are blocked, including numpad and Command", () => {
  for (const key of ["+", "-", "=", "0"]) {
    assert.ok(isBrowserZoomKey({ ctrlKey: true, metaKey: false, altKey: false, key, code: "" }));
    assert.ok(isBrowserZoomKey({ ctrlKey: false, metaKey: true, altKey: false, key, code: "" }));
  }
  assert.ok(isBrowserZoomKey({ ctrlKey: true, metaKey: false, altKey: false, key: "Add", code: "NumpadAdd" }));
});
test("editing, copy shortcuts and AltGr remain available", () => {
  for (const key of ["c", "v", "a", "z", "s", "ArrowLeft"]) assert.equal(isBrowserZoomKey({ ctrlKey: true, metaKey: false, altKey: false, key, code: "" }), false);
  assert.equal(isBrowserZoomKey({ ctrlKey: false, metaKey: false, altKey: false, key: "+", code: "" }), false);
  assert.equal(isBrowserZoomKey({ ctrlKey: true, metaKey: false, altKey: true, key: "=", code: "Equal" }), false);
});
