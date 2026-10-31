# edeco PDF-Werkstatt mit Stirling-PDF

Die PDF-Werkstatt verwendet die **vorhandene Stirling-Oberfläche und deren
PDF-Funktionen**, eingebettet im Toolbox-Fenster. Sie startet keinen externen
Browser. Logo, Firmenfarben und Rückkehr zur Toolbox ergänzt die Integration.

Stirling Core 3.2.2 wird als separater Dienst betrieben, wahlweise auf demselben
Rechner oder einem internen Firmenserver. Ein gemeinsamer Server braucht diese
Einrichtung nur einmal; die Toolbox-PCs brauchen weder Docker noch Java.
Die Windows-Toolbox-EXE enthält die Integration, nicht den Java-/OCR-Dienst.

## Lokal starten

Docker Engine und Compose auf dem Dienstrechner bereitstellen. Dann im
Repository-Hauptordner:

```sh
docker compose -f deployment/pdf-workshop/docker-compose.yml up -d --build --wait
```

Alternativ das Release-Paket `edeco-PDF-Dienst-<Version>.zip` entpacken und im
entpackten Ordner direkt `docker compose up -d --build --wait` ausführen. Die
Toolbox selbst wird weiterhin mit dem normalen Setup installiert.

Der Erstaufbau lädt das festgelegte Stirling-Core-Image und freie OCR-Pakete.
Danach sind OCR Deutsch/Englisch, Ghostscript, QPDF und Bildwerkzeuge installiert;
Dokumentverarbeitung braucht keinen öffentlichen Cloud-Dienst. In der Toolbox
**PDF-Werkstatt → Verbindung** öffnen und `http://127.0.0.1:8088` eintragen.

Die Oberfläche erscheint direkt im Toolbox-Fenster. Der Dienst muss laufen,
solange PDF-Funktionen genutzt werden. Status und Protokoll:

```sh
docker compose -f deployment/pdf-workshop/docker-compose.yml ps
docker compose -f deployment/pdf-workshop/docker-compose.yml logs --tail 100
```

## Gemeinsamer Firmenserver

1. Die `.env.example` als `.env` neben der Compose-Datei ablegen.
2. `PDF_BIND_ADDRESS` auf die konkrete interne Adresse des Servers setzen,
   beispielsweise `192.168.1.20`. Standardmässig ist der Dienst nur lokal gebunden.
3. Den Dienst mit obigem Compose-Befehl starten.
4. Auf den Toolbox-PCs `http://192.168.1.20:8088` als Verbindung eintragen oder
   die Adresse über `EDECO_STIRLING_URL` zentral vorgeben.

Der gewählte Core-Build hat keine Benutzeranmeldung. Für den Firmenbetrieb nur
ein vertrauenswürdiges internes Netz/VPN verwenden oder einen authentifizierten
HTTPS-Zugang davorschalten. Den ungeschützten Port nicht im Internet freigeben.
Die Toolbox prüft ihre lokale Sitzung; das ersetzt keine Zugriffskontrolle für
einen direkt erreichbaren zentralen Stirling-Server. Lizenzpflichtige Stirling-
Benutzerverwaltung oder andere Enterprise-Funktionen werden nicht umgangen.
Eine Linux-VM mit Docker Engine vermeidet eine Docker-Desktop-Installation auf
den Arbeitsplatz-PCs. Docker Desktop hat eigene Lizenzbedingungen; es ist kein
Bestandteil der Toolbox und wird auf den normalen Toolbox-PCs nicht benötigt.

Für einen geschützten Dienst kann die IT `EDECO_STIRLING_API_KEY` im
Toolbox-Prozess bereitstellen. Der Schlüssel wird nur als `X-API-KEY` an diesen
Dienst gesendet, nie an die Oberfläche. Ein vorgeschaltetes Gateway muss ihn
tatsächlich prüfen; der anonyme Core-Build selbst tut dies nicht.

## Firmenanpassungen und Abläufe

Eine eigene Kopie von `company.example.json` an einem von der IT verwalteten
Ort ablegen. Auf den Toolbox-PCs `EDECO_PDF_COMPANY_CONFIG` auf diese Datei setzen.
Damit werden Serveradresse, Titel, Akzentfarbe und erlaubte Abläufe vorgegeben.
Eine vorgegebene Serveradresse ist in der Oberfläche nicht frei änderbar.

Beispielablauf **Als Entwurf auf X: ablegen**:

1. PDF in Stirling bearbeiten und das Ergebnis herunterladen.
2. Im Toolbox-Kopf **Firmenabläufe** öffnen und dieses Ergebnis auswählen.
3. Der Ablauf lässt Stirling den Stempel `ENTWURF` anwenden und speichert im
   vorgegebenen Ordner. Dateiname: `<Name>_Entwurf_<Zeit>_<Kennung>.pdf`.

Es werden nur konfigurierte absolute Zielordner verwendet. Der Browser darf
keine beliebigen Pfade vorgeben. Das Netzlaufwerk muss für den angemeldeten
Toolbox-Benutzer verfügbar sein; UNC-Pfade sind unter Windows ebenfalls möglich.
Vorhandene Dateien werden nicht überschrieben. Der ursprüngliche Upload bleibt
unverändert. Ein visueller Entwurfsstempel ist keine digitale Signatur.

Logo und Design liegen unter `backend/edeco_toolbox/pdf_workshop/assets/`.
Der Proxy ergänzt dieses Design an der Originaloberfläche. Upstream-Lizenz-
und Herkunftshinweise bleiben erhalten. Weitere Werkzeuge lassen sich über
`PDF_DISABLED_ENDPOINTS` auf dem Dienst deaktivieren; Stirling blendet nicht
verfügbare Werkzeuge aus. Beispiel-IDs aus der Upstream-Konfiguration:
`img-to-pdf,remove-pages` (nur setzen, wenn diese Funktionen entfallen sollen).

## Betrieb, Datenschutz und Aktualisierung

- Dokumente werden an den ausgewählten Dienst übertragen. Bei `127.0.0.1`
  bleiben sie auf dem PC, bei einer LAN-Adresse im internen Firmendienst.
- Kein Stirling-Cloud-Konto und kein KI-/API-Abo für diese Core-Integration.
  Analytics, PostHog, Scarf, Suchmaschinenfreigabe und Updatewerbung sind aus.
- Der Dienst besitzt ein normales Docker-Bridge-Netz; es ist nicht technisch
  vom Internet isoliert. Für strikt abgeschotteten Betrieb den ausgehenden
  Zugriff auf dem Dienstrechner sperren und die benötigten Werkzeuge vorab
  installieren. Externe URL-Konvertierung oder Zeitstempeldienste benötigen
  sonst ausdrücklich Netzwerkzugriff.
- Temporäre PDF-Dateien liegen im begrenzten Container-Tmpfs, das beim
  Entfernen des Containers verschwindet. Stirling bereinigt seine Tempdateien.
  Browser-Arbeitsbereiche, Downloads, Firmenablagen und Logs sind davon getrennt;
  dafür gelten die Aufbewahrungsregeln der Firma.
- Das Core-Image ist auf Version und Digest festgelegt. Updates durch IT:
  Referenz bewusst anheben, Integrationsprüfungen ausführen, Image neu bauen
  und den Dienst neu erstellen. Die Toolbox selbst aktualisiert ihren Adapter
  über den bestehenden Windows-Updateweg.
- Für ein Offline-Netz das geprüfte Image mit `docker save` exportieren,
  dort mit `docker load` importieren und Compose mit `--no-build` starten.

## Funktionsprüfung

```sh
EDECO_TEST_STIRLING_URL=http://127.0.0.1:8088 \
  .venv/bin/python -m pytest backend/tests/test_pdf_stirling_live.py -q
```

Die Tests prüfen echte Seitenreihenfolge, Zuschnitt/Seitengrösse, Suchtext nach
OCR, Raster-DPI und Stempel. Die allgemeine Toolbox-Testsuite benötigt keinen
laufenden Stirling-Dienst. Architektur, Lizenzen und Codebeispiel:
[PDF-Architektur](../../docs/PDF_WERKSTATT_ARCHITEKTUR.md).
