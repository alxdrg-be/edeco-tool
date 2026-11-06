import assert from "node:assert/strict";
import { test } from "node:test";
import { quantityCsv, quantityFileName, quantityMatches, type QuantitySource } from "./quantityList.ts";

const rj45: QuantitySource = {
  key: "rj45",
  category: "Kommunikation",
  title: "Datendose RJ45",
  names: ["RJ45 Dose"],
  code: "D.RJ45",
  dataset: "V2 (2025)",
  assignment: "erkannt",
  counts: { "1": 4, "2": 7 },
  total: 11,
};

const unknown: QuantitySource = {
  key: "unknown-rj45",
  category: "Unbekannt",
  title: "RJ45_Sonder",
  names: [],
  code: "",
  dataset: "",
  assignment: "unbekannt",
  counts: { "2": 3 },
  total: 3,
};

test("search finds an apparatus by name, plan text or code", () => {
  assert.equal(quantityMatches(rj45, " rj45 "), true);
  assert.equal(quantityMatches(rj45, "D.RJ45"), true);
  assert.equal(quantityMatches(rj45, "Steckdose"), false);
  assert.equal(quantityMatches(unknown, ""), true);
});

test("csv has one column per floor and keeps an unassigned apparatus", () => {
  const csv = quantityCsv(
    [{ id: 1, name: "EG" }, { id: 2, name: "OG;1" }, { id: 3, name: "EG" }],
    [rj45, unknown],
  );
  assert.ok(csv.startsWith("\uFEFF"));
  const lines = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
  assert.equal(lines[0], "Kategorie;Symbol;Bezeichnung im Plan;Code;Datensatz;Zuordnung;EG;\"OG;1\";EG (2);Total");
  assert.equal(lines[1], "Kommunikation;Datendose RJ45;RJ45 Dose;D.RJ45;V2 (2025);erkannt;4;7;0;11");
  assert.equal(lines[2], "Unbekannt;RJ45_Sonder;;;;unbekannt;0;3;0;3");
});

test("a symbol name is not written as an Excel formula", () => {
  const csv = quantityCsv([{ id: 1, name: "EG" }], [{
    ...rj45, title: "=HYPERLINK()", names: [], counts: { "1": 1 }, total: 1,
  }]);
  assert.match(csv, /'=HYPERLINK\(\)/);
  assert.equal(quantityFileName('  Haus "A"  '), "Haus A-Mengen.csv");
  assert.equal(quantityFileName("   "), "Projekt-Mengen.csv");
});
