import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, BookOpen, ChevronRight, Folder, House, Moon, Search, Settings, Shapes, Sun } from 'lucide-react';
import ToolhubBrand from './ToolhubBrand';
import ToolhubNavigation, { useToolhubLocation } from './ToolhubNavigation';
import { TOOLS } from './catalog';
import { DemoBadge, usePresentation } from './PresentationSettings';
import { allowedToolId } from './presentationPolicy';
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

/** Rail and search use the current editor's guarded navigation callbacks. */
export default function ToolhubHeader({ title, onHome, onOpenTool, currentToolId, disabled,
  className = '', children, knowledge, parent }: {
  title: string; onHome: () => void; onOpenTool?: (id: string) => void; currentToolId?: string | null;
  disabled?: boolean; className?: string; children?: ReactNode;
  knowledge?: ReactNode; parent?: { label: string; onClick: () => void };
}) {
  const location = useToolhubLocation(), id = currentToolId ?? location;
  const { policy } = usePresentation();
  const [searchOpen, setSearchOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const { dark, toggle } = useToolhubTheme();
  const allowed = (tool: string) => Boolean(policy && allowedToolId(tool, TOOLS, policy));
  const calculator = TOOLS.some(tool => tool.id === id && tool.category === 'Berechnungen');
  const memoryId = allowed('elektro-memory') ? 'elektro-memory' : 'wissens-hub';
  const openSettings = () => { if (onOpenTool) onOpenTool('toolhub-options'); else onHome(); };
  useLayoutEffect(() => {
    if (!header.current) return;
    const measure = () => document.documentElement.style.setProperty('--hub-header-height', `${header.current?.getBoundingClientRect().height ?? 64}px`);
    measure();
    const observer = new ResizeObserver(measure); observer.observe(header.current);
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
      <div className="hub-header-top">
        {id ? <button type="button" className="toolhub-back" aria-label="Zum Toolhub" disabled={disabled} onClick={onHome}><ArrowLeft size={16} /><span>Zum Toolhub</span></button>
          : <button type="button" className="toolhub-home" aria-label="Startseite öffnen" disabled={disabled} onClick={onHome}><span className="hub-wordmark"><strong>edeco</strong> Toolhub</span></button>}
        {id && <strong className="hub-header-title" title={title}>{title}</strong>}
        <button type="button" className="hub-global-search" aria-label="Toolhub durchsuchen" aria-haspopup="dialog" aria-expanded={searchOpen} disabled={disabled} onClick={() => setSearchOpen(true)}>
          <Search size={16} aria-hidden="true" /><span>Werkzeuge, Projekte, Memory und Befehle …</span><kbd>Ctrl+K</kbd>
        </button>
        {!policy?.demo_enabled && <ProjectContext disabled={disabled} open={allowed('projektzentrale') && onOpenTool ? () => onOpenTool('projektzentrale') : undefined} />}
        <DemoBadge />
      </div>
      <div className="hub-header-toolbar">
        <nav className="toolhub-breadcrumbs" aria-label="Aktueller Bereich">
          {parent && <><button type="button" disabled={disabled} onClick={parent.onClick}>{parent.label}</button><ChevronRight size={14} /></>}
          <span className="tool-header-title">{title}</span>
        </nav>
        <div className="toolhub-header-actions">
          {onOpenTool && <>
            {calculator && <ToolhubNavigation kind="calculators" currentToolId={id} onSelect={onOpenTool} disabled={disabled} />}
            {allowed('wissens-hub') && (knowledge ?? <button type="button" className="toolhub-knowledge" disabled={disabled} onClick={() => onOpenTool('wissens-hub')}><BookOpen size={16} /><span>Wissens-Hub</span></button>)}
          </>}
          {children}
          <button type="button" className="hub-mobile-theme" aria-label={dark ? 'Heller Modus' : 'Dunkler Modus'} onClick={toggle}>{dark ? <Sun size={16} /> : <Moon size={16} />}<span>{dark ? 'Hell' : 'Dunkel'}</span></button>
        </div>
      </div>
    </header>
    {createPortal(<><div className="hub-chrome-corner"><button className="hub-corner-home" disabled={disabled} onClick={onHome} aria-label="edeco Toolhub – Startseite"><ToolhubBrand compact /></button></div><nav className="hub-rail" aria-label="Toolhub-Navigation">
      <button type="button" disabled={disabled} aria-current={!id ? 'page' : undefined} onClick={onHome}><House size={20} /><span>Start</span></button>
      {allowed('projektzentrale') && <button type="button" aria-label="Projektzentrale" disabled={disabled || !onOpenTool} aria-current={id === 'projektzentrale' ? 'page' : undefined} onClick={() => onOpenTool?.('projektzentrale')}><Folder size={20} /><span>Projekte</span></button>}
      <button type="button" disabled={disabled} aria-current={id && !['projektzentrale', 'elektro-memory', 'wissens-hub'].includes(id) ? 'page' : undefined} onClick={() => setSearchOpen(true)}><Shapes size={20} /><span>Werkzeuge</span></button>
      {allowed(memoryId) && <button type="button" disabled={disabled || !onOpenTool} aria-current={id === 'elektro-memory' || id === 'wissens-hub' ? 'page' : undefined} onClick={() => onOpenTool?.(memoryId)}><BookOpen size={20} /><span>Wissen</span></button>}
      <button type="button" disabled={disabled} onClick={openSettings}><Settings size={20} /><span>Optionen</span></button>
      <button type="button" className="hub-rail-theme" aria-label={dark ? 'Heller Modus' : 'Dunkler Modus'} onClick={toggle}>{dark ? <Sun size={20} /> : <Moon size={20} />}<span>{dark ? 'Hell' : 'Dunkel'}</span></button>
    </nav></>, document.body)}
    {searchOpen && <ToolhubCommandPalette close={() => setSearchOpen(false)} onHome={onHome} onOpenTool={onOpenTool} currentToolId={id} onSettings={openSettings} />}

  </>;
}
