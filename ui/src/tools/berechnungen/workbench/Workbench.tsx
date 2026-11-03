import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator } from "lucide-react";
import type { ToolProps } from "../../../toolbox/modules";
import { useProjectHub } from "../../projektzentrale/projectHubState";
import { downloadBlob } from "../../planlieferung/DeliveryHistory";
import { InfoButton, LabShell, type Help } from "../LabUI";
import { consumeRestore, type ArchiveProject } from "../ablage/api";
import { CALCULATORS } from "./definitions";
import { defaults, validateResult, type Inputs } from "./types";
import ResultView from "./ResultView";
import { fieldOptions, optionsWithProjectValue } from "../electricalOptions";
import { EXPLANATIONS } from "./explanations";
import "./workbench.css";

export default function Workbench({ calculatorId, ...props }: ToolProps & { calculatorId: string }) {
  const definition = CALCULATORS.find(item => item.id === calculatorId);
  if (!definition) return <div role="alert">Unbekannter Rechner.</div>;
  return <CalculatorForm key={calculatorId} definition={definition} {...props} />;
}

function CalculatorForm({ definition, ...props }: ToolProps & { definition: (typeof CALCULATORS)[number] }) {
  const { hub, active } = useProjectHub();
  const [input, setInput] = useState<Inputs>(() => defaults(definition)), [notes, setNotes] = useState("");
  const [project, setProject] = useState<ArchiveProject | null>(null), [ready, setReady] = useState(false);
  const [help, setHelp] = useState<Help | null>(null), [storageError, setStorageError] = useState("");
  const loaded = useRef(false), key = `edeco.workbench.v1.${definition.id}.${project?.id || project?.number || "unassigned"}`;
  useEffect(() => {
    if (!hub || loaded.current) return; loaded.current = true;
    const restored = consumeRestore(definition.id), chosen = restored?.project ?? (active ? { id: active.id, number: active.number, name: active.name } : null);
    setProject(chosen);
    try {
      const local = restored ? null : JSON.parse(localStorage.getItem(`edeco.workbench.v1.${definition.id}.${chosen?.id || chosen?.number || "unassigned"}`) || "null");
      const saved = restored?.document.input ?? local?.input;
      if (saved && typeof saved === "object" && !Array.isArray(saved)) setInput(old => Object.fromEntries(Object.entries(old).map(([k, v]) => [k, typeof saved[k] === "string" ? saved[k] : v])));
      setNotes(restored?.notes ?? (typeof local?.notes === "string" ? local.notes : ""));
    } catch { setStorageError("Gespeicherter Entwurf konnte nicht geladen werden."); }
    setReady(true);
  }, [hub, active, definition]);
  useEffect(() => { if (!ready) return; try { localStorage.setItem(key, JSON.stringify({ input, notes })); setStorageError(""); } catch { setStorageError("Entwurf konnte nicht gespeichert werden."); } }, [input, notes, ready, key]);
  const { result, error } = useMemo(() => { try { return { result: validateResult(definition.calculate(input)), error: "" }; } catch (e) { return { result: null, error: e instanceof Error ? e.message : "Eingaben prüfen." }; } }, [input, definition]);
  const document = { schema: "edeco.workbench.v1", calculatorId: definition.id, project, input, result, notes, source: definition.source, scope: definition.scope };
  const visibleFields = definition.fields.filter(field => !field.visibleWhen || field.visibleWhen.every(condition => condition.values.includes(input[condition.key])));
  const choices = Object.fromEntries(definition.fields.map(field => [field.key, field.options ?? fieldOptions(definition.id, field.key) ?? []]));
  const groups = Array.from(new Set(visibleFields.map(field => field.group ?? "Eingaben")));
  const foundation = <><p>{EXPLANATIONS[definition.id]}</p><p>{definition.scope}</p><p><a href={definition.source} target="_blank" rel="noreferrer">Schweizer Referenz · elektro-rechner.ch</a></p>{result && <><code>{result.formula}</code><ul>{result.limitations.map(item => <li key={item}>{item}</li>)}</ul></>}<p>Eigene nachvollziehbare Modellrechnung. Tabellenwerte, Herstellergrenzen und projektabhängige Faktoren müssen aus der genannten Schweizer Projektgrundlage übernommen werden. Beispielwerte sind keine fachliche Freigabe.</p></>;
  return <LabShell {...props} title={definition.title} subtitle={project ? `${project.number} · ${project.name}` : definition.scope} help={help} setHelp={setHelp} canExport={Boolean(ready && result)} archive={{ toolId: definition.id, project, notes, document }} exportData={() => downloadBlob(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }), `${definition.id.replace("premium-", "")}.json`)} report={<><h2>{definition.title}</h2><h3>Eingaben des Rechenstands</h3><table><thead><tr><th>Parameter</th><th>Wert</th></tr></thead><tbody>{definition.fields.map(field => <tr key={field.key}><td>{field.label}</td><td>{field.options?.find(option => option.value === input[field.key])?.label ?? input[field.key]} {field.unit}</td></tr>)}</tbody></table>{foundation}<p>Notizen: {notes}</p></>}>
    <div className="lab-bento wb-layout"><section className={`wb-results ${result?.diagram || result?.charging || result?.series?.length ? "wb-has-graphic" : ""}`} aria-label="Berechnungsergebnis"><div className="wb-result-heading"><span><Calculator size={17} /> Ergebnis</span><InfoButton title="Berechnungsgrundlagen" onClick={() => setHelp({ title: "Berechnungsgrundlagen", content: foundation })} /></div>
      {result ? <ResultView result={result} /> : <div className="lab-error" role="alert">{error}</div>}
      <details className="wb-details"><summary>Formel & Voraussetzungen</summary><div className="lab-prose">{foundation}</div></details>
    </section><section className="lab-controls wb-controls" aria-label="Rechnereingaben"><div className="lab-control-heading"><h2>Parameter</h2><button className="lab-open" onClick={() => setInput(defaults(definition))} disabled={!ready}>Beispielwerte</button></div>
      {groups.map((group, i) => <details className="wb-field-group" open={i === 0} key={group}><summary>{group}</summary>{visibleFields.filter(field => (field.group ?? "Eingaben") === group).map(field => <div className="wb-field" key={field.key}><div><label htmlFor={`wb-${field.key}`}>{field.label}{field.unit ? ` (${field.unit})` : ""}</label><InfoButton title={field.label} onClick={() => setHelp({ title: field.label, content: <p>{field.help}</p> })} /></div>{(field.kind === "select" || choices[field.key].length > 0) ? <select id={`wb-${field.key}`} data-field-key={field.key} value={input[field.key]} disabled={!ready} onChange={event => setInput(old => ({ ...old, [field.key]: event.target.value }))}>{optionsWithProjectValue(choices[field.key], input[field.key]).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id={`wb-${field.key}`} data-field-key={field.key} type="text" inputMode={field.kind === "text" ? "text" : "decimal"} autoComplete="off" maxLength={field.kind === "text" ? 180 : 24} value={input[field.key]} disabled={!ready} onChange={event => setInput(old => ({ ...old, [field.key]: event.target.value }))} />}</div>)}</details>)}
      <label className="lab-label" htmlFor="wb-notes">Notizen / Grundlagenverweis</label><textarea id="wb-notes" aria-label="Berechnungsnotizen" value={notes} maxLength={10000} rows={3} onChange={event => setNotes(event.target.value)} />{storageError && <p role="alert" className="lab-error">{storageError}</p>}
    </section></div>
  </LabShell>;
}
