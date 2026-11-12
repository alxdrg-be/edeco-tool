import assert from "node:assert/strict";
import test from "node:test";
import { isNumberedTitle, memoryListItems } from "./memoryText.ts";

test("semicolon source lists become list items, prose stays prose", () => {
  assert.deepEqual(memoryListItems("Freischalten und allseitig trennen; gegen Wiedereinschalten sichern; Spannungsfreiheit prüfen; erden und kurzschliessen; benachbarte unter Spannung stehende Teile schützen."),
    ["Freischalten und allseitig trennen", "Gegen Wiedereinschalten sichern", "Spannungsfreiheit prüfen", "Erden und kurzschliessen", "Benachbarte unter Spannung stehende Teile schützen"]);
  assert.equal(memoryListItems("Ein Satz. Noch ein Satz; und ein Rest."), null);
  assert.equal(memoryListItems("A; B"), null);
});

test("counted titles get numbered lists", () => {
  assert.equal(isNumberedTitle("Fünf Sicherheitsregeln"), true);
  assert.equal(isNumberedTitle("5+5 Sicherheitsregeln und PSA"), true);
  assert.equal(isNumberedTitle("RCD-Typen A, F, B und B+"), false);
});

import { memoryEntryMatches } from "./memorySearch.ts";
test("entry search ignores accents and case and needs every word", () => {
  const entry = { id: "x", title: "Zählerformel", kind: "formula" as const, confidence: "verified" as const, source: {}, explanation: "Zählerkonstante in U/kWh" };
  assert.ok(memoryEntryMatches(entry, "zahlerkonstante"));
  assert.ok(memoryEntryMatches(entry, "ZÄHLER kwh"));
  assert.ok(!memoryEntryMatches(entry, "zähler lux"));
  assert.ok(memoryEntryMatches(entry, "messpraxis", "Messpraxis & Prüfungen"));
});
