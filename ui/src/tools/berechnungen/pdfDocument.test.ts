import assert from "node:assert/strict";
import test from "node:test";
import { calculationFilename, imagePagesPDF, wrapReportText, A4 } from "./pdfDocument.ts";

test("PDF filenames preserve umlauts and use the calculator and two input values", () => {
  assert.equal(calculationFilename("Spannungsfall", ["25 m", "2,5 mm²", "16 A"]), "Spannungsfall_25 m_2,5 mm².pdf");
  assert.equal(calculationFilename("Überlast", [], '../a:b\\c?.pdf'), "-a-b-c-.pdf");
  assert.equal(calculationFilename("", []), "Berechnung.pdf");
});

test("PDF word wrapping preserves every character in long formula tokens and explicit paragraphs", () => {
  const text = "ΔU = √3·I·(R·cosφ+X·sinφ)\nZweite Zeile";
  const lines = wrapReportText(text, 12, line => Array.from(line).length);
  assert.ok(lines.every(line => Array.from(line).length <= 12));
  assert.equal(lines.join("").replaceAll(" ", ""), text.replace(/\s/g, ""));
  assert.throws(() => wrapReportText("a", 0, line => line.length));
});

test("PDF writer creates separate A4 pages with byte-correct xref offsets", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = imagePagesPDF([{ bytes: jpeg, width: 1191, height: 1684 }, { bytes: jpeg, width: 1191, height: 1684 }], "Prüfung φ");
  const text = new TextDecoder("latin1").decode(pdf);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 2/);
  assert.equal((text.match(/\/Type \/Page\s/g) ?? []).length, 2);
  assert.ok(text.includes(`/MediaBox [0 0 ${A4.width} ${A4.height}]`));
  const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
  assert.equal(new TextDecoder().decode(pdf.slice(startxref, startxref + 4)), "xref");
  const rows = text.slice(startxref).split("\n").slice(3, 12);
  for (let index = 0; index < rows.length; index++) {
    const offset = Number(rows[index].slice(0, 10));
    assert.ok(new TextDecoder().decode(pdf.slice(offset, offset + 20)).startsWith(`${index + 1} 0 obj\n`));
  }
  assert.throws(() => imagePagesPDF([], "Leer"));
  assert.throws(() => imagePagesPDF([{ bytes: new Uint8Array(8), width: 5, height: 5 }], "Ungültig"));
});
