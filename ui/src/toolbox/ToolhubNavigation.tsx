import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calculator, Check, ChevronDown, Search, Shapes, X } from "lucide-react";
import { TOOLS, type ToolInfo } from "./catalog";
import ToolIcon from "./ToolIcon";
import { useDialogFocus } from "../useDialogFocus";
import "./toolhub-navigation.css";

/** Current location comes from the host; navigation callbacks still belong to each editor. */
export const ToolhubLocation = createContext<string | null>(null);
export function useToolhubLocation() { return useContext(ToolhubLocation); }

type Kind = "tools" | "calculators";

function entries(kind: Kind): readonly ToolInfo[] {
  if (kind === "tools") return TOOLS.filter(tool => !tool.parentId);
  const overview = TOOLS.find(tool => tool.id === "berechnungen");
  return [
    ...(overview ? [{ ...overview, title: "Alle Berechnungen" }] : []),
    ...TOOLS.filter(tool => tool.parentId === "berechnungen" && !["wissens-hub", "berechnungsablage"].includes(tool.id)),
  ];
}

export default function ToolhubNavigation({ kind, onSelect, disabled = false, currentToolId }: {
  kind: Kind; onSelect: (id: string) => void; disabled?: boolean; currentToolId?: string | null;
}) {
  const location = useToolhubLocation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const label = kind === "calculators" ? "Rechner wechseln" : "Werkzeuge";
  return <>
    <button type="button" ref={trigger} className="toolhub-nav-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open}
      disabled={disabled} onClick={() => setOpen(value => !value)}>
      {kind === "calculators" ? <Calculator size={16} aria-hidden="true" /> : <Shapes size={16} aria-hidden="true" />}
      <span className="toolhub-nav-full">{label}</span><span className="toolhub-nav-short" aria-hidden="true">{kind === "calculators" ? "Rechner" : "Werkzeuge"}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <NavigationPopup kind={kind} trigger={trigger.current} currentToolId={currentToolId ?? location}
      close={() => setOpen(false)} choose={id => { setOpen(false); onSelect(id); }} />}
  </>;
}

function NavigationPopup({ kind, trigger, close, choose, currentToolId }: {
  kind: Kind; trigger: HTMLButtonElement | null; close: () => void; choose: (id: string) => void; currentToolId: string | null;
}) {
  const panel = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ left: 16, top: 80, width: 380, maxHeight: 500 });
  useDialogFocus(panel, close);
  useLayoutEffect(() => {
    const place = () => {
      const bounds = trigger?.getBoundingClientRect();
      const width = Math.min(400, window.innerWidth - 32);
      const top = Math.max(16, Math.min((bounds?.bottom ?? 64) + 8, window.innerHeight - 240));
      setPosition({ left: Math.max(16, Math.min(bounds?.left ?? 16, window.innerWidth - width - 16)), top,
        width, maxHeight: Math.max(160, window.innerHeight - top - 16) });
    };
    place(); search.current?.focus();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [trigger]);
  const words = query.toLocaleLowerCase("de-CH").trim().split(/\s+/).filter(Boolean);
  const found = entries(kind).filter(tool => words.every(word => `${tool.title} ${tool.description} ${tool.category}`.toLocaleLowerCase("de-CH").includes(word)));
  const categories = [...new Set(found.map(tool => kind === "calculators" ? "Berechnungen" : tool.category))];
  return createPortal(<div className="toolhub-nav-overlay" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={panel} className="toolhub-nav-panel" role="dialog" aria-modal="true"
      aria-label={kind === "calculators" ? "Rechner wechseln" : "Werkzeug wechseln"} style={position} tabIndex={-1}>
      <div className="toolhub-nav-heading"><h2>{kind === "calculators" ? "Rechner wechseln" : "Werkzeug wechseln"}</h2>
        <button type="button" className="toolhub-nav-close" aria-label="Auswahl schliessen" onClick={close}><X size={17} /></button></div>
      <label className="toolhub-nav-search"><Search size={17} aria-hidden="true" />
        <input ref={search} type="search" aria-label={kind === "calculators" ? "Rechner suchen" : "Werkzeug suchen"}
          placeholder={kind === "calculators" ? "Rechner suchen …" : "Werkzeug suchen …"} value={query}
          onChange={event => setQuery(event.target.value)} onKeyDown={event => {
            if (event.key === "ArrowDown") { event.preventDefault(); panel.current?.querySelector<HTMLButtonElement>(".toolhub-nav-option:not(:disabled)")?.focus(); }
          }} />
      </label>
      <div className="toolhub-nav-results">
        {categories.map(category => <section key={category} aria-label={category}>
          {kind === "tools" && <h3>{category}</h3>}
          {found.filter(tool => kind === "calculators" || tool.category === category).map(tool => <button type="button" key={tool.id}
            className="toolhub-nav-option" disabled={tool.status !== "available"} aria-current={tool.id === currentToolId ? "page" : undefined}
            onClick={() => { if (tool.id === currentToolId) close(); else choose(tool.id); }} onKeyDown={event => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              const options = [...(panel.current?.querySelectorAll<HTMLButtonElement>(".toolhub-nav-option:not(:disabled)") ?? [])];
              const next = (options.indexOf(event.currentTarget) + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
              options[next]?.focus();
            }}>
            <span className={`toolhub-nav-symbol tool-color-${tool.color}`}><ToolIcon id={tool.id} /></span>
            <span>{tool.title}{tool.status !== "available" && <small>Geplant</small>}</span>
            {tool.id === currentToolId && <Check size={16} aria-hidden="true" />}
          </button>)}
        </section>)}
        {!found.length && <p className="toolhub-nav-empty" role="status">Keine passende Auswahl.</p>}
      </div>
    </div>
  </div>, document.body);
}
