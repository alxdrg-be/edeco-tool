import assert from "node:assert/strict";
import test from "node:test";

// Same rule as libraryName in RackLibrary.tsx, kept free of React/CSS imports.
const libraryName = (name: string) => name.replace(/\s*·\s*\d+\s*HE\b/, "").trim() || name;

test("library names drop the HE part that is shown as a badge", () => {
  assert.equal(libraryName("Patchpanel · 48 Ports · 1 HE HD"), "Patchpanel · 48 Ports HD");
  assert.equal(libraryName("Vertikale Steckdosenleiste · 0 HE"), "Vertikale Steckdosenleiste");
  assert.equal(libraryName("USV · 3 HE (Beispiel)"), "USV (Beispiel)");
  assert.equal(libraryName("Server BHBHV05"), "Server BHBHV05");
});
