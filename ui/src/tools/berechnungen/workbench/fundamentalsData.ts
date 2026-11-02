/** Published preset observations, not a replacement for the named standards.
 * motoranlauf.html: 82fa3cdf184a80b22190f8ae42b19729da3ddf6fb99d407b5a6636ce3953fb2e
 * beleuchtung.html: 4e535e5b70d0e18899c8e1d71de897e50cd153de231edda81a0995f5bebe6e90
 * Retrieved 2026-11-01 from https://www.elektro-rechner.ch/Rechner/.
 */
export const MOTOR_PRESET_EFFICIENCIES: Readonly<Record<string, number>> = {
  "0.37": .773, "0.55": .808, "0.75": .825, "1.1": .841, "1.5": .853,
  "2.2": .867, "3": .877, "4": .886, "5.5": .896, "7.5": .904,
  "11": .914, "15": .921, "18.5": .926, "22": .93, "30": .936,
  "37": .939, "45": .942, "55": .946, "75": .95,
};
export const MOTOR_PROTECTION_RATINGS = [.4, .63, 1, 1.6, 2.5, 4, 6.3, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125] as const;
export function motorPresetEfficiency(powerKW: number): number {
  const efficiency = MOTOR_PRESET_EFFICIENCIES[String(powerKW)];
  if (efficiency === undefined) throw new Error("Für diese Motorleistung ist kein veröffentlichter IE3-Vorgabewert hinterlegt. Manuellen Wirkungsgrad wählen.");
  return efficiency;
}
export function motorProtectionRating(current: number): number | null {
  if (!Number.isFinite(current) || current <= 0) throw new Error("Motor-Nennstrom muss positiv sein.");
  return MOTOR_PROTECTION_RATINGS.find(rating => rating >= current - 1e-12) ?? null;
}

export interface LuminairePreset { id: string; label: string; watts: number; lumen: number }
export const LUMINAIRE_PRESETS: readonly LuminairePreset[] = [
  { id: "0", label: "Panel 600 × 600 mm", watts: 36, lumen: 4320 },
  { id: "1", label: "Panel 1200 × 300 mm", watts: 40, lumen: 4800 },
  { id: "2", label: "Panel 1200 × 600 mm", watts: 50, lumen: 6000 },
  { id: "3", label: "Einbauleuchte Ø 200 mm", watts: 18, lumen: 2000 },
  { id: "4", label: "Einbauleuchte Ø 240 mm", watts: 28, lumen: 3200 },
  { id: "5", label: "Lichtband 1500 mm · Variante A", watts: 35, lumen: 5000 },
  { id: "6", label: "Lichtband 1500 mm · Variante B", watts: 50, lumen: 7500 },
  { id: "7", label: "Hallenleuchte · Variante A", watts: 100, lumen: 15000 },
  { id: "8", label: "Hallenleuchte · Variante B", watts: 150, lumen: 22500 },
  { id: "9", label: "Hallenleuchte · Variante C", watts: 200, lumen: 30000 },
  { id: "10", label: "Wannenleuchte 1500 mm · Variante A", watts: 45, lumen: 6000 },
  { id: "11", label: "Wannenleuchte 1500 mm · Variante B", watts: 60, lumen: 8400 },
  { id: "12", label: "GU10-Leuchtmittel", watts: 6, lumen: 600 },
  { id: "13", label: "Kompaktstrahler", watts: 20, lumen: 2400 },
  { id: "14", label: "E27-Leuchtmittel · Variante A", watts: 9, lumen: 1050 },
  { id: "15", label: "E27-Leuchtmittel · Variante B", watts: 14, lumen: 1600 },
  { id: "16", label: "Flächenstrahler · Variante A", watts: 50, lumen: 5500 },
  { id: "17", label: "Flächenstrahler · Variante B", watts: 100, lumen: 11000 },
  { id: "18", label: "Aussenleuchte", watts: 60, lumen: 8400 },
];
export const LUX_PRESETS = [75, 100, 150, 200, 300, 500, 750, 1000] as const;
export function luminairePreset(id: string): LuminairePreset {
  const preset = LUMINAIRE_PRESETS.find(item => item.id === id);
  if (!preset) throw new Error("Gültiges Leuchtenbeispiel wählen.");
  return preset;
}

/** Empirical room approximation observed in the public reference, not LiTG data. */
export function approximateRoomUtilisation(roomIndex: number, reflectance: number): number {
  if (!Number.isFinite(roomIndex) || roomIndex <= 0 || !Number.isFinite(reflectance) || reflectance < 0 || reflectance > 1) throw new Error("Raumindex und Reflexionsannahme prüfen.");
  return Math.min(.85, .4 + .16 * roomIndex * (reflectance + .3));
}
