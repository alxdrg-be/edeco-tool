

export const GRID_KEY = "nl.legend.grid";

export const BAR_KEY = "nl.legend.toolbar";

/** What the toolbar of the legend editor can show; each computer chooses (Ansicht ▾). */
export const TOOLBAR_ITEMS = [
  { id: "history", label: "Neuer Vorschlag, Rückgängig" },
  { id: "insert", label: "Einfügen" },
  { id: "grid", label: "Raster" },
  { id: "rows", label: "Zeile und Text (mm)" },
  { id: "sizes", label: "Schrift, Symbole, gleiche Fläche" },
  { id: "general", label: "Allgemeinteil ein/aus" },
  { id: "gridlines", label: "Raster anzeigen" },
  { id: "export", label: "DXF herunterladen" },
] as const;

export const TOOLBAR_DEFAULT = ["history", "insert", "general", "gridlines", "export"];

export function readBarPref(): Set<string> {
  try {
    const raw = window.localStorage.getItem(BAR_KEY);
    const list = raw ? JSON.parse(raw) : null;
    if (Array.isArray(list)) return new Set(list.filter((x) => typeof x === "string"));
  } catch {
    /* default */
  }
  return new Set(TOOLBAR_DEFAULT);
}

export function readGridPref(): boolean {
  try {
    // on, until this computer switches it off
    return window.localStorage.getItem(GRID_KEY) !== "0";
  } catch {
    return true;
  }
}

export const PANE_KEY = "nl.legend.panes";

export const PANE_LIMITS = { outline: [180, 520], props: [240, 560] } as const;

/** Widths of the side panels, as the user dragged them (per computer). */
export function readPanes(): { outline: number; props: number } {
  try {
    const v = JSON.parse(window.localStorage.getItem(PANE_KEY) || "{}");
    return { outline: Number(v.outline) || 210, props: Number(v.props) || 280 };
  } catch {
    return { outline: 210, props: 280 };
  }
}
