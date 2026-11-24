# Toolhub – gemeinsame Oberfläche V10

Stand: 18. November 2026. Grundlage ist die vom Nutzer bereitgestellte
Präsentation «edeco Toolhub Redesign» und die anschliessende Korrektur:
Das vorhandene edeco-e bleibt das Logo; die Startseite verwendet dessen
Petrol `#017c92`.

## Design-Beta nur für Admins

Die bisherige Oberfläche bleibt standardmässig aktiv. Unter **Toolhub →
Einstellungen → Neues Design testen (Beta)** können die hinterlegten Admins
(`aduerger`, `nstrauss`) die neue Hülle und die kompakten Arbeitsflächen persönlich
einschalten. Der Schalter wirkt sofort, bleibt pro OS-Anmeldung auf diesem
Computer gespeichert und lässt sich an derselben Stelle wieder ausschalten.
Die Beta-Markierung in der neuen Kopfzeile führt ebenfalls zu den Einstellungen.

Andere Benutzer erhalten die bisherige Navigation und Darstellung. Die
Berechtigung kommt aus der OS-Anmeldung im Backend; ein Browserparameter oder
der allgemeine Demo-Modus aktiviert die Design-Beta nicht. Ein fehlender oder
nicht lesbarer Beta-Status aktiviert sie ebenfalls nicht. Der Demo-Modus bleibt
die davon unabhängige Werkzeugauswahl für Präsentationen.

Beide Oberflächen verwenden dieselben Werkzeuge, Berechnungen, Daten und
Speicherprüfungen. Fachliche Korrekturen, Quellenabbildungen und ergänzte
Werkzeugfunktionen bleiben gemeinsam; die bisherige Ansicht ist kein zweiter
älterer Programmstand. Es gibt keine getrennten Beta-Projektkopien.

Technisch: `presentation.json` bleibt unverändert im bisherigen Schema.
`design-beta.json` enthält die persönlichen Opt-ins. Das Backend liefert nur
für tatsächliche Admins einen aktiven `design_beta_enabled`-Status;
`PUT /api/toolbox/presentation/design-beta` prüft die Rolle erneut. Die
Entwicklungsfreigabe allgemeiner Einstellungen gilt nicht für diesen Endpunkt.

## Gemeinsame Bedienung

- Kopfzeile und Navigation verwenden die Werkzeugfarbe. CAD-Layer,
  Schrankfarben, elektrische Zustände und Prüfstatus behalten ihre eigenen Farben.
- Ctrl+K öffnet die gemeinsame Suche nach Werkzeugen, Projekten, Memory-Themen
  und Befehlen. Ctrl+F bleibt die Suche im geöffneten Werkzeug/Dokument.
- Ein Projekt aus der Suche zu öffnen ändert nicht das aktive Projekt.
  Bereits offene Dokumente behalten ihre Zuordnung.
- Wechsel über Suche, Seitenleiste, Logo und Einstellungen laufen durch den
  jeweiligen Speicher-/Verwerfen-Dialog des Werkzeugs. Einstellungen werden erst
  nach dem Verlassen eines bearbeiteten Dokuments geöffnet; eine Änderung des
  Demo-Modus darf keinen ungespeicherten Editor ausblenden.
- «Zuletzt verwendet» speichert auf diesem Computer die zuletzt geöffneten
  Werkzeuge. Es ist keine Wiederherstellung offener Dateien.
- Ausgeblendete Werkzeuge erscheinen weiterhin nicht auf der Startseite.
  Die vorhandene Administrationsrichtlinie gilt auch in der Suche.

## Arbeitsflächen

- NOVA: lokale Navigation innerhalb der gemeinsamen Hülle, klarer Rückweg zu
  Projekten, einklappbare Abschnitte/Eigenschaften, Symbolsuche und grosse Ansicht.
  Vorschau und Export verwenden weiterhin die tatsächliche Legende.
- PDF-Werkstatt: Werkzeugauswahl vor Dateiimport; grosser Zuschnittbereich,
  direkt sichtbare Ausgabe, einklappbare Eigenschaften und Breite/Ganzes Blatt.
  Die Verarbeitung wird als lokale Engine oder konfigurierter Dienst benannt.
- Verteiler-Dispo: Front mit Abdeckungen, Einbau und beide Ansichten nebeneinander
  verwenden denselben Dokumentstand. Geräteöffnungen, Blindstreifen und
  Hutschienen stammen aus dem vorhandenen Datenmodell.
- Berechnungen: gemeinsame Hülle, strukturierte Erklärungen und Quellen;
  Netzplaner mit einklappbarer Bibliothek und Prüfbericht. Elektrische Formeln
  und Grenzwertmodelle wurden durch dieses Redesign nicht geändert.
- Projektzentrale, Umbenennen und Dokumenten-Assistent verwenden die gleiche
  Hülle. Der Assistent unterscheidet Textextraktion, lokale Suche und Antwortdienst.
  Lokale Textextraktion wird nicht als OCR ausgegeben.

## Fachliche Korrektur und Quellen

Die Kabelberechnung verwendete im Bericht bisher fest «55 °C», auch wenn der
Vergleichsmodus tatsächlich mit 20 °C rechnete. PDF, JSON, Archiv und Erklärung
verwenden jetzt die Temperatur des Ergebnisses. Der berechnete Wert selbst
bleibt unverändert.

Das Elektro-Memory verwendet begrenzte Originalausschnitte der bereitgestellten
E-Memory-PDF für Bad-/Duschbereiche, Steckdosen und Messschaltungen. Quelle,
Seite und Dateiprüfsumme stehen im Manifest unter
`ui/src/tools/elektro-memory/reference-figures/`. Eine Vergrösserung kann die
Auflösung der ursprünglichen Rasterbilder nicht erhöhen.

Die bestehenden Electrosuisse-Vergleichstests decken ausgewählte Fälle ab.
Grüne Softwaretests sind keine vollständige NIN- oder Werkvorschriftenfreigabe.
Der aktuelle Linkcheck der Rechnerquellen ersetzt keinen erneuten fachlichen
Abgleich zugangsbeschränkter Premiumseiten.

Die hinterlegten IWB-, Primeo- und EBL-Dokumente waren am 18.11.2026 erneut
abrufbar und entsprachen den gespeicherten Prüfsummen. Die öffentlichen
Schneider-Produktseiten verweigerten dem automatisierten Abruf den Zugriff;
daraus wurde keine Änderung der Produktdaten abgeleitet. Feller DispoSuite
leitete zur Anmeldung weiter. Eine angemeldete Sitzung und ein aktueller
Vergleich des fremden Projekts standen nicht zur Verfügung.

## Verifikation

UI-Lint, Typprüfung, Produktionsbuild und sämtliche UI-Unit-Tests prüfen den
gemeinsamen Stand. Browserprüfungen laufen mit isolierter SQLite-Datenbank und
synthetischen Projektdateien gegen die lokale API. Sie umfassen insbesondere
Speicherschutz, Demo-Zugriff, globale/lokale Suche, responsive Ansichten,
unveränderte NOVA-Exporte, PDF-Seitenreihenfolge und Vektortext sowie die zwei
Ansichten desselben Verteiler-Dokuments.

Tests mit echter Windows-PDF-Laufzeit und nativen Windows-Fenstern bleiben Teil
des Windows-Builds. Ein Linux-Produktionsbuild der Oberfläche ist kein neu
erstellter Windows-Installer.
