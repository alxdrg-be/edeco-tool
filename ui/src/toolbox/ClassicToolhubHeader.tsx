import { useLayoutEffect, useRef } from "react";
import type { ToolhubHeaderProps } from "./ToolhubHeader";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import ToolhubBrand from "./ToolhubBrand";
import ToolhubNavigation, { useToolhubLocation } from "./ToolhubNavigation";
import { TOOLS } from "./catalog";
import { DemoBadge, usePresentation } from "./PresentationSettings";
import { allowedToolId } from "./presentationPolicy";
import "./toolhub-navigation.css";

export default function ClassicToolhubHeader({ title, onHome, onOpenTool, currentToolId, disabled,
  className = "", children, knowledge, parent }: ToolhubHeaderProps) {
  const header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!header.current) return;
    const measure = () => document.documentElement.style.setProperty('--hub-header-height', `${header.current?.getBoundingClientRect().height ?? 90}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header.current);
    return () => observer.disconnect();
  }, []);
  const location = useToolhubLocation(), id = currentToolId ?? location;
  const { policy } = usePresentation();
  const showKnowledge = !policy || allowedToolId("wissens-hub", TOOLS, policy);
  const calculator = TOOLS.some(tool => tool.id === id && tool.category === "Berechnungen");
  return <header ref={header} className={`toolhub-header ${className}`} aria-label={`${title} · Werkzeugleiste`}>
    <button type="button" className="toolhub-home" aria-label="Startseite öffnen" title="edeco Toolhub" disabled={disabled} onClick={onHome}><ToolhubBrand /></button>
    {id && <button type="button" className="toolhub-back" aria-label="Zum Toolhub" disabled={disabled} onClick={onHome}><ArrowLeft size={15} aria-hidden="true" /><span>Zum Toolhub</span></button>}
    <nav className="toolhub-breadcrumbs" aria-label="Aktueller Bereich">
      {parent && <><button type="button" disabled={disabled} onClick={parent.onClick}>{parent.label}</button><ChevronRight size={14} aria-hidden="true" /></>}
      <span className="tool-header-title">{title}</span>
    </nav>
    <div className="toolhub-header-actions">
      <DemoBadge />
      {onOpenTool && <>
        {calculator && <ToolhubNavigation kind="calculators" currentToolId={id} onSelect={onOpenTool} disabled={disabled} />}
        <ToolhubNavigation kind="tools" currentToolId={id} onSelect={onOpenTool} disabled={disabled} />
        {showKnowledge && (knowledge ?? <button type="button" className="toolhub-knowledge" aria-label="Wissens-Hub" title="Wissens-Hub" disabled={disabled} onClick={() => onOpenTool("wissens-hub")}><BookOpen size={16} aria-hidden="true" /><span>Wissens-Hub</span></button>)}
      </>}
      {children}
    </div>
  </header>;
}
