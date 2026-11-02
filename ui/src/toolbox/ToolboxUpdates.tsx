import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "../useDialogFocus";
import { parseReleaseNotes } from "../releaseNotes";

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
}

export default function ToolboxUpdates() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const actionVersion = useRef(0);

  async function load(): Promise<UpdateState> {
    const response = await fetch("/api/toolbox/updates");
    if (!response.ok) throw new Error("Updatestatus nicht erreichbar.");
    return response.json();
  }

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

  return <>
    <button className={`btn ${state?.status === "available" ? "toolbox-update-available" : ""}`}
      disabled={Boolean(busy)} onClick={() => { setOpen(true); void run("check"); }}>
      {busy === "check" ? "Updateprüfung läuft …" : state?.status === "available" ? "Update verfügbar" : "Nach Updates suchen"}
    </button>
    {open && <UpdateDialog state={state} busy={busy} error={error} run={run} close={() => setOpen(false)} />}
  </>;
}

function UpdateDialog({ state, busy, error, run, close }: {
  state: UpdateState | null; busy: string; error: string;
  run: (action: string, body?: object) => Promise<void>; close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirm, setConfirm] = useState(false);
  const changes = parseReleaseNotes(state?.notes ?? "");
  useDialogFocus(ref, close, Boolean(busy));
  return <div className="modal-back">
    <div ref={ref} className="modal toolbox-update-dialog" role="dialog" aria-modal="true"
      aria-labelledby="toolbox-update-title" tabIndex={-1}>
      <h2 id="toolbox-update-title">Toolbox-Updates</h2>
      <p>Ein gemeinsames Update für alle Werkzeuge.</p>
      {state && <>
        <p className="toolbox-update-version">Installierter Stand: {state.current}</p>
        {state.latest && <p>Neuester Stand: {state.latest}</p>}
        <p role="status">{busy === "check" ? "Neue Version wird gesucht …" : busy === "install" ? "Setup wird heruntergeladen und geprüft …" : state.message}</p>
        {(state.status === "available" || changes.points.length > 0) && <section className="toolbox-update-changes" aria-labelledby="toolbox-update-changes-title">
          <h3 id="toolbox-update-changes-title">Was sich geändert hat</h3>
          {state.latest && <p className="toolbox-update-changes-version">In Version {state.latest}</p>}
          {changes.points.length > 0 ? <>
            <ul>{changes.points.slice(0, 5).map((point, index) => <li key={index}>{point}</li>)}</ul>
            {changes.points.length > 5 && <details className="toolbox-update-more">
              <summary>Weitere Änderungen ({changes.points.length - 5})</summary>
              <ul>{changes.points.slice(5).map((point, index) => <li key={index}>{point}</li>)}</ul>
            </details>}
          </> : <p className="toolbox-update-notes-missing">Für diese Version wurden keine Änderungsnotizen mitgeliefert. Weitere Informationen findest du unter «Releases öffnen».</p>}
        </section>}
        {state.notes?.trim() && <details className="toolbox-update-full-notes">
          <summary>Vollständige Release-Notizen</summary>
          <pre className="toolbox-update-notes">{state.notes}</pre>
        </details>}
        <label className="toolbox-update-preference">
          <input type="checkbox" checked={state.automatic} disabled={Boolean(busy)}
            onChange={e => run("preferences", { automatic: e.target.checked })} />
          Beim Programmstart nach Updates suchen
        </label>
        {confirm && <div className="toolbox-update-confirm">
          <p>Die Toolbox schliesst sich für das Update. Danach startet sie wieder. Persönliche Daten bleiben ausserhalb des Installationsordners erhalten.</p>
          <button className="btn primary" disabled={Boolean(busy)} onClick={() => run("install")}>Jetzt aktualisieren</button>
        </div>}
      </>}
      {error && <p role="alert" className="warn-text">{error}</p>}
      <div className="toolbox-update-actions">
        <button className="btn" disabled={!state || Boolean(busy)} onClick={() => run("check")}>Jetzt prüfen</button>
        <a className="btn" href="https://github.com/alxdrg-be/edeco-tool/releases" target="_blank" rel="noreferrer">Releases öffnen</a>
        {state?.can_install && !confirm && <button className="btn primary" disabled={Boolean(busy)} onClick={() => setConfirm(true)}>Update installieren</button>}
        <button className="btn" disabled={Boolean(busy)} onClick={close}>Schliessen</button>
      </div>
    </div>
  </div>;
}
