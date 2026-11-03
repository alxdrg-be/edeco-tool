# Erneuter Abgleich: Leitungen, Schutz und Netzplaner

Stand: 2. November 2026. Geprüft wurden acht Einstiege auf
elektro-rechner.ch und die dazugehörigen nativen EDECO-Modelle.
Die Prüfung erfolgte erneut im eigenen angemeldeten Browser. Cookies blieben
im Speicher; Zugangsdaten, Sitzungsdateien und persönliche Projekte wurden
nicht exportiert. Account-/Projekt-Speicherfunktionen wurden nicht betätigt.

Dies ist eine Eingabe-, Bedienungs- und Zahlenprüfung. Sie bestätigt keine
vollständige Normkonformität und keine vollständige Funktionsgleichheit des
Netzplaners. Serverseitiger PHP-Code und lizenzierte Original-Normtabellen
wurden nicht eingesehen.

## Tatsächlich durchgeführte Interaktionen

| Referenzrechner | Gewechselte native Auswahlwerte | Rechen-/Verlegeart-Schaltflächen | Geöffnete FAQ |
| --- | ---: | ---: | ---: |
| NIN-Kabel | 30 | 27 | 4 |
| Zuleitung / Strombelastbarkeit | 10 | 9 | 4 |
| Spannungsfall | 15 | 7 | 5 |
| LS-Schalter | 49 | 8 | 4 |
| Kurzschlussstrom | 27 | 11 | 5 |
| Potenzialausgleich | 24 | 0 | 4 |
| Selektivität | 131 | 0 | 0 |
| Summe dieser sieben Formulare | 286 | 62 | 26 |

Zusätzlich wurden in der Quelle drei weitere Schutzstufen angefügt
(insgesamt sechs), auf sieben Rechnerseiten die kompakten mobilen
Ergebnis-Panels geöffnet und im Netzplaner fünf Ausgangsknoten samt
Eigenschaften sowie eine Leitung ausgewählt. Die dortigen Menüs wurden
mit weiteren 80 Knoten- und 43 Leitungs-Auswahlwerten tatsächlich bedient.
Das ergibt mindestens 409 protokollierte native Auswahlwechsel. Diese Zahlen beschreiben Interaktionen,
nicht 409 unabhängige normativ geprüfte Zahlenfälle oder sämtliche Kombinationen.

## Konkrete Befunde und Umsetzung

### NIN: Die geführte Bauartauswahl war nicht gleichwertig

Die Referenz trennt zuerst „Einadrig / Mehradrig“ und bietet danach die
passenden Verlegearten mit kurzen Beschreibungen an. EDECO enthielt bereits
die Tabellenpfade beider Bauarten, bot sie aber gemeinsam in einer langen
Liste mit teilweise blossen Codes wie A1/B1/B2 an. Diese Bedienungslücke konnte
den Eindruck fehlender Funktionen erzeugen.

Ergänzt sind eine explizite Leiter-/Kabelbauart, beschreibende Verlegeartnamen
und gefilterte Auswahlmöglichkeiten. Ein bewusster Wechsel ordnet
A1/A2, B1/B2 und F/E entsprechend zu; gemeinsam mögliche C-/D-Verlegearten
bleiben erhalten. Es werden keine zusätzlichen Iz-Werte erzeugt.
D1/D2 bleiben ausschliesslich mit manueller Projektgrundlage nutzbar.

Neue Fälle beginnen mit Mehradrig/B2. Gespeicherte Fälle ohne das neue Feld
behalten ihre bisherige Verlegeart in „Alle · Bestandsansicht“. Unbekannte oder
widersprüchliche explizite Eingaben werden abgewiesen. Beim Laden wird keine
gespeicherte Verlegeart still ersetzt.

Frisch im Browser beobachtet: Cu 6 mm², PVC 70 °C, drei belastete Adern,
30 °C, keine Häufung: **B1 = 36 A, B2 = 34 A**. Die nativen Modelle
und neue Regressionstests reproduzieren beide Anzeigen.

### Selektivität: Spannungsfaktor an die übrigen Modelle angeglichen

Das variable Stufenmodell verwendete noch fest 1.05, während Netzplaner und
Kurzschlussrechner bereits eine dokumentierte Spannungstoleranz anbieten.
Diese verbleibende Inkonsistenz ist behoben: neue Fälle verwenden +10 %
mit cmax 1.10; +6 % mit 1.05 bleibt auswählbar. Fehlende gespeicherte
Toleranzen behalten 1.05 mit ausdrücklichem Altstand-Hinweis.

Ein bereits maximaler Quellenstrom wird mit demselben gewählten Faktor in
eine Quellenimpedanz zurückgerechnet. Es gibt keinen zweiten Aufschlag auf
den bekannten Quellenwert. Eine Null-Leitung reproduziert deshalb bei
230 und 400 V jeweils den vorgegebenen Quellenstrom.

Der alte Quellenfall 5 m / 150 mm², 30 m / 50 mm², 40 m / 2.5 mm² bleibt
bei 1.05 erhalten: Ik,max gerundet **9.82 / 7.96 / 0.39 kA**.
Mit 1.10 ergeben sich rund **9.83 / 8.05 / 0.412 kA**.
Eine ausdrücklich dokumentierte Paargrenze von 0.4 kA wird im zweiten Fall
überschritten. Ein neuer Browserfall prüft den tatsächlichen Wechsel der
Bewertung über die Auswahl, nicht nur eine geänderte Beschriftung.

Generische Staffelungsverhältnisse oder ein Anbieterstatus „vollständig
selektiv“ werden weiterhin nicht als vollständige Herstellerfreigabe übernommen.

### Potenzialausgleich: Frischer Zahlenfall bestätigt die getrennten Pfade

Quelle bei Phasenleiter/PEN je 6 mm², EPA nicht vorhanden:

| Wert | Ohne äusseren Blitzschutz | Mit äusserem Blitzschutz |
| --- | ---: | ---: |
| HPA | 6 mm² | 10 mm² |
| ÖPA | 4 mm² | 4 mm² |
| PE | 6 mm² | 6 mm² |
| FE im Referenzansatz | 6 mm² | 10 mm² |

Der native Rechner bildet dies bereits ab. Ein zusätzlicher unabhängiger
Quellenfall sichert die Anzeigen. Daraus folgt keine allgemeine normgerechte
Auslegung jeder Erdungs-/Blitzschutzanlage.

## Umfang der acht Modelle und verbleibende Unterschiede

| Thema | Vergleichener Umfang | Bewusst verbleibende Begrenzung |
| --- | --- | --- |
| NIN-Kabel | Bauart, Verlegearten, PVC/XLPE, 2/3 Adern, Parallelleiter, Temperatur, Häufung, gering belastete Kreise und Querschnittssuche | Nur belegte Referenzreihen. Unsupported Kombinationen bleiben gesperrt; D1/D2 manuell. |
| Zuleitung | PVC/XLPE/CFW, Ein-/Mehrleiter, Querschnitte und 1–4 parallele Kreise | Ganze-A-Rundung der Quelle je Kreis wird nicht vor der Summierung kopiert; CFW bleibt auf den belegten Ansatz begrenzt. |
| Spannungsfall | 1~/3~, Cu/Al, Querschnitt, Strom, Länge, cos φ und Grenzwert | Ein Abschnitt und dokumentiertes Temperatur-/Reaktanzmodell; keine vollständige Kabel- oder Schutzdimensionierung. |
| LS | Alle 20 Nennströme, 25 Vorsicherungswerte, 5 Icn-Klassen, B/C/D/K/Z und 3 Stromkreisarten | Keine pauschale Selektivitäts-/Schutzfreigabe aus Verhältnis oder generischer Kennlinie. K/Z und Hager-Referenzkoordination bleiben eingegrenzt. |
| Kurzschluss | Quellen-/Trafoansatz, Spannung, parallele Trafos/Leiter, Cu/Al und Leiterpfad | Die Quelle bleibt beim festen cmax 1.05; EDECO verwendet bei neuen +10-%-Fällen ausdrücklich 1.10. Keine garantierten oberen/unteren Schranken. |
| PA | Phasen-/PEN-/EPA-Werte und Blitzschutzschalter | Eingrenzte Cu-Zuordnung plus manuelle Projektwerte; kein vollständiger Erdungs-/Anschlussnachweis. |
| Selektivität | 1–6 Stufen, Gerätetypen, FI-Typ/-Strom, Kabeltyp, Material, Querschnitt, Länge und Leitersystem | Kein automatischer vollständiger Kennlinien- oder Energie-Selektivitätsnachweis. Paargrenzen benötigen konkrete Herstellerbelege. |
| Netzplaner | Fünf Referenzknoten und Leitungseigenschaften frisch geöffnet; alle dort angebotenen Auswahlwerte bedient | EDECO ist weiterhin ein radiales 400/230-V-TN-Modell und kein vollständiger Nachbau des Anbieterplaners. Siehe unten. |

### Netzplaner: Nachweisbare grössere Funktionslücken

Die Quelle bietet in der Verbraucher-Eigenschaft **69 benannte
„NIN Verbrauchertyp“-Vorgaben** plus leeren Eintrag an. EDECO bietet dagegen
allgemeine Verbrauchertypen mit eigenen, sichtbaren Leistungs-/cos-φ-Eingaben.
Eine vollständige lizenzierte Verbraucherbibliothek wurde nicht erfunden oder
als übernommen ausgegeben.

Weitere Unterschiede sind die Quellenauswahl TN-C/TN-C-S/TN-S/TT/IT,
eine anlagenweite Gleichzeitigkeit sowie Primär-/Sekundärspannungen beim
Transformator. EDECO begrenzt sein Rechenmodell bewusst auf die dokumentierte
radiale 400/230-V-TN-Anwendung; TT-/IT-Fehlerschleifen und beliebige
Spannungstransformationen sind keine still mitberechneten Funktionen.
In der Leitungseigenschaft bietet die Quelle Kabeltyp, Querschnitt,
Phasensystem, Parallelkabel und Verlegeart an. EDECO verwendet für den
Überlastnachweis weiterhin explizit dokumentierte Iz-Werte und eigene
Leiter-/Temperaturdaten statt einer behaupteten vollständigen
NIN-Kabeldimensionierung im Planer.

Deshalb ist eine Aussage „alles von elektro-rechner.ch ist vollständig
übernommen“ insbesondere für den Netzplaner weiterhin unzutreffend.
Diese Lücken benötigen eine gesonderte fachliche und datenseitige Umsetzung.

## Belege und Prüfung

- Eigene neue Modell-/Migrationstests in `installationMethodChoices.test.ts`,
  `installationReaudit.test.ts`, `selectivityStages.test.ts` und
  `migrateInputs.test.ts`.
- Zwei echte Browserprüfungen in `backend/tests/test_installation_reaudit_ui.py`:
  Bauartfilter samt Altstand-Erhalt und tatsächlicher Paargrenzenwechsel.
- Produktionsbuild erfolgreich; die zwei Browserfälle bestanden auf diesem
  Stand. Die abschliessende gemeinsame Gesamtsuite wird separat protokolliert.
- Frische Eingabe-/Interaktions-JSONs und reine Rechner-Screenshots liegen
  ausserhalb des Repositorys unter
  `/workspace/scratch/elektro-reaudit-installation-20261102`.
  Zugangsdaten, Cookies oder persönliche Projektdaten sind kein Bestandteil
  dieser Belege.
