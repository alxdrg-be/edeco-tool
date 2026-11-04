import type { MemoryCatalog } from "./types";

// Transcribed from the complete checked inventory of the user-provided source.
// Original PDF SHA-256: 728b3bc0eba7f318c991083989c8312b83271589761116acb4b76d3b3f8373e4
export const SOURCE_CATALOG: MemoryCatalog = {
  "source": {
    "file": "E-Memory_DE_PNG.pdf",
    "sha256": "728b3bc0eba7f318c991083989c8312b83271589761116acb4b76d3b3f8373e4",
    "edition": "EIT.swiss · 1. Auflage ©2025"
  },
  "completeness": {
    "totalPages": 16,
    "inventoriedPages": [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16
    ],
    "notes": [
      "Vollständige Seiten-/Themeninventur; keine Behauptung einer vollständigen Normvalidierung. Dichte grafische Kompatibilitäts-/Gerätebedingungen bleiben ausdrücklich Referenzen.",
      "Die Quelle mischt datierte Normbezüge, unter anderem NIN 2015 B+E und Angaben mit Stand 2025. Das Impressum ersetzt keinen aktuellen Normabgleich."
    ]
  },
  "topics": [
    {
      "id": "em-ohm-cover",
      "title": "Ohmsches Gesetz und Formelscheibe",
      "pages": [
        1
      ],
      "summary": "Zwölf äquivalente Beziehungen für Gleichstrom beziehungsweise einen rein ohmschen Verbraucher.",
      "entries": [
        {
          "id": "em-p01-resistance",
          "title": "Widerstand",
          "kind": "formula",
          "source": {
            "page": 1,
            "section": "Widerstand"
          },
          "confidence": "verified",
          "explanation": "Formelscheibe der Titelseite; positive Beträge und von null verschiedene Nenner vorausgesetzt.",
          "conditions": [
            "Gleichstrom oder rein ohmsche Wechselstromlast. Bei allgemeinen AC-Lasten ist P nicht gleich U · I."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "R = U / I = U² / P = P / I²",
          "calculatorFormulaId": "ohm",
          "variables": [
            {
              "symbol": "U",
              "label": "Spannung",
              "unit": "V"
            },
            {
              "symbol": "I",
              "label": "Stromstärke",
              "unit": "A"
            },
            {
              "symbol": "R",
              "label": "Widerstand",
              "unit": "Ω"
            },
            {
              "symbol": "P",
              "label": "Wirkleistung",
              "unit": "W"
            }
          ],
          "diagram": "ohm"
        },
        {
          "id": "em-p01-voltage",
          "title": "Spannung",
          "kind": "formula",
          "source": {
            "page": 1,
            "section": "Spannung"
          },
          "confidence": "verified",
          "explanation": "Formelscheibe der Titelseite; positive Beträge und von null verschiedene Nenner vorausgesetzt.",
          "conditions": [
            "Gleichstrom oder rein ohmsche Wechselstromlast. Bei allgemeinen AC-Lasten ist P nicht gleich U · I."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "U = R · I = P / I = √(P · R)",
          "calculatorFormulaId": "ohm",
          "variables": [
            {
              "symbol": "U",
              "label": "Spannung",
              "unit": "V"
            },
            {
              "symbol": "I",
              "label": "Stromstärke",
              "unit": "A"
            },
            {
              "symbol": "R",
              "label": "Widerstand",
              "unit": "Ω"
            },
            {
              "symbol": "P",
              "label": "Wirkleistung",
              "unit": "W"
            }
          ]
        },
        {
          "id": "em-p01-current",
          "title": "Strom",
          "kind": "formula",
          "source": {
            "page": 1,
            "section": "Strom"
          },
          "confidence": "verified",
          "explanation": "Formelscheibe der Titelseite; positive Beträge und von null verschiedene Nenner vorausgesetzt.",
          "conditions": [
            "Gleichstrom oder rein ohmsche Wechselstromlast. Bei allgemeinen AC-Lasten ist P nicht gleich U · I."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "I = U / R = P / U = √(P / R)",
          "calculatorFormulaId": "ohm",
          "variables": [
            {
              "symbol": "U",
              "label": "Spannung",
              "unit": "V"
            },
            {
              "symbol": "I",
              "label": "Stromstärke",
              "unit": "A"
            },
            {
              "symbol": "R",
              "label": "Widerstand",
              "unit": "Ω"
            },
            {
              "symbol": "P",
              "label": "Wirkleistung",
              "unit": "W"
            }
          ]
        },
        {
          "id": "em-p01-power",
          "title": "Leistung",
          "kind": "formula",
          "source": {
            "page": 1,
            "section": "Leistung"
          },
          "confidence": "verified",
          "explanation": "Formelscheibe der Titelseite; positive Beträge und von null verschiedene Nenner vorausgesetzt.",
          "conditions": [
            "Gleichstrom oder rein ohmsche Wechselstromlast. Bei allgemeinen AC-Lasten ist P nicht gleich U · I."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "P = U · I = R · I² = U² / R",
          "calculatorFormulaId": "ohm",
          "variables": [
            {
              "symbol": "U",
              "label": "Spannung",
              "unit": "V"
            },
            {
              "symbol": "I",
              "label": "Stromstärke",
              "unit": "A"
            },
            {
              "symbol": "R",
              "label": "Widerstand",
              "unit": "Ω"
            },
            {
              "symbol": "P",
              "label": "Wirkleistung",
              "unit": "W"
            }
          ]
        },
        {
          "id": "em-p01-ruler",
          "title": "Aufgedrucktes Lineal",
          "kind": "reference",
          "presentation": "source-note",
          "source": {
            "page": 1,
            "section": "Titelseite"
          },
          "confidence": "verified",
          "explanation": "Lineal von 0 bis 12 in der gedruckten Vorlage. Eine Bildschirmdarstellung oder ein skalierter Ausdruck liefert kein verlässliches physisches Längenmass.",
          "conditions": [],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-applicable"
          }
        }
      ],
      "group": "formulas"
    },
    {
      "id": "em-emergency",
      "title": "Nothilfe und Asbest",
      "pages": [
        2
      ],
      "summary": "Eigenschutz, Alarmierung, Stromunfall und die im Druckwerk enthaltenen Erste-Hilfe-Merkpunkte.",
      "entries": [
        {
          "id": "em-p02-self-protection",
          "title": "Schauen – Denken – Handeln",
          "kind": "reference",
          "source": {
            "page": 2,
            "section": "Nothilfe"
          },
          "confidence": "needs-review",
          "explanation": "Eigenschutz priorisieren, Unfallstelle beurteilen, Gefahren für Helfende und Betroffene ausschliessen, alarmieren und Hilfe leisten.",
          "conditions": [
            "Sicherheits- und Erste-Hilfe-Inhalt ist hier inventarisiert, nicht medizinisch neu validiert."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p02-electric-accident",
          "title": "Stromunfall an Niederspannungsanlagen",
          "kind": "reference",
          "source": {
            "page": 2,
            "section": "Niederspannungsanlagen"
          },
          "confidence": "needs-review",
          "explanation": "Im Scan: betroffene Person nicht direkt berühren, Versorgung möglichst sicher trennen, Unfallstelle sichern und Zustand beurteilen. Rettung unter Spannung wird nur mit geeigneter Isolierung erwähnt.",
          "conditions": [
            "Keine Freigabe für Laienarbeiten oder für Arbeiten unter Spannung; Einsatzkräfte und Eigenschutz haben Vorrang."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p02-emergency-report",
          "title": "Meldeschema und Notruf",
          "kind": "reference",
          "source": {
            "page": 2,
            "section": "Meldeschema"
          },
          "confidence": "verified",
          "explanation": "Wer meldet? Was, wann und wo? Zahl der Betroffenen, Verletzungen und verbleibende Gefahren. Schweizer Sanitätsnotruf 144.",
          "conditions": [],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p02-first-aid",
          "title": "Erste-Hilfe-Situationen",
          "kind": "reference",
          "source": {
            "page": 2,
            "section": "Person ansprechbar / Blutung / Verbrennung / Bewusstlosigkeit"
          },
          "confidence": "needs-review",
          "explanation": "Enthält separate Abschnitte für ansprechbare Personen, starke Blutungen, Verbrennungen, Bewusstlosigkeit mit Atmung sowie ohne erkennbare Atmung; letzterer nennt AED und 30:2.",
          "conditions": [
            "Nicht als vollständigen aktuellen Reanimationskurs ausgeben. Medizinische Handlungsdetails vor einer Produktübernahme anhand aktueller Schweizer Rettungsleitlinien prüfen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p02-asbestos",
          "title": "Asbest in älteren Gebäuden",
          "kind": "reference",
          "source": {
            "page": 2,
            "section": "Achtung Asbest"
          },
          "confidence": "needs-review",
          "explanation": "Nennt mögliche Fundstellen wie Fassaden, Schaltgerätekombinationen, Decken-/Bodenbeläge, Rohrisolationen und Brandschutzmaterialien; verweist per QR auf EIT.swiss und Suva.",
          "conditions": [
            "QR-Zieladressen aus dem Bild nicht zuverlässig decodiert; keine Links erfinden."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-safety-rules",
      "title": "5+5 Sicherheitsregeln und PSA",
      "pages": [
        3,
        4
      ],
      "summary": "Fünf Sicherheitsregeln, fünf lebenswichtige Regeln, Schutzkleidung und Arbeitsverfahren.",
      "entries": [
        {
          "id": "em-p03-five-electrical-rules",
          "title": "Fünf Sicherheitsregeln",
          "kind": "reference",
          "source": {
            "page": 3,
            "section": "5 Sicherheitsregeln"
          },
          "confidence": "verified",
          "explanation": "Freischalten und allseitig trennen; gegen Wiedereinschalten sichern; Spannungsfreiheit prüfen; erden und kurzschliessen; benachbarte unter Spannung stehende Teile schützen.",
          "conditions": [
            "Anwendung und erforderliche Schritte hängen vom Arbeitsverfahren und der Anlage ab; keine pauschale Arbeitsfreigabe."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p03-five-vital-rules",
          "title": "Fünf lebenswichtige Regeln",
          "kind": "reference",
          "source": {
            "page": 3,
            "section": "5 lebenswichtige Regeln"
          },
          "confidence": "verified",
          "explanation": "Klarer Auftrag und Verantwortung; geschulte/berechtigte Personen; sichere intakte Arbeitsmittel; passende PSA; vorgeschriebene Kontrollen vor Inbetriebnahme.",
          "conditions": [],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p03-arc-ppe-levels",
          "title": "PSA: Angaben für die Auswahl",
          "kind": "reference",
          "source": {
            "page": 3,
            "section": "Kurzschlussstrom Ik"
          },
          "confidence": "needs-review",
          "explanation": "Der Kurzschlussstrom allein bestimmt keine passende Schutzkleidung. Für die Auswahl fehlen ohne Abschaltzeit, Arbeitsabstand, Bewertungsverfahren und Herstellerangaben wesentliche Bedingungen. Hier wird deshalb keine Schutzklasse oder Kleidungsfreigabe berechnet.",
          "sourceTranscription": "Die Vorlage zeigt die Stufen G/1/2/3 mit Stromschwellen 1/7/15/20 kA, Sicherungswerten 16/80/200/315 A und Bekleidungshinweisen.",
          "correction": "Die vereinfachte Stromtabelle wird nicht als eigenständige Auswahlregel übernommen. Ihre Aussagen sind nur mit dem vollständigen Quellenkontext, der Tätigkeit, der Risikobeurteilung und den Herstellerangaben zu beurteilen.",
          "conditions": [
            "Als Quellreferenz mit Hersteller- und Risikobeurteilung behandeln, nicht als eigenständigen automatischen PSA-Rechner. Der Scan verweist ausdrücklich auf Herstellerangaben."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Angabe",
              "Weshalb benötigt"
            ],
            "rows": [
              [
                "Kurzschlussstrom Ik am Arbeitsort",
                "Elektrische Randbedingung; allein keine Kleidungsfreigabe"
              ],
              [
                "Abschaltzeit / Schutzorgan",
                "Dauer und Begrenzung des möglichen Störlichtbogens"
              ],
              [
                "Arbeitsabstand",
                "Abstand zur möglichen Einwirkung"
              ],
              [
                "Tätigkeit und Bewertungsverfahren",
                "Passende Risikobeurteilung und anwendbare Berechnungsgrundlagen"
              ],
              [
                "Herstellerangaben / konkrete PSA",
                "Nachgewiesene Eignung der vollständigen Ausrüstungskombination"
              ]
            ],
            "note": "Keine automatische Arbeitsfreigabe. Stromschwellen allein reichen für die Auswahl nicht aus."
          }
        },
        {
          "id": "em-p04-ppe-components",
          "title": "Persönliche Schutzausrüstung",
          "kind": "diagram",
          "source": {
            "page": 4,
            "section": "PSA / ESTI Weisung 407"
          },
          "confidence": "needs-review",
          "explanation": "Diagramm zu Schutzkleidung, Helm/Visier oder Haube, isolierenden und lichtbogenfesten Handschuhen; nennt EN 61482-1-2 und APC-Klassen.",
          "conditions": [
            "Konkrete Kombination, Gefährdung und aktuelle Herstellerzulassung separat prüfen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p04-work-method-tree",
          "title": "Arbeitsverfahren und Gefahrenzonen",
          "kind": "diagram",
          "source": {
            "page": 4,
            "section": "Entscheidungsbaum"
          },
          "confidence": "needs-review",
          "explanation": "Unterscheidet spannungsfreien Zustand, Arbeiten ausserhalb Annäherungs-/Gefahrenzone und Arbeiten unter Spannung AuS 1/AuS 2; enthält Verweise auf StV, NIV und EN 50110-1.",
          "conditions": [
            "Ein schematischer Entscheidungsbaum ersetzt weder Befähigung noch Arbeitsauftrag und Risikobeurteilung. Normausgaben im Scan nicht vollständig bezeichnet."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-testing",
      "title": "Sichtprüfung und elektrische Messungen",
      "pages": [
        5
      ],
      "summary": "Reihenfolge der Erstprüfung, Niederohm-, Isolations- und Schleifenmessung.",
      "entries": [
        {
          "id": "em-p05-inspection",
          "title": "Sichtprüfung und Vorgehen bei Fehlern",
          "kind": "reference",
          "source": {
            "page": 5,
            "section": "Elemente und Sichtprüfung"
          },
          "confidence": "verified",
          "explanation": "Vor Erproben/Messen und vor Inbetriebnahme prüfen. Bei festgestellten Fehlern: stoppen, Ursache beheben, erneut prüfen. Prüffelder: Dokumente, Leitung, Schutz, Schutzeinrichtung und Betriebsmittel.",
          "conditions": [],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p05-test-sequence",
          "title": "Erproben und Messen: zehn Prüffelder",
          "kind": "reference",
          "source": {
            "page": 5,
            "section": "Erproben und Messen"
          },
          "confidence": "needs-review",
          "explanation": "PE-/Schutzpotentialausgleich-Durchgängigkeit; Isolationswiderstand; SELV/PELV/Trennung; Boden-/Wandwiderstand; automatische Abschaltung; RCD-Zusatzschutz; Polarität; Drehfeld; Funktion/Betrieb; Spannungsfall.",
          "conditions": [],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p05-low-ohm",
          "title": "Niederohmmessung",
          "kind": "reference",
          "source": {
            "page": 5,
            "section": "NIN 6.1.3.2"
          },
          "confidence": "needs-review",
          "explanation": "Der Scan nennt ein geeignetes Prüfgerät, 4–24 V und 0.2–10 A sowie R < 1 Ω als längen-/installationsabhängige Faustregel.",
          "conditions": [
            "R < 1 Ω ist keine allgemeingültige Grenze für jede Leitung. Erwartungswert aus Material, Länge, Querschnitt und Messbedingungen bestimmen.",
            "Im Scan ist die Spannungsangabe AC/DC bezeichnet; tatsächliche Prüfart und Messgeräteeignung prüfen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p05-insulation",
          "title": "Isolationsmessung und historische Grenzwerte",
          "kind": "reference",
          "source": {
            "page": 5,
            "section": "NIN 6.1.3.3"
          },
          "confidence": "needs-review",
          "explanation": "Beschreibt zunächst N gegen PE, danach L gegen PE. Tabelle unterscheidet SELV/PELV, 50–500 V und Anlagen über 500 V sowie historische Grenzwertspalten.",
          "conditions": [
            "Prüfspannung und Grenzwert nach tatsächlicher Anlage, empfindlichen Betriebsmitteln und zutreffender aktueller Prüfgrundlage festlegen. Die pauschale Quellaussage zum Errichtungsjahr ist kein uneingeschränktes Bestandsschutzrecht."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Anlage",
              "Prüfgleichspannung laut Scan",
              "Riso ab 1995",
              "Riso ab 2010"
            ],
            "rows": [
              [
                "50–500 V",
                "500 V",
                "≥ 0.5 MΩ",
                "≥ 1 MΩ"
              ],
              [
                "SELV/PELV",
                "250 V",
                "≥ 0.25 MΩ",
                "≥ 0.5 MΩ"
              ],
              [
                "über 500 V",
                "1000 V",
                "≥ 1 MΩ",
                "≥ 1 MΩ"
              ]
            ],
            "note": "Historische Quellreferenz; keine automatische Wahl allein anhand des Errichtungsjahrs."
          }
        },
        {
          "id": "em-p05-loop-measurement",
          "title": "Messprinzip Schleifen- und Netzimpedanz",
          "kind": "diagram",
          "source": {
            "page": 5,
            "section": "Messprinzip"
          },
          "confidence": "needs-review",
          "explanation": "Unterscheidet Zs zwischen L3–PE, Ri zwischen L3–N und Kurzschlussstrom am Leitungsanfang beziehungsweise -ende; PE/PEN-Verlauf als Schema.",
          "conditions": [
            "Messung und Interpretation erfordern geeignetes Gerät und sichere Prüfbedingungen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-short-circuit-rules",
      "title": "Kurzschlussstrom-Faustregeln",
      "pages": [
        6
      ],
      "summary": "Zwei Tabellen für 5 s und 0.4 s, ausdrücklich als Faustregeln mit Faktor 0.66 bezeichnet.",
      "entries": [
        {
          "id": "em-p06-disconnection-5s",
          "title": "Ik am Anfang: Haupt-/Unterverteilung, 5 s",
          "kind": "reference",
          "source": {
            "page": 6,
            "section": "Start Ik Anfang"
          },
          "confidence": "needs-review",
          "explanation": "Quelltabelle für DI/DII/DIII, NH gG und LS B/C/D; Überschrift nennt NIN 6.1.3.6.1 und Erstprüfung für Lernende Ausgabe 2025.",
          "conditions": [
            "Werte im Druck ausdrücklich nur Faustregeln. Keine allgemeine Herstellerkennlinie oder vollständiger Abschaltnachweis. Faktor 0.66 nicht zusätzlich anwenden, wenn die Tabellenschwelle bereits verwendet wird."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "In A",
              "D-Sicherung Bauform / A",
              "NH gG A",
              "LS B A",
              "LS C A",
              "LS D A"
            ],
            "rows": [
              [
                "20",
                "DII 114",
                "129",
                "152",
                "210",
                "240"
              ],
              [
                "25",
                "DII 152",
                "179",
                "189",
                "260",
                "300"
              ],
              [
                "32",
                "DIII 227",
                "236",
                "242",
                "340",
                "390"
              ],
              [
                "40",
                "DII 242",
                "303",
                "303",
                "420",
                "490"
              ],
              [
                "50",
                "DIII 333",
                "394",
                "379",
                "530",
                "610"
              ],
              [
                "63",
                "DIII 424",
                "530",
                "477",
                "660",
                "760"
              ],
              [
                "80",
                "DIV 576",
                "685",
                "606",
                "840",
                "970"
              ],
              [
                "100",
                "keine",
                "868",
                "758",
                "1050",
                "1210"
              ],
              [
                "125",
                "keine",
                "1136",
                "947",
                "1310",
                "1520"
              ]
            ],
            "note": "Aus dem Scan transkribiert, nicht normativ nachgerechnet."
          }
        },
        {
          "id": "em-p06-disconnection-04s",
          "title": "Ik am Ende: Endstromkreis/Steckdose, 0.4 s",
          "kind": "reference",
          "source": {
            "page": 6,
            "section": "Ik Ende"
          },
          "confidence": "needs-review",
          "explanation": "Quelltabelle für die Endstromkreis-Prüfung mit den gleichen Gerätefamilien und Faktor 0.66.",
          "conditions": [
            "Nicht jeden beliebigen Stromkreis allein wegen der Tabellenüberschrift als 0.4-s-Fall einstufen. Herstellerkennlinie und tatsächliche Anforderungen bleiben massgeblich."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "In A",
              "D-Sicherung Bauform / A",
              "NH gG A",
              "LS B A",
              "LS C A",
              "LS D A"
            ],
            "rows": [
              [
                "6",
                "DI/DIII 53",
                "71",
                "45",
                "91",
                "182"
              ],
              [
                "10",
                "DI/DII 83",
                "121",
                "76",
                "152",
                "303"
              ],
              [
                "13",
                "keine",
                "152",
                "98",
                "197",
                "394"
              ],
              [
                "16",
                "DII/DIII 121",
                "186",
                "121",
                "242",
                "485"
              ],
              [
                "20",
                "DI/DIII 182",
                "236",
                "152",
                "303",
                "606"
              ],
              [
                "25",
                "DI/DIII 242",
                "323",
                "189",
                "379",
                "758"
              ],
              [
                "32",
                "DIII 364",
                "409",
                "242",
                "485",
                "970"
              ],
              [
                "40",
                "DIII 424",
                "545",
                "303",
                "606",
                "1212"
              ],
              [
                "63",
                "DIII 773",
                "942",
                "477",
                "955",
                "1909"
              ]
            ],
            "note": "Aus dem Scan transkribiert; kein unabhängiger NIN-/Hersteller-Nachweis."
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-protective-devices",
      "title": "RCD, Sicherungen und LS",
      "pages": [
        7,
        8
      ],
      "summary": "Typenwahl, Fehlerstromformen, Kennfarben und Auslösebereiche.",
      "entries": [
        {
          "id": "em-p07-rcd-types",
          "title": "RCD-Typen A, F, B und B+",
          "kind": "reference",
          "source": {
            "page": 7,
            "section": "RCDs und ihre Anwendungen"
          },
          "confidence": "needs-review",
          "explanation": "Typ A erfasst sinusförmige Wechsel- und pulsierende Gleichfehlerströme; F erweitert dies für bestimmte Mischfrequenzfehlerströme. B/B+ erfassen zusätzlich glatte Gleichfehlerströme und weitere Frequenzanteile gemäss konkreter Geräteklasse.",
          "conditions": [
            "Der Scantext zu Typ A nennt fälschlich auch reine Gleichströme. Dies nicht übernehmen: glatte Gleichfehlerströme sind kein allgemeiner Typ-A-Nachweis. Konkrete Frequenz-/DC-Grenzen und Geräteausführung prüfen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "source-error-identified; exact-device-standard-not-revalidated"
          },
          "sourceTranscription": "A: Auslösung bei reinen Wechselströmen, pulsierenden und reinen Gleichströmen.",
          "correction": "Typ A: Wechsel- und pulsierende Gleichfehlerströme; keine allgemeine Erfassung glatter Gleichfehlerströme."
        },
        {
          "id": "em-p07-rcd-matrix",
          "title": "RCD-Eigenschaften und Symbole",
          "kind": "diagram",
          "source": {
            "page": 7,
            "section": "Schutzwirkung / Stromstoss / Verzögerung / Frequenz"
          },
          "confidence": "needs-review",
          "explanation": "Mehrspaltige Übersicht zu ≤30 mA Personenzusatzschutz, ≤300 mA Brandschutz, Stossstromfestigkeit, Kurzzeitverzögerung und Frequenzbereich. Die Fortsetzung auf Seite 8 enthält Anwendungen und DC-Immunität.",
          "conditions": [
            "Die Typzuordnung über beide Scan-Hälften ist grafisch komplex. Einzelne Gerätefähigkeiten nicht allein aus dem Matrixausschnitt als verbindlich ableiten."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p07-diazed-colors",
          "title": "DIAZED-Kennfarben",
          "kind": "reference",
          "source": {
            "page": 7,
            "section": "Kennfarben der DIAZED-Sicherungen"
          },
          "confidence": "needs-review",
          "explanation": "Kennfarben sind eine Identifikationshilfe, kein Ersatz für das Ablesen des tatsächlichen Nennstroms.",
          "conditions": [
            "Scan nennt 65 A = kupfer. Das weicht vom üblichen 63-A-Nennwert ab und wird als Quellenfehler/Prüfpunkt markiert; nicht als neuer 65-A-Standard anbieten."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Nennstrom laut Scan",
              "Farbe"
            ],
            "rows": [
              [
                "6 A",
                "grün"
              ],
              [
                "10 A",
                "rot"
              ],
              [
                "16 A",
                "grau"
              ],
              [
                "20 A",
                "blau"
              ],
              [
                "25 A",
                "gelb"
              ],
              [
                "35/40 A",
                "schwarz"
              ],
              [
                "50 A",
                "weiss"
              ],
              [
                "65 A [prüfen: üblich 63 A]",
                "kupfer"
              ],
              [
                "80 A",
                "silber"
              ]
            ]
          }
        },
        {
          "id": "em-p07-socket-protection",
          "title": "Vorsicherung von Steckdosen und Schaltern",
          "kind": "reference",
          "source": {
            "page": 7,
            "section": "Max. Absicherung Steckdosen / Schalter"
          },
          "confidence": "needs-review",
          "explanation": "Scan nennt unter anderem 10-A-Steckdose bis 13-A-Vorsicherung, 32-A-Steckdose bis 32 A und RCD 30 mA für frei verfügbare Steckdosen bis 32 A.",
          "conditions": [
            "Schweizer Anwendungsfall, Normausgabe, Steckdosentyp und Ausnahmen separat prüfen. Nicht auf andere Länder oder beliebige Geräte übertragen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p07-breaker-bcd",
          "title": "LS-Charakteristiken B/C/D",
          "kind": "reference",
          "source": {
            "page": 7,
            "section": "Leitungsschutzschalter LS"
          },
          "confidence": "needs-review",
          "explanation": "Magnetische Bereiche und thermischer Prüfbereich sind voneinander zu unterscheiden.",
          "conditions": [
            "Keine komplette Zeit-Strom-Kennlinie. Prüfdauer, Produktnorm und Gerätekontext gehören zum Nachweis."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "formula": "B: 3–5 · In; C: 5–10 · In; D: 10–20 · In. Thermischer Prüfbereich im Scan: 1.13–1.45 · In.",
          "table": {
            "headers": [
              "Charakteristik",
              "Magnetischer Bereich"
            ],
            "rows": [
              [
                "B",
                "3–5 · In"
              ],
              [
                "C",
                "5–10 · In"
              ],
              [
                "D",
                "10–20 · In"
              ]
            ]
          }
        },
        {
          "id": "em-p08-rcd-applications",
          "title": "RCD-Anwendungen und DC-Immunität",
          "kind": "diagram",
          "source": {
            "page": 8,
            "section": "RCD-Fächer"
          },
          "confidence": "needs-review",
          "explanation": "Fortsetzung der RCD-Grafik für allgemeine Anwendungen, Ladeeinrichtungen, Haushalt, Frequenzumrichter und erhöhten Brandschutz; nennt AC, A, EV/MI, F, B/B+ sowie 6-/10-mA-DC-Markierungen.",
          "conditions": [
            "Nicht als pauschale Auswahlfreigabe für jede Ladeeinrichtung verwenden. Glatte DC-Erkennung, vorgelagerter RCD und Herstellerangaben müssen zusammenpassen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p08-wire-colors",
          "title": "Historische Leiterkennfarben in der Schweiz",
          "kind": "reference",
          "source": {
            "page": 8,
            "section": "Leiter-Kennfarben"
          },
          "confidence": "needs-review",
          "explanation": "Vergleich vor 1970, ab 1970, ab 1980 und ab 2005.",
          "conditions": [
            "Eine Farbe allein beweist die Leiterfunktion nicht; tatsächliche Zuordnung prüfen. Zeitgrenzen sind historische Quellangaben, keine Identifikation eines konkreten Bestands."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Leiter",
              "vor 1970",
              "ab 1970",
              "ab 1980",
              "ab 2005"
            ],
            "rows": [
              [
                "PE",
                "gelb/rot",
                "gelb/grün",
                "gelb/grün",
                "gelb/grün"
              ],
              [
                "N",
                "gelb",
                "gelb",
                "hellblau",
                "blau/hellblau"
              ],
              [
                "L1",
                "rot",
                "schwarz",
                "schwarz",
                "braun"
              ],
              [
                "L2",
                "blau",
                "rot",
                "rot",
                "schwarz"
              ],
              [
                "L3",
                "grün",
                "weiss",
                "weiss",
                "grau"
              ]
            ]
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-earthing",
      "title": "Fundamenterder und Potentialausgleich",
      "pages": [
        9,
        10
      ],
      "summary": "Aufbau, Materialübergänge, Anschlussstellen und Leiterbemessung.",
      "entries": [
        {
          "id": "em-p09-foundation-earth",
          "title": "Fundamenterder: Verlegung und Verbindung",
          "kind": "diagram",
          "source": {
            "page": 9,
            "section": "Fundamenterdung / NIN 4.1"
          },
          "confidence": "needs-review",
          "explanation": "Beschreibt umlaufenden Erder, Betonüberdeckung, Verbindung mit Bewehrung, Kennzeichnung, Korrosionsschutz und dokumentierte Messung. Zeichnung zeigt Verlauf bei einem Beispielgebäude.",
          "conditions": [
            "Die genannten Querschnitte/Abstände sind Quellwerte; konkrete Bauweise, isolierte Fundamente, Korrosion und aktuelle Normgrundlage separat prüfen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "referenceValues": [
            {
              "quantity": "Erderquerschnitt",
              "sourceValue": "mindestens 75 mm²"
            },
            {
              "quantity": "Betonüberdeckung",
              "sourceValue": "mindestens 50 mm"
            },
            {
              "quantity": "zusätzliche Bewehrungsverbindung",
              "sourceValue": "alle 5 m"
            }
          ]
        },
        {
          "id": "em-p09-insulated-foundations",
          "title": "Isoliertes Gebäude und Blitzschutz",
          "kind": "reference",
          "source": {
            "page": 9,
            "section": "Hinweiskasten"
          },
          "confidence": "needs-review",
          "explanation": "Scan nennt zusätzliche Verbindungen zum Ersatzerder bei isolierten Gebäuden und die Einbindung der Blitzschutzanlage.",
          "conditions": [
            "Blitzschutzkonzept und tatsächliche Erdungsanordnung sind eigene Planungsschritte; Schema ist kein vollständiger Nachweis."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p10-earthing-diagram",
          "title": "PE, PEN, Erdungsleiter und Schutzpotentialausgleich",
          "kind": "diagram",
          "source": {
            "page": 10,
            "section": "Erdungsleiter / Legende"
          },
          "confidence": "needs-review",
          "explanation": "Schema unterscheidet PE, Erdungsleiter zur Hauptschiene, Verbindung zum Erder, Schutzpotentialausgleich, Haupterdungsschiene, PEN-Anschlussleitung und Erder.",
          "conditions": [
            "Nicht jede eingehende Leitung darf ohne Prüfung ihrer Funktion und Betreiberanforderung angeschlossen werden. Isolierstücke berücksichtigen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p10-conductor-sizing",
          "title": "Bemessung ortsfester Leiter",
          "kind": "reference",
          "source": {
            "page": 10,
            "section": "NIN 5.4.4 Tabelle 1"
          },
          "confidence": "needs-review",
          "explanation": "Tabelle mit Vorsicherung, Verlegeart B1/B2, L/N/PEN, PE, Erdungsleitung und Schutzpotentialausgleich; enthält Fussnoten zu Reduktion und Blitzschutz.",
          "conditions": [
            "Tabelle ist installations-/material-/verlegeabhängig; Bedingungen und Fussnoten gehören dazu. Keine automatische Normbemessung aus Vorsicherungsstrom allein."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Vorsicherung A",
              "L/N/PEN B1/B2 mm²",
              "PE B1/B2 mm²",
              "Erdungsleitung B1/B2 mm²",
              "Potentialausgleich mm²"
            ],
            "rows": [
              [
                "25",
                "4 / 4",
                "4 / 4",
                "16 / 16",
                "6 bzw. 10 mit Blitzschutz"
              ],
              [
                "32",
                "6 / 6",
                "6 / 6",
                "16 / 16",
                "6 bzw. 10 mit Blitzschutz"
              ],
              [
                "40",
                "10 / 10",
                "10 / 10",
                "16 / 16",
                "6 bzw. 10 mit Blitzschutz"
              ],
              [
                "63",
                "16 / 16",
                "16 / 16",
                "16 / 16",
                "10"
              ],
              [
                "80",
                "25 / 25",
                "16 / 16",
                "16 / 16",
                "10"
              ],
              [
                "100",
                "35 / 35",
                "16 / 16",
                "16 / 16",
                "10"
              ],
              [
                "125",
                "50 / 70",
                "25 / 35",
                "25 / 35",
                "16"
              ],
              [
                "160",
                "70 / 95",
                "35 / 50",
                "35 / 50",
                "16"
              ],
              [
                "200",
                "95 / 120",
                "50 / 70",
                "50 / 50",
                "16"
              ],
              [
                "250",
                "120 / 120",
                "70 / 70",
                "50 / 50",
                "16"
              ]
            ],
            "note": "Gruppierte Zellen als B1/B2 wiederholt. Leiterreduktion laut Quelle nur unter den genannten Bedingungen zulässig."
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-spd-conduits",
      "title": "Überspannungsschutz und Installationsrohre",
      "pages": [
        11
      ],
      "summary": "SPD-Konzept im Wohnungsbau und Tabelle zur Rohrbelegung.",
      "entries": [
        {
          "id": "em-p11-spd-flow",
          "title": "Auswahl von Überspannungsschutzgeräten",
          "kind": "diagram",
          "source": {
            "page": 11,
            "section": "Überspannungsschutz im AC-Bereich / Wohnungsbau"
          },
          "confidence": "needs-review",
          "explanation": "Entscheidungsbaum mit äusserem Blitzschutz, Freileitungsanschluss, Einspeisestrom 160 A und Leitungswegen über 10 m; nennt Typ 1+2+3, Typ 2+3 und Typ 3.",
          "conditions": [
            "AC-Wohnungsbau-Schema; keine vollständige PV-/DC-/Datenleitungsplanung. Koordination, Ableitvermögen, Vorsicherung und Herstellerkonzept prüfen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p11-conduit-fill",
          "title": "Rohrbelegung: maximal isolierte Leiter",
          "kind": "reference",
          "source": {
            "page": 11,
            "section": "Bemessung der Rohre / NIN 5.2.1 Tabelle 9"
          },
          "confidence": "needs-review",
          "explanation": "Nenngrösse, minimaler Innendurchmesser und Querschnitte 1.5 bis 50 mm²; Klammerwerte beziehen sich laut Quelle auf sichtbar verlegte AP-Rohre.",
          "conditions": [
            "Reale Leiter-Aussendurchmesser, Rohrtyp, Biegeradien und Einziehbarkeit können zusätzliche Grenzen setzen. Keine geometrische Füllfaktorformel aus dieser Tabelle ableiten."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "DN",
              "di mm",
              "1.5 mm²",
              "2.5 mm²",
              "4 mm²",
              "6 mm²",
              "10 mm²",
              "16 mm²",
              "25 mm²",
              "35 mm²",
              "50 mm²"
            ],
            "rows": [
              [
                "16",
                "9.5",
                "3 (5)",
                "3",
                "2",
                "1",
                "—",
                "—",
                "—",
                "—",
                "—"
              ],
              [
                "20",
                "13",
                "7 (9)",
                "5",
                "3",
                "2",
                "1",
                "1",
                "—",
                "—",
                "—"
              ],
              [
                "25",
                "18",
                "13",
                "8",
                "4",
                "3",
                "3",
                "1",
                "1",
                "1",
                "—"
              ],
              [
                "32",
                "24",
                "—",
                "—",
                "7",
                "5",
                "4",
                "2",
                "2",
                "1",
                "1"
              ],
              [
                "40",
                "31",
                "—",
                "—",
                "—",
                "7",
                "5",
                "5",
                "3",
                "2",
                "2"
              ],
              [
                "50",
                "39",
                "—",
                "—",
                "—",
                "—",
                "7",
                "7",
                "5",
                "5",
                "3"
              ],
              [
                "63",
                "51",
                "—",
                "—",
                "—",
                "—",
                "—",
                "—",
                "7",
                "7",
                "7"
              ]
            ],
            "note": "Leere Quellzellen bedeuten hier nicht automatisch zulässige freie Auswahl."
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-bathroom",
      "title": "Badewanne und Dusche",
      "pages": [
        12
      ],
      "summary": "Bereiche 0/1/2, Fadenmass, Wasserbeanspruchung und zugelassene Betriebsmittel.",
      "entries": [
        {
          "id": "em-p12-bath-zones",
          "title": "Bereiche und Fadenmass",
          "kind": "diagram",
          "source": {
            "page": 12,
            "section": "NIN 7.01.3"
          },
          "confidence": "needs-review",
          "explanation": "Diagramme für Wanne, Dusche mit beziehungsweise ohne Wanne und feste Abtrennung. Quellmasse: Höhe 2.25 m, Erweiterung 0.60 m, Dusche ohne Wanne 1.20 m.",
          "conditions": [
            "Geometrie, Wasserauslass, feste Abtrennungen und zutreffende Normausgabe beachten. Nicht aus einem dekorativen Grundriss eine vollständige Installationsfreigabe ableiten."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p12-bath-ip",
          "title": "Wasserschutz nach Bereich",
          "kind": "reference",
          "source": {
            "page": 12,
            "section": "Schutzart der Betriebsmittel"
          },
          "confidence": "needs-review",
          "explanation": "Quellübersicht: Bereich 0 mindestens IPX7, Bereiche 1/2 mindestens IPX4, bei Strahlwasser IPX5.",
          "conditions": [
            "Zusätzliche Geräte-, Spannungs-, Anschluss- und Einbaubedingungen gelten unabhängig von der IP-Klasse."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Bereich",
              "Wasserschutz laut Scan"
            ],
            "rows": [
              [
                "0",
                "mindestens IPX7"
              ],
              [
                "1",
                "mindestens IPX4"
              ],
              [
                "2",
                "mindestens IPX4"
              ],
              [
                "bei Strahlwasser",
                "mindestens IPX5"
              ]
            ]
          }
        },
        {
          "id": "em-p12-bath-equipment",
          "title": "Betriebsmittel, SELV/PELV und Leitungsführung",
          "kind": "reference",
          "source": {
            "page": 12,
            "section": "Betriebsmittel je Bereich"
          },
          "confidence": "needs-review",
          "explanation": "Farbfelder unterscheiden Schalter/Steckdosen/Anschlussdosen sowie Wassererwärmer, Handtuchwärmer, Pumpen, Leuchten und Ventilation. Bereich 0 nennt SELV ≤12 V AC beziehungsweise ≤30 V DC; weitere Felder nennen ≤25 V AC beziehungsweise ≤60 V DC.",
          "conditions": [
            "Die volle Gerätefreigabe ist im kleinteiligen Schema an mehrere Bedingungen geknüpft. Nicht auf diese Spannungsschwellen reduzieren; genaue Anforderungen vor Produktregel-Implementierung prüfen."
          ],
          "audit": {
            "sourceReadability": "partly-small-conditional-diagram",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-measurement-billing",
      "title": "Ausmass, Regierapport und Installationscodes",
      "pages": [
        13
      ],
      "summary": "Gerechnete Leitungslängen, Zuschläge und Schweizer Installationscode-Übersicht.",
      "entries": [
        {
          "id": "em-p13-length-examples",
          "title": "Ausmass-Beispiele",
          "kind": "formula",
          "source": {
            "page": 13,
            "section": "Ausmass-Beispiele"
          },
          "confidence": "verified",
          "explanation": "Die vier Additionen im gezeichneten Beispiel sind rechnerisch richtig.",
          "conditions": [
            "Die Zeichnung beschreibt ein Beispiel; Abrechnungsregeln und Zuschläge sind keine allgemeine physikalische Formel."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "l_Rohr = 1.2 + 1.3 = 2.5 m; l_Rohr = 2.2 + 3.5 + 1.2 = 6.9 m; l_3×1.5 = 0.3 + 3.5 + 1.2 + 0.3 = 5.3 m; l_6×1.5 = 0.3 + 2.2 + 0.3 = 2.8 m",
          "variables": [
            {
              "symbol": "l",
              "label": "Länge",
              "unit": "m"
            }
          ]
        },
        {
          "id": "em-p13-measurement-rules",
          "title": "Grundsätze des Ausmasses",
          "kind": "reference",
          "source": {
            "page": 13,
            "section": "Grundsatzregeln"
          },
          "confidence": "needs-review",
          "explanation": "Im Scan: fertige Installation messen und auf 10 cm runden, Formstücke zählen, Anschlussreserven bei Kleinapparaten/Balkenleuchten beachten, Anschlüsse auch bei bauseits gelieferten Apparaten erfassen.",
          "conditions": [
            "Vertrags-/NPK-/Ausmassgrundlage prüfen; Reserven nicht als universelle Normzuschläge ausgeben."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p13-work-report",
          "title": "Regierapport",
          "kind": "reference",
          "source": {
            "page": 13,
            "section": "Wichtig bei jedem Regierapport"
          },
          "confidence": "verified",
          "explanation": "Checkliste zu Auftrag, Personal/Datum, Kundenadresse, Arbeitsbeschreibung, Material, Stunden, NIV-Kontrollen, Fertigstellungsgrad und Unterschrift.",
          "conditions": [],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p13-installation-codes",
          "title": "IC-Übersicht nach NPK",
          "kind": "reference",
          "source": {
            "page": 13,
            "section": "IC-Übersicht"
          },
          "confidence": "needs-review",
          "explanation": "Erste Ziffer beschreibt Ausführung; zweite Ziffer Montageverhältnis. Tabelle gibt Beispiele für AP, UP, Einbau, Einzug und Anschlüsse.",
          "conditions": [
            "Konkrete Ausschreibungs-/Katalogposition und Ausgabe bleiben massgeblich."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Gruppe",
              "IC",
              "Kurzbeschreibung"
            ],
            "rows": [
              [
                "AP",
                "11",
                "Holz / gelochte Montageplatte / einfache Untergründe"
              ],
              [
                "AP",
                "12",
                "Kunststoff, Gips, Ziegel, Beton und vergleichbare Untergründe"
              ],
              [
                "AP",
                "13",
                "Metallkonstruktion / nivellierter Rohboden"
              ],
              [
                "UP",
                "20",
                "vorhandene Öffnung"
              ],
              [
                "UP",
                "21",
                "bauseits erstellte Öffnung oder konventionelle Deckenschalung"
              ],
              [
                "UP",
                "22",
                "Vollgips, Porenbeton, Backstein, Leichtbau, konventionelle Wandschalung"
              ],
              [
                "UP",
                "23",
                "Kalksandstein, Zementstein, Massivholz, Sichtmauerwerk / Sichtbetonschalung"
              ],
              [
                "EB",
                "31",
                "vorhandene oder bauseits erstellte Öffnung"
              ],
              [
                "EB",
                "32",
                "Öffnung in Holz/Kunststoff/Gips erstellen"
              ],
              [
                "EB",
                "33",
                "Öffnung in Feinblech erstellen"
              ],
              [
                "EZ",
                "52",
                "Rohr/Kanal oder horizontales Kabeltragsystem"
              ],
              [
                "EZ",
                "53",
                "Nachzug / Auskreuzung / Kommunikationsschrank"
              ],
              [
                "AS",
                "71",
                "Steck-/Press-/Feder-/Schneidklemme"
              ],
              [
                "AS",
                "72",
                "Schraubklemme / Lötverbindung"
              ],
              [
                "AS",
                "73",
                "Kabelschuh / Schweissverbindung / Glasfaserspleissung"
              ]
            ],
            "note": "Inhalt knapp paraphrasiert; keine vollständige NPK-Lizenz oder Positionsbeschreibung."
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-ip-symbols",
      "title": "IP-Schutz und weitere Kennzeichen",
      "pages": [
        14
      ],
      "summary": "IP-Ziffern, Zusatzbuchstaben und Schutz-/Materialkennzeichen.",
      "entries": [
        {
          "id": "em-p14-ip-first",
          "title": "IP: Berührungs- und Fremdkörperschutz",
          "kind": "reference",
          "source": {
            "page": 14,
            "section": "IP erste Kennziffer"
          },
          "confidence": "needs-review",
          "explanation": "Erste Kennziffer reicht von 0 bis 6.",
          "conditions": [
            "Quellzeile IP2 nennt >12 mm; präzise Normprüfung bezieht sich auf die zugehörigen genormten Prüfsonden. Keine Messlehre aus der vereinfachten Millimeterangabe machen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Ziffer",
              "Bedeutung"
            ],
            "rows": [
              [
                "0",
                "kein Schutz"
              ],
              [
                "1",
                "feste Fremdkörper etwa 50 mm"
              ],
              [
                "2",
                "Finger / feste Fremdkörper etwa 12.5 mm"
              ],
              [
                "3",
                "Werkzeug / feste Fremdkörper etwa 2.5 mm"
              ],
              [
                "4",
                "Draht / feste Fremdkörper etwa 1 mm"
              ],
              [
                "5",
                "staubgeschützt"
              ],
              [
                "6",
                "staubdicht"
              ]
            ],
            "note": "Technische Kurzbeschreibung; Prüfbedingungen der Produktnorm gelten."
          },
          "diagram": "ip-code"
        },
        {
          "id": "em-p14-ip-second",
          "title": "IP: Wasserschutz",
          "kind": "reference",
          "source": {
            "page": 14,
            "section": "IP zweite Kennziffer"
          },
          "confidence": "needs-review",
          "explanation": "Zweite Kennziffer im Scan reicht von 0 bis 8.",
          "conditions": [
            "IPX7/IPX8 beinhalten nicht automatisch jede Strahlwasserprüfung. IPX8-Bedingungen sind herstellerbezogen; eine feste Eintauchtiefe nicht erfinden."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Ziffer",
              "Bedeutung"
            ],
            "rows": [
              [
                "0",
                "kein Schutz"
              ],
              [
                "1",
                "Tropfwasser"
              ],
              [
                "2",
                "Tropfwasser bei bis 15° Neigung"
              ],
              [
                "3",
                "Sprühwasser"
              ],
              [
                "4",
                "Spritzwasser"
              ],
              [
                "5",
                "Strahlwasser"
              ],
              [
                "6",
                "starkes Strahlwasser [Scan: Schwallwasser]"
              ],
              [
                "7",
                "zeitweiliges Untertauchen"
              ],
              [
                "8",
                "dauerndes Untertauchen unter vereinbarten Bedingungen"
              ]
            ]
          }
        },
        {
          "id": "em-p14-ip-letters",
          "title": "Zusatz- und Ergänzungsbuchstaben",
          "kind": "reference",
          "source": {
            "page": 14,
            "section": "Zusätzlicher Berührungsschutz / Ergänzende Kennzeichnung"
          },
          "confidence": "needs-review",
          "explanation": "A Handrücken, B Finger, C Werkzeug, D Draht; H Hochspannungsbetriebsmittel, M bewegte Teile bei Wasserprüfung in Betrieb, S im Stillstand, W Wetterbedingungen.",
          "conditions": [
            "Buchstaben nicht mit der IP-Ziffernfolge oder Schutzklasse verwechseln."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        },
        {
          "id": "em-p14-extra-symbols",
          "title": "Weitere Material- und Schutzzeichen",
          "kind": "diagram",
          "source": {
            "page": 14,
            "section": "NIN 2015 B+E Kennzeichen"
          },
          "confidence": "needs-review",
          "explanation": "Darstellung für Ex, wärmebeständig, kältebeständig, Schutzklasse II (Doppelquadrat) und korrosionssicher.",
          "conditions": [
            "Dieser Quellabschnitt nennt ausdrücklich NIN 2015 B+E. Ein Symbol allein ist kein vollständiger aktueller Zulassungsnachweis."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-swiss-connectors",
      "title": "Schweizer Stecker- und Steckdosensystem",
      "pages": [
        15
      ],
      "summary": "ESTI-Übersicht SN 441011, IP20, mit 10-A- und 16-A-Familien.",
      "entries": [
        {
          "id": "em-p15-connector-types",
          "title": "Schweizer Steckertypen und Bemessung",
          "kind": "reference",
          "source": {
            "page": 15,
            "section": "CH-Stecker-System SN 441011 IP20"
          },
          "confidence": "needs-review",
          "explanation": "Der Einsatz zeigt Stecker, Steckdosen und Kupplungen; Dokumentkopf SN 441011, Fusszeile SN 441011-1_2019 und Datum 28.09.2025.",
          "conditions": [
            "Das Datum ist ein Dokumentstand, keine Aussage zu jedem späteren Normnachtrag. IP20-Übersicht nicht für Feuchtraum/IP55-Anwendungen verallgemeinern."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Typ",
              "Leiter",
              "Bemessung",
              "Hinweis"
            ],
            "rows": [
              [
                "11",
                "L+N",
                "10 A / 250 V",
                "zweipoliger Stecker/Kupplung"
              ],
              [
                "12",
                "L+N+PE",
                "10 A / 250 V",
                "Steckdose ohne Schutzkragen laut Quelle seit 31.12.2016 nicht mehr für Neumontage"
              ],
              [
                "13",
                "L+N+PE",
                "10 A / 250 V",
                "Steckdose/Kupplung mit Schutzkragen"
              ],
              [
                "15",
                "3L+N+PE",
                "10 A / 250–400 V",
                "mehrphasig"
              ],
              [
                "21",
                "L+N",
                "16 A / 250 V",
                "zweipoliger Stecker/Kupplung"
              ],
              [
                "23",
                "L+N+PE",
                "16 A / 250 V",
                "einphasig mit PE"
              ],
              [
                "25",
                "3L+N+PE",
                "16 A / 250–400 V",
                "mehrphasig"
              ],
              [
                "26 / EN 50075",
                "L+N",
                "2.5 A / 250 V",
                "Eurostecker laut Quelle"
              ]
            ]
          }
        },
        {
          "id": "em-p15-compatibility",
          "title": "Kompatibilitätslinien der Stecksysteme",
          "kind": "diagram",
          "source": {
            "page": 15,
            "section": "Verbindungsmatrix"
          },
          "confidence": "needs-review",
          "explanation": "Grafische Anschlusslinien zeigen, welche Stecker in welche Steckdosen beziehungsweise Kupplungen passen.",
          "conditions": [
            "Die eng überlagerten Linien werden nicht ungeprüft als vollständige Kompatibilitätsmatrix maschinenlesbar erfunden. Mechanische Steckbarkeit ist keine Freigabe für höheren Laststrom oder fehlenden Schutzleiter."
          ],
          "audit": {
            "sourceReadability": "types-clear-matrix-lines-dense",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        }
      ],
      "group": "reference"
    },
    {
      "id": "em-basic-formulas",
      "title": "Formeln und Einheiten",
      "pages": [
        16
      ],
      "summary": "Mathematisch geprüfte allgemeine Beziehungen, mit expliziten Korrekturen der Einheiten und Gültigkeitsbedingungen.",
      "entries": [
        {
          "id": "em-p16-active-single",
          "title": "Wirk-/Nutzleistung, einphasig",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Wirk-/Nutzleistung, einphasig"
          },
          "confidence": "verified",
          "explanation": "Die gedruckte Formel enthält η und beschreibt damit Nutzleistung eines umwandelnden Verbrauchers. Elektrische Wirkleistung erhält keinen zusätzlichen η-Faktor.",
          "conditions": [
            "Sinusförmiger stationärer Betrieb; bei nichtsinusförmigen Strömen Gesamtleistungsfaktor statt reinem cos φ unterscheiden."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "P_el = U · I · cos φ; P_nutz = η · U · I · cos φ; I = P_nutz / (η · U · cos φ)",
          "calculatorFormulaId": "leistung-1p",
          "variables": [
            {
              "symbol": "P_el",
              "label": "elektrische Wirkleistung",
              "unit": "W"
            },
            {
              "symbol": "P_nutz",
              "label": "Nutzleistung",
              "unit": "W"
            },
            {
              "symbol": "U",
              "label": "Effektivspannung",
              "unit": "V"
            },
            {
              "symbol": "I",
              "label": "Effektivstrom",
              "unit": "A"
            },
            {
              "symbol": "cos φ",
              "label": "Verschiebungsfaktor",
              "unit": "1"
            },
            {
              "symbol": "η",
              "label": "Wirkungsgrad",
              "unit": "1"
            }
          ]
        },
        {
          "id": "em-p16-active-three",
          "title": "Wirk-/Nutzleistung, dreiphasig",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Wirk-/Nutzleistung, dreiphasig"
          },
          "confidence": "verified",
          "explanation": "U_LL ist Aussenleiterspannung, I_L Leiterstrom. Im Druck wird P mit η angegeben; Nutz- und elektrische Leistung müssen unterschieden werden.",
          "conditions": [
            "Symmetrische sinusförmige Dreiphasenlast. Nicht 230-V-Strangspannung als U_LL einsetzen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "P_el = √3 · U_LL · I_L · cos φ; P_nutz = η · √3 · U_LL · I_L · cos φ; I_L = P_nutz / (η · √3 · U_LL · cos φ)",
          "calculatorFormulaId": "leistung-3p",
          "variables": [
            {
              "symbol": "P_el",
              "label": "elektrische Wirkleistung",
              "unit": "W"
            },
            {
              "symbol": "P_nutz",
              "label": "Nutzleistung",
              "unit": "W"
            },
            {
              "symbol": "U_LL",
              "label": "Aussenleiterspannung",
              "unit": "V"
            },
            {
              "symbol": "I_L",
              "label": "Leiterstrom",
              "unit": "A"
            },
            {
              "symbol": "cos φ",
              "label": "Verschiebungsfaktor",
              "unit": "1"
            },
            {
              "symbol": "η",
              "label": "Wirkungsgrad",
              "unit": "1"
            }
          ]
        },
        {
          "id": "em-p16-conductor-resistance",
          "title": "Leiterwiderstand",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Leiterwiderstand"
          },
          "confidence": "verified",
          "explanation": "Länge ist die tatsächliche Leiterlänge. Hin- und Rückleiter bei einer Schleife zusätzlich erfassen.",
          "conditions": [
            "Einheit von ρ muss zur Flächeneinheit passen. Material und Temperatur gehören zum Widerstandswert."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "R = ρ · l / A",
          "calculatorFormulaId": "leiterwiderstand",
          "variables": [
            {
              "symbol": "R",
              "label": "Widerstand",
              "unit": "Ω"
            },
            {
              "symbol": "ρ",
              "label": "spezifischer Widerstand",
              "unit": "Ω·mm²/m"
            },
            {
              "symbol": "l",
              "label": "Leiterlänge",
              "unit": "m"
            },
            {
              "symbol": "A",
              "label": "Leiterquerschnitt",
              "unit": "mm²"
            }
          ]
        },
        {
          "id": "em-p16-illuminance",
          "title": "Mittlere Beleuchtungsstärke",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Mittlere Beleuchtungsstärke"
          },
          "confidence": "verified",
          "explanation": "Idealisierte mittlere Beleuchtungsstärke aus dem auf die betrachtete Fläche fallenden Lichtstrom.",
          "conditions": [
            "Nicht jeder emittierte Lampenlichtstrom erreicht die Nutzebene. Punktweise Beleuchtungsstärke und Gleichmässigkeit werden nicht bestimmt."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "E_m = Φ / A_Raum",
          "calculatorFormulaId": "beleuchtungsstaerke",
          "variables": [
            {
              "symbol": "E_m",
              "label": "mittlere Beleuchtungsstärke",
              "unit": "lx"
            },
            {
              "symbol": "Φ",
              "label": "auf die Fläche fallender Lichtstrom",
              "unit": "lm"
            },
            {
              "symbol": "A_Raum",
              "label": "Raum-/Bezugfläche",
              "unit": "m²"
            }
          ]
        },
        {
          "id": "em-p16-required-flux",
          "title": "Notwendiger Lichtstrom",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Notwendiger Lichtstrom"
          },
          "confidence": "verified",
          "explanation": "η_B bezeichnet hier den Beleuchtungs-/Nutzungswirkungsgrad, nicht automatisch den Motorwirkungsgrad.",
          "conditions": [
            "0 < η_B ≤ 1. Gedruckte Faustwerte 0.3–0.5 sind keine allgemeine Raumplanung. Wartungsfaktor ist nicht separat in dieser Quellformel enthalten."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "Φ_erforderlich = E_m · A_Raum / η_B",
          "calculatorFormulaId": "lichtstrom",
          "variables": [
            {
              "symbol": "Φ_erforderlich",
              "label": "erforderlicher Gesamtlichtstrom",
              "unit": "lm"
            },
            {
              "symbol": "E_m",
              "label": "Zielbeleuchtungsstärke",
              "unit": "lx"
            },
            {
              "symbol": "A_Raum",
              "label": "Fläche",
              "unit": "m²"
            },
            {
              "symbol": "η_B",
              "label": "Beleuchtungswirkungsgrad",
              "unit": "1"
            }
          ]
        },
        {
          "id": "em-p16-meter-power",
          "title": "Leistung aus Zählerimpulsen/Umdrehungen",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Leistung aus Zählerimpulsen/Umdrehungen"
          },
          "confidence": "verified",
          "explanation": "Bei c in Impulsen beziehungsweise Umdrehungen pro kWh ergibt die gedruckte 3600-Formel kW, nicht W. Anzahl und Zählerkonstante müssen dieselbe Ereignisart verwenden.",
          "conditions": [
            "c > 0 und t_s > 0; tatsächlich am Zähler aufgedruckte Konstante verwenden."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "P_kW = 3600 · n / (c · t_s); P_W = 3 600 000 · n / (c · t_s)",
          "calculatorFormulaId": "zaehlerleistung",
          "variables": [
            {
              "symbol": "P_kW",
              "label": "mittlere Leistung",
              "unit": "kW"
            },
            {
              "symbol": "n",
              "label": "gezählte Ereignisse",
              "unit": "1"
            },
            {
              "symbol": "c",
              "label": "Zählerkonstante",
              "unit": "Impulse/kWh oder Umdrehungen/kWh"
            },
            {
              "symbol": "t_s",
              "label": "Messzeit",
              "unit": "s"
            }
          ],
          "sourceTranscription": "P = 3600 · n / (c · t(s))",
          "correction": "Ergebnis bei c pro kWh ausdrücklich kW; für W Faktor 1000 zusätzlich."
        },
        {
          "id": "em-p16-ohm",
          "title": "Ohmsches Gesetz",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Ohmsches Gesetz"
          },
          "confidence": "verified",
          "explanation": "Reziproke Umstellungen sind dimensionsrichtig.",
          "conditions": [
            "DC oder ohmsche AC-Last; Nenner nicht null."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "U = R · I; I = U / R; R = U / I",
          "calculatorFormulaId": "ohm",
          "variables": [
            {
              "symbol": "U",
              "label": "Spannung",
              "unit": "V"
            },
            {
              "symbol": "I",
              "label": "Strom",
              "unit": "A"
            },
            {
              "symbol": "R",
              "label": "Widerstand",
              "unit": "Ω"
            }
          ],
          "diagram": "ohm"
        },
        {
          "id": "em-p16-conductance",
          "title": "Leitwert",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Leitwert"
          },
          "confidence": "verified",
          "explanation": "Leitwert ist der Kehrwert des ohmschen Widerstands.",
          "conditions": [
            "Für allgemeine AC-Netze komplexe Admittanz und Wirkleitwert unterscheiden."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "G = 1 / R = I / U",
          "calculatorFormulaId": "leitwert",
          "variables": [
            {
              "symbol": "G",
              "label": "Leitwert",
              "unit": "S"
            },
            {
              "symbol": "R",
              "label": "Widerstand",
              "unit": "Ω"
            },
            {
              "symbol": "I",
              "label": "Strom",
              "unit": "A"
            },
            {
              "symbol": "U",
              "label": "Spannung",
              "unit": "V"
            }
          ]
        },
        {
          "id": "em-p16-capacitive-reactance",
          "title": "Kapazitiver Blindwiderstand",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Kapazitiver Blindwiderstand"
          },
          "confidence": "verified",
          "explanation": "Der Faktor 10⁶ der Vorlage ist korrekt, wenn die Kapazität in µF eingesetzt wird.",
          "conditions": [
            "Idealer Kondensator, sinusförmiger stationärer Betrieb. U/I ist hier Betrag; Vorzeichen der kapazitiven Reaktanz in Z = −jX_C beachten."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "X_C = 1 / (ω · C_F) = 10⁶ / (ω · C_µF); ω = 2πf; X_C = U / I",
          "calculatorFormulaId": "kapazitiv",
          "variables": [
            {
              "symbol": "X_C",
              "label": "Betrag des kapazitiven Blindwiderstands",
              "unit": "Ω"
            },
            {
              "symbol": "ω",
              "label": "Kreisfrequenz",
              "unit": "rad/s"
            },
            {
              "symbol": "f",
              "label": "Frequenz",
              "unit": "Hz"
            },
            {
              "symbol": "C_F",
              "label": "Kapazität",
              "unit": "F"
            },
            {
              "symbol": "C_µF",
              "label": "Kapazität",
              "unit": "µF"
            }
          ]
        },
        {
          "id": "em-p16-inductive-reactance",
          "title": "Induktiver Blindwiderstand",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Induktiver Blindwiderstand"
          },
          "confidence": "verified",
          "explanation": "Ideale induktive Reaktanz.",
          "conditions": [
            "Ideale Spule; Wicklungswiderstand, Sättigung und Frequenzverluste nicht enthalten."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "X_L = ω · L = 2πf · L",
          "calculatorFormulaId": "induktiv",
          "variables": [
            {
              "symbol": "X_L",
              "label": "induktiver Blindwiderstand",
              "unit": "Ω"
            },
            {
              "symbol": "ω",
              "label": "Kreisfrequenz",
              "unit": "rad/s"
            },
            {
              "symbol": "f",
              "label": "Frequenz",
              "unit": "Hz"
            },
            {
              "symbol": "L",
              "label": "Induktivität",
              "unit": "H"
            }
          ]
        },
        {
          "id": "em-p16-apparent-power",
          "title": "Scheinleistung",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Scheinleistung"
          },
          "confidence": "verified",
          "explanation": "Das Leistungsdreieck gilt für sinusförmige Einfrequenzgrössen. Divisionen nur bei von null verschiedenem Nenner.",
          "conditions": [
            "Keine pauschale Gleichsetzung bei Verzerrungsleistung. S ist nicht negativ."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "S = √(P² + Q²) = P / cos φ = Q / sin φ",
          "calculatorFormulaId": "leistungsdreieck",
          "variables": [
            {
              "symbol": "S",
              "label": "Scheinleistung",
              "unit": "VA"
            },
            {
              "symbol": "P",
              "label": "Wirkleistung",
              "unit": "W"
            },
            {
              "symbol": "Q",
              "label": "Blindleistung",
              "unit": "var"
            },
            {
              "symbol": "φ",
              "label": "Phasenwinkel",
              "unit": "rad oder °"
            }
          ],
          "diagram": "power-triangle"
        },
        {
          "id": "em-p16-star",
          "title": "Drehstrom: Sternschaltung",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Drehstrom: Sternschaltung"
          },
          "confidence": "verified",
          "explanation": "Spannungs- und Strombeziehungen für symmetrische Sternschaltung.",
          "conditions": [
            "Nicht mit der Eignung eines konkreten Motors für eine Netzspannung gleichsetzen. Typenschild beachten."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "U_LL = √3 · U_Str; U_Str = U_LL / √3; I_L = I_Str",
          "calculatorFormulaId": "stern-dreieck",
          "variables": [
            {
              "symbol": "U_LL",
              "label": "Aussenleiterspannung",
              "unit": "V"
            },
            {
              "symbol": "U_Str",
              "label": "Strangspannung",
              "unit": "V"
            },
            {
              "symbol": "I_L",
              "label": "Leiterstrom",
              "unit": "A"
            },
            {
              "symbol": "I_Str",
              "label": "Strangstrom",
              "unit": "A"
            }
          ]
        },
        {
          "id": "em-p16-delta",
          "title": "Drehstrom: Dreieckschaltung",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Drehstrom: Dreieckschaltung"
          },
          "confidence": "verified",
          "explanation": "Strang- und Leitergrössen sind in der Dreieckschaltung verschieden.",
          "conditions": [
            "Symmetrischer Betrieb. Kein vollständiger Stern-Dreieck-Anlaufnachweis."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "U_LL = U_Str; I_L = √3 · I_Str; I_Str = I_L / √3",
          "calculatorFormulaId": "stern-dreieck",
          "variables": [
            {
              "symbol": "U_LL",
              "label": "Aussenleiterspannung",
              "unit": "V"
            },
            {
              "symbol": "U_Str",
              "label": "Strangspannung",
              "unit": "V"
            },
            {
              "symbol": "I_L",
              "label": "Leiterstrom",
              "unit": "A"
            },
            {
              "symbol": "I_Str",
              "label": "Strangstrom",
              "unit": "A"
            }
          ]
        },
        {
          "id": "em-p16-current-density",
          "title": "Stromdichte",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Stromdichte"
          },
          "confidence": "verified",
          "explanation": "Mittlere Stromdichte im Leiterquerschnitt.",
          "conditions": [
            "Nicht mit zulässigem Dauerstrom gleichsetzen. Wärmeabfuhr, Verlegung und Material bestimmen die Strombelastbarkeit."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "J = I / A",
          "calculatorFormulaId": "stromdichte",
          "variables": [
            {
              "symbol": "J",
              "label": "Stromdichte",
              "unit": "A/mm²"
            },
            {
              "symbol": "I",
              "label": "Strom",
              "unit": "A"
            },
            {
              "symbol": "A",
              "label": "Leiterquerschnitt",
              "unit": "mm²"
            }
          ]
        },
        {
          "id": "em-p16-energy-cost",
          "title": "Energiekosten",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Energiekosten"
          },
          "confidence": "verified",
          "explanation": "Die Quellformel K = T_a · P · t benötigt passende Einheiten. Bei Preis in Rp/kWh muss P in kW stehen.",
          "conditions": [
            "Konstante Leistung/Preis oder entsprechend gemittelte Energie. Grund-, Leistungs- und sonstige Tarifkomponenten nicht enthalten."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "K_Rp = T_Rp/kWh · P_kW · t_h; K_CHF = K_Rp / 100",
          "calculatorFormulaId": "energiekosten",
          "variables": [
            {
              "symbol": "K_Rp",
              "label": "Energiekosten",
              "unit": "Rp"
            },
            {
              "symbol": "K_CHF",
              "label": "Energiekosten",
              "unit": "CHF"
            },
            {
              "symbol": "T_Rp/kWh",
              "label": "Arbeitspreis",
              "unit": "Rp/kWh"
            },
            {
              "symbol": "P_kW",
              "label": "mittlere Leistung",
              "unit": "kW"
            },
            {
              "symbol": "t_h",
              "label": "Dauer",
              "unit": "h"
            }
          ]
        },
        {
          "id": "em-p16-lamp-count",
          "title": "Anzahl Lampen/Leuchten",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Anzahl Lampen/Leuchten"
          },
          "confidence": "verified",
          "explanation": "Die Vorlage zeigt das Lichtstromverhältnis. Für eine Mindestanzahl ganzer identischer Leuchten wird aufgerundet.",
          "conditions": [
            "Nutzungs- und Wartungsfaktoren müssen konsistent im benötigten Gesamtlichtstrom enthalten sein. Verteilung und Gleichmässigkeit separat prüfen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "n = Φ_gesamt / Φ_Lampe; n_erforderlich = aufrunden(n)",
          "calculatorFormulaId": "lampenanzahl",
          "variables": [
            {
              "symbol": "n",
              "label": "Anzahl",
              "unit": "1"
            },
            {
              "symbol": "Φ_gesamt",
              "label": "benötigter Gesamtlichtstrom",
              "unit": "lm"
            },
            {
              "symbol": "Φ_Lampe",
              "label": "Lichtstrom je Lampe/Leuchte",
              "unit": "lm"
            }
          ]
        },
        {
          "id": "em-p16-electric-power",
          "title": "Ohmsche Leistung",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Ohmsche Leistung"
          },
          "confidence": "verified",
          "explanation": "Die drei elektrischen Leistungsgleichungen gelten gemeinsam für eine ohmsche Last.",
          "conditions": [
            "Bei allgemeinen AC-Lasten sind Blind-/Scheinleistung und Leistungsfaktor zu berücksichtigen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "P = U · I = I² · R = U² / R",
          "calculatorFormulaId": "ohm",
          "variables": [
            {
              "symbol": "P",
              "label": "Leistung",
              "unit": "W"
            },
            {
              "symbol": "U",
              "label": "Spannung",
              "unit": "V"
            },
            {
              "symbol": "I",
              "label": "Strom",
              "unit": "A"
            },
            {
              "symbol": "R",
              "label": "Widerstand",
              "unit": "Ω"
            }
          ]
        },
        {
          "id": "em-p16-energy-time",
          "title": "Leistung und Energie",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Leistung und Energie"
          },
          "confidence": "verified",
          "explanation": "Einheit des Ergebnisses hängt von den eingesetzten Zeiteinheiten ab.",
          "conditions": [
            "W · s = J; W · h = Wh; kW · h = kWh. Bei veränderlicher Leistung zeitlich integrieren."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "P = W / t; W = P · t",
          "calculatorFormulaId": "energie",
          "variables": [
            {
              "symbol": "P",
              "label": "Leistung",
              "unit": "W oder kW"
            },
            {
              "symbol": "W",
              "label": "Energie",
              "unit": "J, Wh oder kWh"
            },
            {
              "symbol": "t",
              "label": "Dauer",
              "unit": "s oder h"
            }
          ]
        },
        {
          "id": "em-p16-mechanical-energy",
          "title": "Mechanische Hubenergie",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Mechanische Hubenergie"
          },
          "confidence": "verified",
          "explanation": "Potentielle Energie bei näherungsweise konstanter Fallbeschleunigung.",
          "conditions": [
            "Die Quelllegende „Arbeit in nm“ wird als J beziehungsweise N·m präzisiert. nm wäre die Längeneinheit Nanometer."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "W = m · g · h",
          "calculatorFormulaId": "mechanische-energie",
          "variables": [
            {
              "symbol": "W",
              "label": "Hubenergie",
              "unit": "J = N·m"
            },
            {
              "symbol": "m",
              "label": "Masse",
              "unit": "kg"
            },
            {
              "symbol": "g",
              "label": "Fallbeschleunigung",
              "unit": "m/s²"
            },
            {
              "symbol": "h",
              "label": "Höhendifferenz",
              "unit": "m"
            }
          ],
          "sourceTranscription": "W = Arbeit in nm",
          "correction": "W ist Energie in J = N·m; kein Nanometer."
        },
        {
          "id": "em-p16-unit-conversion",
          "title": "Umrechnungsfaktoren",
          "kind": "formula",
          "source": {
            "page": 16,
            "section": "Umrechnungsfaktoren"
          },
          "confidence": "verified",
          "explanation": "Die gedruckten Leistungswerte 1.36 und 0.736 sind gerundet. Zollumrechnung ist exakt.",
          "conditions": [
            "Metrische PS nicht mit britischer/mechanischer horsepower gleichsetzen."
          ],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "verified-with-stated-conditions",
            "normativeValidation": "not-performed"
          },
          "formula": "1 kW ≈ 1.35962 PS; 1 PS ≈ 0.735499 kW; 1 Zoll = 2.54 cm",
          "calculatorFormulaId": "umrechnung",
          "variables": [
            {
              "symbol": "PS",
              "label": "metrische Pferdestärke",
              "unit": "PS"
            },
            {
              "symbol": "P",
              "label": "Leistung",
              "unit": "kW"
            },
            {
              "symbol": "l",
              "label": "Länge",
              "unit": "Zoll oder cm"
            }
          ]
        },
        {
          "id": "em-p16-symbol-legend",
          "title": "Formelzeichen und Einheiten",
          "kind": "reference",
          "source": {
            "page": 16,
            "section": "Legende"
          },
          "confidence": "verified",
          "explanation": "Legende für R,U,I,Stranggrössen,cos φ,P,S,Q,η,K,T_a,n,Φ,Flächen,ρ,γ,L,C,X_L,X_C,E_m,J,W,m,h,g,G,t und ω.",
          "conditions": [],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          },
          "table": {
            "headers": [
              "Zeichen",
              "Bedeutung",
              "Einheit / Hinweis"
            ],
            "rows": [
              [
                "R",
                "Widerstand",
                "Ω"
              ],
              [
                "U, U_Str",
                "Spannung / Strangspannung",
                "V"
              ],
              [
                "I, I_Str",
                "Leiter-/Strangstrom",
                "A"
              ],
              [
                "cos φ",
                "Verschiebungsfaktor",
                "1; im idealen Leistungsdreieck P/S"
              ],
              [
                "P",
                "Wirk-/Nutzleistung",
                "W; η-Kontext beachten"
              ],
              [
                "S",
                "Scheinleistung",
                "VA"
              ],
              [
                "Q",
                "Blindleistung",
                "var"
              ],
              [
                "η",
                "Wirkungsgrad",
                "1"
              ],
              [
                "K",
                "Kosten",
                "Rp oder CHF explizit"
              ],
              [
                "T_a",
                "Energiepreis",
                "Rp/kWh"
              ],
              [
                "n",
                "Zählereignisse / Lampenzahl",
                "kontextabhängig"
              ],
              [
                "Φ",
                "Lichtstrom",
                "lm"
              ],
              [
                "A_Raum",
                "Fläche",
                "m²"
              ],
              [
                "A",
                "Leiterquerschnitt",
                "mm²"
              ],
              [
                "ρ",
                "spezifischer Widerstand",
                "Ω·mm²/m"
              ],
              [
                "γ",
                "Leitfähigkeit",
                "m/(Ω·mm²)"
              ],
              [
                "L",
                "Induktivität",
                "H"
              ],
              [
                "C",
                "Kapazität",
                "F oder µF explizit"
              ],
              [
                "X_L, X_C",
                "Blindwiderstand",
                "Ω"
              ],
              [
                "E_m",
                "mittlere Beleuchtungsstärke",
                "lx"
              ],
              [
                "J",
                "Stromdichte",
                "A/mm²"
              ],
              [
                "W",
                "Energie",
                "J = N·m, nicht nm"
              ],
              [
                "m",
                "Masse",
                "kg"
              ],
              [
                "h",
                "Höhe",
                "m"
              ],
              [
                "g",
                "Fallbeschleunigung",
                "m/s²"
              ],
              [
                "G",
                "Leitwert",
                "S"
              ],
              [
                "t",
                "Zeit",
                "s oder h explizit"
              ],
              [
                "ω",
                "Kreisfrequenz",
                "rad/s"
              ]
            ]
          }
        },
        {
          "id": "em-p16-imprint",
          "title": "Quellstand und Impressum",
          "kind": "reference",
          "presentation": "source-note",
          "source": {
            "page": 16,
            "section": "Impressum"
          },
          "confidence": "verified",
          "explanation": "EIT.swiss, 1. Auflage ©2025. Druckhinweis nennt Änderungen und mögliche Fehler. Das Ausgabedatum allein bestätigt nicht jeden in der Sammlung zitierten Normstand.",
          "conditions": [],
          "audit": {
            "sourceReadability": "clear",
            "mathematicalReview": "not-applicable",
            "normativeValidation": "not-performed"
          }
        }
      ],
      "group": "formulas"
    }
  ],
  "findings": [
    {
      "id": "issue-rcd-type-a",
      "page": 7,
      "severity": "technical-error",
      "message": "Typ-A-Text nennt reine Gleichströme; glatte Gleichfehlerströme sind nicht pauschal abgedeckt. Korrigierter Text im Eintrag."
    },
    {
      "id": "issue-diazed-65",
      "page": 7,
      "severity": "likely-source-typo",
      "message": "65 A kupfer weicht vom üblichen 63-A-Wert ab; Quelle vor Verwendung verifizieren."
    },
    {
      "id": "issue-meter-power",
      "page": 16,
      "severity": "unit-ambiguity",
      "message": "3600n/(c t_s) mit c pro kWh ergibt kW, nicht W."
    },
    {
      "id": "issue-capacitance-units",
      "page": 16,
      "severity": "unit-ambiguity",
      "message": "10^6 in Xc verlangt C in µF; F-Formel ohne diesen Faktor."
    },
    {
      "id": "issue-efficiency-power",
      "page": 16,
      "severity": "quantity-ambiguity",
      "message": "P mit η ist Nutzleistung, nicht die elektrische Wirkleistung des Anschlusses."
    },
    {
      "id": "issue-tariff",
      "page": 16,
      "severity": "unit-ambiguity",
      "message": "Rp/kWh verlangt P in kW und t in h; Ergebnis Rp, CHF zusätzlich /100."
    },
    {
      "id": "issue-work-unit",
      "page": 16,
      "severity": "unit-error",
      "message": "Arbeit in nm ist als J=N·m zu präzisieren; nm bezeichnet Nanometer."
    },
    {
      "id": "issue-norm-editions",
      "page": 14,
      "severity": "edition-mix",
      "message": "Weitere Kennzeichen referenzieren ausdrücklich NIN2015 B+E; p6/p7 nennen 2025. Impressum2025 bedeutet keinen universellen aktuellen Normabgleich."
    }
  ]
};
