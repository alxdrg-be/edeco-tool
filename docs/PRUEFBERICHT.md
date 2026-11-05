# Prüfbericht edeco Toolhub

Stand `f549280d` (main, 5. November 2026, Europe/Zurich). Phase 1: geprüft und berichtet. Keine Rechenänderung, kein Windows-Build.

Dieser Durchgang beantwortet die Frage, warum Berechnungen unterschiedlich aussehen, und prüft den Stand nach den bereits umgesetzten Korrekturen erneut im Quelltext. Die Formeln wurden gelesen, nicht neu ausgeführt. `npm test`, `tsc`, Lint, Pytest und der Produktionsbuild liefen in diesem Durchgang nicht: im Arbeitsstand fehlt `ui/node_modules`, ein `dist` ist nicht vorhanden. Die letzten gemessenen Zahlen stehen im Abschnitt «Geschwindigkeit». Normtexte lagen nicht auf dem Tisch. Was nicht belegt ist, steht unter «Offen oder unsicher».

## Warum die Bilder unterschiedlich aussehen

Die sechs Vergleichsbilder von elektro-rechner.ch sind nicht ein Erscheinungsbild.

| Seite | Erscheinungsbild im Bild |
| --- | --- |
| Brandlast Fluchtweg, SIA 2056, Selektivität, Netzplaner | hell, salbeigrün |
| PV-Anlage, Zuleitung Schnellcheck | dunkelgrün |

Das ist die Referenzseite, nicht der Toolhub. Im Toolhub schaltet jede Berechnung über dieselbe Stelle um: `LabUI.tsx:120` setzt `data-lab-theme` aus dem Hell-/Dunkelmodus der Werkzeugleiste. `lab.css:6` und `:7` liefern dafür ein dunkles und ein helles Token-Set. Ein Rechner kippt nicht von allein in ein anderes Thema.

Trotzdem sieht derselbe Rechner bei uns nicht immer gleich aus, und er sieht anders aus als die Referenz. Drei Gründe:

1. **Die Fensterbreite verschiebt die Spalten.** Unter 1450 px stehen Eingaben und Ergebnis nebeneinander, die Kennzahlen unter dem Bild (`workbench.css:12`). Ab 1450 px wandern die Kennzahlen in eine rechte Spalte von 220 px, das Bild bleibt links (`workbench.css:13`). Dieselbe Berechnung hat damit zwei Gestalten. Die Referenz hält drei Spalten fest: Eingabe, Bild, Ergebnis.
2. **Das Bild hängt an der Grösse, nicht an einer gemeinsamen Schablone.** Netzplaner ist eine Zeichenfläche mit Palette und Inspektor. Selektivität ist eine senkrechte Kaskade. Kurzschluss, Trafo und LS sind eine waagrechte Symbolkette. Brandlast zeichnet gezählte Striche, nicht den Fluchtwegquerschnitt. SIA, PV und Kosten haben eigene Diagramme. Das ist beabsichtigt. Der Leseweg ist dadurch nicht überall gleich.
3. **Die Selektivität behauptet weniger und zeigt die Aussage an der falschen Linie.** Dazu der nächste Abschnitt.

### Netzplaner

Der Netzplaner von edeco ist für die Planung das stärkere Werkzeug. Er bleibt ein bearbeitbares radiales Modell: Palette, Verbinden, Inspektor, Zoom, eingefrorener Prüfstand. Eine fehlerhafte Leitung wird rot, eine Warnung gelb (`NetworkCanvas.tsx:12` und `:201`–`:205`). Strom und aufsummierter Spannungsfall stehen auf der Leitung.

Der Netzplaner auf elektro-rechner.ch ist eine schnelle Skizze einer Linie. Rot bedeutet dort sofort «dieser Abschnitt fällt durch». Das ist auf einen Blick klar, trägt aber keinen eigenen Prüfstand und keinen Inspektor. Diese Skizze nicht nachbauen. Rot auf der fehlerhaften Leitung haben wir bereits.

### Selektivität

Für dasselbe Beispiel ist das Bild auf elektro-rechner.ch leichter zu lesen. Die Vorgabe bei uns ist dieselbe Topologie (`selectivityStages.ts:16`–`:20`): Quelle 10 kA, NH 250 A nach 5 m / 150 mm², NH 100 A nach 30 m / 50 mm², LS C16 nach 40 m / 2,5 mm².

Dort steht der Kurzschlussstrom auf der Verbindung, und die Farbe der Verbindung ist die Aussage: grün durchgezogen «vollselektiv», orange punktiert «teilselektiv», rot gestrichelt «nicht selektiv». Rechts ein Satz, darunter die Legende.

Bei uns ist die Kaskade vorsichtiger und schlechter lesbar.

- Ein Nennstromverhältnis wird nie grün. NH ≥ 1,6 bleibt ein Hinweis, LS–LS ohne Kennlinie bleibt unbewiesen (`selectivityStages.ts:72`–`:76` und `:91`). Das ist richtig. Die Referenz gibt Paare aus dem Verhältnis als vollselektiv frei. Diese Freigabe übernehmen wir nicht.
- Eine eingehaltene, selbst eingetragene Herstellergrenze bleibt ebenfalls gelb (`selectivityStages.ts:70`, `tone: 'warning'`). Dieselbe Farbe wie «kein Nachweis». Rot gibt es nur, wenn die Grenze überschritten ist. Am Bild sieht man den Unterschied nicht.
- Die Farbe sitzt um eine Stufe daneben. Die Paarfarbe wird auf das untere Gerät gelegt (`selectivityStages.ts:83`, `tone: pairs[j - 1]`). Die Linie unter einem Gerät übernimmt die Farbe dieses Geräts (`TechnicalGraphics.tsx:84`–`:86`). Die Linie von Stufe 1 nach Stufe 2 zeigt damit die Farbe des Paars darüber, nicht die des gezeichneten Abschnitts. Stufe 1 hat keine eingehende Paarfarbe, ihre abgehende Linie bleibt deshalb neutral.

Das Bild der Referenz ist verständlicher. Die grüne Freigabe «vollselektiv» aus dem Stromverhältnis ist es nicht. Übernehmen: Strom und Paarsatz auf die Verbindung, Legende unter die Kaskade, drei lesbare Zustände (Hinweis, dokumentierte Grenze eingehalten, Grenze überschritten). Das Wort «vollselektiv» nur, wenn eine konkrete Herstellerquelle das für dieses Paar sagt. Die Rechnung bleibt gleich.

Mehr visualisierte Berechnungen sind der richtige Weg. Die Bilder, die eine Aussage tragen, sind der Netzplaner, die SIA-Stapel, der bemasste Raum und das Ladeschema. Dünn bleiben Brandlast (gezählte Striche statt Fluchtwegquerschnitt, `TechnicalGraphics.tsx:90`–`:107`) und die Selektivitätskaskade, solange die Farbe nicht zum Paar gehört.

## Teststand in diesem Lauf

| Lauf | Ergebnis |
| --- | --- |
| Quellstand gelesen | Formeln, Kaskade, Netzplaner, Theme, `local_security` |
| `ui`: Tests, `tsc`, Lint, Build | nicht ausgeführt, `ui/node_modules` fehlt |
| `python -m pytest backend/tests` | nicht ausgeführt |
| Browser | nicht geklickt |

Zuletzt ausgeführt am 5. November 2026 gegen `aaad8142`, vor den Darstellungskorrekturen: UI 541 bestanden, Lint ohne Befund, Build erfolgreich, Backend 719 bestanden, 66 übersprungen, 1 fehlgeschlagen. Der Fehlschlag ist der bekannte Linux-Schrifttest `test_font_metrics_avoid_stranded_suffixes_and_break_at_existing_hyphens`. `test_rack_text_layout_at_working_sizes` ist ein Browsertest und blieb unausgeführt. Beide Tests wurden nicht angefasst. Ob sie auf `f549280d` noch gleich scheitern, ist in diesem Lauf nicht neu belegt.

## Befunde

Aufwand ist eine grobe Schätzung für die Korrektur, nicht ein Termin. Keine Zeile ändert eine gespeicherte Zahl.

| Priorität | Modul | Datei und Zeile | Befund | Begründung | Vorschlag | Aufwand |
| --- | --- | --- | --- | --- | --- | --- |
| hoch | Selektivität | `TechnicalGraphics.tsx:84`–`:86`, `selectivityStages.ts:83` | Die Farbe der Verbindung gehört zum darüberliegenden Paar. Die Linie aus der ersten Stufe bleibt neutral, obwohl das erste Paar eine Aussage hat. | Die Paarfarbe liegt auf dem unteren Gerät. Gezeichnet wird die abgehende Linie dieses Geräts. Am Beispiel NH 250 A → NH 100 A → LS C16 zeigt die mittlere Linie die Farbe des oberen Paars. | Farbe, Kurzschlussstrom und Paarsatz auf die Verbindung legen, die das Paar wirklich ist. Legende direkt unter die Zeichnung. Rechnung und Texte unverändert lassen. | 1 Tag |
| mittel | Selektivität | `selectivityStages.ts:70` und `:76` | «Kein Nachweis» und «dokumentierte Grenze eingehalten» sind beide gelb. Rot nur bei Überschreitung. | `pass` setzt `warning`, der Hinweis ohne Quelle ebenfalls. Das Bild kann eine bestandene Paargrenze nicht von einem offenen Hinweis unterscheiden. Die Referenz malt dafür grün «vollselektiv», auch ohne Herstellerkennlinie. | Dritten Zustand nur für eine selbst belegte Grenze: andere Farbe, Wortlaut «dokumentierte Grenze eingehalten». «Vollselektiv» nicht aus dem Nennstromverhältnis vergeben. | 0,5 Tag, zusammen mit der Linie |
| mittel | Berechnungen, Layout | `workbench.css:12` und `:13` | Dieselbe Berechnung wechselt bei 1450 px die Gestalt. Die Ergebnisspalte ist dann 220 px breit. | Unter der Grenze liegen die Kennzahlen unter dem Bild, darüber rechts daneben. Die Referenz hält drei Spalten. Hell und dunkel sind bei uns bereits ein Schalter (`LabUI.tsx:120`). | Den dreispaltigen Leseweg ab einer kleineren Breite anbieten und der Ergebnisspalte mehr als 220 px geben. Kein eigenes Thema pro Rechner. | 1–2 Tage |
| tief | Brandlast | `TechnicalGraphics.tsx:90`–`:107` | Der Fluchtweg ist eine Liste von Strichen, nicht der Querschnitt mit Trasse und Verteiler. | Die Bildunterschrift sagt das. Die Zahl ist davon nicht berührt. Die Referenz zeigt die Kabelplätze im Schnitt und ist dadurch schneller lesbar. | Schematischen Schnitt mit gezählten Plätzen zeichnen, weiter als Schema beschriften, ohne Örtlichkeit zu behaupten. | 2–3 Tage |

Kein Befund der Stufe kritisch. Kein neuer Zahlenfehler in den gelesenen Formeln.

## Geprüft ohne Befund

Die früheren Korrekturen sind im Quellstand vorhanden. Die gespeicherten Formeln wurden dabei nicht neu gerechnet.

- Rechenbasis «Vorsichtig» bleibt der Anfang. «Wie NIN-Programm» rechnet den Spannungsfall bei festen 20 °C; das Feld ist Anzeige.
- Kurzschluss 230 V nennt den uk-Bezug. Die 400-V-Formel ist unverändert.
- Ik,min im Netz nennt die Spanne durch Betragsaddition. Die Addition selbst ist nicht auf komplexe Impedanzen umgestellt.
- Kurzschlussfestigkeit rechnet nur mit selbst belegtem k und selbst belegter Zeit (`networkModel.ts:373`–`:377`). Ohne Beleg bleibt der Prüfpunkt offen (`networkCheckpoints.ts:70`).
- Ein Ladepunkt ohne Typ B oder Typ A/F mit 6 mA bleibt offen (`networkModel.ts:327`).
- Die Rechnergruppen laden getrennt (`Workbench.tsx:27`–`:30`). `definitions.ts` bündelt die drei Gruppen nur für Tests.
- Plan-Upload über 250 MB und das Stirling-Cookie `JSESSIONID` sind die umgesetzten Grenzen. In diesem Lauf nicht neu gemessen.
- Vier Netzplaner-Meldungen nennen Format, Grenze und den nächsten Schritt (`networkModel.ts:143` und `:149`).
- Importzeile und Projektzeile bleiben per Tastatur erreichbar.
- Überlast im Netz: IB ≤ In ≤ Iz und I₂ ≤ 1,45 × Iz (`networkModel.ts:360`–`:368`).
- LS-Bänder B, C, D bleiben 3–5, 5–10 und 10–20 × In (`Workbench.tsx:33`–`:37`). K und Z bleiben als Herstellerannahme beschriftet.
- Selektivität vergibt aus dem Nennstromverhältnis keine Freigabe (`selectivityStages.ts:91`).
- cmax 1,10 bei +10 % und 1,05 bei +6 %, cmin 0,95. Der Normentext von IEC 60909-0 lag nicht auf.
- `local_security` hängt weiter vor den übrigen Routern (`backend/edeco_toolbox/app.py:30`).
- In `ui/src` steht kein ß in einem sichtbaren Text. Einzige Fundstelle bleibt die Zeichennormalisierung in `ui/src/legend.ts:561`.
- Fehlende Leitung im Netz wird rot gezeichnet (`NetworkCanvas.tsx:201`–`:205`).

## Geschwindigkeit, zuletzt gemessen

Nicht neu gemessen. Stand vor dem Aufteilen der Rechnergruppen, gegen `aaad8142`.

| Messung | Wert |
| --- | --- |
| `create_app()` | 0,59 s |
| Chunk Workbench vor dem Split | 523,70 kB, gzip 147,63 kB |
| Chunk Workbench nach dem Split, damaliger Lauf | 362,53 kB |
| Chunk auf `f549280d` | nicht gebaut |

Ob der Workbench-Chunk auf dem jetzigen Stand noch unter 500 kB liegt, ist offen, bis `npm run build` wieder läuft.

## Vorschläge

Nur nach Freigabe. Die Zahlen bleiben gleich.

| Vorschlag | Nutzen | Aufwand |
| --- | --- | --- |
| Selektivität: Aussage auf die Verbindung, mit Legende | Dieselbe Kaskade ist so lesbar wie die Referenz, ohne eine unbelegte Freigabe «vollselektiv». | 1–1,5 Tage |
| Dreispaltiger Leseweg früher und mit breiterer Ergebnisspalte | Ein Rechner sieht bei schmalem und breitem Fenster nach derselben Ordnung aus. | 1–2 Tage |
| Brandlast als schematischer Fluchtwegquerschnitt | Die gezählten Kabel sind örtlich lesbar, weiter als Schema gekennzeichnet. | 2–3 Tage |
| Kurzschlussfestigkeit mit belegtem k bleibt der Weg | Kein stiller Normwert. Erst wenn eine gedruckte k-Tabelle freigegeben ist. | offen |

## Offen oder unsicher

- NIN 2025, IEC 60909-0, IEC 60364-4-41 und SN EN 60228 lagen nicht auf. Abschnittsnummern im Code sind damit nicht neu bestätigt.
- Die Ik-Werte der Referenzkaskade (9,82 kA, 7,96 kA, 0,39 kA) wurden in diesem Lauf nicht nachgerechnet. Verglichen wurde die Topologie und die Aussage des Bildes, nicht die Zahl.
- Die Selektivität bildet die Fehlerschleife als `2 · |Z_Quelle + Z_Leitung|` (`selectivityStages.ts:57`). Der Netzplaner addiert die vorgegebene L–PE-Quelle einmal und die Leiterschleife dazu (`networkModel.ts:345`). Das sind zwei Modelle. Ob sie für denselben Fall auseinanderlaufen, ist nicht neu durchgerechnet.
- Ob der Workbench-Chunk auf `f549280d` unter 500 kB liegt, ist nicht gemessen.
- Die beiden Linux-Schrifttests sind nicht neu gelaufen.
- Renderzeiten grosser Legenden und grosser Netze sind nicht gemessen.
- PoE, SIA 2056, PV-Tarife und Brandmelde-Raster bleiben so unsicher, wie der Code sie selbst bezeichnet.

## Angehalten

Phase 1 ist der Bericht. Keine Umsetzung, bis die Punkte freigegeben sind. Bestehende Referenztests werden nicht gelockert. Gespeicherte Berechnungen rechnen weiter wie bisher.
