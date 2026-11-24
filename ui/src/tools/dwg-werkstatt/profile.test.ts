import assert from "node:assert/strict";
import test from "node:test";
import { parseProfiles, standard, validProfile } from "./profile.ts";

test("stored office profiles round trip without replacing the protected standard", () => {
  const custom = { name: "Planbüro", profile: standard.profile };
  assert.deepEqual(parseProfiles(JSON.stringify([custom])), [custom]);
  assert.deepEqual(parseProfiles(null), []);
  assert.throws(() => parseProfiles(JSON.stringify([standard])));
  assert.throws(() => parseProfiles(JSON.stringify([custom, custom])));
});
test("invalid layers, drawing operations and lineweights cannot reach the DXF request", () => {
  assert.ok(validProfile(standard.profile));
  for (const rule of [{ contains: "  ", action: "grey" }, { contains: "A_", action: "delete" }, { contains: "A_", action: "grey", lineweight_mm: -.1 }]) {
    assert.equal(validProfile({ ...standard.profile, rules: [rule] }), false);
  }
});
