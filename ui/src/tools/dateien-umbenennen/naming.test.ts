import assert from "node:assert/strict";
import test from "node:test";
import { buildName, DEFAULTS, nameIssue, restoreSettings } from "./naming.ts";

test("company naming example, optional fields and order preserve separator rules", () => {
  const settings = structuredClone(DEFAULTS);
  settings.values.project = "1498";
  assert.equal(buildName(settings, "OG02"), "1498_E-G-APP-OG02-C-50.pdf");
  settings.enabled.index = false;
  settings.enabled.scale = false;
  assert.equal(buildName(settings, "EG00"), "1498_E-G-APP-EG00.pdf");
  settings.enabled.project = false;
  assert.equal(buildName(settings, "UG01"), "E-G-APP-UG01.pdf");
  settings.enabled.date = true; settings.values.date = "2026-11-01";
  assert.equal(buildName(settings, "UG01"), "E-G-APP-UG01-2026-11-01.pdf");
});
test("broken saved templates fall back and invalid Windows names cannot export", () => {
  assert.deepEqual(restoreSettings('{"order":["bad"]}'), DEFAULTS);
  assert.deepEqual(restoreSettings(JSON.stringify(DEFAULTS)), DEFAULTS);
  for (const value of ["../test.pdf", "CON.pdf", "a:b.pdf", ".pdf", "test.txt"]) assert.ok(nameIssue(value));
  assert.equal(nameIssue("1498_E-G-APP-OG02-C-50.pdf"), "");
});
