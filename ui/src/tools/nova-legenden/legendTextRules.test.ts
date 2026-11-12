import test from "node:test";
import assert from "node:assert/strict";
import { legendAbbreviationProblem, legendAbbreviationsCsv, parseLegendAbbreviationsCsv } from "./legendTextRules.ts";

test("CSV round trip preserves explicit scope, Unicode, punctuation and disabled rows", () => {
  const rules = [{ id: "a", long: "Gruppe", short: "Gr.", scope: "all", active: true }, { id: "b", long: 'Leuchte "Decke"', short: 'L. "D."', scope: "licht", active: false }];
  assert.deepEqual(parseLegendAbbreviationsCsv(legendAbbreviationsCsv(rules)), rules.map(({ id: _id, ...rule }) => rule));
});

test("CSV rejects damaged headers, ambiguous activation and unsafe technical abbreviations", () => {
  assert.throws(() => parseLegendAbbreviationsCsv("Langform;Kurzform\nGruppe;Gr."), /CSV-Kopf/);
  assert.throws(() => parseLegendAbbreviationsCsv("Langform;Kurzform;Geltungsbereich;Aktiv\nGruppe;Gr.;all;maybe"), /Aktiv/);
  assert.throws(() => parseLegendAbbreviationsCsv("Langform;Kurzform;Geltungsbereich;Aktiv\nT13;T;all;ja"), /geschützt/);
  assert.throws(() => parseLegendAbbreviationsCsv('Langform;Kurzform;Geltungsbereich;Aktiv\n"Gruppe;Gr.;all;ja'), /Anführungszeichen/);
});

test("CSV supports comma-separated complete rules and limits import size", () => {
  assert.deepEqual(parseLegendAbbreviationsCsv("Langform,Kurzform,Geltungsbereich,Aktiv\nGruppe,Gr.,all,ja"), [{ long: "Gruppe", short: "Gr.", scope: "all", active: true }]);
  assert.throws(() => parseLegendAbbreviationsCsv(" ".repeat(150_001)), /gross/);
  assert.throws(() => parseLegendAbbreviationsCsv("Langform;Kurzform;Geltungsbereich;Aktiv\n" + "Gruppe;Gr.;all;ja\n".repeat(101)), /100/);
});

test("valid words can be abbreviated, types, numbers and units cannot", () => {
  assert.equal(legendAbbreviationProblem({ long: "Gruppe", short: "Gr." }), "");
  assert.equal(legendAbbreviationProblem({ long: "Unterputz", short: "UP" }), "");
  for (const [long, short] of [["T13", "T"], ["16 A", "A"], ["mm", "m"], ["Gruppe", "G1"], ["MM", "x"], ["ip", "x"], ["µA", "x"], ["μa", "x"]]) assert.match(legendAbbreviationProblem({ long, short }), /geschützt/);
  assert.match(legendAbbreviationProblem({ long: "Gruppe", short: "Gruppen" }), /kürzer/);
});
