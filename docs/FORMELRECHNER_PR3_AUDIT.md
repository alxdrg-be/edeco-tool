# Formelrechner: PR #3 und E-Memory

Stand: 3. November 2026. Ausgangspunkt ist PR #3,
`3916952fb9be33afe5d17ee0f2842b44081059c2`.

Die neuen Rechenfunktionen wurden gezielt übernommen und geprüft. Der ältere
PR-Header und die dortigen Aufgabenbeschreibungen wurden nicht in die aktuelle
Navigation übernommen. Der Formelrechner ist ein Bereich des Elektro-Memory;
die bestehenden 26 Rechner bleiben erreichbar.

## Geprüfte Grundbeziehungen

| Bereich | Rechenweg und Grenzen |
| --- | --- |
| Ohm / Leistungskreis | Alle sechs gegebenen Paare U/I, U/R, I/R, P/U, P/I, P/R. Daraus folgen die zwölf Umstellungen. Genau zwei Angaben; positive endliche Widerstände und nicht negative Beträge. Unbestimmte Nullfälle ergeben keinen Ersatzwert. |
| 1~/3~-Wirkleistung | Elektrische Wirkleistung = U·I·cosφ beziehungsweise √3·ULL·I·cosφ. Mechanische Nutzleistung zusätzlich mit η multiplizieren. Die inverse Stromrechnung verwendet ausdrücklich die Nutzleistung und η. |
| Leistungsdreieck | S = hypot(P,Q), alternativ P/cosφ oder Q/sinφ. Winkel in Grad; Q als Betrag. Bei Nullleistung wird kein Leistungsfaktor erfunden. |
| Leiterwiderstand / Leitwert / Stromdichte | R = ρ·l/A mit ρ in Ω·mm²/m, G = 1/R oder I/U in S, J = I/A in A/mm². Material-/Temperaturwerte sind Eingaben; J bestätigt kein zulässiges Iz. |
| Kondensator / Spule | Xc = 1/(2πfC), C aus µF nach F umgerechnet. XL = 2πfL mit L in H. Ideale sinusförmige Bauteilmodelle; kein Wicklungsverlustnachweis. |
| Stern / Dreieck | Stern: Ustr = ULL/√3, Istr = ILL. Dreieck: Ustr = ULL, Istr = ILL/√3. Die gegebene Schaltung wird gewählt; es wird keine Motorumschaltfreigabe abgeleitet. |
| Licht | E = Φ/A, Φnotwendig = E·A/η, n = ceil(Φgesamt/ΦLampe). Die erweiterte Leuchtenplanung trennt Wartungsfaktor und Raumindex. Der optionale Strom dort setzt cosφ = 1 voraus. |
| Energie / Kosten | kWh = kW·h, 1 kWh = 3.6 MJ; inverse Leistung aus kWh/h. Rp/kWh·kW·h ergibt Rp, danach einmal durch 100 nach CHF. |
| Zählerleistung | 3600·n/(c·t) ergibt kW bei c in U/kWh und t in Sekunden. U bezeichnet hier Umdrehungen/Impulse, nicht Volt. |
| Mechanische Energie | m·9.81·h ergibt J = N·m, nicht nm. Es wird eine angehobene Höhe als Betrag eingegeben. |
| Umrechnung | Metrische PS: 1 PS = 0.73549875 kW. 1 Zoll = 2.54 cm. Die im PDF gerundeten Werte werden als Rundungen behandelt. |
| Zwei ideale R/C | R-Reihe addiert, R-Parallel verwendet die Summe der Kehrwerte. C-Parallel addiert, C-Reihe verwendet die Summe der Kehrwerte. |

Die PDF-Zuordnung wird vom strukturierten E-Memory-Katalog geführt. Gedruckte
Einheitenfallen werden dort als Präzisierungen kenntlich gemacht. Norm- und
Sicherheitstabellen des Merkblatts werden dadurch nicht automatisch zu aktuellen
Rechenregeln.

## Korrekturen gegenüber PR #3

- Neue Kurzschlussfälle verwenden bei +10 % Spannungstoleranz cmax = 1.10;
  +6 % mit 1.05 bleibt ausdrücklich wählbar. Kaltes und warmes Modell werden
  nicht als garantierte obere/untere Schranken ausgegeben. Vorgelagerte
  Netz-/Fehlerschleifenanteile, Gerätekoordination und eine vollständige
  IEC-60909-Studie bleiben ausserhalb dieses vereinfachten Rechners.
- Der PA-Ansatz ist auf die bereits dokumentierte publizierte Cu-Zuordnung
  4–120 mm² begrenzt. Er bestätigt keine universelle NIN-Tabelle, PEN-Zulässigkeit
  oder komplette Erdungsanlage.
- Motor-Iz wird aus derselben publizierten Datenquelle wie im bestehenden
  Workbench-Rechner bezogen. Eine zweite, angeblich normative Tabelle wird nicht
  gepflegt. Temperatur, Häufung, Anlauf- und Schutznachweise bleiben separat.
- Die EV-Rechnung bewertet Haus-, Grid- und stärksten Phasenstrom getrennt.
  PV-/Speicherleistung wird am tatsächlichen Anschluss begrenzt. Fehlende
  Anschlussreserve und eine aktive Speicherannahme ohne Betriebsstunden ergeben
  keinen scheinbar günstigen Ersatzwert. Referenzfaktoren stammen aus derselben
  gekennzeichneten Kurve wie im Ladegrid; sie sind keine unabhängig bestätigte
  SIA-Tabelle oder Simulation des Reglers.
- Ungültige Auswahlen, nicht ganzzahlige Parallelleiter, nicht endliche
  Rechenergebnisse und Spannungsfälle bis über die Nennspannung werden abgefangen.
  Bei positiver noch so kleiner Lichtanforderung wird mindestens eine Leuchte
  gewählt; kein Abrunden auf null durch eine pauschale Rechentoleranz.

## Referenzfälle und Verifikation

Die automatischen Tests enthalten unter anderem U=12 V, I=2 A, R=6 Ω, P=24 W
aus allen sechs Paaren; 10 µF bei 50 Hz → 318.309886 Ω;
10 Zählerumdrehungen, 1000 U/kWh, 36 s → 1 kW;
2 kW·3 h·25 Rp/kWh → 150 Rp = CHF 1.50;
100 kg um 3 m anheben → 2943 J; P=3 kW und Q=4 kvar → S=5 kVA.

Weitere Tests prüfen einphasige Phasenüberlast trotz ausreichender kW-Summe,
PV hinter einem kleinen Grid, Null-/Überlaufgrenzen, Leiter-/Temperaturmodelle,
Leuchtenrundung sowie falsche Eingaben ohne stille Standardwerte.

Diese numerischen Prüfungen bestätigen die genannten Gleichungen und
Implementierungsfälle. Sie sind keine vollständige Norm- oder Anlagenfreigabe.
