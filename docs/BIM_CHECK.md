# BIM-Check & Raum-Viewer

Das Werkzeug öffnest du im **Toolhub → BIM → BIM-Check & Raum-Viewer**. Es liest lokale Modelle und vergleicht ihre Daten mit dem Excel-Regelwerk des Projekts. Die mitgelieferten Beispielregeln lassen sich bearbeiten. Verbindliche FHNW- oder Auftraggebervorgaben müssen aus dem für das Projekt vereinbarten BIM-Guide stammen.

## Ein Modell prüfen

1. **Modell öffnen.** Ziehe eine IFC-Datei oder eine NOVA-Objektliste im XLSX-Format in die Importfläche.
2. **Raum ansehen.** Wähle ein Geschoss und klicke im Grundriss oder in der Liste auf einen Raum. Der Inspektor zeigt die Eigenschaften, PSets und zugeordneten Elemente. Auch ein Element lässt sich auswählen, um zu seinen Räumen zu wechseln.
3. **Regeln vorbereiten.** Lade die Excel-Vorlage herunter. Nach einem NOVA-Import enthält sie Regeln für die Tabellenspalten und Raumbezüge. Ohne Modell oder mit einem IFC-Modell erhältst du die IFC-Vorlage.
4. **Regelwerk öffnen.** Lade die bearbeitete XLSX-Datei über den Regelimport. Filtere die Befunde nach Status, Geschoss, PSet oder Attribut. Ein Klick auf die Elementbezeichnung öffnet den zugehörigen Inspektor mit Istwert und Vorgabe.
5. **Bericht herunterladen.** Die XLSX-Datei enthält die vollständige Prüfung, unabhängig von den sichtbaren Filtern, mit Modellname, Regeldatei, Einzelbefunden, Vorgaben und vorhandenen Hinweisen. Sichere den Bericht vor dem Schliessen. Die Originaldateien werden ausschliesslich gelesen.

## Geführte Prüfung

Oben im Werkzeug führt eine Leiste in vier Schritten durch die Prüfung: **Modell öffnen**, **Modell ansehen**, **Regeln laden**, **Befunde klären**. Der aktuelle Schritt zeigt einen kurzen Hinweis und die passenden Knöpfe. Erledigte Schritte erhalten einen Haken. Mit **Ausblenden** bleibt nur die Schrittleiste sichtbar. Diese Wahl merkt sich der Browser.

## Nova-Listen vergleichen

Ist eine Nova-Objektliste geöffnet, erscheint das Register **Listen vergleichen**. Es führt in vier Schritten durch den Vergleich: aktuellen Stand öffnen, älteren Stand wählen, Unterschiede ansehen, Bericht speichern.

- **Schlüssel:** Objekte werden über die Spalte «Index» verbunden. Sie ist in Nova-Listen für jedes Objekt gefüllt und eindeutig, anders als die GlobalID.
- **Arten:** «neu» steht nur im aktuellen Stand, «entfernt» nur im älteren, «geändert» hat mindestens eine andere Angabe.
- **Zuordnung prüfen:** Fehlt ein Index auf einer Seite, aber genau ein Objekt mit gleicher Klasse, gleichem Geschoss, Raum und gleicher Bezeichnung steht auf der anderen, schlägt das Werkzeug diese Zuordnung vor. Sie gilt nie automatisch, denn zwei gleiche Steckdosen im selben Raum sind schnell verwechselt.
- **Baustatus:** Änderungen nur am Baustatus sind standardmässig ausgeblendet. Ein Häkchen blendet sie ein.
- **Datenqualität:** Raumnummern mit mehreren Namen im aktuellen Stand erscheinen separat. Sie sind kein Unterschied zwischen den Ständen.
- **Bericht:** Die Excel-Datei enthält alle Unterschiede unabhängig von den Filtern, je Feld eine Zeile mit altem und neuem Wert.

Mit zwei Listen von je 28'207 Objekten dauert der Vergleich etwa 25 Sekunden, fast nur für das Einlesen der älteren Liste.

## IFC-Viewer (Probe)

Der **IFC-Viewer · Probe** zeigt das ganze IFC mit allen Bauteilen. Er läuft vollständig lokal mit [That Open Engine](https://github.com/ThatOpen/engine_components) (MIT) und web-ifc (MPL-2.0). Worker und WASM liegen in der Oberfläche, es wird nichts aus dem Internet geladen. Die Lizenztexte liegen unter `packaging/licenses/ifc-viewer`.

- **Gruppen:** Räume, Wände, Decken & Dächer, Türen & Fenster, Stützen & Träger, Treppen & Geländer und Installationen lassen sich einzeln ein- und ausblenden. Alles, was nicht zur Architektur gehört, zählt als Installation. Nova exportiert Elektro-Objekte je nach Einstellung als `IfcBuildingElementProxy` oder `IfcFlow…`.
- **Auswahl:** Ein Klick auf ein Bauteil oder einen Raum öffnet den Attribut-Inspektor. Die Zuordnung läuft über die GlobalId.
- **Farben:** «IFC-Farben» zeigt die Farben aus dem Modell, Räume leicht eingefärbt und durchsichtig. «Prüfstatus» färbt nach dem Regelimport jedes Objekt nach seinem schwersten Befund: Fehlt rot, Leer orange, Abweichend gelb, OK grün. Ungeprüfte Objekte bleiben grau.
- **Schnitt:** horizontaler Schnitt 1,2 m über dem tiefsten Punkt des gewählten Geschosses.
- **Messen:** zwei Punkte auf Bauteilen anklicken, der Abstand erscheint in Metern.
- **Isolieren:** zeigt nur das gewählte Objekt und die ihm zugeordneten Bauteile.

Die bisherige **3D**-Ansicht mit Raumkörpern bleibt als Rückfall erhalten.

## Räume in 3D ansehen

Öffne ein IFC und wähle in der Raumansicht **3D**. Mit **Alle Geschosse** siehst du das Gebäude im Zusammenhang. Für übereinanderliegende Räume lässt sich ein einzelnes Geschoss auswählen. Ein Klick auf einen Raum öffnet denselben Attribut-Inspektor wie im Grundriss, einschliesslich der Ergebnisse eines geladenen Regelwerks.

Ziehe mit der Maus, um das Modell zu drehen, und benutze das Mausrad zum Zoomen. Mit **Gewählten Raum einpassen** zoomst du auf den markierten Raum. Die Gebäudestruktur erscheint als dezenter Hintergrund. Du kannst ihre Sichtbarkeit einstellen oder sie ausblenden, um Innenräume leichter zu erkennen. Die 3D-Geometrie wird beim ersten Öffnen lokal aus der temporären IFC-Arbeitskopie gelesen und für die Dauer der Modellsitzung wiederverwendet.

Für ein Modell aus Trimble Nova oder der Architektur sollten **IfcSpace mit 3D-Körpern** und die gewünschten Architekturbauteile gemeinsam exportiert werden. Der Viewer übernimmt unter anderem Wände, Geschossdecken, Stützen, Träger, Dächer und Treppen. Ein IFC mit ausschliesslich Raumkörpern zeigt die Räume alleine. Räume mit einer reinen 2D-Kontur bleiben im Grundriss und in der Liste. NOVA-Excel liefert tabellarische Raumbezüge. Die 3D-Anzeige benötigt WebGL 2. Bei aufwendigen Modellen weist das Werkzeug auf ausgelassene Geometrie hin.

## Was die Quellen belegen

**IFC.** Der Viewer zählt `IfcSpace` und folgt Geschossstrukturen, expliziten räumlichen Referenzen und Raumbegrenzungen. Dadurch kann z. B. eine Wand mit mehreren Räumen verknüpft sein. Ein Bezug im Inspektor bezeichnet die Modellbeziehung. Raumnummer und Bezeichnung stammen bei IFC aus `Name` und `LongName`. Fehlende oder mehrdeutige Geschosse sind separat sichtbar. Der 2D-Plan zeigt die projizierte Raumgeometrie in gemeinsamen Modellkoordinaten, einschliesslich Innenringen. Räume ohne verwertbare Kontur bleiben in der Liste. Bei fehlender oder ungültiger Längeneinheit erscheint ein Hinweis und es wird kein Grundriss mit ungesichertem Massstab gezeichnet. Die Flächen und Volumen stammen aus ausgewiesenen Modellwerten, bevorzugt netto, und werden bei bekannter Einheit in m² und m³ angezeigt. PSet-Werte im Inspektor und im Regelvergleich verwenden die Einheiten des Quellmodells.

**NOVA-Excel.** Der Adapter erkennt die Objektliste anhand ihrer Kopfzeile. Er gruppiert die Angaben der Bauteile nach Gebäude, Geschoss und Raumnummer. Diese Raumbezüge sind auch ohne Projekt-IFC durchsuchbar. Für ihren Grundriss, ihre Fläche und ihr Volumen wird eine zusätzliche geometrische Quelle benötigt. Konflikte bei Raumbezeichnungen und Objekte ohne Raumzuordnung werden ausgewiesen.

Die zwei mitgegebenen 1138-Arbeitsmappen enthalten auf `Tabelle1` je 28’207 Bauteile. Daraus ergeben sich je 777 unterschiedliche Raumbezüge über neun Geschosse. Bei 15 Raumbezügen gibt es unterschiedliche Bezeichnungen. In der Abgleichmappe werden die zusätzlichen Blätter, darunter `Nova-Import`, als Änderungsvorschläge vom gelesenen Objektbestand getrennt gehalten. Öffne jede dieser Mappen im **Modellimport**. Für geometrische Raumkonturen aus Nova verwende einen IFC-Export mit Räumen. Die mitgegebenen Windows-Hilfspakete werden für die Bedienung des Toolhubs nicht benötigt.

## Eigene Excel-Regeln

Schreibe je Regel eine Zeile. Die Kopfzeile darf in den ersten 30 Zeilen eines sichtbaren Blatts stehen. Deutsche und englische Überschriften sind möglich. Benötigt werden eine Attributspalte und mindestens eine Bedingung, z. B. Pflichtfeld oder Datentyp. Verwende feste Zellwerte.

| Spalte | Eingabe oder Beispiel |
| --- | --- |
| Regel-ID | Eindeutige Bezeichnung für den Bericht. Ohne ID wird die Zeile im Blatt verwendet. |
| IFC-Klasse | `IfcSpace`, eine Oberklasse wie `IfcElement`, mehrere Klassen mit Semikolon oder `*` für alle. Für NOVA z. B. `NovaBauteil`, der genaue Klassenname aus dem Inspektor oder `NovaRaumbezug`. |
| PSet | Z. B. `Pset_SpaceCommon` oder `Firma_Raum`. Für direkte Attribute wie IFC-`Name` und NOVA-Spalten leer lassen. |
| Attribut | Name des Feldes in der Quelle. Schreibweise aus dem Inspektor übernehmen. |
| Pflichtfeld | `Ja` oder `Nein`. Ohne Angabe gilt `Ja`. |
| Datentyp | `Text`, `Zahl`, `Ganzzahl`, `Boolean` oder `Datum`. Geprüft wird der Werttyp. |
| Sollwert / Erlaubte Werte | Ein genauer Wert oder mehrere Alternativen, z. B. `Büro;Lager;Technik`. |
| Muster | Optionaler regulärer Ausdruck für den gesamten Feldwert, z. B. `[A-Z]{2}-[0-9]{3}`. |

**Status lesen.** «Fehlt» bedeutet, dass PSet oder Feld fehlen. «Leer» bezeichnet ein vorhandenes, unbefülltes Pflichtfeld. «Abweichend» nennt die verletzte Vorgabe. Ein optionales, unbefülltes Feld erhält den Status «Optional». Ein optionales Feld mit Wert wird geprüft. Die Trefferquote ist der Anteil «OK» an allen Prüfungen mit bewertbarem Status, einschliesslich verletzter Pflichtfelder. Hat eine Regel keine Zielobjekte, erscheint ein Hinweis. Eine leere Zielmenge ergibt keine Erfolgsquote.

## Aufbau und Grenzen

Die React-Oberfläche liegt unter `ui/src/tools/bim-check/`. Sie verwendet Werkzeugkatalog, Navigation, Sitzung und Download-Helfer des Toolhubs. Die lokalen FastAPI-Routen unter `/api/bim-check` verwenden die bestehende Sitzungssicherung. Der vorhandene BIM2STEIGER-Import bildet Katalogzuordnungen ab. Der IFC- und NOVA-Adapter für den Raum-Viewer liefern ein gemeinsames Objektmodell mit Raumbezügen für den Inspektor und die Prüfungen.

Unter `backend/edeco_toolbox/bim_check/` lesen `ifc.py`, `geometry.py` und `nova.py` die Quellen. `scene.py` trianguliert IFC-Räume und Architekturbauteile für die lokale 3D-Ansicht mit Three.js. `guide.py`, `checks.py` und `workbook.py` übernehmen Regelimport, Prüfung und Excel-Ausgabe. Ein lokaler Unterprozess verarbeitet pro Import eine Arbeitskopie. Modellattribute liegen temporär in SQLite und werden beim Auswählen nachgeladen. Ein fehlerhafter Folgeimport lässt den zuvor geöffneten Stand weiter nutzbar.

Je Import gelten bis zu 256 MiB für IFC, 64 MiB für XLSX (entpackt 256 MiB), bis zu 100’000 IFC-Produkte, 64 MiB für die interaktive Ausgabe und fünf Minuten Verarbeitungszeit. Eine Prüfung umfasst bis zu 1’000 Regeln und 100’000 passende Objekt-Regel-Paare. Bei grossen Modellen Klassen eingrenzen oder einen Geschoss- bzw. Teilmodell-Export verwenden.
