import assert from "node:assert/strict";
import test from "node:test";
import { groupOf, worstStatus } from "./ifcViewerGroups.ts";

test("architecture classes get their own groups, everything else counts as installation", () => {
  assert.equal(groupOf("IFCSPACE"), "rooms");
  assert.equal(groupOf("IFCWALLSTANDARDCASE"), "walls");
  assert.equal(groupOf("IFCDOOR"), "openings");
  assert.equal(groupOf("IFCSLAB"), "slabs");
  // Nova exports electrical objects as proxies or flow terminals.
  assert.equal(groupOf("IFCBUILDINGELEMENTPROXY"), "installation");
  assert.equal(groupOf("IFCLIGHTFIXTURE"), "installation");
  assert.equal(groupOf("IFCSPACEHEATER"), "installation");
});

test("the most severe finding colours an object", () => {
  assert.equal(worstStatus(["OK", "Abweichend", "Optional"]), "Abweichend");
  assert.equal(worstStatus(["OK", "Fehlt", "Leer"]), "Fehlt");
  assert.equal(worstStatus([]), null);
});
