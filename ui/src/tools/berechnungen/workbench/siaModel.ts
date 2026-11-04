import { withInputRow } from "./inputDiagnostics.ts";
import { InputError } from "./types.ts";
import { SIA_GROUPS, type SIAGroupId } from "./siaData.ts";

export interface SIAConsumerInput { groupId: SIAGroupId; powerDensity: number; energyDensity: number }
export interface SIAZoneInput {
  id: string; label: string; area: number; kcor: number; yearGlz: number;
  powerTarget?: number; energyTarget?: number; consumers: SIAConsumerInput[];
}
export interface SIAInput { zones: SIAZoneInput[]; pvYearKWh: number; pvSelfConsumptionPercent: number }
export interface SIAGroupBalance {
  groupId: SIAGroupId; rawPowerKW: number; powerKW: number; rawEnergyKWh: number; energyKWh: number;
  powerDensity: number; energyDensity: number;
}
export interface SIAZoneBalance {
  id: string; label: string; area: number; kcor: number; yearGlz: number; groups: SIAGroupBalance[];
  rawPowerKW: number; powerKW: number; rawEnergyKWh: number; energyKWh: number;
  powerDensity: number; energyDensity: number; powerTarget?: number; energyTarget?: number;
  powerExceeded: boolean; energyExceeded: boolean;
}
export interface SIABalance {
  zones: SIAZoneBalance[]; groups: SIAGroupBalance[]; area: number;
  rawPowerKW: number; powerKW: number; rawEnergyKWh: number; energyKWh: number;
  powerDensity: number; energyDensity: number; powerTarget?: number; energyTarget?: number;
  pvConsumedKWh: number; netEnergyKWh: number; exceedsTargets: boolean;
}
const groups = new Set<string>(SIA_GROUPS.map(group => group.id));
function nonnegative(value: unknown, label: string, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) throw new Error(`${label}: Zahl von 0 bis ${maximum} eingeben.`);
  return value;
}
function positive(value: unknown, label: string, maximum: number): number {
  const parsed = nonnegative(value, label, maximum);
  if (parsed === 0) throw new Error(`${label}: grösser als 0 eingeben.`);
  return parsed;
}
const add = <T>(items: T[], read: (item: T) => number) => items.reduce((sum, item) => sum + read(item), 0);
const label = (value: unknown, name: string) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) throw new Error(`${name}: Bezeichnung mit 1 bis 100 Zeichen eingeben.`);
  return value.trim();
};
export function createSIAZone(id = "zone-1", name = "Zone 1"): SIAZoneInput {
  return { id, label: name, area: 100, kcor: 1, yearGlz: 1, consumers: SIA_GROUPS.map(group => ({ groupId: group.id, powerDensity: 0, energyDensity: 0 })) };
}

/** Independent power/annual-energy balances. Kcor acts only on power; yearGlz only on energy. */
export function calculateSIABalance(input: SIAInput): SIABalance {
  if (!input || !Array.isArray(input.zones) || input.zones.length === 0 || input.zones.length > 20) throw new Error("Eine bis 20 Nutzungszonen erfassen.");
  const ids = new Set<string>();
  const zones = input.zones.map((zone, index): SIAZoneBalance => withInputRow("siaZones",zone,index,()=>{
    if (!zone || typeof zone !== "object") throw new Error(`Zone ${index + 1}: gültige Daten erfassen.`);
    const id = label(zone.id, "Zonen-ID"), name = label(zone.label, "Zonenname");
    if (ids.has(id)) throw new Error("Zonen-IDs müssen eindeutig sein."); ids.add(id);
    const area = positive(zone.area, `${name} · Fläche`, 1e7), kcor = nonnegative(zone.kcor, `${name} · Kcor`, 5), yearGlz = nonnegative(zone.yearGlz, `${name} · Jahresgleichzeitigkeit`, 1);
    const powerTarget = zone.powerTarget === undefined ? undefined : nonnegative(zone.powerTarget, `${name} · Leistungsziel`, 1e6);
    const energyTarget = zone.energyTarget === undefined ? undefined : nonnegative(zone.energyTarget, `${name} · Energieziel`, 1e7);
    if (!Array.isArray(zone.consumers) || zone.consumers.length !== SIA_GROUPS.length) throw new Error(`${name}: alle sieben Verbrauchergruppen mit expliziten Kennwerten erfassen; ungenutzte Gruppen mit 0.`);
    const found = new Set<string>();
    const balances = zone.consumers.map((consumer): SIAGroupBalance => {
      if (!consumer || !groups.has(consumer.groupId) || found.has(consumer.groupId)) throw new Error(`${name}: jede bekannte Verbrauchergruppe genau einmal erfassen.`);
      found.add(consumer.groupId);
      const rawP = nonnegative(consumer.powerDensity, `${name} · ${consumer.groupId} · Rohleistung`, 1e6), rawE = nonnegative(consumer.energyDensity, `${name} · ${consumer.groupId} · Rohenergie`, 1e7);
      return { groupId: consumer.groupId, rawPowerKW: rawP * area / 1000, powerKW: rawP * area * kcor / 1000,
        rawEnergyKWh: rawE * area, energyKWh: rawE * area * yearGlz, powerDensity: rawP * kcor, energyDensity: rawE * yearGlz };
    });
    const rawPowerKW = add(balances, group => group.rawPowerKW), powerKW = add(balances, group => group.powerKW), rawEnergyKWh = add(balances, group => group.rawEnergyKWh), energyKWh = add(balances, group => group.energyKWh);
    const powerDensity = powerKW * 1000 / area, energyDensity = energyKWh / area;
    return { id, label: name, area, kcor, yearGlz, groups: SIA_GROUPS.map(group => balances.find(item => item.groupId === group.id)!), rawPowerKW, powerKW, rawEnergyKWh, energyKWh, powerDensity, energyDensity, powerTarget, energyTarget,
      powerExceeded: powerTarget !== undefined && powerDensity > powerTarget + 1e-9, energyExceeded: energyTarget !== undefined && energyDensity > energyTarget + 1e-9 };
  }));
  const area = add(zones, zone => zone.area), rawPowerKW = add(zones, zone => zone.rawPowerKW), powerKW = add(zones, zone => zone.powerKW), rawEnergyKWh = add(zones, zone => zone.rawEnergyKWh), energyKWh = add(zones, zone => zone.energyKWh);
  const pv = nonnegative(input.pvYearKWh, "PV-Jahresertrag", 1e12), self = nonnegative(input.pvSelfConsumptionPercent, "PV-Eigenverbrauchsanteil", 100);
  const pvConsumedKWh = Math.min(energyKWh, pv * self / 100);
  const totalGroups = SIA_GROUPS.map((group): SIAGroupBalance => {
    const zoneGroups = zones.map(zone => zone.groups.find(item => item.groupId === group.id)!);
    const groupP = add(zoneGroups, item => item.powerKW), groupE = add(zoneGroups, item => item.energyKWh);
    return { groupId: group.id, rawPowerKW: add(zoneGroups, item => item.rawPowerKW), powerKW: groupP, rawEnergyKWh: add(zoneGroups, item => item.rawEnergyKWh), energyKWh: groupE, powerDensity: groupP * 1000 / area, energyDensity: groupE / area };
  });
  return { zones, groups: totalGroups, area, rawPowerKW, powerKW, rawEnergyKWh, energyKWh, powerDensity: powerKW * 1000 / area, energyDensity: energyKWh / area,
    powerTarget: zones.every(zone => zone.powerTarget !== undefined) ? add(zones, zone => zone.powerTarget! * zone.area) / area : undefined,
    energyTarget: zones.every(zone => zone.energyTarget !== undefined) ? add(zones, zone => zone.energyTarget! * zone.area) / area : undefined,
    pvConsumedKWh, netEnergyKWh: Math.max(0, energyKWh - pvConsumedKWh), exceedsTargets: zones.some(zone => zone.powerExceeded || zone.energyExceeded) };
}

/** UI edits may retain numeric strings, including empty invalid values; never coerce blanks to zero. */
export function parseSIAZones(raw: string): SIAZoneInput[] {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("Nutzungszonen konnten nicht gelesen werden. Eingaben prüfen."); }
  if (!Array.isArray(parsed)) throw new Error("Nutzungszonen als Liste erfassen.");
  const read = (value: unknown, field = "value"): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && /^\d+(?:[.,]\d+)?$/.test(value.trim())) return Number(value.trim().replace(",", "."));
    throw new InputError(field,"Alle Kennwerte und Faktoren explizit ausfüllen; leere Felder sind keine Nullwerte.","Eine explizite endliche Zahl eingeben; ungenutzte Verbraucher mit 0 erfassen.",typeof value === "string"?value||"leer":String(value));
  };
  return parsed.map((zone,index) => {
    if (!zone || typeof zone !== "object" || Array.isArray(zone)) throw new Error("Ungültige Nutzungszone.");
    const item = zone as Record<string, unknown>;
    return withInputRow("siaZones",{id:typeof item.id === "string" ? item.id : ""},index,()=>({ id: item.id as string, label: item.label as string, area: read(item.area,"area"), kcor: read(item.kcor,"kcor"), yearGlz: read(item.yearGlz,"yearGlz"),
      ...(item.powerTarget === undefined ? {} : { powerTarget: read(item.powerTarget,"powerTarget") }), ...(item.energyTarget === undefined ? {} : { energyTarget: read(item.energyTarget,"energyTarget") }),
      consumers: Array.isArray(item.consumers) ? item.consumers.map(value => {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Ungültige Verbrauchergruppe.");
        const consumer = value as Record<string, unknown>;
        return { groupId: consumer.groupId as SIAGroupId, powerDensity: read(consumer.powerDensity,`${consumer.groupId}.powerDensity`), energyDensity: read(consumer.energyDensity,`${consumer.groupId}.energyDensity`) };
      }) : [] }));
  });
}
