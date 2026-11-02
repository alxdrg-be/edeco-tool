# Rechnerüberarbeitung und direkter Quellenabgleich

Nachtrag: Die anschliessenden Änderungen an Serverabsicherung,
Kurzschlussfaktoren, Quellenanzeige und CI sind unter
[Absicherung und Rechenfaktoren](ABSICHERUNG_20261102.md) dokumentiert.

Stand: 2. November 2026. Grundlage ist der aktuelle `main`-Stand `8b2128aa`.
Die bestehenden Rechner, Projektstände, internen IDs, Berechnungsablage und
PDF-/JSON-Wege wurden weiterverwendet. Der frühere separate 17-Rechner-Entwurf
ist nicht Bestandteil dieser Umsetzung.

## Umfang und belastbare Aussage

Die bekannte Referenzsammlung umfasst 25 Einstiege: die öffentlichen Themen,
angemeldete Erweiterungen und den Netzplaner. Dazu kommt das separate
Arthur-Flury-Blitzschutzmodell; edeco hat damit 26 aktive Rechenmodelle.
Alle 26 wurden im eigenen Browser mit der tatsächlichen lokalen Projekt-API
geöffnet. Gültige Ausgangswerte liefern Ergebnisse, die Hauptparameter
verwenden kompakte Auswahlfelder und die schmale 390-px-Ansicht hat keinen globalen
horizontalen Überlauf. Grössere technische Zeichnungen sind innerhalb ihres
beschrifteten Bereichs verschiebbar.

Die Anbieterprüfung verwendet einen eigenen angemeldeten Browser und lesbare
Clientquellen, keinen Tinyfish-Aufruf. Der serverseitige PHP-Code wurde nicht
eingesehen. Eine Übereinstimmung veröffentlichter Zahlen ist keine unabhängige
Bestätigung aller Normzuordnungen, Herstellerfreigaben oder sämtlicher
möglicher Eingabekombinationen. Nicht belegte oder widersprüchliche Fälle
werden ausdrücklich begrenzt; keine unvollständige Funktion erhält allein
aufgrund einer ähnlichen Grafik eine Freigabe.

## Oberfläche und Wissens-Hub

- Bewusste Mischung aus kompakten Dropdowns und Auswahlkacheln. Lange Listen,
  Nennströme, Querschnitte und Icn verwenden Dropdowns; kurze Entscheidungen
  bleiben direkt sichtbar. Die LS-Charakteristik zeigt B/C/D/K/Z mit der
  passenden Kurzbeschreibung darunter. Gespeicherte eigene Projektwerte werden
  sichtbar erhalten, nicht still auf eine Vorgabe gerundet. Kabelkataloge haben
  eine eigene Suchfunktion.
- Ruhige Katalogkacheln, unterschiedliche Lucide-Symbole und lokal eingebundene
  Inter-Schrift mit normaler Breite. Keine externen Font-Abfragen im Betrieb.
- Ausführliche Lesehilfen, Bildunterschriften, Formeln und Voraussetzungen
  starten geschlossen. Kritische Fehler und die aktuellen Prüfaussagen bleiben
  direkt sichtbar. Info-Drawer unterstützen Escape, Fokusfalle und Fokusrückgabe.
- Elf Wissensthemen sind global und aus den Rechner-Drawern erreichbar. Alle
  Rechenmodelle sind zugeordnet. Deep-Links, Browser-Zurück und Rückkehr zum
  bearbeiteten Rechner erhalten die gespeicherten Eingaben. Der Einstieg über
  `#toolbox` ist ausdrücklich als Regression geprüft.
- Positionen bleiben erweiterbar: Schutzstufen, Ladegrids, Punktgruppen, Power
  Units, Kosten-, Brandlast- und PoE-Segmente. Sie werden nicht durch ein festes
  Bild oder einen einzigen Summenparameter ersetzt.

## Wesentliche fachliche Ergänzungen

| Bereich | Ergänzung und Nachweis |
| --- | --- |
| Öffentliche Rechner | Alle 16 Themen erneut gegen Eingaben, Optionen und veröffentlichte Logik inventarisiert. Vorhandene unabhängige Zahlenfälle erhalten. Neue konkrete Lücken und Fälle im [öffentlichen Audit](PUBLIC_AUDIT_20261102.md). Arthur-Flury ist im [separaten Abgleich](ARTHUR_FLURY_AUDIT_20261102.md) dokumentiert. |
| Verlustleistung | Cu 300 mm² bei DC/cos φ = 1 möglich; andere AC-Fälle bleiben ohne belegtes X′ gesperrt. Frischer tatsächlicher Browserfall ergänzt. |
| LS | Optionaler eng begrenzter Hager-Referenz-Backupmodus. Kein Übertragen auf 3-kA-Geräte, LS über 63 A oder falsche Produktfamilien. Herstellerbestätigung bleibt getrennt. |
| Brandlast | 467 datierte Kabelfakten mit Familien, Lieferanten, CPR und Ersatzbezug. Kritische CPR kann nicht durch einen allgemeinen Nachweis-Haken neutralisiert werden. Eigene Kabelwerte bleiben möglich. |
| Selektivität | Eine bis sechs Schutzstufen mit NH/B/C/D/K/FI/TMD/ETU und Kabelpfad. Referenz-Kurzschlusswerte reproduziert; TT/IT erhalten ohne weitere Daten keinen vorgetäuschten TN-Schleifenwert. Nennstromverhältnisse allein ergeben keine pauschale volle Selektivität. |
| Brandmelder | Raumtyp, Höhe, Neigung, Rauch/Wärme, Alarmierung, Gruppen und Materialkosten im datierten Referenzmodus; fünf reale Anbieterfälle geprüft. Manuelles geometrisches Modell bleibt erhalten. |
| SIA 2056 | Veröffentlichtes p/e/Standby-Profilmodell mit 16 Nutzungen, sieben Gruppen, Klassen, vier Zonen, Klima und PV. Sechs unabhängige Browserzustände geprüft. Die ausdrücklich fehlende Food/L-Klasse bleibt gesperrt. |
| Ladekosten | Fünf reale Zustände mit allen vier Vertragsmodellen, Basic/Advanced und Ausbaujahren. Neuer Referenzmodus neben bisherigen Projektannahmen; PDF beschreibt die tatsächlich verwendete Grundlage. |
| Ladegrids | Individuelle PKW-Grid-Modi und Faktoren; physische gemeinsame Haus-/Phasenbilanz statt der widersprüchlichen Anbieter-Summenkappung. LKW kennt AC-/DC-PU-Leistungsbezug sowie einen expliziten Aktiv/Wartend-Modus mit Mindestleistungen. Details und weitere Grenzen im [Premium-Audit](PREMIUM_AUDIT_20261102.md). |
| PoE | Drei zusätzlich authentifizierte Mehrsegmentfälle bestätigen den vorhandenen Kern. Elektrische Referenzreserve und physische 100-m-Länge bleiben getrennt. |

## Grafikprüfung und weiche Übergänge

Geprüft werden Bezug zum Rechenstand, Grenzfarben, Beschriftungen,
Fehlerzustände, Seitenverhältnisse und direkte Interaktion. Ein ungültiges
Kabelresultat zeigt keine erfundene 230-V-/3~-Anzeige. Der Blitzschutz-Leitungsweg
A verändert keine erfundene Gebäudehöhe. Vorhandener und erforderlicher
Abstand verwenden dieselbe adaptive Skala. DC bleibt am DC-Punkt beschriftet;
die vorgelagerte AC-Aufnahme ist getrennt.

Geometrieänderungen interpolieren mit einem gemeinsamen, abbrechbaren
260-ms-Übergang. Das betrifft unter anderem Kabelkurve/-querschnitt,
Abstandsvergleich, Raumplan, Kosten-/Vergleichsbalken und SIA-Segmente.
Schnelle Folgeeingaben ersetzen das vorige Animationsziel. Direktes Ziehen
folgt dem Zeiger; reduzierte Bewegung schaltet die Interpolation aus.
Rechenergebnisse und Fehlerstatus sind sofort aktuell. Bei ungültigen Eingaben
verschwindet die gültige Ergebnisgeometrie unmittelbar.

Eine zusätzliche Stromflussdarstellung läuft im EV-, Mehrgrid-/Depot- und
Netzplaner-Schema nur auf Abschnitten mit tatsächlich berechnetem, endlichem
Strom bzw. Leistungsfluss. Wartende Punkte, stromlose Sammelschienenschwänze und
ungültige Netzabschnitte bleiben statisch. Bei bekannter Rückspeisung kehrt sich
die Bewegungsrichtung um. Das Muster ist schematisch; seine Geschwindigkeit ist
keine Darstellung des momentanen Wechselstroms oder eines Strombetrags.
Reduzierte Bewegung und Druck schalten es aus.

Ein echter Browsertest misst Zwischenposition, Endposition, schnelle
Folgeänderung, Fehlerausblendung und reduzierte Bewegung. Weitere Belege stehen
im [Grafik-Audit](VISUAL_AUDIT_20261102.md).

## Reproduzierbare Prüfung

Die Prüfung umfasst Produktionsbuild, alle registrierten TypeScript-Tests,
gezielte echte Browserprüfungen der Rechneroberfläche, Wissensnavigation,
erweiterbaren Positionen, Netzplaner, Ablage und tatsächlichen PDF-Downloads.
Der abschliessende Produktionsbuild ist erfolgreich. Alle **308** registrierten
TypeScript-Rechen-, Quellen- und Regressionstests bestehen. Die vollständige
gewählte Browser-/Ablage-Suite hat **74 bestandene Prüfungen, einen bewusst
übersprungenen Test und keine Fehler**. Übersprungen wurde nur die externe
Stirling-PDF-Live-Integration, weil `EDECO_TEST_STIRLING_URL` nicht gesetzt ist;
die nativen Rechner-PDF-Exporte wurden tatsächlich geprüft. Alle 26 Modelle
bestehen zusätzlich den Desktop-/390-px-Lauf mit der echten lokalen Projekt-API.
Reine Tests eigener Formeln werden ausdrücklich nicht als zusätzliche
unabhängige Anbieterfälle gezählt.

Lokale Prüfkommandos ab Repositorywurzel:

```sh
npm --prefix ui run build
npm --prefix ui test
PYTHONPATH=backend NOVA_TEST_CHROMIUM=/usr/bin/chromium .venv/bin/python -m pytest \
  backend/tests/test_editor_navigation.py backend/tests/test_network_planner_ui.py \
  backend/tests/test_calculation_archive.py backend/tests/test_visual_animation_ui.py \
  backend/tests/test_current_flow_ui.py
```

Chromium-Pfad und Aktivierung der Python-Umgebung sind plattformspezifisch.
Die Testdatenbanken sind isoliert; keine echten Projekte werden verändert.

## Ansichten und Arbeitsbelege

- Eigene Übersicht: `/workspace/artifacts/edeco-rechner-katalog-hell.png`.
- Wissens-Hub: `/workspace/artifacts/edeco-wissens-hub-hell.png`.
- Referenzrundgang: `/workspace/artifacts/elektro-rundgang/referenz-rundgang.mp4`.
- Tatsächliche Plus-/Auswahlinteraktionen: `/workspace/artifacts/elektro-rundgang/interaktionen-plus-auswahl.mp4`.
- Eigene weiche Skalierung: `/workspace/artifacts/visual-audit/edeco-skalierung.mp4`.
- Eigener gültigkeitsabhängiger Stromfluss: `/workspace/artifacts/visual-audit/edeco-stromfluss.mp4`.
- Finale gemischte LS-Auswahl: `/workspace/artifacts/edeco-main-ls-hybrid.png`.
- Alle-Modelle-Prüfprotokoll: `/workspace/artifacts/edeco-integration/all-calculators-smoke.json`.
- Datierte Browserzustände und Quellhashes: `/workspace/scratch/elektro-reference-20261102`.

Diese Arbeitsbelege enthalten keine gespeicherten Zugangsdaten oder
Sitzungscookies. Vollständige fremde HTML-Anwendungen und deren JavaScript
werden nicht als Bestandteil der eigenen Anwendung ausgeliefert.

Änderungen sind zur lokalen Prüfung vorbereitet. Es wurde weder gepusht noch
eine Umgebung oder Website veröffentlicht.
