# Prüfbericht edeco Toolhub

Stand `aaad8142` (main, 5. November 2026). Phase 1: geprüft und berichtet. Keine Rechenänderung, kein Windows-Build.

Geprüft wurden der Quellstand, die Referenztests und ausgeführte Funktionsaufrufe. Nicht jede Maske wurde in diesem Durchgang im Browser angeklickt. Normaussagen ohne gedruckte Quelle in diesem Lauf stehen unter «Offen oder unsicher».

## Teststand in diesem Lauf

| Lauf | Ergebnis |
| --- | --- |
| `ui`: `npm test` | 541 bestanden, 0 fehlgeschlagen, 3,2 s |
| `ui`: `npm run lint` | ohne Befund |
| `ui`: `npm run build` (`tsc -b` und Vite) | erfolgreich, 3,4 s; Vite-Warnung ab 500 kB |
| `python -m pytest backend/tests` | 719 bestanden, 66 übersprungen, 1 fehlgeschlagen, 25,8 s |
| Berechnungsreferenz, 106 Tests | alle bestanden |

Der eine Fehlschlag ist der bekannte Linux-Schrifttest `test_font_metrics_avoid_stranded_suffixes_and_break_at_existing_hyphens`: `wrap('Schliessblechkontakt', …)` liefert `['Schliessblechkonta', 'kt']` statt eines Wortes (`backend/tests/test_legend_readable_corridor.py:130`). Der Test wurde nicht angepasst.

`test_rack_text_layout_at_working_sizes` ist ein Browsertest und wurde hier nicht ausgeführt. Ob er unter Linux scheitert, bleibt der bisherige Befund und ist in diesem Lauf nicht neu belegt.

## Befunde

Aufwand ist eine grobe Schätzung für die Korrektur, nicht ein Termin.

| Priorität | Modul | Datei und Zeile | Befund | Begründung | Vorschlag | Aufwand |
| --- | --- | --- | --- | --- | --- | --- |
| hoch | Netzplaner | `ui/src/tools/berechnungen/networkModel.ts:56` und `:234` | Bei Rechenbasis «Wie NIN-Programm» wird der Spannungsfall fest bei 20 °C gerechnet. Das Feld «Leitertemperatur für Spannungsfall» bleibt sichtbar, Vorgabe 55 °C, und ändert das Ergebnis nicht. | `zDrop = path(area, ninProgram ? 20 : temperature)`. Die Ergebniszeile nennt danach 20 °C. Ein eingegebener anderer Wert sieht gültig aus. «Vorsichtig» verwendet das Feld, Vorgabe 55 °C. | Feld bei «Wie NIN-Programm» ausblenden oder als fest 20 °C kennzeichnen. Die Rechenbasis «Vorsichtig» bleibt der Standard. | 0,5 Tag |
| hoch | Kurzschlussstrom | `ui/src/tools/berechnungen/workbench/fundamentals.ts:44` und `:48` | Dieselbe Angabe 250 kVA, uk 4 %, 1 m Cu 16 mm², cmax 1,10 ergibt 9,88 kA bei «400 V · 3~» und 28,25 kA bei «230 V · 1~» im Typenschildmodus. Die Vorgabe «Trafo · 400-V-Bezug» bleibt bei 230 V wählbar und liefert 9,77 kA, weil Z mit 400² gebildet und dann durch die 230-V-Formel geteilt wird. | Ausgeführt mit `calculateShortCircuit`. 400 V: Z = uk/100 · U²/S, Ik = cmax · U / (√3 · Z). 230 V Typenschild: Z = uk/100 · 230²/S und Hin- plus Rückleiter. Die 230-V-Stellung ist ein anderes Netz, kein Aussenleiter eines 400-V-Trafos. Die Hilfe sagt das nicht. | Bei 230 V den Bezug von uk verlangen. Die 400-V-Vorgabe bei 230 V sperren oder den Widerspruch in der Statuszeile nennen. Bestehende 400-V-Ergebnisse nicht ändern. | 1 Tag |
| mittel | Netzplaner, Ik,min | `networkModel.ts:328`, Test `reference-nin-nibt-network.test.ts:62` | «Wie NIN-Programm» weicht von acht gedruckten Electrosuisse-Fällen (5. November 2026, Ub 420 V) um bis zu 6,3 % ab. Grösste Abweichung: D20, 15 m, 6 mm², 1047 A gegen gedruckt 1118 A (Verhältnis 0,937). C13 liegt 0,8 % darüber (543 A gegen 539 A). | Der Test lässt 7 % zu. Kommentar im Test: die Quellschleife wird als Betrag addiert, nicht als komplexe Impedanz. «Vorsichtig» liegt in allen acht Fällen unter dem gedruckten Wert (D20: 944 A). Die Oberfläche nennt die Betragsaddition, nicht die Spanne von 6 %. | Die Spanne in der Statuszeile nennen. Die Addition nicht still auf komplex umstellen: das würde gespeicherte Netze ändern und braucht eine Freigabe. | 1 Tag Text, Rechnung nur nach Freigabe |
| mittel | Netzplaner | `ui/src/tools/berechnungen/networkCheckpoints.ts:69` | Der Nachweis k² · S² ≥ I² · t ist nicht implementiert. Der Prüfpunkt «Kurzschlussfestigkeit der Leitungen» bleibt immer offen. | Der Text sagt das. Es wird kein falscher k-Faktor ausgegeben. | Eigener Nachweis mit dokumentiertem k, Anfangs- und Endtemperatur. Bis dahin offen lassen. | 3–5 Tage |
| mittel | Netzplaner, RCD | `networkModel.ts:36` und `:303` | Erfasst werden IΔn und «unverzögert / Typ S». Typen AC, A, F, B und eine 6-mA-DC-Überwachung sind keine Eingabe. | Die Meldung sagt, Abschaltzeit und Erdung bleiben ungeprüft. Der Wissens-Hub nennt Typ B oder Typ A/F mit RDC-DD nur als Hinweis für Ladepunkte. | Auswahl des Typs und ein offener Punkt, wenn ein Ladepunkt keinen belegten DC-Schutz hat. Keine automatische Freigabe. | 2–3 Tage |
| mittel | Berechnungen, Bundle | `ui/src/toolbox/modules.ts:26`, `workbench/definitions.ts:4`, Build | Der Chunk `Workbench` ist 523,70 kB (gzip 147,63 kB) und über der Vite-Grenze von 500 kB. | Alle Katalogrechner laden dasselbe Modul. `CALCULATORS` zieht Grundlagen, Installation und Planung inklusive SIA-, Brand- und PoE-Daten in einem Stück. | Pro Rechner oder pro Gruppe dynamisch importieren. Die Formeln bleiben gleich. | 1–2 Tage |
| mittel | NOVA-Import | `backend/nova_legend/api/projects.py:260` | Der Plan-Upload prüft die Endung und kopiert die Datei ohne Längengrenze. | `shutil.copyfileobj` ohne Cap. Die lokale API bleibt auf dem eigenen Rechner. Andere Werkzeuge haben Grenzen (PDF 250 MB, Dokumente 100 MB, Rack-Body 12 MB). | Dieselbe Grenze wie beim BIM-Import, 250 MB, mit klarer Meldung. | 0,5 Tag |
| mittel | PDF-Werkstatt | `backend/edeco_toolbox/pdf_workshop/api.py:207` | Cookies, die nicht mit `edeco_` beginnen, werden an den eingetragenen Stirling-Dienst weitergereicht. | Die Toolbox-Session wird entfernt. Andere Cookies der Browser-Sitzung nicht. | Nur das Cookie des PDF-Dienstes weitergeben, oder keines. | 0,5 Tag |
| mittel | Tests | `workbench/migrateInputs.ts:10` | Für mehrere Altstände gibt es keinen Test: PV, Potenzialausgleich, Transformator-uk, Ladekosten, PoE-Strecke, SIA 2056. | `migrateInputs.test.ts` deckt einen Teil ab. Unbekannte Schlüssel werden verworfen (`migrateInputs.ts:7`). Ob ein altes Feld dabei seine Bedeutung verliert, ist für die genannten Rechner nicht belegt. | Je einen gespeicherten Altstand pro Rechner. Keine stillen Testanpassungen. | 1 Tag |
| tief | Formelrechner und Workbench | `calc.ts:147` und `:183`, `fundamentals.ts:41` und `:154` | Der Formelrechner nimmt Leitungslänge 0 an und bis zu 366 Betriebstage. Die Workbench lehnt Länge 0 ab («grösser als 0») und begrenzt Tage auf 365. | Ausgeführt. Bei Länge 0 stimmt der Formel-Ik,max mit dem Trafo-Rechner überein (9,923 kA). Die Workbench kann den Fehler direkt an den Klemmen nicht darstellen. | Dieselbe Untergrenze und 366 Tage, mit Hinweis dass 0 m nur die Quelle ist. | 0,5 Tag |
| tief | Leiterdaten | `engineering.ts:7`, `conductors.ts:18` | R′20 und X′ stehen zweimal. Die gemeinsamen Querschnitte sind gleich. Cu 300 mm² mit 0,0601 Ω/km steht nur in `conductors.ts`. | Ein späteres Nachziehen kann die Tabellen auseinanderlaufen lassen. | Eine Tabelle, beide Rechner darüber. | 0,5 Tag |
| tief | Netzplaner, Meldungen | `networkModel.ts:136`, `:142`, `:143`, `:179` | «Ungültiges Netzprojektformat.», «Elementbeschriftung ist ungültig.», «Elementposition ist ungültig.» und «Ungültige Netzparameter.» nennen kein Soll und keinen nächsten Schritt. | Andere Meldungen tun das, zum Beispiel Spannungsfall mit Ist- und Budgetwert (`networkModel.ts:337`) und Magnetauslöser mit beiden Strömen (`:357`). | Dieselben vier Sätze um Grenze und Korrektur ergänzen. | 0,5 Tag |
| tief | Bedienung | `ui/src/components/ImportDialog.tsx:190`, `ProjectsPage.tsx:109` | Die Importzeile und die Projektzeile sind klickbare Flächen ohne Tastaturfokus. | Die Zeile öffnet die Auswahl nur per Zeiger. | `button` oder Rolle, Tabellenindex und Eingabetaste. | 1 Tag |

Kein Befund der Stufe kritisch. Die ausgeführten Referenzfälle der Normmodelle stimmen mit den Handrechnungen überein. Die hohen Punkte sind eine stille Eingabe und eine leicht verwechselbare Spannungswahl, keine abweichende 400-V-Formel.

## Handrechnungen

Ausgeführt am 5. November 2026 gegen den Quellstand. R′20 Cu 2,5 mm² = 7,41 Ω/km, αCu = 0,00393/K, X′ = 0,110 Ω/km. Die X′-Werte sind im Code als Richtwert gekennzeichnet, nicht als NIN-Tabellenwert.

| Fall | Handrechnung | Programm | Ergebnis |
| --- | --- | --- | --- |
| Spannungsfall, vorsichtig: 1~, 25 m, Cu 2,5 mm², 16 A, cos φ = 1, 230 V, 55 °C | R′ = 7,41 · (1 + 0,00393 · 35) = 8,42925 Ω/km. ΔU = 2 · 16 · 25 · 8,42925 / 1000 = 6,743 V = 2,932 % | `calculateCable`, `voltageDrop`, `calculateLoss` | 6,74340 V und 2,93191 %. Alle drei gleich. |
| Dieselbe Strecke, «Wie NIN-Programm», 20 °C | ΔU = 2 · 16 · 25 · 7,41 / 1000 = 5,928 V = 2,577 % | `calculateCable` mit `nin-program` | 5,928 V und 2,57739 %. |
| 3~, 25 m, Cu 2,5 mm², 16 A, cos φ = 0,8, 55 °C, 400 V | sin φ = 0,6. ΔU = √3 · 16 · 25 · (8,42925 · 0,8 + 0,110 · 0,6) / 1000 = 4,718 V = 1,179 % | `calculateCable` | 4,71769 V und 1,17942 %. |
| Verlust, derselbe 1~-Fall, 55 °C | R = 0,210731 Ω. P = 2 · 16² · R = 107,89 W | `calculateLoss` | 107,894 W. Spannungsfall wie oben. |
| Trafo 250 kVA, 20 kV / 400 V, uk 4 %, cmax 1,10 | I2N = 250000 / (√3 · 400) = 360,844 A. Ik(c = 1) = I2N / 0,04 = 9,0211 kA. Ik,max = 9,0211 · 1,10 = 9,9232 kA. Z = 0,0256 Ω | `calculateTransformer` und `shortCircuit` bei 0 m | 360,844 A, 9,02110 kA, 9,92321 kA. Formel-Ik,max 9923,21 A. |
| Kurzschluss, 250 kVA, uk 4 %, 400 V, 20 m Cu 16 mm², 80 °C, cmax 1,10, cmin 0,95 | Ik,max aus der gemeinsamen Impedanz. Ik,min = 0,95 · 230 / (ZTrafo + 2 · \|ZLeitung,80°C\|) | Workbench und Formelrechner | Beide: Ik,max 7,08292 kA, Ik,min 2,64604 kA. |
| Dieselbe Schleife, «Wie NIN-Programm», Ub 420 V | Faktor (420 / √3) / (0,95 · 230) = 1,1098 gegen die vorsichtige Spannung | Workbench | Ik,min 2,93652 kA. Verhältnis 1,1098. |
| Blindleistung 100 kW, cos φ 0,75 auf 0,95, 400 V | Qc = 100 · (tan arccos 0,75 − tan arccos 0,95) = 55,323 kvar | Workbench und Formelrechner | 55,3233 kvar. Ziel unter Ist: 0 kvar. |
| Motor 7,5 kW, 400 V, η 0,9, cos φ 0,85, Faktor 6 | IN = 7500 / (√3 · 400 · 0,9 · 0,85) = 14,151 A. Direktanlauf 84,90 A. Stern mit Anteil 1/3: 28,30 A | `calculateMotor` | 14,1507 A, 84,904 A, 28,301 A. |
| Ohm, DC, 230 V und 10 A | R = 23 Ω, P = 2300 W | `calculateOhm` | 23 Ω und 2300 W. R = 0 wird abgelehnt. |
| Licht, 5 m × 4 m, 500 lx, 4000 lm, η 0,6, MF 0,8 | n = ceil(500 · 20 / (4000 · 0,6 · 0,8)) = ceil(5,208) = 6 | Workbench und `lighting` | 6 Leuchten. Formelstrom 6 · 36 / 230 = 0,939 A. |
| Länge 0, Aluminium 6 mm², cos φ 0, Nutzebene gleich Montagehöhe | Grenzen | beide Schichten | Abgelehnt mit konkreter Meldung. Kein Ergebnis, keine Division durch null. |
| LS B16, C20, D32 | 3–5, 5–10 und 10–20 mal In: 48–80 A, 100–200 A, 320–640 A | `reference-installation.test.ts` | Test bestanden. |
| Iz, 23 gedruckte Electrosuisse-Leitungen, 30 °C, ohne Häufung | nur der gedruckte Programmwert, keine NIN-Tabelle abgeschrieben | `reference-nin-nibt-iz.test.ts` | Test bestanden, darunter 1,5 mm² B2 PVC 3 Adern = 15 A und 10 mm² B2 = 46 A. |
| Überlast | IB ≤ In ≤ Iz und I2 ≤ 1,45 · Iz, I2 = Faktor · In, Vorgabe Faktor 1,45 | `installation.ts:78` und `:166` | Für einen LS mit I2 = 1,45 · In fällt die zweite Zeile mit In ≤ Iz zusammen. Das ist die Bedingung aus IEC 60364-4-43, kein zweiter Faktor. Der genaue NIN-Abschnitt ist hier nicht am Druck geprüft. |
| Abschaltansatz TN | 0,4 s für Steckdosen bis 63 A und für fest angeschlossene Verbraucher bis 32 A, sonst 5 s. Schnell nur, wenn Ik,min den oberen Magnetwert erreicht | `installation.ts:167` | Entspricht dem im Code genannten Planungsansatz. Als Nachweis einer Herstellerkennlinie gekennzeichnet, nicht als Freigabe. |
| cmax / cmin | Neu: +10 % → 1,10. +6 % → 1,05. cmin bleibt 0,95. Altstand ohne Wahl bleibt 1,05 und wird markiert | `voltageFactors.ts:18` | Entspricht der im Code genannten IEC-60909-0-Regel für NS. Der Normentext wurde in diesem Lauf nicht aufgeschlagen. |
| Rechenbasis, Standard | Neue Netze, neuer Kurzschluss und Kabel ohne Wahl: `iec` | `networkModel.ts:24`, `fundamentals.ts:236`, `engineering.ts:26` | «Vorsichtig» ist der Standard. «Wie NIN-Programm» nur nach ausdrücklicher Wahl. |

Weitere Grenzfälle, die nur die Meldung prüfen: Strom und Länge so gross, dass ΔU die Nennspannung erreicht; Al unter 10 mm²; Motor mit cos φ 0. Alle brechen mit Text ab, ohne Zahl.

## Geprüft ohne Befund

- Rechenbasis «Vorsichtig» bleibt überall der Anfangswert. Gespeicherte Kurzschlüsse ohne Basis bleiben auf `iec` (`migrateInputs.ts:19`, Netztest «saved networks without a basis»).
- Trafo-Rechner und Kurzschluss-Rechner liefern für 250 kVA, 400 V, uk 4 %, cmax 1,10 denselben Ik,max. Bei 20 m Leitung liefern Workbench und Formelrechner denselben Ik,max und denselben Ik,min.
- Kabelrechner, Formel-Spannungsfall und Verlustrechner liefern für den Referenzfall 25 m / 16 A / 2,5 mm² denselben Spannungsfall.
- R′20 der geführten Querschnitte ist in beiden Tabellen gleich. Die Werte für Cu 1,5 bis 25 mm² (12,1; 7,41; 4,61; 3,08; 1,83; 1,15; 0,727 Ω/km) entsprechen der bekannten Klasse-2-Spalte von SN EN 60228. Die Normseite wurde hier nicht neu aufgeschlagen; Abweichungen bei den grossen Querschnitten sind nicht aufgefallen, aber auch nicht Blatt für Blatt neu gelesen.
- αCu 0,00393/K und αAl 0,00403/K werden in Kabel, Verlust, Kurzschluss und Netz gleich verwendet.
- X′ ist durchgehend als Richtwert beschriftet.
- Ik,max trägt cmax einmal. Ein eingegebener Quellenstrom wird mit demselben Faktor in Z zurückgerechnet (`networkModel.ts:203`), ohne zweiten Aufschlag.
- Ik,min im Netz verwendet 80 °C für Aussenleiter und PE, unabhängig von der Spannungsfall-Temperatur. Die Feldhilfe sagt das.
- LS-Bänder B/C/D wie IEC 60898-1: 3–5, 5–10, 10–20. K und Z sind als Herstellerannahme beschriftet.
- Selektivität vergibt aus dem Nennstromverhältnis keine Freigabe. RCD-Paare bleiben ein Hinweis.
- PoE-, PV-, SIA-2056-, Brandmelde- und Lade-Modelle tragen im Code den Hinweis, dass die Referenz nicht eine Normfreigabe ist. Daran wurde nichts Falsches belegt und nichts als Norm bestätigt.
- Motor-Anlauffaktoren sind änderbare Annahmen. Stern teilt den Direktanlauf-Faktor durch 3. Vorgabe 6 ergibt 2 · IN.
- Licht-η ist als Näherung beschriftet, nicht als LiTG-Tabelle. Die Leuchtenzahl folgt der aufgerundeten Lichtstromformel.
- Leere und ungültige Zahlen werden abgewiesen. Nicht endliche Ergebnisse fängt `checked` in `calc.ts:543`.
- Alte Workbench-Felder, die der Test abdeckt, bleiben auf dem Alt-Modus (`manual` oder `legacy`), statt still auf eine neue Tabelle zu springen.
- Legenden-JSON wird von Version 1 auf 4 angehoben (`backend/nova_legend/legend/model.py`, `DOC_VERSION = 4`). Rack-Dateien kennen nur Version 1 und sagen das.
- `local_security` hängt an der Toolbox-App vor den übrigen Routern. Host nur loopback, fremde Herkunft 403, unsichere Methoden brauchen die Sitzung. Nova, BIM, PDF, Dokumente, Rack, Umbenennen und Projektzentrale liegen darunter.
- PDF-, Dokument- und Rack-Uploads haben Grenzen, Pfadprüfungen und beim Rack eine SVG-Einschränkung ohne Skript und ohne externe Bilder.
- Kein Laufzeitabruf von elektro-rechner.ch. KI-Aufrufe gehen nur an die vom Benutzer eingetragene HTTPS-Adresse. Updates zielen auf GitHub.
- In `ui/src` steht kein ß in einem sichtbaren Text. Einzige Fundstelle ist die Zeichennormalisierung in `ui/src/legend.ts:561`.
- «Senden an» übergibt Dateien an PDF-Werkstatt und Dateien umbenennen und wechselt das aktive Projekt nicht (`ToolHandoffPanel.tsx`). Die Projektnummer kommt aus der Projektzentrale in Umbenennen und Rack.
- Hell- und Dunkelmodus wurden in diesem Lauf nicht Bild für Bild verglichen. Ein Widerspruch in den gemeinsamen Tokens ist nicht aufgefallen.

## Geschwindigkeit, vorher

Nachher gibt es erst nach einer freigegebenen Änderung.

| Messung | Wert | Grenze |
| --- | --- | --- |
| `create_app()` | 0,59 s | kalter Import in dieser Umgebung |
| `inspect_pdf` von D060.pdf, 55 kB, 1 Seite | 9 ms | kein grosses Plan-PDF |
| `read_dxf` von `pruefplan.dxf`, 16 kB | 5 ms | kein Geschossplan aus einem Projekt |
| Chunk Workbench | 523,70 kB, gzip 147,63 kB | über 500 kB |
| Chunk Rack | 332,05 kB, gzip 104,68 kB | |
| Chunk App (NOVA) | 299,14 kB, gzip 87,94 kB | |
| Chunk Einstieg | 331,30 kB, gzip 102,99 kB | |
| Chunk Netzplaner | 128,95 kB, gzip 44,01 kB | |
| Chunk Elektro-Memory | 170,49 kB, gzip 50,40 kB | vor allem `sourceCatalog.ts`, 3088 Zeilen |
| UI-Tests | 3,2 s | 541 Tests |
| Backend-Tests | 25,8 s | ohne den nicht gestarteten Rack-Browser |

Renderzeiten grosser Legenden und grosser Netze sowie PDF-, DXF- und Rack-Exporte mit realen Projektgrössen sind nicht gemessen.

## Vorschläge

Nur nach Freigabe. Aufwand als Schätzung.

| Vorschlag | Nutzen | Aufwand |
| --- | --- | --- |
| Temperaturfeld an die Rechenbasis koppeln | Der Planer sieht, welche Temperatur wirklich rechnet. | 0,5 Tag |
| uk-Bezug bei 230 V erzwingen | Verhindert, dass ein 400-V-Trafo als 28-kA-Einphasenquelle erscheint. | 1 Tag |
| Kurzschlussfestigkeit k²S² mit belegtem k | Schliesst den offenen Prüfpunkt im Netzplaner. | 3–5 Tage |
| RCD-Typ und DC-Fehlerstrom am Ladepunkt | Passt zur NIN-Planung von AC-Ladepunkten, ohne Gerät freizugeben. | 2–3 Tage |
| Workbench teilen | Schnellerer erster Aufruf eines einzelnen Rechners. | 1–2 Tage |
| Ik,max vom Trafo an den Kurzschlussrechner senden | Dieselbe Quelle muss nicht zweimal getippt werden. | 2 Tage |
| Vier knappe Netzplaner-Meldungen ergänzen | Die übrigen Meldungen sagen schon Ist, Soll und Schritt. | 0,5 Tag |

## Offen oder unsicher

- Der Normentext von NIN 2025, IEC 60909-0, IEC 60364-4-41 und SN EN 60228 lag in diesem Lauf nicht auf dem Tisch. Übereinstimmung ist dort belegt, wo eine Handrechnung oder ein gedruckter Electrosuisse-Ausdruck im Test steht. Abschnittsnummern im Code sind damit nicht neu bestätigt.
- Die 7-%-Grenze gegen das NIN-Programm ist eine Modelldifferenz durch Betragsaddition, keine neu gefundene Formelform. Ob die Planung diese Spanne tragen will, ist eine Freigabe.
- Iz ist gegen 23 gedruckte Programmzeilen geprüft, nicht gegen die NIN-Tabellenblätter. Temperatur- und Häufungsfaktoren ausserhalb dieser Zeilen sind nicht neu durchgerechnet.
- PoE-Thermik, SIA-2056-Kurven, PV-Tarife, Hager-Backup und Brandmelde-Raster bleiben so unsicher, wie der Code sie selbst bezeichnet.
- Ob «Vorsichtig» bei jedem gespeicherten Altfeld der bisherigen Zahl entspricht, ist nur für die getesteten Migrationen belegt.
- Renderzeit, grosse Exporte und der Rack-Schrifttest im Browser sind nicht gemessen beziehungsweise nicht ausgeführt.
- `python -m nova_legend` ohne Toolbox hängt `local_security` nicht ein. Der Toolhub-Start tut es. Ob jemand den nackten Nova-Start nutzt, ist hier nicht bekannt.

## Umgesetzt

Die gespeicherten Zahlen bleiben gleich. Jeder Schritt steht in einem eigenen Commit mit `[skip release]`.

- Netzplaner: Bei «Wie NIN-Programm» zeigt das Temperaturfeld fest 20 °C und bleibt nur Anzeige. Der gespeicherte Wert gilt wieder bei «Vorsichtig».
- Kurzschluss 230 V: Die Statuszeile nennt den uk-Bezug. Die Trafo-Vorgabe bleibt ein gültiger Altmodus, die Impedanzformel ist unverändert.
- Ik,min: Die Annahmen nennen die Spanne von bis zu 6,3 % durch Betragsaddition.
- Kurzschlussfestigkeit: Nur mit selbst belegtem k und selbst belegter Zeit. Ohne Beleg bleibt der Prüfpunkt offen. Keine Normtabelle.
- RCD-Typ steht auf «Nicht belegt». Ein Ladepunkt ohne Typ B oder Typ A/F mit 6 mA bleibt offen und wird nicht freigegeben.
- Die Rechnergruppen laden getrennt. Der Workbench-Chunk ging in diesem Lauf von 523,70 kB auf 362,53 kB.
- Plan-Upload stoppt über 250 MB mit einer deutschen Meldung.
- An Stirling geht nur `JSESSIONID`. Das lokale Sitzungscookie und fremde Cookies bleiben hier.
- Migrationstests für PV, Potenzialausgleich, Trafo-uk, Ladekosten, PoE-Route und SIA 2056.
- Kurzschluss lässt 0 m als Fehler an der Quelle zu und trifft dort die Ik,max des Trafo-Rechners. Die Verlustrechnung nimmt 366 Betriebstage.
- R′ und X′ kommen aus der Leitetabelle. 300 mm² bleibt ohne Reaktanz aussen vor.
- Vier Netzplaner-Meldungen nennen die Grenze und den nächsten Schritt.
- Importdatei und Projektzeile sind per Tastatur erreichbar.

Der bekannte Schriftumbruchtest `test_font_metrics_avoid_stranded_suffixes_and_break_at_existing_hyphens` bleibt rot und wurde nicht angefasst.
