# Visueller Vergleich mit elektro-rechner.ch

Designreferenz vor dem nativen Ausbau: 1. November 2026. Aktueller
Implementierungsumfang: [Rechner und Grenzen](RECHNER_UMFANG.md).

Umfang des visuellen Vergleichs: alle 24 auf der Anbieterübersicht genannten
Rechner, davon 16 öffentlich und acht aus dem angemeldeten Dashboard. Alle
wurden im Browser geöffnet. Die acht Dashboard-Rechner waren nach dem Speichern
des Browserprofils erreichbar. Die Prüfung betrifft die sichtbaren
Standard-/Beispielzustände, Informationsanordnung und Diagrammarten. Sie ist
keine vollständige Interaktionsprüfung, Übernahme der Berechnungslogik oder
Validierung der angezeigten Normenaussagen und Zahlen.

Quellen: [Startseite](https://www.elektro-rechner.ch/) und
[Anbieterübersicht mit Umfang 16 + 8](https://www.elektro-rechner.ch/premium/).
Browserläufe: [E-Mobilität und Spannungsfall](https://agent.tinyfish.ai/runs/c9400956-de03-4d1a-bdc8-f2509c6c7754),
[acht Dashboard-Rechner](https://agent.tinyfish.ai/runs/a407d01a-f871-4d15-9e7f-a16ec12f9883),
[weitere 14 öffentliche Rechner](https://agent.tinyfish.ai/runs/f44f24dc-f6d1-456e-88a2-4263fcddefc8).
Die Läufe erfassen die Browseransichten; separate Screenshot-URLs wurden im
Prüfergebnis nicht geliefert.

## Öffentliche Rechner

| Rechner | Im geprüften Zustand beobachtet | Schluss für edeco |
| --- | --- | --- |
| [NIN-Kabelrechner](https://www.elektro-rechner.ch/Rechner/nin-kabelrechner.html) | Wertekarten und Verlegeartentabelle | Vergleichbare Werte tabellarisch lassen; Verlegearten mit eindeutigen Symbolen ergänzen. |
| [Strombelastbarkeit](https://www.elektro-rechner.ch/Rechner/Strombelastbarkeit.html) | Markierte Auswahloptionen, Ergebnisfelder | Gewählten Berechnungspfad und Korrekturen sichtbar halten. |
| [Spannungsfall](https://www.elektro-rechner.ch/Rechner/spannungsfall.html) | Werte für Volt, Prozent, Verbraucher und maximale Länge | Leitungsgrafik mit den wichtigsten numerischen Ergebnissen kombinieren. |
| [Kurzschlussstrom](https://www.elektro-rechner.ch/Rechner/kurzschlussstrom.html) | Parameter, Ergebnis und Erläuterung in getrennten Bereichen | Hauptwert hervorheben; Netzbeziehungen könnten eine zusätzliche Grafik erklären. |
| [LS-Schalter](https://www.elektro-rechner.ch/Rechner/ls-schalter.html) | Schutzorganwerte und farbige Statusanzeige | Schutzelemente und zugehörige Prüfung eindeutig verbinden. |
| [Potenzialausgleich](https://www.elektro-rechner.ch/Rechner/potenzialausgleich.html) | Kompakte Zusammenfassung mehrerer Querschnitte | Gemeinsame Ergebniszeile statt räumlich verstreuter Einzelwerte. |
| [Transformator](https://www.elektro-rechner.ch/Rechner/transformator.html) | Nenn- und Kurzschlussströme als Zahlen mit Einheiten | Grosse, klar beschriftete Messwerte sind bereits eine wirksame Visualisierung. |
| [Motoranlauf](https://www.elektro-rechner.ch/Rechner/motoranlauf.html) | Verhältnis von Anlauf- zu Nennwerten und Hinweise | Verhältnis sichtbar machen, beispielsweise mit proportionalen Balken. |
| [Blindleistung](https://www.elektro-rechner.ch/Rechner/blindleistung.html) | Vorher-/Nachher-Werte | Vergleichspaare nebeneinander und Differenz direkt zeigen. |
| [Verlustleistung](https://www.elektro-rechner.ch/Rechner/verlustleistung.html) | Farbliche Warnungen und Querschnittshinweise | Rot/Gelb/Grün mit begründetem Text kombinieren; fremde Grenzwert-Voreinstellungen nicht ungeprüft übernehmen. |
| [Ohmsches Gesetz](https://www.elektro-rechner.ch/Rechner/ohmsches-gesetz.html) | Grössenauswahl U/I/R/P mit Symbolen und Ergebnisblöcken | Direkt erkennbare Moduswahl statt zusätzlicher Erklärungstexte. |
| [Beleuchtung](https://www.elektro-rechner.ch/Rechner/beleuchtung.html) | Raumparameter und Leuchtenergebnis als getrennte Bereiche | Raumgeometrie und technische Werte sichtbar zusammenführen. |
| [PV-Anlage](https://www.elektro-rechner.ch/Rechner/pva-rechner.html) | Leistung, Ertrag, Kosten und Wirtschaftlichkeit als Wertekarten | Ertrag und finanzielle Kennzahlen klar trennen und sinnvoll gewichten. |
| [E-Mobilität](https://www.elektro-rechner.ch/Rechner/e-mobility-rechner.html) | Anschluss-/Grid-Schema, Auslastung, Leistung und Strom | Zusammenhänge von Einspeisung, Reserve und Ladebudget direkt zeigen. |
| [Brandlast, öffentliche Variante](https://www.elektro-rechner.ch/Rechner/brandlast-fluchtweg.html) | Brandlast, Grenzwert und aufklappbare Details; Beispiel ohne Kabel | Grenzwert und berechneten Wert vergleichbar anordnen. Ein Leerergebnis ist kein vollständiger Test eines belegten Fluchtwegs. |
| [PoE, öffentliche Variante](https://www.elektro-rechner.ch/Rechner/poe-rechner.html) | Einspeisung, Verluste und Endgerätwerte | Abfolge PSE → Leitung/Verluste → PD als durchgängige Strecke darstellen. |

## Rechner aus dem Dashboard

| Rechner | Im geprüften Zustand beobachtet | Vergleich mit dem bisherigen edeco-Entwurf |
| --- | --- | --- |
| [Ladegrid PKW](https://www.elektro-rechner.ch/premium/ladegrid-rechner.php) | Stromlaufplan mit Werten, Leistungsfluss und Gesamtkennzahlen | Erklärt die Leistungsteilung besser als leere Verteiler-/Ladepunktblöcke. |
| [Ladegrid E-LKW](https://www.elektro-rechner.ch/premium/ladegrid-lkw.php) | Einspeisung, AC/DC-Power-Units und DC-Ladepunkte als verbundene Stufen | AC/DC-Umwandlung und Zugehörigkeit der Einheiten müssen erkennbar sein; Fahrzeugbilder allein reichen nicht. |
| [Brandmelder](https://www.elektro-rechner.ch/premium/brandmelder-rechner.php) | Bemasster 2D-Raumplan mit Melderposition und Wandabständen | Raum- und Abstandsbezug sind deutlich aussagekräftiger als unbemasste Kreise in Beispielräumen. |
| [Selektivität](https://www.elektro-rechner.ch/premium/selektivitaet-rechner.php) | Schutzorgankaskade mit Kurzschlussströmen und Status pro Paar | Stufenbezug und Bewertungen fehlen im edeco-Entwurf noch. Kurven erst mit belegten Herstellerdaten darstellen. |
| [Ladeinfrastruktur-Kosten](https://www.elektro-rechner.ch/premium/ladeinfrastruktur-kostenrechner.php) | Jahresverlauf mit gestapelten Investitions-/Betriebskosten, Kennzahlen und Tabelle | Die Referenz erklärt Zeitverlauf und Kostenteile; unsere symbolischen Balken sind noch kein gleichwertiges Diagramm. |
| [SIA 2056 Energie](https://www.elektro-rechner.ch/premium/sia2056-rechner.php) | Verbrauchergruppen-/Zonentabelle und Kennzahlen | Zahlenbezug ist wichtiger als ein dekorativer Raumplan. Grafik für Gruppenanteile könnte die Tabelle ergänzen. |
| [PoE-Streckenplaner](https://www.elektro-rechner.ch/premium/poe-streckenplaner.php) | Segmenttabelle, elektrische Länge, Vorgabe und Reserve | Der edeco-Sternnetz-Entwurf passte fachlich nicht gut: erforderlich sind aufeinanderfolgende Leitungssegmente und ein Reservevergleich. |
| [Brandlast Fluchtweg](https://www.elektro-rechner.ch/premium/brandlast-fluchtweg.php) | Fluchtwegschema, Zustandslegende und Ergebnisbereich; geprüfter Zustand ohne Kabel | Status und Fluchtwegbezug sind sinnvoll. Aussagen über gefüllte Kabelpläne oder vollständigen Vorher-/Nachher-Vergleich bleiben offen. |

## Umgesetzt und noch offen

Die Texte der edeco-Oberfläche enthalten keine Premium-Bezeichnung mehr. Die
acht Kacheln bleiben als vorbereitete Ansichten erhalten. Ihre Rechenlogik ist
weiterhin offen; der visuelle Vergleich macht daraus keine funktionierenden
Berechnungen. Interne Kennungen bleiben für bereits gespeicherte Stände stabil.

Bei der nativen AC-Vorplanung zeigt edeco jetzt Hausanschluss, Reserve,
Grid-Obergrenze, Leistungsaufteilung, Zuteilung und Strom je Ladepunkt. Beim
Kabel sind Prozent/Budget, maximale Länge aus dem gewählten Budget und
Leiterwiderstand direkt sichtbar. Der PoE-Entwurf zeigt nun eine durchgehende
Strecke statt eines Sternnetzes. Legenden stehen ausserhalb der Grafiken.

Grosse Grafiken bleiben ausdrücklich erwünscht. Der weitere Ausbau soll die
Beziehungen und Zahlen der Referenz erhalten und die edeco-Darstellung verbessern:
zuordenbare Messwerte, technische Symbole, Abstände und gut lesbare Legenden.
Ein unbelegter Zahlenwert oder eine dekorative Grafik ersetzt keine Rechenlogik.

Die eigene Oberfläche wurde zusätzlich bei 1600 und 390 Pixeln Breite geprüft,
einschliesslich Überlappung der SVG-Beschriftungen, horizontalem Überlauf und
heller/dunkler Darstellung der acht Entwurfsansichten. Das ist von der
Referenzprüfung getrennt und kein pauschaler Nachweis für alle Bildschirmgrössen.
