import { SIA_REFERENCE_SOURCE, SIA_REFERENCE_GROUPS } from "./siaReferenceData.ts";

/** Visible menu metadata and dated numerical reference facts, captured directly
 * from the authenticated page on 2026-11-02. Provider publication is not an
 * independent norm certification. The explicit Food/L gap remains blocked. */
export const SIA_DATA_SOURCE = "https://www.elektro-rechner.ch/premium/sia2056-rechner.php";
export const SIA_DATA_OBSERVATION = SIA_REFERENCE_SOURCE.url;
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
/** Full published reference table, including explicit null source gaps. */
export const SIA_AUTOMATIC_DATASET = SIA_REFERENCE_GROUPS;
export function requireSIAAutomaticDataset() { return SIA_AUTOMATIC_DATASET; }
export const SIA_REFERENCE_CATEGORY:Readonly<Record<string,string>> = {
  office:"Büro",mfh:"Wohnen MFH",efh:"Wohnen EFH",hotel:"Hotel",school:"Schule",university:"Hochschule",
  "retail-nonfood":"Verkauf","retail-food":"Verkauf (Food)",restaurant:"Restaurant",assembly:"Versammlung",hospital:"Spital",
  industry:"Industrie",warehouse:"Lager",sports:"Sportbauten",pool:"Hallenbad",parking:"Parkhaus",
};
