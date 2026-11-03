import { ArrowRight, CircleAlert, Info } from "lucide-react";
import { useState } from "react";
import "./diagnostic-details.css";

export interface DiagnosticTarget {
  field: string;
  rowId?: string;
  rowIndex?: number;
  property?: string;
  label?: string;
}
export interface Diagnostic {
  id: string;
  title: string;
  tone: "error" | "warning" | "neutral" | "ok";
  message: string;
  actual?: string;
  required?: string;
  action?: string;
  targets?: DiagnosticTarget[];
}

/** Explanations stay collapsed; links navigate without changing project values. */
export default function DiagnosticDetails({ diagnostic, onNavigate, initiallyOpen = false }: {
  diagnostic: Diagnostic;
  onNavigate?: (target: DiagnosticTarget) => void;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className={`calc-diagnostic calc-diagnostic-${diagnostic.tone}`} data-diagnostic-id={diagnostic.id}>
    <summary>{diagnostic.tone === "error" || diagnostic.tone === "warning" ? <CircleAlert size={16} /> : <Info size={16} />}<span>{diagnostic.title}</span><span className="calc-diagnostic-chevron" aria-hidden="true">⌄</span></summary>
    <div className="calc-diagnostic-body"><p>{diagnostic.message}</p>
      {(diagnostic.actual || diagnostic.required) && <dl>{diagnostic.actual && <div><dt>Aktuell</dt><dd>{diagnostic.actual}</dd></div>}{diagnostic.required && <div><dt>Erforderlich</dt><dd>{diagnostic.required}</dd></div>}</dl>}
      {diagnostic.action && <p className="calc-diagnostic-action">{diagnostic.action}</p>}
      {onNavigate && Boolean(diagnostic.targets?.length) && <div className="calc-diagnostic-links">{diagnostic.targets!.map((target, index) => <button key={`${target.field}-${target.rowId ?? target.rowIndex ?? ""}-${target.property ?? ""}-${index}`} type="button" onClick={() => onNavigate(target)}><ArrowRight size={14} />Zur Eingabe{target.label ? `: ${target.label}` : ""}</button>)}</div>}
    </div>
  </details>;
}

/** Opens every collapsed parameter group before revealing the exact field. */
export function revealDiagnosticElement(element: HTMLElement): void {
  let parent: HTMLElement | null = element;
  while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
  const focus = element.matches("input, select, textarea, button, summary, [tabindex]") ? element
    : element.querySelector<HTMLElement>("input:not([type=hidden]):not([type=range]):not([type=search]), textarea")
      ?? element.querySelector<HTMLElement>("select")
      ?? element.querySelector<HTMLElement>("button[aria-pressed=true], button, summary, [tabindex]");
  element.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  focus?.focus({ preventScroll: true });
  element.classList.remove("calc-diagnostic-focus");
  void element.offsetWidth;
  element.classList.add("calc-diagnostic-focus");
}
