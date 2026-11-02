import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Download, FolderOpen, Info, Moon, Printer, Save, Sun, X } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import { useDialogFocus } from "../../useDialogFocus";
import "./lab.css";
import { ArchiveSaveDialog } from "./ablage/ArchiveDialogs";
import type { ArchivePayload } from "./ablage/api";
import { exportCalculationPDF, type CalculationPDFReport } from "./pdfExport";

export interface Help { title: string; content: ReactNode }
export function InfoButton({ title, onClick }: { title: string; onClick: () => void }) {
  return <button type="button" className="lab-info" aria-label={`Info: ${title}`} title={`ⓘ ${title}`} onClick={onClick}><Info size={15} /></button>;
}
export function InfoDrawer({ help, onClose, busy = false }: { help: Help; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLElement>(null), id = useId();
  const opener = useRef(document.activeElement as HTMLElement | null);
  useDialogFocus(ref, onClose, busy);
  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".engineering-lab");
    if (!workspace) return;
    const old = workspace.style.overflow; workspace.style.overflow = "hidden";
    return () => {
      workspace.style.overflow = old;
      // React removes `inert` after layout cleanup; restore focus on the next frame.
      requestAnimationFrame(() => { if (!document.querySelector(".lab-drawer") && opener.current?.isConnected) opener.current.focus(); });
    };
  }, []);
  return <div className="lab-overlay calc-no-print" onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <aside ref={ref} className="lab-drawer" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
      <div className="edeco:flex edeco:items-center edeco:justify-between edeco:gap-4"><span className="lab-eyebrow">EDECO · INFORMATION</span><button className="lab-icon" disabled={busy} aria-label="Information schliessen" onClick={onClose}><X size={20} /></button></div>
      <h2 id={id}>{help.title}</h2><div className="lab-prose">{help.content}</div>
    </aside></div>;
}
export function Parameter({ label, value, onChange, min, max, step = 1, unit, info, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; min: number; max: number; step?: number; unit?: string; info: () => void; disabled?: boolean;
}) {
  const id = useId(), parsed = Number(value.replace(",", ".")), valid = value.trim() !== "" && Number.isFinite(parsed);
  return <div className="lab-parameter"><div className="edeco:flex edeco:items-center edeco:justify-between edeco:gap-3"><label htmlFor={id}>{label}</label><InfoButton title={label} onClick={info} /></div>
    <div className="lab-number"><input id={id} aria-label={label} inputMode="decimal" autoComplete="off" maxLength={24} disabled={disabled} value={value} onChange={event => onChange(event.target.value)} /><span>{unit}</span></div>
    <input className="lab-range" type="range" aria-label={`${label} Slider`} disabled={disabled} min={min} max={max} step={step} value={valid ? Math.max(min, Math.min(max, parsed)) : min} onChange={event => onChange(event.target.value)} />
  </div>;
}
export function Segments<T extends string>({ label, value, options, onChange, disabled = false }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean }) {
  return <div className="lab-segments" role="group" aria-label={label}>{options.map(option => <button type="button" key={option.value} disabled={disabled} aria-pressed={value === option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}
export function LabShell({ title, subtitle, children, help, setHelp, onHome, onOpenTool, exportData, canExport, canArchive, report, pdfReport, archive, reviewLabel = "Rechenhilfe · Freigabe offen" }: ToolProps & {
  title: string; subtitle: string; children: ReactNode; help: Help | null; setHelp: (help: Help | null) => void; exportData?: () => void; canExport?: boolean; canArchive?: boolean; report?: ReactNode; pdfReport?: CalculationPDFReport | null; archive?: ArchivePayload; reviewLabel?: string;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [pdfBusy, setPDFBusy] = useState(false), [pdfError, setPDFError] = useState("");
  const [dark, setDark] = useState(() => { try { return localStorage.getItem("edeco.calculations.theme") !== "light"; } catch { return true; } });
  function toggle() { setDark(old => { try { localStorage.setItem("edeco.calculations.theme", old ? "light" : "dark"); } catch { /* theme still works in memory */ } return !old; }); }
  async function downloadPDF() {
    if (!canExport || !pdfReport || pdfBusy) return;
    setPDFBusy(true); setPDFError("");
    try { await exportCalculationPDF(pdfReport); }
    catch (error) { setPDFError(error instanceof Error ? error.message : "PDF konnte nicht erstellt werden."); }
    finally { setPDFBusy(false); }
  }
  return <div className={`calc-workspace engineering-lab ${canExport ? "lab-export-ready" : ""}`} data-lab-theme={dark ? "dark" : "light"}>
    <div className="lab-shell" inert={Boolean(help || saveOpen)}>
      <header className="lab-header calc-no-print"><button className="lab-back" onClick={() => onOpenTool ? onOpenTool("berechnungen") : onHome()}><ArrowLeft size={17} /><span>Berechnungen</span></button><span className="lab-brand">edeco<span> / {title}</span></span>
        <div className="lab-header-actions"><button className="lab-icon" onClick={toggle} aria-label={dark ? "Heller Rechnermodus" : "Dunkler Rechnermodus"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          {archive && <button className="lab-icon" disabled={!(canArchive ?? canExport)} aria-label="Projektbezogen auf Server speichern" title="Gemeinsam speichern" onClick={() => setSaveOpen(true)}><Save size={18} /></button>}
          {onOpenTool && <button className="lab-icon" aria-label="Gemeinsame Berechnungsablage öffnen" title="Gemeinsame Ablage" onClick={() => onOpenTool("berechnungsablage")}><FolderOpen size={18} /></button>}
          {pdfReport !== undefined && <button className="lab-icon lab-pdf" disabled={!canExport || !pdfReport || pdfBusy} aria-label="Berechnung als PDF herunterladen" onClick={downloadPDF}><Download size={17} /><span>{pdfBusy ? "PDF …" : "PDF"}</span></button>}
          {exportData && <><button className="lab-icon" disabled={!canExport} aria-label="Ergebnis als JSON sichern" title="JSON sichern" onClick={exportData}><Download size={18} /></button><button className="lab-icon" disabled={!canExport} aria-label="Drucken / als PDF speichern" title="Drucken / PDF" onClick={() => window.print()}><Printer size={18} /></button></>}
          <button className="lab-home" onClick={onHome}>Zur Toolbox</button></div>
      </header>
      <main className="lab-main"><div className="lab-heading"><div><p className="lab-eyebrow">EDECO ENGINEERING</p><h1>{title}</h1><span className="lab-subtitle">{subtitle}</span></div><span className="lab-review">{reviewLabel}</span></div>
        {pdfError && <p className="lab-error" role="alert">{pdfError}</p>}
        {children}
        <div className="lab-print-only lab-prose">{report}</div>
      </main>
    </div>
    {help && <InfoDrawer help={help} onClose={() => setHelp(null)} />}
    {saveOpen && archive && <ArchiveSaveDialog payload={archive} onClose={() => setSaveOpen(false)} />}
  </div>;
}
