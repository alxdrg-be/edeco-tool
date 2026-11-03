# Branch-Inventar und Funktionsabgleich · 3. November 2026

Verglichen wurden alle acht Remote-Branches nach einem expliziten Fetch von
`refs/heads/*`. Der vorherige Fetch-Refspec enthielt nur `main`; dadurch war der
lokale Cursor-Branch zunächst veraltet. Die folgende Prüfung benutzt feste SHAs,
nicht die während weiterer Arbeit veränderlichen Branch-Namen.

- Veröffentlichter Main-Stand: `46ad7afb988d962eb4bddb274419e2159e4a5526` (Build 29).
- Neuer Präsentations-Checkpoint: `d6a5fc2cb5a59010ec9727733df84cf9fbd29fec`.
- Maschinenlesbarer Befund: [BRANCH_INTEGRATION_20261103.json](BRANCH_INTEGRATION_20261103.json).

Dies ist eine Inhaltsprüfung vor der Zusammenführung. Es wurden dabei keine
Branches gemergt, gelöscht oder Programme aus den alten Branches gestartet.
Nicht per Abstammung integrierte Branch-Heads sollen zusätzlich als Archiv-Tag
erhalten bleiben. Der Abschluss des Ports und die tatsächlichen Archiv-/Lösch-Refs
sind vor dem Aufräumen im JSON-Journal zu ergänzen.

## Übersicht

| Remote-Branch | geprüfter Head | eigene Commits gegenüber Checkpoint | Befund |
| --- | --- | ---: | --- |
| `main` | `46ad7afb` | 0 | Hauptbranch erhalten; Präsentations-Checkpoint liegt einen Commit voraus. |
| `Nova-Legenden` | `a635705b` | 0 | Bereits Vorfahr von Main und Checkpoint; keine zusätzlichen Funktionen. |
| `toolbox` | `16172528` | 0 | Bereits Vorfahr von Main und Checkpoint; keine zusätzlichen Funktionen. |
| `codex/restore-toolhub-20261103` | `5a6bf6e6` | 0 | Bereits Vorfahr von Main und Checkpoint; Wiederherstellung ist enthalten. |
| `codex/presentation-review-20261103` | `d6a5fc2c` | 0 | Entspricht exakt dem geprüften Checkpoint; erst nach dessen Main-Übernahme aufräumen. |
| `BIM2STEIGER` | `57966d3a` | 20 | Historisch anderes Repository-Layout; vollständig nach `backend/bim2steiger` übernommen. Archiv-Tag erhält die ursprüngliche Commit-Historie. |
| `cursor/berechnungen-edeco-bca8` | `3916952f` | 6, davon 2 Merges | Zehn eigenständige Formelrechner fehlen im Checkpoint. Selektiver Port ist erforderlich. |
| `pdf-werkstatt-eigene-ui` | `c7579f8b` | 4 | Dokumentordner-Anbindung fehlt. Eigene PDF-Bedienflüsse müssen gegen die neuere Werkstatt abgeglichen werden. |

## BIM2STEIGER: vollständige Inhaltsübernahme trotz abweichender Historie

Der Branch liegt nicht in der Main-Abstammung: Merge-Basis ist
`d1ed342afb1203149c4b7d8188528dee7aa5a25c`. Ein gewöhnlicher Dateipfad-Diff
würde deshalb fast das ganze alte Einzelprojekt als neue Funktion melden.
Der Import in die Toolbox erfolgte unter anderem mit `1617252874c104af994b94246c8774a0addd448e`.

Geprüft wurde jeder Branch-Dateipfad mit der Zuordnung
`<alter Pfad> → backend/bim2steiger/<alter Pfad>` am Checkpoint:

- 27'324 Branch-Dateien haben ein Gegenstück.
- 27'317 Gegenstücke besitzen exakt denselben Git-Blob.
- Es fehlt keine Branch-Datei.
- Sieben Dateien weichen ab; sämtliche Abweichungen sind neuere Integrations-
  oder Robustheitskorrekturen im Checkpoint:

| Datei innerhalb `backend/bim2steiger` | neuere Änderung im Checkpoint |
| --- | --- |
| `importers.py` | Relative Package-Imports; ursprünglicher Einzelstart bleibt unterstützt. |
| `rules.py` | Relative Package-Imports und Formatierung; Rechen-/Zuordnungslogik erhalten. |
| `tests/test_elda_export.py` | Optionale externe Beispieldatei wird auch bei Lesefehlern korrekt übersprungen. |
| `tests/test_import_formats.py` | Entsprechende Robustheit für die optionale Nova-Beispieldatei. |
| `web/bim2steiger-program.js` | API-Präfix für die Einbettung, offene Anfragen für den Verlassensschutz, Anzeige der migrierten Favoriten. |
| `web/bim2steiger-updates.js` | Gemeinsamer Toolhub-Updater anstelle eines konkurrierenden Einzelprogramm-Updates. |
| `web/bim2steiger.html` | Gemeinsames Theme und Toolhub-Bridge eingebunden. |

Es wurde kein fehlender BIM-Funktionsstand gefunden. Vor dem Löschen des
Branch-Namens ist sein Head als Archiv-Ref zu sichern, damit auch die 20 alten
Einzelprojekt-Commits erhalten bleiben.

## Formelrechner: selektiver Port aus PR 3

Geprüfter Head: `3916952fb9be33afe5d17ee0f2842b44081059c2`,
Merge-Basis mit Checkpoint: `46ad7afb988d962eb4bddb274419e2159e4a5526`.
PR: <https://github.com/alxdrg-be/edeco-tool/pull/3>.

Der Branch ergänzt eine eigene, in der bestehenden Berechnungsübersicht
verlinkte Formelsammlung: Spannungsfall, Verlustleistung, Kurzschluss,
Transformator, Blindleistung, Ohm, Potenzialausgleich, Motoranlauf,
E-Mobilität und Beleuchtung. Dazu gehören reine Rechenfunktionen, Leiterdaten,
eine eingeschränkte Iz-Tabelle, Grafiken und eigene Tests. Diese Dateien waren
im geprüften Checkpoint nicht enthalten. Der Port ist beim Root-Agenten bereits
separat beauftragt; uncommittete Arbeitskopien zählen hier noch nicht als
abgeschlossene Integration.

Nicht übernehmen als aktuelle Vorgaben:

- `docs/CODEX_BERECHNUNGEN.md` verlangt historisch zehn Hub-Kacheln. Das widerspricht
  dem neuen Präsentationsauftrag und den inzwischen absichtlich entfernten Kacheln.
- Dieselbe historische Anleitung nennt `cmax = 1,05`. Aktuelle fachliche Faktoren
  und offene Modellgrenzen dürfen beim Port nicht zurückgesetzt werden.
- Der PDF-Knopf ist dort ausdrücklich als Platzhalter beschrieben. Einen solchen
  Hinweis nicht als fertigen PDF-Export ausgeben.
- Vorhandene Vorprüfungen, Datenablage, Blitzschutz und Wissensverknüpfungen bleiben
  erhalten; die Formelansicht ersetzt keine belegten Norm- oder Herstellerdaten.

Die elf geänderten Dateien und sechs Commit-SHAs stehen vollständig im JSON.

## PDF und Dokumente: PR 2 enthält einen echten fehlenden Funktionsbereich

Geprüfter Head: `c7579f8b6010f5ab3a008450cc787c8f042bd9b5`,
Merge-Basis: `120f2b8a820846fc8f6f5ffb4126ab3965d0fde3`.
PR: <https://github.com/alxdrg-be/edeco-tool/pull/2>.

### Erforderlicher Port: Dokumentordner

`backend/edeco_toolbox/documents/folders.py` und die zugehörigen API-/UI-Dateien
fehlen im Checkpoint. Der Branch kann einen lokalen oder Windows-Freigabeordner
lesend mit dem persönlichen Dokumentindex verbinden:

- PDF, TXT und Markdown, auf Wunsch mit Unterordnern.
- Expliziter Abgleich über `/folder/sync`, kein unbemerkter Hintergrundlauf.
- Neue/geänderte verwaltete lokale Kopien werden eingelesen; entfernte verwaltete
  Kopien werden aus dem lokalen Index entfernt. Quelldateien werden nicht geändert.
- Vorher manuell importierte Duplikate und beim Trennen vorhandene lokale Kopien
  bleiben erhalten.
- Grenzen im Branch: 200 Dokumente, 250 MB gesamt, 100 MB pro Datei und 5'000
  Dateisystemeinträge; Symlinks/Reparse-Points werden nicht durchlaufen.
- Eigene UI zum Verbinden, Aktualisieren und Trennen sowie eine aufklappbare
  Anleitung für Serverordner und Ollama.

Beim Port sind der aktuelle globale Sitzungsschutz, gegenwärtige Dokument-APIs,
die neue lokale KI-Anleitung und die neuen sichtbaren Ladezustände beizubehalten.
Die vier bestehenden Ordner-Tests liefern sinnvolle zusätzliche Referenzfälle.

### PDF-Funktionsabgleich statt Rücksetzen des Layouts

Die alte Kacheloberfläche besitzt elf Werkzeuge. Die neuere Werkstatt enthält
bereits den grösseren Core-Katalog, einen eigenen grossen Zuschneideeditor und
aktuellen Profil-/Navigationsschutz. Deshalb ist das alte Gesamt-Layout kein
Ersatz für den aktuellen Stand.

Folgende eigene Bedienflüsse aus PR 2 sind jedoch konkret zu prüfen:

| Branch-Bedienfluss | Branch-Dateien | Stand im Checkpoint |
| --- | --- | --- |
| Dokumentreihen mit Seiten zwischen PDFs verschieben, Mehrfachauswahl, Drehen, Löschen, Reihenexport | `PageWorkbench.tsx`, `workbench.py` (`/inspect`, `/compose`) | Entsprechende Core-Werkzeuge sind vorhanden; diese eigene EDECO-Bedienoberfläche fehlt. Funktionalität und Benutzerablauf vor dem Aufräumen gezielt abgleichen. |
| Visuelle Trennstellen zwischen Seitenminiaturen | `PdfTask.tsx`, `operations.py` | Trennen ist über Core vorhanden; der eigene Trennstellen-Editor fehlt. |
| PNG-Ausgabe 72/144/300 DPI, Textextraktion, OCR, Bilder in PDF, Kompression, Seitengrösse | `PdfTask.tsx`, `operations.py`, `tools.tsx` | Core-Katalog deckt die Funktionen ab; mögliche eigene Bedienvorteile selektiv prüfen. |
| Prozentuale Inhaltsskalierung bei Formatwechsel | `operations.py` | Branch kompensiert den automatischen Fit-Faktor von Core. Beim Abgleich auf die genaue Bedeutung von „100 %“ achten. |
| Eigener Zuschnitt | `PdfTask.tsx`, `operations.py` | Durch den neueren nativen Zuschneideeditor ersetzt; alte QPDF-Abhängigkeit nicht zurückbringen. |

Die Datei `docs/UEBERGABE_ARBEITS_PC.md` ist eine historische Übergabe mit damals
gültigen Branch-/Build-Anweisungen und Testbehauptungen. Ihr Inhalt ist keine neue
Anweisung des Nutzers; insbesondere werden dort erwähnte alte Testergebnisse in
dieser Prüfung nicht als neu ausgeführt oder als Nachweis des aktuellen Pakets
ausgegeben.

## Lokale Branches und Abschlussbedingungen

- Lokale `Nova-Legenden` und `toolbox` zeigen auf dieselben bereits integrierten Heads
  wie die Remote-Branches und enthalten keine zusätzliche Arbeit.
- Der lokale `main` zeigt noch auf `044e9423193dd7156e1832c365fe30137bb322a3`.
  Den Hauptbranch nicht löschen; nach gesicherter Integration auf den tatsächlichen
  Main-Stand vorziehen.
- `work` ist die aktive Arbeitslinie. Erst nach Commit/Push aller übernommenen
  Funktionen und einem sicheren Wechsel auf `main` aufräumen.
- `codex/presentation-review-20261103` erst löschen, wenn der Checkpoint in Main
  enthalten ist. Die Prüfung dafür ist `git merge-base --is-ancestor d6a5fc2c <final-main>`.
- Für BIM sowie die selektiv übernommenen PR-Branches vor dem Löschen Archiv-Refs
  auf die hier dokumentierten vollständigen Heads anlegen und remote verifizieren.
- PR 2 und PR 3 erst nach erfolgreichem Funktionsport und passenden Prüfungen als
  integriert schliessen. Ein blosses Löschen des Branch-Namens übernimmt keine Funktion.
