/** Short plain-language intro under the title of every calculator: what it is for and what you need. */
export interface CalculatorPurpose { use: string; needs: string }

export const CALCULATOR_PURPOSE: Readonly<Record<string, CalculatorPurpose>> = {
  "netzplaner": { use: "Du zeichnest ein Niederspannungsnetz von der Einspeisung bis zum Verbraucher. Das Tool rechnet Ströme, Spannungsfall und Kurzschlussströme pro Abschnitt und prüft die Schutzorgane.", needs: "Einspeisung oder Trafo, Leitungen mit Länge und Querschnitt, Schutzorgane und Lasten." },
  "kabelberechnung": { use: "Du prüfst, ob der Spannungsfall einer Leitung im Budget liegt, bevor du den Querschnitt festlegst.", needs: "Strom oder Leistung, Leitungslänge, Querschnitt, Material und Netzart (1~ oder 3~)." },
  "emobilitaet": { use: "Du schätzt ab, wie viele Ladestationen ein Hausanschluss mit Lastmanagement versorgen kann.", needs: "Anschlussleistung, Grundlast des Gebäudes und Ladeleistung pro Station." },
  "blitzschutz": { use: "Du bestimmst den nötigen Trennungsabstand zwischen Blitzschutzableitung und Installationen wie Leitungen oder Geräten auf dem Dach.", needs: "Blitzschutzklasse, Gebäudeumfang, Anzahl Ableitungen und Länge des Ableitungswegs." },
  "nin-kabelrechner": { use: "Du prüfst eine Leitung gegen Überlast: passen Betriebsstrom, Schutzorgan und Strombelastbarkeit zusammen (IB ≤ In ≤ Iz)?", needs: "Betriebsstrom, Schutzorgan, Querschnitt, Verlegeart und Korrekturfaktoren." },
  "strombelastbarkeit": { use: "Du ermittelst, wie viel Strom eine Leitung unter deinen Verlegebedingungen dauerhaft führen darf.", needs: "Querschnitt, Material, Isolation, Verlegeart, Umgebungstemperatur und Häufung." },
  "kurzschlussstrom": { use: "Du berechnest den Kurzschlussstrom an einem Punkt der Anlage. Ik max brauchst du für das Schaltvermögen, Ik min für die Abschaltbedingung.", needs: "Netzimpedanz oder Ik am Anschluss, Leitungslänge, Querschnitt und Material." },
  "ls-schalter": { use: "Du prüfst, ob ein LS-Schalter im Fehlerfall sicher magnetisch auslöst.", needs: "Nennstrom, Charakteristik (B, C, D) und Fehlerstrom am Leitungsende." },
  "potenzialausgleich": { use: "Du prüfst den Querschnitt von Schutzleiter und Potenzialausgleichsleitern.", needs: "Querschnitt des Aussenleiters, Leiterart und vorhandenen Querschnitt." },
  "transformator": { use: "Du berechnest Nennstrom und Klemmenkurzschlussstrom eines Trafos für die Auslegung der Hauptverteilung.", needs: "Nennleistung in kVA, Spannung und Kurzschlussspannung uk." },
  "motoranlauf": { use: "Du berechnest Nennstrom und Anlaufstrom eines Motors, um Schutzorgan und Zuleitung zu wählen.", needs: "Motorleistung, Wirkungsgrad, cos φ und Anlaufverfahren." },
  "blindleistung": { use: "Du dimensionierst eine Kompensationsanlage und siehst, wie Strom und Scheinleistung danach sinken.", needs: "Wirkleistung, heutiger cos φ und Ziel-cos φ." },
  "verlustleistung": { use: "Du rechnest aus, wie viel Energie eine Leitung als Wärme verliert und was das pro Jahr kostet.", needs: "Strom, Leitungslänge, Querschnitt, Betriebsstunden und Strompreis." },
  "ohmsches-gesetz": { use: "Du rechnest Spannung, Strom, Widerstand oder Leistung aus zwei bekannten Grössen.", needs: "Zwei der vier Werte U, I, R oder P." },
  "beleuchtung": { use: "Du schätzt ab, wie viele Leuchten ein Raum für die gewünschte Beleuchtungsstärke braucht.", needs: "Raumfläche, Zielwert in Lux, Lichtstrom der Leuchte, Nutzungs- und Wartungsfaktor." },
  "pva-rechner": { use: "Du schätzt Leistung, Jahresertrag und Wirtschaftlichkeit einer PV-Anlage ab.", needs: "Dachfläche oder Modulzahl, Ausrichtung, spezifischen Ertrag und Strompreise." },
  "brandlast": { use: "Du rechnest die Brandlast der Kabel auf einer Strecke in MJ pro Meter aus, zum Beispiel für einen Fluchtweg.", needs: "Kabeltypen, Anzahl und Länge der Strecke." },
  "poe": { use: "Du prüfst, ob ein PoE-Gerät am Ende der Netzwerkleitung genug Leistung erhält.", needs: "PoE-Klasse, Leitungslänge und Kabelkategorie." },
  "premium-pkw": { use: "Du planst Ladegrids für Personenwagen an einem gemeinsamen Anschluss mit Lastmanagement.", needs: "Anschlussstrom, Anzahl Ladepunkte, Ladeleistung und Reserve für andere Verbraucher." },
  "premium-lkw": { use: "Du planst DC-Ladeinfrastruktur für E-LKW von der AC-Einspeisung bis zum Ladepunkt.", needs: "AC-Einspeisung, Wirkungsgrad, Power Units und Abgabepunkte." },
  "premium-brandmelder": { use: "Du planst Anzahl und Raster der Brandmelder in einem Raum vor.", needs: "Raumtyp, Raummasse, Raumhöhe, Deckenform und Meldertyp." },
  "premium-selektivitaet": { use: "Du prüfst, ob bei einem Fehler nur das nächste Schutzorgan auslöst und nicht auch das vorgelagerte.", needs: "Schutzorgane pro Stufe, Kabel zwischen den Stufen und Herstellergrenzen." },
  "premium-ladekosten": { use: "Du vergleichst Investition und Betriebskosten von Ladeinfrastruktur über mehrere Jahre.", needs: "Anzahl Ladepunkte, Investitionskosten, Energiepreise und Nutzungsdauer." },
  "premium-sia2056": { use: "Du erstellst eine Leistungs- und Energiebilanz nach Zonen, zum Beispiel für den Anschlussantrag.", needs: "Nutzung und Fläche pro Zone sowie Verbrauchergruppen." },
  "premium-poe": { use: "Du prüfst eine PoE-Strecke mit mehreren Abschnitten, zum Beispiel über Patchfelder und Dosen.", needs: "Länge und Kabeltyp pro Abschnitt sowie PoE-Klasse." },
  "premium-brandlast": { use: "Du vergleichst die Kabel-Brandlast im Fluchtweg vor und nach einer Sanierung.", needs: "Kabelbestand heute, geplanter Bestand und Länge des Fluchtwegs." },
  "leistungsbilanz": { use: "Du stellst alle Verbraucher zusammen und ermittelst die gleichzeitige Leistung für den Anschluss.", needs: "Verbraucherliste mit Leistung und Gleichzeitigkeit." },
  "zev-gestehung": { use: "Du rechnest die Gestehungskosten einer PV-Anlage in Rappen pro Kilowattstunde aus Investition, Zins und erwartetem Ertrag.", needs: "Investition, Laufzeit, Zinssatz, Betriebskosten, Anlagenleistung und spezifischen Ertrag." },
  "rtv-daempfung": { use: "Du rechnest den Pegel am Ende einer Empfangsstrecke aus Kabeldämpfung und Gerätepegeln weiter.", needs: "Startpegel sowie Länge und Dämpfung je Kabel oder die Pegeländerung je Gerät." },
  "bkp-schaetzung": { use: "Du addierst Kostenpositionen mit Menge und eigenem Einheitspreis zu einer Schätzsumme.", needs: "Positionen mit Menge und Preis sowie die gewünschte Schätzbandbreite." },
};

export function calculatorPurpose(id: string | undefined): CalculatorPurpose | undefined {
  return id ? CALCULATOR_PURPOSE[id] : undefined;
}
