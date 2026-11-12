import { useEffect, useRef, useState } from "react";
import { Check, Download, LoaderCircle, RotateCw, ShieldCheck } from "lucide-react";
import { useDialogFocus } from "../shared/useDialogFocus";
import { parseReleaseNotes } from "./releaseNotes";
import "./toolbox-updates.css";

interface UpdateState {
  current: string;
  latest?: string;
  status: string;
  message: string;
  notes?: string;
  can_install: boolean;
  packaged: boolean;
  automatic: boolean;
  release_url: string;
  session_key: string;
  checked_at?: string | null;
  downloaded_bytes?: number;
  total_bytes?: number;
  progress?: number;
}

const ACTIVE_STATES = new Set(["downloading", "verifying", "installing"]);
const megabytes = (value: number) => `${(value / (1024 * 1024)).toLocaleString("de-CH", { maximumFractionDigits: 1 })} MB`;

async function load(): Promise<UpdateState> {
  const response = await fetch("/api/toolbox/updates", { cache: "no-store" });
  if (!response.ok) throw new Error("Updatestatus nicht erreichbar.");
  return response.json();
}

export default function ToolboxUpdates() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const actionVersion = useRef(0);

  async function request(path: string, snapshot: UpdateState, body = {}) {
    const response = await fetch(`/api/toolbox/updates/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Edeco-Update": snapshot.session_key },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Updateaktion fehlgeschlagen.");
    return data as UpdateState;
  }

  useEffect(() => {
    let cancelled = false;
    const version = actionVersion.current;
    load().then(async data => {
      if (cancelled || actionVersion.current !== version) return;
      setState(data);
      // Development and browser tests never make an automatic external request.
      if (data.packaged && data.automatic && (!data.checked_at || Date.now() - Date.parse(data.checked_at) > 300000)) {
        setBusy("check");
        try {
          const checked = await request("check", data);
          if (!cancelled && actionVersion.current === version) setState(checked);
        } finally { if (!cancelled && actionVersion.current === version) setBusy(""); }
      }
    }).catch(e => { if (!cancelled && actionVersion.current === version) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (busy !== "install" && !ACTIVE_STATES.has(state?.status ?? "")) return;
    let cancelled = false, loading = false;
    const version = actionVersion.current;
    const poll = async () => {
      if (loading) return;
      loading = true;
      try {
        const snapshot = await load();
        if (!cancelled && actionVersion.current === version) setState(snapshot);
      } catch { /* The local server closes as the checked setup takes over. */ }
      finally { loading = false; }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 600);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [busy, state?.status]);

  async function run(action: string, body = {}) {
    if (busy) return;
    const version = ++actionVersion.current;
    setBusy(action);
    setError("");
    try {
      const snapshot = state || await load();
      const result = await request(action, snapshot, body);
      if (actionVersion.current === version) setState(result);
    }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  const updating = busy === "install" || ACTIVE_STATES.has(state?.status ?? "");
  return <>
    <button className={`btn ${state?.status === "available" ? "toolbox-update-available" : ""}`}
      disabled={Boolean(busy) || updating} onClick={() => { setOpen(true); void run("check"); }}>
      {updating ? "Update läuft …" : busy === "check" ? "Updateprüfung läuft …" : state?.status === "available" ? "Update verfügbar" : "Nach Updates suchen"}
    </button>
    {(open || updating) && <UpdateDialog state={state} busy={busy} error={error} run={run} close={() => setOpen(false)} />}
  </>;
}

function UpdateDialog({ state, busy, error, run, close }: {
  state: UpdateState | null; busy: string; error: string;
  run: (action: string, body?: object) => Promise<void>; close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState(false);
  const changes = parseReleaseNotes(state?.notes ?? "");
  const installing = busy === "install" || ACTIVE_STATES.has(state?.status ?? "");
  const blocked = Boolean(busy) || installing;
  const phase = state?.status === "installing" ? 2 : state?.status === "verifying" ? 1 : 0;
  useDialogFocus(ref, close, blocked);
  return <div className="modal-back">
    <div ref={ref} className={`modal toolbox-update-dialog${installing ? " is-installing" : ""}`} role="dialog" aria-modal="true"
      aria-labelledby="toolbox-update-title" tabIndex={-1}>
      <h2 id="toolbox-update-title">{installing ? "Der Toolhub wird aktualisiert" : "Toolhub-Updates"}</h2>
      {installing ? <section className="toolbox-update-progress" aria-label="Update-Fortschritt" aria-busy="true">
        <LoaderCircle className="toolbox-update-spinner" size={32} aria-hidden="true" />
        <p role="status">{state?.status === "installing" ? "Download geprüft. Das Setup startet gleich …" : state?.status === "verifying" ? "Die Prüfsumme wird geprüft …" : "Das Update wird heruntergeladen …"}</p>
        <progress aria-label="Update herunterladen" max={100} value={phase === 0 && state?.progress !== undefined ? state.progress : undefined} />
        {phase === 0 && state?.total_bytes ? <p className="toolbox-update-byte-count">{megabytes(state.downloaded_bytes ?? 0)} von {megabytes(state.total_bytes)} · {Math.floor(state.progress ?? 0)} %</p> : null}
        <ol className="toolbox-update-steps">{[
          { title: "Herunterladen", icon: Download },
          { title: "Prüfen", icon: ShieldCheck },
          { title: "Setup starten", icon: RotateCw },
        ].map((step, index) => <li key={step.title} aria-current={phase === index ? "step" : undefined} data-complete={phase > index}>{phase > index ? <Check size={17} /> : <step.icon size={17} />}<span>{step.title}</span></li>)}</ol>
        <p className="toolbox-update-restart-note">Das Programm schliesst sich nach dem Download. Danach zeigt das Setup den Installationsfortschritt und startet den Toolhub neu.</p>
      </section> : <p>Ein gemeinsames Update für alle Werkzeuge.</p>}
      {state && <>
        <p className="toolbox-update-version">Installierter Stand: {state.current}</p>
        {state.latest && <p>Neuester Stand: {state.latest}</p>}
        {!installing && <p role="status">{busy === "check" ? "Neue Version wird gesucht …" : state.message}</p>}
        {!installing && (state.status === "available" || changes.points.length > 0) && <section className="toolbox-update-changes" aria-labelledby="toolbox-update-changes-title">
          <h3 id="toolbox-update-changes-title">Was sich geändert hat</h3>
          {state.latest && <p className="toolbox-update-changes-version">In Version {state.latest}</p>}
          {changes.points.length > 0 ? <>
            <ul>{changes.points.slice(0, 5).map((point, index) => <li key={index}>{point}</li>)}</ul>
            {changes.points.length > 5 && <details className="toolbox-update-more">
              <summary tabIndex={0}>Weitere Änderungen ({changes.points.length - 5})</summary>
              <ul>{changes.points.slice(5).map((point, index) => <li key={index}>{point}</li>)}</ul>
            </details>}
          </> : <p className="toolbox-update-notes-missing">Für diese Version wurden keine Änderungsnotizen mitgeliefert. Weitere Informationen findest du unter «Releases öffnen».</p>}
        </section>}
        {!installing && state.notes?.trim() && <details className="toolbox-update-full-notes">
          <summary tabIndex={0}>Vollständige Release-Notizen</summary>
          <pre className="toolbox-update-notes">{state.notes}</pre>
        </details>}
        <label className="toolbox-update-preference">
          <input type="checkbox" checked={state.automatic} disabled={blocked}
            onChange={e => run("preferences", { automatic: e.target.checked })} />
          Beim Programmstart nach Updates suchen
        </label>
        {confirm && !installing && <div className="toolbox-update-confirm">
          <p>Der Toolhub schliesst sich für das Update. Danach startet er wieder. Persönliche Daten bleiben ausserhalb des Installationsordners erhalten.</p>
          <button className="btn primary" disabled={blocked} onClick={() => run("install")}>Jetzt aktualisieren</button>
        </div>}
      </>}
      {error && <p role="alert" className="warn-text">{error}</p>}
      <div className="toolbox-update-actions">
        {!installing && <><button className="btn" disabled={!state || blocked} onClick={() => run("check")}>Jetzt prüfen</button>
          <a className="btn" href="https://github.com/alxdrg-be/edeco-tool/releases" target="_blank" rel="noreferrer">Releases öffnen</a>
          {state?.can_install && !confirm && <button className="btn primary" disabled={blocked} onClick={() => setConfirm(true)}>Update installieren</button>}
          <button className="btn" disabled={blocked} onClick={close}>Schliessen</button></>}
      </div>
    </div>
  </div>;
}
