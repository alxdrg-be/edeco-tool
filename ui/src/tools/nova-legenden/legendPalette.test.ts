import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { colorLab, deltaE2000, paletteConflicts, paperContrast } from "./legendPalette.ts";

describe("legend palette review", () => {
  it("matches published CIEDE2000 reference pairs", () => {
    assert.ok(Math.abs(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < .0001);
    assert.ok(Math.abs(deltaE2000([50, 3.1571, -77.2803], [50, 0, -82.7485]) - 2.8615) < .0001);
    assert.equal(deltaE2000([50, 0, 0], [50, 0, 0]), 0);
  });
  it("finds duplicates and similar browns without changing their source entries", () => {
    const entries = [{ id: "a", title: "Schwachstrom", color: "#873900" }, { id: "b", title: "ZUKO", color: "#8c4000" }, { id: "c", title: "Licht", color: "#009cff" }, { id: "d", title: "Weiteres", color: "#873900" }];
    const snapshot = structuredClone(entries), conflicts = paletteConflicts(entries);
    assert.ok(conflicts.some(pair => pair.first.id === "a" && pair.second.id === "b"));
    assert.ok(conflicts.some(pair => pair.duplicate));
    assert.ok(conflicts.every(pair => pair.first.id !== "c" && pair.second.id !== "c"));
    assert.deepEqual(entries, snapshot);
  });
  it("handles paper contrast and rejects invalid colours", () => {
    assert.equal(colorLab("red"), null);
    assert.ok(Math.abs(paperContrast("#ffffff")! - 1) < .00001);
    assert.equal(paperContrast("#000000"), 21);
    assert.equal(paperContrast("#fff"), null);
    assert.equal(paletteConflicts([{ id: "x", title: "Ungültig", color: "#fff" }]).length, 0);
  });
});
