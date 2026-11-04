// Catalog verified against Stirling-PDF Core v3.2.2, useTranslatedToolRegistry.tsx.
// All 57 PDF tools are kept; the four developer documentation links are separate.
import { NATIVE_PAGE_TOOLS } from "./nativeTools.ts";
export const PDF_CATALOG_VERSION = "3.2.2";
export const PDF_CATEGORIES = [
  { id: "all", title: "Alle" }, { id: "pages", title: "Seiten" },
  { id: "edit", title: "Bearbeiten" }, { id: "convert", title: "Umwandeln" },
  { id: "security", title: "Schützen & Signieren" }, { id: "review", title: "Prüfen" },
  { id: "advanced", title: "Weitere" },
] as const;
export type PdfCategory = Exclude<typeof PDF_CATEGORIES[number]["id"], "all">;
export interface PdfTool {
  id: string; title: string; description: string; category: PdfCategory; icon: string;
  endpoints: string[]; unavailable?: string; offlineUnavailable?: string; offlineNote?: string;
}
export interface EndpointCapability { enabled: boolean; reason?: string | null }
export type EndpointCapabilities = Record<string, EndpointCapability>;
export interface ToolAvailability { enabled: boolean; checking: boolean; reason: string; partial: boolean }

export const PDF_TOOLS: readonly PdfTool[] = [
  {
    "id": "multiTool",
    "title": "Seiten organisieren",
    "description": "Seiten übersichtlich sortieren, drehen und bearbeiten.",
    "category": "edit",
    "icon": "LayoutGrid",
    "endpoints": [
      "multi-tool"
    ]
  },
  {
    "id": "merge",
    "title": "PDF zusammenfügen",
    "description": "Mehrere Dokumente zu einer Datei verbinden.",
    "category": "edit",
    "icon": "CopyPlus",
    "endpoints": [
      "merge-pdfs"
    ]
  },
  {
    "id": "split",
    "title": "PDF teilen",
    "description": "Seiten und Abschnitte als eigene Dokumente speichern.",
    "category": "pages",
    "icon": "Scissors",
    "endpoints": [
      "split-pages",
      "split-pdf-by-sections",
      "split-by-size-or-count",
      "split-pdf-by-chapters",
      "auto-split-pdf",
      "split-for-poster-print"
    ]
  },
  {
    "id": "compress",
    "title": "PDF verkleinern",
    "description": "Dateigrösse und Qualität passend einstellen.",
    "category": "edit",
    "icon": "Minimize",
    "endpoints": [
      "compress-pdf"
    ]
  },
  {
    "id": "pdfTextEditor",
    "title": "PDF bearbeiten",
    "description": "Text und Bilder im Dokument bearbeiten.",
    "category": "edit",
    "icon": "FilePenLine",
    "endpoints": [
      "text-editor-pdf"
    ]
  },
  {
    "id": "crop",
    "title": "PDF zuschneiden",
    "description": "Direkt auf der grossen Seite auswählen und zoomen.",
    "category": "pages",
    "icon": "Crop",
    "endpoints": [
      "crop"
    ]
  },
  {
    "id": "rotate",
    "title": "Seiten drehen",
    "description": "Seiten um 90°, 180° oder 270° drehen.",
    "category": "pages",
    "icon": "RotateCw",
    "endpoints": [
      "rotate-pdf"
    ]
  },
  {
    "id": "removePages",
    "title": "Seiten löschen",
    "description": "Ausgewählte Seiten aus dem Dokument entfernen.",
    "category": "pages",
    "icon": "FileMinus",
    "endpoints": [
      "remove-pages"
    ]
  },
  {
    "id": "extractPages",
    "title": "Seiten extrahieren",
    "description": "Gewählte Seiten als eigene PDF speichern.",
    "category": "pages",
    "icon": "FileMinus",
    "endpoints": [
      "rearrange-pages"
    ]
  },
  {
    "id": "convert",
    "title": "PDF umwandeln",
    "description": "PDFs, Bilder und weitere Formate umwandeln.",
    "category": "convert",
    "icon": "ArrowLeftRight",
    "endpoints": [
      "pdf-to-img",
      "img-to-pdf",
      "pdf-to-word",
      "pdf-to-presentation",
      "pdf-to-text",
      "pdf-to-html",
      "pdf-to-xml",
      "html-to-pdf",
      "markdown-to-pdf",
      "file-to-pdf",
      "pdf-to-csv",
      "pdf-to-xlsx",
      "pdf-to-markdown",
      "pdf-to-pdfa",
      "eml-to-pdf",
      "pdf-to-epub"
    ],
    "offlineNote": "Lokal sind Bild- und Textwege enthalten. Office-, Webseiten-, E-Book-, Video- und KI-Konvertierung werden nicht mitgeliefert."
  },
  {
    "id": "ocr",
    "title": "Texterkennung (OCR)",
    "description": "Scans erkennen und durchsuchbar machen.",
    "category": "convert",
    "icon": "ScanText",
    "endpoints": [
      "ocr-pdf"
    ],
    "offlineNote": "Lokal erfolgt die Texterkennung mit Tesseract; erweiterte OCRmyPDF-Optionen sind nicht enthalten."
  },
  {
    "id": "sign",
    "title": "Signieren",
    "description": "Fügt PDF-Signaturen durch Zeichnung, Text oder Bild hinzu",
    "category": "security",
    "icon": "Signature",
    "endpoints": [
      "sign"
    ]
  },
  {
    "id": "annotate",
    "title": "Kommentieren",
    "description": "Im PDF markieren, zeichnen und Notizen ergänzen.",
    "category": "edit",
    "icon": "MessageSquare",
    "endpoints": [
      "view-pdf"
    ]
  },
  {
    "id": "redact",
    "title": "PDF schwärzen",
    "description": "Gewählte Inhalte dauerhaft aus der Ausgabe entfernen.",
    "category": "edit",
    "icon": "Square",
    "endpoints": [
      "auto-redact"
    ]
  },
  {
    "id": "scalePages",
    "title": "Seitengrösse ändern",
    "description": "Papierformat und Inhaltsmassstab anpassen.",
    "category": "pages",
    "icon": "Maximize",
    "endpoints": [
      "scale-pages"
    ]
  },
  {
    "id": "reorganizePages",
    "title": "Seiten neu anordnen",
    "description": "PDF-Seiten mit visueller Drag-and-Drop-Steuerung neu anordnen, duplizieren oder löschen.",
    "category": "pages",
    "icon": "ListOrdered",
    "endpoints": [
      "rearrange-pages"
    ]
  },
  {
    "id": "read",
    "title": "PDF ansehen",
    "description": "Dokument gross öffnen und darin navigieren.",
    "category": "review",
    "icon": "BookOpen",
    "endpoints": [
      "view-pdf"
    ]
  },
  {
    "id": "addPassword",
    "title": "Passwort hinzufügen",
    "description": "PDF-Dateien mit Passwortschutz und Einschränkungen versehen",
    "category": "security",
    "icon": "LockKeyhole",
    "endpoints": [
      "add-password"
    ]
  },
  {
    "id": "removePassword",
    "title": "Passwort entfernen",
    "description": "Den Passwortschutz eines PDFs entfernen",
    "category": "security",
    "icon": "LockOpen",
    "endpoints": [
      "remove-password"
    ]
  },
  {
    "id": "watermark",
    "title": "Wasserzeichen hinzufügen",
    "description": "Fügen Sie ein eigenes Wasserzeichen zu Ihrem PDF hinzu",
    "category": "security",
    "icon": "Droplets",
    "endpoints": [
      "add-watermark"
    ]
  },
  {
    "id": "addPageNumbers",
    "title": "Seitenzahlen hinzufügen",
    "description": "Hinzufügen von Seitenzahlen an einer bestimmten Stelle",
    "category": "pages",
    "icon": "ListOrdered",
    "endpoints": [
      "add-page-numbers"
    ]
  },
  {
    "id": "compare",
    "title": "PDFs vergleichen",
    "description": "Unterschiede zwischen zwei Dokumenten anzeigen.",
    "category": "edit",
    "icon": "ArrowLeftRight",
    "endpoints": [
      "compare"
    ]
  },
  {
    "id": "certSign",
    "title": "Mit Zertifikat signieren",
    "description": "Ein PDF mit einem Zertifikat/Schlüssel (PEM/P12) signieren",
    "category": "security",
    "icon": "Award",
    "endpoints": [
      "cert-sign"
    ]
  },
  {
    "id": "timestampPdf",
    "title": "PDF mit Zeitstempel",
    "description": "Fügen Sie einen RFC 3161-Dokumentzeitstempel hinzu, um nachzuweisen, wann Ihr PDF existiert hat",
    "category": "security",
    "icon": "Clock",
    "endpoints": [
      "timestamp-pdf"
    ],
    "offlineUnavailable": "Ein Dokumentzeitstempel benötigt einen externen Zeitstempeldienst und ist im Offline-Paket deaktiviert."
  },
  {
    "id": "addText",
    "title": "Text hinzufügen",
    "description": "Beliebigen Text überall in Ihrem PDF hinzufügen",
    "category": "edit",
    "icon": "Type",
    "endpoints": [
      "sign"
    ]
  },
  {
    "id": "addImage",
    "title": "Bild einfügen",
    "description": "Fügt ein Bild an eine bestimmte Stelle im PDF ein (in Arbeit)",
    "category": "edit",
    "icon": "ImagePlus",
    "endpoints": [
      "add-image"
    ]
  },
  {
    "id": "addStamp",
    "title": "Stempel zu PDF hinzufügen",
    "description": "Text- oder Bildstempel an festgelegten Positionen hinzufügen",
    "category": "security",
    "icon": "Stamp",
    "endpoints": [
      "add-stamp"
    ]
  },
  {
    "id": "sanitize",
    "title": "Bereinigen",
    "description": "Potentiell schädliche Elemente aus PDF-Dateien entfernen",
    "category": "security",
    "icon": "ShieldCheck",
    "endpoints": [
      "sanitize-pdf"
    ]
  },
  {
    "id": "flatten",
    "title": "Abflachen",
    "description": "Alle interaktiven Elemente und Formulare aus einem PDF entfernen",
    "category": "security",
    "icon": "Layers",
    "endpoints": [
      "flatten"
    ]
  },
  {
    "id": "unlockPDFForms",
    "title": "PDF-Formulare entsperren",
    "description": "Entfernen Sie die schreibgeschützte Eigenschaft von Formularfeldern in einem PDF-Dokument.",
    "category": "security",
    "icon": "LockOpen",
    "endpoints": [
      "unlock-pdf-forms"
    ]
  },
  {
    "id": "formFill",
    "title": "Formular bearbeiten",
    "description": "Formularfelder ausfüllen, erstellen und bearbeiten.",
    "category": "edit",
    "icon": "TextCursorInput",
    "endpoints": [
      "form-fill"
    ]
  },
  {
    "id": "autoFormDetection",
    "title": "Automatische Formularerkennung",
    "description": "Formularfelder automatisch mit AI erkennen und Ihre PDF ausfüllbar machen.",
    "category": "advanced",
    "icon": "ScanLine",
    "endpoints": [
      "form-detection"
    ],
    "offlineUnavailable": "Das Modell für die automatische Formularerkennung wird lokal nicht mitgeliefert."
  },
  {
    "id": "changePermissions",
    "title": "Berechtigungen ändern",
    "description": "Dokumentbeschränkungen und -berechtigungen ändern",
    "category": "security",
    "icon": "Shield",
    "endpoints": [
      "add-password"
    ]
  },
  {
    "id": "getPdfInfo",
    "title": "Alle PDF-Infos",
    "description": "Erfasst alle möglichen Informationen in einer PDF",
    "category": "review",
    "icon": "FileSearch",
    "endpoints": [
      "get-info-on-pdf"
    ]
  },
  {
    "id": "validateSignature",
    "title": "PDF-Signatur überprüfen",
    "description": "Digitale Signaturen und Zertifikate in PDF-Dokumenten überprüfen",
    "category": "review",
    "icon": "BadgeCheck",
    "endpoints": [
      "validate-signature"
    ]
  },
  {
    "id": "changeMetadata",
    "title": "Metadaten ändern",
    "description": "Ändern/Entfernen/Hinzufügen von Metadaten aus einem PDF-Dokument",
    "category": "review",
    "icon": "FileCog",
    "endpoints": [
      "update-metadata"
    ]
  },
  {
    "id": "editTableOfContents",
    "title": "Inhaltsverz. bearbeiten",
    "description": "Hinzufügen oder Bearbeiten von Lesezeichen und Inhaltsverzeichnissen in PDF-Dokumenten",
    "category": "review",
    "icon": "ListTree",
    "endpoints": [
      "edit-table-of-contents"
    ]
  },
  {
    "id": "autoRotate",
    "title": "Automatisch drehen",
    "description": "Erkennt die Ausrichtung jeder Seite und dreht sie automatisch aufrecht.",
    "category": "pages",
    "icon": "RotateCw",
    "endpoints": [
      "auto-rotate-pdf"
    ],
    "offlineUnavailable": "Die automatische Ausrichtung benötigt OCRmyPDF; das lokale Paket enthält Tesseract ohne diese Zusatzfunktion."
  },
  {
    "id": "pageLayout",
    "title": "Mehrseitiges Layout",
    "description": "Mehrere Seiten eines PDF zu einer Seite zusammenführen",
    "category": "pages",
    "icon": "PanelsTopLeft",
    "endpoints": [
      "multi-page-layout"
    ]
  },
  {
    "id": "bookletImposition",
    "title": "Broschürendruck",
    "description": "Broschüren mit korrekter Seitenreihenfolge und mehrseitigem Layout für Druck und Bindung erstellen",
    "category": "pages",
    "icon": "BookOpen",
    "endpoints": [
      "booklet-imposition"
    ]
  },
  {
    "id": "pdfToSinglePage",
    "title": "PDF auf eine Seite",
    "description": "Fügt alle PDF-Seiten zu einer einzigen grossen Seite zusammen",
    "category": "pages",
    "icon": "ScrollText",
    "endpoints": [
      "pdf-to-single-page"
    ]
  },
  {
    "id": "addAttachments",
    "title": "Anhänge verwalten",
    "description": "Eingebettete PDF-Anhänge anzeigen, hinzufügen, extrahieren, umbenennen oder löschen",
    "category": "pages",
    "icon": "Paperclip",
    "endpoints": [
      "add-attachments",
      "batch-process-attachments",
      "list-attachments",
      "extract-single-attachment"
    ]
  },
  {
    "id": "createPortfolio",
    "title": "Portfolio erstellen",
    "description": "Mehrere Dateien zu einem Adobe PDF Portfolio bündeln",
    "category": "pages",
    "icon": "FileArchive",
    "endpoints": [
      "create-portfolio"
    ]
  },
  {
    "id": "extractImages",
    "title": "Bilder extrahieren",
    "description": "Extrahiert alle Bilder aus einer PDF-Datei und speichert sie als Zip-Archiv",
    "category": "pages",
    "icon": "Images",
    "endpoints": [
      "extract-images"
    ]
  },
  {
    "id": "removeBlanks",
    "title": "Leere Seiten entfernen",
    "description": "Erkennt und entfernt leere Seiten aus einem Dokument",
    "category": "pages",
    "icon": "Eraser",
    "endpoints": [
      "remove-blanks"
    ]
  },
  {
    "id": "removeAnnotations",
    "title": "Anmerkungen entfernen",
    "description": "Entfernt alle Kommentare/Anmerkungen aus einem PDF",
    "category": "edit",
    "icon": "MessageSquareOff",
    "endpoints": [
      "remove-annotations"
    ]
  },
  {
    "id": "removeImage",
    "title": "Bild entfernen",
    "description": "Bild aus PDF entfernen, um die Dateigrösse zu verringern",
    "category": "edit",
    "icon": "ImageOff",
    "endpoints": [
      "remove-image-pdf"
    ]
  },
  {
    "id": "removeCertSign",
    "title": "Zert.-Signatur entfernen",
    "description": "Zertifikatsignatur aus PDF entfernen",
    "category": "security",
    "icon": "ShieldOff",
    "endpoints": [
      "remove-cert-sign"
    ]
  },
  {
    "id": "automate",
    "title": "Automatisieren",
    "description": "Mehrstufige Arbeitsabläufe durch Verkettung von PDF-Aktionen erstellen. Ideal für wiederkehrende Aufgaben.",
    "category": "advanced",
    "icon": "Workflow",
    "endpoints": [
      "automate"
    ],
    "offlineUnavailable": "Der Automatisierungsdienst ist im lokalen Paket deaktiviert."
  },
  {
    "id": "autoRename",
    "title": "PDF automatisch umbenennen",
    "description": "Benennt eine PDF-Datei automatisch basierend auf der erkannten Überschrift um",
    "category": "advanced",
    "icon": "CaseSensitive",
    "endpoints": [
      "auto-rename"
    ]
  },
  {
    "id": "adjustContrast",
    "title": "Farben/Kontrast anpassen",
    "description": "Farben/Kontrast, Sättigung und Helligkeit einer PDF anpassen",
    "category": "advanced",
    "icon": "Palette",
    "endpoints": [
      "adjust-contrast"
    ]
  },
  {
    "id": "repair",
    "title": "PDF reparieren",
    "description": "Ein beschädigtes PDF aufbereiten.",
    "category": "advanced",
    "icon": "Wrench",
    "endpoints": [
      "repair"
    ]
  },
  {
    "id": "scannerImageSplit",
    "title": "Scanfotos erkennen & teilen",
    "description": "Gescanntes Fotos erkennen und in separate Seiten aufteilen",
    "category": "advanced",
    "icon": "Columns2",
    "endpoints": [
      "extract-image-scans"
    ],
    "offlineUnavailable": "Die Fotoerkennung benötigt OpenCV, das lokal nicht mitgeliefert wird."
  },
  {
    "id": "overlayPdfs",
    "title": "PDFs überlagern",
    "description": "Zwei PDF-Seiten übereinanderlegen.",
    "category": "advanced",
    "icon": "CopyPlus",
    "endpoints": [
      "overlay-pdf"
    ]
  },
  {
    "id": "replaceColor",
    "title": "Farbe ersetzen & invertieren",
    "description": "Farben in PDF-Dokumenten ersetzen oder invertieren",
    "category": "advanced",
    "icon": "Palette",
    "endpoints": [
      "replace-invert-pdf"
    ],
    "offlineUnavailable": "Der Dienst zum Ersetzen und Invertieren von Farben ist im lokalen Paket deaktiviert."
  },
  {
    "id": "showJS",
    "title": "Javascript anzeigen",
    "description": "Alle Javascript Funktionen in einer PDF anzeigen",
    "category": "advanced",
    "icon": "CodeXml",
    "endpoints": [
      "show-javascript"
    ],
    "offlineUnavailable": "Die Entwickler-Endpunkte für eingebettetes JavaScript sind im lokalen Paket deaktiviert."
  },
  {
    "id": "classify",
    "title": "Klassifizieren",
    "description": "Ermitteln, um welche Art von Dokument es sich handelt, und es mit Tags versehen.",
    "category": "advanced",
    "icon": "Sparkles",
    "endpoints": [
      "classify-and-label"
    ],
    "unavailable": "Die Klassifizierung ist in dieser Stirling-Core-Version noch nicht implementiert."
  }
];

/** Operations can expose several endpoints; the runtime decides their availability. */
export function pdfToolAvailability(tool: PdfTool, local: boolean, ready: boolean, capabilities: EndpointCapabilities | null = null): ToolAvailability {
  if (tool.id === "crop") return { enabled: true, checking: false, reason: "Der integrierte Zuschnitt funktioniert ohne Java-Dienst.", partial: false };
  if (tool.id === "sign" || tool.id === "redact") return { enabled: true, checking: false, reason: tool.id === "sign" ? "Die sichtbare Unterschrift wird lokal eingefügt. Zertifikatssignaturen sind ein eigener Ablauf." : "Sicheres Schwärzen erzeugt ein neues Bild-PDF ohne die bisherigen Text- und Objektinhalte.", partial: false };
  if (NATIVE_PAGE_TOOLS.has(tool.id) || tool.id === "split" || tool.id === "scalePages") return { enabled: true, checking: false, reason: "Das integrierte Seitenwerkzeug funktioniert ohne Java-Dienst.", partial: false };
  if (tool.id === "convert") return { enabled: true, checking: false, reason: "PNG, Text und Bilder in PDF funktionieren ohne Java-Dienst. Weitere Formate hängen vom PDF-Dienst ab.", partial: true };
  if (tool.unavailable) return { enabled: false, checking: false, reason: tool.unavailable, partial: false };
  if (local && tool.offlineUnavailable) return { enabled: false, checking: false, reason: tool.offlineUnavailable, partial: false };
  if (!ready) return { enabled: false, checking: true, reason: "Der PDF-Dienst ist noch nicht bereit.", partial: false };
  const values = tool.endpoints.map(endpoint => capabilities?.[endpoint]).filter((entry): entry is EndpointCapability => Boolean(entry));
  const active = values.filter(entry => entry.enabled);
  if (values.length && !active.length) return { enabled: false, checking: false, reason: values.find(entry => entry.reason)?.reason || "Diese Funktion ist in eurem PDF-Dienst deaktiviert.", partial: false };
  const partial = active.length > 0 && active.length < values.length || local && tool.id === "convert";
  const reason = local && tool.offlineNote ? tool.offlineNote : partial ? "Einige Teilfunktionen sind in eurem Dienst deaktiviert." : values.length ? "" : "Die Verfügbarkeit wird beim Öffnen im PDF-Dienst geprüft.";
  return { enabled: true, checking: false, reason, partial };
}

export function filterPdfTools(query: string, category: string, recent: readonly string[] = []): PdfTool[] {
  const normalise = (value: string) => value.toLocaleLowerCase("de-CH").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const terms = normalise(query.trim()).split(/\s+/).filter(Boolean);
  const source = category === "recent" ? [...new Set(recent)].flatMap(id => PDF_TOOLS.filter(tool => tool.id === id)) : PDF_TOOLS;
  return source.filter(tool => (category === "all" || category === "recent" || tool.category === category) && terms.every(term => normalise(`${tool.title} ${tool.description} ${tool.id}`).includes(term)));
}

export function recordRecentPdfTool(previous: readonly string[], id: string): string[] {
  if (!PDF_TOOLS.some(tool => tool.id === id)) return [...previous];
  return [id, ...new Set(previous.filter(value => value !== id && PDF_TOOLS.some(tool => tool.id === value)))].slice(0, 8);
}
