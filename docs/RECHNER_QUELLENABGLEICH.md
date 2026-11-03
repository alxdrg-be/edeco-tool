# Abgleich mit sichtbaren Referenzen

> Aktualisierung 02.11.2026: Der direkte authentifizierte Abgleich und die neuen
> UI-/Funktionsprüfungen stehen im [Gesamtaudit](RECHNER_AUDIT_20261102.md),
> [öffentlichen Audit](PUBLIC_AUDIT_20261102.md), [Premium-Audit](PREMIUM_AUDIT_20261102.md)
> und [Grafik-Audit](VISUAL_AUDIT_20261102.md). Die unten dokumentierten früheren
> Beschränkungen (etwa gesperrte SIA-Profile oder reine Dropdowns) beschreiben den
> Stand vor dieser Überarbeitung. Nicht belegte Einzelfälle bleiben eingeschränkt.

Stand: 2. November 2026. edeco enthält 26 aktive eigene Modelle: 24 reguläre
Themen von elektro-rechner.ch, dessen Netzplaner (Beta) und Arthur-Flury-Blitzschutz.
[Inventar](RECHNER_INVENTAR.md), [Umfang](RECHNER_UMFANG.md) und
[visueller Vergleich](RECHNER_VISUELLER_VERGLEICH.md) beschreiben die Abdeckung.
Dieser Bericht unterscheidet reproduzierte Zahlenfälle, veröffentlichte
Datenstände und weiterhin offene Norm-/Herstellerzuordnungen.

## Quellen und Methode

Öffentliche HTML-/JavaScript-Funktionen wurden mit gültigen Eingaben in einer
isolierten JavaScript-Umgebung ausgeführt. DOM-/Ausgabehilfen wurden nachgebildet;
teilweise wurden Validierungshelfer ersetzt. Die Fälle prüfen Arithmetik und
Rundung, nicht sämtliche Browservalidierung oder Normtabellenzuordnung.

Quellen-URLs, Abrufdatum und SHA-256 sind bei den gespeicherten Zahlenfällen und
Datensätzen dokumentiert. Die eigene Implementierung verwendet datierte
veröffentlichte Zahlenstände; ein vollständiger lizenzierter Normkatalog oder
fremde Anwendung wird nicht ausgeliefert. Serverseitiger PHP-Code wurde nicht
eingesehen. Die fehlende Extraktion einer Clientfunktion durch ein Browserwerkzeug
belegt nicht, dass diese Funktion auf der Website nicht vorhanden ist.

## Öffentliche Themen

| Thema | Belegter Fall / aktuelle Datenbasis | Grenze der Aussage |
| --- | --- | --- |
| Spannungsfall | Fünf Fälle mit Cu/Al, 1~/3~, cos φ, 55 °C und maximaler Länge stimmen nach Referenzrundung. 25 m Cu 2.5 mm², 16 A, 230 V → 6.74 V / 2.93 % / 34.1 m Budgetlänge. | Nur das veröffentlichte ΔU-Modell; keine Strombelastbarkeitsfreigabe. |
| EV | Gemeinsame Leistungs-/Aktivfälle sowie neue Energie-, PV-/Speicher- und Kurvenfälle wurden aus öffentlicher Clientlogik gewonnen. 3 × 11 kW, k = 0.5 → 2 aktiv / 1 wartend / 22 kW bei ausreichendem Budget. | Referenzkurven sind kein unabhängig bestätigter vollständiger SIA-2060-Normkatalog. Einphasige Budgetprüfung und Modelltoleranz werden nicht durch fehlerhafte Warnfarben der Referenz ersetzt. |
| NIN-Kabel | Publizierte Cu-Iz-Matrizen, PVC/XLPE, Aderzahl, Verlegearten sowie belegte Temperatur-/Häufungsfaktoren sind nativ. Gemeinsamer Korrekturkern: 50 × 0.87 × 0.8 = 34.8 A. | Datensatz und ausgewählte Fälle, keine vollständige unabhängige NIN-Zertifizierung. Fehlende Kombinationen werden gesperrt. |
| Strombelastbarkeit | E/F-, PVC-/XLPE- und CFW-Referenzansätze mit Faktoren. edeco erhält 246 × 0.88 × 2 = 432.96 A. | Die Referenz rundet teils pro Kreis auf 432 A, eine andere Seite auf 433 A. Diese Zwischenrundung wird nicht übernommen; CFW ist ein begrenzter Herstelleransatz. |
| LS | B16 48–80 A, C20 100–200 A, D32 320–640 A stimmen. Vorsicherung und TN-Zeitansatz sind ergänzt. | NH-Backup wird nur aus dokumentierter Benutzereingabe berücksichtigt; kein automatischer Hersteller-Koordinationskatalog. |
| PA | Gemeinsame HPA-/ÖPA-Fälle sowie eingegrenzte veröffentlichte Phasen-/PEN-Zuordnung für Cu 4–120 mm². | Referenz-Stufenansatz, kein vollständiger NIN-Katalog oder Ausführungsnachweis. EPA ist nur dokumentiert. |
| Transformator | 250 kVA, 20 kV/400 V, u_k 4 % → 360.8 A sekundär und 9.021 kA bei starrem Netz, c = 1; weiterer Typenschildfall stimmt. | Keine vollständige Netz-/Schaltgruppenstudie; manuelles u_k bleibt möglich. |
| Motor | 7.5 kW, η 0.904, cos φ 0.85 → 14.1 A / 84.5 A direkt beziehungsweise 28.2 A ideal im Sternanlauf. Publizierte IE3-Beispiele und Kabelgrundwerte ergänzen Typenschildstrom und manuelles η. | Keine automatische Temperatur-/Häufungskorrektur oder Bestätigung des konkreten Motors/Schutzgeräts. |
| Blindleistung | 100 kW, cos φ 0.75 → 0.95 ergeben 55.3 kvar. Bereits erreichtes Ziel liefert 0 kvar und unveränderten Ist-Zustand. | Verlustkosten sind Projektannahmen. Der Kompensationsort wird dokumentiert und verändert wie in der Referenz die Formel nicht. |
| Verlustleistung | Cu 2.5 mm², 25 m, 16 A, 3~, 55 °C → 161.84 W und bei cos φ = 1 ein ΔU von 5.840 V; weitere Jahresfälle stimmen. | Kalender-/Jahresbetrieb, R/X und ΔU-Suche sind eigene klar bezeichnete Modi; unpublizierte X′-Werte werden nicht ergänzt. |
| Ohm | DC- und symmetrische AC-Fälle stimmen; 48 V / 2 A → 24 Ω / 96 W. | Nur gewählte bekannte Grössen; keine behauptete Gleichheit sämtlicher UI-Zustände. |
| Licht | Identische Referenzannahmen liefern 18 Leuchten / 648 W. Volle Rasterreihen ergeben optional 20. Leuchtenbeispiele und empirische Reflexions-/Raumableitung sind hinterlegt. | Empirische Näherung, keine photometrischen Tabellen oder freigegebene Produktdatenbank. |
| Kurzschluss | Kalter c_max- und warmer c_min-Betragsfall: 7.729 / 2.685 kA bei 80 °C. Quellenwahl, Stossstrom und I√t sind ergänzt. | Modellwerte sind weder normativer Ik-min-/Ik-max-Nachweis noch garantierte obere/untere Schranken. |
| PV | Gemeinsame Wirtschaftlichkeitsfälle bei gleichen Leistungs-/Tarifannahmen stimmen. Publizierte Dach-/Modul-, Tarif-, Mindestvergütungs- und Förderstände sowie Bestand/Speicher sind nativ ergänzt. | Kein Live-EVU-/PVGIS-/Pronovo-Abruf. Tarifsnapshot 2026 und datierte Förderansätze bestätigen; Speicherzusatz ist keine Stunden-/Lastgangsimulation. |
| Brandlast öffentlich | Gemeinsame Bilanz: 315 MJ / 31.5 MJ/m bei 10 m Strecke. Eine eigene erweiterbare Positionsliste ersetzt die bisherige Beschränkung auf drei Positionen. | Benutzerwerte und Nachweisstatus, kein Hersteller-/CPR-Katalog oder lokale Ausführungsprüfung. |
| PoE öffentlich | Gemeinsame DC-/PD-Fälle und publizierte generische Kabel-/Typwerte. | Typbudgets und RP-Ansätze sind Referenzannahmen, keine vollständige IEEE-/RP-/Thermikfreigabe. |

Wichtige Herkunftsdateien: `reference-ev-cable.test.ts`,
`reference-fundamentals.test.ts`, `reference-installation.test.ts`, `EVdata.ts`,
`fundamentalsData.ts` und `referenceInstallationData.ts`. Tests eigener
Modellfunktionen werden nicht als zusätzliche unabhängige Anbieterbelege gezählt.

## Angemeldete Themen: aktueller direkter Browserabgleich

Frühere automatisierte Berichte mischten teilweise gewünschte Eingaben mit
Ergebnissen vorheriger Standardzustände. Diese Berichte zählen weiterhin nicht
als bestandene numerische Vergleiche. Das betrifft insbesondere den
[sichtbaren Lauf e19c5ad0](https://agent.tinyfish.ai/runs/e19c5ad0-c803-4dad-af7b-1e16de72da17)
und den [Clientquellenlauf 48972228](https://agent.tinyfish.ai/runs/48972228-3edc-49cf-af51-aa460dd0a638),
der die acht Seiten besuchte, aber deren eingebettete Berechnungsfunktionen nicht
verlässlich extrahieren konnte. Das ist eine Grenze der Methode.

| Thema | Aktueller Nachweisstand |
| --- | --- |
| Ladegrid PKW | Individuelle Grid-Modi/Faktoren, gemischte Punkte, Erzeugungsanschluss, Brutto-/Nettowerte und Phase. Reale Einzelgridfälle und neue Bilanztests; Anbieter-Summenwiderspruch wird nicht übernommen. Details: [Premium-Audit](PREMIUM_AUDIT_20261102.md). |
| Ladegrid E-LKW | Modulare PUs mit AC-/DC-Leistungsbezug, individuelle Grid-Modi und Aktiv/Wartend mit Mindestleistung; tatsächlicher Referenzdefault und Bilanztests. Details: [Premium-Audit](PREMIUM_AUDIT_20261102.md). |
| Brandmelder | Neun Raumtypen, Höhe/Neigung, Rauch/Wärme, Alarmierung, Gruppen und Materialkosten. Fünf tatsächliche unabhängige Browserfälle stimmen; kein akustischer oder SES-Normnachweis. Details: [Premium-Audit](PREMIUM_AUDIT_20261102.md). |
| Selektivität | Eine bis sechs Schutzstufen mit Kabelpfad und FI/MCCB-Varianten; kalte Modellströme gegen tatsächlichen Browserstand geprüft. Keine pauschale volle Selektivitätsfreigabe. Details: [Premium-Audit](PREMIUM_AUDIT_20261102.md). |
| Ladekosten | Fünf reale Zustände mit V1–V4, Basic/Advanced, Klassen und Ausbaujahren. Referenzmodus neben dem unverändert interpretierbaren Projektmodell. Details: [Premium-Audit](PREMIUM_AUDIT_20261102.md). |
| SIA 2056 | Vollständige veröffentlichte Rohprofile nun direkt zugänglich; sechs unabhängige Browserzustände für vier Zonen, p/e/Standby und Faktoren geprüft. Fehlendes Food/L bleibt gesperrt. Details: [Premium-Audit](PREMIUM_AUDIT_20261102.md). |
| PoE-Strecke | Drei zusätzlich authentifizierte Mehrsegmentfälle stimmen mit dem nativen Kern überein. Elektrische Reserve bleibt von physischer Kanallänge und Zertifizierung getrennt. Details: [Premium-Audit](PREMIUM_AUDIT_20261102.md). |
| Brandlastvergleich | Getrennte erweiterbare Varianten, datierter 467-Kabelkatalog, CPR und Lieferantenbezug. Kritisches Brandverhalten bleibt im Nachweis und Bericht sichtbar. Details: [Premium-Audit](PREMIUM_AUDIT_20261102.md). |

### Basic-Kostenfall

[Browserbeobachtung 652c34c0-8ea0-4a8a-a39c-1c980921708c](https://agent.tinyfish.ai/runs/652c34c0-8ea0-4a8a-a39c-1c980921708c):
vier AC-Punkte ab 2026, je 2000 CHF Beschaffung + 750 CHF Installation +
2300 CHF Basis; 3500 kWh/a pro Punkt zu 0.25 CHF/kWh. Wartung 25 CHF je
11-kW-Äquivalent und Jahr, Backend 12.5 CHF je Punkt/Monat; Contractinggebühren
Betrieb/Station/Basis 20/30/20 CHF je Äquivalent/Monat. 15 Jahre, keine späteren
Ausbaujahrgänge. Die vier Gesamtkosten sind **94'200 / 98'100 / 97'700 /
102'900 CHF**. Für V1 stimmen 31'200 CHF Investition inklusive Ersatz,
63'000 CHF Betrieb und die vollständigen Jahreszahlungen. Der entsprechende
Fixture steht in `chargingCosts.test.ts`.

### SIA-Faktorbeobachtung

[Browserlauf 80e49f35-8c4b-4873-80e7-82bcd113621f](https://agent.tinyfish.ai/runs/80e49f35-8c4b-4873-80e7-82bcd113621f)
zeigt getrennte Faktoren: P_roh × Kcor sowie E_roh × Jahresgleichzeitigkeit.
Beobachtet wurden 17 Nutzungsbezeichnungen inklusive „keine Zone“, sieben
Verbrauchergruppen und deren Klassenkennungen. Für Büro waren Kcor
0.6/0.7/0.8, für Wohnen MFH 1.0 sichtbar. Diese Angaben belegen keine komplette
Koeffiziententabelle oder Auswahlregel für andere Nutzungen.

Die angezeigten Rohsummen sind gerundet. Beispielsweise lassen 73.8 MWh und
die angezeigten 59.1 MWh nach Faktor 0.8 keine exakte ungerundete
Energiekoeffizienten-Tabelle rekonstruieren. Daraus werden keine Profile erfunden.
Das neue manuelle Modell verwendet explizit eingegebene W/m² und kWh/(m²·a),
prüft die Faktoren unabhängig und bildet flächengewichtete Summen. Die sieben
Gruppen erhalten keine automatischen Normwerte. Der damalige fehlende Zugriff wurde inzwischen durch einen eigenen
angemeldeten Browser gelöst. Die vollständigen veröffentlichten Rohdaten sind
jetzt datiert mit Quellhash eingebunden und anhand tatsächlicher Zustände
geprüft; die in der Quelle fehlende Food/L-Klasse bleibt gesperrt. Das alte
Faktor-/Stundenmodell bleibt als ausdrücklich anderes Bestandsmodell erhalten.

## Netzplaner und Abschlussprüfung

Der [ursprüngliche Beta-Fund](https://agent.tinyfish.ai/runs/67d57183-96fc-4193-8568-8afe36ec4944)
unter [elektro-rechner.ch/planer](https://www.elektro-rechner.ch/planer) zeigte fünf
Knoten ohne Verbindungen; eine grüne NIN-Anzeige war kein numerischer Prüffall.
Der neue eigene Editor berechnet verbundene radiale Netze und erzeugt nach
expliziter Prüfung einen datierten Prüfstand. Änderungen machen ihn veraltet.
Phasen-/Neutralleiterströme, kumulierter Spannungsfall, Quellenmodelle und
Schutzbedingungen werden modellbezogen geprüft. Eine vollständige numerische
Übereinstimmung mit dem Beta-Anbieter oder NIN-Freigabe ist nicht behauptet.

Aktuelle Gesamtprüfung und neue Vorschaubilder werden separat nach Abschluss
der Integrationschecks berichtet. Das bereitgestellte Electrosuisse-Programm und
der NIN-2025-Screenshot werden ausgewertet; elf Prüfthemen sind sichtbar, eine
vollständige numerische Gleichwertigkeit ist noch nicht belegt. Arthur-Flury-Blitzschutz behält seine
separat dokumentierten Zahlenfälle und den bisherigen Druck-/PDF-Weg.
