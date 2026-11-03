## Neue Projekt- und Rechenwerkzeuge

- Anschluss-/Vorsicherungswerte und weitere Gerätenennwerte als Dropdowns aus der Schweizer Referenzauswahl; kontinuierliche Messwerte bleiben frei. Abweichende gespeicherte Projektwerte bleiben erhalten.
- Referenznähere Darstellung mit direkt sichtbaren Schemas, bemassten Raumplänen, jährlichen Kostensäulen, zugeordneten Kennzahlen und kurzen Lesehilfen. Formeln und geprüfte Zahlenfälle sind im Quellenabgleich dokumentiert; das ersetzt keine Normfreigabe.
- Berechnungsverhalten für bereits erreichten Leistungsfaktor und ausgeblendete statische Ladefaktoren korrigiert. Modelldateien zur Vermeidung von Windows-Importkollisionen eindeutig benannt.

- 25 native Rechenhilfen: eigene Vorprüfungen für die 24 Schweizer Referenzthemen plus Blitzschutz. Die bisherigen acht Entwurfskacheln rechnen jetzt; Umfang und Grenzen sind pro Rechner dokumentiert. Normtabellenwerte und Herstellergrenzen werden teilweise manuell eingetragen und nicht als automatische Fachkataloge ausgegeben.
- Ladegrids mit reaktivem Schema: Hausanschluss, Unterverteiler, gerade Sammelschiene, Ladepunkte und Fahrzeuge. Cyan zeigt eingehaltene Leistungsbudgets, Gelb begrenzte Zuteilung, Rot die Überschreitung am jeweiligen Abschnitt. Die Kabel-/Schutzauslegung bleibt ungeprüft.
- Gemeinsame Serverablage: Ordner einrichten, Rechenstände nach Berechnung und Projekt speichern, Notizen ergänzen und Eingaben neu berechnen. PDF-/JSON-Exporte können zusätzlich importiert werden. Kein SQLite auf dem Netzlaufwerk.

- Rechner-Prototyp im edeco Rahmen: 65/35-Ansicht, synchronisierte Slider und Zahlenfelder, Tech-Dunkel-/Hellmodus, Lucide-Symbole und Info-Drawer für Formeln, Schweizer Quellen und Grenzen. Tailwind ohne globale Rücksetzung und mit eigenem Präfix.
- Blitzschutz: interaktives Gebäude mit verschiebbarem Dachobjekt, schematischer Abstandszone und Warnfarben; Schweizer SN-414022-Verfahren bleibt erhalten.
- Kabel-Spannungsfall: Schweizer Referenzmodell bei 55 °C, Wechsel-/Drehstrom, Cu/Al, Spannungsverlauf und Querschnitt allein nach Spannungsfall. Reaktanz als Richtwert markiert; Strombelastbarkeit und Schutzmassnahmen nicht geprüft. Nur Schweizer fachliche Quellen.
- Planlieferungs-Assistent: Projekt, Empfänger und Lieferdatum wählen, PDFs mit Geschoss, Planart, Index und Massstab prüfen und als ZIP mit CSV-, Druck- und JSON-Planliste herunterladen. Unveränderlicher Projektverlauf mit Prüfsummen; Versand nur nach gesonderter Bestätigung protokollieren.
- Bereich Berechnungen mit 25 nativen Rechenhilfen und zusätzlich geplanter Leistungsbilanz. Blitzschutz-Rechenhilfe mit eigener Gebäudevisualisierung, sichtbaren Faktoren und Rechenschritten, Abstandsvergleich und JSON-/Druckexport. Zahlenvergleich gegen die veröffentlichte Arthur-Flury-Referenz; fachliche Freigabe offen.
- Projektzentrale: Projektnummer, Name, Adresse, Ablageordner, Notizen, Kontakte und Dokumentverweise lokal verwalten. Suche, Archivierung und dauerhafte aktive Projektauswahl in der Toolbox ergänzt.
- Aktive Projektnummer an „Dateien umbenennen“ übergeben, inklusive direktem Werkzeugwechsel. Offene Namensvorlagen bleiben bei einem externen Projektwechsel erhalten; neue Nummer bewusst übernehmen.
- Schutz vor ungespeicherten Eingaben und konkurrierenden Projektänderungen. Projektordner im Dateimanager öffnen, Dokumentpfade kopieren. Keine automatische Verlagerung von Dateien oder Zusammenführung mit bestehenden NOVA-Projekten.
- Dateien umbenennen: Grundgerüst mit Projektnummer und einzeln wählbaren, sortierbaren Namensbausteinen nach dem Beispiel `1498_E-G-APP-OG02-C-50.pdf`. Datum standardmässig aus.
- Geschosse aus Dateinamen und PDF-Text erkennen (z. B. `2og` → `OG02`), widersprüchliche Angaben manuell klären; Namen in der Vorschau korrigieren und Konflikte vor dem Export beheben.
- Vorläufige Kürzelauswahl mit eigener Eingabe; Firmenliste folgt. Namensvorlage lokal speichern und benannte PDF-Kopien als ZIP herunterladen. Originale bleiben unverändert.

## edeco Toolbox 0.5.0

- Gemeinsame Werkzeugleiste mit genau einem edeco-Logo, Rückweg und Hell-/Dunkelmodus in allen Tools. Akzentfarben: NOVA Petrol, BIM Blau, Dokumenten-Assistent Violett und PDF-Werkstatt Rosé; eingebettete Arbeitsbereiche folgen dem gewählten Modus.
- edeco PDF-Werkstatt vollständig lokal: Java 25, Windows-PDFium, qpdf und Tesseract inklusive Deutsch/Englisch in Setup und Portable-Paket enthalten.
- Automatischer Start auf 127.0.0.1 mit zufälligem Port und Sitzungsschutz; Windows Job Objects beenden auch Kindprozesse beim Absturz oder erzwungenen Beenden.
- Zusammenfügen, Trennen, Vorschau, Drehen, Zuschneiden, Skalieren, Komprimieren, Bild-/Text-Konvertierung und OCR werden mit dem tatsächlichen Windows-Paket geprüft.
- Offline-Oberfläche mit edeco-Logo; Originalhinweise, Lizenztexte und Quellcode-Beigaben unter Info / Lizenzen.
- Kein PDF-Firmenserver, Internet, VPN, Docker oder separates Java nötig. Office-/Webseiten-/Video-/KI-Konvertierung und OCRmyPDF-Zusatzoptionen gehören nicht zu dieser Ausgabe.
- Grössere Pakete: Updateprüfung unterstützt Setups bis 1900 MiB, streamt die Prüfsummenprüfung und prüft freien Speicher. Mindestens 6 GB freien Speicher vorsehen.

## edeco Toolbox 0.4.0

- PDF-Werkstatt: die vorhandene Stirling-PDF-Core-Oberfläche öffnet sich direkt im Toolbox-Fenster mit edeco-Logo und Firmenfarben.
- PDF-Funktionen bleiben bei Stirling: Seiten bearbeiten, zusammenführen, teilen, konvertieren, signieren und schwärzen, abhängig von den installierten Werkzeugen.
- Reproduzierbarer Dienst auf Basis von Stirling Core 3.2.2 mit festgelegtem Image-Digest; OCR Deutsch/Englisch, OCRmyPDF, Ghostscript und QPDF ergänzt. Lokal oder auf einem internen Firmenserver betreibbar.
- Firmenvorgaben für Dienstadresse, Namen, Akzentfarbe und freigegebene Abläufe. Beispiel: PDF als ENTWURF stempeln und unter neuem Namen im Netzordner ablegen.
- Hinweis vor dem Verlassen eines Arbeitsbereichs mit geöffneten/verarbeiteten Dateien; bestehende Ergebnisse zuerst speichern.
- Build prüft die echte Stirling-Verarbeitung und die eingebettete Oberfläche. Python-Modulpfad im PDF-Prüfschritt des Windows-Builds korrigiert.

## edeco Toolbox 0.3.0

- Neuer Dokumenten-Assistent: eigene PDFs und UTF-8-Textdateien hinzufügen, Dokumentstände angeben und gezielt durchsuchen.
- Fundstellen mit Dokumentname, Stand, PDF-Seite, vorhandenem Blattlabel und Textzeilen; Originalseite mit direkt markiertem Text öffnen.
- Kostenlose Fundstellensuche ohne KI-Zugang. Formulierte Antworten über einen gemeinsamen Ollama-Server mit freiem Modell: keine API-Gebühren und keine lokale Modellinstallation auf den Toolbox-PCs.
- Verbindungsprüfung für den KI-Server. Separates Einrichtungspaket für den Server unter den Release-Dateien.
- Nur auf ausdrückliche Frage werden passende Textauszüge an den eingestellten Server gesendet. Originale und Suchindizes bleiben im persönlichen Toolbox-Datenordner erhalten.
- KI-Quellenangaben werden gegen die tatsächlich gefundenen Stellen geprüft; Antworten ohne gültige Quellenangaben werden nicht angezeigt. Fehlende Belege werden benannt. Die fachliche Prüfung erfolgt anhand der Originale.
- PDFs ohne Textschicht werden erkannt; Texterkennung (OCR) ist noch nicht integriert. Bibliotheken sind derzeit pro PC, nicht automatisch firmenweit synchronisiert.
- Optional weiterhin OpenAI-kompatible API statt Firmenserver. Zugangsschlüssel werden unter Windows mit dem Benutzerprofil verschlüsselt gespeichert.
- Zehn Kacheln auf der gemeinsamen Startseite. Windows-Paketprüfung ergänzt: PDF einlesen, Fundstelle finden und Originalseite rendern.

## edeco Toolbox 0.2.2

- Sieben Erweiterungen als geplante Kacheln vorbereitet: Dateien umbenennen, PDF-Werkzeuge, Projektzentrale, Änderungsbericht, Leistungsbilanz, Kabelberechnung und Anlagetool.
- Die neuen Bereiche bleiben bis zur Umsetzung ausgegraut und deaktiviert. NOVA-Legenden und BIM2STEIGER bleiben zugänglich.
- Kompaktere Startseite: alle neun Kacheln im normalen Desktopfenster ohne Scrollen; kleinere Fenster bleiben scrollbar.
- Ausbauplan mit vorgesehenen Funktionen, Reihenfolge und gemeinsamen Integrationsregeln ergänzt. Bestehende Electrosuisse-Werkzeuge sollen vor der Umsetzung eigener Berechnungen berücksichtigt werden.

## edeco Toolbox 0.2.1

- Windows-Startkorrektur für .NET-DLLs, die beim Entpacken einer heruntergeladenen ZIP eine Download-Markierung erhalten.
- Die .NET-Ladekonfiguration liegt neben der EXE und gilt ausschliesslich für dieses Programm.
- Der Windows-Build prüft jetzt das tatsächliche Programmfenster samt gerenderter Toolbox, auch mit Download-markierten DLLs und nach Installation und Aktualisierung.
- Bei Fehlern des nativen Fensters wird ein verständlicher Hinweis mit Protokollpfad angezeigt.

## edeco Toolbox 0.2.0

- NOVA-Legenden und BIM2STEIGER bleiben nutzbar und sind als «Work in progress» markiert.
- Kommende Werkzeuge sind ausgegraut. In der normalen Fenstergrösse sind alle fünf Kacheln ohne Scrollen sichtbar.
- Neues edeco-Toolbox-Symbol für Programm, Taskleiste, Installer und Browser.
- Installerbilder und Abschlussseite verwenden das gemeinsame Toolbox-Branding.
- Neue Windows-Versionen erscheinen unter GitHub Releases als Setup und portable ZIP, jeweils mit SHA-256-Prüfsumme.
- Gemeinsame Updateprüfung mit bestätigtem, geprüftem Setup-Download im installierten Windows-Programm.
- Der Desktop verwendet ein dauerhaftes WebView-Profil ausserhalb der Installation und merkt sich den lokalen Port für Neustarts und Updates.

Das Repository ist privat. Die integrierte Prüfung verwendet vorhandene GitHub-CLI-/Git-Anmeldungen oder GH_TOKEN/GITHUB_TOKEN; Zugangsdaten werden nicht im Programm gespeichert. Ohne passende Anmeldung lassen sich Releases im angemeldeten Browser herunterladen.

Eine bisherige Version ohne Toolbox-Updater muss einmal mit dem neuen Setup aktualisiert werden. BIM-Arbeitslisten aus älteren Versionen zuvor als JSON sichern und bei Bedarf im neuen Profil laden.
