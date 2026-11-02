import { useState } from "react";
import { ArrowUpRight, ExternalLink, FolderArchive, Info, Network, Search } from "lucide-react";
import type { ToolProps } from "../../toolbox/modules";
import { filterTools } from "../../toolbox/catalog";
import { LabShell, type Help } from "./LabUI";
import { calculationGroup } from "./workbench/catalog";
import CalculatorIcon from "./CalculatorIcon";
import { KnowledgeLink } from "./KnowledgeLink";
import "./ablage/archive.css";
import "./calculator-catalog.css";

export default function Calculations({ onHome, onOpenTool }: ToolProps) {
  const [query, setQuery] = useState(""), [help, setHelp] = useState<Help | null>(null);
  const tools = filterTools(query, "Alle", "berechnungen").filter(tool => !["berechnungsablage", "premium-berechnungen", "netzplaner", "wissens-hub"].includes(tool.id));
  const groups = Array.from(new Set(tools.map(tool => calculationGroup(tool.id))));
  const availableCount = filterTools("", "Alle", "berechnungen").filter(tool => tool.status === "available" && !["berechnungsablage", "wissens-hub"].includes(tool.id)).length;
  const sources = <><p>Nur Schweizer fachliche Grundlagen. Externe Werkzeuge sind Quellen und Vergleichshilfen; sie werden nicht eingebettet.</p><ul>
    <li><a href="https://www.electrosuisse.ch/de/nin-2025/" target="_blank" rel="noreferrer">Electrosuisse · NIN 2025</a> – Schweizer Normenrahmen und aktuelle Ausgabe. Der vollständige Normtext bleibt beim Herausgeber.</li>
    <li><a href="https://www.elektro-rechner.ch/Rechner/spannungsfall.html" target="_blank" rel="noreferrer">Elektro-Rechner Schweiz</a> – veröffentlichte Leiterwiderstände, 55-°C-Modell, Spannungsfall und Referenzfälle.</li>
    <li><a href="https://www.aflury.ch/de/fachwissen/trennungsabstand-rechner/" target="_blank" rel="noreferrer">Arthur Flury Schweiz</a> – Trennungsabstand nach dem veröffentlichten Verfahren zur SN 414022:2024.</li>
    <li><a href="https://www.nexans.ch/de/Tools-and-downloads/easycalc.html" target="_blank" rel="noreferrer">Nexans Schweiz · EASYCALC</a> – Vergleich für geführte Kabeldimensionierung und installationsabhängige Korrekturfaktoren. Ländereinstellung und Projektbedingungen dort prüfen.</li>
  </ul><p>Rechnerische Ergebnisse sind Vorprüfungen. Nicht belegte Normtabellen und ausländische Grenzwerte werden nicht übernommen. Fachliche Freigabe und Nachweise für den Planungseinsatz bleiben offen.</p></>;
  return <LabShell onHome={onHome} onOpenTool={onOpenTool} title="Berechnungen" subtitle="Werkzeuge für deine Elektroplanung" help={help} setHelp={setHelp}>
    <div className="calc-catalog">
    <div className="calc-catalog-toolbar"><label className="calc-search"><Search size={18} aria-hidden="true" /><input aria-label="Berechnung suchen" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechner oder Stichwort suchen …" /></label><span className="calc-catalog-count">{query ? `${tools.length} Treffer` : `${availableCount} aktive Rechner`}</span></div>
    <div className="calc-shortcuts"><button className="calc-network-shortcut" aria-label="Netzplaner (Beta) öffnen" onClick={() => onOpenTool?.("netzplaner")}><Network size={22} strokeWidth={1.6} /><span>Netzplaner<span>Radiales Netz berechnen und prüfen</span></span><ArrowUpRight size={17} /><span className="calc-beta">Beta</span></button><div><button className="lab-open" onClick={() => onOpenTool?.("berechnungsablage")}><FolderArchive size={16} />Gemeinsame Ablage & Einstellungen</button><KnowledgeLink onOpenTool={onOpenTool} /></div></div>
    {groups.map(group => <section className="calc-group" key={group}><h2>{group}</h2><div className="lab-tile-grid">{tools.filter(tool => calculationGroup(tool.id) === group).map(tool => <article className="lab-tile calc-tile" key={tool.id}>
      <div className="calc-card-top"><span className="lab-tile-icon"><CalculatorIcon id={tool.id} /></span>{tool.status !== "available" && <span className="lab-tag">Geplant</span>}<ArrowUpRight className="calc-card-arrow" size={18} aria-hidden="true" /></div>
      <h2>{tool.title}</h2><p>{tool.id === "blitzschutz" ? "Trennungsabstand · SN 414022:2024" : tool.id === "kabelberechnung" ? "Spannungsfall · Schweizer Referenzmodell" : tool.id === "emobilitaet" ? "Eigene AC-Leistungs-Vorplanung · keine vollständige Ladegrid-Dimensionierung" : tool.description}</p>
      <button className="lab-open" aria-label={tool.status === "available" ? `${tool.title} öffnen` : `${tool.title}: demnächst`} disabled={tool.status !== "available"} onClick={() => onOpenTool?.(tool.id)}>{tool.status === "available" ? "Öffnen" : "Demnächst"}</button>
    </article>)}</div></section>)}
    {!tools.length && <p className="lab-note">Keine passende Berechnung gefunden.</p>}
    <div className="lab-references"><Info size={15} /><button className="lab-open" onClick={() => setHelp({ title: "Schweizer Quellen & Vergleichswerkzeuge", content: sources })}>Schweizer Grundlagen <ExternalLink size={12} style={{ display: "inline", marginLeft: 5 }} /></button></div>
    </div>
  </LabShell>;
}
