# Rechnerinventar und offene Referenzfunktionen

Stand: 2. November 2026. **Alle 25 bekannten Referenzeinstiege haben inzwischen
einen eigenen nativen Rechenkern beziehungsweise Editor in edeco. Vollständige
Funktions- oder Normgleichheit ist damit nicht belegt.** Besonders die
automatischen SIA-2056-Profile bleiben ohne vollständig belegten Datensatz
gesperrt.

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
| Verlustleistung / `verlustleistung` | R/X-Spannungsfall, I²R, Jahres- oder Kalenderbetrieb, Gesamtzeitkosten und ΔU-Querschnitt | Keine Strombelastbarkeitsfreigabe. Unbelegte R/X-Paare werden nicht ergänzt; Cu 300 mm² bleibt ohne belegtes X′ gesperrt. |
| Ohmsches Gesetz / `ohmsches-gesetz` | Sechs Paare bekannter Grössen, DC/1~/symmetrisch 3~ | Gemeinsame Grundfälle stimmen; vollständige Gleichheit aller Bedien-/Einheitenzustände nicht behauptet. |
| Beleuchtung / `beleuchtung` | Leuchtenbeispiele, Lux-/Reflexionsauswahl, publizierte empirische Raumableitung oder manuelles η, Mindestanzahl/volle Reihen und Raumplan | Keine photometrischen Normtabellen oder freigegebene Herstellerprodukt-Datenbank. Gemeinsame Lumenfälle stimmen. |
| PV / `pva-rechner` | Dach-/Modulansätze, ganze Module, direkte kWp, Bestand/Jahr/historische Kosten, Tarif-/Fördersnapshots und separater Speicher-/LCOS-Ansatz | Keine Live-EVU-/Pronovo-/PVGIS-Abfrage. Keine vollständige Sensitivitäts-/Historiengrafik oder stündliche Speicherrechnung; datierte Annahmen bestätigen. |
| E-Mobilität / `emobilitaet` | Haus/Grid-Budget, 1~/3~/DC-Ersatzansatz, Phasenrotation, Aktiv/Warten, publizierte SIA-2060-Referenzkurven, Energie/Reichweite und PV/Speicher mit Anschlusswahl | Referenzkurven sind keine unabhängig bestätigte vollständige Normtabelle. PV mit 0.7 × kWp und Speicherenergie/Betriebszeit sind Näherungen. DC im einfachen Modell mit η = 1; keine Fahrzeugsimulation. |
| Brandlast öffentlich / `brandlast` | Erweiterbare eigene Kabelpositionsliste mit Anzahl, tatsächlicher Länge, Brandlast und Nachweisstatus; horizontal/vertikal | Kein kopierter Hersteller-/CPR-Katalog oder automatische Produktklassifikation. Gebäude-/Korridor-Metadaten und reale Kabelpläne sind nicht vollständig gleichwertig. |
| PoE öffentlich / `poe` | Zehn generische Kabelreferenzen, Typ 1–4, Spannungs-/Leistungsbudget, Mindest-PD-Spannung und homogene RP-Annahme | Kabel-/Typwerte sind publizierte Referenzannahmen. Keine automatische thermische Bündel- oder RP-Zertifizierung. |
| Ladegrid PKW / `premium-pkw` | Mehrere Grids mit gemischten AC-1~/AC-3~/DC-Punktgruppen, Mindestleistungen, Phasen, Aktiv/Warten, Haus-/Grid-Budgets und drei Steuerungsmodi | Eigene Aktivierungs-/Verteilregel; vollständige numerische Anbieterparität nicht belegt. Mehrgrid-PV/Speicher fehlen. Alter Zweigridmodus bleibt separat. |
| Ladegrid E-LKW / `premium-lkw` | Modulare PUs, Leistungsmodule und zugeordnete DC-Abgabepunkte, Wirkungsgrade, Begrenzungen und Aktiv/Warten | Stationäres Modell ohne Fahrzeug-/SoC-Fahrplan. Alle Anbieter-Topologie-/Regelzustände nicht numerisch abgeglichen; Altmodell separat. |
| Brandmelder / `premium-brandmelder` | Rechteckraster mit manuellen Zellflächen, Achs-/Wandabständen oder Zelleneckradius | Automatische SES-Typ-/Decken-/Höhenzuordnung, Alarmhorn-/Akustik- und Kostenbereiche fehlen. Geometrisches Raster ist keine Melderfreigabe. |
| Selektivität / `premium-selektivitaet` | Drei NH-/LS-/RCD-Stufen, Staffelungshinweise oder zwei dokumentierte Hersteller-Paargrenzen | Kein frei erweiterbares Referenz-Stufen-/Kennlinienmodell oder eingebettete Gerätepaar-/RCD-Zeitdaten. Nennstromstaffelung allein ist kein Nachweis. |
| Ladekosten / `premium-ladekosten` | Vier Eigentums-/Contractingmodelle, gemischte Kostenpositionen, Dauer, Ersatzzyklen, Ausbaujahrgänge und Detailkosten | Basic-Fall mit vier AC-Punkten und allen vier Gesamtkosten abgeglichen. DC-Klassen, Detailmodus und sämtliche Anbieter-Vertragszustände bleiben separat unbestätigt. |
| SIA 2056 / `premium-sia2056` | Sieben Verbrauchergruppen je Zone, unabhängige manuelle Rohwerte für P/E, Kcor nur auf P, Jahresgleichzeitigkeit nur auf E, Flächengewichtung und zwei Diagramme | **Automatische Profile gesperrt:** die 17 Nutzungsbezeichnungen und Klassencodes sind Metadaten; ein vollständig belegter und nutzbarer Leistungs-/Energiedatensatz fehlt. Altbilanz bleibt ausdrücklich getrennt. |
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
nicht Normausgabe, Anwendungsbedingungen oder Herstellerfreigabe. Die
angemeldeten Werkzeuge sind erreichbar, ihre Clientfunktionen konnten mit der
verwendeten Browsermethode jedoch nicht vollständig extrahiert werden. Daraus
folgt nicht, dass keine Clientlogik vorhanden ist. Beobachtete passende Fälle,
unzuverlässige Zwischenberichte und offene Bereiche bleiben getrennt.

Der angekündigte Vergleich mit den Electrosuisse-Werkzeugen steht bis zur für
morgen angekündigten Bereitstellung durch den Nutzer aus. Er ist noch kein
Bestandteil des Zahlenabgleichs. Aktuelle Gesamttestzahlen und Vorschaubilder
werden nach Abschluss der laufenden Integrationsprüfung separat ausgewiesen.

Quellen: [Startseite](https://www.elektro-rechner.ch/),
[reguläre Themen](https://www.elektro-rechner.ch/premium/),
[Dashboard](https://www.elektro-rechner.ch/premium/dashboard.php),
[Quellenprüfung](RECHNER_QUELLENABGLEICH.md),
[visueller Vergleich](RECHNER_VISUELLER_VERGLEICH.md).
