import { useRef } from "react";
import { Layers, AlertCircle } from "lucide-react";
import InfoTip from "./InfoTip";
import { DEFAULT_LEGEND_SCOPE, toggleLegendFloor } from "../legendScope";
import type { LegendScope, LegendScopeInfo } from "../legendScope";
import "./LegendScopePanel.css";

export interface LegendScopePanelProps {
  value?: LegendScope;
  info?: LegendScopeInfo | null;
  onChange: (scope: LegendScope) => void;
  onShowItem?: (block: string, item: string) => void;
  disabled?: boolean;
}

/** This is a view choice, not a new proposal; stored rows are never deleted. */
export default function LegendScopePanel({ value, info, onChange, onShowItem, disabled }: LegendScopePanelProps) {
  const scope = value ?? DEFAULT_LEGEND_SCOPE;
  const chosen = useRef(scope.plan_ids.length > 0);
  const all = scope.plan_ids.length === 0;
  const counts = info?.counts;
  const changeFloor = (id: number) => {
    const next = toggleLegendFloor(scope, id, !chosen.current);
    chosen.current = true;
    onChange(next);
  };

  return <section className="legend-scope-panel" aria-label="Geschossauswahl der Legende">
    <div className="legend-scope-heading"><strong><Layers size={15} aria-hidden="true" />Geschosse</strong>
      <InfoTip text="Gilt nur für diese Legende. Ohne einzelne Auswahl werden alle heutigen und späteren Geschosse gezählt. Mit «Nur vorkommende Symbole» zeigen Vorschau und Export nur Apparate der gewählten Geschosse. Handtexte, Leitungsmuster und ausdrücklich beibehaltene Zeilen bleiben erhalten. Gespeicherte Inhalte werden nicht gelöscht." /></div>
    <div className="legend-floor-choices" role="group" aria-label="Geschosse für diese Legende">
      <button type="button" className="btn small" aria-pressed={all} disabled={disabled} onClick={() => onChange({ ...scope, plan_ids: [] })}>Alle</button>
      {info?.plans.map(plan => <button type="button" className="btn small" key={plan.id} disabled={disabled}
        aria-pressed={!all && scope.plan_ids.includes(plan.id)} onClick={() => changeFloor(plan.id)}
        title={`${plan.components} Bauteile · ${plan.symbol_types} erkannte Symbolarten${plan.imported ? "" : " · noch kein Import"}`}>
        <span>{plan.name}</span><span className="legend-floor-count" aria-label={`${plan.components} Bauteile`}>{plan.components}</span>
      </button>)}
    </div>
    <label className="legend-scope-toggle"><input type="checkbox" checked={scope.only_present} disabled={disabled}
      onChange={event => { chosen.current = true; onChange({ ...scope, only_present: event.target.checked }); }} />Nur vorkommende Symbole</label>
    {info && info.plans.length === 0 && <p className="hint">Noch keine Geschosse. Handtexte und Leitungsmuster bleiben sichtbar.</p>}
    {!!info?.missing_plan_ids.length && <div className="legend-scope-missing" role="alert"><AlertCircle size={15} aria-hidden="true" /><div>
      <strong>Geschossauswahl prüfen</strong><p>Ein gewähltes Geschoss fehlt. Der Export bleibt gesperrt, bis die Auswahl korrigiert ist.</p>
      {info.missing_plan_ids.map(id => <button type="button" className="btn small" key={id} disabled={disabled}
        onClick={() => onChange({ ...scope, plan_ids: scope.plan_ids.filter(value => value !== id) })}>{id < 0 ? "Ungültige Auswahl" : `Fehlendes Geschoss ${id}`} entfernen</button>)}
    </div></div>}
    <dl className="legend-scope-counts" aria-label="Zählung der gewählten Geschosse">
      <div><dt>Bauteile</dt><dd>{counts?.components ?? "—"}</dd></div>
      <div><dt>Symbolarten</dt><dd>{counts?.symbol_types ?? "—"}</dd></div>
      <div><dt aria-label="Legendenzeilen" title="Legendenzeilen">Zeilen</dt><dd>{counts?.legend_rows ?? "—"}</dd></div>
    </dl>
    {!!counts?.unknown_components && <p className="hint">{counts.unknown_components} Bauteile sind noch nicht zugeordnet.</p>}
    {!!info?.color_warnings?.length && <details className="legend-scope-color-warnings"><summary><AlertCircle size={14} aria-hidden="true" />Farbfilter prüfen ({info.color_warning_count ?? info.color_warnings.length})</summary><div>
      {info.color_warnings.map((warning, index) => <div key={`${warning.block}:${warning.item}:${index}`}>
        <strong>{warning.text || "Symbol"}</strong><p>{warning.message}</p>
        {onShowItem && <button type="button" className="btn small" onClick={() => onShowItem(warning.block, warning.item)}>Zeile anzeigen</button>}
      </div>)}
    </div></details>}
    <details className="legend-scope-options"><summary>ⓘ Zählung & Ausgabe</summary><div>
      <p>Bauteile sind die erkannten und noch unbekannten Apparate. Symbolarten zählt erkannte Familien. Legendenzeilen zählt sichtbare Zeilen im Apparateteil, einschliesslich Handtexten und Leitungsmustern; Allgemeinteil und Titel sind separat.</p>
      <p>{scope.only_present ? "Nicht vorkommende Apparate werden nur in dieser Ansicht ausgeblendet." : "Auch Apparate ohne Vorkommen bleiben in Vorschau und Export sichtbar."}</p>
      <label className="legend-scope-toggle"><input type="checkbox" checked={scope.title_suffix} disabled={disabled || all}
        onChange={event => onChange({ ...scope, title_suffix: event.target.checked })} />Geschosse im Legendentitel</label>
      <label className="legend-scope-toggle"><input type="checkbox" checked={scope.filename_suffix} disabled={disabled || all}
        onChange={event => onChange({ ...scope, filename_suffix: event.target.checked })} />Geschosse im Exportnamen</label>
    </div></details>
  </section>;
}
