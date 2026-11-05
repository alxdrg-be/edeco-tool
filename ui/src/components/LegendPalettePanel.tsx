import { Palette } from "lucide-react";
import LegendSection from "./LegendSection";
import { paletteConflicts, paperContrast, type PaletteEntry } from "../legendPalette";
import InfoTip from "./InfoTip";

interface Props {
  entries: PaletteEntry[];
  threshold: number;
  onThreshold: (value: number) => void;
  onSelect: (id: string) => void;
  grayscale: boolean;
  onGrayscale: (value: boolean) => void;
}

export default function LegendPalettePanel({ entries, threshold, onThreshold, onSelect, grayscale, onGrayscale }: Props) {
  const conflicts = paletteConflicts(entries, threshold);
  const light = entries.filter(entry => (paperContrast(entry.color) ?? 21) < 2);
  const count = conflicts.length + light.length;
  return <LegendSection id="colours" icon={Palette} title="Farbprüfung" status={count ? `${count} ${count === 1 ? "Hinweis" : "Hinweise"}` : "Keine Hinweise"} className="legend-palette-panel">
    <div className="legend-settings-content">
      <p className="hint">Rubrikfarben prüfen. Die Originalfarben der Symbole bleiben erhalten.</p>
      <div className="legend-palette-swatches">{entries.map(entry => <button type="button" key={entry.id} onClick={() => onSelect(entry.id)} title={`${entry.title} · ${entry.color}`}><span className="legend-choice-swatch" style={{ background: entry.color }} />{entry.title}</button>)}</div>
      <label className="field"><span>Ähnlichkeit ΔE00 <InfoTip text="Farben unter diesem Abstand werden als ähnlich gemeldet. Das ist eine einstellbare Sichtprüfung, keine Normgrenze und keine automatische Umfärbung." /></span><input className="input" type="number" min={1} max={40} step={1} aria-label="Schwelle für ähnliche Farben" value={threshold} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value) && value >= 1 && value <= 40) onThreshold(value); }} /></label>
      <label className="toggle"><input type="checkbox" checked={grayscale} onChange={event => onGrayscale(event.target.checked)} />Graustufen – nur Vorschau</label>
      {!conflicts.length && !light.length && <p className="hint" role="status">Keine ähnlichen Rubrikfarben unter der gewählten Schwelle.</p>}
      <ul className="legend-palette-issues">{conflicts.slice(0, 20).map(pair => <li key={`${pair.first.id}:${pair.second.id}`}><button type="button" onClick={() => onSelect(pair.first.id)}><b>{pair.duplicate ? "Gleiche Farbe" : "Ähnliche Farben"}</b><span>{pair.first.title} / {pair.second.title} · ΔE00 {pair.distance.toFixed(1)}</span></button></li>)}{light.map(entry => <li key={`light:${entry.id}`}><button type="button" onClick={() => onSelect(entry.id)}><b>Heller Druckton</b><span>{entry.title} · dünne Linien auf Papier prüfen</span></button></li>)}</ul>
    </div>
  </LegendSection>;
}
