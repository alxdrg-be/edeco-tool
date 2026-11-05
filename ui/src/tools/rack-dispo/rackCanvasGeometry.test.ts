import { test } from "node:test";
import assert from "node:assert/strict";
import { limitRackViewport, rackPortGrid, readRackDragProfile } from "./rackCanvasGeometry.ts";

test("24 and 48 ports have distinct positions, complete numbering and the correct rows", () => {
  for (const count of [24, 48, 288]) {
    const ports = rackPortGrid(count);
    assert.equal(ports.length, count);
    assert.deepEqual(ports.map(port => port.number), Array.from({ length: count }, (_, index) => index + 1));
    assert.equal(new Set(ports.map(port => `${port.row}:${port.column}`)).size, count);
    assert.equal(ports.at(-1)?.row, Math.ceil(count / 24) - 1);
    assert.equal(ports.at(-1)?.column, 23);
  }
  assert.deepEqual(rackPortGrid(0), []);
  assert.deepEqual(rackPortGrid(289), []);
  assert.deepEqual(rackPortGrid(2.5), []);
});

test("panning stays on the cabinet instead of wandering into empty space", () => {
  const rack = { widthMm: 800, heightMm: 2100 }, size = { width: 600, height: 800 };
  const lost = limitRackViewport({ x: 5000, y: -8000, scale: .4 }, rack, size);
  assert.ok(lost.x <= rack.widthMm && lost.x > -size.width / .4);
  assert.ok(lost.y <= rack.heightMm && lost.y > -size.height / .4);
  const fitted = limitRackViewport({ x: -40, y: -30, scale: .3 }, rack, size);
  assert.deepEqual(fitted, { x: -40, y: -30, scale: .3 });
});

test("native profile drag data rejects unrelated, malformed and excessive payloads", () => {
  assert.equal(readRackDragProfile('{"profileId":"generic-patch24"}'), "generic-patch24");
  for (const value of ["", "ordinary text", "null", "[]", '{"profileId":3}', '{"profileId":""}', JSON.stringify({ profileId: "x".repeat(201) }), "x".repeat(2000)]) assert.equal(readRackDragProfile(value), null);
});
