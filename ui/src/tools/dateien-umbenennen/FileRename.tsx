import { useEffect, useRef, useState } from "react";
import type { ToolProps } from "../../toolbox/modules";
import { buildName, DEFAULTS, nameIssue, PARTS, restoreSettings, type NamingSettings, type Part } from "./naming";
import "./file-rename.css";
import { notifyProjectsChanged, useProjectHub, type Project } from "../projektzentrale/projectHubState";
import DeliveryHistory from "../planlieferung/DeliveryHistory";
import "../projektzentrale/project-hub.css";

const API = "/api/tools/dateien-umbenennen";
const STORAGE = "edeco.rename.template.v1";
interface Detection { floor: string; candidates: string[]; source: string; note: string }
interface Row extends Detection { id: number; file: File; customName: string | null; index: string | null; scale: string | null; plan: string | null }
function load(): NamingSettings {
  try { return restoreSettings(localStorage.getItem(STORAGE)); } catch { return structuredClone(DEFAULTS); }
}
async function failure(response: Response): Promise<never> {
  const data = await response.json().catch(() => ({}));
  throw new Error(typeof data.detail === "string" ? data.detail : "Die Aktion konnte nicht abgeschlossen werden.");
}

export default function FileRename({ onHome, deliveryMode = false }: ToolProps & { deliveryMode?: boolean }) {
  const [settings, setSettings] = useState(load);
  const [rows, setRows] = useState<Row[]>([]);
  const [session, setSession] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exported, setExported] = useState(false);
  const { hub: projects, active: activeProject, error: projectError } = useProjectHub();
  const initialProjectApplied = useRef(false);
  const projectTouched = useRef(false);
  const [deliveryProject, setDeliveryProject] = useState<Project | null>(null);
  const [recipient, setRecipient] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const [deliveryTitle, setDeliveryTitle] = useState("Planlieferung");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const nextId = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!projects || initialProjectApplied.current) return;
    initialProjectApplied.current = true;
    if (activeProject && !projectTouched.current) {
      setSettings(old => ({ ...old, values: { ...old.values, project: activeProject.number } }));
      setDeliveryProject(activeProject);
    }
  }, [projects, activeProject]);
  useEffect(() => {
    let alive = true;
    fetch(API + "/state").then(async response => {
      if (!response.ok) return failure(response);
      const data = await response.json(); if (alive) setSession(data.session_key);
    }).catch(e => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(settings)); }
    catch { setError("Die Vorlage konnte nicht gespeichert werden. Bitte Browserspeicher prüfen."); }
  }, [settings]);
  useEffect(() => {
    if (!rows.length || exported) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [rows.length, exported]);

  function changeSettings(change: (old: NamingSettings) => NamingSettings) {
    setSettings(change); setExported(false); setNotice(""); requestId.current = crypto.randomUUID();
  }
  function changeRow(id: number, patch: Partial<Row>) {
    setRows(old => old.map(row => row.id === id ? { ...row, ...patch } : row)); setExported(false); setNotice(""); requestId.current = crypto.randomUUID();
  }
  function move(key: Part, offset: number) {
    changeSettings(old => {
      const order = [...old.order], index = order.indexOf(key);
      [order[index], order[index + offset]] = [order[index + offset], order[index]];
      return { ...old, order };
    });
  }
  async function addFiles(files: File[]) {
    if (!files.length || busy || !session) return;
    setError(""); setNotice("");
    if (rows.length + files.length > 100 || [...rows.map(row => row.file), ...files].reduce((sum, file) => sum + file.size, 0) > 150 * 1024 * 1024) {
      setError("Bitte höchstens 100 PDFs mit insgesamt 150 MB auswählen."); return;
    }
    if (files.some(file => !file.name.toLowerCase().endsWith(".pdf") || !file.size || file.size > 30 * 1024 * 1024)) {
      setError("Bitte ausschliesslich PDFs mit höchstens 30 MB je Datei wählen."); return;
    }
    setBusy("Geschosse werden geprüft …"); setExported(false); requestId.current = crypto.randomUUID();
    try {
      for (const file of files) {
        const form = new FormData(); form.append("file", file);
        const response = await fetch(API + "/inspect", { method: "POST", headers: { "X-Edeco-Rename": session }, body: form });
        if (!response.ok) await failure(response);
        const detected = await response.json() as Detection;
        const id = nextId.current++;
        setRows(old => [...old, { ...detected, id, file, customName: null, index: null, scale: null, plan: null }]);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }
  function rowSettings(row: Row): NamingSettings {
    const values = { ...settings.values, index: row.index ?? settings.values.index, scale: row.scale ?? settings.values.scale, plan: row.plan ?? settings.values.plan };
    return { ...settings, values, enabled: { ...settings.enabled, index: settings.enabled.index && (!deliveryMode || Boolean(values.index.trim())) } };
  }
  const names = rows.map(row => row.customName ?? buildName(rowSettings(row), row.floor));
  const deliveryReady = Boolean(deliveryProject && !deliveryProject.archived && projects?.projects.find(project => project.id === deliveryProject.id)?.version === deliveryProject.version && recipient.trim() && deliveryTitle.trim() && /^\d{4}-\d{2}-\d{2}$/.test(deliveryDate));
  const issues = rows.map((row, index) => {
    const current = rowSettings(row);
    const missing = current.order.filter(key => current.enabled[key] && key !== "floor" && !current.values[key].trim());
    const issue = nameIssue(names[index]);
    if (issue) return issue;
    if (names.some((name, other) => other !== index && name.toLocaleLowerCase() === names[index].toLocaleLowerCase())) return "Namenskonflikt: bitte eindeutig benennen.";
    if (deliveryMode && (!row.floor.trim() || !(row.plan ?? settings.values.plan).trim() || !(row.scale ?? settings.values.scale).trim())) return "Geschoss, Planart und Massstab für die Planliste ausfüllen.";
    if (row.customName === null && missing.length) return "Aktive Namensbausteine bitte ausfüllen.";
    if (row.customName === null && settings.enabled.floor && !row.floor.trim()) return "Geschoss bitte auswählen oder eintragen.";
    if (!settings.order.some(key => settings.enabled[key]) && row.customName === null) return "Mindestens einen Namensbaustein auswählen.";
    return "";
  });
  async function download() {
    if (!rows.length || issues.some(Boolean) || busy || !session || (deliveryMode && (!deliveryReady || !projects))) return;
    setBusy("ZIP wird erstellt …"); setError(""); setNotice("");
    try {
      const form = new FormData(); rows.forEach(row => form.append("files", row.file)); form.append("names", JSON.stringify(names));
      if (deliveryMode && deliveryProject) form.append("manifest", JSON.stringify({ request_id: requestId.current,
        project_id: deliveryProject.id, project_version: deliveryProject.version, recipient, delivery_date: deliveryDate, title: deliveryTitle, notes: deliveryNotes,
        plans: rows.map((row, index) => ({ filename: names[index], floor: row.floor, plan_type: row.plan ?? settings.values.plan, index: row.index ?? settings.values.index, scale: row.scale ?? settings.values.scale })) }));
      const response = await fetch(deliveryMode ? "/api/tools/planlieferung/prepare" : API + "/export", { method: "POST", headers: deliveryMode ? { "X-Edeco-Projects": projects!.session_key } : { "X-Edeco-Rename": session }, body: form });
      if (!response.ok) await failure(response);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "edeco-planlieferung.zip"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExported(true); setNotice(deliveryMode ? "Lieferung vorbereitet und protokolliert. ZIP enthält PDFs und Planliste (CSV, Druckansicht, JSON). Downloadordner prüfen; Versand bei Bedarf separat bestätigen." : "ZIP-Download gestartet. Bitte im Downloadordner prüfen. Die Originaldateien bleiben erhalten.");
      if (deliveryMode) notifyProjectsChanged();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }
  function leave() {
    if (busy) return;
    if (!rows.length || exported || window.confirm("Die Dateiliste und einzelne Korrekturen werden beim Verlassen verworfen. Die Namensvorlage bleibt gespeichert. Zur Toolbox wechseln?")) onHome();
  }
  const example = buildName({ ...settings, values: { ...settings.values, project: settings.values.project || "1498", date: settings.values.date || "2026-11-01" } }, "OG02");
  return <div className="rename-tool">
    <header className="bim-toolbox-header"><button className="btn" onClick={leave} disabled={Boolean(busy)}>← Zur Toolbox</button><strong>{deliveryMode ? "Planlieferungs-Assistent" : "Dateien umbenennen"}</strong><span>Work in progress</span></header>
    <main className="rename-main">
      <h1>{deliveryMode ? "Eine Lieferung. Alle Pläne im Blick." : "Deine Pläne. Eure Benennung."}</h1>
      <p>Bausteine auswählen, PDFs hinzufügen und die Namen prüfen. Anschliessend benannte Kopien als ZIP herunterladen.</p>
      {deliveryMode && <section className="rename-template" aria-label="Lieferangaben"><h2>Lieferangaben</h2><div className="delivery-fields">
        <label>Projekt<select aria-label="Lieferprojekt" disabled={Boolean(busy) || !projects} value={deliveryProject?.id ?? ""} onChange={event => {
          const project = projects?.projects.find(item => item.id === event.target.value) ?? null;
          setDeliveryProject(project); projectTouched.current = true; changeSettings(old => ({ ...old, values: { ...old.values, project: project?.number ?? "" } }));
        }}><option value="">Projekt auswählen</option>{projects?.projects.filter(project => !project.archived).map(project => <option key={project.id} value={project.id}>{project.number} · {project.name}</option>)}</select></label>
        <label>Empfänger<input aria-label="Lieferempfänger" list="delivery-contacts" value={recipient} maxLength={500} disabled={Boolean(busy)} onChange={event => { setRecipient(event.target.value); requestId.current = crypto.randomUUID(); setExported(false); setNotice(""); }} /></label>
        <datalist id="delivery-contacts">{deliveryProject?.contacts.map((contact, index) => <option key={index} value={[contact.name, contact.company, contact.email].filter(Boolean).join(" · ")} />)}</datalist>
        <label>Lieferdatum<input aria-label="Lieferdatum" type="date" value={deliveryDate} disabled={Boolean(busy)} onChange={event => { setDeliveryDate(event.target.value); requestId.current = crypto.randomUUID(); setExported(false); setNotice(""); }} /></label>
        <label>Bezeichnung<input aria-label="Lieferbezeichnung" maxLength={180} value={deliveryTitle} disabled={Boolean(busy)} onChange={event => { setDeliveryTitle(event.target.value); requestId.current = crypto.randomUUID(); setExported(false); setNotice(""); }} /></label>
        <label>Bemerkung<input aria-label="Lieferbemerkung" maxLength={2000} value={deliveryNotes} disabled={Boolean(busy)} onChange={event => { setDeliveryNotes(event.target.value); requestId.current = crypto.randomUUID(); setExported(false); setNotice(""); }} /></label>
      </div><p>Vorbereitung erzeugt eine ZIP und einen Eintrag beim Projekt. Dateien werden dabei nicht versendet. Index darf leer bleiben.</p>
        {deliveryProject && projects?.projects.find(project => project.id === deliveryProject.id)?.version !== deliveryProject.version && <p role="alert" className="rename-error">Projektdaten haben sich geändert. Bitte Projekt oben erneut auswählen und die Angaben prüfen.</p>}
      </section>}
      {!deliveryMode && activeProject && <div className="rename-project"><span>Aktives Projekt: <strong>{activeProject.number} · {activeProject.name}</strong></span>
        {settings.values.project === activeProject.number ? <small>Projektnummer übernommen.</small> : <button className="btn" disabled={Boolean(busy)} onClick={() => { projectTouched.current = true; changeSettings(old => ({ ...old, values: { ...old.values, project: activeProject.number } })); }}>Projektnummer übernehmen</button>}
      </div>}
      {!deliveryMode && projects && !activeProject && <div className="rename-project">Kein aktives Projekt. Die Projektnummer kannst du unten manuell eingeben.</div>}
      {projectError && <p role="alert" className="rename-error">Projektzentrale nicht erreichbar: {projectError} Die Projektnummer kann manuell eingegeben werden.</p>}
      <section className="rename-template" aria-label="Namensvorlage">
        <h2>Namensvorlage</h2><p>Die Häkchen bestimmen, was im Dateinamen steht. Die Kürzel E = Elektro, G = Grundriss und APP = Apparatenplan sind vorläufig; eure Firmenliste ergänzen wir später. Eigene Kürzel kannst du bereits eintragen.</p>
        <fieldset disabled={Boolean(busy)} className="rename-parts"><legend>Namensbausteine und Reihenfolge</legend>
          {settings.order.map((key, position) => {
            const part = PARTS.find(p => p.key === key)!;
            return <div className={`rename-part ${settings.enabled[key] ? "" : "is-off"}`} key={key}>
              <label className="rename-check"><input type="checkbox" checked={settings.enabled[key]} onChange={event => changeSettings(old => ({ ...old, enabled: { ...old.enabled, [key]: event.target.checked } }))} />{part.label} verwenden</label>
              {key === "floor" ? <div className="rename-auto">Automatisch pro PDF<br/><small>Stil: EG00 · OG02 · UG01</small></div> : <>
                <input aria-label={part.label} type={key === "date" ? "date" : "text"} list={part.options.length ? `rename-${key}` : undefined}
                  disabled={!settings.enabled[key] || (deliveryMode && key === "project")} value={settings.values[key]} maxLength={80} placeholder={key === "project" ? "z. B. 1498" : ""}
                  onChange={event => { if (key === "project") projectTouched.current = true; changeSettings(old => ({ ...old, values: { ...old.values, [key]: event.target.value } })); }} />
                {part.options.length > 0 && <datalist id={`rename-${key}`}>{part.options.map(option => <option key={option} value={option} />)}</datalist>}
              </>}
              <div className="rename-order"><button type="button" className="btn" aria-label={`${part.label} nach vorne`} disabled={position === 0} onClick={() => move(key, -1)}>←</button><button type="button" className="btn" aria-label={`${part.label} nach hinten`} disabled={position === settings.order.length - 1} onClick={() => move(key, 1)}>→</button></div>
            </div>;
          })}
        </fieldset>
        <p className="rename-example">Beispiel mit 2. Obergeschoss: <strong>{example}</strong></p>
        <small>Vorlage wird auf diesem PC gespeichert. Nach der Projektnummer folgt „_“, zwischen den übrigen Bausteinen „-“.</small>
      </section>
      <section aria-label="Dateivorschau" className="rename-preview">
        <div className="rename-actions"><h2>Dateien & Vorschau</h2><button className="btn" disabled={!session || Boolean(busy)} onClick={() => input.current?.click()}>PDFs hinzufügen</button>
          <input ref={input} className="rename-file" aria-label="PDFs hinzufügen" type="file" accept=".pdf" multiple disabled={!session || Boolean(busy)} onChange={event => { void addFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
          <button className="btn" disabled={!rows.length || Boolean(busy)} onClick={() => { if (window.confirm("Die gesamte Dateiliste mit Korrekturen leeren?")) { setRows([]); setNotice(""); requestId.current = crypto.randomUUID(); } }}>Liste leeren</button>
        </div>
        <p>Geschosse werden im Dateinamen und im Text der ersten fünf PDF-Seiten gesucht. Scans benötigen eine manuelle Angabe. Alle Vorschläge vor dem Download prüfen.</p>
        <datalist id="rename-floors">{PARTS.find(p => p.key === "floor")!.options.map(value => <option key={value} value={value} />)}</datalist>
        {!rows.length && <div className="rename-empty">PDFs hinzufügen – zum Beispiel „Grundriss 2og.pdf“. Daraus wird mit eurer Vorlage „1498_E-G-APP-OG02-C-50.pdf“.</div>}
        {rows.length > 0 && <div className="rename-table-wrap"><table><thead><tr><th>Original / Erkennung</th><th>Geschoss</th>{deliveryMode && <><th className="delivery-short">Planart</th><th className="delivery-short">Index</th><th className="delivery-short">Massstab 1:</th></>}<th className="rename-name">Neuer Dateiname</th><th>Aktion</th></tr></thead><tbody>
          {rows.map((row, index) => <tr key={row.id}><td><strong>{row.file.name}</strong><small>{row.source}{row.candidates.length ? `: ${row.candidates.join(", ")}` : ""}</small>{row.note && <small>{row.note}</small>}</td>
            <td><input aria-label={`Geschoss für ${row.file.name}`} list="rename-floors" value={row.floor} maxLength={40} disabled={Boolean(busy)} placeholder="Bitte prüfen" onChange={event => changeRow(row.id, { floor: event.target.value.toUpperCase() })} /></td>
            {deliveryMode && ([ ["plan", "Planart"], ["index", "Index"], ["scale", "Massstab"] ] as const).map(([key, label]) => <td key={key}><input aria-label={`${label} für ${row.file.name}`} value={row[key] ?? settings.values[key]} maxLength={80} disabled={Boolean(busy)} onChange={event => changeRow(row.id, { [key]: event.target.value })} /></td>)}
            <td><input aria-label={`Neuer Name für ${row.file.name}`} value={names[index]} disabled={Boolean(busy)} onChange={event => changeRow(row.id, { customName: event.target.value })} />
              {row.customName !== null && <button className="rename-link" disabled={Boolean(busy)} onClick={() => changeRow(row.id, { customName: null })}>Wieder aus Vorlage bilden</button>}
              {issues[index] && <small className="rename-error">{issues[index]}</small>}</td>
            <td><button className="btn" disabled={Boolean(busy)} aria-label={`${row.file.name} entfernen`} onClick={() => { setRows(old => old.filter(item => item.id !== row.id)); setExported(false); setNotice(""); requestId.current = crypto.randomUUID(); }}>Entfernen</button></td></tr>)}
        </tbody></table></div>}
        <div className="rename-actions"><button className="btn primary" disabled={!session || !rows.length || Boolean(busy) || issues.some(Boolean) || (deliveryMode && !deliveryReady)} onClick={() => void download()}>{deliveryMode ? "Lieferpaket mit Planliste erstellen" : "Benannte Kopien als ZIP herunterladen"}</button><small>Originale werden nicht umbenannt oder überschrieben.</small></div>
      </section>
      {busy && <p role="status">{busy}</p>}{notice && <p role="status">{notice}</p>}{error && <p role="alert" className="rename-error">{error}</p>}
      {deliveryMode && deliveryProject && <DeliveryHistory projectId={deliveryProject.id} />}
    </main>
  </div>;
}
