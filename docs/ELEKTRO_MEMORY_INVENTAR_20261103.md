# Elektro-Memory: vollständige Seiteninventur und Formelprüfung

Stand: 3. November 2026.

Die bereitgestellte Datei `E-Memory_DE_PNG.pdf` wurde auf allen **16 Seiten visuell gelesen**. Sie enthält ausschliesslich Rasterbilder mit je 827 × 1166 Pixeln und keinen Textlayer. OCR wurde nur als Such- und Kontrollhilfe verwendet; Formeln und Tabellen wurden am Bild geprüft. Die PDF-Datei wurde nicht verändert.

- Quelle: EIT.swiss, laut Impressum **1. Auflage ©2025**.
- Dateigrösse: 1'416'247 Byte.
- SHA-256: `728b3bc0eba7f318c991083989c8312b83271589761116acb4b76d3b3f8373e4`.
- Maschinenlesbare Arbeitsartefakte: `/workspace/artifacts/electro-memory-audit/manifest.json`, `source-info.json` und `validation.json`.
- Ergebnis: **13 Themengruppen, 70 Einträge und 25 Formeleinträge**. Alle 16 physischen PDF-Seiten sind abgedeckt. Die Formeleinträge enthalten auch die Formelscheibe auf dem Deckblatt und das Ausmass-Beispiel; gleiche Grundgleichungen erscheinen deshalb an mehreren Quellstellen.

Die Darstellung im Tool soll aus sauber gesetztem Text, Tabellen, Formeln und neuen Vektordiagrammen bestehen. Die eingescannten Seiten sind Prüfmaterial, keine Produktoberfläche.

## Seiten und Themen

| PDF-Seite | Vollständig inventarisierte Themen | Einordnung |
| --- | --- | --- |
| 1 | Formelscheibe mit U/I/R/P, zwölf Umstellungen; aufgedrucktes Lineal | Formeln unter ohmschen Bedingungen geprüft; Lineal im skalierten Scan kein Messwerkzeug. |
| 2 | Eigenschutz, Meldeschema, Stromunfall, Erste-Hilfe-Situationen, Asbest | Sicherheitsreferenz; medizinische Handlungsdetails nicht als neu validiert ausgeben. |
| 3 | Fünf Sicherheitsregeln, fünf lebenswichtige Regeln, PSA-Stufen nach Kurzschlussstrom | Regeln lesbar; PSA-Tabelle bleibt risikobeurteilungs-/herstellerabhängig. |
| 4 | PSA-Komponenten, APC-Klassen, Arbeitsverfahren und Gefahrenzonen | Bedingungsabhängige Diagramme, keine automatische Arbeitsfreigabe. |
| 5 | Sichtprüfung, zehn Prüfbereiche, Niederohm-/Isolationsmessung, historische Riso-Grenzen, Schleifenmessung | Mess- und Normreferenz mit begrenztem Anwendungsbereich. |
| 6 | Ik-Faustregeltabellen für 5 s und 0.4 s, D-Sicherungen/NH/LS B/C/D, Faktor 0.66 | Alle lesbaren Tabellenwerte erfasst; ausdrücklich kein Herstellerkennlinien-Nachweis. |
| 7 | RCD-Typen und Eigenschaften, DIAZED-Kennfarben, Steckdosen-/Schalterabsicherung, LS-Auslösebereiche | Quellenfehler bei Typ A und mutmasslich bei 65 A markiert. |
| 8 | RCD-Anwendungen/DC-Immunität, historische Leiterkennfarben | Grafische Typzuordnung und konkrete Gerätefähigkeiten weiter prüfen. |
| 9 | Fundamenterder, Verlegung, Betonüberdeckung, Korrosion, Bewehrungsverbindungen, isolierte Gebäude, Blitzschutz | Quellmasse sind Referenzwerte, keine vollständige Erdungsbemessung. |
| 10 | PE/PEN/Erdungsleiter/Schutzpotentialausgleich, Hauptschiene, B1/B2-Bemessungstabelle | Tabelle mit Fussnoten erfasst; nicht allein aus Vorsicherungsstrom verallgemeinern. |
| 11 | AC-Überspannungsschutz im Wohnungsbau, SPD-Kaskade, Rohrbelegung | Beide Themen vollständig als Referenz inventarisiert; kein vollständiges PV-/DC-/SPD-Konzept. |
| 12 | Bad-/Duschbereiche, Fadenmass, Wasserschutz, Betriebsmittel und SELV/PELV | Kleine bedingungsabhängige Grafikfelder werden nicht zur pauschalen Freigabelogik vereinfacht. |
| 13 | Ausmassbeispiele, Reserven/Rundung, Regierapport, IC-/NPK-Übersicht | Additionen mathematisch geprüft; Abrechnungsbedingungen separat. |
| 14 | IP-Ziffern, Zusatzbuchstaben, Material- und Schutzkennzeichen | Enthält ausdrücklich einen Verweis auf NIN 2015 B+E. |
| 15 | Schweizer Stecker/Steckdosen/Kupplungen, SN 441011, 10-/16-A-Typen, Kompatibilitätslinien | Typen/Bemessungen lesbar; dicht überlagerte Anschlusslinien nicht ungeprüft als vollständige Matrix übernommen. |
| 16 | Elektrische Leistung, R/ρ/l/A, Beleuchtung, Zählerformel, G, Xc/XL, S/P/Q, Stern/Dreieck, Stromdichte, Kosten, Energie, Umrechnungen, Symbollegende | Alle Formelgruppen in sauberem Klartext erfasst und mit Gültigkeitsbedingungen versehen. |

## Wichtige Korrekturen und Grenzen

1. **RCD Typ A, Seite 7:** Der Drucktext nennt neben Wechsel- und pulsierenden Strömen auch reine Gleichströme. Dies darf nicht als allgemeine Erfassung glatter Gleichfehlerströme übernommen werden. Der Manifesttext unterscheidet A/F von B/B+ entsprechend; konkrete Geräteeigenschaften bleiben zu prüfen.
2. **DIAZED, Seite 7:** `65 A = kupfer` weicht vom üblichen 63-A-Nennwert ab. Das ist als mutmasslicher Quellenfehler markiert; daraus wird kein neuer 65-A-Standard konstruiert.
3. **Leistung mit η, Seite 16:** Die gedruckten ein-/dreiphasigen Formeln enthalten η und beschreiben damit Nutzleistung. Elektrische Aufnahmeleistung und mechanische Nutzleistung werden getrennt bezeichnet.
4. **Zählerformel, Seite 16:** `3600 · n / (c · t_s)` ergibt bei c in Ereignissen/kWh **kW**. Für W ist ein zusätzlicher Faktor 1000 nötig. Die pauschale P-Legende in W genügt nicht.
5. **Kondensator, Seite 16:** `10⁶ / (ω · C)` ist für C in **µF** korrekt. Bei C in F gilt `1 / (ω · C)`.
6. **Energiekosten, Seite 16:** Tarif in Rp/kWh verlangt Leistung in kW und Zeit in h; Ergebnis in Rp. CHF ergibt sich durch Division durch 100.
7. **Mechanische Energie, Seite 16:** Die Legendenangabe Arbeit in `nm` wird zu **J = N·m** präzisiert. `nm` wäre Nanometer.
8. **Allgemeine AC-Lasten:** P = U·I und die ohmsche Formelscheibe gelten nicht ungeändert für beliebige Wechselstromlasten. Ebenso ist das einfache Leistungsdreieck bei Verzerrungsleistung nicht vollständig.
9. **Beleuchtung:** Die Flächenformel bestimmt keine punktweise Beleuchtungsstärke oder Gleichmässigkeit. Beleuchtungswirkungsgrad und Motorwirkungsgrad dürfen trotz gleichem η-Zeichen nicht verwechselt werden.
10. **Normstände:** Das Impressum 2025 ist kein unabhängiger Nachweis, dass jede Tabelle und jeder historische Abschnitt der aktuellen NIN entspricht. Insbesondere Mess-, PSA-, Erdungs-, Bad-, RCD- und Gerätetabellen sind Referenzinhalte und keine pauschal zertifizierten Rechenregeln.

Die beiden `confidence`-Werte im Manifest unterscheiden lesbare, unter angegebenen Bedingungen mathematisch/allgemein geprüfte Inhalte (`verified`) von noch normativ, medizinisch oder anwendungsbezogen zu prüfenden Referenzen (`needs-review`). `verified` bedeutet ausdrücklich keine vollständige Normfreigabe.

## Kontrolle der Formelzuordnungen

Alle Rechnerverweise im Manifest wurden gegen den tatsächlichen Formelkatalog geprüft. Die Lampenanzahl verweist auf `lampenanzahl`; sie wird nicht mit der weitergehenden Beleuchtungsplanung samt Wartungsfaktor gleichgesetzt. Überprüft wurden ausserdem eindeutige Eintrags-IDs und die vollständige Seitenabdeckung.

Beispielhafte Einheiten-/Plausibilitätskontrollen:

| Beispiel | Ergebnis |
| --- | --- |
| 1 Zählerereignis in 1 s, Konstante 1000/kWh | 3.6 kW |
| Idealer Kondensator 10 µF bei 50 Hz | Xc ≈ 318.31 Ω |
| 2 kW × 3 h × 30 Rp/kWh | 180 Rp = 1.80 CHF |
| Hubenergie 10 kg × 9.81 m/s² × 2 m | 196.2 J |

## Sinnvolle Ergänzungen über die Vorlage hinaus

Als eigene, klar von PDF-Zitaten getrennte Grundlagen empfehlen sich DC/AC und Effektivwert, Kirchhoff sowie Reihen-/Parallelschaltung, komplexe Impedanz und Leistungsfaktor, Temperatureinfluss auf Leiterwiderstand, die zusammenhängenden Nachweise der Leitungsdimensionierung, TN/TT und PE/N/PEN-Funktionen, Selektivität/Back-up sowie typische Grenzen bei PV, Ladeinfrastruktur und Umrichtern. Einheiten und Vorsätze sollten überall sichtbar sein und Faktor-1000-/Faktor-10⁶-Fehler verhindern.

Nicht ergänzt wurden erfundene Grenzwerte, QR-Ziele oder unleserliche Symbolbedingungen. Eine vollständige Normprüfung und eine vollständige medizinische Aktualitätsprüfung stehen ausserhalb dieser Seiteninventur.
