import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { AlertCircle, CheckCheck, ChevronDown, Download, FileSpreadsheet, FileUp, FolderOpen, Layers3, LoaderCircle, X } from "lucide-react";
import ToolHeader from "../../toolbox/ToolHeader";
import type { ToolProps } from "../../toolbox/modules";
import { readJson, responseError } from "../../shared/http";
import { downloadBlob } from "../../shared/download";
import CheckGuide from "./CheckGuide";
import Findings from "./Findings";
import Inspector from "./Inspector";
import ModelBrowser, { type RoomView } from "./ModelBrowser";
import { floorLabel, groupBy, isRoom, quantity, type BuildingModel, type ModelElement, type Report } from "./model";
import "./bim-check.css";

const ROOT = "/api/bim-check";
const modelPath = (id: string) => `${ROOT}/models/${encodeURIComponent(id)}`;
type Tab = "Räume" | "Elemente" | "Prüfergebnisse";
const tabs: Tab[] = ["Räume", "Elemente", "Prüfergebnisse"];

function removeModel(id: string) {
  return fetch(modelPath(id), { method: "DELETE", keepalive: true }).catch(() => undefined);
}

export default function BimCheck({ onHome, onOpenTool }: ToolProps) {
  const [model, setModel] = useState<BuildingModel | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [guideName, setGuideName] = useState("");
  const [guideVersion, setGuideVersion] = useState(0);
  const [roomView, setRoomView] = useState<RoomView>("plan");
  const [objectQuery, setObjectQuery] = useState("");
  const [floor, setFloor] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Räume");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [colorMode, setColorMode] = useState<"ifc" | "status">("ifc");
  const [explored, setExplored] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);
  const modelInput = useRef<HTMLInputElement>(null);
  const guideInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const importingModel = useRef(false);
  const liveId = useRef<string | null>(null);
  const automaticFloor = useRef(false);
  const inspectorHost = useRef<HTMLDivElement>(null);
  const viewerHost = useRef<HTMLDivElement>(null);
  const helpMenu = useRef<HTMLDetailsElement>(null);
  const lastOpener = useRef<HTMLElement | SVGElement | null>(null);
  const index = useMemo(() => new Map(model?.elements.map(e => [e.id, e])), [model]);
  const roomElements = useMemo(() => {
    const groups = new Map<string, ModelElement[]>();
    for (const item of model?.elements ?? []) {
      for (const id of item.room_ids) {
        const group = groups.get(id);
        if (group) group.push(item); else groups.set(id, [item]);
      }
    }
    return groups;
  }, [model]);
  const findingsByElement = useMemo(() => groupBy(report?.rows ?? [], row => row.element_id), [report]);
  const active = selected ? index.get(selected) : undefined;
  const linked = useMemo(() => active ? (isRoom(active) ? roomElements.get(active.id) ?? []
    : active.room_ids.flatMap(id => index.get(id) ?? [])) : [], [active, index, roomElements]);

  useEffect(() => {
    mounted.current = true;
    function release() {
      if (liveId.current) void removeModel(liveId.current);
      liveId.current = null;
    }
    function onPageHide(event: PageTransitionEvent) {
      if (!event.persisted) release();
    }
    window.addEventListener("pagehide", onPageHide);
    return () => {
      mounted.current = false;
      // A model upload creates a session server-side. Release its ID once the import resolves.
      if (!importingModel.current) request.current?.abort();
      release();
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  async function upload(file: File | undefined, kind: "model" | "guide") {
    if (!file || request.current || (kind === "guide" && !model)) return;
    const isGuide = kind === "guide";
    if (!(isGuide ? /\.xlsx$/i : /\.(ifc|xlsx)$/i).test(file.name)) {
      setError(isGuide ? "Wähle eine Excel-Regeldatei (.xlsx)." : "Wähle ein IFC-Modell (.ifc) oder eine Nova-Objektliste (.xlsx).");
      return;
    }
    setBusy(isGuide ? "Regeln werden eingelesen und geprüft …" : "Modell wird eingelesen …"); setError("");
    const controller = new AbortController();
    request.current = controller; importingModel.current = !isGuide;
    const body = new FormData(); body.set("file", file);
    try {
      if (isGuide && model) {
        const response = await fetch(`${modelPath(model.id)}/guide`, { method: "POST", body, signal: controller.signal });
        const data = await readJson<Report>(response, "Die Excel-Regeldatei konnte nicht geprüft werden.");
        if (controller.signal.aborted) return;
        setReport(data); setReportSaved(false); setGuideVersion(previous => previous + 1); setGuideName(file.name); setTab("Prüfergebnisse"); setFloor(null); setSelected(null);
      } else {
        const response = await fetch(`${ROOT}/models`, { method: "POST", body, signal: controller.signal });
        const data = await readJson<BuildingModel>(response, "Das Modell konnte nicht eingelesen werden.");
        if (!mounted.current || controller.signal.aborted) { void removeModel(data.id); return; }
        const previous = liveId.current;
        liveId.current = data.id;
        setModel(data); setReport(null); setGuideName(""); setSelected(null); setObjectQuery(""); setExplored(false); setReportSaved(false); setColorMode("ifc");
        setTab(data.summary.rooms > 0 ? "Räume" : "Elemente");
        const floorWithPlan = data.elements.find(item => isRoom(item) && item.polygons.length > 0);
        automaticFloor.current = Boolean(floorWithPlan);
        setFloor(floorWithPlan?.storey ?? null);
        setRoomView(floorWithPlan ? "plan" : "list");
        if (previous && previous !== data.id) void removeModel(previous);
      }
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : "Die Datei konnte nicht eingelesen werden.");
    } finally {
      if (request.current === controller) { request.current = null; importingModel.current = false; if (mounted.current && !controller.signal.aborted) setBusy(""); }
    }
  }

  async function download(kind: "template" | "report") {
    if (request.current || (kind === "report" && !model)) return;
    const controller = new AbortController();
    request.current = controller; setBusy("Excel-Datei wird vorbereitet …"); setError("");
    try {
      const path = kind === "template" ? `${ROOT}/template.xlsx${model?.source === "NOVA" ? "?source=NOVA" : ""}` : `${modelPath(model!.id)}/report.xlsx`;
      const response = await fetch(path, { signal: controller.signal });
      if (!response.ok) throw new Error(await responseError(response, "Download nicht möglich."));
      const blob = await response.blob();
      if (!controller.signal.aborted) {
        downloadBlob(blob, kind === "template" ? "BIM-Guide-Vorlage.xlsx" : `${model!.filename.replace(/\.[^.]+$/, "")}-BIM-Pruefbericht.xlsx`);
        if (kind === "report") setReportSaved(true);
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Download nicht möglich.");
    } finally {
      if (request.current === controller) { request.current = null; if (!controller.signal.aborted) setBusy(""); }
    }
  }

  function closeModel() {
    if (request.current || !model) return;
    void removeModel(model.id); liveId.current = null;
    setModel(null); setReport(null); setSelected(null); setError(""); setGuideName(""); setDragOver(false);
  }
  function pick(id: string) {
    const opener = document.activeElement;
    if (!inspectorHost.current?.contains(opener) && (opener instanceof HTMLElement || opener instanceof SVGElement)) lastOpener.current = opener;
    setSelected(id); setExplored(true);
    if (window.matchMedia("(max-width: 760px)").matches) requestAnimationFrame(() => inspectorHost.current?.focus());
  }
  function closeInspector() {
    setSelected(null);
    if (lastOpener.current?.isConnected) lastOpener.current.focus();
  }
  function selectRelated(id: string) {
    const item = index.get(id);
    if (!item) return;
    automaticFloor.current = false;
    setTab(isRoom(item) ? "Räume" : "Elemente"); setFloor(item.storey); setObjectQuery(""); pick(id);
  }
  function chooseRoomView(view: RoomView) {
    if (view === "scene" || view === "viewer") {
      // A floor chosen only for the initial plan should not hide the rest of the building.
      if (automaticFloor.current && selected === null) setFloor(null);
      automaticFloor.current = false;
    } else if (view === "plan" && floor === null) {
      const firstRoom = active && isRoom(active) && active.polygons.length > 0
        ? active : model?.elements.find(item => isRoom(item) && item.polygons.length > 0);
      if (firstRoom) {
        setFloor(firstRoom.storey);
        automaticFloor.current = true;
      }
    }
    setRoomView(view);
  }
  function showSelectedRoomIn3D() {
    if (!active) return;
    automaticFloor.current = false;
    setTab("Räume");
    setFloor(active.storey);
    setObjectQuery("");
    setRoomView("scene");
    requestAnimationFrame(() => viewerHost.current?.querySelector<HTMLElement>('.bc-mode button[aria-pressed="true"]')?.focus());
  }
  function drop(event: DragEvent) {
    event.preventDefault(); setDragOver(false);
    if (event.dataTransfer.files.length !== 1) { setError("Bitte eine Datei pro Import auswählen."); return; }
    void upload(event.dataTransfer.files[0], "model");
  }
  const roomName = model?.source === "NOVA" ? "Raumbezug" : "Raum";
  const roomNames = model?.source === "NOVA" ? "Raumbezüge" : "Räume";
  const warnings = [...new Set([...(model?.warnings ?? []), ...(report?.warnings ?? [])])];
  const isIfc = model?.source === "IFC";
  function openViewer(colors: "ifc" | "status") {
    setTab("Räume"); setFloor(null); automaticFloor.current = false;
    setRoomView(isIfc ? "viewer" : "list"); setColorMode(colors); setExplored(true);
  }
  const guide = <CheckGuide steps={[
    { title: "Modell öffnen", done: Boolean(model),
      text: "Öffne das IFC aus Nova oder von der Architektur. Für die 3D-Ansicht braucht der Export Räume (IfcSpace), Wände, Decken, Türen und Fenster.",
      actions: [{ label: "Datei auswählen", primary: true, run: () => modelInput.current?.click() }] },
    { title: "Modell ansehen", done: Boolean(model) && (explored || Boolean(report)),
      text: isIfc ? "Klicke im IFC-Viewer einen Raum oder ein Bauteil an. Rechts stehen alle Angaben. Fehlen Räume oder Geschosse, lass zuerst den Export korrigieren."
        : "Wähle in der Liste einen Raumbezug oder ein Bauteil. Rechts stehen alle Angaben aus der Nova-Liste.",
      actions: [{ label: isIfc ? "IFC-Viewer öffnen" : "Liste öffnen", primary: true, run: () => openViewer("ifc") }, { label: "Weiter", run: () => setExplored(true) }] },
    { title: "Regeln laden", done: Boolean(report),
      text: "Lade die Excel-Vorlage. Trag pro Zeile ein, welche Angabe Pflicht ist und welche Werte erlaubt sind. Importiere danach die Datei.",
      actions: [{ label: "Regelwerk importieren", primary: true, run: () => guideInput.current?.click() }, { label: "Excel-Vorlage", run: () => void download("template") }] },
    { title: "Befunde klären", done: reportSaved,
      text: isIfc ? "Schalte im Viewer auf «Prüfstatus»: Rot fehlt, Orange ist leer oder abweichend, Grün ist in Ordnung. Lade den Bericht herunter und gib ihn der Architektur."
        : "Prüfe die Befunde unter «Prüfergebnisse». Lade den Bericht herunter und gib ihn der Architektur.",
      actions: [{ label: "Bericht herunterladen", primary: true, run: () => void download("report") },
        isIfc ? { label: "Prüfstatus im Viewer", run: () => openViewer("status") } : { label: "Prüfergebnisse", run: () => setTab("Prüfergebnisse") }] },
  ]} />;
  return <div className="bim-check">
    <ToolHeader title="BIM-Check & Raum-Viewer" currentToolId="bim-check" onHome={onHome} onOpenTool={onOpenTool} />
    <main className="bc-main">
      <input type="file" hidden accept=".ifc,.xlsx" ref={modelInput} aria-label="Modell oder Raumliste importieren"
        onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void upload(file, "model"); }} />
      <input type="file" hidden accept=".xlsx" ref={guideInput} aria-label="Excel-Regelwerk importieren"
        onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void upload(file, "guide"); }} />
      {busy && <div className="bc-notice" role="status"><LoaderCircle size={17} className="bc-spin" aria-hidden="true" />{busy}</div>}
      {error && <div className="bc-notice bc-error" role="alert"><AlertCircle size={17} aria-hidden="true" /><span>{error}</span><button type="button" className="bc-icon" aria-label="Fehlermeldung schliessen" onClick={() => setError("")}><X size={16} /></button></div>}
      {guide}
      {!model ? <section className="bc-intro">
        <div className="bc-intro-title"><h1>BIM-Check &amp; Raum-Viewer</h1>
          <p>IFC-Räume im Grundriss und in 3D ansehen. Modellattribute mit einem Excel-Regelwerk prüfen.</p></div>
        <div className="bc-start-grid">
          <div className="bc-drop" data-drag={dragOver} onDrop={drop}
            onDragOver={e => { e.preventDefault(); if (!busy) setDragOver(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false); }}>
            <span className="bc-file-icon"><Layers3 size={32} strokeWidth={1.5} /></span><h2>Modell öffnen</h2>
            <p>IFC-Modell oder Nova-Objektliste (.xlsx) hierherziehen.</p>
            <button type="button" className="btn bc-primary" disabled={Boolean(busy)} onClick={() => modelInput.current?.click()}><FolderOpen size={16} />Datei auswählen</button>
          </div>
          <section className="bc-guide-card"><FileSpreadsheet size={24} strokeWidth={1.6} /><h2>Excel-Regelwerk</h2>
            <p>Hinterlege IFC-Klasse, PSet, Attribut und Sollwert. Nach dem Modellimport kannst du die Regeln auf deine Daten anwenden.</p>
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void download("template")}><Download size={16} />Excel-Vorlage herunterladen</button>
          </section>
        </div></section> : <>
        <div className="bc-model-head"><div><h1>{model.filename}</h1>
          <p>{model.source === "NOVA" ? "Nova-Objektliste" : model.source} · {quantity(model.summary.rooms, roomName, roomNames)} · {model.source === "NOVA" ? quantity(model.summary.elements - model.summary.rooms, "Bauteil", "Bauteile") : quantity(model.summary.elements - model.summary.rooms, "weiteres Element", "weitere Elemente")}</p></div>
          <div className="bc-file-actions">
            <button type="button" className="btn bc-primary" disabled={Boolean(busy)} onClick={() => guideInput.current?.click()}><FileSpreadsheet size={16} />{report ? "Regelwerk wechseln" : "Regelwerk importieren"}</button>
            {report && <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void download("report")}><Download size={16} />Prüfbericht herunterladen</button>}
            <details className="bc-file-menu" ref={helpMenu} onKeyDown={e => { if (e.key === "Escape" && helpMenu.current) { helpMenu.current.open = false; helpMenu.current.querySelector("summary")?.focus(); } }}>
              <summary>Datei <ChevronDown size={14} /></summary><div>
                <button type="button" disabled={Boolean(busy)} onClick={() => { if (helpMenu.current) helpMenu.current.open = false; modelInput.current?.click(); }}><FileUp size={15} />Modell wechseln</button>
                <button type="button" disabled={Boolean(busy)} onClick={() => { if (helpMenu.current) helpMenu.current.open = false; void download("template"); }}><Download size={15} />Excel-Vorlage herunterladen</button>
                <button type="button" disabled={Boolean(busy)} onClick={closeModel}><X size={15} />Modell schliessen</button>
              </div></details>
          </div>
        </div>
        {warnings.length > 0 && <details className="bc-warnings"><summary>{quantity(warnings.length, "Hinweis", "Hinweise")} zum Import und zur Prüfung</summary><ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
        <div className="bc-controls"><nav className="bc-tabs" aria-label="Modellansichten">{tabs.map(item => <button key={item} type="button" aria-pressed={tab === item}
          onClick={() => { if (tab !== item) setObjectQuery(""); setTab(item); setSelected(null); }}>{item}</button>)}</nav>
          <label className="bc-floor">Geschoss<select value={floor === null ? "" : "floor:" + floor} onChange={e => { automaticFloor.current = false; setFloor(e.target.value ? e.target.value.slice(6) : null); setSelected(null); }}>
            <option value="">Alle Geschosse</option>{model.summary.storeys.map(s => <option key={s.name} value={"floor:" + s.name}>{floorLabel(s.name)} · {quantity(s.rooms, roomName, roomNames)}</option>)}
          </select></label></div>
        <div className="bc-grid" ref={viewerHost} data-inspector={Boolean(active)}>
          {tab === "Prüfergebnisse" ? report ? <div className="bc-result-area"><p className="bc-guide-name"><FileSpreadsheet size={15} />{guideName}</p>
            <Findings key={guideVersion} report={report} floor={floor} onSelect={pick} /></div>
            : <section className="bc-panel bc-empty-check"><CheckCheck size={24} /><h2>Modell prüfen</h2><p>Wähle eine Excel-Datei mit Prüfregeln für dieses Modell.</p>
              <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => guideInput.current?.click()}><FileSpreadsheet size={16} />Excel-Regelwerk auswählen</button></section>
            : <ModelBrowser key={model.id + tab} model={model} modelUrl={modelPath(model.id)} floor={floor} roomsOnly={tab === "Räume"}
              view={roomView} onView={chooseRoomView} query={objectQuery} onQuery={setObjectQuery} selected={selected} onSelect={pick} report={report} colorMode={colorMode} onColorMode={setColorMode} />}
          {active && <div ref={inspectorHost} className="bc-inspector-host" tabIndex={-1}><Inspector key={JSON.stringify([model.id, active.id])} modelUrl={modelPath(model.id)} element={active}
            onShowIn3D={model.source === "IFC" && isRoom(active) && (tab !== "Räume" || roomView !== "scene") ? showSelectedRoomIn3D : undefined}
            related={linked} findings={findingsByElement.get(active.id) ?? []} hasReport={Boolean(report)} onSelect={selectRelated} onClose={closeInspector} /></div>}
        </div>
      </>}
    </main>
  </div>;
}
