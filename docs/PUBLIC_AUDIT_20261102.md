# Öffentliche Rechner: Quellen- und Funktionsprüfung

Stand: 2. November 2026. Die vorhandenen Modelle von `main` wurden beibehalten.
Alle 16 öffentlichen Rechner wurden erneut abgerufen und ihre Eingabefelder,
Auswahlwerte sowie ausgelieferte Clientlogik mit dem bestehenden Umfang
verglichen. Der angemeldete Browserrundgang enthält die gleichen öffentlichen
Seiten; die zusätzliche öffentliche Brandlast-Grundrechnung wird separat vom
Premium-Vorher-/Nachher-Vergleich gezählt.

Dies ist ein Abgleich veröffentlichter Referenzfunktionen. Ausgelieferte
Clientlogik und Zahlenstände sind keine unabhängige Bestätigung der NIN-, VKF-,
IEEE- oder Herstellerkonformität. Serverseitiger PHP-Quellcode wurde nicht
eingesehen. Eine vollständige Gleichheit aller möglichen Bedienzustände wird
nicht behauptet.

## Neue konkrete Befunde und Änderungen

### Verlustleistung: 300 mm² Kupfer

Die Referenz bietet 300 mm² mit R′₂₀ = 0.0601 Ω/km an. edeco hatte diesen
Querschnitt wegen des fehlenden X′-Richtwerts vollständig gesperrt. Bei DC oder
cos φ = 1 wird X′ jedoch nicht benötigt. Diese Fälle und die Querschnittssuche
unterstützen nun auch 300 mm² Cu. Andere AC-Leistungsfaktoren bleiben für
300 mm² ohne belegtes X′ ausdrücklich gesperrt; ein Ersatzwert wird nicht erfunden.

Frischer tatsächlicher Browserfall der Referenz: 300 mm², 200 A, 100 m, 400 V,
55 °C, ein Leiter je Phase, 8 h/Tag, 250 Tage/Jahr, drei Jahre, 0.25 CHF/kWh:
**820.40 W, 2.368 V, 0.59 %, 1’230.60 CHF**. Der entsprechende native Test prüft
die vier beobachteten Anzeigen nach derselben Ausgaberundung.

### LS: ausdrücklich eingegrenzter Hager-Backup-Vergleich

Ein zusätzlicher optionaler Modus bildet die publizierten Referenzwerte für
MBN/MCN mit B/C bei 6 kA sowie NBN/NCN/NDN mit B/C/D bei 10/15/25 kA ab.
Er ist auf LS bis 63 A und die jeweils veröffentlichten NH-Grössen beschränkt.
Die Quelle schreibt die Werte einem Hager-Handbuch S.54 zu; der Originalnachweis
ist nicht unabhängig eingesehen worden. Deshalb bleibt das Ergebnis dieses
Modus eine Warnung/Vorprüfung, selbst wenn die Zahlenbedingung passt.
Manuelle belegte Koordination und „keine Koordination“ bleiben erhalten.

Tatsächlich im Browser beobachtet:

- B16, NH125, 6 kA → 25 kA publizierte Backup-Grenze.
- B16, NH160, 10 kA → 60 kA publizierte Backup-Grenze.
- 3-kA-Gerät → kein Tabellenwert.

Die Referenz zeigt bei B80, NH125, 6 kA weiterhin 25 kA an, obwohl ihr eigener
Kommentar LS über 63 A ausdrücklich ausschliesst. edeco übernimmt diese
Extrapolation nicht. Auch eine untere magnetische Schwelle wird weiterhin nicht
als garantierter Abschaltzeitnachweis verwendet. Ein Selektivitätsnachweis
folgt nicht aus einer Backup-Tabelle oder dem Nennstromverhältnis.

### Brandlast: Katalog, Lieferanten und CPR

Neu eingebunden ist ein datierter Faktenstand von **467 Kabeln**, Version 2.1.0,
Quellenstand 1. November 2026, abgerufen am 2. November. Gespeichert werden
Produktbezeichnung, Familie, Brandlast, CPR-Klasse, plausible Lieferantenwerte,
Artikel-/Leistungserklärungskennungen und gegebenenfalls ein publizierter
Ersatzverweis. Keine Artikeltexte oder fremder Programmcode werden ausgeliefert.

Die Auswahl unterstützt fünf Kabelfamilien, Suche, unterschiedliche Lieferanten,
den höchsten publizierten plausiblen Wert und eigene Kabelpositionen. Aus der
Quelle als unplausibel gekennzeichnete Lieferantenwerte werden nicht als
Auswahl angeboten. Ca.-Richtwerte bleiben entsprechend bezeichnet. Ein
Katalogeintrag bestätigt nicht automatisch den projektspezifischen Nachweis.

Tatsächlicher Browservergleich:

- FE05C 2×1.5, Cca-s1,d1,a1: höchster publizierter Wert 1.48 MJ/m; Kablan
  0.57 MJ/m, Artikel 109010202Cca.
- Bio St 2×1.5, Dca-s2,d2,a2: 1.25 MJ/m als ca.-Richtwert; kritisches d2.

Explizites s3, d2, a3 sowie Eca/Fca werden als kritisch markiert. Unvollständige
Klassen bleiben offen; fehlende Zusatzklassen werden nicht frei ergänzt.
Ein bekannter kritischer Katalogeintrag kann durch „am Projekt dokumentiert“
nicht grün werden. Vorhandene eigene Rechenstände ohne CPR-Zusatz behalten
ihren bisherigen expliziten Nachweisstatus. Bericht/PDF führen CPR,
Lieferantenbezug, Quellenstand und den wirksamen Nachweisstatus mit.

## Inventar aller 16 öffentlichen Themen

| Thema | Geprüfter Umfang / Stand | Noch begrenzte Aussage |
| --- | --- | --- |
| NIN-Kabel | Verlegearten A1/A2/B1/B2/C/D/E/F/F-eben/G-h/G-v, PVC/XLPE, Aderzahl, Temperatur, Häufung, Parallelleiter und Querschnittssuche vorhanden; veröffentlichte Tabellenzahlen und bestehende Quellenfälle unverändert | Kein vollständiger lizenzierter Normkatalog; D1/D2 bleiben manuelle Projektwerte. Norm-/Tabellenzuordnung gesondert prüfen |
| Zuleitung Schnellcheck | PVC/XLPE/CFW, Ein-/Mehrleiteransatz, Querschnitt und ein bis vier Kreise vorhanden | edeco behält volle Präzision vor der Summierung, statt wie die Referenz teilweise zuerst je Kreis auf ganze A zu runden |
| Spannungsfall | 1~/3~, Cu/Al, Querschnitte, cos φ, Länge, Strom und Budget; bestehende tatsächliche Referenzfälle erhalten | Temperaturmodell 55 °C und publiziertes X′ bleiben Annahmen; nur ein Abschnitt, keine vollständige Kabelauslegung |
| Kurzschluss | 230/400 V, Trafo-Vorgabe/manuelle Quellenimpedanz, Material, Querschnitt, Parallelleiter/-trafos und kalter/warmer Pfad vorhanden | Keine garantierten Ik-min-/Ik-max-Schranken oder vollständige IEC-60909-Berechnung aus den vereinfachten Quellenannahmen |
| LS-Schalter | B/C/D/K/Z, Nennstrom, Icn, Vorsicherung, Stromkreisart, Überlastprüfung und neuer eingegrenzter Backup-Vergleich | Konkrete Herstellerkennlinie/-koordination, vollständige Schutzfunktion und Selektivität bleiben gesondert |
| Potenzialausgleich | Phasen-/PEN-/EPA-Auswahl, HPA/ÖPA/FE, Blitzschutzbezug und manuelle Alternative vorhanden | Referenz-Stufenzuordnung ersetzt keinen vollständigen Norm-/Ausführungsnachweis; EPA bleibt Dokumentation |
| Transformator | Veröffentlichte Nennscheinleistungen, Primär-/Sekundärdaten, u_k, Leerlauf, Auslastung; manuelle u_k-Alternative | Reales vorgelagertes Netz, Verluste, Schaltgruppe und Unsymmetrie sind nicht vollständig erfasst |
| Motoranlauf | Alle 19 Leistungsvorgaben, direkte Nennstromeingabe, IE3-Beispiele, vier Anlaufarten, Motorkabel-/MSS-Empfehlung vorhanden | Faktoren, Wirkungsgrade und Momente sind veröffentlichte Beispiele bzw. Annahmen; keine Herstellerfreigabe |
| Blindleistung | Spannung/System, Kompensationsort, Ist-/Ziel-cos φ, Arbeitspreis und Stunden vorhanden | Verlusteinsparung aus manuellem Verlustanteil; keine vollständige Oberschwingungs-/Resonanz- oder Tarifberechnung |
| Verlustleistung | Systeme, Querschnitt, Parallelleiter, Strom, Länge, Tages-/Jahresdauer und Kosten; Cu300-Lücke geschlossen | Bei cos φ ≠ 1 zusätzliches eigenes R/X-Modell; Cu300 dafür ohne X′ weiterhin gesperrt |
| Ohmsches Gesetz | Bekannte Grössen und DC/AC; alle sechs nativen Eingabepaare erhalten | Symmetrisches sinusförmiges AC-Ersatzmodell, keine beliebigen komplexen Netze |
| Beleuchtung | Alle 19 Leuchtenbeispiele, acht Luxvorgaben, Raumdaten, Reflexion, Wartungsfaktor und Raster vorhanden | Empirischer Raumwirkungsgrad ist keine photometrische Tabelle; zusätzliche volle Rasterreihen sind eine eigene Option |
| PV | Neu-/Bestandsanlage, Dach-/Modultypen, Ausrichtung, Neigung, Ertrag, datierte Tarif-/Förderannahmen und Speicher vorhanden | Keine Live-PVGIS-/EVU-/Pronovo-Abfrage oder vollständige stündliche Lastgangrechnung; finanzielle Sensitivität nicht vollständig gleichwertig |
| E-Mobility | Haus-/Gridwerte, Leistungen einschliesslich eigener Vorgabe, Gleichzeitigkeits-/Lastmanagementmodi, Benutzerklassen, PV/Speicher und Anschlussort vorhanden | Eigenes Leistungs-/Phasenbudget bleibt von einer vollständigen Fahrzeug- und Herstellerregelung zu unterscheiden |
| Brandlast öffentlich | Erweiterbare Positionen, fünf Familien/467 Referenzkabel, Lieferant, CPR, Ersatz und eigene Werte; horizontal/vertikal | Kein unabhängiger Herstellerbeleg oder vollständiger realer Kabel-/Fluchtwegplan; Kompensationsmassnahmen und Ausführung projektspezifisch |
| PoE öffentlich | Vier Typen, zehn Kabelansätze, Spannung, Länge, Leistungs-/Stromgrenzen, PD-Spannung und RP-Referenzansatz vorhanden | Publizierte Typ-/RP-Annahmen sind keine thermische oder vollständige IEEE-/Datenkanalfreigabe |

Diskrete Gerätevorgaben verwenden kurze Kachelauswahlen oder kompakte Dropdowns;
kontinuierliche Mess-/Projektwerte bleiben direkt editierbar. Die UI-Prüfung und
Verbindungen zum Wissens-Hub werden zusätzlich durch den Integrationslauf
abgedeckt. Rechenstände, interne Modulkennungen und Ablageformate bleiben
kompatibel; die Brandlast-Metadaten sind optionale Erweiterungen.

## Quellenbelege

`reference-fundamentals.test.ts`, `reference-installation.test.ts` und
`reference-ev-cable.test.ts` enthalten bereits unabhängige, früher aus dem
Referenzquellcode erzeugte Zahlenfälle. Die erneut abgerufenen HTML-Hashes für
Transformator, Motor, Blindleistung, Verlustleistung, Ohm, Beleuchtung,
Kurzschluss, NIN-Kabel, Schnellcheck, LS, PA, PV und Brandlast stimmen mit den
dort dokumentierten Quellständen überein. Die frischen Browserfälle oben
ergänzen diese Tests; reine Tests eigener Gleichungen werden nicht als weitere
unabhängige Referenzbelege gezählt.

Neue Faktendatei: `workbench/fireCableData.ts`, Quelle
`https://www.elektro-rechner.ch/premium/data/kabel_brandlast.json`, SHA-256:
`226a941df3aeebb111ac57ff307fc55e287293df166aedd32565bee03acf2273`.
LS-Quellstand: SHA-256
`fa5893414f1231d3497536807bc9543fc0cfc35f6153b6de1d099f8b1901a6fa`.
Verlustleistung: SHA-256
`e6c8ed8ee5e32de633f6dd12d917e8420ff3282a915cf9f7fb8e39d57a4c56cb`.

Authentifizierte Rundgang-Schemas, Quellhashes und Screenshots liegen im
Arbeitsbereich unter `scratch/elektro-reference-20261102` bzw.
`artifacts/elektro-rundgang`; sie werden nicht als Zugangsdaten oder
Sitzungscookies gespeichert. Neue tatsächliche Browserzahlen stehen dort in
`public-live-cases.json`. Die endgültigen Testzahlen gehören zum abschliessenden
Integrationsbericht und können sich während paralleler Änderungen noch ändern.
