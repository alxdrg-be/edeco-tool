import { POE_CABLE_REFERENCES, POE_CABLE_SOURCE, type PoeCableReference } from "./referenceInstallationData.ts";
import { type CalculatorDefinition, type CalculationResult, type Field, type Inputs } from "./types.ts";

export const POE_ROUTE_SOURCE = POE_CABLE_SOURCE;
export const POE_ROUTE_QUALIFICATION = "Publizierte Referenzannahmen · thermische Koeffizienten und Normzuordnung unbestätigt";
export const POE_ROUTE_CLASSES = ["D", "E", "EA", "F", "FA"] as const;
export const POE_INSTALLATIONS = [
  { value: "EF", label: "Freie Luft · E/F-Referenzansatz", factor: .2312 },
  { value: "C", label: "Offener Kanal · C-Referenzansatz", factor: .3088 },
  { value: "B", label: "Geschlossener Kanal · B-Referenzansatz", factor: .48 },
  { value: "A", label: "Isolierter Einbau · A-Referenzansatz", factor: 1.08 },
] as const;
export const POE_RP_DESIGN = { RP1: 0, RP2: .499, RP3: .5 } as const;
export const POE_PATCH_PRESETS = [
  { factor: 1.2, diameter: 5.5, resistance: 9.5 },
  { factor: 1.5, diameter: 6, resistance: 13 },
  { factor: 2, diameter: 4.5, resistance: 17.8 },
] as const;
export const POE_ROUTE_TYPES = [
  { type: "1", label: "Typ 1", pairs: 2, conductors: 4, conductorCurrent: .175 },
  { type: "2", label: "Typ 2", pairs: 2, conductors: 4, conductorCurrent: .3 },
  { type: "3", label: "Typ 3", pairs: 4, conductors: 8, conductorCurrent: .325 },
  { type: "4", label: "Typ 4", pairs: 4, conductors: 8, conductorCurrent: .5 },
] as const;
const REFERENCE_LENGTH_BUDGETS: Record<string, readonly number[]> = { D: [109, 107, 105], E: [104, 103, 102], EA: [104, 103, 102], F: [105, 103, 102], FA: [105, 103, 102] };
export const POE_ROUTE_GEOMETRY_LIMIT = .6718 / .016;
export const POE_ROUTE_CHANNEL_LIMIT = 100;
export interface PoeRouteSegmentInput {
  id: string; label: string; cableType: string; length: string; numCables: string; width: string;
  ambient: string; installCondition: string; temperature: string;
  diameter: string; resistance: string; attenuation: string; classFactor: string;
  shielding: string; shieldCorrection: string; evidence: string;
}
export interface PoeEvaluatedSegment {
  id: string; label: string; kind: "patch" | "cable"; cableLabel: string; physicalLength: number; equivalent20: number;
  ambient: number; temperature: number; rise: number; cableCount: number; attenuation: number; lengthFactor: number;
  diameter: number; resistance20: number; geometry?: number; thermalCorrection?: number; installation: string;
}
export interface PoeRouteResult {
  segments: PoeEvaluatedSegment[]; physicalChannel: number; permanentLink: number; electricalLength20: number;
  referenceLimit: number; referenceReserve: number; channelReserve: number; weightedTemperature: number;
  allowedLengthApprox: number; rpCategory: "RP1" | "RP2" | "RP3"; designCurrent: number; effectiveCurrent: number | null;
  thermalMode: string; transmissionClass: string; connectors: number; patchFactor: number; channelWithin: boolean; referenceWithin: boolean;
}
export function defaultPoeRouteSegment(id = "cable-1"): PoeRouteSegmentInput {
  return { id, label: "Kabelabschnitt 1", cableType: "cat6a-s-awg23", length: "80", numCables: "24", width: "50", ambient: "25", installCondition: "EF", temperature: "30", diameter: "7.5", resistance: "7.5", attenuation: "0.2", classFactor: "1", shielding: "/s", shieldCorrection: "0", evidence: "" };
}
function value(raw: string | undefined, label: string, min: number, max: number, integer = false) {
  if (typeof raw !== "string" || !/^-?\d+(?:[.,]\d+)?$/.test(raw.trim())) throw new Error(`${label}: gültige Zahl eingeben.`);
  const result = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(result) || result < min || result > max || integer && !Number.isInteger(result)) throw new Error(`${label}: ${integer ? "ganze Zahl, " : ""}${min} bis ${max} eingeben.`);
  return result;
}
const positive = (raw: string | undefined, label: string, max = 1e6) => { const n = value(raw, label, 0, max); if (n <= 0) throw new Error(`${label}: grösser als 0 eingeben.`); return n; };
function choice(input: Inputs, key: string, choices: readonly string[]) { if (!choices.includes(input[key])) throw new Error(`${key}: gültige Auswahl treffen.`); return input[key]; }
export function parsePoeSegments(raw: string, editing = false): PoeRouteSegmentInput[] {
  let decoded: unknown; try { decoded = JSON.parse(raw); } catch { throw new Error("Kabelabschnitte: gültige Liste erforderlich."); }
  if (!Array.isArray(decoded) || decoded.length < 1 || decoded.length > 32) throw new Error("1 bis 32 Kabelabschnitte erfassen.");
  const keys = Object.keys(defaultPoeRouteSegment()) as (keyof PoeRouteSegmentInput)[];
  const used = new Set<string>();
  const rows = decoded.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Abschnitt ${index + 1}: Datenobjekt erforderlich.`);
    const data = entry as Record<string, unknown>;
    for (const key of keys) if (typeof data[key] !== "string") throw new Error(`Abschnitt ${index + 1}: ${key} fehlt oder ist ungültig.`);
    const row = data as unknown as PoeRouteSegmentInput;
    if (!row.id.trim() || row.id.length > 80 || used.has(row.id)) throw new Error("Kabelabschnitte benötigen eindeutige Kennungen.");
    used.add(row.id);
    if (!editing && (!row.label.trim() || row.label.length > 80)) throw new Error(`Abschnitt ${index + 1}: Bezeichnung mit 1 bis 80 Zeichen eingeben.`);
    return row;
  });
  return rows;
}
export function poeBundleGeometry(count: number, width: number, diameter: number) {
  if (![count, width, diameter].every(Number.isFinite) || count < 1 || !Number.isInteger(count) || width < diameter || diameter <= 0) throw new Error("Bündelgeometrie: Anzahl, Kanalbreite und Durchmesser prüfen.");
  const occupiedWidth = count * diameter;
  const layers = occupiedWidth / width;
  return occupiedWidth <= width ? count : width / (diameter * (1 + (layers - 1) * Math.sqrt(3) / 2));
}
function thermalCorrection(geometry: number) {
  return geometry <= 1 ? 1 : geometry <= 10 ? .9868 - .0825 * geometry + .0035 * geometry ** 2 : .6718 - .016 * geometry;
}
export function poeTemperaturePenalty(temperature: number, attenuation: number) {
  if (![temperature, attenuation].every(Number.isFinite) || attenuation < 0) throw new Error("Temperatur und Dämpfungskoeffizient prüfen.");
  return Math.max(0, temperature - 20) * attenuation / 100 + (attenuation === .4 ? Math.max(0, temperature - 40) * .002 : 0);
}
export function poeEquivalentLength(length: number, temperature: number, attenuation: number, lengthFactor: number) {
  if (![length, lengthFactor].every(Number.isFinite) || length < 0 || lengthFactor <= 0) throw new Error("Physische Länge und elektrischen Längenfaktor prüfen.");
  return length * (1 + poeTemperaturePenalty(temperature, attenuation)) / lengthFactor;
}
export function referencePoeRise(count: number, width: number, cable: Pick<PoeCableReference, "diameter" | "resistance20" | "shieldCorrection">, installationFactor: number, designCurrent: number, priority: boolean) {
  const geometry = poeBundleGeometry(count, width, cable.diameter);
  if (geometry >= POE_ROUTE_GEOMETRY_LIMIT) throw new Error(`Bündelgeometrie J = ${geometry.toLocaleString("de-CH", { maximumFractionDigits: 2 })} ausserhalb der veröffentlichten Rechenkurve.`);
  if (count > 2000 || ![cable.resistance20, cable.shieldCorrection, installationFactor, designCurrent].every(Number.isFinite) || cable.resistance20 <= 0 || installationFactor < 0 || designCurrent < 0 || designCurrent > .5) throw new Error("Thermische Referenzparameter ausserhalb des unterstützten Bereichs.");
  let rise = 0;
  for (let samples = 1; samples <= count; samples++) {
    const index = poeBundleGeometry(samples, width, cable.diameter);
    if (index >= POE_ROUTE_GEOMETRY_LIMIT) continue;
    const linearHeat = samples * (3.2 - (priority ? cable.shieldCorrection : 0));
    const boundaryHeat = installationFactor * Math.sqrt(samples) / cable.diameter * 1000;
    rise = Math.max(rise, (linearHeat + boundaryHeat) * designCurrent ** 2 * cable.resistance20 / 100 * thermalCorrection(index));
  }
  return { rise, geometry, correction: thermalCorrection(geometry) };
}
function cableProperties(row: PoeRouteSegmentInput, cls: string, thermalMode: string): PoeCableReference {
  const predefined = POE_CABLE_REFERENCES.find(cable => cable.id === row.cableType);
  if (predefined) {
    if (!Object.hasOwn(predefined.referenceLengthFactors, cls)) throw new Error(`${row.label}: keine veröffentlichte Zuordnung ${predefined.label} zu Klasse ${cls}.`);
    return predefined;
  }
  if (row.cableType !== "custom") throw new Error(`${row.label}: Kabeltyp wählen.`);
  if (thermalMode !== "manual") throw new Error(`${row.label}: eigener Kabeldatensatz benötigt manuell dokumentierte Leitertemperatur; thermische Kalibrierung dafür nicht belegt.`);
  if (!row.evidence.trim() || row.evidence.length > 180) throw new Error(`${row.label}: Datenblatt-/Quellenvermerk für den eigenen Kabeldatensatz eingeben.`);
  if (!["/s", "/u"].includes(row.shielding)) throw new Error(`${row.label}: Schirmung wählen.`);
  return { id: row.cableType, label: `Eigener Datensatz · ${row.evidence}`, resistance20: positive(row.resistance, "Aderwiderstand", 100), diameter: positive(row.diameter, "Kabeldurchmesser", 50), shielding: row.shielding, referenceLengthFactors: { [cls]: positive(row.classFactor, "Längenfaktor", 5) }, attenuationPerDegree: value(row.attenuation, "Dämpfungskoeffizient", 0, 2), shieldCorrection: 0 };
}
export function calculatePoeRoute(input: Inputs): PoeRouteResult {
  const rows = parsePoeSegments(input.poeSegments);
  const transmissionClass = choice(input, "poeClass", POE_ROUTE_CLASSES), connectors = Number(choice(input, "poeConnectors", ["2", "3", "4"]));
  const thermalMode = choice(input, "poeThermalMode", ["published", "manual"]), rpMode = choice(input, "poeRpMode", ["category", "mix"]);
  let effectiveCurrent: number | null = null, rpCategory: keyof typeof POE_RP_DESIGN;
  if (rpMode === "mix") {
    const mix = POE_ROUTE_TYPES.map(type => ({ ...type, share: value(input[`poeShare${type.type}`], `Anteil Typ ${type.type}`, 0, 100) / 100 }));
    const total = mix.reduce((sum, type) => sum + type.share, 0);
    if (total > 1 + 1e-9) throw new Error("PoE-Typanteile dürfen zusammen höchstens 100 % ergeben. Der Rest bleibt ungespeist.");
    effectiveCurrent = Math.sqrt(mix.reduce((sum, type) => sum + type.conductorCurrent ** 2 * type.conductors * type.share, 0) / 8);
    rpCategory = effectiveCurrent < .212 ? "RP1" : effectiveCurrent <= .499 ? "RP2" : "RP3";
  } else rpCategory = choice(input, "poeRpCategory", ["RP1", "RP2", "RP3"]) as keyof typeof POE_RP_DESIGN;
  const designCurrent = POE_RP_DESIGN[rpCategory];
  const patchFactor = Number(choice(input, "poePatchFactor", ["1.2", "1.5", "2"])), patch = POE_PATCH_PRESETS.find(row => row.factor === patchFactor)!;
  const patchMode = choice(input, "poePatchMode", ["reference", "manual"]);
  let patch1Length: number, patch2Length: number;
  if (patchMode === "reference") {
    const total = value(input.poePatchTotal, "Patchlänge gesamt", 0, 10000);
    patch1Length = Math.floor(total * (connectors === 4 ? 2 / 3 : .5)); patch2Length = total - patch1Length;
  } else { patch1Length = value(input.poePatch1Length, "Patchlänge am Verteiler", 0, 10000); patch2Length = value(input.poePatch2Length, "Patchlänge am Endgerät", 0, 10000); }
  const patchAmbient = value(input.poePatchAmbient, "Umgebung Patchkabel", -40, 100), shielding = choice(input, "poePatchShielding", ["/s", "/u"]);
  const priority = choice(input, "poeShieldPriority", ["no", "yes"]) === "yes";
  const segments: PoeEvaluatedSegment[] = [patch1Length, patch2Length].map((length, index) => {
    const count = value(input[`poePatchBundle${index + 1}`], `Patchbündel ${index + 1}`, 1, 2000, true);
    const rise = thermalMode === "manual" ? value(input[`poePatchTemperature${index + 1}`], `Leitertemperatur Patch ${index + 1}`, -40, 200) - patchAmbient : (3.2 * count + .2312 * Math.sqrt(count) / patch.diameter * 1000) * designCurrent ** 2 * patch.resistance / 100;
    const temperature = patchAmbient + rise, attenuation = shielding === "/s" ? .2 : .4;
    return { id: `patch-${index + 1}`, label: index === 0 ? "Patch am Verteiler" : "Patch am Endgerät", kind: "patch", cableLabel: `Patchfaktor ${patchFactor} · ${shielding === "/s" ? "geschirmt" : "ungeschirmt"}`, physicalLength: length, equivalent20: poeEquivalentLength(length, temperature, attenuation, 1 / patchFactor), ambient: patchAmbient, temperature, rise, cableCount: count, attenuation, lengthFactor: 1 / patchFactor, diameter: patch.diameter, resistance20: patch.resistance, installation: "Freie Luft · Patch-Referenzansatz" };
  });
  const cables = rows.map(row => {
    const cable = cableProperties(row, transmissionClass, thermalMode), count = value(row.numCables, `${row.label}: Bündelanzahl`, 1, 2000, true), width = positive(row.width, `${row.label}: Kanalbreite`, 1e5), ambient = value(row.ambient, `${row.label}: Umgebung`, -40, 100), length = positive(row.length, `${row.label}: Länge`, 10000);
    if (width < cable.diameter) throw new Error(`${row.label}: Kanalbreite muss mindestens dem Kabeldurchmesser entsprechen.`);
    const installation = POE_INSTALLATIONS.find(option => option.value === row.installCondition); if (!installation) throw new Error(`${row.label}: Einbauzustand wählen.`);
    const thermal = thermalMode === "manual" ? null : referencePoeRise(count, width, cable, installation.factor, designCurrent, priority);
    const temperature = thermalMode === "manual" ? value(row.temperature, `${row.label}: Leitertemperatur`, -40, 200) : ambient + thermal!.rise;
    return { id: row.id, label: row.label, kind: "cable" as const, cableLabel: cable.label, physicalLength: length, equivalent20: poeEquivalentLength(length, temperature, cable.attenuationPerDegree, cable.referenceLengthFactors[transmissionClass]), ambient, temperature, rise: temperature - ambient, cableCount: count, attenuation: cable.attenuationPerDegree, lengthFactor: cable.referenceLengthFactors[transmissionClass], diameter: cable.diameter, resistance20: cable.resistance20, ...(thermal ? { geometry: thermal.geometry, thermalCorrection: thermal.correction } : {}), installation: installation.label };
  });
  segments.splice(1, 0, ...cables);
  const permanentLink = cables.reduce((sum, segment) => sum + segment.physicalLength, 0), totalPatch = patch1Length + patch2Length;
  const physicalChannel = permanentLink + totalPatch, electricalLength20 = segments.reduce((sum, segment) => sum + segment.equivalent20, 0);
  const referenceLimit = REFERENCE_LENGTH_BUDGETS[transmissionClass][connectors - 2], referenceReserve = referenceLimit - electricalLength20;
  const weightedTemperature = segments.reduce((sum, segment) => sum + segment.temperature * segment.physicalLength, 0) / physicalChannel;
  const meanAttenuation = cables.reduce((sum, segment) => sum + segment.attenuation, 0) / cables.length;
  const allowedLengthApprox = (referenceLimit - totalPatch * (patchFactor - 1)) * (1 - poeTemperaturePenalty(weightedTemperature, meanAttenuation));
  if (!Number.isFinite(electricalLength20) || !Number.isFinite(weightedTemperature) || !Number.isFinite(allowedLengthApprox)) throw new Error("PoE-Streckenmodell ausserhalb des darstellbaren Bereichs.");
  return { segments, physicalChannel, permanentLink, electricalLength20, referenceLimit, referenceReserve, channelReserve: POE_ROUTE_CHANNEL_LIMIT - physicalChannel, weightedTemperature, allowedLengthApprox, rpCategory, designCurrent, effectiveCurrent, thermalMode, transmissionClass, connectors, patchFactor, channelWithin: physicalChannel <= 100 + 1e-9, referenceWithin: referenceReserve >= -1e-9 };
}
const numericField = (key: string, label: string, initial: string, unit: string, group: string, help: string, condition?: { key: string; values: string[] }[]): Field => ({ key, label, default: initial, unit, group, help, visibleWhen: condition });
const selectField = (key: string, label: string, initial: string, options: readonly (string | { value: string; label: string })[], group: string, help: string, condition?: { key: string; values: string[] }[]): Field => ({ key, label, default: initial, kind: "select", options: options.map(row => typeof row === "string" ? { value: row, label: row } : row), group, help, visibleWhen: condition });
export function createPoeRouteDefinition(legacy: CalculatorDefinition): CalculatorDefinition {
  const published = [{ key: "poeRouteMode", values: ["published"] }];
  const when = (key: string, values: string[]) => [...published, { key, values }];
  const fields: Field[] = [
    selectField("poeRouteMode", "Streckenmodell", "published", [{ value: "published", label: "Segmentiertes Referenzmodell" }, { value: "legacy", label: "Frühere manuelle Faktorprüfung" }], "Modell", "Thermik und generische Kabeldaten bleiben veröffentlichte Annahmen, kein Normnachweis."),
    ...legacy.fields.map(field => ({ ...field, visibleWhen: [...(field.visibleWhen ?? []), { key: "poeRouteMode", values: ["legacy"] }] })),
    selectField("poeClass", "Übertragungsklasse", "EA", [...POE_ROUTE_CLASSES], "Kanalmodell", "Kabel und Klasse benötigen eine hinterlegte Zuordnung; unpassende Kombinationen ergeben kein Resultat.", published),
    selectField("poeConnectors", "Stecksysteme", "2", ["2", "3", "4"], "Kanalmodell", "Die 20-°C-Modellbudgets 102–109 m ersetzen nicht die physische Kanalgrenze von 100 m.", published),
    selectField("poeThermalMode", "Temperaturgrundlage", "published", [{ value: "published", label: "Veröffentlichte thermische Referenzkurve" }, { value: "manual", label: "Leitertemperaturen manuell dokumentiert" }], "Kanalmodell", POE_ROUTE_QUALIFICATION, published),
    selectField("poeRpMode", "RP-Belastungsansatz", "category", [{ value: "category", label: "RP-Kategorie vorgeben" }, { value: "mix", label: "Typanteile im Bündel" }], "Belastung", "Designstrom wird aus der Kategorie angesetzt; diese generischen Ströme sind ungeprüfte Referenzannahmen.", published),
    selectField("poeRpCategory", "RP-Kategorie · Referenzansatz", "RP2", ["RP1", "RP2", "RP3"], "Belastung", "RP1 setzt im veröffentlichten Modell die PoE-Erwärmung auf 0 K; das ist kein Nachweis fehlender realer Erwärmung.", when("poeRpMode", ["category"])),
    ...POE_ROUTE_TYPES.map(type => numericField(`poeShare${type.type}`, `${type.label} · Kabelanteil`, type.type === "2" ? "100" : "0", "%", "Belastung", `${type.pairs} aktive Paare / ${type.conductors} Adern, Referenzstrom ${type.conductorCurrent} A je Ader. Rest bis 100 % ungespeist.`, when("poeRpMode", ["mix"]))),
    selectField("poeShieldPriority", "Thermische Schirmkorrektur", "no", [{ value: "no", label: "Ohne zusätzliche Schirmkorrektur" }, { value: "yes", label: "Publizierte Schirmkorrektur anwenden" }], "Belastung", "Kalibrierter Korrekturansatz der Referenz; keine bestätigte Norm- oder Herstellerzuordnung.", published),
    selectField("poePatchMode", "Verteilung der Patchlängen", "reference", [{ value: "reference", label: "Automatische Referenzaufteilung" }, { value: "manual", label: "Verteiler / Endgerät einzeln" }], "Patchabschnitte", "Referenz: bei vier Stecksystemen rund 2/3 am Verteiler, sonst rund die Hälfte; erster Anteil auf volle Meter abgerundet, Rest am Endgerät.", published),
    numericField("poePatchTotal", "Patchlänge gesamt", "10", "m", "Patchabschnitte", "Beide Patchseiten zusammen; physisch in der 100-m-Kanalgrenze enthalten.", when("poePatchMode", ["reference"])),
    numericField("poePatch1Length", "Patchlänge am Verteiler", "5", "m", "Patchabschnitte", "Tatsächliche Länge einschliesslich Anschlussleitung.", when("poePatchMode", ["manual"])),
    numericField("poePatch2Length", "Patchlänge am Endgerät", "5", "m", "Patchabschnitte", "Tatsächliche Länge einschliesslich Anschlussleitung.", when("poePatchMode", ["manual"])),
    selectField("poePatchFactor", "Patch-Längenfaktor · Referenz", "1.5", ["1.2", "1.5", "2"], "Patchabschnitte", "Generische Patchmodelle mit eigenem Durchmesser/Aderwiderstand, keine Herstellerdaten.", published),
    selectField("poePatchShielding", "Patch-Schirmung", "/s", [{ value: "/s", label: "Geschirmt · 0.2 %/K" }, { value: "/u", label: "Ungeschirmt · 0.4 %/K" }], "Patchabschnitte", "Temperaturabhängige Dämpfungsannahme der Referenz.", published),
    numericField("poePatchAmbient", "Umgebung Patchkabel", "25", "°C", "Patchabschnitte", "Gemeinsame Umgebungstemperatur beider Patchseiten.", published),
    numericField("poePatchBundle1", "Patchbündel am Verteiler", "24", "Kabel", "Patchabschnitte", "Anzahl gemeinsam betrachteter Patchkabel.", published),
    numericField("poePatchBundle2", "Patchbündel am Endgerät", "1", "Kabel", "Patchabschnitte", "Anzahl gemeinsam betrachteter Patchkabel.", published),
    numericField("poePatchTemperature1", "Leitertemperatur Patch Verteiler", "30", "°C", "Patchabschnitte", "Manuell belegte Leitertemperatur, keine berechnete Bündelerwärmung.", when("poeThermalMode", ["manual"])),
    numericField("poePatchTemperature2", "Leitertemperatur Patch Endgerät", "25", "°C", "Patchabschnitte", "Manuell belegte Leitertemperatur.", when("poeThermalMode", ["manual"])),
    { key: "poeSegments", label: "Kabelabschnitte", default: JSON.stringify([defaultPoeRouteSegment()]), kind: "text", group: "Kabelabschnitte", help: "Abschnitte über die Segmentkarten bearbeiten; keine frei geratene thermische Näherung.", visibleWhen: published },
  ];
  return { ...legacy, fields, description: "Patchseiten und beliebige Kabelabschnitte mit publizierten Temperatur-/RP-Annahmen oder eigenen dokumentierten Temperaturen vergleichen.", scope: "IEEE 802.3 · EN 50173 / ISO/IEC 11801 · segmentiertes Referenzmodell; thermische und RP-Normzuordnung unbestätigt", calculate(input) {
    const mode = input.poeRouteMode ?? "legacy";
    if (mode === "legacy") return legacy.calculate(input);
    if (mode !== "published") throw new Error("Streckenmodell wählen.");
    const route = calculatePoeRoute(input), bad = !route.channelWithin || !route.referenceWithin;
    const result: CalculationResult & { poeRoute: PoeRouteResult } = {
      poeRoute: route,
      metrics: [{ label: "Physische Kanallänge", value: route.physicalChannel, unit: "m", digits: 2, tone: route.channelWithin ? "neutral" : "error" }, { label: "Elektrische Länge · 20-°C-Modell", value: route.electricalLength20, unit: "m", digits: 2 }, { label: "Reserve zum Referenzbudget", value: route.referenceReserve, unit: "m", digits: 2, tone: route.referenceWithin ? "neutral" : "error" }, { label: "Längengewichtete Modelltemperatur", value: route.weightedTemperature, unit: "°C", digits: 1 }],
      status: { tone: bad ? "error" : "warning", text: !route.channelWithin ? "Physische Kanalgrenze von 100 m überschritten; ein grösseres 20-°C-Modellbudget gibt diese Strecke nicht frei." : !route.referenceWithin ? "Elektrische Modelllänge überschreitet das veröffentlichte Referenzbudget. Keine Streckenfreigabe." : "Innerhalb der physischen 100 m und des Referenzbudgets; thermische, RP- und Normzuordnung bleiben ungeprüft." },
      rows: [{ label: "Permanent-Link · physisch", value: route.permanentLink, unit: "m" }, { label: "Physische Kanalreserve bis 100 m", value: route.channelReserve, unit: "m" }, { label: "20-°C-Referenzbudget · keine physische Freigabe", value: route.referenceLimit, unit: "m" }, { label: "Globale Längennäherung · nicht entscheidend", value: route.allowedLengthApprox, unit: "m" }, { label: "RP-Kategorie / verwendeter Designstrom", value: `${route.rpCategory} / ${route.designCurrent} A je Ader` }, ...(route.effectiveCurrent === null ? [] : [{ label: "Effektivstrom aus Typanteilen · Referenz", value: route.effectiveCurrent, unit: "A je Ader" }]), ...route.segments.map(segment => ({ label: segment.label, value: `${segment.physicalLength.toLocaleString("de-CH")} m → ${segment.equivalent20.toLocaleString("de-CH", { maximumFractionDigits: 3 })} m im 20-°C-Modell; ${segment.temperature.toLocaleString("de-CH", { maximumFractionDigits: 2 })} °C` }))],
      formula: `L₂₀ = Σ Lᵢ × [1 + max(Tᵢ−20, 0) × aᵢ/100 + Zusatz bei a = 0.4 und T > 40] / gᵢ = ${route.segments.map(segment => segment.equivalent20.toLocaleString("de-CH", { maximumFractionDigits: 3 })).join(" + ")} = ${route.electricalLength20.toLocaleString("de-CH", { maximumFractionDigits: 3 })} m. Referenzreserve = ${route.referenceLimit} − ${route.electricalLength20.toLocaleString("de-CH", { maximumFractionDigits: 3 })} = ${route.referenceReserve.toLocaleString("de-CH", { maximumFractionDigits: 3 })} m. Physisch = ${route.physicalChannel.toLocaleString("de-CH")} m ≤ 100 m. T_mittel = Σ(Tᵢ × Lᵢ) / Σ Lᵢ = ${route.weightedTemperature.toLocaleString("de-CH", { maximumFractionDigits: 3 })} °C.`,
      limitations: [POE_ROUTE_QUALIFICATION, `Datierte Kabel- und Modellreferenz vom ${POE_ROUTE_SOURCE.observed}; Datenherkunft im Wissens-Hub.`, "100 m bezeichnet den betrachteten physischen Kanal inklusive Patchkabeln. Die klassen-/stecksystemabhängigen 102–109 m sind interne 20-°C-Referenzbudgets, keine zulässige physische Kanallänge.", route.thermalMode === "published" ? "Bündelerwärmung: ΔT = max über m=1…n von {[(3.2−Schirmkorrektur)·m + 1000·Einbaufaktor·√m/d]·I_Design²·R₂₀/100·K(J_m)}. K ist eine publizierte stückweise kalibrierte Kurve; ihre monotonisierte Hülle ist kein bestätigter ISO/IEC-TR-29125-Nachweis. Ausserhalb J < 41.9875 wird kein Resultat gebildet." : "Leitertemperaturen sind manuell dokumentierte Eingaben, keine berechnete thermische Bündelfreigabe.", ...(route.rpCategory === "RP1" && route.thermalMode === "published" ? ["Der RP1-Referenzansatz verwendet 0 A Designstrom und berechnet deshalb keine zusätzliche PoE-Erwärmung. Reale Erwärmungsfreiheit ist dadurch nicht nachgewiesen."] : []), "Unter 20 °C gibt das Modell keine Längengutschrift. Globale Längennäherung, Klassenfaktoren, Kabelkennwerte und Typströme sind Referenzannahmen. Verbindliche Kabeltemperaturen, Dämpfungsmessung, Stecksysteme, PD-Budget und Herstellerfreigaben separat prüfen."],
    };
    return result;
  } };
}
export function poeRouteReportInputs(input: Inputs): { label: string; value: string }[] {
  if (input.poeRouteMode !== "published") return [];
  return parsePoeSegments(input.poeSegments).map((segment, index) => {
    const preset = POE_CABLE_REFERENCES.find(cable => cable.id === segment.cableType);
    const cableData = segment.cableType === "custom" ? { diameter: segment.diameter, resistance: segment.resistance, attenuation: segment.attenuation, factor: segment.classFactor } : { diameter: preset?.diameter, resistance: preset?.resistance20, attenuation: preset?.attenuationPerDegree, factor: preset?.referenceLengthFactors[input.poeClass] };
    return { label: `Kabelabschnitt ${index + 1} · ${segment.label}`, value: `${preset?.label ?? "Eigener Kabeldatensatz"}; ${segment.length} m; ${segment.numCables} Kabel, ${segment.width} mm Kanalbreite; Umgebung ${segment.ambient} °C; ${input.poeThermalMode === "manual" ? `Leiter ${segment.temperature} °C` : POE_INSTALLATIONS.find(option => option.value === segment.installCondition)?.label}; d=${cableData.diameter} mm; R₂₀=${cableData.resistance} Ω/100 m; a=${cableData.attenuation} %/K; g=${cableData.factor}; ${segment.cableType === "custom" ? segment.evidence : "Referenzannahme"}` };
  });
}
