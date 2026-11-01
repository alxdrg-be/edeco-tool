# Auftrag: Berechnungen in der edeco Toolbox fertig ausbauen

Reimplementiere die fehlenden Rechner im bestehenden Werkzeug Berechnungen. Übernimm keinen JavaScript-Code, keine Kommentare, keinen Marketingtext und kein SVG von elektro-rechner.ch. Formeln neu schreiben, Grafiken neu zeichnen. Die gespeicherten Auszüge unter `/tmp/er` sind nur eine Verhaltensreferenz, kein Quelltext zum Einfügen.

Ziel ist ein minimaler deutscher Rechner je Thema: Eingaben, ein Ergebnis mit der Formel und den eingesetzten Zahlen, die Norm sichtbar in der Überschrift, die Erklärung hinter einem `<details>`. Die bestehende Oberfläche, der Hell-/Dunkel-Modus und die Navigation in `ui/src/toolbox` bleiben das Muster.

## Anschluss, nicht Neubau

Die Kachel Berechnungen öffnet die Übersicht `Calculations.tsx`. Dort liegen die Vorprüfungen unter `workbench/`, Blitzschutz, Kabel-Spannungsfall, E-Mobilität und die Ablage. Diese Übersicht, die Ablage und den Blitzschutz nicht löschen und nicht durch eine leere Seite ersetzen. Die Hauptübersicht der Toolbox bleibt bei zehn Kacheln. `tool_count` bleibt 10. Die Übersicht zeigt 26 Kacheln `.calc-tile`. Diese Zahlen nur ändern, wenn derselbe Schritt die Tests in `backend/edeco_toolbox/__main__.py`, `backend/tests/test_editor_navigation.py` und `.github/workflows/build-windows.yml` mit anpasst.

Der Knopf «Formelrechner öffnen» in dieser Übersicht öffnet `Berechnungen.tsx`. Die reine Rechnung dazu liegt in `calc.ts`, die Leiterdaten in `conductors.ts`, die Iz-Tabelle für den Motor in `iz.ts`, die Grafiken in `graphics.tsx`. Tests: `npm test` im Ordner `ui`, darunter `calc.test.ts`. Neue Nachweise als weitere reine Funktion und als weiteren Reiter in `Berechnungen.tsx` bauen. Keine zweite leere Seite für ein Thema, das dort schon einen Reiter hat.

Wo `workbench/` dasselbe Thema schon als Vorprüfung rechnet, die Vorprüfung an dieselbe Formel angleichen oder das Ergebnis ausdrücklich als manuelle Vorprüfung beschriften, die kein NIN-Nachweis ist. Die Workbench-Verlustleistung rechnet den Spannungsfall heute mit cos φ = 1. Das ist nicht die Zielrechnung des Formelrechners. Die Workbench-Kurzschlussrechnung setzt keine Spannungsfaktoren cmax 1,05 und cmin 0,95. Diese beiden Workbench-Rechner nicht als Vorlage für den Formelrechner verwenden.

Bereits umgesetzt und mit Tests belegt, nicht durch das Verhalten der Website zurückbauen:

- Spannungsfall: ΔU = √3 · I · (R·cosφ + X·sinφ), einphasig Faktor 2. R′ aus SN EN 60228 bei 20 °C, umgerechnet auf 55 °C (α Cu 0,00393 / Al 0,00403). Aluminium erst ab 10 mm². Un 230 V oder 400 V. Standardgrenze 4 % (NIN 5.2.5.1). X′ ist ein Richtwert und auf der Oberfläche so beschriftet. Balken = ΔU % / Grenze, gedeckelt bei 100 %, grün / amber / rot.
- Verlustleistung: Pv = 3 · I² · R′ · L, einphasig 2. Dieselbe R′. Der Spannungsfall enthält cos φ und X′. Die Taste 4 % heisst NIN 5.2.5.1, die Taste 3 % heisst Projektwert.
- Kurzschluss: Ik max = cmax·Un/(√3·Z) mit cmax 1,05, kalter Leiterwiderstand, Trafo als Reaktanz, ohne Netzimpedanz. Ik min über die warme Schleife L–PE, U0 230 V, cmin 0,95, Leiter 80 °C, Schutzleiter = Aussenleiter. Beide Ergebnisse sind als Schranke beschriftet. Keine IEC-60909-Studie behaupten.
- Transformator: I = S/(√3·U), Ik = In·100/uk, Zk = uk/100·U²/S. Ik ist der Wert am starren Netz mit c = 1.
- Blindleistung: Qc = P·(tanφ1 − tanφ2). Ist der Ziel-cos φ nicht höher, ist Qc = 0.
- Gleichstrom U = R·I. Wechselstrom S = √3·U·I oder U·I, P = S·cosφ, Q = √(S² − P²).
- Potenzialausgleich: HPA nach den Stufen 4–10 → 6, 16–35 → 10, ab 50 → 16 mm² Cu, mit Blitzschutz mindestens 10 mm², Deckel 16 mm². PE nach 5.4.3. ÖPA = nächstgrösserer Normquerschnitt von max(4, PE/2), ohne das Blitzschutz-Minimum.
- Motor: In = P/(√3·400·cosφ·η). Faktoren auf der Oberfläche: Direktanlauf 6, Stern-Dreieck 2, Sanftanlauf 3, Frequenzumrichter 1,2. Iz ≥ In.
- E-Mobilität: Hausanschluss und Grid als Auswahlliste 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800 A. P = Σ P_LP · k. Ohne Lastmanagement k = 1 (NIN 7.22). Mit statischem Lastmanagement eine Näherung aus veröffentlichten Beispielwerten, auf der Oberfläche als Näherung und mit dem verwendeten k. 3,7 und 7,4 kW einphasig, 11 und 22 kW dreiphasig. Einlinienbild und eine Schutzstufen-Skizze.
- Beleuchtung: n = ceil(E·A / (Φ·η·MF)), k = A / (hm·(L+W)). η ist ein Eingabewert und als vereinfachter Raumwirkungsgrad beschriftet, keine LiTG-Tabelle. Strom nur als 230 V einphasig.

300 mm² Kupfer hat in `conductors.ts` den Widerstand 0,0601 Ω/km bei 20 °C. X′ fehlt, deshalb bietet der Spannungsfall den Querschnitt nicht an. Erst ergänzen, wenn ein Richtwert X′ belegt und als Richtwert beschriftet ist.

## UX

- Minimal. Lange Erklärung nur im aufgeklappten Grundlagen-Block.
- Gegebene Normgrössen sind Auswahllisten: Sicherungen, Querschnitte, Normleistungen, uk 4 % und 6 %, Ladeleistungen. Keine Schieberegler dafür.
- Ein Schieberegler nur für einen stetigen Anteil, zum Beispiel den eigenen Gleichzeitigkeitsanteil oder den Anteil einer Nutzergruppe.
- Normname in der sichtbaren Kopfzeile des Rechners, nicht nur im Code.
- Hell und Dunkel über den bestehenden Kopf.
- Deutsche Beschriftung, Zahlen `de-CH`.
- Leere oder ungültige Felder ergeben kein stilles Ersatzresultat.

## PDF

Der Knopf «PDF» zeigt heute nur den Hinweis, dass keine Datei erzeugt wird. Diesen Hinweis durch einen echten Export des gerade offenen Rechners ersetzen.

- Seite A4, eine Berechnung je Export.
- Kopfzeile links: Logo aus `ui/src/assets/edeco-logo.svg`, daneben «edeco ag · Berechnungen», rechts das Datum `de-CH`. Das Logo ist ein reserviertes Feld und wird gezeichnet, nicht durch den Text einer fremden Website ersetzt.
- Darunter Rechnername und die Normzeile, die auch auf dem Bildschirm steht.
- Block Eingaben, Block Ergebnisse, die Formel mit den eingesetzten Zahlen, der Prüfvermerk (innerhalb, nahe an der Grenze, überschritten).
- Kein Marketingtext, kein Changelog, kein Fremdlogo.
- Dateiname aus Rechner und den zwei wichtigsten Eingaben, Umlaute erlaubt.

## Fehler der Vorlage, die nicht nachgebaut werden

- PoE: nicht für jeden Typ 37 V am PD verlangen. Typ 1 mindestens 37 V, Typ 2 und Typ 3 mindestens 42,5 V, Typ 4 mindestens 41,1 V (IEEE 802.3). Den Typ auf der Oberfläche nennen.
- Verlustleistung: den Spannungsfall nicht ohne cos φ als NIN-Nachweis ausgeben. Entweder mit cos φ wie der Spannungsfall, oder einen rein ohmschen Wert ausdrücklich als ohmsch beschriften. 3 % nicht als NIN-Grenze beschriften.
- Zuleitung Schnellcheck: die Überschrift nennt k_temp, die Rechnung ist fest auf 30 °C. Entweder die Umgebungstemperatur wirklich als Faktor rechnen und den Faktor anzeigen, oder «30 °C, k_temp = 1» schreiben und k_temp nicht in der Formel vortäuschen.
- Beleuchtung: η nicht als LiTG- oder Norm-Wirkungsgrad ausgeben. Es ist eine Vereinfachung.
- Selektivität LS–LS nicht als nachgewiesen ausgeben, solange keine Herstellerkennlinie vorliegt. Eine Staffelung 1 : 1,6 gilt höchstens als Hinweis für Schmelzsicherungen und muss als Hinweis beschriftet sein.
- elektro-rechner.ch hat keinen Trennungsabstand-Rechner nach SN 414022. Keinen zweiten daraus erfinden. Der bestehende Blitzschutz der Toolbox bleibt unverändert, solange kein eigener Auftrag ihn ändert.

## Daten aus Normen

NIN- und SIA-Zahlentabellen sind lizenzierte Normen. Eine Rechenfunktion bauen und die Zahlen in ein Datenmodul legen. Kurzer Kommentar: die Werte müssen NIN 2025 5.2.3 entsprechen, beziehungsweise der jeweils genannten Tabelle. Nur Werte eintragen, die sich aus der bereits geprüften Rechenvorlage als deren veröffentlichtes Verhalten belegen lassen oder die aus einer im Projekt vorhandenen Normausgabe abgeschrieben sind. Keine «Entscheid»-Kommentare, kein Changelog der fremden Website. Öffentliche Reihen sind erlaubt: SN EN 60228, Normquerschnitte, NH- und Sicherungssprünge, IEC-60034-30-1-Wirkungsgrade als Vorgabe bis zum Typenschild.

Die SIA-2060-Näherung in `approximateSiaFactor` nicht als Tabelle 15 ausgeben. Wer die lizenzierte Tabelle einbaut, ersetzt die Näherung und zeigt den Tabellennamen.

## Noch zu bauen

Jeder neue Reiter im Formelrechner zeigt die Norm in der Kopfzeile, die Formel mit den Live-Zahlen und eine eigene Grafik. Die Skizzen im bestehenden `graphics.tsx` weiterverwenden, nicht die SVG der Vorlage. Eine Workbench-Vorprüfung desselben Namens bleibt erreichbar, bis ihre Formel der hier beschriebenen Rechnung entspricht.

### NIN-Kabelrechner

Norm in der Kopfzeile: NIN 2025 5.2.3.

Iz = Iz0(Querschnitt, Verlegeart, Isolation, belastete Adern) · k_temp · k_Häufung · Anzahl paralleler Leiter. Danach IB ≤ In ≤ Iz und I2 ≤ 1,45·Iz. Verlegearten A1, A2, B1, B2, C, D, E, F als Auswahlliste. Die vorhandene Kupfer-Tabelle für drei Adern und die Methoden B1, B2, C, D, E darf als Anfang dienen und muss auf die fehlenden Methoden und auf zwei belastete Adern erweitert werden, sobald die Werte belegt sind. Häufung nach der zuständigen NIN-Tabelle, Leitungen mit höchstens 30 % Belastung nach 5.2.3.5 aus der Zählung nehmen. Unter 70 mm² Kupfer bei unverseilter Parallelschaltung einen Hinweis auf 5.2.3.7, keine stille Korrektur.

Grafik: Balken Iz gegen IB und gegen In, daneben ein einfacher Kabelquerschnitt mit der gewählten Aderzahl. Farben wie beim Spannungsfallbalken.

### Zuleitung Schnellcheck

Norm: NIN 2025 5.2.3, Verlegeart E für Mehrleiter, F für Einzelleiter im Dreieck.

Iz = Iz0 · k_Häufung für Kupfer auf gelochter Wanne. Siehe den Fehler zu k_temp oben. Häufung aus der passenden Zeile der Häufungstabelle, nicht aus einem festen Text, der einen anderen Faktor rechnet. Querschnitte als Liste. Mehrere parallele Stromkreise zeigen Iz je Kreis und die Summe.

Grafik: Balken der Auslastung und eine kurze Trasse mit der Anzahl Kabel.

### LS-Schalter

Norm: IEC 60898-1, für K und Z IEC 60947-2, NIN 4.3 und 5.3.3.

Prüfen: In ≤ Iz, Icn ≥ Ik an der Einbaustelle. Charakteristik als Liste: B 3–5, C 5–10, D 10–20, K 8–14, Z 2–3 mal In. Nennstrom und Schaltvermögen aus den Normreihen wählen, nicht als Regler. Eine NH-Vorsicherung nur dann als Backup nennen, wenn eine belegte Tabelle für genau diese Icn-Klasse vorliegt; sonst «kein belegter Backup-Wert».

Grafik: zwei Stufen, Vorsicherung und LS, mit der bestehenden Staffelungs-Skizze. Text auf der Skizze: LS–LS ist ohne Herstellerkennlinie nicht nachgewiesen.

### Selektivität

Norm: NIN 5.3, bei Fehlerstromschutz NIN 5.3.6.

Mehrere Stufen, Typ als Liste (NH gG, LS B/C/D, Fehlerstromschutz). NH gegen NH nur als Hinweis, wenn das Nennstromverhältnis mindestens 1,6 ist, und als Hinweis beschriften. LS gegen LS nie als vollselektiv markieren. Fehlerstromschutz: zeitverzögert (Typ S) und ein IΔn-Verhältnis; ohne Zeitverzögerung fehlt die Zeitselektivität. Herstellerkennlinien nur auswerten, wenn der Benutzer sie als Daten liefert.

Grafik: senkrechte Kaskade, je Stufe ein Gerät mit In und Typ. Farbe nur für «Hinweis» oder «nicht belegt», nicht für «nachgewiesen».

### Netzplaner

Normzeile je Abschnitt: NIN 5.2.5.1 und die Kurzschluss-Schranke, keine IEC-60909-Studie.

Knoten: Einspeisung, Leitung, Last. Je Leitung den vorhandenen Spannungsfall und den vorhandenen Kurzschluss aufrufen. Standardquerschnitte und Sicherungen als Listen. Ein Projekt ist eine Liste von Abschnitten, noch ohne Server.

Grafik: dasselbe Einlinienbild wie bei der E-Mobilität, um Abschnitte verlängert, und es zeichnet bei jeder Eingabe neu.

### PVA

Normzeile: Planungsannahme, und EnV Art. 12 nur, wenn die Minimalvergütung mit dem im Code genannten Stand verwendet wird.

kWp aus Fläche und Wp/m² oder als direkte Eingabe. Jahresertrag = kWp · spezifischer Ertrag · Faktor Ausrichtung. Eigenverbrauch und Einspeisung als Anteile; der Eigenverbrauchsanteil darf ein Schieberegler sein. Amortisation aus Investition und jährlichem Erlös. Ausrichtungsfaktoren als Annahme beschriften, nicht als PVGIS-Resultat, solange kein Dienst angebunden ist.

Grafik: Balkenserie des Jahresertrags oder ein einfaches Dach mit der gewählten Himmelsrichtung. Original zeichnen.

### SIA 2056

Norm in der Kopfzeile: SIA 2056.

Flächengewichtet spezifische Leistung und Energie je Zone gegen den Zielwert. Die Zahlentabelle nur einbauen, wenn sie aus einer vorliegenden Normausgabe stammt; sonst das Datenmodul mit dem Kommentar anlegen und den Rechner nicht mit erfundenen Zielwerten freigeben.

Grafik: Balken Ist gegen Ziel je Zone.

### Brandmelder

Norm: SES-Richtlinie Brandmeldeanlagen, Planung nach SN EN 54. Den Namen auf der Oberfläche zeigen.

Anzahl und Position aus Raumlänge, Raumbreite, maximalem Melderabstand und maximaler Fläche je Melder. Die Abstandstabelle nur mit belegten Werten. Ein Melder mittig nur für den in der Richtlinie genannten Sonderfall.

Grafik: Raumrechteck mit Melderpunkten. Eigene, einfache Symbole, nicht die Anhangszeichen der Richtlinie nachzeichnen.

### Brandlast BSR 14-15

Norm: VKF BSR 14-15 Ziffer 5.2.1, Hinweis auf NIN 4.2.2.2.7.

q = Σ (MJ/m · Anzahl · Länge im Fluchtweg) / Länge des Fluchtwegs. Horizontaler Fluchtweg: Grenze 200 MJ/m. Vertikaler Fluchtweg: die Summe zeigen, keine 200-MJ-Grenze behaupten. MJ/m trägt der Benutzer ein oder wählt einen klar als Annahme markierten Richtwert. Keine Herstellerdatenbank kopieren.

Grafik: Balken der spezifischen Brandlast gegen 200 MJ/m und ein Schnitt des Fluchtwegs mit den Kabeln.

### PoE

Norm: IEEE 802.3, Kanallänge 100 m.

Schleifenwiderstand aus Ω/100 m und Ader- oder Paarzahl des Typs. ΔU = I · R_Schleife, Spannung am PD = Spannung der Speisung minus ΔU, Verlust im Kabel = I · ΔU. Die PD-Mindestspannung nach Typ, siehe die Fehlerliste oben. Über 100 m kein gültiges PoE.

Grafik: Balken der Spannung von der Speisung bis zum PD, Farbe gegen die typabhängige Mindestspannung.

### PoE-Streckenplaner

Norm: IEEE 802.3 und die Kanallänge nach EN 50173 bzw. ISO/IEC 11801.

Mehrere Abschnitte mit Kabelliste, Länge und Verlegeart. Zuerst die elektrische Länge bei 20 °C und die Reserve gegen die zulässige Länge. Ein Temperaturmodell des Bündels nur mit einer nachgerechneten Formel; ausserhalb des belegten Bereichs kein Ergebnis erfinden.

Grafik: Kette der Abschnitte mit Länge und Temperatur je Stück.

### Ladegrid

Norm: NIN 7.22, SIA 2060 nur als Näherung, solange die Tabelle nicht lizenziert eingebaut ist.

Mehrere Grids. Je Grid P = Σ (Anzahl · Leistung · k) mit dem vorhandenen `chargeInstallation`. Ohne Lastmanagement k = 1. Hausanschluss und Grid-Sicherung aus derselben Ampere-Liste. Einphasige Punkte auf L1 bis L3 verteilen und den stärksten Aussenleiter zeigen.

Grafik: je Grid ein Einlinienbild mit Einspeisung, Schutz und Ladepunkten. Eingaben ändern die Zeichnung.

### Ladegrid LKW

Norm: NIN 7.22. Wirkungsgrad als Annahme beschriften.

Depot mit Leistungsmodulen und Abgabepunkten. AC-Aufnahme = DC-Leistung / η. Gleichzeitigkeit ausdrücklich, ohne Lastmanagement k = 1. CCS- und MCS-Leistungen als Liste, nicht als Regler.

Grafik: Einlinienbild Depot, Schrank und Abgabepunkte.

### Kosten Ladeinfrastruktur

Keine Tarifvorschrift erfinden. Preise und Energiebedarf sind Eingaben. Ein Anteil der Nutzergruppe darf ein Schieberegler sein.

Jahreskosten = Kapital über die gewählte Dauer plus Betrieb plus Energie. Getrennt nach Beschaffung, Installation und Betrieb zeigen. 15 Jahre als wählbare Dauer, nicht als versteckte Konstante ohne Beschriftung.

Grafik: gestapelte Jahreskosten.

## Tests und Abschluss

Für jeden neuen Rechner mindestens einen Test der reinen Funktion: ein Zahlenbeispiel der Formel, ein ungültiger Fall ohne Ersatzwert, und die Beschriftung, die einen bekannten Vorlagenfehler verhindert (PoE-Typ, k_temp, η, LS–LS). `npm test` und `npm run typecheck` im Ordner `ui` müssen bestehen. Die Kachelzahl der Toolbox-Startseite bleibt zehn, solange kein neues Werkzeug ausserhalb von Berechnungen dazukommt. Keinen Windows-Build starten.
