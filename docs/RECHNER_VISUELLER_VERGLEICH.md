# Visueller Vergleich mit elektro-rechner.ch

> Aktualisierung 02.11.2026: Der direkte authentifizierte Abgleich und die neuen
> UI-/Funktionsprüfungen stehen im [Gesamtaudit](RECHNER_AUDIT_20261102.md),
> [öffentlichen Audit](PUBLIC_AUDIT_20261102.md), [Premium-Audit](PREMIUM_AUDIT_20261102.md)
> und [Grafik-Audit](VISUAL_AUDIT_20261102.md). Die unten dokumentierten früheren
> Beschränkungen (etwa gesperrte SIA-Profile oder reine Dropdowns) beschreiben den
> Stand vor dieser Überarbeitung. Nicht belegte Einzelfälle bleiben eingeschränkt.

Stand: 2. November 2026. Erfasst sind die 24 regulären Themen und der zusätzlich
gefundene Netzplaner (Beta), insgesamt 25 Referenzeinstiege. edeco enthält diese
Themen als eigene Modelle sowie Arthur-Flury-Blitzschutz: 26 aktive Werkzeuge.
Der Netzplaner startet oberhalb der 26 Kacheln; in den Kacheln bleibt die
Leistungsbilanz zusätzlich geplant. [Inventar](RECHNER_INVENTAR.md) und
[Quellenabgleich](RECHNER_QUELLENABGLEICH.md) trennen funktionale Abdeckung und
numerische Belege von der Gestaltung.

## Vergleichsgrundlage

Die ursprünglichen Browserläufe vom 1. November sind
[EV/Spannungsfall](https://agent.tinyfish.ai/runs/c9400956-de03-4d1a-bdc8-f2509c6c7754),
[acht Dashboard-Rechner](https://agent.tinyfish.ai/runs/a407d01a-f871-4d15-9e7f-a16ec12f9883)
und [weitere öffentliche Rechner](https://agent.tinyfish.ai/runs/f44f24dc-f6d1-456e-88a2-4263fcddefc8).
Sie lieferten Beschreibungen sichtbarer Zustände, keine vollständige Sammlung
prüfbarer Screenshot-Dateien. Spätere Läufe ergänzten Kosten- und SIA-Zustände
sowie den [Beta-Editor](https://agent.tinyfish.ai/runs/67d57183-96fc-4193-8568-8afe36ec4944).

Anordnung, technische Beziehungen und Informationsdichte dienen als Vorlage.
edeco verwendet eigene Symbole, SVG-Geometrien und Diagramme. Eine pixelgleiche
Grafik oder vollständige Gleichheit aller Anbieterzustände wird nicht behauptet.
Fehlende Fachlogik wird durch ähnliche Symbole nicht ergänzt.

## Aktuelle eigene Darstellung

| Bereich | Darstellung und Lesebezug |
| --- | --- |
| NIN-Kabel / Zuleitungen | Auswahl von Datenbasis und Verlegebedingungen, symbolische belastete Adern beziehungsweise parallele Stromkreise, zugehörige Iz-/Überlastwerte. Datierte Referenzwerte und manuelle Werte sind unterscheidbar. |
| Spannungsfall / Verluste | Leitungs-/Budgetbezug, Volt/Prozent/Verbraucherspannung, Kosten und Formel mit aktuellen Werten. Ein Querschnitt aus ΔU ist keine vollständige Kabelauslegung. |
| Kurzschluss / Transformator | Eigene Quellen-, Trafo-, Leitungs- und Fehlerstellensymbole mit örtlich zugeordneten Werten. Kalte/warme Näherungen bleiben benannt. |
| Schutz / PA | Vorsicherungs-/Schutzkaskade und Prüfbedingungen; PE/HPA/ÖPA/FE sind getrennte Leiterfunktionen. Unterschiedliche PA-Querschnitte werden nicht als serieller Strompfad gezeichnet. |
| Motor | Ein Motor mit getrennten Nenn-/Anlaufzuständen und proportionalem Stromvergleich. Zwei Betriebszustände erscheinen nicht als zwei seriell verbundene Motoren. |
| Blindleistung / Ohm | Vorher-/Nachher-Vergleich beziehungsweise gezielte U/I/R/P-Ergebnisse. Ein reiner Formelrechner braucht keine zusätzliche dekorative Grafik. |
| Beleuchtung | Bemasster Raumplan mit tatsächlicher Anzahl und korrektem Seitenverhältnis. Empirischer Wirkungsgrad, Leuchtenbeispiele und volle Reihen bleiben als Annahmen beziehungsweise Option erkennbar. |
| PV | Generatorleistung, Jahresenergie und Eigenverbrauch als unterschiedliche Grössen; Ertragsverlauf und finanzielle Werte. Ein Jahresbilanzbild ist kein elektrischer Anschlussplan. Speicherwerte werden getrennt ausgewiesen. |
| Einfache EV-Vorplanung | UV, gerade Sammelschiene, rechts angeschlossene Reihen, Wallboxen/Fahrzeuge, Aktiv/Warten, 1~-Phase und Energie-/Erzeugungsbezug. Farben folgen Haus-/Grid-/Punktzuständen. |
| Modulare Ladegrids | Gemischte Punktgruppen, Grid-/Phasenwerte und Aktiv/Warten; LKW-PUs, Module und zugeordnete Abgabepunkte. Topologie folgt der eigenen gespeicherten Liste. |
| Ladekosten | Vier Modelle im Vergleich, Jahresachse und gestapelte Zahlungen; Fokus-/Zeigerablesung ausserhalb der Grafik. Investition/Ersatz und Betrieb werden nicht zusätzlich als Abschreibung doppelt gezählt. |
| SIA 2056 | Zwei getrennte horizontale Stapeldiagramme: W/m² nach Kcor und kWh/(m²·a) nach Jahresgleichzeitigkeit. Sieben Gruppen je Zone plus flächengewichtetes Gesamt; manuelle Ziele getrennt markiert. Fehlende automatische Profile liefern keine erfundenen Balken. |
| Brandmelder | Bemasster Rechteckraum mit Positionen; Wand-/Achsregel oder Radiusannahme klar getrennt. Keine zertifizierten Erfassungsflächen aus der Geometrie ableiten. |
| PoE | Durchgängiger PSE→Kabel/Patch→PD-Bezug, Abschnittslängen und Temperaturen, physische Kanalgrenze und elektrisches Referenzbudget getrennt. Ein Sternnetz würde die serielle Strecke falsch darstellen. |
| Brandlast | Kabel-/Fluchtwegbezug, Mengen und unabhängiger Vorher-/Nachher-Vergleich. Horizontaler Grenzvergleich und vertikale Mengenbilanz sind unterscheidbar; keine implizite CPR-Freigabe. |
| Netzplaner Beta | Horizontale Quelle→Abgänge-Anordnung, verschiebbare Bauteile, Eingangs-/Ausgangsgriffe und Autoanschluss. Inspektor für Bauteil/Leitung, Pan/Zoom und abschnittsbezogene Ergebnisse. Live-Vorschau und expliziter Prüfbericht besitzen getrennte Zustände. |

## Gemeinsame Regeln

Grosse technische Grafiken bleiben ausdrücklich erwünscht. Messwerte gehören
zum beschrifteten Abschnitt; Legenden, kurze Lesehilfen und Statusbegründungen
stehen ausserhalb der Zeichnung. Diagramme passen sich Eingaben an. Farben
stehen zusammen mit Text: Überschreitung betrifft die konkret geprüfte Bedingung
und ist keine automatische Kabel-/Normfreigabe. Diskrete Gerätenennwerte verwenden jetzt Auswahlkacheln; kontinuierliche
Mess-/Projektwerte bleiben direkt editierbar.

Der Netzplaner zeigt „noch nicht geprüft“, „Prüfbericht aktuell“ oder
„Prüfbericht veraltet“. **Berechnen & prüfen** erzeugt den Bericht; Änderungen
an Verbindungen oder Zahlen erfordern eine neue Prüfung. Der PDF-Export
bezieht sich auf einen aktuellen Prüfstand. Eine grüne Anzeige bei einem
unverbundenen Beispielnetz wird nicht als bestandener Nachweis übernommen.

Grosse Schemas und Tabellen dürfen innerhalb ihres eigenen Bereichs horizontal
verschoben werden. Texte und Einheiten sollen bei grossen und schmalen
Ansichten lesbar bleiben. Die aktuelle Integrationsprüfung kontrolliert unter
anderem SVG-Beschriftungen, Überlauf, dynamische Zustände und PDF-Daten;
abschliessende Testzahlen und Vorschaubilder werden separat ausgewiesen.

Die sichtbare Premium-Bezeichnung ist entfernt; interne IDs bleiben für
Projektstände stabil. Technischer Quellen-/Zahlenabgleich und visuelle
Verständlichkeit sind separate Prüfungen. Das Electrosuisse-Programm und der
Prüfungs-Screenshot wurden inzwischen bereitgestellt. Die elf Prüfthemen sind
sichtbar; die numerische Referenzauswertung ist noch nicht vollständig abgeschlossen.
