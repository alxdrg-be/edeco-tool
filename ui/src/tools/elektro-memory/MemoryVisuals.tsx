import { useState, type ReactNode } from "react";
import type { MemoryEntry } from "./types";
import { checkIk } from "./ikCheck";
import MemorySourceFigure, { BATH_SOURCE_IMAGES, BATH_EQUIPMENT_IMAGE, LOW_OHM_IMAGE, INSULATION_IMAGE } from "./MemorySourceFigure";

/** Own drawings and table views for single reference entries. Values come from the checked catalogue. */

const COLORS: Record<string, string> = {
  grün: "#2f9e44", rot: "#d63b3b", grau: "#8a939b", blau: "#2f6fd6", hellblau: "#86c5ef", gelb: "#f1c232", schwarz: "#1d2228",
  weiss: "#ffffff", kupfer: "#b8733a", silber: "#c3c9cf", braun: "#7a4a2b",
};

/** One swatch per colour name; «gelb/grün» becomes stripes, «blau/hellblau» two halves. */
function Swatch({ name }: { name: string }) {
  const parts = name.toLowerCase().split("/").map(part => part.trim()).filter(part => COLORS[part]);
  if (!parts.length) return null;
  const stripes = parts.length === 2 && name.toLowerCase().includes("gelb");
  const background = parts.length === 1 ? COLORS[parts[0]]
    : stripes ? `repeating-linear-gradient(135deg, ${COLORS[parts[0]]} 0 5px, ${COLORS[parts[1]]} 5px 10px)`
    : `linear-gradient(90deg, ${COLORS[parts[0]]} 50%, ${COLORS[parts[1]]} 50%)`;
  return <span className="memory-swatch" style={{ background }} aria-hidden="true" />;
}

function ColorCell({ value }: { value: string }) {
  return <span className="memory-color-cell"><Swatch name={value} />{value}</span>;
}

/** Tables whose cells are colour names get swatches next to the text. */
function ColorTable({ entry }: { entry: MemoryEntry }) {
  const table = entry.table!;
  return <div className="memory-table-wrap"><table className="memory-color-table"><thead><tr>{table.headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
    <tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((value, cell) => cell === 0 && entry.id === "em-p08-wire-colors"
      ? <th key={cell} scope="row">{value}</th>
      : <td key={cell}>{COLORS[value.toLowerCase().split("/")[0].trim()] ? <ColorCell value={value} /> : value}</td>)}</tr>)}</tbody></table></div>;
}

/** Measured Ik against the rule-of-thumb row: the verdict never replaces the manufacturer's curve. */
function IkCheck({ entry, rating, onRating }: { entry: MemoryEntry; rating: string | null; onRating: (value: string) => void }) {
  const table = entry.table!;
  const [device, setDevice] = useState(3);
  const [measured, setMeasured] = useState("");
  const [unit, setUnit] = useState<"A" | "kA">("A");
  const value = Number(measured.trim().replace(",", ".")) * (unit === "kA" ? 1000 : 1);
  const verdict = rating && measured.trim() ? checkIk(table, device, rating, value) : null;
  const deviceName = table.headers[device].replace(/\s*(Bauform \/ )?A$/, "");
  return <div className="memory-ik-check" aria-label="Ik prüfen" role="group">
    <label>Schutzorgan<select value={device} onChange={event => setDevice(Number(event.target.value))}>{table.headers.slice(1).map((header, index) => <option key={header} value={index + 1}>{header.replace(/\s*(Bauform \/ )?A$/, "")}</option>)}</select></label>
    <label>Nennstrom<select value={rating ?? ""} onChange={event => onRating(event.target.value)}><option value="" disabled>wählen</option>{table.rows.map(row => <option key={row[0]} value={row[0]}>{row[0]} A</option>)}</select></label>
    <label>Gemessener Ik<span className="memory-ik-value"><input inputMode="decimal" autoComplete="off" value={measured} onChange={event => setMeasured(event.target.value)} placeholder="z. B. 180" /><select aria-label="Einheit Ik" value={unit} onChange={event => setUnit(event.target.value as "A" | "kA")}><option>A</option><option>kA</option></select></span></label>
    <p className={`memory-ik-verdict${verdict ? ` is-${verdict.kind}` : ""}`} role="status" aria-live="polite">
      {!verdict ? "Schutzorgan, Nennstrom und gemessenen Ik eingeben."
        : verdict.kind === "none" ? `Für ${deviceName} ${rating} A nennt die Faustregel keinen Wert («${verdict.label}»). Kennlinie des Herstellers verwenden.`
        : verdict.kind === "ok" ? `Genügt nach Faustregel: ${value.toLocaleString("de-CH")} A ≥ ${verdict.required} A (${deviceName} ${rating} A).`
        : `Zu klein nach Faustregel: ${value.toLocaleString("de-CH")} A < ${verdict.required} A. Kennlinie des Herstellers prüfen.`}
    </p>
  </div>;
}

/** Long lookup tables: pick the first-column value to highlight its row (Ik rules of thumb, conduit fill). */
function LookupTable({ entry, label, ik = false }: { entry: MemoryEntry; label: string; ik?: boolean }) {
  const table = entry.table!;
  const [picked, setPicked] = useState<string | null>(null);
  return <div className="memory-lookup">
    {ik && <IkCheck entry={entry} rating={picked} onRating={setPicked} />}
    <div className="memory-lookup-chips" role="group" aria-label={label}>
      {table.rows.map(row => <button type="button" key={row[0]} aria-pressed={picked === row[0]} onClick={() => setPicked(current => current === row[0] ? null : row[0])}>{row[0]}</button>)}
    </div>
    <div className="memory-table-wrap"><table><thead><tr>{table.headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
      <tbody>{table.rows.map(row => <tr key={row[0]} className={picked === row[0] ? "is-picked" : picked ? "is-dimmed" : undefined}>{row.map((value, cell) => cell === 0 ? <th key={cell} scope="row">{value}</th> : <td key={cell}>{value}</td>)}</tr>)}</tbody></table>
      {table.note && <p className="memory-small">{table.note}</p>}</div>
  </div>;
}

const RCD_TYPES = [
  { type: "AC", detects: "Sinusförmige Wechselfehlerströme", range: "50 Hz", use: "In der Vorlage gestrichen: nicht mehr vorsehen", charging: false, muted: true },
  { type: "A", detects: "Wie AC, dazu pulsierende Gleichfehlerströme", range: "50 Hz", use: "Allgemeine Anwendungen", charging: false },
  { type: "A EV / MI", detects: "Wie A, dazu Erkennung glatter Gleichfehlerströme (6 mA, gemäss Herstellerangabe)", range: "50 Hz", use: "Ladeeinrichtungen", charging: true },
  { type: "F", detects: "Wie A, dazu Fehlerströme mit Mischfrequenzen", range: "50 Hz + 10–500 Hz", use: "Haushaltsgeräte mit Frequenzumrichter", charging: false },
  { type: "B", detects: "Wie F, dazu glatte Gleichfehlerströme", range: "0–1 kHz", use: "Frequenzumrichter, Wechselrichter", charging: true },
  { type: "B+", detects: "Wie B, erweiterter Frequenzbereich, verbesserter Brandschutz", range: "0–20 kHz", use: "z. B. Photovoltaikanlagen", charging: true },
] as const;

export function RcdOverview() {
  return <div className="memory-rcd">
    <div className="memory-rcd-limits"><span><strong>≤ 30 mA</strong>Zusätzlicher Personenschutz</span><span><strong>≤ 300 mA</strong>Brandschutz</span></div>
    <div className="memory-table-wrap"><table><thead><tr><th>Typ</th><th>Erfasst</th><th>Frequenzbereich</th><th>Typischer Einsatz</th><th>Ladezugang</th></tr></thead>
      <tbody>{RCD_TYPES.map(row => <tr key={row.type} className={"muted" in row ? "is-dimmed" : undefined}><th scope="row">{row.type}</th><td>{row.detects}</td><td>{row.range}</td><td>{row.use}</td><td>{row.charging ? "✓" : "–"}</td></tr>)}</tbody></table></div>
    <p className="memory-small">Übersicht nach E-Memory S. 7–8 (NIN 5.3.1, Artmap NIN 2025). Für die konkrete Auswahl gelten Herstellerangaben, vorgeschaltete RCD und die Vorgaben des Ladegeräts.</p>
  </div>;
}

/** The source's four views stay intact, including the fixed partitions and Fadenmass. */
export function BathZones() {
  return <MemorySourceFigure images={BATH_SOURCE_IMAGES} page={12}
    note="Die Skizzen zeigen unterschiedliche Einbausituationen. Bei Duschen ohne Wanne und bei festen Abtrennungen die zugehörigen Hinweise der Vorlage beachten. Die Quellenabbildung ersetzt keinen Abgleich der konkreten Geometrie mit der zutreffenden Normausgabe." />;
}

/** Extra visual shown in the card; `replacesTable` hides the plain catalogue table. */
export function entryVisual(entry: MemoryEntry): { node: ReactNode; replacesTable: boolean } | null {
  switch (entry.id) {
    case "em-p08-wire-colors": case "em-p07-diazed-colors": return entry.table ? { node: <ColorTable entry={entry} />, replacesTable: true } : null;
    case "em-p06-disconnection-5s": case "em-p06-disconnection-04s": return entry.table ? { node: <LookupTable entry={entry} label="Nennstrom wählen" ik />, replacesTable: true } : null;
    case "em-p11-conduit-fill": return entry.table ? { node: <LookupTable entry={entry} label="Rohrgrösse wählen" />, replacesTable: true } : null;
    case "em-p07-rcd-types": return { node: <RcdOverview />, replacesTable: false };
    case "em-p12-bath-zones": return { node: <BathZones />, replacesTable: false };
    case "em-p12-bath-equipment": return { node: <MemorySourceFigure images={BATH_EQUIPMENT_IMAGE} page={12}
      note="Die Darstellung enthält mehrere gleichzeitig geltende Bedingungen. Aus IP-Klasse oder Spannung allein ergibt sich keine Gerätefreigabe." />, replacesTable: false };
    case "em-p05-low-ohm": return { node: <MemorySourceFigure images={LOW_OHM_IMAGE} page={5} />, replacesTable: false };
    case "em-p05-insulation": return { node: <MemorySourceFigure images={INSULATION_IMAGE} page={5} />, replacesTable: false };
    default: return null;
  }
}
