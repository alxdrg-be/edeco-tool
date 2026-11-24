import { ChevronDown, Network } from "lucide-react";
import { aiDataRoute } from "./dataRoute";

export default function DataRoute({ endpoint, configured, draft = false }: { endpoint: string; configured: boolean; draft?: boolean }) {
  const route = aiDataRoute(endpoint);
  return <section className="doc-route-panel" aria-label={draft ? "Datenweg der eingegebenen Verbindung" : "Datenweg der Dokumentverarbeitung"}>
    <div className="doc-route-steps">
      <div><span>Text auslesen</span><strong>Lokal</strong><small>Vorhandener Text · kein OCR</small></div>
      <div><span>Fundstellen suchen</span><strong>Lokal</strong><small>Suchindex im Toolhub</small></div>
      <div><span>KI-Antwort{draft ? " · Entwurf" : ""}</span><strong>{configured ? route.label : "Nicht eingerichtet"}</strong><small>{configured ? draft ? "Eingegebene Adresse" : "Eingestellte Verbindung" : "Fundstellensuche bleibt nutzbar"}</small></div>
    </div>
    <details className="doc-ai-guide doc-data-route">
    <summary><Network size={16} aria-hidden="true" /><span>Datenweg &amp; übertragene Inhalte</span><ChevronDown size={17} aria-hidden="true" /></summary>
    <div>{draft && <p>Vorschau der eingegebenen Adresse. Die gespeicherte Verbindung ändert sich erst beim Speichern.</p>}
      <dl><dt>Originaldateien &amp; Suchindex</dt><dd>Lokale Kopien auf diesem PC. „Fundstellen suchen“ verwendet keinen KI-Dienst.</dd>
        <dt>Textextraktion &amp; Scans</dt><dd>Vorhandener PDF-, TXT- und Markdown-Text wird vom lokalen Toolhub ausgelesen. Der Dokumenten-Assistent führt keine OCR aus. Reine Scans zuerst in der PDF-Werkstatt erkennen lassen; deren eingestellten Datenweg separat beachten.</dd>
        <dt>Nur bei „KI-Antwort“</dt><dd>Die Frage und bis zu sechs gefundene Textauszüge gehen an die eingestellte KI-Adresse. Die Originaldateien werden dabei nicht an die KI übertragen.</dd>
        <dt>KI-Ziel{draft ? " (Entwurf)" : " (gespeichert)"}</dt><dd><code>{route.destination}</code><p>{route.detail}</p></dd>
        {route.kind === "local" && <><dt>Lokale Adresse</dt><dd>Die Adresse liegt auf diesem Rechner. Das bestätigt noch nicht, ob der dort laufende KI-Dienst selbst Daten weiterleitet. Für vollständig lokale Antworten ein lokal installiertes Modell verwenden.</dd></>}
        <dt>Verbindung prüfen</dt><dd>Fragt die Modellliste ab; keine Dokumente und keine Frage werden übertragen.</dd>
      </dl>
    </div>
    </details>
  </section>;
}
