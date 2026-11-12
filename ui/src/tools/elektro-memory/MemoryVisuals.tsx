import { useState, type ReactNode } from "react";
import type { MemoryEntry } from "./types";
import { checkIk } from "./ikCheck";

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

const BATH_VIEWS = [["section", "Badewanne · Schnitt"], ["shower", "Dusche ohne Wanne · Grundriss"]] as const;

/** Schematic zone drawing after E-Memory p. 12 / NIN 7.01; not to scale. */
export function BathZones() {
  const [view, setView] = useState<(typeof BATH_VIEWS)[number][0]>("section");
  return <figure className="memory-bath-zones">
    <div className="memory-reference-tabs" role="group" aria-label="Ansicht der Badbereiche">{BATH_VIEWS.map(([id, label]) => <button type="button" key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div>
    {view === "section" ? <svg viewBox="0 0 520 300" role="img" aria-label="Schnitt Badewanne: Bereich 0 in der Wanne, Bereich 1 über der Wanne bis 2,25 m, Bereich 2 daneben 0,6 m breit">
      <rect className="zone-1" x="70" y="40" width="250" height="220" /><rect className="zone-2" x="320" y="40" width="96" height="220" />
      <path className="zone-0" d="M86 205H304V246C304 252 300 256 294 256H96C90 256 86 252 86 246Z" />
      <path className="memory-room-wall" d="M70 20V260H480" /><path className="memory-bath-outline" d="M78 196H312V250C312 258 306 264 298 264H92C84 264 78 258 78 250Z" />
      <path className="memory-dimension" d="M40 40V260M34 40H46M34 260H46M320 280H416M320 274V286M416 274V286" />
      <text x="16" y="154" transform="rotate(-90 16 154)">2,25 m</text><text x="345" y="296">0,6 m</text>
      <text className="zone-label" x="186" y="236">0</text><text className="zone-label" x="186" y="130">1</text><text className="zone-label" x="360" y="160">2</text>
    </svg> : <svg viewBox="0 0 520 300" role="img" aria-label="Grundriss Dusche ohne Wanne: Bereich 1 bis 1,2 m ab Wasserauslass, Bereich 2 als Fadenmass 0,6 m um eine feste Abtrennung">
      <rect className="zone-1" x="60" y="30" width="240" height="240" /><path className="zone-2" d="M300 150A120 120 0 0 1 420 270H300Z" />
      <path className="memory-room-wall" d="M60 270V30H480" /><path className="memory-room-partition" d="M300 30V150" />
      <circle className="memory-drain" cx="72" cy="42" r="7" /><text x="86" y="50">Wasserauslass</text>
      <path className="memory-dimension" d="M60 290H300M60 284V296M300 284V296M300 150L385 235" />
      <text x="150" y="288">1,2 m</text><text x="352" y="200">0,6 m</text><text x="306" y="96">feste Abtrennung</text>
      <text className="zone-label" x="170" y="170">1</text><text className="zone-label" x="330" y="250">2</text>
    </svg>}
    <figcaption><span className="memory-zone-key zone-0" />Bereich 0 · <span className="memory-zone-key zone-1" />Bereich 1 · <span className="memory-zone-key zone-2" />Bereich 2. Schematisch, nicht massstäblich. Bei Duschen ohne Wanne ohne feste Abtrennung gilt Bereich 1 bis 1,2 m ab Wasserauslass.</figcaption>
  </figure>;
}

/** Extra visual shown in the card; `replacesTable` hides the plain catalogue table. */
export function entryVisual(entry: MemoryEntry): { node: ReactNode; replacesTable: boolean } | null {
  switch (entry.id) {
    case "em-p08-wire-colors": case "em-p07-diazed-colors": return entry.table ? { node: <ColorTable entry={entry} />, replacesTable: true } : null;
    case "em-p06-disconnection-5s": case "em-p06-disconnection-04s": return entry.table ? { node: <LookupTable entry={entry} label="Nennstrom wählen" ik />, replacesTable: true } : null;
    case "em-p11-conduit-fill": return entry.table ? { node: <LookupTable entry={entry} label="Rohrgrösse wählen" />, replacesTable: true } : null;
    case "em-p07-rcd-types": return { node: <RcdOverview />, replacesTable: false };
    case "em-p12-bath-zones": return { node: <BathZones />, replacesTable: false };
    default: return null;
  }
}
