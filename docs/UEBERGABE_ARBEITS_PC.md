# Weiterarbeiten am Arbeits-PC

Repository: https://github.com/alxdrg-be/edeco-tool
Branch: `pdf-werkstatt-eigene-ui`
PR: https://github.com/alxdrg-be/edeco-tool/pull/2 (Entwurf)

## Einstieg

Repository am Arbeits-PC mit GitHub-Zugriff öffnen oder klonen. Vor Änderungen
lokalen Git-Status prüfen und bestehende Arbeit erhalten. Den genannten Branch
verwenden. Dieser lokale Desktop-Chat wird durch GitHub nicht mitübertragen;
diese Datei ist die fachliche Übergabe für einen neuen Codex-/Cursor-Chat.

## Aktueller Stand

- Eigene edeco-PDF-Oberfläche mit elf Kacheln und Dokumentreihen.
- Zuschneiden durch Aufziehen eines Rechtecks auf der Vorschau. Relativer
  Bereich für alle Seiten, nur aktuelle Seite oder visuell ausgewählte Seiten.
  Genaues Eingeben der Ränder in mm bleibt als Tastaturalternative erhalten.
- Trennen durch anklickbare Trennstellen zwischen Seitenminiaturen. PDF-Nummern
  zeigen die Gruppierung. Auch keine Trennstelle und jede Seite einzeln möglich.
- Anklickbare Seitenminiaturen in den anderen PDF-Ansichten, Checkboxen für
  Bildausgabe und ausgewählten Zuschnitt.
- Dokumenten-Assistent: „Dokumentordner“ verbindet einen absoluten lokalen oder
  Windows-Freigabepfad. Manueller, lesender Abgleich von PDF/TXT/MD-Dateien in den
  persönlichen Suchindex, inklusive geänderter/entfernter verwalteter Kopien.
  Vorher manuell importierte Duplikate bleiben erhalten. Keine Serverdatei wird
  verändert. Trennen/Ordnerwechsel behalten vorhandene lokale Kopien.
- Anleitung direkt in „Dokumentordner“ und „KI-Verbindung“, ausführlich unter
  [Dokumenten-Assistent](DOKUMENTEN_ASSISTENT.md).
- Ollama durchsucht keine Freigabe selbst: die Toolbox sucht im lokalen Index
  und sendet Frage plus passende Auszüge an den konfigurierten KI-Dienst.

## Prüfstand und Grenzen

- Gesamtsuite: 347 bestanden, 35 optional übersprungen.
- Fünf Integrationstests gegen die echte mitgelieferte lokale Windows-PDF-Laufzeit
  bestanden. Darin: Rechteck mit der Maus wählen, tatsächliche Ausgabeabmessungen,
  visuelle Trennstellen und Inhalt der ausgegebenen PDFs sowie bisherige Werkzeuge.
- Ordner-Dialog im Browser geprüft: Verbinden, Suchen, Aktualisieren und Trennen.
- Kein echter Firmen-SMB-Server und kein tatsächliches Firmen-Ollama geprüft.
- Ordner: 200 Dateien, 250 MB gesamt, 100 MB je Datei; 5000 Dateisystemeinträge.
  Kein automatischer Hintergrundabgleich; jeder PC hat einen eigenen Index.
- Zuschneiden ist keine sichere Schwärzung. PDF-Werkstatt maximal 100 Seiten.
- Die vorhandenen lokalen Windows-Testpakete mit Commit `8a5cba73` enthalten diese
  neuesten Änderungen noch nicht. Sie liegen nur auf dem bisherigen Rechner
  unter `dist-installer`, nicht auf GitHub.

## Nicht auslösen

Nicht ohne ausdrücklichen Auftrag mergen, auf `main` pushen oder veröffentlichen.
Ein Push auf `main` startet Build und Release. Kein neuer Windows-Build für die
hier beschriebenen Änderungen beauftragt. Keine Cloud-Anwendung veröffentlichen.

## Umgebung am neuen Rechner

Python-/Node-Abhängigkeiten stehen in `backend/requirements*.txt` und
`ui/package.json`. Übliche Prüfungen:

```powershell
python -m pytest backend/tests/test_pdf_operations.py backend/tests/test_document_folders.py backend/tests/test_documents.py -q
npm --prefix ui ci
npm --prefix ui run build
npm --prefix ui test
```

Python-Umgebung vorher gemäss Repository einrichten. Für Browserprüfungen
`backend/requirements-browser-tests.txt` installieren und Chromium vorbereiten.
Für echte PDF-Laufzeittests die Windows-Laufzeit nach
[PDF offline unter Windows](PDF_OFFLINE_WINDOWS.md) vorbereiten. Die ignorierten
Verzeichnisse `.tools`, `packaging/pdf-runtime` und Build-Pakete werden nicht von
GitHub mitgeklont. Ohne diese Laufzeit keine erfolgreichen Windows-/PDF-Tests
behaupten. Für reine Weiterentwicklung muss nicht sofort ein Installer gebaut werden.

## Startprompt für Codex oder Cursor

> Arbeite im Repository alxdrg-be/edeco-tool auf pdf-werkstatt-eigene-ui weiter.
> Lies zuerst docs/UEBERGABE_ARBEITS_PC.md und prüfe Git-Status und Änderungen.
> Bewahre lokale Arbeit. Prüfe die visuelle PDF-Bedienung und die neue
> Dokumentordner-Anbindung. Nicht mergen, auf main pushen oder Windows-Pakete
> bauen/veröffentlichen, bevor ich das ausdrücklich beauftrage. Frage nach
> meinem nächsten Änderungswunsch, wenn keine konkrete Aufgabe offen ist.
