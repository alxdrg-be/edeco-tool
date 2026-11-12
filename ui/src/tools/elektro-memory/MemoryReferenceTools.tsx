import { useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Info, Plug, ShieldCheck, X } from "lucide-react";
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
