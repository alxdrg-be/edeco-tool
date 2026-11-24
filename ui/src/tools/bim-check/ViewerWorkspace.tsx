import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Box, Eye, FolderOpen, ListChecks, Maximize, Minimize, PanelLeft, PanelRight, Pin, PinOff, Search, X } from "lucide-react";
import { elementLabel, floorLabel, quantity, type BuildingModel, type Report } from "./model";
import Paging, { pageStart, PAGE_SIZE } from "./Paging";
import sampleUrl from "./assets/Pavillon-West.ifc?url";
import "./viewer-workspace.css";

const IfcViewer = lazy(() => import("./IfcViewer"));

type Props = {
  model: BuildingModel | null; modelUrl: string; selected: string | null; floor: string | null;
  report: Report | null; colorMode: "ifc" | "status"; onColorMode: (value: "ifc" | "status") => void;
  inspector: ReactNode; busy: boolean; onOpen: () => void; onFile: (file: File) => Promise<void>;
  onSelect: (id: string) => void; onFloor: (floor: string | null) => void;
  onCheck: () => void; onClose: () => void; onError: (message: string) => void;
};

export default function ViewerWorkspace({ model, modelUrl, floor, selected, inspector, report, colorMode,
  onColorMode, busy, onOpen, onFile, onError, onSelect, onFloor, onCheck, onClose }: Props) {
  const workspace = useRef<HTMLElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const initiallyNarrow = () => !window.matchMedia("(min-width: 800px)").matches;
  const [left, setLeft] = useState(() => !initiallyNarrow());
  const [right, setRight] = useState(true);
  const [pinned, setPinned] = useState(true);
  const [groupsHost, setGroupsHost] = useState<HTMLDivElement | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [sampleLoading, setSampleLoading] = useState(false);
  const modelBusy = busy || sampleLoading;
  const showLeft = left && !focusMode;
  const showRight = Boolean(selected && right && !focusMode);

  const toggleFull = useCallback(async () => {
    try {
      if (document.fullscreenElement === workspace.current) await document.exitFullscreen();
      else await workspace.current?.requestFullscreen();
    } catch { onError("Vollbild ist in diesem Fenster nicht verfügbar."); }
  }, [onError]);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === workspace.current);
    const shortcut = (e: KeyboardEvent) => {
      if (!model || e.defaultPrevented || e.altKey || document.querySelector('dialog[open],[aria-modal="true"]')) return;
      const editing = e.target instanceof HTMLElement &&
        (e.target.isContentEditable || Boolean(e.target.closest("input,textarea,select")));
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "f") {
        e.preventDefault(); setFocusMode(false); setLeft(true);
        requestAnimationFrame(() => search.current?.focus());
      } else if (!(editing || e.ctrlKey || e.metaKey || e.repeat)) {
        if (key === "f") { e.preventDefault(); void toggleFull(); }
        if (key === "h") { e.preventDefault(); setFocusMode(value => !value); }
      }
    };
    document.addEventListener("fullscreenchange", sync);
    window.addEventListener("keydown", shortcut);
    return () => { document.removeEventListener("fullscreenchange", sync); window.removeEventListener("keydown", shortcut); };
  }, [model, toggleFull]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return model?.elements.filter(e => (floor === null || floor === e.storey)
      && (!term || [e.name, e.number, e.id, e.ifc_class].some(v => v.toLowerCase().includes(term)))) ?? [];
  }, [model, floor, query]);
  const start = pageStart(page, filtered.length);

  async function sample() {
    setSampleLoading(true);
    try {
      const response = await fetch(sampleUrl);
      if (!response.ok) throw new Error("Beispiel nicht gefunden.");
      await onFile(new File([await response.blob()], "Pavillon-West.ifc"));
    } catch { onError("Das mitgelieferte Beispiel konnte nicht geöffnet werden."); }
    finally { setSampleLoading(false); }
  }
  function selectObject(id: string) {
    setRight(true); setFocusMode(false);
    if (initiallyNarrow()) setLeft(false);
    onSelect(id);
  }

  return <section ref={workspace} className="biv" aria-label="IFC-Arbeitsfläche" data-drag={dragOver}
    onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); if (!modelBusy) setDragOver(true); } }}
    onDragLeave={e => { if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDragOver(false); }}
    onDrop={e => { e.preventDefault(); setDragOver(false); if (modelBusy) return;
      if (e.dataTransfer.files.length !== 1) { onError("Bitte ein IFC-Modell pro Import auswählen."); return; }
      void onFile(e.dataTransfer.files[0]);
    }}>
    {!model ? <div className="biv-empty"><div className="bc-drop" data-drag={dragOver}>
      <span className="bc-file-icon"><Box size={30} /></span><h1>IFC-Modell öffnen</h1>
      <p>Ziehe eine IFC-Datei hierher, um Geschosse, Räume und Bauteile in 3D zu untersuchen.</p>
      <p className="biv-limit">.ifc · bis 256 MiB pro Datei</p>
      <div className="biv-actions"><button type="button" className="btn bc-primary" onClick={onOpen} disabled={modelBusy}><FolderOpen size={16} />IFC auswählen</button>
        <button type="button" className="btn" disabled={modelBusy} onClick={() => void sample()}>Beispiel öffnen</button></div>
    </div></div> : <>
      <div className="biv-toolbar"><div className="biv-title"><Box size={18} /><h1 title={model.filename}>{model.filename}</h1></div>
        <button type="button" className="btn" aria-expanded={showLeft} aria-controls="biv-tree"
          onClick={() => { setLeft(!showLeft); setFocusMode(false); }}><PanelLeft size={15} />Modellstruktur</button>
        {selected && <button type="button" className="btn" aria-expanded={showRight} aria-controls="biv-properties"
          onClick={() => { setRight(!showRight); setFocusMode(false); }}><PanelRight size={15} />Eigenschaften</button>}
        <div className="biv-actions"><button type="button" className="btn" onClick={onCheck} disabled={modelBusy}><ListChecks size={15} />Im BIM-Check prüfen</button>
          <details className="bc-file-menu"><summary>Datei</summary><div>
            <button type="button" disabled={modelBusy} onClick={onOpen}><FolderOpen size={15} />IFC wechseln</button>
            <button type="button" disabled={modelBusy} onClick={onClose}><X size={15} />Modell schliessen</button>
          </div></details>
          <button type="button" className="btn" aria-label={focusMode ? "Fenster einblenden (H)" : "Fenster ausblenden (H)"}
            aria-pressed={focusMode} title="Fenster ein-/ausblenden (H)" onClick={() => setFocusMode(!focusMode)}><Eye size={16} /></button>
          <button type="button" className="btn" aria-label={fullscreen ? "Vollbild verlassen (F)" : "Vollbild (F)"} title="Vollbild (F)" onClick={() => void toggleFull()}>{fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}</button>
        </div>
      </div>
      <div className="biv-body" data-left={showLeft} data-right={showRight} data-pinned={pinned}>
        <aside className="biv-tree" id="biv-tree" hidden={!showLeft} aria-label="Modellstruktur">
          <div className="biv-panel-head"><h2>Modellstruktur</h2><button type="button" className="bc-icon biv-pin" aria-label={pinned ? "Modellstruktur lösen" : "Modellstruktur anheften"}
            title={pinned ? "Als schwebendes Fenster anzeigen" : "Am Modellrand anheften"} onClick={() => setPinned(!pinned)}>{pinned ? <Pin size={15} /> : <PinOff size={15} />}</button>
            <button type="button" className="bc-icon" aria-label="Modellstruktur schliessen" onClick={() => setLeft(false)}><X size={15} /></button></div>
          <label className="biv-floor">Geschoss<select value={floor === null ? "" : "floor:" + floor} onChange={e => { setPage(0); onFloor(e.target.value ? e.target.value.slice(6) : null); }}>
            <option value="">Alle Geschosse</option>{model.summary.storeys.map(s => <option key={s.name} value={"floor:" + s.name}>{floorLabel(s.name)}</option>)}
          </select></label>
          <details className="biv-layers"><summary>Sichtbare Bauteilgruppen</summary><div ref={setGroupsHost} /></details>
          <div className="biv-search"><Search size={15}/><input ref={search} type="search" aria-label="Modell durchsuchen" placeholder="Objekte suchen …" value={query}
            onChange={e => { setPage(0); setQuery(e.target.value); }} /></div>
          <div className="biv-count">{quantity(filtered.length, "Objekt", "Objekte")}</div>
          <div className="biv-items">{filtered.slice(start, start + PAGE_SIZE).map(item => <button type="button" key={item.id} aria-pressed={selected === item.id} onClick={() => selectObject(item.id)}>
            <strong>{elementLabel(item)}</strong><small>{item.ifc_class} · {floorLabel(item.storey)}</small>
          </button>)}</div>
          <Paging page={page} total={filtered.length} onChange={setPage} />
        </aside>
        <div className="biv-stage"><Suspense fallback={<p role="status">3D-Viewer wird geladen …</p>}>
          <IfcViewer ifcUrl={modelUrl + "/model.ifc"} filename={model.filename} elements={model.elements}
            groupsHost={groupsHost} floor={floor} selected={selected} onSelect={selectObject} report={report} colorMode={colorMode} onColorMode={onColorMode} />
        </Suspense></div>
        {selected && <aside id="biv-properties" className="biv-properties" aria-label="Objekteigenschaften" hidden={!showRight}>{inspector}</aside>}
      </div>
      <div className="biv-foot"><span>{quantity(model.summary.rooms, "Raum", "Räume")} · {quantity(model.summary.storeys.filter(s => s.name).length, "Geschoss", "Geschosse")}</span>
        {model.warnings.length > 0 && <details><summary>{quantity(model.warnings.length, "Importhinweis", "Importhinweise")}</summary>
          <ul>{model.warnings.map(w => <li key={w}>{w}</li>)}</ul></details>}
      </div>
    </>}
  </section>;
}
