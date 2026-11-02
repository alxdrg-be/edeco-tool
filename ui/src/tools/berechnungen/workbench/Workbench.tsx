import { useEffect, useMemo, useRef, useState } from "react";
import { Calculator } from "lucide-react";
import type { ToolProps } from "../../../toolbox/modules";
import { useProjectHub } from "../../projektzentrale/projectHubState";
import { downloadBlob } from "../../planlieferung/DeliveryHistory";
import { ChoiceCards, Explanation, InfoButton, LabShell, type Help } from "../LabUI";
import { KnowledgeLink } from "../KnowledgeLink";
import { consumeRestore, type ArchiveProject } from "../ablage/api";
import { CALCULATORS } from "./definitions";
import { defaults, validateResult, type Inputs } from "./types";
import ResultView from "./ResultView";
import { hasTechnicalGraphic } from "./TechnicalGraphics";
import { fieldOptions, optionsWithProjectValue } from "../electricalOptions";
import { calculationExplanation } from "./explanations";
import { migrateWorkbenchInputs } from "./migrateInputs";
import PlanningControls from "./PlanningControls";
import SIATableControls from "./SIATableControls";
import PoeRouteControls from "./PoeRouteControls";
import FireLoadControls from "./FireLoadControls";
import SelectivityControls from "./SelectivityControls";
import { calculationNorm, workbenchReport } from "../calculationReport";
import "./workbench.css";

const BREAKER_CHARACTERISTICS: Record<string, { range: string; uses: string; standard: string }> = {
  B: { range: "3–5 × Iₙ", uses: "Ohmsche Lasten, Leitungen und Beleuchtung.", standard: "IEC 60898-1." },
  C: { range: "5–10 × Iₙ", uses: "Lasten mit erhöhtem Einschaltstrom, z. B. Motoren oder Transformatoren.", standard: "IEC 60898-1." },
  D: { range: "10–20 × Iₙ", uses: "Lasten mit hohem Einschaltstrom, z. B. grosse Transformatoren.", standard: "IEC 60898-1." },
  K: { range: "8–14 × Iₙ", uses: "Induktive Lasten und industrielle Anwendungen.", standard: "Herstellerannahme nach IEC 60947-2; konkrete Gerätekennlinie prüfen." },
  Z: { range: "2–3 × Iₙ", uses: "Empfindliche elektronische Lasten.", standard: "Herstellerspezifischer Bereich; konkrete Gerätekennlinie prüfen." },
};

export default function Workbench({ calculatorId, ...props }: ToolProps & { calculatorId: string }) {
  const definition = CALCULATORS.find(item => item.id === calculatorId);
  if (!definition) return <div role="alert">Unbekannter Rechner.</div>;
  return <CalculatorForm key={calculatorId} definition={definition} {...props} />;
}

function CalculatorForm({ definition, ...props }: ToolProps & { definition: (typeof CALCULATORS)[number] }) {
  const { hub, active } = useProjectHub();
  const [input, setInput] = useState<Inputs>(() => defaults(definition)), [notes, setNotes] = useState("");
  const [project, setProject] = useState<ArchiveProject | null>(null), [ready, setReady] = useState(false);
  const [help, setHelp] = useState<Help | null>(null), [storageError, setStorageError] = useState(""), [restoreError, setRestoreError] = useState("");
  const loaded = useRef(false), key = `edeco.workbench.v1.${definition.id}.${project?.id || project?.number || "unassigned"}`;
  useEffect(() => {
    if (!hub || loaded.current) return; loaded.current = true;
    const restored = consumeRestore(definition.id), chosen = restored?.project ?? (active ? { id: active.id, number: active.number, name: active.name } : null);
    setProject(chosen);
    try {
      const local = restored ? null : JSON.parse(localStorage.getItem(`edeco.workbench.v1.${definition.id}.${chosen?.id || chosen?.number || "unassigned"}`) || "null");
      const saved = restored?.document.input ?? local?.input;
      if (saved && typeof saved === "object" && !Array.isArray(saved)) setInput(migrateWorkbenchInputs(definition.id, defaults(definition), saved));
      setNotes(restored?.notes ?? (typeof local?.notes === "string" ? local.notes : ""));
    } catch { setRestoreError("Gespeicherter Entwurf konnte nicht eindeutig geladen werden. Originalstand prüfen oder mit «Beispielwerte» ausdrücklich neu beginnen."); }
    setReady(true);
  }, [hub, active, definition]);
  useEffect(() => { if (!ready || restoreError) return; try { localStorage.setItem(key, JSON.stringify({ input, notes })); setStorageError(""); } catch { setStorageError("Entwurf konnte nicht gespeichert werden."); } }, [input, notes, ready, key, restoreError]);
  const { result, error } = useMemo(() => { if (restoreError) return { result: null, error: restoreError }; try { return { result: validateResult(definition.calculate(input)), error: "" }; } catch (e) { return { result: null, error: e instanceof Error ? e.message : "Eingaben prüfen." }; } }, [input, definition, restoreError]);
  const document = { schema: "edeco.workbench.v1", calculatorId: definition.id, project, input, result, notes, source: definition.source, scope: definition.scope };
  const visibleFields = definition.fields.filter(field => !["grids", "depotUnits", "depotPoints", "costRows", "siaZones", "poeSegments", "fireloadRows", "fireloadRowsAfter", "selectivityStages", "chargingSourceConnection"].includes(field.key) && (!field.visibleWhen || field.visibleWhen.every(condition => condition.values.includes(input[condition.key]))));
  if (definition.id === "ls-schalter") visibleFields.sort((a, b) => (a.key === "rated" ? -1 : b.key === "rated" ? 1 : 0));
  const choices = Object.fromEntries(definition.fields.map(field => [field.key, field.options ?? fieldOptions(definition.id, field.key) ?? []]));
  const groups = Array.from(new Set(visibleFields.map(field => field.group ?? "Eingaben")));
  const positionEditor = definition.id === "premium-selektivitaet" && input.selectivityMode === "stages" ? { title: "Schutzstufen und Zuleitungen bearbeiten", content: <SelectivityControls input={input} onChange={editField} disabled={!ready} /> }
    : definition.id === "premium-sia2056" && input.siaMode === "manual" ? { title: "Zonen und Verbraucher bearbeiten", content: <SIATableControls input={input} onChange={editField} disabled={!ready} /> }
    : definition.id === "premium-poe" && input.poeRouteMode === "published" ? { title: "PoE-Teilstrecken bearbeiten", content: <PoeRouteControls input={input} onChange={editField} disabled={!ready} /> }
    : definition.id === "brandlast" && input.fireloadMode === "dynamic" ? { title: "Kabelpositionen bearbeiten", content: <FireLoadControls input={input} onChange={editField} disabled={!ready} /> }
    : definition.id === "premium-brandlast" && input.fireloadMode === "dynamic" ? { title: "Kabelpositionen vorher / nachher bearbeiten", content: <><FireLoadControls input={input} onChange={editField} disabled={!ready} lengthKey="route" title="Vorher" /><FireLoadControls input={input} onChange={editField} disabled={!ready} rowsKey="fireloadRowsAfter" lengthKey="route" title="Nachher" /></> }
    : definition.id === "premium-pkw" && input.layout === "modular" ? { title: "Ladegrids und Punktgruppen bearbeiten", content: <PlanningControls calculatorId={definition.id} input={input} onChange={editField} disabled={!ready} /> }
    : definition.id === "premium-lkw" && input.depotLayout === "modular" ? { title: "Power Units und Abgabepunkte bearbeiten", content: <PlanningControls calculatorId={definition.id} input={input} onChange={editField} disabled={!ready} /> }
    : definition.id === "premium-ladekosten" && input.costLayout === "contracts" ? { title: "Ladepunkte und Kostenpositionen bearbeiten", content: <PlanningControls calculatorId={definition.id} input={input} onChange={editField} disabled={!ready} /> } : null;
  function editField(key: string, value: string) {
    setInput(old => ({ ...old, [key]: value, ...(definition.id === "poe" && key === "type" && value !== "manual" ? { voltage: ["1", "2"].includes(value) ? "48" : "53" } : {}) }));
  }
  function choiceField(key: string, label: string) {
    const options = optionsWithProjectValue(choices[key], input[key]);
    if (definition.id === "ls-schalter" && key === "curve") {
      const selected = BREAKER_CHARACTERISTICS[input[key]];
      return <div className="wb-curve-choice"><ChoiceCards id={`wb-${key}`} fieldKey={key} label={label} value={input[key]} disabled={!ready} presentation="cards" options={options.map(option => ({ ...option, label: BREAKER_CHARACTERISTICS[option.value] ? option.value : option.label }))} onChange={value => editField(key, value)} />{selected && <div className="wb-characteristic-description" aria-live="polite"><strong>Typ {input[key]} · {selected.range}</strong><p>{selected.uses} {selected.standard}</p></div>}</div>;
    }
    return <ChoiceCards id={`wb-${key}`} fieldKey={key} label={label} value={input[key]} disabled={!ready} options={options} onChange={value => editField(key, value)} />;
  }
  const calculationReport = result ? workbenchReport(definition, input, result, notes, project) : null;
  const foundation = <><p>{definition.scope}</p>{result && <><code>{result.formula}</code><ul>{result.limitations.map(item => <li key={item}>{item}</li>)}</ul></>}<p>Tabellenwerte, Herstellergrenzen und projektabhängige Faktoren sind anhand der zum Projekt passenden Normausgabe, Datenblätter und Nachweise zu bestätigen. Beispielwerte sind keine fachliche Freigabe.</p></>;
  return <LabShell {...props} knowledgeId={definition.id} title={definition.title} subtitle={`${calculationNorm(definition.id, input)}${project ? ` · ${project.number} · ${project.name}` : ""}`} help={help} setHelp={setHelp} canExport={Boolean(ready && result)} pdfReport={calculationReport} archive={{ toolId: definition.id, project, notes, document }} exportData={() => downloadBlob(new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }), `${definition.id.replace("premium-", "")}.json`)} report={<><h2>{definition.title}</h2><h3>Eingaben des Rechenstands</h3><table><thead><tr><th>Parameter</th><th>Wert</th></tr></thead><tbody>{calculationReport?.inputs.map((row, index) => <tr key={index}><td>{row.label}</td><td>{row.value}</td></tr>)}</tbody></table>{foundation}<p>Notizen: {notes}</p></>}>
    {positionEditor && <details className="wb-position-editor"><summary>{positionEditor.title}<span>Positionsliste öffnen</span></summary><div className="wb-position-content">{positionEditor.content}</div></details>}
    <div className="lab-bento wb-layout"><section className={`wb-results ${result && (result.diagram || result.charging || result.chargingNetwork || result.depotNetwork || result.siaBreakdown || result.poeRoute || result.series?.length || result.comparisons?.length || hasTechnicalGraphic(definition.id, result)) ? "wb-has-graphic" : ""}`} aria-label="Berechnungsergebnis"><div className="wb-result-heading"><span><Calculator size={17} /> Live-Auswertung</span><InfoButton title="Berechnungsgrundlagen" onClick={() => setHelp({ title: "Berechnungsgrundlagen", content: foundation })} /></div>
      <Explanation className="wb-reading-guide" title="Ergebnis verstehen"><p>{calculationExplanation(definition.id, input)}</p></Explanation>
      {result ? <ResultView result={result} calculatorId={definition.id} input={input} /> : <div className="lab-error" role="alert">{error}</div>}
      <Explanation className="wb-foundations" title="Formel, Quellen & Voraussetzungen">{foundation}<KnowledgeLink calculatorId={definition.id} onOpenTool={props.onOpenTool}>Grundlagen im Wissens-Hub</KnowledgeLink></Explanation>
    </section><section className="lab-controls wb-controls" aria-label="Rechnereingaben"><div className="lab-control-heading"><h2>Parameter</h2><button className="lab-open" onClick={() => { setInput(defaults(definition)); setRestoreError(""); }} disabled={!ready}>Beispielwerte</button></div>
      {groups.map((group, i) => <details className="wb-field-group" open={i === 0} key={group}><summary>{group}</summary>{visibleFields.filter(field => (field.group ?? "Eingaben") === group).map(field => <div className="wb-field" key={field.key}><div><label htmlFor={`wb-${field.key}`}>{field.label}{field.unit ? ` (${field.unit})` : ""}</label><InfoButton title={`${group} · ${field.label}`} onClick={() => setHelp({ title: field.label, content: <><p>{field.help}</p>{foundation}</> })} /></div>{(field.kind === "select" || choices[field.key].length > 0) ? choiceField(field.key, field.label) : <input id={`wb-${field.key}`} data-field-key={field.key} type="text" inputMode={field.kind === "text" ? "text" : "decimal"} autoComplete="off" maxLength={field.kind === "text" ? 180 : 24} value={input[field.key]} disabled={!ready} onChange={event => editField(field.key, event.target.value)} />}</div>)}</details>)}
      <label className="lab-label" htmlFor="wb-notes">Notizen / Grundlagenverweis</label><textarea id="wb-notes" aria-label="Berechnungsnotizen" value={notes} maxLength={10000} rows={3} onChange={event => setNotes(event.target.value)} />{storageError && <p role="alert" className="lab-error">{storageError}</p>}
    </section></div>
  </LabShell>;
}
