import { useEffect, useState } from "react";
import { api, type LegendDefaultsInfo, type LegendPresentationDefaults } from "../api";
import type { LegendDoc } from "../legend";

export default function LegendDefaultsPanel({ projectId, doc, onApply }: { projectId: string; doc: LegendDoc; onApply: (value: LegendPresentationDefaults) => void }) {
  const [scope, setScope] = useState<"legend" | "project" | "company">("legend");
  const [info, setInfo] = useState<LegendDefaultsInfo | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    api.legendDefaults(projectId).then(value => { if (active) setInfo(value); }).catch(error => { if (active) setMessage((error as Error).message); });
    return () => { active = false; };
  }, [projectId]);
  const saved = scope === "project" ? info?.project : scope === "company" ? info?.company : null;
  async function save() {
    if (scope === "legend") return;
    setBusy(true); setMessage("");
    try { setInfo(await api.saveLegendDefaults(projectId, scope, doc)); setMessage("Standard gespeichert. Bestehende Legenden bleiben unverändert."); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }
  return <details className="legend-settings-card legend-defaults-panel">
    <summary>Standards & Geltungsbereich</summary>
    <div className="legend-settings-content">
      <label className="field"><span>Gilt für</span><select className="select" aria-label="Geltungsbereich der Legendenstandards" disabled={busy} value={scope} onChange={event => { setScope(event.target.value as typeof scope); setMessage(""); }}><option value="legend">Diese Legende</option><option value="project">Projektstandard</option><option value="company">Firmenstandard</option></select></label>
      {scope === "legend" ? <p className="hint">Änderungen werden in dieser Legende gespeichert und lassen sich rückgängig machen.</p> : <>
        <p className="hint">Layout, Textregeln und Varianten als Vorgabe für neue Vorschläge. Geschosse, Titel und Legendeninhalte werden nicht übernommen.</p>
        {scope === "company" && !info?.is_admin && <p className="hint">Den Firmenstandard dürfen nur die hinterlegten Admins ändern. Laden bleibt möglich.</p>}
        <div className="legend-standard-actions"><button type="button" className="btn small" disabled={busy || !info || (scope === "company" && !info.is_admin)} onClick={() => void save()}>{busy ? "Speichert …" : "Als Standard speichern"}</button><button type="button" className="btn small" disabled={busy || !saved} onClick={() => { if (saved) { onApply(saved); setMessage("Standard in diese Legende übernommen. Rückgängig bleibt möglich."); } }}>Standard laden</button></div>
        {info && !saved && <p className="hint">Für diesen Bereich ist noch kein Standard hinterlegt.</p>}
      </>}
      {message && <p className="hint" role="status">{message}</p>}
    </div>
  </details>;
}
