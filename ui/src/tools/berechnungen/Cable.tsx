import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Cable as CableIcon, CheckCircle2 } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import { useProjectHub } from "../projektzentrale/projectHub";
import { downloadBlob } from "../planlieferung/DeliveryHistory";
import { calculateCable, CABLE_SOURCE, NIN_SOURCE, RESISTANCE_20, type CableInput } from "./engineering";
import { InfoButton, LabShell, Parameter, Segments, type Help } from "./LabUI";
import CableCanvas from "./CableCanvas";
import { consumeRestore } from "./ablage/api";

const DEFAULT: CableInput = { phases: "1", material: "cu", length: "25", current: "16", area: "2.5", cosPhi: "1", voltage: "230", limit: "4" };
const format = (value: number, digits = 2) => value.toLocaleString("de-CH", { maximumFractionDigits: digits, minimumFractionDigits: digits });
export default function Cable(props: ToolProps) {
  const { hub, active, error: projectError } = useProjectHub();
  const [input, setInput] = useState<CableInput>(DEFAULT), [ready, setReady] = useState(false), [errorStorage, setErrorStorage] = useState("");
  const [project, setProject] = useState<{ id: string; number: string; name: string } | null>(null), [help, setHelp] = useState<Help | null>(null);
  const loaded = useRef(false), key = `edeco.cable.ch.v1.${project?.id || project?.number || "unassigned"}`;
  useEffect(() => {
    if (!hub || loaded.current) return;
    loaded.current = true;
    const restored = consumeRestore("kabelberechnung");
    const p = restored?.project ?? (active ? { id: active.id, number: active.number, name: active.name } : null); setProject(p);
    try { const saved = restored?.document.input ?? JSON.parse(localStorage.getItem(`edeco.cable.ch.v1.${p?.id || p?.number || "unassigned"}`) || "null");
      if (saved && Object.keys(DEFAULT).every(k => typeof saved[k] === "string") && ["cu", "al"].includes(saved.material) && ["1", "3"].includes(saved.phases)) setInput(saved);
    } catch { setErrorStorage("Entwurf konnte nicht geladen werden."); }
    setReady(true);
  }, [hub, active]);
  useEffect(() => { if (!ready) return; try { localStorage.setItem(key, JSON.stringify(input)); setErrorStorage(""); } catch { setErrorStorage("Entwurf nicht gespeichert. Ergebnis als JSON sichern."); } }, [input, key, ready]);
  const { result, error } = useMemo(() => { try { return { result: calculateCable(input), error: "" }; } catch (e) { return { result: null, error: (e as Error).message }; } }, [input]);
  function edit<K extends keyof CableInput>(name: K, value: CableInput[K]) { setInput(old => ({ ...old, [name]: value })); }
  const foundation: ReactNode = <>
    <p>Schweizer Vorprüfung auf Basis des veröffentlichten <a href={CABLE_SOURCE} target="_blank" rel="noreferrer">Spannungsfall-Rechners von elektro-rechner.ch</a>. Schweizer Normenrahmen: <a href={NIN_SOURCE} target="_blank" rel="noreferrer">Electrosuisse · NIN 2025 / SN 411000:2025</a>. Abruf: 01.11.2026.</p>
    <code>R′₅₅ = R′₂₀ × [1 + α × (55 − 20)]<br/>ΔU₁~ = 2 × L × I × (R′₅₅ × cos φ + X′ × sin φ) / 1000<br/>ΔU₃~ = √3 × L × I × (R′₅₅ × cos φ + X′ × sin φ) / 1000<br/>ΔU% = ΔU / Uₙ × 100</code>
    <p>R′ und X′ in Ω/km, L als einfache Leitungslänge in m. R′₂₀: veröffentlichte Leiterwiderstände mit Bezug auf SN EN 60228; 55 °C gemäss Schweizer Referenz mit Bezug auf NIN 6.1.3 Figur 3. α: Cu 0.00393/K, Al 0.00403/K. X′ ist ausdrücklich ein Richtwert der Schweizer Referenz, kein NIN-Normwert.</p>
    {result && <p>Aktuell: R′₂₀ = {format(result.r20, 4)} Ω/km, R′₅₅ = {format(result.r55, 4)} Ω/km, X′ = {format(result.x, 3)} Ω/km. ΔU = {format(result.deltaU, 4)} V = {format(result.percent, 4)} %.</p>}
    <p>Das voreingestellte Budget von 4 % orientiert sich an der Schweizer Referenz zu NIN 5.2.5.1. Es betrifft die Summe aller relevanten Leitungsabschnitte; dieser Rechner betrachtet einen Abschnitt. Das Budget ist einstellbar und muss zum Projekt passen.</p>
    <p>Die Querschnittsempfehlung prüft ausschliesslich dieses Spannungsfallmodell. Strombelastbarkeit, Verlegeart, Häufung, Schutzorgan, Abschaltbedingungen, Kurzschlussfestigkeit und besondere Lasten sind nicht nachgewiesen. Symmetrische Drehstromlast und induktiver Leistungsfaktor werden vorausgesetzt. Keine vollständige Kabeldimensionierung oder fachliche Freigabe.</p>
    <p>Der vollständige NIN-Normtext ist nicht eingebettet. Keine deutschen VDE/DIN-Grenzwerte und keine fremden Regelwerk-Voreinstellungen. Aluminium wird wegen der verwendeten Tabelle erst ab 10 mm² gerechnet.</p>
  </>;
  function info(title: string, detail?: ReactNode) { setHelp({ title, content: <>{detail}{foundation}</> }); }
  return <LabShell {...props} title="Kabel · Spannungsfall" subtitle={project ? `${project.number} · ${project.name}` : "Schweiz · NIN-orientierte Vorprüfung"} help={help} setHelp={setHelp} canExport={Boolean(result && ready)} archive={{ toolId: "kabelberechnung", project, document: { schema: "edeco.cable.ch.v1", input, result, sources: [CABLE_SOURCE, NIN_SOURCE], assumptions: { temperature: 55, reactance: "Richtwert, kein NIN-Normwert", scope: "Nur Spannungsfall" } } }} report={<><h2>Schweizer Berechnungsgrundlagen</h2>{foundation}</>}
    exportData={() => downloadBlob(new Blob([JSON.stringify({ schema: "edeco.cable.ch.v1", project, input, result, sources: [CABLE_SOURCE, NIN_SOURCE], assumptions: { temperature: 55, reactance: "Richtwerte, keine NIN-Normwerte", scope: "Nur Spannungsfall eines Abschnitts, keine Strombelastbarkeitsprüfung" }, review: "fachliche Freigabe offen", generated_at: new Date().toISOString() }, null, 2)], { type: "application/json" }), "Spannungsfall-CH.json")}>
    <div className="lab-bento"><section className="lab-visual calc-panel" aria-label="Leitungsmodell und Ergebnis"><div className="lab-visual-heading"><span className="edeco:flex edeco:items-center edeco:gap-2"><CableIcon size={16} /> Leitung · Spannungsverlauf</span><span className="lab-live">LIVE</span><InfoButton title="Spannungsfall und Grundlagen" onClick={() => info("Spannungsfall · Schweiz")} /></div>
      <CableCanvas result={result} material={input.material} />
      <div className="lab-values"><div className="lab-value"><small>Spannungsfall</small><strong data-testid="voltage-drop-result">{result ? `${format(result.deltaU)} V` : "–"}</strong><span>{result ? `${format(result.percent)} % von ${result.voltage} V` : "Eingaben prüfen"}</span></div><div className="lab-value"><small>Am Verbraucher</small><strong>{result ? `${format(result.endVoltage, 1)} V` : "–"}</strong><span>rechnerisch</span></div><div className="lab-value"><small>Querschnitt aus ΔU</small><strong data-testid="recommended-area">{result ? result.recommendedArea ? `${result.recommendedArea} mm²` : "> 240 mm²" : "–"}</strong><span>nur Spannungsfall</span></div></div>
      <dl className="lab-detail-values" aria-label="Kabel-Ergebnisdetails">
        <div><dt>Spannungsfall / Budget</dt><dd data-testid="cable-budget-detail">{result ? `${format(result.percent)} % / ${result.limit} %` : "–"}</dd></div>
        <div><dt>Max. Länge aus diesem Budget</dt><dd data-testid="cable-max-length">{result ? `${format(result.maxLength, 1)} m` : "–"}</dd></div>
        <div><dt>Leiterwiderstand R′ bei 55 °C</dt><dd>{result ? `${format(result.r55, 3)} Ω/km` : "–"}</dd></div>
      </dl>
      <div className="lab-status-stack">{result && <div className={`lab-short-status ${result.withinBudget ? "lab-status-ok" : "lab-status-error"}`}>{result.withinBudget ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{result.withinBudget ? "Spannungsfall innerhalb des gewählten Budgets." : "Spannungsfall überschreitet das gewählte Budget."}</div>}
        <div className="lab-short-status lab-status-neutral"><AlertTriangle size={16} />Strombelastbarkeit und Schutzmassnahmen bleiben ungeprüft.</div></div>
      <div className="lab-visual-footer lab-tags"><span className="lab-tag">CH · 55 °C</span><span className="lab-tag">X′ Richtwert</span><span className="lab-tag">ein Abschnitt</span><span className="lab-tag">gestrichelt: Budget {input.limit} %</span></div>
    </section><section className="lab-controls" aria-label="Kabeleingaben"><div className="lab-control-heading"><h2>Parameter</h2><InfoButton title="Schweizer Kabelmodell" onClick={() => info("NIN-orientiertes Modell")} /></div>
      <div className="edeco:flex edeco:items-center edeco:justify-between"><span className="lab-label">Netzart</span><InfoButton title="Netzart" onClick={() => info("Netzart", <p>Einphasig: Hin- und Rückleiter mit Faktor 2. Drehstrom: symmetrische Last, Faktor √3; Bemessungsspannung zwischen den Aussenleitern.</p>)} /></div>
      <Segments disabled={!ready} label="Netzart" value={input.phases} options={[{ value: "1", label: "1~ · 230 V" }, { value: "3", label: "3~ · 400 V" }]} onChange={value => setInput(old => ({ ...old, phases: value, voltage: value === "1" ? "230" : "400" }))} />
      <div className="edeco:flex edeco:items-center edeco:justify-between"><span className="lab-label">Leitermaterial</span><InfoButton title="Leitermaterial" onClick={() => info("Cu / Al", <p>Materialabhängige Widerstandstabellen und Temperaturkoeffizienten. Für Al sind nur die veröffentlichten Werte ab 10 mm² hinterlegt.</p>)} /></div>
      <Segments disabled={!ready} label="Leitermaterial" value={input.material} options={[{ value: "cu", label: "Kupfer" }, { value: "al", label: "Aluminium" }]} onChange={value => setInput(old => ({ ...old, material: value, area: Object.hasOwn(RESISTANCE_20[value], old.area) ? old.area : "10" }))} />
      <Parameter label="Leitungslänge L (m)" unit="m" value={input.length} min={1} max={300} step={1} disabled={!ready} onChange={value => edit("length", value)} info={() => info("Leitungslänge L", <p>Die einfache Leitungslänge; der Faktor für Hin-/Rückleiter wird bereits in der Formel berücksichtigt.</p>)} />
      <Parameter label="Laststrom I (A)" unit="A" value={input.current} min={1} max={250} step={1} disabled={!ready} onChange={value => edit("current", value)} info={() => info("Laststrom I", <p>Betriebsstrom dieses Abschnitts. Kein Nachweis einer zulässigen Strombelastbarkeit.</p>)} />
      <div className="edeco:flex edeco:items-center edeco:justify-between"><label className="lab-label" htmlFor="cable-area">Leiterquerschnitt</label><InfoButton title="Leiterquerschnitt" onClick={() => info("Leiterquerschnitt", <p>Standardquerschnitte mit belegten Widerstandswerten. Die Empfehlung sucht den kleinsten tabellierten Querschnitt, der das gewählte Spannungsfallbudget erfüllt.</p>)} /></div>
      <select id="cable-area" aria-label="Leiterquerschnitt" className="lab-select" disabled={!ready} value={input.area} onChange={event => edit("area", event.target.value)}>{Object.keys(RESISTANCE_20[input.material]).sort((a,b) => Number(a)-Number(b)).map(area => <option key={area} value={area}>{area} mm²</option>)}</select>
      <Parameter label="Leistungsfaktor cos φ" value={input.cosPhi} min={.1} max={1} step={.01} disabled={!ready} onChange={value => edit("cosPhi", value)} info={() => info("Leistungsfaktor", <p>Induktive Last: sin φ = √(1 − cos² φ). R′·cos φ und X′·sin φ werden beide berücksichtigt.</p>)} />
      <Parameter label="Bemessungsspannung Uₙ (V)" unit="V" value={input.voltage} min={24} max={690} step={1} disabled={!ready} onChange={value => edit("voltage", value)} info={() => info("Bemessungsspannung", <p>230 V einphasig bzw. 400 V zwischen den Aussenleitern bei Drehstrom als Voreinstellung.</p>)} />
      <Parameter label="Spannungsfall-Budget (%)" unit="%" value={input.limit} min={.5} max={10} step={.1} disabled={!ready} onChange={value => edit("limit", value)} info={() => info("Verfügbares Budget", <p>Schweizer Voreinstellung 4 %. Bereits verbrauchte Spannungsfallanteile vorgeschalteter Leitungen müssen im Projekt berücksichtigt werden.</p>)} />
      {error && <p className="lab-error" role="alert">{error}</p>}{(errorStorage || projectError) && <p className="lab-error" role="alert">{errorStorage || projectError}</p>}
    </section></div>
  </LabShell>;
}
