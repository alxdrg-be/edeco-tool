import { useEffect, useRef, useState, type FormEvent } from "react";
import ToolHeader from "../../toolbox/ToolHeader";
import type { ToolProps } from "../../toolbox/modules";
import { useDialogFocus } from "../../useDialogFocus";
import PageWorkbench from "./PageWorkbench";
import PdfToolHome, { type Capability } from "./PdfToolHome";
import PdfTask from "./PdfTask";
import { PDF_TOOLS } from "./tools";
import "./pdf-workshop.css";

interface State {
  service_url: string; managed: boolean; local: boolean; title: string; accent: string; session_key: string;
  workflows: { id: string; title: string }[];
}
interface Health { ready: boolean; version: string; message: string }
const API = "/api/tools/pdf-werkstatt";

async function action<T>(path: string, sessionKey: string, body: object | FormData = {}): Promise<T> {
  const headers: Record<string, string> = { "X-Edeco-Pdf": sessionKey };
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(API + path, { method: "POST", headers,
    body: body instanceof FormData ? body : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Die Aktion konnte nicht abgeschlossen werden.");
  return data as T;
}

function LeaveDialog({ onClose, onLeave, target }: { onClose: () => void; onLeave: () => void; target: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose);
  return <div className="modal-back"><div ref={ref} className="modal" role="alertdialog" aria-modal="true" aria-labelledby="pdf-leave-title" tabIndex={-1}>
    <h2 id="pdf-leave-title">Ergebnisse gespeichert?</h2>
    <p>In der PDF-Werkstatt wurden Dateien geöffnet oder verarbeitet. Bitte benötigte Ergebnisse herunterladen, bevor du den Arbeitsbereich verlässt.</p>
    <div className="pdf-actions"><button className="btn primary" onClick={onClose}>Hier bleiben</button>
      <button className="btn" onClick={onLeave}>{target}</button></div>
  </div></div>;
}

export default function PdfWorkshop({ onHome }: ToolProps) {
  const [state, setState] = useState<State | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [url, setUrl] = useState("");
  const [settings, setSettings] = useState(false);
  const [info, setInfo] = useState(false);
  const [workflows, setWorkflows] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [leave, setLeave] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [working, setWorking] = useState(false);
  const [activeTool, setActiveTool] = useState("");
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [leaveTarget, setLeaveTarget] = useState<"home" | "tools">("home");
  const tool = PDF_TOOLS.find(item => item.id === activeTool);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await fetch(API + "/state");
        if (!response.ok) throw new Error("Die PDF-Verbindung konnte nicht geladen werden.");
        const data = await response.json() as State;
        if (!alive) return;
        setState(data); setUrl(data.service_url); setBusy("check");
        const checked = await action<Health>("/check", data.session_key);
        if (alive) setHealth(checked);
      } catch (e) { if (alive) setError((e as Error).message); }
      finally { if (alive) setBusy(""); }
    }
    void load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!state?.local || health?.ready) return;
    const timer = window.setInterval(() => {
      void action<Health>("/check", state.session_key).then(setHealth).catch(e => setError(String(e)));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [state, health?.ready]);

  useEffect(() => {
    if (!health?.ready) return;
    let alive = true;
    fetch(API + "/tools").then(response => { if (!response.ok) throw new Error("Die Werkzeuge konnten nicht geladen werden."); return response.json(); })
      .then(value => { if (alive) setCapabilities(value.tools); }).catch(e => { if (alive) setError((e as Error).message); });
    return () => { alive = false; };
  }, [health?.ready]);

  function toolsHome() {
    if (working) return;
    if (dirty) { setLeaveTarget("tools"); setLeave(true); }
    else setActiveTool("");
  }

  async function check(save: boolean) {
    if (!state || busy) return;
    const changed = save && url.replace(/\/$/, "") !== state.service_url;
    if (changed && dirty) {
      setError("Bitte die PDF-Ergebnisse speichern und die Werkstatt neu öffnen, bevor du den Dienst wechselst."); return;
    }
    setBusy("check"); setError("");
    try {
      if (save) {
        const result = await action<State & Health>("/connection", state.session_key, { service_url: url });
        setState({ ...state, ...result }); setHealth(result);
      } else setHealth(await action<Health>("/check", state.session_key));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  function goHome() {
    if (dirty) { setLeaveTarget("home"); setLeave(true); }
    else onHome();
  }

  async function workflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!state || busy) return;
    const form = event.currentTarget;
    const body = new FormData(form);
    const profile = body.get("profile"); body.delete("profile");
    setBusy("workflow"); setError(""); setNotice("");
    try {
      const result = await action<{ path: string }>(`/workflows/${encodeURIComponent(String(profile))}`, state.session_key, body);
      setNotice(`Gespeichert: ${result.path}`); form.reset();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  return <div className="pdf-workshop">
    <ToolHeader title="edeco PDF-Werkstatt" onHome={goHome} disabled={busy === "workflow" || working}>
      {Boolean(state?.workflows.length) && <button className="btn" onClick={() => setWorkflows(!workflows)}>Firmenabläufe</button>}
      {!state?.local && <button className="btn" onClick={() => setSettings(!settings)}>Verbindung</button>}
    </ToolHeader>
    {state?.local && !health?.ready && <section className="pdf-connection" aria-label="Lokaler PDF-Dienst"><h1>edeco PDF-Werkstatt</h1><p role="status">{health?.message || "Der lokale PDF-Dienst wird gestartet. Beim ersten Start kann dies etwas dauern."}</p><button className="btn" disabled={Boolean(busy)} onClick={() => void check(false)}>Status prüfen</button>{error && <p role="alert">{error}</p>}</section>}
    {info && <section className="pdf-connection pdf-info"><button className="btn" onClick={() => setInfo(false)}>Info schliessen</button><iframe className="pdf-stirling-frame" title="Info / Lizenzen" src={API + "/licenses"} /></section>}
    {!state?.local && (settings || !health?.ready) && <section className="pdf-connection" aria-label="PDF-Verbindung">
      <div><h1>Deine PDF-Werkstatt.</h1><p>PDF-Seiten in der gemeinsamen edeco-Oberfläche zusammenstellen.</p>
        <p className="pdf-muted">PDFs werden ausschliesslich an den von euch eingestellten Stirling-Dienst übertragen. Bitte nur euren lokalen Dienst oder den firmeneigenen Server eintragen.</p></div>
      <form onSubmit={event => { event.preventDefault(); void check(!state?.managed); }}>
        <label>Adresse des Firmen-PDF-Dienstes<input type="url" required value={url} disabled={!state || state.managed || Boolean(busy)}
          placeholder="http://PDF-SERVER:8088" onChange={event => setUrl(event.target.value)} /></label>
        {state?.managed && <span className="pdf-muted">Die Adresse wird von der Firma vorgegeben.</span>}
        <div className="pdf-actions"><button className="btn primary" disabled={!state || Boolean(busy)}>{busy === "check" ? "Verbindung wird geprüft …" : state?.managed ? "Verbindung prüfen" : "Speichern und verbinden"}</button>
          {health?.ready && <button type="button" className="btn" onClick={() => setSettings(false)}>Schliessen</button>}</div>
      </form>
      {health && <p role="status" className={health.ready ? "pdf-connected" : "pdf-muted"}>{health.message}</p>}
      {error && <p role="alert" className="pdf-error">{error}</p>}
    </section>}
    {workflows && state && <section className="pdf-workflows" aria-label="Firmenabläufe">
      <h2>Nach Firmenvorgabe ablegen</h2><p>Das fertige PDF wählen. Der eingerichtete Ablauf kann es stempeln und im vorgesehenen Ordner speichern. Bestehende Dateien werden nicht überschrieben.</p>
      <form onSubmit={workflow}><label>Ablauf<select name="profile" required>{state.workflows.map(profile => <option key={profile.id} value={profile.id}>{profile.title}</option>)}</select></label>
        <label>Fertiges PDF<input name="file" type="file" accept=".pdf" required disabled={Boolean(busy)} /></label>
        <button className="btn primary" disabled={Boolean(busy)}>{busy === "workflow" ? "Wird abgelegt …" : "Firmenablauf ausführen"}</button></form>
      {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="pdf-error">{error}</p>}
    </section>}
    {health?.ready && state && <>
      {tool && <nav className="pdf-workshop-nav" aria-label="PDF-Werkzeuge"><button className="btn small" disabled={working} onClick={toolsHome}>← Alle PDF-Werkzeuge</button><span>{tool.title}</span></nav>}
      {!tool ? <><PdfToolHome capabilities={capabilities} onInfo={() => setInfo(true)} onOpen={id => { setActiveTool(id); setDirty(false); }} />{error && <p role="alert" className="pdf-desk-alert">{error}</p>}</>
        : tool.id === "organize" || tool.id === "merge" ? <PageWorkbench sessionKey={state.session_key} onDirty={() => setDirty(true)} onWorking={setWorking} />
          : <PdfTask key={tool.id} tool={tool} sessionKey={state.session_key} onDirty={() => setDirty(true)} onWorking={setWorking} />}
    </>}
    {leave && <LeaveDialog target={leaveTarget === "home" ? "Zur Toolbox wechseln" : "Zur Werkzeugübersicht"} onClose={() => setLeave(false)} onLeave={() => { setLeave(false); setDirty(false); if (leaveTarget === "home") onHome(); else setActiveTool(""); }} />}
  </div>;
}
