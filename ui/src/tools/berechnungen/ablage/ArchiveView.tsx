import { useEffect, useState } from "react";
import { FolderOpen, RefreshCw, Settings, Upload } from "lucide-react";
import type { ToolProps } from "../../../toolbox/modules";
import { useProjectHub } from "../../projektzentrale/projectHubState";
import { downloadBlob } from "../../../shared/download";
import { InfoDrawer, LabShell, type Help } from "../LabUI";
import { WORKBENCH_CATALOG } from "../workbench/catalog";
import { ArchiveSettingsDialog } from "./ArchiveDialogs";
import { ARCHIVE_API, archiveDate, archiveRequest, prepareRestore, type ArchiveMeta, type ArchiveRecord, type ArchiveSettings, type ArchiveState } from "./api";
import "./archive.css";

export default function ArchiveView(props: ToolProps) {
  const { hub, active } = useProjectHub();
  const [state, setState] = useState<ArchiveState | null>(null), [items, setItems] = useState<ArchiveMeta[]>([]), [record, setRecord] = useState<ArchiveRecord | null>(null);
  const [help, setHelp] = useState<Help | null>(null), [settingsOpen, setSettingsOpen] = useState(false), [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState(""), [tool, setTool] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false), [comment, setComment] = useState(""), [author, setAuthor] = useState("");
  const [number, setNumber] = useState(""), [name, setName] = useState(""), [title, setTitle] = useState(""), [importNotes, setImportNotes] = useState("");
  const [importTool, setImportTool] = useState<string>("premium-pkw"), [file, setFile] = useState<File | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  async function load(given?: ArchiveState) {
    setBusy(true); setError("");
    try {
      const current = given ?? await archiveRequest<ArchiveState>("/state"); setState(current); setAuthor(old => old || current.settings.author);
      const result = await archiveRequest<{ items: ArchiveMeta[]; unreadable: number; truncated: boolean }>("/records", current);
      setItems(result.items); setNotice(result.truncated ? "Die Ablage enthält mehr als 3000 Stände. Es wird nur eine Teilmenge angezeigt." : result.unreadable ? `${result.unreadable} Einträge konnten nicht gelesen werden.` : "");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (active) { setNumber(active.number); setName(active.name); } }, [active?.id]);
  async function select(item: ArchiveMeta) {
    if (!state) return; setBusy(true); setError("");
    try { setRecord(await archiveRequest<ArchiveRecord>(`/record?${new URLSearchParams({ key: item.key })}`, state)); setComment(""); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function openFolder(key?: string) {
    if (!state) return; setBusy(true); setError("");
    try { await archiveRequest("/open-folder", state, "POST", key ? { key } : {}); setNotice("Ordner wurde an den Dateimanager übergeben."); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function note() {
    if (!state || !record || !comment.trim()) return; setBusy(true); setError("");
    try { setRecord(await archiveRequest<ArchiveRecord>("/notes", state, "POST", { key: record.key, text: comment, author, config_revision: state.settings.revision })); setComment(""); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function restore() {
    if (!record) return;
    try { prepareRestore(record); props.onOpenTool?.(record.tool_id); }
    catch { setError("Browser-Zwischenspeicher nicht verfügbar. Rechenstand als JSON herunterladen."); }
  }
  async function downloadOriginal() {
    if (!record?.attachment || !state) return; setBusy(true); setError("");
    try {
      const response = await fetch(ARCHIVE_API + `/attachment?${new URLSearchParams({ key: record.key })}`, { headers: { "X-Edeco-Projects": state.session_key } });
      if (!response.ok) throw new Error("Originalexport konnte nicht geladen werden. Bitte Prüfsumme und Verbindung prüfen.");
      downloadBlob(await response.blob(), record.attachment);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const visible = items.filter(item => (!tool || item.tool_id === tool) && `${item.title} ${item.project.number} ${item.project.name} ${item.author}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const projects = Array.from(new Map([...(hub?.projects ?? []), ...items.map(item => item.project)].map(p => [p.number, p])).values());
  return <LabShell {...props} title="Berechnungsablage" subtitle="Gemeinsame Rechenstände · Projekte · Notizen" reviewLabel="Gemeinsame Ablage" help={help} setHelp={setHelp}>
    <div className="archive-toolbar"><button className="lab-open" disabled={!state || busy} onClick={() => setSettingsOpen(true)}><Settings size={16} />Ablage-Einstellungen</button><button className="lab-open" disabled={busy} onClick={() => void load()}><RefreshCw size={16} />Aktualisieren</button><button className="lab-open" disabled={!state?.settings.configured || busy} onClick={() => { setImportOpen(true); setRequestId(crypto.randomUUID()); }}><Upload size={16} />Berechnung importieren</button><button className="lab-open" disabled={!state?.settings.configured || busy} onClick={() => void openFolder()}><FolderOpen size={16} />Serverordner öffnen</button></div>
    {state && <p className="archive-path">{state.settings.configured ? `${state.settings.root}/${state.settings.subfolder}` : "Noch kein Serverordner eingerichtet."}</p>}
    {error && <p role="alert" className="lab-error">{error}</p>}{notice && <p role="status" className="lab-note">{notice}</p>}{busy && <p role="status" className="lab-note">Ablage wird gelesen oder geschrieben …</p>}
    <div className="archive-filters"><input aria-label="Rechenstände suchen" value={query} placeholder="Projektnummer, Bezeichnung, Bearbeiter …" onChange={event => setQuery(event.target.value)} /><select aria-label="Berechnungstyp filtern" value={tool} onChange={event => setTool(event.target.value)}><option value="">Alle Berechnungen</option>{Object.entries(state?.tools ?? {}).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
    <div className="archive-layout"><aside aria-label="Gemeinsame Rechenstände" className="archive-list">{!visible.length && <p className="lab-note">Keine Rechenstände gefunden. Speichere in einem Rechner oder importiere einen Berechnungsexport.</p>}{visible.map(item => <button className={`archive-item ${record?.key === item.key ? "is-selected" : ""}`} key={item.key} disabled={busy} onClick={() => void select(item)}><span>{item.project.number} · {item.tool_name}</span><strong>{item.title}</strong><small>{archiveDate(item.created_at)} · {item.author}</small><small>{item.source === "edeco" ? "edeco-Rechenstand" : "Importierter Export"}</small></button>)}</aside>
      <section className="archive-detail" aria-label="Rechenstand-Details">{record ? <><div className="archive-detail-head"><div><span className="lab-eyebrow">{record.project.number} · {record.tool_name}</span><h2>{record.title}</h2></div><span className="lab-tag">{record.source === "edeco" ? "GESICHERT" : "IMPORTIERT"}</span></div><p>{record.project.name} · {record.author} · {archiveDate(record.created_at)}</p><p className="archive-notes">{record.notes || "Keine ursprünglichen Notizen."}</p>
        <div className="archive-toolbar"><button className="lab-open" onClick={() => downloadBlob(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }), "Rechenstand.json")}>JSON herunterladen</button>{record.attachment && <button className="lab-open" disabled={busy} onClick={() => void downloadOriginal()}>Originalexport herunterladen</button>}{record.source === "edeco" && ["blitzschutz", "kabelberechnung", "emobilitaet", "netzplaner", ...WORKBENCH_CATALOG.map(item => item[0])].includes(record.tool_id) && <button className="lab-open" onClick={restore}>Eingaben laden & neu berechnen</button>}<button className="lab-open" disabled={busy} onClick={() => void openFolder(record.key)}>Ordner öffnen</button></div>
        <p className="archive-path">{record.path}</p><details><summary>Eingaben & gespeichertes Ergebnis</summary><pre className="archive-json">{JSON.stringify(record.document, null, 2)}</pre></details><h3>Notizen & Verlauf</h3>
        {record.comments.map((item, index) => <div className="archive-comment" key={index}><small>{archiveDate(item.created_at)} · {item.author}</small><p>{item.text}</p></div>)}
        <form className="archive-form" onSubmit={event => { event.preventDefault(); void note(); }}><label>Bearbeiter<input aria-label="Notiz-Bearbeiter" required value={author} maxLength={120} onChange={event => setAuthor(event.target.value)} /></label><label>Weitere Notiz<textarea aria-label="Weitere Notiz" required maxLength={10000} rows={3} value={comment} onChange={event => setComment(event.target.value)} /></label><button className="lab-open" disabled={busy || !comment.trim()}>Notiz ergänzen</button></form>
      </> : <><h2>Rechenstände gemeinsam nutzen</h2><p className="lab-note">Links einen Stand wählen. Eingaben, Ergebnis, Originalexport und Notizen sind für alle mit Zugriff auf denselben Serverordner verfügbar.</p><p className="lab-note">Die Ablage ersetzt keine fachliche Freigabe. Beim Laden von Eingaben wird mit der aktuellen edeco-Version neu gerechnet; der gespeicherte Stand bleibt erhalten.</p></>}</section></div>
    {settingsOpen && state && <ArchiveSettingsDialog state={state} onClose={() => setSettingsOpen(false)} onSaved={(settings: ArchiveSettings) => { const next = { ...state, settings }; setState(next); setSettingsOpen(false); setRecord(null); void load(next); }} />}
    {importOpen && state && <InfoDrawer busy={busy} onClose={() => setImportOpen(false)} help={{ title: "Berechnung gemeinsam ablegen", content: <form className="archive-form" onSubmit={event => {
      event.preventDefault(); if (!file || busy) return; setBusy(true); setError("");
      const data = new FormData(); data.append("file", file); data.append("metadata", JSON.stringify({ request_id: requestId, config_revision: state.settings.revision, project: { id: projects.find(p => p.number === number)?.id ?? "", number, name }, tool_id: importTool, title, author, notes: importNotes, source: "premium-export", document: {} }));
      void archiveRequest<ArchiveRecord>("/import", state, "POST", data).then(async result => { setRecord(result); setImportOpen(false); await load(); }).catch(e => setError((e as Error).message)).finally(() => setBusy(false));
    }}>
      <label>Berechnung<select aria-label="Import-Berechnung" value={importTool} onChange={event => { setImportTool(event.target.value); setRequestId(crypto.randomUUID()); }}>{Object.entries(state.tools).map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
      <label>Projekt übernehmen<select aria-label="Import-Projekt übernehmen" value="" onChange={event => { const p = projects.find(p => p.number === event.target.value); if (p) { setNumber(p.number); setName(p.name); setRequestId(crypto.randomUUID()); } }}><option value="">Projekt wählen …</option>{projects.map(p => <option key={p.number} value={p.number}>{p.number} · {p.name}</option>)}</select></label>
      <label>Projektnummer<input aria-label="Import-Projektnummer" required value={number} maxLength={80} onChange={event => { setNumber(event.target.value); setRequestId(crypto.randomUUID()); }} /></label><label>Projektname<input aria-label="Import-Projektname" required value={name} maxLength={180} onChange={event => { setName(event.target.value); setRequestId(crypto.randomUUID()); }} /></label>
      <label>Bezeichnung<input aria-label="Import-Bezeichnung" required value={title} maxLength={180} onChange={event => { setTitle(event.target.value); setRequestId(crypto.randomUUID()); }} /></label><label>Bearbeiter<input required value={author} maxLength={120} onChange={event => { setAuthor(event.target.value); setRequestId(crypto.randomUUID()); }} /></label>
      <label>Exportdatei<input aria-label="Berechnungsexportdatei" type="file" required accept=".pdf,.json" onChange={event => { setFile(event.target.files?.[0] ?? null); setRequestId(crypto.randomUUID()); }} /></label><label>Notizen<textarea aria-label="Import-Notizen" rows={3} maxLength={10000} value={importNotes} onChange={event => { setImportNotes(event.target.value); setRequestId(crypto.randomUUID()); }} /></label>
      <p>PDF bis 25 MB oder JSON bis 2 MB. Der Originalexport bleibt erhalten. Der Import übernimmt die Datei; er führt keine Neuberechnung durch.</p><button className="lab-open" disabled={busy || !file}>Export gemeinsam ablegen</button>{error && <p role="alert" className="lab-error">{error}</p>}
    </form> }} />}
  </LabShell>;
}
