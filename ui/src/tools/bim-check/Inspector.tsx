import { useEffect, useMemo, useState } from "react";
import { Box, Braces, ChevronRight, Search, X } from "lucide-react";
import { readJson } from "../../shared/http";
import { count, displayValue, elementLabel, floorLabel, isRoom, measure, type ElementDetail, type Finding, type ModelElement, type Value } from "./model";
import Paging, { pageStart } from "./Paging";

function PropertyGroup({ title, values, open = false }: { title: string; values: Record<string, Value>; open?: boolean }) {
  return <details className="bc-detail-group" open={open || undefined}>
    <summary>{title}<span>{count(Object.keys(values).length)}</span></summary>
    <dl>{Object.entries(values).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{displayValue(value)}</dd></div>)}</dl>
  </details>;
}

export default function Inspector({ modelUrl, element, related, findings, onSelect, onClose, onShowIn3D, hasReport }: {
  modelUrl: string; element: ModelElement; related: ModelElement[]; findings: Finding[];
  onSelect: (id: string) => void; onClose: () => void; onShowIn3D?: () => void; hasReport: boolean;
}) {
  const [detail, setDetail] = useState<ElementDetail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [relationPage, setRelationPage] = useState(0);
  const [checkPage, setCheckPage] = useState(0);
  const [propertySearch, setPropertySearch] = useState("");
  const [filledOnly, setFilledOnly] = useState(false);
  const propertyGroups = useMemo(() => {
    if (!detail) return [];
    const sections = [["Attribute", detail.attributes], ...Object.entries(detail.psets)] as [string, Record<string, Value>][];
    const query = propertySearch.trim().toLocaleLowerCase("de-CH");
    return sections.flatMap(([title, properties], index) => {
      const entries = Object.entries(properties).filter(([key, value]) => {
        if (filledOnly && (value == null || value === "")) return false;
        return !query || [title, key, displayValue(value)].some(text => text.toLocaleLowerCase("de-CH").includes(query));
      });
      return entries.length ? [{ title, values: Object.fromEntries(entries), attributes: index === 0 }] : [];
    });
  }, [detail, propertySearch, filledOnly]);
  useEffect(() => {
    const request = new AbortController();
    fetch(`${modelUrl}/elements/${encodeURIComponent(element.id)}`, { signal: request.signal })
      .then(response => readJson<ElementDetail>(response, "Die Eigenschaften konnten nicht geladen werden."))
      .then(result => { if (!request.signal.aborted) setDetail(result); })
      .catch((err: Error) => { if (!request.signal.aborted) setError(err.message); });
    return () => request.abort();
  }, [modelUrl, element.id, attempt]);
  const room = isRoom(element);
  const from = pageStart(relationPage, related.length, 15), checkFrom = pageStart(checkPage, findings.length, 15);
  return <aside className="bc-inspector" aria-label="Attribut-Inspektor">
    <div className="bc-panel-heading"><h2><Braces size={17} />Attribut-Inspektor</h2>
      <button type="button" className="bc-icon" aria-label="Inspektor schliessen" title="Inspektor schliessen" onClick={onClose}><X size={17} /></button>
    </div>
    <div className="bc-element-head">
      <p>{element.ifc_class}</p><h3>{elementLabel(element)}</h3><span>{floorLabel(element.storey)}</span>
      {room && <dl className="bc-measures"><div><dt>Fläche</dt><dd>{measure(element.area_m2, "m²")}</dd></div><div><dt>Volumen</dt><dd>{measure(element.volume_m3, "m³")}</dd></div></dl>}
      {onShowIn3D && <button type="button" className="btn bc-locate" onClick={onShowIn3D}><Box size={15} />Raum in 3D anzeigen</button>}
    </div>
    <details className="bc-detail-group" open={findings.length > 0 || undefined}><summary>Prüfung am Element<span>{count(findings.length)}</span></summary>
      {findings.length === 0 ? <p>{hasReport ? "Keine Regel trifft auf dieses Element zu." : "Dazu ein Excel-Regelwerk importieren."}</p> :
        <div className="bc-element-checks">
          {findings.slice(checkFrom, checkFrom + 15).map((finding, i) => <div key={checkFrom + i}>
            <span className="bc-status" data-value={finding.status}>{finding.status}</span>
            <strong>{[finding.pset, finding.attribute].filter(Boolean).join(" · ")}</strong>
            <span>Ist: {displayValue(finding.actual)} · Soll: {finding.expected || "—"}</span>
            {finding.message && <small>{finding.message}</small>}
          </div>)}
          <Paging page={checkPage} total={findings.length} size={15} onChange={setCheckPage} />
        </div>}
    </details>
    {related.length > 0 && <details className="bc-detail-group"><summary>{room ? "Zugeordnete Elemente" : "Zugeordnete Räume"}<span>{count(related.length)}</span></summary>
      <div className="bc-relations">{related.slice(from, from + 15).map(other => <button type="button" key={other.id} onClick={() => onSelect(other.id)}>{elementLabel(other)} <ChevronRight size={14} /></button>)}
        <Paging total={related.length} page={relationPage} size={15} onChange={setRelationPage} /></div>
    </details>}
    {detail ? <>
      <div className="bc-property-filters">
        <label className="bc-search"><Search size={15} aria-hidden="true" /><input aria-label="Eigenschaften durchsuchen" type="search" placeholder="PSet, Attribut oder Wert suchen …"
          value={propertySearch} onChange={event => setPropertySearch(event.target.value)} /></label>
        <label><input type="checkbox" checked={filledOnly} onChange={event => setFilledOnly(event.target.checked)} /> Nur belegte Werte</label>
      </div>
      {propertyGroups.map(group => <PropertyGroup key={`${group.attributes}-${group.title}`} title={group.title} values={group.values} open={group.attributes || Boolean(propertySearch.trim())} />)}
      {propertyGroups.length === 0 ? <p className="bc-note">Keine passenden Eigenschaften.</p> : Object.keys(detail.psets).length === 0 && <p className="bc-note">Keine Property-Sets am Element.</p>}
    </> : error ? <div className="bc-inline-error" role="alert">{error} <button type="button" className="bc-link" onClick={() => { setError(""); setAttempt(attempt + 1); }}>Erneut laden</button></div> : <p className="bc-note" role="status">Eigenschaften werden geladen …</p>}
  </aside>;
}
