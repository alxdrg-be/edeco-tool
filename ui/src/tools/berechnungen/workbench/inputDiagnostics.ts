import type { DiagnosticTarget } from "../DiagnosticDetails";
import { InputError } from "./types.ts";

export class RowInputError extends InputError {
  readonly target: DiagnosticTarget;
  constructor(target: DiagnosticTarget, error: unknown, actual = "") {
    const original = error instanceof Error ? error.message : "Positionsangaben prüfen.";
    super(target.field, original, error instanceof InputError ? error.required : "Die im Hinweis genannte Daten- oder Modellbedingung muss erfüllt sein.", error instanceof InputError ? error.actual : actual);
    this.target = target;
  }
}

const PROPERTY_WORDS: Record<string, [RegExp, string][]> = {
  costRows: [[/inbetriebnahme/i,"commission"],[/bezeichnung/i,"label"],[/ganze ladepunktzahl|anzahl/i,"count"],[/nennleistung| · leistung$/i,"power"],[/beschaffung/i,"hardware"],[/installation/i,"installation"],[/basisinfrastruktur/i,"basis"],[/jahresenergie/i,"annualEnergy"],[/ersatz/i,"replacement"],[/leistungskategorie|kostenvorgabe/i,"preset"]],
  grids: [[/projekt.?mindestleistung|mindestleistung/i,"minimum"],[/ladeleistung|nennleistung/i,"power"],[/wirkungsgrad/i,"efficiency"],[/ganze anzahl|anzahl/i,"count"],[/vorsicherung/i,"amps"],[/anwenderklasse|nutzerklasse|referenzkurve/i,"userClass"],[/leistungsanteil|gleichzeitigkeitsanteil/i,"factor"]],
  depotUnits: [[/modulleistung/i,"modulePower"],[/modul/i,"modules"],[/wirkungsgrad/i,"efficiency"],[/vorsicherung/i,"gridAmps"],[/lastmanagement/i,"mode"],[/gridfaktor/i,"factor"]],
  depotPoints: [[/zugeordnete power unit/i,"unitId"],[/mindestleistung/i,"minimum"],[/punktleistung/i,"power"],[/abgabepunkt|abgabepunkte/i,"ports"],[/leistungsanteil/i,"factor"]],
  poeSegments: [[/bündel|anzahl|geometrie/i,"numCables"],[/kanalbreite/i,"width"],[/leitertemperatur/i,"temperature"],[/umgebung/i,"ambient"],[/datenblatt|quellenvermerk/i,"evidence"],[/durchmesser/i,"diameter"],[/aderwiderstand/i,"resistance"],[/dämpfung/i,"attenuation"],[/längenfaktor/i,"classFactor"],[/länge/i,"length"],[/einbauzustand/i,"installCondition"],[/kabeltyp|zuordnung/i,"cableType"],[/schirmung/i,"shielding"]],
  selectivityStages: [[/nennstrom/i,"rated"],[/länge/i,"length"],[/r\/x|querschnitt/i,"area"],[/herstellerquelle|quellenvermerk|hersteller.*(?:geräte|tabellenquelle)/i,"pairReference"],[/herstellergrenze|paargrenze/i,"pairLimitKA"],[/einphas|dreiphas/i,"system"]],
  fireloadRows: [[/bezeichnung|herstellerbeleg/i,"name"],[/brandlast/i,"mjPerMeter"],[/anzahl/i,"quantity"],[/länge/i,"length"],[/cpr/i,"cpr"],[/nachweis|brandverhalten/i,"evidence"]],
  siaZones: [[/leistungsziel|ziel leistung/i,"powerTarget"],[/energieziel|ziel energie/i,"energyTarget"],[/fläche/i,"area"],[/kcor/i,"kcor"],[/jahresgleichzeitigkeit/i,"yearGlz"],[/bezeichnung/i,"label"]],
  loadBoards: [[/gleichzeitigkeit/i,"diversity"],[/leistung/i,"watts"],[/anzahl/i,"count"],[/bezeichnung/i,"label"]],
  rtvSegments: [[/dämpfung/i,"attenuation"],[/länge/i,"length"],[/pegel/i,"gain"],[/bezeichnung/i,"label"]],
  costItems: [[/einheitspreis/i,"price"],[/menge/i,"quantity"],[/bezeichnung/i,"label"],[/bkp/i,"code"],[/gruppe/i,"group"]],
};

export function propertyForLabel(field: string, label: string): string | undefined {
  if (field === "siaZones") {
    const consumer = label.match(/ · ([a-z]+) · Roh(leistung|energie)/i);
    if (consumer) return `${consumer[1]}.${consumer[2].toLowerCase() === "leistung" ? "powerDensity" : "energyDensity"}`;
  }
  if (field === "fireloadRowsAfter") field = "fireloadRows";
  return PROPERTY_WORDS[field]?.find(([pattern]) => pattern.test(label))?.[1];
}

/** Add the stable row identity at the point where that row is calculated. */
export function withInputRow<T>(field: string, row: { id: string }, index: number, calculate: () => T): T {
  try { return calculate(); }
  catch (error) {
    if (error instanceof RowInputError) throw error;
    const message = error instanceof Error ? error.message : "";
    const property = error instanceof InputError && error.field !== "value" ? error.field : propertyForLabel(field, message);
    throw new RowInputError({ field, rowId: row.id, rowIndex: index, ...(property ? { property } : {}) }, error);
  }
}
