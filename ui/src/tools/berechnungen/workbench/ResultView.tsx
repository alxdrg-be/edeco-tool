import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import type { CalculationResult, Metric } from "./types";
import ChargingView from "./ChargingView";

export function metricValue(metric: Pick<Metric, "value" | "digits" | "unit">) {
  return `${typeof metric.value === "number" ? metric.value.toLocaleString("de-CH", { maximumFractionDigits: metric.digits ?? 2 }) : metric.value}${metric.unit ? ` ${metric.unit}` : ""}`;
}
export default function ResultView({ result }: { result: CalculationResult }) {
  const diagram = result.diagram;
  const roomScale = diagram?.kind === "room" ? Math.min(690 / diagram.length, 365 / diagram.width) : 1;
  const roomWidth = diagram?.kind === "room" ? diagram.length * roomScale : 690;
  const roomHeight = diagram?.kind === "room" ? diagram.width * roomScale : 365;
  const roomX = (800 - roomWidth) / 2, roomY = (455 - roomHeight) / 2;
  const max = Math.max(1, ...(result.series ?? []).map(item => Math.max(0, item.value) + Math.max(0, item.secondary ?? 0)));
  return <>
    <div className={`wb-status wb-${result.status.tone}`} role="status">{result.status.tone === "ok" ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}<span>{result.status.text}</span></div>
    <div className="wb-metrics" data-testid="workbench-metrics">{result.metrics.map((metric, i) => <div key={`${metric.label}-${i}`} className={`wb-metric wb-${metric.tone ?? "neutral"}`}><span>{metric.label}</span><strong>{metricValue(metric)}</strong></div>)}</div>
    {result.charging && <ChargingView result={result} />}
    {!result.charging && diagram?.kind === "chain" && <section className="wb-diagram" aria-label="Technisches Zusammenhangsschema"><div className="wb-chain">{diagram.nodes.map((node, i) => <div className="wb-chain-step" key={`${node.label}-${i}`}><article className={`wb-node wb-${node.tone ?? "neutral"}`}><span>{node.label}</span><strong>{node.value}</strong>{node.detail && <small>{node.detail}</small>}</article>{i < diagram.nodes.length - 1 && <ArrowRight className="wb-arrow" aria-hidden="true" />}</div>)}</div></section>}
    {diagram?.kind === "room" && <section className="wb-diagram" aria-label="Raumraster zur Vorplanung"><div className="wb-room-dimensions"><span>Länge {diagram.length.toLocaleString("de-CH")} m</span><span>Breite {diagram.width.toLocaleString("de-CH")} m</span><span>{diagram.columns} × {diagram.rows} Raster</span></div><svg className="lab-svg wb-room" viewBox="0 0 800 470" role="img" aria-label={`Raum ${diagram.length} mal ${diagram.width} Meter mit ${diagram.columns * diagram.rows} Rasterpositionen, schematische Vorplanung`}><rect x={roomX} y={roomY} width={roomWidth} height={roomHeight} rx="3" fill="var(--panel)" stroke="var(--line-strong)" strokeWidth="3" />{diagram.columns * diagram.rows <= 144 ? Array.from({ length: diagram.columns * diagram.rows }, (_, i) => { const x = roomX + roomWidth * ((i % diagram.columns) + .5) / diagram.columns, y = roomY + roomHeight * (Math.floor(i / diagram.columns) + .5) / diagram.rows; const radius = Math.min(12, roomWidth / diagram.columns / 4, roomHeight / diagram.rows / 4); return <g key={i}><circle cx={x} cy={y} r={radius} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" /><circle cx={x} cy={y} r={radius / 4} fill="var(--accent)" /></g>; }) : null}</svg><p className="lab-note">Cyan: Rasterpositionen · Raumdarstellung schematisch. {diagram.columns * diagram.rows > 144 && "Mehr als 144 Positionen: Einzelpunkte ausgeblendet."} Hindernisse und reale Erfassungsbereiche bleiben ungeprüft.</p></section>}
    {result.series?.length ? <section className="wb-chart" aria-label={result.seriesLabel ?? "Ergebnisvergleich"}><h2>{result.seriesLabel ?? "Vergleich"}</h2>{result.seriesLabels && <div className="wb-legend"><span><i />{result.seriesLabels[0]}</span><span><i />{result.seriesLabels[1]}</span></div>}<div>{result.series.map((item, i) => <div className="wb-chart-row" key={`${item.label}-${i}`}><span>{item.label}</span><div className="wb-bar-track"><div className="wb-bar-primary" style={{ width: `${100 * Math.max(0, item.value) / max}%` }} /><div className="wb-bar-secondary" style={{ width: `${100 * Math.max(0, item.secondary ?? 0) / max}%` }} /></div><strong>{metricValue({ value: item.value + (item.secondary ?? 0), unit: result.seriesUnit })}</strong></div>)}</div></section> : null}
    {result.rows?.length ? <details className="wb-details"><summary>Rechenwerte im Detail</summary><dl>{result.rows.map((row, i) => <div key={`${row.label}-${i}`}><dt>{row.label}</dt><dd>{metricValue(row)}</dd></div>)}</dl></details> : null}
  </>;
}
