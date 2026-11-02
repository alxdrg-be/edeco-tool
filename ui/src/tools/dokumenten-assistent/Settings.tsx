import { useRef, useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { useDialogFocus } from "../../useDialogFocus";
import { request, type AISettings } from "./api";

export default function Settings({ value, sessionKey, onSave, onClose }: {
  value: AISettings; sessionKey: string; onSave: (settings: AISettings) => void; onClose: () => void;
}) {
  const [endpoint, setEndpoint] = useState(value.endpoint);
  const [provider, setProvider] = useState(value.provider);
  const [model, setModel] = useState(value.model);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose, busy);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const saved = await request<AISettings>("/settings", sessionKey, { method: "POST",
        body: JSON.stringify({ provider, endpoint, model, api_key: apiKey, clear_key: clearKey }) });
      setApiKey(""); setClearKey(false); onSave(saved);
      if (provider === "ollama") {
        const checked = await request<{ message: string }>("/connection", sessionKey, { method: "POST" });
        setNotice(checked.message);
      } else setNotice("KI-Zugang gespeichert.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="modal-back"><div ref={ref} className="modal doc-ai-settings" role="dialog"
    aria-modal="true" aria-labelledby="doc-settings-title" tabIndex={-1}>
    <h2 id="doc-settings-title">KI-Verbindung einrichten</h2>
    <p>Die KI kann auf diesem PC, auf einem gemeinsamen Firmenserver oder über eine API laufen.</p>
    <form onSubmit={save}>
      <label>Betriebsart<select value={provider} disabled={busy} onChange={e => {
        const next = e.target.value as AISettings["provider"]; setProvider(next); setApiKey(""); setClearKey(false);
        setEndpoint(next === "ollama" ? "" : "https://api.openai.com/v1/chat/completions");
        setModel(next === "ollama" ? "qwen3:4b" : ""); setNotice("");
      }}><option value="ollama">Qwen / Ollama · lokal oder Firmenserver</option><option value="openai">KI-API · kostenpflichtige Alternative</option></select></label>
      <label>{provider === "ollama" ? "KI-Serveradresse" : "KI-Schnittstelle (HTTPS)"}<input type="url" required value={endpoint} maxLength={1000}
        placeholder={provider === "ollama" ? "http://127.0.0.1:11434/api/chat" : "https://api.openai.com/v1/chat/completions"}
        disabled={busy} onChange={e => setEndpoint(e.target.value)} /></label>
      <p className="doc-help">{provider === "ollama" ? "Ollama muss auf diesem PC oder dem angegebenen Firmenserver laufen. Einrichtung und Beispieladressen findest du unten. Lokal und im internen Netz ist auch HTTP möglich." : "Für OpenAI die Standardadresse, für Azure oder einen Firmenserver die vollständige Chat-Completions-Adresse der IT verwenden."}</p>
      <label>Modell oder Bereitstellungsname<input required value={model} maxLength={150} disabled={busy}
        placeholder={provider === "ollama" ? "qwen3:4b" : "Modellname aus eurem API-Zugang"} onChange={e => setModel(e.target.value)} /></label>
      <label>{provider === "ollama" ? "Server-Schlüssel (optional)" : "API-Schlüssel"}<input type="password" autoComplete="new-password" value={apiKey} maxLength={4096}
        disabled={busy || clearKey} placeholder={value.has_key ? "Schlüssel hinterlegt; leer lassen zum Beibehalten" : provider === "ollama" ? "Für Ollama ohne Zugangsschutz leer lassen" : "API-Schlüssel eintragen"}
        onChange={e => setApiKey(e.target.value)} /></label>
      {value.has_key && <label className="doc-checkbox"><input type="checkbox" checked={clearKey} disabled={busy}
        onChange={e => setClearKey(e.target.checked)} />Hinterlegten Schlüssel entfernen</label>}
      <p className="doc-help">{value.key_persistent ? "Der Schlüssel wird mit dem Windows-Benutzerprofil verschlüsselt gespeichert." : "Der Schlüssel bleibt in dieser Sitzung. Er wird auf diesem Betriebssystem nicht auf der Festplatte gespeichert."}</p>
      {provider === "ollama" && <div className="doc-ai-guides">
        <details className="doc-ai-guide">
          <summary tabIndex={0}><span>Qwen auf diesem PC einrichten</span><ChevronDown size={17} aria-hidden="true" /></summary>
          <div>
            <ol>
              <li><a href="https://ollama.com/download/windows" target="_blank" rel="noopener noreferrer">Ollama für Windows herunterladen</a>, installieren und anschliessend starten.</li>
              <li>Ein neues PowerShell-Fenster öffnen und das Modell laden:<pre><code>ollama pull qwen3:4b</code></pre></li>
              <li>Hier die lokalen Verbindungsdaten eintragen:
                <dl><dt>KI-Serveradresse</dt><dd><code>http://127.0.0.1:11434/api/chat</code></dd><dt>Modell oder Bereitstellungsname</dt><dd><code>qwen3:4b</code></dd><dt>Server-Schlüssel</dt><dd>Normalerweise leer. Wird ein alter Schlüssel nicht mehr benötigt, „Hinterlegten Schlüssel entfernen“ aktivieren.</dd></dl>
              </li>
              <li>„Speichern und Verbindung prüfen“ wählen.</li>
            </ol>
            <p>Für diese Modellgrösse sind 16 GB Arbeitsspeicher sinnvoll. Eine von Ollama unterstützte GPU kann Antworten beschleunigen.</p>
            <p>Der erste Modell-Download benötigt Internet und mehrere GB freien Festplattenspeicher. Danach kann das lokal vorhandene Modell ohne Internet genutzt werden; Ollama muss dafür laufen.</p>
          </div>
        </details>
        <details className="doc-ai-guide">
          <summary tabIndex={0}><span>Gemeinsamen Firmenserver verwenden</span><ChevronDown size={17} aria-hidden="true" /></summary>
          <div>
            <p>Die IT installiert Ollama und das gemeinsame Modell auf dem Firmenserver. Auf diesem PC ist dann keine Modellinstallation nötig.</p>
            <p>Die vollständige Serveradresse der IT eintragen, zum Beispiel <code>http://KI-SERVER:11434/api/chat</code>. Dazu den dort eingerichteten Modellnamen, etwa <code>qwen3:4b</code>, und gegebenenfalls den von der IT vorgegebenen Server-Schlüssel verwenden.</p>
            <p>Der Server muss von diesem PC erreichbar sein. Mit „Speichern und Verbindung prüfen“ wird die Verbindung geprüft.</p>
          </div>
        </details>
      </div>}
      <div className="doc-settings-note">Nur beim Klick auf „KI-Antwort“ werden die Frage und bis zu sechs gefundene Textauszüge an die eingestellte KI-Adresse übergeben. Originaldateien bleiben auf diesem PC. {provider === "ollama" ? "Bei Ollama auf diesem PC bleibt auch die KI-Verarbeitung lokal; beim Firmenserver werden die Auszüge dorthin übertragen. Für das lokal oder auf dem Firmenserver betriebene Modell fallen keine API-Gebühren an." : "Für den Dienst können API-Kosten entstehen; ein ChatGPT-Abonnement enthält keinen API-Zugang."}</div>
      {error && <p role="alert" className="doc-error">{error}</p>}
      {notice && <p role="status" className="doc-notice">{notice}</p>}
      <div className="doc-actions"><button className="btn" type="button" disabled={busy} onClick={onClose}>Schliessen</button>
        <button className="btn primary" disabled={busy}>{busy ? "Verbindung wird geprüft …" : provider === "ollama" ? "Speichern und Verbindung prüfen" : "Zugang speichern"}</button></div>
    </form>
  </div></div>;
}
