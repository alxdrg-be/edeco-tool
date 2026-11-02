import type { CalculationResult, CalculatorDefinition, Field, Inputs } from "./types.ts";
import { number } from "./types.ts";
import { SIA_BUILDING_TYPES, SIA_CONSUMER_CLASS_CODES, SIA_DATA_SOURCE, SIA_GROUPS } from "./siaData.ts";
import { calculateSIABalance, createSIAZone, parseSIAZones, type SIABalance } from "./siaModel.ts";
import { calculateSIAReference, siaReferenceKey } from "./siaReference.ts";
import { SIA_REFERENCE_SOURCE } from "./siaReferenceData.ts";

const sample = createSIAZone("manual-example", "Eigenes Rechenbeispiel");
sample.consumers[0] = { groupId: "devices", powerDensity: 20, energyDensity: 30 };
export const DEFAULT_SIA_ZONES = JSON.stringify([sample]);
const manual = [{ key: "siaMode", values: ["manual"] }];
const automatic = [{ key: "siaMode", values: ["automatic"] }];
const f = (key: string, label: string, value: string, unit: string, help: string): Field => ({ key, label, default: value, unit, help, group: "Manuelle Bilanz", visibleWhen: manual });
const format = (value: number, digits = 3) => value.toLocaleString("de-CH", { maximumFractionDigits: digits });

export interface SIAReportRow { label: string; value: string }
/** Flatten every entered cell for the PDF/report; never export only the hidden JSON field. */
export function siaReportInputs(input: Inputs): SIAReportRow[] {
  if (input.siaMode === "legacy") return [];
  if (input.siaMode === "automatic") {
    const data=calculateSIAReference(input);
    return [{label:"Bilanzmodus",value:"Veröffentlichte Referenzprofile · 02.11.2026"},{label:"Datenquelle",value:SIA_REFERENCE_SOURCE.url},{label:"Klimaregion",value:input.siaClimate},...data.zones.flatMap((zone,index)=>[
      {label:zone.label,value:`${format(zone.area)} m² · Kcor ${format(zone.kcor)} · Jahresgleichzeitigkeit ${format(zone.yearGlz)}`},
      ...zone.consumers.map(c=>({label:`${zone.label} · ${SIA_GROUPS.find(g=>g.id===c.groupId)!.label}`,value:`${format(c.powerDensity)} W/m² roh; ${format(c.energyDensity)} kWh/(m²·a) roh`})),
      {label:`${zone.label} · PV`,value:`${format(data.metadata[index].pvKWp)} kWp · ${format(data.metadata[index].pvYearKWh)} kWh/a`},
    ])];
  }
  const rows: SIAReportRow[] = [{ label: "Bilanzmodus", value: "Manuelle Rohkennwerte · keine automatische Normtabelle" }, { label: "Kennwertquelle", value: input.siaSource ?? "" }];
  for (const zone of parseSIAZones(input.siaZones)) {
    rows.push({ label: `${zone.label} · Fläche`, value: `${format(zone.area)} m²` }, { label: `${zone.label} · Leistungskorrektur Kcor`, value: format(zone.kcor) }, { label: `${zone.label} · Jahresgleichzeitigkeit`, value: format(zone.yearGlz) });
    for (const consumer of zone.consumers) rows.push({ label: `${zone.label} · ${SIA_GROUPS.find(group => group.id === consumer.groupId)?.label ?? consumer.groupId}`, value: `${format(consumer.powerDensity)} W/m² roh; ${format(consumer.energyDensity)} kWh/(m²·a) roh` });
    if (zone.powerTarget !== undefined) rows.push({ label: `${zone.label} · manuelles Leistungsziel`, value: `${format(zone.powerTarget)} W/m²` });
    if (zone.energyTarget !== undefined) rows.push({ label: `${zone.label} · manuelles Energieziel`, value: `${format(zone.energyTarget)} kWh/(m²·a)` });
  }
  rows.push({ label: "PV-Jahresertrag", value: `${input.siaPV} kWh/a` }, { label: "PV-Eigenverbrauchsanteil", value: `${input.siaPVSelf} %` });
  return rows;
}

export function siaManualResult(input: Inputs): CalculationResult & { siaBreakdown: SIABalance } {
  const reference = (input.siaSource ?? "").trim();
  if (!reference || reference.length > 2000) throw new Error("Quelle der Rohkennwerte mit 1 bis 2000 Zeichen dokumentieren.");
  const balance = calculateSIABalance({ zones: parseSIAZones(input.siaZones), pvYearKWh: number(input, "siaPV", "PV-Jahresertrag", 0, 1e12, true), pvSelfConsumptionPercent: number(input, "siaPVSelf", "PV-Eigenverbrauchsanteil", 0, 100, true) });
  const hasTargets = balance.zones.some(zone => zone.powerTarget !== undefined || zone.energyTarget !== undefined);
  return {
    siaBreakdown: balance,
    metrics: [
      { label: "Korrigierte Leistung", value: balance.powerKW, unit: "kW", digits: 2 },
      { label: "Jahresenergie vor PV", value: balance.energyKWh / 1000, unit: "MWh/a", digits: 2 },
      { label: "Flächengewichtete Leistungsdichte", value: balance.powerDensity, unit: "W/m²", digits: 2 },
      { label: "Flächengewichtete Energiekennzahl", value: balance.energyDensity, unit: "kWh/(m²·a)", digits: 2 },
      { label: "Netzenergie · Jahresmodell", value: balance.netEnergyKWh / 1000, unit: "MWh/a", digits: 2 },
      { label: "Bezugsfläche", value: balance.area, unit: "m²", digits: 1 },
    ],
    status: { tone: balance.exceedsTargets ? "error" : "warning", text: balance.exceedsTargets ? "Mindestens eine Zone überschreitet ein eingegebenes manuelles Ziel. Kein automatischer SIA-Nachweis." : hasTargets ? "Manuelle Ziele eingehalten. Kennwerte, Klassenzuordnung und Anwendbarkeit sind nicht automatisch geprüft." : "Bilanz aus manuell belegten Rohkennwerten. Kein automatischer Normnachweis." },
    formula: `Je Zone: P_roh = A × Σp_roh / 1000; P = P_roh × Kcor. E_roh = A × Σe_roh; E = E_roh × Jahresgleichzeitigkeit. Leistungskorrektur wirkt ausschliesslich auf P, Jahresgleichzeitigkeit ausschliesslich auf E. ${balance.zones.map(zone => `${zone.label}: P = ${format(zone.rawPowerKW)} × ${format(zone.kcor)} = ${format(zone.powerKW)} kW; E = ${format(zone.rawEnergyKWh)} × ${format(zone.yearGlz)} = ${format(zone.energyKWh)} kWh/a`).join("; ")}. Gesamt p = ${format(balance.powerKW)} × 1000 / ${format(balance.area)} = ${format(balance.powerDensity)} W/m²; e = ${format(balance.energyKWh)} / ${format(balance.area)} = ${format(balance.energyDensity)} kWh/(m²·a). Netzenergie = max(0, ${format(balance.energyKWh)} − ${format(balance.pvConsumedKWh)}) = ${format(balance.netEnergyKWh)} kWh/a.`,
    rows: [
      { label: "Rohleistung vor Kcor", value: balance.rawPowerKW, unit: "kW" },
      { label: "Rohenergie vor Jahresgleichzeitigkeit", value: balance.rawEnergyKWh, unit: "kWh/a" },
      ...balance.zones.flatMap(zone => [{ label: `${zone.label} · Leistung / Jahresenergie`, value: `${format(zone.powerKW)} kW / ${format(zone.energyKWh)} kWh/a` }, { label: `${zone.label} · spezifisch`, value: `${format(zone.powerDensity)} W/m² / ${format(zone.energyDensity)} kWh/(m²·a)` }]),
      { label: "PV im Jahresmodell angerechnet", value: balance.pvConsumedKWh, unit: "kWh/a" },
      ...(balance.powerTarget !== undefined ? [{ label: "Vollständig flächengewichtetes Leistungsziel", value: balance.powerTarget, unit: "W/m²" }] : []),
      ...(balance.energyTarget !== undefined ? [{ label: "Vollständig flächengewichtetes Energieziel", value: balance.energyTarget, unit: "kWh/(m²·a)" }] : []),
    ],
    comparisons: hasTargets ? [
      { title: "Leistungsdichte · manuelle Ziele", unit: "W/m²", items: balance.zones.flatMap(zone => zone.powerTarget !== undefined ? [{ label: zone.label, actual: zone.powerDensity, target: zone.powerTarget }] : []) },
      { title: "Energiekennzahl · manuelle Ziele", unit: "kWh/(m²·a)", items: balance.zones.flatMap(zone => zone.energyTarget !== undefined ? [{ label: zone.label, actual: zone.energyDensity, target: zone.energyTarget }] : []) },
    ].filter(comparison => comparison.items.length > 0) : undefined,
    limitations: [
      `Rohkennwertquelle: ${reference}. Beispielwerte sind eigene Rechenbeispiele, keine SIA-Katalogwerte.`,
      "Der manuelle Modus verwendet ausschliesslich die eingegebenen Rohkennwerte. Ein separater Referenzprofil-Modus enthält den datierten Anbieterstand; dieser ist kein unabhängig bestätigter Normkatalog.",
      "Sieben Verbrauchergruppen je Zone. Rohleistung und Rohenergie werden unabhängig eingegeben; Energie wird nicht aus Leistung mal erfundenen Vollbenutzungsstunden abgeleitet. Kcor wirkt nur auf Leistung, Jahresgleichzeitigkeit nur auf Energie.",
      "Diagramme und Zielvergleiche verwenden die Bruttoenergie vor PV-Abzug. Der PV-Abzug ist eine begrenzte Jahresbilanz, kein Nachweis zeitlicher Eigenverbrauchsgleichzeitigkeit, Lastgänge oder Speicher.",
      "Manuelle Zielwerte sind keine automatische SIA-Klassifikation oder Normfreigabe. Teilweise eingegebene Zonenziele ergeben keinen vollständigen Gesamtzielwert.",
    ],
  };
}

const CLASS_LABELS:Readonly<Record<string,string>> = {s:'S · Klein',m:'M · Mittel',l:'L · Gross',keine:'Keine',gw:'Grenzwert',mg:'Minergie',zw:'Zielwert',sole:'WP Sole / Wasser',luft:'WP Luft',oel:'Öl / Gas / Fernwärme',bestand:'Bestand'};
const CLASS_DEFAULT:Readonly<Record<string,string>> = {devices:'m',processes:'m',lighting:'gw',general:'m',heating:'sole',ventilation:'gw',cooling:'gw'};
function referenceFields():Field[] {
  const choice=(key:string,label:string,value:string,group:string,options:readonly (readonly [string,string])[],visibleWhen=automatic):Field=>({key,label,default:value,kind:'select',group,options:options.map(([value,label])=>({value,label})),visibleWhen,help:'Veröffentlichte Auswahl des Anbieters, Stand 02.11.2026. Datenzuordnung und Normausgabe am Projekt prüfen.'});
  return [choice('siaClimate','Klimaregion','mittelland','Referenzprofil · Klima',[
    ['mittelland','Mittelland · 1104 kWh/m²'],['juranordfuss','Juranordfuss · 1059 kWh/m²'],['alpen','Alpennordflanke · 991 kWh/m²'],['tessin','Tessin / Südalpen · 1414 kWh/m²'],['wallis','Wallis · 1441 kWh/m²'],['graubuenden','Graubünden · 1188 kWh/m²'],
  ]),...[1,2,3,4].flatMap(zone=>{
    const key=(name:string)=>siaReferenceKey(zone,name),group=`Referenzprofil · Zone ${zone}`;
    const active=[...automatic,{key:key('Building'),values:SIA_BUILDING_TYPES.filter(([id])=>id!=='none').map(([id])=>id)}];
    return [choice(key('Building'),`Nutzung Zone ${zone}`,zone===1?'office':'none',group,SIA_BUILDING_TYPES),
      {key:key('RefArea'),label:`Zone ${zone} · Nettofläche`,default:zone===1?'1000':'0',unit:'m²',group,visibleWhen:active,min:0,max:1e7,help:'Aktivierte Zone mit Nettofläche. Eine Fläche von 0 nimmt diese Zone aus der Bilanz.'} as Field,
      choice(key('RefKcor'),`Zone ${zone} · Kcor`,'mid',group,[['min','Tief · untere Grenze'],['mid','Mittel · Standard'],['max','Hoch · obere Grenze']],active),
      choice(key('RefGlz'),`Zone ${zone} · Jahresgleichzeitigkeit`,'default',group,[['default','Vorgabe der Nutzung'],['0.7','0.7'],['0.8','0.8']],active),
      ...SIA_GROUPS.map(g=>choice(key(`Class_${g.id}`),`Zone ${zone} · ${g.label}`,CLASS_DEFAULT[g.id],group,SIA_CONSUMER_CLASS_CODES[g.id].map(code=>[code,CLASS_LABELS[code]??code] as const),active)),
      {key:key('RefPVArea'),label:`Zone ${zone} · PV-Fläche`,default:'0',unit:'m²',group,visibleWhen:active,min:0,max:1e7,help:'PV-Generatorfläche. Veröffentlichung rechnet mit 0.20 kWp/m² und 0.80 Systemwirkungsgrad.'} as Field,
      choice(key('RefPVDirection'),`Zone ${zone} · PV-Ausrichtung`,'sued30',group,[['sued30','Süd 30°'],['sued45','Süd 45°'],['sued90','Süd 90° · Fassade'],['sosw30','SW/SO 30°'],['ow30','W/O 30°'],['flach15sued','Flach 15° Süd']],active),
      choice(key('RefShade'),`Zone ${zone} · Verschattung`,'1',group,[['1','Keine'],['0.9','Gering'],['0.75','Mittel'],['0.55','Stark']],active),
    ];
  })];
}

export function siaReferenceResult(input:Inputs):CalculationResult & {siaBreakdown:SIABalance} {
  const data=calculateSIAReference(input),b=data.balance;
  return{siaBreakdown:b,metrics:[
    {label:'Korrigierte Leistung',value:b.powerKW,unit:'kW',digits:2},
    {label:'Jahresenergie vor PV',value:b.energyKWh/1000,unit:'MWh/a',digits:2},
    {label:'Flächengewichtete Leistungsdichte',value:b.powerDensity,unit:'W/m²',digits:2},
    {label:'Flächengewichtete Energiekennzahl',value:b.energyDensity,unit:'kWh/(m²·a)',digits:2},
    {label:'Standby-Leistung · separat',value:data.standbyKW,unit:'kW',digits:2},
    {label:'Bezugsfläche',value:b.area,unit:'m²',digits:1},
    {label:'PV-Produktion · separat',value:data.pvYearKWh/1000,unit:'MWh/a',digits:2},
    {label:'PV-Leistung',value:data.pvKWp,unit:'kWp',digits:2},
  ],status:{tone:'warning',text:'Datierter Anbieter-Referenzstand berechnet. Kennwert- und Normzuordnung sind projektspezifisch zu prüfen.'},
  formula:`Je Zone: P = A × Σp_roh × Kcor / 1000; E = A × Σe_roh × Jahresgleichzeitigkeit. ${b.zones.map(z=>`${z.label}: P = ${format(z.rawPowerKW)} × ${format(z.kcor)} = ${format(z.powerKW)} kW; E = ${format(z.rawEnergyKWh)} × ${format(z.yearGlz)} = ${format(z.energyKWh)} kWh/a`).join('; ')}. PV = A_PV × 0.20 × G_Klima × f_Ausrichtung × f_Verschattung × 0.80 = ${format(data.pvYearKWh)} kWh/a.`,
  rows:[{label:'Datenstand',value:`${SIA_REFERENCE_SOURCE.captured} · ${SIA_REFERENCE_SOURCE.url}`},{label:'Rohleistung vor Kcor',value:b.rawPowerKW,unit:'kW'},{label:'Rohenergie vor Jahresgleichzeitigkeit',value:b.rawEnergyKWh,unit:'kWh/a'},{label:'Kcor · flächengewichtet',value:data.kcorAverage},{label:'Jahresgleichzeitigkeit · flächengewichtet',value:data.yearGlzAverage},...data.metadata.flatMap(z=>[{label:`${z.name} · Standby`,value:z.standbyKW,unit:'kW'},{label:`${z.name} · PV-Produktion`,value:z.pvYearKWh,unit:'kWh/a'}])],
  limitations:[
    `Veröffentlichte Tabellenwerte vom ${SIA_REFERENCE_SOURCE.captured}; keine unabhängige Bestätigung der Normausgabe, Quellenlizenzen oder Zuordnung jeder Nutzungs-/Verbraucherklasse. Eine belegte Anbieterrechnung ist kein SIA-Konformitätsnachweis.`,
    'Die Geräteklasse L bei Verkauf (Food) ist in der Quelle ausdrücklich ohne Kennwert und bleibt gesperrt. Es wird weder interpoliert noch ein Nullwert eingesetzt.',
    'Kcor wirkt auf Betrieb und Standby; die Jahresgleichzeitigkeit wirkt ausschliesslich auf die Rohenergie. Standby wird wie in der Referenz separat ausgewiesen und nicht ein zweites Mal zur Betriebsleistung addiert.',
    'PV-Produktion wird separat dargestellt. Keine automatische Verrechnung als vollständiger Eigenverbrauch. 20 % Modulwirkungsgrad, 80 % Systemwirkungsgrad sowie Klima-/Ausrichtungsfaktoren sind veröffentlichte Näherungsannahmen, keine Stundenbilanz.',
  ]};
}

export function createSIADefinition(legacy: CalculatorDefinition): CalculatorDefinition {
  return { ...legacy, title: "SIA 2056 · Verbraucherbilanz", description: "Sieben Verbrauchergruppen je Zone, getrennte Leistungs- und Energieansätze und gewichtete Bilanz.", source: SIA_DATA_SOURCE,
    scope: "SIA 2056 · manuelle Rohkennwerte oder datierte veröffentlichte Referenzprofile. Leistung: Kcor; Jahresenergie: eigene Gleichzeitigkeit. Kein unabhängiger Normnachweis.",
    fields: [
      { key: "siaMode", label: "Berechnungsgrundlage", default: "manual", kind: "select", group: "Grundlage", options: [{ value: "manual", label: "Manuelle Rohkennwerte · sieben Gruppen" }, { value: "automatic", label: "Veröffentlichte Referenzprofile · 02.11.2026" }, { value: "legacy", label: "Bisherige manuelle Zonenbilanz" }], help: "Manuelle Kennwerte oder veröffentlichte Anbieterprofile mit allen vier Zonen. Die Referenzdaten sind datiert und nicht unabhängig als Normtabellen bestätigt. Die ausdrücklich fehlende Geräteklasse Food/L bleibt gesperrt. Bestehende Stände behalten ihr bisheriges Modell." },
      { key: "siaSource", label: "Quelle der Rohkennwerte", default: "Eigenes Rechenbeispiel: 20 W/m² und 30 kWh/(m²·a) Geräte; keine SIA-Normwerte", kind: "text", group: "Manuelle Bilanz", visibleWhen: manual, help: "Normausgabe/Tabelle, Hersteller oder projektspezifische Annahme dokumentieren. Ein Quellenvermerk allein bestätigt keine fachliche Zuordnung." },
      { key: "siaZones", label: "Nutzungszonen und sieben Verbrauchergruppen", default: DEFAULT_SIA_ZONES, kind: "text", group: "Nutzungszonen", visibleWhen: manual, help: "Strukturierte Eingaben werden über die Zonentabelle bearbeitet. Rohleistung in W/m² und Rohenergie in kWh/(m²·a) getrennt erfassen; ungenutzte Gruppen explizit mit 0." },
      f("siaPV", "PV-Jahresertrag", "0", "kWh/a", "Manuelle Jahresannahme; die Bruttodiagramme bleiben unverändert."),
      f("siaPVSelf", "Anzurechnender PV-Eigenverbrauchsanteil", "50", "%", "Der Abzug wird auf die Jahresenergie begrenzt. Keine zeitaufgelöste Eigenverbrauchssimulation."),
      ...referenceFields(),
      ...legacy.fields.map(field => ({ ...field, visibleWhen: [...(field.visibleWhen ?? []), { key: "siaMode", values: ["legacy"] }] })),
    ],
    calculate(input) {
      if (input.siaMode === "automatic") return siaReferenceResult(input);
      if (input.siaMode === "legacy") {
        const result = legacy.calculate(input);
        return { ...result, status: { ...result.status, tone: result.status.tone === "error" ? "error" : "warning", text: `Bisherige manuelle Bilanz: ${result.status.text}` }, limitations: ["Unverändertes bisheriges Modell für gespeicherte Projektstände. Es verwendet andere Faktorbezüge als die neue getrennte Rohkennwertbilanz; kein identisches SIA-Referenzverfahren.", ...result.limitations] };
      }
      if (input.siaMode !== "manual") throw new Error("Berechnungsgrundlage auswählen.");
      return siaManualResult(input);
    },
  };
}
