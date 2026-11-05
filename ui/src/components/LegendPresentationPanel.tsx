import type { LegendStyle } from "../legend";
import { LayoutGrid } from "lucide-react";
import LegendSection from "./LegendSection";

export default function LegendPresentationPanel({ style, onChange }: { style: LegendStyle; onChange: (patch: Partial<LegendStyle>) => void }) {
  const mode = style.symbol_size === "real" ? "original" : style.symbol_weight === "optical" || (style.symbol_fit !== "corridor" && style.normalize_size !== false) ? "optical" : "fit";
  const row = style.compact_flow && style.grid !== "custom" ? 5 : style.row;
  const tile = style.grid === "standard" && !style.compact_flow ? style.text_size * 3.6 * style.symbol_scale : Math.min(style.text_size * 3.6 * style.symbol_scale, Math.max(2.4, row - .4));
  const density = style.compact_flow ? "compact" : row > 9 ? "large" : "normal";
  const modeLabel = mode === "original" ? "Original" : mode === "fit" ? "Einpassen" : "Optisch";
  const densityLabel = density === "compact" ? "Kompakt" : density === "large" ? "Gross" : "Normal";
  return <LegendSection id="display" icon={LayoutGrid} title="Darstellung" status={`${modeLabel} · ${style.columns} Sp. · ${densityLabel}`} defaultOpen className="legend-presentation-panel"
    help="Gilt für diese Legende. Alle Grössen bleiben proportional. Das breite Feld hält lange Leuchten und Leitungsmuster lesbar. Optisch angleichen gleicht die Flächenwirkung an und darf kleine Symbole vergrössern. Feinabstimmung bleibt am einzelnen Symbol möglich.">
    <span className="legend-section-label">Symbolgrösse</span>
    <div className="legend-choice-row" role="group" aria-label="Symbolgrösse wählen">{([["original", "Original"], ["fit", "Einpassen"], ["optical", "Optisch angleichen"]] as const).map(([id, label]) => <button type="button" key={id} className="btn small" aria-pressed={mode === id} onClick={() => onChange({ symbol_size: id === "original" ? "real" : "tile", symbol_fit: "corridor", symbol_weight: id === "optical" ? "optical" : "fit" })}>{label}</button>)}</div>
    <div className="legend-size-values"><label><span>Symbolfeldhöhe</span><output>{mode === "original" ? "Variabel" : `${tile.toFixed(1).replace(".", ",")} mm`}</output></label><label><span>Zeilenraster</span><output>{row.toFixed(1).replace(".", ",")} mm</output></label></div>
    <span className="legend-section-label">Dichte</span>
    <div className="legend-choice-row" role="group" aria-label="Legendendichte">{([["compact", "Kompakt"], ["normal", "Normal"], ["large", "Gross"]] as const).map(([id, label]) => <button type="button" className="btn small" key={id} aria-pressed={density === id} onClick={() => onChange(id === "compact" ? { compact_flow: true, grid: "dicht", row: 6, text_offset: 8, section_gap: 0, entry_gap: 0 } : id === "normal" ? { compact_flow: false, grid: "dicht", row: 6, text_offset: 8 } : { compact_flow: false, grid: "weit", row: 12, text_offset: 18 })}>{label}</button>)}</div>
    <span className="legend-section-label">Spalten</span>
    <div className="legend-choice-row" role="group" aria-label="Spaltenzahl der Legende">{[2, 3, 4].map(columns => <button type="button" className="btn small" key={columns} aria-pressed={style.columns === columns} onClick={() => onChange({ columns })}>{columns} Spalten</button>)}</div>
  </LegendSection>;
}
