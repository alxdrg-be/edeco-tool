/** Observed public reference curves; independent norm-table validation is still required. */
export const EV_FACTOR_SOURCE = "https://www.elektro-rechner.ch/assets/sia2060.js?v=5399be1e2d";
export const EV_FACTOR_SOURCE_SHA256 = "465e106df91db517a74bb1a954fa3b02be2af3d11ad5ccdb8d03bdb43c5d0765";
export const EV_FACTOR_REFERENCE_MAX_COUNT = 100;
export const EV_FACTOR_BASIS = "Veröffentlichte Referenzkurve · Normzuordnung ungeprüft";
export const EV_USER_CLASSES = [
  { value: "residents", label: "Bewohner / Beschäftigte" },
  { value: "visitors", label: "Kunden / Besucher" },
  { value: "transit", label: "Durchreise" },
] as const;
export const EV_MANUAL_FACTORS = [1, .7, .5, .3] as const;
export const EV_DC_POWER_OPTIONS = [50, 150, 350].map(power => ({ value: String(power), label: `${power} kW · DC, AC-Ersatzmodell η = 1` }));
export const EV_EXTENSION_DEFAULTS = {
  hours: "10", consumption: "18", pv: "0", battery: "0", sourceConnection: "house", factorMode: "manual", userClass: "residents", chargerKind: "auto", powerMode: "preset",
} as const;

type CurveSegment = { upTo: number; coefficient: number; exponent: number };
type Curve = { userClass: string; power: number | null; segments: CurveSegment[] };
const PUBLISHED_CURVES: Curve[] = [
  { userClass: "residents", power: null, segments: [{ upTo: Infinity, coefficient: .800, exponent: -.401 }] },
  { userClass: "visitors", power: 11, segments: [{ upTo: Infinity, coefficient: .895, exponent: -.347 }] },
  { userClass: "visitors", power: 22, segments: [{ upTo: Infinity, coefficient: .455, exponent: -.263 }] },
  { userClass: "visitors", power: 50, segments: [{ upTo: 3, coefficient: .8, exponent: 0 }, { upTo: Infinity, coefficient: 1.670, exponent: -.527 }] },
  { userClass: "transit", power: 100, segments: [{ upTo: 3, coefficient: 1, exponent: 0 }, { upTo: Infinity, coefficient: 1.119, exponent: -.094 }] },
  { userClass: "transit", power: 150, segments: [{ upTo: 3, coefficient: 1, exponent: 0 }, { upTo: Infinity, coefficient: 1.226, exponent: -.164 }] },
  { userClass: "transit", power: 350, segments: [{ upTo: 1, coefficient: 1, exponent: 0 }, { upTo: Infinity, coefficient: 1.111, exponent: -.192 }] },
];
export function publishedEVFactorDetails(userClass: string, count: number, power: number, customPower = false) {
  if (!EV_USER_CLASSES.some(option => option.value === userClass)) throw new Error("Anwenderklasse wählen.");
  if (!Number.isInteger(count) || count < 1 || !Number.isFinite(power) || power <= 0) throw new Error("Für die Referenzkurve Anzahl und Leistung prüfen.");
  if (count > EV_FACTOR_REFERENCE_MAX_COUNT) throw new Error("Veröffentlichte Referenzauswahl: höchstens 100 Ladepunkte; ausserhalb davon eigenen Faktor dokumentieren.");
  if (customPower && userClass !== "residents") return null;
  const curve = PUBLISHED_CURVES.find(row => row.userClass === userClass && (row.power === null || row.power === power));
  const segment = curve?.segments.find(row => count <= row.upTo);
  return segment ? { value: Math.min(1, segment.coefficient * count ** segment.exponent), coefficient: segment.coefficient, exponent: segment.exponent } : null;
}

export function publishedEVFactor(userClass: string, count: number, power: number, customPower = false) {
  return publishedEVFactorDetails(userClass, count, power, customPower)?.value ?? null;
}
