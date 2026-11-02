import { useId, useState } from "react";
import type { CalculationResult, SeriesItem } from "./types";
import "./reference-charts.css";

const amount = (value: number, digits = 0) => value.toLocaleString("de-CH", { maximumFractionDigits: digits });

function chartCeiling(value: number) {
  if (!(value > 0)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 4 ? 4 : fraction <= 5 ? 5 : fraction <= 8 ? 8 : 10;
  return nice * magnitude;
}

/** Annual costs are additive; the two stacks deliberately exclude revenue. */
export function AnnualCostChart({ series, title, labels }: { series: SeriesItem[]; title: string; labels: [string, string] }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const selected = Math.min(active, series.length - 1), item = series[selected];
  const left = 86, right = 868, top = 30, bottom = 326;
  const ceiling = chartCeiling(Math.max(0, ...series.map(row => row.value + (row.secondary ?? 0))));
  const slot = (right - left) / Math.max(1, series.length), barWidth = Math.min(40, slot * .64);
  const height = (value: number) => (bottom - top) * Math.max(0, value) / ceiling;
  const labelEvery = series.length > 18 ? 2 : 1;
  return <figure className="reference-cost-chart" aria-label={title}>
    <div className="reference-chart-heading"><h2>{title}</h2><span>CHF / Jahr</span></div>
    <div className="reference-chart-scroll" role="region" tabIndex={0} aria-label="Jährlicher Kostenverlauf, bei Bedarf horizontal verschieben">
      <svg className="lab-svg reference-cost-svg" viewBox="0 0 900 386" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>Jährliche Investitions- und Betriebskosten</title>
        <desc id={`${id}-description`}>Jede Säule zeigt ein Betriebsjahr. Die gestapelten Anteile zeigen {labels[0]} und {labels[1]}. Säule fokussieren oder mit dem Zeiger berühren, um die einzelnen Kostenwerte unter dem Diagramm zu lesen.</desc>
        {[0, 1, 2, 3, 4].map(tick => {
          const value = ceiling * tick / 4, y = bottom - height(value);
          return <g key={tick}><path d={`M${left} ${y}H${right}`} stroke="var(--line)" strokeWidth="1" /><text x={left - 13} y={y + 4} textAnchor="end" className="reference-axis-label">{amount(value, ceiling < 10 ? 2 : 0)}</text></g>;
        })}
        <path d={`M${left} ${top}V${bottom}H${right}`} stroke="var(--line-strong)" fill="none" />
        {series.map((row, index) => {
          const x = left + slot * (index + .5), firstHeight = height(row.value), secondHeight = height(row.secondary ?? 0);
          return <g key={`${row.label}-${index}`} tabIndex={0} role="img" aria-label={`${row.label}: ${labels[0]} ${amount(row.value)} CHF, ${labels[1]} ${amount(row.secondary ?? 0)} CHF, Total ${amount(row.value + (row.secondary ?? 0))} CHF`} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} className="reference-year-column" data-active={index === selected}>
            <rect className="reference-column-hit" x={left + slot * index + 2} y={top} width={Math.max(1, slot - 4)} height={bottom - top} rx="5" fill="transparent" />
            <rect x={x - barWidth / 2} y={bottom - firstHeight} width={barWidth} height={firstHeight} fill="var(--accent)" opacity={index === selected ? 1 : .75} />
            <rect x={x - barWidth / 2} y={bottom - firstHeight - secondHeight} width={barWidth} height={secondHeight} fill="var(--wire)" opacity={index === selected ? 1 : .75} />
            {index % labelEvery === 0 && <text x={x} y={bottom + 26} textAnchor="middle" className="reference-axis-label">{row.label}</text>}
          </g>;
        })}
      </svg>
    </div>
    <div className="reference-chart-legend"><span><i className="reference-primary-key" />{labels[0]}</span><span><i className="reference-secondary-key" />{labels[1]}</span></div>
    {item && <div className="reference-chart-readout" role="status" aria-live="polite"><strong>{item.label}</strong><span>{labels[0]}<b>{amount(item.value, 2)} CHF</b></span><span>{labels[1]}<b>{amount(item.secondary ?? 0, 2)} CHF</b></span><span>Total<b>{amount(item.value + (item.secondary ?? 0), 2)} CHF</b></span></div>}
    <figcaption>Die Säulen zeigen die jährlichen Kosten. Erlöse werden separat ausgewiesen und sind hier nicht abgezogen.</figcaption>
  </figure>;
}

type Room = Extract<NonNullable<CalculationResult["diagram"]>, { kind: "room" }>;

/** Geometric plan, not a coverage or photometric simulation. */
export function MeasuredRoomPlan({ room }: { room: Room }) {
  const id = useId();
  const scale = Math.min(690 / room.length, 320 / room.width);
  const width = room.length * scale, height = room.width * scale;
  const x = (900 - width) / 2, y = 275 - height / 2;
  const cells = room.columns * room.rows;
  const total = room.count ?? cells, shown = Math.min(144, total);
  const cellWidth = width / room.columns, cellHeight = height / room.rows;
  const pointRadius = Math.min(17, cellWidth / 4, cellHeight / 4);
  const showNumbers = total <= 48 && cellWidth >= 38 && cellHeight >= 34;
  const dimY = 65, dimX = x - 46;
  const showSpacing = total === cells && total <= 48 && room.columns > 1 && cellWidth >= 90;
  const spacingY = y + height + 19, firstX = x + cellWidth / 2;
  return <figure className="reference-room-plan" aria-label="Bemasster Raumplan zur Vorplanung">
    <div className="reference-chart-heading"><h2>Raumplan · {room.columns} × {room.rows} Raster</h2><span>{amount(total)} {total === 1 ? "Position" : "Positionen"}</span></div>
    <div className="reference-chart-scroll" role="region" tabIndex={0} aria-label="Bemasster Raumplan, bei Bedarf horizontal verschieben">
      <svg className="lab-svg reference-room-svg" viewBox="0 0 900 490" role="img" aria-labelledby={`${id}-title ${id}-description`}>
        <title id={`${id}-title`}>Rechteckraum mit Masslinien und Rasterpositionen</title>
        <desc id={`${id}-description`}>Raum {room.length} mal {room.width} Meter. Gleichmässiges Raster mit {room.columns} Spalten und {room.rows} Reihen; {total} Positionen. Länge und Breite werden ausserhalb der Raumwände bemasst. Das Anordnungsraster enthält genau {total} gezeichnete Positionen beziehungsweise eine ausgewiesene Stichprobe. Das Seitenverhältnis entspricht den Eingaben; eine fachliche Erfassungs- oder Lichtverteilung wird nicht dargestellt.</desc>
        <defs><marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="var(--muted)" /></marker></defs>
        <path d={`M${x} ${y - 8}V${dimY - 9}M${x + width} ${y - 8}V${dimY - 9}`} stroke="var(--line-strong)" fill="none" />
        <path d={`M${x} ${dimY}H${x + width}`} stroke="var(--muted)" fill="none" markerStart={`url(#${id}-arrow)`} markerEnd={`url(#${id}-arrow)`} />
        <text x={450} y={dimY - 15} textAnchor="middle" className="reference-dimension-label">{amount(room.length, 2)} m</text>
        <path d={`M${x - 8} ${y}H${dimX - 9}M${x - 8} ${y + height}H${dimX - 9}`} stroke="var(--line-strong)" fill="none" />
        <path d={`M${dimX} ${y}V${y + height}`} stroke="var(--muted)" fill="none" markerStart={`url(#${id}-arrow)`} markerEnd={`url(#${id}-arrow)`} />
        <text x={dimX - 16} y={275} textAnchor="middle" transform={`rotate(-90 ${dimX - 16} 275)`} className="reference-dimension-label">{amount(room.width, 2)} m</text>
        <rect x={x} y={y} width={width} height={height} rx="2" fill="var(--panel-2)" stroke="var(--line-strong)" strokeWidth="3" />
        {showSpacing && <g className="reference-position-dimensions"><path d={`M${x} ${y + height + 4}V${spacingY + 5}M${firstX} ${y + height + 4}V${spacingY + 5}M${firstX + cellWidth} ${y + height + 4}V${spacingY + 5}`} stroke="var(--line-strong)" fill="none" /><path d={`M${x} ${spacingY}H${firstX + cellWidth}`} stroke="var(--muted)" markerStart={`url(#${id}-arrow)`} markerEnd={`url(#${id}-arrow)`} /><path d={`M${firstX} ${spacingY - 4}v8`} stroke="var(--muted)" /><text x={x + cellWidth / 4} y={spacingY + 18} textAnchor="middle" className="reference-spacing-label">{amount(room.length / room.columns / 2, 2)} m</text><text x={firstX + cellWidth / 2} y={spacingY + 18} textAnchor="middle" className="reference-spacing-label">{amount(room.length / room.columns, 2)} m</text></g>}
        {Array.from({ length: shown }, (_, index) => {
          const position = Math.floor(index * total / shown), row = Math.floor(position / room.columns);
          const pointsInRow = Math.min(room.columns, total - row * room.columns);
          const offset = (room.columns - pointsInRow) / 2;
          const pointX = x + cellWidth * ((position % room.columns) + .5 + offset), pointY = y + cellHeight * (row + .5);
          return <g key={position} className="reference-room-position"><circle cx={pointX} cy={pointY} r={pointRadius} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />{showNumbers ? <text x={pointX} y={pointY + 4} textAnchor="middle" className="reference-position-label">{position + 1}</text> : <circle cx={pointX} cy={pointY} r={Math.max(.3, pointRadius / 4)} fill="var(--accent)" />}</g>;
        })}
      </svg>
    </div>
    <figcaption><span><i className="reference-position-key" />{showNumbers ? "Nummern kennzeichnen die Rasterpositionen." : "Cyan kennzeichnet die Rasterpositionen; Nummern sind bei dichtem Raster ausgeblendet."}</span>{total > shown && <span>{shown} von {amount(total)} Positionen dargestellt.</span>}<span>Masslinien zeigen die Raumabmessungen{showSpacing ? "; unten stehen Wand- und Rasterabstand in Längsrichtung" : ""}. Hindernisse, reale Erfassungsbereiche und Lichtverteilung bleiben ungeprüft.</span></figcaption>
  </figure>;
}

type Comparison = NonNullable<CalculationResult["comparisons"]>[number];

/** Actual and target share an axis; targets are never added to actual values. */
export function TargetComparisonChart({ comparison }: { comparison: Comparison }) {
  const id = useId();
  const left = 200, right = 730, top = 26, rowHeight = 82;
  const axisY = top + comparison.items.length * rowHeight + 12;
  const maximum = chartCeiling(Math.max(1, ...comparison.items.flatMap(item => [item.actual, item.target])));
  const x = (value: number) => left + Math.max(0, value) / maximum * (right - left);
  return <figure className="reference-comparison-chart" aria-label={`${comparison.title} · Ist und Ziel`}>
    <div className="reference-chart-heading"><h2>{comparison.title}</h2><span>{comparison.unit}</span></div>
    <div className="reference-chart-scroll" role="region" tabIndex={0} aria-label={`${comparison.title}, bei Bedarf horizontal verschieben`}>
      <svg className="lab-svg reference-comparison-svg" viewBox={`0 0 900 ${axisY + 50}`} role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>{comparison.title}: Ist und Ziel getrennt je Position</title>
        {[0, 1, 2, 3, 4].map(tick => {
          const value = maximum * tick / 4, px = x(value);
          return <g key={tick}><path d={`M${px} ${top}V${axisY}`} stroke="var(--line)" /><text x={px} y={axisY + 22} textAnchor="middle" className="reference-axis-label">{amount(value, maximum < 10 ? 2 : 0)}</text></g>;
        })}
        {comparison.items.map((item, index) => {
          const y = top + index * rowHeight;
          const tone = item.actual > item.target + 1e-9 ? "var(--danger)" : item.target > 0 && item.actual >= .9 * item.target ? "var(--wire)" : "var(--ok)";
          return <g key={`${item.label}-${index}`}><text x="20" y={y + 30} className="reference-zone-label">{item.label}</text><rect x={left} y={y + 10} width={Math.max(0, x(item.actual) - left)} height="15" rx="3" fill={tone} /><rect x={left} y={y + 37} width={Math.max(0, x(item.target) - left)} height="15" rx="3" fill="var(--line-strong)" /><text x="760" y={y + 22} className="reference-comparison-value">{amount(item.actual, 2)} · Ist</text><text x="760" y={y + 49} className="reference-comparison-value">{amount(item.target, 2)} · Ziel</text></g>;
        })}
        <path d={`M${left} ${axisY}H${right}`} stroke="var(--line-strong)" />
      </svg>
    </div>
    <figcaption>Je Position stehen Ist und eingegebener Zielwert in derselben Einheit auf einer gemeinsamen Skala. Grün: darunter · Gelb: ab 90 % · Rot: überschritten. Vergleichswerte werden nebeneinander beurteilt, nicht addiert.</figcaption>
  </figure>;
}
