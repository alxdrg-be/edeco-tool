import { useMemo, useRef, useState } from "react";
import { Check, Download, FileSpreadsheet, LoaderCircle, RefreshCw, Search } from "lucide-react";
import { readJson, responseError } from "../../shared/http";
import { downloadBlob } from "../../shared/download";
import Paging, { pageStart, PAGE_SIZE } from "./Paging";
import { count, floorLabel, quantity } from "./model";

export interface CompareChange { field: string; old: unknown; new: unknown }
export interface CompareRow {
  key: string; status: Kind; element_id: string; nova_class: string; name: string; storey: string;
  room: string; part_of: string; changes: CompareChange[]; status_only: boolean; old_key: string;
}
export interface CompareResult {
  rows: CompareRow[];
  counts: Record<Kind | "nur Status", number>;
  quality: { storey: string; room: string; names: string[] }[];
  status_fields: string[];
  objects: { alt: number; neu: number };
}
export interface Comparison { result: CompareResult; olderName: string }

type Kind = "neu" | "entfernt" | "geändert" | "Zuordnung prüfen";
const kinds: { kind: Kind; hint: string }[] = [
  { kind: "Zuordnung prüfen", hint: "vermutlich dasselbe Objekt mit neuem Index, bitte selbst ansehen" },
  { kind: "neu", hint: "nur im aktuellen Stand" },
  { kind: "entfernt", hint: "nur im älteren Stand" },
  { kind: "geändert", hint: "mindestens eine Angabe ist anders" },
];

const shown = (value: unknown) => value == null || value === "" ? "leer" : String(value);

/** Guided comparison of two Nova lists: current stage open, older stage chosen here. */
export default function ListCompare({ modelUrl, currentName, floor, comparison, onComparison, onSelect }: {
  modelUrl: string; currentName: string; floor: string | null;
  comparison: Comparison | null; onComparison: (value: Comparison | null) => void; onSelect: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [kind, setKind] = useState<Kind | "">("");
  const [hideStatus, setHideStatus] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const result = comparison?.result;

  async function choose(file: File | undefined) {
    if (!file || busy) return;
    if (!/\.xlsx$/i.test(file.name)) { setError("Bitte die ältere Nova-Liste als Excel-Datei (.xlsx) wählen."); return; }
    setBusy(true); setError("");
    const body = new FormData(); body.set("file", file);
    try {
      const response = await fetch(`${modelUrl}/compare`, { method: "POST", body });
      const data = await readJson<CompareResult>(response, "Die beiden Listen liessen sich nicht vergleichen.");
      onComparison({ result: data, olderName: file.name });
      setKind(""); setPage(0); setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Die beiden Listen liessen sich nicht vergleichen.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    try {
      const response = await fetch(`${modelUrl}/compare.xlsx`);
      if (!response.ok) throw new Error(await responseError(response, "Der Bericht liess sich nicht speichern."));
      downloadBlob(await response.blob(), "Nova-Listenvergleich.xlsx");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der Bericht liess sich nicht speichern.");
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("de-CH");
    return (result?.rows ?? []).filter(row => (!kind || row.status === kind)
      && !(hideStatus && row.status === "geändert" && row.status_only)
      && (floor === null || row.storey === floor)
      && (!q || [row.key, row.name, row.nova_class, row.room, row.part_of].some(text => text.toLocaleLowerCase("de-CH").includes(q))));
  }, [result, kind, hideStatus, floor, query]);
  const start = pageStart(page, rows.length);
  const step = !result ? 2 : saved ? 5 : 3;
  const steps = ["Aktuellen Stand öffnen", "Älteren Stand wählen", "Unterschiede ansehen", "Bericht speichern"];

  return <section className="bc-panel lc" aria-label="Nova-Listen vergleichen">
    <ol className="lc-steps" aria-label="Ablauf">
      {steps.map((title, index) => <li key={title} data-state={index + 1 < step ? "done" : index + 1 === step ? "active" : "open"}>
        <span>{index + 1 < step ? <Check size={13} strokeWidth={3} /> : index + 1}</span>{title}</li>)}
    </ol>
    <input ref={input} type="file" hidden accept=".xlsx" aria-label="Älteren Stand der Nova-Liste wählen"
      onChange={e => { const file = e.currentTarget.files?.[0]; e.currentTarget.value = ""; void choose(file); }} />
    {error && <p className="bc-inline-error" role="alert">{error}</p>}

    {!result && <div className="lc-start">
      <h2>Was hat sich seit dem letzten Stand geändert?</h2>
      <p>Offen ist <b>{currentName}</b>. Wähle jetzt die <b>ältere</b> Nova-Liste desselben Projekts.</p>
      <p>Der Toolhub findet jedes Objekt über die Spalte «Index» und zeigt, was neu, weg oder anders ist.</p>
      <button type="button" className="btn bc-primary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <><LoaderCircle size={16} className="bc-spin" />Listen werden verglichen …</> : <><FileSpreadsheet size={16} />Älteren Stand wählen</>}
      </button>
      <p className="lc-small">Bei grossen Listen dauert das bis zu einer Minute. Beide Dateien bleiben auf diesem Rechner und werden nicht verändert.</p>
    </div>}

    {result && comparison && <>
      <div className="lc-head">
        <p><b>{comparison.olderName}</b> (älter) verglichen mit <b>{currentName}</b> (aktuell) · {quantity(result.objects.neu, "Objekt", "Objekte")}</p>
        <div className="lc-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}><RefreshCw size={15} />Anderen Stand wählen</button>
          <button type="button" className="btn bc-primary" onClick={() => void save()}><Download size={15} />Bericht als Excel speichern</button>
        </div>
      </div>
      <div className="lc-kinds" role="group" aria-label="Nach Art filtern">
        {kinds.map(({ kind: item, hint }) => <button key={item} type="button" aria-pressed={kind === item} data-kind={item}
          disabled={!result.counts[item]} onClick={() => { setKind(kind === item ? "" : item); setPage(0); }}>
          <strong>{count(result.counts[item] ?? 0)}</strong><span>{item}</span><small>{hint}</small></button>)}
      </div>
      <div className="lc-filters">
        <label className="lc-check"><input type="checkbox" checked={hideStatus} onChange={e => { setHideStatus(e.target.checked); setPage(0); }} />
          <span>Reine {result.status_fields.join(", ")}-Änderungen ausblenden ({count(result.counts["nur Status"])})
            <small>Hier hat sich nur der {result.status_fields.join(", ")} geändert. Für die Planung meist ohne Bedeutung.</small></span></label>
        <label className="bc-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Im Vergleich suchen" value={query}
          placeholder="Index, Bezeichnung, Raum …" onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
      </div>
      <p className="lc-small" aria-live="polite">{quantity(rows.length, "Objekt", "Objekte")} in der Liste{floor !== null ? ` · nur ${floorLabel(floor)}` : ""}. Ein Klick auf ein Objekt zeigt rechts alle Angaben.</p>
      {rows.length ? <div className="bc-table-wrap"><table><caption className="sr-only">Unterschiede zwischen den Nova-Ständen</caption>
        <thead><tr><th>Art</th><th>Objekt</th><th>Raum</th><th>Bestandteil von</th><th>Was ist anders</th></tr></thead>
        <tbody>{rows.slice(start, start + PAGE_SIZE).map(row => <tr key={row.status + row.key}>
          <td><span className="lc-kind" data-kind={row.status}>{row.status}</span></td>
          <td>{row.element_id ? <button type="button" className="bc-link" onClick={() => onSelect(row.element_id)}>{row.name}</button> : row.name}
            <small>{row.nova_class} · Index {row.key}{row.old_key ? ` · vorher ${row.old_key}` : ""}</small></td>
          <td>{row.room || "—"}<small>{floorLabel(row.storey)}</small></td>
          <td>{row.part_of || "—"}</td>
          <td>{row.changes.length ? <ul className="lc-changes">{row.changes.slice(0, 3).map(change => <li key={change.field}>
            <b>{change.field}:</b> {shown(change.old)} → {shown(change.new)}</li>)}
            {row.changes.length > 3 && <li>und {row.changes.length - 3} weitere</li>}</ul>
            : row.status === "neu" ? "kommt neu dazu" : row.status === "entfernt" ? "fehlt im aktuellen Stand" : "—"}</td>
        </tr>)}</tbody></table></div>
        : <p className="bc-note">{result.rows.length ? "Für diese Auswahl gibt es keine Unterschiede." : "Die beiden Stände sind gleich."}</p>}
      <Paging page={page} total={rows.length} onChange={setPage} />
      {result.quality.length > 0 && <details className="lc-quality">
        <summary>Datenqualität: {quantity(result.quality.length, "Raumnummer hat", "Raumnummern haben")} im aktuellen Stand zwei oder mehr Namen</summary>
        <p className="lc-small">Das ist kein Unterschied zwischen den Ständen, sondern ein Widerspruch in der aktuellen Liste. Er sollte in Nova bereinigt werden.</p>
        <ul>{result.quality.map(entry => <li key={entry.storey + entry.room}><b>{floorLabel(entry.storey)} · {entry.room}:</b> {entry.names.join(" / ")}</li>)}</ul>
      </details>}
    </>}
  </section>;
}
