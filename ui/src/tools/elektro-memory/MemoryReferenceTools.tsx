import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, Bath, Info, Plug, ShieldCheck, X } from "lucide-react";
import { IP_ADDITIONAL, IP_FIRST, IP_SECOND, IP_SUPPLEMENTARY, SWISS_SOCKETS, parseIpCode, socketContactPoints } from "./memoryReference";
import type { IpFirstDigit, IpSecondDigit, SwissSocket } from "./memoryReference";

function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="memory-info-button" aria-label={label} onClick={onClick}><Info size={19} aria-hidden="true" /></button>;
}

function ReferenceDrawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => { dialog?.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="memory-reference-drawer" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose();
  }}>
    <header><h2 id={titleId}>{title}</h2><button type="button" className="memory-drawer-close" aria-label="Erklärung schliessen" onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
    <div className="memory-drawer-content">{children}</div>
  </dialog>;
}

function IpTable({ kind, initialOpen }: { kind: "first" | "second"; initialOpen: boolean }) {
  const values = kind === "first" ? IP_FIRST : IP_SECOND;
  return <details className="memory-reference-detail" open={initialOpen || undefined}>
    <summary>{kind === "first" ? "Erste Kennziffer: Zugang und Fremdkörper" : "Zweite Kennziffer: Wasser"}</summary>
    <div className="memory-table-wrap"><table><thead><tr><th>Kennziffer</th><th>Bedeutung</th></tr></thead><tbody>{values.map(entry => <tr key={entry.digit}><th scope="row">{entry.digit}</th><td><strong>{entry.title}</strong><p>{entry.detail}</p></td></tr>)}</tbody></table></div>
  </details>;
}

export function IpDecoder() {
  const [first, setFirst] = useState<IpFirstDigit>("4");
  const [second, setSecond] = useState<IpSecondDigit>("4");
  const [query, setQuery] = useState("IP44");
  const [error, setError] = useState(false);
  const [info, setInfo] = useState<"all" | "first" | "second" | null>(null);
  const firstInfo = IP_FIRST.find(entry => entry.digit === first)!;
  const secondInfo = IP_SECOND.find(entry => entry.digit === second)!;
  function updateCode(value: string) {
    setQuery(value);
    const parsed = parseIpCode(value);
    setError(!parsed);
    if (parsed) { setFirst(parsed.first); setSecond(parsed.second); }
  }
  function updateDigit(kind: "first" | "second", value: string) {
    const nextFirst = kind === "first" ? value as IpFirstDigit : first;
    const nextSecond = kind === "second" ? value as IpSecondDigit : second;
    setFirst(nextFirst); setSecond(nextSecond); setQuery(`IP${nextFirst}${nextSecond}`); setError(false);
  }
  return <section className="memory-reference-tool memory-ip-decoder" aria-label="IP-Decoder">
    <header><div><ShieldCheck size={20} aria-hidden="true" /><h3>IP-Decoder</h3></div><InfoButton label="IP-Schutzart erklären" onClick={() => setInfo("all")} /></header>
    <div className="memory-ip-controls">
      <label className="memory-ip-input">Schutzart<input value={query} maxLength={12} aria-invalid={error} aria-describedby={error ? "memory-ip-error" : undefined} onChange={event => updateCode(event.target.value)} spellCheck={false} autoComplete="off" placeholder="IP44" /></label>
      <label>Erste Kennziffer<select value={first} onChange={event => updateDigit("first", event.target.value)} aria-label="Erste IP-Kennziffer">{IP_FIRST.map(entry => <option value={entry.digit} key={entry.digit}>{entry.digit}</option>)}</select></label>
      <label>Zweite Kennziffer<select value={second} onChange={event => updateDigit("second", event.target.value)} aria-label="Zweite IP-Kennziffer">{IP_SECOND.map(entry => <option value={entry.digit} key={entry.digit}>{entry.digit}</option>)}</select></label>
    </div>
    {error ? <p className="memory-ip-error" id="memory-ip-error" role="status">Zwei Kennziffern eingeben: zuerst 0–6 oder X, danach 0–8 oder X. Beispiel: IP44 oder IPX7. Weitere Kennzeichnungen stehen im ⓘ.</p> : <div className="memory-ip-results" aria-live="polite">
      <button type="button" onClick={() => setInfo("first")} aria-label={`Erste Kennziffer ${first} erklären`}><span className="memory-ip-digit">{first}</span><span><small>Zugang / feste Fremdkörper</small><strong>{firstInfo.title}</strong></span><Info size={16} aria-hidden="true" /></button>
      <button type="button" onClick={() => setInfo("second")} aria-label={`Zweite Kennziffer ${second} erklären`}><span className="memory-ip-digit">{second}</span><span><small>Wasser</small><strong>{secondInfo.title}</strong></span><Info size={16} aria-hidden="true" /></button>
    </div>}
    {!error && (second === "7" || second === "8") && <p className="memory-reference-callout">IPX{second} bestätigt nicht automatisch IPX5 oder IPX6. Die jeweiligen Prüfbedingungen sind getrennt zu betrachten.</p>}
    <p className="memory-small">Kennziffer oder ⓘ anklicken, um die Prüfbedingungen und Tabellen zu lesen.</p>
    {info && <ReferenceDrawer title="IP-Schutzart verstehen" onClose={() => setInfo(null)}>
      <p>Die erste Kennziffer beschreibt den Zugang zu gefährlichen Teilen und feste Fremdkörper, die zweite den Wasserschutz. Die gewählte Angabe lautet <strong>IP{first}{second}</strong>.</p>
      <div className="memory-reference-callout"><strong>X ist nicht 0.</strong> X bedeutet «nicht angegeben». 0 bezeichnet die jeweilige Stufe ohne Schutz.</div>
      <IpTable kind="first" initialOpen={info === "first"} />
      <IpTable kind="second" initialOpen={info === "second"} />
      <details className="memory-reference-detail"><summary>Zusatz- und Ergänzungsbuchstaben</summary><h3>Zusätzlicher Zugangsschutz</h3><dl>{IP_ADDITIONAL.map(([letter, value]) => <div key={letter}><dt>{letter}</dt><dd>{value}</dd></div>)}</dl><h3>Ergänzende Angaben</h3><dl>{IP_SUPPLEMENTARY.map(([letter, value]) => <div key={letter}><dt>{letter}</dt><dd>{value}</dd></div>)}</dl><p>Die Bedeutung ergibt sich aus der vollständigen Kennzeichnung. Buchstaben sind keine alternative Wasserkennziffer und keine Schutzklasse.</p></details>
      <details className="memory-reference-detail"><summary>Beispiele und typische Verwechslungen</summary><p><strong>IP44:</strong> Draht / feste Fremdkörper ab 1 mm und Spritzwasser aus allen Richtungen, jeweils unter den festgelegten Prüfbedingungen.</p><p><strong>IPX7 / IPX8:</strong> Untertauchen bestätigt nicht automatisch die Strahlwasserprüfungen IPX5 oder IPX6. Bei IPX8 gelten vereinbarte Herstellerbedingungen; keine allgemeine Tiefe annehmen.</p><p><strong>IP2X:</strong> Die Wasserkennziffer ist nicht angegeben. Eine Schutzart ist ausserdem keine automatische Zulässigkeit eines Geräts im Bad oder an einem anderen Installationsort.</p></details>
      <details className="memory-reference-detail"><summary>Quelle, Umfang und Prüfbedingungen</summary><p>E-Memory_DE_PNG.pdf, Seite 14 · EIT.swiss, 1. Auflage ©2025. Normsystem: IEC / SN EN 60529. Die vorliegende Referenz erfasst erste Kennziffer 0–6 und Wasserkennziffer 0–8, jeweils auch X. Andere Kennzeichnungen werden hier nicht still auf eine dieser Stufen reduziert.</p><p>Die Tabellen sind Kurzbeschreibungen. Für Nachweise gelten die vollständige passende Normausgabe, Prüfsonden, Prüfbedingungen und Produktangaben. Die Vorlage enthält auch separat gekennzeichnete ältere Normbezüge.</p></details>
    </ReferenceDrawer>}
  </section>;
}

export function SocketFront({ socket }: { socket: SwissSocket }) {
  return <svg viewBox="0 0 100 100" className="memory-socket-front" role="img" aria-label={`Steckdose Typ ${socket.type}: ${socket.contacts} ${socket.contactShape === "round" ? "runde" : "rechteckige"} Kontakte, ${socket.current} A`} data-socket-type={socket.type}>
    <rect className="memory-socket-plate" x="3" y="3" width="94" height="94" rx="13" />
    {socket.recess === "round" ? <circle className="memory-socket-recess" cx="50" cy="54" r="35" /> : <path className="memory-socket-recess" d="M23 29H77L88 41V67L77 79H23L12 67V41Z" />}
    {socketContactPoints(socket).map(([x, y], index) => socket.contactShape === "round" ? <circle className="memory-socket-contact" data-contact="round" cx={x} cy={y} r="3.8" key={index} /> : <rect className="memory-socket-contact" data-contact="rectangle" x={x - 3.3} y={y - 4} width="6.6" height="8" rx=".6" key={index} />)}
  </svg>;
}

export function SwissSocketGuide() {
  const [selected, setSelected] = useState<(typeof SWISS_SOCKETS)[number]["type"]>(13);
  const [info, setInfo] = useState(false);
  const socket = SWISS_SOCKETS.find(value => value.type === selected)!;
  return <section className="memory-reference-tool" aria-label="Schweizer Steckdosen erkennen">
    <header><div><Plug size={20} aria-hidden="true" /><h3>Steckdosen erkennen</h3></div><InfoButton label="Steckdosentypen erklären" onClick={() => setInfo(true)} /></header>
    <div className="memory-socket-grid" role="group" aria-label="Steckdosentyp wählen">{SWISS_SOCKETS.map(value => <button type="button" key={value.type} aria-pressed={selected === value.type} onClick={() => setSelected(value.type)}><SocketFront socket={value} /><strong>Typ {value.type}</strong><span>{value.current} A · {value.contacts} Kontakte</span></button>)}</div>
    <div className="memory-socket-result" aria-live="polite"><strong>Typ {socket.type}</strong><span>{socket.conductors} · {socket.current} A / {socket.voltage}</span><span>{socket.contactShape === "round" ? "Runde Kontaktöffnungen" : "Rechteckige Kontaktprofile"}</span></div>
    <p className="memory-small">Gleiche Vorderansicht · schematische Kontaktbilder, keine Masszeichnungen. Mechanische Steckbarkeit und Einbaubedingungen separat prüfen.</p>
    {info && <ReferenceDrawer title="Schweizer Steckdosentypen" onClose={() => setInfo(false)}><p>Die Kontaktbilder unterscheiden die vier gezeigten Steckdosentypen. Sie zeigen keine genormten Abmessungen und sind keine Auswahlfreigabe.</p><div className="memory-table-wrap"><table><thead><tr><th>Typ</th><th>Kontakte</th><th>Bemessung</th></tr></thead><tbody>{SWISS_SOCKETS.map(value => <tr key={value.type}><th scope="row">{value.type}</th><td>{value.conductors}</td><td>{value.current} A / {value.voltage}</td></tr>)}</tbody></table></div><p>10-A-Ausführungen haben runde Kontaktöffnungen, 16-A-Ausführungen rechteckige Kontaktprofile. Die Normabmessungen und das Kontaktbild bestimmen gemeinsam die mechanische Steckbarkeit. Diese Übersicht ersetzt keine vollständige Kompatibilitätsmatrix.</p><details className="memory-reference-detail"><summary>Quelle und Stand</summary><p>E-Memory_DE_PNG.pdf, Seite 15: ESTI-Übersicht «CH-Stecker-System SN 441011 IP20». Der Quellenfuss nennt SN 441011-1_2019 und den Dokumentstand 28.09.2025. IP20-Darstellungen nicht auf IP55- oder Feuchtraumausführungen übertragen.</p></details></ReferenceDrawer>}
  </section>;
}

const BATH_CASES = ["Wanne", "Dusche mit Tasse", "Dusche ohne Tasse"] as const;
export function BathReference() {
  const [kind, setKind] = useState<(typeof BATH_CASES)[number]>("Wanne");
  const [partition, setPartition] = useState(false);
  const [info, setInfo] = useState(false);
  return <section className="memory-reference-tool memory-bath-reference" aria-label="Bad und Dusche: Geometrie und Quelle">
    <header><div><Bath size={20} aria-hidden="true" /><h3>Den passenden Raumfall wählen</h3></div><InfoButton label="Badbereiche und Quellenstand erklären" onClick={() => setInfo(true)} /></header>
    <div className="memory-reference-tabs" role="group" aria-label="Raumfall">{BATH_CASES.map(value => <button type="button" key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{value}</button>)}</div>
    <figure className="memory-bath-figure"><svg viewBox="0 0 540 270" role="img" aria-label={`${kind}${partition ? " mit fester Abtrennung" : ""}, neutrale Raumskizze ohne normativ bestätigte Bereichsgrenzen`}>
      <path className="memory-room-wall" d="M35 30H505V235H35Z" />
      {kind === "Wanne" ? <g><rect className="memory-bath-outline" x="80" y="88" width="230" height="112" rx="30" /><rect className="memory-bath-inner" x="92" y="100" width="206" height="88" rx="22" /></g> : kind === "Dusche mit Tasse" ? <g><rect className="memory-bath-outline" x="80" y="75" width="150" height="130" rx="7" /><rect className="memory-bath-inner" x="90" y="85" width="130" height="110" rx="4" /><circle className="memory-drain" cx="154" cy="151" r="6" /></g> : <g><path className="memory-shower-floor" d="M80 185L230 75M98 205L250 93M80 146L177 75M137 205L250 132M80 107L119 75M194 205L250 171" /><circle className="memory-drain" cx="154" cy="151" r="6" /></g>}
      <path className="memory-water-outlet" d="M105 30V63H135V77" /><circle className="memory-drain" cx="135" cy="77" r="4" />
      {partition && <path className="memory-room-partition" d="M335 30V175" />}
      <text x="165" y="59">Wasserauslass</text><path className="memory-drawing-leader" d="M157 56H140L135 71" />
      <text x="350" y="210">Raumgeometrie</text>
    </svg><figcaption>Neutrale Raumskizze. Bereichsgrenzen sind hier bewusst nicht eingezeichnet.</figcaption></figure>
    <label className="memory-partition-choice"><input type="checkbox" checked={partition} onChange={event => setPartition(event.target.checked)} />Feste Abtrennung anzeigen</label>
    <div className="memory-reference-callout"><strong>Zonengeometrie: Normabgleich offen.</strong> Die genaue Kontur, offene Seiten, Höhen und das Fadenmass müssen anhand des gewählten Raumfalls und der zutreffenden NIN-Ausgabe geprüft werden.</div>
    <p className="memory-small">Die folgenden Einträge enthalten die vorhandene Quellenreferenz zu Bereichen, Wasserschutz und Betriebsmitteln.</p>
    {info && <ReferenceDrawer title="Bad und Dusche: Quelle und Grenzen" onClose={() => setInfo(false)}><p>E-Memory_DE_PNG.pdf, Seite 12 · Bereiche nach dem dort genannten Bezug NIN 7.01.3. Die Skizze hilft, Wanne, Duschfläche, Wasserauslass und feste Abtrennungen zu unterscheiden.</p><p>Sie enthält keine farbigen Bereichsflächen, weil ihre genaue Geometrie für die passende Normausgabe noch nicht abschliessend abgeglichen wurde. Dadurch wird auch keine Gerätefreigabe aus einer schematischen Farbfläche abgeleitet.</p><details className="memory-reference-detail" open><summary>Was am tatsächlichen Raum zu prüfen ist</summary><ul><li>Wanne oder Dusche, mit beziehungsweise ohne Tasse</li><li>Lage und Höhe des festen Wasserauslasses</li><li>Kontur, offene Seiten und feste Abtrennungen</li><li>Grundriss, Schnitt und gegebenenfalls Fadenmass</li><li>Schutzart, Spannung, Anschluss und Einbaubedingungen des konkreten Betriebsmittels</li></ul></details><p>Die Quellenwerte und ihre Einschränkungen sind in den aufklappbaren Einträgen hinterlegt. Normausgabe und vollständigen Anwendungsfall vor einer Installationsentscheidung prüfen.</p></ReferenceDrawer>}
  </section>;
}

export function MemoryReferenceShortcuts({ onOpenTopic }: { onOpenTopic: (id: string) => void }) {
  return <div className="memory-reference-shortcuts" aria-label="Grafisch nachschlagen">
    <button type="button" onClick={() => onOpenTopic("em-swiss-connectors")}><span className="memory-shortcut-sockets">{SWISS_SOCKETS.map(socket => <SocketFront key={socket.type} socket={socket} />)}</span><span><strong>Steckdosen erkennen</strong><small>T13 · T23 · T15 · T25</small></span><ArrowUpRight size={17} aria-hidden="true" /></button>
    <button type="button" onClick={() => onOpenTopic("em-ip-symbols")}><span className="memory-shortcut-ip" aria-hidden="true">IP<span>44</span></span><span><strong>IP-Decoder</strong><small>Kennziffern und Prüfbedingungen</small></span><ArrowUpRight size={17} aria-hidden="true" /></button>
    <button type="button" onClick={() => onOpenTopic("em-bathroom")}><Bath size={29} aria-hidden="true" /><span><strong>Bad und Dusche</strong><small>Raumfälle und Quellenreferenz</small></span><ArrowUpRight size={17} aria-hidden="true" /></button>
  </div>;
}
