import { useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Download, Files, ListChecks, Package, X } from "lucide-react";
import type { RenameRow } from "../dateien-umbenennen/FileRename";
import type { NamingSettings } from "../dateien-umbenennen/naming";
import DeliveryHistory from "./DeliveryHistory";
import { compareDeliveryIndex } from "./deliveryIndex";
import "./delivery-flow.css";

const steps = ["Pläne wählen", "Prüfen", "Benennen", "Planliste", "Paket und Protokoll"];

type Props = {
  rows: RenameRow[]; names: string[]; issues: string[]; settings: NamingSettings;
  canImport: boolean; deliveryReady: boolean; projectId: string; recipient: string; date: string;
  deliveryFields: ReactNode; templateFields: ReactNode; busy: string; error: string; notice: string;
  onAdd: (files: File[]) => Promise<boolean>; onChange: (id: number, patch: Partial<RenameRow>) => void;
  onRemove: (id: number) => void; onDownload: () => Promise<void>;
};

export default function DeliveryFlow({ rows, names, issues, settings, canImport, deliveryReady, projectId, recipient,
  date, deliveryFields, templateFields, busy, error, notice, onAdd, onChange, onRemove, onDownload }: Props) {
  const [step, setStep] = useState(0);
  const [expected, setExpected] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const expectedKey = (row: RenameRow) => projectId + ":" + row.id;
  const fileIndex = (row: RenameRow) => row.index ?? "";
  const indexStatus = (row: RenameRow) => compareDeliveryIndex(expected[expectedKey(row)] || "", fileIndex(row));
  const indexOpen = rows.filter(row => Boolean(expected[expectedKey(row)]?.trim()) && indexStatus(row) !== "Stimmt überein").length;
  const ready = deliveryReady && rows.length > 0 && !issues.some(Boolean) && !indexOpen;
  const empty = <div className="delivery-flow-empty"><Files size={28} aria-hidden="true" /><span>Noch keine Pläne gewählt.</span>
    <button className="btn" type="button" onClick={() => setStep(0)}>Zur Planauswahl</button></div>;

  return <main className="delivery-flow" aria-label="Planabgabe">
    <div className="delivery-flow-heading"><h1>Planabgabe</h1><span>{rows.length} {rows.length === 1 ? "PDF" : "PDFs"} im Paket</span></div>
    <nav className="delivery-flow-steps" aria-label="Abgabeschritte">{steps.map((title, i) =>
      <button key={title} type="button" aria-current={step === i ? "step" : undefined} disabled={Boolean(busy)} onClick={() => setStep(i)}>
        <span>{i + 1}</span>{title}</button>)}</nav>
    {busy && <p role="status" className="delivery-flow-busy">{busy}</p>}
    {error && <p role="alert" className="rename-error">{error}</p>}
    {notice && <p role="status" className="delivery-flow-notice">{notice}</p>}

    {step === 0 && <div className="delivery-flow-grid">
      <section className="delivery-flow-panel"><h2>Pläne wählen</h2>
        <button type="button" className="delivery-flow-drop" disabled={!canImport || Boolean(busy)}
          onClick={() => fileInput.current?.click()} onDragOver={event => event.preventDefault()}
          onDrop={event => { event.preventDefault(); void onAdd(Array.from(event.dataTransfer.files)); }}>
          <Files size={26} aria-hidden="true" /><strong>PDFs hinzufügen</strong><small>PDF-Pläne hierher ziehen oder auswählen</small>
        </button>
        <input ref={fileInput} className="rename-file" aria-label="PDFs hinzufügen" type="file" accept=".pdf" multiple disabled={!canImport || Boolean(busy)}
          onChange={event => { void onAdd(Array.from(event.target.files || [])); event.target.value = ""; }} />
        {rows.length > 0 && <ul className="delivery-flow-files">{rows.map(row => <li key={row.id}><div><strong>{row.file.name}</strong><small>{row.floor || "Geschoss offen"}</small></div>
          <button className="btn" type="button" aria-label={row.file.name + " entfernen"} disabled={Boolean(busy)} onClick={() => onRemove(row.id)}><X size={16} /></button></li>)}</ul>}
      </section>
      {deliveryFields}
    </div>}

    {step === 1 && <section className="delivery-flow-panel"><h2>Planstände prüfen</h2>
      <p>Übernimm den Soll-Index je Plan aus eurem Planverzeichnis. Prüfe den Datei-Index am Plankopf. Ein erkannter Index stammt aus dem Dateinamen.</p>
      {rows.length ? <div className="delivery-flow-table"><table><thead><tr><th>Plan</th><th>Geschoss</th><th>Soll-Index</th><th>Datei-Index</th><th>Prüfung</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.id}><td>{row.file.name}</td>
          <td><input aria-label={"Geschoss für " + row.file.name} maxLength={40} value={row.floor} onChange={e => onChange(row.id, { floor: e.target.value.toUpperCase() })} /></td>
          <td><input aria-label={"Soll-Index für " + row.file.name} maxLength={80} placeholder="Optional" value={expected[expectedKey(row)] || ""} onChange={e => setExpected({ ...expected, [expectedKey(row)]: e.target.value })} /></td>
          <td><input aria-label={"Index für " + row.file.name} maxLength={80} placeholder="Am Plan prüfen" value={fileIndex(row)} onChange={e => onChange(row.id, { index: e.target.value })} /></td>
          <td data-index-state={indexStatus(row)}>{indexStatus(row)}</td></tr>)}</tbody></table></div> : empty}
    </section>}

    {step === 2 && <section className="delivery-flow-panel"><h2>Benannte Kopien</h2>{templateFields}
      {rows.length ? <div className="delivery-flow-table"><table><thead><tr><th>Original</th><th>Name im Paket</th><th>Planart</th><th>Massstab 1:</th></tr></thead><tbody>
        {rows.map((row, i) => <tr key={row.id}><td>{row.file.name}</td><td><input aria-label={"Neuer Name für " + row.file.name} value={names[i]} onChange={e => onChange(row.id, { customName: e.target.value })} />
          {row.customName !== null && <button type="button" className="rename-link" onClick={() => onChange(row.id, { customName: null })}>Wieder aus Vorlage bilden</button>}
          {issues[i] && <small className="rename-error">{issues[i]}</small>}</td>
          <td><input aria-label={"Planart für " + row.file.name} value={row.plan ?? settings.values.plan} maxLength={80} onChange={e => onChange(row.id, { plan: e.target.value })} /></td>
          <td><input aria-label={"Massstab für " + row.file.name} value={row.scale ?? settings.values.scale} maxLength={80} onChange={e => onChange(row.id, { scale: e.target.value })} /></td></tr>)}</tbody></table></div> : empty}
    </section>}

    {step === 3 && <section className="delivery-flow-panel"><h2>Planliste</h2>
      {rows.length ? <><p>{recipient || "Empfänger offen"} · {date || "Lieferdatum offen"}</p>
        <div className="delivery-flow-table"><table><thead><tr><th>Dateiname im Paket</th><th>Geschoss</th><th>Planart</th><th>Index</th><th>Massstab 1:</th></tr></thead><tbody>
          {rows.map((row, i) => <tr key={row.id}><td>{names[i]}</td><td>{row.floor || "Offen"}</td><td>{row.plan ?? settings.values.plan}</td><td>{fileIndex(row) || "Ohne Index"}</td><td>{row.scale ?? settings.values.scale}</td></tr>)}</tbody></table></div>
        <p>Die ZIP enthält diese Liste als CSV für Excel, als HTML-Druckansicht und als JSON.</p></> : empty}
    </section>}

    {step === 4 && <div className="delivery-flow-grid"><section className="delivery-flow-panel"><h2>Paket und Protokoll</h2>
      <dl className="delivery-flow-summary"><div><dt>Empfänger</dt><dd>{recipient || "Offen"}</dd></div><div><dt>Lieferdatum</dt><dd>{date}</dd></div>
        <div><dt>Paketinhalt</dt><dd>{rows.length} {rows.length === 1 ? "PDF" : "PDFs"} und Planliste</dd></div></dl>
      {!rows.length && <button className="btn" onClick={() => setStep(0)}>PDFs wählen</button>}
      {!deliveryReady && <button className="btn" onClick={() => setStep(0)}>Lieferangaben vervollständigen</button>}
      {indexOpen > 0 && <button className="btn" onClick={() => setStep(1)}>{indexOpen} {indexOpen === 1 ? "Indexabweichung" : "Indexabweichungen"} prüfen</button>}
      {issues.some(Boolean) && <button className="btn" onClick={() => setStep(2)}>Planangaben prüfen</button>}
      <div className="delivery-flow-download"><button type="button" className="btn primary" disabled={Boolean(busy) || !canImport || !ready} onClick={() => void onDownload()}><Download size={16} />Lieferpaket mit Planliste erstellen</button>
        <p>Der Download protokolliert die Vorbereitung beim Projekt. Einen erfolgten Versand kannst du dort bestätigen.</p></div>
    </section>{projectId ? <DeliveryHistory projectId={projectId} /> : <section className="delivery-flow-panel"><Package size={22} /><h2>Projektprotokoll</h2><p>Wähle im ersten Schritt das Lieferprojekt.</p></section>}</div>}

    <footer className="delivery-flow-footer">
      {step > 0 && <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => setStep(step - 1)}><ArrowLeft size={14} />Zurück</button>}
      {step < 4 && <button type="button" className="btn primary" disabled={Boolean(busy) || !rows.length} onClick={() => setStep(step + 1)}>{step === 0 ? <ListChecks size={16} /> : null}{steps[step + 1]}<ArrowRight size={14} /></button>}
    </footer>
  </main>;
}
