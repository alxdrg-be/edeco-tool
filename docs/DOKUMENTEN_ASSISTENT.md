# Dokumenten-Assistent

Der Assistent beantwortet Fragen anhand eigener Unterlagen. Er trainiert kein
neues Modell aus den Dateien: Zuerst wird in den ausgewählten Dokumenten nach
passenden Textstellen gesucht, dann kann ein KI-Modell diese Stellen zu einer
Antwort zusammenfassen. Jede angezeigte Quellen-ID stammt aus dem lokalen Index.

## Ohne laufende API-Gebühren auf mehreren PCs

Die voreingestellte Variante ist ein gemeinsamer Ollama-Server mit einem freien
Modell. Ollama und die Modellgewichte werden nur einmal auf dem Server
installiert. Die Toolbox-PCs verbinden sich über **KI-Verbindung** mit dessen
Adresse. Der Server braucht geeignete Hardware und muss während der Nutzung
laufen; Hardware, Strom und Betreuung sind nicht durch das Programm abgedeckt.

Das Release enthält dafür `edeco-KI-Server-Einrichtung-<Version>.zip`. Die
[Einrichtungsanleitung](../packaging/ki-server/README.md) beschreibt den einmaligen
Start. Beispiel: `http://192.168.1.20:11434/api/chat`, Modell `qwen3:4b`.
Ein optionaler geschützter Serverzugang ist ebenfalls möglich. Die
Verbindungsprüfung liest nur die verfügbaren Modellnamen und überträgt keine
Dokumenttexte.

Die lokale Fundstellensuche mit Quellen und Markierungen braucht keinen Server.
Eine OpenAI-kompatible API oder Azure OpenAI ist eine kostenpflichtige
Alternative, kein Bestandteil der kostenlosen Voreinstellung. Dafür vollständige
Chat-Completions-Adresse, Modell beziehungsweise Deployment und API-Schlüssel
eintragen. Bei Azure wird `api-key`, sonst Bearer-Authentifizierung verwendet.
Der gewählte Dienst muss den Chat-Completions-Vertrag und JSON-Antworten
unterstützen. Es werden keine API-Schlüssel in die EXE eingebaut.

## Bedienung

1. **Dokumenten-Assistent** öffnen.
2. Vor dem Import den Dokumentstand eintragen, etwa Ausgabe oder Revision.
   Dieser Stand wird nicht aus dem Dateidatum geraten und gilt nicht automatisch
   als neueste oder fachlich anwendbare Fassung.
3. Eigene PDF-, TXT- oder Markdown-Dateien hinzufügen. Originale werden kopiert;
   identische Dateien werden anhand SHA-256 erkannt und nicht doppelt indiziert.
4. Die für die Frage geltenden Dokumente über ihre Checkboxen auswählen.
5. **Fundstellen suchen** durchsucht lokal den extrahierten Text. **KI-Antwort**
   sendet nach eingerichteter Verbindung die Frage und bis zu sechs gefundene
   Auszüge an den ausgewählten Server. Ganze Dateien werden nicht übertragen.
6. Eine Quellenkarte oder Quellen-ID anklicken: Die Originalseite mit
   Markierungen öffnet sich rechts. Pfeile blättern im Original; **Original
   speichern** lädt die unveränderte importierte Datei herunter.

## Quellen und Genauigkeit

- Seitenzahlen sind physische PDF-Seiten ab 1. Ein vorhandenes abweichendes
  PDF-Blattlabel wird zusätzlich angezeigt; gedruckte Seitennummern werden nicht
  geraten.
- PDF-Textzeilen sind die nummerierten Textsegmente der Extraktion auf dieser
  Seite, keine angeblichen gedruckten Zeilennummern. Ihre Rechtecke stammen aus
  der PDF-Textschicht. Bei TXT/Markdown sind es die tatsächlichen Dateizeilen.
- Die Vorschau rendert die Original-PDF-Seite. Koordinaten werden inklusive
  Seitendrehung in die gerenderte Seite umgerechnet. Textdateien zeigen die
  nummerierten Originalzeilen mit Markierung.
- Ohne passende Fundstellen wird kein Modell kontaktiert. Ungültige oder
  erfundene Quellen-IDs sowie Absätze ohne Quellenangabe werden verworfen.
  Ein fachlich falscher Satz trotz gültiger Quellen-ID lässt sich damit nicht
  ausschliessen: Aussage, Geltungsbereich und Dokumentstand im Original prüfen.
- Die Suche ist derzeit eine lokale Volltextsuche mit Wortpräfixen. Bei anderen
  Begriffen in der Quelle die Frage umformulieren. Sie ist keine vollständige
  semantische Suche und keine automatische Normkonformitätsprüfung.
- Gescannte Seiten ohne Textschicht werden ausgewiesen. OCR, Word/Excel-Import,
  Tabellenerkennung und automatische Prüfung von Normrevisionen sind noch nicht
  integriert. Grenzen: 100 MB, 2000 PDF-Seiten und 8 Millionen Textzeichen pro Datei.

## Daten und Zugang

Dokumente liegen unter `<Toolbox-Datenordner>/documents/`: Originalkopien in
`originals/`, Metadaten, Seiten und Volltextindex in `library.sqlite`. Der Ordner
liegt ausserhalb der Installation und übersteht Updates. Er ist pro Benutzer
und PC; ein gemeinsamer KI-Server synchronisiert noch keine Dokumentbibliotheken.
**Entfernen** löscht die importierte Kopie samt Index, nicht die ursprüngliche
Datei ausserhalb der Toolbox. Fragen und Antworten werden derzeit nicht als
Chatverlauf auf der Festplatte gespeichert.

Serveradresse und Modell stehen in `ai-settings.json`. Optionale Schlüssel sind
unter Windows mit DPAPI an den angemeldeten Benutzer gebunden verschlüsselt;
auf anderen Systemen bleiben sie nur in der Sitzung. Ein explizites
`EDECO_AI_API_KEY` kann von der IT bereitgestellt werden. Bei Wechsel des
Anbieters oder Servers wird ein bisheriger Schlüssel nicht an den neuen Server
weitergereicht, sondern muss bei Bedarf neu eingetragen werden.

Alle Dokumentaktionen und Originalabrufe verlangen lokale Host-/Origin-Prüfung
und einen Sitzungsschlüssel. Die KI-Verbindung hat keine Werkzeuge, führt keine
Anweisungen aus Dokumenten aus und erhält keine Originaldateien. Dokumenttext
wird im Prompt ausdrücklich als Quellenmaterial behandelt.

## Geprüfter Umfang

Automatisierte Prüfungen decken echte PDF-Textextraktion und Pixelpositionen in
allen vier Seitendrehungen, leere Textschichten, Auswahl/Stand/Zeilennummern,
Speicherung und Löschung, Zugriffsschutz, Ollama-/OpenAI-Protokoll und ungültige
KI-Quellenangaben ab. Die KI-Protokolle werden mit simulierten Antworten geprüft;
ein tatsächlich laufender Firmenserver und die fachliche Antwortqualität müssen
bei der Einrichtung mit eigenen freigegebenen Unterlagen geprüft werden.


## Serverordner verbinden – Schritt für Schritt

Die Toolbox liest eine Windows-Freigabe und speichert durchsuchbare Kopien im
persönlichen Datenordner. Ollama erhält nur passende Textauszüge zu einer Frage.
Ollama selbst öffnet keine Dateien auf der Freigabe. Jeder Toolbox-PC hat seinen
eigenen Index. Diese Funktion ist im aktuellen Quellstand enthalten; die
Windows-Testpakete mit Commit `8a5cba73` enthalten sie noch nicht.

### 1. Zwei Angaben von der IT holen

- Einen vollständigen Ordnerpfad, beispielsweise `\\SERVER\Unterlagen` oder
  `T:\Unterlagen`. Dein Windows-Konto braucht Leserechte.
- Eine Ollama-Adresse, beispielsweise `http://KI-SERVER:11434/api/chat`, und den
  exakten installierten Modellnamen. Dateiablage und Ollama dürfen auf
  unterschiedlichen Rechnern liegen.

### 2. Ordner im Explorer prüfen

1. Windows-Taste und E drücken.
2. Oben in die Adresszeile klicken, den Ordnerpfad einfügen und Enter drücken.
3. Eine Datei öffnen. Falls Windows eine Anmeldung verlangt, das Firmenkonto dort
   verwenden. Die Toolbox speichert keine Freigabe-Passwörter.
4. Wenn der Ordner nicht erreichbar ist: zuerst Firmennetz bzw. VPN verbinden
   oder die IT nach Pfad und Berechtigung fragen.
5. Einen überschaubaren Unterordner vorbereiten: bis 200 PDF-/TXT-/MD-Dateien,
   250 MB zusammen und 100 MB je Datei. PDF maximal 2000 Seiten. Textdateien
   müssen UTF-8 sein. Scans zuerst mit OCR in der PDF-Werkstatt bearbeiten.

### 3. In der Toolbox verbinden

1. **Dokumenten-Assistent → Dokumentordner** öffnen.
2. Unter **Ordnerpfad** denselben Explorer-Pfad einfügen.
3. **Unterordner einbeziehen** nach Bedarf setzen.
4. **Verbinden und einlesen** anklicken und das Ergebnis abwarten.
5. Den Dialog schliessen. Die eingelesenen Dokumente sind ausgewählt.
6. Eine Frage eingeben, zunächst **Fundstellen suchen** anklicken und die
   Originalstelle prüfen. Dafür ist keine KI-Verbindung erforderlich.

### 4. Ollama einrichten (einmal durch die IT)

Für einen Windows-Rechner als KI-Server:

1. Ollama von [ollama.com](https://ollama.com/download/windows) installieren.
2. PowerShell öffnen und beispielsweise `ollama pull qwen3:4b` ausführen. Dieser
   einmalige Download braucht Internet; das Modell muss zur Hardware passen.
   `ollama list` zeigt die tatsächlich installierten Modellnamen.
3. Ollama über das Symbol im Infobereich vollständig beenden.
4. Im Windows-Startmenü nach **Umgebungsvariablen für dieses Konto bearbeiten**
   suchen. Eine Benutzer-Variable `OLLAMA_HOST` mit Wert `0.0.0.0:11434` anlegen.
5. Für ausschliesslich lokale Modelle zusätzlich `OLLAMA_NO_CLOUD` mit Wert `1`
   anlegen. Änderungen bestätigen und Ollama über das Startmenü neu starten.
6. Die IT gibt TCP-Port 11434 in der Firewall nur für die benötigten internen
   Rechner frei. Keine Portweiterleitung vom Internet auf einen ungeschützten
   Ollama-Dienst einrichten. Dauerbetrieb, Hardware und geschützte Zugänge
   organisiert die IT.
7. Adresse und Modellname an die Toolbox-Benutzer weitergeben.

Grundlage: [offizielle Ollama-FAQ](https://docs.ollama.com/faq) und
[Windows-Anleitung](https://docs.ollama.com/windows). Auf den Toolbox-PCs wird
kein Modell installiert; der PDF-Offline-Dienst bleibt davon unabhängig.

### 5. KI-Verbindung in der Toolbox prüfen

1. **KI-Verbindung** öffnen und **Firmen-KI mit Ollama** auswählen.
2. Vollständige Adresse einschliesslich `/api/chat` eintragen.
3. Den von der IT genannten Modellnamen eintragen, beispielsweise `qwen3:4b`.
4. Falls die IT einen geschützten Zugang bereitstellt, den Schlüssel ergänzen.
5. **Speichern und Server prüfen** anklicken. Diese Prüfung sendet keine
   Dokumenttexte, sondern fragt installierte Modelle ab.
6. Dialog schliessen, Dokumente auswählen und **KI-Antwort** ausprobieren.
   Frage und passende Auszüge werden erst bei dieser Aktion gesendet.

### 6. Aktualisieren und Verbindung trennen

Nach Änderungen auf dem Server **Dokumentordner → Jetzt aktualisieren** anklicken.
Geänderte Dateien ersetzen ihre verwalteten lokalen Vorgänger. Auf dem Server
entfernte Dateien verschwinden aus diesem verwalteten lokalen Bestand.
Manuell importierte, bereits vorher vorhandene identische Dokumente werden dabei
nicht gelöscht. Bei nicht erreichbarem Ordner bleibt der lokale Index erhalten.
Fehler einzelner Dateien werden angezeigt; gegebenenfalls bleibt deren bisherige
lokale Fassung erhalten. Quellen daher bei Aktualisierungsfehlern überprüfen.

Es gibt keine automatische Hintergrundüberwachung. **Verbindung trennen** oder
der Wechsel zu einem anderen Ordner behält bestehende lokale Kopien bei; sie
werden danach nicht mehr mit dem alten Ordner abgeglichen. Einzelne lokale
Dokumente lassen sich weiterhin über **Entfernen** aus der Bibliothek löschen.
Der Assistent ändert oder löscht niemals Quelldateien auf dem Server.

### Häufige Fehler

| Meldung/Problem | Nächster Schritt |
| --- | --- |
| Ordner nicht erreichbar | Pfad im Explorer öffnen, Firmennetz/VPN und Rechte prüfen |
| Zu viele oder zu grosse Dateien | Einen kleineren Unterordner verbinden |
| Modell fehlt | `ollama list` auf dem Server prüfen, exakten Namen übernehmen |
| KI-Server nicht erreichbar | Server läuft? Adresse, `/api/chat` und interne Firewall durch IT prüfen |
| Scan liefert keine Fundstellen | Erst OCR durchführen und die durchsuchbare Datei importieren |
| Neue Dokumente fehlen | „Jetzt aktualisieren“, danach neue Dokumente auswählen |
| Quelle stammt aus alter Fassung | Aktualisierungshinweise prüfen; Originalstand fachlich kontrollieren |

Die gleiche Anleitung ist direkt unter **Dokumentordner** und **KI-Verbindung**
aufklappbar. Ein echter SMB-Firmenserver und eine echte Ollama-Instanz müssen
abschliessend mit den konkreten Angaben der IT getestet werden.
