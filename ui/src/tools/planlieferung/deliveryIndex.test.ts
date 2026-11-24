import assert from "node:assert/strict";
import test from "node:test";
import { compareDeliveryIndex, filenameIndex } from "./deliveryIndex.ts";

test("delivery reads labelled and standard file indices without assuming a universal revision", () => {
  assert.equal(filenameIndex("Grundriss OG1 Index B.pdf"), "B");
  assert.equal(filenameIndex("1498_E-G-APP-OG02-C-50.pdf"), "C");
  assert.equal(filenameIndex("Grundriss 2og.pdf"), "");
  assert.equal(filenameIndex("E_Schema_HV_2026.pdf"), "");
  assert.equal(compareDeliveryIndex("B", "B"), "Stimmt überein");
  assert.equal(compareDeliveryIndex("C", "B"), "Index weicht ab");
  assert.equal(compareDeliveryIndex("", "B"), "Ohne Sollwert");
  assert.equal(compareDeliveryIndex("B", ""), "Datei-Index fehlt");
  assert.equal(compareDeliveryIndex("", ""), "Datei-Index fehlt");
});
