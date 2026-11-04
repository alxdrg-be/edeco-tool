import test from "node:test";
import assert from "node:assert/strict";
import { PDF_CATALOG_VERSION, PDF_TOOLS, filterPdfTools, pdfToolAvailability, recordRecentPdfTool } from "./toolCatalog.ts";

const tool = (id: string) => {
  const found = PDF_TOOLS.find(item => item.id === id);
  assert.ok(found, `Missing catalog tool ${id}`);
  return found;
};

test("catalog covers the 57 Core operations, excluding the four developer links", () => {
  // IDs from the published Core v3.2.2 tool registry, not the PDF24 catalog.
  const expected = "pdfTextEditor multiTool merge certSign timestampPdf sign addText addImage annotate addPassword watermark addStamp sanitize flatten unlockPDFForms formFill autoFormDetection changePermissions getPdfInfo validateSignature read changeMetadata editTableOfContents crop rotate autoRotate split reorganizePages scalePages addPageNumbers pageLayout bookletImposition pdfToSinglePage addAttachments createPortfolio extractPages extractImages removePages removeBlanks removeAnnotations removeImage removePassword removeCertSign automate autoRename adjustContrast repair scannerImageSplit overlayPdfs replaceColor showJS compare classify compress convert ocr redact".split(" ");
  assert.equal(PDF_CATALOG_VERSION, "3.2.2");
  assert.equal(PDF_TOOLS.length, expected.length);
  assert.deepEqual(new Set(PDF_TOOLS.map(item => item.id)), new Set(expected));
  for (const item of PDF_TOOLS) {
    assert.ok(item.title && item.description && item.icon && item.endpoints.length);
    assert.ok(!item.id.startsWith("dev"));
  }
  assert.ok(PDF_TOOLS.slice(0, 8).some(item => item.id === "crop"));
  assert.ok(PDF_TOOLS.slice(0, 8).some(item => item.id === "merge"));
});

test("local exclusions are visible and cannot be enabled by a misleading endpoint map", () => {
  const unavailable = PDF_TOOLS.filter(item => !pdfToolAvailability(item, true, true).enabled).map(item => item.id).sort();
  assert.deepEqual(unavailable, ["classify", "timestampPdf", "autoFormDetection", "autoRotate", "automate", "scannerImageSplit", "replaceColor", "showJS"].sort());
  assert.equal(PDF_TOOLS.filter(item => pdfToolAvailability(item, true, true).enabled).length, 49);
  assert.equal(pdfToolAvailability(tool("classify"), false, true, { "classify-and-label": { enabled: true } }).enabled, false);
  assert.match(pdfToolAvailability(tool("autoRotate"), true, true).reason, /OCRmyPDF/);
  assert.equal(pdfToolAvailability(tool("autoRotate"), false, true, { "auto-rotate-pdf": { enabled: true } }).enabled, true);
});

test("real endpoint capability reports restrict operations and identify partial tools", () => {
  assert.equal(pdfToolAvailability(tool("ocr"), false, true, { "ocr-pdf": { enabled: false, reason: "Durch die Firma deaktiviert" } }).enabled, false);
  assert.match(pdfToolAvailability(tool("ocr"), false, true, { "ocr-pdf": { enabled: false, reason: "Durch die Firma deaktiviert" } }).reason, /Firma/);
  const partial = pdfToolAvailability(tool("convert"), false, true, { "img-to-pdf": { enabled: true }, "pdf-to-word": { enabled: false } });
  assert.equal(partial.enabled, true);
  assert.equal(partial.partial, true);
  assert.match(pdfToolAvailability(tool("convert"), true, true).reason, /PNG/);
  // Frontend-only components need not appear in the endpoint map. Unknown is not
  // represented as confirmed server support.
  assert.match(pdfToolAvailability(tool("formFill"), false, true, {}).reason, /geprüft/);
});

test("native page and output tools work while Java starts; Core-only tools wait", () => {
  assert.equal(pdfToolAvailability(tool("crop"), true, false).enabled, true);
  for (const id of ["multiTool", "merge", "split", "rotate", "removePages", "extractPages", "reorganizePages", "scalePages", "convert", "sign", "redact"]) {
    assert.equal(pdfToolAvailability(tool(id), true, false).enabled, true);
    assert.equal(pdfToolAvailability(tool(id), true, false).checking, false);
  }
  assert.equal(pdfToolAvailability(tool("compress"), true, false).enabled, false);
  assert.equal(pdfToolAvailability(tool("compress"), true, false).checking, true);
  assert.equal(pdfToolAvailability(tool("classify"), true, false).checking, false);
});

test("search, categories and recents preserve the full catalog without duplicate entries", () => {
  assert.deepEqual(filterPdfTools("zusammenfugen", "all").map(item => item.id), ["merge"]);
  assert.ok(filterPdfTools("", "pages").every(item => item.category === "pages"));
  assert.deepEqual(filterPdfTools("", "recent", ["crop", "merge", "crop", "not-a-tool"]).map(item => item.id), ["crop", "merge"]);
  assert.deepEqual(recordRecentPdfTool(["merge", "crop"], "crop"), ["crop", "merge"]);
  assert.deepEqual(recordRecentPdfTool(["merge", "merge", "crop"], "read"), ["read", "merge", "crop"]);
  assert.deepEqual(recordRecentPdfTool(["merge"], "invalid"), ["merge"]);
  assert.equal(PDF_TOOLS.reduce<string[]>((previous, item) => recordRecentPdfTool(previous, item.id), []).length, 8);
});
