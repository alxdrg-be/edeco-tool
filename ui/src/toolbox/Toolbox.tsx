import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import edecoLogo from "../assets/edeco-logo.svg?raw";
import { applyTheme, effectiveDark, loadTheme } from "../theme";
import { filterTools, TOOLS } from "./catalog";
import { MODULES } from "./modules";
import ToolIcon from "./ToolIcon";
import { api } from "../api";
import "./toolbox.css";

class ToolBoundary extends Component<{ children: ReactNode; onHome: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="toolbox-message" role="alert">
      <h1>Das Tool konnte nicht geöffnet werden.</h1>
      <p>Bitte zur Übersicht zurückkehren und es erneut versuchen.</p>
      <button className="btn" onClick={this.props.onHome}>Zur Toolbox</button>
    </main>;
    return this.props.children;
  }
}

export default function Toolbox() {
  const [active, setActive] = useState<string | null>(() => {
    try {
      const saved = sessionStorage.getItem("edeco-toolbox-active");
      return saved && MODULES[saved] && TOOLS.some(tool => tool.id === saved && tool.status === "available") ? saved : null;
    } catch { return null; }
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Alle");
  const [theme, setTheme] = useState(loadTheme);
  const heading = useRef<HTMLHeadingElement>(null);
  const returning = useRef(false);
  const ActiveTool = active ? MODULES[active] : undefined;
  const tools = filterTools(query, category);
  const categories = ["Alle", ...new Set(TOOLS.map(tool => tool.category))];

  useEffect(() => {
    try {
      if (active) sessionStorage.setItem("edeco-toolbox-active", active);
      else sessionStorage.removeItem("edeco-toolbox-active");
    } catch { /* The toolbox also works when browser storage is disabled. */ }
    const tool = TOOLS.find(item => item.id === active);
    if (tool) document.documentElement.dataset.toolColor = tool.color;
    else delete document.documentElement.dataset.toolColor;
    document.title = tool ? `${tool.title} · edeco Toolbox` : "edeco Toolbox";
    if (!active && returning.current) heading.current?.focus();
  }, [active]);

  const goHome = () => {
    returning.current = true;
    setActive(null);
    setTheme(loadTheme());
  };

  if (ActiveTool) return <ToolBoundary key={active} onHome={goHome}>
    <Suspense fallback={<main className="toolbox-message" role="status">Tool wird geladen …</main>}>
      <ActiveTool onHome={goHome} />
    </Suspense>
  </ToolBoundary>;

  return <div className="toolbox">
    <header className="toolbox-header">
      <div className="toolbox-brand">
        <span role="img" aria-label="edeco ag" className="toolbox-logo"
          dangerouslySetInnerHTML={{ __html: edecoLogo.replace(/<\?xml[^?]*\?>/, "") }} />
        <span className="toolbox-brand-divider" />
        <span>Toolbox</span>
      </div>
      <button className="btn" aria-label={effectiveDark(theme) ? "Heller Modus" : "Dunkler Modus"}
        onClick={() => {
          const next = effectiveDark(theme) ? "light" : "dark";
          applyTheme(next);
          setTheme(next);
          api.saveTheme(next).catch(() => undefined);
        }}>{effectiveDark(theme) ? "☀ Hell" : "☾ Dunkel"}</button>
    </header>
    <main className="toolbox-main">
      <section className="toolbox-intro" aria-labelledby="toolbox-title">
        <p className="toolbox-eyebrow">PLANEN. VEREINFACHEN. WEITERDENKEN.</p>
        <h1 id="toolbox-title" ref={heading} tabIndex={-1}>Ein Ort. Deine Werkzeuge.</h1>
        <p>Alles für deine Elektroplanung – übersichtlich an einem Ort.</p>
      </section>
      <div className="toolbox-filters">
        <label className="toolbox-search">Werkzeug suchen
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
          return <article className={`toolbox-card tool-color-${tool.color} ${available ? "is-available" : ""}`} key={tool.id}>
            <button className="toolbox-tile" disabled={!available} title={tool.description}
              aria-label={available ? `${tool.title} öffnen` : `${tool.title}: noch nicht verfügbar`}
              onClick={() => { if (available) setActive(tool.id); }}>
              <span className={`toolbox-badge ${available ? "is-ready" : ""}`}>
                {available ? "Bereit" : tool.status === "awaiting-source" ? "In Vorbereitung" : "Geplant"}
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
      <footer className="toolbox-footer"><span>edeco ag · Toolbox</span><span>Eine gemeinsame Oberfläche. Schritt für Schritt erweiterbar.</span></footer>
    </main>
  </div>;
}
