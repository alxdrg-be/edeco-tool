import { ArrowUpRight, BookOpen, ChevronDown } from "lucide-react";
import { KNOWLEDGE_TOPICS } from "./knowledgeData";

/** Topic explanations are shared with the knowledge hub, so the source stays consistent. */
export default function CalculatorReference({ calculatorId }: { calculatorId: string }) {
  const topic = KNOWLEDGE_TOPICS.find(item => item.calculatorIds.includes(calculatorId));
  if (!topic) return null;
  const sourceGroups = [
    { title: "Normen und Fachquellen", sources: topic.sources.filter(source => !new URL(source.href).hostname.endsWith("elektro-rechner.ch")) },
    { title: "Vergleichsquellen", sources: topic.sources.filter(source => new URL(source.href).hostname.endsWith("elektro-rechner.ch")) },
  ];
  return <details className="lab-reference calc-no-print">
    <summary><BookOpen size={17} aria-hidden="true" /><span>Verstehen & Nachschlagen<small>{topic.title} · Grundlagen, Bedingungen und Quellen</small></span><ChevronDown size={17} aria-hidden="true" /></summary>
    <div className="lab-reference-content">
      <div className="lab-reference-sections">{topic.sections.map(section => <details key={section.title} className="lab-reference-question">
        <summary>{section.title}<ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="lab-prose"><p>{section.text}</p>{section.formula && <code>{section.formula}</code>}</div>
      </details>)}</div>
      <aside className="lab-reference-sources" aria-label="Quellen und Geltungsbereich">
        <h2>Quellen und Geltungsbereich</h2>
        <p>Normausgabe und Anwendungsbereich müssen zum Projekt passen. Vergleichsquellen dokumentieren Rechenannahmen; sie ersetzen keine Norm oder Herstellerfreigabe.</p>
        {sourceGroups.filter(group => group.sources.length > 0).map(group => <div key={group.title}><h3>{group.title}</h3><ul>{group.sources.map(source => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{source.label}<ArrowUpRight size={13} aria-hidden="true" /></a></li>)}</ul></div>)}
      </aside>
    </div>
  </details>;
}
