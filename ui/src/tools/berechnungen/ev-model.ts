import { numeric } from "./engineering.ts";
export interface EVInput { house: string; grid: string; reserve: string; count: string; power: string; mode: "none" | "dynamic" | "static"; diversity: string }
export const EV_SOURCE = "https://www.elektro-rechner.ch/Rechner/e-mobility-rechner.html";
export function calculateEV(input: EVInput) {
  const house = numeric(input.house, "Hausanschluss", 0, 1000), grid = numeric(input.grid, "Grid-Vorsicherung", 0, 1000);
  const reserve = numeric(input.reserve, "Gebäudereserve", 0, 1000, true), count = numeric(input.count, "Ladepunkte", 0, 1000);
  const power = numeric(input.power, "Ladeleistung", 0, 100);
  if (!Number.isInteger(count)) throw new Error("Anzahl Ladepunkte als ganze Zahl eingeben.");
  if (grid > house) throw new Error("Grid-Vorsicherung darf den Hausanschluss nicht überschreiten.");
  if (!["none", "dynamic", "static"].includes(input.mode)) throw new Error("Lastmanagement auswählen.");
  // This field is hidden and unused outside the static planning model.
  const diversity = input.mode === "static" ? numeric(input.diversity, "Planungsfaktor", 0, 1) : 1;
  const factor = Math.sqrt(3) * 400 / 1000, houseKW = house * factor, gridKW = grid * factor;
  const available = Math.max(0, Math.min(gridKW, houseKW - reserve)), installed = count * power;
  const appliedFactor = input.mode === "static" ? diversity : 1;
  const requested = installed * appliedFactor;
  const allocated = input.mode === "none" ? installed : Math.min(available, requested);
  return { houseKW, gridKW, available, installed, requested, allocated, appliedFactor,
    perPoint: allocated / count, balancedCurrent: allocated / factor, capacityOK: requested <= available + 1e-9,
    reserveExceeded: reserve > houseKW, limited: input.mode !== "none" && allocated < installed - 1e-9 };
}
