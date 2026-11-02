# Visueller Prüfstand: reaktive Schemas und Diagramme

Stand: 2. November 2026. Geprüft wurde die vorhandene Implementierung auf Basis
von `main` (`8b2128aa`) mit den laufenden UI-Änderungen. Die Referenzansichten
liegen unter `/workspace/artifacts/elektro-rundgang`; eigene geprüfte Zustände
unter `/workspace/artifacts/visual-audit`. Diese Prüfung betrifft Darstellung
und Interaktion, nicht eine Freigabe nach NIN oder SN 414022.

## Korrigierte Darstellungsfehler

| Bereich | Befund | Korrektur |
| --- | --- | --- |
| Kabelschema bei ungültiger Eingabe | Ohne gültiges Ergebnis wurden zuvor 230 V und 3~ als Ersatzwerte gezeigt. Die animierte Leitung vermittelte weiterhin eine gültige Berechnung. | Spannung und Netzart zeigen jetzt Gedankenstriche; der animierte Stromweg und die Kurve verschwinden. Die zugängliche Bildbeschreibung benennt den ungültigen Zustand. |
| Blitzschutz-Gebäude | Leitungsweg A veränderte die gezeichnete Gebäudehöhe. A ist jedoch nicht automatisch die Gebäudehöhe. | Feste, ausdrücklich schematische Gebäudegeometrie. A wird als Leitungsweg mit dem tatsächlichen Wert beschriftet. Änderungen an A verändern das Rechenergebnis und den Abstandsvergleich, nicht eine erfundene Gebäudehöhe. |
| Blitzschutz-Abstandsvergleich | Der vorhandene Abstand wurde ab einem festen Pixelwert still abgeschnitten. | Erforderlicher und vorhandener Abstand verwenden nun eine gemeinsame adaptive Skala. Tatsächliche s-/d-Werte bleiben sichtbar. Die Skala wird beim Ziehen für die gesamte Bewegung festgehalten, damit sie den Eingabewert nicht rückkoppelt. |
| EV-DC-Punkte | Der DC-Punkt trug im sekundären Text eine 3~-Kennzeichnung. | Am Fahrzeug steht DC. Die vorgelagerte Stromanzeige und Verteilung nennen den AC-Ersatzansatz ausdrücklich. |
| EV-Statusfarben | „Budget eingehalten“ verwendete dieselbe Cyan-Familie wie allgemeine Daten. | Eingehaltene Leistungsbudgets sind grün; begrenzte Zuteilung gelb, Überschreitung rot und fehlende Daten neutral. Die bestehenden lesbaren Statusaussagen bleiben erhalten. |
| Lange Beschriftungen | Lange ungetrennte Namen sowie mehrzeilige Kaskadenbeschriftungen konnten in Symbole bzw. Folgewerte hineinlaufen. | Harte Wortumbrüche bei langen Zeichenfolgen und nach Textumfang berechnete Abstände der technischen Symbole und Kaskaden. |

## Kompakte Erläuterungen

Technische Bildunterschriften, Raumplan-/Kosten-/Zielvergleichserklärungen und
die ausführliche EV-Schemaerklärung stehen hinter nativen aufklappbaren
Bereichen. Aktive/wartende Punkte, Fehlerstatus, Werte und die Kennzeichnung
einer reduzierten Stichprobe bleiben sichtbar. Mehrteilige technische Schemas
behalten ihre lokale horizontale Verschiebung: eine Verkleinerung aller
Beschriftungen auf einem schmalen Ausgabepanel würde die Lesbarkeit verschlechtern.
Der Kopf des Schemas weist mit ↔ auf die Verschiebbarkeit hin.

## Tatsächlich ausgeführte Browserprüfungen

Playwright/Chromium, eigener lokaler Vite-Server, 1440–1600 px Breite und heller
Rechnermodus. Die Projekt-API wurde für diese UI-Prüfungen mit leeren
Testprojekten beantwortet; es wurden keine echten Projekte verändert.

- Leerer Kabel-Laststrom entfernt Kurve, Aktivitätslinie und Ersatzspannung;
  keine falsche 230-V-Anzeige im ungültigen SVG.
- Geänderter Leitungsweg A aktualisiert die zugänglichen Zahlenwerte, während
  das Dachobjekt seine vertikale Lage behält. Ein vorhandener Abstand von
  100 m wird ohne stillen Pixel-Deckel dargestellt. Ungültiges A entfernt die
  Abstandszone vollständig.
- Bei 125-A-Hausanschluss, 63-A-Grid, vier einphasigen 7.4-kW-Punkten und
  20 kW Gebäudereserve erscheint der überschrittene Grid-Aussenleiter rot,
  während der eingehaltene Hausabschnitt grün bleibt.
- Ein DC-Preset zeigt DC am Punkt und „AC-Ersatz 3~“ bei der vorgelagerten
  Stromanzeige. Die ausführliche Schemaerklärung startet geschlossen.
- Die 15 jährlichen Kostensäulen reagieren weiterhin auf Tastaturfokus;
  der zweite Balken zeigt im Ablesefeld 2027. Die Erklärung startet geschlossen.
- Der rechteckige Brandmelder-Raumplan ändert sein Seitenverhältnis korrekt
  beim Wechsel der Länge von 10 auf 12 m. Eine anschließend geleerte Länge
  entfernt den bisherigen Raumplan vollständig.
- Keine JavaScript-Seitenfehler in diesen Prüfläufen. `npm run typecheck`
  erfolgreich; die fünf vorhandenen EV-Schemastatus-Tests erfolgreich.

## Verbleibende Aussagegrenzen

Gebäude, Leitungsquerschnitt, Schutzorgane und Fahrzeuge bleiben Symbole; sie
stellen weder einen maßstäblichen Gebäudeplan noch reale Erfassungs- oder
Lichtverteilungen dar. Der Leitungsverlauf ist ein lineares Abschnittsmodell.
Sehr dichte Raumraster und große Ladegrids zeigen ausdrücklich gekennzeichnete
Stichproben. Diese gezielten Interaktionsprüfungen belegen nicht sämtliche
möglichen Zustände aller 26 Rechenmodelle und ersetzen die getrennten
numerischen Quellen- und Normenprüfungen nicht.

## Weiche Aktualisierung bei geänderten Werten

Ergänzt: ein gemeinsamer `requestAnimationFrame`-Hook interpoliert ausschliesslich
numerische Zeichnungsgeometrie über 260 ms mit einem auslaufenden Verlauf.
Leitungskurve, Budgetlinie, symbolischer Leiterquerschnitt, Abstandszone und
Dachobjekt, Kosten-/Zielbalken, Raumabmessungen sowie SIA-Stapel und Zielmarken
verwenden diese Aktualisierung. Ein neuer Wert während einer laufenden Bewegung
startet beim gerade sichtbaren Zwischenstand und ersetzt das alte Ziel.
Rechenwerte, Fehlermeldungen und Schutzstatus wechseln unmittelbar zum aktuellen
Rechenstand. Ungültige Eingaben entfernen die Ergebnisgeometrie sofort. Beim
direkten Ziehen des Dachobjekts folgt dessen Position ohne Verzögerung dem Zeiger.

Die Betriebssystem-/Browserpräferenz `prefers-reduced-motion: reduce` überspringt
die Zwischenbilder. Die einfachen HTML-Balken in `ResultView` verwenden echte
CSS-Breitentransitionen; bei reduzierter Bewegung entfallen auch diese.

Zusätzliche Prüfung: `backend/tests/test_visual_animation_ui.py` bestanden
(1 realer Chromium-Test). Er vergleicht einen tatsächlichen Kabelkurven-Endpunkt
vor der Änderung, nach 70 ms und nach Ablauf der Bewegung; prüft ein schnelles
8→48-A-Neuausrichten sowie sofortiges Entfernen bei leerer Eingabe und direkte
Zielgeometrie bei reduzierter Bewegung. Für die SIA-Balken wurde zusätzlich
650→558.62→487.5 px bei 65/300 ms beobachtet; schnelle Folgewerten und der
reduzierte Bewegungsmodus wurden geprüft. Der Produktionsbuild ist erfolgreich.

Ein kurzer eigener UI-Rundgang zur Skalierung liegt als
`/workspace/artifacts/visual-audit/edeco-skalierung.mp4` vor. Er zeigt lokale
Beispieldaten, keine Anmeldung oder Zugangsdaten.

## Berechneter Leistungsfluss auf aktiven Leitungen

EV-, gemischte Ladegrid-/Depot-Schemas und der radiale Netzplan zeigen einen
bewegten Strichverlauf ausschliesslich auf Abschnitten mit berechneter endlicher
Leistung beziehungsweise berechnetem Strom ungleich null. Nennwerte allein
aktivieren die Bewegung nicht. Wartende Ladepunkte mit 0 kW und ungültige
Netzergebnisse bleiben statisch. Eine berechnete Überlast kann weiterhin einen
Leistungsfluss haben; deren Bewegung behält die rote Fehlerfarbe.
Sammelschienen und Steigleitungen sind dafür in Teilstücke aufgeteilt: Jedes
Teilstück berücksichtigt nur die Summe der tatsächlich nachgelagerten aktiven
Punkte. Die Leitung hinter dem letzten aktiven Punkt und eine ausschließlich
wartende spätere Reihe bewegen sich nicht.

Bei Grid-PV folgt die vorgelagerte Leitung dem bekannten vorzeichenbehafteten
Nettofluss. Rückspeisung bewegt sich entgegen der üblichen Richtung, während
die nachgelagerten aktiven Ladepunkte weiterhin Leistung aufnehmen. Die
Bewegung visualisiert den stationären Leistungsweg, nicht die momentane
Wechselstromrichtung oder eine Stromgeschwindigkeit. Der Blitzschutzleiter
bleibt statisch, da sein Abstandsmodell keinen tatsächlichen Strom berechnet.
Reduzierte Bewegung und der Druckmodus unterbinden die Animation.

`backend/tests/test_current_flow_ui.py`: zwei zusätzliche echte Chromium-Tests
bestanden. Geprüft wurden eine tatsächliche Änderung des SVG-Strichversatzes,
zwei aktive/ein wartender EV-Punkt, bekannte Grid-Rückspeisung, sofortiges Stoppen
bei leerer Eingabe, reduzierte Bewegung sowie Netzplan mit drei aktiven
Leitungen, ungültiger Länge und entferntem Verbraucher. Für gemischte Grids
wurden zusätzlich vollständig wartende Punkte und ein aktiver Punkt mit
Grid-PV im Browser geprüft. Alle wartenden Punktleitungen blieben statisch;
die Rückspeisung änderte nur die betroffene vorgelagerte Richtung.
Zusätzlich geprüft: Die Sammelschiene zum dritten wartenden Punkt ist bei
zwei aktiven Punkten statisch. Bei drei aktiven und drei wartenden Punkten
bleibt der Steigleitungsabschnitt zur rein wartenden zweiten Reihe statisch.
Ein gemischtes Sechs-Punkte-Grid mit nur dem ersten aktiven Punkt animiert nur
den ersten Busabschnitt und die erste aktive Punktzuleitung.

Eigene Bildschirmaufzeichnung:
`/workspace/artifacts/visual-audit/edeco-stromfluss.mp4` (lokale Beispielwerte,
ohne Anmeldung oder Zugangsdaten).
