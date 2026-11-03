import { useId, useRef, useState, type PointerEvent } from "react";
import type { calculateLightning } from "./lightning-model";
import { useAnimatedGeometry } from "./useAnimatedGeometry";

export default function BuildingCanvas({ length, clearance, result, onDistance }: { length: string; clearance: string; result: ReturnType<typeof calculateLightning> | null; onDistance: (value: string) => void }) {
  const svg = useRef<SVGSVGElement>(null), id = useId().replace(/:/g, "");
  const grabOffset = useRef(0), dragScale = useRef(1);
  const [dragging, setDragging] = useState(false);
  // A is the conductor path to equipotential bonding, not the building height.
  // Keep the building schematic and scale both compared distances together.
  const roof = 225;
  const s = result?.metres ?? 0, known = result?.availableMetres !== null && result?.availableMetres !== undefined;
  const distance = known ? result!.availableMetres! : s * 1.6;
  const scale = 240 / Math.max(s * 1.75, distance, .01);
  const geometry = useAnimatedGeometry({ gap: Math.max(0, distance * scale), radius: s * scale }, { enabled: Boolean(result), immediate: dragging });
  const objectX = 250 + geometry.gap, pointY = roof - 35;
  const state = !result || !known ? "unknown" : !result.clearanceOK || !result.conductorOK ? "fail" : "pass";
  const colour = state === "fail" ? "var(--alert)" : state === "pass" ? "var(--ok)" : "var(--accent)";
  function drag(event: PointerEvent<SVGGElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !svg.current?.getScreenCTM()) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.current.getScreenCTM()!.inverse());
    onDistance(Math.min(100000, Math.max(0, (point.x - 250 - grabOffset.current) / dragScale.current)).toFixed(2));
  }
  return <svg ref={svg} className="lab-svg" viewBox="0 0 850 480" role="img" aria-label={result ? `Interaktives Gebäudeschema: Leitungsweg A ${length} Meter, erforderlicher Abstand ${s} Meter${known ? `, vorhandener Abstand ${distance} Meter` : ", vorhandener Abstand offen"}` : "Gebäudeschema ohne gültiges Berechnungsergebnis"}>
    <defs><pattern id={`${id}-grid`} width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" stroke="var(--line)" strokeWidth=".6" fill="none" /></pattern>
      <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5" /></filter>
      <marker id={`${id}-arrow`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M0 0L6 3L0 6" fill={colour} /></marker></defs>
    <rect width="850" height="480" fill={`url(#${id}-grid)`} />
    <path d={`M250 ${roof}H690V420H250Z`} fill="var(--panel)" stroke="var(--line-strong)" strokeWidth="2" />
    <path d={`M250 ${roof}L275 ${roof-15}H670L690 ${roof}M550 ${roof}V420`} fill="none" stroke="var(--line-strong)" strokeWidth="2" />
    <path d={`M300 ${roof+35}H370V${roof+75}H300ZM410 ${roof+35}H480V${roof+75}H410ZM590 ${roof+35}H650V${roof+75}H590Z`} fill="var(--canvas)" stroke="var(--line)" />
    <path d="M200 420H730" stroke="var(--line-strong)" strokeWidth="2" />
    {result && <g aria-label="Schematische Abstandszone" data-testid="clearance-aura" data-state={state}>
      <circle cx="250" cy={pointY} r={geometry.radius} fill={colour} opacity=".08" /><circle cx="250" cy={pointY} r={geometry.radius} fill="none" stroke={colour} strokeWidth="12" opacity=".15" filter={`url(#${id}-glow)`} />
      <circle cx="250" cy={pointY} r={geometry.radius} fill="none" stroke={colour} strokeWidth="1.5" strokeDasharray="5 4" />
    </g>}
    <path d={`M250 ${roof-75}V420H300`} stroke={result ? "var(--wire)" : "var(--line-strong)"} strokeWidth="3" fill="none" /><circle cx="250" cy={pointY} r="5" fill={result ? "var(--wire)" : "var(--muted)"} />
    <path d="M300 420V433M285 433H315M290 441H310M295 449H305" stroke="var(--muted)" strokeWidth="2" fill="none" /><text x="325" y="441" className="lab-svg-muted">Potenzialausgleich</text>
    <path d={`M155 ${pointY}V420M148 ${pointY}H162M148 420H162`} stroke="var(--muted)" fill="none" /><text x="140" y={(pointY+420)/2-12} textAnchor="end" className="lab-svg-number">A = {result ? Number(length.replace(",", ".")).toLocaleString("de-CH", { maximumFractionDigits: 3 }) : "–"} m</text><text x="140" y={(pointY+420)/2+12} textAnchor="end" className="lab-svg-muted">Leitungsweg</text>
    <text x="540" y="65" className="lab-svg-number">s = {result ? `${s.toLocaleString("de-CH")} m` : "–"}</text>
    <text x="540" y="91" className="lab-svg-muted">vorhanden: {known ? `${distance.toLocaleString("de-CH")} m` : "offen"}</text>
    <path d={`M257 ${pointY}H${Math.max(257, objectX-4)}`} stroke={colour} markerEnd={`url(#${id}-arrow)`} strokeWidth="1.7" />
    <g transform={`translate(${objectX} ${roof-70})`} role="slider" tabIndex={0} aria-label="Abstand Dachobjekt" aria-valuemin={0} aria-valuemax={100000} aria-valuenow={known ? distance : 0} aria-valuetext={known ? `${clearance} Meter` : "Abstand nicht angegeben"}
      onPointerDown={event => {
        event.preventDefault();
        const matrix = svg.current?.getScreenCTM();
        if (matrix) grabOffset.current = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).x - (250 + Math.max(0, distance * scale));
        dragScale.current = scale;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }} onPointerMove={drag}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false); }}
      onPointerCancel={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false); }}
      onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); onDistance(event.key === "Home" ? "0" : event.key === "End" ? "10" : Math.min(100000, Math.max(0, distance + (event.key === "ArrowLeft" ? -.01 : .01))).toFixed(2)); } }}>
      <title>Dachobjekt horizontal verschieben oder Pfeiltasten verwenden</title><rect width="76" height="70" rx="6" fill="var(--panel-2)" stroke={colour} strokeWidth="2" />
      <path d="M12 18h52M12 25h52M12 32h52M12 39h52M12 46h52" stroke="var(--line-strong)" />
    </g>

    <text x="28" y="468" className="lab-svg-muted">Gebäude schematisch · A ist keine Gebäudehöhe · Abstandsskala passt sich an</text>
  </svg>;
}
