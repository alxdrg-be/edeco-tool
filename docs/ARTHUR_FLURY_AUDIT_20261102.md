# Arthur Flury: Trennungsabstand

Stand: 2. November 2026. Die aktuelle Referenzseite und ihr eingebetteter
Rechner wurden mit einem normalen Chromium-Browser geöffnet. Die Hauptseite
antwortete HTTP 200; das Rechner-iFrame und seine Skripte waren über die
gewöhnliche Navigation erreichbar. Ein isolierter Abruf des iFrames ohne
Hauptseitenkontext antwortete teilweise 403. Diese Antwort wurde nicht durch
eine alternative Netzwerkroute umgangen.

## Tatsächliche Eingaben und Bedienumfang

Der Rechner enthält genau diese elektrotechnischen Eingaben:

- Klasse I / II / III, mit k = 0.08 / 0.06 / 0.04.
- Gebäudeumfang U in Metern.
- Ganze Ableiteranzahl n, mindestens zwei.
- Leitungslänge A vom Prüfpunkt bis zum nächstliegenden Potenzialausgleich.

Die Ableiterabstände x sind 10 m für I/II und 15 m für III. Berechnet werden
n₀ = U/x, s = k·A·n₀/n und max(2, ceil(n₀)) als Mindestanzahl Ableiter.
Der Trennungsabstand wird auf ganze Zentimeter aufgerundet. Diese Parameter
und die Zahlenbedingungen sind bereits im nativen `lightning-model.ts`
abgebildet. Der zusätzlich in edeco eingegebene vorhandene Abstand dient
dem klar getrennten eigenen Soll-/Ist-Vergleich.

Es gibt im geprüften Referenzrechner **keine** Eingaben für Gebäudehöhe,
Attikageometrie, Dachobjektabmessungen, k_c, k_m oder Klasse IV. Die
Infoabbildung erklärt die Führung der Länge A; sie ist kein editierbares
Gebäudemodell. Deshalb wurden aus dieser Referenz keine zusätzlichen
Geometrieparameter oder eine vollständige Fangschutzplanung abgeleitet.
Die eigene Gebäudegrafik bleibt eine schematische Abstandsprüfung am Prüfpunkt,
kein vollständiger geometrischer Blitzschutz-/Attikanachweis.

Zusätzliche Bedienfunktionen der Referenz sind ein mehrzeiliger lokaler
Berechnungslog mit Bemerkungen/Bild sowie Excel-/PDF-/JSON-Logexport und
JSON-Import. edeco verwendet stattdessen die gemeinsame Berechnungsablage,
projektspezifische Notizen und seine eigenen PDF-/JSON-Rechenstände. Eine
formatgleiche Übernahme des fremden Log- und Bildformats oder ein identischer
Excel-Logexport wird damit nicht behauptet.

## Tatsächliche Browserzahlen

| Klasse | U (m) | A (m) | n | Referenz s (m) | Mindest-n | Vergleich |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| I | 20 | 3 | 2 | 0.24 | 2 | gleich |
| II | 40 | 5 | 4 | 0.30 | 4 | gleich |
| III | 60 | 10 | 4 | 0.40 | 4 | gleich |
| III | 61 | 10 | 5 | 0.33 | 5 | gleich |
| III | 10 | 3 | 2 | 0.04 | 2 | gleich |
| III | 60 | 10 | 2 | 0.80 | 4 | gleich, Ableiterwarnung |
| II | 20 | 4.5 | 2 | 0.27 | 2 | gleich |
| I | 98.5 | 12.345 | 12 | 0.82 | 10 | gleich |
| II | 123.45 | 8.75 | 7 | 0.93 | 13 | gleich, Ableiterwarnung |
| III | 88.2 | 7.1 | 6 | 0.28 | 6 | gleich |
| I | 20 | 7 | 2 | 0.57 | 2 | bewusste Rundungsabweichung, siehe unten |

Im letzten Fall beträgt der exakte Dezimalausdruck 0.08·7·(20/10/2) = 0.56 m.
Die Referenz zeigt aufgrund von binärer Gleitkommadarstellung und anschliessendem
`ceil` 0.57 m. edeco behält seine vorhandene exakte rationale
Zentimeteraufrundung bei und ergibt 0.56 m; es kopiert diesen zusätzlichen
Zentimeter nicht. Ein eigener Regressionstest dokumentiert die absichtliche
Abweichung. Die übrigen zehn Beobachtungen, einschliesslich Mindestanzahl und
Ableiterwarnung, stimmen mit dem nativen Rechenkern überein.

Die Normangabe auf der Referenz lautet SN 414022:2024, Seite 38. Die
Übereinstimmung mit dem Rechner ersetzt keine unabhängige Prüfung des
Normtexts, der Anwendungsbedingungen oder des tatsächlichen Gebäudes.

## Quellen und Belege

- Hauptseite: <https://www.aflury.ch/de/fachwissen/trennungsabstand-rechner/>
- iFrame: <https://www.aflury.ch/fileadmin/Arthur_Flury_CH/Tools/Trennungsabstand-Rechner/2026_tool_trennungsabstand.html?lang=de>
- Clientskript: `2026_tool_trennungsabstand.js`, SHA-256
  `a6e63a9557a1e453620cf3b8bc1ef0d25afad43dffcf97365131ef5e73b35989`.
- Logskript: `log.js`, SHA-256
  `c15cc270c288aaed00b575d4c7df71e43eeabc5292aaa4432050d21878a40d4d`.
- Beobachtete Anzeigen: Arbeitsbereich
  `scratch/elektro-reference-20261102/flury-live-cases.json`.
- Referenz-Screenshot, Rundungsgrenzfall:
  `artifacts/elektro-rundgang/arthur-flury-trennungsabstand-rundungsgrenze.png`.
- Native Tests: `ui/src/tools/berechnungen/lightning.test.ts`.

Es wird kein fremder Rechnercode mit der Anwendung ausgeliefert. Die native
Modellrechnung ist unverändert; ergänzt wurden Provenienz und tatsächliche
Browserfälle sowie die dokumentierte Rundungsabweichung.
