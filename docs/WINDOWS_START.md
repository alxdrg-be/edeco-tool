# Windows-Fensterstart prüfen

`Python.Runtime.Loader.Initialize` wird beim Laden des nativen WinForms-Fensters
aufgerufen. Ein erfolgreicher Start mit `--server` prüft diesen Pfad nicht.

Auf Windows können DLLs aus einer heruntergeladenen und im Explorer entpackten
ZIP die `Zone.Identifier`-Markierung übernehmen. .NET Framework lehnt dann das
Laden der Assemblies ab. Die anwendungseigene Datei
`edeco-Toolbox.exe.config` verwendet die von Microsoft dokumentierte Einstellung
`loadFromRemoteSources` für die mitgelieferten Assemblies. Sie muss neben der EXE
liegen, nicht im PyInstaller-Unterordner `_internal`. Es werden weder globale
Windows-Einstellungen noch Datei-Markierungen auf dem Benutzerrechner geändert.

Referenz: https://learn.microsoft.com/dotnet/framework/configure-apps/file-schema/runtime/loadfromremotesources-element

Der Build markiert seine DLLs gezielt wie einen Internetdownload und startet die
EXE mit `--desktop-smoke-test`. Dieser Modus öffnet das echte Edge-WebView2-Fenster,
prüft per JavaScript die gerenderte Startseite mit fünf Kacheln, schreibt
`desktop-smoke.json` in den isolierten Benutzerordner und schliesst das Fenster.
Ein fehlerhaftes Rendering oder eine nicht initialisierbare CLR führt zu einem
Fehlercode und verhindert die Veröffentlichung. Auch nach Installation und
erneuter Installation wird dieser native Test ausgeführt.

Laufzeitfehler werden in `%LOCALAPPDATA%/edeco-Toolbox/toolbox.log` aufgezeichnet.
`EDECO_TOOLBOX_HOME` überschreibt den Benutzerordner für isolierte Tests.
