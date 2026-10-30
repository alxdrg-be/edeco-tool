import { useCallback, useEffect, useRef, useState } from "react";
import { api, Category, Options, setDatasetNames, Status, UpdateInfo } from "./api";
import Library from "./components/Library";
import Categories from "./components/Categories";
import SettingsPage from "./components/SettingsPage";
import HelpPage from "./components/HelpPage";
import ProjectsPage from "./components/ProjectsPage";
import { applyTheme, effectiveDark, loadTheme, ThemeMode } from "./theme";
import { NavigationProvider, useNavigation } from "./Navigation";
import { Icon } from "./components/Icons";
import Menu from "./components/Menu";
import edecoLogo from "./assets/edeco-logo.svg?raw";
import Minesweeper from "./components/Minesweeper";
import UpdateDialog, { type UpdatePhase } from "./components/UpdateDialog";

type Tab = "projects" | "library" | "categories" | "settings" | "help";

const NAVIGATION: { id: Tab; label: string; description: string }[] = [
  { id: "projects", label: "Projekte", description: "Pläne und Legenden" },
  { id: "library", label: "Bibliothek", description: "Symbole und Varianten" },
  { id: "categories", label: "Kategorien", description: "Firmenweite Ordnung" },
  { id: "settings", label: "Einstellungen", description: "Programm und Daten" },
  { id: "help", label: "Hilfe", description: "Anleitung und Prüfbericht" },
];

export interface Toast {
  text: string;
  error?: boolean;
}

export default function App() {
  return <NavigationProvider><AppContent /></NavigationProvider>;
}

function AppContent() {
  const { navigate, pending } = useNavigation();
  const [tab, setTab] = useState<Tab>("projects");
  const [status, setStatus] = useState<Status | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [revision, setRevision] = useState(0); // bumps when library data changes
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [checking, setChecking] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [updatePhase, setUpdatePhase] = useState<UpdatePhase>("ready");
  const [updateError, setUpdateError] = useState("");
  const [theme, setThemeState] = useState<ThemeMode>(loadTheme);
  const setTheme = useCallback((mode: ThemeMode) => {
    applyTheme(mode);
    setThemeState(mode);
    api.saveTheme(mode).catch(() => undefined); // localStorage is empty after a restart of the window
  }, []);

  const notify = useCallback((text: string, error = false) => {
    setToast({ text, error });
    window.setTimeout(() => setToast(null), error ? 6000 : 2500);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [s, c, o] = await Promise.all([api.status(), api.categories(), api.options()]);
      setDatasetNames(s.datasets);
      setStatus(s);
      const saved = s.settings.ui_theme;
      if (saved === "light" || saved === "dark" || saved === "system") {
        applyTheme(saved);
        setThemeState(saved);
      }
      setCategories(c.items);
      setOptions(o);
      setRevision((r) => r + 1);
    } catch (e) {
      notify(`Verbindung zum Programm fehlgeschlagen: ${(e as Error).message}`, true);
    }
  }, [notify]);

  const reloadCategories = useCallback(async () => {
    const c = await api.categories();
    setCategories(c.items);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Look for a new program version once at start (silently, errors ignored)
  useEffect(() => {
    api.updateCheck().then(setUpdate).catch(() => undefined);
  }, []);

  /** Click on the program version: ask again and show the result in the update window. */
  async function checkForUpdate() {
    setUpdateOpen(true);
    setUpdatePhase("checking");
    setUpdateError("");
    setChecking(true);
    try {
      const u = await api.updateCheck();
      setUpdate(u);
      setUpdatePhase("ready");
    } catch (e) {
      setUpdateError((e as Error).message);
      setUpdatePhase("ready");
    } finally {
      setChecking(false);
    }
  }

  function showUpdate() {
    setUpdateError("");
    setUpdatePhase("ready");
    setUpdateOpen(true);
  }

  /** Download, check, silent setup, restart. The window itself is the confirmation. */
  async function installUpdate() {
    if (!update?.can_install) return;
    setUpdateOpen(true);
    setUpdatePhase("installing");
    setInstalling(true);
    try {
      await api.updateInstall();
    } catch (e) {
      setUpdateError((e as Error).message);
      setUpdatePhase("ready");
      setInstalling(false);
    }
  }

  const noDatasets = status && status.datasets.length === 0;
  const dataWarning = noDatasets || Boolean(status && (status.company_error || !status.settings.company_folder));
  const current = NAVIGATION.find((item) => item.id === tab)!;
  const [mineOpen, setMineOpen] = useState(false);
  const secretClicks = useRef<number[]>([]);
  const secret = () => {
    const now = Date.now();
    secretClicks.current = [...secretClicks.current.filter((t) => now - t < 4000), now];
    if (secretClicks.current.length >= 5) {
      secretClicks.current = [];
      setMineOpen(true);
    }
  };

  // the legend editor asks for the settings (e.g. to choose the general part)
  useEffect(() => {
    const open = () => navigate(() => setTab("settings"));
    window.addEventListener("nl:open-settings", open);
    return () => window.removeEventListener("nl:open-settings", open);
  }, [navigate]);

  return (
    <div className="app" inert={pending}>
      <aside className="app-nav" aria-label="Programmnavigation">
        <div className="brand">
          <div
            className="brand-logo"
            role="img"
            aria-label="edeco ag"
            onClick={secret}
            dangerouslySetInnerHTML={{ __html: edecoLogo.replace(/<\?xml[^?]*\?>/, "") }}
          />
          <div className="brand-name">NOVA<span>Legenden</span></div>
        </div>
        <div className="nav-label">Arbeitsbereich</div>
        <nav className="tabs" aria-label="Hauptnavigation">
          {NAVIGATION.map((item) => (
            <button
              key={item.id}
              className={`tab ${tab === item.id ? "active" : ""}`}
              aria-current={tab === item.id ? "page" : undefined}
              title={item.label}
              onClick={() => navigate(() => setTab(item.id))}
            >
              <Icon name={item.id} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="nav-footer">
          <span className="nav-footer-label">NOVA-Legenden</span>
          {status?.version_label && (
            <button
              type="button"
              className="nav-version"
              onClick={checkForUpdate}
              disabled={checking}
              title="Nach Updates suchen"
            >
              {checking ? "Suche …" : status.version_label}
            </button>
          )}
          <span>Elektroplanung</span>
          <span className="nav-copy">
            <button type="button" className="nav-secret" onClick={secret}>© 2026 edeco ag</button>
            <span>Alle Rechte vorbehalten.</span>
          </span>
          <span className="powered">Powered by Trimble Nova</span>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="topbar">
          <div className="workspace-context"><span>{current.label}</span><span>{current.description}</span></div>
          <span className="powered topbar-powered">Powered by Trimble Nova</span>
          {status && (
            <div className="top-chips">
              <div className={`data-status ${dataWarning ? "warn" : ""}`}>
                <Menu label={noDatasets ? "Datensätze fehlen" : dataWarning ? "Firmenordner prüfen" : "Datenstatus"}>
                  <dl className="status-details">
                    <dt>Symbolbibliothek</dt>
                    <dd>{status.datasets.length} Datensätze · {status.symbol_count.toLocaleString("de-CH")} Symbole</dd>
                    <dt>Firmenordner</dt>
                    <dd className={status.company_error ? "warn-text" : ""}>{status.company_error || status.settings.company_folder || "Nicht eingerichtet"}</dd>
                    <dt>Nova-Version für neue Projekte</dt>
                    <dd>{status.settings.nova_version}</dd>
                  </dl>
                  <button className="btn small" onClick={() => navigate(() => setTab("settings"))}>Einstellungen öffnen</button>
                </Menu>
              </div>
              <button
                className="chip theme-btn"
                onClick={() => setTheme(effectiveDark(theme) ? "light" : "dark")}
                title={effectiveDark(theme) ? "Zum hellen Modus wechseln" : "Zum dunklen Modus wechseln"}
                aria-label={effectiveDark(theme) ? "Heller Modus" : "Dunkler Modus"}
              >
                <Icon name={effectiveDark(theme) ? "sun" : "moon"} size={16} />
              </button>
              {update?.available && (
                <button
                  className="chip update"
                  disabled={installing}
                  onClick={showUpdate}
                  title="Update ansehen"
                >
                  {installing ? "Update läuft …" : `Update ${update.latest} verfügbar`}
                </button>
              )}
            </div>
          )}
        </header>
        <div className="main">
          {tab === "projects" && status && (
            <ProjectsPage categories={categories} novaVersion={status.settings.nova_version} notify={notify} onOpenSettings={() => navigate(() => setTab("settings"))} />
          )}
          {tab === "library" && options && (
            <Library
              categories={categories}
              options={options}
              revision={revision}
              datasets={status?.datasets ?? []}
              notify={notify}
              onCategoriesChanged={reloadCategories}
              onOpenSettings={() => navigate(() => setTab("settings"))}
            />
          )}
          {tab === "categories" && options && (
            <Categories
              categories={categories}
              options={options}
              notify={notify}
              onChanged={reload}
            />
          )}
          {tab === "help" && <HelpPage notify={notify} />}
          {tab === "settings" && status && (
            <SettingsPage
              status={status}
              update={update}
              onCheckUpdate={checkForUpdate}
              onShowUpdate={showUpdate}
              checking={checking}
              notify={notify}
              onChanged={reload}
              theme={theme}
              onTheme={setTheme}
            />
          )}
        </div>
      </div>
      {toast && <div className={`toast ${toast.error ? "error" : ""}`} role={toast.error ? "alert" : "status"}>{toast.text}</div>}
      {mineOpen && <Minesweeper onClose={() => setMineOpen(false)} />}
      {updateOpen && (
        <UpdateDialog
          phase={updatePhase}
          info={update}
          error={updateError}
          onClose={() => setUpdateOpen(false)}
          onInstall={installUpdate}
          onRetry={checkForUpdate}
        />
      )}
    </div>
  );
}
