import assert from "node:assert/strict";
import test from "node:test";
import { buildName, DEFAULTS, nameIssue, PARTS, restoreSettings } from "./naming.ts";

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
  const options = (key: string) => PARTS.find(part => part.key === key)!.options;
  for (const code of ["A", "E", "KO", "L", "H", "S", "K"]) assert.ok(options("discipline").includes(code));
  assert.deepEqual(options("drawing"), ["G", "P"]);
  for (const code of ["SUS", "UKV", "RTV", "DSP", "APP"]) assert.ok(options("plan").includes(code));
  for (const code of ["UG11", "UG", "SG", "EG", "EG00", "OG", "OG02", "DG", "DA"]) assert.ok(options("floor").includes(code));
  for (const code of ["a", "b", "c", "31", "32", "41", "51", "53"]) assert.ok(options("index").includes(code));
  for (const code of ["1", "5", "50", "100", "1000"]) assert.ok(options("scale").includes(code));
});
