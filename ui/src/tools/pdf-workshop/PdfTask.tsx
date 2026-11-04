import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Minus, Plus, Scissors, Upload, X } from "lucide-react";
import { NATIVE_TASKS, isImageSource, nativePageNumbers, nativeSplitCuts, toggleNativeCut, type NativeTaskId } from "./nativeTools";
import NativePdfPreview from "./NativePdfPreview";
import "./pdf-native-workspace.css";

const API = "/api/tools/pdf-werkstatt";
interface Preview { pages: { number: number; width: number; height: number; thumbnail: string; user_unit?: number | null }[] }
interface Result { url: string; name: string; size: number; text?: string; preview?: Preview }
interface Props { tool: NativeTaskId; sessionKey: string; incomingFiles?: File[]; onDirty: () => void; onWorking: (busy: boolean) => void; onFilesChange?: (files: File[]) => void }

export default function PdfTask({ tool, sessionKey, incomingFiles, onDirty, onWorking, onFilesChange }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pages, setPages] = useState("all");
  const [cutsText, setCutsText] = useState("");
  const [each, setEach] = useState(true);
  const [dpi, setDpi] = useState(144);
  const [format, setFormat] = useState("A4");
  const [orientation, setOrientation] = useState("PORTRAIT");
  const [scale, setScale] = useState("100");
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const urls = useRef({ result: "", image: "" });
  const incoming = useRef<File[] | null>(null);
  const imageTool = tool === "images-to-pdf";
  const [imagePreview, setImagePreview] = useState("");
  const first = preview?.pages[pageIndex];
  const count = preview?.pages.length || 0;
  const cuts = nativeSplitCuts(cutsText, count, each);
  const included = nativePageNumbers(pages, count);
  const [title, description] = [NATIVE_TASKS[tool].title, NATIVE_TASKS[tool].description];
  useEffect(() => { onWorking(Boolean(busy)); return () => onWorking(false); }, [busy, onWorking]);
  useEffect(() => { onFilesChange?.(files); }, [files, onFilesChange]);
  useEffect(() => { if (incomingFiles?.length && incoming.current !== incomingFiles) { incoming.current = incomingFiles; void choose(incomingFiles); } }, [incomingFiles]);
  useEffect(() => () => { Object.values(urls.current).forEach(url => { if (url) URL.revokeObjectURL(url); }); }, []);

  function clearResult() {
    if (urls.current.result) URL.revokeObjectURL(urls.current.result);
    urls.current.result = ""; setResult(null);
  }
  function showImage(file?: File) {
    if (urls.current.image) URL.revokeObjectURL(urls.current.image);
    urls.current.image = file ? URL.createObjectURL(file) : "";
    setImagePreview(urls.current.image);
  }

  async function choose(next: File[]) {
    if (busy || !next.length) return;
    if (next.length > (imageTool ? 20 : 1) || next.some(file => file.size > 100 * 1024 * 1024) || next.reduce((sum, file) => sum + file.size, 0) > 250 * 1024 * 1024) {
      setError(imageTool ? "Bitte bis zu 20 Bilder, je höchstens 100 MB und zusammen 250 MB wählen." : "Bitte eine PDF-Datei mit höchstens 100 MB wählen."); return;
    }
    setBusy("open"); setError("");
    try {
      let nextPreview: Preview | null = null;
      if (imageTool) {
        if (next.some(file => !isImageSource(file))) throw new Error("Bitte PNG- oder JPEG-Bilder wählen.");
      } else {
        const body = new FormData(); body.append("file", next[0]);
        const response = await fetch(API + "/inspect", { method: "POST", headers: { "X-Edeco-Pdf": sessionKey }, body });
        const value = await response.json();
        if (!response.ok) throw new Error(typeof value.detail === "string" ? value.detail : "Das PDF konnte nicht geöffnet werden.");
        nextPreview = value as Preview;
      }
      clearResult(); setPreview(nextPreview); setPageIndex(0); showImage(imageTool ? next[0] : undefined);
      setFiles(next); setPages("all"); setCutsText(""); setEach(true); onDirty();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); if (picker.current) picker.current.value = ""; }
  }

  function change() { clearResult(); }
  function closeDocument() {
    if (busy) return;
    setFiles([]); setPreview(null); setPageIndex(0); setPages("all"); setCutsText(""); setEach(true);
    setZoom(1); setError(""); clearResult(); showImage(); incoming.current = null;
  }
  function moveImage(index: number, direction: number) {
    const next = [...files]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setFiles(next); change();
    showImage(next[0]);
  }
  async function run() {
    if (busy || !files.length) return;
    setBusy("export"); setError("");
    try {
      const options = tool === "split" ? { split_mode: each ? "each" : "custom", split_after: cutsText }
        : tool === "resize" ? { page_size: format, scale: Number(scale), orientation }
        : tool === "pdf-to-images" ? { pages, dpi } : tool === "pdf-to-text" ? { pages } : {};
      const body = new FormData(); files.forEach(file => body.append("files", file)); body.append("options", JSON.stringify(options));
      const response = await fetch(`${API}/process/${tool}`, { method: "POST", headers: { "X-Edeco-Pdf": sessionKey }, body });
      if (!response.ok) { const value = await response.json(); throw new Error(typeof value.detail === "string" ? value.detail : "Die Verarbeitung ist fehlgeschlagen."); }
      const blob = await response.blob();
      const ext = blob.type.includes("zip") ? "zip" : blob.type.includes("png") ? "png" : blob.type.includes("text") ? "txt" : "pdf";
      const stem = files[0].name.replace(/\.[^.]*$/, "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100);
      const url = URL.createObjectURL(blob);
      const ready: Result = { url, name: `${stem}-${tool}.${ext}`, size: blob.size, ...(ext === "txt" ? { text: await blob.text() } : {}) };
      if (ext === "pdf") {
        try {
          const body = new FormData(); body.append("file", new File([blob], ready.name, { type: "application/pdf" }));
          const previewed = await fetch(API + "/inspect", { method: "POST", headers: { "X-Edeco-Pdf": sessionKey }, body });
          if (previewed.ok) ready.preview = await previewed.json() as Preview;
        } catch { /* A preview failure never removes the successfully exported result. */ }
      }
      if (urls.current.result) URL.revokeObjectURL(urls.current.result);
      urls.current.result = url; setResult(ready);
      const link = document.createElement("a"); link.href = ready.url; link.download = ready.name;
      document.body.append(link); link.click(); link.remove();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  const valid = tool === "split" ? cuts !== null : tool === "resize" ? Number.isFinite(Number(scale)) && Number(scale) > 0 && Number(scale) <= 1000 : tool === "pdf-to-images" || tool === "pdf-to-text" ? Boolean(included?.length) : true;
  return <main className="pdf-native-task" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); event.stopPropagation(); void choose([...event.dataTransfer.files]); }}>
    <div className="pdf-native-task-heading"><h1>{title}</h1><p>{description}</p></div>
    <div className="pdf-native-task-layout"><section className="pdf-task-source" aria-label="Datei und Vorschau">
      <input ref={picker} type="file" hidden multiple={imageTool} accept={imageTool ? "image/png,image/jpeg,.png,.jpg,.jpeg" : "application/pdf,.pdf"} aria-label={imageTool ? "Bilder hinzufügen" : "PDF hinzufügen"} onChange={event => void choose([...event.target.files || []])} />
      <div className="pdf-panel-heading"><strong>{files.length ? files.map(file => file.name).join(", ") : imageTool ? "Deine Bilder" : "Dein PDF"}</strong><button className="btn" disabled={Boolean(busy)} onClick={() => picker.current?.click()}><Upload size={15} />{files.length ? "Datei wechseln" : "Datei öffnen"}</button>{files.length > 0 && <button className="btn pdf-clear-button" aria-label="Dokument schliessen" disabled={Boolean(busy)} onClick={closeDocument}><X size={19} /></button>}</div>
      {!files.length && !busy && <div className="pdf-empty-drop"><h2>{imageTool ? "Bilder hier ablegen" : "PDF hier ablegen"}</h2><button className="btn primary" onClick={() => picker.current?.click()}>Dateien auswählen</button></div>}
      {first && tool !== "split" && <><div className="pdf-preview-controls"><button className="btn" aria-label="Vorschau verkleinern" onClick={() => setZoom(value => Math.max(.5, value / 1.2))}><Minus size={15} /></button><span>{Math.round(zoom * 100)}%</span><button className="btn" aria-label="Vorschau vergrössern" onClick={() => setZoom(value => Math.min(4, value * 1.2))}><Plus size={15} /></button><button className="btn" onClick={() => setZoom(1)}>Ganze Seite</button></div>
        <NativePdfPreview file={files[0]} page={first.number} thumbnail={first.thumbnail} sessionKey={sessionKey} zoom={zoom} width={first.width} height={first.height} onZoom={setZoom} /></>}
      {imagePreview && <><div className="pdf-native-preview"><img src={imagePreview} alt="Bildvorschau" /></div><ol className="pdf-image-order">{files.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}</span><button className="btn" aria-label={`${file.name}: Nach oben`} disabled={!index || Boolean(busy)} onClick={() => moveImage(index, -1)}>↑</button><button className="btn" aria-label={`${file.name}: Nach unten`} disabled={index === files.length - 1 || Boolean(busy)} onClick={() => moveImage(index, 1)}>↓</button></li>)}</ol></>}
      {preview && <div className="pdf-visual-pages" aria-label={tool === "split" ? "Trennstellen wählen" : "Seitenvorschauen"}>{preview.pages.map(page => <div className="pdf-visual-page" key={page.number}>
        <button className={`pdf-mini-page${pageIndex === page.number - 1 ? " is-current" : ""}`} aria-label={`Seite ${page.number} ansehen`} aria-pressed={pageIndex === page.number - 1} onClick={() => setPageIndex(page.number - 1)}><img src={page.thumbnail} alt="" /><span>Seite {page.number}</span>{tool === "split" && <small>PDF {(cuts || []).filter(cut => cut < page.number).length + 1}</small>}</button>
        {tool === "split" && page.number < count && <button className={`pdf-cut-marker${cuts?.includes(page.number) ? " is-cut" : ""}`} aria-label={`Nach Seite ${page.number} trennen`} aria-pressed={cuts?.includes(page.number) || false} disabled={Boolean(busy)} onClick={() => { setCutsText(toggleNativeCut(cuts || [], page.number)); setEach(false); change(); }}><Scissors size={17} />{cuts?.includes(page.number) ? "Trennen" : "Trennstelle"}</button>}
      </div>)}</div>}
      {preview && tool !== "split" && <div className="pdf-preview-controls"><button className="btn" aria-label="Vorherige Vorschauseite" disabled={!pageIndex} onClick={() => setPageIndex(value => value - 1)}><ChevronLeft size={16} /></button><span>Seite {pageIndex + 1} von {count}</span><button className="btn" aria-label="Nächste Vorschauseite" disabled={pageIndex + 1 >= count} onClick={() => setPageIndex(value => value + 1)}><ChevronRight size={16} /></button></div>}
    </section><aside className="pdf-task-settings" aria-label="Einstellungen und Ergebnis"><h2>Einstellungen</h2><fieldset disabled={Boolean(busy)}>
      {tool === "split" && <><div className="pdf-actions"><button className="btn" onClick={() => { setEach(true); setCutsText(""); change(); }}>Jede Seite einzeln</button><button className="btn" onClick={() => { setEach(false); setCutsText(""); change(); }}>Alle zusammenlassen</button></div><label>Nach diesen Seiten trennen<input value={each ? (cuts || []).join(",") : cutsText} onChange={event => { setCutsText(event.target.value); setEach(false); change(); }} placeholder="z. B. 2,5" /></label><p>{preview ? (cuts?.length || 0) + 1 : 0} PDF-Dateien im Ergebnis</p><details><summary>ⓘ Trennstellen</summary><p>Eine Trennstelle liegt hinter der markierten Seite. Die PDF-Nummer unter jeder Miniatur zeigt die Zuordnung im ZIP-Ergebnis.</p></details></>}
      {(tool === "pdf-to-images" || tool === "pdf-to-text") && <label>Seitenbereich<input aria-label="Seitenbereich" value={pages} onChange={event => { setPages(event.target.value); change(); }} placeholder="all oder 1,3-5" /></label>}
      {tool === "pdf-to-images" && <label>Bildauflösung<select aria-label="Bildauflösung" value={dpi} onChange={event => { setDpi(Number(event.target.value)); change(); }}><option value={72}>72 DPI · Bildschirm</option><option value={144}>144 DPI · Standard</option><option value={300}>300 DPI · Druck</option></select></label>}
      {tool === "resize" && <><label>Papierformat<select aria-label="Papierformat" value={format} onChange={event => { setFormat(event.target.value); change(); }}>{["KEEP", "A0", "A1", "A2", "A3", "A4", "A5", "A6", "LETTER", "LEGAL"].map(value => <option key={value} value={value}>{value === "KEEP" ? "Bisheriges Format behalten" : value}</option>)}</select></label><label>Ausrichtung<select aria-label="Ausrichtung" value={orientation} disabled={format === "KEEP"} onChange={event => { setOrientation(event.target.value); change(); }}><option value="PORTRAIT">Hochformat</option><option value="LANDSCAPE">Querformat</option></select></label><label>Inhalt skalieren (%)<input aria-label="Inhalt skalieren (%)" type="number" min="1" max="1000" value={scale} onChange={event => { setScale(event.target.value); change(); }} /></label><details><summary>ⓘ 100 % bedeutet Originalgrösse</summary><p>Das Papierformat ändert sich unabhängig vom Inhalt. 100 % behält dessen physische Grösse bei; kleinere Seiten können Inhalt abschneiden.</p></details></>}
      {tool === "pdf-to-text" && <details><summary>ⓘ Text aus Scans</summary><p>Diese Ausgabe liest vorhandene Textschichten. Für Scans zuerst im Werkzeugkatalog „Texterkennung (OCR)“ wählen.</p></details>}
    </fieldset><button className="btn primary pdf-task-run" disabled={!files.length || Boolean(busy) || !valid} onClick={() => void run()}>{busy === "export" ? "Wird verarbeitet …" : tool === "split" ? "Teilen & herunterladen" : "Erstellen & herunterladen"}</button>
      {busy && <p role="status">{busy === "open" ? "Datei wird geöffnet …" : "Ergebnis wird erstellt …"}</p>}{error && <p className="pdf-desk-alert" role="alert">{error}</p>}
      {result && <section className="pdf-task-result" role="status"><h2>Ergebnis bereit · Download gestartet</h2><p>{result.name} · {(result.size / 1024).toFixed(0)} KB{result.preview ? ` · ${result.preview.pages.length} Seiten` : ""}</p><a className="btn primary" href={result.url} download={result.name}><Download size={16} /> Erneut herunterladen</a>{result.preview && <img className="pdf-native-result-preview" src={result.preview.pages[0].thumbnail} alt="Ergebnisvorschau" />}{result.text !== undefined && <pre>{result.text.slice(0, 20000)}</pre>}</section>}
      <p className="pdf-hint">Der Download startet nach der Verarbeitung. Originaldateien bleiben unverändert.</p>
    </aside></div>
  </main>;
}
