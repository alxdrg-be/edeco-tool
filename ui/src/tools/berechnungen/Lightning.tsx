import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Zap } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import { useProjectHub } from "../projektzentrale/projectHubState";
import { downloadBlob } from "../planlieferung/DeliveryHistory";
import { calculateLightning, FACTORS, SOURCE, type LightningInput, type LightningClass } from "./lightning-model";
import { InfoButton, LabShell, Parameter, type Help } from "./LabUI";
import BuildingCanvas from "./BuildingCanvas";
import { consumeRestore } from "./ablage/api";

const DEFAULT: LightningInput = { protection: "III", perimeter: "60", length: "10", conductors: "4", clearance: "" };
const number = (value: number, decimals = 2) => value.toLocaleString("de-CH", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

export default function Lightning(props: ToolProps) {
  const { hub, active, error: projectError, refresh } = useProjectHub();
  const [input, setInput] = useState<LightningInput>(DEFAULT), [note, setNote] = useState("");
  const [project, setProject] = useState<{ id: string; number: string; name: string } | null>(null);
  const [storageError, setStorageError] = useState(""), [ready, setReady] = useState(false), [help, setHelp] = useState<Help | null>(null);
  const loaded = useRef(false), storageKey = project ? `edeco.lightning.v1.${project.id || project.number}` : "edeco.lightning.v1.unassigned";
  useEffect(() => {
    if (!hub || loaded.current) return;
    loaded.current = true;
    const restored = consumeRestore("blitzschutz");
    const selected = restored?.project ?? (active ? { id: active.id, number: active.number, name: active.name } : null);
    setProject(selected);
    try {
      const saved = restored ? { input: restored.document.input, note: restored.notes } : JSON.parse(localStorage.getItem(selected ? `edeco.lightning.v1.${selected.id || selected.number}` : "edeco.lightning.v1.unassigned") || "null");
      if (saved?.input && Object.keys(DEFAULT).every(key => typeof saved.input[key] === "string") && Object.hasOwn(FACTORS, saved.input.protection)) { setInput(saved.input); if (typeof saved.note === "string") setNote(saved.note); }
    } catch { setStorageError("Entwurf konnte nicht geladen werden."); }
    setReady(true);
  }, [hub, active]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ input, note })); setStorageError(""); }
    catch { setStorageError("Entwurf konnte nicht gespeichert werden. JSON sichern."); }
  }, [input, note, storageKey, ready]);
  const { result, error } = useMemo(() => { try { return { result: calculateLightning(input), error: "" }; } catch (e) { return { result: null, error: (e as Error).message }; } }, [input]);
  function edit(key: keyof LightningInput, value: string) { setInput(old => ({ ...old, [key]: value })); }
  const foundation: ReactNode = <>
    <p>Schweizer Rechenhilfe nach dem veröffentlichten Verfahren von <a href={SOURCE} target="_blank" rel="noreferrer">Arthur Flury</a>: Bezug auf SN 414022:2024, Seite 38, Tabelle 8. Abruf: 01.11.2026.</p>
    <code>s = k × (n₀ / n) × A<br/>n₀ = U / xₙ<br/>n_min = max(2, ceil(U / xₙ))</code>
    <table><thead><tr><th>Klasse</th><th>k</th><th>xₙ</th></tr></thead><tbody>{(["I", "II", "III"] as const).map(value => <tr key={value}><td>{value}</td><td>{FACTORS[value].hundredths / 100}</td><td>{FACTORS[value].spacing} m</td></tr>)}</tbody></table>
    {result && <p>Rechenweg: {result.k} × ({number(result.n0, 6)} / {input.conductors}) × {input.length} m = {number(result.rawMetres, 6)} m → <strong>{number(result.metres)} m</strong>. n₀ bleibt im Abstandsterm ungerundet; s wird auf ganze Zentimeter aufgerundet.</p>}
    <p>Nur das veröffentlichte Schweizer Verfahren, Klassen I–III. Der vollständige Normtext ist nicht eingebettet. Numerischer Referenzvergleich ersetzt keine fachliche Freigabe.</p>
    <p>A verläuft entlang der Fang-/Ableitung bis zum nächsten Potenzialausgleich, nicht automatisch entlang der Gebäudehöhe. Metalldach-Ausnahmen werden nicht automatisch abgezogen. Leitungsführung, Potenzialausgleich und Anwendbarkeit bleiben fachlich am Objekt zu prüfen.</p>
    <p>Die farbige Zone zeigt ausschliesslich den erforderlichen Abstand am Prüfpunkt. Sie ist kein Fangschutzvolumen. Dachhöhe und Bauteile sind schematisch, die Dachbewegung illustriert einen vereinfachten vertikalen Leitungsweg.</p>
  </>;
  function info(title: string, content?: ReactNode) { setHelp({ title, content: <>{content}{foundation}</> }); }
  const status = result?.clearanceOK;
  return <LabShell {...props} title="Blitzschutz · Trennungsabstand" subtitle={project ? `${project.number} · ${project.name}` : "Schweiz · SN 414022:2024"} help={help} setHelp={setHelp} canExport={Boolean(result && ready)} archive={{ toolId: "blitzschutz", project, notes: note, document: { schema: "edeco.lightning.v1", input, result, note, source: SOURCE, basis: "SN 414022:2024, veröffentlichtes Schweizer Verfahren" } }} report={<><h2>Schweizer Berechnungsgrundlagen</h2>{foundation}<p>Bemerkung: {note}</p></>}
    exportData={() => downloadBlob(new Blob([JSON.stringify({ schema: "edeco.lightning.v1", project, input, result, note, source: SOURCE, basis: "SN 414022:2024, S. 38, veröffentlichtes Schweizer Verfahren", review: "fachliche Freigabe offen", generated_at: new Date().toISOString() }, null, 2)], { type: "application/json" }), "Trennungsabstand.json")}>
    <div className="lab-bento"><section className="lab-visual calc-panel" aria-label="Visualisierung und Ergebnis"><div className="lab-visual-heading"><span className="edeco:flex edeco:items-center edeco:gap-2"><Zap size={16} /> Gebäude · Prüfpunkt</span><span className="lab-live">LIVE</span><InfoButton title="Abstandszone und Rechenweg" onClick={() => info("Abstandszone & Grundlagen")} /></div>
      <p className="lab-reading-guide">Die Zone zeigt den erforderlichen Trennungsabstand am markierten Prüfpunkt. Verschiebe das Dachobjekt für den Abstandsvergleich; der Leitungsweg A ist nicht automatisch die Gebäudehöhe.</p>
      <BuildingCanvas length={input.length} clearance={input.clearance} result={result} onDistance={value => edit("clearance", value)} />
      <div className="lab-values"><div className="lab-value"><small>Trennungsabstand s</small>{result ? <strong data-testid="separation-result">{number(result.metres)} m</strong> : <strong>–</strong>}<span>auf ganze cm aufgerundet</span></div><div className="lab-value"><small>Ableiter · Minimum</small><strong>{result?.minimum ?? "–"}</strong><span>vorhanden: {input.conductors || "–"}</span></div><div className="lab-value"><small>Vorhandener Abstand d</small><strong>{result?.availableMetres !== null && result?.availableMetres !== undefined ? `${number(result.availableMetres)} m` : "offen"}</strong><span>Dachobjekt ist verschiebbar</span></div></div>
      <div className="lab-status-stack">{result && <><div className={`lab-short-status ${result.conductorOK ? "lab-status-ok" : "lab-status-error"}`}>{result.conductorOK ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{result.conductorOK ? "Ableiteranzahl erfüllt das rechnerische Minimum." : `Ableiteranzahl unterschritten: mindestens ${result.minimum} erforderlich.`}</div><div className={`lab-short-status ${status === null ? "lab-status-neutral" : status ? "lab-status-ok" : "lab-status-error"}`}>{status === null ? <CircleDashed size={16} /> : status ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{status === null ? "Abstand noch nicht angegeben." : status ? "Vorhandener Abstand erfüllt den berechneten Wert." : "Vorhandener Abstand unterschreitet das erforderliche s."}</div></>}</div>
      <div className="lab-visual-footer lab-tags"><span className="lab-tag">CH · Klassen I–III</span><span className="lab-tag">A ≠ Gebäudehöhe</span><span className="lab-tag">Vorprüfung</span></div>
    </section><section className="lab-controls" aria-label="Blitzschutzeingaben"><div className="lab-control-heading"><h2>Parameter</h2><InfoButton title="Schweizer Berechnungsverfahren" onClick={() => info("SN 414022:2024")} /></div>
      <div className="edeco:flex edeco:items-center edeco:justify-between"><label className="lab-label" htmlFor="lightning-class">Blitzschutzklasse</label><InfoButton title="Blitzschutzklasse" onClick={() => info("Blitzschutzklasse", <p>Die Klasse bestimmt k und xₙ. Sie wird durch das erforderliche Blitzschutzkonzept vorgegeben und nicht aus diesem Rechner abgeleitet.</p>)} /></div>
      <select id="lightning-class" className="lab-select" aria-label="Blitzschutzklasse" disabled={!ready} value={input.protection} onChange={event => edit("protection", event.target.value as LightningClass)}>{(["I", "II", "III"] as const).map(value => <option key={value} value={value}>Klasse {value} · k {FACTORS[value].hundredths/100}</option>)}</select>
      <Parameter label="Gebäudeumfang U (m)" unit="m" value={input.perimeter} min={10} max={300} step={1} disabled={!ready} onChange={value => edit("perimeter", value)} info={() => info("Gebäudeumfang U", <p>Umfang des zu betrachtenden Gebäudes in Metern. n₀ ergibt sich aus U/xₙ; die gesonderte Mindestanzahl wird auf ganze Ableiter aufgerundet.</p>)} />
      <Parameter label="Vorhandene Ableiter n" unit="Stk." value={input.conductors} min={2} max={24} step={1} disabled={!ready} onChange={value => edit("conductors", value)} info={() => info("Anzahl Ableiter", <p>Ganze Zahl, mindestens zwei. Der Rechner prüft zusätzlich die Mindestanzahl aus dem Schweizer Verfahren. Die Anzahl allein ist keine Prüfung der Ausführung.</p>)} />
      <Parameter label="Leitungsweg A (m)" unit="m" value={input.length} min={1} max={60} step={.1} disabled={!ready} onChange={value => edit("length", value)} info={() => info("Leitungsweg A", <p>Weg entlang der Leitung vom Prüfpunkt bis zum nächstliegenden Potenzialausgleich. Die Dachbewegung ist eine illustrative vertikale Darstellung, keine Ermittlung der Gebäudehöhe.</p>)} />
      <Parameter label="Vorhandener Abstand (m, optional)" unit="m" value={input.clearance} min={0} max={3} step={.01} disabled={!ready} onChange={value => edit("clearance", value)} info={() => info("Vorhandener Abstand", <p>Kleinster tatsächlich vorhandener Abstand zum leitfähigen Bauteil am Prüfpunkt. Vergleich mit dem aufgerundeten s. Leer bedeutet ungeprüft.</p>)} />
      <label className="lab-label" htmlFor="lightning-note">Notiz</label><textarea id="lightning-note" aria-label="Berechnungsbemerkung" disabled={!ready} value={note} maxLength={2000} rows={2} onChange={event => setNote(event.target.value)} />
      {error && <p className="lab-error" role="alert">{error}</p>}{storageError && <p className="lab-error" role="alert">{storageError}</p>}{projectError && <p role="alert" className="lab-error">Projekt nicht erreichbar. <button onClick={() => void refresh().catch(() => undefined)}>Erneut laden</button></p>}
    </section></div>
  </LabShell>;
}
