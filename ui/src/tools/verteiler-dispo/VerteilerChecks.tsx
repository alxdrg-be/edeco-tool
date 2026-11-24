import { useState } from 'react';
import { ArrowUpRight, CircleAlert } from 'lucide-react';
import { SourceDetails } from './VerteilerInspector.tsx';
import type { Analysis, Issue, SourceRef } from './types.ts';

const GROUP_NAMES: Record<string, string> = {
  'din-mounting-datum-open': 'Herstellerspezifische Befestigung',
  'profile-geometry-open': 'Eigene Bauteilmasse prüfen',
  'device-depth-open': 'Gerätetiefen ergänzen',
  'din-orientation-open': 'Einbaulage bestätigen',
  'terminal-type-open': 'Klemmen und Zubehör ergänzen',
  'collision-depth-open': 'Tiefenlage von Überlappungen prüfen',
  'cover-evidence-open': 'Abdeckungsnachweise ergänzen',
  'busbar-evidence-open': 'Sammelschienennachweise ergänzen',
};

export default function VerteilerChecks({ analysis, sources, selectedId, onVisit }: { analysis: Analysis | null; sources: SourceRef[]; selectedId: string | null; onVisit: (issue: Issue) => void }) {
  const [filter, setFilter] = useState('all');
  const issues = analysis?.issues ?? [];
  const visible = issues.filter(issue => filter === 'all' || filter === issue.severity || filter === 'selection' && issue.target_id === selectedId);
  const errors = visible.filter(issue => issue.severity === 'error');
  const groups = new Map<string, Issue[]>();
  for (const issue of visible.filter(i => i.severity !== 'error')) groups.set(issue.code, [...(groups.get(issue.code) ?? []), issue]);
  function card(issue: Issue) {
    return <article className={`vd-issue vd-issue-${issue.severity}`} key={issue.id}><button type="button" onClick={() => onVisit(issue)}><CircleAlert size={17} /><span><small>{issue.severity === 'error' ? 'Konflikt' : issue.severity === 'open' ? 'Nachweis offen' : issue.severity === 'warning' ? 'Prüfen' : 'Hinweis'}</small><strong>{issue.message}</strong></span><ArrowUpRight size={15} /></button><details><summary>Warum / Ist / Soll</summary><p>{issue.explanation}</p>{(issue.actual || issue.expected) && <dl><dt>Ist</dt><dd>{issue.actual || 'unbekannt'}</dd><dt>Soll</dt><dd>{issue.expected || 'Nachweis ergänzen'}</dd></dl>}{issue.remedies.map((remedy, i) => <p className="vd-remedy" key={i}>{remedy}</p>)}<SourceDetails sources={sources} ids={issue.source_ids} /></details></article>;
  }
  return <div className="vd-checks"><h3>Prüfbericht</h3><p className="vd-muted">Geometrie und Nachweise getrennt prüfen. Keine automatische Normfreigabe.</p>
    <label className="vd-field"><span>Hinweise anzeigen</span><select aria-label="Prüfbericht filtern" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Alle ({issues.length})</option><option value="error">Konflikte ({issues.filter(i => i.severity === 'error').length})</option><option value="open">Nachweise offen ({issues.filter(i => i.severity === 'open').length})</option><option value="selection">Ausgewähltes Bauteil</option></select></label>
    {!analysis ? <p>Prüfung wird erstellt …</p> : !visible.length ? <p>{issues.length ? 'Keine Hinweise für diesen Filter.' : 'Keine Modellkonflikte gefunden. Der Bericht ersetzt keine fachliche Abnahme.'}</p> : <>
      {errors.map(card)}
      {[...groups].map(([code, entries]) => entries.length === 1 ? card(entries[0]) : <details className="vd-issue-group" key={code}><summary><strong>{GROUP_NAMES[code] ?? 'Weitere Prüfhinweise'}</strong><span>{entries.length} betroffene Bauteile</span></summary><div>{entries.map(card)}</div></details>)}
    </>}
  </div>;
}
