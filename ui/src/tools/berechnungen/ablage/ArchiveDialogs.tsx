import { useEffect, useRef, useState } from "react";
import { useProjectHub } from "../../projektzentrale/projectHubState";
import { InfoDrawer } from "../LabUI";
import { archiveRequest, type ArchivePayload, type ArchiveRecord, type ArchiveSettings, type ArchiveState } from "./api";
import "./archive.css";

export function ArchiveSettingsDialog({ state, onClose, onSaved }: { state: ArchiveState; onClose: () => void; onSaved: (settings: ArchiveSettings) => void }) {
  const [root, setRoot] = useState(state.settings.root), [subfolder, setSubfolder] = useState(state.settings.subfolder);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <InfoDrawer busy={busy} onClose={onClose} help={{ title: "Ablage-Einstellungen", content: <form className="archive-form" onSubmit={event => { event.preventDefault(); setBusy(true); setError(""); void archiveRequest<ArchiveSettings>("/settings", state, "POST", { root, subfolder, revision: state.settings.revision }).then(onSaved).catch(e => setError((e as Error).message)).finally(() => setBusy(false)); }}>
    <label>Serverordner<input aria-label="Serverordner" required value={root} maxLength={1500} disabled={busy || state.settings.managed} placeholder="\\Server\Planung oder X:\Planung" onChange={event => setRoot(event.target.value)} /></label>
    <label>Unterordner<input aria-label="Ablage-Unterordner" required maxLength={180} value={subfolder} disabled={busy || state.settings.managed} placeholder="Berechnungen" onChange={event => setSubfolder(event.target.value)} /></label>
    <p>Der Serverordner muss erreichbar sein. Die Unterordner werden automatisch erstellt. Derselbe Pfad muss auf allen Toolhub-PCs eingerichtet sein; Zugriff erhalten Personen mit den entsprechenden Serverberechtigungen.</p>
    <pre className="archive-tree">{root || "Serverordner"}/{subfolder || "Berechnungen"}/{"\n"}  blitzschutz/{"\n"}    P-1498–…/{"\n"}      Rechenstand-ID/{"\n"}        berechnung.json{"\n"}        Notizen/</pre>
    {state.settings.managed ? <p>Der Pfad wird zentral über EDECO_CALCULATIONS_ARCHIVE_ROOT vorgegeben.</p> : <button className="lab-open" disabled={busy}>{busy ? "Verbindung wird geprüft …" : "Verbindung prüfen & speichern"}</button>}
    {error && <p role="alert" className="lab-error">{error}</p>}
  </form> }} />;
}

export function ArchiveSaveDialog({ payload, onClose }: { payload: ArchivePayload; onClose: () => void }) {
  const { hub } = useProjectHub();
  const [state, setState] = useState<ArchiveState | null>(null), [error, setError] = useState("");
  const [number, setNumber] = useState(payload.project?.number ?? ""), [name, setName] = useState(payload.project?.name ?? "");
  const [title, setTitle] = useState(""), [notes, setNotes] = useState(payload.notes ?? ""), [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false), [result, setResult] = useState<ArchiveRecord | null>(null);
  const requestId = useRef(crypto.randomUUID()), snapshot = useRef(structuredClone(payload.document));
  const edited = useRef({ title: false, author: false });
  useEffect(() => {
    let alive = true;
    void archiveRequest<ArchiveState>("/state").then(value => {
      if (!alive) return;
      setState(value);
      if (!edited.current.author) setAuthor(value.settings.author);
      if (!edited.current.title) setTitle(value.tools[payload.toolId] ?? "Berechnung");
    }).catch(e => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, [payload.toolId]);
  function dirty(field?: "title" | "author") {
    if (field) edited.current[field] = true;
    requestId.current = crypto.randomUUID(); setResult(null);
  }
  return <InfoDrawer busy={busy} onClose={onClose} help={{ title: "Projektbezogen speichern", content: <form className="archive-form" onSubmit={event => {
    event.preventDefault(); if (!state || busy) return; setBusy(true); setError("");
    const local = hub?.projects.find(project => project.number === number);
    void archiveRequest<ArchiveRecord>("/records", state, "POST", { request_id: requestId.current, config_revision: state.settings.revision,
      project: { id: local?.id ?? payload.project?.id ?? "", number, name }, tool_id: payload.toolId, title, author, notes, source: "edeco", document: snapshot.current }).then(setResult).catch(e => setError((e as Error).message)).finally(() => setBusy(false));
  }}>
    {state && !state.settings.configured && <p className="lab-error">Zuerst unter Berechnungen → Gemeinsame Ablage → Ablage-Einstellungen den Serverordner einrichten.</p>}
    <label>Projekt auswählen<select aria-label="Ablage-Projekt auswählen" disabled={busy} value="" onChange={event => { const project = hub?.projects.find(item => item.id === event.target.value); if (project) { setNumber(project.number); setName(project.name); dirty(); } }}><option value="">Projekt übernehmen …</option>{hub?.projects.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.number} · {p.name}</option>)}</select></label>
    <div className="archive-two"><label>Projektnummer<input required aria-label="Ablage-Projektnummer" value={number} maxLength={80} disabled={busy} onChange={event => { setNumber(event.target.value); dirty(); }} /></label><label>Projektname<input required aria-label="Ablage-Projektname" value={name} maxLength={180} disabled={busy} onChange={event => { setName(event.target.value); dirty(); }} /></label></div>
    <label>Bezeichnung<input required aria-label="Rechenstand-Bezeichnung" value={title} maxLength={180} disabled={busy} onChange={event => { setTitle(event.target.value); dirty("title"); }} /></label>
    <label>Bearbeiter<input required aria-label="Rechenstand-Bearbeiter" value={author} maxLength={120} disabled={busy} onChange={event => { setAuthor(event.target.value); dirty("author"); }} /></label>
    <label>Notizen<textarea aria-label="Rechenstand-Notizen" rows={4} maxLength={10000} value={notes} disabled={busy} onChange={event => { setNotes(event.target.value); dirty(); }} /></label>
    <p>Eingaben, Ergebnis und Grundlagen werden als neuer Stand gespeichert. Bestehende Stände bleiben erhalten; weitere Notizen können in der gemeinsamen Ablage ergänzt werden.</p>
    <button className="lab-open" disabled={!state?.settings.configured || busy || Boolean(result)}>{busy ? "Wird gespeichert …" : result ? "Stand gespeichert" : "Als neuen Stand speichern"}</button>
    {result && <p role="status">Gemeinsam gespeichert: <span className="archive-path">{result.path}</span></p>}{error && <p role="alert" className="lab-error">{error}</p>}
  </form> }} />;
}
