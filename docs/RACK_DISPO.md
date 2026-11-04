# Rack-Dispo

Eigenständige physische 19-Zoll-Disposition im Toolhub. Die Anwendung verwendet eigene Vektoren und benötigt weder Visio noch eine Katalogverbindung.

## Bedienung

1. Im Toolhub **Rack-Dispo** öffnen. Der erste Plan enthält ein leeres 42-HE-Rack.
2. Rackmasse rechts ergänzen oder über **Neues Rack** ein weiteres 42-/24-HE-Rack anlegen. Die Startmasse sind anpassbare Planungswerte.
3. Geräte links suchen und hineinziehen. Mit **+** wird ein freier Platz gesucht. Patchpanel, Rangierpanel und Switch sind eigene Geräte; 24 Ports bedeuten nicht 24 HE.
4. Gerät auswählen und rechts dessen Bezeichnung, Montageseite, Unterkante, Planungsstand sowie Lieferung und Montage bearbeiten. Hersteller-/Artikelangaben und technische Masse stehen im Geräteprofil.
5. Unter **Portliste** die Anschlüsse bearbeiten. **Ausgebaut** bezeichnet die vorhandene Installation, **belegt** den verwendeten Anschluss. Unbekannt bleibt unbekannt. LWL-Anschlusskonzepte sind ausdrücklich im Profil zu beschreiben.
6. **Prüfung** zeigt Konflikte und fehlende Angaben. Aufklappen erklärt Istwert, Grenze und Ursache; **Zur Eingabe** öffnet Rack, Gerät oder Geräteprofil. Werte werden dabei nicht automatisch geändert.
7. **JSON speichern** sichert den vollständigen Plan mit eigenen Profilen und Portdaten. **Exportieren** erstellt die ausgewählten Ansichten als PDF, SVG oder DXF. Im Listen- und Portbereich stehen CSV-Dateien bereit.

Pfeil hoch/runter verschiebt eine Auswahl um 1 HE. Strg/Cmd + Klick oder Umschalt + Klick wählt mehrere Geräte. Strg/Cmd + C/V kopiert innerhalb des Racks; eine Rack-Kopie übernimmt dessen Aufbau mit neuen Kennungen und ohne doppelte physische Portziele. Rückgängig/Wiederholen stellt ganze Planstände wieder her.

Der Dokumentzoom liegt im Canvas: Strg + Mausrad, Plus/Minus, 100 %, Breite und Ganzansicht. Im Handmodus oder mit Leertaste kann die Ansicht verschoben werden.

Die technische Zeichnung behält ihre Farben unabhängig vom Oberflächenthema: Rack-Grau und weisse Geräteflächen als Startwerte. **Zeichnungsfarbe** beim Rack und **Darstellungsfarbe** im Geräteprofil hinterlegen eigene Vorlagen-/Projektfarben. Sie werden mit der Rack-Datei gespeichert und in PDF/SVG/DXF übernommen. Gelbe oder orange Projektmarkierungen werden nicht automatisch aus dem Gerätetyp oder Prüfstatus abgeleitet; Auswahl und Fehler erhalten eigene Rahmen.

## Geometrie und Prüfgrenzen

- 1 HE = 44,45 mm; 19 Zoll = 482,6 mm Montagebreite. Gehäusebreite, -höhe und -tiefe sind davon getrennt.
- Nutzbare Tiefe bedeutet Abstand zwischen den Montageebenen. Freiräume zu Vorder- und Rücktür sind eigene Angaben. Aussentiefe ersetzt keinen Innenmassnachweis.
- Geräte- und Kabelraum werden gegen die bekannte Einbautiefe geprüft. Bei gegenüberliegenden Geräten werden deren nach innen reichende Räume addiert.
- 0-HE-Zubehör benötigt Höhe und Tiefenlage. Seitliche Montagefreiheit bleibt ohne Herstellergeometrie offen. Eine gezeichnete PDU gilt nicht als freigegeben.
- Gewicht und Wirkleistung zeigen bekannte Teilsummen und fehlende Angaben. Fachboden-Nutzlast zählt die zugeordneten Geräte, das Rack deren Eigengewichte jeweils einmal.
- Die W-Summe ist kein Nachweis für VA-Auslegung der USV, Autonomie, Absicherung, Wärmeabfuhr oder Potenzialausgleich. Hauptverteilungen und IWB-/Primeo-/EBL-Werkvorschriften sind nicht Bestandteil dieses Rack-MVP.
- Neutrale Profile enthalten keine erfundenen Herstellerabmessungen. Vor einer Fertigungs-/Installationsfreigabe müssen die Hersteller- und Projektunterlagen geprüft werden.

## Daten und Exporte

Ein Entwurf wird auf diesem PC im Browser-/WebView-Profil gespeichert. Bei einem Speicherfehler bleibt eine sichtbare Meldung; JSON-Download sichert den Plan unabhängig davon. Ein defekter vorhandener Entwurf wird nicht still überschrieben. Das Öffnen einer anderen Rack-Datei verlangt eine ausdrückliche Bestätigung und validiert die Datei vor dem Ersetzen.

Die eigene Rack-Datei ist versioniertes JSON (Version 1). Ports werden intern sparsam gespeichert: nicht gepflegte Anschlüsse entstehen beim Anzeigen und CSV-Export mit dem Zustand „unbekannt“. Entfernte Geräte bleiben im Plan und unter **Liste → Entfallene Geräte** auswählbar, zählen aber nicht zur aktuellen Belegung und Stückliste.

PDF verwendet A4 mit ausgewiesenem Massstab und je Ansicht einen Geräte-/Hinweisanhang. SVG und DXF R2013 liegen in echten Millimetern vor. Seltene Zeichen ausserhalb WinAnsi können im PDF als `?` erscheinen; SVG/DXF erhalten Unicode. Der Export verarbeitet Dokumente bis 12 MiB, der JSON-Import bis 20 MiB zur Wiederherstellung grösserer Pläne. CSV verwendet UTF-8 mit BOM, Semikolon und Schutz gegen Excel-Formeln in freien Textfeldern.

Der Projektbezug wird bewusst aus der Projektzentrale übernommen. Ein späterer Wechsel des aktiven Projekts verschiebt keine Rackdaten. Eine PDF-Übergabe an andere Werkzeuge erfolgt nur per Knopfdruck, mit demselben exportierten Planstand und denselben Ansichten; am Ziel muss die Datei übernommen werden. Es werden keine Projektordner automatisch beschrieben und keine Dateien versendet.

## Technischer Aufbau

- Oberfläche und Rechenkern: `ui/src/tools/rack-dispo/`.
- Eigener Export-Router: `backend/edeco_toolbox/tools/rack_dispo/`, eingebunden unter `/api/tools/rack-dispo/export` mit dem bestehenden lokalen Sitzungsschutz.
- Keine zusätzlichen Laufzeitabhängigkeiten, externen Grafiken oder BIM2STEIGER-Schnittstellen.
- Referenzen: bereitgestellte Projekt-Rackpläne 0.1/0.2/0.3/2.1 sowie das allgemeine Raster-/Datenprinzip der Microsoft-Anleitung „Create a rack diagram“. Die Benutzerdateien wurden nur gelesen, nicht verändert oder als generische Normvorgaben übernommen.
