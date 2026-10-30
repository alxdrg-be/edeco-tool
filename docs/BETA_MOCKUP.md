# BIM2STEIGER · Beta 0.3

Vom Benutzer am 21.10.2026 zusätzlich angefragter Beta-Prototyp: Katalog links, Artikel mit gezeichneter Vorschau und Bauteilverweisen mittig. Wissen öffnet auf Klick und kann rechts angepinnt werden. Datei: `web/bim2steiger-beta.html`. Die angebundene Hauptansicht `web/bim2steiger.html` bleibt erhalten.

## Öffnen

`web/bim2steiger-beta.html` direkt im Browser öffnen, `Start_BIM2STEIGER_Beta.cmd` doppelklicken oder bei laufendem lokalen Server `/bim2steiger-beta.html` aufrufen. Stile und Bilder sind vollständig eingebettet. Kein Build, keine CDN-Abhängigkeit und keine zusätzlichen Pakete erforderlich. Die Vorschau benötigt keinen Server; tatsächliche CSV-/JSON-Importe verwenden die bestehende lokale API.

Aktuelle Gestaltung: [UI-Vorschlag Beta 0.3](UI_Vorschlag_Beta_0.3.md). Die folgenden Abschnitte dokumentieren zusätzlich die bisherigen Entwicklungsschritte.

## Funktionsumfang

- Aufklappbarer Baum mit drei Komplettpositionen und zwölf enthaltenen Artikel-/VA-Varianten.
- Suche nach Nummer, Beschreibung, E-Nr. und Bestellnummer. Ctrl/Cmd+K, Pfeiltasten, Enter, Escape und Leerzustand.
- Stammdaten, verfügbare Beispiel-VA, Artikeltext und anklickbare Zusammensetzung. Ein Bauteil öffnet die eigene Detailansicht; Rückverweise führen zur Quellposition. URL-Hash unterstützt direkte Artikel-/VA-Links.
- Originalzeichnung als Hauptvorschau, auch im Katalogbaum, in Suchtreffern und in der Zusammensetzung. «Produktfoto ansehen» öffnet das Produktbild erst bei Bedarf im Dialog. Der Globus öffnet eine externe Produktsuche.
- Eigene Favoritenseite unter `#favoriten`, erreichbar im Header und im Katalog. Originalsymbole, Artikelnummer, VA und E-/B-Nummern bleiben sichtbar. Kategorien und Filter verwenden die gespeicherten Original-Katalogpfade aus `data/catalogue.json`; reine Kalkulationsbestandteile ohne eigenen Katalogpfad bleiben ausdrücklich in einer eigenen Gruppe. Artikel-/VA-Kombinationen werden nicht zusammengeführt. Bestehender Schlüssel `bim2steiger:beta:favoriten:v1` bleibt erhalten; keine Änderung der Favoriten der Hauptansicht.
- Tag-/Nachtmodus per Sonne-/Mond-Schalter im Header. Beim ersten Öffnen gilt die Systemdarstellung, danach die gespeicherte Auswahl. Originalbilder behalten ihre Farben.
- «Wissen griffbereit» ist standardmässig geschlossen. Klick öffnet einen Dialog mit Pin und Schliessen. Anpinnen hält Wissen neben der Detailansicht, auf mittleren/kleinen Bildschirmen darunter; Lösen öffnet es wieder als Dialog. Schliessen löst den Pin.
- Anzeigeeinstellungen werden separat unter `bim2steiger:beta:preferences:v1` gespeichert.
- Responsive Darstellung: zwei Spalten als Standard, optional dritte Wissensspalte am Desktop, Katalog über Menü auf kleinen Bildschirmen.

Die Daten stehen als JSON im Element `betaData`. Die kommentierten Bereiche Design-Tokens, Komponenten, Datenadapter und Ereignisse bilden die Erweiterungspunkte. Der Prototyp verwendet bewusst diesen eingefrorenen Katalogauszug. Die vollständige API-Anbindung befindet sich bereits in der bestehenden Hauptansicht.

## Daten und Bilder

Beispielpositionen: 112001/00, 112002/00 und 112212/00. Alle Komponentenkennungen und direkten Mengen stammen aus den jeweiligen Rezepten der vorhandenen SQLite-Datenbank. Nummern bleiben Zeichenketten; Kopfkennungen der Komplettpositionen sind nicht angegeben und bleiben «—». Mengen erhalten keine erfundene Einheit. Der negative Einlasskasten-Abzug bei 112002 bleibt negativ.

- **Schema 112001:** unverändertes Original `web/images/112001.png`, Steiger-Grunddaten derselben Position, erfasst am 20.10.2026, 128 × 150 px.
- **Produktabbildung:** Feller EDIZIO.liv 7563.GMI.A.61, E-Nr. 219070000, beim Bestandteil 998123/48 beobachtet. Für 112001 und 112002 ist ausdrücklich das Foto dieses enthaltenen Bestandteils hinterlegt. Es ist kein Foto der gesamten Installation.
- **Bildquelle:** [BRACK-Produktseite](https://www.brack.ch/feller-edizioliv-schalter-up-druckschalter-sch-3-weiss-1754285), dortiges `og:image`: `https://assets.brack.ch/images2/9/5/1/367693159/367693159_xxl.jpg`. Erfasst am 21.10.2026, Originalauflösung 800 × 600 px, lokale Datei `web/images/beta/feller-7563.GMI.A.61.jpg`, unverändert. Zuordnung der E-/B-Kennung zusätzlich mit dem [Feller-Datenblatt](https://online-katalog.feller.ch/kat_produkt_datenblatt.php?fnr=7563.GMI.A.61) abgeglichen. Rechte verbleiben beim jeweiligen Rechteinhaber; Einbindung in diesen lokalen internen Entwurf, keine Publikation erfolgt.
- **Bauteile ohne erfasste Originalzeichnung:** selbst gezeichnete, schematische SVG-Icons. Diese sind als UI-Symbole gekennzeichnet und stellen keine erfassten Original-CAD-Symbole oder Produktfotos dar. Bei fehlendem Foto erscheint ein erklärter Leerzustand.
- **BIM-Begriffe:** kurze Referenz auf [buildingSMART](https://www.buildingsmart.org/standards/bsi-standards/). Der Prototyp bietet keinen IFC-, N4D-, N4M- oder Planimport.

## Prüfen

JavaScript-Syntax prüfen; im Browser Startposition, Search-Overlay mit Tastatur und fehlenden Treffern, Bauteilverweis samt Rücksprung, VA 30/40 des Rohres, Bildlupe, externen Suchlink, Favoriten, Artikeltext und mobile Navigation prüfen. Für 112002 muss der Einlasskasten die Menge −1 zeigen. Fachlogik der Hauptanwendung wird durch diesen separaten Prototyp nicht verändert.

Prüfung am 21.10.2026: JavaScript-Syntax und alle zwölf Artikel-/VA-Verweise geprüft, eingebettete Bilder byteweise mit den lokalen Originalen abgeglichen. Im Browser geprüft: Drei-Spalten-Darstellung, Bestellnummernsuche und Enter, Such-Leerzustand, Bauteildetails mit eigenen Kennungen, Querverweise und Rücksprung, VA 30/40, Foto-Lupe mit Quelle, Hinzufügen/Entfernen von Favoriten und negativer Abzug bei 112002. Externer Suchlink zeigt auf die Kennungen des tatsächlich abgebildeten Produkts. Aufnahmen: [Startansicht](Beta_2026-10-21_Start.png) und [Bilder mit Zusammensetzung](Beta_2026-10-21_Details.png).


## Präzisierung der Bildführung am 21.10.2026

Im vom Benutzer geöffneten Portal wurden die sichtbaren Grunddaten von **2730 · Wandlampendübel 2 Einf** geprüft. Der Dialog zeigt eine Strichzeichnung und eine separate Produktabbildung. Beide Bilder wurden aus den sichtbaren IMG-Elementen unverändert übernommen, ohne Portal-Zugangsdaten zu speichern.

- `web/images/2730-symbol.png`: Originalzeichnung aus den Grunddaten, 83 × 150 px.
- `web/images/2730-product.jpg`: separate Produktabbildung derselben Artikelnummer, 300 × 300 px. E-Nr. 165930028, Bestellnummer 9951.
- `web/images/112212-symbol.png`: Originalsymbol der zugehörigen Komplettposition aus der sichtbaren Katalogdarstellung, 130 × 150 px.

Quelle: `https://digital.asteigerag.ch/dashboard`, Katalogjahr 2026, erfasst am 21.10.2026. Rollen, Artikel-/VA-Zuordnung und Originalauflösungen stehen zusätzlich in `web/images/inventory.json`. Der Beta-Datensatz enthält nun die Position 112212/00 mit ihren sieben Originalbestandteilen.

Die Zeichnung führt die Artikelansicht an. Originalzeichnungen ersetzen vorhandene generische Icons in Baum, Suche und Zusammensetzung; fehlende Originale bleiben gekennzeichnete schematische Platzhalter. Produktabbildungen werden ausschliesslich im Bilddialog angezeigt. Die API-gestützte Hauptansicht verwendet die neuen Originalsymbole ebenfalls im Baum, in der Suche und in der Zusammensetzung. Ihre Symbolauswahl schliesst Inventareinträge der Rolle `kind=product` ausdrücklich aus.


Nachprüfung der Bildführung: Im Browser sind vor dem Öffnen des Fotodialogs ausschliesslich Zeichnungen als IMG-Elemente sichtbar. Das Foto 2730 wird auf Anforderung mit der Portalquelle und 300 × 300 px geöffnet. Originalsymbole wurden in Beta-Katalogbaum, Bauteildetail und Zusammensetzung sowie in der vollständigen API-Ansicht von 112212 geprüft. Neue Vorschau: [Originalzeichnung und Foto auf Wunsch](Beta_Originalsymbole_2026-10-21.png).


## Persönlicher Arbeitsbereich · Beta 0.2

Am 21.10.2026 ergänzt: Nachtmodus, Wissen auf Klick mit gespeichertem Pin und eigene kategorisierte Favoritenseite. Die vorhandene API-Ansicht und Fachlogik werden durch diese Änderung nicht verändert. Die eingebetteten Artikel enthalten zusätzlich `catalogue_paths`, exakt aus den Katalogeinträgen derselben Artikelnummer übernommen; fehlende Pfade bleiben leer.

Browserprüfung: Tag-/Nachtwechsel samt Neuladen, geschlossenes Wissen als Standard, Öffnen/Anpinnen/Neuladen/Lösen/Schliessen, Favoriten-Leerzustand, Hinzufügen, Entfernen, Originalsymbole in ihren Rahmen, Kategoriefilter, getrennte VA 30/40, direkter Aufruf von `#favoriten` und Browser-Zurück. Der negative Einlasskasten-Abzug bei 112002/00 bleibt −1.

Aktuelle Aufnahmen: [Favoritenseite im Nachtmodus](Beta_Favoriten_Nachtmodus_2026-10-21.png) und [Wissen auf Klick mit Pin](Beta_Wissen_auf_Klick_2026-10-21.png).


## Dateiimport, Ausgabe und Bildgrösse · Beta 0.3

Eigene Navigationsbereiche `#import` und `#export` ergänzen den Katalog und die Favoritenseite. CSV-/JSON-Importe verwenden über HTTP die vorhandene Schnittstelle `/api/import`. Es gibt keine zweite Import-/Mengenlogik. Der direkte Aufruf als HTML-Datei zeigt beide Bereiche als Vorschau und erklärt, wie die lokale Anwendung gestartet wird.

Der Import zeigt Quellname, Zeitpunkt, Objektanzahl, offene Räume und Einheiten sowie maximal zehn Vorschauobjekte. Alle Objekte bleiben ausdrücklich ungeprüft. Der lokale Schlüssel `bim2steiger:beta:model-import:v1` hält den letzten Import; «Import verwerfen» setzt ihn zurück. Ein neuer Import ersetzt erst nach erfolgreicher Normalisierung den vorherigen Stand. Die Quelldatei wird nicht verändert.

«Modellimport als JSON sichern» gibt einen Stand mit `schema_version=bim2steiger.model-review.v1`, `status=unreviewed`, Herkunft und Originalobjekten aus. Das ist keine Messerli-Austauschdatei. Der Messerli-Export bleibt bis zur Implementierung und Prüfung der echten Schnittstelle gesperrt. Direkte Nova-/IFC-Importe und die automatische Zuordnung werden als offen ausgewiesen. Die vorhandene Ausschreibungsanwendung wird auf demselben Server verlinkt.

Rasterbilder werden im Bilddialog nicht über ihre natürliche Auflösung hinaus vergrössert; grössere Bilder passen sich dem verfügbaren Platz an. Die Portalzeichnung von 2730 bleibt unverändert 83 × 150 Pixel gross. Für diesen anhand Bestellnummer 9951 und E-Nr. 165930028 geprüften Artikel führt ein zusätzlicher Link zu den Hersteller-/CAD-Unterlagen. Es wurde keine höhere Auflösung vorgetäuscht und keine technische Zeichnung nacherfunden.

Prüfung: 24 bestehende Tests bestanden; JavaScript-Syntax geprüft. Im Browser: CSV-Dateiauswahl über die vorhandene API, drei Vorschauobjekte, offene Raum-/Einheitsangaben, Erhalt von VA `030` und Menge `0`, Wiederherstellung nach Neuladen, JSON-Download mit `status=unreviewed`, Reset, Import-/Exportnavigation und Bilddarstellung mit exakt 83 × 150 CSS-Pixeln. Keine doppelten IDs oder horizontalen Überläufe in der geprüften Ansicht. Testdaten anschliessend aus der Browserablage entfernt.

Vorschauen: [Dateiimport](Beta_Importbereich_2026-10-21.png), [Exportbereich](Beta_Exportbereich_2026-10-21.png), [Originalgrösse](Beta_Originalgroesse_2026-10-21.png).


## Zurückhaltende PNG-Vorschau · 21.10.2026

Die Beta zeigt Artikelbilder als kleine Original-PNGs mit maximal 72 Pixel Höhe. Der bisherige Bildrahmen mit «Gezeichnete Vorschau», «Originalzeichnung», «Steiger-Grunddaten» und erläuternden Texten entfällt in der Detailansicht. Bild- und Fotoansicht sowie externe Produktsuche bleiben über kleine Schaltflächen erreichbar. Quellen und Originalauflösung stehen bei Bedarf im Bilddialog. Fehlende Originalbilder bleiben schematische Platzhalter.

Browserprüfung: PNG-Format und begrenzte Darstellungsgrösse, keine sichtbaren Bildbeschriftungen, Bild-/Fotodialog, Positionen 112001/00 und 112002/00 samt Abzug −1. JavaScript-Syntax geprüft. [Aktuelle Vorschau](Beta_Kleine_PNG_Vorschau_2026-10-21.png).
