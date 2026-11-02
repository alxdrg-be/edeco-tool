# Native Rechner: Umfang und Grenzen

Stand: 2. November 2026. edeco enthält **26 aktive eigene Rechenmodelle**:
24 reguläre Themen von elektro-rechner.ch, dessen zusätzlich gefundenen
Netzplaner (Beta) und Arthur-Flury-Blitzschutz. Der Netzplaner startet über einen
hervorgehobenen Knopf oberhalb der 26 Kacheln; diese enthalten die bisherigen
25 Rechner und die weiterhin geplante Leistungsbilanz. Die gemeinsame Ablage
ist kein zusätzlicher Rechner.

Alle Modelle rechnen lokal. Projektbezogene Rechenstände, Quellen, Annahmen und
Notizen lassen sich in der gemeinsamen Serverablage speichern und laden.
Die 24 regulären Referenzthemen und der Netzplaner haben einen direkten
A4-PDF-Download mit aktuellen Daten und Projektzuordnung. Die PDF-Seiten sind
gerastert; strukturierte Daten bleiben in JSON erhalten. Blitzschutz behält den
bisherigen Druck-/PDF-Weg. Für den Netzplaner setzt der Ergebnisbericht einen
aktuellen expliziten Prüfstand voraus.

## Daten und Rechenumfang

| Bereich | Aktuell umgesetzt | Wesentliche Grenze |
| --- | --- | --- |
| NIN-Kabel | Publizierte Cu-Referenzreihen für PVC/XLPE, 2/3 Adern und belegte Verlegearten; Temperatur, Häufung, 30-%-Ausnahme, Parallelleiter und Querschnittssuche; manueller Modus | Datenstand der öffentlichen Referenz, kein vollständiger lizenzierter Normkatalog. Unbelegte Kombinationen bleiben gesperrt; Schutz und Spannungsfall separat prüfen. |
| Parallele Zuleitungen | E/F-Grundwerte, PVC/XLPE/CFW, publizierte Faktoren oder manuelle Projektwerte | Identische Leiter und gleichmässige Aufteilung; CFW nur im belegten Anwendungsbereich. |
| Spannungsfall / Verlustleistung | 1~/3~, Cu/Al, R/X und cos φ; I²R, Energie, Kosten, Budget und Querschnitt nur aus ΔU | Temperatur ist vorgegeben. Keine thermische Kabel-/Schutzfreigabe; unpublizierte R/X-Paare werden nicht erfunden. |
| Kurzschluss / Transformator | Typenschild-/Quellenmodelle, Nennwerte, kalter/warm modellierter Fehlerpfad, zusätzliche Stossstrom-/I√t-Näherung | Trafo-Reaktanz und vereinfachtes NS-Netz; keine vollständige IEC-60909-Studie oder garantierte Ik-Schranken. |
| LS / Selektivität | Stromkreis-/Vorsicherungseingaben, Icn/Ik-/Magnetbedingungen; NH-Backup nur mit eingegebenem Herstellerbeleg; drei Selektivitätsstufen | Keine eingebettete Herstellerkoordination, RCD-Zeitkurven oder vollständige Kennlinien. Günstige Stromstaffelung allein ergibt keine Selektivität. |
| Potenzialausgleich | Publizierte Cu-Phasen/PEN-Zuordnung 4–120 mm², PE/HPA/ÖPA/FE und EPA-Dokumentation; manuelle Werte | Eingegrenzter Referenzansatz; Normtabelle und Anwendungsfall am Projekt bestätigen. |
| Motoranlauf | Leistung oder Typenschildstrom, IE3-Beispiele, Anlaufverfahren, Cu-Grundwertsuche und MSS-Stufe | Automatik ohne vollständige Temperatur-/Häufungs- oder Gerätekoordination; keine Moment-/Dauer-/Netzrückwirkungsprüfung. |
| Blindleistung / Ohm | Kompensation und Vorher-/Nachher-Werte; sechs Paare bekannter Grössen für DC/AC | Sinusförmige beziehungsweise symmetrische Modelle. Verlustkosten und Kompensationsort benötigen Projektannahmen. |
| Beleuchtung | Leuchtenbeispiele, Reflexion, empirische Raumableitung oder manuelles η, Mindestanzahl/volle Reihen und bemasster Plan | Keine photometrische Simulation, freigegebene Produktdatenbank oder automatische Norm-Raumnutzung. |
| PV | Ganze Module, Direktleistung/Flächenansatz/Bestand, Dach-/Lagefaktoren, datierte Tarif-/Förderwerte, Wirtschaftlichkeit und separater Speicher-/LCOS-Ansatz | Keine Live-Dienste oder stündliche Last-/Speicherrechnung; Förderfähigkeit und Tarife bestätigen. PV-Hauptkennzahlen enthalten den separat ausgewiesenen Speicher nicht. |
| Einfache EV-Vorplanung | Haus/Grid, Phasen, Aktiv/Warten, publizierte SIA-2060-Kurven, Energie/Reichweite, PV-/Speicheranschluss | Kurven-/Erzeugungsannahmen sind keine vollständige Normtabelle oder zeitliche Ladesimulation. DC als einfaches AC-Ersatzmodell mit η = 1. |
| Modulare PKW-/LKW-Grids | Gemischte AC-/DC-Punkte je Grid, Phasen-/Budgetgrenzen, Mindestleistung und Aktiv/Warten; LKW-PUs/Module mit zugeordneten Punkten und η | Eigene stationäre Zuteilung, keine bestätigte Anbieter-Regelung oder Fahrzeug-/SoC-Fahrplanung. Mehrgrid-PV/Speicher fehlen. |
| Vier Ladekostenmodelle | Eigentum/Betrieb bis Vollcontracting, gemischte Kostenpositionen, Ersatz, Kohorten und Jahreszahlungen | Basic-AC-Fall abgeglichen; DC-/Detailvarianten und Vertragsbedingungen nicht vollständig gegen den Anbieter geprüft. |
| SIA 2056 | Sieben Gruppen je Zone, rohe W/m² und kWh/(m²·a), getrennte Faktoren, gewichtete Summen, manuelle Ziele und begrenzter PV-Abzug | Automatische Profile gesperrt: vollständige belegte und nutzbare Verbraucherkoeffizienten fehlen. 17 Nutzungsnamen/Klassencodes sind nur Metadaten. |
| Brandmelder | Rechteckraster aus manuellen Flächen-, Achs-/Wand- oder Radiusannahmen | Keine automatische SES-/Decken-/Höhenzuordnung, Alarmhorn-/Akustik- oder Kostenplanung. |
| PoE | Kabelreferenzen, Typ-/PD-Budget; segmentierter Kanal mit Patchseiten, Bündel-/RP-/Temperaturannahmen und manuellen Temperaturen | Publizierte thermische Kurven sind kein bestätigter RP-/Normnachweis. Physischer Kanal höchstens 100 m; internes Budget bis 109 m ist keine zusätzliche physische Länge. |
| Brandlast | Eigene erweiterbare Kabelpositionen; unabhängige Vorher-/Nachher-Bilanzen, horizontal/vertikal und Nachweisstatus | Keine Hersteller-/CPR-Datenbank oder lokale Häufungs-/Ausführungsprüfung. 200-MJ/m-Bezug nur horizontal bei bestätigter Anwendbarkeit. |
| Netzplaner Beta | Bearbeitbarer Graph aus Quelle, NS-bezogenem Trafo, UV, Schutzorganen, Verbrauchern und Leitungen; Phasen/N, Pfad-ΔU, Kurzschluss-/Schutzbedingungen | Radial, eine Einspeisung, keine Ringe oder iterative Lastflussrechnung. Iz/Gerätewerte sind dokumentierte Projekteingaben. |
| Blitzschutz | Schweizer Arthur-Flury-Verfahren, Trennungsabstand und Mindestableiterprüfung | Leitungsführung und Anwendbarkeit am Objekt prüfen; kein Fangschutzvolumen. |

Die einzelnen IDs und konkreten Restfunktionen stehen im
[Rechnerinventar](RECHNER_INVENTAR.md). Veröffentlichte Referenzdaten sind datiert
und werden von manuellen Projektwerten unterschieden. Ein grüner Status
bestätigt nur die bezeichnete Zahlenbedingung; die Normausgabe und zugehörigen
Anwendungsbedingungen müssen zum Projekt passen.

## SIA-Faktoren und gespeicherte Stände

Die neue SIA-2056-Bilanz behandelt zwei unabhängige Eingaben:
`P = A × Σp_roh × Kcor / 1000` und
`E = A × Σe_roh × Jahresgleichzeitigkeit`.
Kcor wird nicht nochmals auf Energie, die Jahresgleichzeitigkeit nicht auf
Leistung angewandt. Gesamtkennwerte teilen die absoluten Summen durch die gesamte
Fläche. Diagramme zeigen Bruttoenergie vor PV; Netzenergie bleibt mindestens 0.
Automatische Profile erzeugen bei fehlendem Datensatz kein Ersatzresultat.

Alte Projektstände behalten ausdrückliche Bestandsmodi: manuelle Tabellen,
bisherige PV-/EV-/Zonenansätze sowie frühere Grid-, Kosten- und Segmentmodelle.
Sie werden nicht still in eine neue Referenzautomatik umgedeutet. Die bisherige
SIA-Zonenbilanz bleibt als anderes, historisches Faktor-/Stundenmodell benannt.
Unklare oder fehlerhafte gespeicherte Daten werden zur Korrektur angezeigt.

## Bedienung und Prüfstand

Diskrete Gerätenennwerte verwenden Dropdowns; Mess-/Projektwerte bleiben frei.
Schemas und Diagramme entstehen aus dem aktuellen Modellzustand. Kurze
Erklärungen, Einheiten und Legenden bleiben sichtbar, detaillierte Grundlagen
zusätzlich erreichbar. Grosse Pläne verschieben sich bei Bedarf innerhalb ihres
Bereichs, ohne den gesamten Bildschirm zu verbreitern.

Im Netzplaner werden Bauteile horizontal angeordnet und am passenden Ziel
automatisch angeschlossen oder über Ausgang/Eingang verbunden. Geräte und
Leitungen besitzen eigene Inspektoren. Eine Live-Vorschau ist noch kein
expliziter Prüfbericht. **Berechnen & prüfen** friert den geprüften Stand ein;
Änderungen an Daten oder Verbindungen machen den Bericht veraltet und erfordern
eine neue Prüfung. Unverbundene Netze sind nicht berechenbar; offene Daten und
verletzte Bedingungen werden abschnittsbezogen angezeigt.

## Prüfung

Modelltests decken Zahlenfälle, Bilanzen, unabhängige Faktoren, Grenzen,
ungültige Eingaben und Bestandsmigrationen ab. Browserprüfungen behandeln
Bearbeitung, Zustandsfarben, Überlauf/Beschriftungen und PDF-Daten. Im aktuellen
Prüfstand bestehen 261 Frontend-/Modelltests, Typecheck und lokaler Vite-Build.
Zehn ausgewählte Berechnungs-Browserabläufe, neun Netzplaner-Browserabläufe und
fünf Ablage-API-Tests sind erfolgreich. Die Sichtungsprüfung erzeugt Bilder aller
25 regulären edeco-Rechner, prüft überlappende SVG-Beschriftungen und den
Bildschirmüberlauf bei 390 Pixeln. Das zusätzliche Zwei-UV-Beispiel wurde im
Browser mit unabhängigen Zuleitungen und gemeinsamer Laständerung geprüft. Der
[Quellenabgleich](RECHNER_QUELLENABGLEICH.md) trennt belegte Referenzfälle von
offenen Automatiken.

Der zusätzliche Electrosuisse-Vergleich wartet auf die für morgen angekündigte
Bereitstellung durch den Nutzer. Fachliche Anlagenfreigabe und praktische
Firmenserverprüfung sind durch die Modelltests nicht erledigt.
