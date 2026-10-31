# Ein gemeinsamer KI-Server fuer die edeco Toolbox

Die Toolbox-PCs brauchen weder Ollama noch ein lokales KI-Modell. Ein gemeinsamer
Firmenrechner uebernimmt die Antworten. Ein freies Modell verursacht keine
API-Gebuehren; Hardware, Strom und Betreuung des Servers bleiben erforderlich.
Die lokale Fundstellensuche der Toolbox braucht gar keinen KI-Server.

## Einmal auf dem Server

1. Einen Rechner waehlen, der waehrend der Nutzung eingeschaltet bleibt. Fuer
   den Einstieg mit `qwen3:4b` sind 16 GB RAM sinnvoll; eine passende GPU macht
   Antworten schneller. Geschwindigkeit und gleichzeitige Anfragen haengen von
   Hardware und Modell ab. Fuer das Modell mehrere GB Speicher einplanen.
2. Ollama von https://ollama.com/download/windows installieren.
3. Diese ZIP vollstaendig entpacken. In PowerShell in den entpackten Ordner
   wechseln und `./Start-KI-Server.ps1` starten. Die interne IPv4-Adresse dieses
   Rechners angeben, zum Beispiel `192.168.1.20`. Falls die Firmenrichtlinie die
   Skriptausfuehrung sperrt, den Start von der IT einrichten lassen.
4. Der Helfer startet Ollama auf genau dieser LAN-Adresse und laedt das Modell
   bei Bedarf einmal herunter. Das Fenster offen lassen. Ein bestehender Dienst
   auf derselben Adresse wird wiederverwendet und beim Beenden nicht gestoppt.
5. Falls andere PCs den Server nicht erreichen, die IT den Zugriff auf TCP 11434
   aus dem benoetigten internen Netz freigeben lassen. Der Helfer aendert weder
   Firewall noch Router. Den Dienst nicht ins oeffentliche Internet freigeben.

Eine feste Adresse oder ein interner DNS-Name verhindert, dass die Toolbox nach
einem Serverneustart eine andere Adresse braucht. Fuer einen dauerhaften Dienst
oder mehrere gleichzeitige Nutzer den Betrieb mit der IT einrichten.

## Auf jedem Toolbox-PC

1. **Dokumenten-Assistent → KI-Verbindung** oeffnen.
2. **Firmen-KI mit Ollama** waehlen.
3. Serveradresse `http://192.168.1.20:11434/api/chat` (eigene Adresse einsetzen)
   und Modell `qwen3:4b` eintragen. Bei einem geschuetzten HTTPS-Gateway dessen
   Adresse und optionalen Server-Schluessel verwenden.
4. **Speichern und Server pruefen**. Diese Pruefung uebertraegt keine Dokumente.

Danach eigene PDF-/Textdokumente hinzufuegen und Fragen stellen. Nur die Frage
und bis zu sechs passende Textauszuege gehen an euren Server. Die Originaldateien
und Suchindizes bleiben im persoenlichen Toolbox-Datenordner auf dem jeweiligen
PC. Die Dokumentbibliothek wird noch nicht automatisch zwischen PCs geteilt.

Die Hardware-Empfehlung ist keine Zusage zur Antwortqualitaet. Das Modell erstellt
Formulierungen; die markierten Originalstellen bleiben die fachliche Grundlage.
Andere in Ollama installierte Modelle koennen in der Toolbox eingetragen werden.

Ollama: https://github.com/ollama/ollama
Modell und Modelllizenz: https://ollama.com/library/qwen3
