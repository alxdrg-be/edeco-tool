import { useState } from "react";
import { ArrowUpRight, FolderArchive, Network, Search } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import { filterTools } from "../../toolbox/catalog";
import { LabShell } from "./LabUI";
import { calculationGroup } from "./workbench/catalog";
import CalculatorIcon from "./CalculatorIcon";
import { KnowledgeLink } from "./KnowledgeLink";
import "./ablage/archive.css";
import "./calculator-catalog.css";

export default function Calculations({ onHome, onOpenTool }: ToolProps) {
  const [query, setQuery] = useState("");
  const tools = filterTools(query, "Alle", "berechnungen").filter(tool => !["berechnungsablage", "premium-berechnungen", "netzplaner", "wissens-hub"].includes(tool.id));
  const groups = Array.from(new Set(tools.map(tool => calculationGroup(tool.id))));
  const availableCount = filterTools("", "Alle", "berechnungen").filter(tool => tool.status === "available" && !["berechnungsablage", "wissens-hub"].includes(tool.id)).length;
  return <LabShell onHome={onHome} onOpenTool={onOpenTool} title="Berechnungen" subtitle="Werkzeuge für deine Elektroplanung" help={null} setHelp={() => undefined}>
    <div className="calc-catalog">
    <div className="calc-catalog-toolbar"><label className="calc-search"><Search size={18} aria-hidden="true" /><input aria-label="Berechnung suchen" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechner oder Stichwort suchen …" /></label><span className="calc-catalog-count">{query ? `${tools.length} Treffer` : `${availableCount} aktive Rechner`}</span></div>
    <div className="calc-shortcuts"><button className="calc-network-shortcut" aria-label="Netzplaner (Beta) öffnen" onClick={() => onOpenTool?.("netzplaner")}><Network size={22} strokeWidth={1.6} /><span>Netzplaner<span>Radiales Netz berechnen und prüfen</span></span><ArrowUpRight size={17} /><span className="calc-beta">Beta</span></button><div><button className="lab-open" onClick={() => onOpenTool?.("berechnungsablage")}><FolderArchive size={16} />Gemeinsame Ablage & Einstellungen</button><KnowledgeLink onOpenTool={onOpenTool} /></div></div>
    {groups.map(group => <section className="calc-group" key={group}><h2>{group}</h2><div className="lab-tile-grid">{tools.filter(tool => calculationGroup(tool.id) === group).map(tool => <article className="lab-tile calc-tile" key={tool.id}>
      <div className="calc-card-top"><span className="lab-tile-icon"><CalculatorIcon id={tool.id} /></span>{tool.status !== "available" && <span className="lab-tag">Geplant</span>}<ArrowUpRight className="calc-card-arrow" size={18} aria-hidden="true" /></div>
      <h2>{tool.title}</h2><p>{tool.id === "blitzschutz" ? "Trennungsabstand · SN 414022:2024" : tool.id === "kabelberechnung" ? "Spannungsfall · Schweizer Referenzmodell" : tool.id === "emobilitaet" ? "Eigene AC-Leistungs-Vorplanung · keine vollständige Ladegrid-Dimensionierung" : tool.description}</p>
      <button className="lab-open" aria-label={tool.status === "available" ? `${tool.title} öffnen` : `${tool.title}: demnächst`} disabled={tool.status !== "available"} onClick={() => onOpenTool?.(tool.id)}>{tool.status === "available" ? "Öffnen" : "Demnächst"}</button>
    </article>)}</div></section>)}
    {!tools.length && <p className="lab-note">Keine passende Berechnung gefunden.</p>}
    </div>
  </LabShell>;
}
