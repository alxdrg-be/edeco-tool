import { test } from "node:test";
import assert from "node:assert/strict";
import { rackDrawingFill, rackDrawingInk } from "./rackDrawingPalette.ts";

test("drawing fills accept only complete six-digit hex colours", () => {
  assert.equal(rackDrawingFill("#AABBCC", "#cccccc"), "#aabbcc");
  assert.equal(rackDrawingFill("#ffff00", "#ffffff"), "#ffff00");
  for (const value of [undefined, null, 12, {}, "red", "#fff", " #ffffff", "#ffffff00", "url(https://example.com/x)", "#ffffff;stroke:red"]) assert.equal(rackDrawingFill(value, "#cccccc"), "#cccccc");
});

test("source grey, white, yellow and orange use dark ink; dark custom fills use white ink", () => {
  for (const fill of ["#cccccc", "#ffffff", "#ffff00", "#ff9900"]) assert.equal(rackDrawingInk(fill), "#222222");
  for (const fill of ["#000000", "#222222", "#123456"]) assert.equal(rackDrawingInk(fill), "#ffffff");
});
