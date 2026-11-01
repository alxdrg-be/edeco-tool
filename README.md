# edeco Toolbox

Gemeinsame, erweiterbare Desktopanwendung für die Elektroplanung: edeco-Logo,
farbige Werkzeugkacheln, Suche, Kategorien und Hell-/Dunkelmodus.

## Werkzeuge

| Werkzeug | Stand | Kennfarbe |
| --- | --- | --- |
| NOVA-Legenden | Nutzbar, Work in progress | Petrol |
| BIM2STEIGER | Nutzbar, Work in progress; lokaler Katalog integriert | Blau |
| Dokumenten-Assistent | Nutzbar, Work in progress; lokale Suche, KI über gemeinsamen Server | Violett |
| Dateien umbenennen | Nutzbar, Work in progress | Grün |
| PDF-Werkstatt | Stirling Core mit vollständig mitgelieferter Windows-Offline-Laufzeit | Rosé |
| Projektzentrale | Nutzbar, Work in progress | Petrol |
| Planlieferungs-Assistent | Nutzbar, Work in progress; ZIP, Planlisten und Projektverlauf | Grün |
| Berechnungen | 25 native Schweizer Rechenhilfen und Vorprüfungen | Blau |
| ↳ Blitzschutz | Trennungsabstand; fachliche Freigabe offen | Orange |
| Änderungsbericht | Geplant | Orange |
| Leistungsbilanz | Geplant | Violett |
| ↳ Kabelberechnung | Schweizer Spannungsfall-Vorprüfung; fachliche Freigabe offen | Blau |
| Anlagetool | Geplant | Grün |

BIM2STEIGER verwendet seinen vorhandenen Katalog mit 11’777 Katalogartikeln,
Originalbildern, Favoriten, Modellimport und Ausschreibungen. Es läuft unter
`/tools/bim2steiger/` im selben lokalen Server und Desktopfenster wie Nova.
Die drei geplanten Erweiterungen sind als ausgegraute, deaktivierte Kacheln
vorbereitet; Leistungsbilanz liegt im Bereich Berechnungen.
Alle zehn Hauptkacheln sind im normalen Desktopfenster (1400 × 900)
ohne Scrollen sichtbar; kleinere Fenster können scrollen. Umfang und Reihenfolge
der Erweiterungen stehen im [Ausbauplan](docs/TOOLBOX_AUSBAUPLAN.md).

**Dateien umbenennen** bereitet PDF-Namen nach einer gespeicherten Vorlage vor,
zum Beispiel `1498_E-G-APP-OG02-C-50.pdf`. Projektnummer, Fachbereich,
Darstellung, Planart, Geschoss, Index, Massstab und optional Datum lassen sich
einzeln einschalten und umsortieren. Eigene Kürzel sind möglich; die vollständige
Firmenliste folgt später. Geschosse werden aus Dateinamen und dem Text der ersten
fünf PDF-Seiten erkannt, Widersprüche bleiben zur manuellen Auswahl offen.
Die Vorschau ist korrigierbar und verhindert doppelte Namen. Der ZIP-Download
enthält benannte, inhaltlich unveränderte Kopien; Originaldateien werden nicht
umbenannt. Scans erhalten keine automatische OCR. Grenzen: 100 PDFs, je 30 MB,
insgesamt 150 MB. Vorlagen bleiben auf diesem PC gespeichert; ausgewählte Dateien
und einzelne Korrekturen nur bis zum Verlassen des Werkzeugs.

Die **Projektzentrale** verwaltet Projektnummer, Name, Adresse, Ablageordner,
Notizen, Kontakte und Dokumentverweise. Laufende und archivierte Projekte lassen
sich getrennt durchsuchen. Neue Projekte werden aktiv ausgewählt; die Auswahl
ist auch im Kopf der Toolbox änderbar und bleibt nach einem Neustart bestehen.
„Dateien umbenennen“ übernimmt beim Öffnen die aktive Projektnummer. Ändert sich
das aktive Projekt in einem anderen Fenster, bleibt eine offene Namensvorlage
erhalten; die neue Nummer lässt sich bewusst übernehmen.
Projektordner können im Dateimanager geöffnet, Dokumentpfade kopiert werden.
Ordner und Dokumente werden nicht automatisch angelegt, verschoben oder kopiert.
Die Projektliste liegt lokal im Toolbox-Datenordner und wird nicht zwischen PCs
synchronisiert. Bestehende NOVA-Projekte behalten ihre eigene Verwaltung.

Der **Planlieferungs-Assistent** übernimmt ein Projekt und die Namensvorlage.
Pro PDF können Geschoss, Planart, Index und Massstab korrigiert werden. Das
Lieferpaket enthält unveränderte PDF-Kopien und eine Planliste als CSV (Excel),
HTML-Druckansicht und JSON mit SHA-256-Prüfsummen. Empfänger, Lieferdatum und
Projektstand werden dauerhaft protokolliert. Wiederholtes Herunterladen derselben
Vorbereitung erzeugt keinen doppelten Verlaufseintrag. Die Projektzentrale zeigt
die letzten 200 Lieferungen der Toolbox mit Planlisten. PDF-Inhalte und ZIPs
werden serverseitig nicht dauerhaft gespeichert; nur ihre Metadaten und Prüfsummen.
Ein vorbereitetes Paket ist kein Versand. Erst die ausdrückliche Bestätigung
„Als versendet bestätigen“ protokolliert den Versand; das Tool sendet keine E-Mails.

Unter **Berechnungen** liegen 25 native Rechenhilfen: die 24 Themen der Schweizer
Referenz und zusätzlich Blitzschutz. Die Werkzeuge sind eigene Modellrechnungen
und Vorprüfungen. Normtabellenwerte, Herstellergrenzen und Korrekturfaktoren sind
teilweise ausdrücklich manuell einzutragen; eine vollständige Gleichwertigkeit
mit den Fachkatalogen der Referenz wird nicht behauptet. Umfang je Rechner:
[Rechner und Grenzen](docs/RECHNER_UMFANG.md). Formeln und ausgewählte
Zahlenfälle sind zusätzlich gegen sichtbare Clientlogik geprüft:
[Quellenabgleich](docs/RECHNER_QUELLENABGLEICH.md). Leistungsbilanz bleibt zusätzlich
geplant. Die gemeinsame Ablage
speichert Rechenstände und Notizen nach Berechnungstyp und Projekt in einem
einstellbaren Serverordner, einschliesslich importierter PDF-/JSON-Exporte.
Einrichtung, Grenzen und Zusammenarbeit: [Berechnungsablage](docs/BERECHNUNGSABLAGE.md).
Die React-Oberfläche nutzt Tailwind mit eigenem
`edeco:`-Präfix und Lucide-Symbole. Navigation und Projektkontext bleiben in der
edeco Toolbox. Der Rechnerbereich hat einen lokalen Tech-Dunkelmodus und eine
helle edeco-Ansicht; andere Werkzeuge behalten ihre Darstellung. Slider und
Zahlenfelder aktualisieren SVG und Live-Werte sofort. Alle Parameter haben
Info-Icons für fokussierbare, per Escape schliessbare Grundlagen-Drawer.
Blitzschutz berechnet den Trennungsabstand mit
`s = k × (U / xₙ) / n × A`, zeigt Leitungsweg und Abstand in einer eigenen
Gebäudezeichnung und prüft die Mindestanzahl Ableiter gesondert. Grundlage ist
das [veröffentlichte Schweizer Verfahren von Arthur Flury](https://www.aflury.ch/de/fachwissen/trennungsabstand-rechner/)
mit Bezug auf SN 414022:2024, Seite 38. Klassen I–III, Einheiten, Faktoren,
Aufrundung und Grenzen stehen im Info-Drawer und im Druckbericht. Das Dachmodell
reagiert schematisch auf A, ein Dachobjekt lässt sich mit Maus oder Tastatur
verschieben. Die Zone wechselt bei unterschrittenem Abstand auf Rot; sie zeigt
keinen Fangschutzbereich. Fünf Zahlenfälle sind gegen die Referenz
geprüft; eine fachliche Freigabe am Objekt ist noch offen. Entwürfe werden lokal
im Browserprofil pro ausgewähltem Projekt gespeichert. JSON-Export und
Drucken/als PDF speichern sind vorhanden. Keine Fremdskripte oder externen
Aufrufe sind zur Laufzeit für die Rechnung erforderlich.

**Kabel-Spannungsfall** verwendet ausschliesslich die veröffentlichte Schweizer
Referenz von [elektro-rechner.ch](https://www.elektro-rechner.ch/Rechner/spannungsfall.html)
mit Bezug auf [NIN 2025 / Electrosuisse](https://www.electrosuisse.ch/de/nin-2025/):
Widerstandswerte nach SN EN 60228, Korrektur auf 55 °C und ein ausdrücklich als
Richtwert markierter Reaktanzanteil. Wechsel- und symmetrischer Drehstrom, Cu und
Al (ab 10 mm²), Spannungsverlauf, Budgetvergleich und nächster geeigneter
Standardquerschnitt allein aus Spannungsfall sind vorhanden. Das voreingestellte
4-%-Budget gilt nicht zusätzlich pro Abschnitt; vorgeschaltete Abschnitte sind
im Projekt zu berücksichtigen. Strombelastbarkeit, Verlegeart, Schutzorgane und
Abschaltbedingungen werden nicht nachgewiesen. Fünf Wertevergleiche gegen die
Schweizer Referenz stimmen überein. Deutsche Grenzwerte oder ein zusätzlicher
IEC-Rechnermodus sind nicht enthalten. Der vollständige Normtext und eine
fachliche Freigabe bleiben ausserhalb dieses Prototyps.

Der **Dokumenten-Assistent** liest eigene PDF-, TXT- und Markdown-Dateien ein.
Fundstellen enthalten Dokumentstand, PDF-Seite beziehungsweise Blattlabel und
Textzeilen. Ein Klick zeigt die Stelle im Original markiert. Die Fundstellensuche
funktioniert ohne KI-Server. Formulierte Antworten können über einen gemeinsamen
Ollama-Server mit freiem Modell erzeugt werden: keine API-Gebühren und keine
Modellinstallation auf den einzelnen Toolbox-PCs. Die Dokumentbibliothek bleibt
zunächst pro PC; sie wird nicht automatisch zwischen Rechnern geteilt.
Eine kostenpflichtige OpenAI-kompatible API ist optional. Details und Grenzen:
[Dokumenten-Assistent](docs/DOKUMENTEN_ASSISTENT.md).

Die **edeco PDF-Werkstatt** verwendet die originale kostenlose Stirling-Core-Oberfläche.
Ab 0.5.0 enthalten Windows-Setup und Portable-Paket Java, Windows-PDFium, qpdf,
Tesseract und OCR-Sprachdaten für Deutsch/Englisch. Der Dienst startet automatisch
auf 127.0.0.1 und benötigt weder Internet noch Firmenserver, VPN, Docker oder
zusätzliche Installationen. Lizenztexte und mitgelieferte Quellen sind unter
**Info / Lizenzen** zugänglich. [Offline-Build, Tests und Einschränkungen](docs/PDF_OFFLINE_WINDOWS.md).

Die gemeinsame Anwendung liegt auf `main`. Die Branches `Nova-Legenden` und
`BIM2STEIGER` enthalten die ursprünglichen Programme; `toolbox` hält den bisherigen
Integrationsstand fest.
Branches sind Entwicklungsstände, keine zur Laufzeit geladenen Plugins.

## Aus dem Quellcode starten

Voraussetzungen: Python ab 3.11, Node.js ab 22.18 (oder ab 24).

**Windows:** `start.bat` doppelklicken. Die erste Ausführung installiert die
Abhängigkeiten und baut die Oberfläche. `start.bat --browser` öffnet den Browser.
Nach Quellcode- oder Abhängigkeitsänderungen `setup.bat` erneut ausführen.

**Linux/macOS:** `bash setup.sh`, danach `bash start.sh --browser`.
Nur den lokalen Server starten: `bash start.sh --server --port 8765`.
Der Server lauscht ausschließlich auf `127.0.0.1`.

NOVA-Legenden verwendet weiterhin seine bestehenden Datenpfade. Für eine
isolierte Testumgebung `NOVA_LEGENDEN_HOME` auf einen eigenen Ordner setzen.
BIM-Favoriten und Ausschreibungen verwenden weiterhin die bisherigen lokalen
Browserspeicherschlüssel. Bei einem Wechsel von Host oder Port bestehende
Arbeitslisten im Einzelprogramm als JSON sichern und in der Toolbox laden.
Die gemeinsame Toolbox-Oberfläche startet mit `python -m edeco_toolbox`
(bei gesetztem `PYTHONPATH=backend`).

## Entwicklung und Tests

```sh
.venv/bin/python -m pytest backend/tests -q
(cd backend/bim2steiger && ../../.venv/bin/python -m unittest discover -s tests -q)
cd ui
npm test
npm run build
```

Browser-Tests benötigen zusätzlich `backend/requirements-browser-tests.txt` und
Chromium (`python -m playwright install chromium` oder `NOVA_TEST_CHROMIUM`
auf einen vorhandenen Browser setzen). Tests mit echten Nova-Beispieldateien
werden ohne den lokalen Ordner `samples` übersprungen.

Frontend mit automatischem Neuladen: Im Ordner `ui` `npm run dev` starten;
parallel den Python-Server mit `bash start.sh --server --port 8765` ausführen.

BIM-Importherkunft: [Importstand](docs/BIM2STEIGER_IMPORT.md).
Weitere Module: [Toolbox erweitern](docs/TOOLBOX_ERWEITERN.md).
Nova-Funktionen: [ursprüngliche Dokumentation](docs/NOVA_LEGENDEN.md).

## Windows-Installer

Der Workflow **Toolbox: Windows-Setup bauen** läuft bei Änderungen auf `main`
und lässt sich dort auch manuell starten. Er baut das gemeinsame Windows-Paket,
prüft den Start der EXE und die drei Module und stellt zwei GitHub-Actions-Artefakte
bereit:

- **edeco-Toolbox-Setup-Build-…**: Setup-EXE mit SHA-256-Prüfsumme.
- **edeco-Toolbox-portabel-Build-…**: Vollständiger Programmordner. ZIP komplett
  entpacken und `edeco-Toolbox.exe` starten; die Unterordner müssen dabei bleiben.

Download: Auf GitHub **Actions → Toolbox: Windows-Setup bauen → erfolgreicher
Lauf → Artifacts** öffnen. Nach allen erfolgreichen Prüfungen veröffentlicht
`main` außerdem automatisch ein Release `v<Version>-build.<Nummer>` unter
[Releases](https://github.com/alxdrg-be/edeco-tool/releases). Dort liegen Setup,
portable ZIP, Einrichtungspakete und zugehörige SHA-256-Dateien dauerhaft.
Ab 0.3.0 enthält das Release zusätzlich `edeco-KI-Server-Einrichtung-….zip` mit
Anleitung und Starthelfer für den einen gemeinsamen KI-Server. Diese ZIP wird
auf den normalen Toolbox-PCs nicht benötigt.
Ab 0.5.0 ist der PDF-Dienst in beiden Windows-Paketen enthalten. Das frühere
separate Docker-Dienstpaket entfällt. Der Download ist entsprechend grösser;
für Installation und Updates mindestens 6 GB freien Speicher vorsehen.
Bei einer Vorversion mit 512-MiB-Updategrenze das neue Setup einmal von der
Release-Seite starten; das vorhandene Benutzerprofil bleibt erhalten.
Die Windows-EXE und das Setup werden erst in diesem Windows-Workflow erzeugt;
sie sind kein Bestandteil des Quellcode-Imports.


## Gemeinsame Updates und persönliche Daten

Im Toolbox-Startbildschirm **Nach Updates suchen** öffnen. Installierte und
portable Windows-Versionen prüfen standardmässig beim Start nach neuen Releases;
im Quellcode erfolgt die Prüfung manuell. Die Option lässt sich ausschalten.
Die installierte Windows-Version bietet nach Bestätigung den Download des
Setups an, prüft Grösse und SHA-256 aus GitHub und schliesst die Toolbox.
Ein unabhängiger Helfer wartet auf das Prozessende, installiert am bisherigen
Ort und startet die Toolbox danach wieder. Portable Versionen und Quellcode
werden nicht durch den Installer überschrieben; dort führt der Link zu Releases.

Das Repository ist privat. Verwendet werden vorhandene `GH_TOKEN`-/
`GITHUB_TOKEN`-Variablen oder GitHub-CLI-/Git-Credential-Manager-Anmeldungen
mit Lesezugriff. Tokens bleiben im Arbeitsspeicher und werden nicht in
Einstellungsdateien gespeichert. Eine Anmeldung allein im Browser kann das
Programm nicht übernehmen; in diesem Fall die Releases im angemeldeten Browser
öffnen und das Setup manuell herunterladen.

Das dauerhafte Desktopprofil liegt unter `%LOCALAPPDATA%/edeco-Toolbox/webview`,
Updateeinstellungen und letzter Port daneben. `EDECO_TOOLBOX_HOME` überschreibt
diesen Datenordner. Bestehende Nova-Projekte bleiben an ihren bisherigen Pfaden.
Bei einem Wechsel von einer älteren Version mit flüchtigem WebView-Profil
BIM-Arbeitslisten vor dem Schliessen als JSON sichern und im neuen Profil laden.
Versionen ohne gemeinsamen Updater müssen einmal manuell aktualisiert werden.

## Windows-Fensterstart

Ab Version 0.2.1 enthält die portable Ausgabe zusätzlich
`edeco-Toolbox.exe.config` direkt neben der EXE. Diese Datei gehört zum Programm
und wird auch vom Setup installiert. Sie ermöglicht das Laden der mitgelieferten
.NET-Assemblies nach dem Entpacken eines Internetdownloads. Die Windows-Prüfung
öffnet vor jeder Veröffentlichung jetzt das echte Programmfenster, auch mit
Download-markierten DLLs. Details: [Windows-Startprüfung](docs/WINDOWS_START.md).
