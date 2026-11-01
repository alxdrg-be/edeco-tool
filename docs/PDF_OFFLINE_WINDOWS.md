# edeco PDF-Werkstatt unter Windows

Ab Version 0.5.0 sind Setup und Portable-Paket eigenständig. PDF-Verarbeitung
erfordert weder Internet noch Docker, Java-Installation, VPN oder Firmenserver.
Die bisherige Compose-Konfiguration bleibt eine optionale Entwicklungsreferenz;
die Windows-Ausgabe ignoriert externe PDF-Dienstadressen und Firmenkonfigurationen
für die Dienstwahl. Firmenabläufe zum Ablegen in Netzordnern benötigen weiterhin
Zugriff auf den ausdrücklich konfigurierten Zielordner.

## Laufzeit und Schutz

Der aktuelle Entwicklungsstand verwendet eine eigene edeco-Oberfläche mit elf
Werkzeug-Kacheln. „PDFs organisieren“ und „PDF zusammenfügen“ öffnen die
Dokumentreihen mit Mehrfachauswahl, Herkunftsangaben und separater Ausgabe je
Reihe. Weitere Ansichten bieten Trennen, Drehen, Zuschneiden, Seitengrösse und
Inhaltsskalierung, Kompression, PNG/JPEG nach PDF, PDF nach PNG, PDF nach TXT und
OCR Deutsch/Englisch. Dieser Stand ist noch nicht als neues Windows-Paket
veröffentlicht; die zuvor erstellte Portable-Testausgabe wird nicht verändert.

Die kostenlose Core-Ausgabe von Stirling PDF 3.2.2 enthält die Originaloberfläche
und PDFBox. Das offizielle JAR enthält Linux-PDFium; beim Windows-Build wird diese
Komponente durch JPDFium Windows x64 1.1.6 ersetzt. Hinzu kommen Temurin Java 25,
qpdf 12.4.2 und Tesseract 5.4 mit deu/eng/osd. Alle Downloads sind mit URL, Version
und SHA-256 in `packaging/pdf-runtime.lock.json` festgelegt.

Der Desktop startet den Dienst in einem eigenen temporären Sitzungsordner mit
zufälligem Loopback-Port. Ein zusätzlicher Servlet-Filter verlangt für jeden
Dienstaufruf ein zufälliges Prozessgeheimnis. Dieses bleibt im Backend und wird
nicht an den Browser gegeben. Der vorhandene Proxy verlangt zusätzlich das
HTTP-only-Sitzungscookie und überprüft Host/Origin. Keine System-HTTP-Proxys.
Die Browser-CSP beschränkt Ressourcen und Verbindungen auf lokale Inhalte.

Java startet suspendiert und wird vor Ausführung einem Windows Job Object mit
KILL_ON_JOB_CLOSE zugeordnet. So werden Java und sämtliche Unterprozesse bei
normalem Schliessen und beim Prozessabbruch beendet. Zwei gleichzeitig laufende
Toolboxen verwenden getrennte Ports, Geheimnisse und Arbeitsordner.
Beim normalen Ende wird der Sitzungsordner gelöscht. Nach hartem Prozessabbruch
können temporäre Dateien im Benutzerprofil verbleiben; die Prozesse laufen nicht weiter.

## Verfügbare Funktionen

Die eigene Oberfläche bezieht die Verfügbarkeit aus der lokalen Laufzeitprüfung.
Fehlende Voraussetzungen deaktivieren das betreffende Werkzeug. Vorschauen und
Eingabeprüfung erfolgen lokal; die Bearbeitung verwendet Stirling Core. qpdf
normalisiert bei Layoutoperationen vorhandene Seitendrehungen ohne Rasterung,
damit Querformat-Inhalte erhalten bleiben. Die Prozentangabe zur Inhaltsskalierung
wird gegen Stirlings zusätzliche automatische Formatanpassung kompensiert: 50 %
bedeutet auch beim Wechsel des Papierformats halbe Inhaltsgrösse.

Die Werkzeuge bearbeiten PDFs bis 100 Seiten und 100 MB. Der Organisieren-Bereich
und die Bildkonvertierung akzeptieren bis 20 Dateien mit insgesamt 250 MB.
Bildkonvertierung unterstützt PNG und JPEG; der PNG-Export bietet 72/144/300 DPI
und begrenzt die Gesamtausgabe auf 100 Megapixel. Trennen liefert ein ZIP.
PDF nach Text extrahiert eine vorhandene Textschicht; Scans benötigen zuerst OCR.
Zuschneiden begrenzt den sichtbaren Bereich und ist keine sichere Schwärzung.

Zusammenfügen, Trennen, Vorschaubilder, Drehen, Zuschneiden, Seitenskalierung,
Kompression, Bild/PDF- und PDF/Text-Konvertierung sowie OCR Deutsch/Englisch
verwenden ausschliesslich mitgelieferte Komponenten. OCR arbeitet über die
Tesseract-Alternative von Stirling; es sind keine OCRmyPDF-, Ghostscript- oder
Python-OCR-Installationen erforderlich. OCRmyPDF-spezifische Zusatzoptionen
(Entzerren, Reinigen, separate Textdatei, Render-Kompatibilitätsmodus und strikter
Abbruch bei vorhandener Textebene) werden nicht angeboten.

Nicht enthalten sind LibreOffice, Unoconvert, Weasyprint, Calibre, ImageMagick,
OpenCV, externe Zeitstempeldienste, Web-/URL-Konvertierung, KI und Videoverarbeitung.
Stirlings Verfügbarkeitsprüfung und explizite Gruppensperren blenden die zugehörigen
Werkzeuge in der weiterhin vorhandenen Originaloberfläche aus; die edeco-Ansichten
verwenden eine eigene, begrenzte Werkzeugliste. Kompression kann je nach Originaldatei wenig oder nichts einsparen.
OCR-Genauigkeit hängt von Vorlage, Schrift und Auflösung ab. Auch die native
Oberfläche verwendet eine mitgelieferte feste Microsoft-Edge-WebView2-Laufzeit.
Ein vorhandenes System-WebView2 ist deshalb keine Voraussetzung. Aktualisierungen
dieser festen Laufzeit erfolgen über neue Toolbox-Pakete.

## Reproduzierbarer Build

Windows x64, Python 3.11, Node 22, JDK 25 und Inno Setup:

```
python -m pip install -r backend/requirements.txt -r packaging/requirements-windows.txt -r backend/requirements-browser-tests.txt
npm ci --prefix ui
npm run build --prefix ui
python packaging/prepare_pdf_runtime.py
python packaging/make_toolbox_icon.py
pyinstaller packaging/edeco_toolbox.spec --noconfirm
iscc /DAppVersion=0.5.0 packaging/toolbox-setup.iss
python packaging/make_portable.py --version 0.5.0
```

Nur der Build lädt Abhängigkeiten. Nach gefülltem `packaging/pdf-runtime-cache`
arbeitet `prepare_pdf_runtime.py --offline` ohne Netzwerk. Ein bestehendes
Runtime-Verzeichnis wird niemals still überschrieben. Der JAR-Filterquellcode,
Originalhinweise, transitive Java-Lizenzen, Sprachdatenlizenz und Quellen von
Stirling, JPDFium, Java und Tesseract liegen in `pdf-runtime/licenses` und sind
über Info / Lizenzen zugänglich. Java behält zusätzlich seinen vollständigen
legal-Ordner. Die Laufzeit wird nach PyInstaller unverändert kopiert, damit
Prüfsummen, Binärpfade und Originaldateien erhalten bleiben.

Der bestehende Workflow `.github/workflows/build-windows.yml` prüft die Laufzeit
direkt, dann die EXE, den echten WebView-Fensterstart, Neuinstallation und erneute
Installation über denselben Profilordner. Erst danach werden Setup und ZIP64-
Portable-Paket mit SHA-256 über den bisherigen GitHub-Release-Weg veröffentlicht.
Setup bleibt ein einzelnes Asset unter GitHubs 2-GiB-Grenze. Der Updater akzeptiert
bis 1900 MiB und streamt den Download sowie die abschliessende Hashprüfung.
Vorversionen mit der alten 512-MiB-Updategrenze benötigen einmalig das vollständige
Setup von der Release-Seite. Danach läuft der bisherige automatische Updateweg.

Die mitgelieferten Tests lassen sich gegen die Runtime mit
`EDECO_TEST_PDF_RUNTIME=1` und gegen eine laufende EXE mit
`EDECO_TEST_TOOLBOX_URL=http://127.0.0.1:8799` ausführen:

```
python -m pytest backend/tests/test_pdf_stirling_live.py backend/tests/test_pdf_runtime.py -q
python -m pytest backend/tests/test_pdf_stirling_live.py backend/tests/test_pdf_packaged_ui.py -q
```

Der Browsertest blockiert öffentliche HTTP-/HTTPS-Ziele und prüft echte
Seitenvorschaubilder, einen Merge mit Inhaltsprüfung, Branding und Quellenlinks.
Kein Test benötigt einen externen PDF-Dienst. Die sonstigen Module der Toolbox
haben eigene Netzwerkfunktionen, etwa freiwillige Updateprüfung und den
Dokumenten-Assistenten; diese sind keine Voraussetzung für die PDF-Werkstatt.
