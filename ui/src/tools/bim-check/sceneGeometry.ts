export interface SceneMesh {
  id: string;
  kind: "room" | "structure";
  storey: string;
  positions: number[];
  indices: number[];
}

export interface RoomScene {
  meshes: SceneMesh[];
  warnings: string[];
}

export type Point3 = [number, number, number];

// IFC projects often use Swiss survey coordinates (millions of metres). Subtract
// a double-precision origin before uploading coordinates to the float32 GPU buffer.
export function localVertices(positions: number[]): { origin: Point3; vertices: Float32Array } {
  const origin: Point3 = [positions[0], positions[1], positions[2]];
  const vertices = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    vertices[i] = positions[i] - origin[0];
    vertices[i + 1] = positions[i + 1] - origin[1];
    vertices[i + 2] = positions[i + 2] - origin[2];
  }
  return { origin, vertices };
}

// Walls, slabs and columns share one appearance and are only filtered by storey.
// One indexed buffer per storey avoids separate GPU draw calls for every wall.
export function structureGeometry(meshes: SceneMesh[]) {
  const first = meshes[0].positions;
  const origin: Point3 = [first[0], first[1], first[2]];
  const size = meshes.reduce((n, mesh) => n + mesh.positions.length, 0);
  const vertices = new Float32Array(size);
  const indices = new Uint32Array(meshes.reduce((n, mesh) => n + mesh.indices.length, 0));
  let coordinate = 0;
  let index = 0;
  for (const mesh of meshes) {
    const offset = coordinate / 3;
    for (let i = 0; i < mesh.positions.length; i += 3) {
      vertices[coordinate++] = mesh.positions[i] - origin[0];
      vertices[coordinate++] = mesh.positions[i + 1] - origin[1];
      vertices[coordinate++] = mesh.positions[i + 2] - origin[2];
    }
    for (const pointIndex of mesh.indices) indices[index++] = offset + pointIndex;
  }
  return { vertices, indices, origin };
}

export function meshVisible(mesh: SceneMesh, floor: string | null, visibleIds: ReadonlySet<string>, structure: boolean) {
  return (floor === null || mesh.storey === floor) && (mesh.kind === "room" ? visibleIds.has(mesh.id) : structure);
}
