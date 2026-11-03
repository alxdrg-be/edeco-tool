# Dokumenten-Assistent

Der Assistent beantwortet Fragen anhand eigener Unterlagen. Er trainiert kein
neues Modell aus den Dateien: Zuerst wird in den ausgewählten Dokumenten nach
passenden Textstellen gesucht, dann kann ein KI-Modell diese Stellen zu einer
Antwort zusammenfassen. Jede angezeigte Quellen-ID stammt aus dem lokalen Index.

## Qwen lokal auf diesem PC

Die Anleitung ist direkt unter **Dokumenten-Assistent → KI-Verbindung**
verfügbar: **Qwen auf diesem PC einrichten** aufklappen. Die Fundstellensuche
funktioniert bereits ohne ein KI-Modell. Für lokal formulierte Antworten:

1. [Ollama für Windows](https://ollama.com/download/windows) installieren und
   starten.
2. PowerShell öffnen und das Modell einmal herunterladen:
   `ollama pull qwen3:4b`.
3. Im Toolhub **Qwen / Ollama** wählen und als Adresse
   `http://127.0.0.1:11434/api/chat`, als Modell `qwen3:4b` eintragen.
   Für einen lokalen Ollama-Dienst ohne Zugangsschutz bleibt der Schlüssel leer.
4. **Speichern und Verbindung prüfen** anklicken. Ollama muss während der
   KI-Nutzung laufen.

Der erste Download benötigt Internet und mehrere GB Speicher. Mit dem lokal
installierten Modell können Suche und Antworten anschliessend auf diesem PC
offline laufen. 16 GB RAM sind für den Einstieg sinnvoll; eine passende GPU
beschleunigt die Antworten. Geschwindigkeit und Qualität hängen vom Modell und
der verfügbaren Hardware ab. Bei anderen Modellen müssen der heruntergeladene
Name und der Eintrag im Toolhub übereinstimmen.

Das Öffnen oder Aufklappen der Anleitung ändert keine Verbindungseinstellungen
und startet keine Installation. Die vorhandene Adresse wird erst durch das
bewusste Bearbeiten und Speichern des Formulars geändert.

## Ohne laufende API-Gebühren auf mehreren PCs

Alternativ können mehrere Toolhub-PCs einen gemeinsamen Ollama-Server mit einem
freien Modell verwenden. Ollama und die Modellgewichte werden dafür nur einmal
auf dem Server installiert. Die PCs verbinden sich über **KI-Verbindung** mit
dessen Adresse. Der Server braucht geeignete Hardware und muss während der
Nutzung laufen; Hardware, Strom und Betreuung sind nicht durch das Programm
abgedeckt.

Das Release enthält dafür `edeco-KI-Server-Einrichtung-<Version>.zip`. Die
[Einrichtungsanleitung](../packaging/ki-server/README.md) beschreibt den einmaligen
Start. Beispiel: `http://192.168.1.20:11434/api/chat`, Modell `qwen3:4b`.
Ein optionaler geschützter Serverzugang ist ebenfalls möglich. Die
Verbindungsprüfung liest nur die verfügbaren Modellnamen und überträgt keine
Dokumenttexte.

Die lokale Fundstellensuche mit Quellen und Markierungen braucht keinen KI-Dienst.
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
   Auszüge an den ausgewählten Ollama-Dienst oder die KI-API. Im lokalen Modus
   bleibt dies auf demselben PC. Ganze Dateien werden nicht übertragen.
6. Eine Quellenkarte oder Quellen-ID anklicken: Die Originalseite mit
   Markierungen öffnet sich rechts. Pfeile blättern im Original; **Original
   speichern** lädt die unveränderte importierte Datei herunter.

## Dokumentordner verbinden

Über **Dokumentordner** lassen sich ein absoluter lokaler Ordnerpfad oder eine
Windows-Freigabe wie `\\SERVER\Unterlagen` anbinden. Im Programmfenster kann der
Ordner mit **Auswählen** gewählt werden; im Browser bleibt die Pfadeingabe.
Die aufklappbare Anleitung erklärt die Einrichtung direkt im Dialog.

- **Verbinden und einlesen** speichert die gewählte Quelle und startet den
  ersten lesenden Abgleich. Nur dabei beziehungsweise mit **Jetzt aktualisieren**
  wird der Quellordner durchsucht. Beim Programmstart und beim Öffnen des Dialogs
  findet kein automatischer Scan statt.
- Unterstützt werden PDF, UTF-8-TXT und Markdown. Grenzen pro Quelle: 200
  Dokumente, 250 MB insgesamt, 100 MB pro Datei und 5000 Dateisystemeinträge
  einschliesslich nicht unterstützter Dateien und Unterordner. Die vorhandenen
  Grenzen für PDF-Seiten und extrahierten Text gelten weiterhin.
- Quelldateien werden nur gelesen; Kopien und Suchindex liegen auf diesem PC.
  Der Zugriff verwendet die Windows-Rechte des angemeldeten Toolhub-Benutzers.
  Firmenfreigaben vorher im Explorer mit Firmennetz/VPN und Leserechten prüfen.
  Verknüpfungen und Junctions werden nicht verfolgt.
- Beim ausdrücklichen Abgleich werden neue und geänderte Dokumente übernommen.
  Entfernte beziehungsweise ersetzte verwaltete Kopien werden aus dem lokalen
  Index entfernt. Identische Inhalte werden über SHA-256 dedupliziert.
  Zusätzlich manuell importierte Dokumente bleiben erhalten, auch wenn der
  manuelle Import erst nach dem Ordnerimport erfolgt ist.
- **Verbindung trennen** und ein Ordnerwechsel behalten die bisherigen lokalen
  Dokumente. Ein nicht erreichbarer Quellordner oder während des Lesens
  ausgetauschte, veränderte oder unlesbare Dateien löschen keine letzte gültige lokale Kopie.
  Hinweise zur Aktualisierung zeigen solche Fälle an.

Der Ordner und die KI sind getrennt eingerichtet: Ordnerimport und
Fundstellensuche brauchen kein KI-Modell. Ollama liest keine Freigabe selbst;
erst **KI-Antwort** sendet die Frage und passende Auszüge aus dem lokalen Index
an die zuvor eingerichtete KI. Dokumentstände und Geltungsbereiche werden nicht
aus Dateidatum oder Ordnernamen als fachlich gültig abgeleitet.

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
Speicherung und Löschung, lesenden Ordnerabgleich inklusive Grenzen,
Verknüpfungen und getrennt erhaltenen manuellen Kopien, Zugriffsschutz,
Ollama-/OpenAI-Protokoll und ungültige
KI-Quellenangaben ab. Die KI-Protokolle werden mit simulierten Antworten geprüft;
ein tatsächlich laufender Firmenserver und die fachliche Antwortqualität müssen
bei der Einrichtung mit eigenen freigegebenen Unterlagen geprüft werden.
