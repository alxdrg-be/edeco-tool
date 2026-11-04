import type { ConnectionPoint, Tone } from "./calc";

export function LimitBar({ percent, tone, label }: { percent: number; tone: Tone; label: string }) {
  const width = Math.max(0, Math.min(percent, 100));
  return <div className="calc-bar" role="img" aria-label={label}>
    <div className={`calc-bar-fill is-${tone}`} style={{ width: `${width}%` }} />
  </div>;
}

interface LineProps {
  hausA: number;
  gridA: number;
  connection: ConnectionPoint;
  count: number;
  kw: number;
  phases: 1 | 3;
  pv: boolean;
  battery: boolean;
}

export function ChargeSingleLine({ hausA, gridA, connection, count, kw, phases, pv, battery }: LineProps) {
  const shown = Math.min(Math.max(count, 0), 3);
  const label = [
    `Netz, Hausanschluss ${hausA} Ampere, Grid ${gridA} Ampere`,
    count > 0 ? `${count} Ladepunkte à ${kw} Kilowatt, ${phases === 1 ? "einphasig" : "dreiphasig"}` : "noch ohne Ladepunkte",
    pv || battery ? `Erzeuger am ${connection === "haus" ? "Hausanschluss" : "Grid"}` : "ohne PV und Speicher",
  ].join(", ");
  const tapX = connection === "haus" ? 250 : 430;
  return <svg className="calc-svg" viewBox="0 0 760 280" role="img" aria-label={`Einlinienbild: ${label}`}>
    <line className="calc-wire" x1="70" y1="168" x2="700" y2="168" />
    <g className="calc-symbol">
      <circle cx="48" cy="168" r="18" />
      <path d="M38 168c2.2-7 5.5-7 8 0s5.8 7 8 0" />
      <text x="48" y="210" textAnchor="middle">Netz</text>
    </g>
    <Fuse x={150} amps={hausA} caption="Hausanschluss" />
    <Fuse x={330} amps={gridA} caption="Grid" />
    {(pv || battery) && <g className="calc-symbol">
      <line className="calc-wire" x1={tapX} y1="168" x2={tapX} y2="78" />
      {pv&&<path className="calc-wire" d={`M${tapX-(battery?42:0)} 72V78H${tapX}`} />}
      {battery&&<path className="calc-wire" d={`M${tapX+(pv?42:0)} 72V78H${tapX}`} />}
      <circle cx={tapX} cy="168" r="3.5" className="calc-joint" />
      {pv && <g>
        <rect x={tapX - (battery ? 78 : 36)} y="36" width="72" height="36" rx="6" />
        <circle cx={tapX - (battery ? 54 : 12)} cy="54" r="7" />
        <text x={tapX - (battery ? 42 : 0)} y="58" textAnchor="middle">PV</text>
      </g>}
      {battery && <g>
        <rect x={tapX + (pv ? 6 : -36)} y="36" width="72" height="36" rx="6" />
        <text x={tapX + (pv ? 42 : 0)} y="58" textAnchor="middle">Speicher</text>
      </g>}
    </g>}
    {Array.from({ length: shown }, (_, index) => {
      const x = 470 + index * 78;
      return <g key={x} className="calc-symbol">
        <line className="calc-wire" x1={x} y1="168" x2={x} y2="206" />
        <rect x={x - 30} y="206" width="60" height="40" rx="6" />
        <text x={x} y="223" textAnchor="middle">{kw} kW</text>
        <text x={x} y="237" textAnchor="middle" className="calc-svg-muted">{phases === 1 ? "1~" : "3~"}</text>
      </g>;
    })}
    {count > shown && <text className="calc-symbol" x="700" y="160" textAnchor="end">× {count}</text>}
  </svg>;
}

function Fuse({ x, amps, caption }: { x: number; amps: number; caption: string }) {
  return <g className="calc-symbol">
    <rect x={x - 16} y="150" width="32" height="36" rx="2" />
    <line x1={x - 7} y1="158" x2={x + 7} y2="178" />
    <text x={x} y="142" textAnchor="middle">{amps} A</text>
    <text x={x} y="210" textAnchor="middle">{caption}</text>
  </g>;
}

export function SelectivitySketch({ upstreamA, downstreamA }: { upstreamA: number; downstreamA: number | null }) {
  const down = downstreamA === null ? "> 125 A" : `${downstreamA} A`;
  return <figure className="calc-sketch">
    <svg viewBox="0 0 460 118" role="img" aria-label={`Staffelung ${upstreamA} Ampere vor ${down}`}>
      <line className="calc-wire" x1="150" y1="48" x2="300" y2="48" />
      <g className="calc-symbol">
        <rect x="78" y="28" width="72" height="40" rx="3" />
        <text x="114" y="52" textAnchor="middle">{upstreamA} A</text>
        <text x="114" y="92" textAnchor="middle">Vorsicherung</text>
      </g>
      <g className="calc-symbol">
        <rect x="300" y="28" width="86" height="40" rx="3" />
        <text x="343" y="52" textAnchor="middle">{down}</text>
        <text x="343" y="92" textAnchor="middle">Ladepunkt</text>
      </g>
    </svg>
  </figure>;
}
