import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Crop, Download, FilePlus2, Hand, Maximize, Minus, Plus, RotateCcw, Upload } from "lucide-react";
import { FULL_CROP, clampCrop, constrainCrop, cropMargins, cropPageRange, cropPoint, drawCrop, equalCrop,
  fitCropZoom, marginsCrop, moveCrop, resizeCrop, type CropHandle, type CropMargins, type CropPoint, type CropRect, type CropSize } from "./cropGeometry";
import "./pdf-crop-editor.css";

interface Props { sessionKey: string; onBack: () => void; initialFile?: File; onDirtyChange?: (dirty: boolean) => void }
interface CropPage extends CropSize { page: number; rotation: number; user_unit?: number | null }
interface CropDocument { id: string; name: string; page_count: number; pages: CropPage[] }
type MarginDraft = Record<keyof CropMargins, string>;
interface Gesture {
  pointer: number; mode: "draw" | "move" | "resize" | "pan"; handle?: CropHandle;
  client: CropPoint; point: CropPoint; rect: CropRect; scroll: CropPoint; moved: boolean;
}
const API = "/api/tools/pdf-werkstatt/crop-documents";
const POINTS_TO_MM = 25.4 / 72;
const HANDLE_POSITIONS: { key: CropHandle; x: number; y: number; label: string }[] = [
  { key: "nw", x: 0, y: 0, label: "Obere linke Ecke" }, { key: "n", x: .5, y: 0, label: "Oberer Rand" },
  { key: "ne", x: 1, y: 0, label: "Obere rechte Ecke" }, { key: "e", x: 1, y: .5, label: "Rechter Rand" },
  { key: "se", x: 1, y: 1, label: "Untere rechte Ecke" }, { key: "s", x: .5, y: 1, label: "Unterer Rand" },
  { key: "sw", x: 0, y: 1, label: "Untere linke Ecke" }, { key: "w", x: 0, y: .5, label: "Linker Rand" },
];
const format = (number: number, precision = 2) => new Intl.NumberFormat("de-CH", { maximumFractionDigits: precision, useGrouping: false }).format(number);
const physicalFactor = (page: CropPage) => typeof page.user_unit === "number" && Number.isFinite(page.user_unit) && page.user_unit > 0 ? page.user_unit : 1;
const ratioFor = (aspect: string, page: CropSize) => aspect === "portrait" ? 210 / 297 : aspect === "landscape" ? 297 / 210 : aspect === "original" ? page.width / page.height : null;
async function errorText(response: Response, fallback: string): Promise<string> {
  try { const data = await response.json(); return typeof data.detail === "string" ? data.detail : fallback; } catch { return fallback; }
}
function downloadName(response: Response, original: string): string {
  const disposition = response.headers.get("Content-Disposition") || "";
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) { try { return decodeURIComponent(encoded[1]); } catch { /* Use the plain filename. */ } }
  return /filename="([^"]+)"/i.exec(disposition)?.[1] || original.replace(/\.pdf$/i, "") + "_zugeschnitten.pdf";
}

export default function PdfCropEditor({ sessionKey, onBack, initialFile, onDirtyChange }: Props) {
  const [document, setDocument] = useState<CropDocument | null>(null), [pageNumber, setPageNumber] = useState(1);
  const [rects, setRects] = useState<Record<number, CropRect>>({}), [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<{ id: string; page: number; url: string } | null>(null);
  const [busy, setBusy] = useState<"" | "upload" | "save">(""), [previewBusy, setPreviewBusy] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [zoom, setZoom] = useState(1), [fit, setFit] = useState<"page" | "width" | null>("page");
  const [size, setSize] = useState({ width: 800, height: 650 }), [hand, setHand] = useState(false), [space, setSpace] = useState(false);
  const [aspect, setAspect] = useState("free"), [scope, setScope] = useState("current"), [range, setRange] = useState("");
  const [marginDraft, setMarginDraft] = useState<MarginDraft | null>(null);
  const fileInput = useRef<HTMLInputElement>(null), viewport = useRef<HTMLDivElement>(null), sheet = useRef<HTMLDivElement>(null);
  const docRef = useRef(document), pageRef = useRef<CropPage | null>(null), rectRef = useRef<CropRect>({ ...FULL_CROP }), zoomRef = useRef(zoom);
  const uploadRequest = useRef<AbortController | null>(null), saveRequest = useRef<AbortController | null>(null), zoomFrame = useRef<number | null>(null);
  const dirtyCallback = useRef(onDirtyChange), gesture = useRef<Gesture | null>(null);
  const touches = useRef(new Map<number, CropPoint>()), pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const descriptionId = `crop-description-${useId().replaceAll(":", "")}`;
  const page = document?.pages.find(item => item.page === pageNumber) ?? null, rect = rects[pageNumber] ?? FULL_CROP;
  docRef.current = document; pageRef.current = page; rectRef.current = rect; zoomRef.current = zoom; dirtyCallback.current = onDirtyChange;
  const hasPhysicalSize = Boolean(page && (page.user_unit === undefined || typeof page.user_unit === "number" && Number.isFinite(page.user_unit) && page.user_unit > 0));
  const pageMm = page ? { width: page.width * physicalFactor(page) * POINTS_TO_MM, height: page.height * physicalFactor(page) * POINTS_TO_MM } : null;
  const marginUnit = hasPhysicalSize ? "mm" : "%", ruler = hasPhysicalSize && pageMm ? pageMm : { width: 100, height: 100 };
  const headers = useCallback(() => ({ "X-Edeco-Pdf": sessionKey }), [sessionKey]);
  const clearDocument = useCallback((id: string) => { void fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE", headers: headers(), keepalive: true }).catch(() => {}); }, [headers]);

  const loadFile = useCallback(async (file: File, signal?: AbortSignal) => {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { setError("Bitte eine PDF-Datei auswählen."); return; }
    uploadRequest.current?.abort(); const controller = new AbortController(); uploadRequest.current = controller;
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    setBusy("upload"); setError(""); setNotice("");
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch(API, { method: "POST", headers: headers(), body, signal: controller.signal });
      if (!response.ok) throw new Error(await errorText(response, "Das PDF konnte nicht geöffnet werden."));
      const next = await response.json() as CropDocument;
      if (!next || typeof next.id !== "string" || typeof next.name !== "string" || !Array.isArray(next.pages) || !next.pages.length || !Number.isInteger(next.page_count)
        || next.pages.some(item => !Number.isInteger(item.page) || item.page < 1 || !Number.isFinite(item.width) || !Number.isFinite(item.height) || item.width <= 0 || item.height <= 0)) throw new Error("Die PDF-Seitenangaben konnten nicht gelesen werden.");
      if (controller.signal.aborted) { clearDocument(next.id); return; }
      const previous = docRef.current;
      docRef.current = next; setDocument(next); setPageNumber(1); setRects({}); setAspect("free"); setScope("current"); setRange("");
      setMarginDraft(null); setFit("page"); setDirty(true); gesture.current = null; touches.current.clear(); pinch.current = null;
      if (previous) clearDocument(previous.id);
    } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Das PDF konnte nicht geöffnet werden."); }
    finally { if (uploadRequest.current === controller) { setBusy(""); uploadRequest.current = null; } }
  }, [headers, clearDocument]);

  useEffect(() => { if (!initialFile) return; const controller = new AbortController(); void loadFile(initialFile, controller.signal); return () => controller.abort(); }, [initialFile, loadFile]);
  useEffect(() => { dirtyCallback.current?.(dirty); }, [dirty]);
  useEffect(() => () => {
    uploadRequest.current?.abort(); saveRequest.current?.abort();
    if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
    if (docRef.current) clearDocument(docRef.current.id); dirtyCallback.current?.(false);
  }, [clearDocument]);
  useEffect(() => {
    if (!document || !page) return;
    const controller = new AbortController(); let objectUrl = "";
    setPreviewBusy(true); setError("");
    void (async () => {
      try {
        const response = await fetch(`${API}/${encodeURIComponent(document.id)}/pages/${page.page}?width=2500`, { headers: headers(), signal: controller.signal });
        if (!response.ok) throw new Error(await errorText(response, "Die Seitenvorschau konnte nicht geladen werden."));
        const blob = await response.blob(); if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob); setPreview({ id: document.id, page: page.page, url: objectUrl });
      } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Die Vorschau fehlt."); }
      finally { if (!controller.signal.aborted) setPreviewBusy(false); }
    })();
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [document, page, headers]);
  useEffect(() => {
    if (!document || !viewport.current) return;
    const observer = new ResizeObserver(entries => { const box = entries[0].contentRect; if (box.width && box.height) setSize({ width: box.width, height: box.height }); });
    observer.observe(viewport.current); return () => observer.disconnect();
  }, [document]);
  useEffect(() => {
    if (!page || !fit) return;
    const factor = physicalFactor(page); setZoom(fitCropZoom({ width: page.width * factor, height: page.height * factor }, size, fit));
    if (viewport.current) { viewport.current.scrollTop = 0; viewport.current.scrollLeft = 0; }
  }, [page, size, fit]);

  const zoomTo = useCallback((value: number, client?: CropPoint) => {
    const holder = viewport.current, element = sheet.current, metadata = pageRef.current;
    const factor = metadata ? physicalFactor(metadata) : 1;
    const maximum = metadata ? Math.min(8, 2_000_000 / (Math.max(metadata.width, metadata.height) * factor * 96 / 72)) : 8;
    const next = Math.max(1e-9, Math.min(maximum, value));
    let anchor: CropPoint | null = null, pointer: CropPoint | null = null;
    if (holder && element) {
      const box = holder.getBoundingClientRect(), at = client ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      anchor = cropPoint(at, element.getBoundingClientRect()); pointer = { x: at.x - box.left - holder.clientLeft, y: at.y - box.top - holder.clientTop };
    }
    setFit(null); setZoom(next); zoomRef.current = next;
    if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
    zoomFrame.current = requestAnimationFrame(() => {
      const current = viewport.current, paper = sheet.current;
      if (current && paper && anchor && pointer) {
        current.scrollLeft = paper.offsetLeft + anchor.x * paper.offsetWidth - pointer.x;
        current.scrollTop = paper.offsetTop + anchor.y * paper.offsetHeight - pointer.y;
      }
      zoomFrame.current = null;
    });
  }, []);
  useEffect(() => {
    const holder = viewport.current; if (!holder || !document) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault(); event.stopPropagation(); gesture.current = null;
      zoomTo(zoomRef.current * Math.exp(-event.deltaY * .002), { x: event.clientX, y: event.clientY });
    };
    holder.addEventListener("wheel", wheel, { passive: false }); return () => holder.removeEventListener("wheel", wheel);
  }, [document, zoomTo]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".pdf-crop-editor") || event.target.closest("input,textarea,select,[contenteditable='true']")) return;
      if (event.code === "Space" && event.target.closest("[data-document-zoom]")) { event.preventDefault(); setSpace(true); }
      if ((event.ctrlKey || event.metaKey) && event.target.closest("[data-document-zoom]") && ["+", "=", "-", "0"].includes(event.key)) {
        event.preventDefault(); zoomTo(event.key === "0" ? 1 : zoomRef.current * (event.key === "-" ? 1 / 1.2 : 1.2));
      }
    };
    const up = (event: KeyboardEvent) => { if (event.code === "Space") setSpace(false); };
    const blur = () => { setSpace(false); gesture.current = null; touches.current.clear(); pinch.current = null; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); };
  }, [zoomTo]);

  function updateRect(value: CropRect, clearDraft = true) {
    const next = clampCrop(value); rectRef.current = next;
    setRects(old => ({ ...old, [pageNumber]: next })); setDirty(true); setNotice(""); if (clearDraft) setMarginDraft(null);
  }
  function pointAt(event: { clientX: number; clientY: number }) { return cropPoint({ x: event.clientX, y: event.clientY }, sheet.current!.getBoundingClientRect()); }
  function start(event: ReactPointerEvent, mode?: Gesture["mode"], handle?: CropHandle) {
    if (busy || !sheet.current || !viewport.current || !rendered || event.button > 1) return;
    event.preventDefault(); event.stopPropagation();
    const focus = event.currentTarget instanceof HTMLElement && event.currentTarget.matches("button,[tabindex]") ? event.currentTarget : viewport.current;
    focus.focus({ preventScroll: true });
    viewport.current.setPointerCapture(event.pointerId);
    if (event.pointerType === "touch") {
      touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (touches.current.size >= 2) {
        const [a, b] = [...touches.current.values()];
        if (gesture.current && gesture.current.mode !== "pan") updateRect(gesture.current.rect);
        gesture.current = null; pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomRef.current }; return;
      }
    }
    gesture.current = { pointer: event.pointerId, mode: hand || space || event.button === 1 ? "pan" : mode ?? "draw", handle,
      client: { x: event.clientX, y: event.clientY }, point: pointAt(event), rect: { ...rectRef.current },
      scroll: { x: viewport.current.scrollLeft, y: viewport.current.scrollTop }, moved: false };
  }
  function move(event: ReactPointerEvent) {
    if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch.current && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()];
      zoomTo(pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.current.distance), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); return;
    }
    const active = gesture.current; if (!active || active.pointer !== event.pointerId || !page) return;
    const dx = event.clientX - active.client.x, dy = event.clientY - active.client.y;
    if (!active.moved && Math.hypot(dx, dy) < 4) return; active.moved = true;
    if (active.mode === "pan") { viewport.current!.scrollLeft = active.scroll.x - dx; viewport.current!.scrollTop = active.scroll.y - dy; return; }
    const at = pointAt(event), delta = { x: at.x - active.point.x, y: at.y - active.point.y };
    if (active.mode === "move") updateRect(moveCrop(active.rect, delta));
    else {
      const next = active.mode === "resize" ? resizeCrop(active.rect, active.handle!, delta) : drawCrop(active.point, at);
      updateRect(constrainCrop(next, ratioFor(aspect, page), page));
    }
  }
  function end(event: ReactPointerEvent) {
    touches.current.delete(event.pointerId);
    if (pinch.current) { if (touches.current.size < 2) pinch.current = null; gesture.current = null; }
    if (gesture.current?.pointer === event.pointerId) gesture.current = null;
    if (viewport.current?.hasPointerCapture(event.pointerId)) viewport.current.releasePointerCapture(event.pointerId);
  }
  function cancel(event: ReactPointerEvent) {
    if (gesture.current?.pointer === event.pointerId && gesture.current.mode !== "pan" && gesture.current.moved) updateRect(gesture.current.rect);
    end(event);
  }
  function handleKey(event: ReactKeyboardEvent, handle?: CropHandle) {
    if (!page || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? 10 : 1, factor = physicalFactor(page);
    const delta = { x: (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0) / (page.width * factor * 96 / 72),
      y: (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0) / (page.height * factor * 96 / 72) };
    updateRect(handle ? constrainCrop(resizeCrop(rectRef.current, handle, delta), ratioFor(aspect, page), page) : moveCrop(rectRef.current, delta));
  }
  const actualMargins = cropMargins(rect, ruler);
  const marginValues: MarginDraft = marginDraft ?? Object.fromEntries(Object.entries(actualMargins).map(([key, value]) => [key, format(value)])) as MarginDraft;
  function readMargins(draft: MarginDraft): CropRect | null {
    const values = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim() && /^\d*(?:[.,]\d*)?$/.test(value.trim()) ? Number(value.replace(",", ".")) : NaN])) as unknown as CropMargins;
    return marginsCrop(values, ruler);
  }
  const marginError = marginDraft && !readMargins(marginDraft) ? `Bitte gültige Ränder in ${marginUnit} eingeben. Die gegenüberliegenden Ränder dürfen die Seite nicht vollständig abdecken.` : "";
  function editMargin(key: keyof CropMargins, value: string) {
    const next = { ...marginValues, [key]: value }; setMarginDraft(next); const crop = readMargins(next);
    if (crop) { setAspect("free"); updateRect(crop, false); }
  }
  const rangePages = cropPageRange(range, document?.page_count ?? 0);
  const rendered = Boolean(document && page && preview?.id === document.id && preview.page === page.page);
  async function save() {
    if (!document || !rendered || busy || marginError || scope === "range" && !rangePages) return;
    const controller = new AbortController(); saveRequest.current = controller; setBusy("save"); setDirty(true); setError(""); setNotice("");
    const pages = scope === "all" ? "all" : scope === "range" ? rangePages! : [pageNumber];
    try {
      const response = await fetch(`${API}/${encodeURIComponent(document.id)}/crop`, { method: "POST", headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ pages, rect }), signal: controller.signal });
      if (!response.ok) throw new Error(await errorText(response, "Der Ausschnitt konnte nicht gespeichert werden."));
      const blob = await response.blob(); if (controller.signal.aborted) return;
      const name = downloadName(response, document.name), url = URL.createObjectURL(blob), anchor = window.document.createElement("a");
      anchor.href = url; anchor.download = name; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      const applied = pages === "all" ? document.pages.map(item => item.page) : pages;
      const remaining = Object.entries(rects).some(([number, value]) => !applied.includes(Number(number)) && !equalCrop(value, FULL_CROP));
      setRects(old => ({ ...old, ...Object.fromEntries(applied.map(number => [number, { ...rect }])) }));
      setDirty(remaining); setNotice(`Gespeichert: ${name}`);
    } catch (caught) { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Zuschneiden fehlgeschlagen."); }
    finally { if (saveRequest.current === controller) { saveRequest.current = null; setBusy(""); } }
  }
  function changePage(number: number) { gesture.current = null; touches.current.clear(); pinch.current = null; setPageNumber(number); setMarginDraft(null); setAspect("free"); }
  function fileChanged(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) void loadFile(file); event.target.value = ""; }
  const pageWidth = page ? page.width * physicalFactor(page) * 96 / 72 * zoom : 0, pageHeight = page ? page.height * physicalFactor(page) * 96 / 72 * zoom : 0;

  return <section className="pdf-crop-editor" aria-label="PDF zuschneiden">
    <input ref={fileInput} className="pdf-crop-file" type="file" accept="application/pdf,.pdf" aria-label="PDF zum Zuschneiden hinzufügen" onChange={fileChanged} />
    <div className="pdf-crop-toolbar"><div><button type="button" className="btn" onClick={onBack} disabled={Boolean(busy)}><ArrowLeft size={16} />Werkzeugauswahl</button><span><strong>PDF zuschneiden</strong>{document && <small title={document.name}>{document.name}</small>}</span></div>
      {document && <div><button type="button" className="btn" onClick={() => fileInput.current?.click()} disabled={Boolean(busy)}><FilePlus2 size={16} />Datei wechseln</button><div className="pdf-crop-page-navigation"><button type="button" aria-label="Vorherige PDF-Seite" disabled={pageNumber <= 1 || Boolean(busy)} onClick={() => changePage(pageNumber - 1)}><ChevronLeft size={17} /></button><label>Seite<select aria-label="PDF-Seite wählen" value={pageNumber} disabled={Boolean(busy)} onChange={event => changePage(Number(event.target.value))}>{document.pages.map(item => <option key={item.page} value={item.page}>{item.page}</option>)}</select><span>/ {document.page_count}</span></label><button type="button" aria-label="Nächste PDF-Seite" disabled={pageNumber >= document.page_count || Boolean(busy)} onClick={() => changePage(pageNumber + 1)}><ChevronRight size={17} /></button></div></div>}
    </div>
    {!document ? <div className="pdf-crop-import" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file && !busy) void loadFile(file); }}><Upload size={38} /><h2>PDF zum Zuschneiden hinzufügen</h2><p>Datei hier ablegen oder auswählen.</p><button type="button" className="btn primary" disabled={Boolean(busy)} onClick={() => fileInput.current?.click()}>{busy === "upload" ? "PDF wird geöffnet …" : "PDF auswählen"}</button>{error && <p role="alert" className="pdf-error">{error}</p>}</div>
      : <div className="pdf-crop-workspace"><div className={`pdf-crop-viewport${hand || space ? " is-hand" : ""}`} ref={viewport} data-document-zoom="true" data-crop-zoom={zoom} tabIndex={0} aria-label="PDF-Arbeitsfläche: Ausschnitt ziehen, Strg und Mausrad zum Zoomen" onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onPointerDown={event => { if (event.target === event.currentTarget || (event.target as Element).classList.contains("pdf-crop-surface")) start(event, "pan"); }}>
        {page && <div className="pdf-crop-surface" style={{ width: Math.max(size.width, pageWidth + 64), height: Math.max(size.height, pageHeight + 64) }}><div ref={sheet} className="pdf-crop-page" style={{ width: pageWidth, height: pageHeight, left: Math.max(32, (size.width - pageWidth) / 2), top: Math.max(32, (size.height - pageHeight) / 2) }} onPointerDown={event => start(event)}>
          {rendered && <img src={preview!.url} alt={`PDF-Seite ${page.page} von ${document.name}`} draggable={false} />}
          {rendered && <><div className="pdf-crop-mask" style={{ left: 0, top: 0, width: "100%", height: `${rect.y * 100}%` }} /><div className="pdf-crop-mask" style={{ left: 0, top: `${(rect.y + rect.height) * 100}%`, width: "100%", height: `${Math.max(0, 1 - rect.y - rect.height) * 100}%` }} /><div className="pdf-crop-mask" style={{ left: 0, top: `${rect.y * 100}%`, width: `${rect.x * 100}%`, height: `${rect.height * 100}%` }} /><div className="pdf-crop-mask" style={{ left: `${(rect.x + rect.width) * 100}%`, top: `${rect.y * 100}%`, width: `${Math.max(0, 1 - rect.x - rect.width) * 100}%`, height: `${rect.height * 100}%` }} />
            <div className={`pdf-crop-selection${equalCrop(rect, FULL_CROP) ? " is-full" : ""}`} data-testid="pdf-crop-selection" role="group" tabIndex={0} aria-label="Zuschneidebereich" aria-describedby={descriptionId} style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }} onKeyDown={event => handleKey(event)} onPointerDown={event => start(event, equalCrop(rect, FULL_CROP) ? undefined : "move")}><span className="pdf-crop-selection-label">Ausschnitt</span>
              {HANDLE_POSITIONS.map(handle => <button type="button" key={handle.key} className={`pdf-crop-handle pdf-crop-handle-${handle.key}`} style={{ left: `${handle.x * 100}%`, top: `${handle.y * 100}%` }} aria-label={`${handle.label} des Ausschnitts verschieben`} aria-describedby={descriptionId} onPointerDown={event => start(event, "resize", handle.key)} onKeyDown={event => handleKey(event, handle.key)} />)}
            </div></>}
        </div></div>}
        {(previewBusy || busy === "upload") && <div className="pdf-crop-loading" role="status">{busy === "upload" ? "PDF wird geöffnet …" : "Seite wird geladen …"}</div>}
      </div><aside className="pdf-crop-settings"><h2>Ausschnitt</h2>{page && <>
        <label className="pdf-crop-label">Seitenverhältnis<select aria-label="Seitenverhältnis" value={aspect} disabled={Boolean(busy)} onChange={event => { const next = event.target.value; setAspect(next); updateRect(constrainCrop(rect, ratioFor(next, page), page)); }}><option value="free">Frei</option><option value="portrait">A4 Hochformat</option><option value="landscape">A4 Querformat</option><option value="original">Wie die Seite</option></select></label>
        <fieldset className="pdf-crop-margins"><legend>Ränder ({marginUnit})</legend>{([["top", "Oben"], ["bottom", "Unten"], ["left", "Links"], ["right", "Rechts"]] as const).map(([key, label]) => <label key={key}>{label}<input aria-label={`Rand ${label.toLowerCase()} (${marginUnit})`} inputMode="decimal" maxLength={24} value={marginValues[key]} disabled={Boolean(busy)} aria-invalid={Boolean(marginError)} onChange={event => editMargin(key, event.target.value)} onBlur={() => { if (marginDraft && readMargins(marginDraft)) setMarginDraft(null); }} /></label>)}</fieldset>
        {marginError && <p role="alert" className="pdf-error">{marginError}</p>}<p className="pdf-crop-size">Ausschnitt: {hasPhysicalSize && pageMm ? `${format(rect.width * pageMm.width)} × ${format(rect.height * pageMm.height)} mm` : `${format(rect.width * 100)} × ${format(rect.height * 100)} %`}</p>
        {!hasPhysicalSize && <p className="pdf-crop-hint">Der physische Seitenmassstab ist nicht eindeutig; die Ränder werden relativ angezeigt.</p>}
        <label className="pdf-crop-label">Anwenden auf<select aria-label="Anwenden auf" value={scope} disabled={Boolean(busy)} onChange={event => setScope(event.target.value)}><option value="current">Diese Seite</option><option value="all">Alle Seiten</option><option value="range">Seitenbereich</option></select></label>
        {scope === "range" && <label className="pdf-crop-label">Seitenbereich<input aria-label="Seitenbereich" value={range} maxLength={500} placeholder="z. B. 1, 3–5" onChange={event => setRange(event.target.value)} aria-invalid={!rangePages} /></label>}{scope !== "current" && <p className="pdf-crop-hint">Der gezeigte Ausschnitt wird mit gleichen relativen Rändern übernommen.</p>}
        <button type="button" className="btn primary pdf-crop-save" onClick={() => void save()} disabled={Boolean(busy) || !rendered || Boolean(marginError) || scope === "range" && !rangePages}><Download size={17} />{busy === "save" ? "PDF wird erstellt …" : "Zuschneiden & speichern"}</button>
        <button type="button" className="btn pdf-crop-reset" disabled={Boolean(busy)} onClick={() => { setAspect("free"); updateRect({ ...FULL_CROP }); }}><RotateCcw size={15} />Auswahl zurücksetzen</button>
        <details className="pdf-crop-info"><summary>ⓘ Bedienung</summary><p id={descriptionId}>Rahmen ziehen oder an den Griffen anpassen. Strg + Mausrad zoomt nur das PDF. Leertaste + Ziehen verschiebt die Ansicht. Pfeiltasten bewegen den gewählten Ausschnitt oder Griff, mit Umschalt zehnmal so weit.</p><p>Das Original bleibt unverändert. Für verschiedene Seiten werden die Auswahlen einzeln gemerkt. Bei allen Seiten oder einem Seitenbereich wird der aktuell gezeigte Ausschnitt relativ übertragen.</p></details>
      </>}{error && <p role="alert" className="pdf-error">{error}</p>}{notice && <p role="status" className="pdf-crop-saved">{notice}</p>}</aside>
      <div className="pdf-crop-zoom" aria-label="PDF-Zoom"><button type="button" aria-label="PDF-Ansicht verschieben" aria-pressed={hand} onClick={() => setHand(value => !value)}><Hand size={17} /></button><button type="button" aria-label="Ausschnitt bearbeiten" aria-pressed={!hand} onClick={() => setHand(false)}><Crop size={17} /></button><span className="pdf-crop-zoom-divider" /><button type="button" aria-label="PDF verkleinern" onClick={() => zoomTo(zoom / 1.2)}><Minus size={17} /></button><button type="button" className="pdf-crop-percent" aria-label="PDF auf 100 Prozent" onClick={() => zoomTo(1)}>{format(zoom * 100, 0)} %</button><button type="button" aria-label="PDF vergrössern" onClick={() => zoomTo(zoom * 1.2)}><Plus size={17} /></button><span className="pdf-crop-zoom-divider" /><button type="button" aria-pressed={fit === "width"} onClick={() => setFit("width")}>Breite</button><button type="button" aria-pressed={fit === "page"} onClick={() => setFit("page")}><Maximize size={15} />Ganze Seite</button></div>
    </div>}
  </section>;
}
