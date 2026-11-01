# Native Rechner: Umfang und Grenzen

Die Toolbox enthält 25 native Rechenhilfen: eigene Modelle für die 24 Themen
der Schweizer Referenz elektro-rechner.ch sowie den bisherigen Blitzschutz.
Leistungsbilanz ist zusätzlich als künftiges Werkzeug gekennzeichnet.

Alle 25 Werkzeuge rechnen lokal und können Eingaben, Ergebnisse, Quellen,
Annahmen und Notizen projektbezogen in der gemeinsamen Serverablage speichern,
laden und exportieren. Eine Anmeldung beim Referenzanbieter ist nicht nötig.
Die Modelle sind keine vollständige Nachbildung seiner Fachkataloge.

## Die Rechenmodelle

| Werkzeug | Native Funktion | Wesentliche Grenze / manuelle Grundlage |
| --- | --- | --- |
| NIN-Kabelvorprüfung | Iz aus Tabellenwert und Faktoren; Iᵦ ≤ Iₙ ≤ Iz und I₂ ≤ 1.45 Iz | Iz₀, Verlegeart und Faktoren werden dokumentiert eingegeben; keine automatische NIN-Tabelle oder vollständige Querschnittsauslegung. |
| Strombelastbarkeit | Korrigierter Referenzstrom, parallele identische Stromkreise, Auslastung | Tabellenwerte und Faktoren manuell; gleichmässige Stromaufteilung vorausgesetzt. |
| Kabel-Spannungsfall | Cu/Al, 1~/3~, 55 °C, Budget und nächster Standardquerschnitt nur aus ΔU | Keine Strombelastbarkeits-/Schutzprüfung; X′ ist ein Richtwert. |
| Kurzschlussstrom | Trafo- und Leitungsimpedanz, vereinfachtes 3~- und L–PE-Modell | Keine normativen Ik-max-/Ik-min-Werte; vereinfachte Traforeaktanz und identischer PE-Pfad. |
| LS-Schalter | Überlastbedingungen, magnetischer Auslösebereich und Ausschaltreserve | Gerätewerte und Ik am Projekt eingeben; verbindliche Abschaltzeit und Selektivität bleiben offen. |
| Potenzialausgleich | Standardquerschnitte aus PE-/HPA-Eingaben und Zusatzbedingungen | Schweizer HPA-Tabellenwert manuell; kein pauschaler HPA = PE/2-Ansatz. Nur Cu. |
| Transformator | Nennströme, Übersetzung, Leerlaufstrom, idealer Kurzschlusswert | Typenschildwerte manuell; Kurzschlussmodell mit starrer vorgelagerter Einspeisung. |
| Motoranlauf | Nennstrom aus mechanischer Leistung, Wirkungsgrad und cos φ; Anlaufverfahren | Herstellerfaktoren manuell; kein Anlaufmoment-, Netzrückwirkungs- oder Schutzkonzeptnachweis. |
| Blindleistung | Kompensationsleistung, Strom vorher/nachher, angenommene Verlustkosten | Sinusförmige Grössen; keine Oberschwingungs-/Resonanz- oder Tarifautomatik. |
| Verlustleistung | Temperaturkorrigiertes I²R-Modell, Energie, Kosten und Spannungsfall | DC oder symmetrische AC-Last bei cos φ = 1; Betriebspunkte sind Annahmen. |
| Ohmsches Gesetz | Sechs Kombinationen zweier bekannter Grössen, DC/1~/3~ | AC mit Impedanzbetrag; 3~ als symmetrisches Stern-Ersatzmodell. |
| Beleuchtung | Lumenmethode, Leuchtenanzahl, rechteckiges Raster und installierte Leistung | Nutzungs-/Wartungsfaktoren manuell; keine photometrische Punktberechnung, Gleichmässigkeit oder Blendungsbewertung. |
| PV-Anlage | Fläche, Leistung, degradierter Ertrag, Tarife, Förderung, Amortisation, Kapitalwert, LCOE | Keine automatische Tarif-/Förderabfrage, Verschattungs- oder zeitaufgelöste Eigenverbrauchssimulation. |
| E-Mobilität · AC-Vorplanung | Haus-/Grid-Budget, Reserve, Anzahl Ladepunkte und Lastmanagementmodell | Symmetrisch 400 V, cos φ = 1; keine automatische SIA-Faktorwahl oder Schutzdimensionierung. |
| Brandlast · Grundrechnung | Drei Kabelpositionen mit Herstellerwerten und realen Längen → MJ und mittlere MJ/m | CPR und Ausführung separat; keine vertikale Grenzwertfreigabe. |
| PoE · Leistung | PSE → Leitungs-/Kontaktverluste → PD, Temperaturansatz und Strombegrenzung | Manuelle Datenblattwerte; keine RP-/IEEE-/Datenübertragungszertifizierung. |
| Ladegrid PKW | Zwei parallele AC-Grids, eigenes Grid-Limit und gemeinsame Hausreserve | Proportionales Budgetmodell; keine reale Regelung, Lastgänge oder automatische SIA-2060-Tabelle. |
| Ladegrid E-LKW | AC-Budget, Power Units, η, DC-Bedarf, Zuteilung und Verluste | Stationäres Leistungsmodell; kein Fahrplan, SoC, MCS-/CCS2- oder Netzverträglichkeitsnachweis. |
| Brandmelder | Rechteckraum mit Raster aus Fläche je Melder und horizontalem Abdeckungsradius | Geometrische Vorplanung mit manuellen Abdeckungsannahmen; keine automatische SES-/SN-EN-54-Auswahl, Alarmhorn- oder Kostenplanung. |
| Selektivität | Drei Schutzorgane, zwei Paarvergleiche gegen Hersteller-Stromgrenzen | Herstellerkombinationen und Bedingungen müssen belegt sein; kein vollständiger Selektivitäts- oder Kennliniennachweis. |
| Ladeinfrastruktur-Kosten | 15 Jahre, Anfangsinvestition, Betrieb, Ersatz und Erlöse | Ein eigenes Verrechnungsszenario; kein automatischer Vergleich vier Vertragsmodelle, keine Steuern oder Finanzierung. |
| SIA 2056 · Zonenbilanz | Drei aggregierte Zonen, Leistung, Jahresenergie und jährlicher PV-Eigenverbrauch | Manuelle Kennwerte, Stunden und Faktoren; keine automatische SIA-Tabellenzuordnung oder vollständige Gebäudebilanz. |
| PoE-Streckenplaner | Drei Segmente mit physischer/äquivalenter Länge und Reserve | Faktoren und Längengrenze manuell dokumentieren; keine automatische Bündel-/Temperatur-/Dämpfungstabelle. |
| Brandlast Fluchtweg | Ist-/Sanierungsvergleich für zwei Kabelgruppen | Mittlere Brandlast über die Bezugsstrecke; lokale Spitzen und Ausführung bleiben separat zu prüfen. |
| Blitzschutz | Trennungsabstand nach dem veröffentlichten Schweizer Arthur-Flury-Verfahren | Leitungsführung und Anwendbarkeit am Objekt prüfen; kein Fangschutzvolumen. |

Die Felder erläutern Quelle und Bedeutung über ⓘ. Manuelle Vorgaben sind
Beispielwerte und erhalten erst durch die geeignete Projektgrundlage ihre
fachliche Zuordnung. Ein grüner Status bestätigt nur die konkret beschriebene
Zahlenprüfung, keine allgemeine Normkonformität der Anlage.

## Darstellung

E-Mobilität und Mehrgrid-AC nutzen ein grosses Stromweg-Schema mit Hausanschluss,
UV, Sammelschiene, schematischem Schutzorgan, Wallbox und Fahrzeug. Nennleistung
und Modellzuteilung sind getrennt beschriftet. Der Unterverteiler speist eine
gerade vertikale Sammelschiene mit rechts angeschlossenen Reihen. Die Darstellung
passt Anzahl, Reihen und Leistungswerte live an. Cyan bedeutet eingehaltenes
Leistungsbudget, Gelb begrenzte Zuteilung, Rot eine Überschreitung am konkret
betroffenen Leistungsabschnitt. Hausstatus bewertet beide Grids samt Reserve;
der Gridstatus bewertet nur das ausgewählte Grid. Schutzsymbole bleiben grau,
weil deren Auslegung nicht geprüft wird. Bei zwei Grids kann die Ansicht
umgeschaltet werden; beide behalten dasselbe Hausbudget.

Raumbezogene Modelle nutzen schematische Raster mit korrektem Raumseitenverhältnis.
Kosten, Energie und Stromvergleiche verwenden proportional skalierte Balken.
Bei reinen Formelfragen stehen Messwerte und Statuskarten im Vordergrund.
Eine Grafik wird nicht allein zur Dekoration ergänzt. Farben sind stets mit
Beschriftung oder Status kombiniert. Auf schmalen Bildschirmen bleibt ein grosses
Stromschema innerhalb seines eigenen Bereichs horizontal verschiebbar.

## Prüfung

Unit-Tests prüfen bekannte Zahlenfälle, Leistungs-/Energiebilanzen, Grenzen,
ungültige Eingaben und die Registrierung aller 22 neuen Modelle. Nicht endliche
Ergebnisse werden vor Export/Speichern gesperrt. Browserprüfungen öffnen alle
25 Rechner, verändern Eingaben, prüfen Fehlzustände und stellen die Ansichten
auf grossen/schmalen Bildschirmen sowie hell/dunkel dar. Eine zusätzliche
API-Prüfung speichert und liest jeden der 25 Berechnungstypen. Das ersetzt
keine fachliche Freigabe oder praktische Prüfung am Firmen-Dateiserver.
