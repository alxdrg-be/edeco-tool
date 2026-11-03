/** Small PDF image-page writer; all dimensions are in PostScript points. */
export const A4 = { width: 595.276, height: 841.89 } as const;
export interface PDFPageImage { bytes: Uint8Array; width: number; height: number }
const bytes = (value: string) => new TextEncoder().encode(value);

export function calculationFilename(title: string, values: readonly string[], explicit?: string): string {
  const raw = explicit || [title, ...values.slice(0, 2)].filter(Boolean).join("_");
  const clean = raw.normalize("NFC").replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ").replace(/\.pdf$/i, "").replace(/^[ .]+|[ .]+$/g, "").slice(0, 190).replace(/[ .]+$/g, "");
  return `${clean || "Berechnung"}.pdf`;
}

/** Wrap every code point, including words too long for a line; never truncate. */
export function wrapReportText(value: string, maxWidth: number, measure: (line: string) => number): string[] {
  if (!(maxWidth > 0)) throw new Error("PDF-Textbreite ist ungültig.");
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (line && measure(`${line} ${word}`) <= maxWidth) { line += ` ${word}`; continue; }
      if (line) { lines.push(line); line = ""; }
      for (const character of Array.from(word)) {
        if (line && measure(line + character) > maxWidth) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function utf16Hex(value: string) {
  let out = "FEFF";
  for (let index = 0; index < value.length; index++) out += value.charCodeAt(index).toString(16).padStart(4, "0");
  return out;
}

export function imagePagesPDF(pages: readonly PDFPageImage[], title: string): Uint8Array {
  if (!pages.length || pages.length > 200) throw new Error("PDF benötigt zwischen 1 und 200 Seiten.");
  const chunks: Uint8Array[] = [], offsets = [0];
  let length = 0;
  const append = (chunk: Uint8Array | string) => { const next = typeof chunk === "string" ? bytes(chunk) : chunk; chunks.push(next); length += next.length; };
  const object = (id: number, body: string) => { offsets[id] = length; append(`${id} 0 obj\n${body}\nendobj\n`); };
  append("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${4 + index * 3} 0 R`).join(" ")}] >>`);
  pages.forEach((page, index) => {
    if (!Number.isInteger(page.width) || !Number.isInteger(page.height) || page.width <= 0 || page.height <= 0 || page.bytes.length < 4 || page.bytes[0] !== 0xff || page.bytes[1] !== 0xd8) throw new Error("Ungültiges PDF-Seitenbild.");
    const imageId = 3 + index * 3, pageId = imageId + 1, contentId = imageId + 2;
    offsets[imageId] = length;
    append(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`);
    append(page.bytes); append("\nendstream\nendobj\n");
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    const content = `q\n${A4.width} 0 0 ${A4.height} 0 0 cm\n/Im0 Do\nQ\n`;
    object(contentId, `<< /Length ${bytes(content).length} >>\nstream\n${content}endstream`);
  });
  const infoId = 3 + pages.length * 3;
  object(infoId, `<< /Title <${utf16Hex(title)}> /Producer (edeco ag) >>`);
  const xref = length;
  append(`xref\n0 ${infoId + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= infoId; id++) append(`${offsets[id].toString().padStart(10, "0")} 00000 n \n`);
  append(`trailer\n<< /Size ${infoId + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const output = new Uint8Array(length);
  let cursor = 0;
  for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
  return output;
}
