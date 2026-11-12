import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Download, FolderOpen, Info, Moon, MoreHorizontal, Printer, Save, Search, Sun, X } from "lucide-react";
import { calculatorPurpose } from "./purpose";
import type { ToolProps } from "../../toolbox/modules";
import { useDialogFocus } from "../../shared/useDialogFocus";
import "./lab.css";
import { ArchiveSaveDialog } from "./ablage/ArchiveDialogs";
import type { ArchivePayload } from "./ablage/api";
import { exportCalculationPDF, type CalculationPDFReport } from "./pdfExport";
import { KnowledgeLink } from "./KnowledgeLink";
import "@fontsource-variable/inter";
import ToolhubHeader from "../../toolbox/ToolhubHeader";
import { useToolhubLocation } from "../../toolbox/ToolhubNavigation";
import { useToolhubTheme } from "../../toolbox/useToolhubTheme";

export interface Help { title: string; content: ReactNode }
export function InfoButton({ title, onClick }: { title: string; onClick: () => void }) {
  return <button type="button" className="lab-info" aria-label={`Info: ${title}`} title={`ⓘ ${title}`} onClick={onClick}><Info size={15} /></button>;
}
export function InfoDrawer({ help, onClose, busy = false, footer }: { help: Help; onClose: () => void; busy?: boolean; footer?: ReactNode }) {
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
      <div className="edeco:flex edeco:items-center edeco:justify-between edeco:gap-4"><span className="lab-eyebrow">Information</span><button className="lab-icon" disabled={busy} aria-label="Information schliessen" onClick={onClose}><X size={20} /></button></div>
      <h2 id={id}>{help.title}</h2><div className="lab-prose">{help.content}</div>{footer && <div className="lab-drawer-footer">{footer}</div>}
    </aside></div>;
}
export function Parameter({ label, value, onChange, min, max, step = 1, unit, info, disabled = false, fieldKey }: {
  label: string; value: string; onChange: (value: string) => void; min: number; max: number; step?: number; unit?: string; info: () => void; disabled?: boolean; fieldKey?: string;
}) {
  const id = useId(), parsed = Number(value.replace(",", ".")), valid = value.trim() !== "" && Number.isFinite(parsed);
  return <div className="lab-parameter" data-field-key={fieldKey}><div className="edeco:flex edeco:items-center edeco:justify-between edeco:gap-3"><label htmlFor={id}>{label}</label><InfoButton title={label} onClick={info} /></div>
    <div className="lab-number"><input id={id} aria-label={label} inputMode="decimal" autoComplete="off" maxLength={24} disabled={disabled} value={value} onChange={event => onChange(event.target.value)} /><span>{unit}</span></div>
    <input className="lab-range" type="range" aria-label={`${label} Slider`} disabled={disabled} min={min} max={max} step={step} value={valid ? Math.max(min, Math.min(max, parsed)) : min} onChange={event => onChange(event.target.value)} />
  </div>;
}
export function Segments<T extends string>({ label, value, options, onChange, disabled = false, fieldKey }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean; fieldKey?: string }) {
  return <ChoiceCards fieldKey={fieldKey} label={label} value={value} options={options} onChange={onChange} disabled={disabled} />;
}
/** Small visual choices use buttons; ratings and long lists stay compact. */
export function ChoiceCards<T extends string>({ label, value, options, onChange, disabled = false, id, fieldKey, presentation = "auto" }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean; id?: string; fieldKey?: string; presentation?: "auto" | "cards" | "select";
}) {
  const [expanded, setExpanded] = useState(false), [query, setQuery] = useState("");
  const listId = useId();
  const useSelect = presentation === "select" || presentation === "auto" && (options.length > 6 || Boolean(fieldKey && ["rated", "upstream", "icn", "area", "in"].includes(fieldKey)));
  if (useSelect) return <div className="lab-card-choice lab-select-choice" data-choice-field={fieldKey}>
    <select id={id} aria-label={label} data-field-key={fieldKey} value={value} disabled={disabled} onChange={event => onChange(event.target.value as T)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={16} aria-hidden="true" />
  </div>;
  const selectedIndex = options.findIndex(option => option.value === value);
  const start = Math.max(0, Math.min(options.length - 6, selectedIndex - 2));
  const compact = options.slice(start, start + 6);
  const shown = (expanded ? options : compact).filter(option => !expanded || option.label.toLocaleLowerCase("de-CH").includes(query.trim().toLocaleLowerCase("de-CH")));
  return <div className="lab-card-choice" id={id} data-field-key={fieldKey}>
    {expanded && options.length > 12 && <label className="lab-choice-search"><Search size={15} /><input type="search" aria-label={`Optionen durchsuchen: ${label}`} placeholder="Option suchen …" value={query} disabled={disabled} maxLength={80} onChange={event => setQuery(event.target.value)} /></label>}
    <div className="lab-choice-grid" id={listId} role="group" aria-label={label}>{shown.map(option => <button type="button" key={option.value} disabled={disabled} data-choice-value={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}><span>{option.label}</span>{value === option.value && <span className="lab-choice-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>}</button>)}</div>
    {!shown.length && <p className="lab-note" role="status">Keine passende Option.</p>}
    {options.length > 6 && <button className="lab-choice-expand" type="button" aria-expanded={expanded} aria-controls={listId} disabled={disabled} onClick={() => { setExpanded(old => !old); setQuery(""); }}>{expanded ? "Weniger anzeigen" : `Alle ${options.length} Optionen anzeigen`}<ChevronDown size={15} style={{ transform: expanded ? "rotate(180deg)" : undefined }} /></button>}
  </div>;
}
export function Explanation({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return <details className={`lab-explanation ${className}`}><summary>{title}<ChevronDown size={16} aria-hidden="true" /></summary><div className="lab-prose">{children}</div></details>;
}
function CalculatorActions({ children }: { children: ReactNode }) {
  const [small, setSmall] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => { setSmall(media.matches); setOpen(false); };
    media.addEventListener("change", sync);
    // The viewport may change between the first render and this subscription.
    sync();
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!small || !open) return;
    const closeOutside = (event: PointerEvent) => { if (event.target instanceof Node && !ref.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [small, open]);
  return <details ref={ref} className="lab-export-actions" open={!small || open}
    onKeyDown={event => { if (small && event.key === "Escape") { event.preventDefault(); setOpen(false); ref.current?.querySelector("summary")?.focus(); } }}>
    <summary aria-label="Berechnungsaktionen" title="Speichern und exportieren" onClick={event => {
      // Keep one owner of the state: delayed native toggle events must not undo Escape.
      event.preventDefault();
      if (small) setOpen(value => !value);
    }}><MoreHorizontal size={18} aria-hidden="true" /><span>Aktionen</span></summary>
    <div className="lab-extra-panel">{children}</div>
  </details>;
}

export function LabShell({ title, subtitle, children, help, setHelp, onHome, onOpenTool, knowledgeId, exportData, canExport, canArchive, report, pdfReport, archive, reviewLabel = "Rechenhilfe · Freigabe offen" }: ToolProps & {
  title: string; subtitle: string; children: ReactNode; help: Help | null; setHelp: (help: Help | null) => void; knowledgeId?: string; exportData?: () => void; canExport?: boolean; canArchive?: boolean; report?: ReactNode; pdfReport?: CalculationPDFReport | null; archive?: ArchivePayload; reviewLabel?: string;
}) {
  const purpose = calculatorPurpose(knowledgeId);
  const [saveOpen, setSaveOpen] = useState(false);
  const [pdfBusy, setPDFBusy] = useState(false), [pdfError, setPDFError] = useState("");
  const { dark, toggle } = useToolhubTheme();
  const active = useToolhubLocation();
  async function downloadPDF() {
    if (!canExport || !pdfReport || pdfBusy) return;
    setPDFBusy(true); setPDFError("");
    try { await exportCalculationPDF(pdfReport); }
    catch (error) { setPDFError(error instanceof Error ? error.message : "PDF konnte nicht erstellt werden."); }
    finally { setPDFBusy(false); }
  }
  return <div className={`calc-workspace engineering-lab ${canExport ? "lab-export-ready" : ""}`} data-lab-theme={dark ? "dark" : "light"}>
    <div className="lab-shell" inert={Boolean(help || saveOpen)}>
      <ToolhubHeader className="lab-header calc-no-print" title={title} onHome={onHome} onOpenTool={onOpenTool}
        knowledge={onOpenTool ? <KnowledgeLink calculatorId={knowledgeId} onOpenTool={onOpenTool} /> : undefined}
        parent={onOpenTool && active !== "berechnungen" ? { label: "Berechnungen", onClick: () => onOpenTool("berechnungen") } : undefined}>
        <button className="lab-icon toolhub-theme" onClick={toggle} aria-label={dark ? "Heller Modus" : "Dunkler Modus"}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        <CalculatorActions>
          {archive && <button className="lab-icon" disabled={!(canArchive ?? canExport)} aria-label="Projektbezogen auf Server speichern" title="Gemeinsam speichern" onClick={() => setSaveOpen(true)}><Save size={18} /></button>}
          {onOpenTool && <button className="lab-icon" aria-label="Gemeinsame Berechnungsablage öffnen" title="Gemeinsame Ablage" onClick={() => onOpenTool("berechnungsablage")}><FolderOpen size={18} /></button>}
          {pdfReport !== undefined && <button className="lab-icon lab-pdf" disabled={!canExport || !pdfReport || pdfBusy} aria-label="Berechnung als PDF herunterladen" onClick={downloadPDF}><Download size={17} /><span>{pdfBusy ? "PDF …" : "PDF"}</span></button>}
          {exportData && <><button className="lab-icon" disabled={!canExport} aria-label="Ergebnis als JSON sichern" title="JSON sichern" onClick={exportData}><Download size={18} /></button><button className="lab-icon" disabled={!canExport} aria-label="Drucken / als PDF speichern" title="Drucken / PDF" onClick={() => window.print()}><Printer size={18} /></button></>}
        </CalculatorActions>
      </ToolhubHeader>
      <main className="lab-main"><div className="lab-heading"><div><h1>{title}</h1><span className="lab-subtitle">{subtitle}</span>{purpose && <div className="lab-purpose"><p><strong>Wofür?</strong> {purpose.use}</p><p><strong>Du brauchst:</strong> {purpose.needs}</p></div>}</div>{!["berechnungen", "wissens-hub", "berechnungsablage"].includes(active ?? "") && reviewLabel && <span className="lab-review">{reviewLabel}</span>}</div>
        {pdfError && <p className="lab-error" role="alert">{pdfError}</p>}
        {children}
        <div className="lab-print-only lab-prose">{report}</div>
      </main>
    </div>
    {help && <InfoDrawer help={help} onClose={() => setHelp(null)} footer={onOpenTool ? <KnowledgeLink calculatorId={knowledgeId} onOpenTool={onOpenTool}>Im Wissens-Hub weiterlesen</KnowledgeLink> : undefined} />}
    {saveOpen && archive && <ArchiveSaveDialog payload={archive} onClose={() => setSaveOpen(false)} />}
  </div>;
}
