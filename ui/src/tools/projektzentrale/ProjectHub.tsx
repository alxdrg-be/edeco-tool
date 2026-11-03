import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ToolProps } from "../../toolbox/modules";
import ToolHeader from "../../toolbox/ToolHeader";
import { useDialogFocus } from "../../useDialogFocus";
import { dataOf, EMPTY_PROJECT, projectAction, useProjectHub, type Project, type ProjectData } from "./projectHubState";
import "./project-hub.css";
import DeliveryHistory from "../planlieferung/DeliveryHistory";
import "../dateien-umbenennen/file-rename.css";

function LeaveDialog({ busy, error, onCancel, onDiscard, onSave }: { busy: boolean; error: string; onCancel: () => void; onDiscard: () => void; onSave: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onCancel, busy);
  return <div className="modal-back"><div ref={ref} className="modal" role="alertdialog" aria-modal="true" aria-labelledby="project-leave-title" tabIndex={-1}>
    <h2 id="project-leave-title">Projektänderungen speichern?</h2><p>Es gibt ungespeicherte Angaben. Du kannst sie speichern oder verwerfen.</p>
    {error && <p role="alert" className="project-error">{error}</p>}
    <div className="hub-project-actions"><button className="btn primary" disabled={busy} onClick={onSave}>Speichern und weiter</button><button className="btn" disabled={busy} onClick={onDiscard}>Verwerfen und weiter</button><button className="btn" disabled={busy} onClick={onCancel}>Hier bleiben</button></div>
  </div></div>;
}

export default function ProjectHub({ onHome, onOpenTool }: ToolProps) {
  const { hub, active, error: loadError, refresh } = useProjectHub();
  const [saved, setSaved] = useState<Project | null>(null);
  const [draft, setDraft] = useState<ProjectData | null>(null);
  const [query, setQuery] = useState("");
  const [archive, setArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<(() => void) | null>(null);
  const initialized = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const dirty = Boolean(draft && (!saved || JSON.stringify(draft) !== JSON.stringify(dataOf(saved))));
  function choose(project: Project | null) {
    setSaved(project); setDraft(project ? structuredClone(dataOf(project)) : structuredClone(EMPTY_PROJECT)); setError(""); setNotice("");
  }
  useEffect(() => {
    if (!hub || initialized.current) return;
    initialized.current = true;
    const project = hub.projects.find(item => item.id === hub.active_id) ?? hub.projects.find(item => !item.archived);
    if (project) choose(project);
  }, [hub]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function navigate(action: () => void) { if (dirty) setPending(() => action); else action(); }
  function edit<K extends keyof ProjectData>(key: K, value: ProjectData[K]) {
    setDraft(old => old ? { ...old, [key]: value } : old); setNotice("");
  }
  async function save(): Promise<boolean> {
    if (!draft || !hub || busy) return false;
    if (!form.current?.reportValidity()) { setError("Bitte Projektnummer, Projektname und die Angaben zu Kontakten und Dokumenten prüfen."); return false; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await projectAction<Project>(saved ? `/projects/${saved.id}` : "/projects", hub.session_key,
        saved ? { ...draft, version: saved.version } : draft, saved ? "PUT" : "POST");
      setSaved(result); setDraft(structuredClone(dataOf(result)));
      setNotice("Projekt gespeichert.");
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  }
  async function activate(toolId?: string) {
    if (!saved || !hub || dirty) return;
    setBusy(true); setError("");
    try {
      await projectAction("/selection", hub.session_key, { project_id: saved.id });
      setNotice("Projekt ist für den Toolhub ausgewählt.");
      if (toolId) onOpenTool?.(toolId);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function reload() {
    setBusy(true); setError("");
    try {
      const next = await refresh();
      const project = next.projects.find(item => item.id === saved?.id);
      if (project) choose(project);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function folder() {
    if (!hub || !saved) return;
    setBusy(true); setError("");
    try { await projectAction(`/projects/${saved.id}/open-folder`, hub.session_key); setNotice("Der Projektordner wurde an den Dateimanager übergeben."); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function copyPath(path: string) {
    try { await navigator.clipboard.writeText(path); setNotice("Pfad kopiert."); }
    catch { setError("Pfad konnte nicht kopiert werden. Bitte im Eingabefeld markieren und kopieren."); }
  }
  const projects = (hub?.projects ?? []).filter(project => project.archived === archive && `${project.number} ${project.name} ${project.address}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="project-hub">
    <ToolHeader title="Projektzentrale" onHome={() => navigate(onHome)} onOpenTool={onOpenTool ? id => navigate(() => onOpenTool(id)) : undefined} disabled={busy}><span className="tool-header-context" aria-label="Aktives Projekt">{active ? `Aktiv: ${active.number} · ${active.name}` : "Kein aktives Projekt"}</span></ToolHeader>
    <main className="project-main">
      <div className="project-heading"><div><h1>Deine Projekte im Überblick.</h1><p>Projektdaten, Kontakte und Dokumentverweise an einem Ort.</p></div><button className="btn primary" disabled={!hub || busy} onClick={() => navigate(() => choose(null))}>Neues Projekt</button></div>
      {(error || loadError) && <p className="project-error" role="alert">{error || loadError}</p>}
      {notice && <p role="status" className="project-notice">{notice}</p>}
      {!hub && !loadError && <p role="status">Projekte werden geladen …</p>}
      {loadError && <button className="btn" onClick={() => void refresh().catch(() => undefined)}>Erneut laden</button>}
      <div className="project-layout">
        <aside className="hub-project-list" aria-label="Projektliste">
          <label>Projekte suchen<input type="search" value={query} placeholder="Nummer, Name oder Adresse" onChange={event => setQuery(event.target.value)} /></label>
          <div className="project-tabs"><button className="btn" aria-pressed={!archive} onClick={() => setArchive(false)}>Laufend</button><button className="btn" aria-pressed={archive} onClick={() => setArchive(true)}>Archiv</button></div>
          <small>{projects.length} {projects.length === 1 ? "Projekt" : "Projekte"}</small>
          {projects.map(project => <button className={`hub-project-list-item ${saved?.id === project.id ? "is-selected" : ""}`} aria-pressed={saved?.id === project.id} key={project.id} disabled={busy} onClick={() => { if (saved?.id !== project.id) navigate(() => choose(project)); }}>
            <span className="project-number">{project.number}{hub?.active_id === project.id && <small>Aktiv</small>}</span><strong>{project.name}</strong>{project.address && <span>{project.address}</span>}
          </button>)}
          {hub && !projects.length && <p>{query ? "Kein Projekt gefunden." : archive ? "Noch keine archivierten Projekte." : "Lege dein erstes Projekt an."}</p>}
          <small>Die Projektliste wird auf diesem PC gespeichert.</small>
        </aside>
        {draft ? <form ref={form} className="project-editor" onSubmit={(event: FormEvent) => { event.preventDefault(); void save(); }}>
          <div className="project-editor-heading"><div><h2>{saved ? `${saved.number} · ${saved.name}` : "Neues Projekt"}</h2><small>{dirty ? "Ungespeicherte Änderungen" : "Alle Angaben gespeichert"}</small></div><button className="btn primary" disabled={!hub || busy || !dirty}>{busy ? "Bitte warten …" : "Projekt speichern"}</button></div>
          <fieldset disabled={busy}><legend>Projektdaten</legend>
            <div className="project-fields"><label>Projektnummer<input required maxLength={80} value={draft.number} placeholder="1498" onChange={event => edit("number", event.target.value)} /></label><label>Projektname<input required maxLength={180} value={draft.name} placeholder="Neubau Musterstrasse" onChange={event => edit("name", event.target.value)} /></label></div>
            <label>Projektadresse<input maxLength={500} value={draft.address} onChange={event => edit("address", event.target.value)} /></label>
            <label>Ablageordner<input maxLength={1500} value={draft.folder} placeholder="X:\Projekte\1498 oder \\Server\Projekte\1498" onChange={event => edit("folder", event.target.value)} /></label>
            <div className="hub-project-actions"><button type="button" className="btn" disabled={!saved?.folder || dirty} onClick={() => void folder()}>Ordner öffnen</button><button type="button" className="btn" disabled={!draft.folder} onClick={() => void copyPath(draft.folder)}>Ordnerpfad kopieren</button><small>Ordnerpfad hinterlegen; es wird kein Ordner angelegt oder verschoben.</small></div>
            <label className="project-check"><input type="checkbox" checked={draft.archived} onChange={event => edit("archived", event.target.checked)} />Projekt archiviert</label>
            <label>Notizen<textarea aria-label="Notizen" rows={3} maxLength={10000} value={draft.notes} onChange={event => edit("notes", event.target.value)} /></label>
          </fieldset>
          <fieldset disabled={busy}><legend>Kontakte</legend>
            {!draft.contacts.length && <p className="project-muted">Noch keine Kontakte hinterlegt.</p>}
            {draft.contacts.map((contact, index) => <div className="project-contact" key={index}>
              <div className="project-fields">{([ ["name", "Name"], ["role", "Rolle"], ["company", "Firma"], ["email", "E-Mail"], ["phone", "Telefon"] ] as const).map(([key, label]) => <label key={key}>{label}<input aria-label={`${label} Kontakt ${index + 1}`} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} maxLength={key === "email" ? 254 : key === "phone" ? 80 : 180} value={contact[key]} onChange={event => edit("contacts", draft.contacts.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} /></label>)}</div>
              <button type="button" className="btn" aria-label={`Kontakt ${index + 1} entfernen`} onClick={() => edit("contacts", draft.contacts.filter((_, i) => i !== index))}>Kontakt entfernen</button>
            </div>)}
            <button type="button" className="btn" disabled={draft.contacts.length >= 50} onClick={() => edit("contacts", [...draft.contacts, { name: "", role: "", company: "", email: "", phone: "" }])}>Kontakt hinzufügen</button>
          </fieldset>
          <fieldset disabled={busy}><legend>Dokumentverweise</legend><p className="project-muted">Verweise zu wichtigen Plänen und Dokumenten. Dateien bleiben an ihrem Ablageort; zuletzt hinzugefügte Verweise stehen oben.</p>
            {[...draft.documents].reverse().map(document => <div key={document.id} className="project-document">
              <label>Titel<input aria-label={`Dokumenttitel ${document.id}`} required maxLength={180} value={document.title} onChange={event => edit("documents", draft.documents.map(item => item.id === document.id ? { ...item, title: event.target.value } : item))} /></label>
              <label>Vollständiger Dateipfad<input aria-label={`Dokumentpfad ${document.id}`} required maxLength={1500} value={document.path} placeholder="X:\Projekte\1498\Plan.pdf" onChange={event => edit("documents", draft.documents.map(item => item.id === document.id ? { ...item, path: event.target.value } : item))} /></label>
              <div className="hub-project-actions"><button type="button" className="btn" disabled={!document.path} onClick={() => void copyPath(document.path)}>Dateipfad kopieren</button><button type="button" className="btn" onClick={() => edit("documents", draft.documents.filter(item => item.id !== document.id))}>Verweis entfernen</button><small>{document.added_at ? `Erfasst: ${new Date(document.added_at).toLocaleDateString("de-CH")}` : "Noch nicht gespeichert"}</small></div>
            </div>)}
            <button type="button" className="btn" disabled={draft.documents.length >= 100} onClick={() => edit("documents", [...draft.documents, { id: crypto.randomUUID(), title: "", path: "", added_at: "" }])}>Dokumentverweis hinzufügen</button>
          </fieldset>
          <div className="hub-project-actions"><button type="button" className="btn" disabled={!saved || dirty || busy || saved.archived} onClick={() => void activate()}>Als aktives Projekt verwenden</button>
            {onOpenTool && <button type="button" className="btn" disabled={!saved || dirty || busy || saved.archived} onClick={() => void activate("dateien-umbenennen")}>Dateien für dieses Projekt benennen</button>}
            {saved && <button type="button" className="btn" disabled={busy} onClick={() => navigate(() => void reload())}>Gespeicherten Stand laden</button>}
          </div><small className="project-muted">Aktive Projekte liefern ihre Nummer an „Dateien umbenennen“. Bestehende NOVA-Projekte werden separat verwaltet.</small>
          {saved && <><div className="hub-project-actions">{onOpenTool && <button type="button" className="btn" disabled={dirty || busy || saved.archived} onClick={() => void activate("planlieferung")}>Planlieferung vorbereiten</button>}</div><DeliveryHistory projectId={saved.id} /></>}
        </form> : <section className="project-editor project-welcome"><h2>Ein Projekt für deine Werkzeuge.</h2><p>Lege ein Projekt an oder wähle links eines aus. Projektnummer, Kontakte und Ablage bleiben beim nächsten Start erhalten.</p></section>}
      </div>
    </main>
    {pending && <LeaveDialog busy={busy} error={error} onCancel={() => setPending(null)} onDiscard={() => { const action = pending; setPending(null); action(); }} onSave={() => { void save().then(ok => { if (ok) { const action = pending; setPending(null); action(); } }); }} />}
  </div>;
}
