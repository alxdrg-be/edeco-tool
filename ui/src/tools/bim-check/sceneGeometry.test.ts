import assert from "node:assert/strict";
import test from "node:test";
import { localVertices, meshVisible, structureGeometry, type SceneMesh } from "./sceneGeometry.ts";

test("lokales GPU-Mesh behält Zentimeter bei Schweizer Landeskoordinaten", () => {
  const { origin, vertices } = localVertices([2600000.12, 1200000.1, 504.2, 2600000.13, 1200000.13, 504.3]);
  assert.deepEqual(origin, [2600000.12, 1200000.1, 504.2]);
  assert.ok(Math.abs(vertices[3] - 0.01) < 1e-7);
  assert.ok(Math.abs(vertices[4] - 0.03) < 1e-7);
  assert.ok(Math.abs(vertices[5] - 0.1) < 1e-7);
});

test("3D-Gebäudestruktur folgt Geschoss und Schalter, Räume folgen auch der Suche", () => {
  const room: SceneMesh = { kind: "room", id: "R", storey: "EG", positions: [], indices: [] };
  const slab: SceneMesh = { ...room, id: "D", kind: "structure" };
  const visibleIds = new Set(["R"]);
  assert.ok(meshVisible(room, "EG", visibleIds, false));
  assert.ok(!meshVisible(room, "OG", visibleIds, true));
  assert.ok(!meshVisible(room, null, new Set(), true));
  assert.ok(meshVisible(slab, null, visibleIds, true));
  assert.ok(!meshVisible(slab, "EG", visibleIds, false));
  assert.ok(!meshVisible(slab, "OG", visibleIds, true));
});

test("zusammengefasste Wände behalten ihre Position und ihre eigenen Dreiecksindizes", () => {
  const wall: SceneMesh = { kind: "structure", id: "W1", storey: "EG", positions: [2600000, 0, 0, 2600002, 0, 0, 2600002, 0, 3], indices: [0, 1, 2] };
  const wall2 = { ...wall, id: "W2", positions: wall.positions.map((v, i) => i % 3 === 1 ? v + 4 : v) };
  const batch = structureGeometry([wall, wall2]);
  assert.deepEqual(batch.origin, [2600000, 0, 0]);
  assert.deepEqual([...batch.indices], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual([...batch.vertices.slice(9)], [0, 4, 0, 2, 4, 0, 2, 4, 3]);
});
