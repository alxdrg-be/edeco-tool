import { useEffect, useMemo, useRef, useState } from "react";
import { Focus, Info, LoaderCircle, Maximize2, Minus, Plus } from "lucide-react";
import { readJson } from "../../shared/http";
import { quantity } from "./model";
import { type RoomScene } from "./sceneGeometry";
import { SceneViewport } from "./sceneViewport";
import "./scene-viewer.css";

interface Props {
  sceneUrl: string;
  floor: string | null;
  visibleIds: ReadonlySet<string>;
  selected: string | null;
  onSelect: (id: string) => void;
  roomLabels?: ReadonlyMap<string, string>;
}

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; scene: RoomScene };

export default function RoomScene3D({ sceneUrl, ...view }: Props) {
  const [result, setResult] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const request = new AbortController();
    setResult({ state: "loading" });
    fetch(sceneUrl, { signal: request.signal })
      .then(response => readJson<RoomScene>(response, "Die 3D-Geometrie konnte nicht geladen werden."))
      .then(scene => { if (!request.signal.aborted) setResult({ state: "ready", scene }); })
      .catch(error => {
        if (!request.signal.aborted) setResult({ state: "error", message: error instanceof Error ? error.message : "Die 3D-Geometrie konnte nicht geladen werden." });
      });
    return () => request.abort();
  }, [attempt, sceneUrl]);

  if (result.state === "loading") return <p className="bc-scene-message" role="status"><LoaderCircle size={17} className="bc-spin" /> IFC-Geometrie wird geladen …</p>;
  if (result.state === "error") return <div className="bc-scene-message" role="alert">{result.message}
    <button type="button" className="bc-link" onClick={() => setAttempt(attempt + 1)}>Erneut laden</button></div>;
  return <div className="bc-scene">
    {result.scene.meshes.length > 0 ? <ModelCanvas scene={result.scene} {...view} /> :
      <p className="bc-scene-message" role="status">Das IFC enthält keine darstellbaren Raumkörper oder Gebäudebauteile in 3D. Verfügbare Konturen und Attribute findest du im Grundriss und in der Liste.</p>}
    {result.scene.warnings.length > 0 && <details className="bc-scene-warnings"><summary>Hinweise zur 3D-Geometrie ({result.scene.warnings.length})</summary>
      <ul>{result.scene.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
  </div>;
}

function ModelCanvas({ scene, floor, selected, visibleIds, onSelect, roomLabels }: Omit<Props, "sceneUrl"> & { scene: RoomScene }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<SceneViewport | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [showStructure, setShowStructure] = useState(true);
  const [opacity, setOpacity] = useState(12);
  const [failure, setFailure] = useState("");
  const [retry, setRetry] = useState(0);
  const counts = useMemo(() => {
    let rooms = 0, structures = 0, selectedHasMesh = false;
    for (const mesh of scene.meshes) {
      if (mesh.id === selected) selectedHasMesh = true;
      if (floor !== null && mesh.storey !== floor) continue;
      if (mesh.kind === "structure") structures++;
      else if (visibleIds.has(mesh.id)) rooms++;
    }
    return { rooms, structures, selectedHasMesh };
  }, [scene, floor, selected, visibleIds]);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    let engine: SceneViewport | null = null;
    const lost = (event: Event) => {
      event.preventDefault();
      setFailure("Die Verbindung zur Grafikdarstellung wurde unterbrochen.");
    };
    node.addEventListener("webglcontextlost", lost);
    try {
      engine = new SceneViewport(node, id => select.current(id));
      engine.load(scene);
      viewport.current = engine;
    } catch {
      setFailure("Die 3D-Darstellung benötigt WebGL 2. Grundriss, Raumliste und Inspektor stehen weiterhin zur Verfügung.");
    }
    return () => {
      node.removeEventListener("webglcontextlost", lost);
      engine?.dispose();
      viewport.current = null;
    };
  }, [scene, retry, failure]);
  useEffect(() => {
    viewport.current?.show(floor, visibleIds, selected, showStructure ? opacity : 0);
  }, [scene, floor, selected, visibleIds, opacity, showStructure, retry, failure]);

  if (failure) return <div className="bc-scene-message" role="status"><Info size={16} /><span>{failure}</span>
    <button type="button" className="bc-link" onClick={() => { setFailure(""); setRetry(value => value + 1); }}>3D erneut öffnen</button></div>;

  const structureVisible = showStructure && counts.structures > 0;
  const selectedLabel = selected ? roomLabels?.get(selected) : undefined;
  return <>
    <div className="bc-scene-tools">
      <span className="bc-scene-key"><i />{quantity(counts.rooms, "Raumkörper", "Raumkörper")}</span>
      {counts.structures > 0 && <><label className="bc-scene-structure"><input type="checkbox" checked={showStructure} onChange={e => setShowStructure(e.target.checked)} />Gebäudestruktur anzeigen</label>
        {showStructure && <label className="bc-scene-opacity">Deckkraft<input aria-label="Deckkraft der Gebäudestruktur"
          type="range" min={1} max={60} value={opacity} onChange={e => setOpacity(Number(e.target.value))} /><output>{opacity} %</output></label>}</>}
    </div>
    <div className="bc-scene-stage">
      <canvas ref={canvas} tabIndex={0} role="img" aria-label="3D-Modell mit IFC-Räumen und Gebäudestruktur"
        aria-description="Ziehen dreht, die rechte Maustaste verschiebt, das Mausrad zoomt. Pfeiltasten drehen das Modell. Räume lassen sich auch in der Liste auswählen." />
      <div className="bc-scene-camera" aria-label="3D-Kamera">
        <button type="button" aria-label="3D-Ansicht verkleinern" title="Verkleinern" onClick={() => viewport.current?.zoom(0.8)}><Minus size={16} /></button>
        <button type="button" aria-label="3D-Ansicht vergrössern" title="Vergrössern" onClick={() => viewport.current?.zoom(1.25)}><Plus size={16} /></button>
        {selected && counts.selectedHasMesh && visibleIds.has(selected) && <button type="button" aria-label="Gewählten Raum einpassen" title="Gewählten Raum einpassen" onClick={() => viewport.current?.fit(selected)}><Focus size={16} /></button>}
        <button type="button" aria-label="3D-Modell einpassen" title={floor === null ? "Gebäude einpassen" : "Geschoss einpassen"} onClick={() => viewport.current?.fit()}><Maximize2 size={16} /></button>
      </div>
      {selectedLabel && counts.selectedHasMesh && visibleIds.has(selected!) && <div className="bc-scene-selection" aria-label="Gewählter Raum"><i />{selectedLabel}</div>}
      {counts.rooms === 0 && !structureVisible && <p className="bc-scene-empty" role="status">Für diese Auswahl ist keine sichtbare 3D-Geometrie vorhanden.</p>}
    </div>
    <div className="bc-scene-caption">Ziehen dreht · Rechte Maustaste verschiebt · Mausrad zoomt</div>
    {selectedLabel && !counts.selectedHasMesh && <p className="bc-scene-message" role="status">Für «{selectedLabel}» ist kein darstellbarer IFC-Raumkörper verfügbar.</p>}
  </>;
}
