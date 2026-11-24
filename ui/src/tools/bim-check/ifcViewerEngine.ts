import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
// Worker and WASM ship with the Toolhub. Nothing is fetched from a CDN, the viewer works offline.
import workerUrl from "@thatopen/fragments/worker?url";
import { groupOf, viewerGroups, type GroupId } from "./ifcViewerGroups";

export type { GroupId };
export interface Pick { localId: number; point: THREE.Vector3 }

const SELECTED = new THREE.Color("#C0402A");
const NEUTRAL = new THREE.Color("#C9D0D4");
const ROOM_OPACITY = 0.28;
// IfcSpace usually carries no colour. A light tint keeps rooms readable over the white structure.
const ROOM_TINT = new THREE.Color("#79A9B3");

/** One That Open world per canvas. All model edits go through the fragments worker. */
export class IfcViewerEngine {
  private readonly components = new OBC.Components();
  private readonly world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>;
  private readonly fragments: OBC.FragmentsManager;
  private readonly clipper: OBC.Clipper;
  private readonly measureGroup = new THREE.Group();
  private model: FRAGS.FragmentsModel | null = null;
  private groups = new Map<GroupId, number[]>();
  private selectedIds: number[] = [];
  private colors: Map<number, string> | null = null;
  private disposed = false;

  constructor(private readonly host: HTMLElement) {
    const worlds = this.components.get(OBC.Worlds);
    this.world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();
    this.world.scene = new OBC.SimpleScene(this.components);
    this.world.scene.setup();
    this.world.scene.three.background = null;
    this.world.renderer = new OBC.SimpleRenderer(this.components, host);
    // Credit for That Open Engine (MIT) stays in docs/BIM_CHECK.md, not on the drawing.
    this.world.renderer.showLogo = false;
    this.world.camera = new OBC.OrthoPerspectiveCamera(this.components);
    this.components.init();
    this.world.scene.three.add(this.measureGroup);

    this.fragments = this.components.get(OBC.FragmentsManager);
    this.fragments.init(workerUrl);
    this.world.camera.controls.addEventListener("rest", () => void this.fragments.core.update(true));
    this.fragments.list.onItemSet.add(({ value }) => {
      value.useCamera(this.world.camera.three);
      this.world.scene.three.add(value.object);
      void this.fragments.core.update(true);
    });
    this.clipper = this.components.get(OBC.Clipper);
    this.clipper.enabled = false;
    // Only the cut is wanted, not the plane and its drag arrow.
    this.clipper.onAfterCreate.add(plane => { plane.visible = false; });
  }

  get canvas() { return this.world.renderer!.three.domElement; }

  async load(buffer: ArrayBuffer, name: string) {
    const loader = this.components.get(OBC.IfcLoader);
    // The build copies web-ifc.wasm to /web-ifc/ (see vite.config.ts).
    await loader.setup({ autoSetWasm: false, wasm: { path: new URL("web-ifc/", document.baseURI).href, absolute: true } });
    const model = await loader.load(new Uint8Array(buffer), true, name, {
      // Swiss models often carry LV95 coordinates (2.6 million metres). Keep every object.
      instanceCallback: importer => { importer.distanceThreshold = null; },
    });
    if (this.disposed) return;
    this.model = model;
    const categories = await model.getCategories();
    const byCategory = await model.getItemsOfCategories(categories.map(c => new RegExp(`^${c}$`)));
    const withGeometry = new Set(await model.getItemsIdsWithGeometry());
    this.groups = new Map(viewerGroups.map(group => [group.id, [] as number[]]));
    for (const [category, ids] of Object.entries(byCategory)) {
      const group = groupOf(category);
      this.groups.get(group)!.push(...ids.filter(id => withGeometry.has(id)));
    }
    await this.restyle();
    await this.fit();
  }

  groupCounts() {
    return new Map([...this.groups].map(([id, ids]) => [id, ids.length]));
  }

  async localIds(elementIds: string[]) {
    if (!this.model) return [];
    const guids = elementIds.filter(id => !id.startsWith("#"));
    const steps = elementIds.filter(id => id.startsWith("#")).map(id => Number(id.slice(1))).filter(Number.isInteger);
    const found = guids.length ? await this.model.getLocalIdsByGuids(guids) : [];
    return [...found.filter((id): id is number => id !== null), ...steps];
  }

  async elementId(localId: number) {
    const [guid] = await this.model!.getGuidsByLocalIds([localId]);
    return { guid, step: `#${localId}` };
  }

  /** Shows the enabled groups, limited to one storey or an isolated set when given. */
  async show(enabled: ReadonlySet<GroupId>, only: ReadonlySet<number> | null) {
    const model = this.model;
    if (!model) return;
    const visible: number[] = [], hidden: number[] = [];
    for (const [group, ids] of this.groups) {
      for (const id of ids) (enabled.has(group) && (!only || only.has(id)) ? visible : hidden).push(id);
    }
    if (hidden.length) await model.setVisible(hidden, false);
    if (visible.length) await model.setVisible(visible, true);
    await this.fragments.core.update(true);
  }

  /** Colours checked objects by status. `null` shows the colours from the IFC. */
  async paint(colors: Map<number, string> | null) {
    this.colors = colors;
    await this.restyle();
  }

  async select(localIds: number[]) {
    this.selectedIds = localIds;
    await this.restyle();
  }

  // All styling runs through one highlight layer, so status colours, room tint and
  // selection never fight over the same material.
  private async restyle() {
    const model = this.model;
    if (!model) return;
    await model.resetHighlight();
    const rooms = new Set(this.groups.get("rooms") ?? []);
    const style = (color: THREE.Color, room: boolean): FRAGS.MaterialDefinition => ({
      color, renderedFaces: FRAGS.RenderedFaces.TWO,
      opacity: room ? ROOM_OPACITY : 1, transparent: room, depthTest: true,
    });
    const apply = async (ids: number[], color: THREE.Color) => {
      const solid = ids.filter(id => !rooms.has(id)), spaces = ids.filter(id => rooms.has(id));
      if (solid.length) await model.highlight(solid, style(color, false));
      if (spaces.length) await model.highlight(spaces, style(color, true));
    };
    const selected = new Set(this.selectedIds);
    if (this.colors) {
      const byColor = new Map<string, number[]>();
      const neutral: number[] = [];
      for (const id of [...this.groups.values()].flat()) {
        if (selected.has(id)) continue;
        const color = this.colors.get(id);
        if (color) byColor.set(color, [...byColor.get(color) ?? [], id]); else neutral.push(id);
      }
      await apply(neutral, NEUTRAL);
      for (const [color, ids] of byColor) await apply(ids, new THREE.Color(color));
    } else {
      await apply([...rooms].filter(id => !selected.has(id)), ROOM_TINT);
    }
    if (selected.size) await apply([...selected], SELECTED);
    await this.fragments.core.update(true);
  }

  async pick(event: MouseEvent): Promise<Pick | null> {
    const result = await this.model?.raycast({
      camera: this.world.camera.three, mouse: new THREE.Vector2(event.clientX, event.clientY), dom: this.canvas,
    });
    return result ? { localId: result.localId, point: result.point.clone() } : null;
  }

  async fit(localIds?: number[]) {
    const model = this.model;
    if (!model) return;
    const box = localIds?.length ? await model.getMergedBox(localIds) : model.box;
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    await this.world.camera.controls.fitToSphere(sphere, true);
  }

  zoom(factor: number) {
    void this.world.camera.controls.dolly(factor > 1 ? 4 : -4, true);
  }

  /** Horizontal section 1.2 m above the lowest point of the given objects, or of the model. */
  async section(active: boolean, localIds?: number[]) {
    this.clipper.deleteAll();
    this.clipper.enabled = active;
    if (active && this.model) {
      const box = localIds?.length ? await this.model.getMergedBox(localIds) : this.model.box;
      const height = Math.min(box.min.y + 1.2, box.max.y);
      this.clipper.createFromNormalAndCoplanarPoint(this.world, new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, height, 0));
    }
    await this.fragments.core.update(true);
  }

  /** Draws a measuring line between two picked points and returns its length in metres. */
  measure(a: THREE.Vector3, b: THREE.Vector3 | null) {
    this.clearMeasure();
    const material = new THREE.MeshBasicMaterial({ color: SELECTED, depthTest: false });
    for (const point of b ? [a, b] : [a]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), material);
      dot.position.copy(point); dot.renderOrder = 2;
      this.measureGroup.add(dot);
    }
    if (!b) return null;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]),
      new THREE.LineBasicMaterial({ color: SELECTED, depthTest: false }));
    line.renderOrder = 2;
    this.measureGroup.add(line);
    return a.distanceTo(b);
  }

  clearMeasure() {
    for (const child of [...this.measureGroup.children]) {
      this.measureGroup.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) child.geometry.dispose();
    }
  }

  dispose() {
    this.disposed = true;
    this.clearMeasure();
    this.components.dispose();
    this.host.replaceChildren();
  }
}
