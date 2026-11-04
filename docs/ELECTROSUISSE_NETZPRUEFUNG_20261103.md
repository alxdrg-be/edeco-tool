# Electrosuisse NIN/NIBT: Archivprüfung und Abgleich mit dem Netzplaner

Stand: 3. November 2026. Diese Prüfung bewertet den bereitgestellten Programmstand und den aktuellen EDECO-Code. Sie ist weder eine NIN-Freigabe noch ein numerischer Gleichheitsnachweis zwischen beiden Programmen.

## Ergebnis

Das Electrosuisse-Archiv ist vorhanden und lesbar. Es enthält zehn Beispielprojekte, Kabel- und Schutzgerätedaten, Bedienhilfen sowie die Programmdateien. Für die nächste Bestandsaufnahme wird daher **kein erneuter Upload des Programms oder des Prüflisten-Screenshots benötigt**.

Die elf Prüfpunkte des Screenshots sind im Referenzprogramm nachvollziehbar. Der EDECO-Netzplaner bildet jedoch weiterhin ein vereinfachtes radiales NS-TN-Modell ab. Die neue Prüfliste macht vorhandene Prüfungen und offene Nachweise sichtbar; sie ergänzt keine bisher fehlende Netzphysik. Insbesondere PEN-Regeln, tatsächliche Abschaltzeiten, thermische Kurzschlussfestigkeit, vollständige Gerätekoordination und Steckdosen-Zusatzschutz sind noch nicht vollständig nachgebildet.

Für einen belastbaren Zahlenvergleich fehlen **zu identischen Eingaben gehörende, regulär vom Referenzprogramm berechnete Ergebnisse**. Die Beispielprojekte sind als Eingabereferenz nutzbar, enthalten aber keine befüllten zweigbezogenen Kurzschluss-Ergebnisfelder. Alte manuelle Formularwerte sind dafür kein Ersatz.

## Material und unveränderte Originale

- Bereitgestelltes Archiv: `NIN NIBT.zip`, 7'411'473 Byte.
- SHA-256: `9b7f119adc60032e8bdb4560d4354dbef858e2cd108e7525dfef0ef746b0ed64`.
- 64 Archiveinträge, darunter 22 DLLs, 18 MDBs, zwei EXEs und sechs HTML-Hilfedateien.
- Isoliert entpackte Arbeitskopie; kein Referenzprogramm ausgeführt, kein Benutzerprojekt geöffnet oder gespeichert, keine Originaldatei geändert.
- Kein Projekt `1137_GHN Basel` aus dem Screenshot im Archiv gefunden. Die vorhandenen Beispielprojekte sind andere Objekte.
- Einbezogene EDECO-Dateien: `networkModel.ts`, `networkTypes.ts`, `networkDiagnostics.ts`, `networkCheckpoints.ts`, `engineering.ts`, `voltageFactors.ts` unter `ui/src/tools/berechnungen/`.

Der mitgelieferte Lizenzvertrag untersagt Reverse Engineering, Dekompilieren und Desassemblieren. Nach Sichtung dieser Klausel wurde die weitere Binäranalyse beendet. Bereits gelesene technische Anhaltspunkte werden hier als solche eingeordnet; es wird kein Herstellerquellcode, IL-Code oder Datenbankbestand in EDECO übernommen oder mit ausgeliefert. Kabel- und Normdaten benötigen weiterhin eigene belastbare Quellen und Nutzungsrechte.

## Welche NIN-Ausgabe ist belegt?

Der Benutzer hat **NIN 2025** für das geöffnete Objekt bestätigt. Das wird durch ältere Dateinamen oder Beispielmetadaten nicht widerlegt.

Gleichzeitig sind im Archiv verschiedene historische Stände enthalten:

| Fundstelle | Beobachtung | Aussagegrenze |
| --- | --- | --- |
| Programmdateien | Kernassemblies melden Version `1.2.0.0`; der Screenshot zeigt `1.2.0`. | Programmversion bezeichnet nicht automatisch die NIN-Ausgabe eines Projekts. |
| Programmkern | Bezeichnungen für NIN 2025 sowie ältere Ausgaben sind vorhanden. | Das Vorhandensein einer Auswahl belegt nicht die fachliche Richtigkeit sämtlicher Regeln dieser Ausgabe. |
| `NIN NIBT Calc/Daten/Bsp_*.mdb`, Tabelle `Programm` | Alle zehn Beispiele tragen `NIN 2020`, Version `3.0.8`. | Das sind historische Beispiel-Metadaten, keine Widerlegung der Benutzerangabe NIN 2025. |
| `Datenbank/NIN NIBT.mdb` | Ebenfalls historischer NIN-2020-Template-Stand. | Nicht das geöffnete Benutzerobjekt. |
| `Datenbank/ETKabel.mdb`, Tabelle `Stand` | Datenhistorie mit Einträgen bis 20.09.2016. | Ein alter Historieneintrag beweist weder eine vollständige NIN-2025-Aktualisierung noch die Ungültigkeit unveränderter Tabellenwerte. |

Ein vollständiger Abgleich mit dem offiziellen NIN-2025-Normtext wurde damit nicht erbracht. Das Archiv ersetzt die zutreffenden Normstellen nicht.

## Archivinhalt, der für den Vergleich nutzbar ist

### Kabel- und Gerätemodelle

`Datenbank/ETKabel.mdb` unterscheidet unter anderem Leitermaterial, Isolierung, Kabelbauart, belastete Adern, Verlegeart, Referenzverlegeart, Anordnung, Temperatur und Häufung. Es enthält 71 Verlegearten, 19 Querschnittseinträge, 1'047 kabelbezogene Parametersätze und 1'659 Strombelastbarkeitssätze. Diese Zählwerte beschreiben den Bestand; sie sind keine Prüfung jeder Tabellenzelle.

`Datenbank/schutzmodul.mdb` besitzt Tabellen für Gerätekatalog, Kennlinien, Stützpunkte und Selektivität. Der Bestand erlaubt nicht die Behauptung, dass jede heutige Gerätefamilie beziehungsweise jede Kombination aktuell enthalten ist. EDECO besitzt im Netzplaner gegenwärtig keinen entsprechenden vollständigen Herstellerkatalog.

Die Tabellenwerte werden nicht pauschal kopiert. Bereits ein exemplarischer Vergleich zeigt unterschiedliche Annahmen: Ein kabelbauartbezogener R′/X′-Datensatz ist nicht automatisch identisch mit den generischen, querschnittsbezogenen EDECO-Richtwerten. Eine numerische Abweichung wäre ohne Abgleich dieser Annahmen noch kein Rechenfehler.

### Beispielprojekte und gespeicherte Ergebnisse

| Beispiel | Leitungen / Zweige | Verbraucher |
| --- | ---: | ---: |
| `Bsp_Baustelle.mdb` | 41 | 24 |
| `Bsp_EFH_AMO.mdb` | 33 | 17 |
| `Bsp_EFH_HHH.mdb` | 16 | 13 |
| `Bsp_Gewerbe1.mdb` | 59 | 48 |
| `Bsp_Landwirtschaft.mdb` | 62 | 38 |
| `Bsp_MFH10.mdb` | 122 | 93 |
| `Bsp_Restaurant.mdb` | 29 | 24 |
| `Bsp_Schreinerei-Wohnung.mdb` | 38 | 30 |
| `Bsp_Wohnhausumbau.mdb` | 18 | 14 |
| `Bsp_Zuleitung.mdb` | 6 | 0 |

Geprüft wurden die Tabellen und Spalten sämtlicher zehn Beispiele, insbesondere `SPGFALL`, `LEITUNG`, `VERBRAUCHER`, `SICHERUNG`, `ZWEIG`, `DOKUMENT` und `DokuDaten`:

- Alle 424 `ZWEIG`-Datensätze besitzen die Spalten `Ikmax`, `Ikmin`, `RISO`, `Leitf` und `Ausloesezeit`; diese Felder sind überall `NULL`.
- Keine zugeordneten berechneten I-/U-/Spannungsfall-Ergebnislisten oder gespeicherten Ergebnisse der elf Laufzeitprüfungen gefunden.
- Drei Beispiele enthalten zusammen sechs alte Formulare mit 330 `DokuDaten`-Feldern, darunter Installationsanzeige, Sicherheitsnachweis und Mess-/Prüfprotokoll aus 2005. Hier gibt es manuelle Kontrollhäkchen und Einzelwerte wie `txtIkl` oder `txtSpannung`.
- Diese Formularwerte besitzen keinen belastbaren Bezug zu einer aktuellen NIN-2025-Berechnung des jeweiligen Netzzweigs. Sie werden deshalb nicht als numerische Sollwerte verwendet.

Das kleinste Beispiel `Bsp_Zuleitung` ist wegen seiner sechs Leitungen für einen späteren Quellen-/Kurzschlussvergleich überschaubar. Es hat jedoch keine Verbraucher und liefert keine gespeicherten Rechenergebnisse. Ein Lastflussvergleich benötigt einen passenden belasteten Teilfall.

## Die elf Prüfpunkte und der tatsächliche EDECO-Umfang

Die deutschen Bezeichnungen sind sowohl im Benutzer-Screenshot als auch in `Datenbank/Resource.mdb`, Tabelle `Sprache`, vorhanden. Die Referenz unterscheidet zwischen bestanden, tatsächlich geprüft und zur Prüfung ausgewählt. Ein nicht durchgeführter Nachweis darf deshalb nicht allein wegen fehlender Fehlermeldung grün werden.

| Prüfpunkt | EDECO derzeit | Wesentliche offene Abgrenzung |
| --- | --- | --- |
| Leiterzuordnung | Radiale Struktur, eindeutige Anschlüsse und verfügbare Phasen werden geprüft. | Tatsächliche Leiterkennzeichnung, PEN-Führung und Ausführung nicht bestätigt. |
| Leitungsinduktivität | X′-Richtwerte nach Querschnitt sind im Rechenansatz enthalten. | Kein eigenständiger Nachweis der realen Kabelbauart und Leiteranordnung. Die Referenz unterscheidet auch vereinfachte und konkrete Kabelmodelle. |
| PEN-Reduktion | N und PE können getrennt erfasst werden. | Kein vollständiges TN-C-/TN-C-S- oder PEN-Reduktionsmodell. N-Querschnitt ist kein PEN-Nachweis. |
| Zulässiger Spannungsfall | Alle vorgeschalteten Leitungsabschnitte werden gegen ein gemeinsames Projektbudget bewertet. | Der in der Referenz sichtbare Bezug Zähler/HAK ist noch nicht als eigener Berechnungsbeginn umgesetzt. |
| Staffelung der Schutzorgane | Mehrstufige Schutzorgane werden erkannt und als offener Koordinationsnachweis erklärt. | Herstellerkennlinien, Back-up und vollständige Selektivitätsnachweise fehlen. |
| Überstromschutz der Kabel und Leitungen | Ib, In, dokumentiertes Iz, I₂ sowie gesondertes N-Iz werden verglichen; Parallelkreise werden berücksichtigt. | Iz und Prüfstromfaktoren sind Projekteingaben, keine vollständige automatische Auswahl aus den Referenztabellen. |
| Ausreichende Versorgung der Verbraucher | Anschluss-, Geräte- und Trafo-Nennströme sowie Phasenlasten werden verglichen. | Keine iterative Lastflussrechnung, keine Rückführung von Leitungsverlusten auf den Laststrom, kein Motoranlaufnachweis. |
| Abschaltbedingung bei Kurzschluss | Warmes Ik,min-Modell bei dokumentierter L–PE-Quelle; oberer LS-/RCBO-Magnetauslöser wird verglichen. | Tatsächliche Abschaltzeiten und konkrete NH-/MCCB-/Motorschutzkennlinien bleiben offen. |
| Schaltvermögen der Schutzorgane | Eingetragenes Icn von LS/RCBO/MCCB wird gegen Ik,max am Gerät geprüft. | Kein vollständiger Geräte- und Back-up-Nachweis, insbesondere keine automatische NH-Katalogprüfung. |
| Kurzschlussfestigkeit der Leitungen | Kurzschlussströme werden näherungsweise berechnet. | Thermischer I²t-/k²S²-Nachweis für L/N/PE/PEN ist im Netzmodell nicht implementiert. |
| Zusätzlicher Schutz / FI für Steckdosen | Steckdosen, RCD/RCBO und IΔn sind erfassbar. | Keine vollständige automatische Pflicht-, Typ-, Pfad-, Erdungs- oder Zeitprüfung. |

Die neue EDECO-Prüfliste in `networkCheckpoints.ts` kennzeichnet diese offenen Nachweise ausdrücklich. Bei vorhandenen Modellfehlern führen die verknüpften Diagnoseeinträge zum betroffenen Objekt und zum passenden Eingabefeld. Diese Bedienverbesserung ändert den fachlichen Nachweisumfang nicht.

## Konkrete Unterschiede vor einem Zahlenvergleich

1. **Querschnitte des gezeigten Objekts:** Der Screenshot enthält 300, 500 und 630 mm². EDECO begrenzt Aussenleiter, N und PE derzeit auf belegte Tabelleneinträge bis 240 mm². Das gezeigte Netz ist damit noch nicht vollständig abbildbar. Eine Erweiterung benötigt geeignete, belegte R′/X′- und Kabelbauartdaten.
2. **Null-Meter-Verbindungen:** Die mitgelieferte Maus-/Tastaturhilfe beschreibt ausdrücklich unbenutzte beziehungsweise direkte Verbindungen mit Länge 0 m. Solche Werte sind auch im Beispielbestand vorhanden. EDECO verlangt gegenwärtig jede Leitungslänge grösser als 0. Ein späteres ideales Verbindungselement muss physikalische und numerische Sonderfälle ausdrücklich behandeln.
3. **Lastmodell:** Die Referenz bietet unterschiedliche Verbraucheransätze und wiederholte Strom-/Spannungsberechnung. EDECO bestimmt die Lastströme an der Bemessungsspannung und summiert sie komplex; Leitungsverluste erhöhen den Verbraucheransatz nicht nachträglich. Insbesondere bei hohen Spannungsfällen sind die Ergebnisse nicht gleichzusetzen.
4. **Netz- und Nullsystemdaten:** Das Archiv enthält Quellen-R/X, Trafo-Kupferverluste, Schaltgruppe sowie R0/X0- und PEN-bezogene Leitungsdaten. EDECO verwendet ein eingeschränktes NS-TN-Ersatznetz, einen rein reaktiven Trafo und eine separat vorgegebene skalare L–PE-Quellenimpedanz. Ein TT-Erdungs- und RCD-Nachweis ist damit nicht abgedeckt.
5. **Spannungsfallbezug:** Referenz und Screenshot unterscheiden Zähler und HAK. In EDECO verschiebt ein Zähler-/HAK-Symbol den Berechnungsbeginn nicht; der ganze modellierte Pfad zählt. Vor einem Vergleich müssen Bezugsbeginn und Budget übereinstimmen.
6. **Spannungsfaktor:** Der gelesene Referenzstand weist beim maximalen Kurzschlussstrom eine spannungsabhängige 1.05-/1.10-Verzweigung auf. EDECO unterscheidet ausdrücklich die gewählte Netz-Spannungstoleranz mit cmax 1.05 oder 1.10. Diese Annahmen müssen im Vergleich angeglichen und anhand der zutreffenden Quelle geprüft werden. Nur zur Zahlenangleichung wird EDECO nicht auf den älteren Faktor zurückgesetzt.
7. **Leiter- und Fehlertemperatur:** Die Referenz besitzt unterschiedliche Kurzschluss-/Temperaturverfahren; EDECO verwendet für Ik,min fest 80 °C und cmin 0.95. Gleichlautende Temperaturwerte allein bedeuten wegen der unterschiedlichen Schleifen-/Nullsystemmodelle noch keine Gleichwertigkeit.
8. **Gerätekennlinien und thermischer Schutz:** Kennlinien, Abschaltzeiten und Leitungs-Kurzschlussfestigkeit sind eigenständige Referenzfunktionen. EDECOs allgemeiner I₂-Faktor und LS-Magnetvergleich ersetzen diese Funktionen nicht.

Diese Unterschiede sind keine Aufforderung, die private Herstellerimplementierung zu kopieren. Die fachlichen Erweiterungen brauchen ein eigenes dokumentiertes Modell, geeignete veröffentlichte beziehungsweise lizenzierte Eingangsdaten und unabhängige Referenzfälle.

## Was für belastbare Vergleichsfälle tatsächlich noch fehlt

Für das Lesen des Programmbestands und für die elf Prüfpunkte liegt genug Material vor. Für einen späteren numerischen Gleichheitsvergleich werden dagegen die **Ergebnisse eines regulären Referenzlaufs** benötigt, jeweils mit:

- eindeutigem Teilnetz und identischen Eingaben: Ausgabe NIN 2025, TN/TT, Spannung und Spannungsfaktoren, Quelle/Trafo, Leiter-/Nullsystemdaten, Lastansatz, Temperaturen, Verlege- und Korrekturfaktoren;
- berechneten Last- und Neutralleiterströmen, Knotenspannungen, Teil-/Pfadspannungsfall, Ik,max/Ik,min sowie verwendeten Abschaltzeiten;
- sichtbarem Prüfstatus und der tatsächlichen Geräte-/Kabelzuordnung, insbesondere bei NH-, RCD- und thermischen Nachweisen;
- einer vorab begründeten Vergleichstoleranz, die dokumentierte Modellunterschiede berücksichtigt.

Sinnvolle erste Fälle sind ein kurzer symmetrischer TN-Abgang, ein einphasiger Abgang mit Neutralleiter und ein gezielt fehlerhafter Schutzfall. Ein regulär erzeugter Bericht oder das Ablesen der berechneten Werte an einer separaten Testkopie genügt; das Originalobjekt muss dafür nicht überschrieben werden. Das Archiv selbst muss nicht noch einmal geliefert werden.

Bis solche Ausgaben vorliegen, lautet der Status: **Bestands- und Funktionsabgleich durchgeführt, numerischer Vergleich mit Electrosuisse nicht nachgewiesen**. Bestehende eigene Modelltests prüfen Regressionen und bekannte Formeln; sie belegen keine vollständige Übereinstimmung mit Electrosuisse oder NIN 2025.
