import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Bath, BookOpen, Cable, Calculator, Earth, HardHat, HeartPulse, Info, Layers, Moon, Printer, ScanLine, Search, ShieldCheck, Sigma, Sun, X, Zap } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import ToolhubHeader from "../../toolbox/ToolhubHeader";
import { useToolhubLocation } from "../../toolbox/ToolhubNavigation";
import { useToolhubTheme } from "../../toolbox/useToolhubTheme";
import { FormulaCalculator } from "../berechnungen/Berechnungen";
import { isFormulaId, type FormulaId } from "../berechnungen/formulaCatalog";
import { BASIC_TOPICS } from "./basics";
import { SOURCE_CATALOG } from "./sourceCatalog";
import { memoryEntryMatches } from "./memorySearch";
import type { MemoryEntry } from "./types";
import MemoryDiagram from "./MemoryDiagram";
import { IpDecoder, SwissSocketGuide } from "./MemoryReferenceTools";
import { entryVisual } from "./MemoryVisuals";
import { MEMORY_CONTENT, type MemoryContent } from "./memoryContent";
import { EMERGENCY_CHAPTER, MEMORY_CHAPTERS, type MemoryChapter } from "./chapters";
import { isNumberedTitle, memoryListItems } from "./memoryText";
import "./elektro-memory.css";

export interface ElektroMemoryProps extends ToolProps { initialTab?: "reference" | "calculator"; initialFormulaId?: string }
const ENTRIES = new Map([...SOURCE_CATALOG.topics, ...BASIC_TOPICS].flatMap(topic => topic.entries).map(entry => [entry.id, entry]));
const SOURCE_NOTES = SOURCE_CATALOG.topics.flatMap(topic => topic.entries).filter(entry => entry.presentation === "source-note");
const CHAPTER_KEY = "edeco.memory.chapter";
const chapterEntries = (chapter: MemoryChapter) => chapter.entries.map(id => ENTRIES.get(id)).filter((entry): entry is MemoryEntry => Boolean(entry));
const ICONS = { emergency: HeartPulse, safety: HardHat, testing: ScanLine, protection: ShieldCheck, earthing: Earth, bath: Bath, conduits: Cable,
  surge: Zap, ip: ShieldCheck, formulas: Sigma, basics: Layers } as const;

function ChapterIcon({ chapter, size = 18 }: { chapter: MemoryChapter; size?: number }) {
  const Icon = ICONS[chapter.icon] ?? BookOpen;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
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
  const section = entry.source.page && entry.source.section ? ` · ${entry.source.section}` : "";
  return <span className="memory-source-label">{entry.source.page ? `E-Memory S. ${entry.source.page}${section}` : entry.source.label || "Ergänzende Grundlagen"}</span>;
}

function ContentBlock({ content, numbered }: { content: MemoryContent; numbered: boolean }) {
  return <>
    {content.lead && <p className="memory-lead">{content.lead}</p>}
    {content.steps && (numbered || content.steps.length > 2 ? <ol className="memory-steps">{content.steps.map(item => <li key={item}>{item}</li>)}</ol> : <ul className="memory-points">{content.steps.map(item => <li key={item}>{item}</li>)}</ul>)}
    {content.points && <ul className="memory-points">{content.points.map(item => <li key={item}>{item}</li>)}</ul>}
    {content.groups && <div className="memory-groups">{content.groups.map(group => <section key={group.title}><h4>{group.title}</h4><ul className="memory-points">{group.items.map(item => <li key={item}>{item}</li>)}</ul></section>)}</div>}
    {content.table && <div className="memory-table-wrap"><table><thead><tr>{content.table.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{content.table.rows.map(row => <tr key={row.join("|")}>{row.map((value, cell) => cell === 0 ? <th key={cell} scope="row">{value}</th> : <td key={cell}>{value}</td>)}</tr>)}</tbody></table></div>}
    {content.note && <p className="memory-small">{content.note}</p>}
  </>;
}

/** One reference card, always open: everything of an entry is readable without a click. */
function MemoryCard({ entry, chapterTitle, onCalculate }: { entry: MemoryEntry; chapterTitle?: string; onCalculate: (id: FormulaId) => void }) {
  const calculator = entry.calculatorFormulaId && isFormulaId(entry.calculatorFormulaId) ? entry.calculatorFormulaId : null;
  const list = entry.explanation ? memoryListItems(entry.explanation) : null;
  const visual = entryVisual(entry);
  const content = MEMORY_CONTENT[entry.id];
  const wide = Boolean(entry.table && entry.table.headers.length > 3) || Boolean(visual);
  return <article className={`memory-card${wide ? " is-wide" : ""}`} id={`memory-entry-${entry.id}`} aria-labelledby={`memory-title-${entry.id}`}>
    <header>{chapterTitle && <span className="memory-card-chapter">{chapterTitle}</span>}<h3 id={`memory-title-${entry.id}`}>{entry.title}</h3></header>
    {entry.formula && <div className="memory-equation" aria-label={`Formel: ${entry.formula}`}>{entry.formula.split(/;\s*/).map((part, index) => <span key={index}><MathText value={part} /></span>)}</div>}
    {content && <ContentBlock content={content} numbered={isNumberedTitle(entry.title)} />}
    {entry.explanation && !content && (list ? isNumberedTitle(entry.title) ? <ol className="memory-steps">{list.map(item => <li key={item}>{item}</li>)}</ol> : <ul className="memory-points">{list.map(item => <li key={item}>{item}</li>)}</ul> : <p>{entry.explanation}</p>)}
    {entry.paragraphs?.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
    {visual?.node}
    {entry.diagram && <MemoryDiagram kind={entry.diagram} />}
    {entry.variables && entry.variables.length > 0 && <div className="memory-table-wrap"><table className="memory-variable-table"><caption>Grössen und Einheiten</caption><thead><tr><th>Zeichen</th><th>Grösse</th><th>Einheit</th></tr></thead><tbody>{entry.variables.map(variable => <tr key={`${variable.symbol}-${variable.label}`}><th scope="row"><MathText value={variable.symbol} /></th><td>{variable.label}</td><td>{variable.unit}</td></tr>)}</tbody></table></div>}
    {entry.table && !visual?.replacesTable && <div className="memory-table-wrap"><table><thead><tr>{entry.table.headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{entry.table.rows.map((row, index) => <tr key={index}>{row.map((value, cell) => cell === 0 ? <th key={cell} scope="row">{value}</th> : <td key={cell}>{value}</td>)}</tr>)}</tbody></table>{entry.table.note && <p className="memory-small">{entry.table.note}</p>}</div>}
    {entry.referenceValues && <div className="memory-table-wrap"><table><caption>Werte in der Vorlage</caption><thead><tr><th>Angabe</th><th>Wert</th></tr></thead><tbody>{entry.referenceValues.map(value => <tr key={value.quantity}><th scope="row">{value.quantity}</th><td>{value.sourceValue}</td></tr>)}</tbody></table></div>}
    {entry.correction && <div className="memory-correction" role="note"><strong><Info size={14} aria-hidden="true" />Präzisierung zur Vorlage</strong><p>{entry.correction}</p>{entry.sourceTranscription && <p className="memory-small">Gedruckt: <MathText value={entry.sourceTranscription} /></p>}</div>}
    {entry.conditions && entry.conditions.length > 0 && <ul className="memory-conditions" aria-label="Beachten">{entry.conditions.map(condition => <li key={condition}>{condition}</li>)}</ul>}
    <footer><SourceLabel entry={entry} />{calculator && <button type="button" className="memory-calculate" onClick={() => onCalculate(calculator)}><Calculator size={16} aria-hidden="true" />Mit Werten berechnen<ArrowUpRight size={14} aria-hidden="true" /></button>}</footer>
  </article>;
}

function readChapter(): string {
  try { const saved = localStorage.getItem(CHAPTER_KEY); return MEMORY_CHAPTERS.some(chapter => chapter.id === saved) ? saved! : MEMORY_CHAPTERS[0].id; }
  catch { return MEMORY_CHAPTERS[0].id; }
}

export default function ElektroMemory({ onHome, onOpenTool, initialTab = "reference", initialFormulaId }: ElektroMemoryProps) {
  const [tab, setTab] = useState<"reference" | "calculator">(initialTab);
  const [formula, setFormula] = useState<FormulaId | undefined>(() => initialFormulaId && isFormulaId(initialFormulaId) ? initialFormulaId : undefined);
  const [chapterId, setChapterId] = useState(readChapter);
  const [query, setQuery] = useState("");
  const pageTop = useRef<HTMLDivElement>(null);
  const location = useToolhubLocation();
  const theme = useToolhubTheme();
  const chapter = MEMORY_CHAPTERS.find(item => item.id === chapterId) ?? MEMORY_CHAPTERS[0];
  const searching = query.trim().length > 0;
  const hits = useMemo(() => searching ? MEMORY_CHAPTERS.map(item => ({ chapter: item, entries: chapterEntries(item).filter(entry => memoryEntryMatches(entry, query, item.title)) })) : [], [query, searching]);
  const hitCount = hits.reduce((sum, item) => sum + item.entries.length, 0);
  const coverage = new Set(SOURCE_CATALOG.completeness.inventoriedPages).size;
  const formulaCount = SOURCE_CATALOG.topics.flatMap(topic => topic.entries).filter(entry => entry.kind === "formula").length;
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { if (initialFormulaId && isFormulaId(initialFormulaId)) setFormula(initialFormulaId); }, [initialFormulaId]);
  useEffect(() => { try { localStorage.setItem(CHAPTER_KEY, chapterId); } catch { /* the chapter is only a convenience */ } }, [chapterId]);
  function calculate(id: FormulaId) { setFormula(id); setTab("calculator"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function openChapter(id: string) {
    setChapterId(id); setQuery(""); setTab("reference");
    requestAnimationFrame(() => pageTop.current?.scrollIntoView({ block: "start", behavior: "instant" }));
  }

  return <div className="electro-memory">
    <ToolhubHeader title="Elektro-Memory" onHome={onHome} onOpenTool={onOpenTool}
      parent={location === "formelrechner" ? { label: "Berechnungen", onClick: () => onOpenTool?.("berechnungen") } : undefined}>
      <button type="button" className="btn toolhub-theme" aria-label={theme.dark ? "Heller Modus" : "Dunkler Modus"} onClick={theme.toggle}>{theme.dark ? <Sun size={16} /> : <Moon size={16} />}<span>{theme.dark ? "Hell" : "Dunkel"}</span></button>
    </ToolhubHeader>
    <main className="memory-main">
      <header className="memory-topbar">
        <h1>Elektro-Memory</h1>
        <div className="memory-tabs" role="tablist" aria-label="Elektro-Memory Bereiche">
          <button type="button" id="memory-reference-tab" role="tab" aria-selected={tab === "reference"} aria-controls="memory-reference-panel" onClick={() => setTab("reference")}><BookOpen size={17} />Nachschlagen</button>
          <button type="button" id="memory-calculator-tab" role="tab" aria-selected={tab === "calculator"} aria-controls="memory-calculator-panel" onClick={() => setTab("calculator")}><Calculator size={17} />Formelrechner</button>
        </div>
        <button type="button" className="memory-emergency" onClick={() => openChapter(EMERGENCY_CHAPTER)}><HeartPulse size={16} aria-hidden="true" />Notfall · 144</button>
        <details className="memory-source-info"><summary><Info size={15} />Quelle & Umfang</summary><div><strong>Deine E-Memory-Vorlage</strong><p>{SOURCE_CATALOG.source?.file || "E-Memory_DE_PNG.pdf"} · {coverage}/{SOURCE_CATALOG.completeness.totalPages} Seiten erfasst · {formulaCount} Formeleinträge.</p><p>Texte und Formeln sind neu gesetzt. Normbezogene Angaben bleiben als Quellenreferenz gekennzeichnet. Die zusätzlichen Grundlagen sind separat ausgewiesen.</p>{SOURCE_CATALOG.source?.edition && <p>{SOURCE_CATALOG.source.edition}</p>}{SOURCE_CATALOG.completeness.notes?.map(note => <p key={note}>{note}</p>)}{SOURCE_NOTES.length > 0 && <details className="memory-source-print"><summary>Druckvorlage & Impressum ({SOURCE_NOTES.length})</summary><p>Diese Angaben gehören zum gedruckten Original und erscheinen deshalb hier statt als digitale Facheinträge.</p>{SOURCE_NOTES.map(entry => <div key={entry.id}><strong>{entry.title} · Seite {entry.source.page}</strong><p>{entry.explanation}</p></div>)}</details>}{SOURCE_CATALOG.findings && <details className="memory-source-findings"><summary>Fachliche Präzisierungen ({SOURCE_CATALOG.findings.length})</summary><ul>{SOURCE_CATALOG.findings.map(finding => <li key={finding.id}><strong>Seite {finding.page}:</strong> {finding.message}</li>)}</ul></details>}</div></details>
      </header>
      <section id="memory-reference-panel" className="memory-reference-layout" role="tabpanel" aria-labelledby="memory-reference-tab" hidden={tab !== "reference"}>
        <aside className="memory-sidebar" aria-label="Kapitel">
          <label className="memory-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Elektro-Memory durchsuchen" placeholder="Suchen, z. B. RCD, IPX4, Riso" value={query} onChange={event => setQuery(event.target.value)} />{searching && <button type="button" aria-label="Suche leeren" onClick={() => setQuery("")}><X size={15} /></button>}</label>
          <nav aria-label="Kapitel des Elektro-Memory">
            {[["E-Memory", MEMORY_CHAPTERS.filter(item => item.number)], ["Weitere Themen", MEMORY_CHAPTERS.filter(item => !item.number)]].map(([label, items]) => <div className="memory-chapter-group" key={label as string}>
              <span>{label as string}</span>
              <ol>{(items as MemoryChapter[]).map(item => {
                const count = hits.find(hit => hit.chapter.id === item.id)?.entries.length ?? 0;
                return <li key={item.id}><button type="button" aria-current={!searching && item.id === chapter.id ? "page" : undefined} className={searching && !count ? "is-empty" : undefined} onClick={() => openChapter(item.id)}>
                  <span className="memory-chapter-icon">{item.number ?? <ChapterIcon chapter={item} size={15} />}</span><span>{item.title}</span>{searching && <em>{count}</em>}
                </button></li>;
              })}</ol>
            </div>)}
          </nav>
        </aside>
        <div className="memory-page" ref={pageTop}>
          {searching ? <>
            <header className="memory-page-head"><h2>{hitCount ? `${hitCount} Treffer für «${query.trim()}»` : `Kein Treffer für «${query.trim()}»`}</h2><p>{hitCount ? "Alle Kapitel durchsucht. Kapitel links öffnet die ganze Seite." : "Anderen Begriff, eine Einheit oder eine Zahl versuchen, zum Beispiel «Riso», «IPX4» oder «M20»."}</p></header>
            <div className="memory-cards">{hits.flatMap(hit => hit.entries.map(entry => <MemoryCard key={entry.id} entry={entry} chapterTitle={hit.chapter.title} onCalculate={calculate} />))}</div>
          </> : <>
            <header className="memory-page-head"><span className="memory-page-icon"><ChapterIcon chapter={chapter} size={24} /></span><div><span className="memory-page-number">{chapter.number ? `Kapitel ${chapter.number}` : "Weitere Themen"}</span><h2>{chapter.title}</h2><p>{chapter.short}</p></div>
              <button type="button" className="memory-print" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />Kapitel drucken</button></header>
            <p className="memory-print-source">edeco Toolhub · Elektro-Memory · nach E-Memory EIT.swiss, 1. Auflage 2025 · gedruckt {new Date().toLocaleDateString("de-CH")}</p>
            {chapter.tool === "sockets" && <SwissSocketGuide />}
            {chapter.tool === "ip" && <IpDecoder />}
            <div className="memory-cards">{chapterEntries(chapter).map(entry => <MemoryCard key={entry.id} entry={entry} onCalculate={calculate} />)}</div>
          </>}
        </div>
      </section>
      <section id="memory-calculator-panel" className="memory-calculator-panel" role="tabpanel" aria-labelledby="memory-calculator-tab" hidden={tab !== "calculator"}>
        <FormulaCalculator initialFormula={formula} onFormulaChange={setFormula} />
      </section>
    </main>
  </div>;
}
