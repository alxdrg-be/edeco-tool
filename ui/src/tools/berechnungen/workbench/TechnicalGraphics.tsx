import { useId, type ReactNode } from "react";
import type { CalculationResult, DiagramNode, Inputs, Metric, Tone } from "./types";
import { useAnimatedGeometry } from "../useAnimatedGeometry";
import "./technical-graphics.css";

type SymbolKind = "source" | "transformer" | "cable" | "fault" | "breaker" | "bond" | "pse" | "pd" | "converter" | "charger" | "motor" | "roof";
const colour = (tone: Tone = "neutral") => tone === "error" ? "var(--danger)" : tone === "warning" ? "var(--wire)" : tone === "ok" ? "var(--ok)" : "var(--accent)";
const display = (metric: Pick<Metric, "value" | "unit" | "digits">) => `${typeof metric.value === "number" ? metric.value.toLocaleString("de-CH", { maximumFractionDigits: metric.digits ?? 2 }) : metric.value}${metric.unit ? ` ${metric.unit}` : ""}`;
const wrap = (text: string, width = 25) => {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).flatMap(word => word.match(new RegExp(`.{1,${width}}`, "g")) ?? [])) {
    if (lines.length && `${lines[lines.length - 1]} ${word}`.length <= width) lines[lines.length - 1] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
};
function Lines({ text, x, y, className = "", width = 25, lineHeight = 20 }: { text: string; x: number; y: number; className?: string; width?: number; lineHeight?: number }) {
  return <text x={x} y={y} textAnchor="middle" className={className}>{wrap(text, width).map((line, index) => <tspan key={index} x={x} dy={index ? lineHeight : 0}>{line}</tspan>)}</text>;
}

/** Original schematic symbols; geometry communicates topology, never physical sizing. */
function Symbol({ kind, x, y, stroke }: { kind: SymbolKind; x: number; y: number; stroke: string }) {
  let drawing: ReactNode;
  switch (kind) {
    case "transformer": drawing = <><circle cx="-14" cy="0" r="29" /><circle cx="14" cy="0" r="29" /><path d="M-60 0h17M43 0h17" /></>; break;
    case "cable": drawing = <><path d="M-60-9H60M-60 9H60M-44-20V20M44-20V20" /><path d="M-34-24H34" strokeWidth="1" /></>; break;
    case "fault": drawing = <><path d="M-55 0H-14M14 0H55M-8-33l-13 35H0L-8 33 22-8H4L12-33" /><circle r="47" strokeWidth="1" strokeDasharray="4 5" /></>; break;
    case "breaker": drawing = <><path d="M0-57v24M0 33V57" /><rect x="-22" y="-33" width="44" height="66" rx="3" fill="var(--panel)" /><path d="M-9 20 10-20" /><circle cy="-47" r="3" fill={stroke} /><circle cy="47" r="3" fill={stroke} /></>; break;
    case "bond": drawing = <><path d="M-60 0H60M0 0v35M-27 35H27M-18 46H18M-8 57H8" /><circle r="7" fill="var(--canvas)" /></>; break;
    case "pse": drawing = <><rect x="-49" y="-27" width="98" height="54" rx="5" fill="var(--panel)" />{[-30,-10,10,30].map(px => <rect key={px} x={px - 6} y="-7" width="12" height="14" rx="1" />)}<path d="M-60 0h11M49 0h11" /></>; break;
    case "pd": drawing = <><rect x="-30" y="-37" width="60" height="68" rx="6" fill="var(--panel)" /><path d="M-21-28H21V14H-21ZM-16 41H16M0 31V41M-60 0h30M30 0h30" /><circle cy="22" r="2" fill={stroke} /></>; break;
    case "converter": drawing = <><rect x="-46" y="-38" width="92" height="76" rx="4" fill="var(--panel)" /><path d="M-40 32 40-32M-32-13q8-14 16 0t16 0M7 17H32M7 25H32M-60 0h14M46 0h14" /></>; break;
    case "charger": drawing = <><rect x="-24" y="-44" width="48" height="88" rx="8" fill="var(--panel)" /><rect x="-15" y="-33" width="30" height="23" rx="3" /><circle cy="18" r="10" /><path d="M24-5q18 0 18 17v23q0 10-13 10M-60 0h36" /></>; break;
    case "motor": drawing = <><circle r="40" fill="var(--panel)" /><path d="M-19 17V-17L0 8 19-17V17M-60 0h20M40 0h20M-18 50H18" /></>; break;
    case "roof": drawing = <><path d="M-60 11 0-39 60 11M-45-2V40H45V-2" /><path d="M-26-2H26V24H-26ZM-9-2V24M9-2V24M-26 11H26" /></>; break;
    default: drawing = <><circle r="36" fill="var(--panel)" /><path d="M-24 0q12-24 24 0t24 0M-60 0h24M36 0h24" /></>;
  }
  return <g data-symbol={kind} transform={`translate(${x} ${y})`} stroke={stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">{drawing}</g>;
}

function Figure({ title, description, children, caption }: { title: string; description: string; children: (id: string) => ReactNode; caption: string }) {
  const id = useId();
  return <figure className="technical-figure" aria-label={title}><header><h2>{title}</h2><span title="Bei Bedarf innerhalb des Schemas horizontal verschieben">Schema · ↔</span></header><div className="technical-scroll" role="region" tabIndex={0} aria-label={`${title}, bei Bedarf horizontal verschieben`}>{children(id)}</div><figcaption><details><summary>Darstellung & Grenzen</summary>{description && <p>{description}</p>}<p>{caption}</p></details></figcaption></figure>;
}

function symbolsFor(calculatorId: string, length: number): SymbolKind[] {
  if (calculatorId === "transformator") return ["source", "transformer", "source"];
  if (calculatorId === "kurzschlussstrom") return ["transformer", "cable", "fault"];
  if (calculatorId === "ls-schalter") return ["source", "breaker", "cable"];
  if (calculatorId === "poe" || calculatorId === "premium-poe") return Array.from({ length }, (_, i) => i === 0 ? "pse" : i === length - 1 ? "pd" : "cable");
  if (calculatorId === "premium-lkw") return ["source", "converter", "charger"];
  if (calculatorId === "potenzialausgleich") return ["bond", "bond", "bond"];
  return Array.from({ length }, (_, i) => i === 0 ? "source" : i === length - 1 ? "pd" : "cable");
}

function Circuit({ calculatorId, nodes }: { calculatorId: string; nodes: DiagramNode[] }) {
  const slot = 270, width = Math.max(810, nodes.length * slot);
  const maxLabelLines = Math.max(1, ...nodes.map(node => wrap(node.label, 28).length));
  const centreY = Math.max(137, 34 + maxLabelLines * 18 + 65), valueY = centreY + 73;
  const maxValueLines = Math.max(1, ...nodes.map(node => wrap(node.value, 23).length));
  const detailY = valueY + maxValueLines * 24, maxDetailLines = Math.max(1, ...nodes.map(node => wrap(node.detail ?? "", 28).length));
  const height = detailY + maxDetailLines * 18 + 30;
  const symbols = symbolsFor(calculatorId, nodes.length);
  const caption = calculatorId === "pva-rechner" ? "Jahresbilanz aus den eingegebenen Projektannahmen. Die Generatorleistung in kWp und die Jahresenergie in kWh sind unterschiedliche Grössen; Ausrichtung, Verluste und Eigenverbrauch sind keine zeitaufgelöste Simulation." : calculatorId === "poe" || calculatorId === "premium-poe" ? "Verbindung: Speisegerät → Kabelstrecke → Endgerät. Spannung, Leistung und Längen sind berechnete Werte; eine Datenübertragungsfreigabe ist damit nicht belegt." : calculatorId === "potenzialausgleich" ? "Die drei Querschnitte gehören zu unterschiedlichen Leiterfunktionen; sie sind kein serieller Strompfad." : "Linien zeigen die technische Verbindung. Symbole und Leitungslängen sind schematisch; Geräte- und Schutzauslegung separat prüfen.";
  return <Figure title={calculatorId === "premium-lkw" ? "Leistungsweg · AC zu DC" : calculatorId === "potenzialausgleich" ? "Schutz- und Potenzialausgleichsleiter" : calculatorId === "pva-rechner" ? "PV-Generator und Jahresenergie" : "Technisches Einlinienschema"} description="" caption={caption}>{id => <svg className="lab-svg technical-svg" viewBox={`0 0 ${width} ${height}`} style={{ minWidth: Math.min(width, 900) }} role="img" aria-labelledby={`${id}-title`}><title id={`${id}-title`}>{nodes.map(node => `${node.label}: ${node.value}`).join("; ")}</title>
    {nodes.map((node, index) => {
      const x = slot * (index + .5), stroke = colour(node.tone);
      return <g key={`${node.label}-${index}`}><Lines text={node.label} x={x} y={34} className="technical-node-label" width={28} lineHeight={18} /><Symbol kind={symbols[index]} x={x} y={centreY} stroke={stroke} />{index < nodes.length - 1 && calculatorId !== "potenzialausgleich" && <g stroke={stroke} fill="none" strokeWidth="2.5"><path d={`M${x + 60} ${centreY}H${x + slot - 60}`} /><path d={`M${x + slot - 77} ${centreY - 6}l10 6-10 6`} /></g>}<Lines text={node.value} x={x} y={valueY} className="technical-node-value" width={23} lineHeight={24} />{node.detail && <Lines text={node.detail} x={x} y={detailY} className="technical-node-detail" width={28} lineHeight={18} />}</g>;
    })}
  </svg>}</Figure>;
}

function Cascade({ nodes }: { nodes: DiagramNode[] }) {
  let top = 15;
  const blocks = nodes.map(node => {
    const labelHeight = Math.max(1, wrap(node.label, 38).length) * 18;
    const valueHeight = Math.max(1, wrap(node.value, 30).length) * 24;
    const detailHeight = Math.max(1, wrap(node.detail ?? "", 38).length) * 18;
    const height = Math.max(154, labelHeight + valueHeight + detailHeight + 54);
    const block = { node, centreY: top + height / 2, labelY: top + 24, valueY: top + 36 + labelHeight, detailY: top + 48 + labelHeight + valueHeight };
    top += height + 20;
    return block;
  });
  return <Figure title="Schutzorgankaskade" description="Jede Stufe zeigt ihren Nennstrom und den Kurzschlusswert an ihrem Einbauort." caption="LS–LS ist ohne Herstellerkennlinie nicht nachgewiesen. Farben betreffen ausschliesslich den eingetragenen Zahlenvergleich.">{id => <svg className="lab-svg technical-svg technical-cascade-svg" viewBox={`0 0 760 ${top}`} role="img" aria-labelledby={`${id}-title`}><title id={`${id}-title`}>Senkrechte Kaskade der Schutzorgane</title>{blocks.map(({node, centreY, labelY, valueY, detailY}, index) => {
    const stroke = colour(node.tone);
    return <g key={index}><Symbol kind="breaker" x={150} y={centreY} stroke={stroke} />{index < blocks.length - 1 && <path d={`M150 ${centreY + 57}V${blocks[index+1].centreY - 57}`} stroke={stroke} fill="none" strokeWidth="2.5" />}<Lines text={node.label} x={455} y={labelY} className="technical-node-label" width={38} lineHeight={18} /><Lines text={node.value} x={455} y={valueY} className="technical-node-value" width={30} lineHeight={24} /><Lines text={node.detail ?? ""} x={455} y={detailY} className="technical-node-detail" width={38} lineHeight={18} /></g>;
  })}</svg>}</Figure>;
}

function Corridor({ result, input }: { result: CalculationResult; input?: Inputs }) {
  const counted = (keys: string[]) => {
    if (!input || keys.some(key => input[key] === undefined)) return null;
    const values = keys.map(key => Number(input[key].replace(",", ".")));
    return values.every(value => Number.isInteger(value) && value >= 0) ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  const numericMetric = (label: string) => { const value = result.metrics.find(metric => metric.label === label)?.value; return typeof value === "number" ? value : null; };
  const comparison = input && Object.hasOwn(input, "countBefore1");
  const states = comparison ? [
    { label: "Vorher", count: input?.fireloadMode === "dynamic" ? numericMetric("Kabel vorher") : counted(["countBefore1", "countBefore2"]), metric: result.metrics.find(metric => metric.label === "Vorher") ?? result.metrics[0] },
    { label: "Nachher", count: input?.fireloadMode === "dynamic" ? numericMetric("Kabel nachher") : counted(["countAfter1", "countAfter2"]), metric: result.metrics.find(metric => metric.label === "Nachher") ?? result.metrics[1] },
  ] : [{ label: "Erfasster Bestand", count: input?.fireloadMode === "dynamic" ? numericMetric("Kabel total") : counted(["n1", "n2", "n3"]), metric: result.metrics[0] }];
  return <Figure title="Kabelbestand im Fluchtweg" description="Die Bilanz bezieht die gesamte eingetragene Kabelbrandlast auf die betrachtete Fluchtweglänge." caption="Symbolischer Bestandsvergleich. Linien stehen für Kabel, ohne örtliche Verteilung oder massstäbliche Länge zu behaupten. Lokale Häufungen, Abschottungen und Brandverhalten sind separat zu prüfen.">{id => <svg className="lab-svg technical-svg" viewBox={`0 0 810 ${states.length * 210 + 15}`} role="img" aria-labelledby={`${id}-title`}><title id={`${id}-title`}>Kabelbestand und berechnete spezifische Brandlast{comparison ? " vor und nach der Sanierung" : ""}</title>{states.map((state,index) => {
    const y = index * 210, shown = Math.min(12, state.count ?? 0);
    const comparisonItem = result.comparisons?.flatMap(chart => chart.items).find(item => item.label === state.label);
    const tone = comparisonItem && comparisonItem.actual > comparisonItem.target + 1e-9 ? "error" : state.metric.tone ?? "neutral";
    return <g key={state.label}><text x="405" y={y+32} textAnchor="middle" className="technical-node-label">{state.label}</text><text x="405" y={y+57} textAnchor="middle" className="technical-node-detail">{state.count === null ? "Kabelanzahl nicht im Rechenstand ausgewiesen" : `${state.count.toLocaleString("de-CH")} Kabel erfasst · ${shown} symbolisch dargestellt`}</text><path d={`M58 ${y+76}H750V${y+147}H58Z`} fill="var(--panel-2)" stroke="var(--line-strong)" strokeWidth="3" /><rect x="90" y={y+91} width="630" height="40" rx="4" fill="var(--panel)" stroke="var(--muted)" />{Array.from({ length: shown }, (_, cable) => <path key={cable} d={`M106 ${y+98+cable*26/Math.max(1,shown-1)}H704`} stroke={colour(tone)} strokeWidth="2" />)}<text x="405" y={y+187} textAnchor="middle" className="technical-node-value">{display(state.metric)}</text></g>;
  })}</svg>}</Figure>;
}

function CableTray({ input, result }: { input?: Inputs; result: CalculationResult }) {
  const count = Number(input?.circuits ?? 1), shown = Math.min(12, Math.max(1, Number.isFinite(count) ? count : 1));
  const geometry = useAnimatedGeometry(Object.fromEntries(Array.from({ length: shown }, (_, index) => [`x-${index}`, 405 - (shown - 1) * 23 + index * 46])));
  return <Figure title="Parallele Zuleitungen" description="Jeder gezeichnete Kreis steht für einen vollständigen Stromkreis, nicht für eine einzelne Ader." caption="Gleiche Stromaufteilung und identische Stromkreise sind vorausgesetzt. Die angegebene Häufung bleibt eine eigene Projekteingabe.">{id => <svg className="lab-svg technical-svg" viewBox="0 0 810 235" role="img" aria-labelledby={`${id}-title`}><title id={`${id}-title`}>Kabeltrasse mit {count} parallelen Stromkreisen</title><path d="M60 100v65H750V100M83 177v22M727 177v22" fill="none" stroke="var(--line-strong)" strokeWidth="7" />{Array.from({ length: shown }, (_, index) => <circle key={index} cx={geometry[`x-${index}`]} cy="138" r="18" fill="var(--panel-2)" stroke={colour(result.status.tone)} strokeWidth="3" />)}<text x="405" y="45" textAnchor="middle" className="technical-node-label">{count} parallele Stromkreise{count > shown ? ` · ${shown} dargestellt` : ""}</text><text x="405" y="81" textAnchor="middle" className="technical-node-value">{display(result.metrics[0])}</text></svg>}</Figure>;
}

function LoadedCores({ input, result }: { input?: Inputs; result: CalculationResult }) {
  const cores = Number(input?.cores), area = input?.area ?? "–", method = input?.method ?? "–";
  if (![2, 3].includes(cores)) return null;
  const positions = cores === 2 ? [[-26,0],[26,0]] : [[0,-28],[-27,20],[27,20]];
  return <Figure title="Kabelquerschnitt · belastete Adern" description="Die markierten Kreise stehen für die gewählte Anzahl belasteter Adern." caption={`Symbolischer Belastungsquerschnitt, kein vollständiger Kabelaufbau. Weitere Adern und PE sind nicht dargestellt. ${input?.tableMode === "published" ? "Iz₀ und Faktoren stammen aus dem gewählten veröffentlichten Referenzdatensatz; die Anwendbarkeit am Projekt bleibt zu prüfen." : "Iz₀ und Korrekturfaktoren bleiben belegte manuelle Eingaben."}`}>{id => <svg className="lab-svg technical-svg" viewBox="0 0 810 270" role="img" aria-labelledby={`${id}-title`}><title id={`${id}-title`}>{cores} belastete Adern, {area} Quadratmillimeter, Verlegeart {method}</title><circle cx="190" cy="133" r="84" fill="var(--panel-2)" stroke="var(--line-strong)" strokeWidth="4" />{positions.map(([x,y],i) => <g key={i}><circle cx={190+x} cy={133+y} r="21" fill="var(--panel-2)" stroke="var(--wire)" strokeWidth="3" /><text x={190+x} y={138+y} textAnchor="middle" className="technical-core-label">{i+1}</text></g>)}<text x="525" y="67" textAnchor="middle" className="technical-node-label">{cores} belastete Adern · {input?.isolation?.toUpperCase() ?? "Isolation gemäss Eingabe"}</text><text x="525" y="110" textAnchor="middle" className="technical-node-value">{area} mm² · {method}</text><text x="525" y="154" textAnchor="middle" className="technical-node-label">Korrigierte Strombelastbarkeit</text><text x="525" y="193" textAnchor="middle" className="technical-node-value">{display(result.metrics[0])}</text></svg>}</Figure>;
}

function MotorStates({ result }: { result: CalculationResult }) {
  return <Figure title="Motor · Nennbetrieb und Anlauf" description="Ein Motor, zwei Betriebszustände: Der Anlaufstrom wird dem Nennstrom gegenübergestellt." caption="Die Felder rechts vergleichen alternative Betriebszustände desselben Motors. Anlaufverfahren und Faktoren sind Eingaben; Netzrückwirkung, Schutz und zulässige Startdauer bleiben separat zu prüfen.">{id => <svg className="lab-svg technical-svg" data-testid="motor-state-comparison" viewBox="0 0 810 285" role="img" aria-labelledby={`${id}-title`}><title id={`${id}-title`}>Ein Motor: Nennstrom {display(result.metrics[0])}, Anlaufstrom {display(result.metrics[1])}</title><text x="150" y="47" textAnchor="middle" className="technical-node-label">Drehstrommotor</text><Symbol kind="motor" x={150} y={132} stroke="var(--accent)" /><text x="150" y="224" textAnchor="middle" className="technical-node-value">{display(result.metrics[2])}</text><text x="150" y="250" textAnchor="middle" className="technical-node-detail">elektrische Nennleistung</text>{[{ x: 430, title: "Nennbetrieb", metric: result.metrics[0], colour: "var(--accent)" }, { x: 660, title: "Anlaufannahme", metric: result.metrics[1], colour: "var(--wire)" }].map(state => <g key={state.title} data-motor-state={state.title}><rect x={state.x - 100} y="86" width="200" height="135" rx="8" fill="var(--panel)" stroke={state.colour} /><text x={state.x} y="118" textAnchor="middle" className="technical-node-label">{state.title}</text><text x={state.x} y="166" textAnchor="middle" className="technical-node-value">{display(state.metric)}</text><text x={state.x} y="197" textAnchor="middle" className="technical-node-detail">Leitungsstrom</text></g>)}</svg>}</Figure>;
}

function PVBalance({ result }: { result: CalculationResult }) {
  const own = result.rows?.find(row => row.label.includes("Eigenverbrauch"));
  return <Figure title="PV-Generator · Jahresbilanz" description="Generatorleistung, Jahresertrag und Eigenverbrauch werden als unterschiedliche Kenngrössen ausgewiesen." caption="Das Dachsymbol zeigt die PV-Anlage. Die Wertefelder bilden eine Jahresbilanz aus Projektannahmen, keinen elektrischen Anschlussplan und keine zeitaufgelöste Simulation.">{id => <svg className="lab-svg technical-svg" viewBox="0 0 810 285" role="img" aria-labelledby={`${id}-title`}><title id={`${id}-title`}>PV-Generator {display(result.metrics[0])}, Jahresertrag {display(result.metrics[1])}</title><text x="150" y="47" textAnchor="middle" className="technical-node-label">PV-Generator</text><Symbol kind="roof" x={150} y={132} stroke="var(--accent)" /><text x="150" y="225" textAnchor="middle" className="technical-node-value">{display(result.metrics[0])}</text>{[{ x: 430, title: "Jahresertrag", value: display(result.metrics[1]) }, { x: 660, title: "Eigenverbrauch", value: own ? display(own) : "separat ausgewiesen" }].map(item => <g key={item.title}><rect x={item.x - 100} y="86" width="200" height="135" rx="8" fill="var(--panel)" stroke="var(--line-strong)" /><text x={item.x} y="118" textAnchor="middle" className="technical-node-label">{item.title}</text><Lines text={item.value} x={item.x} y={166} className="technical-node-value" width={18} lineHeight={24} /><text x={item.x} y="205" textAnchor="middle" className="technical-node-detail">Jahr 1</text></g>)}</svg>}</Figure>;
}

export function hasTechnicalGraphic(calculatorId: string | undefined, result: CalculationResult) {
  return Boolean(result.diagram?.kind === "chain" || calculatorId && ["nin-kabelrechner", "potenzialausgleich", "motoranlauf", "brandlast", "premium-brandlast", "strombelastbarkeit", "pva-rechner"].includes(calculatorId));
}

export default function TechnicalGraphics({ calculatorId = "", result, input }: { calculatorId?: string; result: CalculationResult; input?: Inputs }) {
  if (calculatorId === "nin-kabelrechner") return <LoadedCores result={result} input={input} />;
  if (calculatorId === "brandlast" || calculatorId === "premium-brandlast") return <Corridor result={result} input={input} />;
  if (calculatorId === "strombelastbarkeit") return <CableTray input={input} result={result} />;
  if (calculatorId === "motoranlauf") return <MotorStates result={result} />;
  if (calculatorId === "pva-rechner") return <PVBalance result={result} />;
  if (calculatorId === "potenzialausgleich") return <Circuit calculatorId={calculatorId} nodes={result.metrics.map(metric => ({ label: metric.label, value: display(metric) }))} />;
  if (result.diagram?.kind === "chain") return calculatorId === "premium-selektivitaet" ? <Cascade nodes={result.diagram.nodes} /> : <Circuit calculatorId={calculatorId} nodes={result.diagram.nodes} />;
  return null;
}
