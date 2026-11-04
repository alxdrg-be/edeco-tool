import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, FilePlus2, Info, Minus, Plus, RotateCcw, ShieldCheck, Signature, Trash2, Upload, X } from "lucide-react";
import "./pdf-mark-editor.css";

interface Props {
  mode: "sign" | "redact"; sessionKey: string; initialFile?: File;
  onDirtyChange?: (value: boolean) => void; onBusyChange?: (value: boolean) => void;
  onFilesChange?: (value: File[]) => void; onResultFiles?: (value: File[]) => void; onCertificateSign?: (file: File) => void; certificateAvailable?: boolean;
}
interface Rect { x: number; y: number; width: number; height: number }
interface Selection extends Rect { page: number; id: string; text?: string }
interface PdfDocument { id: string; name: string; page_count: number; signatures: number; pages: { page: number; width: number; height: number }[] }
interface Preview { page: number; width: number; height: number; image: string; lines: (Rect & { id: number; text: string })[]; text_limited?: boolean }
interface Template { name: string; reason: string; place: string; date: string; image: string }
const API = "/api/tools/pdf-werkstatt/mark-documents";
const TEMPLATE_KEY = "edeco-pdf-signature-appearance-v1";
const defaultTemplate = (): Template => ({ name: "", reason: "Kontrolliert", place: "", date: new Intl.DateTimeFormat("de-CH").format(new Date()), image: "" });
const initialRect: Rect = { x: .53, y: .79, width: .4, height: .1 };
const clamp = (value: number, lower = 0, upper = 1) => Math.max(lower, Math.min(upper, value));
async function responseError(response: Response): Promise<string> {
  try { const value = await response.json(); return value.detail || "Das PDF konnte nicht verarbeitet werden."; } catch { return "Das PDF konnte nicht verarbeitet werden."; }
}
function imageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source; });
}
async function appearance(template: Template): Promise<string> {
  const canvas = window.document.createElement("canvas"); canvas.width = 1200; canvas.height = 320;
  const context = canvas.getContext("2d")!;
  const fields = [template.name && `Unterschrift: ${template.name}`, template.reason && `Grund: ${template.reason}`, template.place && `Ort: ${template.place}`, template.date && `Datum: ${template.date}`].filter(Boolean);
  const textX = template.image ? 510 : 25;
  if (template.image) {
    const image = await imageElement(template.image);
    const scale = Math.min(450 / image.width, 270 / image.height);
    context.drawImage(image, 20 + (450 - image.width * scale) / 2, (320 - image.height * scale) / 2, image.width * scale, image.height * scale);
  }
  context.fillStyle = "#17262d"; context.textBaseline = "middle";
  const size = Math.min(43, 260 / Math.max(1, fields.length)); context.font = `500 ${size}px Arial, sans-serif`;
  fields.forEach((text, index) => {
    let fontSize = size;
    while (context.measureText(text).width > 1175 - textX && fontSize > 17) { fontSize -= 1; context.font = `500 ${fontSize}px Arial, sans-serif`; }
    context.fillText(text, textX, (320 - fields.length * 64) / 2 + 32 + index * 64, 1175 - textX);
    context.font = `500 ${size}px Arial, sans-serif`;
  });
  return canvas.toDataURL("image/png");
}

export default function PdfMarkEditor({ mode, sessionKey, initialFile, onDirtyChange, onBusyChange, onFilesChange, onResultFiles, onCertificateSign, certificateAvailable = false }: Props) {
  const [file, setFile] = useState<File | null>(null), [document, setDocument] = useState<PdfDocument | null>(null);
  const [pageNumber, setPageNumber] = useState(1), [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [template, setTemplate] = useState<Template>(defaultTemplate), [stamp, setStamp] = useState("");
  const [rect, setRect] = useState<Rect>(initialRect), [selections, setSelections] = useState<Selection[]>([]);
  const [selectionMode, setSelectionMode] = useState<"area" | "lines">("area"), [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Rect | null>(null), [zoom, setZoom] = useState(1), [fit, setFit] = useState({ width: 800, height: 650 });
  const [acknowledge, setAcknowledge] = useState(false), [drawing, setDrawing] = useState(false);
  const [dirty, setDirty] = useState(false), [result, setResult] = useState<{ url: string; name: string; file: File } | null>(null);
  const [confirmRedaction, setConfirmRedaction] = useState(false);
  const [rasterDpi, setRasterDpi] = useState<150 | 300>(300);
  const picker = useRef<HTMLInputElement>(null), viewport = useRef<HTMLDivElement>(null), paper = useRef<HTMLDivElement>(null), pen = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef(document), alive = useRef(true), resultRef = useRef(result), abort = useRef<AbortController | null>(null);
  const callbacks = useRef({ onDirtyChange, onBusyChange, onFilesChange, onResultFiles }); callbacks.current = { onDirtyChange, onBusyChange, onFilesChange, onResultFiles };
  const gesture = useRef<{ pointer: number; start: { x: number; y: number }; rect: Rect; moving: boolean } | null>(null);
  const penPoint = useRef<{ x: number; y: number } | null>(null);
  documentRef.current = document; resultRef.current = result;
  const headers = () => ({ "X-Edeco-Pdf": sessionKey });
  const removeSession = (id: string) => { void fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "X-Edeco-Pdf": sessionKey }, keepalive: true }).catch(() => {}); };
  function clearResult() {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    resultRef.current = null; setResult(null); setNotice("");
    // A draft redaction must never hand the confidential original to OCR or
    // another tool as if its black preview rectangles were already permanent.
    callbacks.current.onFilesChange?.(mode === "redact" ? [] : file ? [file] : []);
  }
  function edited() { setDirty(true); clearResult(); }
  useEffect(() => { callbacks.current.onDirtyChange?.(dirty); }, [dirty]);
  useEffect(() => { callbacks.current.onBusyChange?.(Boolean(busy)); }, [busy]);
  useEffect(() => { let current = true; void appearance(template).then(value => { if (current) setStamp(value); }).catch(() => { if (current) setError("Das Signaturbild konnte nicht dargestellt werden."); }); return () => { current = false; }; }, [template]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; abort.current?.abort(); if (documentRef.current) removeSession(documentRef.current.id); if (resultRef.current) URL.revokeObjectURL(resultRef.current.url); callbacks.current.onBusyChange?.(false); callbacks.current.onDirtyChange?.(false); };
    // Session ownership follows this editor instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);
  async function openFile(next: File) {
    if (!/\.pdf$/i.test(next.name) || next.size > 100 * 1024 * 1024) { setError("Bitte eine PDF-Datei mit höchstens 100 MB wählen."); return; }
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    setBusy("upload"); setError(""); setNotice("");
    try {
      const body = new FormData(); body.append("file", next);
      const response = await fetch(API, { method: "POST", headers: headers(), body, signal: controller.signal });
      if (!response.ok) throw new Error(await responseError(response));
      const value = await response.json() as PdfDocument;
      if (!alive.current || controller.signal.aborted) { removeSession(value.id); return; }
      clearResult();
      if (documentRef.current) removeSession(documentRef.current.id);
      const first = value.pages[0];
      documentRef.current = value; setDocument(value); setFile(next); setPageNumber(1); setPreview(null); setSelections([]); setRect({ ...initialRect, height: initialRect.width * first.width / first.height * 320 / 1200 }); setSearch(""); setZoom(1); setAcknowledge(false); setConfirmRedaction(false); setDirty(true);
      callbacks.current.onFilesChange?.(mode === "redact" ? [] : [next]);
    } catch (caught) { if (!controller.signal.aborted && alive.current) setError((caught as Error).message); }
    finally { if (alive.current && abort.current === controller) { setBusy(""); abort.current = null; } }
  }
  useEffect(() => { if (initialFile) void openFile(initialFile); /* host hands over one selected PDF */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);
  useEffect(() => {
    if (!document) return;
    const controller = new AbortController(); setPreview(null); setError("");
    void (async () => {
      try {
        const response = await fetch(`${API}/${encodeURIComponent(document.id)}/pages/${pageNumber}`, { headers: { "X-Edeco-Pdf": sessionKey }, signal: controller.signal });
        if (!response.ok) throw new Error(await responseError(response));
        const value = await response.json() as Preview; if (!controller.signal.aborted) setPreview(value);
      } catch (caught) { if (!controller.signal.aborted) setError((caught as Error).message); }
    })();
    return () => controller.abort();
  }, [document, pageNumber, sessionKey]);
  useEffect(() => {
    const node = viewport.current; if (!node) return;
    const observer = new ResizeObserver(entries => setFit({ width: entries[0].contentRect.width, height: entries[0].contentRect.height })); observer.observe(node); return () => observer.disconnect();
  }, [document]);
  useEffect(() => {
    if (mode !== "sign" || !preview) return;
    setRect(value => {
      let width = value.width, height = width * preview.width / preview.height * 320 / 1200;
      if (height > .4) { height = .4; width = height * preview.height / preview.width * 1200 / 320; }
      return { width, height, x: Math.min(value.x, 1 - width), y: Math.min(value.y, 1 - height) };
    });
  }, [mode, preview]);
  useEffect(() => {
    const node = viewport.current; if (!node) return;
    const wheel = (event: WheelEvent) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); event.stopPropagation(); setZoom(value => clamp(value * Math.exp(-event.deltaY / 500), .5, 5)); } };
    node.addEventListener("wheel", wheel, { passive: false }); return () => node.removeEventListener("wheel", wheel);
  }, [document]);
  function closeFile() {
    abort.current?.abort(); if (documentRef.current) removeSession(documentRef.current.id);
    documentRef.current = null; setDocument(null); setFile(null); setPreview(null); setSelections([]); setDraft(null); setSearch(""); setConfirmRedaction(false); setError(""); setDirty(false); clearResult(); callbacks.current.onFilesChange?.([]);
  }
  function point(event: ReactPointerEvent) { const box = paper.current!.getBoundingClientRect(); return { x: clamp((event.clientX - box.left) / box.width), y: clamp((event.clientY - box.top) / box.height) }; }
  function pointerDown(event: ReactPointerEvent, moving = false) {
    if (!preview || busy || event.button !== 0 || mode === "redact" && selectionMode !== "area") return;
    event.preventDefault(); event.stopPropagation(); const at = point(event); paper.current!.setPointerCapture(event.pointerId);
    gesture.current = { pointer: event.pointerId, start: at, rect, moving };
    if (mode === "redact") setDraft({ x: at.x, y: at.y, width: 0, height: 0 });
    else if (!moving) { setRect(value => ({ ...value, x: clamp(at.x - value.width / 2, 0, 1 - value.width), y: clamp(at.y - value.height / 2, 0, 1 - value.height) })); edited(); }
  }
  function pointerMove(event: ReactPointerEvent) {
    const current = gesture.current; if (!current || current.pointer !== event.pointerId) return;
    const at = point(event), dx = at.x - current.start.x, dy = at.y - current.start.y;
    if (mode === "redact") setDraft({ x: Math.min(at.x, current.start.x), y: Math.min(at.y, current.start.y), width: Math.abs(dx), height: Math.abs(dy) });
    else if (current.moving) { setRect({ ...current.rect, x: clamp(current.rect.x + dx, 0, 1 - current.rect.width), y: clamp(current.rect.y + dy, 0, 1 - current.rect.height) }); edited(); }
  }
  function pointerUp(event: ReactPointerEvent) {
    const current = gesture.current; if (!current || current.pointer !== event.pointerId) return;
    if (mode === "redact") { const at = point(event); const value = { x: Math.min(at.x, current.start.x), y: Math.min(at.y, current.start.y), width: Math.abs(at.x - current.start.x), height: Math.abs(at.y - current.start.y) };
      if (value.width > .002 && value.height > .002) { setSelections(old => [...old, { ...value, id: crypto.randomUUID(), page: pageNumber }]); edited(); }
    }
    gesture.current = null; setDraft(null); if (paper.current?.hasPointerCapture(event.pointerId)) paper.current.releasePointerCapture(event.pointerId);
  }
  function selectLine(line: Rect & { id: number; text: string }) {
    const id = `${pageNumber}:${line.id}`; setSelections(old => old.some(item => item.id === id) ? old.filter(item => item.id !== id) : [...old, { ...line, id, page: pageNumber }]); edited();
  }
  async function readImage(next: File) {
    if (!/^image\/(png|jpeg)$/.test(next.type) || next.size > 5 * 1024 * 1024) { setError("Bitte ein PNG- oder JPEG-Bild mit höchstens 5 MB wählen."); return; }
    try {
      const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(next); });
      const image = await imageElement(source); if (image.width * image.height > 8_000_000) throw new Error("Bitte ein Bild mit höchstens 8 Millionen Pixeln wählen.");
      setTemplate(value => ({ ...value, image: source })); edited(); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Das Bild konnte nicht geöffnet werden."); }
  }
  function draw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!penPoint.current || !pen.current) return;
    const box = pen.current.getBoundingClientRect(), at = { x: (event.clientX - box.left) / box.width * pen.current.width, y: (event.clientY - box.top) / box.height * pen.current.height };
    const context = pen.current.getContext("2d")!; context.strokeStyle = "#14252c"; context.lineWidth = 3; context.lineCap = "round"; context.beginPath(); context.moveTo(penPoint.current.x, penPoint.current.y); context.lineTo(at.x, at.y); context.stroke(); penPoint.current = at;
  }
  function saveTemplate() {
    try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template)); setNotice("Vorlage auf diesem Computer gespeichert."); } catch { setError("Die Vorlage konnte auf diesem Computer nicht gespeichert werden."); }
  }
  function loadTemplate() {
    try { const value = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "null") as Template | null;
      if (!value || typeof value.name !== "string" || typeof value.image !== "string" || !["", "data:image/png;base64,", "data:image/jpeg;base64,"].some(prefix => value.image === "" || prefix && value.image.startsWith(prefix))) throw new Error();
      setTemplate({ name: value.name.slice(0, 120), reason: String(value.reason || "").slice(0, 120), place: String(value.place || "").slice(0, 120), date: defaultTemplate().date, image: value.image }); edited(); setNotice("Gespeicherte Vorlage geladen.");
    } catch { setError("Auf diesem Computer ist noch keine passende Vorlage gespeichert."); }
  }
  async function exportFile() {
    if (!document || !preview || busy || document.signatures > 0 && !acknowledge || mode === "redact" && (!selections.length || !confirmRedaction)) return;
    setBusy("export"); setError(""); setNotice("");
    try {
      let body: BodyInit, requestHeaders: Record<string, string> = headers();
      if (mode === "sign") {
        const form = new FormData(); form.append("image", await (await fetch(await appearance(template))).blob(), "Signaturdarstellung.png");
        form.append("positions", JSON.stringify([{ ...rect, page: pageNumber }])); form.append("acknowledge_signatures", String(acknowledge)); body = form;
      } else { requestHeaders = { ...requestHeaders, "Content-Type": "application/json" }; body = JSON.stringify({ positions: selections.map(({ page, x, y, width, height }) => ({ page, x, y, width, height })), acknowledge_signatures: acknowledge, confirmed: confirmRedaction, dpi: rasterDpi }); }
      const response = await fetch(`${API}/${encodeURIComponent(document.id)}/${mode === "sign" ? "signature" : "redact"}`, { method: "POST", headers: requestHeaders, body });
      if (!response.ok) throw new Error(await responseError(response));
      const blob = await response.blob(); if (!alive.current) return;
      if (blob.type !== "application/pdf") throw new Error("Es wurde keine gültige PDF-Ausgabe geliefert.");
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
      const name = document.name.replace(/\.pdf$/i, "") + (mode === "sign" ? "_unterschrieben.pdf" : "_geschwaerzt.pdf");
      const next = new File([blob], name, { type: "application/pdf" });
      const value = { url: URL.createObjectURL(blob), name, file: next };
      resultRef.current = value; setResult(value); callbacks.current.onFilesChange?.([next]); callbacks.current.onResultFiles?.([next]);
      const anchor = window.document.createElement("a"); anchor.href = value.url; anchor.download = value.name; anchor.click(); setNotice("PDF erstellt und Download gestartet."); setDirty(false);
    } catch (caught) { if (alive.current) setError((caught as Error).message); }
    finally { if (alive.current) setBusy(""); }
  }
  async function certificateSign() {
    if (!file || !document || !preview || busy || !certificateAvailable || !onCertificateSign || document.signatures > 0 && !acknowledge) return;
    setBusy("certificate"); setError("");
    try {
      let next = file;
      if (template.image || template.name.trim()) {
        let blob: Blob;
        if (resultRef.current && !dirty) blob = resultRef.current.file;
        else {
          const body = new FormData(); body.append("image", await (await fetch(await appearance(template))).blob(), "Signaturdarstellung.png");
          body.append("positions", JSON.stringify([{ ...rect, page: pageNumber }])); body.append("acknowledge_signatures", String(acknowledge));
          const response = await fetch(`${API}/${encodeURIComponent(document.id)}/signature`, { method: "POST", headers: headers(), body });
          if (!response.ok) throw new Error(await responseError(response));
          blob = await response.blob();
        }
        if (blob.type !== "application/pdf") throw new Error("Die Signaturdarstellung konnte nicht übernommen werden.");
        next = new File([blob], file.name.replace(/\.pdf$/i, "") + "_unterschrieben.pdf", { type: "application/pdf" });
      }
      if (alive.current) onCertificateSign(next);
    } catch (caught) { if (alive.current) setError((caught as Error).message); }
    finally { if (alive.current) setBusy(""); }
  }
  const available = mode === "sign" ? Boolean(template.image || template.name.trim()) : selections.length > 0 && confirmRedaction;
  const factor = preview ? Math.min(fit.width / preview.width, fit.height / preview.height) * zoom : 1;
  const visibleSelections = selections.filter(value => value.page === pageNumber);
  const lines = preview?.lines.filter(line => !search.trim() || line.text.toLocaleLowerCase("de-CH").includes(search.trim().toLocaleLowerCase("de-CH"))) ?? [];
  const rectStyle = (value: Rect) => ({ left: `${value.x * 100}%`, top: `${value.y * 100}%`, width: `${value.width * 100}%`, height: `${value.height * 100}%` });
  return <section className={`pdf-mark-editor is-${mode}`} aria-label={mode === "sign" ? "Sichtbare PDF-Unterschrift" : "PDF-Inhalte schwärzen"}>
    <input ref={picker} className="pdf-mark-file-input" type="file" accept="application/pdf,.pdf" aria-label="PDF hinzufügen" onChange={event => { const next = event.target.files?.[0]; if (next) void openFile(next); event.target.value = ""; }} />
    {!document ? <div className="pdf-mark-empty" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const next = event.dataTransfer.files[0]; if (next) void openFile(next); }}>
      {mode === "sign" ? <Signature size={38} /> : <ShieldCheck size={38} />}<h2>{mode === "sign" ? "Unterschrift auf dem PDF platzieren" : "Bereiche und Textzeilen schwärzen"}</h2><p>PDF hier hineinziehen.</p><button className="btn primary" disabled={Boolean(busy)} onClick={() => picker.current?.click()}><FilePlus2 size={17} /> PDF hinzufügen</button>
      {mode === "sign" && <p className="pdf-mark-note">Eine sichtbare Unterschrift ist keine Zertifikatssignatur.</p>}
    </div> : <><div className="pdf-mark-toolbar"><strong title={document.name}>{document.name}</strong><span>{pageNumber} / {document.page_count}</span><button className="btn icon" aria-label="Vorherige PDF-Seite" disabled={pageNumber <= 1 || Boolean(busy)} onClick={() => { setPageNumber(value => value - 1); edited(); }}><ChevronLeft size={19} /></button><button className="btn icon" aria-label="Nächste PDF-Seite" disabled={pageNumber >= document.page_count || Boolean(busy)} onClick={() => { setPageNumber(value => value + 1); edited(); }}><ChevronRight size={19} /></button><button className="btn icon" aria-label="Verkleinern" onClick={() => setZoom(value => clamp(value / 1.2, .5, 5))}><Minus size={17} /></button><button className="btn" onClick={() => setZoom(1)}>Ganze Seite</button><button className="btn icon" aria-label="Vergrössern" onClick={() => setZoom(value => clamp(value * 1.2, .5, 5))}><Plus size={17} /></button><button className="btn pdf-mark-close" disabled={Boolean(busy)} aria-label="PDF schliessen" onClick={closeFile}><X size={22} /></button></div>
      <div className="pdf-mark-layout"><div ref={viewport} className="pdf-mark-viewport" tabIndex={0} data-document-zoom={zoom} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && ["+", "=", "-", "0"].includes(event.key)) { event.preventDefault(); setZoom(value => event.key === "0" ? 1 : clamp(value * (event.key === "-" ? 1 / 1.2 : 1.2), .5, 5)); } }}>
        {preview ? <div ref={paper} className="pdf-mark-paper" style={{ width: preview.width * Math.max(.05, factor), height: preview.height * Math.max(.05, factor) }} onPointerDown={event => pointerDown(event)} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { gesture.current = null; setDraft(null); }}>
          <img className="pdf-mark-original" draggable={false} src={preview.image} alt={`PDF-Seite ${pageNumber} von ${document.name}`} />
          {mode === "sign" && stamp && <div className="pdf-mark-appearance" style={rectStyle(rect)} onPointerDown={event => pointerDown(event, true)} role="img" aria-label="Signaturdarstellung verschieben" tabIndex={0} title="Ziehen oder mit den Pfeiltasten verschieben" onKeyDown={event => { if (!event.key.startsWith("Arrow")) return; event.preventDefault(); const step = event.shiftKey ? .02 : .002; setRect(value => ({ ...value, x: clamp(value.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0), 0, 1 - value.width), y: clamp(value.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0), 0, 1 - value.height) })); edited(); }}><img draggable={false} src={stamp} alt="Vorschau der sichtbaren Unterschrift" /></div>}
          {mode === "redact" && selectionMode === "lines" && lines.map(line => <button key={line.id} className="pdf-mark-text-line" style={rectStyle(line)} aria-label={`Textzeile schwärzen: ${line.text}`} title={line.text} aria-pressed={selections.some(item => item.id === `${pageNumber}:${line.id}`)} onPointerDown={event => event.stopPropagation()} onClick={() => selectLine(line)} />)}
          {visibleSelections.map(value => <span key={value.id} className="pdf-mark-redaction" style={rectStyle(value)} aria-label="Vorgemerkter Schwärzungsbereich" />)}
          {draft && <span className="pdf-mark-redaction is-draft" style={rectStyle(draft)} />}
        </div> : <p role="status">PDF-Seite wird geladen …</p>}
      </div><aside className="pdf-mark-settings"><div className="pdf-mark-fields">
        {mode === "sign" ? <><div className="pdf-mark-type"><span><Signature size={18} /> Sichtbare Unterschrift</span><button className="btn small" disabled={Boolean(busy) || !preview || !file || !onCertificateSign || !certificateAvailable || document.signatures > 0 && !acknowledge} onClick={() => void certificateSign()}><ShieldCheck size={15} /> Mit Zertifikat signieren</button></div><p className="pdf-mark-note">Bild und Angaben werden sichtbar auf die Seite gesetzt. Beim Zertifikatswechsel wird diese Darstellung vorher übernommen.</p>
          <label className="btn pdf-mark-image-upload"><Upload size={16} /> Bild / Logo hinzufügen<input type="file" accept="image/png,image/jpeg" aria-label="Signaturbild oder Logo hinzufügen" onChange={event => { const next = event.target.files?.[0]; if (next) void readImage(next); event.target.value = ""; }} /></label>
          <button className="btn small" aria-expanded={drawing} onClick={() => setDrawing(value => !value)}>Unterschrift zeichnen</button>
          {drawing && <div className="pdf-mark-drawing"><canvas ref={pen} width={600} height={180} aria-label="Unterschrift zeichnen" onPointerDown={event => { const box = event.currentTarget.getBoundingClientRect(); penPoint.current = { x: (event.clientX - box.left) / box.width * 600, y: (event.clientY - box.top) / box.height * 180 }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={draw} onPointerUp={() => { penPoint.current = null; if (pen.current) { setTemplate(value => ({ ...value, image: pen.current!.toDataURL("image/png") })); edited(); } }} onPointerCancel={() => { penPoint.current = null; }} /><button className="btn small" onClick={() => { pen.current?.getContext("2d")?.clearRect(0, 0, 600, 180); setTemplate(value => ({ ...value, image: "" })); edited(); }}>Zeichnung löschen</button></div>}
          {([['name', 'Name'], ['reason', 'Grund'], ['place', 'Ort'], ['date', 'Datum']] as const).map(([key, title]) => <label key={key}>{title}<input maxLength={120} value={template[key]} onChange={event => { setTemplate(value => ({ ...value, [key]: event.target.value })); edited(); }} /></label>)}
          <label>Breite der Darstellung<input type="range" aria-label="Breite der Signaturdarstellung" min={15} max={80} value={Math.round(rect.width * 100)} onChange={event => { const width = Number(event.target.value) / 100, height = preview ? Math.min(.4, width * preview.width / preview.height * 320 / 1200) : .1; setRect(value => ({ width, height, x: Math.min(value.x, 1 - width), y: Math.min(value.y, 1 - height) })); edited(); }} /></label>
          <div className="pdf-mark-template-actions"><button className="btn small" onClick={saveTemplate}>Vorlage merken</button><button className="btn small" onClick={loadTemplate}>Vorlage laden</button></div>
          <details><summary><Info size={15} /> Darstellung und Zertifikat</summary><p>Diese Darstellung enthält keine kryptografische Signatur. Eine Zertifikatssignatur wird über „Mit Zertifikat signieren“ erstellt. Eine qualifizierte elektronische Signatur nach ZertES ist damit nicht automatisch gegeben.</p>{!certificateAvailable && <p>Die Zertifikatfunktion wartet auf die PDF-Engine. Die sichtbare Unterschrift funktioniert bereits lokal.</p>}<p>Die Windows-ID aus einem anderen PDF-Programm wird hier nicht automatisch übernommen. Gespeicherte Bildvorlagen bleiben in diesem Browserprofil auf diesem PC.</p></details>
        </> : <><h3>Schwärzungsbereiche</h3><div className="pdf-mark-modes" role="group" aria-label="Schwärzung auswählen"><button className="btn" aria-pressed={selectionMode === "area"} onClick={() => setSelectionMode("area")}>Bereich aufziehen</button><button className="btn" aria-pressed={selectionMode === "lines"} onClick={() => setSelectionMode("lines")}>Textzeilen</button></div>
          {selectionMode === "lines" && <><label>Text auf dieser Seite suchen<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Textzeile finden …" /></label><small>{preview?.text_limited ? "Textauswahl bei dieser umfangreichen Seite begrenzt. Bereiche können weiterhin aufgezogen werden." : preview?.lines.length ? `${lines.length} Textzeilen auf dieser Seite` : "Keine Textschicht: Bereiche aufziehen oder zuerst OCR ausführen."}</small></>}
          <p>{selections.length} {selections.length === 1 ? "Bereich" : "Bereiche"} auf {new Set(selections.map(value => value.page)).size} Seiten</p>
          <div className="pdf-mark-selection-list">{selections.map((value, index) => <div key={value.id}><button className="pdf-mark-selection-jump" onClick={() => setPageNumber(value.page)}>Seite {value.page} · {value.text || `Bereich ${index + 1}`}</button><button className="btn icon pdf-mark-close" aria-label={`Bereich ${index + 1} entfernen`} onClick={() => { setSelections(old => old.filter(item => item.id !== value.id)); edited(); }}><X size={17} /></button></div>)}</div>
          <button className="btn small" disabled={!selections.length} onClick={() => { setSelections([]); edited(); }}><Trash2 size={15} /> Alle Bereiche entfernen</button>
          <div className="pdf-mark-warning"><strong>Sicher schwärzen · Bild-PDF</strong><p>Alle Seiten werden als Bild neu aufgebaut. Textsuche und Vektoren entfallen; danach ist eine neue OCR möglich.</p></div>
          <label>Bildauflösung<select aria-label="Auflösung der geschwärzten PDF" value={rasterDpi} onChange={event => { setRasterDpi(Number(event.target.value) as 150 | 300); edited(); }}><option value="300">300 DPI · hohe Qualität</option><option value="150">150 DPI · kleinere Datei</option></select></label>
          <details><summary><Info size={15} /> Wie wird geschwärzt?</summary><p>Die ausgewählten Bereiche werden nach dem Darstellen geschwärzt. Die Ausgabe enthält nur diese fertigen Bilder: keine ursprünglichen Textobjekte, Anhänge, Kommentare oder Metadaten. Auch unmarkierte Seiten erhalten eine neue Bilddarstellung, damit gemeinsam verwendete PDF-Objekte keine verdeckten Originaldaten zurücklassen.</p><p>Die Originaldatei bleibt unverändert. Sichtbare Formularfelder und Kommentare können als Bild erscheinen, sind danach aber nicht mehr bearbeitbar. Kontrolliere alle Seiten vor der Weitergabe.</p></details>
          <label className="pdf-mark-check"><input type="checkbox" checked={confirmRedaction} onChange={event => setConfirmRedaction(event.target.checked)} /> Auswahl geprüft; Bild-PDF ohne Textschicht erstellen.</label>
        </>}
        {document.signatures > 0 && <label className="pdf-mark-check pdf-mark-warning"><input type="checkbox" checked={acknowledge} onChange={event => setAcknowledge(event.target.checked)} /> Vorhandene Zertifikatssignaturen werden durch diese Bearbeitung ungültig.</label>}
        </div><div className="pdf-mark-actions">
        <button className="btn primary pdf-mark-export" disabled={!preview || Boolean(busy) || !available || document.signatures > 0 && !acknowledge} onClick={() => void exportFile()}>{busy === "export" ? "PDF wird erstellt …" : mode === "sign" ? "Unterschrift setzen & speichern" : "Schwärzen & speichern"}</button>
        {result && <a className="btn" href={result.url} download={result.name}>PDF erneut herunterladen</a>}
      </div></aside></div></>}
    <div className="pdf-mark-footer"><div className="pdf-mark-feedback" aria-live="polite" aria-atomic="true">
      {error ? <p className="pdf-mark-error" role="alert">{error}</p> : busy === "upload" ? <p className="pdf-mark-status" role="status">PDF wird geöffnet …</p> : notice ? <p className="pdf-mark-status" role="status">{notice}</p> : document ? <span>{mode === "sign" ? "Auf die Seite klicken oder die Darstellung an die gewünschte Stelle ziehen." : "Bereiche aufziehen oder Textzeilen anklicken. Die schwarzen Flächen zeigen die vorgemerkte Auswahl."}</span> : null}
    </div>{document && <button className="btn small" disabled={Boolean(busy)} onClick={() => { setRect(initialRect); setSelections([]); edited(); }}><RotateCcw size={14} /> Zurücksetzen</button>}</div>
  </section>;
}
