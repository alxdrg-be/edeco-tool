import { useId, useRef, useState } from "react";
import { downloadBlob } from "../shared/download";
import { Info, Maximize2, Plus, Trash2, Type, X } from "lucide-react";
import LegendSection from "./LegendSection";
import { DEFAULT_LEGEND_TEXT_RULES, legendAbbreviationProblem, legendAbbreviationsCsv, parseLegendAbbreviationsCsv } from "../legendTextRules";
import type { LegendAbbreviation, LegendTextRules } from "../legendTextRules";
import "./LegendTextPanel.css";

export type { LegendTextRules, LegendTextWarning, LegendAbbreviation } from "../legendTextRules";

type Props = {
  value?: LegendTextRules;
  onChange: (next: LegendTextRules) => void;
  categories: { id: string; title: string }[];
  disabled?: boolean;
};

/** Compact per-legend settings. Nothing edits the underlying apparatus descriptions. */
export default function LegendTextPanel({ value = DEFAULT_LEGEND_TEXT_RULES, onChange, categories, disabled = false }: Props) {
  const file = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [message, setMessage] = useState("");
  const [csvDraft, setCsvDraft] = useState<Omit<LegendAbbreviation, "id">[] | null>(null);
  const update = (id: string, patch: Partial<LegendAbbreviation>) => onChange({ ...value, rules: value.rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule) });
  const add = () => onChange({ ...value, rules: [...value.rules, { id: crypto.randomUUID(), long: "", short: "", scope: "all", active: true }] });
  function exportCsv() {
    downloadBlob(new Blob([legendAbbreviationsCsv(value.rules)], { type: "text/csv;charset=utf-8" }), "Legenden-Abkuerzungen.csv");
  }

  const modeLabel = value.mode === "warn" ? "Warnen" : value.mode === "abbreviate" ? "Kürzen" : "Umbruch";
  const active = value.rules.filter(rule => rule.active && !legendAbbreviationProblem(rule)).length;
  return <><LegendSection id="text" icon={Type} title="Texte und Kürzel" status={`${modeLabel} · ${active} ${active === 1 ? "Regel" : "Regeln"}`} className="legend-text-panel"
    help="Gilt für diese Legende. Die Regeln ändern nur die Ausgabe; die ursprünglichen Beschreibungen bleiben erhalten.">
    <div className="legend-text-panel-body">
      <div className="legend-text-modes" role="group" aria-label="Textlänge behandeln">
        {([["wrap", "Umbruch"], ["warn", "Warnen + Vorschlag"], ["abbreviate", "Automatisch kürzen"]] as const).map(([mode, label]) => <button type="button" key={mode} disabled={disabled} aria-pressed={value.mode === mode} onClick={() => onChange({ ...value, mode })}>{label}</button>)}
      </div>
      <p className="legend-text-mode-note">{value.mode === "warn" ? "Original bleibt erhalten; bis zur Entscheidung wird umgebrochen." : value.mode === "abbreviate" ? "Aktive Regeln kürzen nur die Ausgabe. Die ursprünglichen Beschreibungen bleiben erhalten." : "Texte werden wie bisher umgebrochen; die Abkürzungstabelle wird nicht angewendet."}</p>
      <div className="legend-text-preview"><strong>{value.rules.length} {value.rules.length === 1 ? "Regel" : "Regeln"} · {value.rules.filter(rule => rule.active && !legendAbbreviationProblem(rule)).length} aktiv</strong>{value.rules.slice(0, 3).map(rule => <span key={rule.id}>{rule.long || "Langform fehlt"} → {rule.short || "Kurzform fehlt"}</span>)}{!value.rules.length && <span>Zum Beispiel: Gruppe → Gr.</span>}</div>
      <button type="button" className="btn legend-text-open-table" ref={trigger} disabled={disabled} onClick={() => { if (!dialog.current?.open) dialog.current?.showModal(); }}><Maximize2 size={15} />Tabelle gross bearbeiten</button>
    </div>
  </LegendSection>
    <dialog className="legend-text-dialog" ref={dialog} aria-labelledby={titleId} onClose={() => trigger.current?.focus()} onKeyDown={event => event.stopPropagation()} onClick={event => { if (event.target !== event.currentTarget) return; const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close(); }}>
      <header className="legend-text-dialog-header"><div><h2 id={titleId}>Abkürzungstabelle bearbeiten</h2><p>Diese Legende · Änderungen erscheinen direkt in der Vorschau und bleiben rückgängig machbar.</p></div><button type="button" className="btn legend-text-dialog-close" aria-label="Abkürzungstabelle schliessen" onClick={() => dialog.current?.close()}><X size={20} /></button></header>
      <div className="legend-text-dialog-body">
      <details className="legend-text-help"><summary><Info size={14} />Regeln und Schutz</summary><p>Nur ganze Wörter ersetzen. Typcodes wie T13, Einheiten und Nummern bleiben geschützt. Die Reihenfolge der Tabelle bestimmt die Anwendung. Ein unbekannter Geltungsbereich wird nicht auf andere Rubriken ausgeweitet. Zu lange Texte bleiben lesbar und erhalten einen Hinweis.</p><p>Firmenbeschreibungen und andere Legenden werden nicht verändert. Im Modus «Umbruch» bleibt die Tabelle vorbereitet, ohne Texte zu kürzen.</p></details>
      <div className="legend-abbreviation-table-wrap"><table className="legend-abbreviation-table"><caption>Bearbeitbare Abkürzungstabelle</caption><thead><tr><th>Langform</th><th>Kurzform</th><th>Geltungsbereich</th><th>Aktiv</th><th><span className="sr-only">Aktion</span></th></tr></thead><tbody>
        {value.rules.map((rule, index) => {
          const problem = legendAbbreviationProblem(rule);
          const categoryMissing = rule.scope !== "all" && !categories.some(category => category.id === rule.scope);
          return <tr key={rule.id}>
            <td><input className="input" aria-label={`Langform Regel ${index + 1}`} value={rule.long} maxLength={120} disabled={disabled} onChange={event => update(rule.id, { long: event.target.value })} />{problem && rule.active && <span className="legend-rule-warning">{problem}</span>}</td>
            <td><input className="input" aria-label={`Kurzform Regel ${index + 1}`} value={rule.short} maxLength={80} disabled={disabled} onChange={event => update(rule.id, { short: event.target.value })} /></td>
            <td><select className="input" aria-label={`Geltungsbereich Regel ${index + 1}`} value={rule.scope} disabled={disabled} onChange={event => update(rule.id, { scope: event.target.value })}><option value="all">Alle Rubriken</option>{categoryMissing && <option value={rule.scope}>Nicht vorhandene Rubrik</option>}{categories.map(category => <option key={category.id} value={category.id}>{category.title}</option>)}</select></td>
            <td><input type="checkbox" aria-label={`Regel ${index + 1} aktiv`} checked={rule.active} disabled={disabled} onChange={event => update(rule.id, { active: event.target.checked })} /></td>
            <td><button type="button" className="btn legend-rule-remove" aria-label={`Regel ${index + 1} entfernen`} disabled={disabled} onClick={() => onChange({ ...value, rules: value.rules.filter(item => item.id !== rule.id) })}><Trash2 size={14} /></button></td>
          </tr>;
        })}
        {!value.rules.length && <tr><td colSpan={5} className="legend-rules-empty">Noch keine Regeln. Beispielsweise «Gruppe» → «Gr.».</td></tr>}
      </tbody></table></div>
      <div className="legend-text-actions"><button type="button" className="btn" disabled={disabled || value.rules.length >= 100} onClick={add}><Plus size={14} />Regel hinzufügen</button><details><summary>CSV und Reihenfolge</summary><div className="legend-text-advanced"><button type="button" className="btn" disabled={disabled} onClick={() => file.current?.click()}>CSV importieren …</button><button type="button" className="btn" disabled={!value.rules.length} onClick={exportCsv}>CSV exportieren</button><p>Spalten: Langform;Kurzform;Geltungsbereich;Aktiv. Geltungsbereich: all oder Rubrik-ID. Import wird zuerst geprüft und ersetzt die Tabelle erst nach Bestätigung.</p>{value.rules.map((rule, index) => <div className="legend-rule-order" key={rule.id}><span>{rule.long || `Regel ${index + 1}`}</span><button type="button" className="btn" disabled={disabled || index === 0} aria-label={`Regel ${index + 1} nach oben`} onClick={() => { const rules = [...value.rules]; [rules[index - 1], rules[index]] = [rules[index], rules[index - 1]]; onChange({ ...value, rules }); }}>↑</button><button type="button" className="btn" disabled={disabled || index === value.rules.length - 1} aria-label={`Regel ${index + 1} nach unten`} onClick={() => { const rules = [...value.rules]; [rules[index], rules[index + 1]] = [rules[index + 1], rules[index]]; onChange({ ...value, rules }); }}>↓</button></div>)}</div></details></div>
      <input type="file" ref={file} accept=".csv,text/csv" hidden onChange={async event => { const selected = event.target.files?.[0]; event.target.value = ""; if (!selected) return; try { if (selected.size > 150_000) throw new Error("CSV-Datei höchstens 150 kB."); const rows = parseLegendAbbreviationsCsv(await selected.text()); const known = new Set(["all", ...categories.map(category => category.id)]); if (rows.some(rule => !known.has(rule.scope))) throw new Error("CSV enthält eine unbekannte Rubrik-ID. Geltungsbereich korrigieren oder all verwenden."); setCsvDraft(rows); setMessage(""); } catch (error) { setCsvDraft(null); setMessage((error as Error).message); } }} />
      {csvDraft && <div className="legend-csv-confirm"><strong>{csvDraft.length} Regeln geprüft</strong><p>Die aktuelle Tabelle mit {value.rules.length} Regeln wird ersetzt.</p><button type="button" className="btn" disabled={disabled} onClick={() => { onChange({ ...value, rules: csvDraft.map(rule => ({ ...rule, id: crypto.randomUUID() })) }); setCsvDraft(null); setMessage("Abkürzungstabelle übernommen."); }}>Tabelle übernehmen</button><button type="button" className="btn" onClick={() => setCsvDraft(null)}>Abbrechen</button></div>}
      {message && <p role="status" className="legend-text-import-status">{message}</p>}
      </div>
      <footer className="legend-text-dialog-footer"><span>Originaltexte bleiben erhalten.</span><button type="button" className="btn" onClick={() => dialog.current?.close()}>Fertig</button></footer>
    </dialog>
  </>;
}
