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
