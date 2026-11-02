/**
 * Visible menu metadata observed 2026-11-02, TinyFish run
 * 80e49f35-8c4b-4873-80e7-82bcd113621f, elektro-rechner.ch/premium/sia2056-rechner.php.
 * Labels and a few displayed correction factors do NOT establish the underlying
 * SIA consumer coefficients. Do not reconstruct a normative dataset from rounded
 * aggregate outputs. Automatic profiles require independently sourced, versioned
 * raw power AND annual-energy coefficients for every category/class combination,
 * documented applicability and reproducible unrounded reference fixtures.
 */
export const SIA_DATA_SOURCE = "https://www.elektro-rechner.ch/premium/sia2056-rechner.php";
export const SIA_DATA_OBSERVATION = "https://agent.tinyfish.ai/runs/80e49f35-8c4b-4873-80e7-82bcd113621f";
export const SIA_BUILDING_TYPES = [
  ["none", "— keine Zone —"], ["office", "Büro"], ["mfh", "Wohnen MFH"], ["efh", "Wohnen EFH"],
  ["hotel", "Hotel"], ["school", "Schule"], ["university", "Hochschule"], ["retail-nonfood", "Verkauf (Non-Food)"],
  ["retail-food", "Verkauf (Food)"], ["restaurant", "Restaurant"], ["assembly", "Versammlung / Kultur"],
  ["hospital", "Spital / Pflege"], ["industry", "Industrie"], ["warehouse", "Lager"],
  ["sports", "Sportbauten"], ["pool", "Hallenbad"], ["parking", "Parkhaus"],
] as const;
export const SIA_GROUPS = [
  { id: "devices", label: "Geräte", color: "#00c8d7" },
  { id: "processes", label: "Prozesse", color: "#8f90ff" },
  { id: "lighting", label: "Beleuchtung", color: "#ffd600" },
  { id: "general", label: "Allgemeine Gebäudetechnik", color: "#ef8cc7" },
  { id: "heating", label: "Wärme / WP", color: "#ff9859" },
  { id: "ventilation", label: "Lüftung", color: "#79c982" },
  { id: "cooling", label: "Kälte", color: "#75adff" },
] as const;
export type SIAGroupId = (typeof SIA_GROUPS)[number]["id"];
export const SIA_CONSUMER_CLASS_CODES: Readonly<Record<SIAGroupId, readonly string[]>> = {
  devices: ["s", "m", "l", "keine"], processes: ["s", "m", "l", "keine"],
  lighting: ["gw", "mg", "zw"], general: ["s", "m", "l"],
  heating: ["sole", "luft", "oel", "keine"], ventilation: ["gw", "zw", "keine"],
  cooling: ["gw", "zw", "bestand", "keine"],
};
/** Observed menu values only; no interpolation or selection rule is established. */
export const SIA_OBSERVED_KCOR = { office: [.6, .7, .8], mfh: [1] } as const;
/** No complete validated coefficient dataset has been obtained. */
export const SIA_AUTOMATIC_DATASET = null;
export function requireSIAAutomaticDataset(): never {
  throw new Error("Automatisches SIA-Profil gesperrt: belegte Leistungs- und Energiekennwerte des vollständigen Datensatzes fehlen. Manuelle Kennwerte mit Quellenvermerk erfassen; es werden keine Ersatzwerte berechnet.");
}
