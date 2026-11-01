import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, PlugZap } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import { useProjectHub } from "../projektzentrale/projectHub";
import { downloadBlob } from "../planlieferung/DeliveryHistory";
import { InfoButton, LabShell, Parameter, Segments, type Help } from "./LabUI";
import { consumeRestore, type ArchiveProject } from "./ablage/api";
import { calculateEV, EV_SOURCE, type EVInput } from "./ev";
import EVSchema from "./EVSchema";
import { EVDetails, EVPowerFlow } from "./EVPowerFlow";
const DEFAULT: EVInput = { house: "160", grid: "125", reserve: "30", count: "10", power: "11", mode: "dynamic", diversity: "1" };
export default function EV(props: ToolProps) {
  const { hub, active } = useProjectHub();
  const [input, setInput] = useState<EVInput>(DEFAULT), [project, setProject] = useState<ArchiveProject | null>(null), [ready, setReady] = useState(false), [help, setHelp] = useState<Help | null>(null);
  const [note, setNote] = useState(""), [storageError, setStorageError] = useState("");
  const loaded = useRef(false), key = `edeco.ev.ac.v1.${project?.id || project?.number || "unassigned"}`;
  useEffect(() => {
    if (!hub || loaded.current) return; loaded.current = true;
    const restore = consumeRestore("emobilitaet"), p = restore?.project ?? (active ? { id: active.id, number: active.number, name: active.name } : null);
    setProject(p);
    try {
      const local = restore ? null : JSON.parse(localStorage.getItem(`edeco.ev.ac.v1.${p?.id || p?.number || "unassigned"}`) || "null");
      const saved = restore?.document.input ?? local?.input;
      if (saved && Object.keys(DEFAULT).every(k => typeof (saved as Record<string, unknown>)[k] === "string")) setInput(saved as EVInput);
      if (restore) setNote(restore.notes); else if (typeof local?.note === "string") setNote(local.note);
    } catch { setStorageError("Entwurf konnte nicht geladen werden."); }
    setReady(true);
  }, [hub, active]);
  useEffect(() => { if (!ready) return; try { localStorage.setItem(key, JSON.stringify({ input, note })); setStorageError(""); } catch { setStorageError("Entwurf nicht gespeichert."); } }, [input, note, key, ready]);
  const { result, error } = useMemo(() => { try { return { result: calculateEV(input), error: "" }; } catch (e) { return { result: null, error: (e as Error).message }; } }, [input]);
  const foundation = <><p>Eigene AC-Leistungs-Vorplanung mit Bezug auf die öffentlich beschriebene <a href={EV_SOURCE} target="_blank" rel="noreferrer">Schweizer E-Mobility-Referenz</a>.</p><code>P₃~ = √3 × 400 V × I / 1000<br/>P_verfügbar = max(0, min(P_Grid, P_Haus − Reserve))<br/>P_installiert = Anzahl × P_Ladepunkt</code><p>Vereinfachte ausgeglichene dreiphasige AC-Betrachtung bei 400 V und cos φ = 1. Ohne Lastmanagement wird Faktor 1 verwendet. Bei statischem Lastmanagement ist der Faktor eine manuell dokumentierte Planungsannahme; es werden keine SIA-2060-Faktoren automatisch bestimmt. Dynamische Zuteilung wird als rechnerische Gleichverteilung des verfügbaren Budgets dargestellt.</p><p>Netzbetreiberfreigabe, Phasenunsymmetrie, Mindestladestrom, reales Regelungsverhalten, Kabeldimensionierung, Abschaltbedingungen und Schutztechnik werden nicht nachgewiesen. SIA 2060 und NIN 7.22 sind am Projekt zu prüfen. PV und Speicher sind in dieser ersten Vorplanung nicht eingerechnet.</p>{result && <p>Aktuell: {result.houseKW.toFixed(2)} kW Hausanschluss, {result.available.toFixed(2)} kW für Laden verfügbar, {result.installed.toFixed(2)} kW installiert. Rechenwert je Ladepunkt: {result.perPoint.toFixed(2)} kW.</p>}</>;
  const document = { schema: "edeco.ev.ac.v1", project, input, result, note, source: EV_SOURCE, review: "Vorplanung, fachliche Freigabe offen" };
  function edit(key: keyof EVInput, value: string) { setInput(old => ({ ...old, [key]: value })); }
  return <LabShell {...props} title="E-Mobilität · AC-Vorplanung" subtitle={project ? `${project.number} · ${project.name}` : "Schweizer Planungskontext · eigene Leistungs-Vorprüfung"} help={help} setHelp={setHelp} canExport={Boolean(ready && result)} archive={{ toolId: "emobilitaet", project, notes: note, document }} report={foundation} exportData={() => downloadBlob(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }), "E-Mobilitaet-AC.json")}>
    <div className="lab-bento"><section className="lab-visual" aria-label="Ladepunkte und Leistungsbudget"><div className="lab-visual-heading"><span><PlugZap size={16} /> Ladegrid · Leistung</span><span className="lab-live">LIVE</span><InfoButton title="AC-Leistungsmodell" onClick={() => setHelp({ title: "AC-Leistungsmodell", content: foundation })} /></div>
      <EVPowerFlow result={result} reserve={Number(input.reserve.replace(",", ".")) || 0} />
      <EVSchema input={input} result={result} />
      <div className="lab-values"><div className="lab-value"><small>Für Laden verfügbar</small><strong data-testid="ev-budget">{result ? `${result.available.toFixed(1)} kW` : "–"}</strong><span>nach Gebäudereserve</span></div><div className="lab-value"><small>Installierte Ladeleistung</small><strong>{result ? `${result.installed.toFixed(1)} kW` : "–"}</strong><span>{input.count} Ladepunkte</span></div><div className="lab-value"><small>Rechenwert je Punkt</small><strong>{result ? `${result.perPoint.toFixed(1)} kW` : "–"}</strong><span>{input.mode === "none" ? "Nennleistung, unbegrenzt" : "vereinfachte Zuteilung"}</span></div></div>
      <EVDetails result={result} count={input.count} />
      <div className="lab-status-stack">{result && <div className={`lab-short-status ${result.reserveExceeded || input.mode === "none" && !result.capacityOK ? "lab-status-error" : "lab-status-neutral"}`}>{result.reserveExceeded || !result.capacityOK ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}{result.reserveExceeded ? "Gebäudereserve überschreitet den Hausanschluss." : input.mode === "none" && !result.capacityOK ? "Nennleistung überschreitet das verfügbare Budget." : result.limited ? "Ladeleistung wird im Modell auf das verfügbare Budget begrenzt." : "Leistungsbudget reicht im vereinfachten Modell aus."}</div>}<div className="lab-short-status lab-status-neutral">Mindestladestrom, Schutztechnik und Netzfreigabe bleiben ungeprüft.</div></div>
    </section><section className="lab-controls" aria-label="E-Mobilitäts-Eingaben"><div className="lab-control-heading"><h2>Parameter</h2><InfoButton title="E-Mobilitäts-Grundlagen" onClick={() => setHelp({ title: "Schweizer Vorplanung", content: foundation })} /></div>
      {([ ["house","Hausanschluss (A)",25,630,1,"A"], ["grid","Grid-Vorsicherung (A)",16,250,1,"A"], ["reserve","Gebäudereserve (kW)",0,150,1,"kW"], ["count","Anzahl Ladepunkte",1,100,1,"Stk."], ["power","3~ Ladeleistung je Punkt (kW)",1,44,.1,"kW"] ] as const).map(([key,label,min,max,step,unit]) => <Parameter key={key} label={label} value={input[key]} min={min} max={max} step={step} unit={unit} disabled={!ready} onChange={value => edit(key,value)} info={() => setHelp({ title: label, content: foundation })} />)}
      <Segments disabled={!ready} label="Lastmanagement" value={input.mode} options={[{ value:"none",label:"Ohne LM" },{ value:"dynamic",label:"Dynamisch" },{ value:"static",label:"Statisch" }]} onChange={value => edit("mode",value)} />
      {input.mode === "static" && <Parameter label="Manueller Planungsfaktor" value={input.diversity} min={.1} max={1} step={.01} disabled={!ready} onChange={value => edit("diversity",value)} info={() => setHelp({ title:"Planungsannahme",content:foundation })} />}
      <label className="lab-label" htmlFor="ev-note">Notiz</label><textarea id="ev-note" aria-label="EV-Notizen" value={note} maxLength={10000} onChange={event => setNote(event.target.value)} />{(error || storageError) && <p className="lab-error" role="alert">{error || storageError}</p>}
    </section></div>
  </LabShell>;
}
