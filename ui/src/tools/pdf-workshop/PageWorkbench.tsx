import { useEffect, useRef, useState } from "react";
import "./pdf-native-workspace.css";

interface Source { id: string; file: File; count: number; number: number }
interface DocumentRow { id: string; name: string }
interface Page { id: string; document: string; source: string; number: number; width: number; height: number; thumbnail: string; rotation: number; user_unit?: number | null }
interface Inspection { pages: Omit<Page, "id" | "document" | "source" | "rotation">[] }
const API = "/api/tools/pdf-werkstatt";

export default function PageWorkbench({ sessionKey, onDirty, onWorking, incomingFiles, onFilesChange }: {
  sessionKey: string; onDirty: () => void; onWorking: (busy: boolean) => void;
  incomingFiles?: File[]; onFilesChange?: (files: File[]) => void;
}) {
  const [sources, setSources] = useState<Source[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [thumbnailSize, setThumbnailSize] = useState(140);
  const [multiple, setMultiple] = useState(false);
  const [scope, setScope] = useState("all");
  const [moveTarget, setMoveTarget] = useState("");
  const nextSourceNumber = useRef(1);
  const anchor = useRef("");
  const [history, setHistory] = useState<{ pages: Page[]; documents: DocumentRow[]; sources: Source[] }[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; name: string; count: number } | null>(null);
  const [filename, setFilename] = useState("edeco-Zusammenstellung");
  const [dragging, setDragging] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const resultUrl = useRef("");
  const received = useRef<File[] | null>(null);
  const alive = useRef(true);
  const current = pages.find(page => page.id === selected[selected.length - 1]);
  const position = pages.findIndex(page => page.id === current?.id);
  useEffect(() => { onWorking(Boolean(busy)); return () => onWorking(false); }, [busy, onWorking]);
  useEffect(() => () => { if (resultUrl.current) URL.revokeObjectURL(resultUrl.current); }, []);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (incomingFiles?.length && received.current !== incomingFiles) { received.current = incomingFiles; void addFiles(incomingFiles); } }, [incomingFiles]);
  useEffect(() => { onFilesChange?.(sources.map(source => source.file)); }, [sources, onFilesChange]);

  const activeDocument = documents.find(document => document.id === current?.document);
  const chosen = pages.filter(page => selected.includes(page.id));
  const outputPages = scope === "selection" ? chosen : scope === "document" ? pages.filter(page => page.document === current?.document) : pages;
  const sourceLabel = (source: string) => `PDF ${sources.find(item => item.id === source)?.number || ""}`;
  const sourceClass = (source: string) => `pdf-origin-${((sources.find(item => item.id === source)?.number || 1) - 1) % 6}`;

  function clearResult() {
    if (resultUrl.current) { URL.revokeObjectURL(resultUrl.current); resultUrl.current = ""; }
    setResult(null);
  }

  function update(next: Page[], nextDocuments = documents, nextSources = sources) {
    clearResult();
    setHistory(previous => [...previous.slice(-19), { pages, documents, sources }]);
    setPages(next); setDocuments(nextDocuments); setSources(nextSources); onDirty();
  }

  function select(page: Page, event: React.MouseEvent) {
    if (event.shiftKey && anchor.current) {
      const row = pages.filter(item => item.document === page.document);
      const from = row.findIndex(item => item.id === anchor.current), to = row.findIndex(item => item.id === page.id);
      if (from >= 0) { setSelected(row.slice(Math.min(from, to), Math.max(from, to) + 1).map(item => item.id)); return; }
    }
    if (multiple || event.ctrlKey || event.metaKey) setSelected(previous => previous.includes(page.id) ? previous.filter(id => id !== page.id) : [...previous, page.id]);
    else setSelected([page.id]);
    anchor.current = page.id;
  }

  function moveTo(ids: string[], document: string, before?: string) {
    const moving = pages.filter(page => ids.includes(page.id));
    if (!moving.length || before && ids.includes(before)) return;
    const remaining = pages.filter(page => !ids.includes(page.id));
    const row = remaining.filter(page => page.document === document);
    const target = before ? row.findIndex(page => page.id === before) : row.length;
    row.splice(target < 0 ? row.length : target, 0, ...moving.map(page => ({ ...page, document })));
    update(documents.flatMap(item => item.id === document ? row : remaining.filter(page => page.document === item.id)));
    setSelected(moving.map(page => page.id));
  }

  function drop(event: React.DragEvent, document: string, before?: string) {
    const data = event.dataTransfer.getData("application/x-edeco-pages");
    if (!data) return;
    event.preventDefault(); event.stopPropagation();
    try { moveTo(JSON.parse(data) as string[], document, before); } catch { /* Ignore foreign drag data. */ }
    setDragging("");
  }

  function extractSelection() {
    if (!chosen.length) return;
    const id = crypto.randomUUID();
    const nextDocuments = [...documents, { id, name: `Neue Zusammenstellung ${documents.filter(document => !sources.some(source => source.id === document.id)).length + 1}.pdf` }];
    update([...pages.filter(page => !selected.includes(page.id)), ...chosen.map(page => ({ ...page, document: id }))], nextDocuments);
  }

  function moveDocument(id: string, direction: number) {
    const index = documents.findIndex(document => document.id === id), target = index + direction;
    if (target < 0 || target >= documents.length) return;
    const next = [...documents]; const [document] = next.splice(index, 1); next.splice(target, 0, document);
    update(next.flatMap(document => pages.filter(page => page.document === document.id)), next);
  }

  async function addFiles(files: File[]) {
    if (busy || !files.length) return;
    if (sources.length + files.length > 20 || files.some(file => file.size > 100 * 1024 * 1024) || [...sources.map(source => source.file), ...files].reduce((size, file) => size + file.size, 0) > 250 * 1024 * 1024) {
      setError("Bitte höchstens 20 PDFs mit insgesamt 250 MB hinzufügen."); return;
    }
    setBusy("import"); setError("");
    try {
      const addedSources: Source[] = [], addedPages: Page[] = [];
      for (const file of files) {
        const body = new FormData(); body.append("file", file);
        const response = await fetch(API + "/inspect", { method: "POST", headers: { "X-Edeco-Pdf": sessionKey }, body });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Das PDF konnte nicht geöffnet werden.");
        const inspected = data as Inspection;
        if (!alive.current) return;
        if (pages.length + addedPages.length + inspected.pages.length > 100) throw new Error("Der Arbeitsbereich unterstützt bis zu 100 Seiten.");
        const id = crypto.randomUUID();
        addedSources.push({ id, file, count: inspected.pages.length, number: nextSourceNumber.current++ });
        addedPages.push(...inspected.pages.map(page => ({ ...page, source: id, document: id, id: crypto.randomUUID(), rotation: 0 })));
      }
      update([...pages, ...addedPages], [...documents, ...addedSources.map(source => ({ id: source.id, name: source.file.name }))], [...sources, ...addedSources]);
    } catch (e) { setError((e as Error).message); }
    finally { if (alive.current) { setBusy(""); if (picker.current) picker.current.value = ""; } }
  }

  function moveStep(direction: number) {
    if (!current) return;
    const row = pages.filter(page => page.document === current.document);
    const index = row.findIndex(page => selected.includes(page.id));
    const last = row.length - 1 - [...row].reverse().findIndex(page => selected.includes(page.id));
    const rowSelection = row.filter(page => selected.includes(page.id)).map(page => page.id);
    if (direction < 0 && index > 0) { moveTo(rowSelection, current.document, row[index - 1].id); setSelected(selected); }
    if (direction > 0 && last < row.length - 1) { moveTo(rowSelection, current.document, row[last + 2]?.id); setSelected(selected); }
  }

  function rotate() {
    update(pages.map(page => selected.includes(page.id) ? { ...page, rotation: (page.rotation + 90) % 360 } : page));
  }

  function duplicate() {
    const copies: string[] = [];
    update(pages.flatMap(page => {
      if (!selected.includes(page.id)) return [page];
      const id = crypto.randomUUID(); copies.push(id);
      return [page, { ...page, id }];
    }));
    setSelected(copies);
  }

  function remove() {
    const next = pages.filter(page => !selected.includes(page.id));
    const affected = new Set(chosen.map(page => page.document));
    const nextDocuments = next.length ? documents.filter(document => !affected.has(document.id) || next.some(page => page.document === document.id)) : [];
    update(next, nextDocuments, sources.filter(source => next.some(page => page.source === source.id) || nextDocuments.some(document => document.id === source.id)));
    setSelected(next[Math.min(position, next.length - 1)] ? [next[Math.min(position, next.length - 1)].id] : []);
    setMoveTarget("");
  }

  function removeDocument(id: string) {
    const next = pages.filter(page => page.document !== id);
    const nextDocuments = next.length ? documents.filter(document => document.id !== id) : [];
    update(next, nextDocuments, sources.filter(source => next.some(page => page.source === source.id) || nextDocuments.some(document => document.id === source.id)));
    setSelected(selected.filter(id => next.some(page => page.id === id))); setMoveTarget("");
  }

  async function save(exportPages = outputPages, exportName = filename) {
    if (busy || !exportPages.length) return;
    setBusy("export"); setError("");
    try {
      const body = new FormData();
      const uploads = sources.filter(source => exportPages.some(page => page.source === source.id));
      uploads.forEach(source => body.append("files", source.file));
      body.append("pages", JSON.stringify(exportPages.map(page => ({ file: uploads.findIndex(source => source.id === page.source), page: page.number, rotation: page.rotation }))));
      const response = await fetch(API + "/compose", { method: "POST", headers: { "X-Edeco-Pdf": sessionKey }, body });
      if (!response.ok) { const data = await response.json(); throw new Error(data.detail || "Die PDF konnte nicht erstellt werden."); }
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      resultUrl.current = URL.createObjectURL(await response.blob());
      const name = (exportName.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\.pdf$/i, "") || "edeco-Zusammenstellung") + ".pdf";
      setResult({ url: resultUrl.current, name, count: exportPages.length });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  return <div className="pdf-desk" onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
    onDrop={event => { if (event.dataTransfer.files.length) { event.preventDefault(); event.stopPropagation(); void addFiles([...event.dataTransfer.files]); } }}>
    <aside className="pdf-library" aria-label="PDF-Dateien">
      <div className="pdf-panel-heading"><h2>Deine PDFs</h2><span>{sources.length}</span></div>
      <details className="pdf-hint"><summary>ⓘ Arbeiten mit Seiten</summary><p>Eine Reihe pro PDF. Seiten zwischen Reihen verschieben oder ausgewählte Seiten als neue Zusammenstellung exportieren. Quelldateien bleiben unverändert.</p></details>
      <input ref={picker} type="file" multiple accept="application/pdf,.pdf" hidden aria-label="PDF-Dateien hinzufügen" onChange={event => void addFiles([...event.target.files || []])} />
      <button className="btn pdf-add" disabled={Boolean(busy)} onClick={() => picker.current?.click()}>＋ PDFs hinzufügen</button>
      <div className="pdf-source-list">{sources.map(source => <button key={source.id} className={`pdf-source ${sourceClass(source.id)} ${pages.some(page => page.document === source.id && selected.includes(page.id)) ? "is-current" : ""}`}
        onClick={() => { document.getElementById(`pdf-row-${source.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); const first = pages.find(page => page.document === source.id); if (first) setSelected([first.id]); }} disabled={Boolean(busy)}>
        <span className="pdf-source-icon">PDF {source.number}</span><span><strong>{source.file.name}</strong><small>{source.count} {source.count === 1 ? "Seite" : "Seiten"} · {(source.file.size / 1024).toFixed(0)} KB</small></span>
      </button>)}</div>
      <div className="pdf-library-foot"><span className="pdf-local-dot" /> Dateien auf diesem Computer<p>Vorschau · Sortieren · Drehen · Entfernen · Zusammenführen</p></div>
    </aside>
    <main className="pdf-page-workspace" aria-labelledby="pdf-desk-title">
      <div className="pdf-desk-intro"><h1 id="pdf-desk-title">Seiten zusammenstellen</h1></div>
      <div className="pdf-page-toolbar" aria-label="Seiten bearbeiten">
        <strong>{chosen.length ? `${chosen.length} ausgewählt` : `${pages.length} Seiten`}</strong><span className="pdf-toolbar-divider" />
        <button className="btn small" disabled={!current || Boolean(busy)} onClick={rotate}>↻ Drehen</button>
        <button className="btn small" disabled={!current || Boolean(busy)} onClick={duplicate}>Duplizieren</button>
        <button className="btn small" disabled={!current || Boolean(busy)} onClick={remove}>Entfernen</button>
        <button className="btn small" disabled={!history.length || Boolean(busy)} onClick={() => { const previous = history[history.length - 1]; setPages(previous.pages); setDocuments(previous.documents); setSources(previous.sources); setHistory(history.slice(0, -1)); setSelected(previous.pages.filter(page => selected.includes(page.id)).map(page => page.id)); clearResult(); onDirty(); }}>↶ Rückgängig</button>
        <button className="btn small" disabled={!chosen.length || Boolean(busy)} onClick={extractSelection}>＋ Neue Zusammenstellung</button>
        <button className="btn small" aria-pressed={multiple} disabled={Boolean(busy)} onClick={() => setMultiple(!multiple)}>Mehrfachauswahl</button>
        <label className="pdf-thumbnail-size">Miniaturen<input type="range" min="110" max="230" step="10" value={thumbnailSize} onChange={event => setThumbnailSize(Number(event.target.value))} /></label>
      </div>
      {error && <p className="pdf-desk-alert" role="alert">{error}</p>}
      {busy && <p className="pdf-desk-progress" role="status">{busy === "import" ? "PDFs werden geöffnet und Vorschauen erstellt …" : "Deine Zusammenstellung wird als PDF erstellt …"}</p>}
      {!pages.length ? <div className="pdf-empty-drop"><span className="pdf-empty-symbol" aria-hidden="true">▤</span><h2>Hier beginnt deine Zusammenstellung.</h2><p>Ziehe PDF-Dateien in den Arbeitsbereich<br />oder wähle sie auf deinem Computer aus.</p><button className="btn primary" disabled={Boolean(busy)} onClick={() => picker.current?.click()}>PDFs auswählen</button><small>Bis zu 20 Dateien · 100 Seiten · 250 MB gesamt</small></div>
        : <div className="pdf-document-rows" aria-label="Dokumente organisieren">{documents.map((document, documentIndex) => {
          const rowPages = pages.filter(page => page.document === document.id);
          return <section key={document.id} id={`pdf-row-${document.id}`} className={`pdf-document-row ${rowPages.some(page => selected.includes(page.id)) ? "has-selection" : ""} ${sources.some(source => source.id === document.id) ? sourceClass(document.id) : "pdf-origin-custom"}`} aria-label={document.name}
            onDragOver={event => { if (event.dataTransfer.types.includes("application/x-edeco-pages")) event.preventDefault(); }} onDrop={event => drop(event, document.id)}>
            <header className="pdf-row-heading"><span className="pdf-document-number">{String(documentIndex + 1).padStart(2, "0")}</span>
              <div className="pdf-row-title"><h2>{document.name}</h2><p>{rowPages.length} {rowPages.length === 1 ? "Seite" : "Seiten"}{sources.some(source => source.id === document.id) ? ` · Original: ${sourceLabel(document.id)}` : " · Eigene Zusammenstellung"}</p></div>
              <div className="pdf-row-actions"><button className="btn small" aria-label={`${document.name}: Reihe nach oben`} disabled={documentIndex === 0 || Boolean(busy)} onClick={() => moveDocument(document.id, -1)}>↑</button><button className="btn small" aria-label={`${document.name}: Reihe nach unten`} disabled={documentIndex === documents.length - 1 || Boolean(busy)} onClick={() => moveDocument(document.id, 1)}>↓</button><button className="btn small" disabled={!rowPages.length || Boolean(busy)} onClick={() => setSelected(rowPages.map(page => page.id))}>Alle auswählen</button><button className="btn small" disabled={!rowPages.length || Boolean(busy)} onClick={() => void save(rowPages, document.name)}>PDF erstellen</button><button className="btn small" aria-label={`${document.name}: Dokument entfernen`} disabled={Boolean(busy)} onClick={() => removeDocument(document.id)}>×</button></div>
            </header>
            <div className="pdf-page-strip" style={{ "--thumbnail-width": `${thumbnailSize}px` } as React.CSSProperties}>
              {rowPages.map((page, index) => <button type="button" key={page.id}
                className={`pdf-page-card ${selected.includes(page.id) ? "is-selected" : ""} ${dragging && selected.includes(page.id) ? "is-dragging" : ""}`} disabled={Boolean(busy)}
                aria-label={`${document.name}, Position ${index + 1}: ${sources.find(source => source.id === page.source)?.file.name}, Seite ${page.number}`} aria-pressed={selected.includes(page.id)}
                draggable={!busy} onDragStart={event => { const ids = selected.includes(page.id) ? rowPages.filter(item => selected.includes(item.id)).map(item => item.id) : [page.id]; setSelected(ids); event.dataTransfer.setData("application/x-edeco-pages", JSON.stringify(ids)); event.dataTransfer.effectAllowed = "move"; setDragging(page.id); }}
                onDragEnd={() => setDragging("")} onDragOver={event => { if (event.dataTransfer.types.includes("application/x-edeco-pages")) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
                onDrop={event => drop(event, document.id, page.id)} onClick={event => select(page, event)}>
                <span className="pdf-page-position">{index + 1}<span className="pdf-page-origin">{sourceLabel(page.source)} · S. {page.number}</span></span><span className="pdf-page-check" aria-hidden="true">{selected.includes(page.id) ? "✓" : "⠿"}</span>
                <span className="pdf-thumbnail-stage"><img draggable={false} src={page.thumbnail} style={{ transform: `rotate(${page.rotation}deg)` }} alt={`Vorschau Seite ${page.number}`} /></span>
                <span className="pdf-page-caption"><strong title={sources.find(source => source.id === page.source)?.file.name}>{sources.find(source => source.id === page.source)?.file.name}</strong><small>Originalseite {page.number}{page.rotation ? ` · ${page.rotation}° gedreht` : ""}</small></span>
              </button>)}
              <div className="pdf-row-drop" onDragOver={event => { if (event.dataTransfer.types.includes("application/x-edeco-pages")) event.preventDefault(); }} onDrop={event => drop(event, document.id)}><span aria-hidden="true">＋</span><span>{rowPages.length ? "Seiten hier anhängen" : "Seiten in diese Reihe ziehen"}</span></div>
            </div>
          </section>;
        })}<p className="pdf-selection-tip">Strg + Klick: mehrere Seiten · Umschalt + Klick: Bereich auswählen · Auswahlfarbe: aktuelle Dokumentreihe · PDF-Nummer: ursprüngliche Datei.</p></div>}

    </main>
    <aside className="pdf-output-panel" aria-label="Auswahl und Ausgabe">
      <div className="pdf-panel-heading"><h2>Deine Auswahl</h2>{current && <span>{chosen.length} ausgewählt</span>}</div>
      {current ? <><div className="pdf-selected-preview"><img src={current.thumbnail} alt="Ausgewählte Seite" style={{ transform: `rotate(${current.rotation}deg)` }} /></div>
        <p className={`pdf-selected-origin ${sources.some(source => source.id === current.document) ? sourceClass(current.document) : "pdf-origin-custom"}`}>{sourceLabel(current.source)} · Originalseite {current.number}</p><strong className="pdf-selected-name">{sources.find(source => source.id === current.source)?.file.name}</strong><p className="pdf-hint">Originalseite {current.number} · {current.user_unit ? `${Math.round((current.rotation % 180 ? current.height : current.width) * current.user_unit * 25.4 / 72)} × ${Math.round((current.rotation % 180 ? current.width : current.height) * current.user_unit * 25.4 / 72)} mm` : "Physische Abmessungen unbekannt"}</p>
        <div className="pdf-move-controls"><button className="btn" disabled={pages.filter(page => page.document === current.document).findIndex(page => selected.includes(page.id)) <= 0 || Boolean(busy)} onClick={() => moveStep(-1)} aria-label="Seite nach vorne">← Nach vorne</button><button className="btn" disabled={selected.includes(pages.filter(page => page.document === current.document).at(-1)?.id || "") || Boolean(busy)} onClick={() => moveStep(1)} aria-label="Seite nach hinten">Nach hinten →</button></div></>
        : <p className="pdf-hint pdf-selection-empty">Wähle eine Seite, um ihre Vorschau und Position zu sehen.</p>}
      <div className="pdf-transfer"><label>Auswahl in Reihe verschieben<select aria-label="Zielreihe" value={moveTarget} disabled={!chosen.length || Boolean(busy)} onChange={event => setMoveTarget(event.target.value)}><option value="">Ziel wählen …</option>{documents.map(document => <option key={document.id} value={document.id}>{document.name}</option>)}</select></label><button className="btn" disabled={!chosen.length || !documents.some(document => document.id === moveTarget) || Boolean(busy)} onClick={() => moveTo(selected, moveTarget)}>Auswahl verschieben</button></div>
      <div className="pdf-output"><label className="pdf-output-scope">Ausgabe<select value={scope} onChange={event => setScope(event.target.value)}><option value="all">Alle Dokumente zusammenfügen</option><option value="document">Aktuelle Reihe{activeDocument ? `: ${activeDocument.name}` : ""}</option><option value="selection">Nur ausgewählte Seiten</option></select></label><p className="pdf-eyebrow">DEIN ERGEBNIS</p><h2>Als neues PDF speichern</h2><label>Dateiname<input className="input" maxLength={120} value={filename} onChange={event => setFilename(event.target.value)} disabled={Boolean(busy)} /></label>
        <p className="pdf-hint">{outputPages.length ? `${outputPages.length} Seiten · Reihen von oben nach unten, Seiten von links nach rechts.` : "Wähle zuerst Seiten für die Ausgabe."}</p>
        <button className="btn primary pdf-export" disabled={!outputPages.length || Boolean(busy)} onClick={() => void save()}>{busy === "export" ? "Wird erstellt …" : "↓ PDF erstellen"}</button>
        {result && <div className="pdf-result" role="status"><strong>✓ PDF erstellt · {result.count} Seiten</strong><a className="btn" href={result.url} download={result.name}>PDF herunterladen</a><small>Bereits erstelltes Ergebnis. Nach weiteren Änderungen erneut erstellen.</small></div>}
      </div>
      <p className="pdf-prototype-note">Seiten zusammenstellen<br />Weitere Werkzeuge unter „Werkzeugauswahl“.</p>
    </aside>
  </div>;
}
