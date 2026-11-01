import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PdfTool } from "./tools";
import { PdfToolIcon } from "./tools";

const API = "/api/tools/pdf-werkstatt";
interface Preview { pages: { number: number; width: number; height: number; thumbnail: string }[] }
interface Result { url: string; name: string; size: number; text?: string; preview?: Preview }
const defaults = { pages: "all", split_after: "", angle: 90, top: 0, bottom: 0, left: 0, right: 0, page_size: "A4", scale: 100, orientation: "PORTRAIT", quality: 5, dpi: 144, languages: ["deu", "eng"], force_ocr: false, split_mode: "each", crop_box: null as number[] | null };
type Options = typeof defaults;

function size(bytes: number) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export default function PdfTask({ tool, sessionKey, onDirty, onWorking }: { tool: PdfTool; sessionKey: string; onDirty: () => void; onWorking: (busy: boolean) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [options, setOptions] = useState<Options>(defaults);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const cropDrag = useRef<{x: number; y: number} | null>(null);
  const [cropScope, setCropScope] = useState("all");
  const picker = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const imageTool = tool.id === "images-to-pdf";
  const first = preview?.pages[previewPage];
  useEffect(() => { onWorking(Boolean(busy)); return () => onWorking(false); }, [busy, onWorking]);
  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);

  async function inspect(file: File): Promise<Preview> {
    const body = new FormData(); body.append("file", file);
    const response = await fetch(API + "/inspect", { method: "POST", headers: { "X-Edeco-Pdf": sessionKey }, body });
    const value = await response.json();
    if (!response.ok) throw new Error(value.detail || "Die Vorschau konnte nicht erstellt werden.");
    return value as Preview;
  }

  async function choose(incoming: File[]) {
    if (busy || !incoming.length) return;
    if (incoming.length > (imageTool ? 20 : 1) || incoming.some(file => file.size > 100 * 1024 * 1024) || incoming.reduce((sum, file) => sum + file.size, 0) > 250 * 1024 * 1024) { setError(imageTool ? "Bitte bis zu 20 Bilder, je höchstens 100 MB und insgesamt 250 MB wählen." : "Bitte genau ein PDF mit höchstens 100 MB wählen."); return; }
    setBusy("preview"); setError(""); setResult(null); setPreview(null); setImagePreview(""); setPreviewPage(0);
    urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current = [];
    onDirty();
    try {
      if (imageTool) {
        if (incoming.some(file => !['image/png', 'image/jpeg'].includes(file.type) && !((!file.type || file.type === 'application/octet-stream') && /\.(png|jpe?g)$/i.test(file.name)))) throw new Error("Bitte PNG- oder JPEG-Bilder wählen.");
        const url = URL.createObjectURL(incoming[0]); urls.current.push(url); setImagePreview(url);
      } else setPreview(await inspect(incoming[0]));
      setFiles(incoming);
    } catch (e) { setFiles([]); setError((e as Error).message); }
    finally { setBusy(""); if (picker.current) picker.current.value = ""; }
  }

  function reorder(index: number, direction: number) {
    const next = [...files]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; setFiles(next); setResult(null);
    const url = URL.createObjectURL(next[0]); urls.current.push(url); setImagePreview(url);
  }

  function set<K extends keyof Options>(key: K, value: Options[K]) { setOptions(previous => ({ ...previous, [key]: value, ...(key === "page_size" && value === "KEEP" ? { orientation: "PORTRAIT" } : {}) })); setResult(null); }

  async function run(event: React.FormEvent) {
    event.preventDefault(); if (busy || !files.length) return;
    setBusy("process"); setError(""); setResult(null);
    try {
      const body = new FormData(); files.forEach(file => body.append("files", file)); body.append("options", JSON.stringify({ ...options, ...(tool.id === "crop" && cropScope === "page" ? { pages: String(previewPage + 1) } : {}) }));
      const response = await fetch(`${API}/process/${tool.id}`, { method: "POST", headers: { "X-Edeco-Pdf": sessionKey }, body });
      if (!response.ok) { const value = await response.json(); throw new Error(typeof value.detail === "string" ? value.detail : "Die Verarbeitung konnte nicht abgeschlossen werden."); }
      const blob = await response.blob(); const extension = response.headers.get("content-disposition")?.match(/\.([a-z]+)"/)?.[1] || "pdf";
      const stem = files[0].name.replace(/\.[^.]*$/, "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100);
      const name = `${stem}-${tool.id}.${extension}`;
      const url = URL.createObjectURL(blob); urls.current.push(url);
      const value: Result = { url, name, size: blob.size };
      if (extension === "txt") value.text = await blob.text();
      if (extension === "pdf") { try { value.preview = await inspect(new File([blob], name, { type: "application/pdf" })); } catch { /* The verified PDF remains available even if its preview fails. */ } }
      setResult(value);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  function cropPoint(event: React.PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return {x: Math.max(0, Math.min(1, (event.clientX-box.left)/box.width)), y: Math.max(0, Math.min(1, (event.clientY-box.top)/box.height))};
  }
  function drawCrop(event: React.PointerEvent<HTMLDivElement>) {
    if (!cropDrag.current || busy) return;
    const start = cropDrag.current, end = cropPoint(event);
    const box = [Math.min(start.x,end.x), Math.min(start.y,end.y), Math.max(start.x,end.x), Math.max(start.y,end.y)];
    if (box[2]-box[0] >= .01 && box[3]-box[1] >= .01) set("crop_box",box);
  }
  const rangeIncludes = (value: string, number: number) => value.trim() === "all" || value.split(',').some(part=>{const [start,end]=part.trim().split('-').map(Number);return number>=start&&number<=(end||start);});
  const cuts = preview ? preview.pages.slice(0,-1).filter(page=>options.split_mode === "each" && !options.split_after || rangeIncludes(options.split_after,page.number)).map(page=>page.number) : [];

  const selectablePages = tool.id === "pdf-to-images" || tool.id === "crop" && cropScope === "range";
  const included = preview?.pages.filter(page=>rangeIncludes(options.pages,page.number)).map(page=>page.number) || [];
  function togglePage(number: number) { set("pages",(included.includes(number) ? included.filter(n=>n!==number) : [...included,number].sort((a,b)=>a-b)).join(',')); }
  function toggleCut(number: number) {
    const next = cuts.includes(number) ? cuts.filter(n=>n!==number) : [...cuts,number].sort((a,b)=>a-b);
    setOptions(previous=>({...previous,split_mode:"custom",split_after:next.join(',')})); setResult(null);
  }
  const cropMargins = first && options.crop_box ? {top:Math.round(options.crop_box[1]*first.height*25.4/72*10)/10,bottom:Math.round((1-options.crop_box[3])*first.height*25.4/72*10)/10,left:Math.round(options.crop_box[0]*first.width*25.4/72*10)/10,right:Math.round((1-options.crop_box[2])*first.width*25.4/72*10)/10} : {top:options.top,bottom:options.bottom,left:options.left,right:options.right};
  const margins: CSSProperties | undefined = tool.id === "crop" && first ? options.crop_box ? {left:`${options.crop_box[0]*100}%`,top:`${options.crop_box[1]*100}%`,right:`${(1-options.crop_box[2])*100}%`,bottom:`${(1-options.crop_box[3])*100}%`} : { top: `${options.top * 72 / 25.4 / first.height * 100}%`, bottom: `${options.bottom * 72 / 25.4 / first.height * 100}%`, left: `${options.left * 72 / 25.4 / first.width * 100}%`, right: `${options.right * 72 / 25.4 / first.width * 100}%` } : undefined;
  return <main className="pdf-task"><div className="pdf-task-heading"><span className="pdf-tool-symbol"><PdfToolIcon id={tool.id} /></span><div><h1>{tool.title}</h1><p>{tool.description}</p></div></div>
    <div className="pdf-task-layout"><section className="pdf-task-source" aria-label="Datei und Vorschau" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void choose([...event.dataTransfer.files]); }}>
      <div className="pdf-panel-heading"><h2>{imageTool ? "Deine Bilder" : "Dein PDF"}</h2><button className="btn" disabled={Boolean(busy)} onClick={() => picker.current?.click()}>{files.length ? "Dateien wechseln" : "Dateien auswählen"}</button></div>
      <input ref={picker} hidden type="file" multiple={imageTool} accept={imageTool ? "image/png,image/jpeg,.png,.jpg,.jpeg" : "application/pdf,.pdf"} aria-label={imageTool ? "Bilder hinzufügen" : "PDF hinzufügen"} onChange={event => void choose([...event.target.files || []])} />
      {!files.length && !busy && <div className="pdf-task-drop"><PdfToolIcon id={tool.id} /><h2>{imageTool ? "Bilder hier ablegen" : "PDF hier ablegen"}</h2><p>{imageTool ? "PNG oder JPEG · bis zu 20 Bilder" : "Ein PDF · bis zu 100 Seiten und 100 MB"}</p><button className="btn primary" onClick={() => picker.current?.click()}>Dateien auswählen</button></div>}
      {files.length > 0 && <><div className="pdf-task-files">{files.map((file, index) => <div key={`${file.name}-${index}`}><span><strong>{index + 1}. {file.name}</strong><small>{size(file.size)}</small></span>{imageTool && <span><button className="btn small" aria-label={`${file.name}: Nach oben`} disabled={!index || Boolean(busy)} onClick={() => reorder(index, -1)}>↑</button><button className="btn small" aria-label={`${file.name}: Nach unten`} disabled={index === files.length - 1 || Boolean(busy)} onClick={() => reorder(index, 1)}>↓</button></span>}</div>)}</div>
        {first && tool.id !== "split" && <div className="pdf-task-preview"><div className={`pdf-task-preview-page ${tool.id === "crop" ? "pdf-crop-canvas" : ""}`} aria-label={tool.id === "crop" ? "Zuschnittbereich aufziehen" : undefined}
          onPointerDown={event=>{if(tool.id!=="crop" || busy || event.button!==0)return; event.preventDefault(); cropDrag.current=cropPoint(event); event.currentTarget.setPointerCapture(event.pointerId);}}
          onPointerMove={event=>drawCrop(event)} onPointerUp={event=>{drawCrop(event);cropDrag.current=null;}} onPointerCancel={()=>{cropDrag.current=null;}}
          style={{ aspectRatio: `${first.width}/${first.height}` }}><img src={first.thumbnail} alt={`Vorschau Seite ${first.number}`} />{margins && <span className="pdf-crop-overlay" style={margins} />}</div></div>}
        {imagePreview && <div className="pdf-task-preview"><img className="pdf-task-image" src={imagePreview} alt="Bildvorschau" /></div>}
        {preview && selectablePages && <div className="pdf-task-pages"><button type="button" className="btn small" disabled={Boolean(busy)} onClick={()=>set("pages","all")}>Alle Seiten auswählen</button><button type="button" className="btn small" disabled={Boolean(busy)} onClick={()=>set("pages","")}>Auswahl leeren</button><span>{included.length} ausgewählt</span></div>}
        {preview && <div className="pdf-visual-pages" aria-label={tool.id === "split" ? "Trennstellen wählen" : "Seitenvorschauen"}>{preview.pages.map(page=><div className="pdf-visual-page" key={page.number}>
          <button type="button" className={`pdf-mini-page ${previewPage===page.number-1 ? "is-current" : ""}`} disabled={Boolean(busy)} aria-label={`Seite ${page.number} ansehen`} aria-pressed={previewPage===page.number-1} onClick={()=>setPreviewPage(page.number-1)}><img src={page.thumbnail} alt=""/><span>Seite {page.number}</span>{tool.id === "split" && <small>PDF {cuts.filter(n=>n<page.number).length+1}</small>}</button>
          {selectablePages && <label className="pdf-page-checkbox"><input type="checkbox" aria-label={`Seite ${page.number} ${tool.id === "crop" ? "zuschneiden" : "ausgeben"}`} checked={included.includes(page.number)} disabled={Boolean(busy)} onChange={()=>togglePage(page.number)}/>Verwenden</label>}
          {tool.id === "split" && page.number<preview.pages.length && <button type="button" className={`pdf-cut-marker ${cuts.includes(page.number) ? "is-cut" : ""}`} aria-label={`Nach Seite ${page.number} trennen`} aria-pressed={cuts.includes(page.number)} disabled={Boolean(busy)} onClick={()=>toggleCut(page.number)}>{cuts.includes(page.number) ? "✂ Trennen" : "+ Trennstelle"}</button>}</div>)}</div>}
        {preview && <div className="pdf-task-pages"><button className="btn small" disabled={!previewPage || Boolean(busy)} onClick={() => setPreviewPage(previewPage - 1)}>←</button><span>Seite {previewPage + 1} von {preview.pages.length}</span><button className="btn small" disabled={previewPage === preview.pages.length - 1 || Boolean(busy)} onClick={() => setPreviewPage(previewPage + 1)}>→</button></div>}</>}
    </section>
    <section className="pdf-task-settings" aria-label="Einstellungen und Ergebnis"><h2>Einstellungen</h2><form onSubmit={run}>
      <fieldset disabled={Boolean(busy)}>
        {tool.id === "split" && <><p className="pdf-hint">Klicke zwischen zwei Vorschaubildern auf die Trennstelle. Die PDF-Nummern zeigen, welche Seiten zusammenbleiben.</p><div className="pdf-actions"><button type="button" className="btn" onClick={()=>{set("split_mode","each");set("split_after","");}}>Jede Seite einzeln</button><button type="button" className="btn" onClick={()=>{set("split_mode","custom");set("split_after","");}}>Alle zusammenlassen</button></div><strong>{preview ? cuts.length+1 : 0} PDF-Dateien im Ergebnis</strong><label>Nach diesen Seiten trennen<input aria-label="Nach diesen Seiten trennen" className="input" value={options.split_mode === "each" ? cuts.join(",") : options.split_after} onChange={event => {set("split_after", event.target.value);set("split_mode","custom");}} placeholder="z. B. 2,5 · leer = keine Trennstelle" /><small>Die Trennstelle liegt jeweils hinter der angegebenen Seite. Ausgabe als ZIP mit einzelnen PDFs.</small></label></>}
        {tool.id === "rotate" && <label>Drehung<select aria-label="Drehung" value={options.angle} onChange={event => set("angle", Number(event.target.value))}><option value="90">90° im Uhrzeigersinn</option><option value="180">180°</option><option value="270">90° gegen den Uhrzeigersinn</option></select><small>Wird auf alle Seiten angewendet. Einzelne Seiten lassen sich unter „PDFs organisieren“ drehen.</small></label>}
        {tool.id === "crop" && <><p>Ziehe auf der Vorschau einen Rahmen um den Bereich, der bleiben soll. Zum Ändern einen neuen Rahmen aufziehen. Alternativ die Ränder unten genau eingeben.</p><button type="button" className="btn" onClick={()=>{set("crop_box",null);(["top","bottom","left","right"] as const).forEach(key=>set(key,0));}}>Ganze Seite wiederherstellen</button><label>Anwenden auf<select aria-label="Zuschnitt anwenden auf" value={cropScope} onChange={event=>setCropScope(event.target.value)}><option value="all">Alle Seiten · gleicher relativer Bereich</option><option value="page">Nur die angezeigte Seite</option><option value="range">Ausgewählte Seiten</option></select></label><details><summary>Ränder genau eingeben (mm)</summary><div className="pdf-margin-fields">{([['top', 'Oben'], ['bottom', 'Unten'], ['left', 'Links'], ['right', 'Rechts']] as const).map(([key, label]) => <label key={key}>{label} (mm)<input className="input" type="number" min="0" max="1000" step="0.1" required value={cropMargins[key]} onChange={event => {setOptions(previous=>({...previous,...cropMargins,crop_box:null,[key]:Number(event.target.value)}));setResult(null);}} /></label>)}</div></details><p className="pdf-hint">Der Rahmen zeigt den sichtbaren Bereich nach dem Zuschnitt. Inhalte ausserhalb können im PDF erhalten bleiben; dies ist keine Schwärzung.</p></>}
        {((tool.id === "crop" && cropScope === "range") || tool.id === "pdf-to-images") && <label>Seitenbereich<input aria-label="Seitenbereich" className="input" required value={options.pages} onChange={event => set("pages", event.target.value)} placeholder="all oder 1,3-5" /><small>„all“ für alle Seiten oder z. B. 1,3-5.</small></label>}
        {tool.id === "resize" && <><label>Papierformat<select aria-label="Papierformat" value={options.page_size} onChange={event => set("page_size", event.target.value)}>{['KEEP', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'LETTER', 'LEGAL'].map(value => <option key={value} value={value}>{value === "KEEP" ? "Bisheriges Seitenformat behalten" : value}</option>)}</select></label><label>Ausrichtung<select aria-label="Ausrichtung" disabled={options.page_size === "KEEP"} value={options.orientation} onChange={event => set("orientation", event.target.value)}><option value="PORTRAIT">Hochformat</option><option value="LANDSCAPE">Querformat</option></select></label><label>Inhalt skalieren (%)<input aria-label="Inhalt skalieren (%)" className="input" type="number" min="1" max="1000" step="1" required value={options.scale} onChange={event => set("scale", Number(event.target.value))} /><small>100 % behält die Inhaltsgrösse bei. Das Papierformat wird unabhängig davon eingestellt.</small></label></>}
        {tool.id === "compress" && <label>Kompressionsstufe<select aria-label="Kompressionsstufe" value={options.quality} onChange={event => set("quality", Number(event.target.value))}><option value="2">Schonend · höhere Bildqualität</option><option value="5">Ausgewogen</option><option value="8">Stark · kleinere Bilder</option></select><small>Die erreichbare Verkleinerung hängt vom PDF ab. Stärkere Kompression kann die Bildqualität reduzieren.</small></label>}
        {tool.id === "pdf-to-images" && <label>Bildauflösung<select aria-label="Bildauflösung" value={options.dpi} onChange={event => set("dpi", Number(event.target.value))}><option value="72">72 DPI · Bildschirm</option><option value="144">144 DPI · Standard</option><option value="300">300 DPI · Druck</option></select><small>Eine Seite ergibt ein PNG, mehrere Seiten eine ZIP mit PNG-Bildern.</small></label>}
        {tool.id === "images-to-pdf" && <p className="pdf-hint">Jedes Bild wird zu einer PDF-Seite. Die Reihenfolge links bestimmt die Reihenfolge im Ergebnis.</p>}
        {tool.id === "pdf-to-text" && <p className="pdf-hint">Extrahiert vorhandenen Text als UTF-8-TXT. Bei eingescannten Seiten ohne Textschicht zuerst die Texterkennung verwenden.</p>}
        {tool.id === "ocr" && <><div className="pdf-ocr-languages"><span>Sprachen</span>{([['deu', 'Deutsch'], ['eng', 'Englisch']] as const).map(([id, label]) => <label key={id}><input type="checkbox" checked={options.languages.includes(id)} onChange={event => set("languages", event.target.checked ? [...options.languages, id] : options.languages.filter(value => value !== id))} />{label}</label>)}</div><label className="pdf-ocr-force"><input type="checkbox" checked={options.force_ocr} onChange={event => set("force_ocr", event.target.checked)} />Vorhandene Textschicht neu erkennen</label><p className="pdf-hint">Ohne diese Option werden Seiten mit vorhandener Textschicht übersprungen. Erkennung erfolgt lokal mit Tesseract.</p></>}
      </fieldset>
      <button className="btn primary pdf-task-run" disabled={!files.length || Boolean(busy) || tool.id === "ocr" && !options.languages.length || selectablePages && !included.length} type="submit">{busy === "process" ? "Wird verarbeitet …" : "Ergebnis erstellen"}</button>
    </form>
    {busy && <p className="pdf-desk-progress" role="status">{busy === "preview" ? "Datei wird geöffnet …" : tool.id === "ocr" ? "Texterkennung läuft. Bei vielen Seiten kann dies einige Zeit dauern …" : "PDF wird auf diesem Computer verarbeitet …"}</p>}
    {error && <p className="pdf-desk-alert" role="alert">{error}</p>}
    {result && <div className="pdf-task-result" role="status"><h2>✓ Ergebnis bereit</h2><p>{result.name}</p><p className="pdf-hint">{size(result.size)}{result.preview ? ` · ${result.preview.pages.length} Seiten` : ""}{tool.id === "compress" ? ` · vorher ${size(files[0].size)}${result.size < files[0].size ? ` · ${Math.round((1 - result.size / files[0].size) * 100)} % kleiner` : " · keine Verkleinerung erreicht"}` : ""}</p>
      <a className="btn primary" href={result.url} download={result.name}>Ergebnis herunterladen</a>
      {result.preview && <img className="pdf-task-result-preview" src={result.preview.pages[0].thumbnail} alt="Ergebnisvorschau" />}
      {result.text !== undefined && <pre className="pdf-text-result">{result.text.slice(0, 20000)}</pre>}
    </div>}
    <p className="pdf-hint">Das Ergebnis separat herunterladen. Deine Originaldateien bleiben unverändert.</p>
    </section></div>
  </main>;
}
