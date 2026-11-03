import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import {
  ArrowLeft, ArrowLeftRight, ArrowUpRight, Award, BadgeCheck, BookOpen, CaseSensitive, Clock, CodeXml,
  Columns2, CopyPlus, Crop, Droplets, Eraser, FileArchive, FileCog, FileMinus, FilePenLine,
  FileSearch, ImageOff, ImagePlus, Images, Info, Layers, LayoutGrid, ListOrdered, ListTree,
  LockKeyhole, LockOpen, Maximize, MessageSquare, MessageSquareOff, Minimize, Palette,
  PanelsTopLeft, Paperclip, RotateCw, ScanLine, ScanText, Scissors, ScrollText, Search,
  Settings, Shield, ShieldCheck, ShieldOff, Signature, Sparkles, Square, Stamp, X,
  TextCursorInput, Type, Workflow, Wrench, type LucideIcon,
} from "lucide-react";
import ToolHeader from "../../toolbox/ToolHeader";
import type { ToolProps } from "../../toolbox/modules";
import { useDialogFocus } from "../../useDialogFocus";
import PdfCropEditor from "./PdfCropEditor";
import PageWorkbench from "./PageWorkbench";
import PdfTask from "./PdfTask";
import { NATIVE_PAGE_TOOLS, NATIVE_TASKS, isImageSource, isPdfSource, type NativeTaskId } from "./nativeTools";
import { PDF_CATEGORIES, PDF_TOOLS, filterPdfTools, pdfToolAvailability, recordRecentPdfTool,
  type EndpointCapabilities, type PdfTool } from "./toolCatalog";
import "./pdf-workshop.css";

interface State {
  service_url: string; managed: boolean; local: boolean; title: string; accent: string; session_key: string;
  workflows: { id: string; title: string }[];
}
interface Health { ready: boolean; version: string; message: string }
interface PdfWindow extends Window { edecoPDF?: {
  hasWork: () => boolean; isReady: () => boolean;
  activateTool: (id: string) => Promise<void>; openHome: () => Promise<void>; openSettings: () => boolean;
  importFiles: (files: readonly File[]) => Promise<void>;
} }
const API = "/api/tools/pdf-werkstatt";
const RECENT_KEY = "edeco.pdf.recent-tools";
const ICONS: Record<string, LucideIcon> = {
  ArrowLeftRight, Award, BadgeCheck, BookOpen, CaseSensitive, Clock, CodeXml, Columns2,
  CopyPlus, Crop, Droplets, Eraser, FileArchive, FileCog, FileMinus, FilePenLine, FileSearch,
  ImageOff, ImagePlus, Images, Layers, LayoutGrid, ListOrdered, ListTree, LockKeyhole,
  LockOpen, Maximize, MessageSquare, MessageSquareOff, Minimize, Palette, PanelsTopLeft,
  Paperclip, RotateCw, ScanLine, ScanText, Scissors, ScrollText, Shield, ShieldCheck,
  ShieldOff, Signature, Sparkles, Square, Stamp, TextCursorInput, Type, Workflow, Wrench,
};

async function action<T>(path: string, sessionKey: string, body: object | FormData = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Edeco-Pdf": sessionKey };
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(API + path, { method: "POST", headers,
    body: body instanceof FormData ? body : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Die Aktion konnte nicht abgeschlossen werden.");
  return data as T;
}

function LeaveDialog({ onClose, onLeave }: { onClose: () => void; onLeave: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose);
  return <div className="modal-back"><div ref={ref} className="modal" role="alertdialog" aria-modal="true" aria-labelledby="pdf-leave-title" tabIndex={-1}>
    <h2 id="pdf-leave-title">Ergebnisse gespeichert?</h2>
    <p>Bitte benötigte Ergebnisse vor dem Verlassen herunterladen. Beim Wechsel zwischen den PDF-Werkzeugen bleiben die geöffneten Dateien erhalten.</p>
    <div className="pdf-actions"><button className="btn primary" onClick={onClose}>Hier bleiben</button>
      <button className="btn" onClick={onLeave}>Werkzeug wechseln</button></div>
  </div></div>;
}

function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && PDF_TOOLS.some(tool => tool.id === id)).slice(0, 8) : [];
  } catch { return []; }
}

export default function PdfWorkshop({ onHome, onOpenTool }: ToolProps) {
  const [state, setState] = useState<State | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [capabilities, setCapabilities] = useState<EndpointCapabilities | null>(null);
  const [url, setUrl] = useState("");
  const [settings, setSettings] = useState(false);
  const [info, setInfo] = useState(false);
  const [workflows, setWorkflows] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [recent, setRecent] = useState(readRecent);
  const [view, setView] = useState<"catalog" | "stirling" | "crop" | "pages" | "task" | "convert">("catalog");
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingTool, setPendingTool] = useState<string | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [settingsWanted, setSettingsWanted] = useState(false);
  const [cropOpened, setCropOpened] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [cropInitialFile, setCropInitialFile] = useState<File>();
  const [cropRevision, setCropRevision] = useState(0);
  const importingFiles = useRef<File[] | null>(null);
  const cropDirty = useRef(false);
  const nativeDirty = useRef(false);
  const nativeFiles = useRef<File[]>([]);
  const [nativeWorking, setNativeWorking] = useState(false);
  const [pagesOpened, setPagesOpened] = useState(false);
  const [pageIncoming, setPageIncoming] = useState<File[]>();
  const [taskIncoming, setTaskIncoming] = useState<Partial<Record<NativeTaskId, File[]>>>({});
  const taskFiles = useRef<Partial<Record<NativeTaskId, File[]>>>({});
  const [openedTasks, setOpenedTasks] = useState<NativeTaskId[]>([]);
  const [nativeTask, setNativeTask] = useState<NativeTaskId | null>(null);
  const markNativeDirty = useCallback(() => { nativeDirty.current = true; }, []);
  const rememberNativeFiles = useCallback((files: File[]) => { nativeFiles.current = files; }, []);
  const frame = useRef<HTMLIFrameElement>(null);
  const tools = filterPdfTools(query, category, recent);
  const title = PDF_TOOLS.find(tool => tool.id === selected)?.title;

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await fetch(API + "/state");
        if (!response.ok) throw new Error("Die PDF-Verbindung konnte nicht geladen werden.");
        const data = await response.json() as State;
        if (!alive) return;
        setState(data); setUrl(data.service_url); setBusy("check");
        const checked = await action<Health>("/check", data.session_key);
        if (alive) setHealth(checked);
      } catch (e) { if (alive) setError((e as Error).message); }
      finally { if (alive) setBusy(""); }
    }
    void load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!state?.local || health?.ready) return;
    const timer = window.setInterval(() => {
      void action<Health>("/check", state.session_key).then(setHealth).catch(e => setError(String(e)));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [state, health?.ready]);

  useEffect(() => {
    if (!health?.ready) return;
    let alive = true;
    fetch("/tools/pdf-werkstatt/api/v1/config/endpoints-availability").then(async response => {
      if (!response.ok) throw new Error();
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
      const valid = Object.fromEntries(Object.entries(data).filter(([, value]) => value && typeof value === "object" && typeof value.enabled === "boolean"));
      if (alive) setCapabilities(valid);
    }).catch(() => { if (alive) setCapabilities(null); });
    return () => { alive = false; };
  }, [health?.ready, revision]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "edeco-pdf-state") setBridgeReady(event.data.ready === true);
      if (event.data?.type === "edeco-pdf-native-tool" && event.data.tool === "crop" && view === "stirling") {
        const files: unknown = event.data.files;
        if (Array.isArray(files) && files.length === 1 && files[0] instanceof File) {
          setCropInitialFile(files[0]); setNotice("");
        } else {
          // Do not silently edit an older document when Core has several active files.
          setCropInitialFile(undefined); setCropRevision(value => value + 1);
          setNotice("Bitte die gewünschte PDF-Datei zum Zuschneiden auswählen.");
        }
        setSelected("crop"); setCropOpened(true); setView("crop"); setPendingTool(null); setSettingsWanted(false);
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [view]);

  useEffect(() => {
    if (!pendingTool || !bridgeReady || view !== "stirling") return;
    const child = frame.current?.contentWindow as PdfWindow | null;
    if (!child?.edecoPDF) return;
    let alive = true;
    const opening = pendingTool === "__home__" ? child.edecoPDF.openHome() : child.edecoPDF.activateTool(pendingTool);
    void opening.then(() => {
      if (alive) { setPendingTool(null); setNotice(""); }
    }).catch((e: Error) => { if (alive) { setPendingTool(null); setError(e.message); } });
    return () => { alive = false; };
  }, [pendingTool, bridgeReady, view]);

  useEffect(() => {
    if (!pendingFiles.length || !bridgeReady || pendingTool || view !== "stirling" || importingFiles.current === pendingFiles) return;
    const child = frame.current?.contentWindow as PdfWindow | null;
    if (!child?.edecoPDF?.importFiles) return;
    importingFiles.current = pendingFiles;
    let alive = true;
    void child.edecoPDF.importFiles(pendingFiles).then(() => {
      // A palette visit during the handoff must not upload the same batch twice.
      setPendingFiles(old => old === pendingFiles ? [] : old);
      if (alive) setNotice("");
    }).catch((e: Error) => {
      importingFiles.current = null;
      if (alive) setError(e.message);
    });
    return () => { alive = false; };
  }, [pendingFiles, pendingTool, bridgeReady, view]);

  useEffect(() => {
    if (!settingsWanted || !bridgeReady || view !== "stirling") return;
    const child = frame.current?.contentWindow as PdfWindow | null;
    if (child?.edecoPDF?.openSettings()) setSettingsWanted(false);
  }, [settingsWanted, bridgeReady, view]);

  async function check(save: boolean) {
    if (!state || busy) return;
    const changed = save && url.replace(/\/$/, "") !== state.service_url;
    const child = frame.current?.contentWindow as PdfWindow | null;
    if (changed && (pendingFiles.length || cropDirty.current || nativeDirty.current || child?.edecoPDF?.hasWork())) {
      setError("Bitte die PDF-Ergebnisse speichern und die Werkstatt neu öffnen, bevor du den Dienst wechselst."); return;
    }
    setBusy("check"); setError("");
    try {
      if (save) {
        const result = await action<State & Health>("/connection", state.session_key, { service_url: url });
        setState({ ...state, ...result }); setHealth(result);
      } else setHealth(await action<Health>("/check", state.session_key));
      if (changed || !health?.ready) { setBridgeReady(false); setCapabilities(null); setRevision(value => value + 1); }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  function requestLeave(callback: () => void) {
    if (busy === "workflow" || nativeWorking) return;
    const child = frame.current?.contentWindow as PdfWindow | null;
    if (pendingFiles.length || cropDirty.current || nativeDirty.current || child?.edecoPDF?.hasWork()) setLeave(() => callback);
    else callback();
  }

  function remember(id: string) {
    setRecent(old => {
      const value = recordRecentPdfTool(old, id);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(value)); } catch { /* Storage may be unavailable in private mode. */ }
      return value;
    });
  }

  function openTool(tool: PdfTool) {
    const availability = pdfToolAvailability(tool, Boolean(state?.local), Boolean(health?.ready), capabilities);
    if (!state || !availability.enabled) { setNotice(availability.reason); return; }
    if (tool.id === "crop" && pendingFiles.length > 1) { setError("Zum Zuschneiden bitte eine PDF-Datei bereithalten. Entferne die übrigen Dateien aus der Auswahl."); return; }
    setSelected(tool.id); setSettingsWanted(false); setError(""); setNotice(""); remember(tool.id);
    if (tool.id === "crop") {
      if (pendingFiles[0]) { setCropInitialFile(pendingFiles[0]); setPendingFiles([]); }
      setCropOpened(true); setView("crop"); setPendingTool(null);
    }
    else if (NATIVE_PAGE_TOOLS.has(tool.id)) {
      if (pendingFiles.length) { setPageIncoming(pendingFiles); setPendingFiles([]); }
      setPagesOpened(true); setView("pages"); setPendingTool(null);
    } else if (tool.id === "split" || tool.id === "scalePages") {
      openNativeTask(tool.id === "split" ? "split" : "resize");
    } else if (tool.id === "convert") { setView("convert"); setPendingTool(null); }
    else { setView("stirling"); setPendingTool(tool.id); }
  }

  function openNativeTask(id: NativeTaskId) {
    const candidates = pendingFiles.length ? pendingFiles : taskFiles.current[id]?.length ? taskFiles.current[id]! : nativeFiles.current;
    const incoming = candidates.filter(id === "images-to-pdf" ? isImageSource : isPdfSource);
    if (id !== "images-to-pdf" && incoming.length > 1) { setError("Bitte eine PDF-Datei für dieses Werkzeug auswählen. Die übrigen Dateien bleiben bereitgelegt."); return; }
    if (incoming.length && (pendingFiles.length || !openedTasks.includes(id))) setTaskIncoming(previous => ({ ...previous, [id]: incoming }));
    if (pendingFiles.length && incoming.length === pendingFiles.length) setPendingFiles([]);
    setOpenedTasks(previous => previous.includes(id) ? previous : [...previous, id]);
    setNativeTask(id); setView("task"); setPendingTool(null); setError("");
  }

  function openExtendedTool() {
    if (nativeWorking) return;
    if (nativeFiles.current.length) setPendingFiles([...nativeFiles.current]);
    setNotice("Die Originaldateien werden im erweiterten Werkzeug geöffnet. Die Seitenanordnung bleibt im integrierten Arbeitsbereich erhalten.");
    setView("stirling"); setPendingTool(selected || "__home__");
  }

  function allFunctions() { setSelected(null); setView("stirling"); setPendingTool("__home__"); setSettingsWanted(false); setError(""); }
  function toolSettings() { setSelected("__settings__"); setPendingTool(null); setView("stirling"); setSettingsWanted(true); }

  function receiveDrop(event: DragEvent<HTMLElement>) {
    if (event.defaultPrevented || !event.dataTransfer.files.length) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    const imageInput = view === "task" && nativeTask === "images-to-pdf";
    if (view !== "stirling" && files.some(file => imageInput ? !isImageSource(file) : !isPdfSource(file))) {
      setError(imageInput ? "Bitte PNG- oder JPEG-Bilder ablegen." : "Bitte PDF-Dateien ablegen und anschliessend ein Werkzeug wählen."); return;
    }
    if (view === "crop") {
      if (files.length > 1) { setError("Zum Zuschneiden bitte eine einzelne PDF-Datei ablegen."); return; }
      setCropInitialFile(files[0]); setError(""); setNotice(""); return;
    }
    if (view === "pages") { setPageIncoming(files); setError(""); setNotice(""); return; }
    if (view === "task") {
      if (nativeTask !== "images-to-pdf" && files.length > 1) { setError("Bitte eine PDF-Datei für dieses Werkzeug ablegen."); return; }
      if (nativeTask) setTaskIncoming(previous => ({ ...previous, [nativeTask]: files }));
      setError(""); setNotice(""); return;
    }
    setPendingFiles(files); setError(""); setNotice("");
  }

  async function workflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!state || busy) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    const profile = body.get("profile"); body.delete("profile");
    setBusy("workflow"); setError(""); setNotice("");
    try {
      const result = await action<{ path: string }>(`/workflows/${encodeURIComponent(String(profile))}`, state.session_key, body);
      setNotice(`Gespeichert: ${result.path}`); form.reset();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  return <div className="pdf-workshop" onDragOver={event => {
    if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }
  }} onDrop={receiveDrop}>
    <ToolHeader title="PDF-Werkstatt" onHome={() => requestLeave(onHome)} onOpenTool={onOpenTool ? id => requestLeave(() => onOpenTool(id)) : undefined} disabled={busy === "workflow" || nativeWorking}>
      {health?.ready && <span className="pdf-service-badge">{state?.local ? "Offline bereit · auf diesem Computer" : `Stirling-PDF ${health.version} · interner Dienst`}</span>}
      {Boolean(state?.workflows.length) && <button className="btn" onClick={() => setWorkflows(!workflows)}>Firmenabläufe</button>}
      {!state?.local && <button className="btn" onClick={() => setSettings(!settings)}>Verbindung</button>}
      <button className="btn" onClick={toolSettings} disabled={!health?.ready}><Settings size={16} /> Einstellungen</button>
      <button className="btn pdf-info-button" onClick={() => setInfo(!info)}><Info size={16} /> Info / Lizenzen</button>
    </ToolHeader>
    {info && <section className="pdf-connection pdf-license-panel"><button className="btn" onClick={() => setInfo(false)}>Info schliessen</button><iframe className="pdf-stirling-frame" title="Info / Lizenzen" src={API + "/licenses"} /></section>}
    {!state?.local && (settings || (state && !health?.ready && (view === "catalog" || view === "stirling"))) && <section className="pdf-connection" aria-label="PDF-Verbindung">
      <div><h2>PDF-Dienst verbinden</h2><p className="pdf-muted">Dein lokaler oder firmeneigener Stirling-Dienst verarbeitet die PDFs.</p></div>
      <form onSubmit={event => { event.preventDefault(); void check(!state?.managed); }}>
        <label>Adresse des Firmen-PDF-Dienstes<input type="url" required value={url} disabled={!state || state.managed || Boolean(busy)}
          placeholder="http://PDF-SERVER:8088" onChange={event => setUrl(event.target.value)} /></label>
        {state?.managed && <span className="pdf-muted">Die Adresse wird von der Firma vorgegeben.</span>}
        <div className="pdf-actions"><button className="btn primary" disabled={!state || Boolean(busy)}>{busy === "check" ? "Verbindung wird geprüft …" : state?.managed ? "Verbindung prüfen" : "Speichern und verbinden"}</button>
          {health?.ready && <button type="button" className="btn" onClick={() => setSettings(false)}>Schliessen</button>}</div>
      </form>
      {health && <p role="status" className={health.ready ? "pdf-connected" : "pdf-muted"}>{health.message}</p>}
    </section>}
    {workflows && state && <section className="pdf-workflows" aria-label="Firmenabläufe">
      <h2>Nach Firmenvorgabe ablegen</h2><p>Fertiges PDF wählen und mit dem eingerichteten Ablauf im vorgesehenen Ordner ablegen.</p>
      <form onSubmit={workflow}><label>Ablauf<select name="profile" required>{state.workflows.map(profile => <option key={profile.id} value={profile.id}>{profile.title}</option>)}</select></label>
        <label>Fertiges PDF<input name="file" type="file" accept=".pdf" required disabled={Boolean(busy)} /></label>
        <button className="btn primary" disabled={Boolean(busy)}>{busy === "workflow" ? "Wird abgelegt …" : "Firmenablauf ausführen"}</button></form>
    </section>}
    {(error || notice) && <div className="pdf-message" role={error ? "alert" : "status"}>{error || notice}<button className="btn" onClick={() => { setError(""); setNotice(""); }} aria-label="Meldung schliessen">×</button></div>}
    {view === "catalog" && <main className="pdf-tool-home">
      <div className="pdf-tool-intro"><div><span className="pdf-eyebrow">PDF-WERKSTATT</span><h1>Was möchtest du mit deinem PDF tun?</h1><p>Werkzeug wählen. Datei öffnen. Fertig.</p></div>
        {health?.ready && <button className="btn" onClick={allFunctions}>Alle Funktionen <ArrowUpRight size={15} /></button>}</div>
      {pendingFiles.length > 0 && <section className="pdf-pending-files" aria-label="Bereitgelegte PDF-Dateien"><p role="status">{pendingFiles.length === 1 ? "Eine PDF ist bereit. Wähle jetzt ein Werkzeug." : `${pendingFiles.length} PDFs sind bereit. Wähle jetzt ein Werkzeug.`}</p>
        <ul>{pendingFiles.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><button className="btn" aria-label={`${file.name} aus der Auswahl entfernen`} onClick={() => setPendingFiles(old => old.filter((_, at) => at !== index))}><X size={14} /></button></li>)}</ul>
      </section>}
      <div className="pdf-tool-filter"><label className="pdf-tool-search"><Search size={18} /><input type="search" placeholder="Werkzeug suchen …" aria-label="PDF-Werkzeug suchen" value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div className="pdf-tool-tabs" role="group" aria-label="PDF-Werkzeugkategorien">{PDF_CATEGORIES.map(item => <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.title}</button>)}
          <button aria-pressed={category === "recent"} onClick={() => setCategory("recent")}><Clock size={13} /> Zuletzt verwendet</button></div></div>
      {!health?.ready && <div className="pdf-runtime-status" role="status"><span>{health?.message || "Der PDF-Dienst wird gestartet."} Seitenwerkzeuge, Zuschneiden und Bild-/Textausgabe sind bereits verfügbar.</span><button className="btn" disabled={!state || Boolean(busy)} onClick={() => void check(false)}>Status prüfen</button></div>}
      <div className="pdf-tool-grid">{tools.map(tool => {
        const availability = pdfToolAvailability(tool, Boolean(state?.local), Boolean(health?.ready), capabilities);
        const Icon = ICONS[tool.icon] || FilePenLine;
        const enabled = Boolean(state) && availability.enabled;
        return <button key={tool.id} className={`pdf-tool-tile${enabled ? "" : " is-unavailable"}`} data-pdf-tool={tool.id} aria-disabled={!enabled} onClick={() => openTool(tool)} title={availability.reason || tool.description}>
          <span className="pdf-tool-icon"><Icon size={25} strokeWidth={1.6} /></span><span className="pdf-tool-label"><strong>{tool.title}</strong><span>{tool.description}</span>
            {!enabled && <small>{availability.checking ? "Dienst wird gestartet" : state?.local && tool.offlineUnavailable ? "Im Firmenserver möglich" : tool.unavailable ? "In Core nicht verfügbar" : "Nicht verfügbar"}</small>}
            {enabled && availability.partial && <small>Teilweise verfügbar</small>}</span>{enabled && <ArrowUpRight className="pdf-tool-arrow" size={16} />}
        </button>;
      })}</div>
      {!tools.length && <p className="pdf-empty">{category === "recent" && !query ? "Hier erscheinen deine zuletzt gewählten PDF-Werkzeuge." : "Kein passendes Werkzeug. Probiere einen anderen Suchbegriff."}</p>}
      <details className="pdf-tool-availability"><summary><Info size={15} /> Welche Funktionen sind enthalten?</summary><p>Alle 57 Werkzeuge der Stirling-Core-Registry 3.2.2 sind hier aufgeführt. Deaktivierte Funktionen bleiben sichtbar. Die vier Entwickler- und Dokumentationslinks sowie zusätzliche Werkzeuge deines Servers findest du unter „Alle Funktionen“.</p>
        {state?.local && <p>Offline werden Office-, HTML-/Webseiten-, E-Book-, Video- und KI-Konvertierung nicht mitgeliefert. OCR verwendet Tesseract ohne die erweiterten OCRmyPDF-Optionen. Zusätzliche Serverfunktionen hängen von eurer Einrichtung ab.</p>}
        <p>Für die lokale PDF-Werkstatt brauchst du kein Benutzerkonto. Das Zahnrad öffnet die PDF-Einstellungen. Bei einem Firmenserver bleibt dessen Anmeldung bestehen.</p></details>
    </main>}
    {view === "stirling" && <div className="pdf-editor-heading"><button className="btn" onClick={() => setView("catalog")}><ArrowLeft size={16} /> Werkzeugauswahl</button><strong>{title || (selected === "__settings__" ? "PDF-Einstellungen" : "Alle PDF-Funktionen")}</strong>{(pendingTool || settingsWanted) && <span role="status">{settingsWanted ? "Einstellungen werden geöffnet …" : "Werkzeug wird geöffnet …"}</span>}</div>}
    {health?.ready && <div className="pdf-embedded-workspace" hidden={view !== "stirling"}><iframe ref={frame} key={revision} className="pdf-stirling-frame" title="Stirling-PDF · edeco PDF-Werkstatt" src="/tools/pdf-werkstatt/" onLoad={() => setBridgeReady(Boolean((frame.current?.contentWindow as PdfWindow | null)?.edecoPDF?.isReady()))} /></div>}
    {(view === "pages" || view === "task" || view === "convert") && <div className="pdf-editor-heading"><button className="btn" disabled={nativeWorking} onClick={() => setView("catalog")}><ArrowLeft size={16} /> Werkzeugauswahl</button><strong>{view === "task" && nativeTask ? NATIVE_TASKS[nativeTask].title : title}</strong><span className="pdf-native-badge">Auf diesem Computer</span>{health?.ready && <button className="btn" disabled={nativeWorking} onClick={openExtendedTool}>Erweiterte Funktionen</button>}</div>}
    {pagesOpened && state && <div className="pdf-native-workspace" hidden={view !== "pages"}><PageWorkbench sessionKey={state.session_key} incomingFiles={pageIncoming} onDirty={markNativeDirty} onWorking={setNativeWorking} onFilesChange={rememberNativeFiles} /></div>}
    {state && openedTasks.map(id => <div key={id} className="pdf-native-workspace" hidden={view !== "task" || nativeTask !== id}><PdfTask tool={id} sessionKey={state.session_key} incomingFiles={taskIncoming[id]} onDirty={markNativeDirty} onWorking={setNativeWorking} onFilesChange={files => { taskFiles.current[id] = files; if (nativeTask === id) nativeFiles.current = files; }} /></div>)}
    {view === "convert" && <main className="pdf-native-conversions"><h1>Was möchtest du umwandeln?</h1><div className="pdf-tool-grid">{(["pdf-to-images", "pdf-to-text", "images-to-pdf"] as const).map(id => <button key={id} className="pdf-tool-tile" onClick={() => openNativeTask(id)}><span className="pdf-tool-label"><strong>{NATIVE_TASKS[id].title}</strong><span>{NATIVE_TASKS[id].description}</span></span><ArrowUpRight size={17} /></button>)}<button className="pdf-tool-tile" disabled={!health?.ready} onClick={openExtendedTool}><span className="pdf-tool-label"><strong>Weitere Formate</strong><span>Office, Webseiten und zusätzliche Formate deines PDF-Dienstes.</span></span></button></div></main>}
    {cropOpened && state && <div className="pdf-native-crop" hidden={view !== "crop"}><PdfCropEditor key={cropRevision} sessionKey={state.session_key} initialFile={cropInitialFile} onBack={() => setView("catalog")} onDirtyChange={dirty => { cropDirty.current = dirty; }} /></div>}
    {leave && <LeaveDialog onClose={() => setLeave(null)} onLeave={() => { const callback = leave; setLeave(null); callback(); }} />}
  </div>;
}
