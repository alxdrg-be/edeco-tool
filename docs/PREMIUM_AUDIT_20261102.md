# Angemeldete Rechner: Quellen- und Zahlenprüfung

Stand: 2. November 2026. Diese Prüfung verwendet erstmals in dieser Arbeitsumgebung einen eigenen angemeldeten Chromium-Browser und direkte Clientquellen. Es wurde dafür kein Tinyfish-Aufruf verwendet. Zugangsdaten und Sitzungscookies wurden weder ausgegeben noch im Repository gespeichert. Keine Projekte, Bibliothekseinträge oder Kontoeinstellungen wurden auf der Referenzseite gespeichert oder geändert.

Die Anmeldung erschliesst Client-JavaScript, nicht den serverseitigen PHP-Quellcode. Reproduzierte Anbieterwerte sind ein numerischer Vergleich; sie bestätigen weder die Richtigkeit sämtlicher Anbieterannahmen noch eine unabhängige Normenkonformität. Eigene konservative Abweichungen bleiben als solche dokumentiert.

## Acht angemeldete Rechner

| Referenz / edeco-ID | Auswahl und Ausbau | Zahlenprüfung / Umsetzung | Verbleibende Grenze |
| --- | --- | --- | --- |
| `/premium/ladegrid-rechner.php` / `premium-pkw` | Haus-/Grid-Anschluss, mehrere Grids, erweiterbare Punktgruppen, 1~/3~/DC, feste Leistung oder eigene Leistung, LM je Grid, feste Faktoren oder Anwenderkurven | Einzelgrid ohne LM: 4×11 kW → 44 kW und 63.5085296109 A; 3×7.4 kW 1~ → 22.2 kW und 32.1739130435 A je symmetrisch belegtem Leiter. Fehlende DC-100-kW-Option ergänzt. Individuelle Grid-Modi und Faktoren ergänzt, gleiche Leistungsgruppen werden vor der Aktivierungsaufrundung zusammengefasst. | Explizit statische Grids behalten ihren berechneten Bedarf und melden Überlast statt einer stillen dynamischen Drosselung. Ein gemeinsames Haus-/Phasenbudget wird vollständig auf reale Grid-Werte verteilt. Anbieterfehler mit nur global gekappten Summen wird nicht übernommen. PV-/Speicherentlastung mit Betriebsstunden, Fahrzeugverbrauch, explizitem Anschlussort und separaten Brutto-/Netto-/Reichweitenwerten ergänzt. Die reale Reglerdynamik ist nicht simuliert. |
| `/premium/ladegrid-lkw.php` / `premium-lkw` | Modulare Grids/Power Units/Abgabepunkte, CCS/MCS, eigene Leistungen und Wirkungsgrade | Quelle kennzeichnet PU-Leistung als AC-Aufnahme. Optionaler expliziter AC-/DC-Leistungsbezug ergänzt; alte gespeicherte Stände bleiben DC. Zwei 150-kW-AC-Module mit η=.97 liefern höchstens 291 kW DC statt 300 kW DC. 90-/120-kW-Module, 600-kW-CCS und grosse Einspeisestufen ergänzt. | Expliziter Aktiv/Wartend-Modus ergänzt: konfigurierbare 50-kW-Mindestleistung, leistungsstarke Punkte zuerst, gleichmässige Wasserfüllung mit Nennleistungsgrenzen, wartende Punkte 0 kW. Authentifizierter Default stimmt mit 227.128129211 kW AC / 220.314285335 kW DC und 3 aktiven Punkten. Proportionales Bestandsmodell bleibt erhalten. Individuelles LM je LKW-Grid ergänzt: feste Grids verbrauchen das Hausbudget zuerst; dynamische Grids teilen den Rest nach Sicherungsstufen. Die gesamte Anbieter-Regelzustandsmenge ist damit noch nicht unabhängig numerisch bestätigt; keine Fahrzeug-/SoC-Zeitplanung. |
| `/premium/brandmelder-rechner.php` / `premium-brandmelder` | Neun Raumtypen, Rauch/Wärme A1/A2, Höhe, flache/geneigte Decke, Geschosse, Kollektiv/Adressiert, Grundschall, optische Alarmierung, Handfeuer/Raumanzeige und sechs Materialpreise | Datierter Referenzmodus ergänzt; manuelles geometrisches Modell erhalten. Fünf unabhängige Browserfälle decken Raum, grosse Fläche, Wärme/geneigt, Korridor und erhöhte Alarmanforderungen ab. Nicht unterstützte Höhen und leere Werte entfernen das Resultat. | SES-Bezug ist veröffentlichte Rechenannahme, kein eigenständig eingesehener Normtext. Hornzahl ist kein Schallausbreitungsnachweis. Vertikale Bereiche erhalten Mengen statt eines irreführenden Rechteckraumplans. |
| `/premium/selektivitaet-rechner.php` / `premium-selektivitaet` | Erweiterbare Schutzstufen, NH/B/C/D/K, FI und MCCB TMD/ETU; Kabelweg, Material, Querschnitt, Kabeltyp, Phasensystem und Einstellungen | Neuer Stufeneditor mit Kabelpfad-Modell; frühere drei Stufen und dokumentierte Paargrenzen bleiben erhalten. Default-Pfadströme werden separat gegen Anbieterzustand geprüft. | Keine universelle NH/LS-, MCCB- oder FI-Selektivitätsfreigabe aus Nennstromverhältnissen. Herstellerkennlinien und koordinierte Gerätepaargrenzen sind weiterhin erforderlich. |
| `/premium/ladeinfrastruktur-kostenrechner.php` / `premium-ladekosten` | V1–V4, Basic/Advanced, mehrere Ausbaujahrgänge und Kategorien, Netz-/Trassenkosten, Gebühren, Nutzergruppen und PV-Stromanteil | Expliziter datierter Klassenansatz neben eigenem Projektmodell. 5 tatsächliche Browserzustände ×4 Modellgesamtsummen geprüft: AC, DC-Klasse, späterer Ausbau, Advanced AC, Advanced DC. Feste 11/50/100/350-kW-Äquivalente, Basis aller Ausbauten im Startjahr, Advanced-Wartung je AC/DC-Punkt, Nutzergruppen-Jahresenergie und halber LM-Ersatz ergänzt. | Quelle verwendet 15 Jahre und 8 Jahre Stationslebensdauer. Andere Laufzeiten/Zyklen bleiben eigene Erweiterungen. Preise sind Projektannahmen; keine Tarif-, Steuer- oder Vertragsfreigabe. |
| `/premium/sia2056-rechner.php` / `premium-sia2056` | Vier Zonen, 16 Nutzungen plus keine Zone, sieben Verbrauchergruppen mit allen sichtbaren Klassen, Kcor, Jahresgleichzeitigkeit, Klima, PV-Ausrichtung und Verschattung | Vollständige frisch zugängliche veröffentlichte p/e/Standby-Datensätze mit Herkunftshash eingebunden. Sechs unabhängige ungerundete Browserzustände stimmen. Manuelle und ältere Bilanz bleiben erreichbar. | Die in der Quelle ausdrücklich fehlende Geräteklasse Verkauf Food/L bleibt gesperrt. Die Datensammlung ist eine Anbieterreferenz, keine unabhängig bestätigte oder vollständig lizenzierte SIA-Tabelle. PV-Produktion ist kein pauschaler Eigenverbrauchsabzug. |
| `/premium/poe-streckenplaner.php` / `premium-poe` | RP1–3, Klassen D/E/EA/F/FA, 2–4 Stecksysteme, Schirmung, drei Patchfaktoren, STP-Priorität, Segmentanzahl/-typ/-bündel/-kanal/-temperatur/-verlegung und eigene Kabel | Bestehender segmentierter Kern stimmt zusätzlich in drei angemeldeten Mehrsegmentfällen mit tatsächlichem `buildChannel()`/`PE.linkLength()` überein. Eigene physische 100-m-Prüfung bleibt unabhängig vom elektrischen 20-°C-Budget. | Generische Thermikkurve und Kabelkoeffizienten sind veröffentlichte Annahmen, keine thermische oder RP-Zertifizierung. Benutzerbibliothek wird nicht mit der Anbieterbibliothek synchronisiert. |
| `/premium/brandlast-fluchtweg.php` / `premium-brandlast` | Fluchtweg horizontal/vertikal, Typ/Aufbau, eigene Kabel und Nachweise, erweitern/entfernen, unabhängige Varianten A/B | Gemeinsamer Kabelpositionskern und neuer datierter Kabel-Faktenkatalog werden auch im Premium-Vergleich verwendet. Hersteller-/CPR-Vermerk und kritisches Brandverhalten bleiben im Bericht erhalten. | Durchschnittliche Brandlast ersetzt keine lokale Häufungs-/Ausführungsbewertung. Kein automatischer Import privater Anbieterbibliotheken oder gespeicherter Projekte. |

## Tatsächlich gemessene Premium-Fälle

### Brandmelder

Alle Preise in diesen Fällen: 45 CHF/Melder, 65 CHF/Horn, 95 CHF/Blitzleuchte, 120 CHF/Handfeuer, 45 CHF/Raumanzeige, 180 CHF/Gruppe. Eine Raumanzeige, Kollektivtechnik und sonst Standardwerte.

| Eingabe | Melder | Hörner | Blitzleuchten | Gruppen | Material CHF |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10×8 m, 2.8 m Höhe, Rauch, flach | 1 | 1 | 0 | 1 | 335 |
| 40×18 m, Rauch, flach | 12 | 2 | 0 | 1 | 895 |
| 20×10 m, 6 m Höhe, Wärme A1, geneigt | 5 | 1 | 0 | 1 | 515 |
| Korridor 40×2 m, Rauch | 3 | 2 | 0 | 1 | 490 |
| Standardraum, 90 dB(A), 11 Handfeuermelder | 1 | 1 | 1 | 3 | 2110 |

Eine frühe programmatische Vertikalprobe hatte einen alten `lastResult` behalten, weil die Website ihre Eingabegrenzen erst über das Ereignis des Raumtypwechsels umstellt. Dieser alte Wert wird ausdrücklich **nicht** als numerischer Beleg gezählt. Zusätzliche eigene Vertikaltests prüfen Formelverhalten und Sicherheitsgrenzen, nicht eine unabhängige Browserübereinstimmung.

### Ladekosten

| Zustand | V1 CHF | V2 CHF | V3 CHF | V4 CHF |
| --- | ---: | ---: | ---: | ---: |
| Basic, 4 AC ab Start | 94'200 | 98'100 | 97'700 | 102'900 |
| Basic, eine DC-Klasse 80–150 kW | 273'684.090909 | 300'752.272727 | 247'843.181818 | 264'170.454545 |
| Basic, 4 AC erst im 3. Betriebsjahr | 85'800 | 89'180 | 85'900 | 89'180 |
| Advanced, 4 AC | 122'306.64 | 126'206.64 | 125'806.64 | 102'157.20 |
| Advanced, eine DC-Klasse 80–150 kW | 305'408 | 334'685.272727 | 281'776.181818 | 264'035.454545 |

Advanced-Werte wurden mit den sichtbaren Referenzvorgaben aufgenommen: Netzbeitrag 210 CHF/kVA, Anschlussgrundbetrag 3000 CHF +20 m×11 CHF/m, Trasse 50 m×250 CHF/m, Verteilung 6000 CHF, LM 2750 CHF, Projektierung 10 %, Nutzergruppen 60/30/10 %, Wartung AC/DC 25/80 CHF jährlich. PV-Anteil 0 %. Die unabhängigen Projektmodelltests bleiben zusätzlich erhalten und bestätigen die bisherige gespeicherte Interpretation.

### PoE-Strecke

Drei Cat7A/s AWG22-Abschnitte mit 40/30/20 m; Bündel 200/75/24; Kanalbreiten 200/100/50 mm; E/F/C/B-Anordnung gemäss Abschnitt; 10 m Patch; Patchbündel 24 und 1.

| Zustand | Elektrische Länge m | Modelltemperatur °C | Reserve m |
| --- | ---: | ---: | ---: |
| RP3, D, 2 Stecksysteme, Patch 1.5, 25 °C | 95.6779879403 | 33.1738841932 | 13.3220120597 |
| RP1, Kabelumgebung 10 °C, Patch weiter 25 °C | 93.4108695652 | 11.5 | 15.5891304348 |
| RP3, 4 Stecksysteme, Patch 2 ungeschirmt, erster Abschnitt 40 °C | 102.6010458061 | 39.6487496794 | 2.3989541939 |

### LKW-Depot

Mit 400-A-Einspeisung, 50 kW Gebäudereserve und einem 630-A-Grid: PU-Gruppe A mit 2×150 kW AC und zwei 350-kW-Punkten; PU-Gruppe B mit 1×300 kW AC und einem 350-kW-Punkt. η jeweils .97, dynamisch, Mindestleistung 50 kW. Beobachtet und nativ reproduziert: 227.12812921102034 kW AC, 220.3142853346897 kW DC, 3 aktive Punkte, 0 wartend. Gruppe A liefert je 55.07857133367243 kW, Gruppe B 110.15714266734486 kW.

Eigene Grenztests prüfen zusätzlich null aktive Punkte unterhalb einer echten Mindestleistung, wartende 0-kW-Anschlüsse, individuelle Gruppen-Mindestleistungen und statische Aktivierung der stärksten Anschlüsse. Bei einem eingegebenen echten Minimum werden keine darunter liegenden aktiven Punkte als erfolgreich dargestellt. Dies ist konservativer als die Quelle, die bei sehr kleinem Restbudget noch eine einzelne unterversorgte Säule aktiv markiert.

### PV/Speicher und Anschlussort im PKW-Mehrgrid-Modell

Die Referenzeingaben für Betriebsstunden, Fahrzeugverbrauch, PV, Speicher und Anschlussort sind nun auch im modularen Modell vorhanden. Veröffentlichtes stationäres Leistungsmodell: `P_Quelle = 0.7 × PV_kWp + Speicher_kWh_pro_Tag / Betriebsstunden`. Die angenommene dreiphasige gleichzeitige Quellenleistung wird konservativ auf den gewählten Haus-/Grid-Anschluss begrenzt. Das ist weder ein Wechselrichter- noch ein Batterie-/Lastgangnachweis.

Brutto-Ladeleistung, AC-Aufnahme, Gebäudereserve und vorzeichenbehaftete Nettoleistung bleiben getrennt. Bei Anschluss am Haus kann die Erzeugung das Hausbudget entlasten; jede nachgelagerte Grid-Leitung muss weiterhin den vollen dortigen Ladebedarf führen. Bei Anschluss hinter einer konkreten Grid-Sicherung wird die Erzeugung auch auf deren vorgelagertem Leiter verrechnet. Rückspeisung erscheint negativ, und der Strombetrag wird gegen die Sicherung geprüft. Nicht vorhandene/gelöschte Grid-Zuordnungen blockieren das Resultat und werden nicht still umgebogen.

Eigene unabhängige Bilanzprüfungen decken beide Anschlussorte, Mehrgrid- und Phasensummen, unveränderte Bruttolasten, begrenzte Erzeugerleistung, vorzeichenbehaftete Rückspeisung, Null-/Leereingaben, Betriebsenergie und Reichweite ab. Beispiel: 20 kWp PV plus 20 kWh/Tag Speicher bei 10 h ergeben 16 kW gleichzeitigen Ansatz. Bei Hausanschluss-Erzeugung bleibt ein 63-A-Grid trotz sehr grosser PV auf seine physische Leitungsgrenze beschränkt.

## Bewusst nicht übernommene Inkonsistenzen

Beim aktuellen PKW-Default zeigte die Referenz zwei einzelne Grid-Leistungen von 43.6476803507 und 66.6025403784 kW, also 110.2502207292 kW. Die globale Anzeige begrenzte diese Summe dagegen auf 66.6025403784 kW, ohne die Einzelgrids entsprechend neu zuzuteilen. edeco erhält deshalb die gemeinsame Kapazitäts-/Phasenbilanz und übernimmt diesen Summenwiderspruch nicht.

Eine deaktivierte optische Alarmierung bei Grundschall über 85 dB(A) wird in edeco als Konflikt ausgewiesen. Das Materialmodell allein ist kein akustischer Nachweis. Referenz-Tabellenraster, die den kleinsten Wandabstand nicht erfüllen, ergeben keine positive Freigabe.

## Belegdateien und Nachprüfbarkeit

Neue Tests: `fireAlarmReference.test.ts`, `siaReference.test.ts`; erweitert: `chargingCosts.test.ts`, `chargingGrid.test.ts`, `poeRoute.test.ts`, `migrateInputs.test.ts`, `calculationReport.test.ts`. Sie enthalten unabhängige Sollwerte der frischen Browserfälle, keine aus der eigenen Implementierung erzeugten Sollwerte.

Die SIA-Daten und der Brandmelder-/Kostenansatz enthalten Abrufdatum, Quelle und SHA-256. Die ungetrackten Arbeitsbelege liegen unter `/workspace/scratch/elektro-reference-20261102`; browserseitige Rundgang-Screenshots/-Videos unter `/workspace/artifacts`. Sie gehören nicht als fremde vollständige Anwendung in den ausgelieferten Rechnercode.
