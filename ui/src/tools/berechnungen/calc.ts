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
import { shortCircuitVoltageFactors } from "./voltageFactors.ts";
import { publishedEVFactor } from "./EVdata.ts";

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
  if (!positive(lengthM) || !Number.isInteger(parallel) || parallel < 1) return fail("Länge und Leiterzahl müssen grösser als null sein.");
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
function voltageDropModel(input: VoltageDropInput): CalcResult<VoltageDrop> {
  const parallel = input.parallel ?? 1;
  if (![1, 3].includes(input.phases)) return fail("Einphasig oder dreiphasig wählen.");
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
  if (deltaUV >= unV) return fail("Spannungsfall erreicht die Nennspannung: lineares Modell ausserhalb des gültigen Bereichs. Last, Länge und Querschnitt gemeinsam prüfen.");
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
function powerLossModel(input: PowerLossInput): CalcResult<PowerLoss> {
  if (input.hoursPerDay > 24 || input.days > 366) return fail("Betriebsstunden pro Tag höchstens 24; Betriebstage pro Jahr höchstens 366.");
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
  voltageTolerance?: "plus10" | "plus6";
}

export interface ShortCircuit {
  zkOhm: number;
  ikMaxA: number;
  ikMinA: number;
  ikMaxLabel: string;
  ikMinLabel: string;
  coldImpedanceOhm: number;
  warmLoopOhm: number;
  cMax: number;
}

/** Simplified cold/warm model; no guaranteed upper/lower bound or complete IEC60909 study. */
function shortCircuitModel(input: ShortCircuitInput): CalcResult<ShortCircuit> {
  if (![230, 400].includes(input.unV) || !Number.isInteger(input.parallel) || input.parallel < 1 || input.ukPercent > 100 || !positive(input.apparentPowerVa) || !positive(input.ukPercent) || !nonNegative(input.lengthM)) {
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
  const { cMax } = shortCircuitVoltageFactors(input.voltageTolerance ?? "plus10");
  const unV = input.unV;
  const zkOhm = input.ukPercent / 100 * unV * unV / input.apparentPowerVa;
  const rOhm = rCold / 1000 * input.lengthM / input.parallel;
  const xOhm = xPerKm / 1000 * input.lengthM / input.parallel;
  const goReturn = unV === 230 ? 2 : 1;
  const resistance = goReturn * rOhm;
  const reactance = zkOhm + goReturn * xOhm;
  const zMax = Math.hypot(resistance, reactance);
  const ikMaxA = unV === 230 ? cMax * unV / zMax : cMax * unV / (Math.sqrt(3) * zMax);
  const warm = 1 + ALPHA_PER_K[input.material] * (SHORT_CIRCUIT_WARM_C - 20);
  const loop = 2 * Math.hypot(rOhm * warm, xOhm);
  const ikMinA = 0.95 * 230 / (zkOhm + loop);
  return {
    ok: true,
    value: {
      zkOhm, ikMaxA, ikMinA, cMax, coldImpedanceOhm: zMax, warmLoopOhm: zkOhm + loop,
      ikMaxLabel: `Kaltes Modell: Trafo als Reaktanz, ohne Netzimpedanz, cmax = ${cMax}. Keine garantierte obere Schranke oder IEC-60909-Studie.`,
      ikMinLabel: "Warmes L–PE-Modell bei 80 °C, PE = Aussenleiter und U0 = 230 V. Vorgelagerter Schleifenanteil nicht erfasst; keine garantierte untere Schranke oder Abschaltfreigabe.",
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
function transformerModel(input: TransformerInput): CalcResult<Transformer> {
  if (!positive(input.apparentPowerVa) || !positive(input.primaryV) || !positive(input.secondaryV) || !positive(input.ukPercent)) {
    return fail("Leistung, Spannungen und uk müssen grösser als null sein.");
  }
  if (input.ukPercent > 100 || input.noLoadPercent > 100 || !nonNegative(input.noLoadPercent) || !nonNegative(input.loadPercent)) return fail("Leerlaufstrom und Auslastung prüfen.");
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
function reactiveCompensationModel(input: ReactiveInput): CalcResult<Reactive> {
  if (![1, 3].includes(input.phases) || ![230, 400].includes(input.unV)) return fail("Unterstütztes Phasensystem und Spannung wählen.");
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

function ohmsDcModel(input: { voltageV?: number; currentA?: number; resistanceOhm?: number; powerW?: number }): CalcResult<OhmsDc> {
  const supplied=[input.voltageV,input.currentA,input.resistanceOhm,input.powerW].filter(value=>value!==undefined);
  if(supplied.length!==2||!supplied.every(value=>Number.isFinite(value)&&value!>=0)||input.resistanceOhm===0) return fail("Genau zwei endliche, nicht negative Grössen aus U/I/R/P angeben; R muss grösser als 0 sein.");
  let u=input.voltageV,i=input.currentA,r=input.resistanceOhm;
  const p=input.powerW;
  if(p!==undefined){
    if(r!==undefined){u=Math.sqrt(p)*Math.sqrt(r);i=Math.sqrt(p)/Math.sqrt(r);}
    else if(u!==undefined){if(u===0||p===0)return fail("P und U müssen für einen eindeutigen endlichen Widerstand grösser als 0 sein.");i=p/u;r=u/i;}
    else if(i!==undefined){if(i===0||p===0)return fail("P und I müssen für einen eindeutigen endlichen Widerstand grösser als 0 sein.");u=p/i;r=u/i;}
  }else if(u!==undefined&&i!==undefined){if(i===0)return fail("U und I mit I = 0 bestimmen keinen endlichen Widerstand.");r=u/i;}
  else if(u!==undefined&&r!==undefined)i=u/r;
  else if(i!==undefined&&r!==undefined)u=i*r;
  if(u===undefined||i===undefined||r===undefined||!(r>0))return fail("Die Eingaben bestimmen keinen positiven endlichen ohmschen Widerstand.");
  return {ok:true,value:{voltageV:u,currentA:i,resistanceOhm:r,powerW:p??u*i}};
}

export interface OhmsAc {
  apparentVa: number;
  activeW: number;
  reactiveVar: number;
  angleDeg: number;
}

function ohmsAcModel(input: { phases: PhaseSystem; voltageV: number; currentA: number; cosPhi: number }): CalcResult<OhmsAc> {
  if (![1, 3].includes(input.phases)) return fail("Einphasig oder dreiphasig wählen.");
  if (!positive(input.voltageV) || !positive(input.currentA) || !cosOk(input.cosPhi)) return fail("Spannung, Strom und cos φ prüfen.");
  const apparentVa = (input.phases === 3 ? Math.sqrt(3) : 1) * input.voltageV * input.currentA;
  const activeW = apparentVa * input.cosPhi;
  return {
    ok: true,
    value: {
      apparentVa, activeW,
      reactiveVar: apparentVa * Math.sqrt(Math.max(0, 1 - input.cosPhi * input.cosPhi)),
      angleDeg: Math.acos(input.cosPhi) * 180 / Math.PI,
    },
  };
}

const CU_SECTIONS = [2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];

export function snapUpCu(sectionMm2: number): number {
  const found = CU_SECTIONS.find(section => section >= sectionMm2 - 1e-9);
  if (!positive(sectionMm2) || found === undefined) throw new Error("Kein ausreichend grosser Standardquerschnitt hinterlegt.");
  return found;
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

/** Bounded published Cu reference behavior, not an independently verified NIN table or PEN approval. */
function equipotentialModel(input: EquipotentialInput): CalcResult<Equipotential> {
  if (![4,6,10,16,25,35,50,70,95,120].includes(input.phaseMm2) || ![4,6,10,16,25,35,50,70,95,120].includes(input.penMm2)) return fail("Publizierte Cu-Zuordnung nur für 4–120 mm² verfügbar; darüber dokumentierte Projektwerte verwenden.");
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

function motorModel(input: MotorInput): CalcResult<Motor> {
  if (!positive(input.powerW) || !(input.cosPhi > 0 && input.cosPhi <= 1) || !(input.eta > 0 && input.eta <= 1)) {
    return fail("Leistung, cos φ und Wirkungsgrad prüfen.");
  }
  if (!["direct","star","soft","vfd"].includes(input.start) || !["PVC","XLPE"].includes(input.insulation) || !["B1","B2","C","D","E"].includes(input.method)) return fail("Gültiges Anlaufmodell und belegte Kabelgrundwerte wählen.");
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

/** Published reference curve, not an independently verified SIA norm table. */
export function approximateSiaFactor(siaClass: Exclude<SiaClass, "share">, count: number, power = 11): { k: number; approximate: true } {
  if (!["bewohner", "beschaeftigte", "besucher"].includes(siaClass)) throw new Error("Anwenderklasse wählen.");
  const k = publishedEVFactor(siaClass === "besucher" ? "visitors" : "residents", count, power);
  if (k === null) throw new Error("Keine veröffentlichte Kurve für diese Kombination; eigenen Faktor belegen.");
  return { k, approximate: true };
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

function chargeInstallationModel(input: ChargeInput): CalcResult<Charge> {
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 10000) return fail("1 bis 10'000 Ladepunkte als ganze Zahl eingeben.");
  if (![1,3].includes(input.phases) || !["none","static"].includes(input.management) || !["haus","grid"].includes(input.connection) || !["bewohner","beschaeftigte","besucher","share"].includes(input.siaClass)) return fail("Phasen, Lastmanagement und Anschlussort gültig wählen.");
  if (!positive(input.kwEach) || !positive(input.hausA) || !positive(input.gridA)) return fail("Leistung und Sicherungen prüfen.");
  if (![input.reserveKw,input.pvKwp,input.batteryKwh,input.batteryHours].every(nonNegative)) return fail("Reserve, PV und Speicher müssen endlich und nicht negativ sein.");
  if (input.batteryKwh > 0 && input.batteryHours <= 0) return fail("Für eine aktive Speicherannahme Betriebsstunden grösser als 0 eingeben.");
  let k = 1, approximate = false, factorNote = "Ohne Lastmanagement: k = 1. Keine automatische Gerätefreigabe.";
  if (input.management === "static") {
    if (input.siaClass === "share") {
      if (!Number.isFinite(input.share) || input.share < 0 || input.share > 1) return fail("Eigenen Gleichzeitigkeitsanteil zwischen 0 und 1 eingeben.");
      k = input.share; factorNote = "Eigener dokumentierter Gleichzeitigkeitsanteil; keine Simulation des Lastmanagements.";
    } else {
      k = approximateSiaFactor(input.siaClass, input.count, input.kwEach).k; approximate = true;
      factorNote = "Veröffentlichte Referenzkurve; keine unabhängig bestätigte SIA-Normtabelle oder Regler-Simulation.";
    }
  }
  const kwPerA = Math.sqrt(3)*400/1000, hausKw=input.hausA*kwPerA, gridKw=input.gridA*kwPerA;
  const reliefKw=Math.min(.7*input.pvKwp+(input.batteryKwh>0?input.batteryKwh/input.batteryHours:0),hausKw,input.connection==="grid"?gridKw:hausKw);
  const powerKw=input.count*input.kwEach*k;
  const availableKw=Math.max(0,Math.min(gridKw+(input.connection==="grid"?reliefKw:0),hausKw-input.reserveKw+reliefKw));
  if (availableKw===0&&powerKw>0) return fail("Keine verfügbare Anschlussreserve für die Ladung. Gebäudereserve, reale Einspeisung und Quellenannahme gemeinsam prüfen.");
  const stationA=input.kwEach*1000/(input.phases===1?230:Math.sqrt(3)*400), sourceA=reliefKw/kwPerA, reserveA=input.reserveKw/kwPerA;
  const loadPhases=[0,1,2].map(phase=>(input.phases===1?Math.floor((input.count+2-phase)/3):input.count)*stationA*k);
  const strongestPhaseA=Math.max(...loadPhases.map(current=>Math.abs(current-(input.connection==="grid"?sourceA:0))));
  const housePhaseA=Math.max(...loadPhases.map(current=>Math.abs(current+reserveA-sourceA)));
  const utilization=Math.max(availableKw>0?powerKw/availableKw*100:0,strongestPhaseA/input.gridA*100,housePhaseA/input.hausA*100);
  return {ok:true,value:{k,approximate,factorNote,powerKw,hausKw,gridKw,availableKw,utilization,tone:toneFor(utilization,100),stationA,strongestPhaseA,deviceA:nextRating(stationA,MCB_STEPS_A),reliefKw}};
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
function lightingModel(input: LightingInput): CalcResult<Lighting> {
  if (!positive(input.illuminanceLux) || !positive(input.lengthM) || !positive(input.widthM) || !positive(input.fluxLm)) {
    return fail("Beleuchtungsstärke, Raummasse und Lichtstrom prüfen.");
  }
  if (!(input.eta > 0 && input.eta <= 1) || !(input.maintenance > 0 && input.maintenance <= 1)) {
    return fail("η und Wartungsfaktor müssen zwischen 0 und 1 liegen.");
  }
  if (!positive(input.heightM) || !nonNegative(input.workplaneM)) return fail("Raumhöhe und Nutzebene prüfen.");
  const mountingHeight = input.heightM - input.workplaneM;
  if (!(mountingHeight > 0)) return fail("Die Nutzebene muss unter der Raumhöhe liegen.");
  const areaM2 = input.lengthM * input.widthM;
  const roomIndex = areaM2 / (mountingHeight * (input.lengthM + input.widthM));
  const totalFluxLm = input.illuminanceLux * areaM2 / (input.eta * input.maintenance);
  const count = Math.ceil(totalFluxLm / input.fluxLm);
  const currentA = input.luminairePowerW === null ? null : count * input.luminairePowerW / 230;
  if (currentA !== null && !nonNegative(input.luminairePowerW ?? 0)) return fail("Leuchtenleistung prüfen.");
  return { ok: true, value: { areaM2, roomIndex, count, totalFluxLm, currentA } };
}

function checked<T>(calculate: () => CalcResult<T>): CalcResult<T> {
  try {
    const result = calculate();
    const finite = (value: unknown): boolean => typeof value === "number" ? Number.isFinite(value) : value !== null && typeof value === "object" ? Object.values(value).every(finite) : value !== undefined;
    return result.ok && !finite(result.value) ? fail("Ergebnis ausserhalb des berechenbaren Zahlenbereichs; Eingaben und Einheiten prüfen.") : result;
  } catch (error) { return fail(error instanceof Error && !(error instanceof TypeError) ? error.message : "Ungültige Auswahl oder nicht unterstützte Rechendaten. Eingaben prüfen."); }
}
export const voltageDrop = (input: VoltageDropInput) => checked(() => voltageDropModel(input));
export const powerLoss = (input: PowerLossInput) => checked(() => powerLossModel(input));
export const shortCircuit = (input: ShortCircuitInput) => checked(() => shortCircuitModel(input));
export const transformer = (input: TransformerInput) => checked(() => transformerModel(input));
export const reactiveCompensation = (input: ReactiveInput) => checked(() => reactiveCompensationModel(input));
export const ohmsDc = (input: { voltageV?: number; currentA?: number; resistanceOhm?: number; powerW?: number }) => checked(() => ohmsDcModel(input));
export const ohmsAc = (input: { phases: PhaseSystem; voltageV: number; currentA: number; cosPhi: number }) => checked(() => ohmsAcModel(input));
export const equipotential = (input: EquipotentialInput) => checked(() => equipotentialModel(input));
export const motor = (input: MotorInput) => checked(() => motorModel(input));
export const chargeInstallation = (input: ChargeInput) => checked(() => chargeInstallationModel(input));
export const lighting = (input: LightingInput) => checked(() => lightingModel(input));
