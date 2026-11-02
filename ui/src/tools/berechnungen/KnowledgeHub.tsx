import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronDown, Search } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import { TOOLS } from "../../toolbox/catalog";
import { LabShell } from "./LabUI";
import CalculatorIcon from "./CalculatorIcon";
import { KNOWLEDGE_TOPICS } from "./knowledgeData";
import "./calculator-catalog.css";

function selectedTopic() {
  const id = window.location.hash.match(/^#wissen(?:\/([a-z0-9-]+))?$/)?.[1];
  return KNOWLEDGE_TOPICS.find(topic => topic.id === id);
}

export default function KnowledgeHub({ onHome, onOpenTool }: ToolProps) {
  const [topic, setTopic] = useState(selectedTopic), [query, setQuery] = useState("");
  const articleHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const update = () => { setTopic(selectedTopic()); setQuery(""); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => { articleHeading.current?.focus(); }, [topic]);
  let returnId = "berechnungen";
  try {
    const saved = sessionStorage.getItem("edeco-knowledge-return");
    if (saved && TOOLS.some(tool => tool.id === saved && tool.status === "available")) returnId = saved;
  } catch { /* Back to the overview when storage is unavailable. */ }
  const returnTitle = TOOLS.find(tool => tool.id === returnId)?.title ?? "Berechnungen";
  const words = query.toLocaleLowerCase("de-CH").trim().split(/\s+/).filter(Boolean);
  const topics = KNOWLEDGE_TOPICS.filter(item => words.every(word => `${item.title} ${item.description} ${item.sections.map(section => `${section.title} ${section.text}`).join(" ")}`.toLocaleLowerCase("de-CH").includes(word)));
  const sourceGroups = topic ? [
    { title: "Normen & Fachquellen", sources: topic.sources.filter(source => !source.href.startsWith("https://www.elektro-rechner.ch/")) },
    { title: "Vergleichsdaten · elektro-rechner.ch", sources: topic.sources.filter(source => source.href.startsWith("https://www.elektro-rechner.ch/")) },
  ] : [];

  return <LabShell onHome={onHome} onOpenTool={onOpenTool} title="Wissens-Hub" subtitle="Grundlagen für die Schweizer Elektroplanung" help={null} setHelp={() => undefined}>
    <div className="knowledge-hub">
      <nav className="knowledge-breadcrumb" aria-label="Wissensnavigation">
        <button type="button" onClick={() => onOpenTool?.(returnId)}><ArrowLeft size={16} />{returnTitle}</button>
        {topic && <a href="#wissen">Alle Wissensthemen</a>}
      </nav>
      {topic ? <article className="knowledge-article">
        <header><span className="knowledge-article-icon"><BookOpen size={25} strokeWidth={1.6} /></span><h2 ref={articleHeading} tabIndex={-1}>{topic.title}</h2><p>{topic.description}</p></header>
        <div className="knowledge-article-layout"><div>
          {topic.sections.map(section => <details className="knowledge-section" key={section.title}><summary>{section.title}<ChevronDown size={18} aria-hidden="true" /></summary><div><p>{section.text}</p>{section.formula && <code>{section.formula}</code>}</div></details>)}
          <details className="knowledge-section knowledge-sources"><summary>Quellen & Geltungsbereich<ChevronDown size={18} aria-hidden="true" /></summary><div><p>Normausgabe, Anwendungsbedingungen und Herstellerfreigaben müssen zum Projekt passen. Vergleichsdaten dokumentieren die Herkunft datierter Rechenannahmen; sie sind kein unabhängig bestätigter Normnachweis. Vollständige Normtexte sind hier nicht eingebettet.</p>{sourceGroups.filter(group => group.sources.length > 0).map(group => <div className="knowledge-source-group" key={group.title}><h3>{group.title}</h3><ul>{group.sources.map(source => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{source.label}<ArrowUpRight size={14} /></a></li>)}</ul></div>)}</div></details>
        </div><aside className="knowledge-related"><h3>Passende Rechner</h3>{topic.calculatorIds.map(id => {
          const tool = TOOLS.find(item => item.id === id);
          return tool && <button key={id} type="button" onClick={() => onOpenTool?.(id)}><CalculatorIcon id={id} size={20} /><span>{tool.title}</span><ArrowUpRight size={15} /></button>;
        })}</aside></div>
      </article> : <>
        <label className="knowledge-search"><Search size={18} aria-hidden="true" /><input aria-label="Wissen suchen" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Thema oder Begriff suchen …" /><span>{topics.length}</span></label>
        <div className="knowledge-topic-grid">{topics.map(item => <a className="knowledge-topic-card" href={`#wissen/${item.id}`} key={item.id}><BookOpen size={25} strokeWidth={1.6} aria-hidden="true" /><h2>{item.title}</h2><p>{item.description}</p><span>Wissen öffnen<ArrowUpRight size={15} aria-hidden="true" /></span></a>)}</div>
        {!topics.length && <p role="status" className="knowledge-empty">Kein Wissensthema gefunden. Versuche einen anderen Begriff.</p>}
      </>}
    </div>
  </LabShell>;
}
