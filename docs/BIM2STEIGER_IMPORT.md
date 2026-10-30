# Herkunft der BIM2STEIGER-Integration

Importiert aus `alxdrg-be/edeco-tool`, Branch `BIM2STEIGER`, Commit
`57966d3ab15843fc99595101b32cee3032a6ec62` (BIM2STEIGER importieren), nach `backend/bim2steiger/`.
Der ursprüngliche Branch bleibt unverändert.

Der Upload enthält 27’324 Dateien. Alle Pfade aus der mitgelieferten
`MANIFEST.sha256` sind enthalten. Dieses Manifest stammt teilweise von einem
älteren Datenstand: Die Hashes von `catalogue.sqlite` und `assemblies.json`
weichen bereits im hochgeladenen Original davon ab. Daten und Manifest werden
unverändert erhalten; die importierten Datenbytes entsprechen dem Git-Branch.
Die SQLite-Datenbank besteht `PRAGMA quick_check`.

Integrationsänderungen betreffen den Python-Paketimport, lokale URL-Präfixe,
gemeinsame Farben und Schrift, den deaktivierten Einzelprogramm-Updater und
das kontrollierte Verlassen der Oberfläche. Beim Wiederöffnen werden außerdem
die Favoritenzähler sofort aus den gespeicherten Favoriten aktualisiert.
Katalogdaten, Originalbilder, Mengen- und Exportregeln werden übernommen.

Die Fachtests laufen aus `backend/bim2steiger` mit:

```
../../.venv/bin/python -m unittest discover -s tests -q
```

Die Tests des gemeinsamen API-Adapters liegen in
`backend/tests/test_bim_integration.py`; Browser-Regressionen in
`backend/tests/test_editor_navigation.py` prüfen zusätzlich den Modulwechsel,
Favoriten, Ausschreibung, offene Dialoge und fehlgeschlagene lokale Speicherung.
