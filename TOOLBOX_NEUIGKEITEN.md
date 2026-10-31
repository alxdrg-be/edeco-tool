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
