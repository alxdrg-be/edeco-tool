import { useMemo, useState } from "react";
import { count, displayValue, floorLabel, quantity, statuses, type Report, type Rule, type Status } from "./model";
import Paging, { pageStart, PAGE_SIZE } from "./Paging";

export default function Findings({ report, floor, onSelect }: { report: Report; floor: string | null; onSelect: (id: string) => void }) {
  const [status, setStatus] = useState("");
  const [pset, setPset] = useState<string | null>(null);
  const [attribute, setAttribute] = useState("");
  const [page, setPage] = useState(0);
  const sets = useMemo(() => [...new Set(report.rules.map(r => r.pset))].sort(), [report]);
  const attributes = useMemo(() => [...new Set(report.rules.filter((r: Rule) => pset === null || r.pset === pset).map(r => r.attribute))].sort(), [report, pset]);
  const filtered = useMemo(() => report.rows.filter(row => (!status || row.status === status)
    && (pset === null || row.pset === pset) && (!attribute || row.attribute === attribute) && (floor === null || row.storey === floor)),
    [report, status, pset, attribute, floor]);
  const start = pageStart(page, filtered.length);
  return <section className="bc-panel bc-results" aria-label="Prüfergebnisse">
    <div className="bc-result-head"><h2>Prüfergebnisse</h2><span>{quantity(report.rules.length, "Regel", "Regeln")} · {quantity(report.rows.length, "Einzelprüfung", "Einzelprüfungen")}</span></div>
    {report.pass_rate !== null && <p className="bc-result-rate"><strong>{report.pass_rate.toLocaleString("de-CH", { maximumFractionDigits: 1 })} %</strong> erfüllt im gesamten Modell</p>}
    <div className="bc-status-list">{statuses.map((item: Status) => <button type="button" key={item}
      aria-pressed={item === status} onClick={() => { setStatus(item === status ? "" : item); setPage(0); }}>
      <span className="bc-status" data-value={item}>{item}</span><strong>{count(report.counts[item] ?? 0)}</strong></button>)}</div>
    <div className="bc-filters">
      <label>Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">Alle Status</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>PSet<select value={pset === null ? "" : "set:" + pset} onChange={e => { setPset(e.target.value ? e.target.value.slice(4) : null); setAttribute(""); setPage(0); }}>
        <option value="">Alle PSets</option>{sets.map(s => <option key={s} value={"set:" + s}>{s || "Direkte Attribute"}</option>)}</select></label>
      <label>Attribut<select value={attribute} onChange={e => { setAttribute(e.target.value); setPage(0); }}><option value="">Alle Attribute</option>{attributes.map(a => <option key={a}>{a}</option>)}</select></label>
    </div>
    <p className="bc-match-count" aria-live="polite">{quantity(filtered.length, "passende Einzelprüfung", "passende Einzelprüfungen")}</p>
    {filtered.length ? <div className="bc-table-wrap"><table><caption className="sr-only">Regelprüfung pro Element</caption>
      <thead><tr><th>Status</th><th>Element / Geschoss</th><th>PSet / Attribut</th><th>Ist</th><th>Soll</th></tr></thead>
      <tbody>{filtered.slice(start, start + PAGE_SIZE).map((row, i) => <tr key={start + i}>
        <td><span className="bc-status" data-value={row.status}>{row.status}</span></td>
        <td><button type="button" className="bc-link" onClick={() => onSelect(row.element_id)}>{[...new Set([row.number, row.name].filter(Boolean))].join(" · ") || row.element_id}</button><small>{floorLabel(row.storey)}</small></td>
        <td>{row.attribute}<small>{row.pset || "Direktes Attribut"}</small></td><td>{displayValue(row.actual)}</td><td>{row.expected || "—"}</td></tr>)}</tbody>
    </table></div> : <p className="bc-note">{report.rows.length ? "Für diese Filter gibt es keine Treffer." : "Für die eingelesenen Regeln wurden keine passenden Elemente gefunden."}</p>}
    <Paging total={filtered.length} page={page} onChange={setPage} />
  </section>;
}
