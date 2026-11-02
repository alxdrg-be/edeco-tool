import { useId } from "react";
import type { Inputs } from "./types";
import { createFireLoadRow, parseFireLoadRows, type FireLoadRow } from "./installation";
import "./fireload-controls.css";

function ValueField({ label, value, onChange, disabled, text = false }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; text?: boolean }) {
  const id = useId();
  return <label className="fireload-entry" htmlFor={id}><span>{label}</span><input id={id} value={value} disabled={disabled} inputMode={text ? "text" : "decimal"} maxLength={text ? 180 : 24} onChange={event => onChange(event.target.value)} /></label>;
}

export default function FireLoadControls({ input, onChange, disabled = false, rowsKey = "fireloadRows", lengthKey = "length", title = "Kabelbestand" }: { input: Inputs; onChange: (key: string, value: string) => void; disabled?: boolean; rowsKey?: "fireloadRows" | "fireloadRowsAfter"; lengthKey?: "length" | "route"; title?: string }) {
  if (input.fireloadMode !== "dynamic") return null;
  let rows: FireLoadRow[];
  try { rows = parseFireLoadRows(input[rowsKey], true); }
  catch (error) { return <p role="alert" className="lab-error">{(error as Error).message}</p>; }
  const change = (next: FireLoadRow[]) => onChange(rowsKey, JSON.stringify(next));
  const update = (id: string, key: keyof FireLoadRow, value: string) => change(rows.map(row => row.id === id ? { ...row, [key]: value } : row));
  return <section className="fireload-controls" aria-label={`${title} im Fluchtweg`}>
    <div className="fireload-controls-heading"><h2>{title} · {rows.length} Positionen</h2><button type="button" className="lab-open" disabled={disabled || rows.length >= 1000} onClick={() => change([...rows, { ...createFireLoadRow(`fire-${crypto.randomUUID()}`), length: input[lengthKey] }])}>Kabelposition hinzufügen</button></div>
    <p className="lab-note">MJ/m aus dem Herstellerbeleg eintragen. Länge je Kabel im betrachteten Fluchtweg; die Bezugsstrecke wird separat angegeben.</p>
    {!rows.length && <p className="lab-note">Noch keine Kabelposition erfasst.</p>}
    {rows.map((row, index) => <details className="fireload-card" key={row.id} open={index === 0}><summary>{row.name || `Kabelposition ${index + 1}`} · {row.quantity || "–"} Kabel</summary><div className="fireload-fields">
      <ValueField label={`${title} · Position ${index + 1} · Bezeichnung / Herstellerbeleg`} value={row.name} disabled={disabled} text onChange={value => update(row.id, "name", value)} />
      <ValueField label={`${title} · Position ${index + 1} · Brandlast je Kabel (MJ/m)`} value={row.mjPerMeter} disabled={disabled} onChange={value => update(row.id, "mjPerMeter", value)} />
      <ValueField label={`${title} · Position ${index + 1} · Anzahl`} value={row.quantity} disabled={disabled} onChange={value => update(row.id, "quantity", value)} />
      <ValueField label={`${title} · Position ${index + 1} · Länge je Kabel (m)`} value={row.length} disabled={disabled} onChange={value => update(row.id, "length", value)} />
      <label className="fireload-entry"><span>{title} · Position {index + 1} · Nachweis / Brandverhalten</span><select value={row.evidence} disabled={disabled} onChange={event => update(row.id, "evidence", event.target.value)} aria-label={`${title} · Position ${index + 1} · Nachweis / Brandverhalten`}><option value="open">Nachweis offen</option><option value="documented">Am Projekt dokumentiert</option><option value="critical">Kritisches Brandverhalten</option></select></label>
      <div className="fireload-card-actions"><button type="button" className="lab-open" disabled={disabled} onClick={() => update(row.id, "length", input[lengthKey])}>Fluchtweglänge einsetzen</button><button type="button" className="lab-open" disabled={disabled} aria-label={`${title} · Kabelposition ${index + 1} entfernen`} onClick={() => change(rows.filter(item => item.id !== row.id))}>Entfernen</button></div>
    </div></details>)}
  </section>;
}
