import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { filterTools, presentationCatalog, TOOLS } from "./catalog";
import { MODULES } from "./modules";
import ToolIcon from "./ToolIcon";
import BetaToolList from "./BetaToolList";
import ToolboxUpdates from "./ToolboxUpdates";
import ProjectPicker from "../tools/projektzentrale/ProjectPicker";
import { openKnowledge } from "../tools/berechnungen/KnowledgeLink";
import ToolhubHeader from "./ToolhubHeader";
import { ToolhubLocation } from "./ToolhubNavigation";
import { useToolhubTheme } from "./useToolhubTheme";
import PresentationSettings, { PresentationProvider, ToolhubSettingsDialog, usePresentation } from "./PresentationSettings";
import { allowedToolId, designBetaEnabled, toolsForPresentation } from "./presentationPolicy";
import "./toolbox.css";
import "./toolhub-redesign.css";
import { toolAppearance } from "./toolAppearance";
import { recordToolVisit } from "./recentTools";
import ToolhubRecent from "./ToolhubRecent";

function toolFromHash(): string | null | undefined {
  if (/^#wissen(?:\/|$)/.test(window.location.hash)) return "wissens-hub";
  if (/^#memory(?:\/|$)/.test(window.location.hash)) return "elektro-memory";
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

function ToolboxContents() {
  const { policy, error: policyError, refresh } = usePresentation();
  const beta = designBetaEnabled(policy);
  const [active, setActive] = useState<string | null>(() => {
    const linked = toolFromHash();
    if (linked !== undefined) return linked;
    try {
      const saved = sessionStorage.getItem("edeco-toolbox-active");
      return saved && MODULES[saved] && TOOLS.some(tool => tool.id === saved && tool.status === "available") ? saved : null;
    } catch { return null; }
  });
  const [query, setQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [category, setCategory] = useState("Alle");
  const { dark, toggle } = useToolhubTheme();
  const heading = useRef<HTMLHeadingElement>(null);
  const returning = useRef(false);
  const activeRef = useRef(active);
  const effectiveActive = active && policy && allowedToolId(active, TOOLS, policy) ? active : null;
  activeRef.current = effectiveActive;
  const policyRef = useRef(policy);
  policyRef.current = policy;
  const ActiveTool = effectiveActive ? MODULES[effectiveActive] : undefined;
  const visible = toolsForPresentation(policy);
  const visibleRoot = visible.filter(tool => !tool.parentId && !tool.hiddenFromHub);
  const categories = ["Alle", ...new Set(visibleRoot.map(tool => tool.category))];
  const filterCategory = categories.includes(category) ? category : "Alle";
  const tools = filterTools(query, filterCategory, undefined, visible);

  useEffect(() => {
    const navigate = () => {
      const current = activeRef.current;
      const managed = current === null || current === "wissens-hub" || current === "elektro-memory" || TOOLS.some(tool => tool.id === current && tool.category === "Berechnungen");
      if (!managed) {
        // Another editor owns its save/dirty-navigation contract. A hash edit
        // or browser Back must not bypass that editor's onHome callback.
        if (/^#(?:wissen|memory|rechner|toolbox|toolhub)(?:\/|$)/.test(window.location.hash)) history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        return;
      }
      const next = toolFromHash();
      if (next !== undefined && (next === null || policyRef.current && allowedToolId(next, TOOLS, policyRef.current))) { activeRef.current = next; setActive(next); }
      else if (next && policyRef.current) {
        activeRef.current = null; setActive(null);
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}#toolhub`);
      }
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);

  function openTool(id: string) {
    if (id === "toolhub-options") {
      goHome(); setSettingsOpen(true); return;
    }
    if (!MODULES[id] || !policy || !allowedToolId(id, TOOLS, policy)) return;
    activeRef.current = id;
    if (id === "wissens-hub") {
      if (!/^#wissen(?:\/|$)/.test(window.location.hash)) openKnowledge();
    } else if (id === "elektro-memory") {
      window.location.hash = "memory";
    } else if (TOOLS.some(tool => tool.id === id && tool.category === "Berechnungen")) {
      // Canonicalise even when entered from #toolbox: browser Back from an
      // article must restore this calculator rather than the toolbox.
      window.location.hash = `rechner/${id}`;
    } else if (/^#(?:wissen|memory|rechner|toolbox|toolhub)(?:\/|$)/.test(window.location.hash)) {
      // Keep other tools on their established callback-based navigation.
      // Their editors own pending-save/dirty-state checks before onHome.
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    setActive(id);
  }

  useEffect(() => {
    if (!policy) return;
    try {
      if (effectiveActive) sessionStorage.setItem("edeco-toolbox-active", effectiveActive);
      else sessionStorage.removeItem("edeco-toolbox-active");
    } catch { /* The toolbox also works when browser storage is disabled. */ }
    const tool = presentationCatalog(beta && !policy.demo_enabled).find(item => item.id === effectiveActive);
    const style = document.documentElement.style;
    if (beta) {
      const appearance = toolAppearance(effectiveActive);
      style.setProperty("--toolhub-header-bg", appearance.header);
      style.setProperty("--toolhub-accent", `light-dark(${appearance.accent}, ${appearance.lightAccent})`);
      style.setProperty("--toolhub-accent-soft", `light-dark(${appearance.tint}, color-mix(in srgb, ${appearance.lightAccent} 15%, #16232b))`);
      if (effectiveActive) recordToolVisit(effectiveActive);
    } else {
      for (const name of ["--toolhub-header-bg", "--toolhub-accent", "--toolhub-accent-soft"]) style.removeProperty(name);
    }
    if (tool) document.documentElement.dataset.toolColor = tool.color;
    else delete document.documentElement.dataset.toolColor;
    document.title = tool ? `${tool.title} · edeco Toolhub` : "edeco Toolhub";
    if (active && !effectiveActive) {
      setActive(null);
      if (/^#(?:wissen|memory|rechner)(?:\/|$)/.test(window.location.hash)) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}#toolhub`);
      }
    }
    if (!effectiveActive && returning.current) heading.current?.focus();
  }, [active, effectiveActive, policy, beta]);

  const goHome = () => {
    returning.current = true;
    activeRef.current = null;
    setActive(null);
    if (/^#(?:wissen|memory|rechner)(?:\/|$)/.test(window.location.hash)) window.location.hash = "toolhub";
  };

  if (!policy) return <main className="toolhub-policy-error"><h1>edeco Toolhub</h1>{policyError ? <><p role="alert">{policyError}</p><button className="btn" onClick={() => void refresh()}>Erneut versuchen</button></> : <p role="status">Toolhub wird geladen …</p>}</main>;

  if (ActiveTool) return <ToolBoundary key={effectiveActive} onHome={goHome}>
    <Suspense fallback={<div className="toolhub-loading">
      <ToolhubHeader title={visible.find(tool => tool.id === effectiveActive)?.title ?? "Werkzeug"} currentToolId={effectiveActive} onHome={goHome}>
        <button className="btn toolhub-theme" aria-label={dark ? "Heller Modus" : "Dunkler Modus"} onClick={toggle}>{dark ? "☀ Hell" : "☾ Dunkel"}</button>
      </ToolhubHeader>
      <main className="toolhub-loading-main"><p role="status">Werkzeug wird geladen …</p><div aria-hidden="true" className="toolhub-loading-placeholder" /></main>
    </div>}>
      <ToolhubLocation.Provider value={effectiveActive}><ActiveTool onHome={goHome} onOpenTool={openTool} /></ToolhubLocation.Provider>
    </Suspense>
  </ToolBoundary>;

  return <div className="toolbox" data-toolhub-mode={policy.demo_enabled ? "demo" : "normal"} data-toolhub-admin={policy.is_admin ? "true" : "false"} data-toolhub-count={visibleRoot.length}>
    <ToolhubHeader className="toolbox-header" title="Übersicht" currentToolId={null} onHome={() => { setQuery(""); setCategory("Alle"); heading.current?.focus(); }} onOpenTool={openTool}>
      {!beta && !policy.demo_enabled && <ProjectPicker />}
      <ToolboxUpdates />
      <PresentationSettings onOpen={() => setSettingsOpen(true)} onSaved={() => { setQuery(""); setCategory("Alle"); }} />
      <button className="btn toolhub-theme" aria-label={dark ? "Heller Modus" : "Dunkler Modus"} onClick={toggle}>
        {dark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}<span>{dark ? "Hell" : "Dunkel"}</span></button>
    </ToolhubHeader>
    <main className="toolbox-main">
      <section className="toolbox-intro" aria-labelledby="toolbox-title">
        <div>{(!beta || policy.demo_enabled) && <p className="toolbox-eyebrow">{policy.demo_enabled ? "PRÄSENTATION" : "PLANEN. VEREINFACHEN. WEITERDENKEN."}</p>}
        <h1 id="toolbox-title" ref={heading} tabIndex={-1}>Ein Ort. Deine Werkzeuge.</h1>
        {(!beta || policy.demo_enabled) && <p>{policy.demo_enabled ? "Die ausgewählten Werkzeuge für deine Präsentation." : "Alles für deine Elektroplanung – übersichtlich an einem Ort."}</p>}</div>
        {beta && !policy.demo_enabled && <div className="hub-home-project"><span>Aktives Projekt für neue Arbeiten</span><ProjectPicker /></div>}
      </section>
      {beta && <ToolhubRecent policy={policy} onOpenTool={openTool} />}
      <div className="toolbox-filters">
        <label className="toolbox-search"><span className="sr-only">Werkzeug suchen</span>
          <input type="search" placeholder="Name oder Aufgabe …" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <div className="toolbox-categories" role="group" aria-label="Kategorien">
          {categories.map(value => <button key={value} className="btn" aria-pressed={value === filterCategory}
            onClick={() => setCategory(value)}>{value}</button>)}
        </div>
      </div>
      <p className="toolbox-count" role="status">{tools.length} {tools.length === 1 ? "Werkzeug" : "Werkzeuge"} · {tools.filter(t => t.status === "available").length} verfügbar</p>
      {beta && !policy.demo_enabled ? <BetaToolList tools={tools} openTool={openTool} /> : <div className="toolbox-grid">
        {tools.map(tool => {
          const available = tool.status === "available" && Boolean(MODULES[tool.id]);
          const inProgress = tool.developmentStatus === "in-progress";
          return <article className={`toolbox-card tool-color-${tool.color} ${available ? "is-available" : ""}`} key={tool.id}>
            <button className="toolbox-tile" disabled={!available} title={tool.description}
              aria-label={available ? `${tool.title} öffnen` : `${tool.title}: noch nicht verfügbar`}
              aria-description={inProgress ? "Work in progress; kann bereits verwendet werden." : undefined}
              onClick={() => { if (available) openTool(tool.id); }}>
              {!policy.demo_enabled && <span className={`toolbox-badge ${inProgress ? "is-in-progress" : available ? "is-ready" : ""}`}>
                {inProgress ? "Work in progress" : available ? "Bereit" : tool.status === "awaiting-source" ? "In Vorbereitung" : "Geplant"}
              </span>}
              <span className="toolbox-symbol"><ToolIcon id={tool.id} /></span>
              <h2>{tool.title}</h2>
              <span className="toolbox-category">{tool.category}</span>
              <span className="toolbox-tile-action">{available ? "Öffnen" : "Demnächst"}</span>
            </button>
          </article>;
        })}
      </div>}
      {tools.length === 0 && <div className="toolbox-empty"><h2>Kein passendes Werkzeug</h2>
        <p>Versuche einen anderen Suchbegriff oder wähle eine andere Kategorie.</p>
        <button className="btn" onClick={() => { setQuery(""); setCategory("Alle"); }}>Filter zurücksetzen</button>
      </div>}
      {settingsOpen && <ToolhubSettingsDialog onClose={() => {
        setSettingsOpen(false);
        // A design switch replaces the original header button, so restore focus
        // to its current counterpart after the dialog has closed.
        requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".toolhub-settings-button")?.focus());
      }} onSaved={() => { setQuery(""); setCategory("Alle"); }} />}
      <footer className="toolbox-footer"><span>edeco Toolhub</span><span>Eine gemeinsame Oberfläche für deine Elektroplanung.</span></footer>
    </main>
  </div>;
}

function ToolhubFrame() {
  const { policy } = usePresentation();
  // Stable wrapper: switching appearance must not remount editors or their data.
  return <div className={designBetaEnabled(policy) ? "toolhub-frame" : "toolhub-classic-frame"}><ToolboxContents /></div>;
}

export default function Toolbox() {
  return <PresentationProvider><ToolhubFrame /></PresentationProvider>;
}
