import { useEffect, useRef, useState } from "react";
import { applyTheme, effectiveDark, loadTheme } from "../theme";
import edecoLogo from "../assets/edeco-logo.svg?raw";
import type { ToolProps } from "./modules";
import { api } from "../api";

interface BimWindow extends Window {
  edecoToolbox?: { prepareLeave: () => Promise<boolean> };
}

export default function BimTool({ onHome }: ToolProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [theme] = useState(() => effectiveDark(loadTheme()) ? "dark" : "light");

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === "nova-legenden-theme") {
        applyTheme(loadTheme());
        api.saveTheme(loadTheme()).catch(() => undefined);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  async function leave() {
    setBusy(true);
    setError("");
    try {
      const child = frame.current?.contentWindow as BimWindow | null;
      if (!child?.edecoToolbox) {
        setError("Das Tool lädt noch. Bitte kurz warten und erneut versuchen.");
        return;
      }
      if (await child.edecoToolbox.prepareLeave()) onHome();
    } catch {
      setError("Bitte die Eingaben in BIM2STEIGER prüfen und als JSON sichern.");
    } finally { setBusy(false); }
  }

  return <div className="bim-workspace">
    <header className="bim-toolbox-header">
      <span className="bim-toolbox-logo" role="img" aria-label="edeco ag"
        dangerouslySetInnerHTML={{ __html: edecoLogo.replace(/<\?xml[^?]*\?>/, "") }} />
      <button type="button" className="btn" disabled={busy} onClick={leave}>← Zur Toolbox</button>
      <span className="bim-toolbox-label">BIM2STEIGER</span>
      {error && <span role="alert">{error}</span>}
    </header>
    <iframe ref={frame} title="BIM2STEIGER" className="bim-frame"
      src={`/tools/bim2steiger/bim2steiger.html?toolbox=1&theme=${theme}`} />
  </div>;
}
