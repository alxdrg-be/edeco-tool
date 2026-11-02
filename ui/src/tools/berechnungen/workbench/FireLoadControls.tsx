import { useId, useState } from "react";
import type { Inputs } from "./types";
import { ChoiceCards } from "../LabUI";
import { KnowledgeLink } from "../KnowledgeLink";
import { createFireLoadRow, parseFireLoadRows, type FireLoadRow } from "./installation";
import { FIRE_CABLE_FACTS, FIRE_CABLE_FAMILIES, FIRE_CABLE_REFERENCE, fireCableSelection } from "./fireCableData";
import "./fireload-controls.css";

function ValueField({ label, value, onChange, disabled, text = false }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; text?: boolean }) {
  const id = useId();
  return <label className="fireload-entry" htmlFor={id}><span>{label}</span><input id={id} value={value} disabled={disabled} inputMode={text ? "text" : "decimal"} maxLength={text ? 180 : 24} onChange={event => onChange(event.target.value)} /></label>;
}

type CatalogRow = FireLoadRow & { catalogId?: string; supplier?: string; cpr?: string };
function CatalogChoice({ row, label, onChange, disabled }: { row: CatalogRow; label: string; onChange: (row: CatalogRow) => void; disabled: boolean }) {
  const fact = FIRE_CABLE_FACTS.find(item => item.id === row.catalogId);
  const [family, setFamily] = useState<string>(fact?.family ?? "all"), [query, setQuery] = useState("");
  const words = query.trim().toLocaleLowerCase("de-CH").split(/\s+/).filter(Boolean);
  const matches = FIRE_CABLE_FACTS.filter(item => (family === "all" || item.family === family) && words.every(word => `${item.label} ${item.cpr} ${item.id}`.toLocaleLowerCase("de-CH").includes(word)));
  function choose(id: string, supplier = "") {
    if (id === "custom") onChange({ ...row, catalogId: "", supplier: "" });
    else onChange({ ...row, ...fireCableSelection(id, supplier) });
  }
  return <details className="fireload-catalog"><summary>Kabel aus Referenzkatalog wählen<span>{fact ? fact.label : "Eigene Projektwerte"}</span></summary>
    <div className="fireload-catalog-content">
      <ChoiceCards label={`${label} · Kabelfamilie`} value={family} disabled={disabled} onChange={setFamily} options={[{ value: "all", label: "Alle Familien" }, ...FIRE_CABLE_FAMILIES]} />
      <label className="fireload-catalog-search"><span>Kabel suchen</span><input type="search" value={query} disabled={disabled} maxLength={100} placeholder="Typ, Querschnitt oder CPR-Klasse …" aria-label={`${label} · Kabel suchen`} onChange={event => setQuery(event.target.value)} /></label>
      <ChoiceCards presentation="cards" label={`${label} · Referenzkabel`} value={row.catalogId || "custom"} disabled={disabled} onChange={choose} options={[{ value: "custom", label: "Eigene dokumentierte Werte" }, ...matches.map(item => ({ value: item.id, label: `${item.label} · ${item.cpr || "CPR offen"} · ${item.mj} MJ/m` }))]} />
      {fact && <>
        <p className="lab-note">Gewählt: {fact.label} · {fact.cpr || "CPR offen"} · {fact.basis === "richtwert" ? "Publizierter ca.-Richtwert" : "Publizierte Produktangabe"}. Der Nachweis am Projekt bleibt separat.</p>
        {fact.suppliers.length > 0 && <ChoiceCards label={`${label} · Lieferant`} value={row.supplier || ""} disabled={disabled} onChange={supplier => choose(fact.id, supplier)} options={[{ value: "", label: `Referenz-Grundwert · ${fact.mj} MJ/m` }, ...fact.suppliers.map(supplier => ({ value: supplier.supplier, label: `${supplier.supplier} · ${supplier.article} · ${supplier.mj} MJ/m` }))]} />}
        {fact.replacement && <button type="button" className="lab-open" disabled={disabled} onClick={() => choose(fact.replacement!)}>Publizierte Ersatzvariante einsetzen</button>}
      </>}
      <details className="fireload-catalog-source"><summary>Quelle und Geltungsbereich</summary><p className="lab-note">Datierter Referenzkatalog mit {FIRE_CABLE_FACTS.length} Einträgen, Stand {FIRE_CABLE_REFERENCE.sourceUpdated}. Werte und CPR-Klassifikation vor der Projektverwendung mit dem tatsächlichen Produkt und Herstellerbeleg abgleichen. Ein Katalogeintrag allein ist keine Fluchtwegfreigabe.</p><KnowledgeLink calculatorId="brandlast">Datenherkunft im Wissens-Hub</KnowledgeLink></details>
    </div>
  </details>;
}

export default function FireLoadControls({ input, onChange, disabled = false, rowsKey = "fireloadRows", lengthKey = "length", title = "Kabelbestand" }: { input: Inputs; onChange: (key: string, value: string) => void; disabled?: boolean; rowsKey?: "fireloadRows" | "fireloadRowsAfter"; lengthKey?: "length" | "route"; title?: string }) {
  if (input.fireloadMode !== "dynamic") return null;
  let rows: CatalogRow[];
  try { rows = parseFireLoadRows(input[rowsKey], true); }
  catch (error) { return <p role="alert" className="lab-error">{(error as Error).message}</p>; }
  const change = (next: CatalogRow[]) => onChange(rowsKey, JSON.stringify(next));
  const update = (id: string, key: keyof CatalogRow, value: string) => change(rows.map(row => row.id === id ? { ...row, [key]: value, ...(["name", "mjPerMeter", "cpr"].includes(key) ? { catalogId: "", supplier: "" } : {}) } : row));
  return <section className="fireload-controls" aria-label={`${title} im Fluchtweg`}>
    <div className="fireload-controls-heading"><h2>{title} · {rows.length} Positionen</h2><button type="button" className="lab-open" disabled={disabled || rows.length >= 1000} onClick={() => change([...rows, { ...createFireLoadRow(`fire-${crypto.randomUUID()}`), length: input[lengthKey] }])}>Kabelposition hinzufügen</button></div>
    <p className="lab-note">MJ/m aus dem Herstellerbeleg eintragen. Länge je Kabel im betrachteten Fluchtweg; die Bezugsstrecke wird separat angegeben.</p>
    {!rows.length && <p className="lab-note">Noch keine Kabelposition erfasst.</p>}
    {rows.map((row, index) => <details className="fireload-card" key={row.id} open={index === 0}><summary>{row.name || `Kabelposition ${index + 1}`} · {row.quantity || "–"} Kabel</summary><div className="fireload-fields">
      <CatalogChoice row={row} label={`${title} · Position ${index + 1}`} disabled={disabled} onChange={next => change(rows.map(item => item.id === row.id ? next : item))} />
      <ValueField label={`${title} · Position ${index + 1} · Bezeichnung / Herstellerbeleg`} value={row.name} disabled={disabled} text onChange={value => update(row.id, "name", value)} />
      <ValueField label={`${title} · Position ${index + 1} · Brandlast je Kabel (MJ/m)`} value={row.mjPerMeter} disabled={disabled} onChange={value => update(row.id, "mjPerMeter", value)} />
      <ValueField label={`${title} · Position ${index + 1} · Anzahl`} value={row.quantity} disabled={disabled} onChange={value => update(row.id, "quantity", value)} />
      <ValueField label={`${title} · Position ${index + 1} · Länge je Kabel (m)`} value={row.length} disabled={disabled} onChange={value => update(row.id, "length", value)} />
      <ValueField label={`${title} · Position ${index + 1} · CPR-Klasse (optional)`} value={row.cpr ?? ""} disabled={disabled} text onChange={value => update(row.id, "cpr", value)} />
      <div className="fireload-entry"><span>{title} · Position {index + 1} · Nachweis / Brandverhalten</span><ChoiceCards value={row.evidence} disabled={disabled} onChange={value => update(row.id, "evidence", value)} label={`${title} · Position ${index + 1} · Nachweis / Brandverhalten`} options={[{ value: "open", label: "Nachweis offen" }, { value: "documented", label: "Am Projekt dokumentiert" }, { value: "critical", label: "Kritisches Brandverhalten" }]} /></div>
      <div className="fireload-card-actions"><button type="button" className="lab-open" disabled={disabled} onClick={() => update(row.id, "length", input[lengthKey])}>Fluchtweglänge einsetzen</button><button type="button" className="lab-open" disabled={disabled} aria-label={`${title} · Kabelposition ${index + 1} entfernen`} onClick={() => change(rows.filter(item => item.id !== row.id))}>Entfernen</button></div>
    </div></details>)}
  </section>;
}
