import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ChevronDown, FolderOpen, Info } from "lucide-react";
import { useDialogFocus } from "../../useDialogFocus";
import { request, type DocumentInfo } from "./api";
import SetupGuide from "./SetupGuide";

interface FolderState { path: string; recursive: boolean; linked_files: number; last_sync?: string | null }
interface SyncResult { folder: FolderState; documents: DocumentInfo[]; added: number; unchanged: number; removed: number; errors: string[] }
const EMPTY: FolderState = { path: "", recursive: true, linked_files: 0 };

export default function FolderSettings({ sessionKey, onDocuments, onClose }: {
  sessionKey: string; onDocuments: (documents: DocumentInfo[]) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathId = useId();
  const [folder, setFolder] = useState<FolderState | null>(null);
  const [path, setPath] = useState("");
  const [recursive, setRecursive] = useState(true);
  const [busy, setBusy] = useState("load");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  useDialogFocus(ref, onClose, Boolean(busy));

  useEffect(() => {
    let alive = true;
    void request<FolderState>("/folder", sessionKey).then(data => {
      if (alive) { setFolder(data); setPath(data.path); setRecursive(data.recursive); }
    }).catch((e: Error) => { if (alive) { setFolder(EMPTY); setError(e.message); } })
      .finally(() => { if (alive) setBusy(""); });
    return () => { alive = false; };
  }, [sessionKey]);

  function clearFeedback() { setError(""); setNotice(""); setWarnings([]); }
  async function chooseFolder() {
    setBusy("browse"); clearFeedback();
    try {
      const response = await fetch("/api/dialog/folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start: path }) });
      if (!response.ok) throw new Error("Die Ordnerauswahl konnte nicht geöffnet werden. Du kannst den Pfad direkt einfügen.");
      const data = await response.json() as { available: boolean; path: string | null };
      if (!data.available) setNotice("Im Browser bitte den vollständigen Ordnerpfad aus dem Explorer einfügen.");
      else if (data.path) setPath(data.path);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  async function update(save: boolean) {
    setBusy("sync"); clearFeedback();
    try {
      if (save) {
        const connected = await request<FolderState>("/folder", sessionKey, { method: "POST", body: JSON.stringify({ path, recursive }) });
        setFolder(connected); setPath(connected.path);
      }
      const result = await request<SyncResult>("/folder/sync", sessionKey, { method: "POST" });
      setFolder(result.folder); onDocuments(result.documents); setWarnings(result.errors);
      setNotice(`${result.added} neu/aktualisiert · ${result.unchanged} unverändert · ${result.removed} alte lokale Kopien entfernt.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  async function disconnect() {
    setBusy("disconnect"); clearFeedback();
    try {
      const cleared = await request<FolderState>("/folder", sessionKey, { method: "POST", body: JSON.stringify({ path: "", recursive: true }) });
      setFolder(cleared); setPath(""); setRecursive(true);
      setNotice("Ordner getrennt. Die vorhandenen lokalen Dokumentkopien bleiben erhalten.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void update(true); }
  return <div className="modal-back"><div ref={ref} className="modal doc-ai-settings doc-folder-settings" role="dialog" aria-modal="true" aria-labelledby="doc-folder-title" tabIndex={-1}>
    <h2 id="doc-folder-title">Dokumentordner verbinden</h2>
    <p>Unterlagen von diesem PC oder einer Firmenfreigabe durchsuchen.</p>
    <form onSubmit={submit}>
      <label htmlFor={pathId}>Ordnerpfad</label><div className="doc-folder-path"><input id={pathId} required value={path} maxLength={2000} autoComplete="off" disabled={!folder || Boolean(busy)} placeholder={"C:\\Unterlagen oder \\\\SERVER\\Unterlagen"} onChange={event => { setPath(event.target.value); clearFeedback(); }} /><button type="button" className="btn" disabled={!folder || Boolean(busy)} onClick={() => void chooseFolder()}><FolderOpen size={16} />Auswählen</button></div>
      <label className="doc-checkbox"><input type="checkbox" checked={recursive} disabled={!folder || Boolean(busy)} onChange={event => { setRecursive(event.target.checked); clearFeedback(); }} />Unterordner einbeziehen</label>
      {folder?.last_sync && <p className="doc-help">Zuletzt aktualisiert: {new Date(folder.last_sync).toLocaleString("de-CH")} · {folder.linked_files} verknüpfte Dateien</p>}
      <details className="doc-ai-guide doc-data-guide"><summary><Info size={16} aria-hidden="true" /><span>Was wird gespeichert und geändert?</span><ChevronDown size={17} aria-hidden="true" /></summary><div>
        <p>Die Quelldateien werden nur gelesen. Die Suche verwendet lokale Kopien und einen eigenen Index auf diesem PC. Neue und geänderte Dateien werden erst bei einer ausdrücklich gestarteten Aktualisierung übernommen.</p>
        <p>Aus dem Ordner entfernte oder ersetzte Dateien verschwinden dann aus dem verwalteten lokalen Index. Zusätzlich von dir importierte Kopien bleiben erhalten. „Verbindung trennen“ beendet die Zuordnung und behält alle vorhandenen lokalen Dokumente.</p>
        <p>PDF, TXT und Markdown: höchstens 200 Dokumente, 250 MB insgesamt, 100 MB pro Datei und 5000 Ordnereinträge. Verknüpfungen und Junctions werden nicht verfolgt. Für Firmenfreigaben gelten deine Windows-Leserechte.</p>
      </div></details>
      {error && <p role="alert" className="doc-error">{error}</p>}
      {notice && <p role="status" className="doc-notice">{notice}</p>}
      {warnings.length > 0 && <details className="doc-ai-guide doc-folder-warnings"><summary><span>{warnings.length} Hinweise zur Aktualisierung</span><ChevronDown size={17} aria-hidden="true" /></summary><div><ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div></details>}
      <div className="doc-actions"><button className="btn primary" disabled={!folder || Boolean(busy) || !path.trim()}>{busy === "sync" ? "Dokumente werden eingelesen …" : "Verbinden und einlesen"}</button>
        <button type="button" className="btn" disabled={!folder?.path || Boolean(busy) || path !== folder.path || recursive !== folder.recursive} onClick={() => void update(false)}>Jetzt aktualisieren</button>
        <button type="button" className="btn" disabled={Boolean(busy) || (!folder?.path && !error)} onClick={() => void disconnect()}>Verbindung trennen</button></div>
    </form>
    <SetupGuide />
    <div className="doc-actions doc-folder-close"><button type="button" className="btn" disabled={Boolean(busy)} onClick={onClose}>Schliessen</button></div>
  </div></div>;
}
