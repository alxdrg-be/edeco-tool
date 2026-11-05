import { useId } from "react";
import type { Inputs } from "./types";
import { type LoadBoard, type LoadRow, type LevelSegment, type CostItem } from "./projectSheets";
import "./planning-controls.css";

type Props = { calculatorId: string; input: Inputs; onChange: (key: string, value: string) => void; disabled?: boolean };
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

function Field({ label, value, onChange, disabled, decimal = true }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; decimal?: boolean }) {
  const fieldId = useId();
  return <div className="planning-entry" data-diagnostic-label={label}><label htmlFor={fieldId}>{label}</label><input id={fieldId} value={value} inputMode={decimal ? "decimal" : "text"} autoComplete="off" maxLength={decimal ? 24 : 80} onChange={event => onChange(event.target.value)} disabled={disabled} /></div>;
}

export default function SheetControls({ calculatorId, input, onChange, disabled }: Props) {
  if (calculatorId === "leistungsbilanz") return <LoadEditor input={input} onChange={onChange} disabled={disabled} />;
  if (calculatorId === "rtv-daempfung") return <LevelEditor input={input} onChange={onChange} disabled={disabled} />;
  if (calculatorId === "bkp-schaetzung") return <CostEditor input={input} onChange={onChange} disabled={disabled} />;
  return null;
}

function readList<T>(raw: string): T[] | null {
  try { const value: unknown = JSON.parse(raw); return Array.isArray(value) ? value as T[] : null; }
  catch { return null; }
}

function LoadEditor({ input, onChange, disabled }: Omit<Props, "calculatorId">) {
  const boards = readList<LoadBoard>(input.loadBoards);
  if (!boards) return <p role="alert" className="lab-error">Verteilungen: die Liste ist beschädigt.</p>;
  const save = (next: LoadBoard[]) => onChange("loadBoards", JSON.stringify(next));
  const editBoard = (index: number, key: "label" | "diversity", value: string) => save(boards.map((board, j) => j === index ? { ...board, [key]: value } : board));
  const editRow = (boardIndex: number, rowIndex: number, key: keyof LoadRow, value: string) => save(boards.map((board, j) => j === boardIndex ? { ...board, rows: board.rows.map((row, k) => k === rowIndex ? { ...row, [key]: value } : row) } : board));
  return <section className="planning-controls" aria-label="Verteilungen und Verbraucher"><div className="planning-section-heading"><h2>Verteilungen</h2><button type="button" className="lab-open" disabled={disabled || boards.length >= 12} onClick={() => save([...boards, { id: newId(), label: `Verteilung ${boards.length + 1}`, diversity: "1", rows: [{ id: newId(), label: "Verbraucher", count: "1", watts: "1000", diversity: "1" }] }])}>Verteilung hinzufügen</button></div>
    <p className="lab-note">Leistung mal Anzahl mal Gleichzeitigkeit. Die Gleichzeitigkeit der Verteilung gilt auf die Summe ihrer Verbraucher. Beispielwerte sind keine Normleistungen.</p>
    {boards.map((board, boardIndex) => <details data-diagnostic-field="loadBoards" data-diagnostic-row={board.id} data-diagnostic-index={boardIndex} className="planning-card" key={board.id} open={boardIndex === 0}><summary>{board.label} · {board.rows.length} Verbraucher</summary>
      <div className="planning-row"><Field label={`${board.label} · Bezeichnung`} value={board.label} onChange={value => editBoard(boardIndex, "label", value)} disabled={disabled} decimal={false} /><Field label={`${board.label} · Gleichzeitigkeit der Verteilung`} value={board.diversity} onChange={value => editBoard(boardIndex, "diversity", value)} disabled={disabled} /></div>
      {board.rows.map((row, rowIndex) => <div data-diagnostic-field="loadBoards" data-diagnostic-row={row.id} data-diagnostic-index={rowIndex} className="planning-subcard" key={row.id}><div className="planning-section-heading"><strong>{row.label}</strong><button type="button" className="planning-remove" disabled={disabled || board.rows.length === 1} aria-label={`${board.label}, ${row.label} entfernen`} onClick={() => save(boards.map((item, j) => j === boardIndex ? { ...item, rows: item.rows.filter((_, k) => k !== rowIndex) } : item))}>Entfernen</button></div>
        <div className="planning-row"><Field label={`${row.label} · Bezeichnung`} value={row.label} onChange={value => editRow(boardIndex, rowIndex, "label", value)} disabled={disabled} decimal={false} /><Field label={`${row.label} · Anzahl`} value={row.count} onChange={value => editRow(boardIndex, rowIndex, "count", value)} disabled={disabled} /><Field label={`${row.label} · Leistung`} value={row.watts} onChange={value => editRow(boardIndex, rowIndex, "watts", value)} disabled={disabled} /><Field label={`${row.label} · Gleichzeitigkeit`} value={row.diversity} onChange={value => editRow(boardIndex, rowIndex, "diversity", value)} disabled={disabled} /></div>
      </div>)}
      <div className="planning-actions"><button type="button" className="lab-open" disabled={disabled || board.rows.length >= 40} onClick={() => save(boards.map((item, j) => j === boardIndex ? { ...item, rows: [...item.rows, { id: newId(), label: `Verbraucher ${item.rows.length + 1}`, count: "1", watts: "1000", diversity: "1" }] } : item))}>Verbraucher hinzufügen</button><button type="button" className="planning-remove" disabled={disabled || boards.length === 1} onClick={() => save(boards.filter((_, j) => j !== boardIndex))}>Verteilung entfernen</button></div>
    </details>)}
  </section>;
}

function LevelEditor({ input, onChange, disabled }: Omit<Props, "calculatorId">) {
  const segments = readList<LevelSegment>(input.rtvSegments);
  if (!segments) return <p role="alert" className="lab-error">Abschnitte: die Liste ist beschädigt.</p>;
  const save = (next: LevelSegment[]) => onChange("rtvSegments", JSON.stringify(next));
  const edit = (index: number, key: keyof LevelSegment, value: string) => save(segments.map((segment, j) => j === index ? { ...segment, [key]: value } : segment));
  return <section className="planning-controls" aria-label="Pegelabschnitte"><div className="planning-section-heading"><h2>Abschnitte</h2><button type="button" className="lab-open" disabled={disabled || segments.length >= 24} onClick={() => save([...segments, { id: newId(), label: `Abschnitt ${segments.length + 1}`, kind: "cable", length: "10", attenuation: "20", gain: "0" }])}>Abschnitt hinzufügen</button></div>
    <p className="lab-note">Kabel: Länge mal dB/100 m, abgezogen. Gerät: eingegebene Pegeländerung, negativ für Dämpfung. Keine hinterlegte Kabeltabelle.</p>
    {segments.map((segment, index) => <details data-diagnostic-field="rtvSegments" data-diagnostic-row={segment.id} data-diagnostic-index={index} className="planning-card" key={segment.id} open={index === 0}><summary>{segment.label}</summary>
      <div className="planning-row"><Field label={`${segment.label} · Bezeichnung`} value={segment.label} onChange={value => edit(index, "label", value)} disabled={disabled} decimal={false} /><Field label={`${segment.label} · Art`} value={segment.kind === "cable" ? "Kabel" : "Gerät"} onChange={() => undefined} disabled />
        <button type="button" className="lab-open" disabled={disabled} onClick={() => edit(index, "kind", segment.kind === "cable" ? "device" : "cable")}>{segment.kind === "cable" ? "Als Gerät rechnen" : "Als Kabel rechnen"}</button>
        {segment.kind === "cable" ? <><Field label={`${segment.label} · Länge`} value={segment.length} onChange={value => edit(index, "length", value)} disabled={disabled} /><Field label={`${segment.label} · Dämpfung`} value={segment.attenuation} onChange={value => edit(index, "attenuation", value)} disabled={disabled} /></> : <Field label={`${segment.label} · Pegeländerung`} value={segment.gain} onChange={value => edit(index, "gain", value)} disabled={disabled} />}
      </div>
      <button type="button" className="planning-remove" disabled={disabled || segments.length === 1} onClick={() => save(segments.filter((_, j) => j !== index))}>Abschnitt entfernen</button>
    </details>)}
  </section>;
}

function CostEditor({ input, onChange, disabled }: Omit<Props, "calculatorId">) {
  const items = readList<CostItem>(input.costItems);
  if (!items) return <p role="alert" className="lab-error">Positionen: die Liste ist beschädigt.</p>;
  const save = (next: CostItem[]) => onChange("costItems", JSON.stringify(next));
  const edit = (index: number, key: keyof CostItem, value: string) => save(items.map((item, j) => j === index ? { ...item, [key]: value } : item));
  return <section className="planning-controls" aria-label="Kostenpositionen"><div className="planning-section-heading"><h2>Positionen</h2><button type="button" className="lab-open" disabled={disabled || items.length >= 80} onClick={() => save([...items, { id: newId(), group: "Allgemein", code: "23", label: `Position ${items.length + 1}`, quantity: "1", price: "0" }])}>Position hinzufügen</button></div>
    <p className="lab-note">Menge mal eigener Einheitspreis. Die Beispielposition ist kein Marktpreis.</p>
    {items.map((item, index) => <details data-diagnostic-field="costItems" data-diagnostic-row={item.id} data-diagnostic-index={index} className="planning-card" key={item.id} open={index === 0}><summary>{item.code} · {item.label}</summary>
      <div className="planning-row"><Field label={`${item.label} · Gruppe`} value={item.group} onChange={value => edit(index, "group", value)} disabled={disabled} decimal={false} /><Field label={`${item.label} · BKP`} value={item.code} onChange={value => edit(index, "code", value)} disabled={disabled} decimal={false} /><Field label={`${item.label} · Bezeichnung`} value={item.label} onChange={value => edit(index, "label", value)} disabled={disabled} decimal={false} /><Field label={`${item.label} · Menge`} value={item.quantity} onChange={value => edit(index, "quantity", value)} disabled={disabled} /><Field label={`${item.label} · Einheitspreis`} value={item.price} onChange={value => edit(index, "price", value)} disabled={disabled} /></div>
      <button type="button" className="planning-remove" disabled={disabled || items.length === 1} onClick={() => save(items.filter((_, j) => j !== index))}>Position entfernen</button>
    </details>)}
  </section>;
}
