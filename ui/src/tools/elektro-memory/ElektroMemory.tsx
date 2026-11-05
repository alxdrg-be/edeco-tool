import { useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, ArrowUpRight, Bath, BookOpen, Cable, Calculator, ChevronDown, Earth, HardHat, HeartPulse, Info, Layers, Moon, Plug, Ruler, ScanLine, Search, ShieldCheck, Star, Sun, Zap } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import ToolhubHeader from "../../toolbox/ToolhubHeader";
import { useToolhubLocation } from "../../toolbox/ToolhubNavigation";
import { useToolhubTheme } from "../../toolbox/useToolhubTheme";
import { FormulaCalculator } from "../berechnungen/Berechnungen";
import { isFormulaId, type FormulaId } from "../berechnungen/formulaCatalog";
import { BASIC_TOPICS } from "./basics";
import { SOURCE_CATALOG } from "./sourceCatalog";
import { filterMemoryEntries, filterMemoryTopics, memoryPagesLabel, referenceMemoryTopics, type MemoryFilter } from "./memorySearch";
import type { MemoryEntry, MemoryTopic } from "./types";
import MemoryDiagram from "./MemoryDiagram";
import { BathReference, IpDecoder, MemoryReferenceShortcuts, SwissSocketGuide } from "./MemoryReferenceTools";
import { readMemoryFavorites } from "./memoryReference";
import { isNumberedTitle, memoryListItems } from "./memoryText";
import "./elektro-memory.css";

export interface ElektroMemoryProps extends ToolProps { initialTab?: "reference" | "calculator"; initialFormulaId?: string }
const TOPICS = referenceMemoryTopics([...SOURCE_CATALOG.topics, ...BASIC_TOPICS]);
const SOURCE_NOTES = SOURCE_CATALOG.topics.flatMap(topic => topic.entries).filter(entry => entry.presentation === "source-note");
const FILTERS: [MemoryFilter, string][] = [["all", "Alle"], ["formulas", "Formeln"], ["reference", "Schutz & Normen"], ["basics", "Grundlagen"]];
const FAVORITES_KEY = "edeco-memory-favorites-v1";

function TopicIcon({ topic, size = 22 }: { topic: MemoryTopic; size?: number }) {
  const sourceIcons = { "em-emergency": HeartPulse, "em-safety-rules": HardHat, "em-testing": ScanLine, "em-short-circuit-rules": Zap,
    "em-protective-devices": ShieldCheck, "em-earthing": Earth, "em-spd-conduits": Zap, "em-conduits": Cable, "em-asbestos": HardHat, "em-bathroom": Bath,
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
  const list = entry.explanation ? memoryListItems(entry.explanation) : null;
  return <details className="memory-entry" id={`memory-entry-${entry.id}`}>
    <summary><span>{entry.kind !== "reference" && <span className="memory-entry-kind">{entry.kind === "formula" ? "Formel" : entry.diagram ? "Schaubild" : "Grafische Quellenreferenz"}</span>}<strong>{entry.title}</strong></span><ChevronDown size={18} aria-hidden="true" /></summary>
    <div className="memory-entry-body">
      {entry.formula && <div className="memory-equation" aria-label={`Formel: ${entry.formula}`}>{entry.formula.split(/;\s*/).map((part, index) => <span key={index}><MathText value={part} /></span>)}</div>}
      {entry.explanation && (list ? isNumberedTitle(entry.title) ? <ol className="memory-steps">{list.map(item => <li key={item}>{item}</li>)}</ol> : <ul className="memory-points">{list.map(item => <li key={item}>{item}</li>)}</ul> : <p>{entry.explanation}</p>)}
      {entry.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
      {entry.diagram && <MemoryDiagram kind={entry.diagram} />}
      {entry.variables && entry.variables.length > 0 && <div className="memory-table-wrap"><table className="memory-variable-table"><caption>Grössen und Einheiten</caption><thead><tr><th>Zeichen</th><th>Grösse</th><th>Einheit</th></tr></thead><tbody>{entry.variables.map(variable => <tr key={`${variable.symbol}-${variable.label}`}><th scope="row"><MathText value={variable.symbol} /></th><td>{variable.label}</td><td>{variable.unit}</td></tr>)}</tbody></table></div>}
      {entry.table && <div className="memory-table-wrap"><table><thead><tr>{entry.table.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{entry.table.rows.map((row, index) => <tr key={index}>{row.map((value, cell) => cell === 0 ? <th key={cell} scope="row">{value}</th> : <td key={cell}>{value}</td>)}</tr>)}</tbody></table>{entry.table.note && <p className="memory-small">{entry.table.note}</p>}</div>}
      {entry.referenceValues && <div className="memory-table-wrap"><table><caption>Abgelesene Quellenwerte · aktuelle Normprüfung erforderlich</caption><thead><tr><th>Angabe</th><th>Wert in der Vorlage</th></tr></thead><tbody>{entry.referenceValues.map(value => <tr key={value.quantity}><th scope="row">{value.quantity}</th><td>{value.sourceValue}</td></tr>)}</tbody></table></div>}
      {entry.correction && <details className="memory-correction"><summary><Info size={14} />Präzisierung zur Vorlage</summary><div>{entry.sourceTranscription && <p>Gedruckt: <MathText value={entry.sourceTranscription} /></p>}<p>{entry.correction}</p></div></details>}
      {entry.conditions && entry.conditions.length > 0 && <details className="memory-conditions"><summary><Info size={13} aria-hidden="true" />Voraussetzungen ({entry.conditions.length})</summary><ul>{entry.conditions.map(condition => <li key={condition}>{condition}</li>)}</ul></details>}
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
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return readMemoryFavorites(localStorage.getItem(FAVORITES_KEY), TOPICS.map(topic => topic.id)); }
    catch { return []; }
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const entryList = useRef<HTMLDivElement>(null);
  function setAllOpen(open: boolean) { entryList.current?.querySelectorAll<HTMLDetailsElement>(":scope > details.memory-entry").forEach(item => { item.open = open; }); }
  const topicButtons = useRef(new Map<string, HTMLButtonElement>());
  const overviewScroll = useRef(0);
  const overviewTopic = useRef<string | null>(null);
  const location = useToolhubLocation();
  const theme = useToolhubTheme();
  const selected = TOPICS.find(topic => topic.id === topicId);
  const topics = filterMemoryTopics(TOPICS, query, filter).filter(topic => !favoritesOnly || favorites.includes(topic.id));
  const entries = selected ? filterMemoryEntries(selected, entryQuery) : [];
  const coverage = new Set(SOURCE_CATALOG.completeness.inventoriedPages).size;
  const formulaCount = SOURCE_CATALOG.topics.flatMap(topic => topic.entries).filter(entry => entry.kind === "formula").length;
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { if (initialFormulaId && isFormulaId(initialFormulaId)) setFormula(initialFormulaId); }, [initialFormulaId]);
  useEffect(() => { if (topicId) heading.current?.focus(); }, [topicId]);
  useEffect(() => { try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)); } catch { /* Reference tools still work when browser storage is unavailable. */ } }, [favorites]);
  function toggleFavorite(id: string) { setFavorites(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); }
  function calculate(id: FormulaId) { setFormula(id); setTab("calculator"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function openTopic(id: string) {
    if (!topicId) { overviewScroll.current = window.scrollY; overviewTopic.current = id; }
    setEntryQuery(topicId ? "" : query.trim());
    setTopicId(id);
  }
  function returnToTopics() {
    const previous = overviewTopic.current ?? topicId;
    setTopicId(null);
    requestAnimationFrame(() => {
      window.scrollTo({ top: overviewScroll.current, behavior: "instant" });
      if (previous) topicButtons.current.get(previous)?.focus({ preventScroll: true });
    });
  }

  return <div className="electro-memory">
    <ToolhubHeader title="Elektro-Memory" onHome={onHome} onOpenTool={onOpenTool}
      parent={location === "formelrechner" ? { label: "Berechnungen", onClick: () => onOpenTool?.("berechnungen") } : undefined}>
      <button type="button" className="btn toolhub-theme" aria-label={theme.dark ? "Heller Modus" : "Dunkler Modus"} onClick={theme.toggle}>{theme.dark ? <Sun size={16} /> : <Moon size={16} />}<span>{theme.dark ? "Hell" : "Dunkel"}</span></button>
    </ToolhubHeader>
    <main className={`memory-main${selected && tab === "reference" ? " is-reading" : ""}`}>
      <header className="memory-hero"><div><span className="memory-eyebrow">Wissen griffbereit</span><h1>Elektro-Memory</h1><p>Nachschlagen. Verstehen. Direkt berechnen.</p></div><span className="memory-hero-symbol" aria-hidden="true"><Zap size={52} strokeWidth={1.3} /><span>U · I · R</span></span></header>
      <div className="memory-nav-row"><div className="memory-tabs" role="tablist" aria-label="Elektro-Memory Bereiche">
        <button type="button" id="memory-reference-tab" role="tab" aria-selected={tab === "reference"} aria-controls="memory-reference-panel" onClick={() => setTab("reference")}><BookOpen size={17} />Nachschlagen</button>
        <button type="button" id="memory-calculator-tab" role="tab" aria-selected={tab === "calculator"} aria-controls="memory-calculator-panel" onClick={() => setTab("calculator")}><Calculator size={17} />Formelrechner</button>
      </div><details className="memory-source-info"><summary><Info size={15} />Quelle & Umfang</summary><div><strong>Deine E-Memory-Vorlage</strong><p>{SOURCE_CATALOG.source?.file || "E-Memory_DE_PNG.pdf"} · {coverage}/{SOURCE_CATALOG.completeness.totalPages} Seiten erfasst · {formulaCount} Formeleinträge.</p><p>Texte und Formeln sind neu gesetzt. Normbezogene Angaben bleiben als Quellenreferenz gekennzeichnet. Die zusätzlichen Grundlagen sind separat ausgewiesen.</p>{SOURCE_CATALOG.source?.edition && <p>{SOURCE_CATALOG.source.edition}</p>}{SOURCE_CATALOG.completeness.notes?.map(note => <p key={note}>{note}</p>)}{SOURCE_NOTES.length > 0 && <details className="memory-source-print"><summary>Druckvorlage & Impressum ({SOURCE_NOTES.length})</summary><p>Diese Angaben gehören zum gedruckten Original und erscheinen deshalb hier statt als digitale Facheinträge.</p>{SOURCE_NOTES.map(entry => <div key={entry.id}><strong>{entry.title} · Seite {entry.source.page}</strong><p>{entry.explanation}</p></div>)}</details>}{SOURCE_CATALOG.findings && <details className="memory-source-findings"><summary>Fachliche Präzisierungen ({SOURCE_CATALOG.findings.length})</summary><ul>{SOURCE_CATALOG.findings.map(finding => <li key={finding.id}><strong>Seite {finding.page}:</strong> {finding.message}</li>)}</ul></details>}</div></details></div>
      <section id="memory-reference-panel" role="tabpanel" aria-labelledby="memory-reference-tab" hidden={tab !== "reference"}>
        {selected ? <article className="memory-article">
          <nav className="memory-article-navigation" aria-label="Memory-Themennavigation">
            <button type="button" className="memory-back" onClick={returnToTopics}><ArrowLeft size={18} aria-hidden="true" />Alle Themen</button>
            <button type="button" className="memory-favorite" aria-pressed={favorites.includes(selected.id)} onClick={() => toggleFavorite(selected.id)}><Star size={17} aria-hidden="true" />{favorites.includes(selected.id) ? "Als Favorit gespeichert" : "Als Favorit merken"}</button>
            <label className="memory-topic-switch"><span>Thema wechseln</span><select aria-label="Thema wechseln" value={selected.id} onChange={event => openTopic(event.target.value)}>{TOPICS.map(topic => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label>
          </nav>
          <header className="memory-article-heading"><span className="memory-topic-icon"><TopicIcon topic={selected} size={27} /></span><div><span className="memory-topic-source">{memoryPagesLabel(selected.pages)}</span><h2 tabIndex={-1} ref={heading}>{selected.title}</h2>{selected.summary && <p>{selected.summary}</p>}</div></header>
          {entryQuery && entries.length < selected.entries.length && <div className="memory-entry-search"><span>{entries.length} Einträge für «{entryQuery}»</span><button type="button" onClick={() => setEntryQuery("")}>Alle {selected.entries.length} Einträge anzeigen</button></div>}
          <div className="memory-article-layout">
            <nav className="memory-article-toc" aria-label="Inhalt dieses Themas">
              <strong>Inhalt</strong>
              <ol>{entries.map(entry => <li key={entry.id}><a href={`#memory-entry-${entry.id}`} onClick={event => { event.preventDefault(); const target = document.getElementById(`memory-entry-${entry.id}`) as HTMLDetailsElement | null; if (target) { target.open = true; target.scrollIntoView({ behavior: "smooth", block: "start" }); target.querySelector("summary")?.focus({ preventScroll: true }); } }}>{entry.title}</a></li>)}</ol>
              <div className="memory-toc-actions"><button type="button" onClick={() => setAllOpen(true)}>Alle öffnen</button><button type="button" onClick={() => setAllOpen(false)}>Alle schliessen</button></div>
            </nav>
            <div className="memory-article-content">
              {selected.id === "em-swiss-connectors" && <SwissSocketGuide />}
              {selected.id === "em-ip-symbols" && <IpDecoder />}
              {selected.id === "em-bathroom" && <BathReference />}
              <div className="memory-entry-list" ref={entryList}>{entries.map(entry => <MemoryEntryCard entry={entry} key={entry.id} onCalculate={calculate} />)}</div>
            </div>
          </div>
        </article> : <>
          <div className="memory-search-row"><label className="memory-search"><Search size={19} aria-hidden="true" /><input type="search" aria-label="Elektro-Memory durchsuchen" placeholder="Thema, Formel oder Einheit suchen …" value={query} onChange={event => setQuery(event.target.value)} /><span aria-label={`${topics.length} Themen`}>{topics.length}</span></label><div className="memory-reference-actions"><button type="button" className="memory-favorite" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Star size={16} aria-hidden="true" />Favoriten{favorites.length > 0 ? ` (${favorites.length})` : ""}</button><button type="button" className="memory-emergency" onClick={() => openTopic("em-emergency")}><HeartPulse size={17} aria-hidden="true" />Notfall · 144</button></div></div>
          <div className="memory-filter" role="group" aria-label="Themen filtern">{FILTERS.map(([id, label]) => <button type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}</div>
          {!query && filter === "all" && !favoritesOnly && <MemoryReferenceShortcuts onOpenTopic={openTopic} />}
          {!query && filter === "all" && <div className="memory-quick"><span><Calculator size={18} />Schnell berechnen</span>{(["ohm", "leistung-3p", "leiterwiderstand", "energie"] as FormulaId[]).map((id, index) => <button type="button" key={id} onClick={() => calculate(id)}>{["Ohmsches Gesetz", "Drehstromleistung", "Leiterwiderstand", "Energie"][index]}<ArrowUpRight size={14} /></button>)}</div>}
          <div className="memory-topic-grid">{topics.map(topic => <button type="button" className={`memory-topic-card ${topic.group === "basics" ? "is-basic" : ""}`} key={topic.id} ref={node => { if (node) topicButtons.current.set(topic.id, node); else topicButtons.current.delete(topic.id); }} onClick={() => openTopic(topic.id)}><div><span className="memory-topic-icon"><TopicIcon topic={topic} /></span><ArrowUpRight size={17} aria-hidden="true" /></div><h2>{topic.title}</h2><p>{topic.summary}</p><footer><span>{topic.entries.length} Einträge</span><span>{memoryPagesLabel(topic.pages)}</span></footer></button>)}</div>
          {topics.length === 0 && <div className="memory-empty" role="status"><Search size={30} strokeWidth={1.3} /><h2>{favoritesOnly && favorites.length === 0 ? "Noch keine Favoriten" : "Kein passendes Thema"}</h2><p>{favoritesOnly && favorites.length === 0 ? "Öffne ein Thema und wähle «Als Favorit merken»." : "Versuche einen anderen Begriff oder entferne den Filter."}</p><button type="button" onClick={() => { setQuery(""); setFilter("all"); setFavoritesOnly(false); }}>Suche zurücksetzen</button></div>}
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
