# Erfassung fortsetzen – ohne erneute Übernahme fertiger Artikel

<!-- CAPTURE_PROGRESS -->
**Aktueller Erfassungsstand, 23.10.2026, 20:58 Uhr (Zürich):** 16’699 von 16’699 Quellen (100 %), 11’648 Artikel mit Originalbild, 530 vollständige Katalogabschnitte. Noch offen: 0 Quellen. Die Erfassung des Katalogs 2026 ist abgeschlossen. Der Prüfstand steht in `data/portal_capture/resume_checkpoint.json`.
<!-- /CAPTURE_PROGRESS -->

Stand: 23.10.2026, 20:58 Uhr (Zürich) – 16’699 von 16’699 Quellen (100 %), 11’648 Artikel mit Originalbild, 530 vollständige Katalogabschnitte. Noch offen: 0 Quellen.

Die Erfassung des Katalogs 2026 ist abgeschlossen: 16’681 Artikeldialoge und 18 Textquellen. Der genaue Stand steht in `data/portal_capture/resume_checkpoint.json`: Anzahl, Artikel-/VA-Schlüssel, abgeschlossene Seiten und Prüfsummen. Die vollständigen Originalquellen liegen unter `data/portal_capture/details/`, die Originalbilder unter `web/images/`.

## Beim nächsten Auftrag

1. `CODEX_START.md` und diese Anleitung lesen. Nicht wieder mit einer vollständigen Portal-Erfassung beginnen.
2. Lokal `python tools/validate_portal_capture.py` ausführen. Der Validator prüft die vorhandenen Dateien ohne Portalzugriff. Die Liste fertiger Artikel ist zusätzlich im Checkpoint enthalten; entscheidend bleiben die gespeicherten Quelldateien.
3. Im CUA-Browser den tatsächlich angemeldeten Steiger-Tab mit sichtbarem Katalogjahr 2026 bestätigen. Nach einem Sitzungsablauf können andere Tabs weiterhin die Anmeldeseite zeigen. Keine Zugangsdaten oder privaten Portal-Endpunkte auslesen.
4. `resumeCapture(root, tabs, options)` aus `tools/resume_portal_capture.mjs` mit frischen dokumentierten CUA-Tab-Handles aufrufen. Die Funktion rekonstruiert alle fertigen Artikel-/VA-Schlüssel und Bildzuordnungen. Sie überspringt fertige Quellen automatisch, auch innerhalb eines noch nicht vollständigen Kapitels.
5. Begrenzte `batch(45)`- oder `batch(50)`-Aufrufe verwenden. Acht vorbereitete Tabs können Ladezeiten überlappen; höchstens zwei gleichzeitige Browseraktionen verwenden. Mehr gleichzeitige Aktionen führten zu Hängern. Optional einen erlaubten, beschreibbaren `stateFolder` ausserhalb von OneDrive angeben. Dieser Laufzeitordner ist zur Wiederaufnahme nicht erforderlich.
6. Jeder fertige Dialog wird sofort gespeichert. Nach einem Durchlauf wird das Bildinventar veröffentlicht. Für einen neuen Prüfstand `python tools/import_portal_details.py --publish-json`, den Quellenvalidator und die passenden vorhandenen Tests ausführen. `python tools/save_portal_checkpoint.py` schreibt den neuen geprüften Haltepunkt.

Die Originalnummern, VA mit führenden Nullen, negative Mengen sowie geprüfte Rezepte und BKP-/Raumregeln bleiben erhalten. Neue Rohkalkulationen dienen als Quellenarchiv und ersetzen geprüfte Rezepte nicht automatisch.

## GitHub und Testversion

Die Erfassungsdaten werden auf `main` gesichert. Der neuere Stand mit eigenem Programmfenster und erweiterten Importfunktionen liegt ausserdem in `cursor/bim2steiger-fenster-4944`. Bei Datenaktualisierungen dessen Programmdateien erhalten; keine ältere Oberfläche darüberkopieren. Vor dem Upload den aktuellen Remote-Stand prüfen. Der Windows-Build dieses Entwicklungszweigs erzeugt den Installer zum Testen.

Ein erneuter Start soll nur die noch fehlenden Quellen erfassen. Die schon vorhandenen Katalogseiten, Bilder und Detailansichten brauchen weder erneut gesucht noch erneut heruntergeladen zu werden.
