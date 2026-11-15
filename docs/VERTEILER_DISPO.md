# Verteiler-Dispo

Das Werkzeug plant UV und HV in Millimetern. Front- und Einbauansicht zeigen denselben Aufbau. Seine geometrischen Prüfungen sind keine automatische Freigabe einer Schaltgerätekombination.

## Einstieg

1. Im Toolhub **Verteiler-Dispo** öffnen.
2. Unter **Neu** einen freien UV-/HV-Aufbau oder eine Vorbereitung für die gewünschte Produktfamilie wählen.
3. Netzbetreiber und Quellenstand wählen: IWB, Primeo Region Basel oder EBL. Messart und konkretes Netzgebiet zusätzlich mit dem Auftrag abgleichen.
4. Bauteile anklicken oder in den Plan ziehen. DIN-Geräte rasten am tatsächlichen Reihenraster ein. Gehäuse, Felder, Schienen, Abdeckungen und eigene Profile rechts bearbeiten.
5. Zwischen **Mit Abdeckungen** und **Einbauansicht** wechseln. Die Bestückung bleibt identisch.
6. Im **Prüfbericht** einen Hinweis anklicken: Das Werkzeug zeigt Bauteil und Eingabefeld sowie Ist/Soll, Erklärung und mögliche Korrekturen.
7. Über **Export** PDF, SVG, DXF, Stück-/Klemmenliste oder die vollständige JSON-Datei herunterladen. Fertige PDFs lassen sich bewusst an PDF-Werkstatt oder Umbenennen übergeben.

Hersteller- und CAD-Farben bleiben unabhängig vom Hell-/Dunkelmodus erhalten. RAL-Bezeichnungen werden getrennt von den Bildschirmfarben gespeichert; aus einem Hex-Farbwert wird keine RAL-Freigabe abgeleitet.

## Speichern und Wiederherstellung

Autosave speichert bestätigte Änderungen lokal unter `<EDECO_TOOLBOX_HOME>/verteiler-dispo/` in SQLite. Dokumentrevisionen bleiben erhalten. Ein zweites Fenster mit altem Stand erhält einen Versionskonflikt, statt neuere Arbeit zu überschreiben.

Zusätzlich bleibt ein Browserentwurf erhalten. Ein unlesbarer oder unbekannter Import ersetzt den offenen Entwurf nicht. Bei Speicherfehlern lässt sich eine Wiederherstellungsdatei sichern. Projektstammdaten werden nur nach ausdrücklicher Übernahme aktualisiert.

Die SQLite-Datei gehört auf den lokalen PC, nicht als gemeinsam geöffnete Datenbank auf ein Netzlaufwerk.

## Zentrale Firmenvorlagen

**Firmenvorlagen** öffnet den Pfad- und Quellenstand. Administratoren können eine JSON-Bibliothek auswählen und ausdrücklich neu laden. Das Werkzeug schreibt die Serverdatei nicht um. Ein validierter Stand wird lokal anhand seiner SHA-256-Prüfsumme gespeichert; bei Serverausfall oder fehlerhaftem Ersatz bleibt der letzte gültige Stand verwendbar.

**Aktuellen Aufbau als Vorlage herunterladen** erzeugt ein Bibliothekspaket. Dieses kann bewusst auf dem Firmenserver abgelegt werden. Projektzuordnungen, Planreferenzen und Stromkreisverknüpfungen werden dabei entfernt; freie Bezeichnungen und Notizen vor der Weitergabe kontrollieren.

Bibliotheken sind begrenzte JSON-Daten in Dateiversion 1. Eigene Quellen und Artikel verwenden den Namensraum `firma:` und können mitgelieferte Datensätze nicht überschreiben. Dokumentvorlagen sind vollständige Kopien mit ihren Quellen. Das Neuladen einer Bibliothek verändert keine gespeicherten Projektpläne.

## Quellen und Nachweisgrenzen

Die ausführliche Herkunftsliste steht in [VERTEILER_QUELLEN.md](VERTEILER_QUELLEN.md).

- Originale regionale Werkvorschriften, IWB-Fernauslesungsunterlagen und Primeo-Factsheets liefern versionierte Quellen und bestimmte Apparateplatz-Geometrien.
- Phoenix-Klemmen besitzen artikelbezogene Abmessungen aus Herstellerunterlagen. Der Montagebezug und das gesamte Zubehör bleiben separat zu bestätigen.
- Pragma Multi, PrismaSeT XL, Hager-Feldverteiler und Almatec sind als Produktfamilien beziehungsweise bearbeitbare Vorbereitungen berücksichtigt. Wo der konkrete Artikel nicht verifiziert werden konnte, steht **Artikelmasse offen**. Solche Gehäusemasse sind eigene Planungswerte, keine Herstellerzusicherung.
- 30 × 5 mm Cu beschreibt einen Querschnitt, keine zugesicherte Stromtragfähigkeit. Icw braucht eine Zeitdauer; bedingter Icc braucht ein zugeordnetes Schutzgerät.
- Ein Quellenlink oder ausgefülltes IP-Feld bestätigt weder Schutzart, Erwärmung noch Kurzschlussfestigkeit der ausgeführten Kombination.
- Bauart- und Stücknachweise sowie die anwendbaren Teile von SN EN IEC 61439, NIN und VNB-Vorgaben sind fachlich abzugleichen. Vollständige lizenzierte Normtexte und alle Hersteller-Systemkombinationen sind kein automatisch geprüfter Datenbestand.

Offene Nachweise bleiben im Bildschirm und im PDF sichtbar. Wiederholte offene Hinweise werden im Bericht kompakt gruppiert; echte Konflikte und unterschiedliche Ist/Soll-Werte bleiben einzeln nachvollziehbar.

## Integration

Frontend: `ui/src/tools/verteiler-dispo/`. Backend: `backend/edeco_toolbox/tools/verteiler_dispo/`. API: `/api/tools/verteiler-dispo`.

Eine kanonische Vektorgeometrie erzeugt die Ansichten und Exporte. Der Browser ergänzt Auswahl, Fang-/Dragvorschau und Zoom; die maßgeblichen Prüfungen laufen im Backend. Es gibt keine Verbindung zu BIM2STEIGER.

Werkzeug- und Demo-Eigenschaften liegen gemeinsam in `backend/edeco_toolbox/resources/tool_contract.json`. Verteiler-Dispo ist separat für die Demo auswählbar, wird aber nicht unbemerkt in bestehende Auswahlen aufgenommen.

## NOVA-Allgemeinteil

Unter den Firmen-Legendeneinstellungen kann für die DXF-/DWG-Servervorlage **CAD-Vorlage wie gezeichnet übernehmen** gewählt werden. Dieser Modus erhält Anordnung, Farben und Schriftgrössen und erzeugt keinen zusätzlichen Allgemein-Titel. Der bisherige Zeilenmodus bleibt Standard für vorhandene Einstellungen.

**Neu laden** und die SVG-Vorschau zeigen den gespeicherten Pfad/Modus; DXF und PDF lassen sich herunterladen. Eine geladene CAD-Datei wird lokal nach Hash kopiert, damit ihre Vorschau und ihr Export denselben geladenen Stand verwenden. Beim erneuten Öffnen gilt weiterhin die aktuelle Firmenquelle; eine dauerhaft pro Altlegende eingefrorene Vorlagenrevision ist damit nicht eingeführt.
