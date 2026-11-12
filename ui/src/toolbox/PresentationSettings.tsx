import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Settings, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "../useDialogFocus";
import { TOOLS } from "./catalog";
import { DEFAULT_DEMO_TOOLS, type PresentationPolicy } from "./presentationPolicy";
import "./presentation.css";
import { readJson } from "../shared/http";

const API = "/api/toolbox/presentation";
interface ContextValue {
  policy: PresentationPolicy | null;
  error: string;
  refresh: () => Promise<void>;
  save: (value: Pick<PresentationPolicy, "demo_enabled" | "demo_tools" | "admins">) => Promise<void>;
}
const PresentationContext = createContext<ContextValue>({ policy: null, error: "", refresh: async () => {}, save: async () => {} });
export const usePresentation = () => useContext(PresentationContext);

async function readResponse(response: Response): Promise<PresentationPolicy> {
  const data = await readJson<PresentationPolicy | null>(response, "Die Toolhub-Einstellungen konnten nicht geladen werden.");
  if (!data || typeof data.revision !== "string" || typeof data.demo_enabled !== "boolean" || !Array.isArray(data.demo_tools) || !Array.isArray(data.admins)) {
    throw new Error("Die Toolhub-Einstellungen haben ein unbekanntes Format.");
  }
  return data as PresentationPolicy;
}

export function PresentationProvider({ children }: { children: ReactNode }) {
  const [policy, setPolicy] = useState<PresentationPolicy | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { const value = await readResponse(await fetch(API)); setPolicy(value); setError(""); }
    catch (failure) { setError((failure as Error).message); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const save = useCallback(async (value: Pick<PresentationPolicy, "demo_enabled" | "demo_tools" | "admins">) => {
    if (!policy) throw new Error("Die Einstellungen werden noch geladen.");
    const updated = await readResponse(await fetch(API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...value, revision: policy.revision }) }));
    setPolicy(updated); setError("");
  }, [policy]);
  return <PresentationContext.Provider value={{ policy, error, refresh, save }}>{children}</PresentationContext.Provider>;
}

export function DemoBadge() {
  const { policy } = usePresentation();
  return policy?.demo_enabled ? <span className="toolhub-demo-badge" title="Die Präsentationsauswahl wird in den Toolhub-Einstellungen verwaltet.">Demo-Modus</span> : null;
}

function SettingsDialog({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const { policy, save } = usePresentation();
  const [demo, setDemo] = useState(policy?.demo_enabled ?? false);
  const [tools, setTools] = useState(policy?.demo_tools ?? DEFAULT_DEMO_TOOLS);
  const [admins, setAdmins] = useState(policy?.admins.join("\n") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose, busy);
  if (!policy) return null;
  async function submit() {
    if (!policy?.can_manage || busy) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      await save({ demo_enabled: demo, demo_tools: tools,
        admins: admins.split(/[\n;,]+/).map(name => name.trim()).filter(Boolean) });
      setSaved(true); onSaved?.();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return createPortal(<div className="modal-back" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} className="modal toolhub-presentation-dialog" role="dialog" aria-modal="true" aria-labelledby="toolhub-settings-title" tabIndex={-1}>
      <div className="toolhub-settings-heading"><h2 id="toolhub-settings-title">Toolhub-Einstellungen</h2><button className="btn icon" aria-label="Einstellungen schliessen" disabled={busy} onClick={onClose}><X size={18} /></button></div>
      <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <fieldset disabled={!policy.can_manage || busy}>
          <label className="toolhub-demo-switch"><input type="checkbox" checked={demo} onChange={event => { setDemo(event.target.checked); setSaved(false); }} /><span><strong>Demo-Modus</strong><small>Nur die gewählten Werkzeuge zeigen.</small></span></label>
          <div className="toolhub-demo-tools" role="group" aria-label="Werkzeuge im Demo-Modus">{DEFAULT_DEMO_TOOLS.map(id => <label key={id}>
            <input type="checkbox" checked={tools.includes(id)} disabled={id === "nova-legenden"} onChange={event => { setTools(old => event.target.checked ? [...old, id] : old.filter(value => value !== id)); setSaved(false); }} />
            <span>{TOOLS.find(tool => tool.id === id)?.title}</span>
          </label>)}</div>
          <details className="toolhub-settings-details"><summary>Administratoren & Windows-Anmeldung</summary>
            <p>Angemeldet: <strong>{policy.identity || "Windows-Anmeldung nicht verfügbar"}</strong>{policy.is_admin ? " · Administrator" : ""}</p>
            <label>Administrator-Anmeldenamen<textarea aria-label="Administrator-Anmeldenamen" value={admins} rows={3} spellCheck={false} onChange={event => { setAdmins(event.target.value); setSaved(false); }} /></label>
            <p>Ein Name pro Zeile, zum Beispiel aduerger oder FIRMA\benutzer. Gross-/Kleinschreibung spielt keine Rolle. Administratoren sehen ausserhalb der Demo auch ausgeblendete verfügbare Werkzeuge.</p>
            <p>Die Liste steuert die lokalen Toolhub-Einstellungen. Windows-Dateirechte und Firmenberechtigungen gelten zusätzlich. Bei leerer Liste können alle lokalen Benutzer die Einstellung ändern.</p>
          </details>
        </fieldset>
        {!policy.windows_roles && <p className="toolhub-settings-note">Die Windows-Zuordnung wird auf Windows geprüft. In dieser Entwicklungsumgebung bleiben die Einstellungen bearbeitbar.</p>}
        {!policy.can_manage && <p className="toolhub-settings-note">Diese Einstellungen werden von den hinterlegten Administratoren verwaltet.</p>}
        {error && <p role="alert" className="error">{error}</p>}
        {saved && <p role="status" className="toolhub-settings-saved">Gespeichert.</p>}
        <div className="toolhub-settings-actions"><button className="btn" type="button" disabled={busy} onClick={onClose}>Schliessen</button>
          {policy.can_manage && <button className="btn primary" type="submit" disabled={busy}>{busy ? "Wird gespeichert …" : "Speichern"}</button>}</div>
      </form>
    </div>
  </div>, document.body);
}

export default function PresentationSettings({ onSaved }: { onSaved?: () => void }) {
  const { policy, save } = usePresentation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function endDemo() {
    if (!policy || busy) return;
    setBusy(true); setError("");
    try { await save({ demo_enabled: false, demo_tools: policy.demo_tools, admins: policy.admins }); onSaved?.(); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <>{policy?.demo_enabled && policy.can_manage && <button className="btn" disabled={busy} onClick={() => void endDemo()}>{busy ? "Demo wird beendet …" : "Demo beenden"}</button>}
    <button className="btn toolhub-settings-button" aria-label="Toolhub-Einstellungen" title="Toolhub-Einstellungen" disabled={!policy} onClick={() => setOpen(true)}><Settings size={16} /><span>Einstellungen</span></button>
    {error && <small role="alert">{error}</small>}
    {open && <SettingsDialog onClose={() => setOpen(false)} onSaved={onSaved} />}</>;
}
