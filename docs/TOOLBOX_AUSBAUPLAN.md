# Vorbereitete Erweiterungen

Die folgenden sechs Erweiterungen sind im gemeinsamen Katalog registriert.
Dateien umbenennen ist inzwischen als **Work in progress** nutzbar: wählbare
Namensbausteine, lokale Vorlage, Geschosserkennung und Vorschau mit Konfliktprüfung.
Der Download liefert benannte Kopien als ZIP; Umbenennung der Originale und
protokolliertes Rückgängigmachen sind noch nicht umgesetzt. Die Firmenkürzelliste
wird später ergänzt. Die Projektzentrale ist ebenfalls als **Work in progress**
nutzbar: Projektdaten, Kontakte, Dokumentverweise, Archiv und gemeinsame aktive
Auswahl mit Übernahme ins Umbenennen. Die übrigen drei Kacheln zeigen **Geplant**, sind ausgegraut
und deaktiviert. NOVA-Legenden und BIM2STEIGER
bleiben als **Work in progress** nutzbar.
Der zusätzliche Dokumenten-Assistent ist inzwischen ebenfalls als **Work in
progress** nutzbar; Details unter [Dokumenten-Assistent](DOKUMENTEN_ASSISTENT.md).
Die PDF-Werkstatt verwendet inzwischen die eingebettete Stirling-Oberfläche;
Details unter [PDF-Werkstatt](PDF_WERKSTATT_ARCHITEKTUR.md).

## Reihenfolge und vorgesehener Umfang

| Priorität | Werkzeug / stabile ID | Vorgesehener erster Umfang |
| --- | --- | --- |
| Zuerst | Dateien umbenennen / `dateien-umbenennen` | Regeln für Projektnummer, Planart, Geschoss, Revision und Datum; Vorschau alter/neuer Namen; Konfliktprüfung; protokolliertes Rückgängigmachen. |
| Zuerst | Projektzentrale / `projektzentrale` | Projektnummer, Bezeichnung, Kontakte und Projektordner; letzte Dokumente; gemeinsame Projektauswahl für weitere Werkzeuge. |
| Später | Änderungsbericht / `aenderungsbericht` | Zwei gespeicherte Projektstände vergleichen; hinzugefügte, entfernte und geänderte Einträge mit Quelle darstellen; PDF-/Excel-Bericht. |
| Später | Leistungsbilanz / `leistungsbilanz` | Verbraucher nach Verteilung gruppieren; Anschlussleistung und Gleichzeitigkeitsfaktoren nachvollziehbar erfassen; Ergebnisse mit Annahmen exportieren. |
| Vorprüfung umgesetzt | Kabelberechnung / `kabelberechnung` | Schweizer Spannungsfallmodell, Budget und Querschnittsvergleich; Verlegebedingungen, Strombelastbarkeit und Schutzmassnahmen bleiben spätere Erweiterungen. |
| Später | Anlagetool / `anlagetool` | Anlagen, Verteilungen und Stromkreise strukturieren; eindeutige Kennzeichnungen; Übersicht und Export für die Projektdokumentation. |

Auf Nutzerwunsch ergänzt der Planlieferungs-Assistent jetzt die Projektzentrale
und Dateibenennung. Der neue Bereich **Berechnungen** bündelt Blitzschutz,
Leistungsbilanz und Kabelberechnung als Unterkacheln. Leistungsbilanz bleibt
geplant. Blitzschutz und Kabel-Spannungsfall sind als ausdrücklich noch nicht
fachlich freigegebene Schweizer Rechenhilfen umgesetzt.

## Fachliche Vorbereitung

Vor eigenen Berechnungsfunktionen zuerst die vorhandenen Electrosuisse-Werkzeuge
prüfen: Eine Verlinkung oder ein unterstützter Datenexport kann sinnvoller sein
als eine zweite Berechnung. Es ist noch keine Schnittstelle zugesagt oder
angebunden. Verfügbarkeit, Nutzungsrechte und fachliche Eignung müssen für die
gewählte Lösung geklärt werden.

Für jede Berechnung müssen Grundlagen, Einheiten, Annahmen und Grenzen sichtbar
sein. Die fachliche Freigabe für den Planungseinsatz braucht geprüfte
Referenzfälle und eine Prüfung der Anwendbarkeit. Die auf Nutzerwunsch umgesetzte
Blitzschutz-Rechenhilfe bleibt bis dahin deutlich als Entwicklung gekennzeichnet;
weitere noch nicht umgesetzte Berechnungskacheln bleiben deaktiviert.

### Trennungsabstand: geprüfte Grundlage und Grenzen

Quelle (Abruf 01.11.2026):
[Arthur Flury, Trennungsabstand-Rechner](https://www.aflury.ch/de/fachwissen/trennungsabstand-rechner/),
mit veröffentlichter Formelgrafik und Faktorentabelle zur SN 414022:2024,
Seite 38, Tabelle 8. Eigenständige Implementierung und Grafik, keine Einbettung
oder Auslieferung von Hersteller-Skripten oder Bildern.

`n₀ = U/xₙ`, `s = k × (n₀/n) × A`. Mindestanzahl Ableiter:
`max(2, ceil(U/xₙ))`; im Abstandsterm wird n₀ nicht gerundet.
Klasse I: k=0.08, xₙ=10 m; II: k=0.06, xₙ=10 m; III: k=0.04, xₙ=15 m.
Das Ergebnis wird mit exakter Dezimalarithmetik auf ganze Zentimeter aufgerundet.
Ein optionaler vorhandener Abstand wird mit diesem aufgerundeten Wert verglichen.
A folgt der Leitung bis zum nächsten Potenzialausgleich, nicht pauschal der Höhe.
Metalldach-Ausnahmen werden nicht automatisch abgezogen. Für ein nach
SN EN 62305-3 gefordertes getrenntes System gelten die dortigen Berechnungen;
diese Rechenhilfe ersetzt sie nicht.

Numerisch unabhängig gegen die veröffentlichte Rechenfunktion geprüft:

| Klasse | U (m) | A (m) | n | s (m) | Mindestanzahl |
| --- | --- | --- | --- | --- | --- |
| I | 20 | 3 | 2 | 0.24 | 2 |
| II | 40 | 5 | 4 | 0.30 | 4 |
| III | 60 | 10 | 4 | 0.40 | 4 |
| III | 61 | 10 | 5 | 0.33 | 5 |
| III | 10 | 3 | 2 | 0.04 | 2 |

Dies bestätigt die Zahlenübereinstimmung, keine vollständige Normprüfung oder
fachliche Freigabe. Zusätzliche Tests behandeln Dezimalkomma, Grenzabstände,
ungültige Werte, Mindestanzahl und das Vermeiden binärer Rundungsfehler.

### Schweizer Kabelmodell und Vergleichsfälle

Auf ausdrücklichen Nutzerwunsch werden ausschliesslich Schweizer fachliche
Grundlagen verwendet. Quellen: [Elektro-Rechner Schweiz, Spannungsfall](https://www.elektro-rechner.ch/Rechner/spannungsfall.html),
[Electrosuisse, NIN 2025](https://www.electrosuisse.ch/de/nin-2025/),
Abruf 01.11.2026. Nexans Schweiz EASYCALC dient als UX-Vergleich für geführte
Eingaben; seine vollständige Kabeldimensionierung wird nicht nachgebildet.
KuMaKo/DIN und ein separates IEC-Faktormodell sind keine fachlichen Quellen.

Widerstand bei 55 °C: `R′55 = R′20 × (1 + α × 35)`.
`ΔU = f × L × I × (R′55 cos φ + X′ sin φ)/1000`, f=2 einphasig bzw. √3
für symmetrischen Drehstrom, R′/X′ in Ω/km. Cu α=0.00393/K, Al α=0.00403/K.
R′20 wird aus den veröffentlichten Tabellen mit Bezug auf SN EN 60228
übernommen; Al ist darin erst ab 10 mm² vorhanden. X′ ist ausdrücklich ein
Richtwert aus der Schweizer Referenz und kein NIN-Normwert. Das Modell ist
eine Vorprüfung, keine unabhängig bestätigte Implementierung des vollständigen
Normtexts. Die voreingestellten 4 % werden als Projektbudget behandelt, mit
Berücksichtigung bereits vorhandener Spannungsfallanteile.

Gegen die veröffentlichte Schweizer Rechenfunktion geprüft:

| Netz | Material | L (m) | I (A) | A (mm²) | cos φ | ΔU (V) | ΔU (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1~, 230 V | Cu | 25 | 16 | 2.5 | 1.00 | 6.74 | 2.93 |
| 3~, 400 V | Cu | 80 | 32 | 10 | 0.85 | 8.08 | 2.02 |
| 3~, 400 V | Al | 120 | 63 | 35 | 0.90 | 12.18 | 3.05 |
| 1~, 230 V | Cu | 60 | 16 | 2.5 | 0.85 | 13.87 | 6.03 |
| 1~, 230 V | Cu | 10 | 6 | 1.5 | 1.00 | 1.65 | 0.72 |

Der Standardquerschnitt wird allein nach diesem Spannungsfallmodell gesucht.
Strombelastbarkeit, Häufung, Verlegeart, Schutzorgane und Abschaltbedingungen
sind nicht geprüft. Die für den einfachen Prototyp vorgeschlagene reine
κ-Formel wird zugunsten der belegten Schweizer Referenz mit Temperatur- und
Reaktanzanteil nicht als vermeintlich vollständige NIN-Rechnung angeboten.

## Gemeinsame Grundlage für die Umsetzung

### Gemeinsames Projektmodell

Die Projektzentrale verwendet eine eigene SQLite-Datei unter
`<Toolbox-Datenordner>/projects/projects.sqlite3`. Jedes Projekt hat eine stabile
UUID, eine eindeutige Projektnummer, Bezeichnung, Adresse, Status (aktiv/archiviert),
Ablageordner, Notizen sowie Kontakt- und Dokumentverweise. Dokumentverweise enthalten
Titel, absoluten Pfad und Erfassungsdatum; es werden keine Dokumente kopiert oder
Projektordner automatisch angelegt. Die gemeinsame aktive Projekt-ID bleibt über
Neustarts erhalten. Archivieren entfernt die aktive Auswahl, bewahrt aber die Daten.
Eine Versionsnummer verhindert das Überschreiben neuerer Änderungen aus einem
anderen Fenster. NOVA-Projekte behalten ihre bisherigen IDs und Speicherorte;
eine automatische Zusammenführung ist nicht Teil dieser ersten Umsetzung.
Dateien umbenennen übernimmt beim Öffnen die Nummer des aktiven Projekts. Spätere
Projektwechsel werden dort bewusst übernommen, damit offene Dateivorschauen nicht
unbemerkt einem anderen Projekt zugeordnet werden.

- Die IDs aus der Tabelle beibehalten. Katalog, Suche, Kategorien und SVG-Symbole
  sind unter `ui/src/toolbox/` vorbereitet.
- Oberfläche und Hell-/Dunkelmodus aus der Toolbox verwenden; pro Werkzeug ist
  eine Kennfarbe hinterlegt. Die Farben wirken nicht auf Plan- oder Exportdaten.
- Gemeinsame Projektdaten in der Projektzentrale halten; weitere Anbindungen
  referenzieren dieselbe Projekt-ID. Das Datenmodell ist oben beschrieben.
- Dateiverarbeitung braucht eine Vorschau, Konfliktbehandlung und ein klares
  Speicherziel. Originale bei PDF-Exporten erhalten; Umbenennungen reversibel
  protokollieren und Überschreiben verhindern.
- Erst einen getesteten Loader in `modules.ts` registrieren, dann den Status im
  Katalog von `planned` auf `available` ändern. Keine separate EXE, kein eigener
  Updater pro Werkzeug: Erweiterungen kommen über das gemeinsame Toolbox-Setup.

Die technischen Schritte und Prüfungen stehen in
[Ein weiteres Werkzeug integrieren](TOOLBOX_ERWEITERN.md).
