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
Lauf → Artifacts** öffnen. Nach allen erfolgreichen Prüfungen veröffentlicht
`main` außerdem automatisch ein Release `v<Version>-build.<Nummer>` unter
[Releases](https://github.com/alxdrg-be/edeco-tool/releases). Dort liegen Setup,
portable ZIP und beide SHA-256-Dateien dauerhaft.
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
