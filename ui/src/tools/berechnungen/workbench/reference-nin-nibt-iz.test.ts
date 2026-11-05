import assert from "node:assert/strict";
import test from "node:test";
import { lookupPublishedIz } from "./referenceInstallationData.ts";

/**
 * Iz values printed by Electrosuisse "NIN 2025 Anlagenplanung" (reports of
 * 05.11.2026: Umbau Wohnhaus, Restaurant mit Wohnung, Muster-Gewerbe mit
 * 1 Wohnung). Only unambiguous single circuits at 30 °C without grouping are
 * used. Loaded conductors follow the circuit: 3~ consumers = 3, 1~ = 2.
 * Values are observed outputs; no program code or catalogue data is copied.
 */
const cases: [string, "pvc" | "xlpe", 2 | 3, string, number, number][] = [
  ["CH-N1VV 1x10 B1 (Zuleitung HAK)", "pvc", 3, "B1", 10, 50],
  ["CH-N1VV 1x6 B1 (D 20 A, 1~)", "pvc", 2, "B1", 6, 41],
  ["H07V-U 6 B1", "pvc", 3, "B1", 6, 36],
  ["CH-N1VV 5x1.5 B2", "pvc", 3, "B2", 1.5, 15],
  ["H07V-U 2.5 B1 (Kochherd)", "pvc", 3, "B1", 2.5, 21],
  ["H07V-U 1.5 A1", "pvc", 3, "A1", 1.5, 13.5],
  ["CH-N1VV 5x95 B2", "pvc", 3, "B2", 95, 179],
  ["H07V-K 70 B1", "pvc", 3, "B1", 70, 171],
  ["CH-N1VV 5x6 B2", "pvc", 3, "B2", 6, 34],
  ["CH-N1VV 5x10 B2", "pvc", 3, "B2", 10, 46],
  ["CH-N1VV 5x2.5 B2", "pvc", 3, "B2", 2.5, 20],
  ["CH-N1VV 3x2.5 B2", "pvc", 2, "B2", 2.5, 23],
  ["CH-N1VV 3x1.5 B2", "pvc", 2, "B2", 1.5, 16.5],
  ["CH-N1VV 5x50 C", "pvc", 3, "C", 50, 144],
  ["CH-N1BQ-F EPR/PUR 5x4 E", "xlpe", 3, "E", 4, 42],
  ["CH-N1BQ-F EPR/PUR 5x2.5 E", "xlpe", 3, "E", 2.5, 32],
  ["CH-N1BQ-F EPR/PUR 5x6 E", "xlpe", 3, "E", 6, 54],
  ["CH-N1Z1Z1 5x2.5 B2", "xlpe", 3, "B2", 2.5, 26],
  ["CH-N1Z1Z1 3x2.5 B2", "xlpe", 2, "B2", 2.5, 30],
  ["H07Z-U 1.5 B1", "xlpe", 3, "B1", 1.5, 20],
  ["H07Z-U 2.5 B1", "xlpe", 3, "B1", 2.5, 28],
  ["H07Z-U 16 A1", "xlpe", 3, "A1", 16, 73],
  ["H07Z-K 10 A1", "xlpe", 3, "A1", 10, 54],
];

test("published Iz matches the Electrosuisse NIN program for 23 printed cables", () => {
  for (const [name, isolation, cores, method, area, expected] of cases) {
    assert.equal(lookupPublishedIz({ material: "cu", isolation, cores, method, area }), expected, name);
  }
});
