import type { Diagnostic, DiagnosticTarget } from "../DiagnosticDetails";
import { InputError, type CalculatorDefinition, type CalculationResult, type Field, type Inputs } from "./types.ts";
import { RowInputError } from "./inputDiagnostics.ts";
import { parseSelectivityStages, selectivityStageCurrents } from "./selectivityStages.ts";
import { parseFireLoadRows, fireLoadRowsToPositions } from "./installation.ts";

const fmt = (value: number, unit = "", digits = 3) => `${value.toLocaleString("de-CH", { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;
// Bounds use a shared precision tighter than the models' 1e-9 comparison
// tolerance. Rounding the upper bound to a device display's 1–3 decimals can
// otherwise suggest a value outside the permitted interval.
const bound = (value: number, unit = "") => value !== 0 && Math.abs(value) < 1e-9 ? `${value}${unit ? ` ${unit}` : ""}` : fmt(value, unit, 12);
const num = (input: Inputs, key: string) => Number((input[key] ?? "").replace(",", "."));
const target = (field: string, label?: string): DiagnosticTarget => ({ field, ...(label ? { label } : {}) });
const numericValue = (result: CalculationResult, label: RegExp): number | null => {
  const row = [...result.metrics, ...(result.rows ?? [])].find(row => label.test(row.label));
  return row && typeof row.value === "number" && Number.isFinite(row.value) ? row.value : null;
};
export function fieldVisible(field: Field, input: Inputs): boolean {
  return !field.visibleWhen || field.visibleWhen.every(condition => condition.values.includes(input[condition.key]));
}

const ERROR_FIELDS: [RegExp, string[]][] = [
  [/minimaler fehlerstrom.*maximalen/i,["ikMin","ikMax"]],
  [/backup.*(grenze|nh)|nh.*(vorsicherung|kombination)/i,["upstreamType","backupMode"]],
  [/hersteller.*fundstelle|hersteller.*koordination/i,["backupReference"]],
  [/temperatur.*(referenzfaktor|faktor belegt)/i,["ambient","tableMode"]],
  [/häufungsfaktor|wirksamer stromkreise/i,["groupCount","lightlyLoaded","tableMode"]],
  [/referenzwert|verlegeart.*bauart|standardquerschnitt|tabellierten querschnitt/i,["area","method","conductorKind","tableMode"]],
  [/motor.*vergleichswerte/i,["methodIz","isolation"]],
  [/montagehöhe|nutzebene/i,["height","plane"]],
  [/wandabstandsannahmen|wand.\/abstandsannahmen|darstellbares.*raster|raster zu gross/i,["minWall","maxWall","maxSpacing","maxArea","length","width","radius"]],
  [/bewertungsjahr.*inbetriebnahme/i,["valuationYear","commissionedYear"]],
  [/förderbeitrag.*investition/i,["grant","cost","historicalCost"]],
  [/dachfläche|vollständiges modul/i,["area","usable","moduleArea"]],
  [/dc.modellgrenze/i,["voltage","length","power","resistance"]],
  [/quelle der rohkennwerte/i,["siaSource"]],
  [/netzanschluss|hausanschluss/i,["house","reserve"]],
  [/ac.einspeisung|reserve.*einspeisung/i,["feed","reserve"]],
  [/nutzergruppenanteile.*100/i,["costRefFleet","costRefCommuters","costRefVisitors"]],
  [/mindestens einen ladepunkt.*betrachtungsdauer/i,["costRows","years"]],
  [/mindestens einen ladepunkt/i,["grids","count1"]],
  [/mindestens einen dc.abgabepunkt/i,["depotPoints"]],
  [/hersteller.paargrenzen|quellenvermerk|konkreten hersteller/i,["reference","evidence"]],
  [/grid.*pv|pv.*speicheranschluss/i,["chargingSourceConnection"]],
  [/kabelabschnitte|bündelgeometrie|thermische referenzparameter/i,["poeSegments"]],
  [/patchbündel 1/i,["poePatchBundle1"]],[/patchbündel 2/i,["poePatchBundle2"]],
  [/patchlänge gesamt/i,["poePatchTotal"]],[/patchlänge am verteiler/i,["poePatch1Length"]],[/patchlänge am endgerät/i,["poePatch2Length"]],
  [/leitertemperatur patch 1/i,["poePatchTemperature1"]],[/leitertemperatur patch 2/i,["poePatchTemperature2"]],
  [/umgebung patch/i,["poePatchAmbient"]],
  [/höchstens.*kabelposition|kabelpositionsliste/i,["fireloadRows"]],
  [/fluchtweg|bezugsstrecke/i,["route","routeLength","limit"]],
  [/mindestens eine zone/i,["siaZones"]],
  [/leistungsfaktor|cos/i,["cos"]],
];

export function errorDiagnostics(definition: CalculatorDefinition, input: Inputs, error: unknown): Diagnostic[] {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Eingaben prüfen.";
  let targets: DiagnosticTarget[] = [];
  if (error instanceof RowInputError) targets = [{ ...error.target, label: `${definition.fields.find(field => field.key === error.target.field)?.label ?? "Position"}${error.target.rowIndex === undefined ? "" : ` · ${error.target.rowIndex + 1}`}` }];
  else if (error instanceof InputError && definition.fields.some(field => field.key === error.field)) targets = [target(error.field)];
  if (!targets.length) {
    const match = ERROR_FIELDS.find(([pattern, keys]) => pattern.test(message) && keys.some(key => definition.fields.some(field => field.key === key && fieldVisible(field, input))));
    if (match) targets = match[1].filter(key => definition.fields.some(field => field.key === key && fieldVisible(field, input))).map(key => target(key));
  }
  if (!targets.length) {
    // Match the actual model label; never send an unrelated error to the first input.
    const plain = message.split(":")[0].toLocaleLowerCase();
    const fields = definition.fields.filter(field => fieldVisible(field, input) && (field.key === plain || field.label.toLocaleLowerCase().includes(plain) || plain.length > 5 && plain.includes(field.label.toLocaleLowerCase())));
    if (fields.length === 1) targets = [target(fields[0].key)];
  }
  if (!targets.length) {
    const invalidChoice = definition.fields.filter(field => fieldVisible(field, input) && field.kind === "select" && field.options && !field.options.some(option => option.value === input[field.key]));
    if (invalidChoice.length === 1) targets = [target(invalidChoice[0].key)];
  }
  targets = targets.map(value => ({ ...value, label: value.label ?? definition.fields.find(field => field.key === value.field)?.label ?? value.field }));
  const actual = error instanceof InputError ? error.actual : targets.filter(value => !value.rowId).map(value => `${value.label}: ${input[value.field] || "leer"}`).join(" · ");
  let required = error instanceof InputError ? error.required : "Die genannte Eingabe muss zur gewählten Modell- und Datengrundlage passen. Bei fehlenden Referenzdaten ist eine belegte Projektgrundlage erforderlich.";
  if (/montagehöhe.*nutzebene/i.test(message)) required = `Montagehöhe > ${input.plane} m (eingegebene Nutzebene).`;
  if (/bewertungsjahr.*inbetriebnahme/i.test(message)) required = `Bewertungsjahr ≥ ${input.commissionedYear} (Inbetriebnahmejahr).`;
  if (/nutzergruppenanteile.*100/i.test(message)) required = `Nutzergruppenanteile zusammen genau 100 %; aktuell ${fmt(num(input, "costRefFleet") + num(input, "costRefCommuters") + num(input, "costRefVisitors"), "%")}.`;
  const single = targets.length === 1 ? definition.fields.find(field => field.key === targets[0].field) : undefined;
  if (!(error instanceof InputError) && single?.options && /gültige.*(auswahl|option)|wählen/i.test(message)) required = `Eine gültige Auswahl: ${single.options.map(option => option.label).join(" · ")}.`;
  return [{ id: "invalid-input", title: "Eingabe oder Datengrundlage prüfen", tone: "error", message,
    ...(actual ? { actual } : {}), required,
    action: "Öffne die betroffene Eingabe und prüfe sie anhand der genannten Bedingung. Deine Werte werden nicht automatisch ersetzt.", targets }];
}

export function resultDiagnostics(definition: CalculatorDefinition, input: Inputs, result: CalculationResult): Diagnostic[] {
  const out: Diagnostic[] = [];
  const add = (id: string, title: string, message: string, actual: string, required: string, action: string, keys: string[], tone: Diagnostic["tone"] = "error") => out.push({ id, title, tone, message, actual, required, action, targets: keys.filter(key => definition.fields.some(field => field.key === key && fieldVisible(field, input))).map(key => target(key, definition.fields.find(field => field.key === key)?.label)) });
  if (definition.id === "nin-kabelrechner" || definition.id === "ls-schalter") {
    const nin = definition.id === "nin-kabelrechner", ib = num(input, nin ? "ib" : "load"), rated = num(input, nin ? "in" : "rated"), factor = num(input, "i2factor");
    const iz = nin ? numericValue(result, /^Korrigierte Strombelastbarkeit/) : num(input, "iz");
    if (iz !== null) {
      const maxRated = Math.min(iz, 1.45 * iz / factor);
      if (ib > rated + 1e-9) add("overload-load", "Betriebsstrom liegt über dem Schutznennstrom", "Das Schutzorgan darf nicht kleiner als der Bemessungs-Betriebsstrom sein. Eine grössere Strombelastbarkeit allein erfüllt diese Bedingung nicht.", `Iᵦ ${fmt(ib, "A")} > Iₙ ${fmt(rated, "A")}`, `Iᵦ ≤ Iₙ; bei unveränderten Kabeldaten zusätzlich Iₙ ≤ ${bound(maxRated, "A")}.`, ib > maxRated ? "Mit diesen Kabel- und Prüfstromdaten besteht kein Nennstrombereich für diese Last. Last, Kabelauslegung und geeignetes Schutzorgan gemeinsam prüfen." : "Geeignetes Schutzorgan innerhalb aller Bedingungen wählen oder den belegten Betriebsstrom korrigieren.", [nin ? "in" : "rated", nin ? "ib" : "load"]);
      if (rated > iz + 1e-9 || rated * factor > 1.45 * iz + 1e-9) {
        const requiredIz = Math.max(rated, rated * factor / 1.45);
        add("overload-capacity", "Leitung und Schutzorgan passen noch nicht zusammen", "Neben Iₙ ≤ Iz muss auch der grosse Prüfstrom I₂ ≤ 1.45 × Iz bleiben.", `Iₙ ${fmt(rated, "A")}; I₂ ${fmt(rated * factor, "A")}; Iz ${fmt(iz, "A")}`, `Bei diesem Schutzorgan: Iz ≥ ${bound(requiredIz, "A")}. Bei unverändertem Iz: ${ib > maxRated ? "kein Nennstrombereich für den eingegebenen Betriebsstrom" : `${bound(ib, "A")} ≤ Iₙ ≤ ${bound(maxRated, "A")}`}.`, "Leitungsdimensionierung und reale Korrekturfaktoren prüfen. Den Tabellenwert oder Faktor nur ändern, wenn die tatsächliche Ausführung dies belegt.", nin ? ["area", "iz0", "temperature", "grouping", "in", "i2factor"] : ["iz", "rated", "i2factor"]);
      }
    }
    if (!nin) {
      const max = num(input, "ikMax"), icn = num(input, "icn"), breaking = numericValue(result, /^Ausschaltreserve/);
      if (breaking !== null && breaking < -1e-9) add("breaker-breaking", "Ausschaltvermögen reicht im Zahlenvergleich nicht", "Der prospektive Kurzschlussstrom an der Einbaustelle überschreitet die verwendete Ausschaltgrenze.", `Ik,max ${fmt(max, "kA")}; wirksame Grenze ${fmt(max + breaking, "kA")} (Icn ${fmt(icn, "kA")})`, "Wirksames Ausschaltvermögen ≥ Ik,max; eine Backup-Erweiterung benötigt die passende Herstellerkoordination.", "Gerätedaten oder dokumentierte Backup-Kombination prüfen. Den Kurzschlussstrom nicht zur Anpassung an das Gerät verringern.", ["icn", "ikMax", "backupMode", "backupReference"]);
      const multiplier: Record<string, number> = { B: 5, C: 10, D: 20, K: 14, Z: 3 }, upper = multiplier[input.curve] * rated;
      if (num(input, "ikMin") < upper - 1e-9) add("breaker-magnetic", "Oberer Magnetauslöser wird nicht erreicht", "Ein Wert unter der oberen magnetischen Grenze belegt keine sichere magnetische Schnellauslösung. Die konkrete Gerätekennlinie und Abschaltzeit bleiben massgebend.", `Ik,min ${fmt(num(input, "ikMin"), "A")}; obere Grenze ${fmt(upper, "A")}`, `Für diesen Schnellvergleich: Ik,min ≥ ${fmt(upper, "A")}.`, "Belegten Fehlerstrom, Leitungsimpedanz und geeignete Gerätekennlinie prüfen. Ein Eingabewert ersetzt keine Messung oder Netzberechnung.", ["ikMin", "curve", "rated"], "warning");
    }
  }
  if (definition.id === "strombelastbarkeit") {
    const iz = numericValue(result, /^Gesamt-Iz/), load = num(input, "load");
    if (iz !== null && load > iz + 1e-9) add("tray-capacity", "Gesamt-Betriebsstrom überschreitet die Zuleitung", "Die parallelen Stromkreise dürfen zusammen höchstens den korrigierten Gesamt-Iz tragen.", `Iᵦ ${fmt(load, "A")} > Iz,gesamt ${fmt(iz, "A")}`, `Iᵦ ≤ ${fmt(iz, "A")}, beziehungsweise belegter Gesamt-Iz ≥ ${fmt(load, "A")}.`, "Querschnitt, zulässige Parallelführung und reale Korrekturfaktoren überprüfen. Der Tabellenwert je Kreis ist kein Gesamtwert.", ["load", "area", "circuits", "base"]);
  }
  if (definition.id === "motoranlauf") {
    const nominal = numericValue(result, /^Motor-Nennstrom/), iz = numericValue(result, /^Strombelastbarkeit Iz · manuell/);
    if (nominal !== null && iz !== null && iz < nominal - 1e-9) add("motor-capacity", "Motorkabel trägt den Nennstrom nicht", "Der bereits korrigierte Iz-Wert ist kleiner als der Motor-Nennstrom.", `I_N ${fmt(nominal, "A")}; Iz ${fmt(iz, "A")}`, `Iz ≥ ${fmt(nominal, "A")}.`, "Kabelauslegung mit realer Temperatur, Häufung und Verlegeart prüfen. Anlauf- und Schutzkoordination bleiben zusätzliche Nachweise.", ["iz", "nominalCurrent", "kw"]);
  }
  if (definition.id === "transformator" && num(input, "load") > 100) add("transformer-load", "Transformator über Nennleistung belastet", "Der eingegebene Lastanteil liegt über der Typenschild-Nennleistung; das Modell bestätigt keine thermische Zulässigkeit.", fmt(num(input, "load"), "%"), "Bis 100 % für den Nennleistungsvergleich; höhere Belastung nur mit passenden Hersteller- und Betriebsdaten.", "Tatsächliche Last und Transformatorauslegung prüfen.", ["load", "kva"], "warning");
  if (definition.id === "verlustleistung") {
    const drop = result.comparisons?.find(comparison => comparison.unit === "%")?.items.find(item => item.label === "Spannungsfall")?.actual ?? numericValue(result, /Spannungsfall.*%|Spannungsfall relativ/), budget = num(input, "budget");
    if (drop !== null && drop > budget + 1e-9) add("loss-voltage", "Spannungsfallbudget überschritten", "Der berechnete Spannungsfall ist grösser als das gewählte Streckenbudget.", `${fmt(drop, "%")} > ${fmt(budget, "%")}`, `ΔU ≤ ${fmt(budget, "%")}; bei sonst unveränderten Daten L ≤ ${fmt(num(input, "length") * budget / drop, "m")}.`, "Leitungslänge, Last und Querschnitt prüfen. Das Budget nur entsprechend dem tatsächlichen Projektkonzept ändern.", ["length", "area", "current", "budget"]);
  }
  if (definition.id === "potenzialausgleich" && input.paMode === "published") {
    const pe = numericValue(result, /^Massgebender Schutzleiter/);
    if (pe !== null && num(input, "pen") < pe) add("bonding-pen", "Vorhandener PEN ist kleiner als der ermittelte PE", "Der vorhandene Leiter liegt unter der im gewählten Cu-Modell ermittelten Zuordnung.", `PEN ${fmt(num(input, "pen"), "mm²")}; PE ${fmt(pe, "mm²")}`, `Für diesen Vergleich: PEN/PE ≥ ${fmt(pe, "mm² Cu")}.`, "Tatsächliche Zuleitung und zutreffende Normzuordnung prüfen; ein anderer Eingabewert vergrössert den vorhandenen Leiter nicht.", ["pen", "phase"], "warning");
  }
  if (definition.id === "poe") {
    const output = numericValue(result, /^Spannung am Endgerät/), minimum = numericValue(result, /^PD-Mindestspannung/);
    if (output !== null && minimum !== null && output < minimum - 1e-9) add("poe-pd-voltage", "PoE-Endgerät erreicht die Mindestspannung nicht", "Kabel- und Kontaktwiderstände verursachen einen Spannungsfall unter die verwendete typabhängige PD-Grenze.", `${fmt(output, "V")} am PD`, `PD-Spannung ≥ ${fmt(minimum, "V")}; PSE und Endgerät müssen zum gewählten Typ passen.`, "Tatsächliche Kanal- und Patchlängen, Aderwiderstände und Gerätedaten prüfen. Eine höhere PSE-Eingabe ist nur mit zulässigen Gerätedaten möglich.", ["length", "cable", "resistance", "voltage", "power"]);
    if (num(input, "length") > 100) add("poe-channel", "PoE-Kanal überschreitet die physische Grenze", "Eine noch ausreichende PD-Spannung macht einen überlangen Ethernet-Kanal nicht gültig.", fmt(num(input, "length"), "m"), "Physischer Kanal einschliesslich Patchleitungen ≤ 100 m im betrachteten Modell.", "Tatsächlichen Leitungsverlauf und Netzwerkaufteilung überprüfen.", ["length"]);
  }
  if (definition.id === "brandlast" || definition.id === "premium-brandlast") {
    const horizontal = (input.routeType ?? input.route) === "horizontal", length = num(input, definition.id === "brandlast" ? "length" : "route"), limit = num(input, "limit");
    const candidates = result.comparisons?.flatMap(comparison => comparison.unit === "MJ/m" ? comparison.items : []) ?? [];
    const density = numericValue(result, /^Brandlast bezogen auf Fluchtweg/);
    if (horizontal && density !== null) candidates.push({ label: "Variante A", actual: density, target: limit });
    candidates.forEach((item, index) => { if (item.actual > item.target + 1e-9) add(`fire-budget-${index}`, `${item.label}: horizontale Brandlastgrenze überschritten`, "Die Kabelmengen ergeben im Mittel über die tatsächliche Bezugsstrecke eine höhere Brandlast als die eingegebene Vergleichsgrenze.", `${fmt(item.actual, "MJ/m")} > ${fmt(item.target, "MJ/m")}`, `Bei ${fmt(length, "m")} tatsächlicher Bezugsstrecke: gesamte Brandlast ≤ ${fmt(item.target * length, "MJ")}.`, "Kabelmengen, Typen und Schutzmassnahmen prüfen. Die Bezugsstrecke oder Grenze nicht zur rechnerischen Freigabe vergrössern; lokale Häufungen bleiben ein eigener Nachweis.", [item.label === "Nachher" ? "fireloadRowsAfter" : "fireloadRows", "length", "route", "limit"]); });
    if (input.fireloadMode === "dynamic") {
      for (const key of ["fireloadRows", ...(definition.id === "premium-brandlast" && input.comparisonEnabled !== "no" ? ["fireloadRowsAfter"] : [])]) {
        const rows = parseFireLoadRows(input[key]), positions = fireLoadRowsToPositions(rows);
        positions.forEach((position, index) => { if (position.quantity > 0 && position.evidence === "critical") out.push({ id: `fire-critical-${key}-${rows[index].id}`, title: `${rows[index].name}: kritisches Brandverhalten`, tone: "error", message: "Die Kabelposition ist durch Eingabe beziehungsweise hinterlegte CPR-Zuordnung als kritisch gekennzeichnet. Ein kleiner MJ/m-Mittelwert hebt dies nicht auf.", actual: `${position.quantity} Kabel · kritisches Brandverhalten`, required: "Geeignetes Produkt und passende Ausführung mit Herstellerbelegen und projektspezifischer VKF-/NIN-Bewertung.", action: "Tatsächliches Kabel, CPR-Nachweis und Schutzmassnahmen prüfen. Den Nachweisstatus nicht allein zur grünen Anzeige umstellen.", targets: [{ field: key, rowId: rows[index].id, rowIndex: index, property: "evidence", label: `${rows[index].name} · Nachweis` }] }); });
      }
    }
  }
  if (result.siaBreakdown) {
    result.siaBreakdown.zones.forEach((zone, index) => {
      for (const kind of ["power", "energy"] as const) {
        const exceeded = kind === "power" ? zone.powerExceeded : zone.energyExceeded, actual = kind === "power" ? zone.powerDensity : zone.energyDensity, limit = kind === "power" ? zone.powerTarget : zone.energyTarget, unit = kind === "power" ? "W/m²" : "kWh/(m²·a)";
        if (!exceeded || limit === undefined) continue;
        out.push({ id: `sia-${zone.id}-${kind}`, title: `${zone.label}: ${kind === "power" ? "Leistungsziel" : "Energieziel"} überschritten`, tone: "error", message: "Die aus Rohkennwerten und den eingegebenen Faktoren berechnete Zonendichte überschreitet das manuelle Projektziel.", actual: `${fmt(actual, unit)} > ${fmt(limit, unit)}`, required: `Zonendichte ≤ ${fmt(limit, unit)} entsprechend der belegten Zielgrundlage.`, action: "Rohkennwerte und tatsächliche Verbraucherplanung prüfen. Kcor wirkt nur auf Leistung, Jahresgleichzeitigkeit nur auf Energie; PV darf die Brutto-Zielprüfung nicht verdecken.", targets: [{ field: "siaZones", rowId: zone.id, rowIndex: index, property: kind === "power" ? "powerTarget" : "energyTarget", label: `${zone.label} · manuelles Ziel` }, { field: "siaZones", rowId: zone.id, rowIndex: index, property: kind === "power" ? "kcor" : "yearGlz", label: `${zone.label} · Bilanzfaktor` }] });
      }
    });
  }
  if (definition.id === "premium-selektivitaet" && input.selectivityMode === "stages") {
    const stages = parseSelectivityStages(input.selectivityStages), nodes = selectivityStageCurrents(input);
    for (let index = 1; index < stages.length; index++) {
      const stage = stages[index], limit = Number(stage.pairLimitKA.replace(",", ".")), ik = nodes[index].ikMax;
      if (stage.pairLimitKA.trim() && ik > limit + 1e-9) out.push({ id: `selectivity-pair-${stage.id}`, title: `${stages[index - 1].name} → ${stage.name}: Paargrenze überschritten`, tone: "error", message: "Der Modell-Kurzschlussstrom überschreitet die eingetragene Hersteller-Paargrenze dieser beiden Geräte.", actual: `${fmt(ik, "kA")} > ${fmt(limit, "kA")}`, required: `Passende dokumentierte Koordination für mindestens ${fmt(ik, "kA")}; der Grenzwert darf nicht frei erhöht werden.`, action: "Konkrete Geräte und Original-Koordinationstabelle prüfen; gegebenenfalls Gerätepaar oder Netzplanung anpassen.", targets: [{ field: "selectivityStages", rowId: stage.id, rowIndex: index, property: "pairLimitKA", label: `${stage.name} · Paargrenze` }, { field: "selectivityStages", rowId: stage.id, rowIndex: index, property: "pairReference", label: `${stage.name} · Herstellerquelle` }] });
    }
  }
  if (result.poeRoute) {
    const route = result.poeRoute;
    if (!route.channelWithin) add("poe-physical", "Physischer PoE-Kanal ist zu lang", "Kabel- und Patchlängen zählen gemeinsam zur physischen Kanalgrenze.", fmt(route.physicalChannel, "m"), `Physische Gesamtlänge ≤ 100 m; derzeit mindestens ${fmt(route.physicalChannel - 100, "m")} zu lang.`, "Tatsächlichen Leitungsverlauf und beide Patchseiten prüfen. Eine thermische Referenzreserve hebt die 100-m-Grenze nicht auf.", ["poeSegments", "poePatchTotal", "poePatch1Length", "poePatch2Length"]);
    if (!route.referenceWithin) add("poe-electrical", "Elektrisches PoE-Streckenbudget überschritten", "Leitungslänge, Temperatur, Kabeldatensatz und Patchfaktoren ergeben zusammen eine zu grosse äquivalente Länge.", `${fmt(route.electricalLength20, "m")} äquivalent`, `Im verwendeten Referenzmodell ≤ ${fmt(route.referenceLimit, "m")}.`, "Die tatsächlichen Abschnitte, Temperaturen und Kabeldaten prüfen. Eine höhere Grenze ist kein Ersatz für einen zulässigen Kanal.", ["poeSegments", "poePatchFactor", "poeThermalMode"]);
  }
  if (result.chargingNetwork) {
    const data = result.chargingNetwork;
    if (data.reserveExceeded) add("charging-reserve", "Gebäudereserve überschreitet den Anschluss", "Die Gebäudelast beansprucht bereits mehr als das Hausanschlussbudget.", `${fmt(data.reserveKW, "kW")} Reserve; ${fmt(data.houseKW, "kW")} Anschluss`, `Gebäudereserve ≤ ${fmt(data.houseKW, "kW")}.`, "Belegte Gebäudelast und Anschlusskonzept prüfen. Lastmanagement der Ladepunkte kann eine bereits überlastete Gebäudeeinspeisung nicht ausgleichen.", ["reserve", "house"]);
    if (data.strongestPhaseCurrent > data.houseAmps + 1e-8) add("charging-house-phase", "Aussenleiter am Hausanschluss überlastet", "Massgebend ist der stärkste Aussenleiter; eine passende kW-Summe allein genügt nicht.", `${fmt(data.strongestPhaseCurrent, "A")} > ${fmt(data.houseAmps, "A")}`, `Jeder Aussenleiter ≤ ${fmt(data.houseAmps, "A")}.`, "Lastmanagement, Phasenaufteilung und reale Anschlussauslegung prüfen.", ["house", "mode", "grids"]);
    data.grids.forEach((grid, index) => { const strongest = Math.max(...grid.phases.map(Math.abs)); if (strongest > grid.amps + 1e-8) out.push({ id: `grid-${grid.id}`, title: `${grid.label}: Grid-Vorsicherung überschritten`, tone: "error", message: "Der konfigurierte Bedarf überlastet mindestens einen Aussenleiter dieses Grids.", actual: `${fmt(strongest, "A")} > ${fmt(grid.amps, "A")}`, required: `Jeder Grid-Aussenleiter ≤ ${fmt(grid.amps, "A")}.`, action: "Punktgruppen, Phasen und geeignetes Lastmanagement prüfen; die Vorsicherung nur nach realer Leitungs-/Schutzauslegung ändern.", targets: [{ field: "grids", rowId: grid.id, rowIndex: index, property: "amps", label: `${grid.label} · Vorsicherung` }] }); });
    if (data.waitingCount && !data.overload) add("charging-waiting", "Ladepunkte warten auf Leistungsbudget", "Das Lastmanagement hält Punkte bewusst zurück, damit aktive Punkte die eingegebenen Mindestleistungen und Phasengrenzen einhalten.", `${data.activeCount} aktiv · ${data.waitingCount} wartend`, "Aktive Punkte benötigen ihre konfigurierte Mindestleistung innerhalb der Anschluss- und Phasenbudgets.", "Projekt-Mindestleistungen und Betriebspriorität prüfen. Ein wartender Punkt ist keine erfundene zusätzliche Anschlussreserve.", ["grids", "mode"], "warning");
  }
  if (result.depotNetwork) {
    const data = result.depotNetwork;
    data.units.forEach((unit, index) => { if (unit.overload) out.push({ id: `depot-unit-${unit.id}`, title: `${unit.label}: Leistungsbudget überschritten`, tone: "error", message: "Die zugeordneten Abgabepunkte überschreiten ein erfasstes AC-/DC-Budget der Power Unit.", actual: `Bedarf ${fmt(unit.demandDC, "kW DC")}; Modulleistung ${fmt(unit.capacityDC, "kW DC")}`, required: `DC-Bedarf innerhalb ${fmt(unit.capacityDC, "kW")} und AC-/Grid-/Hausgrenzen.`, action: "Module, Wirkungsgrad, zugeordnete Abgabepunkte und Lastmanagement prüfen.", targets: [{ field: "depotUnits", rowId: unit.id, rowIndex: index, property: "modules", label: `${unit.label} · Module` }] }); });
    if (data.reserveKW > data.houseKW) add("depot-reserve", "Reserve überschreitet die AC-Einspeisung", "Die verfügbare Einspeisung reicht bereits für die Gebäudereserve nicht aus.", `${fmt(data.reserveKW, "kW")} > ${fmt(data.houseKW, "kW")}`, `Reserve ≤ ${fmt(data.houseKW, "kW")}.`, "Belegte Reserve und Einspeisekonzept gemeinsam prüfen.", ["reserve", "feed"]);
  }
  // Every model retains a compact explanation for unresolved manufacturer,
  // measurement and normative proofs; numerical pass is not a full approval.
  if (!out.length && result.status.tone !== "ok") out.push({ id: "model-basis", title: result.status.tone === "error" ? "Ergebnisbedingung prüfen" : "Annahmen und offene Nachweise", tone: result.status.tone, message: result.status.text, actual: result.metrics.map(metric => `${metric.label}: ${typeof metric.value === "number" ? fmt(metric.value, metric.unit) : metric.value}`).join(" · "), required: definition.scope, action: result.limitations[0] ?? "Die ausgewählte Projektgrundlage und Herstellerdaten bestätigen." });
  return out;
}
