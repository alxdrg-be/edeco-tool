# Toolhub-Oberfläche und erneuter Referenzabgleich

Stand: 2. November 2026. Ausgangsbasis: Build 20 / `dc476e65`.

## Gemeinsame Bedienung

- Produktname edeco Toolhub mit neuem SVG-Logo, Windows-Icon und Installerbildern.
- Gleiche Kopfzeile für NOVA, BIM, Dokumente, PDF, Dateien, Projekte,
  Planlieferungen, Rechner und Wissens-Hub. Sichtbarer Button „Zum Toolhub“;
  das Logo ist zusätzlich ein Rückweg. Rechner haben einen eigenen Rückweg zur
  Rechnerübersicht und einen direkten, durchsuchbaren Wechsel.
- Der Wechsel verwendet die bestehenden Verlassensprüfungen der jeweiligen
  Werkzeuge. Ein offener BIM-Dialog, ungespeicherte NOVA-/Projektdaten und
  geöffnete PDF-Dateien werden weiterhin berücksichtigt.
- Gemeinsamer Modus und lokal geladene Inter-Schrift. Die frühere separate
  Rechnerpalette ist an die gemeinsamen Farbwerte gebunden.
- Acht unterscheidbare Akzentfarben der verfügbaren Hauptwerkzeuge; identische
  Farben für identische Fehler-/Warn-/Erfolgszustände bleiben absichtlich erhalten.
- Projektauswahl ohne schwebendes Zusatzlabel, gleich hohe Bedienelemente,
  Suche und Kategorien als zusammenhängende Werkzeugleiste.
- Gleich ausgerichtete Inhaltskanten bei Rechnerübersicht, Projekten und
  Datei-/Lieferabläufen. Auf kleinen Ansichten sind Export-/Speicheraktionen
  aufklappbar. Der Kopf bleibt auch beim Nachladen eines Moduls sichtbar.

Technische IDs, Speicherpfade, AppId, EXE- und Update-Assetnamen behalten aus
Kompatibilitätsgründen ihre bisherigen Bezeichnungen. Der Installer migriert
gezielt die bisherigen Produktverknüpfungen.

## Neuer Quellenabgleich

Die angemeldeten Referenzwerkzeuge wurden erneut bedient. Auswahloptionen,
FAQ, Plus-Erweiterungen, eigene Leistungsfelder und schmale Ergebnisansichten
wurden tatsächlich geöffnet. Interaktionszahlen dokumentieren die geprüfte
Abdeckung; sie belegen weder sämtliche Eingabekombinationen noch eine
unabhängige Normfreigabe.

- [Installation und Schutz](REAUDIT_INSTALLATION_20261102.md): acht Themen,
  geführte Leitungsbauarten und Verlegearten sowie konsistente Selektivitätsfaktoren.
- [Energie und Gebäude](REAUDIT_ENERGIE_20261102.md): 13 Seiten, PV-Analysen,
  datierte Tarifhistorie, optionaler Emissionsansatz und Brandlast mit optionalem B.
- [Ladeinfrastruktur](REAUDIT_EMOBILITAET_20261102.md): vier Bereiche,
  eingebbare eigene Leistungen, gespeicherte Leistungsart und 64 Kostenpositionen.

Unterschiedliche Ausgangsbeispiele sind von fehlenden Funktionen zu
unterscheiden. Reproduzierte Anbieterdaten werden nicht zu bestätigten
Normtabellen umbenannt. Der Netzplaner ist weiterhin auf sein radiales
400/230-V-TN-Ersatzmodell begrenzt; 69 zusätzliche Verbrauchervorgaben,
weitere Netzformen, globale Gleichzeitigkeit und Spannungsebenen der Quelle
sind ausdrücklich als verbleibende Unterschiede dokumentiert.

## Verifikation und Vorschau

Neue Browserfälle prüfen direkten Wechsel, Eingabeerhalt, Verlassensschutz,
gemeinsamen Modus, Kopfzeilenausrichtung, acht Akzentfarben, Inhaltskanten,
mobile Aktionen und die neuen Rechnerfelder. Alle 26 eigenen Rechner wurden
zusätzlich auf Desktop und bei 390 px mit tatsächlicher lokaler API geöffnet.

Ansichten liegen unter `/workspace/artifacts/toolhub-design`; die JSON-Datei
`all-calculators.json` protokolliert den zusätzlichen Rechnerdurchlauf.
Die drei Fachberichte führen frische Zahlenfälle und Grenzen separat auf.
