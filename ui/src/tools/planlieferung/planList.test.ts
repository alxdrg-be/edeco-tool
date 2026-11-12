import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, planListCsv } from "./planList.ts";
import type { DeliveryRecord } from "../projektzentrale/projectHubState.ts";

test("csv cells are quoted and escape quotes", () => {
  assert.equal(csvCell("EG"), '"EG"');
  assert.equal(csvCell('Plan "A"'), '"Plan ""A"""');
});

test("csv cells neutralise formula starts for Excel", () => {
  for (const value of ["=SUM(A1)", "+41", "-1", "@x", "  =1", "\tx"]) assert.ok(csvCell(value).startsWith(`"'`), value);
  assert.equal(csvCell("1:50"), '"1:50"');
});

test("plan list has BOM, header and one row per plan", () => {
  const plan = { filename: "E_EG.pdf", original: "a.pdf", floor: "EG", plan_type: "Elektro", index: "A", scale: "50", sha256: "ab", size: 1 };
  const record = { id: "1", project_id: "p", project_number: "412698", project_name: "X", recipient: "Bauherr", delivery_date: "2026-11-12",
    title: "T", notes: "", plans: [plan, { ...plan, filename: "E_OG.pdf", floor: "1.OG" }], created_at: "", sent_at: null } satisfies DeliveryRecord;
  const csv = planListCsv(record), lines = csv.slice(1).split("\r\n");
  assert.ok(csv.startsWith("﻿"));
  assert.equal(lines.length, 3);
  assert.equal(lines[0].split(";")[0], '"Projektnummer"');
  assert.equal(lines[2], '"412698";"2026-11-12";"Bauherr";"E_OG.pdf";"1.OG";"Elektro";"A";"50";"ab"');
});
