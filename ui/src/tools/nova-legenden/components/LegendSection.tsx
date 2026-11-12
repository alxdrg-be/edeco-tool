import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import InfoTip from "../../../shared/InfoTip";
import "./LegendSection.css";

const KEY = "edeco.legend.sections";
function remembered(id: string, fallback: boolean): boolean {
  try { const value = JSON.parse(localStorage.getItem(KEY) ?? "{}")[id]; return typeof value === "boolean" ? value : fallback; } catch { return fallback; }
}
function remember(id: string, open: boolean) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(KEY) ?? "{}"), [id]: open })); } catch { /* the state still works in memory */ }
}

/** One look for every settings section of the legend editor: icon, title, short status, chevron. Open state is remembered per section. */
export default function LegendSection({ id, icon: Icon, title, status, help, label, defaultOpen = false, className = "", children }: {
  id: string; icon: LucideIcon; title: string; status?: ReactNode; help?: string; label?: string; defaultOpen?: boolean; className?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(() => remembered(id, defaultOpen));
  return <details className={`legend-section ${className}`} open={open} data-legend-section={id} onToggle={event => { const next = event.currentTarget.open; setOpen(next); remember(id, next); }}>
    <summary><Icon size={15} aria-hidden="true" className="legend-section-icon" /><span className="legend-section-heading"><span className="legend-section-title">{title}</span>{status !== undefined && <span className="legend-section-status">{status}</span>}</span><ChevronDown size={15} aria-hidden="true" className="legend-section-chevron" /></summary>
    <section className="legend-section-body" aria-label={label ?? title}>
      {help && <div className="legend-section-help"><InfoTip text={help} /></div>}
      {children}
    </section>
  </details>;
}
