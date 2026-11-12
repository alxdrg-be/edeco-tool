import assert from "node:assert/strict";
import { test } from "node:test";
import { checkIk, requiredCurrent } from "./ikCheck.ts";

const table = { headers: ["In A", "D-Sicherung Bauform / A", "NH gG A", "LS B A"], rows: [["13", "keine", "152", "98"], ["16", "DII/DIII 121", "186", "121"]] };

test("required current is read from plain and labelled cells", () => {
  assert.equal(requiredCurrent("DII/DIII 121"), 121);
  assert.equal(requiredCurrent("303"), 303);
  assert.equal(requiredCurrent("keine"), null);
});

test("measured Ik is compared with the table value", () => {
  assert.deepEqual(checkIk(table, 3, "16", 150), { kind: "ok", required: 121, label: "121" });
  assert.deepEqual(checkIk(table, 3, "16", 121), { kind: "ok", required: 121, label: "121" });
  assert.deepEqual(checkIk(table, 2, "16", 150), { kind: "low", required: 186, label: "186" });
  assert.deepEqual(checkIk(table, 1, "13", 500), { kind: "none", label: "keine" });
});

test("incomplete input gives no verdict", () => {
  assert.equal(checkIk(table, 3, "99", 150), null);
  assert.equal(checkIk(table, 9, "16", 150), null);
  assert.equal(checkIk(table, 3, "16", 0), null);
  assert.equal(checkIk(table, 3, "16", Number.NaN), null);
});
