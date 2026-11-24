import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, ChevronRight, Folder, Moon, Search, Settings, Shapes, Sun } from 'lucide-react';
import ToolhubBrand from './ToolhubBrand';
import ToolhubNavigation, { useToolhubLocation } from './ToolhubNavigation';
import { TOOLS } from './catalog';
import { DemoBadge, usePresentation } from './PresentationSettings';
import { allowedToolId, designBetaEnabled } from './presentationPolicy';
import ClassicToolhubHeader from './ClassicToolhubHeader';
import { useToolhubTheme } from './useToolhubTheme';
import { useProjectHub } from '../tools/projektzentrale/projectHubState';
import ToolhubCommandPalette from './ToolhubCommandPalette';
import './toolhub-navigation.css';

function modalOpen() {
  return [...document.querySelectorAll<HTMLElement>('[aria-modal="true"]:not([data-toolhub-workspace-dialog="true"]), dialog[open]')]
    .some(dialog => dialog.getClientRects().length > 0);
}

function ProjectContext({ open, disabled }: { open?: () => void; disabled?: boolean }) {
  const { active, error } = useProjectHub();
  return <button className="hub-project-context" disabled={disabled || !open} onClick={open}
    aria-label={active ? `Projektkontext: ${active.number} · ${active.name}` : 'Projektkontext: kein aktives Projekt'}
    title={error ? 'Projektkontext nicht erreichbar' : `${active ? `${active.number} · ${active.name}. ` : ''}Toolhub-Projekt für neue Arbeiten. Bereits offene Pläne behalten ihre eigene Zuordnung.`}>
    <Folder size={15} aria-hidden="true" /><span>{error ? 'Projekt nicht erreichbar' : active ? `${active.number} · ${active.name}` : 'Projekt wählen'}</span>
  </button>;
}

export interface ToolhubHeaderProps {
  title: string; onHome: () => void; onOpenTool?: (id: string) => void; currentToolId?: string | null;
  disabled?: boolean; className?: string; children?: ReactNode;
  knowledge?: ReactNode; parent?: { label: string; onClick: () => void };
}

export default function ToolhubHeader(props: ToolhubHeaderProps) {
  const { policy } = usePresentation();
  return designBetaEnabled(policy) ? <BetaToolhubHeader {...props} /> : <ClassicToolhubHeader {...props} />;
}

/** Both layouts receive the same editor-owned guarded navigation callbacks. */
function BetaToolhubHeader({ title, onHome, onOpenTool, currentToolId, disabled,
  className = '', children, knowledge, parent }: ToolhubHeaderProps) {
  const location = useToolhubLocation(), id = currentToolId ?? location;
  const { policy } = usePresentation();
  const [searchOpen, setSearchOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const topRow = useRef<HTMLDivElement>(null);
  const { dark, toggle } = useToolhubTheme();
  const allowed = (tool: string) => Boolean(policy && allowedToolId(tool, TOOLS, policy));
  const calculator = TOOLS.some(tool => tool.id === id && tool.category === 'Berechnungen');
  const hasToolActions = Boolean(onOpenTool && calculator) || Children.toArray(children).length > 0;
  const memoryId = allowed('elektro-memory') ? 'elektro-memory' : 'wissens-hub';
  const openSettings = () => { if (onOpenTool) onOpenTool('toolhub-options'); else onHome(); };
  useLayoutEffect(() => {
    if (!header.current || !topRow.current) return;
    const measure = () => {
      document.documentElement.style.setProperty('--hub-header-height', `${header.current?.getBoundingClientRect().height ?? 48}px`);
      document.documentElement.style.setProperty('--hub-top-height', `${topRow.current?.getBoundingClientRect().height ?? 48}px`);
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(header.current); observer.observe(topRow.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (disabled || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k' || event.altKey) return;
      if (modalOpen()) return;
      event.preventDefault(); setSearchOpen(true);
    };
    const requestSearch = () => { if (!disabled && !modalOpen()) setSearchOpen(true); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('edeco-command-search', requestSearch);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('edeco-command-search', requestSearch); };
  }, [disabled]);
  return <>
    <header ref={header} className={`toolhub-header ${className}`} aria-label={`${title} · Werkzeugleiste`}>
      {/* One row on every page: wordmark, place, search, project, tool actions. Colour only marks the place. */}
      <div ref={topRow} className="hub-header-top" data-place={id ? "tool" : "home"}>
        <div className="hub-head-left">
        {/* The wordmark is the way back: plain on the start page, a back button inside a tool. */}
        <button type="button" className={id ? 'toolhub-home toolhub-back' : 'toolhub-home'} aria-label={id ? 'Zum Toolhub' : 'Startseite öffnen'}
          title={id ? 'Zurück zur Startseite' : undefined} disabled={disabled} onClick={onHome}>
          <ArrowLeft size={15} aria-hidden="true" className={id ? undefined : 'hub-back-arrow-idle'} /><span className="hub-wordmark"><strong>edeco</strong> Toolhub</span></button>
        <span className="hub-header-sep" aria-hidden="true">/</span>
        <nav className="toolhub-breadcrumbs" aria-label="Aktueller Bereich">
          {parent && <><button type="button" disabled={disabled} onClick={parent.onClick}>{parent.label}</button><ChevronRight size={14} aria-hidden="true" /></>}
          <strong className="hub-header-title tool-header-title" title={title}>{id ? title : 'Übersicht'}</strong>
        </nav>
        </div>
        <button type="button" className="hub-global-search" aria-label="Toolhub durchsuchen" aria-haspopup="dialog" aria-expanded={searchOpen} disabled={disabled} onClick={() => setSearchOpen(true)}>
          <Search size={15} aria-hidden="true" /><span>Suchen</span><kbd>Ctrl+K</kbd>
        </button>
        <div className="hub-head-right">
        {!policy?.demo_enabled && <ProjectContext disabled={disabled} open={allowed('projektzentrale') && onOpenTool ? () => onOpenTool('projektzentrale') : undefined} />}
        <div className="hub-global-actions">
          {onOpenTool && allowed('wissens-hub') && (knowledge ?? <button type="button" className="toolhub-knowledge" aria-label="Wissens-Hub" title="Wissens-Hub" disabled={disabled} onClick={() => onOpenTool('wissens-hub')}><BookOpen size={16} aria-hidden="true" /></button>)}
          <button type="button" className="hub-mobile-theme" aria-label={dark ? 'Heller Modus' : 'Dunkler Modus'} onClick={toggle}>{dark ? <Sun size={15} /> : <Moon size={15} />}<span>{dark ? 'Hell' : 'Dunkel'}</span></button>
        </div>
        <DemoBadge />
        </div>
      </div>
      {/* Tool-specific controls sit in their own row, so the header row looks the same everywhere. */}
      {hasToolActions && <div className="hub-header-tools toolhub-header-actions" role="toolbar" aria-label={`${title} · Aktionen`}>
        {onOpenTool && calculator && <ToolhubNavigation kind="calculators" currentToolId={id} onSelect={onOpenTool} disabled={disabled} />}
        {children}
      </div>}
    </header>
    {createPortal(<><div className="hub-chrome-corner"><button className="hub-corner-home" disabled={disabled} onClick={onHome} aria-label="edeco Toolhub – Startseite"><ToolhubBrand compact /></button></div><nav className="hub-rail" aria-label="Toolhub-Navigation">
      <button type="button" disabled={disabled} aria-current={id && !['projektzentrale', 'elektro-memory', 'wissens-hub'].includes(id) ? 'page' : undefined} onClick={() => setSearchOpen(true)}><Shapes size={20} /><span>Werkzeuge</span></button>
      {allowed(memoryId) && <button type="button" disabled={disabled || !onOpenTool} aria-current={id === 'elektro-memory' || id === 'wissens-hub' ? 'page' : undefined} onClick={() => onOpenTool?.(memoryId)}><BookOpen size={20} /><span>Wissen</span></button>}
      <button type="button" disabled={disabled} onClick={openSettings}><Settings size={20} /><span>Optionen</span></button>
      <button type="button" className="hub-rail-beta" disabled={disabled} onClick={openSettings} aria-label="Design-Beta: Einstellungen öffnen" title="Neues Design · nur für deine Admin-Anmeldung. In den Einstellungen zur bisherigen Oberfläche zurückwechseln."><span>Beta</span></button>
      <button type="button" className="hub-rail-theme" aria-label={dark ? 'Heller Modus' : 'Dunkler Modus'} onClick={toggle}>{dark ? <Sun size={20} /> : <Moon size={20} />}<span>{dark ? 'Hell' : 'Dunkel'}</span></button>
    </nav></>, document.body)}
    {searchOpen && <ToolhubCommandPalette close={() => setSearchOpen(false)} onHome={onHome} onOpenTool={onOpenTool} currentToolId={id} onSettings={openSettings} />}

  </>;
}
