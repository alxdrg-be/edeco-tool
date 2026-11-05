import { renderToStaticMarkup } from "react-dom/server";
import { RackDeviceGlyph } from "./RackCanvas";
import { placementRect, rackGeometry } from "./geometry";
import { rackDrawingFill, rackDrawingInk } from "./rackDrawingPalette";
import { SHEET, sheetScale, stackLabels, textWidth, wrapText } from "./sheetLayout";
import { HE_MM } from "./types";
import type { Placement, RackDocument } from "./types";
import { responsibility } from "./responsibility";

/** Own A4 plan sheet. The preview shows exactly this markup; PDF and SVG are converted from it. */
export interface RackSheetProps { document: RackDocument; rackId: string; view: "front" | "rear"; logo?: string; filename?: string }

const INK = "#222222", MUTED = "#5f6f78", FONT = "Helvetica, Arial, sans-serif";
const onFace = (item: Placement, view: "front" | "rear") => item.side === view || item.side === "zero-left" || item.side === "zero-right" || view === "rear" && item.side === "zero-rear";
const mm = (value: number) => value.toLocaleString("de-CH", { maximumFractionDigits: 1 });
const ZERO_SIDES = ["zero-left", "zero-right", "zero-rear"];

function Lines({ x, y, lines, size, bold = false, fill = INK, anchor = "start" }: { x: number; y: number; lines: string[]; size: number; bold?: boolean; fill?: string; anchor?: "start" | "middle" | "end" }) {
  return <>{lines.map((line, index) => <text key={index} x={x} y={y + index * size * 1.25} fontSize={size} fontWeight={bold ? "bold" : "normal"} fill={fill} textAnchor={anchor} fontFamily={FONT}>{line}</text>)}</>;
}

/** Inline the edeco logo with explicit fills so the sheet has no stylesheet dependency. */
export function sheetLogo(raw: string): string {
  const fills: Record<string, string> = { "cls-1": 'fill="#017c92"', "cls-2": 'fill="#017c92" fill-rule="evenodd"', "cls-3": 'fill="#14212b"', "cls-4": 'fill="#ff8c00"' };
  return raw.replace(/<\?xml[^>]*>/, "").replace(/<defs>[\s\S]*?<\/defs>/, "").replace(/class="(cls-\d)"/g, (_, name: string) => fills[name] ?? "")
    .replace(/<svg[^>]*viewBox="([^"]+)"[^>]*>/, '<svg viewBox="$1">').trim();
}

export default function RackSheet({ document, rackId, view, logo, filename }: RackSheetProps) {
  const rack = document.racks.find(item => item.id === rackId);
  if (!rack) return null;
  const profiles = new Map(document.profiles.map(item => [item.id, item]));
  const geometry = rackGeometry(rack), scale = sheetScale(rack.widthMm, rack.heightMm);
  const cabinetFill = rackDrawingFill(rack.metadata?.drawingFill, "#cccccc"), cabinetInk = rackDrawingInk(cabinetFill);
  const rackX = 32, rackY = SHEET.drawingTop + 4, drawWidth = rack.widthMm / scale, drawHeight = rack.heightMm / scale;
  const unitPaper = HE_MM / scale, labelEvery = unitPaper >= 2.2 ? 1 : unitPaper >= 1.1 ? 5 : 10;
  const items = document.placements.filter(item => item.rackId === rack.id && item.status !== "removed" && onFace(item, view) && profiles.has(item.profileId))
    .filter(item => !ZERO_SIDES.includes(item.side) || item.zeroStartMm !== null && item.zeroHeightMm !== null);
  const labelX = rackX + drawWidth + 16, labelWidth = SHEET.width - SHEET.margin - 3 - labelX, labelSize = 2.3, lineHeight = labelSize * 1.25;
  const duties = new Map(items.map(item => [item.id, responsibility(item)]));
  // Free parts carry their text on the face (as in the template); they only get a side label for L+M.
  const labelled = items.filter(item => profiles.get(item.profileId)!.metadata?.free !== true || duties.get(item.id)!.plan);
  const labels = stackLabels(labelled.map(item => {
    const profile = profiles.get(item.profileId)!, rect = placementRect(rack, item, profile), duty = duties.get(item.id)!;
    const status = item.status === "existing" ? " (Bestand)" : "";
    return { id: item.id, anchorY: rackY + (rect.y + rect.height / 2) / scale, lines: wrapText(`${item.label || profile.name}${status}${duty.plan ? ` (${duty.plan})` : ""}`, labelSize, labelWidth) };
  }), lineHeight, rackY, SHEET.drawingBottom);
  const anchors = new Map(items.map(item => { const rect = placementRect(rack, item, profiles.get(item.profileId)!); return [item.id, { x: rackX + (rect.x + rect.width) / scale, y: rackY + (rect.y + rect.height / 2) / scale }]; }));
  const title = `${rack.label} · ${view === "front" ? "Vorderansicht" : "Rückansicht"}`;
  const project = [document.projectNumber, document.name].filter(Boolean).join(" · ") || "Projekt offen";
  const notes = wrapText(rack.notes.trim() || "Zuleitung, Absicherung und Erdung im Rack-Hinweis erfassen.", 2.3, 74).slice(0, 7);
  const neighbours = document.racks.filter(item => item.room === rack.room);
  const plan = neighbours.length ? Math.min(54 / neighbours.reduce((sum, item) => sum + item.widthMm, 0), 21 / Math.max(...neighbours.map(item => item.depthMm + item.widthMm))) : 0;
  let planX = 140;
  const T = SHEET.titleTop, B = SHEET.height - SHEET.margin;
  return <svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297" fontFamily={FONT} data-rack-sheet={rack.id} data-view={view}>
    <rect x="0" y="0" width="210" height="297" fill="#ffffff" stroke="none" />
    <rect x={SHEET.margin} y={SHEET.margin} width={210 - 2 * SHEET.margin} height={297 - 2 * SHEET.margin} fill="none" stroke={INK} strokeWidth=".35" />
    <line x1={SHEET.margin} x2={210 - SHEET.margin} y1="26" y2="26" stroke={INK} strokeWidth=".25" />
    <line x1={SHEET.margin} x2={210 - SHEET.margin} y1="31" y2="31" stroke={INK} strokeWidth=".25" />
    <text x={200 - 34} y="29.6" fontSize="2.6" fill={INK}>Trasse</text>

    <rect x={rackX} y={rackY - 4.2} width={drawWidth} height="3.6" fill="#ffffff" stroke={INK} strokeWidth=".2" />
    <text x={rackX + drawWidth / 2} y={rackY - 1.6} fontSize="2" textAnchor="middle" fill={INK}>{rack.label}</text>
    <g transform={`translate(${rackX} ${rackY}) scale(${1 / scale})`}>
      <rect x="0" y="0" width={rack.widthMm} height={rack.heightMm} fill={cabinetFill} stroke={cabinetInk} strokeWidth={.3 * scale} />
      <rect x="22" y="22" width={rack.widthMm - 44} height={rack.heightMm - 44} fill={cabinetFill} stroke={cabinetInk} strokeWidth={.15 * scale} />
      <rect x={geometry.railLeftMm} y={geometry.railTopMm} width={geometry.railRightMm - geometry.railLeftMm} height={geometry.railHeightMm} fill="#ffffff" stroke={INK} strokeWidth={.2 * scale} />
      {[geometry.railLeftMm - 15, geometry.railRightMm + 3].map(x => <rect key={x} x={x} y={geometry.railTopMm} width="12" height={geometry.railHeightMm} fill="#e6e6e6" stroke={INK} strokeWidth={.1 * scale} />)}
      {Array.from({ length: rack.units + 1 }, (_, index) => { const y = geometry.railBottomMm - index * HE_MM; return <line key={index} x1={geometry.railLeftMm - 4} x2={geometry.railRightMm + 4} y1={y} y2={y} stroke="#9aa7ad" strokeWidth={index % 5 === 0 ? .12 * scale : .06 * scale} />; })}
      {Array.from({ length: rack.units }, (_, index) => index + 1).filter(unit => unit === 1 || unit % labelEvery === 0).map(unit => { const y = geometry.railBottomMm - (unit - .5) * HE_MM + Math.min(1.6, unitPaper * .55) * scale * .35; const size = Math.min(1.6, unitPaper * .55) * scale; return <g key={unit}><text x={geometry.railLeftMm - 20} y={y} fontSize={size} textAnchor="end" fill={cabinetInk}>{unit}</text><text x={geometry.railRightMm + 20} y={y} fontSize={size} textAnchor="start" fill={cabinetInk}>{unit}</text></g>; })}
      {items.map(item => {
        const profile = profiles.get(item.profileId)!, rect = placementRect(rack, item, profile);
        const fill = rackDrawingFill(profile.metadata?.drawingFill, "#ffffff"), ink = rackDrawingInk(fill), zero = ZERO_SIDES.includes(item.side);
        const caption = !profile.portCount && !zero && profile.kind !== "manager" && profile.kind !== "reserve";
        return <g key={item.id} transform={`translate(${rect.x} ${rect.y})`} data-placement={item.id}>
          <rect x="1" y="1" width={Math.max(0, rect.width - 2)} height={Math.max(0, rect.height - 2)} fill={fill} stroke={ink} strokeWidth={.2 * scale} strokeDasharray={profile.kind === "reserve" ? `${1.2 * scale} ${1 * scale}` : undefined} />
          {!zero && [8, rect.width - 8].flatMap(x => [Math.min(10, rect.height / 2), Math.max(rect.height - 10, rect.height / 2)].map((y, index) => <circle key={`${x}-${index}`} cx={x} cy={y} r="2.7" fill={ink} stroke="none" />))}
          <g color={ink} fill="none" stroke="currentColor" strokeWidth={.12 * scale}><RackDeviceGlyph profile={profile} width={rect.width} height={rect.height} /></g>
          {caption && <text x={rect.width / 2} y={rect.height / 2 + Math.min(2.2 * scale, rect.height * .45) * .35} fontSize={Math.min(2.2 * scale, rect.height * .45)} textAnchor="middle" fill={ink}>{item.label || profile.name}</text>}
        </g>;
      })}
    </g>
    {labels.map(label => { const anchor = anchors.get(label.id)!, textY = label.y + labelSize * .8; return <g key={label.id}>
      <path d={`M${anchor.x + .6} ${anchor.y}H${anchor.x + 5}L${labelX - 3} ${label.y + labelSize * .45}H${labelX - 1}`} fill="none" stroke={MUTED} strokeWidth=".15" />
      {duties.get(label.id)!.owner && <rect x={labelX - .6} y={label.y - .1} width={Math.max(...label.lines.map(line => textWidth(line, labelSize))) + 1.2} height={label.lines.length * lineHeight + .3} fill="#fff3a6" stroke="none" />}
      <Lines x={labelX} y={textY} lines={label.lines} size={labelSize} />
    </g>; })}
    <text x={rackX} y={rackY + drawHeight + 5} fontSize="2.2" fill={MUTED}>Gehäuse {mm(rack.widthMm)} × {mm(rack.heightMm)} × {mm(rack.depthMm)} mm · Massstab 1:{scale} bei A4</text>

    <line x1={SHEET.margin} x2={210 - SHEET.margin} y1={SHEET.infoTop - 1} y2={SHEET.infoTop - 1} stroke={INK} strokeWidth=".2" />
    <Lines x={14} y={SHEET.infoTop + 4} size={2.4} lines={[`Schrank: 19" ${rack.units} HE`, `Breite: ${mm(rack.widthMm)} mm`, `Höhe: ${mm(rack.heightMm)} mm`, `Tiefe: ${mm(rack.depthMm)} mm`, ...(rack.room ? [`Raum: ${rack.room}`] : [])]} />
    <text x="62" y={SHEET.infoTop + 4} fontSize="2.4" fontWeight="bold" fill={INK}>Hinweise</text>
    <Lines x={62} y={SHEET.infoTop + 7.4} size={2.3} lines={notes} fill={rack.notes.trim() ? INK : MUTED} />
    {neighbours.map(item => { const w = item.widthMm * plan, d = item.depthMm * plan, x = planX; planX += w; const active = item.id === rack.id; return <g key={item.id}>
      <rect x={x} y={SHEET.infoTop + 3} width={w} height={d} fill={active ? "#d6d6d6" : "#ffffff"} stroke={INK} strokeWidth=".2" />
      <Lines x={x + w / 2} y={SHEET.infoTop + 6} size={1.8} anchor="middle" lines={wrapText(item.label, 1.8, Math.max(4, w - 1)).slice(0, 2)} />
      <path d={`M${x} ${SHEET.infoTop + 3 + d}C${x} ${SHEET.infoTop + 3 + d + w * .55} ${x + w * .45} ${SHEET.infoTop + 3 + d + w} ${x + w} ${SHEET.infoTop + 3 + d + w}`} fill="none" stroke={MUTED} strokeWidth=".15" strokeDasharray=".8 .6" />
    </g>; })}

    <line x1={SHEET.margin} x2={210 - SHEET.margin} y1={T} y2={T} stroke={INK} strokeWidth=".35" />
    <line x1="58" x2="58" y1={T} y2={B} stroke={INK} strokeWidth=".35" /><line x1="148" x2="148" y1={T} y2={B} stroke={INK} strokeWidth=".35" />
    <line x1={SHEET.margin} x2="58" y1={T + 14} y2={T + 14} stroke={INK} strokeWidth=".2" /><line x1="148" x2="200" y1={T + 22} y2={T + 22} stroke={INK} strokeWidth=".2" />
    <text x="12" y={T + 4} fontSize="2.2" fill={INK}>Datei:</text>
    <Lines x={12} y={T + 8} size={2.2} lines={wrapText(filename || `${document.name}.pdf`, 2.2, 44).slice(0, 2)} />
    <Lines x={12} y={T + 19} size={2.2} fill={MUTED} lines={["Vorplanung · keine", "Ausführungs- oder Normfreigabe"]} />
    <Lines x={62} y={T + 7} size={3.6} bold lines={wrapText(project, 3.6, 82).slice(0, 2)} />
    {document.room && <text x="62" y={T + 16} fontSize="2.8" fill={INK}>{document.room}</text>}
    <text x="62" y={T + 29} fontSize="4.6" fontWeight="bold" fill={INK}>{title}</text>
    {logo ? <g transform={`translate(160 ${T + 4}) scale(${28 / 251.26})`} dangerouslySetInnerHTML={{ __html: logo.replace(/^<svg[^>]*>|<\/svg>$/g, "") }} /> : <text x="174" y={T + 13} fontSize="6" fontWeight="bold" textAnchor="middle" fill="#017c92">edeco</text>}
    {[["Datum:", document.date || "–"], ["Index:", document.index || "–"], ["Erstellt von:", document.author || "–"]].map(([label, value], index) => <g key={label}>
      <text x={150 + index * 17} y={T + 26} fontSize="2" fill={MUTED}>{label}</text>
      <Lines x={150 + index * 17} y={T + 30.5} size={2.4} lines={wrapText(value, 2.4, 16).slice(0, 2)} />
    </g>)}
  </svg>;
}

/** Serialized sheet for the export request. */
export function rackSheetMarkup(props: RackSheetProps): string {
  return renderToStaticMarkup(<RackSheet {...props} />);
}

export { textWidth };
