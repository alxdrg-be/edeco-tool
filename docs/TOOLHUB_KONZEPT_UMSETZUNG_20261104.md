# Umsetzung der Toolhub-Entwürfe · 4. November 2026

Die besprochenen Ansichten sind in die vorhandene Anwendung integriert. Bestehende
Werkzeuge, Datenpfade und gespeicherte Legenden bleiben nutzbar. Es entsteht kein
zusätzlicher Plankopf; Planlieferung und die ausgeblendeten Werkzeuge werden nicht
wieder in die Startübersicht aufgenommen.

## NOVA-Legenden

- Grosse Exportvorschau mit ausblendbarer Abschnittsliste; Grössen- und
  Fortschrittsangaben liegen ausserhalb der Zeichnung. A4/A3-Prozentwerte beziehen
  sich ausdrücklich auf den Höhenbedarf, nicht auf eine behauptete Flächenbelegung.
- Originalmassstab, proportional einpassen und optisch angleichen. Die optische
  Angleichung darf kleine Zeichnungen vergrössern und hält lange Symbole innerhalb
  ihres breiten Feldes. Symbolfeldhöhe und Zeilenraster werden getrennt angezeigt.
- Mehrfachauswahl von Geschossen pro Legende. Vorschau, Varianten, Zählung und
  PDF/DXF/DWG benutzen denselben Ausgabeweg. Handtexte und bewusst beibehaltene
  Einträge bleiben erhalten. Fehlende Geschosse sperren den Export mit Erklärung.
- Die drei Zählungen bedeuten Bauteile inklusive unbekannter Apparate, erkannte
  Symbolfamilien und tatsächlich sichtbare Ausgabezeilen im Apparateteil.
- Quellenfarben werden pro Importversion und tatsächlichem Mitglied ausgewertet.
  Gleich benannte Layer in verschiedenen Geschossen dürfen verschiedene Farben
  haben. Alte Importe ohne belegte Farbaufnahme erhalten einen Hinweis; sie werden
  nicht still als neu geprüfte Quelle dargestellt.
- Acht optionale Variantenregeln verändern ausschliesslich eine Ausgabekopie.
  Die Gruppierung benötigt übereinstimmende Katalogdaten. UP/AP benötigt zusätzlich
  tatsächliches Vorkommen und eindeutige Mitgliedsfarben. Unklare Fälle bleiben
  unverändert und werden erklärt. Einzelzeilen, Typcodes und Mengen bleiben erhalten.
- Beim Bearbeiten einer gefilterten Kombination öffnet sich der richtige
  Originalteil, auch bei gleicher Grafik und unterschiedlicher Farbe/Drehung.
  Rein erzeugte Varianten werden nicht als unabhängig gespeicherte Quelle ausgegeben.
- Textmodi Umbruch, Warnung mit Vorschlag und automatische Abkürzung. Die
  editierbare Tabelle enthält Rubrikbezug und Aktivierung; CSV-Import verlangt
  eine Bestätigung. Ein grosser Dialog erleichtert die Bearbeitung. Schriftbreiten
  werden tatsächlich gemessen. Originaltexte, Nummern, Einheiten und Typcodes bleiben
  erhalten. Ungeklärte Texte werden weiterhin lesbar umgebrochen.
- Farbprüfung für Rubrikfarben mit einstellbarem ΔE00-Abstand und Graustufenvorschau.
  Hinweise färben keine Quellsymbole um. Die Schwelle ist keine Normgrenze.
- Projekt- und Firmenvorgaben speichern nur Darstellung, Text- und Variantenregeln.
  Firmenänderungen erfordern die vorhandene Adminberechtigung. Gespeicherte
  Legenden werden durch eine neue Vorgabe nicht automatisch umgestellt.

## Memory und Netzplaner

Das Memory erhält unterscheidbare T13-/T23-/T15-/T25-Kontaktbilder, einen
interaktiven IP-Decoder und ein zugängliches seitliches Infopanel. Kennziffern,
X, Zusatzbuchstaben und Quellen stehen im Detail. IPX7/8 wird nicht mit einer
Strahlwasserprüfung gleichgesetzt. Favoriten werden nur auf diesem PC gespeichert.

Bad-/Duschzeichnungen bleiben neutral, solange der passende NIN-7.01-Referenzfall
nicht bestätigt ist. Die fehlerhaften farbigen Entwurfsflächen werden nicht
ausgeliefert. Die PSA-Hilfe erklärt benötigte Angaben; sie erzeugt keine
Kleidungsfreigabe allein aus Ik.

Der Netzplaner kann eine ausdrücklich gewählte Variante ohne Änderung des
aktuellen Dokuments vollständig rechnen und vergleichen. Übernehmen erzeugt
einen neuen Prüfstand und bleibt rückgängig machbar. Veraltete Vorschauen und
ungültige Eingaben sperren die Übernahme. Das Nichterreichen einer oberen
magnetischen Schwelle wird nicht als bewiesene konkrete Abschaltzeit dargestellt.

## Dateiweitergabe und KI-Ziel

NOVA kann ein gespeichertes PDF ausdrücklich an die PDF-Werkstatt übergeben.
Fertige PDFs lassen sich zum Umbenennen weiterreichen und als benannte Kopien
herunterladen. Jede Übergabe verlangt eine Übernahme am Ziel. Sie bleibt nur im
Sitzungsspeicher und ersetzt keine vorhandene Auswahl oder Projektzuordnung.
Es erfolgt kein automatischer E-Mail-Versand und kein automatisches Schreiben
in einen Projektordner.

Der Dokumenten-Assistent zeigt das konfigurierte KI-Ziel ohne Zugangsdaten oder
Query-Schlüssel und benennt die übergebenen Inhalte. Lokale Suche, lokale KI,
private Netzadresse und sonstiger Netzwerkendpunkt werden unterschieden;
eine feste Aussage «Internet: nichts» wird nicht verwendet.

Die Rechner-Erklärungen des Branches `claude/vigilant-edison-frtpvf` sind mit
unveränderter Historie übernommen. Diese Überarbeitung ist kein vollständiger
Normenaudit und keine Anlagenfreigabe.
