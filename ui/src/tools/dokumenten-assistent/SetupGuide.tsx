export default function SetupGuide() {
  return <details className="doc-setup-guide"><summary>Schritt für Schritt: Serverordner und Ollama einrichten</summary>
    <p>Frage eure IT nach dem freigegebenen Dokumentordner, der Ollama-Adresse und dem installierten Modellnamen. Ordner und KI können auf verschiedenen Servern liegen.</p>
    <ol>
      <li><strong>Dokumente vorbereiten.</strong> Einen eigenen Unterordner mit den gewünschten PDF-, TXT- oder Markdown-Dateien anlegen. Scans zuerst in der PDF-Werkstatt mit OCR lesbar machen.</li>
      <li><strong>Freigabe im Explorer testen.</strong> Den Pfad oben im Windows-Explorer einfügen, z. B. <code>{'\\\\SERVER\\Unterlagen'}</code>. Eine Datei öffnen. Falls nötig dort mit dem Firmenkonto anmelden und zuerst Firmennetz/VPN verbinden.</li>
      <li><strong>Ordner verbinden.</strong> In der Toolbox „Dokumentordner“ öffnen, denselben Pfad einfügen und „Verbinden und einlesen“ anklicken. Persönliche Kopien und Suchindex entstehen auf diesem PC. Serverdateien werden nicht verändert. Nach Änderungen „Jetzt aktualisieren“ anklicken.</li>
      <li><strong>Ohne KI ausprobieren.</strong> Dokumente auswählen, Frage eingeben und „Fundstellen suchen“ anklicken. Die gefundene Originalseite öffnen. Das benötigt kein Ollama.</li>
      <li><strong>Ollama einmal einrichten lassen.</strong> Die IT installiert Ollama auf einem geeigneten Server, lädt ein Modell herunter und nennt dir Adresse und Modellname. Auf den Toolbox-PCs ist kein Modell nötig.</li>
      <li><strong>KI verbinden.</strong> „KI-Verbindung“ öffnen, „Firmen-KI mit Ollama“ wählen. Beispiel: <code>http://KI-SERVER:11434/api/chat</code>. Den exakt installierten Modellnamen und gegebenenfalls den Schlüssel der IT eintragen, dann „Speichern und Server prüfen“ anklicken.</li>
      <li><strong>KI-Antwort ausprobieren.</strong> Dokumente auswählen und „KI-Antwort“ anklicken. Die Toolbox sucht passende Textstellen und sendet diese mit der Frage an Ollama. Ollama durchsucht nicht selbst den Serverordner. Quellen und Originalseiten prüfen.</li>
    </ol>
    <p><strong>Fehlerhilfe:</strong> Ordner nicht erreichbar → Explorer, Verbindung und Leserechte prüfen. Modell fehlt → Namen mit der IT abgleichen. Scan liefert keine Fundstellen → zuerst OCR. Neue Serverdateien fehlen → Ordner aktualisieren.</p>
    <details><summary>Für die IT: Ollama auf einem Windows-Server</summary><p>Ollama von ollama.com installieren. Ein passendes Modell laden, z. B. mit <code>ollama pull qwen3:4b</code> (Internet und genügend Speicher nötig). <code>ollama list</code> zeigt die installierten Namen. Für LAN-Zugriff die Benutzer-Umgebungsvariable <code>OLLAMA_HOST</code> auf <code>0.0.0.0:11434</code> setzen und Ollama vollständig beenden und neu starten. Für ausschliesslich lokale Modelle zusätzlich <code>OLLAMA_NO_CLOUD=1</code> setzen. Die Firewall nur für die benötigten internen Rechner und TCP 11434 freigeben; keine Router-Portweiterleitung ins Internet. Ein geschützter Zugang ausserhalb des vertrauenswürdigen Netzes ist Aufgabe der IT. Der Ordner wird mit dem Windows-Konto der Toolbox gelesen, nicht mit dem Ollama-Dienstkonto.</p></details>
  </details>;
}
