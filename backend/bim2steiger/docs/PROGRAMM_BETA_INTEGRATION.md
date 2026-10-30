# BIM2STEIGER – Beta als vollständige Anwendung

<!-- CAPTURE_PROGRESS -->
**Aktueller Erfassungsstand, 23.10.2026, 20:58 Uhr (Zürich):** 16’699 von 16’699 Quellen (100 %), 11’648 Artikel mit Originalbild, 530 vollständige Katalogabschnitte. Noch offen: 0 Quellen. Die Erfassung des Katalogs 2026 ist abgeschlossen. Der Prüfstand steht in `data/portal_capture/resume_checkpoint.json`.
<!-- /CAPTURE_PROGRESS -->

Stand: 22.10.2026. Benutzerauftrag: das Programm nach der überarbeiteten Beta aufbauen und die Originalbilder sowie weitere Steiger-Daten übernehmen.

## Anwendung und Start

`Start_BIM2STEIGER.cmd` startet die lokale Anwendung. `launch.py` erkennt einen Server desselben Projektordners über `/api/app` und verwendet sonst einen freien Port zwischen 8765 und 8780. Der alte Starter bleibt ein Alias. Favoriten und Ausschreibung sind je Browser, Host und Port gespeichert; JSON-Sicherungen für einen Umzug verwenden.

Die Hauptansicht `web/bim2steiger.html` verwendet die Gestaltung der lokalen Beta 0.3 und den neuen Adapter `web/bim2steiger-program.js`. Die kompakte Bilddarstellung aus dem neueren GitHub-Stand ist übernommen: kleine Originalvorschau, weitere Bilder auf Wunsch, Herkunft im Dialog. Keine CDN-Abhängigkeit. `web/bim2steiger-beta.html` bleibt als eigenständige Beispielansicht erhalten; ihre bisherigen UI-Änderungen werden nicht verworfen.

Die bisherigen Funktionen unter `/` bleiben verfügbar. Der vorhandene Windows-Build aus GitHub (`packaging/`, `.github/workflows/build-windows.yml`) bleibt erhalten. `server.main()` und die Ressourcenpfade für die installierte Anwendung sind beim Zusammenführen berücksichtigt.

## Funktionsumfang

- Vollständiger Kapitelbaum: 11’777 Katalogartikel und 853 gesonderte Kalkulationskomponenten. Artikel werden kapitelweise nachgeladen; Kapitel- und Artikelbilder bleiben getrennt zugeordnet.
- Suche nach Text, Artikel/VA, E-Nr. und B-Nr.; Schreibweisen mit Leerzeichen, Punkten oder Bindestrichen werden für die Suche normalisiert. Gespeicherte Originalnummern bleiben unverändert. Eigene Kennungstreffer stehen vor Positionen, die das Produkt lediglich enthalten.
- Exakte VA- und Rezeptauswahl. Mehrere eigene/gleichartige Quellkennungen bleiben mit Kontext wählbar; keine Übertragung von Kindkennungen auf die Komplettposition.
- Zusammensetzung mit aufklappbaren Unterbaugruppen sowie getrennte Endbestandteile über `/api/expand`. Direkte Mengen gelten je Elternteil, Endmengen je Stammposition. Negative Abzüge, fehlende Einheiten und die Materialregeln bleiben erhalten.
- Favoriten als eigene Ansicht mit Originalsymbolen und Katalogkategorien, JSON-Sicherung/-Import. Der historische Schlüssel `bim2steiger:merkliste:v1` bleibt erhalten. Favoriten der Beta werden am selben Host/Port einmalig übernommen.
- Tag-/Nachtmodus; Wissen auf Klick mit Pin; Tastatursteuerung der Suche und Tabs.
- Manuelle Übernahme in die Ausschreibung mit expliziter Menge, Einheit und BKP sowie Geschoss, Raum, Anlage und Verlegung. Vorhandene sichere Verdichtung und JSON-Ausgabe bleiben erhalten.
- Eigene Import- und Exportansichten. CSV, JSON, IFC und Nova N4D/N4M nutzen die vorhandene API und zeigen ungeprüfte Objekte. IFC übernimmt Raumnummer und Raumname nur aus einem eindeutigen IfcSpace. N4D/N4M übernimmt die Apparate ohne Raum. Automatische Artikelzuordnung und das echte Messerli-Austauschformat sind noch offen. Eine Import-JSON-Sicherung ist keine Messerli-Datei.

## Originaldaten: abgeschlossener Teil und offene Erfassung

Geprüfter Abschluss vom 23.10.2026, 20:58 Uhr (Zürich):

- Alle 532 geplanten Katalogseiten für die Artikelvorschauen gelesen.
- 11’648 Artikelnummern mit mindestens einer Originalabbildung; 32’434 artikel-/VA-bezogene Bildzuordnungen.
- 500 originale Kapitelillustrationen. Kapitelbilder werden nicht als Bilder eines beliebigen Artikels ausgegeben.
- Insgesamt 9’969 unterschiedliche lokale Originaldateien einschliesslich Kapitelbilder und der bisherigen vier Einzeldateien; identische Bilddaten werden über SHA-256 erkannt.
- 16’699 von 16’699 geplanten Artikel-/VA-Quellen (100 %): 16’681 geprüfte Artikeldialoge mit Grunddaten sowie 18 Textquellen ohne zugänglichen Kalkulationsdialog.

**Alle geplanten Grunddatenquellen sind erfasst.** Artikel ohne Bild in der Quelle bleiben ohne Bild. Die ursprünglichen 2’772 geprüften VA-00-Kalkulationen und zehn Textpositionen bleiben erhalten. Neue Rohkalkulationen werden als Quelle angezeigt, ersetzen diese geprüften Rezepte aber nicht automatisch.

Artikelbilder stehen in `web/images/inventory.json`, Kapitelbilder in `web/images/chapters.json`. Die unveränderten Originalbytes liegen in `web/images/portal-2026/`. Die Quelle, der Artikel, die exakte VA bzw. VA-Liste, Rolle, Zeitpunkt, Originalauflösung und SHA-256 sind dokumentiert. Ein unbekanntes Grunddatenbild wird nicht ohne Nachweis als Produktfoto klassifiziert. Kleine Rasterbilder werden nicht künstlich hochskaliert.

`data/portal_capture/pages/` enthält die Katalogseiten, `details/` die zusätzlichen Artikeldialoge. Die Pläne stehen in `plan.json` und `details-plan.json`. `/api/source-status` zeigt den tatsächlichen Umfang unabhängig vom Dokumentationsstand.

Alle 530 Katalogabschnitte des Detailplans sind vollständig. Offen ist keine Quelle. Der Prüfstand steht in `docs/ERFASSUNG_FORTSETZEN.md` und `data/portal_capture/resume_checkpoint.json`.

## Fortsetzung der Erfassung

`tools/portal_capture.mjs` und `tools/portal_details_capture.mjs` werden aus der dokumentierten CUA-Browsersitzung mit dem angemeldeten Steiger-Tab verwendet. Sie lesen die sichtbare Portaloberfläche und originale Bilddaten aus deren DOM; keine Zugangsdaten, privaten Portal-APIs oder versteckten Anwendungszustände. Vor dem Speichern werden Katalogjahr, Artikelnummer, VA und Quellseite überprüft. Bereits gespeicherte Artikel-/VA-Dateien werden bei einer Fortsetzung übersprungen.

Die Detailerfassung nutzt `createDetailsCapture(root, plan, mediaCapture, stateFolder)` und begrenzte `batch([{tab, assigned: plan}], seconds)`-Aufrufe. `tools/resume_portal_capture.mjs` rekonstruiert den Stand aus gespeicherten Quellen. Acht vorbereitete Tabs können Ladezeiten überlappen; höchstens zwei gleichzeitige Browseraktionen verwenden. Während einer mobilen Viewport-Prüfung nicht erfassen. Für häufig aktualisierte Zwischenstände einen beschreibbaren Ordner ausserhalb des synchronisierten OneDrive-Projekts verwenden; anschliessend `mediaCapture.publish()` aufrufen. Bilddateien und abgeschlossene Quellen liegen schon vorher im Projekt.

Anschliessend:

```console
python tools/import_portal_details.py --publish-json
python tools/validate_portal_capture.py
python -m unittest discover -s tests
```

Der Import ergänzt ausschliesslich die eigenen Grunddaten in den vorhandenen Varianten der bestehenden Datenbank und in `assemblies.json`. Quellen- und Fachprüfung der neuen Rezeptgraphen sind ein eigener nächster Schritt. Keine zweite Datenbank beginnen.

## Prüfung am 22.10.2026

30 Python-Tests bestanden. JS-Syntaxprüfung für Adapter, Ausschreibung und Erfassung bestanden. Der Quellenvalidator prüft SHA-256 und echte Bildabmessungen aller Originaldateien, vollständige Seitennummern sowie Artikel-/VA-Zuordnung der erfassten Dialoge.

Im Browser geprüft: E-/B-Nummernsuche, Tastaturauswahl und Escape, exakte VA, 83 × 150 px ohne Hochskalierung bei 2730, 112001/00, Abzug −1 bei 112002/00, verschachtelte Zusammensetzung und Endmengen bei 122104/00, kategorisierte Favoriten einschliesslich Persistenz, Wissen/Pin und Nachtmodus. Vier Ansichten bei 320, 390, 768, 1024 und 1440 Pixeln ohne seitlichen Seitenüberlauf. Der Katalogbaum hat auch intern keinen seitlichen Überlauf.

CSV-Prüfdatei: drei Objekte einschliesslich Menge 0, fehlender Einheit und VA 030/30 korrekt übernommen. BKP-/Raum-Test: zwei gleiche Positionen mit Mengen 2 und 3 zu 5 verdichtet, JSON-Sicherung und Artikelrückverweis geprüft. Eigene Testdaten anschliessend entfernt. Keine bestehenden Benutzerlisten gelöscht.

Referenzbilder: `Programm_Beta_Integration_Desktop.png`, `Programm_Beta_Integration_Mobil.png` und `Programm_BKP_Pruefung_2026-10-22.png`.

## Teststand vom 23.10.2026

52 Python-Tests bestanden. Am 23.10.2026, 20:58 Uhr (Zürich), bestätigte der Quellenvalidator alle 16’699 Quellen, einschliesslich SHA-256, Originalauflösung und Artikel-/VA-Zuordnung. Eine WebP-Datei, die das Portal als JPEG ausgeliefert hatte, wird mit der richtigen Endung geführt. Die neueren Programmfenster- und Importfunktionen aus dem Entwicklungszweig bleiben erhalten.
