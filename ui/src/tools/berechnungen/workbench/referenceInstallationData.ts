/** Published reference data, observed 2026-11-01; entries must correspond to NIN 2025 5.2.3.
 * This snapshot records provider behavior, not an independently licensed norm edition.
 * Unsupported combinations are null; no interpolation or extrapolation is performed.
 */
export const INSTALLATION_REFERENCE = { url: "https://www.elektro-rechner.ch/Rechner/nin-kabelrechner.html", observed: "2026-11-01", sha256: "1893aead40ecb010d64631c521c022d9902b990081079375838162d242008ba8" } as const;
export const PUBLISHED_AREAS = [1.5,2.5,4.0,6.0,10.0,16.0,25.0,35.0,50.0,70.0,95.0,120.0,150.0,185.0,240.0,300.0,400.0,500.0,630.0] as const;
export interface PublishedIzConfig { material: "cu"; isolation: "pvc" | "xlpe"; cores: 2 | 3; method: string }
export interface PublishedIzInput extends PublishedIzConfig { area: number }
const ratings: Record<string, Record<string, readonly (number | null)[]>> = {
  "pvc-2": {
    "A1": [14.5,19.5,26,34,46,61,80,99,119,151,182,210,240,273,321,367,null,null,null],
    "A2": [14,18.5,25,32,43,57,75,92,110,139,167,192,219,248,291,334,null,null,null],
    "B1": [17.5,24,32,41,57,76,101,125,151,192,232,269,300,341,400,458,null,null,null],
    "B2": [16.5,23,30,38,52,69,90,111,133,168,201,232,258,294,344,394,null,null,null],
    "C": [19.5,27,36,46,63,85,112,138,168,213,258,299,344,392,461,530,null,null,null],
    "D": [22,29,37,46,60,78,99,119,140,173,204,231,261,292,336,379,null,null,null],
    "E": [22,30,40,51,70,94,119,148,180,232,282,328,379,434,514,593,null,null,null],
    "F": [null,null,null,null,null,null,131,162,196,251,304,352,406,463,546,629,754,868,1005],
    "F-eben": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    "G-h": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    "G-v": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  },
  "pvc-3": {
    "A1": [13.5,18,24,31,42,56,73,89,108,136,164,188,216,245,286,328,null,null,null],
    "A2": [13,17.5,23,29,39,52,68,83,99,125,150,172,196,223,261,298,null,null,null],
    "B1": [15.5,21,28,36,50,68,89,110,134,171,207,239,262,296,346,394,null,null,null],
    "B2": [15,20,27,34,46,62,80,99,118,149,179,206,225,255,297,339,null,null,null],
    "C": [17.5,24,32,41,57,76,96,119,144,184,223,259,299,341,403,464,null,null,null],
    "D": [18,24,30,38,50,64,82,98,116,143,169,192,217,243,280,316,null,null,null],
    "E": [18.5,25,34,43,60,80,101,126,153,196,238,276,319,364,430,497,null,null,null],
    "F": [null,null,null,null,null,null,110,137,167,216,264,308,356,409,485,561,656,749,855],
    "F-eben": [null,null,null,null,null,null,114,143,174,225,275,321,372,427,507,587,689,789,905],
    "G-h": [null,null,null,null,null,null,146,181,219,281,341,396,456,521,615,709,852,982,1138],
    "G-v": [null,null,null,null,null,null,130,162,197,254,311,362,419,480,569,659,795,920,1070],
  },
  "xlpe-2": {
    "A1": [19,26,35,45,61,81,106,131,158,200,241,278,318,362,424,486,null,null,null],
    "A2": [18.5,25,33,42,57,76,99,121,145,183,220,253,290,329,386,442,null,null,null],
    "B1": [23,31,42,54,75,100,133,164,198,253,306,354,393,449,528,603,null,null,null],
    "B2": [22,30,40,51,69,91,119,146,175,221,265,305,334,384,459,532,null,null,null],
    "C": [24,33,45,58,80,107,138,171,209,269,328,382,441,506,599,693,null,null,null],
    "D": [25,33,43,53,71,91,116,139,164,203,239,271,306,343,395,446,null,null,null],
    "E": [26,36,49,63,86,115,149,185,225,289,352,410,473,542,641,741,null,null,null],
    "F": [null,null,null,null,null,null,161,200,242,310,377,437,504,575,679,783,940,1083,1254],
    "F-eben": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    "G-h": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
    "G-v": [null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
  },
  "xlpe-3": {
    "A1": [17,23,31,40,54,73,95,117,141,179,216,249,285,324,380,435,null,null,null],
    "A2": [16.5,22,30,38,51,68,89,109,130,164,197,227,259,295,346,396,null,null,null],
    "B1": [20,28,37,48,66,88,117,144,175,222,269,312,342,384,450,514,null,null,null],
    "B2": [19.5,26,35,44,60,80,105,128,154,194,233,268,300,340,398,455,null,null,null],
    "C": [22,30,40,52,71,96,119,147,179,229,278,322,371,424,500,576,null,null,null],
    "D": [21,28,36,44,58,75,96,115,135,167,197,223,251,281,324,365,null,null,null],
    "E": [23,32,42,54,75,100,127,158,192,246,298,346,399,456,538,621,null,null,null],
    "F": [null,null,null,null,null,null,135,169,207,268,328,383,444,510,607,703,823,946,1088],
    "F-eben": [null,null,null,null,null,null,141,176,216,279,342,400,464,533,634,736,868,998,1151],
    "G-h": [null,null,null,null,null,null,182,226,275,353,430,500,577,661,781,902,1085,1253,1454],
    "G-v": [null,null,null,null,null,null,161,201,246,318,389,454,527,605,719,833,1008,1169,1362],
  },
};
export function lookupPublishedIz(input: PublishedIzInput): number | null {
  if (input.material !== "cu") return null;
  const index = (PUBLISHED_AREAS as readonly number[]).indexOf(input.area);
  if (index < 0) return null;
  return ratings[`${input.isolation}-${input.cores}`]?.[input.method]?.[index] ?? null;
}
export function publishedAreas(config: PublishedIzConfig): number[] {
  return PUBLISHED_AREAS.filter(area => lookupPublishedIz({ ...config, area }) !== null);
}
const temperatureAir: Record<string, Record<number, number>> = {
  pvc: {"10":1.22,"15":1.17,"20":1.12,"25":1.06,"30":1.0,"35":0.94,"40":0.87,"45":0.79,"50":0.71,"55":0.61,"60":0.5},
  xlpe: {"10":1.15,"15":1.12,"20":1.08,"25":1.04,"30":1.0,"35":0.96,"40":0.91,"45":0.87,"50":0.82,"55":0.76,"60":0.71},
};
const temperatureGround: Record<string, Record<number, number>> = {
  pvc: {"10":1.1,"15":1.05,"20":1.0,"25":0.95,"30":0.89,"35":0.84,"40":0.77,"45":0.71,"50":0.63,"55":0.55,"60":0.45},
  xlpe: {"10":1.07,"15":1.04,"20":1.0,"25":0.96,"30":0.93,"35":0.89,"40":0.85,"45":0.8,"50":0.76,"55":0.71,"60":0.65,"65":0.6,"70":0.53,"75":0.46,"80":0.38},
};
export function publishedTemperatureFactor(isolation: "pvc" | "xlpe", temperature: number, method: string): number | null {
  const table = method === "D" ? temperatureGround : temperatureAir;
  return table[isolation]?.[temperature] ?? null;
}
const groupedAir: Record<number, number> = { 1:1, 2:.8, 3:.7, 4:.65, 5:.6, 6:.57, 7:.54, 8:.52, 9:.5, 12:.45, 16:.41, 20:.38 };
const groupedGround: Record<number, number> = { 1:1, 2:.75, 3:.65, 4:.6, 5:.55, 6:.5 };
export function publishedGroupingFactor(count: number, method: string): number | null {
  if (!Number.isInteger(count) || count < 1) return null;
  const table = method === "D" ? groupedGround : groupedAir;
  const next = Object.keys(table).map(Number).sort((a,b) => a-b).find(value => value >= count);
  return next === undefined ? null : table[next];
}

export type PublishedTrayType = "pvc" | "xlpe" | "cfw";
const cfwTray: Record<number, number> = { 25:138,35:171,50:208,70:263,95:323,120:376,150:432,185:499,240:591,300:678 };
export function lookupPublishedTrayIz(type: PublishedTrayType, method: "E" | "F", area: number): number | null {
  if (type === "cfw") return cfwTray[area] ?? null;
  return lookupPublishedIz({ material: "cu", isolation: type, cores: 3, method, area });
}
export function publishedTrayGroupingFactor(type: PublishedTrayType, count: number): number | null {
  const factors = type === "cfw" ? [1,.93,.9,.88] : [1,.88,.82,.77];
  return Number.isInteger(count) && count >= 1 && count <= 4 ? factors[count-1] : null;
}
export const TRAY_REFERENCE = {
  url: "https://www.elektro-rechner.ch/Rechner/Strombelastbarkeit.html", observed: "2026-11-01",
  sha256: "9f043889248548d05975306395148e3393e564e358b32b983f1dfa5baf090e83",
  cfwGroupingUrl: "https://www.elektro-rechner.ch/assets/cfw-powercable-excel.js",
  cfwGroupingSha256: "f91e0c12d34ab135ed79cd65f4bb9c8c80debcd20dc2c708ee50e871de27ba49",
} as const;

/** Published provider transcription of Hager handbook p.54; not independently
 * checked manufacturer coordination. Never extrapolate to another device series. */
export const HAGER_BACKUP_REFERENCE = {
  url:"https://www.elektro-rechner.ch/Rechner/ls-schalter.html",observed:"2026-11-02",
  sha256:"fa5893414f1231d3497536807bc9543fc0cfc35f6153b6de1d099f8b1901a6fa",
  attribution:"Hager-Handbuch S.54 laut veröffentlichter Referenz; Originalnachweis offen",
} as const;
export type PublishedHagerFamily="standard6"|"high10";
export function publishedHagerBackup(family:PublishedHagerFamily,curve:string,rated:number,upstream:number,icnKA:number):number|null {
  if(!Number.isFinite(rated)||rated<=0||rated>63)return null;
  const standard:Record<number,number>={50:50,63:40,80:25,100:25,125:25};
  const high:Record<number,number>={50:60,63:60,80:60,100:60,125:60,160:60};
  if(family==="standard6"&&icnKA===6&&["B","C"].includes(curve))return standard[upstream]??null;
  if(family==="high10"&&[10,15,25].includes(icnKA)&&["B","C","D"].includes(curve))return high[upstream]??null;
  return null;
}

export interface PoeCableReference { id:string; label:string; resistance20:number; diameter:number; shielding:string; referenceLengthFactors:Readonly<Record<string,number>>; attenuationPerDegree:number; shieldCorrection:number }
export const POE_CABLE_REFERENCES: readonly PoeCableReference[] = [
  {"id":"cat5e-u-awg24","label":"Cat5e/u (AWG24)","resistance20":9.5,"diameter":5.0,"shielding":"/u","referenceLengthFactors":{"D":1.0},"attenuationPerDegree":0.4,"shieldCorrection":0.0},
  {"id":"cat6-u-awg24","label":"Cat6/u (AWG24)","resistance20":8.5,"diameter":5.7,"shielding":"/u","referenceLengthFactors":{"D":1.0,"E":1.0},"attenuationPerDegree":0.4,"shieldCorrection":0.0},
  {"id":"cat6-u-awg23","label":"Cat6/u (AWG23)","resistance20":7.5,"diameter":6.0,"shielding":"/u","referenceLengthFactors":{"D":1.05,"E":1.0},"attenuationPerDegree":0.4,"shieldCorrection":0.0},
  {"id":"cat6a-u-awg23","label":"Cat6A/u (AWG23)","resistance20":8.5,"diameter":9.0,"shielding":"/u","referenceLengthFactors":{"D":1.1,"E":1.05,"EA":1.0},"attenuationPerDegree":0.4,"shieldCorrection":0.0},
  {"id":"cat5e-s-awg24","label":"Cat5e/s (AWG24)","resistance20":9.5,"diameter":5.0,"shielding":"/s","referenceLengthFactors":{"D":1.0},"attenuationPerDegree":0.2,"shieldCorrection":1.274},
  {"id":"cat6-s-awg23","label":"Cat6/s (AWG23)","resistance20":7.5,"diameter":7.5,"shielding":"/s","referenceLengthFactors":{"D":1.05,"E":1.0},"attenuationPerDegree":0.2,"shieldCorrection":1.274},
  {"id":"cat6a-s-awg23","label":"Cat6A/s (AWG23)","resistance20":7.5,"diameter":7.5,"shielding":"/s","referenceLengthFactors":{"D":1.1,"E":1.05,"EA":1.0,"F":1.0},"attenuationPerDegree":0.2,"shieldCorrection":1.424},
  {"id":"cat7-s-awg23","label":"Cat7/s (AWG23)","resistance20":7.5,"diameter":7.5,"shielding":"/s","referenceLengthFactors":{"D":1.1,"E":1.05,"EA":1.0,"F":1.0},"attenuationPerDegree":0.2,"shieldCorrection":1.424},
  {"id":"cat7-s-awg22","label":"Cat7/s (AWG22)","resistance20":6.0,"diameter":8.5,"shielding":"/s","referenceLengthFactors":{"D":1.15,"E":1.1,"EA":1.05,"F":1.0,"FA":1.0},"attenuationPerDegree":0.2,"shieldCorrection":1.424},
  {"id":"cat7a-s-awg22","label":"Cat7A/s (AWG22)","resistance20":6.0,"diameter":8.5,"shielding":"/s","referenceLengthFactors":{"D":1.15,"E":1.1,"EA":1.05,"F":1.0,"FA":1.0},"attenuationPerDegree":0.2,"shieldCorrection":1.424},
];
export const POE_CABLE_SOURCE = {url:"https://www.elektro-rechner.ch/assets/poe-engine.js",observed:"2026-11-01",sha256:"211cb4eb84fa81f1e3fecfd0401eabc1a414d64a4e62822bc70d7a862e8396f9", qualification:"Publizierte generische Referenzannahmen; Datenblatt und Normzuordnung separat bestätigen"} as const;

export interface PvTariffReference { id:string; label:string; rp:number }
export const PV_BUY_TARIFFS: readonly PvTariffReference[] = [
  {"id":"CH","label":"CH Median · Referenz 2026","rp":29.1},
  {"id":"AG","label":"Aargau","rp":27.5},
  {"id":"AI","label":"App. Innerrh.","rp":28.2},
  {"id":"AR","label":"App. Ausserrh.","rp":28.7},
  {"id":"BE","label":"Bern","rp":29.7},
  {"id":"BL","label":"Basel-Land","rp":31.1},
  {"id":"BS","label":"Basel-Stadt","rp":33.2},
  {"id":"FR","label":"Fribourg","rp":27.3},
  {"id":"GE","label":"Genf","rp":24.9},
  {"id":"GL","label":"Glarus","rp":28.9},
  {"id":"GR","label":"Graubünden","rp":29.6},
  {"id":"JU","label":"Jura","rp":26.2},
  {"id":"LU","label":"Luzern","rp":24.4},
  {"id":"NE","label":"Neuenburg","rp":28.1},
  {"id":"NW","label":"Nidwalden","rp":23.6},
  {"id":"OW","label":"Obwalden","rp":25.8},
  {"id":"SG","label":"St. Gallen","rp":29.1},
  {"id":"SH","label":"Schaffhausen","rp":31.2},
  {"id":"SO","label":"Solothurn","rp":29.4},
  {"id":"SZ","label":"Schwyz","rp":26.3},
  {"id":"TG","label":"Thurgau","rp":29.3},
  {"id":"TI","label":"Tessin","rp":26.4},
  {"id":"UR","label":"Uri","rp":24.9},
  {"id":"VD","label":"Waadt","rp":27.4},
  {"id":"VS","label":"Wallis","rp":26.9},
  {"id":"ZG","label":"Zug","rp":23.5},
  {"id":"ZH","label":"Zürich","rp":24.2},
];
export const PV_FEED_TARIFFS: readonly PvTariffReference[] = [
  {"id":"CH","label":"CH Median · Referenz 2026","rp":9.0},
  {"id":"SGSW","label":"St. Galler Stadtwerke","rp":13.6},
  {"id":"IWB","label":"IWB Basel","rp":13.0},
  {"id":"ewz","label":"ewz Zürich","rp":13.0},
  {"id":"ewl","label":"ewl Luzern","rp":11.1},
  {"id":"SiL","label":"SiL Lausanne","rp":11.1},
  {"id":"ewb","label":"ewb Bern","rp":11.0},
  {"id":"SIG","label":"SIG Genf","rp":11.0},
  {"id":"StWi","label":"Stadtwerk Winterthur","rp":10.8},
  {"id":"Vit","label":"Viteos NE","rp":10.1},
  {"id":"EBL","label":"Elektra Baselland","rp":10.0},
  {"id":"EKZ","label":"EKZ Kt. Zürich","rp":10.0},
  {"id":"ESB","label":"Energie Service Biel","rp":9.5},
  {"id":"BKW","label":"BKW Bern","rp":9.2},
  {"id":"PrAV","label":"Primeo Energie (AVAG)","rp":9.0},
  {"id":"AIL","label":"AIL Lugano","rp":9.0},
  {"id":"AMB","label":"AM Bellinzona","rp":9.0},
  {"id":"CKW","label":"CKW Luzern","rp":9.0},
  {"id":"Prim","label":"Primeo Energie","rp":9.0},
  {"id":"Eni","label":"Eniwa Aarau","rp":9.0},
  {"id":"EWN","label":"EW Nidwalden","rp":9.0},
  {"id":"SES","label":"SES Sopracenerina","rp":9.0},
  {"id":"EKS","label":"EKS Schaffhausen","rp":8.7},
  {"id":"GrE","label":"Groupe E Freiburg","rp":8.5},
  {"id":"SAK","label":"SAK St.Gallen","rp":8.5},
  {"id":"AEW","label":"AEW Aargau","rp":8.3},
  {"id":"SIE","label":"SIE Sierre","rp":8.0},
  {"id":"WWZ","label":"WWZ Zug","rp":8.0},
  {"id":"Oik","label":"Oiken Wallis","rp":7.6},
  {"id":"Rep","label":"Repower GR","rp":7.2},
  {"id":"RoE","label":"Romande Energie","rp":7.0},
  {"id":"ref","label":"Ref.Marktpreis BFE","rp":7.5},
];
export const PV_DIRECTIONS: Readonly<Record<string,{label:string;factor:number}>> = {
  south:{label:"Süd",factor:1}, southeast:{label:"Südost / Südwest",factor:.95}, eastwest:{label:"Ost / West",factor:.8}, north:{label:"Nord-Teil",factor:.85},
};
export const PV_TILTS: Readonly<Record<string,number>> = {"20":.95,"30":1,"35":1,"45":.97};
export const PV_MODULES = [
  {id:"22-1.92",efficiency:22,area:1.92},{id:"21.5-1.95",efficiency:21.5,area:1.95},{id:"22.5-1.95",efficiency:22.5,area:1.95},
  {id:"23-1.95",efficiency:23,area:1.95},{id:"24.5-1.95",efficiency:24.5,area:1.95},{id:"18-1.7",efficiency:18,area:1.7},
] as const;
export function publishedMinimumFeedRp(kwp:number, selfConsumption:boolean):number {
  if(!Number.isFinite(kwp)||kwp<=0)throw new Error("Anlagenleistung muss positiv sein.");
  return kwp<30?6:selfConsumption?180/kwp:6.2;
}
export function publishedPvGrant(kwp:number, style:"mounted"|"free"|"integrated", selfConsumption:boolean, steep:boolean, parking:boolean) {
  if(!Number.isFinite(kwp)||kwp<=0)throw new Error("Anlagenleistung muss positiv sein.");
  if(kwp<2)return {program:"kein Beitrag im Referenzmodell",main:0,bonus:0,total:0};
  const integrated=style==="integrated",low=integrated?400:360,mid=integrated?330:300;
  const main=!selfConsumption&&kwp<150?450*kwp:low*Math.min(kwp,30)+mid*Math.min(Math.max(kwp-30,0),70)+250*Math.max(kwp-100,0);
  const bonus=(steep?(integrated?400:200)*kwp:0)+(parking&&kwp>=100?250*kwp:0);
  return {program:!selfConsumption&&kwp<150?"HEIV-Referenzansatz":kwp<100?"KLEIV-Referenzansatz":"GREIV-Referenzansatz",main,bonus,total:main+bonus};
}
export const PV_REFERENCE = {url:"https://www.elektro-rechner.ch/Rechner/pva-rechner.html",observed:"2026-11-01",sha256:"b8ac93253238abf8facb5bfda3dbb36a19347a13294cfd8dc7fef9c52789e9ef",tariffYear:2026,grantStand:"Ansätze 01.04.2025 / Boni 01.01.2026",minimumFeedStand:"EnV Art. 12 · Referenzstand 01.01.2026",qualification:"Publizierte Annahmen und Tarif-/Förderreferenz, kein aktueller EVU-/Pronovo-Abruf"} as const;
