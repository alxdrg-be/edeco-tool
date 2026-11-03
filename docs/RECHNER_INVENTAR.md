# Rechnerinventar und offene Referenzfunktionen

Stand: 2. November 2026. **Alle 25 bekannten Referenzeinstiege haben inzwischen
einen eigenen nativen Rechenkern beziehungsweise Editor in edeco. Vollständige
Funktions- oder Normgleichheit ist damit nicht belegt.** Der authentifizierte Abgleich vom 2. November ergänzt Referenzprofile, Brandmelder,
variable Schutzstufen und Kabelkatalog. Einzelne unbelegte Kombinationen bleiben
ausdrücklich gesperrt. Der aktuelle Nachweisstand steht im
[Gesamtaudit](RECHNER_AUDIT_20261102.md).

## Zählung und Einstieg

Die Startseite von elektro-rechner.ch enthält 16 öffentliche Themen. Das
angemeldete Dashboard zeigt 24 Einträge: 15 dieser öffentlichen Themen, acht
angemeldete Rechner und den Beta-Netzplaner. Die öffentliche
Brandlast-Grundrechnung fehlt dort. Die Vereinigung umfasst deshalb
25 unterschiedliche Einstiege: 24 reguläre Themen plus
[Netzplaner unter `/planer`](https://www.elektro-rechner.ch/planer).

edeco enthält **26 aktive Modelle**: diese 25 Themen als eigene Implementierungen
plus Arthur-Flury-Blitzschutz. Der Netzplaner hat einen hervorgehobenen Startknopf
oberhalb der **26 Rechnerkacheln**. Die Kacheln enthalten die bisherigen
25 Rechenhilfen und die weiterhin geplante Leistungsbilanz. Die gemeinsame
Ablage zählt nicht als Rechner. Der neue Netzplaner ist ein bearbeitbarer Graph;
das feste Stromschema des EV-Rechners wird nicht als Netzeditor gezählt.

## Vorhandener Kern und offene Gleichwertigkeit

Die folgende Spalte „offen“ benennt tatsächliche Einschränkungen beziehungsweise
einen noch nicht abgeschlossenen Vergleich. Sie unterstellt nicht, dass die
Referenz selbst einen vollständigen Normnachweis führt. Herkunft und Reichweite
der Zahlenfälle stehen im [Quellenabgleich](RECHNER_QUELLENABGLEICH.md).

| Referenzthema / edeco-ID | Aktuell vorhanden | Offen / eingegrenzte Aussage |
| --- | --- | --- |
| NIN-Kabel / `nin-kabelrechner` | Publizierte Cu-Iz-Reihen für PVC/XLPE, 2/3 belastete Adern und belegte Verlegearten; Temperatur/Häufung, 30-%-Ausnahme, Querschnittssuche und Überlastbedingungen; manueller Modus | Kein vollständiger lizenzierter NIN-Katalog. Nicht belegte Kombinationen liefern keinen Ersatzwert; D1/D2 benötigen manuelle Werte. Suchergebnis und Schutz-/Spannungsfallnachweise sind getrennt. |
| Strombelastbarkeit / `strombelastbarkeit` | Publizierte PVC-/XLPE-E/F- und CFW-Wannenansätze, Temperatur-/Häufungsfaktoren, parallele Kreise; manuelle Werte | CFW nur im publizierten Anwendungsbereich. Keine allgemeine Hersteller-/Verlegefreigabe; edeco behält volle Präzision statt früher Zwischenrundung. |
| Spannungsfall / `kabelberechnung` | Cu/Al, 1~/3~, 55 °C, Budget, maximale Länge und Querschnitt aus ΔU | Gemeinsame Kernfälle stimmen. Vollständige Eingabe-/Interaktionsgleichheit nicht belegt; Querschnitt nur aus Spannungsfall. |
| Kurzschluss / `kurzschlussstrom` | Typenschild-/Trafo-Vorgabe oder resultierende Quellenimpedanz, kalter/warm modellierter Pfad, Stossstrom-/I√t-Näherung | Vereinfachtes NS-Modell; kein garantierter Ik-min-/Ik-max-Bereich oder vollständiger IEC-60909-Nachweis. |
| LS-Schalter / `ls-schalter` | Vorsicherung, Stromkreisart/TN-Zeitansatz, B/C/D/K/Z, Überlast-/Icn-/Magnetprüfung und optional dokumentierte NH-Backup-Grenze | Kein eingebetteter Hager-/Hersteller-Koordinationskatalog. Abschaltzeit, LS–LS und Backup-Gültigkeit benötigen passende Herstellerdaten. |
| Potenzialausgleich / `potenzialausgleich` | Publizierte Phasen-/PEN-Zuordnung für Cu 4–120 mm², PE/HPA/ÖPA/FE, EPA-Dokumentation und PEN-Hinweis; manueller Modus | Begrenztes Referenzverhalten, kein vollständiger NIN-Katalog. EPA ist eine Dokumentationsangabe; Ausführung und Tabellenzuordnung am Projekt bestätigen. |
| Transformator / `transformator` | Nennströme, Übersetzung, Leerlaufstrom, starres Kurzschlussmodell und manueller u_k-Typenschildwert | Gemeinsame Typenschildfälle stimmen. Keine konkrete zusätzliche Hauptfunktionslücke aus dem bisherigen Vergleich belegt; vollständiger Zustandsabgleich offen. |
| Motoranlauf / `motoranlauf` | Leistung oder Typenschildstrom, IE3-Beispiele/manuelles η, Anlaufverfahren, Cu-Grundwertsuche und MSS-Stufe | Automatische Grundwertsuche nur im belegten Bereich, ohne automatische Temperatur-/Häufungskorrektur. MSS ist eine Grössenempfehlung, kein Geräteeinstellnachweis. |
| Blindleistung / `blindleistung` | Kompensation, Vorher-/Nachher-Strom, Verlustkosten und dokumentierter Kompensationsort | Gemeinsame Fälle stimmen. Kompensationsort ändert die Formel nicht; reale Verlustersparnis bleibt eine Projekteingabe. |
| Verlustleistung / `verlustleistung` | R/X-Spannungsfall, I²R, Jahres- oder Kalenderbetrieb, Gesamtzeitkosten und ΔU-Querschnitt | Keine Strombelastbarkeitsfreigabe. Unbelegte R/X-Paare werden nicht ergänzt; Cu 300 mm² ist bei DC/cos φ = 1 ergänzt; AC mit sin φ ≠ 0 bleibt ohne belegtes X′ gesperrt. |
| Ohmsches Gesetz / `ohmsches-gesetz` | Sechs Paare bekannter Grössen, DC/1~/symmetrisch 3~ | Gemeinsame Grundfälle stimmen; vollständige Gleichheit aller Bedien-/Einheitenzustände nicht behauptet. |
| Beleuchtung / `beleuchtung` | Leuchtenbeispiele, Lux-/Reflexionsauswahl, publizierte empirische Raumableitung oder manuelles η, Mindestanzahl/volle Reihen und Raumplan | Keine photometrischen Normtabellen oder freigegebene Herstellerprodukt-Datenbank. Gemeinsame Lumenfälle stimmen. |
| PV / `pva-rechner` | Dach-/Modulansätze, ganze Module, direkte kWp, Bestand/Jahr/historische Kosten, Tarif-/Fördersnapshots und separater Speicher-/LCOS-Ansatz | Keine Live-EVU-/Pronovo-/PVGIS-Abfrage. Keine vollständige Sensitivitäts-/Historiengrafik oder stündliche Speicherrechnung; datierte Annahmen bestätigen. |
| E-Mobilität / `emobilitaet` | Haus/Grid-Budget, 1~/3~/DC-Ersatzansatz, Phasenrotation, Aktiv/Warten, publizierte SIA-2060-Referenzkurven, Energie/Reichweite und PV/Speicher mit Anschlusswahl | Referenzkurven sind keine unabhängig bestätigte vollständige Normtabelle. PV mit 0.7 × kWp und Speicherenergie/Betriebszeit sind Näherungen. DC im einfachen Modell mit η = 1; keine Fahrzeugsimulation. |
| Brandlast öffentlich / `brandlast` | Erweiterbare eigene Kabelpositionsliste mit Anzahl, tatsächlicher Länge, Brandlast und Nachweisstatus; horizontal/vertikal | 467 datierte Kabel-Faktenwerte und CPR-/Lieferantenbezug ergänzen die eigene Liste; Hersteller-/Ausführungsnachweis bleibt projektbezogen. Gebäude-/Korridor-Metadaten und reale Kabelpläne sind nicht vollständig gleichwertig. |
| PoE öffentlich / `poe` | Zehn generische Kabelreferenzen, Typ 1–4, Spannungs-/Leistungsbudget, Mindest-PD-Spannung und homogene RP-Annahme | Kabel-/Typwerte sind publizierte Referenzannahmen. Keine automatische thermische Bündel- oder RP-Zertifizierung. |
| Ladegrid PKW / `premium-pkw` | Mehrere Grids mit gemischten AC-1~/AC-3~/DC-Punktgruppen, Mindestleistungen, Phasen, Aktiv/Warten, Haus-/Grid-Budgets und drei Steuerungsmodi | Eigene Aktivierungs-/Verteilregel; vollständige numerische Anbieterparität nicht belegt. Mehrgrid-PV/Speicher sind mit explizitem Anschlussort und stationären Modellgrenzen ergänzt. Alter Zweigridmodus bleibt separat. |
| Ladegrid E-LKW / `premium-lkw` | Modulare PUs, Leistungsmodule und zugeordnete DC-Abgabepunkte, Wirkungsgrade, Begrenzungen und Aktiv/Warten | Stationäres Modell ohne Fahrzeug-/SoC-Fahrplan. Alle Anbieter-Topologie-/Regelzustände nicht numerisch abgeglichen; Altmodell separat. |
| Brandmelder / `premium-brandmelder` | Neun Raumtypen, Höhe/Neigung, Rauch/Wärme A1/A2, Geschosse, Alarmierung, Gruppen und Materialkosten sowie manuelles Raster | Fünf unabhängige Browserfälle belegt; SES-Bezug und Schallausbreitung nicht unabhängig nachgewiesen. |
| Selektivität / `premium-selektivitaet` | Ein bis sechs Schutzstufen mit Kabelpfad, NH/B/C/D/K/FI/TMD/ETU, Quellenstrom und optional dokumentierten Paargrenzen; Altmodell erhalten | Kalte Modellströme gegen Referenz geprüft. Keine pauschale volle Selektivität aus Nennstromverhältnissen, keine erfundenen Herstellerkennlinien. |
| Ladekosten / `premium-ladekosten` | Vier Eigentums-/Contractingmodelle, gemischte Kostenpositionen, Dauer, Ersatzzyklen, Ausbaujahrgänge und Detailkosten | Basic-Fall mit vier AC-Punkten und allen vier Gesamtkosten abgeglichen. DC-Klassen, Detailmodus und sämtliche Anbieter-Vertragszustände bleiben separat unbestätigt. |
| SIA 2056 / `premium-sia2056` | Vier Referenzzonen, 16 Nutzungen, sieben p/e/Standby-Gruppen, Klassen, Klima und PV; manuelle und ältere Bilanz erhalten | Datierter Anbieterstand, kein unabhängiger Normkatalog. Die ausdrücklich fehlende Food/L-Klasse bleibt gesperrt. |
| PoE-Strecke / `premium-poe` | Patchseiten, erweiterbare Kabelsegmente, Klassen-/Stecksystemansatz, RP-/Typmix, Kabel-/Bündelparameter, Temperatur- und Längennäherung oder manuelle Temperaturen | Thermische Kurve und RP-/Klassenkoeffizienten sind unbestätigte publizierte Annahmen. Physisch höchstens 100 m; internes 20-°C-Budget bis 109 m ist keine physische Freigabe. |
| Brandlastvergleich / `premium-brandlast` | Getrennte eigene Vorher-/Nachher-Kabelpositionslisten, MJ/MJ/m und horizontaler Vergleich | Kein Hersteller-/CPR-Katalog, keine automatische Produktzuordnung oder Bewertung lokaler Häufungen. Vollständige Anbieter-Kabelpläne nicht numerisch abgeglichen. |
| Netzplaner Beta / `netzplaner` | Bearbeitbarer horizontaler Graph, Verbinden/Autoanschluss, radiale Berechnung mit Phasen/N, Pfad-ΔU, Kurzschluss-/Schutzbedingungen und explizitem Prüfbericht/PDF | Genau eine NS-Einspeisung, keine Ringe/Mehrfacheinspeisung oder iterative Lastflussrechnung. Iz/Gerätewerte manuell; keine vollständige NIN- oder Referenzparität belegt. |

Blitzschutz ergänzt diese Liste unabhängig mit dem veröffentlichten
Arthur-Flury-Trennungsabstandsverfahren. Der ursprüngliche Fund des
Beta-Einstiegs ist im [Browserlauf 67d57183-96fc-4193-8568-8afe36ec4944](https://agent.tinyfish.ai/runs/67d57183-96fc-4193-8568-8afe36ec4944)
belegt. Dort sichtbare fünf Knoten ohne Verbindungen und eine grüne NIN-Anzeige
waren kein numerischer Netz-Prüffall. Der eigene Editor benötigt ein verbundenes,
gültiges Netz; ein Prüfergebnis ist vom blossen Live-Rechenstand getrennt.

## Nächste Belege

Die Veröffentlichung einer Zahl und deren rechnerische Reproduktion ersetzen
nicht Normausgabe, Anwendungsbedingungen oder Herstellerfreigabe. Die angemeldeten Clientfunktionen sind seit dem direkten authentifizierten
Browserlauf zugänglich und wurden erneut geprüft. Die früheren Grenzen der
Browsermethode sind im historischen Quellenbericht dokumentiert. Beobachtete passende Fälle,
unzuverlässige Zwischenberichte und offene Bereiche bleiben getrennt.

Das Electrosuisse-Programm und der NIN-2025-Prüfungs-Screenshot wurden inzwischen
bereitgestellt. Die elf Prüfthemen sind sichtbar, die numerische Referenzauswertung
ist noch nicht abgeschlossen. Aktuelle Gesamttestzahlen und Vorschaubilder
werden nach Abschluss der laufenden Integrationsprüfung separat ausgewiesen.

Quellen: [Startseite](https://www.elektro-rechner.ch/),
[reguläre Themen](https://www.elektro-rechner.ch/premium/),
[Dashboard](https://www.elektro-rechner.ch/premium/dashboard.php),
[Quellenprüfung](RECHNER_QUELLENABGLEICH.md),
[visueller Vergleich](RECHNER_VISUELLER_VERGLEICH.md).
