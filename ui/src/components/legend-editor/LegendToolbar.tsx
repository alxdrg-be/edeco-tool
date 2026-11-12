import type { LegendDoc } from "../../legend";
import type { LegendInfo } from "../../api";
import { Icon } from "../Icons";
import Menu from "../Menu";
import { NumberInput } from "./SymbolBits";
import { FREE_TEXT_HINT } from "./editorShared.ts";
import { TOOLBAR_DEFAULT, TOOLBAR_ITEMS } from "./editorPrefs.ts";
import type { SaveState } from "./useLegendSave.ts";

type Style = LegendDoc["style"];

export interface LegendToolbarProps {
  bar: Set<string>; toggleBar: (id: string) => void; saveBar: (next: Set<string>) => void;
  showGrid: boolean; toggleGrid: () => void;
  outlineOpen: boolean; onToggleOutline: () => void;
  busy: boolean; exporting: boolean; exportBlock: string;
  canUndo: boolean; canRedo: boolean; onUndo: () => void; onRedo: () => void; onProposal: () => void;
  onAddKind: (kind: "line" | "note" | "text") => void; onAddBlock: () => void;
  style: Style; grids: LegendInfo["grids"]; setStyle: (patch: Partial<Style>) => void;
  generalKind: string | null | undefined; exportGeneral: boolean; setExportGeneral: (on: boolean) => void;
  applyCompact: () => void; applyA4: () => void; alignSectionColors: () => void;
  detached: boolean; onToggleDetached: () => void;
  saveState: SaveState; savedInfo: string; onExportDxf: () => void;
  menuContainer: () => HTMLElement | null;
}

/** Toolbar of the legend editor; each computer chooses the visible groups (Ansicht). */
export function LegendToolbar({ bar, toggleBar, saveBar, showGrid, toggleGrid, outlineOpen, onToggleOutline, busy, exporting, exportBlock,
  canUndo, canRedo, onUndo, onRedo, onProposal, onAddKind, onAddBlock, style, grids, setStyle, generalKind, exportGeneral, setExportGeneral,
  applyCompact, applyA4, alignSectionColors, detached, onToggleDetached, saveState, savedInfo, onExportDxf, menuContainer }: LegendToolbarProps) {
  return (
      <div className="legend-toolbar">
        <button type="button" className="btn small" aria-expanded={outlineOpen} aria-controls="legend-sections-outline" onClick={onToggleOutline}>Abschnitte {outlineOpen ? "ausblenden" : "einblenden"}</button>
        {bar.has("history") && (
          <div className="tool-group" role="group" aria-label="Verlauf">
            <button className="btn small" disabled={busy} onClick={onProposal} title="Legende aus den aktuellen Projektzahlen neu vorschlagen">
              Neuer Vorschlag
            </button>
            <button className="btn small icon-btn" disabled={!canUndo} onClick={onUndo}
              title="Rückgängig (Strg+Z)" aria-label="Rückgängig">↶</button>
            <button className="btn small icon-btn" disabled={!canRedo} onClick={onRedo}
              title="Wiederholen (Strg+Y)" aria-label="Wiederholen">↷</button>
          </div>
        )}
        {bar.has("insert") && (
          <Menu label="Einfügen" portalContainer={menuContainer}>
            <button className="btn small" onClick={() => onAddKind("text")} title={FREE_TEXT_HINT}>+ Freier Text</button>
            <button className="btn small" onClick={() => onAddKind("line")} title="Linienmuster, z. B. für Leitungen und Trassen">+ Linie</button>
            <button className="btn small" onClick={() => onAddKind("note")}>+ Hinweis</button>
            <button className="btn small" onClick={onAddBlock}>+ Abschnitt</button>
          </Menu>
        )}
        {(bar.has("grid") || bar.has("rows")) && (
          <div className="tool-group" role="group" aria-label="Raster">
          {bar.has("grid") && (<label className="filter-label">
            Raster
            <select
              className="select"
              value={style.grid}
              onChange={(e) => {
                if (e.target.value === "custom") {
                  setStyle({ grid: "custom" });
                  return;
                }
                // row and text step change at once, so the grid lines follow without a reload
                const g = grids.find((x) => x.id === e.target.value);
                if (g) setStyle({ grid: g.id, row: g.row, text_offset: g.text_offset });
              }}
              aria-label="Rastermass"
              title="Zeilenhöhe / Textabstand in mm"
            >
              {grids.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id === "standard"
                    ? "Standard (aus Schrift)"
                    : `${g.label} ${String(g.row).replace(".", ",")} / ${String(g.text_offset).replace(".", ",")} mm`}
                </option>
              ))}
              <option value="custom">Eigenes Mass</option>
            </select>
          </label>)}
            {bar.has("rows") && (
              <>
                <label className="filter-label">
                  Zeile
                  <span className="grid-mm">
                    <NumberInput label="Zeilenhöhe in mm" value={style.row} step={0.5} min={3} max={30}
                      onCommit={(v) => setStyle({ grid: "custom", row: Math.round(v * 100) / 100 })} />
                  </span>
                </label>
                <label className="filter-label">
                  Text
                  <span className="grid-mm">
                    <NumberInput label="Textabstand in mm" value={style.text_offset} step={0.5} min={5} max={45}
                      onCommit={(v) => setStyle({ grid: "custom", text_offset: Math.round(v * 100) / 100 })} />
                  </span>
                </label>
              </>
            )}
          </div>
        )}
        {bar.has("sizes") && (
          <div className="tool-group" role="group" aria-label="Grössen">
            <label className="filter-label">
              Schrift
              <span className="grid-mm">
                <NumberInput label="Schriftgrösse in mm" value={style.text_size} step={0.25} min={1} max={10}
                  onCommit={(v) => setStyle({ text_size: Math.max(1, Math.min(10, v)) })} />
              </span>
            </label>
            <label className="filter-label">
              Symbole
              <span className="grid-mm">
                <NumberInput label="Symbolmassstab" value={style.symbol_scale} step={0.1} min={0.2} max={5}
                  onCommit={(v) => setStyle({ symbol_scale: Math.max(0.2, Math.min(5, v)) })} />
              </span>
            </label>
            {(style.symbol_size ?? "tile") === "tile" && style.symbol_fit !== "corridor" && (
              <label className="toggle" title="Jedes Symbol bekommt dieselbe Fläche, mit einem kleinen freien Rand">
                <input type="checkbox" checked={style.normalize_size !== false} onChange={(e) => setStyle({ normalize_size: e.target.checked })} />
                Gleiche Fläche
              </label>
            )}
          </div>
        )}
        {bar.has("general") && generalKind && (
          <label className="toggle tool-toggle" title={`Allgemeinteil in dieser Legende zeigen (Vorschau und Export). ${generalKind === "dxf" ? "DXF/DWG" : "Vorlagen-Projekt"} vom Server, gesperrt. Schrift, Symbolgrösse, Abstand und Spalten übernimmt er von dieser Legende.`}>
            <input type="checkbox" checked={exportGeneral} onChange={(e) => setExportGeneral(e.target.checked)} />
            Allgemeinteil
          </label>
        )}
        {bar.has("gridlines") && (
          <button className={`btn small ${showGrid ? "is-on" : ""}`} aria-pressed={showGrid} onClick={toggleGrid} aria-label="Raster anzeigen"
            title="Rasterlinien im gewählten Mass einblenden. Sie erscheinen nicht im Export.">
            ▦ Raster
          </button>
        )}
        <Menu label="Ansicht" portalContainer={menuContainer}>
          <div className="menu-fields">
            <label className="filter-label">
              Raster
              <select
                className="select"
                value={style.grid}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    setStyle({ grid: "custom" });
                    return;
                  }
                  // row and text step change at once, so the grid lines follow without a reload
                  const g = grids.find((x) => x.id === e.target.value);
                  if (g) setStyle({ grid: g.id, row: g.row, text_offset: g.text_offset });
                }}
                aria-label="Rastermass"
                title="Zeilenhöhe / Textabstand in mm"
              >
                {grids.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.id === "standard"
                      ? "★ Standard · Kachel aus der Schrift"
                      : `${g.label} · Zeile ${String(g.row).replace(".", ",")} mm · Text ${String(g.text_offset).replace(".", ",")} mm`}
                  </option>
                ))}
                <option value="custom">Benutzerdefiniert</option>
              </select>
            </label>
          </div>
          {!bar.has("gridlines") && (
            <button className={`btn small ${showGrid ? "is-on" : ""}`} aria-pressed={showGrid} onClick={toggleGrid}>Raster anzeigen</button>
          )}
          <button className={`btn small ${style.compact_flow && style.columns !== 4 ? "is-on" : ""}`} aria-pressed={Boolean(style.compact_flow && style.columns !== 4)} onClick={applyCompact}>
            Dichte wie Entwurf
          </button>
          <button className={`btn small ${style.compact_flow && style.columns === 4 ? "is-on" : ""}`} aria-pressed={Boolean(style.compact_flow && style.columns === 4)} onClick={applyA4} title="Vier Spalten, kompakte Abstände. Die Seitenhöhe folgt dem Inhalt.">
            A4 kompakt
          </button>
          <button className="btn small" onClick={alignSectionColors} title="Rubrikmarkierung und Trennlinie auf die häufigste Originalfarbe ihrer Symbole setzen. Quellfarben, Farbvarianten und eigene Symbolfarben bleiben unverändert.">
            Rubrikfarben aus Symbolen
          </button>
          <button className={`btn small ${detached ? "is-on" : ""}`} aria-pressed={detached} onClick={onToggleDetached}>
            {detached ? "Einstellungen andocken" : "Einstellungen schwebend"}
          </button>
          <div className="menu-divider" />
          <div className="menu-fields bar-choice" role="group" aria-label="Sichtbar in der Leiste">
            <span className="hint">In der Leiste zeigen:</span>
            {TOOLBAR_ITEMS.map((t) => (
              <label key={t.id} className="toggle">
                <input type="checkbox" checked={bar.has(t.id)} onChange={() => toggleBar(t.id)} />
                {t.label}
              </label>
            ))}
            <button className="btn small" onClick={() => saveBar(new Set(TOOLBAR_DEFAULT))}>Standard</button>
          </div>
        </Menu>

        <span style={{ flex: 1 }} />
        <span className={saveState === "error" ? "dirty" : saveState === "saving" ? "hint" : "saved"} role="status"
          title={savedInfo ? `Zuletzt gespeichert ${savedInfo}` : undefined}>
          {saveState === "saving" ? "Speichert …" : saveState === "error" ? "Nicht gespeichert" : savedInfo ? "Gespeichert" : ""}
        </span>
        {bar.has("export") && (
          <button className="btn small primary" disabled={busy || exporting}
            onClick={onExportDxf}
            title={exportBlock ? "Den gewählten Abschnitt als DXF herunterladen" : "Die ganze Legende als DXF herunterladen"}>
            <Icon name="download" size={16} /> {exporting ? "Exportiert …" : "DXF herunterladen"}
          </button>
        )}
      </div>
  );
}
