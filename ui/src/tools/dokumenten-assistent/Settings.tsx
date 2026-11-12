import { useRef, useState, type FormEvent } from "react";
import { ChevronDown, Info } from "lucide-react";
import { useDialogFocus } from "../../shared/useDialogFocus";
import { request, type AISettings } from "./api";
import QwenGuide from "./QwenGuide";
import DataRoute from "./DataRoutePanel";

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
  const endpointField = useRef<HTMLInputElement>(null);
  useDialogFocus(ref, onClose, busy);

  function clearFeedback() { setError(""); setNotice(""); }
  function useLocal() {
    setProvider("ollama"); setEndpoint("http://127.0.0.1:11434/api/chat"); setModel("qwen3:4b");
    setApiKey(""); setClearKey(false); setError("");
    setNotice("Lokale Angaben eingesetzt. Die bisherige Verbindung bleibt gespeichert, bis du die neuen Angaben ausdrücklich speicherst.");
    endpointField.current?.focus();
  }
  function preferences() { return { provider, endpoint, model, api_key: apiKey, clear_key: clearKey }; }

  async function check() {
    setBusy(true); clearFeedback();
    try {
      const checked = await request<{ message: string }>("/connection", sessionKey, { method: "POST", body: JSON.stringify(preferences()) });
      setNotice(`${checked.message} Die Angaben wurden noch nicht gespeichert.`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      // A failed local setup must not replace an existing company connection.
      const checked = provider === "ollama" ? await request<{ message: string }>("/connection", sessionKey, {
        method: "POST", body: JSON.stringify(preferences()) }) : null;
      const saved = await request<AISettings>("/settings", sessionKey, { method: "POST",
        body: JSON.stringify(preferences()) });
      setApiKey(""); setClearKey(false); onSave(saved);
      setNotice(checked ? `${checked.message} Verbindung gespeichert.` : "KI-Zugang gespeichert.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="modal-back"><div ref={ref} className="modal doc-ai-settings" role="dialog"
    aria-modal="true" aria-labelledby="doc-settings-title" tabIndex={-1}>
    <h2 id="doc-settings-title">KI-Verbindung einrichten</h2>
    <p>Auf diesem PC mit Qwen oder über euren Firmenserver.</p>
    <QwenGuide onUseLocal={useLocal} disabled={busy} />
    <form onSubmit={save}>
      <label>Betriebsart<select value={provider} disabled={busy} onChange={e => {
        const next = e.target.value as AISettings["provider"]; setProvider(next); setApiKey(""); setClearKey(false);
        setEndpoint(next === value.provider ? value.endpoint : next === "ollama" ? "" : "https://api.openai.com/v1/chat/completions");
        setModel(next === value.provider ? value.model : next === "ollama" ? "qwen3:4b" : ""); clearFeedback();
      }}><option value="ollama">Qwen / Ollama · lokal oder Firmenserver</option><option value="openai">KI-API · kostenpflichtige Alternative</option></select></label>
      <label>{provider === "ollama" ? "KI-Serveradresse" : "KI-Schnittstelle (HTTPS)"}<input ref={endpointField} type="url" required value={endpoint} maxLength={1000}
        placeholder={provider === "ollama" ? "http://127.0.0.1:11434/api/chat" : "https://api.openai.com/v1/chat/completions"}
        disabled={busy} onChange={e => { setEndpoint(e.target.value); clearFeedback(); }} /></label>
      <p className="doc-help">{provider === "ollama" ? "Ollama muss auf diesem PC oder dem angegebenen Firmenserver laufen. Einrichtung und Beispieladressen findest du unten. Lokal und im internen Netz ist auch HTTP möglich." : "Für OpenAI die Standardadresse, für Azure oder einen Firmenserver die vollständige Chat-Completions-Adresse der IT verwenden."}</p>
      <DataRoute endpoint={endpoint} configured={Boolean(endpoint.trim())} draft />
      <label>Modell oder Bereitstellungsname<input required value={model} maxLength={150} disabled={busy}
        placeholder={provider === "ollama" ? "qwen3:4b" : "Modellname aus eurem API-Zugang"} onChange={e => { setModel(e.target.value); clearFeedback(); }} /></label>
      <label>{provider === "ollama" ? "Server-Schlüssel (optional)" : "API-Schlüssel"}<input type="password" autoComplete="new-password" value={apiKey} maxLength={4096}
        disabled={busy || clearKey} placeholder={value.has_key ? "Schlüssel hinterlegt; leer lassen zum Beibehalten" : provider === "ollama" ? "Für Ollama ohne Zugangsschutz leer lassen" : "API-Schlüssel eintragen"}
        onChange={e => { setApiKey(e.target.value); clearFeedback(); }} /></label>
      {value.has_key && <label className="doc-checkbox"><input type="checkbox" checked={clearKey} disabled={busy}
        onChange={e => { setClearKey(e.target.checked); clearFeedback(); }} />Hinterlegten Schlüssel entfernen</label>}
      <p className="doc-help">{value.key_persistent ? "Der Schlüssel wird mit dem Windows-Benutzerprofil verschlüsselt gespeichert." : "Der Schlüssel bleibt in dieser Sitzung. Er wird auf diesem Betriebssystem nicht auf der Festplatte gespeichert."}</p>
      {provider === "ollama" && <div className="doc-ai-guides">
        <details className="doc-ai-guide">
          <summary tabIndex={0}><span>Gemeinsamen Firmenserver verwenden</span><ChevronDown size={17} aria-hidden="true" /></summary>
          <div>
            <p>Die IT installiert Ollama und das gemeinsame Modell auf dem Firmenserver. Auf diesem PC ist dann keine Modellinstallation nötig.</p>
            <p>Die vollständige Serveradresse der IT eintragen, zum Beispiel <code>http://KI-SERVER:11434/api/chat</code>. Dazu den dort eingerichteten Modellnamen, etwa <code>qwen3:4b</code>, und gegebenenfalls den von der IT vorgegebenen Server-Schlüssel verwenden.</p>
            <p>Der Server muss von diesem PC erreichbar sein. „Verbindung prüfen“ testet die Angaben; erst „Speichern und Verbindung prüfen“ übernimmt sie nach erfolgreicher Prüfung.</p>
          </div>
        </details>
      </div>}
      <details className="doc-ai-guide doc-data-guide"><summary><Info size={16} aria-hidden="true" /><span>Welche Daten werden übertragen?</span><ChevronDown size={17} aria-hidden="true" /></summary><div>Nur „KI-Antwort“ übergibt die Frage und bis zu sechs gefundene Textauszüge an die eingestellte KI-Adresse. Die Originaldatei wird nicht an die KI gesendet. Der Verbindungstest fragt ausschliesslich die Modellliste ab. {provider === "ollama" ? "Bei der lokalen Adresse geht die KI-Anfrage an Ollama auf diesem PC; beim Firmenserver werden die Auszüge dorthin übertragen. Für das selbst betriebene Modell fallen keine API-Gebühren an." : "Für den Dienst können API-Kosten entstehen; ein ChatGPT-Abonnement enthält keinen API-Zugang."}</div></details>
      {error && <p role="alert" className="doc-error">{error}</p>}
      {notice && <p role="status" className="doc-notice">{notice}</p>}
      <div className="doc-actions"><button className="btn" type="button" disabled={busy} onClick={onClose}>Schliessen</button>
        {provider === "ollama" && <button className="btn" type="button" disabled={busy || !endpoint.trim() || !model.trim()} onClick={() => void check()}>Verbindung prüfen</button>}
        <button className="btn primary" disabled={busy}>{busy ? "Verbindung wird geprüft …" : provider === "ollama" ? "Speichern und Verbindung prüfen" : "Zugang speichern"}</button></div>
    </form>
  </div></div>;
}
