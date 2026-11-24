import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, CircleAlert, FileText, FolderOpen, Layers3, LoaderCircle, Plus, SlidersHorizontal, X } from "lucide-react";
import ToolHeader from "../../toolbox/ToolHeader";
import type { ToolProps } from "../../toolbox/modules";
import { readJson, responseError } from "../../shared/http";
import { downloadBlob } from "../../shared/download";
import { protocolPdf } from "./protocolPdf";
import { useDialogFocus } from "../../shared/useDialogFocus";
import { parseProfiles, standard, validProfile, weights, type LayerAction, type LayerRule, type NamedProfile, type Profile } from "./profile";
import "./dwg-werkstatt.css";

interface Preview {
  before_svg: string; after_svg: string; unit: string; layers: string[]; extent: { width: number; height: number } | null;
  stats: { grey_layers: number; hidden_layers: number; wipeouts_removed: number; text_backgrounds_removed: number };
  issues: string[];
}
interface Source { file: File | null; settings: NamedProfile }
type View = "vergleich" | "vorher" | "nachher";
const ROOT = "/api/dwg-workshop";
const STORAGE = "edeco.dwg-werkstatt.bueroprofile.v1";
const actions: Record<LayerAction, string> = { keep: "Original", grey: "Grau", hide: "Ausblenden" };
const fmt = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 2 });
const nameOf = (source: Source) => source.file?.name ?? "Beispielgrundriss.dxf";
const baseName = (source: Source) => nameOf(source).replace(/\.dxf$/i, "");

function bodyOf(source: Source) {
  const data = new FormData();
  if (source.file) data.set("file", source.file);
  data.set("profile", JSON.stringify(source.settings.profile));
  return data;
}

function editorCopy(named: NamedProfile): NamedProfile {
  return { name: named === standard ? "" : named.name, profile: {
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
    if (!name || name === standard.name || (names.includes(name) && name !== settings.name)) { setError("Bitte einen eigenen, eindeutigen Profilnamen eingeben."); return; }
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
    <label className="dwg-check"><input type="checkbox" checked={draft.profile.remove_wipeouts} onChange={e => update({ remove_wipeouts: e.target.checked })}/>Wipeouts entfernen</label>
    <label className="dwg-check"><input type="checkbox" checked={draft.profile.remove_text_backgrounds} onChange={e => update({ remove_text_backgrounds: e.target.checked })}/>Texthintergründe entfernen</label>
    {error && <p role="alert">{error}</p>}
    <footer><button className="btn" onClick={close}>Abbrechen</button><button className="btn dwg-primary" onClick={save}>Profil lokal speichern</button></footer>
  </div></div>;
}

function statsOf(p: Preview): [string, string | number][] {
  return [
    ["Zeichnungseinheit", p.unit], ["Layer insgesamt", p.layers.length],
    ["Layer grau", p.stats.grey_layers], ["Layer ausgeblendet", p.stats.hidden_layers],
    ["Wipeouts entfernt", p.stats.wipeouts_removed], ["Texthintergründe entfernt", p.stats.text_backgrounds_removed],
  ];
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
  const [exporting, setExporting] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const output = useRef<AbortController | null>(null);
  const preview = result?.source === source ? result.data : undefined;
  const error = actionError || (result?.source === source && result.error) || library.error;
  const loading = result?.source !== source;
  const list = [standard, ...library.profiles];
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`${ROOT}/preview`, { method: "POST", body: bodyOf(source), signal: controller.signal });
        const data = await readJson<Preview>(response, "Die DXF-Vorschau konnte nicht erstellt werden.");
        if (!controller.signal.aborted) setResult({ source, data });
      } catch (e) { if (!controller.signal.aborted) setResult({ source, error: e instanceof Error ? e.message : "Vorschau fehlgeschlagen." }); }
    }
    void load();
    return () => controller.abort();
  }, [source]);
  useEffect(() => () => output.current?.abort(), []);
  function loadFile(file: File) {
    if (output.current) return;
    if (!file.name.toLowerCase().endsWith(".dxf")) {
      setActionError("DWG in Nova öffnen, mit der Stapelbereinigung vorbereiten und eine DXF-Kopie hier öffnen."); return;
    }
    if (file.size > 16 * 1024 * 1024) { setActionError("Die DXF-Vorschau unterstützt Dateien bis 16 MiB."); return; }
    setActionError(""); setSource({ file, settings: source.settings });
  }
  function save(value: NamedProfile) {
    if (library.error) return library.error;
    const next = [...library.profiles.filter(item => item.name !== value.name), value];
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); }
    catch { return "Das Büroprofil konnte auf diesem Computer nicht gespeichert werden."; }
    setLibrary({ profiles: next, error: "" }); setActionError("");
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
  async function exportDxf() {
    if (output.current || !preview) return;
    const controller = new AbortController(); output.current = controller;
    setExporting(true); setActionError("");
    try {
      const response = await fetch(`${ROOT}/export`, { method: "POST", body: bodyOf(source), signal: controller.signal });
      if (!response.ok) throw new Error(await responseError(response, "DXF-Export fehlgeschlagen."));
      const data = await response.blob();
      if (!controller.signal.aborted) downloadBlob(data, `${baseName(source)}_aufbereitet.dxf`);
    } catch (e) { if (!controller.signal.aborted) setActionError(e instanceof Error ? e.message : "DXF-Export fehlgeschlagen."); }
    finally { output.current = null; if (!controller.signal.aborted) setExporting(false); }
  }
  return <div className="dwg-workspace">
    <ToolHeader title="DWG-Werkstatt" currentToolId="dwg-werkstatt" disabled={edit || exporting} onHome={onHome} onOpenTool={onOpenTool}/>
    <main className="dwg-main" inert={edit} aria-label="DWG-Werkstatt" onDragOver={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
      onDrop={e => { e.preventDefault(); const files = e.dataTransfer.files; if (files.length === 1) loadFile(files[0]); else if (files.length > 1) setActionError("Bitte eine DXF-Datei für die Vorschau wählen."); }}>
      <header className="dwg-title"><div><p>{source.file ? "DXF-Arbeitskopie" : "Beispielzeichnung"}</p><h1>{nameOf(source)}</h1></div>
        <div className="dwg-actions"><button type="button" className="btn" onClick={() => input.current?.click()} disabled={exporting}><FolderOpen size={16}/>DXF öffnen</button>
          <button type="button" className="btn dwg-primary" disabled={!preview || exporting} onClick={() => void exportDxf()}><ArrowDownToLine size={16}/>{exporting ? "DXF wird erstellt …" : "DXF-Kopie speichern"}</button></div>
        <input ref={input} hidden type="file" accept=".dxf,.dwg" aria-label="DXF-Datei auswählen" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) loadFile(f); }}/>
      </header>
      {error && <div role="alert" className="dwg-error"><CircleAlert size={17}/><span>{error}</span>{actionError && <button className="btn" onClick={() => setActionError("")} aria-label="Meldung schliessen"><X size={15}/></button>}</div>}
      <div className="dwg-grid"><section className="dwg-comparison" aria-label="Zeichnungsvergleich">
        <div className="dwg-tools"><h2>Planvorschau</h2><div role="group" aria-label="Ansicht">{([["vergleich","Vergleich"],["vorher","Original"],["nachher","Ergebnis"]] as const).map(([key, label]) => <button className="btn" aria-pressed={view === key} key={key} onClick={() => setView(key)}>{label}</button>)}</div></div>
        {preview ? <div className="dwg-sheets" data-view={view}>
          {view !== "nachher" && <SheetImage heading="Vorher · Original" svg={preview.before_svg}/>}
          {view !== "vorher" && <SheetImage heading={`Nachher · ${source.settings.name}`} svg={preview.after_svg} warning={preview.issues.find(i => /vorschau unvollständig|referenz|xref/i.test(i))}/>}
        </div> : <div className="dwg-empty" role="status">{loading ? <><LoaderCircle className="dwg-spin" size={18}/>DXF wird geprüft …</> : <><Layers3 size={18}/>Vorschau nicht verfügbar<button className="btn" onClick={() => { setActionError(""); setSource({ ...source }); }}>Erneut versuchen</button>{source.file && <button className="btn" onClick={() => { setActionError(""); setSource({ ...source, file: null }); }}>Beispiel öffnen</button>}</>}</div>}
      </section>
      <aside className="dwg-side"><section><h2>Büroprofil</h2><div className="dwg-profile"><select aria-label="Büroprofil auswählen" value={source.settings.name} disabled={exporting} onChange={e => { const settings = list.find(v => v.name === e.target.value); if (settings) { setActionError(""); setSource({ ...source, settings }); } }}>{list.map(p => <option key={p.name}>{p.name}</option>)}</select>
        <button className="btn" aria-label="Büroprofil bearbeiten" title="Büroprofil bearbeiten" disabled={exporting} onClick={() => setEdit(true)}><SlidersHorizontal size={16}/></button></div></section>
        <section><h2>Prüfprotokoll</h2>{preview ? <><dl>{statsOf(preview).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {preview.extent && <p>Ausdehnung {fmt.format(preview.extent.width)} × {fmt.format(preview.extent.height)} {preview.unit}</p>}
          {preview.issues.length > 0 && <ul className="dwg-issues">{preview.issues.map((issue, n) => <li key={n}><CircleAlert size={14}/>{issue}</li>)}</ul>}
          <button className="btn" disabled={reportBusy} onClick={() => void downloadReport()}><FileText size={15}/>{reportBusy ? "PDF wird erstellt …" : "Protokoll als PDF"}</button>
        </> : <p>Das Protokoll erscheint nach dem Einlesen.</p>}</section>
        <details><summary>DWG aus Nova vorbereiten</summary><p>DWG in Nova öffnen und die Stapelbereinigung ausführen. Eine DXF-Kopie speichern und hier öffnen. Die aufbereitete DXF kannst du in Nova als Grundlage prüfen.</p></details>
      </aside></div>
    </main>
    {edit && <ProfileEditor settings={source.settings} names={library.profiles.map(p => p.name)} layers={preview?.layers ?? []} onClose={() => setEdit(false)} onSave={save}/>}
  </div>;
}
