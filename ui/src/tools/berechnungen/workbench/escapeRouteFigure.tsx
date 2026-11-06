import { useId, useState } from "react";
import type { CalculationResult, Inputs } from "./types.ts";
import { ESCAPE_EMPTY_TEXT, escapeRouteStates, type EscapeCableTone, type EscapeRouteState } from "./escapeRoute.ts";

const toneColour = (tone: EscapeCableTone | EscapeRouteState["summary"]) => tone === "error" ? "var(--danger)" : tone === "warning" ? "var(--wire)" : tone === "ok" ? "var(--ok)" : "var(--muted)";

function RouteDrawing({ state, titleId }: { state: EscapeRouteState; titleId: string }) {
  const trayX = 168, trayWidth = 640, slotWidth = trayWidth / 5;
  const trays = [78, 188];
  const utilisation = state.limit && state.density !== null ? Math.min(1, Math.max(0, state.density / state.limit)) : 0;
  const barTone = state.empty ? "neutral" : state.summary;
  return <svg className="lab-svg technical-svg escape-route-svg" viewBox="0 0 860 340" role="img" aria-labelledby={titleId} data-escape-state={state.id} data-escape-summary={state.summary}>
    <title id={titleId}>{state.empty ? ESCAPE_EMPTY_TEXT : `${state.label}: ${state.headline}, ${state.countLabel}`}</title>
    <text x="24" y="28" className="technical-node-label">{state.horizontal ? "Fluchtweg horizontal" : "Fluchtweg vertikal"}</text>
    <text x="836" y="28" textAnchor="end" className="technical-node-value" data-escape-headline={state.headline}>{state.headline}</text>
    <rect x="28" y="78" width="92" height="168" rx="8" fill="var(--panel)" stroke="var(--line-strong)" />
    <text x="74" y="156" textAnchor="middle" className="technical-node-label">Verteiler</text>
    <text x="74" y="176" textAnchor="middle" className="technical-node-detail">HV / UV</text>
    <path d="M120 118H168M120 228H168" fill="none" stroke="var(--line-strong)" strokeWidth="3" />
    {trays.map(y => <rect key={y} x={trayX} y={y} width={trayWidth} height="78" rx="6" fill="var(--panel-2)" stroke="var(--line-strong)" strokeWidth="2" />)}
    {state.slots.map((tone, index) => {
      const tray = index < 5 ? 0 : 1;
      const column = index % 5;
      const x = trayX + column * slotWidth;
      const y = trays[tray];
      return <g key={index} data-escape-slot={index + 1} data-escape-tone={tone ?? "empty"}>
        <rect x={x + 8} y={y + 10} width={slotWidth - 16} height="58" rx="4" fill="var(--panel)" stroke="var(--line)" />
        <text x={x + slotWidth / 2} y={y + 24} textAnchor="middle" className="technical-node-detail">R{index + 1}</text>
        {tone && <path d={`M${x + 18} ${y + 46}H${x + slotWidth - 18}`} stroke={toneColour(tone)} strokeWidth="4" strokeLinecap="round" />}
      </g>;
    })}
    {state.empty && <g><rect x="280" y="150" width="400" height="34" rx="8" fill="var(--canvas)" stroke="var(--line)" /><text x="480" y="172" textAnchor="middle" className="technical-node-label">{ESCAPE_EMPTY_TEXT}</text></g>}
    <text x="24" y="292" className="technical-node-detail">{state.lengthLabel}{state.shown < state.count ? ` · ${state.shown} von ${state.count.toLocaleString("de-CH")} gezeichnet` : ""}</text>
    <text x="836" y="292" textAnchor="end" className="technical-node-detail">{state.limit === null ? "Vertikal · ohne Grenzwertfreigabe" : state.empty ? "Leere Bilanz" : `${state.countLabel}`}</text>
    <rect x="24" y="308" width="812" height="10" rx="5" fill="var(--panel)" stroke="var(--line)" />
    <rect x="24" y="308" width={812 * utilisation} height="10" rx="5" fill={toneColour(barTone)} data-escape-utilisation={utilisation.toFixed(3)} />
  </svg>;
}

export default function EscapeRoute({ calculatorId, input, result }: { calculatorId: string; input?: Inputs; result: CalculationResult }) {
  const titleId = useId();
  const states = input ? escapeRouteStates(calculatorId, input, result) : [];
  const [selected, setSelected] = useState(0);
  const active = states[Math.min(selected, Math.max(0, states.length - 1))] ?? states[0];
  if (!active) return null;
  return <figure className="technical-figure escape-route" aria-label="Fluchtweg, schematisch">
    <header><h2>Fluchtweg, schematisch</h2><span>Nicht massstäblich</span></header>
    {states.length > 1 && <div className="escape-switch" role="group" aria-label="Zustand im Fluchtweg">{states.map((state, index) => <button type="button" key={state.id} aria-pressed={state.id === active.id} onClick={() => setSelected(index)}>{state.label} · {state.countLabel}</button>)}</div>}
    <div className="technical-scroll" role="region" tabIndex={0} aria-label="Fluchtweg-Schnitt, bei Bedarf horizontal verschieben">
      <RouteDrawing state={active} titleId={titleId} />
    </div>
    {states.length === 1 && <p className="escape-count">{active.countLabel}</p>}
    <ul className="escape-legend">
      <li><i data-tone="ok" /> Unter dem Grenzwert, Nachweis eingetragen</li>
      <li><i data-tone="warning" /> Nachweis offen</li>
      <li><i data-tone="error" /> Überschritten oder kritisches Brandverhalten</li>
    </ul>
    <figcaption><details><summary>Darstellung und Grenzen</summary><p>Die Plätze zeigen die erfasste Anzahl, keine örtliche Lage. Grün gilt nur horizontal, unter dem eingegebenen Grenzwert und mit eingetragenem Nachweis. Ein vertikaler Fluchtweg erhält keine pauschale Freigabe. Lokale Häufungen, Abschottungen und die VKF-Anwendbarkeit bleiben separat zu prüfen.</p></details></figcaption>
  </figure>;
}
