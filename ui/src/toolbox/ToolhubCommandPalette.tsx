import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Command, Folder, Moon, Search, Settings, Sun, X } from 'lucide-react';
import { useDialogFocus } from '../shared/useDialogFocus';
import { useProjectHub } from '../tools/projektzentrale/projectHubState';
import { MEMORY_CHAPTERS } from '../tools/elektro-memory/chapters';
import { TOOLS } from './catalog';
import { allowedToolId, toolAllowed } from './presentationPolicy';
import { usePresentation } from './PresentationSettings';
import { useToolhubTheme } from './useToolhubTheme';
import ToolIcon from './ToolIcon';

export default function ToolhubCommandPalette({ close, onHome, onOpenTool, currentToolId, onSettings }: {
  close: () => void; onHome: () => void; onOpenTool?: (id: string) => void; currentToolId: string | null; onSettings: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const { policy } = usePresentation();
  const { hub, error } = useProjectHub();
  const { dark, toggle } = useToolhubTheme();
  useDialogFocus(panel, close);
  const words = query.toLocaleLowerCase('de-CH').trim().split(/\s+/).filter(Boolean);
  const matches = (value: string) => words.every(word => value.toLocaleLowerCase('de-CH').includes(word));
  const allowed = (id: string) => Boolean(policy && allowedToolId(id, TOOLS, policy));
  const tools = TOOLS.filter(tool => policy && toolAllowed(tool, policy) && tool.status === 'available' && matches(`${tool.title} ${tool.description} ${tool.category}`));
  const projects = allowed('projektzentrale') ? (hub?.projects ?? []).filter(project => !project.archived && matches(`${project.number} ${project.name} ${project.address}`)) : [];
  const chapters = allowed('elektro-memory') ? MEMORY_CHAPTERS.filter(chapter => matches(`${chapter.title} ${chapter.short}`)) : [];
  function navigate(id: string) { close(); onOpenTool?.(id); }
  function focusEntity(tool: string, key: string, id: string) {
    try { sessionStorage.setItem(key, id); } catch { /* The tool remains reachable without a focused item. */ }
    close();
    if (currentToolId === tool) window.dispatchEvent(new CustomEvent(key, { detail: id }));
    else onOpenTool?.(tool);
  }
  const actions = [
    { id: 'home', title: 'Zum Toolhub', icon: Command, run: onHome },
    { id: 'theme', title: dark ? 'Hellen Modus einschalten' : 'Dunklen Modus einschalten', icon: dark ? Sun : Moon, run: toggle },
    { id: 'settings', title: 'Toolhub-Einstellungen öffnen', icon: Settings, run: onSettings },
  ].filter(action => matches(action.title));
  return createPortal(<div className="hub-command-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={panel} className="hub-command-dialog" role="dialog" aria-modal="true" aria-labelledby="hub-command-title" tabIndex={-1} onKeyDown={event => {
      // Editors listen on window/document. Keys inside search must never edit the plan.
      // Tab reaches useDialogFocus's document listener to retain its focus trap.
      if (event.key !== 'Tab') event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && ['f', 'k'].includes(event.key.toLowerCase())) {
        event.preventDefault(); panel.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus(); return;
      }
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      const buttons = [...(panel.current?.querySelectorAll<HTMLButtonElement>('.hub-command-result:not(:disabled)') ?? [])];
      if (!buttons.length) return;
      event.preventDefault();
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1)
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}>
      <div className="hub-command-heading"><h2 id="hub-command-title">Im Toolhub finden</h2><button className="btn icon" aria-label="Suche schliessen" onClick={close}><X size={19} /></button></div>
      <label className="hub-command-input"><Search size={20} /><input autoFocus type="search" aria-label="Werkzeuge, Projekte, Memory und Befehle suchen" placeholder="Werkzeuge, Projekte, Memory und Befehle …" value={query} onChange={event => setQuery(event.target.value)} /><kbd>Esc</kbd></label>
      <div className="hub-command-results">
        {tools.length > 0 && <section><h3>Werkzeuge</h3>{tools.map(tool => <button key={tool.id} aria-label={tool.title} className="hub-command-result" disabled={!onOpenTool} onClick={() => navigate(tool.id)}><ToolIcon id={tool.id} /><span><strong>{tool.title}</strong><small>{tool.hiddenFromHub ? "Im Toolhub ausgeblendet · Administratorzugriff" : tool.description}</small></span><span className="hub-command-kind">Öffnen</span></button>)}</section>}
        {projects.length > 0 && <section><h3>Projekte</h3>{projects.map(project => <button key={project.id} className="hub-command-result" disabled={!onOpenTool} onClick={() => focusEntity('projektzentrale', 'edeco-project-focus', project.id)}><Folder size={18} /><span><strong>{project.number} · {project.name}</strong><small>Projektangaben öffnen · bestehende Pläne bleiben zugeordnet</small></span></button>)}</section>}
        {allowed('projektzentrale') && error && <p className="hub-command-note" role="status">Projektliste nicht erreichbar. Werkzeuge und Memory bleiben durchsuchbar.</p>}
        {chapters.length > 0 && <section><h3>Elektro-Memory</h3>{chapters.map(chapter => <button key={chapter.id} className="hub-command-result" disabled={!onOpenTool} onClick={() => focusEntity('elektro-memory', 'edeco-memory-focus', chapter.id)}><BookOpen size={18} /><span><strong>{chapter.title}</strong><small>{chapter.short}</small></span></button>)}</section>}
        {actions.length > 0 && <section><h3>Befehle</h3>{actions.map(action => <button key={action.id} className="hub-command-result" onClick={() => { close(); action.run(); }}><action.icon size={18} /><strong>{action.title}</strong></button>)}</section>}
        {!tools.length && !projects.length && !chapters.length && !actions.length && <p className="hub-command-note" role="status">Keine passenden Einträge. Versuche einen anderen Suchbegriff.</p>}
      </div>
      <footer>Ctrl+K · Toolhub-Suche <span>Ctrl+F · Suche im geöffneten Werkzeug</span></footer>
    </div>
  </div>, document.body);
}
