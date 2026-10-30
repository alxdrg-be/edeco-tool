# Ein weiteres Werkzeug integrieren

Die Toolbox ist eine gemeinsame Anwendung aus einem React-Frontend, einem lokalen
FastAPI-Server und einem Desktopfenster. Git-Branches dienen der Entwicklung;
sie werden zur Laufzeit weder gewechselt noch heruntergeladen.

## Aktueller Stand

- NOVA-Legenden ist integriert. Seine vorhandenen Einstellungen, Firmenordner und
  Projektdateien bleiben unter den bisherigen Pfaden verwendbar.
- BIM2STEIGER ist unter `backend/bim2steiger/` inklusive Originalkatalog integriert.
  Der Adapter `backend/edeco_toolbox/bim.py` stellt seine vorhandene Fachlogik
  als ASGI-Unteranwendung bereit. Die Oberfläche wird unter
  `/tools/bim2steiger/` im gemeinsamen Fenster eingebettet; ein zweiter Prozess
  oder Server ist nicht erforderlich.
- Berechnungen, Blitzschutz und Dateien umbenennen sind geplante Werkzeuge;
  die Kacheln sind deaktiviert und enthalten noch keine Fachfunktionen.

## Frontend

1. Das Werkzeug als eigenen Ordner unter `ui/src/tools/<tool-id>/` hinzufügen.
2. Eine React-Komponente mit `ToolProps` aus `ui/src/toolbox/modules.ts` exportieren.
   `onHome` führt zurück zur Toolbox. Vorher ausstehende Änderungen speichern
   oder nachfragen; ein fehlgeschlagener Speicherversuch muss im Werkzeug bleiben.
   NOVA-Legenden verwendet dafür seinen bestehenden `NavigationProvider`.
3. Einen Lazy-Loader in `modules.ts` registrieren. Name, Beschreibung, Kategorie
   und Kennfarbe in `catalog.ts` eintragen, erst nach erfolgreichem Test auf
   `available` setzen. Ein SVG-Symbol in `ToolIcon.tsx` ergänzen.
4. Die gemeinsamen Variablen aus `ui/src/theme.css` und die bestehenden
   Schaltflächen-, Formular- und Dialogstile verwenden. Kennfarben ändern nur die
   Oberfläche, niemals CAD-Symbolfarben oder Exportdaten.

Petrol steht für Nova, Blau für BIM, Violett für Berechnungen, Orange für
Blitzschutz und Grün für Dateien. Die Startseite setzt `data-tool-color` am
Dokument für das aktive Werkzeug; weitere Module können darüber ihre Akzente
mit denselben gemeinsamen Designvariablen festlegen.

## Backend

Neue Fachlogik unter `backend/edeco_toolbox/tools/<tool_id>/` ablegen. Einen
FastAPI-`APIRouter` in `backend/edeco_toolbox/app.py` unter
`/api/tools/<tool-id>` einbinden, **vor** dem statischen UI-Mount. Der
NOVA-Legenden-Adapter behält seine vorhandenen `/api`-Pfade bei. BIM kapselt seine
Pfade vollständig unter `/tools/bim2steiger/api/`. Sein kleines `localUrl`-Hilfsmittel
übersetzt lokale URLs für diesen Mount; Bilder und Skripte bleiben relativ.

Werkzeuge mit anderem Technologieaufbau benötigen einen passenden Adapter;
Quellcode aus fremden Branches nicht blind über die gemeinsamen Dateien kopieren.
Zusätzliche Python-Pakete auch in den Requirements und Windows-Build aufnehmen.
Für neue Daten eigene Unterordner verwenden, damit sich Module nicht überschreiben.

## Tests und Windows-Paket

`npm test` und `npm run build` im Ordner `ui` ausführen. Backendtests laufen mit
`.venv/bin/python -m pytest backend/tests -q`. Für Browser-Tests zusätzlich
`backend/requirements-browser-tests.txt` installieren und Chromium bereitstellen.
Die Browser-Tests decken auch den Wechsel zur Toolbox und Speicherfehler ab.

Der gemeinsame Windows-Build verwendet `packaging/edeco_toolbox.spec` und
`packaging/toolbox-setup.iss`. Er besitzt eine eigene Installer-ID und ersetzt
keine bestehende Einzelinstallation. Die beiden Einzelprogramm-Updater sind in der Toolbox deaktiviert.
Beim Verlassen von BIM prüft `toolbox-bridge.js`, dass kein Vorgang und kein
Dialog mehr offen ist, und speichert Favoriten, Modellimport und Ausschreibung.
Fehler beim Schreiben des lokalen Speichers verhindern den Wechsel. Der gemeinsame Updater liegt in
`backend/edeco_toolbox/updater.py`, seine lokalen, durch Sitzungsschlüssel
abgesicherten Aktionen unter `/api/toolbox/updates`. Neue Module brauchen keinen
eigenen Updater. Das Desktopprofil und der zuletzt genutzte Port bleiben bei
Updates ausserhalb des Installationsordners erhalten. `main` veröffentlicht
erfolgreiche Builds automatisch als GitHub Release.
