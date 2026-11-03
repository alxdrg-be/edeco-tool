import { CheckCircle2, CircleAlert } from "lucide-react";
import type { CalculationResult, Inputs, Metric } from "./types";
import ChargingView from "./ChargingView";
import { AnnualCostChart, MeasuredRoomPlan, TargetComparisonChart } from "./ReferenceCharts";
import TechnicalGraphics, { hasTechnicalGraphic } from "./TechnicalGraphics";
import CostModelView from "./CostModelView";
import SIABreakdownCharts from "./SIABreakdownCharts";
import PoeRouteView from "./PoeRouteView";
import PVAnalysisView from "./PVAnalysisView";
import "./result-view.css";

export function metricValue(metric: Pick<Metric, "value" | "digits" | "unit">) {
  return `${typeof metric.value === "number" ? metric.value.toLocaleString("de-CH", { maximumFractionDigits: metric.digits ?? 2 }) : metric.value}${metric.unit ? ` ${metric.unit}` : ""}`;
}

export default function ResultView({ result, calculatorId, input }: { result: CalculationResult; calculatorId?: string; input?: Inputs }) {
  const diagram = result.diagram;
  const hasSeries = Boolean(result.series?.length);
  const annualCosts = hasSeries && result.seriesUnit === "CHF" && result.seriesLabels && result.series?.some(item => item.secondary !== undefined);
  const max = Math.max(1, ...(result.series ?? []).map(item => Math.max(0, item.value) + Math.max(0, item.secondary ?? 0)));
  const technical = !result.charging && !result.chargingNetwork && !result.depotNetwork && !result.poeRoute && hasTechnicalGraphic(calculatorId, result);
  const hasGraphics = Boolean(result.charging || result.chargingNetwork || result.depotNetwork || result.siaBreakdown || result.poeRoute || diagram || hasSeries || technical || result.comparisons?.length);
  return <>
    <div className={`wb-status wb-${result.status.tone}`} role="status">{result.status.tone === "ok" ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}<span>{result.status.text}</span></div>
    {hasGraphics && <div className="wb-result-graphics">
      {result.costModels && <CostModelView models={result.costModels} />}
      {result.siaBreakdown && <SIABreakdownCharts balance={result.siaBreakdown} />}
      {result.poeRoute && <PoeRouteView route={result.poeRoute} />}
      {(result.charging || result.chargingNetwork || result.depotNetwork) && <ChargingView result={result} />}
      {technical && <TechnicalGraphics calculatorId={calculatorId} result={result} input={input} />}
      {diagram?.kind === "room" && <MeasuredRoomPlan room={diagram} />}
      {result.pvAnalysis && <PVAnalysisView analysis={result.pvAnalysis} series={result.series} />}
      {result.comparisons?.map((comparison, index) => <TargetComparisonChart key={`${comparison.title}-${index}`} comparison={comparison} />)}
      {hasSeries && !result.pvAnalysis && (annualCosts ? <AnnualCostChart series={result.series!} title={result.seriesLabel ?? "Jährlicher Kostenverlauf"} labels={result.seriesLabels!} /> : <section className="wb-chart" aria-label={result.seriesLabel ?? "Ergebnisvergleich"}><h2>{result.seriesLabel ?? "Vergleich"}</h2>{result.seriesLabels && <div className="wb-legend"><span><i />{result.seriesLabels[0]}</span><span><i />{result.seriesLabels[1]}</span></div>}<div>{result.series!.map((item, i) => <div className="wb-chart-row" key={`${item.label}-${i}`}><span>{item.label}</span><div className="wb-bar-track"><div className="wb-bar-primary" style={{ width: `${100 * Math.max(0, item.value) / max}%` }} /><div className="wb-bar-secondary" style={{ width: `${100 * Math.max(0, item.secondary ?? 0) / max}%` }} /></div><strong>{metricValue({ value: item.value + (item.secondary ?? 0), unit: result.seriesUnit })}</strong></div>)}</div></section>)}
    </div>}
    <div className="wb-metrics" data-testid="workbench-metrics">{result.metrics.map((metric, i) => <div key={`${metric.label}-${i}`} className={`wb-metric wb-${metric.tone ?? "neutral"}`}><span>{metric.label}</span><strong>{metricValue(metric)}</strong></div>)}</div>
    {result.rows?.length ? <details className="wb-details"><summary>Rechenwerte im Detail</summary><dl>{result.rows.map((row, i) => <div key={`${row.label}-${i}`}><dt>{row.label}</dt><dd>{metricValue(row)}</dd></div>)}</dl></details> : null}
  </>;
}
