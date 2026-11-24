import { ArrowUpRight } from "lucide-react";
import type { ToolInfo } from "./catalog";
import ToolIcon from "./ToolIcon";

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

export default function BetaToolList({ tools, openTool }: { tools: readonly ToolInfo[]; openTool: (id: string) => void }) {
  return <ul className="beta-tool-list" aria-label="Werkzeuge">{tools.map(tool =>
    <li key={tool.id} className={`toolbox-card tool-color-${tool.color}${tool.status === "available" ? " is-available" : ""}`}>
      <h2 aria-label={tool.title}>
        <button type="button" className="toolbox-tile" disabled={tool.status !== "available"}
          title={tool.developmentStatus === "in-progress" ? tool.description + " · In Entwicklung" : tool.description}
          onClick={() => openTool(tool.id)} aria-label={`${tool.title} öffnen`}>
          <span className="toolbox-symbol"><ToolIcon id={tool.id} /></span>
          <span className="beta-tool-label">
            <span className="beta-tool-name"><strong>{tool.title}</strong>
              {(tool.designBetaOnly || tool.id === "planlieferung") && <span className="beta-tool-status">Beta</span>}
            </span>
            <small>{tasks[tool.id] ?? tool.category}</small>
          </span>
          <ArrowUpRight aria-hidden="true" size={16} className="beta-tool-link" />
        </button>
      </h2>
    </li>
  )}</ul>;
}
