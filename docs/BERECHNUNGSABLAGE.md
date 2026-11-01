# Gemeinsame Berechnungsablage

Unter **Berechnungen → Gemeinsame Ablage & Einstellungen → Ablage-Einstellungen**
einen bestehenden, erreichbaren Serverordner und den gewünschten Unterordner
eintragen. Beispiel: `\\Server\Planung` und `Berechnungen`. Die Toolbox prüft
Schreiben, Lesen und Entfernen einer eigenen Testdatei. Der gewählte Unterordner
wird bei Bedarf angelegt. Alle beteiligten PCs benötigen Zugriff auf denselben
Ordner sowie passende Lese- und Schreibberechtigungen. Der Pfad wird vom Rechner
aufgelöst, auf dem das Toolbox-Backend läuft.

Die Einstellung ist pro Toolbox-PC gespeichert. Administratoren können den
Serverordner über `EDECO_CALCULATIONS_ARCHIVE_ROOT` vorgeben; dann ist er in der
Oberfläche gesperrt. Es wird hier kein Firmenserver automatisch eingerichtet.

## Aufbau und Zusammenarbeit

```text
Berechnungen/
  blitzschutz/
    P-1498--<Nummer-Prüfwert>/
      <Rechenstand-ID>/
        berechnung.json
        meta.json
        pruefsumme.sha256
        Notizen/
  emobilitaet/
    P-1498--<Nummer-Prüfwert>/
      <Rechenstand-ID>/
        ...
```

Die Projektnummer bestimmt den gemeinsamen Projektordner. Die lokale Projekt-ID
kann auf verschiedenen PCs unterschiedlich sein. Deshalb muss dieselbe
Projektnummer firmenweit dasselbe Projekt bezeichnen. Anzeigenamen und
Projektzuordnung werden je Rechenstand mitgespeichert.

Das Speichern-Symbol im Rechner erzeugt einen neuen Stand mit Eingaben,
Ergebnis, Grundlagen, Bearbeiter und Notizen. Vorhandene Stände werden nicht
überschrieben. Die Ablage zeigt auch Stände anderer PCs. **Aktualisieren** liest
neue Einträge ein. Weitere Notizen werden als eigene Dateien angehängt. Kollegen
können native Eingaben laden, neu berechnen und einen weiteren Stand speichern.

Es gibt keine SQLite-Datenbank auf dem Netzlaufwerk. Rechenstände werden zunächst
in einem temporären Verzeichnis geschrieben und danach veröffentlicht. Eine
SHA-256-Prüfsumme erkennt Änderungen an der gespeicherten Berechnungsdatei; sie
ist keine Signatur und kein fachlicher Freigabenachweis. Gleichzeitige Stände und
Notizen verschiedener Instanzen werden mit getrennten IDs abgelegt. Bei einem
nicht erreichbaren Server erscheint ein Fehler; ein lokaler Ersatzstand wird
nicht als gemeinsam gespeichert ausgegeben. Firmenseitige Backups und
Serverberechtigungen bleiben erforderlich.

Die Projektzentrale selbst bleibt lokal. Diese Erweiterung synchronisiert
Berechnungsstände und deren Projektreferenzen, keine Kontakte oder vollständigen
Projektstammdaten. Die Anwendung besitzt für den Dateiserver keine zusätzliche
Benutzerverwaltung; massgebend sind die Berechtigungen des ausführenden Kontos.

## Berechnungsexporte und Stand der Rechner

**Berechnung importieren** übernimmt PDF (bis 25 MB) oder JSON-Objekte (bis 2 MB),
mit Projekt, Rechnerzuordnung und Notizen. Die Originaldatei bleibt herunterladbar.
Ein Import übernimmt keine fremde Berechnungslogik und wird nicht als native
Berechnung wiederhergestellt.

Blitzschutz und Kabel-Spannungsfall sind Schweizer Rechenhilfen mit den in der
Oberfläche dokumentierten Grenzen. Die neue **E-Mobilität · AC-Vorplanung**
berechnet ein vereinfachtes Leistungsbudget für symmetrisches 3~ AC bei 400 V,
mit Gebäudereserve, Ladepunkten und ohne, statischem oder dynamischem
Lastmanagement. Ohne Lastmanagement gilt Faktor 1. Ein statischer Faktor ist
eine manuelle Planungsannahme; SIA-2060-Faktoren werden nicht automatisch bestimmt.
Mindestladestrom, Netzfreigabe, Phasenunsymmetrie, Kabel und Schutztechnik werden
nicht nachgewiesen. PV, Speicher und DC sind nicht enthalten.

Die E-Mobilitätsansicht zeigt Hausanschluss, Gebäudereserve und Grid-Obergrenze
in eigenen Feldern. Ein gestapelter Balken erklärt die Aufteilung des
Hausanschlusses auf Reserve, Laden innerhalb des verfügbaren Budgets und
unverplante Leistung. Nicht begrenzter Ladebedarf über dem Budget erscheint
gesondert als Warnung. Gesamtzuteilung und Strom je Ladepunkt beziehen sich auf
das vereinfachte symmetrische 3~-Modell. Beim Kabel sind Prozentwert,
gewähltes Budget, maximale Länge aus diesem Budget und Leiterwiderstand direkt
sichtbar. Die maximale Länge ist kein Strombelastbarkeitsnachweis.

Alle 25 nativen Rechenhilfen können Eingaben, Ergebnisse, Formeln, Annahmen
und Notizen gemeinsam speichern und wieder laden. Die acht bisherigen
Entwurfskacheln wurden durch bedienbare Vorprüfungen ersetzt. Dazu gehören
Mehrgrid-AC-Planung, AC/DC-Depotbudget, geometrisches Melderraster,
Herstellergrenzen-Vergleich für Schutzorganpaare, 15-Jahres-Kosten,
Dreizonen-Energiebilanz, äquivalente PoE-Streckenlänge und Brandlastvergleich.
Manuelle Norm-/Herstellerwerte bleiben deutlich gekennzeichnet.
[Umfang und Grenzen je Rechner](RECHNER_UMFANG.md).

Eine Anmeldung bei externen Referenzrechnern wird nicht in die Toolbox
übernommen. Berechnungen laufen nativ ohne Anbieteranmeldung.

Die öffentlichen Referenzrechner für E-Mobilität und Spannungsfall wurden am
1. November 2026 über einen interaktiven Browserlauf für den visuellen Vergleich
aufgerufen. Die daraus übernommenen Gestaltungsprinzipien sind sichtbare
Leistungszusammenhänge, getrennte Messwerte und kontextbezogene Warnungen.
Grosse Grafiken bleiben sinnvoll, wenn sie diese Zusammenhänge erklären.
Nach dem Speichern der Anmeldung im Browserprofil wurden auch die acht
Dashboard-Rechner und die übrigen 14 öffentlichen Rechner visuell geprüft.
Ergebnis und Grenzen: [Visueller Referenzvergleich](RECHNER_VISUELLER_VERGLEICH.md).
Die Texte der edeco-Oberfläche enthalten keine Premium-Bezeichnung mehr;
interne Ablagekennungen bleiben für vorhandene Rechenstände kompatibel.

## Prüfung

Automatisierte Tests prüfen getrennte Toolbox-Instanzen am selben lokalen
Testordner, parallele Schreibvorgänge, Notizen, Wiederholungen, Prüfsummen,
Pfadgrenzen, nicht erreichbare Ordner und Importgrenzen. Browserprüfungen decken
Einstellungen, Speichern, Wiederherstellen, Notizen, Import und Originaldownload
ab. Ein echter SMB-/Windows-Server und die firmenweiten Berechtigungen müssen
bei der Einrichtung zusätzlich praktisch geprüft werden.
