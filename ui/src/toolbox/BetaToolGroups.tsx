import { ArrowUpRight } from "lucide-react";
import type { ToolInfo } from "./catalog";
import ToolIcon from "./ToolIcon";

const groups = [
  { title: "Modelle", ids: ["ifc-viewer", "bim-check", "bim2steiger"] },
  { title: "Pläne", ids: ["dwg-werkstatt", "planvergleich", "pdf-werkzeuge"] },
  { title: "Abgabe", ids: ["planlieferung", "dateien-umbenennen", "projektzentrale"] },
];

const tasks: Record<string, string> = {
  "ifc-viewer": "IFC-Modell in 3D erkunden",
  "bim-check": "Attribute prüfen und Nova-Listen vergleichen",
  bim2steiger: "IFC-Elemente Katalogartikeln zuordnen",
  "dwg-werkstatt": "Architekturpläne aus DXF aufbereiten",
  planvergleich: "Zwei PDF-Stände überlagern",
  "pdf-werkzeuge": "PDFs zuschneiden und bearbeiten",
  planlieferung: "Planliste und ZIP-Paket erstellen",
  "dateien-umbenennen": "Dateinamen nach Bürostandard bilden",
  projektzentrale: "Projekte und Kontakte verwalten",
};

export default function BetaToolGroups({ tools, openTool }: { tools: readonly ToolInfo[]; openTool: (id: string) => void }) {
  const byId = new Map(tools.map(tool => [tool.id, tool]));
  const sections = groups.map(({ title, ids }) => {
    const members = ids.flatMap(id => {
      const tool = byId.get(id);
      byId.delete(id);
      return tool ? [tool] : [];
    });
    return { title, members };
  });
  sections.push({ title: "Weitere Werkzeuge", members: Array.from(byId.values()) });

  return <div className="beta-tool-groups">{sections.filter(group => group.members.length > 0).map(({ title, members }) =>
    <section className={title === "Weitere Werkzeuge" ? "beta-tool-section beta-tools-other" : "beta-tool-section"} key={title} aria-label={title}>
      <h2>{title}</h2>
      <div className="beta-tool-list">{members.map(tool => <article key={tool.id} className={`toolbox-card tool-color-${tool.color}${tool.status === "available" ? " is-available" : ""}`}>
        <h3 aria-label={tool.title}><button type="button" className="toolbox-tile" disabled={tool.status !== "available"} title={tool.developmentStatus === "in-progress" ? tool.description + " · In Entwicklung" : tool.description}
          onClick={() => openTool(tool.id)} aria-label={`${tool.title} öffnen`}>
          <span className="toolbox-symbol"><ToolIcon id={tool.id} /></span>
          <span className="beta-tool-label"><span className="beta-tool-name"><strong>{tool.title}</strong>
            {(tool.designBetaOnly || tool.id === "planlieferung") && <span className="beta-tool-status">Beta</span>}</span><small>{tasks[tool.id] ?? tool.category}</small></span>
          <ArrowUpRight aria-hidden="true" size={16} className="beta-tool-link" />
        </button></h3>
      </article>)}</div>
    </section>
  )}</div>;
}
