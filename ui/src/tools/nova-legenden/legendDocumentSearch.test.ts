import { test } from "node:test";
import assert from "node:assert/strict";
import type { LegendDoc, LegendItem } from "./legend.ts";
import { findLegendEntries } from "./legendDocumentSearch.ts";

const item = (id: string, text: string, extra: Partial<LegendItem> = {}) => ({ id, text, kind: "symbol", hidden: false, ...extra }) as LegendItem;
const doc = {
  title: { text: "Legende EG" },
  blocks: [{ id: "licht", title: "Licht und Schalter", items: [
    item("schalter", "Schalter Schema 3"),
    item("kombiniert", "Deckendose", { parts: [{ text: "Wanddose" }] as LegendItem["parts"] }),
    item("verdeckt", "Schalter Schema 3 AP", { hidden: true }),
    item("leer", "Schalter", { kind: "gap" }),
  ] }],
} as LegendDoc;

test("document search finds combined variants and returns the original editable entry", () => {
  const found = findLegendEntries(doc, "wanddose LICHT");
  assert.equal(found.length, 1);
  assert.equal(found[0].label, "Deckendose / Wanddose");
  assert.deepEqual(found[0].selection, { type: "item", block: "licht", item: "kombiniert" });
});

test("hidden source entries and empty layout cells are not presented as visible output", () => {
  assert.deepEqual(findLegendEntries(doc, "schema 3").map(match => match.id), ["item:schalter"]);
  assert.deepEqual(findLegendEntries(doc, " "), []);
});

test("search respects the rendered floor selection", () => {
  assert.deepEqual(findLegendEntries(doc, "Schalter", [], new Set(["kombiniert"])).map(match => match.id), ["item:kombiniert"]);
  assert.deepEqual(findLegendEntries(doc, "Schema 3", [], new Set(["kombiniert"])), []);
});

test("general part search follows the current legend toggle without changing the document", () => {
  const before = JSON.stringify(doc);
  const rows = [{ id: "leitung", text: "UP-Deckenleitung" }];
  assert.deepEqual(findLegendEntries(doc, "deckenleitung", rows)[0].selection, { type: "general-row", id: "leitung" });
  assert.deepEqual(findLegendEntries({ ...doc, general_on: false }, "deckenleitung", rows), []);
  assert.deepEqual(findLegendEntries(doc, "legende eg")[0].selection, { type: "title" });
  assert.equal(JSON.stringify(doc), before);
});
