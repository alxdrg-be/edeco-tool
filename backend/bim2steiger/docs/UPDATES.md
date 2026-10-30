# Start, Einstellungen und Updates

Stand: 22.10.2026, Programmversion 0.3.1.

## Katalog öffnen

Den vollständigen Katalog über `Start_BIM2STEIGER.cmd` oder das installierte BIM2STEIGER-Programmsymbol starten. Die HTML-Datei allein kann die lokale API nicht bereitstellen. Beim direkten Öffnen zeigt sie deshalb eine Startanleitung mit einem Link zur bereits laufenden Anwendung. Standardadresse: `http://127.0.0.1:8765/bim2steiger.html`; der Starter kann bei belegtem Port eine andere Adresse wählen.

`Start_BIM2STEIGER_Beta.cmd` bleibt die separate Beispielansicht. Die vollständige Anwendung ist `web/bim2steiger.html`.

Auch die installierte Windows-Version verwendet beim erneuten Öffnen ihre bereits laufende Instanz. Ist der Standardport durch eine andere Projektkopie belegt, wählt sie einen freien Port zwischen 8765 und 8780. Ein ausdrücklich angegebener Port bleibt verbindlich.

## Einstellungen

«Einstellungen» steht in der linken Navigation und ist zusätzlich über die Versionsanzeige im Fussbereich erreichbar. Angezeigt werden Programmversion, Buildnummer, Startart, Zeitpunkt und Ergebnis der letzten Updateprüfung sowie der Umfang der Bilderfassung.

Die Prüfung beim Start ist standardmässig aktiviert und kann abgeschaltet werden. Diese Präferenz liegt im Browser unter `bim2steiger:updates:v1`. Verfügbare Updates erscheinen zusätzlich als Hinweis am Anfang der Anwendung. Eine manuelle Prüfung bleibt jederzeit möglich.

## Private GitHub-Releases

Die Updatequelle ist fest `Dobolino/BIM2STEIGER`. Eine bereits vorhandene lokale GitHub-Anmeldung über Git Credential Manager kann ohne neue Anmeldung verwendet werden. Git ist für den Katalog nicht erforderlich. Ohne diese lokale Anmeldung zeigt die Anwendung den privaten Zugriff als nicht verfügbar und bietet die Release-Seite im angemeldeten Browser an. Eine Browseranmeldung wird nicht ausgelesen. Es werden keine Zugangsdaten im Projekt oder in den Einstellungen gespeichert.

Ein neuerer Build wird numerisch anhand von Version und Buildnummer erkannt. Bei genau einer passenden Windows-Setupdatei mit SHA-256-Digest bietet die installierte Windows-Version «Update installieren». Dabei wird ausschliesslich die zuvor geprüfte Setupdatei dieses Repositorys heruntergeladen. Grösse und SHA-256 werden vor Ausführung überprüft. GitHub-Anmeldedaten werden bei einer Weiterleitung auf den Asset-Server entfernt. Grundlage: [GitHub Releases API](https://docs.github.com/en/rest/releases/releases) und [Release Assets API](https://docs.github.com/en/rest/releases/assets).

Nach erfolgreichem Download schliesst BIM2STEIGER zuerst Fenster und Prozess. Erst danach öffnet sich der Installationsassistent. Das Setup schliesst eine noch laufende BIM2STEIGER-Instanz selbst. Die Deinstallation steht im Startmenü unter «BIM2STEIGER deinstallieren» und in den Windows-Apps. Das Schliessen des Fensters beendet den Prozess `BIM2STEIGER.exe`; der Task-Manager zeigt danach keinen solchen Eintrag mehr. Das Setup beendet verbleibende Prozesse, die diese Dateien noch offen haben. Der Abschluss des Assistenten bleibt beim Benutzer. Die Oberfläche behauptet zu diesem Zeitpunkt noch keine abgeschlossene Installation. Ein Quellcode-Start wird nicht durch ein Setup überschrieben und bietet stattdessen den GitHub-Download an. Einmalig muss die neue Version installiert werden, bevor eine ältere Installation ohne Updateoberfläche diese Funktionen erhält.

Programm, Task-Manager-Eintrag, Setup und Installationsordner heissen BIM2STEIGER. Der Ordner ist `%LOCALAPPDATA%\Programs\BIM2STEIGER`, die Programmdatei `BIM2STEIGER.exe`. Ältere Setup-Dateinamen `Steiger2Bim-Setup-…` bleiben für bereits veröffentlichte Releases gültig.

## Build und Prüfung

`version.json` enthält die Quellversion. Der GitHub-Workflow ergänzt Buildnummer, Commit und Erstellungszeitpunkt und paketiert diese Daten mit der Anwendung. Release-Tag und Setup-Version werden daraus erzeugt. Die vorhandene EXE-Startprüfung kontrolliert zusätzlich `/api/updates` und die tatsächliche Buildnummer.

Die lokalen Tests prüfen Versionsvergleiche, private Zugriffe ohne Anmeldung, bekannte Downloadquellen, SHA-256 und Dateigrösse, geschützte vorhandene Dateien, entfernte Anmeldedaten bei Weiterleitungen sowie abgewiesene fremde Updateaufrufe. Der reale authentifizierte Download von Build 6 wurde mit SHA-256 geprüft; dabei wurde kein Setup ausgeführt.

Die Browserprüfung betrifft die lokale HTTP-Anwendung. Die direkte `file:`-Ansicht ist für Browserautomation gesperrt und wurde anhand des HTML-/JS-Startpfads geprüft.

44 lokale Tests bestanden. Desktop und Mobilansicht (390 × 844) wurden im Browser geprüft: Einstellungen, gespeicherte Startprüfung, manuelle Updateprüfung, Datenstand und Schliessen per Escape. Die Einstellungen erzeugen keinen horizontalen Seitenüberlauf. Referenzbilder: `Einstellungen_0.3.1_Desktop.png` und `Einstellungen_0.3.1_Mobil.png`.

## Fehlende Bilder

Der Datenstand bleibt unverändert: 5’429 Artikel mit Originalabbildung, 500 Kapitelillustrationen und 238 von 16’699 zusätzlich geplanten Artikel-/VA-Quellen. Diese Erfassung ist nicht vollständig. Einige reine Kalkulationskomponenten haben keine eigene Katalogabbildung. Beispielsweise bleiben 985992/70 und 998123/48 in der Zusammensetzung von 112001/00 als Platzhalter kenntlich. Eine ähnliche Position erhält nicht ohne belegte Artikel-/VA-Zuordnung deren Bild.
