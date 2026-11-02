import logoSVG from "../../assets/edeco-logo.svg?raw";
import { A4, calculationFilename, imagePagesPDF, wrapReportText, type PDFPageImage } from "./pdfDocument.ts";

export interface CalculationPDF {
  title: string;
  norm: string;
  inputs: { label: string; value: string | number }[];
  results: { label: string; value: string | number }[];
  formula: string;
  status: string;
  notes?: string[];
  filename?: string;
}
export type CalculationPDFReport = CalculationPDF;

const MARGIN = 42, RIGHT = A4.width - MARGIN, WIDTH = A4.width - 2 * MARGIN;
const BOTTOM = A4.height - 49, SCALE = 2;
const FONT = 'Arial, "Segoe UI", sans-serif';
const MONO = '"Consolas", "DejaVu Sans Mono", monospace';
type Page = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; y: number };

async function loadLogo(): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([logoSVG.replace("fill: currentColor", "fill: #14212b")], { type: "image/svg+xml" }));
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Das edeco-Logo konnte für den PDF-Export nicht geladen werden."));
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

function printable(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("PDF enthält kein gültiges Rechenergebnis.");
    return value.toLocaleString("de-CH", { maximumFractionDigits: 6 });
  }
  return value;
}

function textLines(context: CanvasRenderingContext2D, text: string, width = WIDTH) {
  return wrapReportText(text, width, line => context.measureText(line).width);
}

/** Builds a real A4 PDF, independent of the print dialog and the current theme. */
export async function buildCalculationPDF(report: CalculationPDF): Promise<Blob> {
  if (![report.title, report.norm, report.formula, report.status].every(value => value.trim()) || !report.results.length) throw new Error("Für den PDF-Export fehlen gültige Berechnungsdaten.");
  for (const row of [...report.inputs, ...report.results]) printable(row.value);
  await document.fonts.ready;
  const logo = await loadLogo(), pages: Page[] = [];
  const date = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Zurich" }).format(new Date());
  function newPage(): Page {
    if (pages.length >= 200) throw new Error("Der Bericht überschreitet 200 Seiten. Eingaben und Notizen kürzen.");
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(A4.width * SCALE); canvas.height = Math.ceil(A4.height * SCALE);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PDF-Zeichenfläche konnte nicht erstellt werden.");
    context.scale(SCALE, SCALE); context.fillStyle = "#ffffff"; context.fillRect(0, 0, A4.width, A4.height);
    context.textBaseline = "alphabetic";
    context.drawImage(logo, MARGIN, 25, 75, 75 * 107.88 / 251.26);
    context.font = `bold 12px ${FONT}`; context.fillStyle = "#14212b";
    context.fillText("edeco ag · Berechnungen", MARGIN + 92, 44);
    context.font = `10px ${FONT}`; context.textAlign = "right"; context.fillText(date, RIGHT, 44); context.textAlign = "left";
    context.strokeStyle = "#cad3d9"; context.beginPath(); context.moveTo(MARGIN, 71); context.lineTo(RIGHT, 71); context.stroke();
    let y = 103;
    context.font = `bold 19px ${FONT}`;
    for (const line of textLines(context, report.title)) { context.fillText(line, MARGIN, y); y += 24; }
    context.font = `10px ${FONT}`; context.fillStyle = "#46545f";
    for (const line of textLines(context, report.norm)) { context.fillText(line, MARGIN, y); y += 15; }
    y += 21;
    if (y > BOTTOM - 75) throw new Error("Rechnername oder Normzeile sind für die PDF-Kopfzeile zu lang.");
    const page = { canvas, context, y }; pages.push(page); return page;
  }
  let current = newPage();
  const ensure = (height: number) => { if (current.y + height > BOTTOM) current = newPage(); };
  const heading = (label: string) => {
    ensure(70); current.y += 7;
    current.context.font = `bold 11px ${FONT}`; current.context.fillStyle = "#017c92";
    current.context.fillText(label, MARGIN, current.y); current.y += 19;
  };
  const rows = (entries: CalculationPDF["inputs"]) => {
    for (const row of entries) {
      current.context.font = `10px ${FONT}`;
      const labels = textLines(current.context, row.label, 250);
      current.context.font = `10px ${MONO}`;
      const values = textLines(current.context, printable(row.value), WIDTH - 269);
      const count = Math.max(labels.length, values.length);
      ensure(Math.min(42, count * 15 + 7));
      for (let line = 0; line < count; line++) {
        ensure(15);
        current.context.font = `10px ${FONT}`; current.context.fillStyle = "#46545f";
        if (labels[line]) current.context.fillText(labels[line], MARGIN, current.y);
        current.context.font = `10px ${MONO}`; current.context.fillStyle = "#14212b";
        if (values[line]) current.context.fillText(values[line], MARGIN + 269, current.y);
        current.y += 15;
      }
      current.y += 7;
    }
  };
  const paragraph = (text: string, mono = false) => {
    current.context.font = `${mono ? 10 : 10.5}px ${mono ? MONO : FONT}`;
    const lines = textLines(current.context, text);
    for (const line of lines) {
      ensure(16); current.context.font = `${mono ? 10 : 10.5}px ${mono ? MONO : FONT}`; current.context.fillStyle = "#14212b";
      current.context.fillText(line, MARGIN, current.y); current.y += 16;
    }
    current.y += 7;
  };
  heading("Eingaben"); rows(report.inputs);
  heading("Ergebnisse"); rows(report.results);
  heading("Formel mit eingesetzten Zahlen"); paragraph(report.formula, true);
  heading("Prüfvermerk"); paragraph(report.status);
  if (report.notes?.length) { heading("Grundlagen und Annahmen"); for (const note of report.notes) paragraph(note); }
  const images: PDFPageImage[] = [];
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    page.context.font = `8px ${FONT}`; page.context.fillStyle = "#64727e";
    page.context.fillText(report.title, MARGIN, A4.height - 25, WIDTH - 100);
    page.context.textAlign = "right"; page.context.fillText(`Seite ${index + 1} / ${pages.length}`, RIGHT, A4.height - 25);
    const image = await new Promise<Blob>((resolve, reject) => page.canvas.toBlob(value => value ? resolve(value) : reject(new Error("PDF-Seite konnte nicht gespeichert werden.")), "image/jpeg", .95));
    images.push({ bytes: new Uint8Array(await image.arrayBuffer()), width: page.canvas.width, height: page.canvas.height });
    page.canvas.width = page.canvas.height = 0;
  }
  const output = imagePagesPDF(images, report.title);
  return new Blob([output.buffer as ArrayBuffer], { type: "application/pdf" });
}

export async function exportCalculationPDF(report: CalculationPDF): Promise<void> {
  const pdf = await buildCalculationPDF(report), url = URL.createObjectURL(pdf);
  const link = document.createElement("a");
  link.href = url; link.download = calculationFilename(report.title, report.inputs.map(row => printable(row.value)), report.filename);
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
