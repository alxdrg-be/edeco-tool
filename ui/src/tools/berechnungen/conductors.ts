/** Conductor data for the calculation engines.
 *  Resistances are the SN EN 60228 class-2 maxima at 20 °C (Ω/km).
 *  Aluminium is listed only from 10 mm². 300 mm² copper is the resistance
 *  published for the loss calculation; no guidance reactance is stored for it,
 *  so voltage drop does not offer that section.
 */

export type Material = "cu" | "al";

export const ALPHA_PER_K = { cu: 0.00393, al: 0.00403 } as const;

/** Operating temperature used for voltage drop and losses, as in the NIN 6.1.3 diagram. */
export const OPERATING_TEMP_C = 55;

/** Warm-loop temperature for the short-circuit lower bound. */
export const SHORT_CIRCUIT_WARM_C = 80;

export const R20_OHM_PER_KM: Record<Material, Record<number, number>> = {
  cu: {
    1.5: 12.1, 2.5: 7.41, 4: 4.61, 6: 3.08, 10: 1.83, 16: 1.15, 25: 0.727,
    35: 0.524, 50: 0.387, 70: 0.268, 95: 0.193, 120: 0.153, 150: 0.124,
    185: 0.0991, 240: 0.0754, 300: 0.0601,
  },
  al: {
    10: 3.08, 16: 1.91, 25: 1.2, 35: 0.868, 50: 0.641, 70: 0.443, 95: 0.32,
    120: 0.253, 150: 0.206, 185: 0.164, 240: 0.125,
  },
};

/** Guidance reactance for multicore cables, Ω/km. Not a value from a standard. */
export const X_GUIDANCE_OHM_PER_KM: Record<number, number> = {
  1.5: 0.115, 2.5: 0.11, 4: 0.107, 6: 0.104, 10: 0.1, 16: 0.096, 25: 0.092,
  35: 0.089, 50: 0.086, 70: 0.083, 95: 0.08, 120: 0.079, 150: 0.078, 185: 0.077,
  240: 0.075,
};

export const SERVICE_FUSE_A = [63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800] as const;

export const MCB_STEPS_A = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125] as const;

/** NIN 5.2.5.1 planning limit used by the voltage-drop and loss calculators. */
export const NIN_VOLTAGE_DROP_LIMIT_PERCENT = 4;

export function resistancePerKm(material: Material, sectionMm2: number, tempC: number): number | null {
  const r20 = R20_OHM_PER_KM[material][sectionMm2];
  if (r20 === undefined) return null;
  return r20 * (1 + ALPHA_PER_K[material] * (tempC - 20));
}

export function guidanceReactancePerKm(sectionMm2: number): number | null {
  const value = X_GUIDANCE_OHM_PER_KM[sectionMm2];
  return value === undefined ? null : value;
}

export function sectionsFor(material: Material): number[] {
  return Object.keys(R20_OHM_PER_KM[material])
    .map(Number)
    .filter((section) => guidanceReactancePerKm(section) !== null)
    .sort((a, b) => a - b);
}

export function nextRating(currentA: number, steps: readonly number[]): number | null {
  return steps.find((step) => step >= currentA - 1e-9) ?? null;
}
