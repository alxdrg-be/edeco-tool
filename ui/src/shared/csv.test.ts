import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, csvRows, quoteCsvCell } from "./csv.ts";

test("lossless exchange quoting keeps leading punctuation and literal apostrophes", () => {
  assert.equal(quoteCsvCell("-Verteilung"), '"-Verteilung"');
  assert.equal(quoteCsvCell("'Beleuchtung"), '"\'Beleuchtung"');
  assert.equal(quoteCsvCell('=Code; "A"'), '"=Code; ""A"""');
});

test("Excel formulas in text remain text after whitespace, BOM and control prefixes", () => {
  for (const value of ["=HYPERLINK()", "+41", "-1", "@SUM(A1)", "  =1", "\uFEFF=1", "\u2003@x", " \t-1", "\tx", "\rtext", "\ntext"]) {
    assert.equal(csvCell(value), `"'${value}"`, JSON.stringify(value));
    assert.ok(csvCell(value, "minimal").includes(`'${value}`), JSON.stringify(value));
  }
  assert.equal(csvCell("1:50"), '"1:50"');
  assert.equal(csvCell("Licht + Steckdosen", "minimal"), "Licht + Steckdosen");
});

test("numeric values stay numeric while a numeric-looking untrusted string is protected", () => {
  assert.equal(csvCell(-12.5, "minimal"), "-12.5");
  assert.equal(csvCell(-12.5), '"-12.5"');
  assert.equal(csvCell("-12.5", "minimal"), "'-12.5");
  assert.equal(csvCell(0, "minimal"), "0");
  assert.equal(csvCell(null), '""');
  assert.equal(csvCell(null, "minimal"), "");
});

test("separators, quotes, multiline labels and Unicode stay inside one CSV cell", () => {
  assert.equal(csvRows([["Büro; Süd", 'Plan "A"', "Decke\nWand", "Grösse Ω"]], { quote: "minimal" }),
    '\uFEFF"Büro; Süd";"Plan ""A""";"Decke\nWand";Grösse Ω');
});

test("exporters can preserve always/minimal quoting, one BOM and terminal CRLF independently", () => {
  assert.equal(csvRows([["Titel", "Anzahl"], ["Licht", 2]]), '\uFEFF"Titel";"Anzahl"\r\n"Licht";"2"');
  assert.equal(csvRows([["Titel", "Anzahl"], ["Licht", 2]], { quote: "minimal", trailingNewline: true }),
    "\uFEFFTitel;Anzahl\r\nLicht;2\r\n");
  const header = csvRows([["Langform", "Kurzform"]], { quote: "minimal", trailingNewline: true });
  assert.equal(header + csvRows([["Gruppe", "Gr."]], { bom: false }), '\uFEFFLangform;Kurzform\r\n"Gruppe";"Gr."');
  assert.equal(header + csvRows([], { bom: false }), "\uFEFFLangform;Kurzform\r\n");
  assert.equal(csvRows([], { trailingNewline: true }), "\uFEFF\r\n");
});
