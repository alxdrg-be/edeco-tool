# Abgleich mit sichtbarer Clientlogik

Stand: 1. November 2026. Geprüft wurden mathematische Beziehungen und
reproduzierbare Fälle aus den öffentlich ausgelieferten HTML-/JavaScript-Rechnern
von elektro-rechner.ch. Das ist eine separate Prüfung nach dem vorherigen
[visuellen Vergleich](RECHNER_VISUELLER_VERGLEICH.md).

Die öffentlichen Berechnungsfunktionen wurden mit passenden Eingaben in einer
isolierten JavaScript-Umgebung ausgeführt. DOM-/Ausgabehilfen wurden nachgebildet;
teilweise wurden Validierungshelfer durch gültige Eingaben ersetzt. Diese Fälle
belegen daher die Rechenarithmetik und Ausgabe-Rundung, keine vollständige
Browservalidierung oder automatische Normtabellenzuordnung.

Die Regressionstests behalten beobachtete Zahlen, Quellen-URLs, Datum und
SHA-256 der untersuchten Quellen. Fremder Programmcode und vollständige
Normkataloge sind nicht Teil der Toolbox. Serverseitiger PHP-Code wurde nicht
eingesehen. Sichtbarer Clientcode ist auch kein Nachweis fachlicher Richtigkeit.

## Ergebnis je öffentlichem Thema

| Thema | Ergebnis im vergleichbaren Umfang |
| --- | --- |
| Spannungsfall | Fünf Fälle stimmen nach Referenzrundung überein: Cu/Al, 1~/3~, Blindanteil, 55 °C und maximale Länge. Beispiel: 25 m Cu 2.5 mm², 16 A, 230 V → 6.74 V / 2.93 % / 34.1 m Budgetlänge. |
| E-Mobilität | Drei gemeinsame symmetrische 3~-Fälle stimmen bei der zugeteilten Leistung überein. Keine Gleichwertigkeit für 1~, Warteschlangen, PV/Speicher oder automatische SIA-Faktoren. |
| NIN-Kabel | Der Korrekturkern stimmt bei identischen manuellen Tabellenwerten und Faktoren: 50 A × 0.87 × 0.8 = 34.8 A. Keine Prüfung oder Übernahme des gesamten Normkatalogs. |
| Strombelastbarkeit | edeco rechnet mit voller Präzision. Bei 246 A × 0.88 × 2 bleiben 432.96 A; eine Referenzseite rundet pro Kreis auf 216 A und zeigt 432 A, die andere zeigt gerundet 433 A. Diese abweichende Zwischenrundung wird nicht übernommen. |
| LS-Schalter | Gemeinsame magnetische Bereiche stimmen: B16 48–80 A, C20 100–200 A, D32 320–640 A. Hersteller-Selektivitäts-/Back-up-Daten sind nicht gleichwertig eingebettet. |
| Potenzialausgleich | Drei Fälle stimmen mit entsprechend eingetragenen Schweizer HPA-/PE-Tabellenwerten überein. Die automatische Tabellenzuordnung der Referenz bleibt eine Funktionsdifferenz. |
| Transformator | Beispiel 250 kVA, 20 kV/400 V, uₖ 4 % → 360.8 A sekundär und 9.021 kA im starren Modell. Ein weiterer Zahlenfall stimmt ebenfalls. |
| Motoranlauf | Bei gleichem η und cos φ stimmen Nenn- und Anlaufstrom: 7.5 kW, η 0.904, cos φ 0.85 → 14.1 A / 84.5 A direkt beziehungsweise 28.2 A ideal im Sternanlauf. |
| Blindleistung | Gemeinsame Kompensations- und Verlustkostenfälle stimmen. Beispiel 100 kW, 0.75 → 0.95: 55.3 kvar. Bereits erreichtes Ziel liefert nun ausdrücklich 0 kvar statt eines Fehlers. |
| Verlustleistung | Zwei gemeinsame I²R-Fälle stimmen. Beispiel Cu 2.5 mm², 25 m, 16 A, 3~, 55 °C → 161.84 W und 5.840 V. |
| Ohmsches Gesetz | DC- und symmetrische AC-Fälle stimmen; 48 V / 2 A → 24 Ω / 96 W. |
| Beleuchtung | Die gemeinsame Lumenrechnung liefert im Prüffall mindestens 18 Leuchten. edeco rundet für sein vollständiges Rechteckraster auf 20 auf; Referenzanzahl und installierte Rasterleistung sind deshalb nicht gleich. |
| Kurzschlussstrom | Keine Gleichwertigkeit zu Referenz-Ik-min/max: Dort werden zusätzliche Spannungsfaktoren und ein anderes warmes Schleifenmodell verwendet. Der edeco-Wert bleibt ausdrücklich eine Impedanz-Näherung ohne normativen Ik-min/max-Nachweis. |
| PV-Anlage | Vergleichbare Wirtschaftlichkeitsfälle bei gleicher installierter Leistung, Tarifen und Betrachtungsdauer stimmen. Der edeco-Flächenansatz ist kontinuierlich; die Referenz rundet auf ganze Module ab. |
| Brandlast, Grundrechnung | Gemeinsame Bilanz: drei Kabelpositionen ergeben 315 MJ und 31.5 MJ/m bei 10 m Bezugsstrecke. Herstellerwerte und CPR-Zuordnung sind getrennte Eingaben/Nachweise. |
| PoE, Leistungsbudget | Drei DC-Leistungs-/Verlustfälle stimmen bei 20 °C und ohne zusätzliche Kontaktwiderstände. Die Referenz bezeichnet mehrere Konstanten selbst als Richtwerte; deren RP-/thermische Modellierung wird nicht als bestätigte Normgrundlage übernommen. |

Tests: `reference-fundamentals.test.ts`, `reference-installation.test.ts` und
`reference-ev-cable.test.ts` im jeweiligen Rechnerverzeichnis. Sie enthalten
die konkrete Herkunft und Genauigkeit der gespeicherten Zahlenfälle.

## Acht Dashboard-Themen

Die angemeldeten Seiten wurden erneut geöffnet und ihre sichtbaren Formeln und
Ergebnisse untersucht. Der automatisierte Bericht konnte jedoch nicht für alle
Felder verlässlich denselben Parameterzustand nachweisen. Beispielsweise wurden
gewünschte PKW-/Kosten-Testeingaben zusammen mit Ergebnissen der vorherigen
Standardkonfiguration gemeldet. Solche gemischten Zustände werden ausdrücklich
nicht als bestandene Zahlenvergleiche verwendet.

| Thema | Was weiterhin offen ist |
| --- | --- |
| Ladegrid PKW | Identischer Mehrgrid-/Lastmanagementzustand mit nachvollziehbaren Aktiv-/Wartezuständen. |
| Ladegrid E-LKW | Identische PU-Topologie, Wirkungsgrade und Begrenzungen. |
| Brandmelder | Zuordnung von Raumtyp, Decke, Höhe und Normtabellen; edeco nutzt manuelle geometrische Annahmen. |
| Selektivität | Identische Herstellerkombination und dokumentierte Randbedingungen; keine Freigabe aus blossen Nennstromverhältnissen. |
| Ladekosten | Vollständig identische Kosten-/Tarif-/Vertragsparameter, nicht nur gleiche Überschrift. |
| SIA 2056 | Identische Zonen-/Verbraucherzuordnung und Tabellenfaktoren. |
| PoE-Streckenplaner | Identische Kabel-, Temperatur-, Patch- und Kanalparameter. |
| Brandlast Fluchtweg | Belegter Kabelbestand vor/nach Sanierung statt eines leeren Beispielplans. |

Diese acht eigenen Vorprüfungen haben separate mathematische Tests; der
vollständige numerische Referenzabgleich ist damit nicht als bestanden erklärt.
Blitzschutz bleibt mit seinen separat dokumentierten Arthur-Flury-Fällen geprüft.

## Korrekturen und Darstellung

- Ein leerer, ausgeblendeter statischer Leistungsanteil blockiert dynamische
  beziehungsweise ungeregelte Ladeplanung nicht mehr.
- Bereits ausreichender Leistungsfaktor ergibt 0 Kompensationsbedarf; der
  tatsächliche Ist-Zustand bleibt sichtbar.
- Hausanschluss, Grid-Vorsicherung und weitere Gerätenennwerte verwenden
  diskrete Auswahlwerte aus den sichtbaren Referenzmenüs. Die Liste ist keine
  allgemeine Freigabe jedes Werts durch jeden Netzbetreiber. Gespeicherte
  abweichende Projektwerte werden ausdrücklich beibehalten und nicht gerundet.
- Die 63-A-Leistungsanzeige wird korrekt aus 400 V / 3~ berechnet: 43.6 kW.
- Statisch bedeutet bei edeco ein gleichmässiger Leistungsanteil für alle
  Punkte. Die Referenz aktiviert stattdessen aufgerundet ganze Stationen:
  3 × 11 kW bei Faktor 0.5 bedeuten dort 2 aktive Stationen / 22 kW, im
  edeco-Anteilsmodell 16.5 kW. Das wird nicht als identisches Verfahren bezeichnet.
- Die Referenz kann im exakt gesättigten dynamischen Fall durch Rundungsfehler
  einen roten Hinweis mit angezeigten 100 % ausgeben. edeco behält die geprüfte
  numerische Toleranz und übernimmt diesen Fehlalarm nicht.
- Grafikaufbau, Symbolik und Bedienung dienen als Inspiration. Das eigene
  Schema bleibt an die tatsächliche edeco-Modelllogik gekoppelt. Kurze
  Erklärungen und Legenden sind immer sichtbar; detaillierte Normhinweise
  und Herleitungen bleiben zusätzlich über ⓘ erreichbar.
