import {
  Box3, BufferAttribute, BufferGeometry, DirectionalLight, DoubleSide, EdgesGeometry,
  HemisphereLight, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  OrthographicCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { localVertices, meshVisible, structureGeometry, type Point3, type RoomScene, type SceneMesh } from "./sceneGeometry";

const roomColors = [0x79a9b3, 0xa4bdaa, 0x899fbd, 0x88b6b5, 0xb4ac9a, 0x9daabf];
const isoDirection = new Vector3(1.1, -1.55, 1.12).normalize();

interface ScenePart {
  source: SceneMesh;
  count: number;
  body: Mesh;
  edges: LineSegments;
  box: Box3;
  color: MeshStandardMaterial | MeshBasicMaterial;
}

function roomMaterial(color: number) {
  return new MeshStandardMaterial({
    color, roughness: 1, metalness: 0, flatShading: true, side: DoubleSide,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
}

/** GPU resources live for one scene. Changing the active room only updates materials. */
export class SceneViewport {
  private readonly renderer: WebGLRenderer;
  private readonly world = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  private readonly controls: OrbitControls;
  private readonly observer: ResizeObserver;
  private readonly parts: ScenePart[] = [];
  private readonly roomMaterials = roomColors.map(roomMaterial);
  private readonly selectedMaterial = roomMaterial(0xef945a);
  private readonly structureMaterial = new MeshBasicMaterial({
    color: 0x929da7, transparent: true, opacity: 0.12, side: DoubleSide, depthWrite: false, forceSinglePass: true,
  });
  private readonly roomEdge = new LineBasicMaterial({ color: 0x456774, transparent: true, opacity: 0.72 });
  private readonly selectedEdge = new LineBasicMaterial({ color: 0x913c1f });
  private readonly structureEdge = new LineBasicMaterial({ color: 0x687985, transparent: true, opacity: 0.3, depthWrite: false });
  private readonly ray = new Raycaster();
  private readonly pickable: Mesh[] = [];
  private readonly screen = new Vector2();
  private readonly origin = new Vector3();
  private readonly center = new Vector3();
  private verticalSpan = 10;
  private width = 1;
  private height = 1;
  private floor: string | null | undefined;
  private pointer: { id: number; x: number; y: number; dragged: boolean } | null = null;
  private frame: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly onSelect: (id: string) => void) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0, 0);
    this.camera.up.set(0, 0, 1);
    this.camera.position.copy(isoDirection).multiplyScalar(10);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.minZoom = 0.15;
    this.controls.maxZoom = 100;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener("change", this.invalidate);
    this.world.add(new HemisphereLight(0xffffff, 0xe3e7e9, 1.75));
    const light = new DirectionalLight(0xfff5e7, 2.05);
    light.position.set(-3, -5, 7);
    this.world.add(light);

    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.resize();
    canvas.addEventListener("pointerdown", this.pointerDown);
    canvas.addEventListener("pointermove", this.pointerMove);
    canvas.addEventListener("pointerup", this.pointerUp);
    canvas.addEventListener("pointercancel", this.pointerCancel);
    canvas.addEventListener("keydown", this.keyDown);
  }

  load(scene: RoomScene) {
    const first = scene.meshes.find(item => item.positions.length > 0);
    if (first) this.origin.fromArray(first.positions);
    const structureByFloor = new Map<string, SceneMesh[]>();
    let roomIndex = 0;
    for (const mesh of scene.meshes) {
      if (mesh.positions.length < 9 || mesh.indices.length < 3) continue;
      if (mesh.kind === "room") {
        const { vertices, origin } = localVertices(mesh.positions);
        this.addPart(mesh, 1, origin, vertices, mesh.indices, this.roomMaterials[roomIndex++ % this.roomMaterials.length]);
      } else {
        const group = structureByFloor.get(mesh.storey);
        if (group) group.push(mesh); else structureByFloor.set(mesh.storey, [mesh]);
      }
    }
    for (const group of structureByFloor.values()) {
      const { vertices, indices, origin } = structureGeometry(group);
      this.addPart(group[0], group.length, origin, vertices, new BufferAttribute(indices, 1), this.structureMaterial);
    }
  }

  private addPart(source: SceneMesh, count: number, origin: Point3, vertices: Float32Array,
    indices: number[] | BufferAttribute, color: MeshBasicMaterial | MeshStandardMaterial) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeBoundingBox();
    const room = source.kind === "room";
    const body = new Mesh(geometry, color);
    body.position.fromArray(origin).sub(this.origin);
    body.userData.id = source.id;
    body.renderOrder = room ? 0 : 2;
    const edges = new LineSegments(new EdgesGeometry(geometry, 25), room ? this.roomEdge : this.structureEdge);
    edges.renderOrder = room ? 1 : 3;
    body.add(edges);
    this.world.add(body);
    this.parts.push({ source, count, color, body, edges, box: geometry.boundingBox!.clone().translate(body.position) });
  }

  show(floor: string | null, visibleIds: ReadonlySet<string>, selected: string | null, opacity: number) {
    this.structureMaterial.opacity = opacity / 100;
    this.structureEdge.opacity = Math.min(0.68, opacity / 100 + 0.15);
    this.pickable.length = 0;
    let structures = 0;
    for (const { source, count, body, edges, color } of this.parts) {
      body.visible = meshVisible(source, floor, visibleIds, opacity > 0);
      if (!body.visible) continue;
      if (source.kind === "room") {
        const active = source.id === selected;
        body.material = active ? this.selectedMaterial : color;
        edges.material = active ? this.selectedEdge : this.roomEdge;
        this.pickable.push(body);
      } else {
        structures += count;
      }
    }
    this.canvas.dataset.roomCount = String(this.pickable.length);
    this.canvas.dataset.structureCount = String(structures);
    if (this.floor !== floor) {
      this.floor = floor;
      this.fit();
    }
    this.invalidate();
  }

  fit = (id?: string) => {
    const bounds = new Box3();
    for (const { source, box, body } of this.parts) {
      if (body.visible && (!id || source.id === id)) bounds.union(box);
    }
    if (bounds.isEmpty()) return;
    const diameter = Math.max(0.1, bounds.getSize(new Vector3()).length());
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    bounds.getCenter(this.center);
    this.controls.target.copy(this.center);
    this.camera.position.copy(this.center).addScaledVector(direction.lengthSq() ? direction : isoDirection, 2 * diameter);
    this.camera.lookAt(this.center);
    this.camera.updateMatrixWorld();
    const right = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    const size = bounds.getSize(new Vector3());
    const extent = (axis: Vector3) => Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z;
    this.verticalSpan = Math.max(extent(up), extent(right) * this.height / this.width, 0.1) * 1.16;
    this.camera.near = diameter * 0.001;
    this.camera.far = diameter * 12;
    this.camera.zoom = 1;
    this.updateFrustum();
    this.controls.update();
    this.invalidate();
  };

  zoom(factor: number) {
    this.camera.zoom = Math.max(this.controls.minZoom, Math.min(this.controls.maxZoom, this.camera.zoom * factor));
    this.camera.updateProjectionMatrix();
    this.controls.update();
    this.invalidate();
  }

  private resize = () => {
    this.width = Math.max(1, this.canvas.clientWidth);
    this.height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(this.width, this.height, false);
    this.updateFrustum();
    this.invalidate();
  };

  private updateFrustum() {
    const halfHeight = this.verticalSpan / 2;
    const halfWidth = halfHeight * this.width / this.height;
    this.camera.left = -halfWidth; this.camera.right = halfWidth;
    this.camera.top = halfHeight; this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  private invalidate = () => {
    if (this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.renderer.render(this.world, this.camera);
    });
  };

  private pointerDown = (event: PointerEvent) => {
    this.pointer = event.button === 0 && event.isPrimary
      ? { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false } : null;
  };

  private pointerMove = (event: PointerEvent) => {
    if (this.pointer && Math.hypot(this.pointer.x - event.clientX, this.pointer.y - event.clientY) > 4) this.pointer.dragged = true;
  };

  private pointerCancel = () => { this.pointer = null; };

  private pointerUp = (event: PointerEvent) => {
    const press = this.pointer;
    this.pointer = null;
    if (!press || press.id !== event.pointerId || press.dragged || Math.hypot(press.x - event.clientX, press.y - event.clientY) > 4) return;
    const rect = this.canvas.getBoundingClientRect();
    this.screen.set(2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height);
    this.ray.setFromCamera(this.screen, this.camera);
    // Building context is deliberately transparent to room picking.
    const hit = this.ray.intersectObjects(this.pickable, false)[0];
    if (hit) this.onSelect(hit.object.userData.id);
  };

  private keyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const step = Math.PI / 18;
    switch (event.key) {
      case "ArrowLeft": this.controls.rotateLeft(step); break;
      case "ArrowRight": this.controls.rotateLeft(-step); break;
      case "ArrowUp": this.controls.rotateUp(step); break;
      case "ArrowDown": this.controls.rotateUp(-step); break;
      case "+": case "=": this.zoom(1.25); break;
      case "-": this.zoom(0.8); break;
      case "Home": this.fit(); break;
      default: return;
    }
    event.preventDefault();
    this.controls.update();
  };

  dispose() {
    this.observer.disconnect();
    this.canvas.removeEventListener("pointerdown", this.pointerDown);
    this.canvas.removeEventListener("pointermove", this.pointerMove);
    this.canvas.removeEventListener("pointerup", this.pointerUp);
    this.canvas.removeEventListener("pointercancel", this.pointerCancel);
    this.canvas.removeEventListener("keydown", this.keyDown);
    this.controls.removeEventListener("change", this.invalidate);
    this.controls.dispose();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    for (const { body, edges } of this.parts) { body.geometry.dispose(); edges.geometry.dispose(); }
    for (const material of [...this.roomMaterials, this.selectedMaterial, this.structureMaterial, this.roomEdge, this.selectedEdge, this.structureEdge]) material.dispose();
    this.world.clear();
    this.renderer.dispose();
    // React StrictMode can initialise a new renderer on this same canvas.
    if (!this.canvas.isConnected) this.renderer.forceContextLoss();
  }
}
