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
