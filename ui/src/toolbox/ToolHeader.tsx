import { useEffect, useState, type ReactNode } from "react";
import edecoLogo from "../assets/edeco-logo.svg?raw";
import { applyTheme, effectiveDark, loadTheme } from "../theme";
import { api } from "../api";

interface Props {
  title: string;
  onHome: () => void;
  disabled?: boolean;
  onLogoClick?: () => void;
  children?: ReactNode;
}

export default function ToolHeader({ title, onHome, disabled, onLogoClick, children }: Props) {
  const [theme, setTheme] = useState(loadTheme);
  useEffect(() => {
    const sync = () => setTheme(loadTheme());
    window.addEventListener("edeco-theme-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("edeco-theme-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const dark = effectiveDark(theme);
  return <header className="tool-header" aria-label={`${title} · Werkzeugleiste`}>
    <span className="tool-header-logo" role="img" aria-label="edeco ag" onClick={onLogoClick}
      dangerouslySetInnerHTML={{ __html: edecoLogo.replace(/<\?xml[^?]*\?>/, "") }} />
    <span className="tool-header-divider" aria-hidden="true" />
    <button type="button" className="btn tool-header-back" disabled={disabled} onClick={onHome}>← Zur Toolbox</button>
    <span className="tool-header-title"><span aria-hidden="true" className="tool-header-mark" />{title}</span>
    <div className="tool-header-actions">{children}
      <button type="button" className="btn" aria-label={dark ? "Heller Modus" : "Dunkler Modus"} onClick={() => {
        const next = dark ? "light" : "dark";
        applyTheme(next);
        api.saveTheme(next).catch(() => undefined);
      }}>{dark ? "☀ Hell" : "☾ Dunkel"}</button>
    </div>
  </header>;
}
