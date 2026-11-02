# Erneuter Vergleich: Maschinen, Gebäude und Energie

Stand: 2. November 2026. Ausgangspunkt war `main` mit Build 20.

## Tatsächlich erneut bediente Referenz

Die Prüfung verwendet einen frisch angemeldeten eigenen Chromium-Browser,
ohne externen Browserdienst. Zugangsdaten und Cookies blieben im Speicher;
Projekte und Benutzerbibliotheken wurden nicht gespeichert oder geändert.
Auf 13 Rechnerseiten wurden 217 nicht kontobezogene Eingabefelder inventarisiert,
52 Erklärungsbereiche geöffnet, 597 Select-Optionswechsel ausgelöst und weitere
121 Kachel-/Tab-/Tarifknöpfe betätigt. Bedingte und nicht sichtbare Optionen
sind im Protokoll ausdrücklich als solche erkennbar. Diese Interaktionszahlen
sind keine Behauptung einer Prüfung aller Kombinationen oder Normen.

| Rechner | Erneut überprüfte Auswahl | Befund |
| --- | --- | --- |
| Transformator | 11 Scheinleistungen, Spannungen, u_k, Leerlauf, Last | Eingaben und tabellierte Resultate vorhanden. Zusätzliches einphasiges Modell bleibt eine eigene Erweiterung. |
| Motoranlauf | 19 Leistungsvorgaben/manueller Strom, vier Anlaufarten, PVC/XLPE, fünf Verlegearten | Vollständige sichtbare Referenzauswahl vorhanden. Annahmen und Herstellergrenzen bleiben getrennt. |
| Blindleistung | 1~/3~, drei Kompensationsorte, cos φ, Arbeitspreis und Stunden | Keine neue Parameterlücke gefunden. Verlustanteil ist bei edeco ausdrücklich eine Projektannahme. |
| Verlustleistung | Querschnitte, Phasen, vier Spannungsfallbudgets, Betrieb und Kosten | Keine neue Parameterlücke gefunden. Die eigene Al-/Temperatur-/cos-φ-Erweiterung wird nicht als identischer Quellenzustand ausgegeben. |
| Ohmsches Gesetz | Eingabepaare, 1~/3~ | Die sechs nativen Eingabepaare bleiben erhalten; keine neue Parameterlücke. |
| Beleuchtung | 19 Leuchten, acht Luxvorgaben, Reflexion, Wartung, Raum | Eingaben und Optionen vorhanden. Die empirische Raumableitung ersetzt weiterhin keine Photometrie. |
| PV | Dach, Module, Bestand, Kanton-/EVU-Tarife, Speicher, Förderung, Premium-Finanzparameter | Die grundlegenden Eingaben waren vorhanden. Sensitivitätsanalyse und historische Tarifkurven fehlten; ergänzt. |
| SIA 2056 | Vier Zonen, 16 Nutzungen/keine Zone, Klassen, Kcor, Gleichzeitigkeit, Klima/PV | Die beobachteten Optionen sind vorhanden. Die in der Quelle nicht hinterlegte Food/L-Klasse bleibt gesperrt. |
| Brandmelder | Neun Raumtypen, Rauch/Wärme, A1/A2, Neigung, Geschosse, Alarmierung, Preise | Datierter Referenzmodus vorhanden; keine neue Parameterlücke gefunden. Akustischer und normativer Nachweis bleiben offen. |
| Brandlast öffentlich | Familien, Typ/Aufbau, Lieferant, Menge/Länge, eigener Kabelwert | Referenzkatalog und eigene Werte vorhanden. Kein privater Bibliotheksimport. |
| Brandlast Premium | Einzelvariante A oder zuschaltbare Variante B | B war bei edeco immer Teil der Rechnung. Optionaler Vergleich wurde ergänzt. |
| PoE | Vier Typen, zehn Kabelansätze, PSE-Spannung und Länge | Keine neue Parameterlücke gefunden. Die veröffentlichten Typ-/RP-Annahmen sind keine vollständige IEEE-Freigabe. |
| PoE-Strecke | 1–3 Referenzsegmente, RP, Klasse, Stecksysteme, Schirmung/Patch und Einbau | Referenzoptionen vorhanden; edeco unterstützt zusätzlich beliebige dokumentierte Abschnitte. Quelleigene Benutzerbibliotheken werden nicht synchronisiert. |

## PV: konkrete Ergänzungen

Die bisher fehlende Sensitivität variiert Bezugspreis, Investition,
Jahresertrag, Eigenverbrauch und Einspeisetarif jeweils um −20/+20 Prozent.
Sie verwendet die aktuell gewählten Projektwerte für Betriebskosten,
Leistungsabnahme, Betrachtungsdauer und Brutto-/Nettokapital. Die unveränderte
Förderung wird bei der Netto-Basis separat berücksichtigt; der Eigenverbrauch
ist bei 100 Prozent begrenzt. Eine fehlende Amortisation bleibt `null` und wird
sichtbar als ausserhalb des Zeitraums dargestellt, niemals als null Jahre.

Eine eigene Darstellung zeigt die Szenarien auf derselben Jahresachse und
bewegt ihre Geometrie mit dem vorhandenen Übergangssystem. Sie ist zusammen
mit einem kompakten Jahresertragsverlauf und dem historischen Tarifvergleich
standardmässig eingeklappt. Damit ersetzt sie auch die bisher ständig sichtbare
Liste von 25 Jahresbalken. Sämtliche Zahlen bleiben im Rechenbericht enthalten.

Historische Bezug-/Einspeisewerte für 2020–2026 werden ausdrücklich als datierte
Vergleichsdaten geführt. Sie sind keine aktuelle Tarifauskunft, keine Prognose
und ersetzen die eingetragenen Projekttarife nicht.

Der Quellenrechner zeigt zudem einen pauschalen Emissionsansatz von 128 g/kWh.
Bei edeco ist ein solcher Vergleich nur nach ausdrücklicher Wahl eines eigenen
Projektfaktors aktiv. Der voreingetragene Vergleichswert ist editierbar und keine
pauschale Schweizer Klimavorgabe oder Lebenszyklusbilanz.

### Frische unabhängige Zahlenfälle

Die Default-Referenz liefert 27.64125 kWp, 26'991.680625 kWh/a und
46'990.125 CHF Bruttoinvestition bei 30 Prozent Eigenverbrauch. Beobachtete
Amortisation: 13.574394706950386 Jahre. Alle fünf Sensitivitätspaare sind als
ungerundete unabhängige Sollwerte in `pvAnalysis.test.ts` hinterlegt.

Bei 50 Prozent Eigenverbrauch wurden 10.319326975957123 Jahre beobachtet.
Mit demselben Eigenverbrauch und 96'744.375 CHF Investition waren es
24.946477326094428 Jahre; mehrere −20/+20-Proben amortisieren sich dort nicht
innerhalb von 25 Jahren. Auch diese `null`-Ausgänge werden geprüft.

Eine anschliessende unzulässige 0-Prozent-Quelleneingabe behielt im globalen
`pvaState` einen alten Zahlenstand. Dieser Fall ist als ungültig/stale markiert
und wird ausdrücklich nicht als weiterer numerischer Vergleich gewertet.

## Brandlast: optionaler zweiter Zustand

Eine neue Rechnung beginnt mit einer einzelnen Variante A. Ein zweiter Zustand
kann zugeschaltet werden. Ist B aus, werden seine gespeicherten Eingaben weder
geprüft noch als leere Nachher-Bilanz oder angebliche Reduktion ausgegeben.
Bei erneuter Aktivierung stehen die Eingaben wieder zur Verfügung, einschliesslich
eines zuvor unvollständigen Wertes. Der Bericht führt nur die aktiven Varianten.

Gespeicherte dynamische Vergleiche ohne den neuen Schalter werden ausdrücklich
auf den Zwei-Zustands-Modus migriert. Bisherige Gruppenrechnungen bleiben
unverändert. Die Grafik unterscheidet Einzelbestand und Vergleich.

## Umfang und Belege

Keine neue Prüfung kann eine nicht vorliegende Originalnorm oder Hersteller-
koordination ersetzen. Der Abgleich liest ausgelieferte Clientfunktionen und
bedient die Referenzoberfläche; serverseitiger PHP-Quellcode wurde nicht geprüft.
Nicht synchronisierte private Anbieterprojekte/-bibliotheken sind eine bewusste
Systemgrenze. Die eigenen Rechenstände und die gemeinsame edeco-Ablage bleiben
unabhängig davon nutzbar.

Ungetrackte Quellenbelege: `/workspace/scratch/elektro-reaudit-energy-20261102`.
Neue Modelltests: `workbench/pvAnalysis.test.ts`; erweitert wurden
`fireComparison.test.ts`, `migrateInputs.test.ts` und `calculationReport.test.ts`.
Zwei echte UI-Regressionsfälle in `backend/tests/test_energy_reaudit_ui.py`
prüfen Ein-/Aufklappen, reaktive Zahlen/Grafik, JSON-Export, Fehlerausblendung,
Mobilansicht und den Erhalt deaktivierter B-Eingaben.
