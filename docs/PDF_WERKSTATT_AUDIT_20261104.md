# PDF-Werkstatt: Bedienung, Verarbeitung und Grenzen · 4. November 2026

Diese Überarbeitung folgt den konkreten Build-32-Rückmeldungen. Sie verwendet
native Arbeitsansichten für Seiten, Zuschnitt, OCR/Kompression und sichtbare
Signaturen/Schwärzung. Erweiterte Funktionen bleiben über Stirling Core 3.2.2
zugänglich. Der Katalog wurde mit allen 57 Einträgen abgeglichen; 49 auswählbare
Core-Startrouten wurden ohne JavaScript-Fehler geöffnet, acht Einträge bleiben
begründet deaktiviert. Dieser Einstiegstest ersetzt keinen Verarbeitungstest
aller 49 Werkzeuge.

## Geprüfte Abläufe

- Neue Dokumentreihe durch Ablegen von Seiten, Einfügemarkierung, Mehrfachauswahl,
  Reihenfolge und Undo; tatsächliche Download-PDFs enthalten die erwarteten Seiten.
- Drehen/Löschen/Extrahieren mit eigener Hauptaktion; kein zusätzlicher Download-
  Pflichtschritt nach dem Erstellen. Originaldateien bleiben erhalten.
- Einzeldatei-Werkzeuge bieten eine Auswahl. Fehlgeschlagener Import oder Export
  entfernt kein vorheriges fertiges Ergebnis. Arbeitsbereiche bleiben getrennt.
- OCR auf echtem Raster-PDF sowie Kompression mit realer Core-Verarbeitung;
  Ergebnistext, Seitentreffer und Bytevergleich geprüft. Wortzahlen zählen die
  Ergebnistextschicht inklusive vorhandener Wörter, keine Erkennungsqualität.
- Texttreffer wurden gegen sichtbare PDFium-Koordinaten bei Cropbox und allen
  vier Seitendrehungen geprüft. Schliessen leert den dokumentbezogenen nativen
  Arbeitsbereich. Der erweiterte Core-Assistent behält seine eigene Schrittfolge;
  dessen React-Speicherschutz wird nicht durch DOM-Navigation umgangen.
- Eigene Signaturdarstellung mit Bild/Logo; Originaltext und interaktive
  Formularfelder bleiben erhalten, auch bei gedrehten Seiten. PKCS#12-Signatur
  über den echten Core wurde mit synthetischem Zertifikat kryptografisch geprüft:
  CMS-Verifikation erfolgreich, Manipulation abgewiesen, eigene Bilddarstellung
  erhalten. Das belegt keine QES-/ZertES-Eigenschaft oder Windows-ID-Anbindung.
- Sichere Schwärzung zeichnet alle Seiten nach bestätigtem Hinweis neu als
  Bild-PDF; ausgewählte Bereiche werden in den Pixeln entfernt. Es werden keine
  ursprünglichen Ressourcen, Textschichten, Anhänge oder Metadaten kopiert.
  Formularerscheinungen bleiben im Bild sichtbar, soweit nicht geschwärzt.
  Geschwärzte Ergebnisse werden bei anschliessender OCR weitergegeben.
- Gemeinsame Vorschauen initialisieren Formularerscheinungen. Zusammenstellen
  und Teilen erhalten den Feldkatalog; mehrere Quellformulare erhalten getrennte
  Namensräume. Formatänderung von PDFs mit Feldern/Anmerkungen wird vorab erklärt
  abgelehnt, statt Werte oder Positionen still zu verlieren.

## Firmenserver und lokale Verarbeitung

Die installierte Windows-Ausgabe startet ihre gebündelte PDF-Engine auf dem PC.
Sie benötigt dafür keinen Firmenserver und kein Benutzerkonto. Eine separate
Stirling-Serverinstallation kann zusätzliche Office-/Web-/Konvertierungsprogramme
bereitstellen, wenn sie dort eingerichtet und freigeschaltet sind. Ein Server
schaltet weder fehlende Programme noch proprietäre Funktionen automatisch frei.

Optionale Firmenabläufe verarbeiten eine ausdrücklich ausgewählte Datei nach
einem vorkonfigurierten Profil und legen eine Kopie im vorgesehenen Zielordner ab.
Das ist kein automatischer Upload oder Versand. Die KI-Verbindung des
Dokumenten-Assistenten ist davon unabhängig.

## Grenzen

Die kompakten OCR-/Kompressionsansichten unterstützen 100 Seiten und 100 MB
Eingabe, mit höchstens 250 MB Ausgabe. Weitere Grenzen gelten für Pixelbudgets
der Vorschauen und der sicheren Bildredaktion. Bei grösseren Dokumenten muss die
Datei aufgeteilt oder ein geeignetes erweitertes Werkzeug bewusst gewählt werden.
Ein schwarzes Rechteck als gewöhnliche Anmerkung ist keine sichere Schwärzung.
