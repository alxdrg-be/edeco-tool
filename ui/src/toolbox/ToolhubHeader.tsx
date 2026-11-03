import type { ReactNode } from "react";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import ToolhubBrand from "./ToolhubBrand";
import ToolhubNavigation, { useToolhubLocation } from "./ToolhubNavigation";
import { TOOLS } from "./catalog";
import "./toolhub-navigation.css";

export default function ToolhubHeader({ title, onHome, onOpenTool, currentToolId, disabled, onTitleActivate,
  className = "", children, knowledge, parent }: {
  title: string; onHome: () => void; onOpenTool?: (id: string) => void; currentToolId?: string | null;
  disabled?: boolean; onTitleActivate?: () => void; className?: string; children?: ReactNode;
  knowledge?: ReactNode; parent?: { label: string; onClick: () => void };
}) {
  const location = useToolhubLocation(), id = currentToolId ?? location;
  const calculator = TOOLS.some(tool => tool.id === id && tool.category === "Berechnungen");
  return <header className={`toolhub-header ${className}`} aria-label={`${title} · Werkzeugleiste`}>
    <button type="button" className="toolhub-home" aria-label="Startseite öffnen" title="edeco Toolhub" disabled={disabled} onClick={onHome}><ToolhubBrand /></button>
    {id && <button type="button" className="toolhub-back" aria-label="Zum Toolhub" disabled={disabled} onClick={onHome}><ArrowLeft size={15} aria-hidden="true" /><span>Zum Toolhub</span></button>}
    <nav className="toolhub-breadcrumbs" aria-label="Aktueller Bereich">
      {parent && <><button type="button" disabled={disabled} onClick={parent.onClick}>{parent.label}</button><ChevronRight size={14} aria-hidden="true" /></>}
      <span className="tool-header-title" onDoubleClick={onTitleActivate}>{title}</span>
    </nav>
    <div className="toolhub-header-actions">
      {onOpenTool && <>
        {calculator && <ToolhubNavigation kind="calculators" currentToolId={id} onSelect={onOpenTool} disabled={disabled} />}
        <ToolhubNavigation kind="tools" currentToolId={id} onSelect={onOpenTool} disabled={disabled} />
        {knowledge ?? <button type="button" className="toolhub-knowledge" aria-label="Wissens-Hub" title="Wissens-Hub" disabled={disabled} onClick={() => onOpenTool("wissens-hub")}><BookOpen size={16} aria-hidden="true" /><span>Wissens-Hub</span></button>}
      </>}
      {children}
    </div>
  </header>;
}
