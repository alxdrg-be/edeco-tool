/** Published reference data already used by the planning workbench.
 * No separate, supposedly normative copy is maintained here. Corrections and
 * applicability must be confirmed for the project before choosing a cable.
 */
import { lookupPublishedIz, publishedAreas } from "./workbench/referenceInstallationData.ts";
export type Insulation = "PVC" | "XLPE";
export type InstallMethod = "B1" | "B2" | "C" | "D" | "E";
export interface SectionChoice { sectionMm2: number; izA: number }
export function sectionForCurrent(currentA: number, insulation: Insulation, method: InstallMethod): SectionChoice | null {
  if (!Number.isFinite(currentA) || currentA <= 0 || !["PVC", "XLPE"].includes(insulation) || !["B1", "B2", "C", "D", "E"].includes(method)) return null;
  const config = { material: "cu" as const, isolation: insulation === "PVC" ? "pvc" as const : "xlpe" as const, cores: 3 as const, method };
  for (const sectionMm2 of publishedAreas(config).filter(area => area <= 300)) {
    const izA = lookupPublishedIz({ ...config, area: sectionMm2 });
    if (izA !== null && izA >= currentA) return { sectionMm2, izA };
  }
  return null;
}
