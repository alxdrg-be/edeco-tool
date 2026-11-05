import assert from "node:assert/strict";
import test from "node:test";
import { ESCAPE_EMPTY_TEXT, escapeCableTone, escapeCountLabel, escapeRouteStates, placeEscapeSlots } from "./escapeRoute.ts";
import { INSTALLATION } from "./installation.ts";
import { PLANNING } from "./planning.ts";
import { defaults, type Inputs } from "./types.ts";

const brandlast = INSTALLATION.find(item => item.id === "brandlast")!;
const premium = PLANNING.find(item => item.id === "premium-brandlast")!;
const run = (id: "brandlast" | "premium-brandlast", patch: Inputs = {}) => {
  const definition = id === "brandlast" ? brandlast : premium;
  const input = { ...defaults(definition), ...patch };
  return { input, result: definition.calculate(input) };
};
const rows = (entries: Array<[string, string, string, string]>) => JSON.stringify(entries.map(([mjPerMeter, quantity, length, evidence], index) => ({
  id: `row-${index}`, name: `Kabel ${index + 1}`, mjPerMeter, quantity, length, evidence,
})));

test("default escape-route counts and densities stay on the calculated metrics", () => {
  const single = run("brandlast");
  const [state] = escapeRouteStates("brandlast", single.input, single.result);
  // 3 MJ/m × 10 × 10 m + 0.5 × 5 × 6 m = 315 MJ; 315 / 10 m = 31.5 MJ/m; 10 + 5 = 15 cables.
  assert.equal(single.result.metrics.find(item => item.label === "Brandlast bezogen auf Fluchtweg")?.value, 31.5);
  assert.equal(state.density, 31.5);
  assert.equal(state.count, 15);
  assert.equal(state.countLabel, "15 Kabel erfasst");
  assert.equal(state.headline, "31.5 / 200 MJ/m");
  assert.equal(state.summary, "warning");
  assert.equal(state.shown, 10);
  assert.equal(state.slots.filter(slot => slot === "warning").length, 10);

  const compared = run("premium-brandlast", { comparisonEnabled: "yes" });
  const states = escapeRouteStates("premium-brandlast", compared.input, compared.result);
  // Before: 1.5 × 20 × 20 + 2 × 10 × 20 = 1000 MJ / 20 m = 50. After: 1 × 10 × 20 + 1 × 5 × 20 = 300 / 20 = 15.
  assert.equal(compared.result.metrics.find(item => item.label === "Vorher")?.value, 50);
  assert.equal(compared.result.metrics.find(item => item.label === "Nachher")?.value, 15);
  assert.deepEqual(states.map(item => item.count), [30, 15]);
  assert.deepEqual(states.map(item => item.density), [50, 15]);
  assert.deepEqual(states.map(item => item.summary), ["warning", "warning"]);
});

test("escape-route colours follow the entered limit and the cable proof", () => {
  assert.equal(escapeCableTone("documented", true, false), "ok");
  assert.equal(escapeCableTone("open", true, false), "warning");
  assert.equal(escapeCableTone("documented", false, false), "warning");
  assert.equal(escapeCableTone("critical", true, false), "error");
  assert.equal(escapeCableTone("documented", true, true), "error");
  assert.deepEqual(placeEscapeSlots([{ name: "A", quantity: 2, tone: "ok" }, { name: "B", quantity: 1, tone: "error" }], 4), ["ok", "ok", "error", null]);

  const documented = run("brandlast", { fireloadRows: rows([["3", "2", "10", "documented"], ["0.5", "1", "6", "documented"]]) });
  const [ok] = escapeRouteStates("brandlast", documented.input, documented.result);
  // 3 × 2 × 10 + 0.5 × 1 × 6 = 63 MJ / 10 m = 6.3 MJ/m, under 200.
  assert.equal(ok.density, 6.3);
  assert.equal(ok.summary, "ok");
  assert.deepEqual(ok.cables.map(cable => cable.tone), ["ok", "ok"]);

  const over = run("brandlast", { fireloadRows: rows([["3", "80", "10", "documented"], ["0.5", "5", "6", "open"]]) });
  const [failed] = escapeRouteStates("brandlast", over.input, over.result);
  // 3 × 80 × 10 + 0.5 × 5 × 6 = 2415 MJ / 10 m = 241.5 MJ/m, over 200.
  assert.equal(failed.density, 241.5);
  assert.equal(failed.exceeded, true);
  assert.equal(failed.summary, "error");
  assert.ok(failed.cables.every(cable => cable.tone === "error"));

  const critical = run("brandlast", { fireloadRows: rows([["1", "1", "10", "critical"], ["1", "1", "10", "documented"]]) });
  const [marked] = escapeRouteStates("brandlast", critical.input, critical.result);
  assert.equal(marked.density, 2);
  assert.equal(marked.exceeded, false);
  assert.deepEqual(marked.cables.map(cable => cable.tone), ["error", "ok"]);
  assert.equal(marked.summary, "error");

  const vertical = run("brandlast", { route: "vertical", fireloadRows: rows([["1", "1", "10", "documented"]]) });
  const [shaft] = escapeRouteStates("brandlast", vertical.input, vertical.result);
  assert.equal(shaft.horizontal, false);
  assert.equal(shaft.limit, null);
  assert.equal(shaft.headline, "1 MJ/m");
  assert.equal(shaft.summary, "warning");
  assert.equal(shaft.cables[0].tone, "warning");

  const empty = run("brandlast", { fireloadRows: rows([["0", "0", "0", "open"]]) });
  const [none] = escapeRouteStates("brandlast", empty.input, empty.result);
  assert.equal(none.empty, true);
  assert.equal(none.count, 0);
  assert.equal(none.summary, "neutral");
  assert.equal(empty.result.metrics.find(item => item.label === "Brandlast total")?.value, 0);
});

test("escape-route labels keep both variant counts and the empty corridor text", () => {
  const compared = run("premium-brandlast", { comparisonEnabled: "yes" });
  const states = escapeRouteStates("premium-brandlast", compared.input, compared.result);
  assert.deepEqual(states.map(item => item.countLabel), [escapeCountLabel(30), escapeCountLabel(15)]);
  assert.equal(ESCAPE_EMPTY_TEXT, "Noch keine Kabel im Fluchtweg");
  const empty = run("brandlast", { fireloadRows: rows([["0", "0", "0", "open"]]) });
  const [none] = escapeRouteStates("brandlast", empty.input, empty.result);
  assert.equal(none.countLabel, escapeCountLabel(0));
  assert.equal(none.empty, true);
});
