/** Independent project sensitivity model; no provider implementation is bundled. */
export interface PVFinancialScenario {
  investment: number;
  grant: number;
  basis: "gross" | "net";
  annualEnergy: number;
  buyPrice: number;
  feedPrice: number;
  selfShare: number;
  operatingShare: number;
  degradation: number;
  years: number;
}

export interface PVSensitivity {
  key: "buy" | "investment" | "yield" | "self" | "feed";
  label: string;
  minus: number | null;
  plus: number | null;
}

export interface PVAnalysis {
  years: number;
  basis: "gross" | "net";
  basePayback: number | null;
  scenarios: PVSensitivity[];
  history: { year: number; buyRp: number; feedRp: number }[];
}

export const PV_HISTORY_REFERENCE = {
  observed: "2026-11-02",
  period: "2020–2026",
  qualification: "Datierte Vergleichsdaten · keine aktuelle Tarifauskunft oder Prognose",
};

// Historical observations from the dated comparison, not live official tariffs.
const history = [
  { year: 2020, buyRp: 20.5, feedRp: 9.5 },
  { year: 2021, buyRp: 21.2, feedRp: 9.0 },
  { year: 2022, buyRp: 21.7, feedRp: 10.5 },
  { year: 2023, buyRp: 27.2, feedRp: 14.0 },
  { year: 2024, buyRp: 28.7, feedRp: 13.2 },
  { year: 2025, buyRp: 32.1, feedRp: 11.5 },
  { year: 2026, buyRp: 29.1, feedRp: 9.0 },
] as const;

function validate(s: PVFinancialScenario): void {
  if (![s.investment, s.grant, s.annualEnergy, s.buyPrice, s.feedPrice, s.selfShare, s.operatingShare, s.degradation, s.years].every(Number.isFinite)
      || [s.investment, s.grant, s.annualEnergy, s.buyPrice, s.feedPrice, s.operatingShare].some(value => value < 0)
      || s.selfShare < 0 || s.selfShare > 1 || s.degradation < 0 || s.degradation >= 1
      || !Number.isInteger(s.years) || s.years < 1 || s.years > 50 || !["gross", "net"].includes(s.basis)) {
    throw new Error("Gültige PV-Projektannahmen für die Sensitivität eingeben.");
  }
}

/** First crossing of the selected capital basis, interpolated inside that year. */
export function pvPayback(s: PVFinancialScenario): number | null {
  validate(s);
  const capital = s.basis === "gross" ? s.investment : Math.max(0, s.investment - s.grant);
  if (capital === 0) return 0;
  const tariff = s.selfShare * s.buyPrice + (1 - s.selfShare) * s.feedPrice;
  const operation = s.investment * s.operatingShare;
  let accumulated = 0;
  for (let year = 1; year <= s.years; year++) {
    const cash = s.annualEnergy * (1 - s.degradation) ** (year - 1) * tariff - operation;
    if (cash > 0 && accumulated + cash >= capital) return year - 1 + (capital - accumulated) / cash;
    accumulated += cash;
  }
  return null;
}

/** Vary one input at a time; every scenario retains the current project assumptions. */
export function pvSensitivity(s: PVFinancialScenario): PVAnalysis {
  validate(s);
  const definitions: { key: PVSensitivity["key"]; label: string; alter: (factor: number) => PVFinancialScenario }[] = [
    { key: "buy", label: "Bezugspreis", alter: factor => ({ ...s, buyPrice: s.buyPrice * factor }) },
    { key: "investment", label: "Investition", alter: factor => ({ ...s, investment: s.investment * factor }) },
    { key: "yield", label: "Jahresertrag", alter: factor => ({ ...s, annualEnergy: s.annualEnergy * factor }) },
    { key: "self", label: "Eigenverbrauch", alter: factor => ({ ...s, selfShare: Math.min(1, s.selfShare * factor) }) },
    { key: "feed", label: "Einspeisetarif", alter: factor => ({ ...s, feedPrice: s.feedPrice * factor }) },
  ];
  return {
    years: s.years,
    basis: s.basis,
    basePayback: pvPayback(s),
    scenarios: definitions.map(({ key, label, alter }) => ({ key, label, minus: pvPayback(alter(.8)), plus: pvPayback(alter(1.2)) })),
    history: history.map(point => ({ ...point })),
  };
}
