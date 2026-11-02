import { numeric } from "./engineering.ts";
import { EV_EXTENSION_DEFAULTS, publishedEVFactorDetails } from "./EVdata.ts";
export interface EVInput {
  house: string; grid: string; reserve: string; count: string; power: string;
  mode: "none" | "dynamic" | "static"; diversity: string;
  minimumPower?: string; hours?: string; consumption?: string; pv?: string; battery?: string;
  sourceConnection?: "house" | "grid"; factorMode?: "manual" | "reference";
  userClass?: string; chargerKind?: "auto" | "ac1" | "ac3" | "dc"; powerMode?: "preset" | "custom";
}
export const EV_SOURCE = "https://www.elektro-rechner.ch/Rechner/e-mobility-rechner.html";
const KW_PER_THREE_PHASE_AMP = Math.sqrt(3) * 400 / 1000;
const TOLERANCE = 1e-9;
const optionalEnergy = (value: string | undefined, label: string) => value === undefined || value.trim() === "" ? 0 : numeric(value, label, 0, 1e6, true);

/** A scheduling snapshot with balanced local generation and building reserve. */
export function calculateEV(input: EVInput) {
  const house = numeric(input.house, "Hausanschluss", 0, 1000), grid = numeric(input.grid, "Grid-Vorsicherung", 0, 1000);
  const reserve = numeric(input.reserve, "Gebäudereserve", 0, 1000, true), count = numeric(input.count, "Ladepunkte", 0, 1000);
  const power = numeric(input.power, "Ladeleistung", 0, 3000);
  if (!Number.isInteger(count)) throw new Error("Anzahl Ladepunkte als ganze Zahl eingeben.");
  if (grid > house) throw new Error("Grid-Vorsicherung darf den Hausanschluss nicht überschreiten.");
  if (!["none", "dynamic", "static"].includes(input.mode)) throw new Error("Lastmanagement auswählen.");
  const hours = numeric(input.hours ?? EV_EXTENSION_DEFAULTS.hours, "Betriebszeit", 0, 24);
  const consumption = numeric(input.consumption ?? EV_EXTENSION_DEFAULTS.consumption, "Fahrzeugverbrauch", 0, 1000);
  const pvKWp = optionalEnergy(input.pv, "PV-Leistung"), batteryKWh = optionalEnergy(input.battery, "Nutzbare Speicherenergie pro Tag");
  const sourceConnection = input.sourceConnection ?? "house";
  if (!["house", "grid"].includes(sourceConnection)) throw new Error("Anschlusspunkt von PV und Speicher wählen.");
  const kind = input.chargerKind ?? "auto";
  if (!["auto", "ac1", "ac3", "dc"].includes(kind)) throw new Error("Ladeart wählen.");
  if (input.powerMode !== undefined && !["preset", "custom"].includes(input.powerMode)) throw new Error("Leistungsauswahl prüfen.");
  const chargerKind = kind === "auto" ? power === 3.7 || power === 7.4 ? "ac1" : [50, 150, 350].includes(power) ? "dc" : "ac3" : kind;
  const phases: 1 | 3 = chargerKind === "ac1" ? 1 : 3;
  const factorMode = input.factorMode ?? "manual";
  if (!["manual", "reference"].includes(factorMode)) throw new Error("Grundlage des Gleichzeitigkeitsfaktors wählen.");
  const referenceDetails = input.mode === "static" && factorMode === "reference" ? publishedEVFactorDetails(input.userClass ?? "residents", count, power, input.powerMode === "custom") : null;
  const referenceFactor = referenceDetails?.value ?? null;
  const referenceFormula = referenceDetails ? `k = min(1, ${referenceDetails.coefficient} × ${count}^(${referenceDetails.exponent})) = ${referenceFactor?.toLocaleString("de-CH", { maximumFractionDigits: 4 })}` : null;
  const factorFallback = input.mode === "static" && factorMode === "reference" && referenceFactor === null;
  const diversity = input.mode !== "static" ? 1 : factorMode === "reference" ? referenceFactor ?? 1 : numeric(input.diversity, "Planungsfaktor", 0, 1, true);
  const minimumPower = input.mode === "dynamic" ? numeric(input.minimumPower ?? "3.7", "Mindestleistung im Projektmodell", 0, 3000) : 0;
  if (input.mode === "dynamic" && minimumPower > power + TOLERANCE) throw new Error("Mindestleistung im Projektmodell darf die konfigurierte Punktleistung nicht überschreiten.");

  const houseKW = house * KW_PER_THREE_PHASE_AMP, gridKW = grid * KW_PER_THREE_PHASE_AMP;
  const pvKW = pvKWp * .7, batteryKW = batteryKWh / hours, generationKW = pvKW + batteryKW;
  const houseNetKW = Math.max(0, houseKW - reserve + (sourceConnection === "house" ? generationKW : 0));
  const networkAvailableKW = Math.min(gridKW, houseNetKW);
  const available = networkAvailableKW + (sourceConnection === "grid" ? generationKW : 0), installed = count * power;
  const reserveCurrent = reserve / KW_PER_THREE_PHASE_AMP, generationCurrent = generationKW / KW_PER_THREE_PHASE_AMP;
  const availablePhaseCurrent = available / KW_PER_THREE_PHASE_AMP;
  const currentPowerFactor = phases === 1 ? .230 : KW_PER_THREE_PHASE_AMP;
  const pointLimit = (active: number) => active === 0 ? 0 : Math.max(0, Math.min(power, available / active,
    availablePhaseCurrent * currentPowerFactor / (phases === 1 ? Math.ceil(active / 3) : active)));

  let activeCount = input.mode === "static" ? Math.min(count, Math.ceil(count * diversity - TOLERANCE)) : count;
  if (input.mode === "dynamic") while (activeCount > 0 && pointLimit(activeCount) < minimumPower - TOLERANCE) activeCount--;
  const perPoint = input.mode === "none" ? power : pointLimit(activeCount);
  if (input.mode !== "none" && perPoint <= TOLERANCE) activeCount = 0;
  const waitingCount = count - activeCount;
  const pointPowers = Array.from({ length: count }, (_, index) => index < activeCount ? perPoint : 0);
  const pointPhases = Array.from({ length: count }, (_, index) => phases === 1 ? index % 3 + 1 : 0);
  const phaseCurrents: [number, number, number] = [0, 0, 0];
  for (let index = 0; index < activeCount; index++) {
    if (phases === 1) phaseCurrents[index % 3] += perPoint / .230;
    else for (let phase = 0; phase < 3; phase++) phaseCurrents[phase] += perPoint / KW_PER_THREE_PHASE_AMP;
  }
  const gridPhaseCurrents = phaseCurrents.map(current => current - (sourceConnection === "grid" ? generationCurrent : 0));
  const housePhaseCurrents = phaseCurrents.map(current => current + reserveCurrent - generationCurrent);
  const strongestPhaseCurrent = Math.max(...phaseCurrents), perPointCurrent = perPoint / currentPowerFactor;
  const strongestGridPhaseCurrent = Math.max(...gridPhaseCurrents.map(Math.abs)), strongestHousePhaseCurrent = Math.max(...housePhaseCurrents.map(Math.abs));
  const allocated = activeCount * perPoint, requestedActiveCount = input.mode === "static" ? Math.min(count, Math.ceil(count * diversity - TOLERANCE)) : count;
  const requested = requestedActiveCount * power;
  const requestedPhaseCurrent = (phases === 1 ? Math.ceil(requestedActiveCount / 3) : requestedActiveCount) * power / currentPowerFactor;
  const phaseCapacityOK = strongestGridPhaseCurrent <= grid + TOLERANCE && strongestHousePhaseCurrent <= house + TOLERANCE;
  const energyPerDay = allocated * hours, energyPerActive = activeCount > 0 ? energyPerDay / activeCount : 0;
  const kmPerActive = energyPerActive / consumption * 100;
  const houseImportKW = Math.max(0, reserve + allocated - generationKW), houseExportKW = Math.max(0, generationKW - reserve - allocated);
  const gridImportKW = Math.max(0, allocated - (sourceConnection === "grid" ? generationKW : 0));
  const gridExportKW = Math.max(0, (sourceConnection === "grid" ? generationKW : 0) - allocated);
  const usedGenerationKW = Math.min(generationKW, reserve + allocated);
  const generationEnergy = generationKW * hours, usedGenerationEnergy = usedGenerationKW * hours;
  return { houseKW, gridKW, available, networkAvailableKW, installed, requested, allocated, appliedFactor: diversity,
    factorMode, referenceFactor, referenceFormula, factorFallback, chargerKind, phases, activeCount, waitingCount, throttledCount: perPoint < power - TOLERANCE ? activeCount : 0,
    pointPowers, pointPhases, phaseCurrents, strongestPhaseCurrent, perPointCurrent, availablePhaseCurrent, reserveCurrent,
    gridPhaseCurrents, housePhaseCurrents, strongestGridPhaseCurrent, strongestHousePhaseCurrent,
    hours, consumption, pvKWp, batteryKWh, sourceConnection, pvKW, batteryKW, generationKW, generationCurrent,
    energyPerDay, energyPerActive, kmPerActive, generationEnergy, usedGenerationEnergy, houseImportKW, houseExportKW, gridImportKW, gridExportKW,
    requestedActiveCount, minimumPower, perPoint, balancedCurrent: allocated / KW_PER_THREE_PHASE_AMP, phaseCapacityOK,
    capacityOK: requested <= available + TOLERANCE && requestedPhaseCurrent <= availablePhaseCurrent + TOLERANCE && phaseCapacityOK,
    reserveExceeded: reserve > houseKW && houseImportKW > houseKW + TOLERANCE, limited: input.mode !== "none" && allocated < installed - TOLERANCE };
}
