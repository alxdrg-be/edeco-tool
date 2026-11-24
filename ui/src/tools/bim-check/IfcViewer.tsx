import { useEffect, useMemo, useRef, useState } from "react";
import { Focus, LoaderCircle, Maximize2, Minus, Plus, Ruler, Scissors, ScanSearch } from "lucide-react";
import { createPortal } from "react-dom";
import type { Vector3 } from "three";
import { responseError } from "../../shared/http";
import { IfcViewerEngine } from "./ifcViewerEngine";
import { statusColors, viewerGroups, worstStatus, type CheckStatus, type GroupId } from "./ifcViewerGroups";
import { count, type ModelElement, type Report } from "./model";
import "./ifc-viewer.css";

interface Props {
  ifcUrl: string;
  filename: string;
  groupsHost?: HTMLDivElement | null;
  elements: ModelElement[];
  floor: string | null;
  selected: string | null;
  onSelect: (id: string) => void;
  report: Report | null;
  colorMode: "ifc" | "status";
  onColorMode: (mode: "ifc" | "status") => void;
}

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready" };
const defaultGroups: GroupId[] = ["rooms", "walls", "slabs", "openings", "structure", "stairs", "installation"];

export default function IfcViewer({ ifcUrl, filename, elements, floor, selected, onSelect, report, groupsHost, colorMode: requestedMode, onColorMode: setColorMode }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<IfcViewerEngine | null>(null);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [counts, setCounts] = useState(new Map<GroupId, number>());
  const [groups, setGroups] = useState(new Set<GroupId>(defaultGroups));
  const [isolated, setIsolated] = useState(false);
  const [section, setSection] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const firstPoint = useRef<Vector3 | null>(null);
  const [pointCount, setPointCount] = useState(0);
  const fitKey = useRef(JSON.stringify([floor, null]));
  const select = useRef(onSelect);
  select.current = onSelect;
  const index = useMemo(() => new Set(elements.map(item => item.id)), [elements]);
  const colorMode = report ? requestedMode : "ifc";

  const statusById = useMemo(() => {
    const byElement = new Map<string, CheckStatus[]>();
    for (const row of report?.rows ?? []) byElement.set(row.element_id, [...byElement.get(row.element_id) ?? [], row.status]);
    return new Map([...byElement].map(([id, list]) => [id, worstStatus(list)!]));
  }, [report]);

  // Load the IFC once per model. The engine converts it in a worker and keeps it for this view.
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const request = new AbortController();
    let viewer: IfcViewerEngine | null = null;
    setLoad({ state: "loading" });
    (async () => {
      try {
        viewer = new IfcViewerEngine(node);
        engine.current = viewer;
        const response = await fetch(ifcUrl, { signal: request.signal });
        if (!response.ok) throw new Error(await responseError(response, "Das IFC konnte nicht geladen werden."));
        await viewer.load(await response.arrayBuffer(), filename);
        if (request.signal.aborted) return;
        setCounts(viewer.groupCounts());
        setLoad({ state: "ready" });
      } catch (error) {
        if (!request.signal.aborted) setLoad({ state: "error", message: error instanceof Error && error.message ? error.message : "Der IFC-Viewer konnte nicht gestartet werden. WebGL 2 wird benötigt." });
      }
    })();
    return () => { request.abort(); viewer?.dispose(); engine.current = null; };
  }, [ifcUrl, filename, attempt]);

  const ready = load.state === "ready";
  const floorIds = useMemo(() => floor === null ? null : elements.filter(item => item.storey === floor).map(item => item.id), [elements, floor]);
  const isolatedIds = useMemo(() => {
    if (!isolated || !selected) return null;
    return [selected, ...elements.filter(item => item.room_ids.includes(selected)).map(item => item.id)];
  }, [isolated, selected, elements]);

  useEffect(() => {
    const viewer = engine.current;
    if (!ready || !viewer) return;
    let stale = false;
    (async () => {
      const ids = isolatedIds ?? floorIds;
      const local = ids ? await viewer.localIds(ids) : null;
      if (stale) return;
      await viewer.show(groups, local ? new Set(local) : null);
      if (!stale && fitKey.current !== JSON.stringify([floor, isolatedIds])) {
        fitKey.current = JSON.stringify([floor, isolatedIds]);
        await viewer.fit(local ?? undefined);
      }
    })();
    return () => { stale = true; };
  }, [ready, groups, floor, floorIds, isolatedIds]);

  useEffect(() => {
    const viewer = engine.current;
    if (!ready || !viewer) return;
    (async () => {
      if (colorMode === "ifc" || !statusById.size) { await viewer.paint(null); return; }
      const ids = [...statusById.keys()];
      const local = await Promise.all(ids.map(async id => [(await viewer.localIds([id]))[0], statusColors[statusById.get(id)!]] as const));
      await viewer.paint(new Map(local.filter(([id]) => id !== undefined)));
    })();
  }, [ready, colorMode, statusById]);

  useEffect(() => {
    const viewer = engine.current;
    if (!ready || !viewer) return;
    void (async () => viewer.select(selected ? await viewer.localIds([selected]) : []))();
  }, [ready, selected]);

  useEffect(() => {
    const viewer = engine.current;
    if (!ready || !viewer) return;
    void (async () => viewer.section(section, floorIds ? await viewer.localIds(floorIds) : undefined))();
  }, [ready, section, floorIds]);

  useEffect(() => {
    firstPoint.current = null; setDistance(null); setPointCount(0);
    engine.current?.clearMeasure();
  }, [measuring]);

  // Clicks pick objects. A drag rotates the camera and selects nothing.
  useEffect(() => {
    const node = host.current;
    if (!ready || !node) return;
    let start: { x: number; y: number } | null = null;
    const down = (event: PointerEvent) => { start = { x: event.clientX, y: event.clientY }; };
    const up = async (event: PointerEvent) => {
      const viewer = engine.current;
      if (!viewer || !start || event.button !== 0 || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) return;
      const hit = await viewer.pick(event);
      if (!hit) return;
      if (measuring) {
        if (!firstPoint.current) { firstPoint.current = hit.point; viewer.measure(hit.point, null); setDistance(null); setPointCount(1); }
        else { setDistance(viewer.measure(firstPoint.current, hit.point)); firstPoint.current = null; setPointCount(0); }
        return;
      }
      const { guid, step } = await viewer.elementId(hit.localId);
      const id = guid && index.has(guid) ? guid : index.has(step) ? step : null;
      if (id) { setNotice(""); select.current(id); }
      else setNotice("Dieses Objekt hat keinen Eintrag in der Elementliste, zum Beispiel eine Öffnung.");
    };
    node.addEventListener("pointerdown", down);
    node.addEventListener("pointerup", up);
    return () => { node.removeEventListener("pointerdown", down); node.removeEventListener("pointerup", up); };
  }, [ready, measuring, index]);

  function toggleGroup(id: GroupId) {
    setGroups(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const fitSelected = async () => {
    const viewer = engine.current;
    if (viewer && selected) await viewer.fit(await viewer.localIds([selected]));
  };

  const groupControls = <div className="iv-bar" aria-label="Sichtbare Bauteilgruppen">
      {viewerGroups.map(group => <label key={group.id} className="iv-chip" data-empty={ready && !counts.get(group.id)}>
        <input type="checkbox" checked={groups.has(group.id)} disabled={!ready || !counts.get(group.id)} onChange={() => toggleGroup(group.id)} />
        {group.label}{ready && <span>{count(counts.get(group.id) ?? 0)}</span>}
      </label>)}
    </div>;

  return <div className="iv">
    {groupsHost ? createPortal(groupControls, groupsHost) : groupsHost === undefined && groupControls}
    <div className="iv-bar">
      <div className="iv-seg" role="group" aria-label="Farben">
        <button type="button" aria-pressed={colorMode === "ifc"} onClick={() => setColorMode("ifc")}>IFC-Farben</button>
        <button type="button" aria-pressed={colorMode === "status"} disabled={!report}
          title={report ? undefined : "Zuerst ein Regelwerk importieren"} onClick={() => setColorMode("status")}>Prüfstatus</button>
      </div>
      <button type="button" className="iv-tool" aria-pressed={section} disabled={!ready} onClick={() => setSection(!section)}
        title="Horizontaler Schnitt 1,2 m über dem Boden des gewählten Geschosses"><Scissors size={15} />Schnitt</button>
      <button type="button" className="iv-tool" aria-pressed={measuring} disabled={!ready} onClick={() => setMeasuring(!measuring)}><Ruler size={15} />Messen</button>
      <button type="button" className="iv-tool" aria-pressed={isolated} disabled={!ready || !selected} onClick={() => setIsolated(!isolated)}
        title="Nur das gewählte Objekt und die zugeordneten Bauteile zeigen"><ScanSearch size={15} />Isolieren</button>
    </div>
    <div className="iv-stage">
      <div ref={host} className="iv-canvas" role="img" aria-label="IFC-Modell in 3D"
        aria-description="Ziehen dreht, rechte Maustaste verschiebt, Mausrad zoomt. Klick wählt ein Bauteil." data-state={load.state} />
      {load.state === "loading" && <p className="iv-message" role="status"><LoaderCircle size={17} className="bc-spin" />IFC wird für die 3D-Ansicht aufbereitet …</p>}
      {load.state === "error" && <div className="iv-message" role="alert">{load.message}
        <button type="button" className="bc-link" onClick={() => setAttempt(attempt + 1)}>Erneut laden</button></div>}
      {ready && <div className="iv-camera" aria-label="3D-Kamera">
        <button type="button" aria-label="Verkleinern" title="Verkleinern" onClick={() => engine.current?.zoom(0.8)}><Minus size={16} /></button>
        <button type="button" aria-label="Vergrössern" title="Vergrössern" onClick={() => engine.current?.zoom(1.25)}><Plus size={16} /></button>
        {selected && <button type="button" aria-label="Gewähltes Objekt einpassen" title="Gewähltes Objekt einpassen" onClick={() => void fitSelected()}><Focus size={16} /></button>}
        <button type="button" aria-label="Modell einpassen" title="Modell einpassen" onClick={() => void engine.current?.fit()}><Maximize2 size={16} /></button>
      </div>}
      {ready && colorMode === "status" && <ul className="iv-legend" aria-label="Legende Prüfstatus">
        {Object.entries(statusColors).map(([status, color]) => <li key={status}><i style={{ background: color }} />{status}</li>)}
        <li><i className="iv-unchecked" />nicht geprüft</li>
      </ul>}
      {measuring && <p className="iv-readout" role="status">{distance === null ? (pointCount ? "Zweiten Punkt anklicken" : "Ersten Punkt auf einem Bauteil anklicken")
        : `Abstand ${distance.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`}</p>}
    </div>
    <p className="iv-caption">{notice || "Ziehen dreht · Rechte Maustaste verschiebt · Mausrad zoomt · Klick wählt ein Bauteil"}</p>
  </div>;
}
