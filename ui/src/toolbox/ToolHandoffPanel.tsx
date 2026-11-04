import { useEffect, useState } from "react";
import { ArrowUpRight, Files, X } from "lucide-react";
import { consumeToolHandoff, HANDOFF_EVENT, pendingToolHandoff, stageToolHandoff, type HandoffTarget } from "./toolHandoff";
import "./tool-handoff.css";

export function IncomingToolFiles({ target, disabled, onReceive, currentProjectId }: {
  target: HandoffTarget; disabled?: boolean; currentProjectId?: string | null;
  onReceive: (files: File[]) => void | boolean | Promise<void | boolean>;
}) {
  const [pending, setPending] = useState(() => pendingToolHandoff(target));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => setPending(pendingToolHandoff(target));
    window.addEventListener(HANDOFF_EVENT, refresh);
    return () => window.removeEventListener(HANDOFF_EVENT, refresh);
  }, [target]);
  if (!pending) return null;
  async function receive() {
    if (!pending || busy || disabled) return;
    const current = pendingToolHandoff(target);
    if (!current || current.id !== pending.id) { setPending(current); return; }
    setBusy(true); setError("");
    try {
      if (await onReceive([...current.files]) === false) return;
      consumeToolHandoff(target, current.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Die Dateien konnten nicht übernommen werden."); }
    finally { setBusy(false); }
  }
  return <section className="tool-handoff" aria-label="Dateiübergabe">
    <Files size={20} aria-hidden="true" />
    <div><strong>Aus {pending.source}</strong><span>{pending.files.map(file => file.name).join(" · ")}</span>
      {pending.projectLabel && <small>Quellprojekt: {pending.projectLabel}{pending.projectId && pending.projectId !== currentProjectId ? " · Aktives Projekt bleibt unverändert." : ""}</small>}
      <small>Lokale Kopie in dieser Sitzung. Keine Datei wird versendet oder überschrieben.</small>
      {error && <span role="alert">{error}</span>}
    </div>
    <button type="button" className="btn primary" disabled={disabled || busy} onClick={() => void receive()}>{busy ? "Wird übernommen …" : "Dateien übernehmen"}</button>
    <button type="button" className="btn" aria-label="Dateiübergabe verwerfen" disabled={busy} onClick={() => consumeToolHandoff(target, pending.id)}><X size={17} /></button>
  </section>;
}

export function SendFilesToTool({ files, source, projectId, projectLabel, onOpenTool, disabled, onError }: {
  files: readonly File[]; source: string; projectId?: string; projectLabel?: string;
  onOpenTool?: (id: string) => void; disabled?: boolean; onError?: (message: string) => void;
}) {
  if (!onOpenTool) return null;
  function send(target: HandoffTarget) {
    try { stageToolHandoff({ target, source, files, projectId, projectLabel }); onOpenTool?.(target); }
    catch (caught) { onError?.(caught instanceof Error ? caught.message : "Die Dateiübergabe ist fehlgeschlagen."); }
  }
  return <details className="tool-send-to"><summary aria-disabled={disabled || !files.length}>Senden an <ArrowUpRight size={15} /></summary>
    <div><p>{files.length ? `${files.length} fertige PDF${files.length === 1 ? "" : "s"} weitergeben` : "Zuerst ein PDF erstellen."}</p>
      <button className="btn" type="button" disabled={disabled || !files.length} onClick={() => send("dateien-umbenennen")}>Dateien umbenennen</button>
      <small>Dateien am Ziel ausdrücklich übernehmen. Projektzuordnung bleibt unverändert.</small>
    </div>
  </details>;
}
