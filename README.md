# edeco Toolbox

Gemeinsame, erweiterbare Desktopanwendung für die Elektroplanung: edeco-Logo,
farbige Werkzeugkacheln, Suche, Kategorien und Hell-/Dunkelmodus.

## Werkzeuge

| Werkzeug | Stand | Kennfarbe |
| --- | --- | --- |
| NOVA-Legenden | Nutzbar, Work in progress | Petrol |
| BIM2STEIGER | Nutzbar, Work in progress; lokaler Katalog integriert | Blau |
| Berechnungstool | Geplant | Violett |
| Blitzschutz | Geplant | Orange |
| Dateien umbenennen | Geplant | Grün |

BIM2STEIGER verwendet seinen vorhandenen Katalog mit 11’777 Katalogartikeln,
Originalbildern, Favoriten, Modellimport und Ausschreibungen. Es läuft unter
`/tools/bim2steiger/` im selben lokalen Server und Desktopfenster wie Nova.
Die weiteren Fachwerkzeuge sind noch nicht implementiert.

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
prüft den Start der EXE und beide Module und stellt zwei GitHub-Actions-Artefakte
bereit:

- **edeco-Toolbox-Setup-Build-…**: Setup-EXE mit SHA-256-Prüfsumme.
- **edeco-Toolbox-portabel-Build-…**: Vollständiger Programmordner. ZIP komplett
  entpacken und `edeco-Toolbox.exe` starten; die Unterordner müssen dabei bleiben.

Download: Auf GitHub **Actions → Toolbox: Windows-Setup bauen → erfolgreicher
Lauf → Artifacts** öffnen. Der Workflow veröffentlicht kein Release.
Die Windows-EXE und das Setup werden erst in diesem Windows-Workflow erzeugt;
sie sind kein Bestandteil des Quellcode-Imports.
