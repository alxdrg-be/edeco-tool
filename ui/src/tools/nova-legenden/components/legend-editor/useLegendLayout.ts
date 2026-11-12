import { useEffect, useRef, useState } from "react";
import { api, type LegendLayout } from "../../api";
import { beginSave, isCurrentSave, type LegendDoc } from "../../legend";

/** Sheet layout from the backend (same code as the DXF export); only the newest answer wins. */
export function useLegendLayout(projectId: string, doc: LegendDoc | null, generalRev: number, notify: (text: string, error?: boolean) => void) {
  const [placed, setPlaced] = useState<LegendLayout | null>(null);
  const [layoutBusy, setLayoutBusy] = useState(false);
  const layoutGate = useRef({ generation: 0 });
  // layout from the backend (same code as the DXF export)
  useEffect(() => {
    if (!doc) return;
    const ctrl = new AbortController();
    const handle = window.setTimeout(() => {
      const generation = beginSave(layoutGate.current);
      setLayoutBusy(true);
      api
        .layoutLegend(projectId, doc, ctrl.signal)
        .then((r) => isCurrentSave(layoutGate.current, generation) && setPlaced(r))
        .catch(error => { if (!ctrl.signal.aborted && isCurrentSave(layoutGate.current, generation)) notify(`Vorschau nicht aktualisiert: ${(error as Error).message}`, true); })
        .finally(() => { if (isCurrentSave(layoutGate.current, generation)) setLayoutBusy(false); });
    }, 120);
    return () => {
      window.clearTimeout(handle);
      ctrl.abort();
    };
  }, [doc, projectId, generalRev, notify]);
  return { placed, setPlaced, layoutBusy };
}
