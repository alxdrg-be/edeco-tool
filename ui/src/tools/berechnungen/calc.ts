import {
  ALPHA_PER_K,
  MCB_STEPS_A,
  OPERATING_TEMP_C,
  SHORT_CIRCUIT_WARM_C,
  guidanceReactancePerKm,
  nextRating,
  resistancePerKm,
  type Material,
} from "./conductors.ts";
import { sectionForCurrent, type Insulation, type InstallMethod } from "./iz.ts";

export { NIN_VOLTAGE_DROP_LIMIT_PERCENT, SERVICE_FUSE_A, sectionsFor } from "./conductors.ts";
export type { Material } from "./conductors.ts";
export { sectionForCurrent } from "./iz.ts";

export type PhaseSystem = 1 | 3;
export type Tone = "ok" | "warn" | "over";

export type CalcResult<T> = { ok: true; value: T } | { ok: false; message: string };

function fail(message: string): CalcResult<never> {
  return { ok: false, message };
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function nonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function cosOk(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function toneFor(percent: number, limit: number): Tone {
  if (percent > limit) return "over";
  if (percent > limit * 0.8) return "warn";
  return "ok";
}

export interface Impedance {
  rPerKm: number;
  xPerKm: number;
  rOhm: number;
  xOhm: number;
  sinPhi: number;
}

function oneWayImpedance(
  material: Material,
  sectionMm2: number,
  lengthM: number,
  parallel: number,
  cosPhi: number,
  tempC: number,
): CalcResult<Impedance> {
  if (!positive(lengthM) || !positive(parallel)) return fail("Länge und Leiterzahl müssen grösser als null sein.");
  const rPerKm = resistancePerKm(material, sectionMm2, tempC);
  if (rPerKm === null) {
    return fail(material === "al"
      ? "Aluminium ist erst ab 10 mm² hinterlegt (SN EN 60228)."
      : "Für diesen Querschnitt ist kein Leiterwiderstand hinterlegt.");
  }
  const xPerKm = guidanceReactancePerKm(sectionMm2);
  if (xPerKm === null) return fail("Für diesen Querschnitt ist kein Richtwert X′ hinterlegt.");
  const rOhm = rPerKm / 1000 / parallel * lengthM;
  const xOhm = xPerKm / 1000 / parallel * lengthM;
  return { ok: true, value: { rPerKm, xPerKm, rOhm, xOhm, sinPhi: Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi)) } };
}

export interface VoltageDropInput {
  phases: PhaseSystem;
  material: Material;
  sectionMm2: number;
  currentA: number;
  lengthM: number;
  cosPhi: number;
  limitPercent: number;
  parallel?: number;
}

export interface VoltageDrop {
  unV: number;
  factor: 2 | "sqrt3";
  rPerKm: number;
  xPerKm: number;
  rOhm: number;
  xOhm: number;
  sinPhi: number;
  deltaUV: number;
  deltaUPercent: number;
  endVoltageV: number;
  maxLengthM: number;
  barPercent: number;
  tone: Tone;
}

/** ΔU = √3 · I · (R·cosφ + X·sinφ), with 2 instead of √3 for a single-phase go-and-return path. */
export function voltageDrop(input: VoltageDropInput): CalcResult<VoltageDrop> {
  const parallel = input.parallel ?? 1;
  if (!positive(input.currentA) || !positive(input.limitPercent) || !cosOk(input.cosPhi)) {
    return fail("Strom, Grenzwert und cos φ prüfen.");
  }
  const impedance = oneWayImpedance(input.material, input.sectionMm2, input.lengthM, parallel, input.cosPhi, OPERATING_TEMP_C);
  if (!impedance.ok) return impedance;
  const { rPerKm, xPerKm, rOhm, xOhm, sinPhi } = impedance.value;
  const factor = input.phases === 1 ? 2 : Math.sqrt(3);
  const deltaUV = factor * input.currentA * (rOhm * input.cosPhi + xOhm * sinPhi);
  const unV = input.phases === 1 ? 230 : 400;
  const deltaUPercent = deltaUV / unV * 100;
  const perMeter = factor * input.currentA * (rOhm / input.lengthM * input.cosPhi + xOhm / input.lengthM * sinPhi);
  const maxLengthM = perMeter > 0 ? (input.limitPercent / 100 * unV) / perMeter : Infinity;
  return {
    ok: true,
    value: {
      unV, factor: input.phases === 1 ? 2 : "sqrt3", rPerKm, xPerKm, rOhm, xOhm, sinPhi,
      deltaUV, deltaUPercent, endVoltageV: unV - deltaUV, maxLengthM,
      barPercent: Math.min(deltaUPercent / input.limitPercent * 100, 100),
      tone: toneFor(deltaUPercent, input.limitPercent),
    },
  };
}

export interface PowerLossInput extends VoltageDropInput {
  parallel: number;
  pricePerKwh: number;
  hoursPerDay: number;
  days: number;
  years: number;
}

export interface PowerLoss extends VoltageDrop {
  lossW: number;
  energyKwh: number;
  costChf: number;
}

/** Pv = 3 · I² · R′ · L, with 2 instead of 3 on a single-phase circuit. ΔU includes cos φ. */
export function powerLoss(input: PowerLossInput): CalcResult<PowerLoss> {
  if (!nonNegative(input.pricePerKwh) || !nonNegative(input.hoursPerDay) || !nonNegative(input.days) || !nonNegative(input.years)) {
    return fail("Betriebszeit und Preis dürfen nicht negativ sein.");
  }
  const drop = voltageDrop(input);
  if (!drop.ok) return drop;
  const lossFactor = input.phases === 1 ? 2 : 3;
  const lossW = lossFactor * input.currentA * input.currentA * (drop.value.rOhm / input.lengthM) * input.lengthM;
  const energyKwh = lossW / 1000 * input.hoursPerDay * input.days * input.years;
  return { ok: true, value: { ...drop.value, lossW, energyKwh, costChf: energyKwh * input.pricePerKwh } };
}

export interface ShortCircuitInput {
  unV: 230 | 400;
  apparentPowerVa: number;
  ukPercent: number;
  material: Material;
  sectionMm2: number;
  lengthM: number;
  parallel: number;
}

export interface ShortCircuit {
  zkOhm: number;
  ikMaxA: number;
  ikMinA: number;
  ikMaxLabel: string;
  ikMinLabel: string;
}

/** Upper bound treats the transformer as reactance and ignores the upstream grid. Not an IEC 60909 study. */
export function shortCircuit(input: ShortCircuitInput): CalcResult<ShortCircuit> {
  if (!positive(input.apparentPowerVa) || !positive(input.ukPercent) || !positive(input.parallel) || !nonNegative(input.lengthM)) {
    return fail("Trafo, uk und Leitung prüfen.");
  }
  const rCold = resistancePerKm(input.material, input.sectionMm2, 20);
  const xPerKm = guidanceReactancePerKm(input.sectionMm2);
  if (rCold === null) {
    return fail(input.material === "al"
      ? "Aluminium ist erst ab 10 mm² hinterlegt (SN EN 60228)."
      : "Für diesen Querschnitt ist kein Leiterwiderstand hinterlegt.");
  }
  if (xPerKm === null) return fail("Für diesen Querschnitt ist kein Richtwert X′ hinterlegt.");
  const unV = input.unV;
  const zkOhm = input.ukPercent / 100 * unV * unV / input.apparentPowerVa;
  const rOhm = rCold / 1000 * input.lengthM / input.parallel;
  const xOhm = xPerKm / 1000 * input.lengthM / input.parallel;
  const goReturn = unV === 230 ? 2 : 1;
  const resistance = goReturn * rOhm;
  const reactance = zkOhm + goReturn * xOhm;
  const zMax = Math.hypot(resistance, reactance);
  const ikMaxA = unV === 230 ? 1.05 * unV / zMax : 1.05 * unV / (Math.sqrt(3) * zMax);
  const warm = 1 + ALPHA_PER_K[input.material] * (SHORT_CIRCUIT_WARM_C - 20);
  const loop = 2 * Math.hypot(rOhm * warm, xOhm);
  const ikMinA = 0.95 * 230 / (zkOhm + loop);
  return {
    ok: true,
    value: {
      zkOhm, ikMaxA, ikMinA,
      ikMaxLabel: "Obere Schranke: Trafo als Reaktanz, ohne Netzimpedanz, cmax = 1,05. Keine IEC-60909-Studie.",
      ikMinLabel: "Untere Schranke: warme Schleife L–PE bei 80 °C, Schutzleiter = Aussenleiter, U0 = 230 V, cmin = 0,95.",
    },
  };
}

export interface TransformerInput {
  apparentPowerVa: number;
  primaryV: number;
  secondaryV: number;
  ukPercent: number;
  noLoadPercent: number;
  loadPercent: number;
}

export interface Transformer {
  primaryA: number;
  secondaryA: number;
  shortCircuitA: number;
  voltageFactor: 1;
  impedanceOhm: number;
  ratio: number;
  noLoadA: number;
  loadA: number;
  ikLabel: string;
}

/** Ik = In · 100 / uk at a rigid grid, voltage factor c = 1. */
export function transformer(input: TransformerInput): CalcResult<Transformer> {
  if (!positive(input.apparentPowerVa) || !positive(input.primaryV) || !positive(input.secondaryV) || !positive(input.ukPercent)) {
    return fail("Leistung, Spannungen und uk müssen grösser als null sein.");
  }
  if (!nonNegative(input.noLoadPercent) || !nonNegative(input.loadPercent)) return fail("Leerlaufstrom und Auslastung prüfen.");
  const primaryA = input.apparentPowerVa / (Math.sqrt(3) * input.primaryV);
  const secondaryA = input.apparentPowerVa / (Math.sqrt(3) * input.secondaryV);
  return {
    ok: true,
    value: {
      primaryA, secondaryA,
      shortCircuitA: secondaryA * 100 / input.ukPercent,
      voltageFactor: 1,
      impedanceOhm: input.ukPercent / 100 * input.secondaryV * input.secondaryV / input.apparentPowerVa,
      ratio: input.primaryV / input.secondaryV,
      noLoadA: primaryA * input.noLoadPercent / 100,
      loadA: secondaryA * input.loadPercent / 100,
      ikLabel: "Ik bei starrem Netz, Spannungsfaktor c = 1.",
    },
  };
}

export interface ReactiveInput {
  activePowerW: number;
  cosBefore: number;
  cosTarget: number;
  unV: 230 | 400;
  phases: PhaseSystem;
}

export interface Reactive {
  kvar: number;
  beforeVar: number;
  afterVar: number;
  beforeVa: number;
  afterVa: number;
  beforeA: number;
  afterA: number;
}

/** Qc = P · (tan φ1 − tan φ2). No compensation when the target cos φ is not higher. */
export function reactiveCompensation(input: ReactiveInput): CalcResult<Reactive> {
  if (!positive(input.activePowerW)) return fail("Wirkleistung muss grösser als null sein.");
  if (!(input.cosBefore > 0 && input.cosBefore <= 1 && input.cosTarget > 0 && input.cosTarget <= 1)) {
    return fail("cos φ muss zwischen 0 und 1 liegen.");
  }
  const target = input.cosTarget > input.cosBefore ? input.cosTarget : input.cosBefore;
  const beforeVar = input.activePowerW * Math.tan(Math.acos(input.cosBefore));
  const afterVar = input.activePowerW * Math.tan(Math.acos(target));
  const beforeVa = input.activePowerW / input.cosBefore;
  const afterVa = input.activePowerW / target;
  const phaseFactor = input.phases === 3 ? Math.sqrt(3) : 1;
  return {
    ok: true,
    value: {
      kvar: input.cosTarget > input.cosBefore ? (beforeVar - afterVar) / 1000 : 0,
      beforeVar, afterVar, beforeVa, afterVa,
      beforeA: beforeVa / (phaseFactor * input.unV),
      afterA: afterVa / (phaseFactor * input.unV),
    },
  };
}

export interface OhmsDc {
  voltageV: number;
  currentA: number;
  resistanceOhm: number;
  powerW: number;
}

export function ohmsDc(input: { voltageV?: number; currentA?: number; resistanceOhm?: number }): CalcResult<OhmsDc> {
  const u = input.voltageV;
  const i = input.currentA;
  const r = input.resistanceOhm;
  const known = [u, i, r].filter((value) => value !== undefined && Number.isFinite(value));
  if (known.length < 2) return fail("Zwei Grössen angeben.");
  let voltageV = u;
  let currentA = i;
  let resistanceOhm = r;
  if (voltageV === undefined && currentA !== undefined && resistanceOhm !== undefined) voltageV = currentA * resistanceOhm;
  if (currentA === undefined && voltageV !== undefined && resistanceOhm !== undefined) {
    if (resistanceOhm === 0) return fail("Widerstand null ergibt keinen Strom.");
    currentA = voltageV / resistanceOhm;
  }
  if (resistanceOhm === undefined && voltageV !== undefined && currentA !== undefined) {
    if (currentA === 0) return fail("Strom null ergibt keinen Widerstand.");
    resistanceOhm = voltageV / currentA;
  }
  if (voltageV === undefined || currentA === undefined || resistanceOhm === undefined) return fail("Zwei Grössen angeben.");
  if (![voltageV, currentA, resistanceOhm].every(Number.isFinite)) return fail("Eingabe prüfen.");
  return { ok: true, value: { voltageV, currentA, resistanceOhm, powerW: voltageV * currentA } };
}

export interface OhmsAc {
  apparentVa: number;
  activeW: number;
  reactiveVar: number;
  angleDeg: number;
}

export function ohmsAc(input: { phases: PhaseSystem; voltageV: number; currentA: number; cosPhi: number }): CalcResult<OhmsAc> {
  if (!positive(input.voltageV) || !positive(input.currentA) || !cosOk(input.cosPhi)) return fail("Spannung, Strom und cos φ prüfen.");
  const apparentVa = (input.phases === 3 ? Math.sqrt(3) : 1) * input.voltageV * input.currentA;
  const activeW = apparentVa * input.cosPhi;
  return {
    ok: true,
    value: {
      apparentVa, activeW,
      reactiveVar: Math.sqrt(Math.max(0, apparentVa * apparentVa - activeW * activeW)),
      angleDeg: Math.acos(input.cosPhi) * 180 / Math.PI,
    },
  };
}

const CU_SECTIONS = [2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

export function snapUpCu(sectionMm2: number): number {
  return CU_SECTIONS.find((section) => section >= sectionMm2 - 1e-9) ?? CU_SECTIONS[CU_SECTIONS.length - 1];
}

export interface EquipotentialInput {
  phaseMm2: number;
  penMm2: number;
  lightningProtection: boolean;
}

export interface Equipotential {
  hpaMm2: number;
  peMm2: number;
  opaMm2: number;
  penTooSmall: boolean;
}

/** HPA from the NIN 5.4.4 steps, minimum 10 mm² with LPS, capped at 16. ÖPA ignores the LPS minimum. */
export function equipotential(input: EquipotentialInput): CalcResult<Equipotential> {
  if (!positive(input.phaseMm2) || !positive(input.penMm2)) return fail("Querschnitte prüfen.");
  const fromTable = input.phaseMm2 <= 10 ? 6 : input.phaseMm2 <= 35 ? 10 : 16;
  const hpaMm2 = Math.min(16, Math.max(input.lightningProtection ? 10 : 6, fromTable));
  const peMm2 = input.phaseMm2 <= 16 ? input.phaseMm2 : input.phaseMm2 <= 35 ? 16 : snapUpCu(input.phaseMm2 / 2);
  const opaMm2 = snapUpCu(Math.max(4, peMm2 / 2));
  return { ok: true, value: { hpaMm2, peMm2, opaMm2, penTooSmall: input.penMm2 < peMm2 } };
}

/** Fixed start-current multiples stated on the motor screen. */
export const START_FACTORS = { direct: 6, star: 2, soft: 3, vfd: 1.2 } as const;
export type StartKind = keyof typeof START_FACTORS;

/** IEC 60034-30-1 IE3, 4-pole, 50 Hz. A default until the nameplate value is known. */
export const IE3_4POLE_ETA: Record<number, number> = {
  0.37: 0.773, 0.55: 0.808, 0.75: 0.825, 1.1: 0.841, 1.5: 0.853, 2.2: 0.867, 3: 0.877,
  4: 0.886, 5.5: 0.896, 7.5: 0.904, 11: 0.914, 15: 0.921, 18.5: 0.926, 22: 0.93,
  30: 0.936, 37: 0.939, 45: 0.942, 55: 0.946, 75: 0.95,
};

export interface MotorInput {
  powerW: number;
  cosPhi: number;
  eta: number;
  start: StartKind;
  insulation: Insulation;
  method: InstallMethod;
}

export interface Motor {
  currentA: number;
  startA: number;
  factor: number;
  apparentVa: number;
  section: { sectionMm2: number; izA: number } | null;
}

export function motor(input: MotorInput): CalcResult<Motor> {
  if (!positive(input.powerW) || !(input.cosPhi > 0 && input.cosPhi <= 1) || !(input.eta > 0 && input.eta <= 1)) {
    return fail("Leistung, cos φ und Wirkungsgrad prüfen.");
  }
  const currentA = input.powerW / (Math.sqrt(3) * 400 * input.cosPhi * input.eta);
  const factor = START_FACTORS[input.start];
  return {
    ok: true,
    value: {
      currentA, factor, startA: currentA * factor,
      apparentVa: Math.sqrt(3) * 400 * currentA,
      section: sectionForCurrent(currentA, input.insulation, input.method),
    },
  };
}

export const CHARGE_OPTIONS = [
  { id: "3.7", kw: 3.7, phases: 1 as PhaseSystem, label: "3,7 kW · 1-phasig" },
  { id: "7.4", kw: 7.4, phases: 1 as PhaseSystem, label: "7,4 kW · 1-phasig" },
  { id: "11", kw: 11, phases: 3 as PhaseSystem, label: "11 kW · 3-phasig" },
  { id: "22", kw: 22, phases: 3 as PhaseSystem, label: "22 kW · 3-phasig" },
] as const;

export type SiaClass = "bewohner" | "beschaeftigte" | "besucher" | "share";
export type ConnectionPoint = "haus" | "grid";

/** Published example points only. This is not the licensed SIA 2060 table 15. */
const SIA_EXAMPLES: Record<Exclude<SiaClass, "share">, readonly (readonly [number, number])[]> = {
  bewohner: [[1, 1], [5, 0.42], [10, 0.32], [20, 0.24], [50, 0.17]],
  beschaeftigte: [[1, 1], [5, 0.42], [10, 0.32], [20, 0.24], [50, 0.17]],
  besucher: [[1, 1], [5, 0.51], [20, 0.32]],
};

export function approximateSiaFactor(siaClass: Exclude<SiaClass, "share">, count: number): { k: number; approximate: true } {
  const points = SIA_EXAMPLES[siaClass];
  if (count <= points[0][0]) return { k: points[0][1], approximate: true };
  for (let index = 1; index < points.length; index += 1) {
    const [n0, k0] = points[index - 1];
    const [n1, k1] = points[index];
    if (count <= n1) {
      const t = (count - n0) / (n1 - n0);
      return { k: k0 + t * (k1 - k0), approximate: true };
    }
  }
  return { k: points[points.length - 1][1], approximate: true };
}

export interface ChargeInput {
  count: number;
  kwEach: number;
  phases: PhaseSystem;
  management: "none" | "static";
  siaClass: SiaClass;
  share: number;
  hausA: number;
  gridA: number;
  connection: ConnectionPoint;
  reserveKw: number;
  pvKwp: number;
  batteryKwh: number;
  batteryHours: number;
}

export interface Charge {
  k: number;
  approximate: boolean;
  factorNote: string;
  powerKw: number;
  hausKw: number;
  gridKw: number;
  availableKw: number;
  utilization: number;
  tone: Tone;
  stationA: number;
  strongestPhaseA: number;
  deviceA: number | null;
  reliefKw: number;
}

export function chargeInstallation(input: ChargeInput): CalcResult<Charge> {
  if (!Number.isInteger(input.count) || input.count < 1) return fail("Anzahl Ladepunkte als ganze Zahl ab 1.");
  if (!positive(input.kwEach) || !positive(input.hausA) || !positive(input.gridA)) return fail("Leistung und Sicherungen prüfen.");
  if (!nonNegative(input.reserveKw) || !nonNegative(input.pvKwp) || !nonNegative(input.batteryKwh) || !nonNegative(input.batteryHours)) {
    return fail("Reserve, PV und Batterie dürfen nicht negativ sein.");
  }
  if (input.management === "static" && input.siaClass === "share" && !(input.share >= 0 && input.share <= 1)) {
    return fail("Der Anteil muss zwischen 0 und 100 % liegen.");
  }
  let k = 1;
  let approximate = false;
  let factorNote = "Ohne Lastmanagement gilt k = 1 (NIN 7.22).";
  if (input.management === "static") {
    if (input.siaClass === "share") {
      k = input.share;
      factorNote = "Statisches Lastmanagement mit selbst gewähltem Anteil.";
    } else if (input.siaClass === "besucher" && input.kwEach !== 11) {
      k = 1;
      approximate = true;
      factorNote = "Die Besucher-Näherung nennt nur 11 kW. Gerechnet mit k = 1.";
    } else {
      const sample = approximateSiaFactor(input.siaClass, input.count);
      k = sample.k;
      approximate = true;
      factorNote = "Näherung aus veröffentlichten Beispielwerten der SIA 2060, Tabelle 15. Nicht die lizenzierte Tabelle.";
    }
  }
  const powerKw = input.count * input.kwEach * k;
  const hausKw = input.hausA * 400 * Math.sqrt(3) / 1000;
  const gridKw = Math.min(input.gridA, input.hausA) * 400 * Math.sqrt(3) / 1000;
  const reliefKw = input.pvKwp * 0.7 + (input.batteryHours > 0 ? input.batteryKwh / input.batteryHours : 0);
  const hausNet = Math.max(0, hausKw - input.reserveKw);
  const availableKw = input.connection === "haus"
    ? Math.min(gridKw, hausNet + reliefKw)
    : Math.min(gridKw, hausNet) + reliefKw;
  const utilization = availableKw > 1e-9 ? powerKw / availableKw * 100 : powerKw > 0 ? Infinity : 0;
  const stationA = input.phases === 1 ? input.kwEach * 1000 / 230 : input.kwEach * 1000 / (Math.sqrt(3) * 400);
  const scaledA = stationA * k;
  const strongestPhaseA = input.phases === 1 ? Math.ceil(input.count / 3) * scaledA : input.count * scaledA;
  return {
    ok: true,
    value: {
      k, approximate, factorNote, powerKw, hausKw, gridKw, availableKw, reliefKw,
      utilization, tone: toneFor(utilization, 100), stationA, strongestPhaseA,
      deviceA: nextRating(stationA, MCB_STEPS_A),
    },
  };
}

export interface LightingInput {
  illuminanceLux: number;
  lengthM: number;
  widthM: number;
  heightM: number;
  workplaneM: number;
  fluxLm: number;
  eta: number;
  maintenance: number;
  luminairePowerW: number | null;
}

export interface Lighting {
  areaM2: number;
  roomIndex: number;
  count: number;
  totalFluxLm: number;
  currentA: number | null;
}

/** n = ceil(E · A / (Φ · η · MF)). η is whatever the caller supplies; it is not a LiTG table. */
export function lighting(input: LightingInput): CalcResult<Lighting> {
  if (!positive(input.illuminanceLux) || !positive(input.lengthM) || !positive(input.widthM) || !positive(input.fluxLm)) {
    return fail("Beleuchtungsstärke, Raummasse und Lichtstrom prüfen.");
  }
  if (!(input.eta > 0 && input.eta <= 1) || !(input.maintenance > 0 && input.maintenance <= 1)) {
    return fail("η und Wartungsfaktor müssen zwischen 0 und 1 liegen.");
  }
  const mountingHeight = input.heightM - input.workplaneM;
  if (!(mountingHeight > 0)) return fail("Die Nutzebene muss unter der Raumhöhe liegen.");
  const areaM2 = input.lengthM * input.widthM;
  const roomIndex = areaM2 / (mountingHeight * (input.lengthM + input.widthM));
  const totalFluxLm = input.illuminanceLux * areaM2 / (input.eta * input.maintenance);
  const count = Math.ceil(totalFluxLm / input.fluxLm - 1e-9);
  const currentA = input.luminairePowerW === null ? null : count * input.luminairePowerW / 230;
  if (currentA !== null && !nonNegative(input.luminairePowerW ?? 0)) return fail("Leuchtenleistung prüfen.");
  return { ok: true, value: { areaM2, roomIndex, count, totalFluxLm, currentA } };
}
