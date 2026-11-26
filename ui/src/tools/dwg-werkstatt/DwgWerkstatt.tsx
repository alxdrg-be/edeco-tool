import { useEffect, useRef, useState } from "react";
import { Archive, ArrowDownToLine, CircleAlert, FileText, FolderOpen, Layers3, LoaderCircle, Plus, SlidersHorizontal, X } from "lucide-react";
import ToolHeader from "../../toolbox/ToolHeader";
import type { ToolProps } from "../../toolbox/modules";
import { readJson, responseError } from "../../shared/http";
import { downloadBlob } from "../../shared/download";
import { protocolPdf } from "./protocolPdf";
import { useDialogFocus } from "../../shared/useDialogFocus";
import { auditOnly, parseProfiles, standard, validProfile, weights, type LayerAction, type LayerRule, type NamedProfile, type Profile } from "./profile";
import "./dwg-werkstatt.css";

interface Preview {
  insertion_base?: [number, number, number];
  before_svg: string; after_svg: string; unit: string; layers: string[]; extent: { width: number; height: number } | null;
  stats: { grey_layers: number; hidden_layers: number; wipeouts_removed: number; text_backgrounds_removed: number; audit_fixes?: number; audit_errors?: number };
  issues: string[];
}
interface Source { file: File | null; settings: NamedProfile }
type View = "vergleich" | "vorher" | "nachher";
const ROOT = "/api/dwg-workshop";
const STORAGE = "edeco.dwg-werkstatt.bueroprofile.v1";
const actions: Record<LayerAction, string> = { keep: "Original", grey: "Grau", hide: "Ausblenden" };
const fmt = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 });
const nameOf = (source: Source) => source.file?.name ?? "Beispielgrundriss.dxf";
const baseName = (source: Source) => nameOf(source).replace(/\.(?:dwg|dxf)$/i, "");

function bodyOf(source: Source) {
  const data = new FormData();
  if (source.file) data.set("file", source.file);
  data.set("profile", JSON.stringify(source.settings.profile));
  return data;
}

function editorCopy(named: NamedProfile): NamedProfile {
  return { name: named === standard || named === auditOnly ? "" : named.name, profile: {
    ...named.profile, rules: named.profile.rules.map(rule => ({ ...rule })),
  } };
}

function ProfileEditor({ settings, names, layers, onClose, onSave }: {
  settings: NamedProfile; names: string[]; layers: string[]; onClose: () => void; onSave: (value: NamedProfile) => string | undefined;
}) {
  const [initial] = useState(() => editorCopy(settings));
  const [draft, setDraft] = useState(initial);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const [error, setError] = useState("");
  const sheet = useRef<HTMLDivElement>(null);
  function close() {
    if (!dirty || window.confirm("Ungespeicherte Änderungen am Büroprofil verwerfen?")) onClose();
  }
  useDialogFocus(sheet, close);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const update = (changes: Partial<Profile>) => setDraft(value => ({ ...value, profile: { ...value.profile, ...changes } }));
  function updateRule(i: number, patch: Partial<LayerRule>) {
    update({ rules: draft.profile.rules.map((rule, index) => index === i ? { ...rule, ...patch } : rule) });
  }
  function save() {
    const name = draft.name.trim();
    const reservedOrUsed = name === standard.name || name === auditOnly.name || names.includes(name);
    if (!name || (reservedOrUsed && name !== initial.name)) { setError("Bitte einen eigenen, eindeutigen Profilnamen eingeben."); return; }
    if (!validProfile(draft.profile)) { setError("Bitte für jede Regel einen Layernamen oder einen Teil davon eingeben."); return; }
    const message = onSave({ name, profile: { ...draft.profile, rules: draft.profile.rules.map(r => ({ ...r, contains: r.contains.trim() })) } });
    if (message) setError(message);
  }
  return <div className="dwg-overlay"><div className="dwg-dialog" role="dialog" aria-modal="true" aria-labelledby="dwg-edit-heading" ref={sheet} tabIndex={-1}>
    <header><h2 id="dwg-edit-heading">Büroprofil bearbeiten</h2><button className="btn" aria-label="Profil schliessen" onClick={close}><X size={16} /></button></header>
    <label className="dwg-field">Profilname<input autoComplete="off" maxLength={70} value={draft.name} placeholder="z. B. Muster Architekten" onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
    <p>Die erste passende Regel gilt. Weitere Layer behalten die Darstellung der Quelle.</p>
    <div className="dwg-rules"><table><thead><tr><th>Layer enthält</th><th>Darstellung</th><th>Linienstärke</th><th/></tr></thead><tbody>
      {draft.profile.rules.map((rule, i) => <tr key={i}>
        <td><input aria-label={`Layer Regel ${i+1}`} list="dwg-source-layers" maxLength={255} value={rule.contains} onChange={e => updateRule(i, { contains: e.target.value })}/></td>
        <td><select aria-label={`Darstellung Regel ${i+1}`} value={rule.action} onChange={e => updateRule(i, { action: e.target.value as LayerAction })}>{Object.entries(actions).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></td>
        <td><select aria-label={`Linienstärke Regel ${i+1}`} disabled={rule.action === "hide"} value={rule.lineweight_mm ?? ""} onChange={e => updateRule(i, { lineweight_mm: e.target.value === "" ? null : Number(e.target.value) })}><option value="">Original</option>{weights.map(w => <option value={w} key={w}>{fmt.format(w)} mm</option>)}</select></td>
        <td><button className="btn" aria-label={`Regel ${i+1} entfernen`} onClick={() => update({ rules: draft.profile.rules.filter((_, index) => index !== i) })}><X size={14}/></button></td>
      </tr>)}</tbody></table></div>
    <datalist id="dwg-source-layers">{layers.map(name => <option key={name} value={name}/>)}</datalist>
    <button className="btn dwg-add-rule" disabled={draft.profile.rules.length >= 128} onClick={() => update({ rules: [...draft.profile.rules, { contains: "", action: "grey" }] })}><Plus size={15}/>Regel hinzufügen</button>
    <label className="dwg-check"><input type="checkbox" checked={draft.profile.audit_dxf ?? false} onChange={e => update({ audit_dxf: e.target.checked })}/>DXF-Struktur prüfen und reparierbare Fehler beheben</label>
    <label className="dwg-check"><input type="checkbox" checked={draft.profile.remove_wipeouts} onChange={e => update({ remove_wipeouts: e.target.checked })}/>Wipeouts entfernen</label>
    <label className="dwg-check"><input type="checkbox" checked={draft.profile.remove_text_backgrounds} onChange={e => update({ remove_text_backgrounds: e.target.checked })}/>Texthintergründe entfernen</label>
    {error && <p role="alert">{error}</p>}
    <footer><button className="btn" onClick={close}>Abbrechen</button><button className="btn dwg-primary" onClick={save}>Profil lokal speichern</button></footer>
  </div></div>;
}

function statsOf(p: Preview): [string, string | number][] {
  const rows: [string, string | number][] = [
    ["Zeichnungseinheit", p.unit], ["Layer insgesamt", p.layers.length],
    ["Layer grau", p.stats.grey_layers], ["Layer ausgeblendet", p.stats.hidden_layers],
    ["Wipeouts entfernt", p.stats.wipeouts_removed], ["Texthintergründe entfernt", p.stats.text_backgrounds_removed],
  ];
  if (p.insertion_base) rows.push(["Zeichnungsbasispunkt (X / Y / Z)", `${p.insertion_base.join(" / ")} ${p.unit}`]);
  if (p.stats.audit_fixes !== undefined) rows.push(["Strukturfehler behoben", p.stats.audit_fixes]);
  if (p.stats.audit_errors !== undefined) rows.push(["Strukturfehler offen", p.stats.audit_errors]);
  return rows;
}
function protocol(source: Source, data: Preview) {
  const rows = [nameOf(source), `Profil: ${source.settings.name}`, ...statsOf(data).map(([k, v]) => `${k}: ${v}`)];
  if (data.extent) rows.push(`Ausdehnung: ${fmt.format(data.extent.width)} × ${fmt.format(data.extent.height)} ${data.unit}`);
  return [...rows, "", "Hinweise", ...(data.issues.length ? data.issues : ["Keine Hinweise aus der DXF-Vorschau."])].join("\n");
}

function SheetImage({ heading, svg, warning }: {heading: string; svg: string; warning?: string}) {
  const [image, setImage] = useState<{svg: string; url: string} | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    setImage({ svg, url });
    return () => URL.revokeObjectURL(url);
  }, [svg]);
  return <figure className="dwg-paper"><figcaption>{heading}</figcaption>
    <div className="dwg-drawing">{image?.svg === svg && <img src={image.url} alt={heading}/>}</div>
    {warning && <div className="dwg-warn"><CircleAlert size={15} aria-hidden="true"/>{warning}</div>}
  </figure>;
}

export default function DwgWerkstatt({ onHome, onOpenTool }: ToolProps) {
  const [library, setLibrary] = useState(() => {
    try { return { profiles: parseProfiles(localStorage.getItem(STORAGE)), error: "" }; }
    catch { return { profiles: [] as NamedProfile[], error: "Die lokalen Büroprofile konnten nicht geladen werden." }; }
  });
  const [source, setSource] = useState<Source>({ file: null, settings: standard });
  const [result, setResult] = useState<{ source: Source; data?: Preview; error?: string } | null>(null);
  const [view, setView] = useState<View>("vergleich");
  const [edit, setEdit] = useState(false);
  const [actionError, setActionError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dwgAvailable, setDwgAvailable] = useState<boolean | null>(null);
  const [exporting, setExporting] = useState<"single" | "batch" | null>(null);
  const [batchResult, setBatchResult] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const output = useRef<AbortController | null>(null);
  const previewRequest = useRef<AbortController | null>(null);
  const previewQueue = useRef(Promise.resolve());
  const preview = result?.source === source ? result.data : undefined;
  const error = actionError || (result?.source === source && result.error) || library.error;
  const loading = result?.source !== source;
  const list = [standard, auditOnly, ...library.profiles];
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${ROOT}/capabilities`, { signal: controller.signal })
      .then(response => readJson<{ dwg_available: boolean }>(response, "DWG-Konverter konnte nicht geprüft werden."))
      .then(data => { if (!controller.signal.aborted) setDwgAvailable(data.dwg_available); })
      .catch(() => { /* A failed status check still permits opening a drawing. */ });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    let selected = true;
    // An aborted HTTP request does not stop an already running CAD process on the server.
    // Keep one preview in flight and skip drawings that have since been deselected.
    async function load() {
      if (!selected) return;
      const controller = new AbortController();
      previewRequest.current = controller;
      try {
        const response = await fetch(`${ROOT}/preview`, { method: "POST", body: bodyOf(source), signal: controller.signal });
        const data = await readJson<Preview>(response, "Die Planvorschau konnte nicht erstellt werden.");
        if (selected && !controller.signal.aborted) setResult({ source, data });
      } catch (e) {
        if (selected && !controller.signal.aborted) setResult({ source, error: e instanceof Error ? e.message : "Vorschau fehlgeschlagen." });
      } finally { previewRequest.current = null; }
    }
    previewQueue.current = previewQueue.current.then(load);
    return () => { selected = false; };
  }, [source]);
  useEffect(() => () => { output.current?.abort(); previewRequest.current?.abort(); }, []);
  function addFiles(incoming: File[]) {
    if (output.current || incoming.length === 0) return;
    const next = [...files, ...incoming];
    const invalid = incoming.find(file => !/\.(?:dwg|dxf)$/i.test(file.name));
    if (invalid) { setActionError(`«${invalid.name}» hat kein unterstütztes Format. Bitte DWG oder DXF wählen.`); return; }
    const large = incoming.find(file => file.size > 16 * 1024 * 1024);
    if (large) { setActionError(`«${large.name}» überschreitet 16 MiB pro Datei.`); return; }
    if (next.length > 24 || next.reduce((sum, file) => sum + file.size, 0) > 128 * 1024 * 1024) {
      setActionError("Ein Plansatz umfasst maximal 24 Dateien und insgesamt 128 MiB."); return;
    }
    setFiles(next); setSource({ ...source, file: incoming[0] }); setActionError(""); setBatchResult("");
  }
  function removeFile() {
    const index = source.file ? files.indexOf(source.file) : -1;
    if (index < 0 || output.current) return;
    const next = files.filter((_, i) => i !== index);
    setFiles(next); setSource({ ...source, file: next[Math.min(index, next.length - 1)] ?? null });
    setActionError(""); setBatchResult("");
  }
  function save(value: NamedProfile) {
    if (library.error) return library.error;
    const next = [...library.profiles.filter(item => item.name !== value.name), value];
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); }
    catch { return "Das Büroprofil konnte auf diesem Computer nicht gespeichert werden."; }
    setLibrary({ profiles: next, error: "" }); setActionError(""); setBatchResult("");
    setSource({ file: source.file, settings: value }); setEdit(false);
  }
  async function downloadReport() {
    if (!preview || reportBusy) return;
    setActionError("");
    setReportBusy(true);
    try { downloadBlob(await protocolPdf(protocol(source, preview)), `${baseName(source)}_Protokoll.pdf`); }
    catch (e) { setActionError(e instanceof Error ? e.message : "PDF-Protokoll fehlgeschlagen."); }
    finally { setReportBusy(false); }
  }
  async function exportPlans(mode: "single" | "batch") {
    if (output.current || (mode === "batch" && !files.length)) return;
    const controller = new AbortController(); output.current = controller;
    setExporting(mode); setActionError(""); setBatchResult("");
    const isBatch = mode === "batch";
    try {
      const data = isBatch ? new FormData() : bodyOf(source);
      if (isBatch) {
        for (const file of files) data.append("files", file);
        data.set("profile", JSON.stringify(source.settings.profile));
      }
      const response = await fetch(`${ROOT}/${isBatch ? "batch" : "export"}`, { method: "POST", body: data, signal: controller.signal });
      if (!response.ok) throw new Error(await responseError(response, "Export fehlgeschlagen."));
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      downloadBlob(blob, isBatch ? "Architekturplaene_aufbereitet.zip" : `${baseName(source)}_aufbereitet.dxf`);
      if (isBatch) {
        const succeeded = response.headers.get("X-DWG-Succeeded"), failed = response.headers.get("X-DWG-Failed");
        setBatchResult(succeeded !== null && failed !== null
          ? `${succeeded} von ${files.length} Plänen als DXF ausgegeben. ${Number(failed) > 0 ? `Fehlgeschlagen: ${failed}. ` : ""}Das Protokoll liegt im ZIP.`
          : "Das ZIP enthält das Ergebnis und das Protokoll pro Plan.");
      }
    } catch (e) { if (!controller.signal.aborted) setActionError(e instanceof Error ? e.message : "Export fehlgeschlagen."); }
    finally { output.current = null; if (!controller.signal.aborted) setExporting(null); }
  }
  return <div className="dwg-workspace">
    <ToolHeader title="DWG-Werkstatt" currentToolId="dwg-werkstatt" disabled={edit || !!exporting} onHome={onHome} onOpenTool={onOpenTool}/>
    <main className="dwg-main" inert={edit} aria-label="DWG-Werkstatt" onDragOver={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      onDrop={e => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files)); }}>
      <header className="dwg-title"><div><h1>Architekturpläne bereinigen</h1><p>DWG- oder DXF-Pläne hierherziehen. Das Büroprofil gilt für den ganzen Plansatz.</p></div>
        <div className="dwg-actions"><button type="button" className="btn" onClick={() => input.current?.click()} disabled={!!exporting}><FolderOpen size={16}/>Pläne hinzufügen</button>
          <button type="button" className="btn dwg-primary" disabled={!files.length || !!exporting} onClick={() => void exportPlans("batch")}>
            {exporting === "batch" ? <LoaderCircle className="dwg-spin" size={16}/> : <Archive size={16}/>}
            {exporting === "batch" ? "Plansatz wird bereinigt …" : "Stapel als DXF-ZIP speichern"}
          </button></div>
        <input ref={input} hidden multiple type="file" accept=".dxf,.dwg" aria-label="DWG- oder DXF-Pläne auswählen" onChange={e => { const chosen = Array.from(e.target.files ?? []); e.target.value = ""; addFiles(chosen); }}/>
      </header>
      {files.length > 0 && <div className="dwg-planset">
        <label>Planvorschau<select aria-label="Plan für die Vorschau" disabled={!!exporting} value={source.file ? files.indexOf(source.file) : -1} onChange={e => { setActionError(""); setSource({ ...source, file: files[Number(e.target.value)] }); }}>
          {files.map((file, i) => <option key={i} value={i}>{i + 1}. {file.name}</option>)}
        </select></label>
        <button className="btn" disabled={!!exporting} aria-label="Gewählten Plan aus dem Stapel entfernen" title="Gewählten Plan aus dem Stapel entfernen" onClick={removeFile}><X size={16}/></button>
        <span>{files.length} {files.length === 1 ? "Plan" : "Pläne"} im Stapel</span>
      </div>}
      {dwgAvailable === false && <p className="dwg-notice"><CircleAlert size={16}/>Für DWG fehlt der lokale ODA File Converter. Installiere ihn auf dem Rechner, auf dem der Toolhub läuft. DXF kannst du direkt verarbeiten.</p>}
      {batchResult && <p className="dwg-notice" role="status">{batchResult}</p>}
      {error && <div role="alert" className="dwg-error"><CircleAlert size={17}/><span>{error}</span>{actionError && <button className="btn" onClick={() => setActionError("")} aria-label="Meldung schliessen"><X size={15}/></button>}</div>}
      <div className="dwg-grid"><section className="dwg-comparison" aria-label="Zeichnungsvergleich">
        <div className="dwg-tools"><div><h2>Planvorschau</h2><p>{nameOf(source)}{source.file ? "" : " · Beispiel"}</p></div><div role="group" aria-label="Ansicht">{([["vergleich","Vergleich"],["vorher","Original"],["nachher","Ergebnis"]] as const).map(([key, label]) => <button className="btn" aria-pressed={view === key} key={key} onClick={() => setView(key)}>{label}</button>)}</div></div>
        {preview ? <div className="dwg-sheets" data-view={view}>
          {view !== "nachher" && <SheetImage heading="Vorher · Original" svg={preview.before_svg}/>}
          {view !== "vorher" && <SheetImage heading={`Nachher · ${source.settings.name}`} svg={preview.after_svg} warning={preview.issues.find(i => /vorschau unvollständig|referenz|xref/i.test(i))}/>}
        </div> : <div className="dwg-empty" role="status">{loading ? <><LoaderCircle className="dwg-spin" size={18}/>Plan wird geprüft …</> : <><Layers3 size={18}/>Vorschau nicht verfügbar<button className="btn" onClick={() => { setActionError(""); setSource({ ...source }); }}>Erneut versuchen</button></>}</div>}
      </section>
      <aside className="dwg-side"><section><h2>Büroprofil</h2><div className="dwg-profile"><select aria-label="Büroprofil auswählen" value={list.indexOf(source.settings)} disabled={!!exporting} onChange={e => { const settings = list[Number(e.target.value)]; if (settings) { setActionError(""); setBatchResult(""); setSource({ ...source, settings }); } }}>{list.map((p, i) => <option key={i} value={i}>{p.name}{p !== auditOnly && p.name === auditOnly.name ? " (eigenes Profil)" : ""}</option>)}</select>
        <button className="btn" aria-label="Büroprofil bearbeiten" title="Büroprofil bearbeiten" disabled={!!exporting} onClick={() => setEdit(true)}><SlidersHorizontal size={16}/></button></div></section>
        <section><h2>Gewählter Plan</h2><button className="btn" disabled={!!exporting} onClick={() => void exportPlans("single")}><ArrowDownToLine size={15}/>{exporting === "single" ? "DXF wird erstellt …" : "DXF-Kopie speichern"}</button></section>
        <section><h2>Prüfprotokoll</h2>{preview ? <><dl>{statsOf(preview).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {preview.extent && <p>Ausdehnung {fmt.format(preview.extent.width)} × {fmt.format(preview.extent.height)} {preview.unit}</p>}
          {preview.issues.length > 0 && <ul className="dwg-issues">{preview.issues.map((issue, n) => <li key={n}><CircleAlert size={14}/>{issue}</li>)}</ul>}
          <button className="btn" disabled={reportBusy} onClick={() => void downloadReport()}><FileText size={15}/>{reportBusy ? "PDF wird erstellt …" : "Protokoll als PDF"}</button>
        </> : <p>Das Protokoll erscheint nach dem Einlesen.</p>}</section>
        <details><summary>In Trimble Nova übernehmen</summary><p>Entpacke das ZIP und importiere die bereinigten DXF-Kopien in dein Nova-Projekt. Die Werkstatt erzeugt DXF. Native N4D-Zeichnungen speicherst du in Nova.</p><p>Kontrolliere beim Import Einheit, Einfügepunkt und externe Referenzen.</p></details>
      </aside></div>
    </main>
    {edit && <ProfileEditor settings={source.settings} names={library.profiles.map(p => p.name)} layers={preview?.layers ?? []} onClose={() => setEdit(false)} onSave={save}/>}
  </div>;
}
