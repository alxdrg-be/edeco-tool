# Vorbereitete Erweiterungen

Die folgenden sechs Werkzeuge sind im gemeinsamen Katalog registriert. Ihre
Kacheln zeigen **Geplant**, sind ausgegraut und deaktiviert. Es gibt dafür noch
keine Dateizugriffe, Berechnungen oder Exporte. NOVA-Legenden und BIM2STEIGER
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
| Später | Kabelberechnung / `kabelberechnung` | Eingaben für Leitung, Länge, Last und Verlegebedingungen; Spannungsfall und Querschnitt mit dokumentierten Berechnungsgrundlagen prüfen. |
| Später | Anlagetool / `anlagetool` | Anlagen, Verteilungen und Stromkreise strukturieren; eindeutige Kennzeichnungen; Übersicht und Export für die Projektdokumentation. |

Blitzschutz-Dokumentation gehört derzeit nicht zum vorgesehenen Ausbau. Der
bisherige allgemeine Berechnungsplatzhalter wird durch Leistungsbilanz und
Kabelberechnung konkretisiert.

## Fachliche Vorbereitung

Vor eigenen Berechnungsfunktionen zuerst die vorhandenen Electrosuisse-Werkzeuge
prüfen: Eine Verlinkung oder ein unterstützter Datenexport kann sinnvoller sein
als eine zweite Berechnung. Es ist noch keine Schnittstelle zugesagt oder
angebunden. Verfügbarkeit, Nutzungsrechte und fachliche Eignung müssen für die
gewählte Lösung geklärt werden.

Für jede Berechnung müssen Grundlagen, Einheiten, Annahmen und Grenzen sichtbar
sein. Die Freigabe als nutzbares Werkzeug braucht fachlich geprüfte
Referenzfälle. Bis dahin bleibt die Kachel deaktiviert.

## Gemeinsame Grundlage für die Umsetzung

- Die IDs aus der Tabelle beibehalten. Katalog, Suche, Kategorien und SVG-Symbole
  sind unter `ui/src/toolbox/` vorbereitet.
- Oberfläche und Hell-/Dunkelmodus aus der Toolbox verwenden; pro Werkzeug ist
  eine Kennfarbe hinterlegt. Die Farben wirken nicht auf Plan- oder Exportdaten.
- Projektübergreifende Daten später in der Projektzentrale halten; einzelne
  Werkzeuge referenzieren dieselbe Projekt-ID. Das gemeinsame Datenmodell ist
  vor der ersten Umsetzung der Projektzentrale festzulegen.
- Dateiverarbeitung braucht eine Vorschau, Konfliktbehandlung und ein klares
  Speicherziel. Originale bei PDF-Exporten erhalten; Umbenennungen reversibel
  protokollieren und Überschreiben verhindern.
- Erst einen getesteten Loader in `modules.ts` registrieren, dann den Status im
  Katalog von `planned` auf `available` ändern. Keine separate EXE, kein eigener
  Updater pro Werkzeug: Erweiterungen kommen über das gemeinsame Toolbox-Setup.

Die technischen Schritte und Prüfungen stehen in
[Ein weiteres Werkzeug integrieren](TOOLBOX_ERWEITERN.md).
