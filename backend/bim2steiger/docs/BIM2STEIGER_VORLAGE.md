# BIM2STEIGER – Portalvorlage

Die bestätigte ältere Detailansicht steckt in **einem HTML-Dokument**: `web/bim2steiger.html`. Darin befinden sich HTML, Tailwind per CDN, ergänzende Komponentenstile, SVG-Bildplatzhalter, Beispieldaten, eine eingebettete Original-PNG-Grafik und einfaches JavaScript. Es ist kein Build-Schritt nötig. Für die Übergabe an Codex zuerst `CODEX_START.md` im Projektordner lesen.

## Öffnen

Bei laufendem Steiger2Bim-Programm: <http://127.0.0.1:8765/bim2steiger.html>.

Alternativ `bim2steiger.html` direkt im Browser öffnen. Das Layout und die lokalen Beispieldaten sind im Dokument enthalten. Für das Nachladen von Tailwind wird eine Internetverbindung verwendet; grundlegende Komponentenstile sind zusätzlich direkt enthalten.

Die bestehende Steiger2Bim-Anwendung unter `/` bleibt als eigenständige Anwendung erhalten.

## Bedienung

- Suche über die Suchleiste oder **Strg/Cmd+K** öffnen. Nach Artikelnummer, Originalbezeichnung, Bestandteil oder hinterlegten Synonymen suchen. «weiterer Schalter» findet beispielsweise «w Schalter/Taster».
- Treffer nach Komplettpositionen, Baugruppen und Einzelteilen filtern. Pfeiltasten wechseln den hervorgehobenen Treffer, Enter öffnet ihn und Escape schliesst das Overlay.
- Kategorien links auf- und zuklappen; eine Position auswählen. Auf kleinen Bildschirmen öffnet der Menüknopf die Navigation.
- Verfügbare VA in der Detailansicht auswählen. Führende Nullen wie `030` bleiben erhalten. Ein Rezept wird nur bei passender VA angezeigt; fehlende Zusammensetzungen haben einen ausdrücklich sichtbaren Leerzustand.
- Zwischen Zusammensetzung, Eigenschaften und originalem Beschreibungstext wechseln. Unterbestandteile sind einzeln oder gesammelt aufklappbar.
- Katalogpositionen als Favoriten speichern, entfernen und die Favoriten als JSON exportieren. Sie werden zusätzlich im lokalen Browserspeicher gesichert. Erfasste Unterbaugruppen dienen der Ansicht; sie können in dieser Vorlage nicht separat übernommen werden.
- «Wissen griffbereit» steht im Header direkt links neben «Favoriten» und öffnet Abkürzungen und Schnell-Referenzen als Dialog.
- Die Lupe am Produktbild öffnet die Großansicht. Bei 112001 wird das Original-PNG aus den Steiger-Grunddaten angezeigt. Andere Beispielbilder bleiben ausdrücklich gekennzeichnete Platzhalter.
- E-Nr. und B-Nr./Bestellnummer stehen in den Positionsdetails sowie unter dem jeweiligen Bestandteil der Zusammensetzung. Eine Komplettposition übernimmt keine Produktkennungen eines enthaltenen Einzelartikels. Die Suche findet auch die hinterlegten E-/B-Kennungen.

## Datenumfang

Die Vorlage enthält einen **Auszug mit zehn Positionen**: vier Komplettpositionen, zwei erfasste Unterbaugruppen und vier Einzelpositionen aus den vorhandenen Steiger-Daten von 2026. Artikelnummern, verfügbare VA und dargestellte Komponenten stammen aus den gespeicherten Katalogdateien. Die Produktzeichnungen sind schematische Platzhalter; die einzige bisher übernommene Originalgrafik ist `112001` (siehe auch `web/images/QUELLEN.md`).

Die Zusammensetzungen zeigen die Quellmengen je direktem Elternteil. Negative Mengen bleiben Abzüge. Die Vorlage ergänzt weder fehlende Einheiten noch Preise. Gespeicherte Grunddaten können historische Preise aus der Quelle enthalten. Die Favoriten sind keine fertige Ausschreibung; BKP, Raum, Menge und Einheit fehlen dort bewusst noch.

## Aufbau für die Weiterentwicklung

1. **Design-Tokens** am Anfang des `<style>`-Blocks: Farben, Seitenleistenbreite, Headerhöhe.
2. **HTML-Komponenten**: Header, Katalogbaum, Detailansicht, Suchdialog und Merklistendialog.
3. **`catalogueData`**: eingebetteter JSON-Auszug mit stabilen Artikel-IDs, Nummern als Zeichenketten, VA als Zeichenketten und Rezepten je VA. IDs einer Baugruppenansicht sind zusätzlich mit `assembly:` gekennzeichnet.
4. **`state`**: gewählte Position, VA, Detailreiter, Suchfilter, offene Unterbestandteile und Favoriten.
5. **Renderfunktionen**: Baum, Artikelansicht, Zusammensetzung, Eigenschaften mit Grunddaten, Suchtreffer und Favoriten. Daten werden vor ihrer Ausgabe als HTML maskiert.
6. **Ereignisse**: gebündelt am Ende des Skripts. Dialoge verwenden native `<dialog>`-Elemente mit Fokusbegrenzung; die Detailreiter unterstützen Pfeiltasten sowie Home/End.

## Nächster Schritt mit Codex oder Claude Code

Die Vorlage kann als neue Oberfläche an die vorhandene Anwendung angebunden werden. Dafür den eingebetteten Auszug durch die vorhandenen Schnittstellen `/api/search`, `/api/article` und `/api/expand` ersetzen und die vorhandenen Datenformate auf das Ansichtsmodell abbilden. Die bisherige Mengenlogik in `core.py` beibehalten: Gesamtmengen werden entlang der gesamten Rezeptkette multipliziert; Eltern und Endbestandteile dürfen nicht gleichzeitig als Materialsumme gezählt werden.

Für eine Ausschreibung die bestehende Zuordnung von Artikel, VA, Rezept, BKP, Geschoss, Raum, Anlage, Verlegung und Einheit übernehmen. Favoriten allein genügen dafür noch nicht. Direkte IFC-, N4D-, N4M- oder Planimporte sind nicht Teil dieser Vorlage.

Der CDN-Einstieg folgt der [offiziellen Tailwind-Anleitung](https://tailwindcss.com/docs/installation/play-cdn). Für eine spätere Veröffentlichung Tailwind lokal bauen und die Komponenten bei Bedarf in getrennte Dateien auslagern.
