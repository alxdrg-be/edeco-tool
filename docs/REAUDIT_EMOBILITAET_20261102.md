# Erneuter Abgleich: E-Mobilität und Ladekosten

Stand: 2. November 2026. Geprüft wurde der Quellstand nach Build 20 und eine
frische angemeldete Browser-Sitzung der Referenzseite. Zugangsdaten und Cookies
blieben ausschliesslich im Arbeitsspeicher. Es wurden keine Anbieterprojekte
gespeichert, geändert oder gelöscht. Die Prüfung betrifft sichtbare Eingaben,
Client-Rechenzustände und Ergebnisse; der PHP-Servercode und lizenzierte
Originalnormen wurden nicht eingesehen.

## Tatsächlich geöffnete Auswahl und Erweiterungen

| Referenz | Frische Interaktion | Abgleich mit Toolhub |
| --- | --- | --- |
| [E-Mobilität](https://www.elektro-rechner.ch/Rechner/e-mobility-rechner.html) | Haus-/Grid-Sicherung und Ladeleistung als native Auswahl geöffnet; im statischen Modus zusätzlich die Anwenderklasse. Alle vier FAQ und Ergebnisdetails aufgeklappt. Dynamisch und statisch mit 6 Punkten, AC 11/22 kW verglichen. | Haus/Grid/Reserve, Anzahl, Leistung, Ladeart, LM, Kurven/manuelle Faktoren, Betriebszeit, Verbrauch, PV/Speicher und Anschlussort vorhanden. Neue eigene Leistungswerte sind im Einzelrechner bereits zugänglich. |
| [Ladegrid PKW](https://www.elektro-rechner.ch/premium/ladegrid-rechner.php) | Native Auswahl in Ausgangs-, statischem und erweitertem Zustand geöffnet; Grid und Punktgruppe über Plus ergänzt. Eigene Leistung tatsächlich ausgewählt, hinzugefügt und auf 17 kW geändert. | Mehrere Grids, Vorsicherungen, LM/Faktoren je Grid, Anwenderklassen, gemischte AC/DC-Gruppen, Phasen, Wirkungsgrad, Mindestleistung, Erzeugung und Anschlussort sind vorhanden. Der eigene kW-Eingabepfad fehlte in der Oberfläche und ist ergänzt. |
| [Ladegrid LKW](https://www.elektro-rechner.ch/premium/ladegrid-lkw.php) | Auswahl für Einspeisung/Grid, Module und Säulen geöffnet; PU, Säule und weiteres Grid hinzugefügt. Statisch/40 % geprüft. Benutzerdefinierte PU und Säule ausgewählt und auf 137/412 kW geändert. | Module, Zuordnung, AC/DC-Bezug, Wirkungsgrad, CCS/MCS, Grid-LM und Aktiv/Wartend sind vorhanden. Eigene Modul-/Punktleistungen waren im Modell möglich, in der Oberfläche aber nicht neu eingebbar; dieser Pfad ist ergänzt. |
| [Ladekosten](https://www.elektro-rechner.ch/premium/ladeinfrastruktur-kostenrechner.php) | Basic/Advanced umgeschaltet, Startjahr und Netz-Erweiterungsauswahl geöffnet, technische Eingaben erfasst. Alle 60 Jahres-/Klassenfelder zusätzlich mit je einem Ladepunkt belegt. | Vier Vertragsmodelle und eigener Projekt-/Referenzansatz vorhanden. Die bisherige Grenze von 24 Kostenpositionen reichte nicht für alle 4 × 15 Ausbaukohorten. Parser und Oberfläche sind gemeinsam auf 64 begrenzt. |

Die native Auswahl wurde tatsächlich geöffnet und geschlossen; die Optionen
wurden nicht nur aus Überschriften abgeleitet. Technische Formulare erfassten
11 Felder im Einzelrechner, 21 im PKW-Ausgangszustand, 16 im LKW-Ausgangszustand
und 100 im Kostenrechner, jeweils ohne Projekt-/Kontospeicherfelder. Nach dem
Hinzufügen weiterer Grids/PU-Gruppen entstanden weitere echte Eingabefelder.
Es sind keine pauschalen „Vollständigkeit erreicht“-Zahlen: Auswahlzustände mit
eigenen Werten und die nachfolgenden Unterschiede sind gesondert bewertet.

## Konkrete Korrekturen

- PKW, LKW-Power-Unit, DC-Abgabepunkt und Projekt-Kostenposition erhalten
  „Eigene Leistung …“ mit anschliessender kW-Eingabe. Einheit und zulässiger
  Bereich stehen am Feld. Leere, nicht numerische oder unzulässige Werte
  verhindern das Ergebnis; es wird keine Ersatzleistung eingesetzt.
- PKW-Gruppen speichern ausdrücklich `powerMode: custom`, damit beispielsweise
  eine benutzerdefinierte 11-kW-Leistung nicht automatisch zu einer belegten
  Besucher-Standardkurve wird. Bestehende Gruppen ohne dieses Feld behalten
  ihre bisherige Interpretation. Eigene und Standardleistungen werden bei
  der Rundung statischer Kurvengruppen getrennt geführt.
- Eigene PU-Leistungen reichen wie in der Referenzeingabe bis 5000 kW.
  Die Berechnung begrenzt anschliessend weiterhin PU-, Grid- und Hausbudget;
  ein zulässiger Zahlenbereich ist keine Geräte- oder Netzfreigabe.
- Die Kostengrenze ist als `COST_MAX_ROWS` gemeinsam in Parser und Editor
  hinterlegt. Alle 60 Klassen-/Jahreskohorten können erfasst werden; mehr als
  64 Positionen werden weiterhin ausdrücklich abgewiesen.

## Frische Zahlenfälle

| Fall | Beobachteter Referenzwert | Nachprüfung |
| --- | --- | --- |
| Einzel-EV: 125-A-Haus, 63-A-Grid, 20 kW Reserve, 6 × 11 kW, dynamisch, 10 h, 15 kWh/100 km | 43.6 kW gesamt, 6 ladend/gedrosselt, 436.5 kWh/Tag, 72.7 kWh und 485 km je aktivem Punkt | Gerundete Anzeigen und identische Eingaben erfasst. Unterschiedliche Standardbeispiele werden nicht als identischer Ausgangsfall ausgegeben. |
| PKW: ein 125-A-Grid, 250-A-Haus ohne Reserve, ein eigener 17-kW-3~-Punkt, ohne LM | 17 kW; 24.5373864406 A je Leiter | Neuer unabhängiger Zahlen-/Serialisierungsfall. |
| PKW: 4 Standard-11-kW- plus 4 eigene 11-kW-Punkte, Bewohnerkurve, statisch | Zwei getrennte Kurvengruppen; 4 aktive Punkte, 44 kW | Verhindert das stille Zusammenfassen eigener und standardisierter Gruppen. |
| LKW: 1 × 137 kW AC, η = .97, ein eigener 412-kW-Abgabepunkt | 137 kW AC, 132.89 kW DC, 1 Säule | Umrechnung wirkt genau einmal; Nennleistung 412 kW bleibt Eingabewert. |
| Kosten: Basic, ursprüngliche 4 AC-Punkte | V1/V2/V3/V4: 94'200 / 98'100 / 97'700 / 102'900 CHF | Erneut beobachtet; bereits vorhandener Referenztest bleibt erhalten. |
| Kosten: Advanced, ursprüngliche 4 AC-Punkte | 122'306.64 / 126'206.64 / 125'806.64 / 102'157.20 CHF | Erneut beobachtet; bereits vorhandener Referenztest bleibt erhalten. |
| Kosten: Basic, je 1 Punkt jeder der 4 Klassen in jedem der 15 Jahre | 9'154'663.636364 / 10'281'190.909091 / 8'753'727.272727 / 9'344'618.181818 CHF | Neuer 60-Kohorten-Test gegen die frischen vier Referenzgesamtsummen. |

## Unterschiede, die nicht als fehlende Formel versteckt werden

- Standardbeispiele unterscheiden sich deutlich: Der öffentliche Anbieter
  startet mit 125/63 A, 20 kW Reserve, 4 × 7.4 kW und 15 kWh/100 km; EDECO
  bisher mit 160/125 A, 30 kW, 10 × 11 kW und 18 kWh/100 km. Gleiche Rechner
  liefern deshalb beim blossen Öffnen verschiedene Werte. Ein ausdrücklich
  bezeichnetes Vergleichsbeispiel ist nachvollziehbarer als eine stille
  Veränderung gespeicherter Projekte.
- Im Kosten-Projektmodell zählt die tatsächliche Nennleistung, im datierten
  Anbieteransatz das Klassenäquivalent. Beispielsweise entspricht die
  80–150-kW-Klasse dort 100 kW-äq. Dies muss vor einem DC-Vergleich passend
  ausgewählt werden; beides sind unterschiedliche, sichtbare Annahmen.
- Der PKW-Anbieter zeigt zusätzliche LKW-Schnellwahlen. Elektrisch gleiche
  DC-Gruppen sind manuell abbildbar; die LKW-spezifische Schnellwahl und deren
  automatische Faktor-1-Regel sind im PKW-Werkzeug keine eigene Fahrzeugklasse.
  PKW-Kurven dürfen nicht allein wegen einer frei eingegebenen Gruppenbezeichnung
  als LKW-Kurve ausgegeben werden. Ein eigenes LKW-Depotmodell ist vorhanden.
- Referenz-Kabelquerschnitte stammen aus einer pauschalen Strom-/Querschnitts-
  Zuordnung ohne vollständigen Verlege-/Temperatur-/Häufungsnachweis. Toolhub
  übernimmt diese Hinweise nicht als automatisch bestätigte Kabeldimensionierung.
  Kontextlinks zur Kabelvorprüfung sind dafür geeigneter.
- Der bereits dokumentierte PKW-Summenwiderspruch und unterhalb eines echten
  Minimums noch aktive LKW-Punkte werden weiterhin nicht übernommen. Toolhub
  erhält gemeinsame Phasen-/Leistungsbilanzen und weist Unterversorgung aus.
- Private Anbieterprojekte, Bibliothekseinträge, Chat- und Kontofunktionen werden
  nicht kopiert. Lokale Projekt-/Ablagefunktionen haben eigene Speicherwege.

## Gestaltung und Wissens-Verknüpfung

Das bisherige generische „Positionsliste öffnen“ verbirgt gerade die wichtigen
Grid-/PU-/Kostenstrukturen. Ein kurzer Einstieg mit Mengen und direkten
Hinzufügeaktionen am Parameter-/Diagrammbereich macht die vorhandenen
Funktionen besser erkennbar; die langen Bearbeitungslisten können weiterhin
eingeklappt starten.

Der bisherige Ladeinfrastruktur-Artikel hatte nur drei allgemeine Abschnitte.
In der Referenz werden zusätzlich Fehlerstromschutz/DC-Fehlerstromüberwachung
und die konkrete Faktorgrundlage erklärt. Diese Grundlagen gehören als kurze
aufklappbare Texte in den Wissens-Hub, mit passenden Kabel-/Schutzrechnern und
ohne eine daraus erfundene RCD-, Geräte- oder Normfreigabe.

## Nachweise

Arbeitsbelege ausserhalb des Repositorys:
`/workspace/scratch/re-audit-ev-20261102/`. Darin liegen ausschliesslich
technische Auswahlzustände und Zahlenfälle; keine Zugangsdaten oder Cookies.
Fremde vollständige Webseiten werden nicht mit dem Produkt ausgeliefert.

Geänderte Regressionsdateien: `chargingCosts.test.ts`, `chargingGrid.test.ts`.
Neue Browserprüfung: `backend/tests/test_charging_custom_power_ui.py` für eigene
17-/137-/412-kW-Werte, Speicherung, ungültige Werte und Wiederherstellung.
Die Zahlenfälle sind Datenvergleiche und keine unabhängige Normzertifizierung.

Verifikation dieser Ergänzung: **38 Charging-/Kostenmodelltests bestanden**
(einschliesslich fünf neuer Fälle) und **zwei echte Browserprüfungen bestanden**.
Die Browserfälle verwenden die gemeinsame Toolhub-Navigation und den neuen
„Struktur bearbeiten“-Einstieg, wählen eigene Leistungen tatsächlich aus und
prüfen die Werte nach einem Neuladen sowie Fehlerzustände ohne Ersatzwerte.
Die vollständige Typprüfung war nach Zusammenführung der parallelen Modelle
erfolgreich. Keine Commits oder Veröffentlichungen aus diesem Teilauftrag.
