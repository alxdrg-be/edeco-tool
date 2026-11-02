import { useId, useState } from "react";
import { SIA_GROUPS } from "./siaData";
import type { SIABalance, SIAGroupBalance } from "./siaModel";
import { useAnimatedGeometry } from "../useAnimatedGeometry";
import "./sia-breakdown-charts.css";

const fmt = (value: number, digits = 2) => value.toLocaleString("de-CH", { maximumFractionDigits: digits });
const niceMaximum = (value: number) => {
  if (!(value > 0)) return 1;
  const scale = 10 ** Math.floor(Math.log10(value)), part = value / scale;
  return (part <= 1 ? 1 : part <= 2 ? 2 : part <= 4 ? 4 : part <= 5 ? 5 : part <= 8 ? 8 : 10) * scale;
};
const wrapped = (value: string) => {
  const lines: string[] = [];
  for (const word of value.split(/\s+/)) {
    if (lines.length && `${lines[lines.length - 1]} ${word}`.length <= 24) lines[lines.length - 1] += ` ${word}`;
    else for (let at = 0; at < word.length; at += 24) lines.push(word.slice(at, at + 24));
  }
  return lines;
};
interface Row { id: string; label: string; area: number; groups: SIAGroupBalance[]; target?: number }
function BreakdownChart({ balance, kind }: { balance: SIABalance; kind: "power" | "energy" }) {
  const id = useId();
  const [selected, setSelected] = useState<{ row: string; group: string } | null>(null);
  const power = kind === "power", unit = power ? "W/m²" : "kWh/(m²·a)", title = power ? "Leistungsdichte · nach Kcor" : "Jahresenergiekennzahl · nach Jahresgleichzeitigkeit";
  const rows: Row[] = [...balance.zones.map(zone => ({ id: zone.id, label: zone.label, area: zone.area, groups: zone.groups, target: power ? zone.powerTarget : zone.energyTarget })), { id: "__total", label: "Gesamt · flächengewichtet", area: balance.area, groups: balance.groups, target: power ? balance.powerTarget : balance.energyTarget }];
  const value = (group: SIAGroupBalance) => power ? group.powerDensity : group.energyDensity;
  const rowValue = (row: Row) => row.groups.reduce((sum, group) => sum + value(group), 0);
  const maximum = niceMaximum(Math.max(0, ...rows.flatMap(row => [rowValue(row), row.target ?? 0])));
  const left = 245, right = 895, barWidth = right - left;
  const geometryTarget: Record<string, number> = {};
  for (const row of rows) {
    let start = left;
    for (const meta of SIA_GROUPS) {
      const group = row.groups.find(group => group.groupId === meta.id)!;
      const width = barWidth * value(group) / maximum;
      geometryTarget[`${row.id}/${meta.id}/x`] = start;
      geometryTarget[`${row.id}/${meta.id}/width`] = width;
      start += width;
    }
    geometryTarget[`${row.id}/target`] = left + barWidth * (row.target ?? 0) / maximum;
  }
  const geometry = useAnimatedGeometry(geometryTarget);
  let top = 32;
  const positions = rows.map(row => {
    const lines = wrapped(row.label), height = Math.max(68, lines.length * 17 + 21), y = top;
    top += height;
    return { row, lines, y, height };
  });
  const axisY = top + 5, height = axisY + 45;
  const selectedRow = rows.find(row => row.id === selected?.row), selectedGroup = selectedRow?.groups.find(group => group.groupId === selected?.group);
  const groupMeta = SIA_GROUPS.find(group => group.id === selectedGroup?.groupId);
  return <figure className="sia-breakdown-chart" aria-label={title} data-sia-chart={kind}>
    <header><h2>{title}</h2><span>{unit}</span></header>
    <div className="sia-chart-scroll" role="region" tabIndex={0} aria-label={`${title} · horizontal verschiebbar`}>
      <svg className="lab-svg sia-breakdown-svg" viewBox={`0 0 1100 ${height}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{title}: sieben Verbrauchergruppen je Zone und flächengewichtetes Gesamt</title>
        <desc id={`${id}-desc`}>Jede Zeile zeigt eine Nutzungszone. Die letzte Zeile teilt die Summe der absoluten {power ? "Leistungen" : "Jahresenergien vor PV"} durch die gesamte Bezugsfläche. Sie ist keine Addition der spezifischen Zonenwerte. Farbige Segmente unterscheiden die Verbrauchergruppen. Erfasste manuelle Ziele sind gestrichelt markiert.</desc>
        {[0, 1, 2, 3, 4].map(index => {
          const tick = maximum * index / 4, x = left + barWidth * tick / maximum;
          return <g key={index}><path d={`M${x} 20V${axisY}`} stroke="var(--line)" /><text x={x} y={axisY + 25} textAnchor="middle" className="sia-axis-label">{fmt(tick, maximum < 10 ? 2 : 0)}</text></g>;
        })}
        {positions.map(({ row, lines, y, height: rowHeight }, rowIndex) => {
          const total = rowValue(row), yCentre = y + rowHeight / 2 - 4;
          return <g key={row.id} data-sia-zone={row.id} className={rowIndex === rows.length - 1 ? "sia-total-row" : ""}>
            {rowIndex === rows.length - 1 && <path d={`M18 ${y - 5}H1080`} stroke="var(--line-strong)" />}
            <text x="20" y={yCentre - (lines.length - 1) * 8.5} className="sia-zone-label">{lines.map((line, index) => <tspan key={index} x="20" dy={index ? 17 : 0}>{line}</tspan>)}</text>
            <rect x={left} y={yCentre - 13} width={barWidth} height="25" rx="3" fill="var(--panel-2)" />
            {SIA_GROUPS.map(meta => {
              const group = row.groups.find(group => group.groupId === meta.id)!, number = value(group);
              const width = geometry[`${row.id}/${meta.id}/width`], x = geometry[`${row.id}/${meta.id}/x`];
              if (number <= 0 && width <= .01) return null;
              return <g key={meta.id} tabIndex={0} role="img" aria-label={`${row.label} · ${meta.label}: ${fmt(number, 4)} ${unit}`} className="sia-chart-segment" onMouseEnter={() => setSelected({ row: row.id, group: meta.id })} onFocus={() => setSelected({ row: row.id, group: meta.id })}>
                <rect x={x} y={yCentre - 13} width={width} height="25" fill={meta.color} opacity={selectedRow?.id === row.id && selectedGroup?.groupId === meta.id ? 1 : .83} />
              </g>;
            })}
            {row.target !== undefined && <path d={`M${geometry[`${row.id}/target`]} ${yCentre - 20}v39`} stroke="var(--fg)" strokeWidth="2" strokeDasharray="4 3" />}
            <text x="925" y={yCentre + 3} className="sia-chart-value">{fmt(total, 3)}</text>
            {row.target !== undefined && <text x="925" y={yCentre + 23} className="sia-axis-label">Ziel {fmt(row.target, 3)}</text>}
          </g>;
        })}
        <path d={`M${left} ${axisY}H${right}`} stroke="var(--line-strong)" />
      </svg>
    </div>
    <div className="sia-chart-legend">{SIA_GROUPS.map(group => <span key={group.id}><i style={{ background: group.color }} />{group.label}</span>)}</div>
    <div className="sia-chart-readout" aria-live="polite" role="status">{selectedRow && selectedGroup && groupMeta ? <><strong>{selectedRow.label} · {groupMeta.label}</strong><span>{fmt(value(selectedGroup), 4)} {unit}</span></> : <span>Segment fokussieren oder mit dem Zeiger berühren, um den Gruppenwert abzulesen.</span>}</div>
    <figcaption>{power ? "Kcor korrigiert ausschliesslich die Rohleistung." : "Jahresgleichzeitigkeit korrigiert ausschliesslich die Rohenergie. Diese Grafik zeigt die Bruttoenergie vor PV-Abzug."} Gesamt = absolute Summe / Gesamtfläche. Gestrichelt: manuelles Ziel, falls erfasst.</figcaption>
  </figure>;
}

export default function SIABreakdownCharts({ balance }: { balance: SIABalance }) {
  return <section className="sia-breakdown-charts" aria-label="Getrennte Leistungs- und Jahresenergiebilanz"><BreakdownChart balance={balance} kind="power" /><BreakdownChart balance={balance} kind="energy" /></section>;
}
