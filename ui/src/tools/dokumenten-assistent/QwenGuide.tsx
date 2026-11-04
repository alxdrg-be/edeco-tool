import { ChevronDown, Info } from "lucide-react";

/** Kept beside the workflow so the same instructions remain available in settings. */
export default function QwenGuide({ onUseLocal, onOpenSettings, disabled = false }: {
  onUseLocal?: () => void; onOpenSettings?: () => void; disabled?: boolean;
}) {
  return <details className="doc-ai-guide doc-qwen-guide">
    <summary><Info size={16} aria-hidden="true" /><span>Lokal mit Qwen · Schritt für Schritt</span><ChevronDown size={17} aria-hidden="true" /></summary>
    <div>
      <ol>
        <li><strong>Ollama installieren.</strong> <a href="https://ollama.com/download/windows" target="_blank" rel="noopener noreferrer">Ollama für Windows herunterladen</a>, installieren und starten.</li>
        <li><strong>Modell laden.</strong> Ein neues PowerShell-Fenster öffnen und ausführen:<pre><code>ollama pull qwen3:4b</code></pre>Warten, bis der Download abgeschlossen ist. Ollama danach laufen lassen.</li>
        <li><strong>Verbindung eintragen.</strong>
          <dl><dt>KI-Serveradresse</dt><dd><code>http://127.0.0.1:11434/api/chat</code></dd><dt>Modell</dt><dd><code>qwen3:4b</code></dd><dt>Server-Schlüssel</dt><dd>Bei der normalen lokalen Ollama-Installation leer lassen.</dd></dl>
          {onUseLocal ? <button type="button" className="btn" disabled={disabled} onClick={event => {
            const guide = event.currentTarget.closest("details"); if (guide) guide.open = false;
            onUseLocal();
          }}>Lokale Angaben ins Formular einsetzen</button> : onOpenSettings && <button type="button" className="btn" disabled={disabled} onClick={onOpenSettings}>KI-Verbindung öffnen</button>}
        </li>
        <li><strong>Prüfen und übernehmen.</strong> „Verbindung prüfen“ testet Adresse und Modell, ohne die gespeicherte Firmenverbindung zu ersetzen. Mit „Speichern und Verbindung prüfen“ übernimmst du die Angaben nach erfolgreicher Prüfung.</li>
        <li><strong>PDF hinzufügen.</strong> Die Einrichtung schliessen, einen Dokumentstand eintragen und „Dokumente hinzufügen“ wählen. Reine Scans benötigen zuerst OCR, zum Beispiel in der PDF-Werkstatt.</li>
        <li><strong>Frage und Fundstellen prüfen.</strong> Dokument auswählen und eine konkrete Frage stellen. „Fundstellen suchen“ arbeitet ohne KI. „KI-Antwort“ formuliert eine Antwort mit Quellenknöpfen: Ein Klick öffnet die zugehörige Originalseite und markiert den Text. Ausgabe und Aussage dort nachlesen.</li>
      </ol>
      <details className="doc-guide-more"><summary>Voraussetzungen &amp; Offlinebetrieb</summary><p>Für dieses Modell sind 16 GB Arbeitsspeicher sinnvoll; die Geschwindigkeit hängt von CPU und GPU ab. Der erste Download benötigt Internet und mehrere GB freien Speicher. Danach kann das vollständig heruntergeladene Modell ohne Internet antworten. Ollama muss dafür auf diesem PC laufen.</p></details>
      <details className="doc-guide-more"><summary>Verbindung klappt noch nicht?</summary><p>Ollama starten und in PowerShell mit <code>ollama list</code> prüfen, ob <code>qwen3:4b</code> vorhanden ist. Fehlt das Modell, den Download aus Schritt 2 abschliessen. Für einen Firmenserver dessen Adresse und Modellnamen von der IT verwenden.</p></details>
    </div>
  </details>;
}
