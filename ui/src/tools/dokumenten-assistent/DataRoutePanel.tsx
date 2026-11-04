import { ChevronDown, Network } from "lucide-react";
import { aiDataRoute } from "./dataRoute";

export default function DataRoute({ endpoint, configured, draft = false }: { endpoint: string; configured: boolean; draft?: boolean }) {
  const route = aiDataRoute(endpoint);
  return <details className="doc-ai-guide doc-data-route">
    <summary><Network size={16} aria-hidden="true" /><span>Datenweg · Suche lokal · KI: {configured ? route.label : "nicht eingerichtet"}</span><ChevronDown size={17} aria-hidden="true" /></summary>
    <div>{draft && <p>Vorschau der eingegebenen Adresse. Die gespeicherte Verbindung ändert sich erst beim Speichern.</p>}
      <dl><dt>Originaldateien &amp; Suchindex</dt><dd>Lokale Kopien auf diesem PC. „Fundstellen suchen“ verwendet keinen KI-Dienst.</dd>
        <dt>Nur bei „KI-Antwort“</dt><dd>Die Frage und bis zu sechs gefundene Textauszüge gehen an die eingestellte KI-Adresse. Die Originaldateien werden dabei nicht an die KI übertragen.</dd>
        <dt>KI-Ziel{draft ? " (Entwurf)" : " (gespeichert)"}</dt><dd><code>{route.destination}</code><p>{route.detail}</p></dd>
        <dt>Verbindung prüfen</dt><dd>Fragt die Modellliste ab; keine Dokumente und keine Frage werden übertragen.</dd>
      </dl>
    </div>
  </details>;
}
