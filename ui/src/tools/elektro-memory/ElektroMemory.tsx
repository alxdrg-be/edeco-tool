import { useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, ArrowUpRight, Bath, BookOpen, Cable, Calculator, ChevronDown, Earth, HardHat, HeartPulse, Info, Layers, Moon, Plug, Ruler, ScanLine, Search, ShieldCheck, Sun, Zap } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import ToolhubHeader from "../../toolbox/ToolhubHeader";
import { useToolhubLocation } from "../../toolbox/ToolhubNavigation";
import { useToolhubTheme } from "../../toolbox/useToolhubTheme";
import { FormulaCalculator } from "../berechnungen/Berechnungen";
import { isFormulaId, type FormulaId } from "../berechnungen/formulaCatalog";
import { BASIC_TOPICS } from "./basics";
import { SOURCE_CATALOG } from "./sourceCatalog";
import { filterMemoryEntries, filterMemoryTopics, memoryPagesLabel, type MemoryFilter } from "./memorySearch";
import type { MemoryEntry, MemoryTopic } from "./types";
import MemoryDiagram from "./MemoryDiagram";
import "./elektro-memory.css";

export interface ElektroMemoryProps extends ToolProps { initialTab?: "reference" | "calculator"; initialFormulaId?: string }
const TOPICS = [...SOURCE_CATALOG.topics, ...BASIC_TOPICS];
const FILTERS: [MemoryFilter, string][] = [["all", "Alle"], ["formulas", "Formeln"], ["reference", "Schutz & Normen"], ["basics", "Grundlagen"]];

function TopicIcon({ topic, size = 22 }: { topic: MemoryTopic; size?: number }) {
  const sourceIcons = { "em-emergency": HeartPulse, "em-safety-rules": HardHat, "em-testing": ScanLine, "em-short-circuit-rules": Zap,
    "em-protective-devices": ShieldCheck, "em-earthing": Earth, "em-spd-conduits": Cable, "em-bathroom": Bath,
    "em-measurement-billing": Ruler, "em-ip-symbols": ShieldCheck, "em-swiss-connectors": Plug };
  const Icon = sourceIcons[topic.id as keyof typeof sourceIcons] ?? (topic.group === "basics" ? Layers : topic.entries.some(entry => entry.kind === "formula") ? Activity : BookOpen);
  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />;
}

/** Small mathematical typography layer; no executable formula strings. */
function MathText({ value }: { value: string }) {
  const chunks = value.split(/([A-Za-zΑ-Ωα-ω]+_[A-Za-z0-9µ]+)/g);
  return <>{chunks.map((chunk, index) => {
    const match = chunk.match(/^([A-Za-zΑ-Ωα-ω]+)_([A-Za-z0-9µ]+)$/);
    return match ? <span key={index}>{match[1]}<sub>{match[2]}</sub></span> : chunk;
  })}</>;
}

function SourceLabel({ entry }: { entry: MemoryEntry }) {
  return <span className="memory-source-label">{entry.source.page ? `E-Memory · Seite ${entry.source.page}` : entry.source.label || "Ergänzende Grundlagen"}</span>;
}

function MemoryEntryCard({ entry, onCalculate }: { entry: MemoryEntry; onCalculate: (id: FormulaId) => void }) {
  const calculator = entry.calculatorFormulaId && isFormulaId(entry.calculatorFormulaId) ? entry.calculatorFormulaId : null;
  return <details className="memory-entry" id={`memory-entry-${entry.id}`}>
    <summary><span><span className="memory-entry-kind">{entry.kind === "formula" ? "Formel" : entry.kind === "diagram" ? entry.diagram ? "Schaubild" : "Grafische Quellenreferenz" : "Nachschlagen"}</span><strong>{entry.title}</strong></span><ChevronDown size={18} aria-hidden="true" /></summary>
    <div className="memory-entry-body">
      {entry.formula && <div className="memory-equation" aria-label={`Formel: ${entry.formula}`}>{entry.formula.split(/;\s*/).map((part, index) => <span key={index}><MathText value={part} /></span>)}</div>}
      {entry.explanation && <p>{entry.explanation}</p>}
      {entry.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      {entry.diagram && <MemoryDiagram kind={entry.diagram} />}
      {entry.variables && entry.variables.length > 0 && <div className="memory-table-wrap"><table className="memory-variable-table"><caption>Grössen und Einheiten</caption><thead><tr><th>Zeichen</th><th>Grösse</th><th>Einheit</th></tr></thead><tbody>{entry.variables.map(variable => <tr key={`${variable.symbol}-${variable.label}`}><th scope="row"><MathText value={variable.symbol} /></th><td>{variable.label}</td><td>{variable.unit}</td></tr>)}</tbody></table></div>}
      {entry.table && <div className="memory-table-wrap"><table><thead><tr>{entry.table.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{entry.table.rows.map((row, index) => <tr key={index}>{row.map((value, cell) => cell === 0 ? <th key={cell} scope="row">{value}</th> : <td key={cell}>{value}</td>)}</tr>)}</tbody></table>{entry.table.note && <p className="memory-small">{entry.table.note}</p>}</div>}
      {entry.referenceValues && <div className="memory-table-wrap"><table><caption>Abgelesene Quellenwerte · aktuelle Normprüfung erforderlich</caption><thead><tr><th>Angabe</th><th>Wert in der Vorlage</th></tr></thead><tbody>{entry.referenceValues.map(value => <tr key={value.quantity}><th scope="row">{value.quantity}</th><td>{value.sourceValue}</td></tr>)}</tbody></table></div>}
      {entry.correction && <details className="memory-correction"><summary><Info size={14} />Präzisierung zur Vorlage</summary><div>{entry.sourceTranscription && <p>Gedruckt: <MathText value={entry.sourceTranscription} /></p>}<p>{entry.correction}</p></div></details>}
      {entry.conditions && entry.conditions.length > 0 && <div className="memory-conditions"><h4>Gilt unter diesen Voraussetzungen</h4><ul>{entry.conditions.map(condition => <li key={condition}>{condition}</li>)}</ul></div>}
      {entry.confidence === "needs-review" && <p className="memory-reference-note"><Info size={15} aria-hidden="true" />Normbezogene Quellenreferenz. Ausgabe, Grenzwerte und Geltungsbereich vor der Anwendung mit der aktuellen Fachquelle prüfen.</p>}
      <footer><SourceLabel entry={entry} />{calculator && <button type="button" className="memory-calculate" onClick={() => onCalculate(calculator)}><Calculator size={16} aria-hidden="true" />Mit Werten berechnen<ArrowUpRight size={14} aria-hidden="true" /></button>}</footer>
    </div>
  </details>;
}

export default function ElektroMemory({ onHome, onOpenTool, initialTab = "reference", initialFormulaId }: ElektroMemoryProps) {
  const [tab, setTab] = useState<"reference" | "calculator">(initialTab);
  const [formula, setFormula] = useState<FormulaId | undefined>(() => initialFormulaId && isFormulaId(initialFormulaId) ? initialFormulaId : undefined);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [entryQuery, setEntryQuery] = useState("");
  const [filter, setFilter] = useState<MemoryFilter>("all");
  const heading = useRef<HTMLHeadingElement>(null);
  const location = useToolhubLocation();
  const theme = useToolhubTheme();
  const selected = TOPICS.find(topic => topic.id === topicId);
  const topics = filterMemoryTopics(TOPICS, query, filter);
  const entries = selected ? filterMemoryEntries(selected, entryQuery) : [];
  const coverage = new Set(SOURCE_CATALOG.completeness.inventoriedPages).size;
  const formulaCount = SOURCE_CATALOG.topics.flatMap(topic => topic.entries).filter(entry => entry.kind === "formula").length;
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { if (initialFormulaId && isFormulaId(initialFormulaId)) setFormula(initialFormulaId); }, [initialFormulaId]);
  useEffect(() => { if (topicId) heading.current?.focus(); }, [topicId]);
  function calculate(id: FormulaId) { setFormula(id); setTab("calculator"); window.scrollTo({ top: 0, behavior: "smooth" }); }

  return <div className="electro-memory">
    <ToolhubHeader title="Elektro-Memory" onHome={onHome} onOpenTool={onOpenTool}
      parent={location === "formelrechner" ? { label: "Berechnungen", onClick: () => onOpenTool?.("berechnungen") } : undefined}>
      <button type="button" className="btn toolhub-theme" aria-label={theme.dark ? "Heller Modus" : "Dunkler Modus"} onClick={theme.toggle}>{theme.dark ? <Sun size={16} /> : <Moon size={16} />}<span>{theme.dark ? "Hell" : "Dunkel"}</span></button>
    </ToolhubHeader>
    <main className="memory-main">
      <header className="memory-hero"><div><span className="memory-eyebrow">Wissen griffbereit</span><h1>Elektro-Memory</h1><p>Nachschlagen. Verstehen. Direkt berechnen.</p></div><span className="memory-hero-symbol" aria-hidden="true"><Zap size={52} strokeWidth={1.3} /><span>U · I · R</span></span></header>
      <div className="memory-nav-row"><div className="memory-tabs" role="tablist" aria-label="Elektro-Memory Bereiche">
        <button type="button" id="memory-reference-tab" role="tab" aria-selected={tab === "reference"} aria-controls="memory-reference-panel" onClick={() => setTab("reference")}><BookOpen size={17} />Nachschlagen</button>
        <button type="button" id="memory-calculator-tab" role="tab" aria-selected={tab === "calculator"} aria-controls="memory-calculator-panel" onClick={() => setTab("calculator")}><Calculator size={17} />Formelrechner</button>
      </div><details className="memory-source-info"><summary><Info size={15} />Quelle & Umfang</summary><div><strong>Deine E-Memory-Vorlage</strong><p>{SOURCE_CATALOG.source?.file || "E-Memory_DE_PNG.pdf"} · {coverage}/{SOURCE_CATALOG.completeness.totalPages} Seiten erfasst · {formulaCount} Formeleinträge.</p><p>Texte und Formeln sind neu gesetzt. Normbezogene Angaben bleiben als Quellenreferenz gekennzeichnet. Die zusätzlichen Grundlagen sind separat ausgewiesen.</p>{SOURCE_CATALOG.source?.edition && <p>{SOURCE_CATALOG.source.edition}</p>}{SOURCE_CATALOG.completeness.notes?.map(note => <p key={note}>{note}</p>)}{SOURCE_CATALOG.findings && <details className="memory-source-findings"><summary>Fachliche Präzisierungen ({SOURCE_CATALOG.findings.length})</summary><ul>{SOURCE_CATALOG.findings.map(finding => <li key={finding.id}><strong>Seite {finding.page}:</strong> {finding.message}</li>)}</ul></details>}</div></details></div>
      <section id="memory-reference-panel" role="tabpanel" aria-labelledby="memory-reference-tab" hidden={tab !== "reference"}>
        {selected ? <article className="memory-article">
          <button type="button" className="memory-back" onClick={() => setTopicId(null)}><ArrowLeft size={16} />Alle Themen</button>
          <header className="memory-article-heading"><span className="memory-topic-icon"><TopicIcon topic={selected} size={27} /></span><div><span className="memory-topic-source">{memoryPagesLabel(selected.pages)}</span><h2 tabIndex={-1} ref={heading}>{selected.title}</h2>{selected.summary && <p>{selected.summary}</p>}</div></header>
          {entryQuery && <div className="memory-entry-search"><span>{entries.length} Einträge für «{entryQuery}»</span><button type="button" onClick={() => setEntryQuery("")}>Alle {selected.entries.length} Einträge anzeigen</button></div>}
          <div className="memory-article-layout"><div className="memory-entry-list">{entries.map(entry => <MemoryEntryCard entry={entry} key={entry.id} onCalculate={calculate} />)}</div><aside className="memory-article-aside"><BookOpen size={23} strokeWidth={1.5} /><h3>Schritt für Schritt</h3><p>Eintrag öffnen, Voraussetzungen lesen und bei einer Formel eigene Werte einsetzen.</p><span>{selected.entries.length} Einträge</span>{selected.pages.length > 0 && <span>Vorlage: Seite {selected.pages.join(", ")}</span>}<button type="button" onClick={() => setTab("calculator")}><Calculator size={16} />Zum Formelrechner</button></aside></div>
        </article> : <>
          <div className="memory-search-row"><label className="memory-search"><Search size={19} aria-hidden="true" /><input type="search" aria-label="Elektro-Memory durchsuchen" placeholder="Thema, Formel oder Einheit suchen …" value={query} onChange={event => setQuery(event.target.value)} /><span aria-label={`${topics.length} Themen`}>{topics.length}</span></label><div className="memory-filter" role="group" aria-label="Themen filtern">{FILTERS.map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div></div>
          {!query && filter === "all" && <div className="memory-quick"><span><Calculator size={18} />Schnell berechnen</span>{(["ohm", "leistung-3p", "leiterwiderstand", "energie"] as FormulaId[]).map((id, index) => <button type="button" key={id} onClick={() => calculate(id)}>{["Ohmsches Gesetz", "Drehstromleistung", "Leiterwiderstand", "Energie"][index]}<ArrowUpRight size={14} /></button>)}</div>}
          <div className="memory-topic-grid">{topics.map(topic => <button type="button" className={`memory-topic-card ${topic.group === "basics" ? "is-basic" : ""}`} key={topic.id} onClick={() => { setTopicId(topic.id); setEntryQuery(query.trim()); }}><div><span className="memory-topic-icon"><TopicIcon topic={topic} /></span><ArrowUpRight size={17} aria-hidden="true" /></div><h2>{topic.title}</h2><p>{topic.summary}</p><footer><span>{topic.entries.length} Einträge</span><span>{memoryPagesLabel(topic.pages)}</span></footer></button>)}</div>
          {topics.length === 0 && <div className="memory-empty" role="status"><Search size={30} strokeWidth={1.3} /><h2>Kein passendes Thema</h2><p>Versuche einen anderen Begriff oder entferne den Filter.</p><button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>Suche zurücksetzen</button></div>}
          <footer className="memory-overview-footer"><span>{coverage} PDF-Seiten als strukturierte Nachschlagethemen</span><span>Formelrechner und Wissens-Hub bleiben direkt erreichbar.</span></footer>
        </>}
      </section>
      <section id="memory-calculator-panel" className="memory-calculator-panel" role="tabpanel" aria-labelledby="memory-calculator-tab" hidden={tab !== "calculator"}>
        <div className="memory-calculator-intro"><span className="memory-topic-icon"><Calculator size={22} /></span><div><h2>Formelrechner</h2><p>Teil des Elektro-Memory · eigene Werte einsetzen und Rechenweg nachvollziehen.</p></div></div>
        <FormulaCalculator initialFormula={formula} onFormulaChange={setFormula} />
      </section>
    </main>
  </div>;
}
