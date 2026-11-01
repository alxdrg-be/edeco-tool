import { useId } from "react";
import type { calculateEV, EVInput } from "./ev.ts";
import { schemaState, signalColour, type EVSchemaState } from "./EVSchemaState.ts";
import "./ev-schema.css";

type Result = Pick<ReturnType<typeof calculateEV>, "houseKW" | "gridKW" | "perPoint" | "reserveExceeded" | "capacityOK">;

function decimal(value: string) {
  return /^\d+(?:[.,]\d+)?$/.test(value.trim()) ? Number(value.trim().replace(",", ".")) : NaN;
}

const format = (value: number | undefined, unit: string) => value === undefined || !Number.isFinite(value)
  ? "–"
  : `${new Intl.NumberFormat("de-CH", { maximumFractionDigits: value > 0 && value < 1 ? 3 : 1 }).format(value)} ${unit}`;

/** An original functional diagram. Symbol dimensions are illustrative, never a sizing proof. */
export default function EVSchema({ input, result, signals }: { input: EVInput; result: Result | null; signals?: EVSchemaState }) {
  const id = useId();
  const requestedCount = decimal(input.count);
  const count = Number.isInteger(requestedCount) && requestedCount > 0 ? requestedCount : 0;
  const shown = Math.min(12, count), columns = Math.min(4, shown || 1), rows = Math.ceil(shown / columns);
  const firstX = 520, trunkX = 405;
  const width = Math.max(840, firstX + (columns - 1) * 180 + 100), height = rows ? 660 + (rows - 1) * 400 : 340;
  const state = signals ?? schemaState(result ? {
    houseKW: result.houseKW, reserveKW: decimal(input.reserve), totalAssignedKW: result.perPoint * count,
    gridKW: result.gridKW, gridAssignedKW: result.perPoint * count,
    nominalPerPointKW: decimal(input.power), assignedPerPointKW: result.perPoint, managed: input.mode !== "none",
  } : null);
  const houseColour = signalColour(state.house.tone), gridColour = signalColour(state.grid.tone), pointColour = signalColour(state.points.tone);
  const nominal = result ? decimal(input.power) : undefined;
  const allocated = result?.perPoint;
  const hasMore = count > shown;

  return <figure className="ev-schema" aria-label="Elektrisches Ladegrid-Schema">
    <div className="ev-schema-caption">
      <strong>Stromweg · Hausanschluss bis Fahrzeug</strong>
      <span>{shown ? `${shown} von ${count} Ladepunkten` : "Eingaben prüfen"}</span>
      <span className="ev-schema-mobile-hint">↔ Schema horizontal verschieben</span>
    </div>
    <div className="ev-schema-signals" aria-label="Status der Leistungsabschnitte">
      {([{ key: "house", label: "Haus" }, { key: "grid", label: "Grid" }, { key: "points", label: "Ladepunkte" }] as const).map(item => <span key={item.key} data-state={state[item.key].tone} style={{ borderColor: signalColour(state[item.key].tone) }}><i style={{ background: signalColour(state[item.key].tone) }} /><strong>{item.label}</strong>{state[item.key].label}</span>)}
    </div>
    <div className="ev-schema-scroll" role="region" tabIndex={0} aria-label="Ladegrid-Schema, bei Bedarf horizontal verschieben">
      <svg className="lab-svg ev-schema-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-title ${id}-description`} style={{ minWidth: Math.min(width, 900) }}>
        <title id={`${id}-title`}>Hausanschluss, Unterverteiler und AC-Ladepunkte</title>
        <desc id={`${id}-description`}>Der Hausanschluss speist den Grid-Unterverteiler. Von dort führt eine Sammelschiene über schematische Schutzorgane zu den Ladepunkten und Fahrzeugen. Jeder Ladepunkt zeigt konfigurierte Nennleistung und rechnerische Zuteilung getrennt. Die Schutzorgane sind nicht dimensioniert. {hasMore ? `${count - shown} weitere Ladepunkte werden nicht einzeln gezeichnet.` : ""}</desc>

        <g className="ev-schema-supply">
          <rect x="24" y="40" width="210" height="140" rx="12" fill="var(--panel)" stroke={houseColour} strokeWidth="2" />
          <text x="129" y="73" textAnchor="middle" className="ev-schema-title">Hausanschluss</text>
          <text x="129" y="116" textAnchor="middle" className="ev-schema-ampere">{format(result ? decimal(input.house) : undefined, "A")}</text>
          <text x="129" y="152" textAnchor="middle" className="ev-schema-power">{format(result?.houseKW, "kW")}</text>
          <path data-testid="schema-house-feed" data-state={state.house.tone} d="M234 110H300" stroke={houseColour} strokeWidth="3" fill="none" />
          <path d="M283 104l10 6-10 6" stroke={houseColour} strokeWidth="2" fill="none" />
          <text x="267" y="143" textAnchor="middle" className="ev-schema-feed-detail">400 V · 3~</text>
          <rect x="300" y="40" width="210" height="140" rx="12" fill="var(--panel)" stroke={gridColour} strokeWidth="2" />
          <text x="405" y="73" textAnchor="middle" className="ev-schema-title">Grid / Unterverteiler</text>
          <text x="405" y="116" textAnchor="middle" className="ev-schema-ampere">{format(result ? decimal(input.grid) : undefined, "A")}</text>
          <text x="405" y="152" textAnchor="middle" className="ev-schema-power">{format(result?.gridKW, "kW")}</text>
        </g>

        {shown > 0 && <path data-testid="schema-grid-feed" data-state={state.grid.tone} d={`M${trunkX} 180V${272 + (rows - 1) * 400}`} stroke={gridColour} strokeWidth="3" fill="none" />}
        {Array.from({ length: rows }, (_, row) => {
          const length = Math.min(columns, shown - row * columns), busY = 272 + row * 400;
          return <g key={`bus-${row}`}><path data-testid="schema-grid-bus" data-state={state.grid.tone} d={`M${trunkX} ${busY}H${firstX + (length - 1) * 180}`} stroke={gridColour} strokeWidth="4" fill="none" /><circle cx={trunkX} cy={busY} r="4" fill={gridColour} /></g>;
        })}
        {Array.from({ length: shown }, (_, index) => {
          const x = firstX + (index % columns) * 180, busY = 272 + Math.floor(index / columns) * 400;
          return <g className="ev-schema-point" data-index={index + 1} data-state={state.points.tone} key={index}>
            <rect x={x - 24} y={busY - 38} width="48" height="24" rx="5" fill="var(--accent-soft)" stroke={pointColour} />
            <text x={x} y={busY - 21} textAnchor="middle" className="ev-schema-ac">AC</text>
            <path d={`M${x} ${busY}V${busY + 88}`} stroke={pointColour} strokeWidth="2.5" fill="none" />
            <rect x={x - 11} y={busY + 40} width="22" height="26" rx="3" fill="var(--panel)" stroke="var(--muted)" strokeWidth="1.5" />
            <path d={`M${x - 5} ${busY + 59}l10-13`} stroke="var(--muted)" strokeWidth="1.5" />

            <rect x={x - 35} y={busY + 88} width="70" height="110" rx="11" fill="var(--panel-2)" stroke={pointColour} strokeWidth="2" />
            <rect x={x - 24} y={busY + 99} width="48" height="70" rx="6" fill="var(--panel)" stroke="var(--line-strong)" />
            <rect x={x - 14} y={busY + 110} width="28" height="27" rx="3" fill="var(--canvas)" stroke="var(--line-strong)" />
            <circle cx={x} cy={busY + 154} r="9" fill="var(--canvas)" stroke={pointColour} strokeWidth="1.7" />
            <circle cx={x - 3} cy={busY + 152} r="1.5" fill={pointColour} /><circle cx={x + 3} cy={busY + 152} r="1.5" fill={pointColour} /><circle cx={x} cy={busY + 157} r="1.5" fill={pointColour} />
            <path d={`M${x + 35} ${busY + 133}q13 0 13 15v22q0 13-13 13`} stroke={pointColour} strokeWidth="2" fill="none" />
            <path d={`M${x} ${busY + 198}V${busY + 221}`} stroke={pointColour} strokeWidth="2" strokeDasharray="4 4" />

            <path d={`M${x - 46} ${busY + 245}q0-12 13-12h7l12-15h27l13 15h7q13 0 13 12v16h-92Z`} fill="var(--panel-2)" stroke={pointColour} strokeWidth="1.8" />
            <path d={`M${x - 17} ${busY + 233}l7-10h18l8 10Z`} fill="var(--canvas)" />
            <circle cx={x - 27} cy={busY + 262} r="8" fill="var(--canvas)" stroke={pointColour} strokeWidth="2" /><circle cx={x + 27} cy={busY + 262} r="8" fill="var(--canvas)" stroke={pointColour} strokeWidth="2" />

            <text x={x} y={busY + 301} textAnchor="middle" className="ev-schema-rated">Nennleistung {format(nominal, "kW")}</text>
            <text x={x} y={busY + 330} textAnchor="middle" className="ev-schema-allocated" style={{ fill: pointColour }}>{format(allocated, "kW")}</text>
            <text x={x} y={busY + 351} textAnchor="middle" className="ev-schema-secondary">Zuteilung · LP {String(index + 1).padStart(2, "0")}</text>
          </g>;
        })}
        {!shown && <text x={width / 2} y="280" textAnchor="middle" className="ev-schema-secondary">Eine gültige Anzahl Ladepunkte eingeben.</text>}
      </svg>
    </div>
    <figcaption className="ev-schema-legend">
      <span><i style={{ background: signalColour("normal") }} />Budget eingehalten</span>
      <span><i style={{ background: signalColour("limited") }} />Lastmanagement begrenzt</span>
      <span><i style={{ background: signalColour("error") }} />Leistungsbudget überschritten</span>
      <span><i style={{ background: signalColour("unknown") }} />Eingaben ungültig</span>
      <span><i className="ev-schema-protection" />Graues Schutzsymbol: Auslegung ungeprüft</span>
      <span>Linien: Sammelschiene und Zuleitungen · Farben gelten für das Leistungsmodell, nicht für Kabel- oder Schutznachweise.</span>
      {hasMore && <strong>+ {count - shown} weitere Ladepunkte im Rechenmodell</strong>}
    </figcaption>
  </figure>;
}
