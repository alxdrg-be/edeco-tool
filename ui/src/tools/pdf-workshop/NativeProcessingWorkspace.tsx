import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, FileSearch, LoaderCircle, Minus, Plus, Search, Upload, X } from "lucide-react";
import "./pdf-processing-workspace.css";

const API = "/api/tools/pdf-werkstatt";
type Mode = "ocr" | "compress";
interface Page { number: number; width: number; height: number; thumbnail: string }
interface Statistics { page_count: number; pages_with_text: number; word_count: number; signatures?: number; input_bytes?: number; output_bytes?: number; saved_bytes?: number; saved_percent?: number }
interface Inspection extends Statistics { pages: Page[] }
interface Match { page: number; rects: number[][] }
interface Result { file: File; url: string; stats: Statistics; inspection?: Inspection }
interface Props { mode: Mode; sessionKey: string; incomingFiles?: File[]; onDirty: () => void; onWorking: (busy: boolean) => void; onFilesChange?: (files: File[]) => void; onResultFiles?: (files: File[]) => void }

const bytes = (value: number) => value < 1024 ? `${value} B` : new Intl.NumberFormat("de-CH", { maximumFractionDigits: value < 1024 * 1024 ? 1 : 2 }).format(value / (value < 1024 * 1024 ? 1024 : 1024 * 1024)) + (value < 1024 * 1024 ? " KB" : " MB");

function ProcessingPreview({ file, page, sessionKey, zoom, onZoom, marks }: { file: File; page: Page; sessionKey: string; zoom: number; onZoom: (value: number) => void; marks: { rect: number[]; current: boolean }[] }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [documentId, setDocumentId] = useState("");
  const [image, setImage] = useState("");
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(entries => setSize({ width: entries[0].contentRect.width, height: entries[0].contentRect.height }));
    observer.observe(viewport.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); onZoom(Math.max(.5, Math.min(4, zoom * Math.exp(-event.deltaY / 500)))); } };
    node.addEventListener("wheel", wheel, { passive: false }); return () => node.removeEventListener("wheel", wheel);
  }, [zoom, onZoom]);
  useEffect(() => {
    const controller = new AbortController(); let id = "";
    const headers = { "X-Edeco-Pdf": sessionKey };
    const remove = (value: string) => { void fetch(`${API}/crop-documents/${encodeURIComponent(value)}`, { method: "DELETE", headers }).catch(() => {}); };
    setDocumentId(""); setImage("");
    void (async () => {
      try {
        const body = new FormData(); body.append("file", file);
        const response = await fetch(API + "/crop-documents", { method: "POST", headers, body, signal: controller.signal });
        if (!response.ok) return;
        const value = await response.json(); id = value.id;
        if (controller.signal.aborted) remove(id); else setDocumentId(id);
      } catch { /* Bounded thumbnail remains available if the sharp-preview session is full. */ }
    })();
    return () => { controller.abort(); if (id) remove(id); };
  }, [file, sessionKey]);
  useEffect(() => {
    const controller = new AbortController(); let url = "";
    setImage("");
    if (documentId) void (async () => {
      try {
        const response = await fetch(`${API}/crop-documents/${encodeURIComponent(documentId)}/pages/${page.number}?width=1800`, { headers: { "X-Edeco-Pdf": sessionKey }, signal: controller.signal });
        if (!response.ok) return;
        const blob = await response.blob();
        if (!controller.signal.aborted) { url = URL.createObjectURL(blob); setImage(url); }
      } catch { /* Switching pages cancels a superseded render. */ }
    })();
    return () => { controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [documentId, page.number, sessionKey]);
  const fit = Math.min(Math.max(1, size.width - 32) / page.width, Math.max(1, size.height - 32) / page.height);
  return <div ref={viewport} className="pdf-processing-preview" tabIndex={0} aria-label="PDF mit Dokumentzoom und Suchtreffern" data-document-zoom={zoom} onKeyDown={event => {
    if (!(event.ctrlKey || event.metaKey) || !["0", "+", "=", "-"].includes(event.key)) return;
    event.preventDefault(); onZoom(event.key === "0" ? 1 : Math.max(.5, Math.min(4, zoom * (event.key === "-" ? 1 / 1.2 : 1.2))));
  }}><div className="pdf-processing-sheet" style={{ width: page.width * fit * zoom, height: page.height * fit * zoom }}>
    <img src={image || page.thumbnail} alt={`PDF-Seite ${page.number} von ${file.name}`} draggable={false} />
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pdf-processing-matches" aria-label="Markierte Suchtreffer">{marks.map(({ rect: [x0, y0, x1, y1], current }, index) => <rect key={index} x={x0} y={y0} width={x1 - x0} height={y1 - y0} className={current ? "is-current" : ""} vectorEffect="non-scaling-stroke" />)}</svg>
  </div></div>;
}

export default function NativeProcessingWorkspace({ mode, sessionKey, incomingFiles, onDirty, onWorking, onFilesChange, onResultFiles }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showResult, setShowResult] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [languages, setLanguages] = useState(["deu", "eng"]);
  const [force, setForce] = useState(false);
  const [quality, setQuality] = useState(5);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [searching, setSearching] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [searchError, setSearchError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const main = useRef<HTMLElement>(null);
  const generation = useRef(0);
  const incoming = useRef<File[] | null>(null);
  const resultUrl = useRef("");
  const callbacks = useRef({ onWorking, onFilesChange, onResultFiles });
  callbacks.current = { onWorking, onFilesChange, onResultFiles };
  const displayFile = showResult && result ? result.file : file;
  const displayed = showResult && result?.inspection ? result.inspection : inspection;
  const currentPage = displayed?.pages[pageIndex];
  const isOcr = mode === "ocr";
  useEffect(() => { callbacks.current.onWorking(Boolean(busy)); }, [busy]);
  useEffect(() => () => callbacks.current.onWorking(false), []);
  useEffect(() => { callbacks.current.onFilesChange?.(displayFile ? [displayFile] : []); }, [displayFile]);
  useEffect(() => { if (incomingFiles?.length && incoming.current !== incomingFiles) { incoming.current = incomingFiles; void choose(incomingFiles); } }, [incomingFiles]);
  useEffect(() => () => { generation.current++; if (resultUrl.current) URL.revokeObjectURL(resultUrl.current); }, []);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && main.current && main.current.offsetParent !== null && file) { event.preventDefault(); search.current?.focus(); search.current?.select(); }
    };
    document.addEventListener("keydown", handle); return () => document.removeEventListener("keydown", handle);
  }, [file]);
  useEffect(() => {
    const controller = new AbortController();
    setMatches([]); setMatchIndex(0); setSearchError(""); setTruncated(false);
    if (!query.trim() || !displayFile) { setSearching(false); return; }
    setSearching(true);
    const timer = window.setTimeout(() => { void (async () => {
      try {
        const body = new FormData(); body.append("file", displayFile); body.append("query", query);
        const response = await fetch(API + "/processing/search", { method: "POST", headers: { "X-Edeco-Pdf": sessionKey }, body, signal: controller.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(typeof value.detail === "string" ? value.detail : "Die PDF-Suche ist fehlgeschlagen.");
        if (!controller.signal.aborted) { setMatches(value.matches); setTruncated(value.truncated); if (value.matches.length) setPageIndex(value.matches[0].page - 1); }
      } catch (e) { if (!controller.signal.aborted) setSearchError((e as Error).message); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    })(); }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [displayFile, query, sessionKey]);

  function invalidateResult() { if (resultUrl.current) URL.revokeObjectURL(resultUrl.current); resultUrl.current = ""; setResult(null); setShowResult(true); }
  function closeDocument() {
    if (busy) return;
    generation.current++; setFile(null); setInspection(null); invalidateResult(); setError(""); setQuery(""); setMatches([]); setPageIndex(0); setZoom(1);
  }
  async function inspect(source: File): Promise<Inspection> {
    const body = new FormData(); body.append("file", source);
    const response = await fetch(API + "/processing/inspect", { method: "POST", headers: { "X-Edeco-Pdf": sessionKey }, body });
    const value = await response.json();
    if (!response.ok) throw new Error(typeof value.detail === "string" ? value.detail : "Das PDF konnte nicht geöffnet werden.");
    return value as Inspection;
  }
  async function choose(files: File[]) {
    if (busy || !files.length) return;
    if (files.length !== 1 || files[0].size > 100 * 1024 * 1024 || !(/\.pdf$/i.test(files[0].name) || files[0].type === "application/pdf")) { setError("Bitte eine PDF-Datei mit höchstens 100 MB wählen."); return; }
    const run = ++generation.current;
    setBusy("open"); setError("");
    try {
      const value = await inspect(files[0]);
      if (run === generation.current) { invalidateResult(); setQuery(""); setFile(files[0]); setInspection(value); setPageIndex(0); setZoom(1); onDirty(); }
    } catch (e) { if (run === generation.current) setError((e as Error).message); }
    finally { if (run === generation.current) setBusy(""); if (picker.current) picker.current.value = ""; }
  }
  async function run() {
    if (!file || busy || isOcr && !languages.length) return;
    const run = ++generation.current;
    setBusy("process"); setError("");
    try {
      const body = new FormData(); body.append("file", file); body.append("options", JSON.stringify(isOcr ? { languages, force_ocr: force } : { quality }));
      const response = await fetch(`${API}/processing/${mode}`, { method: "POST", headers: { "X-Edeco-Pdf": sessionKey }, body });
      if (!response.ok) { const value = await response.json(); throw new Error(typeof value.detail === "string" ? value.detail : "Die PDF-Verarbeitung ist fehlgeschlagen."); }
      const stats = JSON.parse(response.headers.get("X-Edeco-Pdf-Statistics") || "null") as Statistics | null;
      if (!stats) throw new Error("Die PDF-Auswertung fehlt. Bitte erneut versuchen.");
      const blob = await response.blob();
      const name = file.name.replace(/\.pdf$/i, "") + (isOcr ? "_durchsuchbar.pdf" : "_komprimiert.pdf");
      const ready: Result = { file: new File([blob], name, { type: "application/pdf" }), url: URL.createObjectURL(blob), stats };
      if (run !== generation.current) { URL.revokeObjectURL(ready.url); return; }
      try { ready.inspection = await inspect(ready.file); } catch { /* The finished download survives a missing result preview. */ }
      if (run !== generation.current) { URL.revokeObjectURL(ready.url); return; }
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      resultUrl.current = ready.url;
      setResult(ready); setShowResult(Boolean(ready.inspection)); setPageIndex(0); onDirty();
      callbacks.current.onResultFiles?.([ready.file]);
      const link = document.createElement("a"); link.href = ready.url; link.download = name; document.body.append(link); link.click(); link.remove();
    } catch (e) { if (run === generation.current) setError((e as Error).message); }
    finally { if (run === generation.current) setBusy(""); }
  }
  function nextMatch(direction: number) {
    if (!matches.length) return;
    const index = (matchIndex + direction + matches.length) % matches.length;
    setMatchIndex(index); setPageIndex(matches[index].page - 1);
  }
  const marks = matches.flatMap((match, index) => match.page === currentPage?.number ? match.rects.map(rect => ({ rect, current: index === matchIndex })) : []);
  return <main ref={main} className="pdf-processing-workspace" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); void choose([...event.dataTransfer.files]); }}>
    <input ref={picker} type="file" hidden accept="application/pdf,.pdf" aria-label="PDF für Texterkennung oder Komprimierung öffnen" onChange={event => void choose([...event.target.files || []])} />
    <section className="pdf-processing-document" aria-label="PDF und Dokumentsuche">
      <div className="pdf-processing-file"><strong>{file?.name || "Dein PDF"}</strong><button className="btn" disabled={Boolean(busy)} onClick={() => picker.current?.click()}><Upload size={16} />{file ? "Datei wechseln" : "PDF öffnen"}</button>{file && <button className="btn pdf-processing-close" aria-label="PDF schliessen" title="PDF schliessen" disabled={Boolean(busy)} onClick={closeDocument}><X size={20} /></button>}</div>
      {!file && <div className="pdf-processing-empty"><FileSearch size={42} /><h1>{isOcr ? "Texterkennung (OCR)" : "PDF komprimieren"}</h1><p>PDF hier ablegen oder öffnen.</p><button className="btn primary" disabled={Boolean(busy)} onClick={() => picker.current?.click()}>PDF auswählen</button></div>}
      {file && <><div className="pdf-processing-search"><Search size={17} /><input ref={search} aria-label="Im PDF suchen" placeholder="Im PDF suchen …" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} /><span role="status">{searching ? "Suche …" : query ? `${matches.length ? matchIndex + 1 : 0} / ${matches.length}${truncated ? "+" : ""}` : "Strg + F"}</span><button className="btn icon" aria-label="Vorheriger Suchtreffer" disabled={!matches.length || searching} onClick={() => nextMatch(-1)}><ChevronLeft size={17} /></button><button className="btn icon" aria-label="Nächster Suchtreffer" disabled={!matches.length || searching} onClick={() => nextMatch(1)}><ChevronRight size={17} /></button>{query && <button className="btn icon pdf-processing-close" aria-label="PDF-Suche leeren" onClick={() => setQuery("")}><X size={17} /></button>}</div>
        {searchError && <p role="alert">{searchError}</p>}
        {truncated && <p role="status" className="pdf-processing-note">Die Suche ist begrenzt. Verwende einen genaueren Suchbegriff, um weitere Treffer zu finden.</p>}
        {query && !searching && !matches.length && !searchError && !truncated && <p className="pdf-processing-note">Keine Treffer in der Textschicht.{!inspection?.pages_with_text && isOcr ? " Zuerst die Texterkennung ausführen." : ""}</p>}
        <div className="pdf-processing-view-controls">{result && <div className="pdf-processing-view-toggle" role="group" aria-label="PDF-Ansicht"><button className="btn" aria-pressed={!showResult} onClick={() => setShowResult(false)}>Original</button><button className="btn" disabled={!result.inspection} aria-pressed={showResult} onClick={() => setShowResult(true)}>Ergebnis</button></div>}<button className="btn icon" aria-label="PDF verkleinern" onClick={() => setZoom(value => Math.max(.5, value / 1.2))}><Minus size={16} /></button><span>{Math.round(zoom * 100)}%</span><button className="btn icon" aria-label="PDF vergrössern" onClick={() => setZoom(value => Math.min(4, value * 1.2))}><Plus size={16} /></button><button className="btn" onClick={() => setZoom(1)}>Ganze Seite</button><span className="pdf-processing-pager"><button className="btn icon" aria-label="Vorherige PDF-Seite" disabled={!pageIndex} onClick={() => setPageIndex(value => value - 1)}><ChevronLeft size={16} /></button>{pageIndex + 1} / {displayed?.pages.length || 0}<button className="btn icon" aria-label="Nächste PDF-Seite" disabled={pageIndex + 1 >= (displayed?.pages.length || 0)} onClick={() => setPageIndex(value => value + 1)}><ChevronRight size={16} /></button></span></div>
        {currentPage && displayFile && <ProcessingPreview file={displayFile} page={currentPage} sessionKey={sessionKey} zoom={zoom} onZoom={setZoom} marks={marks} />}
        {displayed && displayed.pages.length > 1 && <div className="pdf-processing-thumbnails" aria-label="PDF-Seiten">{displayed.pages.map(page => <button className="btn" key={page.number} aria-label={`PDF-Seite ${page.number} ansehen`} aria-pressed={page.number === pageIndex + 1} onClick={() => setPageIndex(page.number - 1)}><img src={page.thumbnail} alt="" loading="lazy" /><span>{page.number}</span></button>)}</div>}
      </>}
    </section>
    <aside className="pdf-processing-settings" aria-label="Verarbeitung und Ergebnis"><h2>{isOcr ? "Texterkennung" : "Komprimieren"}</h2>
      {!file ? <p>Öffne ein PDF, um die Einstellungen zu verwenden.</p> : <><fieldset disabled={Boolean(busy)}><details open className="pdf-processing-options"><summary>Einstellungen<ChevronDown size={16} /></summary>{isOcr ? <div className="pdf-processing-languages"><span>Sprachen</span>{[["deu", "Deutsch"], ["eng", "Englisch"]].map(([id, title]) => <label key={id}><input type="checkbox" checked={languages.includes(id)} onChange={event => { setLanguages(old => event.target.checked ? [...old, id] : old.filter(value => value !== id)); invalidateResult(); }} />{title}</label>)}</div> : <label>Komprimierungsstufe<select aria-label="Komprimierungsstufe" value={quality} onChange={event => { setQuality(Number(event.target.value)); invalidateResult(); }}><option value={3}>Schonend · hohe Bildqualität</option><option value={5}>Ausgewogen</option><option value={8}>Stark · kleinere Bilder</option></select></label>}</details>
        <details className="pdf-processing-options"><summary>Erweitert<ChevronDown size={16} /></summary>{isOcr ? <><label className="pdf-processing-check"><input type="checkbox" checked={force} onChange={event => { setForce(event.target.checked); invalidateResult(); }} />Vorhandene Textschicht neu erkennen</label><p>Ohne diese Option bleiben bereits durchsuchbare Seiten erhalten. Deutsch und Englisch stehen in dieser Ansicht zur Verfügung; weitere Optionen findest du unter „Erweiterte Funktionen“.</p></> : <p>Die Komprimierung kann Bilddetails reduzieren. Prüfe das Ergebnis bei Plänen mit dünnen Linien und kleiner Beschriftung.</p>}</details></fieldset>
        {Boolean(inspection?.signatures) && <p className="pdf-processing-note">Das PDF enthält {inspection?.signatures} digitale Signatur(en). Die Verarbeitung verändert die Datei und kann diese Signaturen ungültig machen. Das Original bleibt erhalten.</p>}
        {inspection && !result && <dl className="pdf-processing-summary"><div><dt>Original</dt><dd>{bytes(file.size)}</dd></div><div><dt>Durchsuchbare Seiten</dt><dd>{inspection.pages_with_text} / {inspection.page_count}</dd></div></dl>}
        <button className="btn primary pdf-processing-run" disabled={Boolean(busy) || isOcr && !languages.length} onClick={() => void run()}>{busy === "process" ? <LoaderCircle className="is-spinning" size={18} /> : <Download size={18} />}{busy === "process" ? isOcr ? "Text wird erkannt …" : "PDF wird komprimiert …" : isOcr ? "Erkennen & herunterladen" : "Komprimieren & herunterladen"}</button>
        {result && <section className="pdf-processing-result" aria-label="PDF-Ergebnis"><h3>Ergebnis</h3><dl className="pdf-processing-summary"><div><dt>Vorher</dt><dd>{bytes(result.stats.input_bytes || file.size)}</dd></div><div><dt>Nachher</dt><dd>{bytes(result.file.size)}</dd></div>{!isOcr && <div className={(result.stats.saved_bytes || 0) > 0 ? "is-saving" : "is-larger"}><dt>{(result.stats.saved_bytes || 0) >= 0 ? "Gespart" : "Grösser geworden"}</dt><dd>{bytes(Math.abs(result.stats.saved_bytes || 0))} · {Math.abs(result.stats.saved_percent || 0)}%</dd></div>}{isOcr && <><div><dt>Wörter in der Textschicht</dt><dd>{result.stats.word_count.toLocaleString("de-CH")}</dd></div><div><dt>Durchsuchbare Seiten</dt><dd>{result.stats.pages_with_text} / {result.stats.page_count}</dd></div></>}</dl>{isOcr && <details><summary>ⓘ Was wird gezählt?</summary><p>Gezählt werden Wörter in der fertigen Textschicht, einschliesslich bereits vorhandenem Text. Das ist kein Nachweis der Erkennungsqualität. Vergleiche wichtige Zahlen und Begriffe mit der Originalseite.</p></details>}<a className="btn" href={result.url} download={result.file.name}>Erneut herunterladen</a></section>}
      </>}
      {busy && <p role="status" className="pdf-processing-busy"><LoaderCircle className="is-spinning" size={16} />{busy === "open" ? "PDF wird geöffnet …" : "PDF wird verarbeitet …"}</p>}
      {error && <p role="alert" className="pdf-processing-error">{error}</p>}
    </aside>
  </main>;
}
