# BIM2STEIGER Beta 0.3 – UI-Vorschlag

21.10.2026. Umsetzung als eigenständige Datei `web/bim2steiger-beta.html` mit eingebetteten Stilen und Bildern. Per Doppelklick auf `Start_BIM2STEIGER_Beta.cmd` lässt sich die Vorschau ohne Server öffnen. Für tatsächliche Dateiimporte wird weiterhin die bestehende lokale API benötigt. Die Downloadskizze `bim-2-steiger-dashboard-design` dient als Gestaltungsreferenz. Grundlage bleibt die vorhandene interaktive Beta mit drei Komplettpositionen und zwölf Bauteilvarianten.

## Hierarchie und Dichte

**«ARTIKEL» entfällt.** Oberhalb des Positionsnamens steht nur die formatierte Nummer, beispielsweise **112 001**, mit einem Kopierknopf. Kopiert wird die unveränderte Kennung `112001`. Der Positionsname bleibt mit 29 px die stärkste Information; die Nummer folgt mit 18 px. Die VA steht rechts als klar beschriftete Auswahl «Verlegungsart (VA)».

Die Einführung «Vom Baustein zum Ganzen.» bleibt erhalten, wird aber auf 21 px verkleinert. Der zusätzliche Slogan entfällt. Ein schmaler beiger Streifen zeigt «Interner Entwurf · Ausgewählte Katalogdaten» und «Beta 0.3». So bleibt der kleine Katalogauszug klar vom vollständigen Katalog getrennt.

Die grosse Fläche dient der Position und ihrer Zusammensetzung. Statt vieler dreizeiliger Tabellenzellen stehen Name, Artikelnummer, E-Nr., B-Nr., VA und Menge in eigenen Spalten. Zeilen sind kompakt, auf einen Blick vergleichbar und anklickbar. Auf schmalen Bildschirmen scrollt die Tabelle innerhalb ihres Rahmens horizontal; die übrige Seite bleibt in der Bildschirmbreite.

## Vier Arbeitsbereiche

| Bereich | Konkrete Gestaltung |
| --- | --- |
| Katalog | Brotkrumen, kleine Einführung, Entwurfsstreifen und eine klare Positionskarte. Originalzeichnung links auf feinem Punktraster, daneben «Originalzeichnung» und «Produktfoto ansehen». Bei fehlenden Quellen steht «Schematisches Symbol» beziehungsweise «Kein Produktfoto erfasst.». Fotos enthalten gegebenenfalls den Hinweis auf den abgebildeten Bestandteil. Darunter Favoritenaktion und Artikeltext, anschliessend die drei vertrauten Reiter. |
| Favoriten | Eigene Seite mit dem Hinweis «Auf diesem Gerät gespeichert». Filterchips und Gruppen verwenden die Original-Katalogpfade. Name, Artikel, VA und Produktkennungen erhalten eine klar abgestufte Schrift. Jede Artikel-/VA-Kombination bleibt separat; Entfernen über das Kreuz. |
| Dateiimport | Drei nummerierte Schritte. Nur Dateiimport ist verfügbar; Zuordnung/Prüfung und Messerli-Export stehen sichtbar auf «Noch offen». CSV/JSON und Nova/IFC sind klar getrennt. Nach dem Import: Dateiname, Zeitpunkt, drei Kennzahlen, höchstens zehn Vorschauzeilen und das Badge «Ungeprüft». JSON-Sicherung und Verwerfen stehen direkt bei diesen Objekten. |
| Export | Drei Prüfpunkte und der deaktivierte Messerli-Knopf zeigen den tatsächlichen Stand. «Bestehende Ausschreibung öffnen» führt zur vorhandenen Ansicht für BKP, Raum und Mengen. Der Text erklärt ausdrücklich, dass Beta-Importobjekte noch nicht automatisch übergeben werden. |

Der Weg von der Position zur Ausschreibung beginnt unterhalb der Artikeldetails mit «Ausschreibung & Exportstatus». Vom Import führt «Exportstatus ansehen» zur selben Statusseite. Beide Wege zeigen die bestehende Ausschreibungsansicht und die noch offene Verbindung, ohne eine fertige Übergabe vorzutäuschen.

## Seitenleiste und Bedienung

Die dunkelblaue Seitenleiste bleibt 234 px breit und über die Fensterhöhe sichtbar. Arbeitsbereich, Katalog/Favoriten, Ausschreibung und Katalogstruktur sind durch Abstand und kurze Gruppenbezeichnungen gegliedert. Gewählte Navigation und gewählter Artikel sind klar blau hinterlegt. Die Zähler zeigen den tatsächlichen Beta-Auszug.

Für den späteren vollständigen Katalog bleibt derselbe aufklappbare Baum das Navigationsmuster; die kleine Beta erhält keine vorgetäuschten zusätzlichen Artikel. Die Suche bleibt der direkte Weg über Name und Kennungen. Wissen ist geschlossen, bis es angefordert oder angepinnt wird. Mobile Navigation, Tastatursuche, Reiter und sichtbarer Fokus bleiben erhalten; neu gibt es einen Sprunglink «Zum Inhalt».

## Websuche mit E-Nr. oder B-Nr.

Direkt neben den vorhandenen E- und B-Nummern im Positionskopf steht jeweils ein dezenter Globus. Er öffnet eine Google-Suche im neuen Tab. Gesucht wird die unveränderte Kennung in Anführungszeichen; bei B-Nummern ergänzt der Positionsname den Suchkontext, damit kurze Bestellnummern weniger beliebige Treffer liefern. Fehlende Nummern bleiben als «—» stehen und erhalten keinen Suchknopf. Komplettpositionen übernehmen hierfür keine Nummern ihrer Bestandteile. Die Aktionen sind beschriftet und per Tastatur erreichbar.

Die interne Suche bleibt davon unabhängig: Sie findet Name, Artikelnummer, E-Nr. und B-Nr. auch bei Kennungen mit Leerzeichen oder Punkten. Suchfeld und Platzhalter nennen diese Suchmöglichkeiten ausdrücklich. Beide Suchen beziehen sich auf die Kennung der jeweiligen Position und bewirken keine automatische Produktzuordnung.

## Hilfstexte, Farbe und Schrift

Wichtige Angaben sind keine hellgrauen Fussnoten: Kennungen, VA und Mengen stehen im normalen Textkontrast. Notwendige Statushinweise bleiben direkt sichtbar. Längere Erklärungen zur Zusammensetzung und zu fehlenden Importmengen stehen in aufklappbaren Hinweisen. Begriffe gehören in «Wissen griffbereit»; die Stammdaten enthalten die Herkunft. Wiederholte Werbesätze entfallen.

| Verwendung | Tag | Nacht |
| --- | --- | --- |
| Fläche | `#f5f7fa` | `#101b2c` |
| Karten | `#ffffff` | `#18273b` |
| Navigation | `#142238` | `#101d31` |
| Aktion / Link | `#315ce7` | `#a0b8ff`; Hauptknöpfe kräftig blau |
| Haupttext | `#25344b` | `#e5edf8` |
| Sekundärtext | `#596b82` | `#afbed2` |
| Linie | `#e5eaf1` | `#304259` |

Segoe UI als lokal vorhandene Windows-Schrift; Inter als Alternative. Grundschrift 13 px, Daten 12–14 px, Hilfstext grundsätzlich 11–12 px. 10 px bleibt für knappe Metadaten wie Versionsangabe und Tabellenköpfe. Kennungen und Mengen verwenden Monospace mit gleich breiten Ziffern. Karten haben 6–9 px Radius, feine Linien und keinen dekorativen Schatten. Originalbilder behalten ihre Farben und werden nicht über ihre Pixelgrösse hinaus vergrössert.

## Prüfung

24 vorhandene Tests bestanden. JavaScript-Syntax geprüft; eingebetteter Datensatz samt Bildern gegenüber dem vorherigen Arbeitsstand unverändert. Die erzeugten Ansichten aller 15 Artikel-/VA-Varianten und aller 20 Rezeptzeilen wurden zusätzlich ohne Browser gegen die Quelldaten geprüft: exakte Mengen, negativer Abzug, getrennte VA 030/30, keine automatisch eingeblendeten Fotos und höchstens zehn Importvorschauzeilen. Auch Nullmenge, fehlende Einheit und der Status «Ungeprüft» wurden geprüft. Mengen erscheinen ohne die bisherige Rundung auf vier Nachkommastellen.

Die visuelle und funktionale Browserprüfung wurde am 21.10.2026 über den lokalen Server auf Port 8766 nachgeholt. Port 8765 war bereits mit einem anderen Stand belegt. Katalog, Favoriten, Import und Export wurden bei 320, 390, 768, 1024 und 1440 Pixeln geprüft; dies sind simulierte Bildschirmbreiten im integrierten Browser, keine Tests auf physischen Mobilgeräten. Die Ansichten bleiben ohne seitlichen Seitenüberlauf; die Zusammensetzung scrollt innerhalb ihres Rahmens. Dabei wurden der Überlauf durch unsichtbare Tabellenüberschriften, die zu breite Kopfzeile bei 320 Pixeln und die Tab-Erreichbarkeit der geschlossenen mobilen Navigation korrigiert. Escape schliesst die Navigation und gibt den Fokus an den Menüknopf zurück.

Geprüft wurden Namen- und Kennungssuche, E-Nummern mit Leerzeichen/Punkten, B-Nummern mit und ohne Trennzeichen, Such-Leerzustand, Ctrl K, Pfeiltasten, Enter und Escape, VA-Wechsel, Bauteil- und Rückverweise, Favoritenkategorien und Speicherung, Reiter per Tastatur, Tag-/Nachtmodus sowie Wissen öffnen/anpinnen/lösen. Originalbilder von 112001 und 2730 erscheinen im Dialog ohne Hochskalierung; das Produktfoto eines Bestandteils nennt dessen Herkunft. Die Komplettpositionen behalten ihre fehlenden eigenen Produktkennungen; 112002 / VA 00 zeigt weiterhin den Einlasskasten-Abzug −1.

CSV- und JSON-Testdateien wurden über die Beta importiert und die JSON-Sicherung tatsächlich heruntergeladen und gelesen. Nullmenge, fehlende Einheit sowie die getrennten VA «00», «030» und «30» blieben erhalten. Eine Datei mit fehlender Menge zeigt den Fehler, ohne den vorherigen gültigen Import zu ersetzen. Testimporte und Testfavoriten wurden danach entfernt. Nova/IFC, automatische Zuordnung und Messerli-Austauschformat bleiben offen; der Messerli-Knopf bleibt deaktiviert. Alle 24 vorhandenen Tests bestehen. Die eingebetteten Beispieldaten samt Originalbildern sind gegenüber dem vorgefundenen Arbeitsstand unverändert.

Bildnachweise der Prüfung: `Beta_0.3_Websuche_Desktop.png` und `Beta_0.3_Websuche_Mobil.png` im selben Dokumentationsordner.
