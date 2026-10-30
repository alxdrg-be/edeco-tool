# Projektstand · 21.10.2026

Die aktuelle Beta 0.3 steht in `web/bim2steiger-beta.html`: kompakte Bauteiltabelle, Originalsymbole innerhalb ihrer Rahmen, Nachtmodus, Wissen auf Klick mit gespeichertem Pin und eigene Favoritenseite mit Original-Katalogkategorien. Sie verwendet einen eingebetteten Beispieldatensatz. Die vollständige API-gestützte Katalogansicht steht separat unter `web/bim2steiger.html`.

Produktziel: Nova-/IFC-Modelle in einen prüfbaren Ausschreibungsentwurf mit Steiger-Positionen überführen und an Messerli übergeben. Rund 90 % Vorarbeit bei geeigneten Standardleistungen ist ein Entwicklungsziel, kein bereits erreichter Automatisierungsgrad.

Katalog, Rezeptauflösung, Mengen-/BKP-/Raumlogik, CSV-/JSON-Import, IFC-Bauteile mit Raumnummer und Raumname sowie Nova-N4D/N4M-Apparate sind vorhanden. N4D/N4M enthält in den gelesenen Objekten keinen Raum. Automatische Zuordnungsregeln und ein geprüfter Messerli-Export fehlen noch. Nächster fachlicher Schritt: ein kleines reales Nova-Projekt samt IFC-Export und zugehöriger geprüfter Messerli-Ausschreibung als Referenzfall. Die genaue Messerli-Schnittstelle anhand einer echten Austauschdatei bestimmen; Steiger- und NPK-Identitäten nicht gleichsetzen.

Weitere Regeln und Aufgaben: `CODEX_START.md`, `docs/DATENMODELL.md`, `docs/WEITERENTWICKLUNG.md` und `docs/BETA_MOCKUP.md`. Die vorhandene Fachlogik erhalten und echte Testdaten verwenden.

Beta 0.3 ergänzt eigene Import-/Exportseiten. CSV, JSON, IFC und Nova N4D/N4M laufen über die vorhandene API; die JSON-Sicherung bleibt ungeprüft. Automatische Artikelzuordnung und der echte Messerli-Export bleiben offen. Portal-Rasterbilder werden im Dialog in Originalgrösse gezeigt; für grössere scharfe Ansichten sind höher aufgelöste Quellen nötig.
