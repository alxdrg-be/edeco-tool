import assert from "node:assert/strict";
import test from "node:test";
import { auditOnly, parseProfiles, standard, validProfile } from "./profile.ts";

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
test("older profiles load with optional structural audit disabled", () => {
  const legacy = { ...standard.profile };
  delete legacy.audit_dxf;
  const [named] = parseProfiles(JSON.stringify([{ name: "Altbestand", profile: legacy }]));
  assert.equal(named.profile.audit_dxf ?? false, false);
  assert.ok(validProfile({ ...legacy, audit_dxf: true }));
  assert.equal(validProfile({ ...legacy, audit_dxf: "ja" }), false);
});
test("the structural preset changes no layer or mask options and coexists with an old private profile", () => {
  assert.deepEqual(auditOnly.profile, { rules: [], remove_wipeouts: false, remove_text_backgrounds: false, audit_dxf: true });
  const custom = { name: auditOnly.name, profile: standard.profile };
  assert.deepEqual(parseProfiles(JSON.stringify([custom])), [custom]);
});
