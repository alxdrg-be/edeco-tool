/** Current-carrying capacity Iz in ampere, copper, three loaded cores.
 *  Values must match NIN 2025 5.2.3.
 *  The figures are the ones the reviewed motor calculator publishes for the
 *  Iz ≥ In check (methods B1, B2, C, D and E).
 */

export type Insulation = "PVC" | "XLPE";
export type InstallMethod = "B1" | "B2" | "C" | "D" | "E";

export const IZ_CU_THREE_CORE: Record<Insulation, Record<InstallMethod, Record<number, number>>> = {
  PVC: {
    B1: { 1.5: 15.5, 2.5: 21, 4: 28, 6: 36, 10: 50, 16: 68, 25: 89, 35: 110, 50: 134, 70: 171, 95: 207, 120: 239, 150: 262, 185: 296, 240: 346, 300: 394 },
    B2: { 1.5: 15, 2.5: 20, 4: 27, 6: 34, 10: 46, 16: 62, 25: 80, 35: 99, 50: 118, 70: 149, 95: 179, 120: 206, 150: 225, 185: 255, 240: 297, 300: 339 },
    C: { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 96, 35: 119, 50: 144, 70: 184, 95: 223, 120: 259, 150: 299, 185: 341, 240: 403, 300: 464 },
    D: { 1.5: 18, 2.5: 24, 4: 30, 6: 38, 10: 50, 16: 64, 25: 82, 35: 98, 50: 116, 70: 143, 95: 169, 120: 192, 150: 217, 185: 243, 240: 280, 300: 316 },
    E: { 1.5: 18.5, 2.5: 25, 4: 34, 6: 43, 10: 60, 16: 80, 25: 101, 35: 126, 50: 153, 70: 196, 95: 238, 120: 276, 150: 319, 185: 364, 240: 430, 300: 497 },
  },
  XLPE: {
    B1: { 1.5: 20, 2.5: 28, 4: 37, 6: 48, 10: 66, 16: 88, 25: 117, 35: 144, 50: 175, 70: 222, 95: 269, 120: 312, 150: 342, 185: 384, 240: 450, 300: 514 },
    B2: { 1.5: 19.5, 2.5: 26, 4: 35, 6: 44, 10: 60, 16: 80, 25: 105, 35: 128, 50: 154, 70: 194, 95: 233, 120: 268, 150: 300, 185: 340, 240: 398, 300: 455 },
    C: { 1.5: 22, 2.5: 30, 4: 40, 6: 52, 10: 71, 16: 96, 25: 119, 35: 147, 50: 179, 70: 229, 95: 278, 120: 322, 150: 371, 185: 424, 240: 500, 300: 576 },
    D: { 1.5: 21, 2.5: 28, 4: 36, 6: 44, 10: 58, 16: 75, 25: 96, 35: 115, 50: 135, 70: 167, 95: 197, 120: 223, 150: 251, 185: 281, 240: 324, 300: 365 },
    E: { 1.5: 23, 2.5: 32, 4: 42, 6: 54, 10: 75, 16: 100, 25: 127, 35: 158, 50: 192, 70: 246, 95: 298, 120: 346, 150: 399, 185: 456, 240: 538, 300: 621 },
  },
};

const SECTIONS = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];

export interface SectionChoice {
  sectionMm2: number;
  izA: number;
}

/** Smallest section with Iz ≥ In. Null when even 300 mm² is below In. */
export function sectionForCurrent(currentA: number, insulation: Insulation, method: InstallMethod): SectionChoice | null {
  const table = IZ_CU_THREE_CORE[insulation][method];
  for (const section of SECTIONS) {
    const izA = table[section];
    if (izA !== undefined && izA >= currentA) return { sectionMm2: section, izA };
  }
  return null;
}
