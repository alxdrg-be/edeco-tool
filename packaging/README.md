# Windows-Paketierung

Der gemeinsame Toolhub wird mit `edeco_toolbox.spec` und `toolbox-setup.iss` gebaut. Die regulären Workflows verweisen auf diese Dateien. Zusätzliche Laufzeitdaten, etwa der gemeinsame Werkzeugvertrag, müssen dort ausdrücklich aufgenommen werden.

`nova_legenden.spec`, `launcher.py`, `setup.iss` und `make_icon.py` gehören zum älteren NOVA-Einzelprogramm. Sie sind kein zweiter Toolhub-Veröffentlichungsweg. Ihre Start- und Importkompatibilität bleibt vorerst erhalten; eine Entfernung braucht eine gesonderte Entscheidung über den Einzelprogramm-Support. Der aktive `backend/nova_legend`-Kern wird im Toolhub weiterhin benötigt.

Ein erfolgreicher UI-Build ist kein gebauter Windows-Installer. Windows-/WebView2-Prüfung, Paketprüfung und Veröffentlichung bleiben eigene Schritte. Eine Prüfsumme belegt die Identität einer Datei und ersetzt weder eine digitale Herausgebersignatur noch eine Prüfung einer konkreten Antivirusmeldung.
