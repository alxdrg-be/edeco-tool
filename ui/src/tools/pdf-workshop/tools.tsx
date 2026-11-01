import type { ReactNode } from "react";

export interface PdfTool { id: string; title: string; description: string; group: string }
export const PDF_TOOLS: PdfTool[] = [
  { id: "organize", title: "PDFs organisieren", description: "Seiten überblicken, sortieren, drehen und zwischen Dokumenten verschieben.", group: "Seiten & Dokumente" },
  { id: "merge", title: "PDF zusammenfügen", description: "Mehrere PDFs oder ausgewählte Seiten als neues Dokument speichern.", group: "Seiten & Dokumente" },
  { id: "split", title: "PDF trennen", description: "Einzelne Seiten oder Abschnitte als separate PDF-Dateien ausgeben.", group: "Seiten & Dokumente" },
  { id: "rotate", title: "Seiten drehen", description: "Alle Seiten eines PDFs um 90°, 180° oder 270° drehen.", group: "Seiten & Dokumente" },
  { id: "crop", title: "PDF zuschneiden", description: "Bereich auf der Vorschau markieren und das PDF passend zuschneiden.", group: "Seiten & Dokumente" },
  { id: "resize", title: "Seitengrösse ändern", description: "Papierformat und Ausrichtung ändern oder den Seiteninhalt skalieren.", group: "Seiten & Dokumente" },
  { id: "compress", title: "PDF komprimieren", description: "Die Dateigrösse mit einer wählbaren Kompressionsstufe reduzieren.", group: "Optimieren" },
  { id: "images-to-pdf", title: "Bilder in PDF", description: "PNG- und JPEG-Bilder in deiner Reihenfolge zu einem PDF verbinden.", group: "Konvertieren" },
  { id: "pdf-to-images", title: "PDF in Bilder", description: "PDF-Seiten als PNG-Bilder mit 72, 144 oder 300 DPI ausgeben.", group: "Konvertieren" },
  { id: "pdf-to-text", title: "Text extrahieren", description: "Die vorhandene Textschicht aus einem PDF als TXT-Datei speichern.", group: "Konvertieren" },
  { id: "ocr", title: "Texterkennung (OCR)", description: "Scans auf Deutsch und Englisch erkennen und durchsuchbar machen.", group: "Texterkennung" },
];

export function PdfToolIcon({ id }: { id: string }) {
  const paths: Record<string, ReactNode> = {
    organize: <><rect x="3" y="3" width="7" height="8" rx="1" /><rect x="14" y="3" width="7" height="8" rx="1" /><rect x="3" y="15" width="7" height="6" rx="1" /><path d="M14 16h7m-7 4h7" /></>,
    merge: <><path d="M3 3h6v7H3zm12 0h6v7h-6zM6 10v4h12v-4m-6 4v7m-3-3 3 3 3-3" /></>,
    split: <><circle cx="5" cy="6" r="3" /><circle cx="5" cy="18" r="3" /><path d="m8 8 13 13M8 16l13-13m-8 9h.01" /></>,
    rotate: <><path d="M20 9a8 8 0 1 0 0 7M20 3v6h-6" /><rect x="8" y="8" width="6" height="9" rx="1" /></>,
    crop: <><path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14M9 9h6v6" /></>,
    resize: <><path d="M3 9V3h6m6 0h6v6m0 6v6h-6M9 21H3v-6" /><rect x="8" y="8" width="8" height="8" rx="1" /></>,
    compress: <><path d="m3 3 6 6M3 9h6V3m12 18-6-6m6 0h-6v6M3 21l6-6H3m6 6v-6M21 3l-6 6h6m-6-6v6" /></>,
    "images-to-pdf": <><rect x="2" y="4" width="12" height="14" rx="1" /><circle cx="6" cy="8" r="1" /><path d="m3 15 4-4 4 5m5-8h5m-2-2 2 2-2 2M15 14h6v7h-6z" /></>,
    "pdf-to-images": <><path d="M3 3h10v12H3zm12 4h6m-2-2 2 2-2 2" /><rect x="10" y="13" width="12" height="8" rx="1" /><path d="m11 20 4-4 3 3 2-2 2 3" /></>,
    "pdf-to-text": <><path d="M5 2h10l4 4v16H5zm10 0v5h4M8 11h8m-8 4h8m-8 4h5" /></>,
    ocr: <><path d="M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5M7 8h10m-5 0v9m-3 0h6" /></>,
  };
  return <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[id] || paths.organize}</svg>;
}
