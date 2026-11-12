import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { BAR_KEY, GRID_KEY, PANE_KEY, PANE_LIMITS, readBarPref, readGridPref, readPanes } from "./editorPrefs.ts";

/** Per-computer view choices of the legend editor: grid lines, panel widths and toolbar groups. */
export function useEditorPrefs() {
  const [showGrid, setShowGrid] = useState(readGridPref);
  const [panes, setPanes] = useState(readPanes);

  /** Drag the border of a side panel, like a pane in the Explorer. Double click: back to the default. */
  function startPaneDrag(e: ReactPointerEvent, which: "outline" | "props") {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = panes[which];
    const [lo, hi] = PANE_LIMITS[which];
    let latest = panes;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const w = Math.round(Math.max(lo, Math.min(hi, which === "outline" ? w0 + dx : w0 - dx)));
      latest = { ...latest, [which]: w };
      setPanes(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("pane-resizing");
      try {
        window.localStorage.setItem(PANE_KEY, JSON.stringify(latest));
      } catch {
        /* only a convenience */
      }
    };
    document.body.classList.add("pane-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function resetPane(which: "outline" | "props") {
    const next = { ...panes, [which]: which === "outline" ? 240 : 280 };
    setPanes(next);
    try {
      window.localStorage.setItem(PANE_KEY, JSON.stringify(next));
    } catch {
      /* only a convenience */
    }
  }
  const [bar, setBar] = useState<Set<string>>(readBarPref);
  const saveBar = (next: Set<string>) => {
    setBar(next);
    try {
      window.localStorage.setItem(BAR_KEY, JSON.stringify([...next]));
    } catch {
      /* only a convenience */
    }
  };
  const toggleBar = (id: string) => {
    const next = new Set(bar);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    saveBar(next);
  };
  function toggleGrid() {
    const next = !showGrid;
    setShowGrid(next);
    try {
      window.localStorage.setItem(GRID_KEY, next ? "1" : "0");
    } catch {
      /* only a convenience */
    }
  }
  return { showGrid, toggleGrid, panes, startPaneDrag, resetPane, bar, saveBar, toggleBar };
}
