import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ArrowLeft, Check, Crosshair, Download, FilePlus2, FileText, Layers2, LoaderCircle, Maximize2, Minus, Plus, X } from "lucide-react";
import { csvRows } from "../../shared/csv";
import { downloadText } from "../../shared/download";
import ToolHeader from "../../toolbox/ToolHeader";
import type { ToolProps } from "../../toolbox/modules";
import { alignPair, transform, type Point } from "./geometry";
import { overlay, exportOverlay, type Overlay } from "./raster";
import { usePlanSource, type PlanSource } from "./usePlanSource";
import "./planvergleich.css";

const labels = ["A", "B", "K"] as const;
interface Pending { drawing: number; notes: number }
type Side = "old" | "newer";
type Marks = Record<Side, (Point | null)[]>;
const emptyMarks = (): Marks => ({ old: [null, null, null], newer: [null, null, null] });
const fmt = (n: number, digits = 2) => n.toLocaleString("de-CH", { maximumFractionDigits: digits });

function SourceCard({ source, title, discard }: { source: PlanSource; title: string; discard: () => boolean }) {
  const input = useRef<HTMLInputElement>(null), [drag, setDrag] = useState(false);
  return <section className="pc-source" data-loaded={!!source.doc} data-drag={drag}
    onDragOver={e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrag(true); } }}
    onDragLeave={e => { if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) setDrag(false); }}
    onDrop={e => { e.preventDefault(); setDrag(false); const file = e.dataTransfer.files[0]; if (file) void source.open(file, discard); }}>
    <input type="file" accept=".pdf,application/pdf" ref={input} aria-label={title + " als PDF"} hidden
      onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; if (file) void source.open(file, discard); }} />
    <div className="pc-source-line">
      <div className="pc-source-icon"><FileText size={21} /></div>
      <div className="pc-filename"><h2>{title}</h2>{source.doc && <span title={source.doc.name}>{source.doc.name}</span>}</div>
      {source.doc && <button type="button" className="btn pc-icon" aria-label={title + " schliessen"} title="Schliessen" onClick={() => { if (discard()) source.clear(); }}><X size={18} /></button>}
    </div>
    <div className="pc-source-actions">
      <button type="button" className="btn" disabled={source.busy} onClick={() => input.current?.click()}>
        {source.busy ? <LoaderCircle size={16} /> : <FilePlus2 size={16} />}{source.busy ? "PDF wird geöffnet …" : source.doc ? "PDF wechseln" : "PDF auswählen"}</button>
      {source.doc ? <label>Seite <select value={source.number} aria-label={title + " Seite"}
        onChange={e => { if (discard()) source.changePage(Number(e.target.value)); }}>{source.doc.pages.map(p => <option key={p.page}>{p.page}</option>)}</select> / {source.doc.pages.length}</label>
        : <span className="pc-muted">oder hier hineinziehen</span>}
    </div>
    {source.error && <p role="alert">{source.error}</p>}
    {source.previewError && <p role="alert">{source.previewError} <button type="button" className="btn" onClick={source.retry}>Erneut laden</button></p>}
    {source.doc && !source.image && !source.previewError && <span role="status">Seite wird gerendert …</span>}
  </section>;
}

function MarkPage({ image, title, marks, pick, zoom }: {
  image: HTMLImageElement; title: string; marks: (Point | null)[]; pick: (p: Point) => void; zoom: number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 320, height: 320 });
  useEffect(() => {
    const box = viewport.current; if (!box) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(box); return () => observer.disconnect();
  }, []);
  const scale = Math.min((size.width - 14) / image.width, (size.height - 14) / image.height) * zoom;
  return <section className="pc-mark"><h3>{title}</h3><div className="pc-mark-scroll" ref={viewport}>
    <div className="pc-paper" style={{ width: Math.max(1, image.width * scale), height: Math.max(1, image.height * scale) }}
      onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect();
        pick({ x: (event.clientX - rect.left) / rect.width * image.width, y: (event.clientY - rect.top) / rect.height * image.height });
      }}>
      <img src={image.src} alt={title} draggable={false} />
      {marks.map((p, i) => p && <span className="pc-cross" key={i} style={{ left: p.x / image.width * 100 + "%", top: p.y / image.height * 100 + "%" }}><b>{labels[i]}</b></span>)}
    </div></div></section>;
}

function Zoom({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <div className="pc-zoom" aria-label="Planzoom">
    <button type="button" className="btn pc-icon" disabled={value <= 1} aria-label="Verkleinern" onClick={() => onChange(Math.max(1, value / 1.5))}><Minus size={15} /></button>
    <button type="button" className="btn pc-icon" title="Einpassen" aria-label="Ganzes Blatt" onClick={() => onChange(1)}><Maximize2 size={15} /></button>
    <button type="button" className="btn pc-icon" disabled={value >= 5} aria-label="Vergrössern" onClick={() => onChange(Math.min(5, value * 1.5))}><Plus size={15} /></button>
  </div>;
}

function Result({ output, backward, exportPdf, exportList, saving, reviewed, setReviewed, notes, setNotes, checkLabel }: {
  output: Overlay; backward: () => void; exportPdf: () => void; exportList: () => void; notes: Record<number, string>; setNotes: (value: Record<number, string>) => void; saving: boolean; checkLabel: string;
  reviewed: Set<number>; setReviewed: (value: Set<number>) => void;
}) {
  const [mode, setMode] = useState<"old" | "both" | "newer">("both"), [zoom, setZoom] = useState(1);
  const [selected, select] = useState<number | null>(null);
  const paper = useRef<HTMLDivElement>(null), container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 420 });
  useEffect(() => {
    const node = container.current; if (!node) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => { const host = paper.current; host?.replaceChildren(output[mode]); }, [output, mode]);
  const region = selected === null ? null : output.regions[selected];
  const scale = Math.min((size.width - 16) / output.both.width, (size.height - 16) / output.both.height) * zoom;
  useEffect(() => {
    const box = container.current;
    if (region && box && paper.current) {
      const plan = paper.current.getBoundingClientRect(), viewport = box.getBoundingClientRect();
      box.scrollLeft += plan.left - viewport.left + (region.left + region.right) / 2 * plan.width - box.clientWidth / 2;
      box.scrollTop += plan.top - viewport.top + (region.top + region.bottom) / 2 * plan.height - box.clientHeight / 2;
    }
  }, [region, scale]);
  return <>
    <div className="pc-toolbar">
      <button type="button" className="btn" onClick={backward}><ArrowLeft size={16} /> Ausrichtung</button>
      <div className="pc-segments" aria-label="Vergleichsansicht">{([["old", "Alt"], ["both", "Überlagerung"], ["newer", "Neu"]] as const).map(([id, name]) =>
        <button type="button" key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>{name}</button>)}</div>
      <Zoom value={zoom} onChange={setZoom} />
      <button type="button" className="btn pc-list-export" onClick={exportList}><Download size={16} />Änderungsliste (CSV)</button>
      <button type="button" className="btn pc-primary" disabled={saving} onClick={exportPdf}><Download size={16} />{saving ? "Erstellt …" : "Vergleichs-PDF"}</button>
    </div>
    <div className="pc-results">
      <section className="pc-overlay" aria-label="Vergleich der Planstände"><div className="pc-legend">
        {mode === "both" ? <><span><i className="pc-red" />Entfernt</span><span><i className="pc-blue" />Neu</span><span><i className="pc-gray" />Gleich</span></> : <span>{mode === "old" ? "Alter Planstand" : "Neuer Planstand"}</span>}
      </div><div className="pc-result-scroll" ref={container}>
        <div className="pc-overlay-inner" style={{ width: Math.max(1, scale * output.both.width), height: Math.max(1, scale * output.both.height) }}>
          <div ref={paper} className="pc-canvas" />
          {region && <div className="pc-region" style={{ left: region.left * 100 + "%", top: region.top * 100 + "%", width: (region.right - region.left) * 100 + "%", height: (region.bottom - region.top) * 100 + "%" }} />}
        </div></div></section>
      <aside className="pc-review"><h3>Änderungsbereiche <span>{output.regions.length}</span></h3>
        <p className="pc-muted">{output.regions.length ? "Wähle einen Bereich zur Sichtprüfung." : "In dieser Auflösung wurden keine abweichenden Linien erkannt."}</p>
        <details><summary>Was wird verglichen?</summary><p>Das Werkzeug vergleicht gerasterte Linien. Verschiebungen innerhalb der gewählten Rastertoleranz erscheinen grau. Feine Details und reine Farbwechsel können unentdeckt bleiben. Kleine Abweichungen der Passpunkte können zusätzliche Bereiche erzeugen.</p></details>
        <p>{checkLabel}</p>
        <div className="pc-findings">{output.regions.map((_, i) => <button type="button" key={i} aria-pressed={selected === i}
          onClick={() => { select(i); setMode("both"); setZoom(2); }}>Bereich {i + 1} {reviewed.has(i) ? <Check size={15} aria-label="Gesehen" /> : null}</button>)}</div>
        {selected !== null && <label className="pc-note">Raum / Vermerk<input maxLength={300} value={notes[selected] || ""} onChange={e => setNotes({ ...notes, [selected]: e.target.value })} /></label>}
        {selected !== null && <label className="pc-check"><input type="checkbox" checked={reviewed.has(selected)} onChange={e => {
          const next = new Set(reviewed); if (e.target.checked) next.add(selected); else next.delete(selected); setReviewed(next);
        }} />Bereich {selected + 1} gesichtet</label>}
      </aside>
    </div>
  </>;
}

function Pair({ old, newer, pending }: { old: PlanSource; newer: PlanSource; pending: RefObject<Pending> }) {
  const [marks, setMarks] = useState<Marks>(emptyMarks), [point, setPoint] = useState(0), [zoom, setZoom] = useState(1);
  const [tolerance, setTolerance] = useState(2);
  const [scaleInput, setScaleInput] = useState(""), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const [output, setOutput] = useState<Overlay | null>(null), [reviewed, setReviewed] = useState(new Set<number>());
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [oldA, oldB, oldK] = marks.old, [newA, newB, newK] = marks.newer;
  let alignment = null, problem = "";
  if (oldA && oldB && newA && newB) {
    try { alignment = alignPair(oldA, oldB, newA, newB); } catch (caught) { problem = (caught as Error).message; }
  }
  let checkLabel = "Kontrollpunkt K offen";
  if (alignment && oldK && newK && old.image && old.page) {
    const p = transform(newK, alignment), dx = p.x - oldK.x, dy = p.y - oldK.y;
    const unit = old.page.user_unit, denominator = Number(scaleInput);
    if (unit && unit > 0) {
      const mm = Math.hypot(dx * old.page.width / old.image.width, dy * old.page.height / old.image.height) * unit * 25.4 / 72;
      checkLabel = `K: ${fmt(mm)} mm auf Papier` + (denominator > 0 && Number.isFinite(denominator) ? ` · ${fmt(mm * denominator, 1)} mm im Gebäude (1:${fmt(denominator)})` : "");
    } else checkLabel = `K: ${fmt(Math.hypot(dx, dy))} px · Papiermass unbekannt`;
  }
  function pick(side: Side, position: Point) {
    if (point < 2 && (reviewed.size || Object.values(notes).some(Boolean)) &&
      !window.confirm("Eine neue Ausrichtung verwirft die Sichtvermerke zu den bisherigen Bereichen. Fortfahren?")) return;
    pending.current.drawing++;
    const coordinates = [...marks[side]]; coordinates[point] = position;
    const both = { ...marks, [side]: coordinates };
    setMarks(both); setError(""); if (point < 2) { setReviewed(new Set()); setNotes({}); pending.current.notes = 0; }
    if (both.old[point] && both.newer[point] && point < 2) setPoint(point + 1);
  }
  async function save() {
    if (!output || !old.doc || !newer.doc) return;
    const draft = pending.current, revision = draft.drawing;
    setSaving(true); setError("");
    try {
      await exportOverlay(output, { key: old.doc.key, old: `${old.doc.name} · S. ${old.number}`, newer: `${newer.doc.name} · S. ${newer.number}`,
        reviewed, report: `${output.regions.length} Änderungsbereiche · ${reviewed.size} gesichtet · Toleranz ${tolerance} px · ${checkLabel}` });
      if (draft.drawing === revision) draft.drawing = 0;
    } catch (caught) { setError((caught as Error).message); }
    finally { setSaving(false); }
  }
  function saveList() {
    const oldPlan = old.doc?.name, newPlan = newer.doc?.name;
    if (!output || !oldPlan || !newPlan) return;
    const rows = output.regions.map((region, index) => [
      index + 1, reviewed.has(index) ? "Gesichtet" : "Offen", notes[index] || "",
      ...[region.left, region.top, region.right, region.bottom].map(value => Number((value * 100).toFixed(2))),
      oldPlan, old.number, newPlan, newer.number, tolerance, checkLabel,
    ]);
    downloadText("Planvergleich-Bereiche.csv", csvRows([
      ["Bereich", "Sichtprüfung", "Raum / Vermerk", "Links (%)", "Oben (%)", "Rechts (%)", "Unten (%)", "Alter Plan", "Seite alt", "Neuer Plan", "Seite neu", "Rastertoleranz (px)", "Lagekontrolle"],
      ...rows,
    ]), "text/csv;charset=utf-8");
    pending.current.notes = 0;
  }
  if (!old.image || !newer.image) return null;
  return <section className="pc-work" aria-label="Planvergleich">
    {error && <p role="alert">{error}</p>}
    {output ? <Result output={output} notes={notes} setNotes={value => { setNotes(value); pending.current.notes++; }}
      exportList={saveList} reviewed={reviewed} setReviewed={value => { setReviewed(value); pending.current.drawing++; }} backward={() => setOutput(null)} exportPdf={() => void save()} saving={saving} checkLabel={`${checkLabel} · Toleranz ${tolerance} px`} /> : <>
      <div className="pc-toolbar"><h2><Crosshair size={18} /> Passpunkte setzen</h2>
        <div className="pc-segments">{labels.map((l, i) => <button type="button" key={l} aria-label={i === 2 ? "Kontrollpunkt K" : "Passpunkt " + l}
          aria-pressed={point === i} onClick={() => setPoint(i)}>{l}{marks.old[i] && marks.newer[i] && <Check size={13} />}</button>)}</div>
        <Zoom value={zoom} onChange={setZoom} />
        <label className="pc-tolerance" title="Linienversatz bis zu diesem Abstand im Vergleichsbild wird als gleich dargestellt.">Rastertoleranz
          <select value={tolerance} onChange={e => {
            if ((reviewed.size || Object.values(notes).some(Boolean)) && !window.confirm("Eine andere Rastertoleranz gruppiert die Bereiche neu. Bisherige Sichtvermerke verwerfen?")) return;
            setTolerance(Number(e.target.value)); setReviewed(new Set()); setNotes({}); pending.current.notes = 0;
            if (marks.old.some(Boolean) || marks.newer.some(Boolean)) pending.current.drawing++;
          }}><option value={0}>0 px · exakt</option><option value={1}>1 px</option><option value={2}>2 px · Standard</option></select>
        </label>
        <button type="button" className="btn pc-primary" disabled={!alignment} onClick={() => {
          if (!alignment || !old.image || !newer.image) return;
          try { setOutput(overlay(old.image, newer.image, alignment, tolerance)); } catch (e) { setError((e as Error).message); }
        }}><Layers2 size={16} />Vergleichen</button>
      </div>
      <p className="pc-instruction">{point === 2 ? "K ist optional. Wähle dieselbe dritte Stelle in beiden Plänen zur unabhängigen Lagekontrolle." :
        `Klicke denselben Referenzpunkt ${labels[point]} im alten und im neuen Plan an.`}</p>
      <div className="pc-pair"><MarkPage zoom={zoom} image={old.image} title="Alter Planstand" marks={marks.old} pick={p => pick("old", p)} />
        <MarkPage zoom={zoom} image={newer.image} title="Neuer Planstand" marks={marks.newer} pick={p => pick("newer", p)} /></div>
      <div className="pc-status"><span>{problem || checkLabel}</span><label>Massstab alter Plan · 1 : <input type="number" min="1" placeholder="optional" value={scaleInput} onChange={e => { setScaleInput(e.target.value); pending.current.drawing++; }} /></label></div>
    </>}
  </section>;
}

export default function Planvergleich({ onHome, onOpenTool }: ToolProps) {
  const old = usePlanSource(), newer = usePlanSource();
  const pending = useRef<Pending>({ drawing: 0, notes: 0 });
  function discard() {
    const { drawing, notes } = pending.current;
    if ((drawing || notes) && !window.confirm("Ausrichtung oder Sichtvermerke wurden noch nicht vollständig exportiert. Änderungen verwerfen?")) return false;
    pending.current = { drawing: 0, notes: 0 };
    return true;
  }
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pending.current.drawing || pending.current.notes) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  return <div className="pc-app"><ToolHeader title="Planvergleich" currentToolId="planvergleich" onHome={() => { if (discard()) onHome(); }}
      onOpenTool={onOpenTool ? id => { if (discard()) onOpenTool(id); } : undefined} />
    <main className="pc-main" style={{ "--pc-color": "var(--toolhub-accent, var(--accent))" } as CSSProperties}>
      <div className="pc-head"><h1>Planvergleich</h1><p>Alten und neuen PDF-Plan über zwei Passpunkte ausrichten.</p></div>
      <div className="pc-sources"><SourceCard title="Alter Stand" source={old} discard={discard} /><SourceCard title="Neuer Stand" source={newer} discard={discard} /></div>
      {old.image && newer.image && <Pair key={[old.doc?.id, old.number, newer.doc?.id, newer.number].join(":")} old={old} newer={newer} pending={pending} />}
    </main></div>;
}
