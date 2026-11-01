import { useState } from "react";
import { PDF_TOOLS, PdfToolIcon } from "./tools";

export interface Capability { id: string; available: boolean; reason: string }
export default function PdfToolHome({ capabilities, onOpen, onInfo }: { capabilities: Capability[]; onOpen: (id: string) => void; onInfo: () => void }) {
  const [search, setSearch] = useState("");
  const tools = PDF_TOOLS.filter(tool => `${tool.title} ${tool.description}`.toLocaleLowerCase("de-CH").includes(search.toLocaleLowerCase("de-CH")));
  return <main className="pdf-tools-home">
    <div className="pdf-tools-intro"><div><p className="pdf-eyebrow">DEINE PDF-WERKZEUGE</p><h1>Was möchtest du mit deinen PDFs tun?</h1><p>Ein Werkzeug wählen. Dateien hinzufügen. Das Ergebnis auf deinem Computer speichern.</p></div>
      <label className="pdf-tools-search">PDF-Werkzeug suchen<input type="search" className="input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name oder Aufgabe …" /></label></div>
    <div className="pdf-tool-grid">{tools.map(tool => {
      const capability = capabilities.find(item => item.id === (tool.id === "merge" ? "organize" : tool.id));
      const ready = Boolean(capability?.available);
      return <button className="pdf-tool-tile" key={tool.id} disabled={!ready} aria-label={tool.title} onClick={() => onOpen(tool.id)}>
        <span className="pdf-tool-tile-top"><span className="pdf-tool-symbol"><PdfToolIcon id={tool.id} /></span>{!ready && <span className="pdf-tool-ready">Nicht verfügbar</span>}</span>
        <strong>{tool.title}</strong><span className="pdf-tool-description">{tool.description}</span><span className="pdf-tool-group">{ready ? tool.group : capability?.reason || "Verfügbarkeit wird geprüft …"}</span>
      </button>;
    })}</div>
    {!tools.length && <p className="pdf-hint">Kein passendes PDF-Werkzeug. Versuche einen anderen Suchbegriff.</p>}
    <footer className="pdf-tools-footer"><span>Originaldateien bleiben unverändert.</span><button type="button" className="pdf-info-link" aria-label="Info / Lizenzen" onClick={onInfo}>Info</button></footer>
  </main>;
}
