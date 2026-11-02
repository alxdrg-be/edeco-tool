import { useId } from "react";
import type { calculateCable } from "./engineering";
import { useAnimatedGeometry } from "./useAnimatedGeometry";
export default function CableCanvas({ result, material }: { result: ReturnType<typeof calculateCable> | null; material: string }) {
  const id = useId().replace(/:/g, ""), colour = result ? result.withinBudget ? "var(--ok)" : "var(--alert)" : "var(--muted)";
  const voltage = result?.voltage, percent = result?.percent ?? 0, axisMax = Math.max(10, Math.ceil(Math.max(percent, result?.limit ?? 4) / 5) * 5);
  const geometry = useAnimatedGeometry({ endY: 315 + Math.min(100, percent / axisMax * 100), radius: Math.min(35, 12 + Math.sqrt(result?.area ?? 2.5) * 3), budgetY: 315 + (result?.limit ?? 4) / axisMax * 100, axisMax }, { enabled: Boolean(result) });
  const { endY, radius } = geometry;
  return <svg className="lab-svg" viewBox="0 0 850 480" role="img" aria-label={result ? `Leitungsmodell: ${result.length} Meter, ${result.area} Quadratmillimeter, ${result.voltage} auf ${result.endVoltage.toFixed(1)} Volt, Spannungsfall ${result.percent.toFixed(2)} Prozent` : "Leitungsmodell ohne gültiges Berechnungsergebnis"}>
    <defs><pattern id={`${id}-grid`} width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" stroke="var(--line)" strokeWidth=".6" fill="none" /></pattern><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
    <rect width="850" height="480" fill={`url(#${id}-grid)`} />
    <rect x="50" y="120" width="155" height="105" rx="12" fill="var(--panel)" stroke="var(--line-strong)" /><text x="70" y="148" className="lab-svg-muted">EINSPEISUNG</text><text x="70" y="180" className="lab-svg-number">{voltage === undefined ? "–" : `${voltage} V`}</text><text x="70" y="206">{result ? result.factor === 2 ? "1~" : "3~" : "–"}</text>
    <rect x="645" y="120" width="155" height="105" rx="12" fill="var(--panel)" stroke={colour} /><text x="665" y="148" className="lab-svg-muted">VERBRAUCHER</text><text x="665" y="180" className="lab-svg-number">{result ? `${result.endVoltage.toFixed(1)} V` : "–"}</text><text x="665" y="206">{result ? `${result.current} A` : "–"}</text>
    <path d="M205 172H645" stroke="var(--line-strong)" strokeWidth="9" />{result && <path d="M205 172H645" className="lab-svg-wire" />}
    <circle cx="425" cy="172" r={radius+8} fill="var(--panel-2)" stroke="var(--line-strong)" strokeWidth="3" /><circle cx="425" cy="172" r={radius} fill={material === "cu" ? "var(--wire)" : "#b6c5d8"} opacity=".8" />
    <text x="425" y="88" textAnchor="middle" className="lab-svg-number">{result ? `${result.area} mm² · ${material === "cu" ? "Cu" : "Al"}` : "Eingaben prüfen"}</text>
    <path d="M215 247H635M215 240V254M635 240V254" stroke="var(--muted)" /><text x="425" y="272" textAnchor="middle">L = {result?.length ?? "–"} m · einfache Länge</text>
    <text x="75" y="305" className="lab-svg-muted">SPANNUNGSFALL</text><path d="M135 315H745M135 365H745M135 415H745" stroke="var(--line)" />
    <text x="75" y="321">0 %</text><text x="75" y="371">{(geometry.axisMax/2).toLocaleString("de-CH", { maximumFractionDigits: 1 })} %</text><text x="75" y="421">{geometry.axisMax.toLocaleString("de-CH", { maximumFractionDigits: 1 })} %</text>
    {result && <><path d={`M135 315L745 ${endY}V415H135Z`} fill={`url(#${id}-area)`} /><path d={`M135 315L745 ${endY}`} stroke={colour} strokeWidth="3" fill="none" /><circle cx="745" cy={endY} r="5" fill={colour} />
      <path d={`M135 ${geometry.budgetY}H745`} stroke="var(--muted)" strokeDasharray="5 5" /></>}
    <text x="135" y="450" className="lab-svg-muted">0 m</text><text x="745" y="450" textAnchor="end" className="lab-svg-muted">{result?.length ?? "–"} m</text>
  </svg>;
}
