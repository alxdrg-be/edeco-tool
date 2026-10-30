# Daten und Schnittstellen

Alle Artikelnummern, VA, BKP und GUIDs sind Zeichenketten. Führende Nullen einer VA müssen erhalten bleiben. Jahr + Artikelnummer + VA bilden eine Variantenidentität, zum Beispiel `2026:122104:00`.

`data/catalogue.json` enthält Katalogeinträge mit Namen, Text, VA, Kapitelherkunft und Suchtext. `source_kind=catalogue` bezeichnet einen vorhandenen Katalogeintrag; `composition_only` einen nur innerhalb einer Kalkulation beobachteten Eintrag.

`data/assemblies.json` enthält:

- `metadata`: Erfassungsumfang, Soll/Ist und Prüfstatus.
- `roots`: direkt geöffnete Komplettpositionen, Quelle, Zeitpunkt, Grunddaten, Artikeltext, Portalsummen und konkrete Rezept-ID.
- `recipes`: Zusammensetzungen mit unmittelbaren Kindern. Gleiche Nummer/VA können in verschiedenen Kontexten mehrere Rezeptversionen haben. Die ID hängt vom Inhalt ab.
- `variants`: Status und alle beobachteten Rezept-IDs je Nummer/VA.
- `recipe_provenance`: wo und wann eine Rezeptversion beobachtet wurde.
- `validation_findings` und `missing_complete_positions`: explizite offene Punkte.

Ein Rezeptteil hat `quantity` und `quantity_raw` je unmittelbarem Elternteil, Artikelnummer/VA, Namen, Netto- und K-Zeitwerte sowie optional ein Unterrezept. Mengen je Stammposition werden durch Multiplikation entlang des Pfads bestimmt. Ein Rezept ohne weitere Kinder kann ein `atomic`-Element mit den Werten aus der Portalsumme enthalten; es werden keine fiktiven Bestandteile ergänzt. Fehlende Werte bleiben `null`.

Preise sind CHF, Zeiten Stunden. Tabellenpreise von Zwischenbaugruppen werden zur originalgetreuen Ansicht gespeichert. Für Endbestandteilauszüge werden ausschliesslich Endbestandteile berücksichtigt. Reine Arbeitspositionen unterdrücken Materiallieferungen entlang ihres Pfads. Anschlussbaugruppen können separate Lieferteile enthalten. Explizite Fremdleistungen werden mit eigener Kostenart erhalten; zwei interne Kostenklassifikationen sind in derived_component_cost_rules mit Herleitung dokumentiert. Die direkt geöffnete Portalsumme bleibt als Referenz erhalten.

Die normalisierten Modellobjekte besitzen `id`, `guid`, `ifc_class`, `name`, `storey`, `room`, `system`, `placement`, `quantity`, `unit`, optionale `number`/`va`/`bkp`, `source_file`, `source_row`, `properties`. Mengen brauchen eine nachprüfbare Einheit und Herkunft. Ein künftiger Adapter soll zusätzlich Mengenquelle, Originaleinheit und Regelversion speichern.

Ausschreibungszeilen enthalten Artikel/VA, Menge/Einheit, BKP, Geschoss, Raum, Anlage, Verlegung, konkrete `recipe_id`, Katalogjahr und Modellreferenzen in `sources`. Die Verdichtung benutzt alle diese Sachzuordnungen; unbekannte Räume bleiben einzeln. Der Katalogreferenzpreis ist nicht der Vertragspreis.

## Lokale HTTP-Schnittstellen

- `GET /api/meta`: Erfassungsumfang.
- `GET /api/search?q=122104&kind=complete`: Suche; `kind=all|complete|single`.
- `GET /api/article?number=122104&va=00`: Artikel, Varianten, gewählte Zusammensetzung und erreichbare Unterrezepte.
- `GET /api/expand?number=122104&va=00&quantity=2&recipe=REZEPT_ID`: Endbestandteile mit aufmultiplizierten Mengen und Pfad.
- `POST /api/import`: `{ "filename": "objekte.csv", "text": "..." }` → normalisierte Modellobjekte.
- `POST /api/tender/aggregate`: `{ "lines": [...] }` → verdichtete Zeilen mit erhaltenen Quellen.

Der Server ist für die lokale Nutzung vorgesehen. Ein Mehrbenutzerbetrieb, Netzfreigabe, Authentifizierung und Cloud-Publikation sind kein Bestandteil dieses Projektstarts.


## Ergänzungen der Detailansicht

- `GET /api/catalogue`: schlanke Navigation aller Artikel mit Nummer, Name, VA, Quelltyp und allen Kapitelpfaden. Die bestehende SQLite-Datenbank bleibt die einzige persistente Katalogablage.
- `/api/search` durchsucht zusätzlich die E-/B-Originalkennungen des jeweiligen Artikels. `kind=assembly` beschränkt auf `composition_only`, `kind=single` auf bestätigte Einzelartikel. Kennungstreffer übertragen keine Identität auf Elternpositionen.
- `/api/article` liefert zusätzlich `identifiers`: getrennte Kennungspaare mit Herkunft und Rezeptquellen. Grunddaten derselben Position haben Vorrang, einschliesslich explizit leerer Felder. Ohne Grunddaten werden nur Beobachtungen exakt derselben Artikel-/VA-Kombination verwendet. Mehrere unterschiedliche Kennungen bleiben getrennt.
- Optionales `recipe` bei `/api/article` wählt eine der vorhandenen Rezeptalternativen. Fremde Rezept-IDs werden abgewiesen. Die Detailansicht und `/api/expand` verwenden dieselbe konkrete Version.
- Das Bildinventar liegt in `web/images/inventory.json`. Ein Bild wird nur bei passender Artikelnummer und VA verwendet.

Die Navigation und Kennungsableitungen werden im Prozess zwischengespeichert. Nach Austausch oder Neuaufbau der Katalogdaten den Server neu starten.

## Zusätzliche Portalquellen und Beta-Anwendung, 22.10.2026

Die vollständige Anwendung verwendet `web/bim2steiger-program.js`. `/api/app` identifiziert den konkreten lokalen Projektordner für den Starter. `/api/source-status` unterscheidet gelesene Katalogseiten, vorhandene Artikelbilder und noch unvollständige Artikeldialoge.

Neue Quellen liegen unter `data/portal_capture/`. Eigene Grunddaten werden an exakt dieselbe Artikel-/VA-Variante im vorhandenen SQLite-Index und in `assemblies.json` angehängt (`basic_data`, `portal_source`). Artikelnummer, VA, E-Nr. und Bestellnummer bleiben Original-Zeichenketten. Eine ausdrücklich leere eigene Kennung bleibt leer; abweichende Beobachtungen desselben Artikels und derselben VA bleiben separat mit Quellenkontext verfügbar. Suchformatierung wird nur während der Suche entfernt. Eigene Kennungstreffer werden vor Treffern in enthaltenen Bestandteilen sortiert.

`portal_details` in `/api/article` liefert eine zusätzliche geprüfte Quellzuordnung, jedoch keinen automatisch freigegebenen Rezeptgraphen. Die originalen Zeilen, Mengen, Felder und Kalkulationssummen bleiben im Quellenarchiv; bestehende geprüfte `recipes` und `roots` werden dadurch nicht ersetzt. Fehlende geprüfte Rezepte bleiben unbekannt.

Artikelbilder enthalten SHA-256, Originalabmessungen, Quelle und exakte VA/VA-Liste. `chapters.json` speichert Kapitelillustrationen getrennt. Die Bilddateien sind unverändert. Umfang und Fortsetzung: `PROGRAMM_BETA_INTEGRATION.md`.
