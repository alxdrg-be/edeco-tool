/**
 * Readable content of entries whose catalogue text only describes the printed page.
 * Values and order follow E-Memory (EIT.swiss, 1st ed. 2025); wording is our own.
 * The catalogue keeps the audit (conditions, corrections, source page).
 */
export interface MemoryContent {
  lead?: string;
  steps?: string[];
  points?: string[];
  groups?: { title: string; items: string[] }[];
  table?: { headers: string[]; rows: string[][]; note?: string };
  note?: string;
}

export const MEMORY_CONTENT: Record<string, MemoryContent> = {
  "em-p02-self-protection": {
    lead: "Eigenschutz hat Priorität.",
    groups: [
      { title: "Schauen", items: ["Art des Notfalls", "Ort des Notfalls", "Anzahl Patienten"] },
      { title: "Denken", items: ["Gefahr für Helfende ausschliessen", "Gefahr für Unbeteiligte ausschliessen", "Gefahr für Verunfallte ausschliessen", "Unfallstelle sichern"] },
      { title: "Handeln", items: ["Selbstschutz und Verunfallte absichern", "Alarmieren nach Meldeschema", "Nothilfe nach ABCD-Schema leisten"] },
    ],
  },
  "em-p02-electric-accident": {
    steps: [
      "Verunfallte Person nicht direkt berühren.",
      "So schnell wie möglich spannungsfrei setzen.",
      "Vom leitenden Gegenstand oder von der Stromversorgung trennen.",
      "Rettung unter Spannung nur mit geeigneter Isolierung. Unfallstelle sichern.",
      "Zustand der Person beurteilen und Erste Hilfe leisten.",
    ],
  },
  "em-p02-emergency-report": {
    lead: "Notruf 144. Am Telefon bleiben, bis die Notrufzentrale das Gespräch beendet.",
    points: ["Wer ruft an, Rückrufnummer?", "Was ist passiert?", "Wann ist es passiert?", "Wo genau ist es passiert?", "Wie viele Personen sind verunfallt?", "Welche Verletzungen?", "Drohen weitere Gefahren?"],
  },
  "em-p02-first-aid": {
    groups: [
      { title: "Person ansprechbar", items: ["Person betreuen", "Arzt aufsuchen oder Notruf 144"] },
      { title: "Schwere Blutung", items: ["Druck auf die Wunde ausüben", "Anweisungen der Notrufzentrale folgen, bis Hilfe eintrifft"] },
      { title: "Schwere Verbrennung", items: ["Kurz mit kühlem Wasser oder feuchtem Tuch leicht kühlen, danach locker und sauber abdecken", "Keine Salben oder Öle auftragen", "Kleidung nicht entfernen", "Anweisungen der Notrufzentrale folgen", "Ruhe bewahren, Vitalzeichen beobachten"] },
      { title: "Bewusstlos, Atmung vorhanden", items: ["Stabile Seitenlage", "Hilfe rufen, Notruf 144", "Atmung regelmässig prüfen"] },
      { title: "Bewusstlos, keine erkennbare Atmung", items: ["Hilfe rufen, Notruf 144", "AED holen lassen", "30 Thoraxkompressionen, dann 2 Beatmungen", "Sobald der AED da ist: einschalten und seinen Anweisungen folgen"] },
    ],
  },
  "em-p02-asbestos": {
    lead: "Seit 1990 verboten, in älteren Häusern aber noch häufig vorhanden.",
    points: ["Fassadenverkleidungen und Dacheindeckungen", "Schaltgerätekombinationen (SGK)", "Wand- und Bodenbeläge", "Platten hinter Elektroinstallationen", "Rohrisolationen", "Brandschutzkissen", "Blumenkisten"],
    note: "Weiterführend: EIT.swiss «Achtung Asbest», Suva-Branchenregeln, Suva «Asbesthaus».",
  },
  "em-p03-five-electrical-rules": {
    steps: [
      "Freischalten und allseitig trennen: allpolig von spannungsführenden Teilen trennen.",
      "Gegen Wiedereinschalten sichern.",
      "Auf Spannungsfreiheit prüfen: allpolig, mit geeignetem Prüfgerät.",
      "Erden und kurzschliessen: mit kurzschlussfesten Vorrichtungen.",
      "Gegen benachbarte, unter Spannung stehende Teile schützen: abdecken oder isolieren.",
    ],
  },
  "em-p03-five-vital-rules": {
    steps: [
      "Klarer Auftrag, Verantwortung geklärt. Bei Unklarheit die vorgesetzte Person fragen.",
      "Nur Arbeiten, für die wir geschult und berechtigt sind. Sonst STOPP sagen.",
      "Sichere, intakte und isolierte Arbeitsmittel. Defekte sofort reparieren oder melden.",
      "Persönliche Schutzausrüstung tragen, passend zur Arbeit.",
      "Anlage erst in Betrieb nehmen, wenn die vorgeschriebenen Kontrollen gemacht und dokumentiert sind.",
    ],
  },
  "em-p04-ppe-components": {
    lead: "ESTI-Weisung 407, Art. 67/69 Starkstromverordnung (StV).",
    points: [
      "Bekleidung aus 100 % Baumwolle oder gleichwertig, lang- oder kurzarm je nach Schutzklasse.",
      "Schutzhelm mit Visier oder Schutzhaube (Schutzklasse 1 oder 2 je nach Gefahr); bis 17 kV AC geschlossene Helmschale ohne Lüftungslöcher.",
      "Hitzeschutz-Handschuhe: Isolierhandschuhe und lichtbogenfeste Handschuhe.",
      "Nach Risikobeurteilung ergänzen, z. B. mit Schutzbrille.",
      "Auch unter 1 kA kann ein Lichtbogen ungeschützte Körperstellen thermisch gefährden.",
    ],
    table: { headers: ["Lagen nach SN EN 61482-1-2", "Schutzklasse"], rows: [["1 × Klasse 1", "APC 1"], ["2 × Klasse 1 oder 1 × Klasse 2", "APC 2"], ["1 × Klasse 1 + 1 × Klasse 2", "APC 1 + APC 2"]] },
  },
  "em-p04-work-method-tree": {
    steps: [
      "Spannungsfreien Zustand herstellen, wenn möglich: Arbeiten im spannungsfreien Zustand (Art. 70–74 StV, 5 Sicherheitsregeln).",
      "Sonst: Arbeit ausserhalb der Annäherungszone (EN 50110-1 6.5, Suva 66138)?",
      "Sonst: Arbeit ausserhalb der Gefahrenzone mit Schutzmitteln (Art. 66.1 und 58.1 StV)?",
      "Ist Schutz durch Abstand und Aufsicht nicht umsetzbar: Arbeit nicht zulässig.",
      "Arbeiten unter Spannung AuS 1 ohne Veränderung an spannungsführenden Teilen: prüfen, messen, Abdeckungen anbringen und entfernen (Art. 75–79 StV).",
      "Arbeiten unter Spannung AuS 2: bewusstes Arbeiten in der Gefahrenzone oder Berühren blanker, unter Spannung stehender Teile (Art. 22.2/3 NIV, EN 50110-1 6.3).",
    ],
  },
  "em-p05-inspection": {
    groups: [
      { title: "Wann", items: ["Vor dem Erproben und Messen", "Vor der Inbetriebnahme", "Wenn möglich bei abgeschalteter Anlage"] },
      { title: "Fehler bei der Erstprüfung", items: ["Prüfung stoppen", "Fehler suchen und beheben", "Prüfung wiederholen", "Fortsetzen und in Betrieb nehmen"] },
      { title: "Was ansehen", items: ["Dokumente: Schema, Legende, Nachweis HV/UV", "Leitung: Querschnitt, Kabeltyp, Bezeichnung", "Schutz: Basisschutz, Brandschutz, IP-Schutz, Überlastschutz", "Schutzeinrichtung: Sicherung, LS, RCD, Wahl, Typ, Anordnung, Einstellung", "Betriebsmittel: Zugang, Bedienung, Herstellerangaben"] },
    ],
  },
  "em-p05-test-sequence": {
    steps: [
      "Durchgängigkeit von PE, Schutzpotenzialausgleich und zusätzlichem Schutzpotenzialausgleich",
      "Isolationswiderstand",
      "Wirksamkeit von SELV, PELV und Schutztrennung",
      "Fussboden- und Wandwiderstände",
      "Schutz durch automatische Abschaltung",
      "Wirksamkeit des Zusatzschutzes (RCD)",
      "Polarität von Steckdosen, Schalt- und Schutzeinrichtungen",
      "Drehsinn, Drehrichtung",
      "Funktion und Betrieb, auch Sicherheitseinrichtungen",
      "Spannungsfall",
    ],
  },
  "em-p05-low-ohm": {
    lead: "NIN 6.1.3.2 · Installationstester oder Niederohm-Messgerät verwenden.",
    table: { headers: ["Grösse", "Wert"], rows: [["Messspannung", "4 … 24 V AC/DC"], ["Messstrom", "0,2 … 10 A"], ["Faustregel", "R < 1 Ω, je nach Leitungslänge und Installation"]] },
    note: "Gemessen wird vom Haupterdungspunkt zu allen Anschlüssen des Schutzpotenzialausgleichs und der Schutzleiter.",
  },
  "em-p05-insulation": {
    lead: "NIN 6.1.3.3 · Messmethode 1",
    steps: ["Zuerst N gegen PE messen.", "Sind die Werte in Ordnung, L gegen PE messen.", "Prüfspannung nach Tabelle; Beginn mit 250 V ist zulässig."],
    note: "Neutralleitertrenner vor dem Einschalten mit Niederohmmessung prüfen. Die Vorlage verweist auf den Grenzwert aus dem Erstellungsjahr; die Einschränkung dazu steht unten.",
  },
  "em-p05-loop-measurement": {
    points: [
      "Schleifenimpedanz Zs: zwischen Aussenleiter und PE.",
      "Netzinnenwiderstand Ri: zwischen Aussenleiter und N.",
      "Ik Anfang in HV/UV: Risiko beurteilen, 5 + 5 Regeln und PSA beachten (ESTI-Weisung 407).",
      "Ik Ende am Endstromkreis oder an der Steckdose: mit geeignetem Gerät und gleicher Sorgfalt wie Ik Anfang messen.",
    ],
  },
  "em-p06-disconnection-5s": { lead: "Abschaltzeit 5 s · Haupt- oder Unterverteilung, Schutzbekleidung. Der gemessene Ik muss mindestens den Tabellenwert erreichen. Genügt er nicht, die Kennlinie des Herstellers verwenden." },
  "em-p06-disconnection-04s": { lead: "Abschaltzeit 0,4 s · Endstromkreise und Steckdosen. Der gemessene Ik muss mindestens den Tabellenwert erreichen. Genügt er nicht, die Kennlinie des Herstellers verwenden." },
  "em-p07-socket-protection": {
    points: [
      "Vorsicherung höchstens gleich dem Nennstrom der Steckdose.",
      "Steckdose 10 A: Vorsicherung höchstens 13 A.",
      "Steckdose 32 A: Vorsicherung höchstens 32 A.",
      "Alle frei verfügbaren Steckdosen bis 32 A mit RCD 30 mA schützen.",
      "Schalter: Absicherung höchstens Nennstrom des Schalters oder höchster Strom der fest angeschlossenen Verbraucher.",
    ],
  },
  "em-p09-foundation-earth": {
    lead: "NIN Kap. 4.1",
    steps: [
      "Querschnitt des Erdleiters mindestens 75 mm², blanker oder verzinkter Stahl (Profil oder Seil). Als Ring entlang der Aussenkante der Bodenplatte. Flachband hochkant und lagesicher verlegen. Bewehrungsstahl nur mit Mindestabmessung und ohne isolierende Beschichtung.",
      "Allseitig mindestens 50 mm Konstruktionsbeton als Korrosionsschutz.",
      "Verbindungen müssen Kurzschluss- und Blitzströme sicher führen. Alle 5 m gut leitend mit der Bewehrung verbinden.",
      "Erdleiter aus Bewehrungsstahl vor dem Betonieren markieren.",
      "Blanken oder verzinkten Stahl nicht aus dem Beton führen: Korrosion.",
      "Anschlusspunkte aus Inox VA4 oder Kupfer. Nach dem Ausschalen ist nur die Kontaktrondelle VA4 sichtbar: Ø 50 mm, Gewinde M10.",
    ],
    note: "Jeder Fundamenterder wird gemessen und schriftlich dokumentiert.",
  },
  "em-p09-insulated-foundations": {
    points: [
      "Isolierte Gebäude: mindestens 2 unabhängige Verbindungen vom Fundamenterder zum erdfühlig verlegten Ersatzerder.",
      "Mit Blitzschutz: jeden Ableiter über eine Trennstelle mit dem Fundamenterder verbinden.",
      "Blitzschutzkonzept beachten.",
    ],
  },
  "em-p10-earthing-diagram": {
    steps: ["Schutzleiter PE", "Erdungsleiter zur Haupterdungsschiene / Potenzialausgleichsschiene", "Erdungsleiter zum Erder", "Verbindung zum Schutzpotenzialausgleich", "Haupterdungsschiene", "PEN-Leiter der Anschlussleitung", "Erder (Fundamenterder)"],
    note: "Von aussen eingeführte Leitungen so nahe wie möglich beim Eintritt verbinden: Gas (mit Isolierstück), Wasser, Fernwärme, Telefon, EVU-Zuleitung, Radio/TV.",
  },
  "em-p11-spd-flow": {
    lead: "NIN 5.3.4 · Auswahl im AC-Bereich, Wohnungsbau. Vereinfachte Darstellung des Entscheidungsbaums.",
    steps: [
      "Gebäude mit Blitzschutzsystem Klasse I oder II: im Vorzählerbereich Kombi-Ableiter Typ 1+2+3, leckstromfrei.",
      "Blitzschutzklasse III oder Freileitungsanschluss: je nach Zuleitung (mehr oder weniger als 160 A) ebenfalls Kombi-Ableiter Typ 1+2+3 im Vorzählerbereich.",
      "Ohne Blitzschutz und ohne Freileitung: im Vorzählerbereich Typ 2+3, leckstromfrei.",
      "Leitung zur Unterverteilung länger als 10 m: in der UV Kombi-Ableiter Typ 2+3.",
      "Leitung zum Endgerät länger als 10 m: SPD Typ 3 vor dem Endgerät. Sonst sind keine weiteren SPD nötig.",
    ],
    note: "Für das ganze Konzept möglichst einen Hersteller wählen und die Anwendung mit ihm klären.",
  },
  "em-p12-bath-zones": {
    groups: [
      { title: "Bereich 0", items: ["Das Innere der Bade- oder Duschwanne"] },
      { title: "Bereich 1", items: ["Über der Wanne bis 2,25 m ab Boden oder bis zum Wasserauslass", "Dusche: 1,2 m rechtwinklig ab Wasseraustritt bis zur festen Abtrennung"] },
      { title: "Bereich 2", items: ["Erweiterung von Bereich 1 um 0,6 m (Fadenmass beachten)", "Dusche: ab fester Abtrennung 0,6 m ab Seite oder Abtrennung", "Dusche ohne Wanne: Bereiche 1 und 2 werden zu Bereich 1 bis 1,2 m ab Wasserauslass"] },
    ],
  },
  "em-p12-bath-equipment": {
    groups: [
      { title: "Bereich 0 · mindestens IPX7", items: ["Keine Schalt-, Schutz- und Steuergeräte", "Nur vom Hersteller für diesen Bereich zugelassene Betriebsmittel, Un ≤ 12 V AC / 30 V DC SELV"] },
      { title: "Bereich 1 · mindestens IPX4", items: ["Bei 230/400 V nur Verbindungs- und Anschlussdosen für Geräte in diesem Bereich", "Betriebsmittel mit Un ≤ 25 V AC / 60 V DC SELV/PELV, Stromquelle ausserhalb Bereich 0 und 1", "Zulässig: Wassererwärmer, Abluftventilation, Handtuchradiatoren, Leuchten IPX4", "Unter der Badewanne (z. B. Whirlpool-, Abwasserpumpen) mit Un ≤ 25 V AC / 60 V DC SELV/PELV", "Zuleitungsführung beachten"] },
      { title: "Bereich 2 · mindestens IPX4", items: ["Schalt-, Schutz- und Installationsgeräte, keine Steckdosen", "Kommunikationssteckdosen zulässig", "Betriebsmittel mit Un ≤ 25 V AC / 60 V DC SELV/PELV wie Bereich 1, weitere Betriebsmittel IPX4", "Zuleitungsführung beachten"] },
    ],
    note: "Wo Strahlwasser vorkommt: mindestens IPX5.",
  },
  "em-p13-length-examples": {
    lead: "Das Ausmass Kap. 4.3 und 4.6",
    table: { headers: ["Beispiel", "Rechnung", "Ergebnis"], rows: [
      ["Rohr, ein Bogen", "1,2 m + 1,3 m, dazu 1 Rohrbogen", "2,5 m"],
      ["Rohr, Abzweigung", "2,2 m + 3,5 m + 1,2 m", "6,9 m"],
      ["Draht 3 × 1,5 mm²", "0,3 m + 3,5 m + 1,2 m + 0,3 m", "5,3 m"],
      ["Draht 6 × 1,5 mm²", "0,3 m + 2,2 m + 0,3 m", "2,8 m"],
    ] },
  },
  "em-p13-measurement-rules": {
    points: [
      "Fertige Installation messen und auf 10 cm auf- oder abrunden.",
      "Bögen, Formstücke und Richtungsänderungen werden gezählt.",
      "Freies Leitungsende: Kleinapparate + 30 cm, Balkenleuchten + 70 cm.",
      "Apparate enthalten 2 Anschlüsse.",
      "Bei bauseits gelieferten Apparaten die Anschlüsse nicht vergessen.",
    ],
  },
  "em-p13-work-report": {
    points: ["Verrechenbar ohne Nachfrage", "Name der Mitarbeitenden und Datum", "Name und Adresse des Kunden korrekt", "Kurzbeschreibung der Arbeit", "Material (Kopie Lieferschein)", "Stunden aller Mitarbeitenden", "NIV-Kontrollen durchgeführt", "Arbeit fertig oder nicht fertig", "Unterschrift des Kunden"],
  },
  "em-p15-compatibility": {
    points: [
      "Einphasige 10-A-Stecker (Typ 11 und 12) passen in die Steckdosen T13 und T23.",
      "16-A-Stecker (Typ 21, 23 und 25) passen nur in 16-A-Steckdosen, nicht in 10-A-Steckdosen.",
      "Eurostecker Typ 26 (2,5 A) passt in T13 und T23.",
      "Typ 12 (Steckdose ohne Schutzkragen) ist seit 31.12.2016 für Neumontagen nicht mehr zulässig.",
    ],
  },
};
