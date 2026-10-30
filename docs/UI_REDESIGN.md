# Oberfläche im edeco-Design

Die Programmoberfläche verwendet Petrol aus dem gelieferten RGB-Logo (`#017C92`) als primären Akzent. Neutrale Flächen, einheitliche Abstände, klare Überschriften und sparsame Statusfarben halten den Fokus auf Projekten und Symbolen. Das originale SVG-Logo liegt unverändert in `ui/src/assets/edeco-logo.svg` und wird von Vite mit dem Programm ausgeliefert.

## Legende und Programmoberfläche

Das Designsystem betrifft Navigation, Formulare, Tabellen, Dialoge und die Bedienelemente des Editors. Die eigentliche Legende bleibt ein weisses Blatt mit den gespeicherten Symbol-, Linien-, Text- und Kategorienfarben. Hell-/Dunkelmodus, Zoom und das sichtbare Hilfsraster verändern den Export nicht. Vorschau-Renderer, Katalogdaten und DXF-Ausgabe wurden nicht angepasst.

## Orientierung und Abläufe

### Kompakte Ansicht und Fehlerkorrekturen (29.10.2026)

- Projektzahlen stehen als kurze Zeile unter der Überschrift. Der Datenstatus in der Kopfleiste fasst Bibliothek, Firmenordner und Nova-Voreinstellung zusammen; fehlende Datensätze und Probleme mit dem Firmenordner bleiben am Auslöser sichtbar.
- Der Projektkopf ist kompakter. ZIP-Export, Fehleranalyse und weitere Projektaktionen liegen im Menü **Projektaktionen**. **Gesamtliste**, **Legende** und **Prüfung** bleiben direkt sichtbar; Importvergleiche, unbekannte Elemente, Ebenen und nicht berücksichtigte Elemente stehen unter **Weitere Bereiche**. Der aktuell gewählte zusätzliche Bereich erscheint am Menüauslöser.
- Beim Öffnen der Legende ist die Planübersicht eingeklappt. Sie lässt sich im Editor wieder öffnen, ohne den gemerkten Zustand der übrigen Projektansicht zu verändern. Die Werkzeugleiste zeigt Verlauf, Einfügen, Zoom und DXF-Export; Raster, Spalten und Fensteroptionen liegen unter **Ansicht**. Im vergrösserten Fenster bleibt **Fenster schliessen** direkt erreichbar. Menüs werden über der Arbeitsfläche angezeigt und an den Fensterrändern ausgerichtet.
- Ungespeicherte Kategorieänderungen werden beim Arbeitsbereichs- und Kategoriewechsel mit **Speichern**, **Verwerfen** oder **Abbrechen** geschützt. Bei ungültigen Eingaben oder Speicherfehlern bleiben Dialog und Entwurf erhalten. Beim Schliessen der Anwendung wird vor ungespeicherten Kategorien gewarnt.
- Bibliothekssuchen brechen ältere Anfragen ab und übernehmen deren spätere Ergebnisse oder Fehlermeldungen nicht mehr. Neue Projekte verwenden die unter Einstellungen gewählte Nova-Version; eine manuelle Auswahl im Dialog bleibt möglich.
- Pillow ist als allgemeine Backendabhängigkeit deklariert, da die DXF-SVG-Vorschau es auch ausserhalb des Windows-Pakets benötigt.

Browserregressionen prüfen die drei Fehler einschliesslich Abbruch, Verwerfen, Speicherfehlern und erneutem Versuch, die nutzbare Editorfläche sowie Ansichtseinstellungen und einen echten DXF-Download. Die vorhandenen Tests für Speichern und Projektwechsel bleiben erhalten.

Validierter Stand dieser Überarbeitung: 23 Frontendtests, TypeScript-/Vite-Build und 184 Backendtests einschliesslich 19 Browserfällen bestanden. 13 weitere Tests benötigen hier nicht vorhandene Original-/Beispieldateien und wurden übersprungen. Zusätzlich wurden die Ansicht bei 320, 390, 768, 1440 und 1560 Pixeln, Hell-/Dunkelmodus und die Erreichbarkeit der zusätzlichen Bereiche geprüft. Windows-Installer und ODA-DWG-Konvertierung waren nicht Teil dieser Prüfung.

| Bereich | Anpassung | Erreichbarkeit |
|---|---|---|
| Hauptnavigation | Feste Navigation mit Logo und vier Arbeitsbereichen | Projekte, Bibliothek, Kategorien und Einstellungen bleiben jederzeit erreichbar; auf kleinen Fenstern als kompakte Leiste |
| Projektübersicht | Übersichtszahlen, Suche nach Name/Nummer, Sortierung | Bestehende Projekte öffnen, neue Legende erstellen und Projekte archivieren bleiben direkt erreichbar |
| Projektkopf | Titel, Projektwechsel und relevante Mengen stehen im Vordergrund | Nummer, Bezeichnung und Nova-Version stehen unter **Projektdetails bearbeiten**, einschliesslich Speichern und Änderungsanzeige |
| Projektaktionen | Weniger gleichzeitige Buttons im Projektkopf | Duplizieren, ZIP-Export, Vorlagenfreigabe und Archivieren liegen im Menü **Projektaktionen** |
| Legendeneditor | Ruhige Arbeitsfläche, Abschnittsliste und Eigenschaften | Text, Linie, Hinweis und Abschnitt stehen unter **Einfügen**; Undo/Redo, Raster, Spalten und Zoom bleiben in der Werkzeugleiste |
| Symbolbibliothek | Suche, klar beschriftete Filter, einheitliche Symbolkarten | Alle Montagearten, Datensätze, Varianten und Symbolgrössen bleiben verfügbar; bei schmalen Fenstern ersetzt eine Kategorieauswahl die Seitenliste |
| Importvorschau | Klare Schritte, zusammengehörige Kennzahlen und feste Abschlussaktionen | Dateiauswahl, Geschossnamen, Änderungsfilter, Warnungsbestätigung und Übernahme behalten ihre bisherigen Abläufe |
| Prüfung | Der neue Prüfungsreiter verwendet dieselben Abstände, Flächen und Radien | Offene Punkte, erledigte Prüfungen, erneute Prüfung und Sprünge zum passenden Reiter bleiben erreichbar; auf schmalen Fenstern stehen die Aktionen unter dem Inhalt |

**DXF herunterladen** ist im Editor direkt erreichbar, auch wenn gerade ein Symbol oder Titel ausgewählt ist. Es verwendet die bestehenden Exportoptionen und speichert wie bisher zuerst die Legende. DWG, Abschnittsauswahl und Allgemeinteil bleiben im Eigenschaftenbereich verfügbar. Die zusätzliche Aktion **An Breite anpassen** verändert nur den Zoom der Ansicht. Projektordner und Herkunftsinformationen bleiben in den aufklappbaren Detailbereichen verfügbar.

## Bedienbarkeit

- Symbolkarten lassen sich mit Tab erreichen und mit Enter oder Leertaste öffnen.
- Im Projekt- und Importdialog bleibt der Tastaturfokus im Dialog. Escape schliesst einen nicht laufenden Vorgang und gibt den Fokus zurück.
- Menüs öffnen bei wenig Platz unterhalb des Buttons nach oben und bleiben innerhalb des Fensters. Escape führt zum Menüauslöser zurück.
- Steuerelemente behalten sichtbare Fokusmarkierungen. Statusmeldungen werden für assistive Technologien angekündigt.
- Der Systemmodus und die manuelle Wahl von Hell/Dunkel bleiben erhalten. Reduzierte Bewegung wird berücksichtigt.
- Tabellen scrollen bei Bedarf innerhalb ihres Bereichs; die gesamte Seite soll nicht seitlich ausweichen.

## Anpassbare Gestaltung

`ui/src/theme.css` enthält die zentralen Variablen für Marke, Akzent, Oberflächen, Text, Linien, Statusfarben, Abstände, Typografie, Radien und Schatten. Die expliziten und systemabhängigen Dunkelmodus-Werte liegen ebenfalls dort. `ui/src/styles.css` enthält die Komponentenlayouts und Anpassungen an die verfügbare Arbeitsfläche.

Die vorhandenen Symbolvariablen `--sym-layer` und `--sym-bg` dienen weiterhin den Bibliotheksvorschauen. Die fachlichen Farben der Legende stehen in den Legendendaten; sie werden nicht von `--accent` oder `--brand` abgeleitet.

## Prüfung

Validierung umfasst den TypeScript-/Vite-Build, die bestehenden Frontendtests und Browser-Regressionstests zum Speichern und Wechseln von Projekten/Reitern. Der Duplizier-Test öffnet nun das Menü **Projektaktionen**, bevor er den bestehenden Ablauf ausführt.

Zusätzlich wurde die echte Oberfläche gegen eine isolierte API mit Kopien der bereitgestellten N4M-/N4D-Projekte geprüft: Suche und Sortierung, Projektdetails speichern, ZIP-Export, Importvorschau abbrechen, Tastaturbedienung, Zoom/Raster, Kategorien und Einstellungen sowie Fensterbreiten von 320 bis 1560 Pixeln. Die beiden DXF-Exporte wurden mit den Ausgaben vor dem Redesign verglichen, einschliesslich Modell- und Blockgeometrie und deren Farben. Die Originalzeichnungen werden bei diesen Prüfungen nicht verändert.

Windows-Installation und der native DWG-Konverter wurden durch dieses Redesign nicht verändert und nicht erneut ausgeführt.

Prüfergebnis des mit den aktuellen Import- und Prüfungsverbesserungen zusammengeführten Standes: TypeScript/Vite-Build, 23 Frontendtests und 181 Backendtests einschliesslich der 10 Browser-Regressionen zum Speichern und Navigieren bestanden. Zunächst fehlende lokale Beispieldateien wurden für die Parser-/Katalogprüfungen über die bereitgestellten Originale eingebunden; drei weitere Tests bleiben wegen fehlender Vergleichsdateien übersprungen. Kundendateien werden nicht mit versioniert.

Die zusätzlichen Prüfungen mit beiden echten Zeichnungsformaten meldeten keine JavaScript-Seitenfehler. Projektübersicht, Projektdetails, Bibliothek, Legendeneditor und Importdialog wurden bis 320 Pixel Breite ohne seitlichen Seitenüberlauf geprüft; Tabellen und die Legendenfläche behalten ihre eigenen Scrollbereiche. Der neue Prüfungsreiter wurde nach der Zusammenführung mit N4M und N4D bei 320, 390, 768 und 1560 Pixeln geprüft, einschliesslich Einträgen, erneutem Prüfen und Sprüngen zum passenden Arbeitsbereich.

Vor der Zusammenführung stimmten Modell- und Blockgeometrie samt Farben der beiden DXF-Dateien mit den Ausgaben vor dem Redesign überein. Die zusätzlich übernommenen Backendkorrekturen erweitern bewusst die Symbolerkennung und Zeichnungsdarstellung. Für den gemeinsamen Stand wurden deshalb die über die neue Oberfläche heruntergeladenen DXF-Dateien mit direkten Exporten derselben Backendversion verglichen: Modell- und Blockgeometrie samt Farben sind identisch, und die gespeicherten Legendendokumente bleiben unverändert. Auch im Dunkelmodus bleibt das Legendenblatt weiss.
