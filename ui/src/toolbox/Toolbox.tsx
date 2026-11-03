import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { filterTools, TOOLS } from "./catalog";
import { MODULES } from "./modules";
import ToolIcon from "./ToolIcon";
import ToolboxUpdates from "./ToolboxUpdates";
import ProjectPicker from "../tools/projektzentrale/ProjectPicker";
import { openKnowledge } from "../tools/berechnungen/KnowledgeLink";
import ToolhubHeader from "./ToolhubHeader";
import { ToolhubLocation } from "./ToolhubNavigation";
import { useToolhubTheme } from "./useToolhubTheme";
import "./toolbox.css";

function toolFromHash(): string | null | undefined {
  if (/^#wissen(?:\/|$)/.test(window.location.hash)) return "wissens-hub";
  if (window.location.hash === "#toolbox" || window.location.hash === "#toolhub") return null;
  const tool = window.location.hash.match(/^#rechner\/([a-z0-9-]+)$/)?.[1];
  return tool && MODULES[tool] && TOOLS.some(item => item.id === tool && item.status === "available") ? tool : undefined;
}

class ToolBoundary extends Component<{ children: ReactNode; onHome: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="toolbox-message" role="alert">
      <h1>Das Tool konnte nicht geöffnet werden.</h1>
      <p>Bitte zur Übersicht zurückkehren und es erneut versuchen.</p>
      <button className="btn" onClick={this.props.onHome}>Zum Toolhub</button>
    </main>;
    return this.props.children;
  }
}

export default function Toolbox() {
  const [active, setActive] = useState<string | null>(() => {
    const linked = toolFromHash();
    if (linked !== undefined) return linked;
    try {
      const saved = sessionStorage.getItem("edeco-toolbox-active");
      return saved && MODULES[saved] && TOOLS.some(tool => tool.id === saved && tool.status === "available") ? saved : null;
    } catch { return null; }
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Alle");
  const { dark, toggle } = useToolhubTheme();
  const heading = useRef<HTMLHeadingElement>(null);
  const returning = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const ActiveTool = active ? MODULES[active] : undefined;
  const tools = filterTools(query, category);
  const categories = ["Alle", ...new Set(TOOLS.map(tool => tool.category))];

  useEffect(() => {
    const navigate = () => {
      const current = activeRef.current;
      const managed = current === null || current === "wissens-hub" || TOOLS.some(tool => tool.id === current && tool.category === "Berechnungen");
      if (!managed) {
        // Another editor owns its save/dirty-navigation contract. A hash edit
        // or browser Back must not bypass that editor's onHome callback.
        if (/^#(?:wissen|rechner|toolbox|toolhub)(?:\/|$)/.test(window.location.hash)) history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        return;
      }
      const next = toolFromHash();
      if (next !== undefined) { activeRef.current = next; setActive(next); }
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);

  function openTool(id: string) {
    if (!MODULES[id]) return;
    activeRef.current = id;
    if (id === "wissens-hub") {
      if (!/^#wissen(?:\/|$)/.test(window.location.hash)) openKnowledge();
    } else if (TOOLS.some(tool => tool.id === id && tool.category === "Berechnungen")) {
      // Canonicalise even when entered from #toolbox: browser Back from an
      // article must restore this calculator rather than the toolbox.
      window.location.hash = `rechner/${id}`;
    } else if (/^#(?:wissen|rechner|toolbox|toolhub)(?:\/|$)/.test(window.location.hash)) {
      // Keep other tools on their established callback-based navigation.
      // Their editors own pending-save/dirty-state checks before onHome.
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    setActive(id);
  }

  useEffect(() => {
    try {
      if (active) sessionStorage.setItem("edeco-toolbox-active", active);
      else sessionStorage.removeItem("edeco-toolbox-active");
    } catch { /* The toolbox also works when browser storage is disabled. */ }
    const tool = TOOLS.find(item => item.id === active);
    if (tool) document.documentElement.dataset.toolColor = tool.color;
    else delete document.documentElement.dataset.toolColor;
    document.title = tool ? `${tool.title} · edeco Toolhub` : "edeco Toolhub";
    if (!active && returning.current) heading.current?.focus();
  }, [active]);

  const goHome = () => {
    returning.current = true;
    activeRef.current = null;
    setActive(null);
    if (/^#(?:wissen|rechner)(?:\/|$)/.test(window.location.hash)) window.location.hash = "toolhub";
  };

  if (ActiveTool) return <ToolBoundary key={active} onHome={goHome}>
    <Suspense fallback={<div className="toolhub-loading">
      <ToolhubHeader title={TOOLS.find(tool => tool.id === active)?.title ?? "Werkzeug"} currentToolId={active} onHome={goHome} onOpenTool={openTool}>
        <button className="btn" aria-label={dark ? "Heller Modus" : "Dunkler Modus"} onClick={toggle}>{dark ? "☀ Hell" : "☾ Dunkel"}</button>
      </ToolhubHeader>
      <main className="toolhub-loading-main"><p role="status">Werkzeug wird geladen …</p><div aria-hidden="true" className="toolhub-loading-placeholder" /></main>
    </div>}>
      <ToolhubLocation.Provider value={active}><ActiveTool onHome={goHome} onOpenTool={openTool} /></ToolhubLocation.Provider>
    </Suspense>
  </ToolBoundary>;

  return <div className="toolbox">
    <ToolhubHeader className="toolbox-header" title="Übersicht" currentToolId={null} onHome={() => { setQuery(""); setCategory("Alle"); heading.current?.focus(); }} onOpenTool={openTool}>
      <ProjectPicker /><ToolboxUpdates />
      <button className="btn toolhub-theme" aria-label={dark ? "Heller Modus" : "Dunkler Modus"} onClick={toggle}>
        {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}<span>{dark ? "Hell" : "Dunkel"}</span></button>
    </ToolhubHeader>
    <main className="toolbox-main">
      <section className="toolbox-intro" aria-labelledby="toolbox-title">
        <p className="toolbox-eyebrow">PLANEN. VEREINFACHEN. WEITERDENKEN.</p>
        <h1 id="toolbox-title" ref={heading} tabIndex={-1}>Ein Ort. Deine Werkzeuge.</h1>
        <p>Alles für deine Elektroplanung – übersichtlich an einem Ort.</p>
      </section>
      <div className="toolbox-filters">
        <label className="toolbox-search"><span className="sr-only">Werkzeug suchen</span>
          <input type="search" placeholder="Name oder Aufgabe …" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <div className="toolbox-categories" role="group" aria-label="Kategorien">
          {categories.map(value => <button key={value} className="btn" aria-pressed={value === category}
            onClick={() => setCategory(value)}>{value}</button>)}
        </div>
      </div>
      <p className="toolbox-count" role="status">{tools.length} {tools.length === 1 ? "Werkzeug" : "Werkzeuge"} · {tools.filter(t => t.status === "available").length} verfügbar</p>
      <div className="toolbox-grid">
        {tools.map(tool => {
          const available = tool.status === "available" && Boolean(MODULES[tool.id]);
          const inProgress = tool.developmentStatus === "in-progress";
          return <article className={`toolbox-card tool-color-${tool.color} ${available ? "is-available" : ""}`} key={tool.id}>
            <button className="toolbox-tile" disabled={!available} title={tool.description}
              aria-label={available ? `${tool.title} öffnen` : `${tool.title}: noch nicht verfügbar`}
              aria-description={inProgress ? "Work in progress; kann bereits verwendet werden." : undefined}
              onClick={() => { if (available) openTool(tool.id); }}>
              <span className={`toolbox-badge ${inProgress ? "is-in-progress" : available ? "is-ready" : ""}`}>
                {inProgress ? "Work in progress" : available ? "Bereit" : tool.status === "awaiting-source" ? "In Vorbereitung" : "Geplant"}
              </span>
              <span className="toolbox-symbol"><ToolIcon id={tool.id} /></span>
              <h2>{tool.title}</h2>
              <span className="toolbox-category">{tool.category}</span>
              <span className="toolbox-tile-action">{available ? "Öffnen" : "Demnächst"}</span>
            </button>
          </article>;
        })}
      </div>
      {tools.length === 0 && <div className="toolbox-empty"><h2>Kein passendes Werkzeug</h2>
        <p>Versuche einen anderen Suchbegriff oder wähle eine andere Kategorie.</p>
        <button className="btn" onClick={() => { setQuery(""); setCategory("Alle"); }}>Filter zurücksetzen</button>
      </div>}
      <footer className="toolbox-footer"><span>edeco Toolhub</span><span>Eine gemeinsame Oberfläche für deine Elektroplanung.</span></footer>
    </main>
  </div>;
}
