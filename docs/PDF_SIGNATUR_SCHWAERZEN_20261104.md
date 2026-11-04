# PDF-Unterschrift und sichere Bereichsschwärzung

## Unterschrift

Der grosse Editor setzt eine sichtbare PNG-Darstellung aus Bild/Logo, Zeichnung,
Name, Grund, Ort und Datum auf die angezeigte PDF-Seite. Die Darstellung kann
gezogen, mit Pfeiltasten verschoben und in der Breite angepasst werden. Eine
Vorlage lässt sich ausdrücklich im lokalen Browserprofil speichern und laden.

Die vorhandenen Seiten, Texte, Dokumentinformationen und interaktiven
AcroForm-Felder bleiben erhalten. Die intrinsische Seitendrehung wird nicht
normalisiert: Nur die Signaturdarstellung erhält die inverse Transformation.
Damit behalten Widgets auch auf 90/180/270-Grad-Seiten ihre ursprüngliche Lage.

Eine sichtbare Darstellung ist **keine kryptografische Zertifikatssignatur**.
„Mit Zertifikat signieren“ übernimmt eine vorhandene oder aktuelle Darstellung
zuerst und öffnet anschliessend das vorhandene Core-Zertifikatwerkzeug mit genau
dieser PDF. Eine qualifizierte elektronische Signatur nach ZertES wird nicht
behauptet. Die Windows-ID anderer PDF-Programme wird nicht automatisch gelesen.
Vorhandene Zertifikatssignaturen erfordern vor einer Bearbeitung eine Bestätigung,
da die neue Ausgabe deren ursprünglichen Signaturstatus verändert.

## Schwärzen

Rechtecke können direkt auf der grossen Seite aufgezogen oder aus tatsächlichen
Textzeilen der PDF ausgewählt werden. Eine Suche filtert ausdrücklich die Zeilen
der aktuellen Seite. Bei Scans ohne Textschicht bleibt die Bereichsauswahl möglich.

Der Standardexport lautet **„Sicher schwärzen · Bild-PDF“**. Die Oberfläche erklärt
vorher und verlangt eine ausdrückliche Bestätigung:

- Alle Seiten werden in einer neuen PDF aus fertig geschwärzten Bildern aufgebaut.
- Ursprüngliche Texte, Vektoren, Anhänge, Metadaten und interaktive Formstrukturen
  werden nicht in die Ausgabe kopiert. Sichtbare Formularwerte werden vor der
  Schwärzung mit dargestellt.
- Die schwarzen Pixel werden nach dem Rendern aller sichtbaren Inhalte gesetzt.
- Textsuche und Vektorfunktionen entfallen in der Ausgabe. Danach ist eine neue
  OCR auf den bereits geschwärzten Bildern möglich.
- Die Originaldatei wird nicht überschrieben.

Diese vollständige Neuerzeugung verhindert auch, dass unbenutzte gemeinsame
Image-/Form-XObjects auf unmarkierten Seiten die verdeckten Originaldaten in der
Datei behalten. Sie ist bewusst ein Bildmodus; eine verlustfreie Vektorredaktion
wird damit nicht behauptet.

Grenzen: 100 Eingabeseiten, 100 MB Eingabedatei, 500 Bereiche, 150 oder 300 DPI,
40 Millionen Pixel je Seite und 250 Millionen Pixel insgesamt, maximal 250 MB
Ausgabe. A0 ist bei 150 DPI möglich. Grössere Ausgaben werden vor dem Rendern
abgewiesen; die DPI werden nicht stillschweigend reduziert. XFA-Formulare werden
wegen fehlender verlässlicher Darstellung abgewiesen.

Nach einem erfolgreichen Export wird das **Ergebnis** an weitere Werkzeuge
übergeben. Unexportierte Schwärzungsentwürfe geben das vertrauliche Original nicht
als fertige Bearbeitung an OCR weiter. Ein fehlgeschlagener Export oder ein
ungültiger Dateiaustausch löscht ein zuvor erfolgreiches Ergebnis nicht.

## Abgrenzung zu Core 3.2.2

Die geprüften öffentlichen Originalquellen zeigen, dass manuelle Flächen und
`imageBoxes` in Core zunächst schwarze Flächen über vorhandene Inhalte zeichnen.
Die manuelle Route erzeugt erst mit `convertPDFToImage=true` eine Bildausgabe.
Deshalb verwendet der eigene Editor keine Overlay-Ausgabe als sichere Schwärzung.

- <https://github.com/Stirling-Tools/Stirling-PDF/blob/v3.2.2/app/core/src/main/java/stirling/software/SPDF/controller/api/security/RedactController.java>
- <https://github.com/Stirling-Tools/Stirling-PDF/blob/v3.2.2/app/core/src/main/java/stirling/software/SPDF/controller/api/security/ManualRedactionService.java>
- <https://github.com/Stirling-Tools/Stirling-PDF/blob/v3.2.2/app/core/src/main/java/stirling/software/SPDF/controller/api/security/RedactExecuteService.java>

## Prüfung

Die gezielten Backendfälle prüfen reale PDFs: Signaturposition, transparente
Pixel, Originaltext, Formularwerte und Widgetlage auf vier Drehungen, gedrehte
CropBox-/UserUnit-Seiten, sichere Entfernung von Text/Anhängen/Metadaten/Annotationen,
A0 bei 150 DPI, Ressourcenbudgets und API-Sitzung/Bestätigung.

Browserfälle prüfen echte Downloads, Vorlagen, Drag-/Bereichsauswahl, Dokumentzoom,
mobile Breite, Erhalt vorheriger Ergebnisse bei Fehlern sowie die Übergabe einer
sichtbaren Darstellung an eine reale Core-3.2.2-Vorschau und die Übergabe einer
geschwärzten Ausgabe an eine bereits zuvor verwendete OCR-Arbeitsansicht.
