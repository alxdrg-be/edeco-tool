import { useRef, useState, type FormEvent } from "react";
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
    <p>Ein gemeinsamer KI-Server reicht für mehrere PCs. Auf diesem PC wird kein KI-Modell installiert.</p>
    <form onSubmit={save}>
      <label>Betriebsart<select value={provider} disabled={busy} onChange={e => {
        const next = e.target.value as AISettings["provider"]; setProvider(next); setApiKey(""); setClearKey(false);
        setEndpoint(next === "ollama" ? "" : "https://api.openai.com/v1/chat/completions");
        setModel(next === "ollama" ? "qwen3:4b" : ""); setNotice("");
      }}><option value="ollama">Firmen-KI mit Ollama · keine API-Gebühren</option><option value="openai">KI-API · kostenpflichtige Alternative</option></select></label>
      <label>{provider === "ollama" ? "KI-Serveradresse" : "KI-Schnittstelle (HTTPS)"}<input type="url" required value={endpoint} maxLength={1000}
        placeholder={provider === "ollama" ? "http://KI-SERVER:11434/api/chat" : "https://api.openai.com/v1/chat/completions"}
        disabled={busy} onChange={e => setEndpoint(e.target.value)} /></label>
      <p className="doc-help">{provider === "ollama" ? "Ollama und das Modell werden einmal auf dem gemeinsamen Server eingerichtet. Hier auf allen PCs dieselbe Serveradresse eintragen. Für das interne Netz ist auch HTTP möglich." : "Für OpenAI die Standardadresse, für Azure oder einen Firmenserver die vollständige Chat-Completions-Adresse der IT verwenden."}</p>
      <label>Modell oder Bereitstellungsname<input required value={model} maxLength={150} disabled={busy}
        placeholder="Modellname aus eurem API-Zugang" onChange={e => setModel(e.target.value)} /></label>
      <label>{provider === "ollama" ? "Server-Schlüssel (optional)" : "API-Schlüssel"}<input type="password" autoComplete="new-password" value={apiKey} maxLength={4096}
        disabled={busy || clearKey} placeholder={value.has_key ? "Schlüssel hinterlegt; leer lassen zum Beibehalten" : provider === "ollama" ? "Für Ollama ohne Zugangsschutz leer lassen" : "API-Schlüssel eintragen"}
        onChange={e => setApiKey(e.target.value)} /></label>
      {value.has_key && <label className="doc-checkbox"><input type="checkbox" checked={clearKey} disabled={busy}
        onChange={e => setClearKey(e.target.checked)} />Hinterlegten Schlüssel entfernen</label>}
      <p className="doc-help">{value.key_persistent ? "Der Schlüssel wird mit dem Windows-Benutzerprofil verschlüsselt gespeichert." : "Der Schlüssel bleibt in dieser Sitzung. Er wird auf diesem Betriebssystem nicht auf der Festplatte gespeichert."}</p>
      <div className="doc-settings-note">Nur beim Klick auf „KI-Antwort“ werden die Frage und bis zu sechs gefundene Textauszüge an diesen Dienst gesendet. Originaldateien bleiben auf diesem PC. {provider === "ollama" ? "Ein freies Modell auf eurem Firmenserver verursacht keine API-Gebühren. Der Server benötigt passende Hardware und muss erreichbar sein." : "Für den Dienst können API-Kosten entstehen; ein ChatGPT-Abonnement enthält keinen API-Zugang."}</div>
      {error && <p role="alert" className="doc-error">{error}</p>}
      {notice && <p role="status" className="doc-notice">{notice}</p>}
      <div className="doc-actions"><button className="btn" type="button" disabled={busy} onClick={onClose}>Schliessen</button>
        <button className="btn primary" disabled={busy}>{busy ? "Verbindung wird geprüft …" : provider === "ollama" ? "Speichern und Server prüfen" : "Zugang speichern"}</button></div>
    </form>
  </div></div>;
}
