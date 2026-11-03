import { useId } from "react";
import { useAnimatedGeometry } from "../useAnimatedGeometry";
import { PV_HISTORY_REFERENCE, type PVAnalysis } from "./pvAnalysis";
import type { SeriesItem } from "./types";
import "./pv-analysis.css";

const amount = (value: number, digits = 1) => value.toLocaleString("de-CH", { maximumFractionDigits: digits });
const duration = (value: number | null, years: number) => value === null ? `über ${years}` : amount(value);

function SensitivityChart({ analysis }: { analysis: PVAnalysis }) {
  const id = useId(), left = 165, right = 640, top = 42, rowHeight = 72;
  const position = (value: number | null) => left + Math.min(analysis.years, value ?? analysis.years) / analysis.years * (right - left);
  const rows = [...analysis.scenarios].sort((a, b) => Math.abs((b.minus ?? analysis.years) - (b.plus ?? analysis.years)) - Math.abs((a.minus ?? analysis.years) - (a.plus ?? analysis.years)));
  const geometry = useAnimatedGeometry<Record<string,number>>({ ...Object.fromEntries(rows.flatMap((row,index) => [[`${row.key}-minus`, position(row.minus)], [`${row.key}-plus`, position(row.plus)], [`${row.key}-y`,top+index*rowHeight]])),baseline:position(analysis.basePayback) });
  const baseline = geometry.baseline, axis = top + rows.length * rowHeight;
  return <figure className="pv-analysis-figure" aria-label="Sensitivität der PV-Amortisation">
    <div className="pv-analysis-heading"><h3>Was beeinflusst die Amortisation?</h3><span>Jeweils ±20 %</span></div>
    <p>Eine Annahme wird verändert; die übrigen Projektwerte bleiben dieselben. Basis: {duration(analysis.basePayback, analysis.years)} Jahre · {analysis.basis === "gross" ? "Bruttoinvestition" : "Nettoinvestition nach Förderung"}.</p>
    <div className="pv-analysis-legend"><span><i />−20 % des Eingabewerts</span><span><i />+20 % des Eingabewerts</span></div>
    <div className="pv-analysis-scroll" role="region" tabIndex={0} aria-label="Sensitivitätsdiagramm, bei Bedarf horizontal verschieben">
      <svg viewBox={`0 0 930 ${axis + 45}`} className="lab-svg pv-analysis-svg" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Amortisation in Jahren bei jeweils zwanzig Prozent kleinerem und grösserem Eingabewert</title>
        {[0, 1, 2, 3, 4].map(tick => {
          const value = analysis.years * tick / 4, x = position(value);
          return <g key={tick}><path d={`M${x} ${top}V${axis}`} stroke="var(--line)" /><text x={x} y={axis + 24} textAnchor="middle">{amount(value)}</text></g>;
        })}
        <path d={`M${baseline} ${top - 9}V${axis}`} stroke="var(--muted)" strokeDasharray="5 5" />
        <text x={baseline} y="18" textAnchor={baseline > 560 ? "end" : "start"}>Basis {duration(analysis.basePayback, analysis.years)} J.</text>
        {rows.map(row => {
          const y = geometry[`${row.key}-y`], minus = geometry[`${row.key}-minus`], plus = geometry[`${row.key}-plus`];
          return <g key={row.key} data-pv-sensitivity={row.key}>
            <text x="12" y={y + 35} className="pv-analysis-row-label">{row.label}</text>
            <path d={`M${baseline} ${y + 24}H${minus}`} stroke="var(--accent)" strokeWidth="5" opacity=".55" />
            <path d={`M${baseline} ${y + 43}H${plus}`} stroke="var(--wire)" strokeWidth="5" opacity=".55" />
            {row.minus === null ? <path d={`M${minus - 7} ${y + 18}l10 6-10 6`} fill="none" stroke="var(--accent)" strokeWidth="3" /> : <circle cx={minus} cy={y + 24} r="5" fill="var(--accent)" />}
            {row.plus === null ? <path d={`M${plus - 7} ${y + 37}l10 6-10 6`} fill="none" stroke="var(--wire)" strokeWidth="3" /> : <circle cx={plus} cy={y + 43} r="5" fill="var(--wire)" />}
            <text x="680" y={y + 27}>−20 %: {duration(row.minus, analysis.years)} Jahre</text>
            <text x="680" y={y + 46}>+20 %: {duration(row.plus, analysis.years)} Jahre</text>
          </g>;
        })}
      </svg>
    </div>
    <figcaption>Gestrichelt: aktueller Ausgangsfall. Ein Pfeil rechts bedeutet keine Amortisation innerhalb von {analysis.years} Jahren. Eigenverbrauch wird bei 100 % begrenzt.</figcaption>
  </figure>;
}

function HistoryChart({ analysis }: { analysis: PVAnalysis }) {
  const id = useId(), left = 64, right = 812, top = 22, bottom = 212;
  const maximum = Math.ceil(Math.max(...analysis.history.flatMap(point => [point.buyRp, point.feedRp])) / 5) * 5;
  const x = (index: number) => left + index / Math.max(1, analysis.history.length - 1) * (right - left);
  const y = (value: number) => bottom - value / maximum * (bottom - top);
  const path = (key: "buyRp" | "feedRp") => analysis.history.map((point, index) => `${index ? "L" : "M"}${x(index)} ${y(point[key])}`).join(" ");
  return <figure className="pv-analysis-figure" aria-label="Historischer Tarifvergleich 2020 bis 2026">
    <div className="pv-analysis-heading"><h3>Historischer Tarifvergleich</h3><span>{PV_HISTORY_REFERENCE.period} · Rp./kWh</span></div>
    <div className="pv-analysis-legend"><span><i />Bezug</span><span><i />Einspeisung</span></div>
    <div className="pv-analysis-scroll" role="region" tabIndex={0} aria-label="Historische Tarifkurven, bei Bedarf horizontal verschieben">
      <svg viewBox="0 0 880 260" className="lab-svg pv-analysis-svg" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>Datierte historische Vergleichswerte für Bezugspreis und Einspeisetarif von 2020 bis 2026</title>
        {[0, 1, 2, 3, 4].map(tick => <g key={tick}><path d={`M${left} ${y(maximum * tick / 4)}H${right}`} stroke="var(--line)" /><text x={left - 12} y={y(maximum * tick / 4) + 4} textAnchor="end">{amount(maximum * tick / 4)}</text></g>)}
        <path d={path("buyRp")} fill="none" stroke="var(--accent)" strokeWidth="3" /><path d={path("feedRp")} fill="none" stroke="var(--wire)" strokeWidth="3" />
        {analysis.history.map((point, index) => <g key={point.year}>
          <circle cx={x(index)} cy={y(point.buyRp)} r="4" fill="var(--accent)" /><text x={x(index)} y={y(point.buyRp) - 11} textAnchor="middle">{amount(point.buyRp)}</text>
          <circle cx={x(index)} cy={y(point.feedRp)} r="4" fill="var(--wire)" /><text x={x(index)} y={y(point.feedRp) + 19} textAnchor="middle">{amount(point.feedRp)}</text>
          <text x={x(index)} y="251" textAnchor="middle">{point.year}</text>
        </g>)}
      </svg>
    </div>
    <figcaption>Vergleichsstand vom 02.11.2026. Historische Medianwerte, keine aktuelle Tarifauskunft oder Prognose. Die eingegebenen Projekttarife werden dadurch nicht geändert.</figcaption>
  </figure>;
}

function GenerationChart({ series }: { series: SeriesItem[] }) {
  const id = useId(), left = 72, right = 812, top = 22, bottom = 190;
  const maximum = Math.max(1, ...series.map(point => point.value));
  const target = Object.fromEntries(series.flatMap((point, index) => [[`x${index}`, left + index / Math.max(1, series.length - 1) * (right - left)], [`y${index}`, bottom - point.value / maximum * (bottom - top)]]));
  const geometry = useAnimatedGeometry(target);
  const path = series.map((_, index) => `${index ? "L" : "M"}${geometry[`x${index}`]} ${geometry[`y${index}`]}`).join(" ");
  const labels = [...new Set([0, Math.round((series.length - 1) / 2), series.length - 1])];
  return <figure className="pv-analysis-figure" aria-label="PV-Ertrag im Betrachtungszeitraum">
    <div className="pv-analysis-heading"><h3>Jahresertrag im Verlauf</h3><span>{series.length} Jahre · kWh/a</span></div>
    <div className="pv-analysis-scroll" role="region" tabIndex={0} aria-label="PV-Ertragskurve, bei Bedarf horizontal verschieben"><svg viewBox="0 0 880 240" className="lab-svg pv-analysis-svg" role="img" aria-labelledby={`${id}-title`}>
      <title id={`${id}-title`}>Jährlicher PV-Ertrag mit der eingegebenen Leistungsabnahme</title>
      {[0, 1, 2].map(tick => <g key={tick}><path d={`M${left} ${bottom - tick / 2 * (bottom - top)}H${right}`} stroke="var(--line)" /><text x={left - 10} y={bottom - tick / 2 * (bottom - top) + 4} textAnchor="end">{amount(maximum * tick / 2, 0)}</text></g>)}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="3" />
      {labels.map(index => <g key={index}><circle cx={geometry[`x${index}`]} cy={geometry[`y${index}`]} r="4" fill="var(--accent)" /><text x={target[`x${index}`]} y="225" textAnchor="middle">{series[index].label}</text></g>)}
    </svg></div>
    <figcaption>Konstanter spezifischer Ertrag und jährliche relative Leistungsabnahme gemäss Eingabe; keine Wetter- oder Lastgangsimulation.</figcaption>
  </figure>;
}

export default function PVAnalysisView({ analysis, series }: { analysis: PVAnalysis; series?: SeriesItem[] }) {
  return <details className="pv-analysis"><summary>PV-Analyse vertiefen<span>Sensitivität, Ertragsverlauf und Tarifhistorie</span></summary><div className="pv-analysis-content">
    <SensitivityChart analysis={analysis} />
    {Boolean(series?.length) && <GenerationChart series={series!} />}
    <HistoryChart analysis={analysis} />
  </div></details>;
}
