import { useEffect, useRef, useState } from "react";
import { applyTheme, effectiveDark, loadTheme, saveTheme } from "../shared/theme";
import ToolHeader from "./ToolHeader";
import type { ToolProps } from "./modules";

interface BimWindow extends Window {
  edecoToolbox?: { prepareLeave: () => Promise<boolean> };
}

export default function BimTool({ onHome, onOpenTool }: ToolProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const stopShortcutRelay = useRef<(() => void) | null>(null);
  useEffect(() => () => stopShortcutRelay.current?.(), []);
  function connectShortcuts() {
    stopShortcutRelay.current?.();
    try {
      const child = frame.current?.contentWindow;
      if (!child || child.location.origin !== window.location.origin) return;
      const forward = (event: KeyboardEvent) => {
        if (document.documentElement.dataset.designBeta !== "true") return;
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "k" || child.document.querySelector("[aria-modal=\"true\"]")) return;
        event.preventDefault(); event.stopImmediatePropagation();
        window.dispatchEvent(new Event("edeco-command-search"));
      };
      child.addEventListener("keydown", forward, true);
      stopShortcutRelay.current = () => child.removeEventListener("keydown", forward, true);
    } catch { /* Only the embedded same-origin tool participates. */ }
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [theme] = useState(() => effectiveDark(loadTheme()) ? "dark" : "light");

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === "nova-legenden-theme") {
        applyTheme(loadTheme());
        saveTheme(loadTheme()).catch(() => undefined);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  async function leave(action = onHome) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const child = frame.current?.contentWindow as BimWindow | null;
      if (!child?.edecoToolbox) {
        setError("Das Tool lädt noch. Bitte kurz warten und erneut versuchen.");
        return;
      }
      if (await child.edecoToolbox.prepareLeave()) action();
    } catch {
      setError("Bitte die Eingaben in BIM2STEIGER prüfen und als JSON sichern.");
    } finally { setBusy(false); }
  }

  return <div className="bim-workspace">
    <ToolHeader title="BIM2STEIGER" onHome={() => void leave()} onOpenTool={onOpenTool ? id => { void leave(() => onOpenTool(id)); } : undefined} disabled={busy}>
      {error && <span role="alert">{error}</span>}
    </ToolHeader>
    <iframe ref={frame} onLoad={connectShortcuts} title="BIM2STEIGER" className="bim-frame"
      src={`/tools/bim2steiger/bim2steiger.html?toolbox=1&theme=${theme}`} />
  </div>;
}
