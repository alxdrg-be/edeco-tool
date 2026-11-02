# Lokale Absicherung und Kurzschlussfaktoren

Stand: 2. November 2026. Ergänzung zum bestehenden Rechneraudit.

## Lokaler Server

Die gemeinsame Toolbox-App schützt sämtliche HTTP-Routen und gemounteten
Werkzeuge mit einer zentralen ASGI-Middleware. Zugelassen sind die lokalen
Hosts `127.0.0.1` und `localhost`. Angegebene Origin-/Referer- und
Fetch-Metadaten müssen zur eigenen Herkunft passen. Doppelte oder ungültige
sicherheitsrelevante Header werden abgewiesen.

Schreibzugriffe benötigen die aktuelle Prozesssitzung, entweder als
`X-Edeco-Session` oder als portbezogenes `HttpOnly`-/`SameSite=Strict`-Cookie.
Ein vertrauenswürdiger GET startet die Browsersitzung. Eigene API-Clients
können `GET /api/toolbox/session` verwenden; dessen Antwort wird nicht gecacht.
Bereits vorhandene Werkzeugschlüssel bleiben zusätzlich erforderlich.
Die Middleware puffert keine Uploads und verändert keine PDF-Dateien.

Der PDF-Proxy entfernt lokale `edeco_*`-Cookies und `X-Edeco-*`-Header vor
der Übertragung zum PDF-Dienst. Dessen eigene Sitzung und die separat
eingesetzte Engine-Authentifizierung bleiben erhalten.

## ODA File Converter

Die Settings-API akzeptiert einen Converterpfad nur innerhalb der vorgesehenen
lokalen ODA-Installation unter den vom Desktopprozess ermittelten Program-Files-
Verzeichnissen. Die Prüfung umfasst Dateiname, Installationsstruktur,
kanonischen Pfad und lokalen Laufwerktyp. UNC-/Gerätepfade, gemappte
Netzlaufwerke und Symlinks aus dem Installationsbereich werden abgewiesen.

Import und Export validieren unmittelbar vor dem Programmstart erneut.
Ein unsicherer gespeicherter Altpfad wird nicht ausgeführt; es bleibt die
validierte automatische Erkennung. Benutzerdefinierte Converterpfade ausserhalb
dieses Installationsbereichs sind nicht mehr unterstützt. Der Schutz setzt die
üblichen Betriebssystemrechte der Installationsverzeichnisse voraus.

## Kurzschlussfaktoren

Netzplaner und Kurzschlussrechner verwenden denselben Faktoransatz:

| Eingestellte obere Spannungstoleranz | cmax | cmin |
| --- | --- | --- |
| +10 %, neuer Standard | 1.10 | 0.95 |
| +6 % | 1.05 | 0.95 |
| Altstand, Toleranz nicht bestätigt | 1.05 | 0.95 |

Bei fest vorgegebener Impedanz erhöht der Wechsel von 1.05 auf 1.10 den
berechneten Ik,max um 4.76 %. Bei einem bereits vorgegebenen maximalen
Quellenstrom wird die Quellenimpedanz mit demselben gewählten Faktor
zurückgerechnet, sodass kein zweiter Zuschlag auf den Quellenwert entsteht.
Der Ausschaltvermögensvergleich verwendet das aktuelle berechnete Ergebnis.

Gespeicherte Modelle ohne Toleranzfeld behalten den früheren Faktor mit
sichtbarem Altstand-Hinweis. Neue Projekte verwenden +10 %. Ungültige Werte
werden nicht durch einen Standard ersetzt. Das Modell bleibt ausdrücklich auf
400-V-Drehstrom beziehungsweise 230-V-Wechselstrom begrenzt; 230 V für
einphasige Lasten und die L–PE-Schleife bleiben darin beabsichtigt.

Der Faktoransatz ersetzt keine vollständige IEC-60909-Studie oder fachliche
Freigabe. Netzbetreiberdaten, Impedanzen, Herstellergrenzen und die konkrete
Normausgabe müssen zum Projekt passen.

## Quellenanzeige und Datenherkunft

Die Rechneroberflächen führen Normbezüge, Datenstände und Modellgrenzen.
Wiederholte Anbieterlinks sind entfernt. Im Wissens-Hub stehen die Quellen
eingeklappt, getrennt nach Fachquellen und Vergleichsdaten. Kanonische URLs,
Provenienz in Archivmetadaten und die vorhandenen Audits bleiben erhalten.

Das Bereinigen der Oberfläche erteilt keine zusätzlichen Nutzungsrechte.
Für die bereits vorhandenen Portalbilder, Katalogdaten und datierten
Vergleichsdaten sind Quellen dokumentiert; eine ausdrückliche Erlaubnis zur
Weiterverteilung wurde in den geprüften Repository-Dokumenten nicht gefunden.
Eine ausserhalb des Repositorys bestehende Vereinbarung wurde nicht geprüft.

## Prüfungen

Neue Regressionstests prüfen fremde Hosts/Herkünfte, fehlende beziehungsweise
rotierte Sitzungen, gemountete Routen, blockierte Converterpfade, Import/Export,
entfernte lokale Proxy-Schlüssel, numerische Kurzschlussgrenzen und die
Migration gespeicherter Projekte. Browserprüfungen kontrollieren die
bereinigten Rechneransichten und die eingeklappten Quellen im Wissens-Hub.

`npm test` entdeckt alle verschachtelten Testdateien automatisch. Ein zusätzlicher
Linux-Workflow prüft Pull Requests und main mit ESLint, Ruff, Typprüfung,
Rechen-, Backend- und echten Browsertests. Der Windows-Workflow prüft weiterhin
die vollständige lokale PDF-Laufzeit, EXE, Installation und Aktualisierung.
