# BIM2STEIGER

Das vollständige lokale Programm verwendet jetzt die freigegebene **Beta-0.3-Gestaltung**: `web/bim2steiger.html` mit `web/bim2steiger-program.js`. Es enthält den vollständigen Katalog, eigene Favoriten-, Import- und Exportansichten, Tag-/Nachtmodus und Wissen auf Klick mit Pin. Die ursprüngliche `web/bim2steiger-beta.html` bleibt als eigenständige Gestaltungsreferenz mit ihren Beispielpositionen erhalten. Die frühere Programmoberfläche ist unter `/` weiter verfügbar. Umsetzungsstand: [docs/PROGRAMM_BETA_INTEGRATION.md](docs/PROGRAMM_BETA_INTEGRATION.md).

**Für die Weiterentwicklung zuerst [CODEX_START.md](CODEX_START.md) lesen.** «Wissen griffbereit» steht im Header direkt links neben «Favoriten». Originalbilder bleiben klein und artikelbezogen. Die alternative Drei-Spalten-Skizze ist keine Vorgabe.

Bei laufendem Server die bestätigte Ansicht unter <http://127.0.0.1:8765/bim2steiger.html> öffnen. Sie verwendet jetzt den vollständigen lokalen Katalog und die vorhandene API. Die bisherige Programmoberfläche unter `/` bleibt für neutrale Importe und zusätzliche Ausgaben erreichbar. Nach einem Update `server.py` neu starten, damit ergänzte Schnittstellen verfügbar sind.

Lokaler Projektstart für Katalogsuche, nachvollziehbare Zusammensetzungen und eine Ausschreibung mit BKP- und Raumzuordnung. Die Daten stammen aus dem Steiger-Portal, Katalogjahr 2026. Es werden keine Zugangsdaten gespeichert und keine Dateien an einen Cloud-Dienst geschickt.

## Starten

Unter Windows **`Start_BIM2STEIGER.cmd`** doppelklicken. Es öffnet sich ein eigenes Programmfenster, nicht der Browser. `Start_Steiger2Bim.cmd` bleibt als Alias erhalten. Benötigt wird Python 3.11 oder neuer und für das Fenster `pywebview`; auf diesem Rechner wird auch die vorhandene Codex-Python-Installation gefunden. Der Starter verwendet einen passenden laufenden Server desselben Projektordners oder einen freien Port von 8765 bis 8780. Alternativ im Projektordner:

```console
python server.py --open
python server.py --open --browser
```

Beim manuellen Start läuft die Anwendung unter <http://127.0.0.1:8765/bim2steiger.html>. `--open` zeigt das Programmfenster. `--browser` ist die Ausnahme und öffnet den Standardbrowser. Für den blossen Server sind keine zusätzlichen Python-Pakete erforderlich. Falls der Port belegt ist: `python server.py --port 8766 --open`. Der Windows-Starter startet den Server ohne zusätzliches sichtbares Terminalfenster.

## Windows-Setup

Der vorhandene GitHub-Workflow baut auf `main` das Windows-Setup und legt erfolgreiche Builds unter den privaten Releases ab. Die installierte Anwendung benötigt kein separates Python und öffnet ein eigenes Fenster mit Programmicon. Kann das Fenster nicht starten, erscheint eine Meldung; der Browser öffnet sich nicht. Der Quellcode startet weiterhin über `Start_BIM2STEIGER.cmd`.

Ab Version 0.3.1 gibt es «Einstellungen» mit Versions-/Buildanzeige, automatischer Updateprüfung beim Start und manueller Prüfung. Verfügbare Updates erscheinen am Anfang der Anwendung. Die installierte Windows-Version kann ein geprüftes Setup herunterladen und dessen Installationsassistenten starten. Beim privaten Repository wird eine vorhandene lokale GitHub-Anmeldung benötigt; andernfalls die Release-Seite im angemeldeten Browser verwenden. Details und Grenzen: [docs/UPDATES.md](docs/UPDATES.md).

Die Datei `web/bim2steiger.html` nicht direkt als vollständiges Programm verwenden: Sie zeigt ohne Server eine Startanleitung. Den Starter oder das installierte Programmsymbol verwenden.

## Was bereits funktioniert

- Artikel nach Nummer, Beschreibung, E-Nr., B-Nr. und enthaltenen Bestandteilen suchen; VA und Rezeptversion auswählen. Direkte Kennungstreffer erscheinen zuerst. Die Suchnormalisierung verändert keine gespeicherten Originalnummern.
- Komplettpositionen und Unterbaugruppen mit Mengen je Elternteil und je Stammposition anzeigen.
- Vollständigen Artikeltext, verfügbare Stammdaten und die Kalkulationszusammenfassung ansehen.
- Positionen manuell oder aus neutralen Modellobjekten einer BKP, einem Raum und einer Verlegeart zuordnen.
- Favoriten mit Symbolen nach Katalogkategorien verwalten und als JSON sichern/laden. Ausschreibung mit Menge, Einheit, BKP und Raum übernehmen, verdichten und als JSON sichern. Weitere Import-/CSV-Ausgaben bleiben in der bisherigen Oberfläche unter `/` erreichbar.
- Gleiche Positionen nur bei gleicher BKP, Geschoss, Raum, Anlage, Verlegung, Einheit, Artikel, VA und Zusammensetzung zusammenführen. Ohne Raum werden Positionen einzeln behalten.

## Datenumfang und Grenzen

`data/assemblies.json` enthält die erfassten Komplettpositionen mit VA 00, deren vollständige sichtbare Unterbaugruppen, Stammdaten und Artikeltexte. `metadata` weist Soll, Ist und Prüfstatus ausdrücklich aus. In Unterbaugruppen beobachtete Einzelartikel und deren VA sind zusätzlich verknüpft. Die Kalkulationen sämtlicher anderer Einzelartikel-VA wurden nicht separat geöffnet; ihr Status bleibt sichtbar. Ein fehlendes Rezept bedeutet daher **unbekannt**, nicht „enthält keine Teile“.

Mengen werden entlang der gesamten Baugruppenkette multipliziert. Zwischenbaugruppen und Endbestandteile dürfen nicht zusätzlich zusammengezählt werden. Bei Kabelanschlüssen und reinen Arbeitspositionen wird Material nicht erneut geliefert; separate Lieferteile und ausdrücklich ausgewiesene Fremdleistungen bleiben enthalten. VA 100 erzeugt keine zusätzliche Arbeitszeit. Negative Komponenten einer Mehr-/Minderpreisposition bleiben erhalten. Positionen ohne weitere Unterteilung verwenden die ausgewiesene Kalkulationszusammenfassung.

Die Portalansicht nennt keine Mengeneinheit. Die Anwendung erfindet sie nicht: Vor Übernahme in die Ausschreibung muss sie ausdrücklich gewählt werden. Die Kalkulation zeigt den gespeicherten K-Referenzstand des Portals in CHF und Stunden. Sie ist keine aktuelle Unternehmerofferte. Herkunft und Erfassungszeitpunkt sind im Datensatz enthalten.

Reine Lieferanten-/Kalkulationskomponenten ohne bestätigten Katalogeintrag können betrachtet, aber nicht direkt als Ausschreibungsposition übernommen werden.

Die abgeschlossene Erfassung umfasst **2’772 Kalkulationen und 10 Textpositionen**, zusammen 30’025 Baumzeilen und 3’034 unterschiedliche Rezeptdefinitionen. Alle 2’782 Zieleinträge sind geprüft. 110 Kalkulationen haben keine weitere Unteraufteilung.

Bei 20 Kalkulationen fehlen in der Quelle einzelne Einheitspreise; diese bleiben `null`. 5’524 Material-/Zeitsummen konnten anhand der Endbestandteile geprüft werden. Zwei interne Kostenanteile (992878/09 und 990625/09) sind aus den Portalsummen abgeleitet und ausdrücklich entsprechend gekennzeichnet; ihre separate Kostenklassifikation ist nicht durch eigene Grunddaten bestätigt.

## Modellobjekte importieren

Im Bereich „Dateiimport“ eine CSV, JSON, IFC, N4D oder N4M laden. Die Vorschau zeigt ungeprüfte Objekte und fehlende Angaben; ihre JSON-Sicherung ist keine Messerli-Datei. Eine CSV-Vorlage und manuelle Modellzuordnung sind zusätzlich in der bisherigen Oberfläche unter `/` verfügbar. Unterstützte CSV-/JSON-Felder: `id`, `guid`, `ifc_class`, `name`, `storey`, `room`, `system`, `placement`, `quantity`, `unit`, `number`, `va`, `bkp`. `properties` kann in JSON zusätzliche Merkmale enthalten. Deutsche Spaltennamen wie `Menge`, `Einheit`, `Raum` werden unterstützt.

Eine vorhandene Menge bleibt unverändert; bei fehlendem Mengenfeld wird ein Objekt als Menge 1 eingelesen. Das ist noch keine Längen- oder Flächenermittlung. Fehlende Einheiten bleiben offen. Doppelte Objekt-IDs werden bei CSV und JSON abgewiesen. Die Zuordnung zu Artikel/VA und BKP wird vom Benutzer bestätigt.

IFC übernimmt elektrische Bauteile und `IfcBuildingElementProxy`. Raumnummer ist der Name des `IfcSpace`, Raumname dessen Langname, Geschoss der Name des `IfcBuildingStorey`, wenn die Datei das Bauteil genau einem Raum zuordnet. N4D und N4M lesen platzierte Nova-Apparate mit derselben Datensatzkennung wie NOVA-Legenden. Diese Objekte enthalten keine Raumnummer; der Raum bleibt offen. Nova-Kennungen werden nicht als Steiger-Artikelnummern eingetragen. Jedes IFC- oder Nova-Objekt zählt als ein Stück, ohne erfundene Einheit. Planimporte (PDF, DXF, DWG), automatische Artikelzuordnung und der Messerli-Export bleiben offen.

## Speichern und weiterentwickeln

Die Arbeitsliste liegt zunächst im Browser dieses Rechners. Regelmässig „JSON sichern“ verwenden; damit lässt sie sich in einem anderen Browser wieder laden. Katalogdaten und Programm liegen vollständig im Projektordner. Projektkopien können ohne Portal-Anmeldung geöffnet werden.

- `docs/WEITERENTWICKLUNG.md`: konkrete Aufgaben für Codex oder Claude Code.
- `docs/DATENMODELL.md`: Identitäten, Mengenregeln, Schnittstellen und Herkunft.
- `tools/rebuild_index.py`: Suchindex aus den mitgelieferten JSON-Dateien neu aufbauen.
- `tests/test_core.py`: Prüfungen für Mengen, Importe und sichere Verdichtung.
- `data/chapter_information.json`: Kapitelinformationen und Hinweise des Katalogs.
- `data/source_snapshots.zip`: gespeicherte Portalansichten mit Erfassungsplan und Belegen der Sonderleistungen.
- `data/quality_report.json`: Ergebnis der vollständigen Mengen-/Summenprüfung, einschliesslich fehlender Quellpreise.

```console
python tools/rebuild_index.py
python -m unittest discover -s tests
```



## Vollständiger Katalog in der Beta-Gestaltung (22.10.2026)

`web/bim2steiger.html` bindet über `web/bim2steiger-program.js` den Katalog an. Der Kapitelbaum zeigt 11’777 Katalogartikel und 853 ausdrücklich markierte Kalkulationskomponenten. Artikelbuttons werden kapitelweise nachgeladen. Suche nach Beschreibung, Artikelnummer, Artikel/VA, E-Nr. und Bestellnummer; bis zu 100 Treffer mit Hinweis zum Eingrenzen.

VA und Rezeptversion sind ausdrücklich wählbar. E-/B-Nummern gehören zur gewählten Artikel-/VA-Kombination; unterschiedliche beobachtete Kennungen und deren Rezeptquellen stehen unter Eigenschaften. Die Tabelle zeigt Mengen je Elternteil und je Stammposition. «Endbestandteile» verwendet `/api/expand` samt Rezeptpfaden und Materiallieferungsstatus.

«In Ausschreibung» verlangt Menge, Einheit und BKP; Geschoss, Raum, Anlage und Verlegung werden erhalten. Die Verdichtung verwendet `/api/tender/aggregate`. Die Ausschreibung nutzt denselben lokalen Speicherschlüssel und dasselbe JSON-Format wie die bisherige Oberfläche. Favoriten behalten `bim2steiger:merkliste:v1`. Browserdaten gelten je Host und Port: Auf einem anderen Port sind die gespeicherten Listen nicht automatisch sichtbar.

Die Vorschauerfassung hat alle 532 geplanten Katalogseiten gelesen. Tausende Artikelbilder und 500 Kapitelillustrationen sind unverändert lokal gesichert. `web/images/inventory.json` und `chapters.json` dokumentieren Zuordnung, Quelle, Zeitpunkt, Originalauflösung, Datei und SHA-256. Die Lupe zeigt Originalgrösse ohne Hochskalierung. Fehlende Artikelbilder werden nicht durch ein ähnliches Produkt ersetzt. Alle 16’699 Artikel-/VA-Quellen des Katalogs 2026 sind erfasst; «Datenstand ansehen» zeigt diesen Stand.

Neue Grunddaten werden mit `python tools/import_portal_details.py --publish-json` in den vorhandenen Suchindex und die vorhandene JSON-Quelle übernommen. Zusätzliche Rohkalkulationen bleiben als einsehbare Quellen getrennt von den geprüften Rezepten. Zum Prüfen: `python tools/validate_portal_capture.py` sowie `python -m unittest discover -s tests` (52 Tests, geprüft am 23.10.2026). Browserprüfung und Grenzen: [docs/PROGRAMM_BETA_INTEGRATION.md](docs/PROGRAMM_BETA_INTEGRATION.md).
