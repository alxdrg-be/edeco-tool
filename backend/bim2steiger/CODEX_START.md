# BIM2STEIGER – hier mit Codex oder Claude Code beginnen

<!-- CAPTURE_PROGRESS -->
**Aktueller Erfassungsstand, 23.10.2026, 20:58 Uhr (Zürich):** 16’699 von 16’699 Quellen (100 %), 11’648 Artikel mit Originalbild, 530 vollständige Katalogabschnitte. Noch offen: 0 Quellen. Die Erfassung des Katalogs 2026 ist abgeschlossen. Der Prüfstand steht in `data/portal_capture/resume_checkpoint.json`.
<!-- /CAPTURE_PROGRESS -->

Stand: 22.10.2026. Dieses Dokument enthält die freigegebene Gestaltungsrichtung, den vorhandenen Programmstand und die nächsten Schritte. Der gesamte Ordner `Steiger2Bim` ist das Projekt; der Produktname ist **BIM2STEIGER**.

**Version 0.3.1:** Einstellungen mit Version/Build, Updateprüfung beim Start, Updatehinweis und geprüftem Setup-Start in der installierten Windows-Version. Beim privaten Repository die bestehende lokale GitHub-Anmeldung verwenden oder die Release-Seite im Browser öffnen; keine Browser-Zugangsdaten auslesen. Direkte HTML-Dateiaufrufe zeigen eine Startanleitung. Umsetzung und Prüfgrenzen: `docs/UPDATES.md`. `version.json` wird beim Windows-Build um Buildnummer, Commit und Zeitpunkt ergänzt.

**Gesicherter Stand vom 23.10.2026, 20:58 Uhr (Zürich):** Die Erfassung des Katalogs 2026 ist abgeschlossen: 16’699 von 16’699 Quellen (100 %), 11’648 Artikel mit Originalbild, 530 vollständige Katalogabschnitte. Der Prüfstand steht in `data/portal_capture/resume_checkpoint.json`. Die neueren Programmfenster-, Import- und UI-Änderungen bleiben Teil dieser Version.

**Bedienung und Funktionen, 23.10.2026:** Ohne Adresse öffnet `#start` mit Suche, Kacheln, «Zuletzt angesehen» und Hauptkapiteln. Die Seitenleiste ordnet Start, Katalog, Favoriten, Ausschreibung und Einstellungen fest an; nur der Katalogbaum scrollt, das Katalogjahr steht in seinem Kopf. Der Baum lässt sich mit Pfeiltasten bedienen. Brotkrümel der Position folgen dem Original-Katalogpfad. Leere E-/B-Nummern blenden den Block aus. Neu: VA-Vergleich im Positionskopf, Suchfilter nach VA (serverseitig, `va` in `/api/search`) und «Nur mit Bild», Favoritennotizen und eigene Listen (`bim2steiger:favoriten-extra:v1`, Export Version 2), mehrere Projekte (`bim2steiger:projekte:v1`; die aktive Ausschreibung bleibt unter `steiger2bim.tender.v1`), CSV- und Excel-Export der Ausschreibung, Zuordnung importierter Objekte nach Bezeichnung mit Vorschlägen aus der Katalogsuche und Übernahme in die Ausschreibung. Jede Zuordnung wählt die Nutzerin oder der Nutzer selbst.

## Freigegebene Oberfläche

**Aktueller Auftrag: das vollständige Programm nach der Beta aufbauen.** `web/bim2steiger.html` übernimmt jetzt die überarbeitete Gestaltung aus `web/bim2steiger-beta.html` und verwendet den vollständigen lokalen Katalog über `web/bim2steiger-program.js`. Die Beta-Datei bleibt als eigenständige Gestaltungsreferenz erhalten. Die neueren Entscheidungen in `docs/UI_Vorschlag_Beta_0.3.md` haben Vorrang vor der älteren `docs/Designreferenz_2026-10-20.png`.

Die alternative Drei-Spalten-Ideenskizze `web/bim2steiger-mockup.html` ist keine Vorgabe für die weitere Hauptansicht. Insbesondere gehört die Hilfe nicht dauerhaft in eine rechte Spalte.

**Beta als Programmgrundlage, 22.10.2026:** Katalog, Favoriten, Import und Exportvorbereitung sind eigene Ansichten. Wissen öffnet auf Klick und lässt sich anpinnen; es steht standardmässig nicht rechts. Tag-/Nachtmodus, kleine Originalbilder und die getrennten Spalten für Artikel-, E-/B-Nummern, VA und Menge bleiben erhalten. Die vorhandene Mengen- und BKP-Logik wird weiterverwendet. Einzelheiten: `docs/PROGRAMM_BETA_INTEGRATION.md`.

**Aktuelle Präzisierung für Beta 0.2:** Wissen ist standardmässig geschlossen und öffnet über «Wissen griffbereit» im Header. Der Pin hält es sichtbar; erst dann erscheint am Desktop die dritte Spalte. Nachtmodus und Pin werden lokal gespeichert. Favoriten haben eine eigene Ansicht unter `#favoriten`, mit passenden Symbolen und Kategorien aus den Original-Katalogpfaden. Reine Kalkulationsbestandteile ohne Katalogpfad bleiben gesondert gekennzeichnet. Die kompakten Tabellen und vollständig in ihre Rahmen passenden Originalsymbole erhalten.

Die bestätigten Wünsche:

- Branding **BIM2STEIGER**.
- Header: globale Suche, dann **Wissen griffbereit unmittelbar links neben Favoriten**. Auf kleinen Bildschirmen darf das Wissenssymbol den Text ersetzen.
- **Favoriten** als Bezeichnung in der gesamten Oberfläche. Der historische Browserspeicherschlüssel mit `merkliste` bleibt für die Kompatibilität der vorhandenen Ansicht erhalten.
- PNG-/Produktbilder aus den jeweiligen Steiger-Grunddaten direkt an der Stelle des großen Produktbilds anzeigen. Die Lupe öffnet eine größere Ansicht. Das Bild muss zur Position gehören. Wird ersatzweise ein enthaltenes Produkt gezeigt, muss die Herkunft sichtbar sein.
- E-Nr. und B-Nr./Bestellnummer der jeweiligen Position sowie der enthaltenen Bestandteile sichtbar machen. Die Originalnummern als Zeichenketten erhalten.
- Artikelnummer, VA und E-/B-Nummern sind verschiedene Identitäten. Eine Komplettposition hat nicht automatisch die E-/B-Nummer eines enthaltenen Schalters.
- Die kompakte Zusammensetzungstabelle der aktuellen Beta bleibt erhalten. Name, Artikelnummer, E-/B-Nummern, VA und Menge haben eigene Spalten; auf schmalen Bildschirmen scrollt nur die Tabelle horizontal.
- Such-Overlay, Favoriten, VA-Auswahl, Artikeltext und nachvollziehbare Zusammensetzung beibehalten.

**Beta 0.3:** Die Sidebar öffnet über **Ausschreibung** das Hauptfenster. Dateiimport und Export stehen dort gemeinsam, ohne eigenes Popup und ohne eigene Sidebar-Einträge. `#ausschreibung`, `#import` und `#export` zeigen dieselbe Ansicht. CSV, JSON, IFC und Nova N4D/N4M nutzen die lokale API. IFC liest elektrische Bauteile mit Raumnummer (`IfcSpace.Name`) und Raumname (`IfcSpace.LongName`), wenn genau ein Raum zugeordnet ist. N4D/N4M liest Apparate wie NOVA-Legenden; eine Raumzuordnung steht in diesen Objekten nicht. Automatische Artikelzuordnung und das Messerli-Austauschformat bleiben offen. Die JSON-Ausgabe ist eine Sicherung ungeprüfter Importobjekte. Rasterbilder im Dialog nicht über die Originalauflösung hinaus vergrössern.

**Aktuelle UI-Überarbeitung der Beta:** Die Downloadskizze dient als Gestaltungsreferenz. Im Positionskopf steht nur die Nummer mit Kopierknopf; «ARTIKEL» entfällt. Originalzeichnungen erscheinen auf feinem Punktraster mit maximal 110 Pixel Vorschauhöhe und dem Hinweis «Originalzeichnung». Produktfotos öffnen nur auf Wunsch; Quellen stehen im Dialog. Die Zusammensetzung zeigt Name, Artikelnummer, E-Nr., B-Nr., VA und Menge in separaten Spalten. Keine Mengenrundung in der Anzeige. Stil und Bilder sind vollständig eingebettet; keine CDN-Abhängigkeit. `Start_BIM2STEIGER_Beta.cmd` öffnet die Vorschau ohne Server. Für tatsächliche Importe ist weiterhin die lokale API nötig. Gestaltungsentscheidungen: `docs/UI_Vorschlag_Beta_0.3.md`.

## Was vorhanden ist

**Beta-Websuche und Browserprüfung (21.10.2026):** Dezente Globus-Aktionen neben vorhandenen E-/B-Nummern öffnen die externe Suche im neuen Tab; B-Nummern verwenden zusätzlich den Positionsnamen als Suchkontext. Fehlende Kennungen bleiben ohne Aktion. Die interne Kennungssuche bleibt erhalten. Die vier Beta-Bereiche wurden bei 320–1440 Pixeln im Browser geprüft, einschliesslich CSV-/JSON-Import und JSON-Sicherung. Seitlicher Seitenüberlauf und die Tab-Erreichbarkeit der geschlossenen mobilen Navigation wurden korrigiert. Ergebnisse und Referenzbilder: `docs/UI_Vorschlag_Beta_0.3.md`.

### Oberfläche und Bilder

`web/bim2steiger.html` enthält die Beta-Gestaltung ohne CDN-Abhängigkeit; die vollständige API-Anbindung steht in `web/bim2steiger-program.js`, die Ausschreibungsübernahme in `web/bim2steiger-tender.js`. Kapitelbaum, Kennungssuche, VA-/Rezeptauswahl und Endbestandteile verwenden die vorhandene API. Die frühere `web/bim2steiger.js` wird von dieser Ansicht nicht mehr geladen. Die Original-Beta bleibt eigenständig und enthält weiterhin nur ihre Beispielpositionen.

Die E-/B-Kennungen aller dargestellten Komponenten kommen aus dem jeweiligen Rezept der vorhandenen Datenbank. Kopfnummern kommen aus den Grunddaten derselben Position oder Beobachtungen exakt derselben Artikel-/VA-Kombination; unterschiedliche Kennungspaare bleiben mit Quellenkontext sichtbar. Fehlende Nummern bleiben leer und werden als «—» angezeigt. Kennungen von Unterartikeln werden nicht auf die Elternposition übertragen.

Alle 532 geplanten Katalogseiten wurden für die Artikelvorschauen gelesen. Tausende originale Artikelabbildungen und 500 Kapitelillustrationen liegen in `web/images/portal-2026/`; `inventory.json` ordnet Artikelbilder der exakten Position/VA zu, `chapters.json` ordnet Kapitelillustrationen nur dem Kapitel zu. Alle 16’699 geplanten Artikeldialoge sind unter `data/portal_capture/details/` erfasst. Die Grunddaten-/Bilderfassung des Katalogs 2026 ist vollständig. Der aktuelle Umfang ist im Programm unter «Datenstand ansehen» abrufbar und mit `python tools/validate_portal_capture.py` prüfbar. Originaldateien werden weder hochskaliert noch künstlich ersetzt. Herkunft: `web/images/QUELLEN.md`.

### Vollständige lokale Daten und Programmgrundlage

- `data/catalogue.json`: 11’777 erfasste Katalogartikel und zusätzlich gekennzeichnete reine Kalkulationskomponenten.
- `data/assemblies.json`: 2’772 erfasste VA-00-Kalkulationen sowie zehn Textpositionen; Unterbaugruppen, Mengen und Herkunft.
- `data/catalogue.sqlite`: vorhandener Suchindex.
- `data/chapter_information.json`: Kapitelhinweise einschließlich Steiger-Abkürzungsverzeichnis, S. 21.16–21.17.
- `data/source_snapshots.zip`: zugrunde liegende gespeicherte Portalansichten.
- `core.py`: Katalogabfrage, Rezeptauflösung, Mengenlogik und sichere Verdichtung.
- `server.py`: lokaler Server und vorhandene API.
- `importers.py`, `ifc_import.py`, `n4_import.py`: CSV/JSON, IFC-Räume und Nova-N4D/N4M-Apparate. N4D/N4M braucht `olefile`. Planimporte und Steiger-Zuordnung sind noch nicht umgesetzt.
- `web/index.html`: bisherige funktionale Programmoberfläche für den vollständigen Katalog. Zum Vergleichen der vorhandenen Funktionen verwenden.

## Lokal starten

`Start_BIM2STEIGER.cmd` doppelklicken. Der Starter öffnet ein eigenes Programmfenster und nicht den Browser. Er verwendet nur einen laufenden Server desselben Projektordners und wählt andernfalls einen freien Port zwischen 8765 und 8780. `Start_Steiger2Bim.cmd` ist ein kompatibler Alias. Python 3.11 oder neuer verwenden. Der Katalogserver und IFC brauchen keine zusätzlichen Pakete; N4D/N4M braucht `olefile`, das Fenster braucht `pywebview`. Beides enthält die Windows-exe bereits. `--browser` bleibt die ausdrückliche Ausnahme. Die installierte Programmdatei heisst `BIM2STEIGER.exe` und liegt unter `%LOCALAPPDATA%\Programs\BIM2STEIGER`. Das Icon liegt in `packaging/app.ico`.

```console
python server.py --port 8765
```

Bevorzugte Oberfläche: <http://127.0.0.1:8765/bim2steiger.html>.

Bestehende vollständige Programmoberfläche: <http://127.0.0.1:8765/>.

Bei einem manuellen Start und belegtem Port einen anderen Port wählen. Favoriten und Ausschreibung liegen im Browser je Host/Port; für einen Umzug als JSON sichern. `Start_BIM2STEIGER_Beta.cmd` öffnet weiterhin nur die eigenständige Beispiel-Beta ohne Server.

## API-Anbindung umgesetzt; nächster Entwicklungsschritt

Die Beta-Gestaltung ist an die vorhandene API angebunden (22.10.2026). Weitere Arbeiten sollen diesen Ansichtsadapter erhalten; keine zweite Datenbank beginnen. Nächster Schritt ist die Fortsetzung der zusätzlichen Artikeldialog-Erfassung sowie die fachliche Prüfung dieser neuen Kalkulationsquellen. Die bisherigen Import- und Ausgabefunktionen sind zusätzlich unter `/` erreichbar.

- `/api/meta`: vorhandenen Katalogumfang ausweisen.
- `/api/search`: vollständige Artikelsuche einschliesslich E-/B-Kennungen; direkte Kennungstreffer stehen vor enthaltenen Produkten. Suchformatierung wird normalisiert, Originalnummern bleiben unverändert.
- `/api/source-status`: abgeschlossene Katalogvorschauen und noch unvollständige Artikeldialog-Erfassung unterscheiden.
- `/api/article`: Artikel, verfügbare VA, Grunddaten und erreichbaren Rezeptgraphen anzeigen.
- `/api/expand`: überprüfbare Endbestandteile und Mengen verwenden.
- `/api/tender/aggregate`: bestehende, an BKP und Raum gebundene Verdichtungslogik verwenden.

Das aktuelle Datenfeld `eldas` entspricht der angezeigten E-Nr.; `manufacturer_number` entspricht der Bestell-/Typnummer aus den erfassten Kalkulationen. In `basic_data` stehen die Quellfelder `E-Nr` und `Bestellnummer`. Nicht anhand eines ähnlichen Namens verschiedene Produkte zusammenführen. Bei mehreren unterschiedlichen Kennungen Auswahl oder Quellenkontext erhalten.

Erfassung fortsetzen: `tools/portal_capture.mjs` und `tools/portal_details_capture.mjs` verwenden die sichtbare, angemeldete Portaloberfläche über CUA. Keine Zugangsdaten oder privaten Portal-Endpunkte auslesen. `tools/import_portal_details.py --publish-json` indexiert geprüfte eigene Grunddaten im bestehenden SQLite-Index und erhält die JSON-Quelle. Neue Rohkalkulationen bleiben als Originalquelle getrennt von den bereits fachlich geprüften Rezepten.

## Fachliche Regeln beibehalten

- Mengen gelten je direktem Elternteil. Zur Stammposition alle Ebenen multiplizieren. Elternbaugruppen und Endbestandteile nicht zusätzlich zusammenzählen.
- Negative Mengen erhalten; sie sind Abzüge, keine Erfassungsfehler.
- VA als Zeichenketten mit führenden Nullen behandeln, beispielsweise `00`, `030`, `048`.
- Fehlende Mengeneinheiten und Preise nicht erfinden.
- Material bei Anschluss-/Arbeitspositionen nicht doppelt liefern. Vorhandene Sonderregeln und Fremdleistungen berücksichtigen.
- Bei einer Ausschreibung nur innerhalb desselben Kontexts verdichten: Artikel, VA, Rezept, BKP, Geschoss, Raum, Anlage, Verlegung und Einheit. Unbekannte Räume nicht zusammenführen.
- Abkürzungen im Kontext auswerten. «w Schalter» bedeutet «weiterer Schalter»; «MP» bedeutet «Mehrpreis».
- Keine automatischen Mengen oder passenden Ausschreibungsartikel aus Modell-/Planformaten vortäuschen, solange deren Import und Prüfregeln fehlen.

Weitere Details: `docs/DATENMODELL.md`, `docs/WEITERENTWICKLUNG.md` und `README.md`.

## Prüfen

Nach Änderungen an der Fachlogik die vorhandenen sinnvollen Tests ausführen:

```console
python -m unittest discover -s tests
```

Die bevorzugte Ansicht zusätzlich im Browser prüfen: Suche, E-/B-Nummern, Herkunft der PNG-Bilder, Wissen-Dialog, Favoriten, VA-Wechsel und verschachtelte Zusammensetzungen. Den Testfall `112001 / VA 00` und den negativen Einlasskasten-Abzug bei `112002 / VA 00` beibehalten.

## Geeigneter Startauftrag

Lies zuerst CODEX_START.md und docs/PROGRAMM_BETA_INTEGRATION.md. Entwickle die vollständige Anwendung in web/bim2steiger.html mit web/bim2steiger-program.js auf Basis der freigegebenen Beta weiter. Erhalte die vorhandenen Originaldaten und die Mengen-/BKP-Regeln. Setze die noch unvollständige Erfassung der Artikeldialoge mit eindeutiger Artikel-/VA-Zuordnung fort; neue Kalkulationsquellen erst nach fachlicher Prüfung als Rezepte verwenden. IFC-Bauteile und Nova-Apparate werden bereits gelesen. Raumnummern kommen nur aus einem eindeutigen IfcSpace; N4D/N4M-Objekte haben keine Raumzuordnung. Automatische Steiger-Zuordnung und der echte Messerli-Export bleiben offen.
