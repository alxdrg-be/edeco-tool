import { useEffect, useRef, useState, type FormEvent } from "react";
import { downloadBlob } from "../../shared/download";
import { BookOpen } from "lucide-react";
import ToolHeader from "../../toolbox/ToolHeader";
import type { ToolProps } from "../../toolbox/modules";
import { request, sourceLabel, ROOT, type Answer, type DocumentInfo, type DocumentPage, type LibraryState, type Source } from "./api";
import Settings from "./Settings";
import QwenGuide from "./QwenGuide";
import FolderSettings from "./FolderSettings";
import DataRoute from "./DataRoutePanel";
import "./documents.css";

export default function DocumentAssistant({ onHome, onOpenTool }: ToolProps) {
  const [library, setLibrary] = useState<LibraryState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [edition, setEdition] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [page, setPage] = useState<DocumentPage | null>(null);
  const [pageBusy, setPageBusy] = useState(false);
  const [zoom, setZoom] = useState("1");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const pageRequest = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLElement>(null);

  useEffect(() => {
    let alive = true;
    request<LibraryState>("/state").then(data => {
      if (!alive) return;
      setLibrary(data); setSelected(data.documents.filter(doc => doc.empty_pages < doc.pages).map(doc => doc.id));
    }).catch(e => { if (alive) setError((e as Error).message); });
    return () => { alive = false; controller.current?.abort(); pageRequest.current++; };
  }, []);

  useEffect(() => {
    if (pageBusy) return;
    preview.current?.querySelector("[data-highlight]")?.scrollIntoView({ block: "center" });
  }, [page, pageBusy, source, zoom]);

  function resetAnswer() {
    pageRequest.current++; setAnswer(null); setSource(null); setPage(null); setPageBusy(false);
  }

  async function addFiles(files: FileList | null) {
    if (!library || !files?.length) return;
    const documents = [...library.documents];
    const newSelected = new Set(selected);
    let duplicates = 0, added = 0;
    setBusy("upload"); setError(""); setNotice(""); resetAnswer();
    try {
      for (const file of Array.from(files)) {
        if (file.size > 100 * 1024 * 1024) throw new Error(`${file.name}: maximal 100 MB pro Datei.`);
        const body = new FormData(); body.set("file", file); body.set("edition", edition);
        const data = await request<{ document: DocumentInfo; duplicate: boolean }>("/documents", library.session_key, { method: "POST", body });
        if (data.duplicate) duplicates++;
        else added++;
        if (!documents.some(doc => doc.id === data.document.id)) documents.unshift(data.document);
        if (data.document.empty_pages < data.document.pages) newSelected.add(data.document.id);
      }
      setNotice(`${added} Dokument${added === 1 ? "" : "e"} hinzugefügt${duplicates ? ` · ${duplicates} bereits vorhanden` : ""}.`);
    } catch (e) { setError((e as Error).message); }
    finally {
      setLibrary({ ...library, documents }); setSelected([...newSelected]); setBusy("");
      if (upload.current) upload.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!library) return;
    setBusy("delete"); setError("");
    try {
      await request(`/documents/${id}`, library.session_key, { method: "DELETE" });
      pageRequest.current++; setPageBusy(false); setSource(null);
      setLibrary({ ...library, documents: library.documents.filter(doc => doc.id !== id) });
      setSelected(selected.filter(value => value !== id)); setAnswer(null); setDeleting(null);
      if (page?.document.id === id) { setPage(null); setSource(null); }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  async function ask(useAI: boolean) {
    if (!library || busy || !selected.length || !question.trim()) return;
    controller.current = new AbortController();
    setBusy(useAI ? "ai" : "search"); setError(""); setNotice(""); resetAnswer();
    try {
      const data = await request<Answer>("/ask", library.session_key, { method: "POST", signal: controller.current.signal,
        body: JSON.stringify({ question, document_ids: selected, use_ai: useAI }) });
      setAnswer(data);
      if (data.sources[0]) void openPage(data.sources[0].document_id, data.sources[0].page, data.sources[0]);
    } catch (e) { if ((e as Error).name !== "AbortError") setError((e as Error).message); }
    finally { setBusy(""); }
  }

  async function openPage(id: string, number: number, highlight: Source | null = null) {
    if (!library) return;
    const version = ++pageRequest.current;
    setPageBusy(true); setSource(highlight);
    try {
      const data = await request<DocumentPage>(`/documents/${id}/pages/${number}`, library.session_key);
      if (pageRequest.current === version) setPage(data);
    } catch (e) { if (pageRequest.current === version) { setPage(null); setError((e as Error).message); } }
    finally { if (pageRequest.current === version) setPageBusy(false); }
  }

  async function download() {
    if (!library || !page) return;
    try {
      const response = await fetch(`${ROOT}/documents/${page.document.id}/file`, { headers: { "X-Edeco-Documents": library.session_key } });
      if (!response.ok) throw new Error("Das Original konnte nicht heruntergeladen werden.");
      downloadBlob(await response.blob(), page.document.filename);
    } catch (e) { setError((e as Error).message); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(false); }
  const documents = library?.documents ?? [];
  const canAsk = Boolean(library && selected.length && question.trim().length >= 2 && !busy);
  const highlighted = (number: number) => Boolean(source && page && source.document_id === page.document.id && source.page === page.number && number >= source.start_line && number <= source.end_line);

  return <div className="document-assistant">
    <ToolHeader title="Dokumenten-Assistent" onHome={onHome} onOpenTool={onOpenTool} disabled={busy === "upload" || busy === "delete"}>
      <button className="btn" disabled={!library || Boolean(busy)} onClick={() => setFolderOpen(true)}>Dokumentordner</button>
      <button className="btn" disabled={!library || Boolean(busy)} onClick={() => setSettingsOpen(true)}>KI-Verbindung</button>
    </ToolHeader>
    <div className="doc-workspace">
      <aside className="doc-library" aria-label="Dokumentbibliothek">
        <div className="doc-section-title"><h1>Deine Dokumente</h1><span>{documents.length}</span></div>
        <p className="doc-help">Normen, Richtlinien und eigene Unterlagen als PDF, TXT oder Markdown.</p>
        <label className="doc-field">Dokumentstand für neue Dateien<input value={edition} maxLength={160} disabled={Boolean(busy)}
          placeholder="z. B. Ausgabe 2025" onChange={e => setEdition(e.target.value)} /></label>
        <label className={`btn doc-add ${busy ? "is-disabled" : ""}`}>{busy === "upload" ? "Dokumente werden eingelesen …" : "+ Dokumente hinzufügen"}
          <input ref={upload} type="file" accept=".pdf,.txt,.md" multiple disabled={!library || Boolean(busy)}
            aria-label="Dokumente hinzufügen" onChange={e => void addFiles(e.target.files)} /></label>
        <p className="doc-help">Max. 100 MB und 2000 PDF-Seiten pro Datei. Originale werden im persönlichen Toolhub-Datenordner aufbewahrt.</p>
        {!documents.length && <div className="doc-empty-library">Füge dein erstes Dokument hinzu. Danach kannst du Fundstellen suchen und Fragen stellen.</div>}
        <div className="doc-document-list">{documents.map(doc => <article key={doc.id} className="doc-document">
          <label className="doc-checkbox"><input type="checkbox" checked={selected.includes(doc.id)}
            disabled={Boolean(busy) || doc.empty_pages === doc.pages} aria-label={`${doc.title} für Fragen auswählen`}
            onChange={e => { setSelected(e.target.checked ? [...selected, doc.id] : selected.filter(id => id !== doc.id)); resetAnswer(); }} />
            <strong>{doc.title}</strong></label>
          <span>{doc.edition || "Stand nicht angegeben"} · {doc.pages} {doc.pages === 1 ? "Seite" : "Seiten"}</span>
          {doc.empty_pages > 0 && <p className="doc-warning">{doc.empty_pages === doc.pages ? "Kein durchsuchbarer Text. Für die Suche ist zuerst eine Texterkennung (OCR) nötig." : `${doc.empty_pages} Seiten ohne durchsuchbaren Text; dort ist eine Texterkennung (OCR) nötig.`}</p>}
          <div className="doc-document-actions"><button className="btn" disabled={Boolean(busy)} onClick={() => void openPage(doc.id, 1)}>Ansehen</button>
            <button className="btn" disabled={Boolean(busy)} onClick={() => setDeleting(doc.id)}>Entfernen</button></div>
          {deleting === doc.id && <div className="doc-delete" role="group" aria-label={`${doc.title} entfernen`}>
            <p>Dieses Dokument und seinen Suchindex aus dem Toolhub entfernen? Die ursprüngliche Datei ausserhalb des Toolhubs bleibt erhalten.</p>
            <button className="btn danger" disabled={Boolean(busy)} onClick={() => void remove(doc.id)}>Jetzt entfernen</button>
            <button className="btn" disabled={Boolean(busy)} onClick={() => setDeleting(null)}>Abbrechen</button>
          </div>}
        </article>)}</div>
      </aside>
      <main className="doc-conversation">
        <p className="toolbox-eyebrow">WISSEN MIT QUELLEN.</p><h2>Was möchtest du wissen?</h2>
        <p className="doc-intro">Frage zu deinen ausgewählten Unterlagen. Jede Antwort führt zurück zur Fundstelle.</p>
        <QwenGuide onOpenSettings={() => setSettingsOpen(true)} disabled={!library || Boolean(busy)} />
        {library && <DataRoute endpoint={library.settings.endpoint} configured={library.settings.configured} />}
        <form onSubmit={submit} className="doc-question-form">
          <label htmlFor="doc-question">Deine Frage</label>
          <textarea id="doc-question" rows={4} maxLength={2000} value={question} disabled={Boolean(busy)}
            placeholder="z. B. Welche Anforderungen werden an die Prüfung gestellt?" onChange={e => setQuestion(e.target.value)} />
          <span className="doc-help">{selected.length} Dokument{selected.length === 1 ? "" : "e"} ausgewählt · angegebene Dokumentstände beachten</span>
          <div className="doc-actions"><button className="btn" disabled={!canAsk}>Fundstellen suchen</button>
            <button type="button" className="btn primary" disabled={!canAsk || !library?.settings.configured} onClick={() => void ask(true)}>
              {busy === "ai" ? "Antwort wird erstellt …" : "KI-Antwort"}</button>
            {(busy === "ai" || busy === "search") && <button className="btn" type="button" onClick={() => controller.current?.abort()}>Abbrechen</button>}</div>
          {!library?.settings.configured && <p className="doc-help">Die Fundstellensuche ist kostenlos nutzbar. Für formulierte Antworten zuerst die <button type="button" className="doc-text-button" disabled={!library || Boolean(busy)} onClick={() => setSettingsOpen(true)}>KI-Verbindung einrichten</button> – lokal auf diesem PC oder mit einem gemeinsamen KI-Server.</p>}
        </form>
        {error && <p role="alert" className="doc-error">{error}</p>}
        {notice && <p role="status" className="doc-notice">{notice}</p>}
        {busy && <p role="status" className="doc-help">{busy === "ai" ? "Passende Textauszüge werden vom KI-Dienst ausgewertet …" : busy === "upload" ? "Texte und Seiten werden eingelesen …" : "Bitte kurz warten …"}</p>}
        {answer && <section className="doc-answer" aria-label="Antwort und Fundstellen">
          <h3>{answer.mode === "ai" ? "KI-Antwort" : "Gefundene Originalstellen"}</h3>
          <p className="doc-help">Frage: {answer.question}</p>
          {answer.message && <p role="status" className="doc-notice">{answer.message}</p>}
          {answer.blocks.map((block, i) => <div className="doc-answer-block" key={i}><p>{block.text}</p><div className="doc-citations">{block.source_ids.map(id => {
            const item = answer.sources.find(value => value.id === id);
            return item && <button key={id} className="btn" title={sourceLabel(item)} onClick={() => void openPage(item.document_id, item.page, item)}>[{id}] {item.title}, {item.kind === "pdf" ? `S. ${item.page}` : `Z. ${item.start_line}–${item.end_line}`}</button>;
          })}</div></div>)}
          {answer.sources.map(item => <article className="doc-source" key={item.id}>
            <button className="doc-source-link" onClick={() => void openPage(item.document_id, item.page, item)}>
              <strong>[{item.id}] {item.title}</strong><span>{sourceLabel(item).slice(item.title.length + 3)}</span>
              <span>Im Original markieren →</span></button><blockquote>{item.text}</blockquote>
          </article>)}
          {answer.sources.length > 0 && <p className="doc-help">Textzeilen beziehen sich auf die Textextraktion, nicht auf gedruckte Zeilennummern. Antworten und Geltungsbereich anhand der Originale prüfen.</p>}
        </section>}
      </main>
      <section ref={preview} className="doc-preview" aria-label="Original und markierte Fundstelle" aria-busy={pageBusy}>
        <div className="doc-preview-heading"><h2>Original &amp; Fundstelle</h2>{page && <button className="btn" disabled={pageBusy} onClick={() => void download()}>Original speichern</button>}</div>
        {pageBusy ? <p role="status">Originalseite wird geöffnet …</p> : page ? <>
          <p className="doc-page-title"><strong>{page.document.title}</strong><span>{page.document.edition || "Stand nicht angegeben"}</span></p>
          <div className="doc-page-nav"><button className="btn" disabled={page.number <= 1} aria-label="Vorige Seite" onClick={() => void openPage(page.document.id, page.number - 1)}>←</button>
            <span>Seite {page.number} von {page.document.pages}{page.label && page.label !== String(page.number) ? ` · Blatt ${page.label}` : ""}</span>
            <button className="btn" disabled={page.number >= page.document.pages} aria-label="Nächste Seite" onClick={() => void openPage(page.document.id, page.number + 1)}>→</button></div>
          {page.image && <label className="doc-zoom">Ansicht<select aria-label="PDF-Vergrösserung" value={zoom} onChange={e => setZoom(e.target.value)}>
            <option value="1">Seite einpassen</option><option value="1.5">150 %</option><option value="2">200 %</option></select></label>}
          {source && <p className="doc-highlight-note">Markiert: Textzeilen {source.start_line}–{source.end_line}</p>}
          {page.image ? <div className="doc-pdf-page" style={{ width: `${Number(zoom) * 100}%` }}><img src={page.image} alt={`${page.document.title}, Originalseite ${page.number}`} />
            {page.lines.filter(line => highlighted(line.number) && line.box).map(line => {
              const box = line.box!;
              return <span key={line.number} className="doc-source-highlight" data-highlight="true" aria-label={`Markierte Textzeile ${line.number}`}
                style={{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${(box[2] - box[0]) * 100}%`, height: `${(box[3] - box[1]) * 100}%` }} />;
            })}</div> : <ol className="doc-text-page">{page.lines.map(line => <li key={line.number} value={line.number}
              data-highlight={highlighted(line.number) || undefined} className={highlighted(line.number) ? "is-highlighted" : ""}>{line.text || " "}</li>)}</ol>}
          {!page.lines.length && <p className="doc-warning">Diese Seite enthält keinen durchsuchbaren Text. Für Fundstellen ist eine Texterkennung (OCR) nötig.</p>}
        </> : <div className="doc-preview-empty"><span aria-hidden="true"><BookOpen size={36} /></span><h3>Quellen direkt nachlesen</h3><p>Klicke auf eine Fundstelle, um die Seite mit markiertem Text zu öffnen. Über „Ansehen“ kannst du auch ohne Frage im Dokument blättern.</p></div>}
      </section>
    </div>
    {settingsOpen && library && <Settings value={library.settings} sessionKey={library.session_key}
      onSave={settings => setLibrary({ ...library, settings })} onClose={() => setSettingsOpen(false)} />}
    {folderOpen && library && <FolderSettings sessionKey={library.session_key} onClose={() => setFolderOpen(false)} onDocuments={next => {
      const existing = new Set(library.documents.map(document => document.id));
      const readable = new Set(next.filter(document => document.empty_pages < document.pages).map(document => document.id));
      setLibrary({ ...library, documents: next });
      setSelected(old => [...new Set([...old.filter(id => readable.has(id)), ...next.filter(document => !existing.has(document.id) && readable.has(document.id)).map(document => document.id)])]);
      resetAnswer();
    }} />}
  </div>;
}
