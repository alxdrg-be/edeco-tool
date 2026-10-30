# Bildquellen

## Systematische Ergänzung, 21.–23.10.2026

Alle 532 geplanten Katalogseiten wurden im angemeldeten Portal für das Katalogjahr 2026 gelesen. Der geprüfte Stand vom 23.10.2026, 20:58 Uhr (Zürich), umfasst 11’648 Artikelnummern mit Originalabbildung, 32’434 artikel-/VA-bezogene Bildzuordnungen und zusätzlich 500 Kapitelillustrationen. Insgesamt sind 9’969 unterschiedliche Originaldateien lokal vorhanden. Alle 16’699 geplanten Artikel-/VA-Quellen sind erfasst, davon 16’681 Artikeldialoge.

`inventory.json` ordnet Artikelbilder nur dem jeweiligen Artikel und der belegten VA/VA-Liste zu. `chapters.json` enthält ausschliesslich Kapitelillustrationen mit ihrem Katalogpfad. Die Dateien in `portal-2026/` sind unveränderte Originalbytes mit SHA-256 im Dateinamen. Rolle, Quell-URL, Katalogjahr, Kapitel, Zeitpunkt und Originalauflösung sind im Inventar enthalten. Identische Dateien werden mehrfach zugeordnet, aber nicht mehrfach gespeichert. Die bisherigen vier Originaldateien bleiben erhalten.

Bilder aus den einzelnen Grunddaten-Reitern werden zunächst als `kind=basic` erfasst. Ohne belegte Bildrolle werden sie nicht automatisch zu einem Produktfoto erklärt. Kleine Rastergrafiken werden nicht hochskaliert. Die Originalauflösung steht im Bilddialog. Die Illustration eines Kapitels wird nicht auf alle darin enthaltenen Artikel übertragen.

Prüfung: `python tools/validate_portal_capture.py`. Fortsetzung und Grenzen: `docs/PROGRAMM_BETA_INTEGRATION.md`. Der aktuelle Fortschritt steht zusätzlich im Programm unter «Datenstand ansehen».

## Bisherige Einzelquellen

`112001.png`: unveränderte PNG-Grafik aus dem sichtbaren Grunddaten-Reiter der Steiger-Komplettposition 112001, Katalog 2026, erfasst am 20.10.2026. Originalauflösung: 128 × 150 Pixel. Die API-gestützte Detailansicht lädt die lokale Originaldatei; `inventory.json` enthält ihre Artikel-/VA-Zuordnung und Herkunft.

Diese vier anfänglichen Einzelquellen sind weiterhin unverändert vorhanden. Platzhalter dürfen nicht als Originalbilder bezeichnet werden; Produktbilder von Bestandteilen dürfen nur mit Herkunft und Artikelzuordnung als repräsentative Bilder einer Komplettposition verwendet werden.


Am 21.10.2026 direkt aus dem sichtbaren Steiger-Portal übernommen (unveränderte Bilddaten, Katalog 2026):

- `2730-symbol.png`: Strichzeichnung aus den Grunddaten von 2730, Wandlampendübel 2 Einf, 83 × 150 px.
- `2730-product.jpg`: separate Produktabbildung derselben Position, 300 × 300 px; E-Nr. 165930028, Bestellnummer 9951.
- `112212-symbol.png`: gezeichnete Artikelvorschau der Komplettposition 112212 aus der sichtbaren Katalogdarstellung, 130 × 150 px.

Die Originalzeichnung wird auch als kleine Vorschau benutzt. Das Produktfoto wird nur bei Bedarf geöffnet. Einträge mit `kind=product` werden nicht als Symbolvorschau verwendet. Das Inventar bleibt artikelweise; daraus folgt keine vollständige Bilderfassung des gesamten Katalogs.

Herstellerreferenz für 2730 / VA 30: [AGRO 9951](https://www.kaisergroup.com/de-AGRO/p/Lampenduebel-Auslass-OE-30-mm/9951), abgeglichen am 21.10.2026 anhand Bestellnummer 9951 und E-Nr. 165930028. Die Seite bietet Produktunterlagen und einen Zugang zu CAD-/Planungsdaten. Die lokale Portalzeichnung bleibt unverändert; es wurde keine höher aufgelöste Zeichnung übernommen.
