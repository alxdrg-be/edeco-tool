import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, DragEvent, KeyboardEvent, PointerEvent } from "react";
import { Hand, Maximize2, Minus, MousePointer2, MoveHorizontal, Plus, ScanLine } from "lucide-react";
import { HE_MM } from "./types";
import type { DeviceProfile, MountSide, Placement, RackDocument, RackIssue } from "./types";
import { placementRect, rackGeometry, rawStartUnitFromY } from "./geometry";
import { addPlacement, movePlacements } from "./model";
import { limitRackViewport, rackPortGrid, readRackDragProfile } from "./rackCanvasGeometry";
import { rackDrawingFill, rackDrawingInk } from "./rackDrawingPalette";
import "./rack-canvas.css";

export interface RackCanvasProps {
  document: RackDocument;
  rackId: string;
  view: "front" | "rear";
  selectedIds: string[];
  dragProfileId?: string | null;
  issues?: RackIssue[];
  onSelect: (id: string | null, add: boolean) => void;
  onPlace: (profileId: string, startUnit: number, side: MountSide) => void;
  onMove: (ids: string[], delta: number) => void;
  onError: (issues: RackIssue[]) => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  focusPlacementId?: string | null;
}

const BASE_SCALE = .48;
// Annotation and tool sizes stay readable in screen pixels while the rack stays in mm.
const FIT_MARGIN = { left: 44, right: 76, top: 26, bottom: 62 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
/** Fixed drawing size, so zooming in enlarges the text with the cabinet and it stays inside its band. */
function drawingFont(naturalMm: number, maxMm: number) {
  return Math.min(maxMm, naturalMm);
}
function textPlate(x: number, y: number, text: string, font: number, anchor: "start" | "middle" | "end") {
  const width = Math.max(font * 1.15, text.length * font * .62), height = font * 1.42;
  const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  return { x: left - font * .32, y: y - height / 2, width: width + font * .64, height, rx: Math.min(4, font * .18) };
}
const onFace = (item: Placement, view: "front" | "rear") => item.side === view || item.side === "zero-left" || item.side === "zero-right" || view === "rear" && item.side === "zero-rear";
const number = (value: number) => value.toLocaleString("de-CH", { maximumFractionDigits: 1 });
const toneFor = (issues: RackIssue[]) => issues.some(issue => issue.severity === "error") ? "error" : issues.some(issue => issue.severity === "warning") ? "warning" : issues.length ? "open" : "neutral";
type Viewport = { x: number; y: number; scale: number };
type Preview = { document: RackDocument; ids: string[]; accepted: boolean; issues: RackIssue[]; profileId?: string; startUnit?: number; side?: MountSide; delta?: number };
type Gesture = { kind: "pan"; clientX: number; clientY: number; viewport: Viewport; moved: boolean } |
  { kind: "move"; clientX: number; clientY: number; ids: string[]; moved: boolean; delta: number };

/** Port numbers smaller than this on screen are unreadable, and Windows rounds their glyphs up so they collide. */
const MIN_PORT_NUMBER_PX = 5;

/** Independent technical glyph; the profile controls HE, medium and ports. `screenScale` (px per mm) hides port numbers while they are too small to read. The sheet passes none. */
export function RackDeviceGlyph({ profile, width, height, screenScale }: { profile: DeviceProfile; width: number; height: number; screenScale?: number }) {
  const ports = rackPortGrid(profile.portCount);
  if (profile.kind === "pdu") {
    const count = profile.portCount || 8, gap = height / (count + 1), radius = Math.min(width * .29, gap * .25);
    return <g className="rd-device-glyph"><line x1={width / 2} x2={width / 2} y1={10} y2={height - 10} />{Array.from({ length: count }, (_, index) => <g key={index} transform={`translate(${width / 2} ${gap * (index + 1)})`}><rect x={-radius} y={-radius} width={radius * 2} height={radius * 2} rx={radius * .2} /><circle cx={-radius * .35} r={radius * .11} /><circle cx={radius * .35} r={radius * .11} /><path d={`M0 ${radius * .2}v${radius * .35}`} /></g>)}</g>;
  }
  if (ports.length) {
    const inset = profile.kind === "switch" ? 40 : 17, available = width - inset * 2;
    const cellWidth = available / ports[0].columns, cellHeight = (height - 9) / ports[0].rows;
    const portFont = Math.min(11, cellHeight * .3, cellWidth * .7);
    return <g className={`rd-device-glyph rd-ports rd-medium-${profile.medium.toLowerCase()}`} data-port-count={ports.length}>
      {ports.map(port => {
        const x = inset + port.column * cellWidth + cellWidth * .12, y = 4 + port.row * cellHeight;
        const portWidth = cellWidth * .76, portHeight = Math.min(cellHeight * .56, portWidth * .8);
        return <g key={port.number} data-port-number={port.number} transform={`translate(${x} ${y})`}><title>{`${profile.medium} · Port ${port.number}`}</title>
          {profile.medium === "LWL" ? <><rect x={0} y={cellHeight * .32} width={portWidth * .43} height={portHeight} rx="1" /><rect x={portWidth * .54} y={cellHeight * .32} width={portWidth * .43} height={portHeight} rx="1" /></> : <path d={`M0 ${cellHeight * .32}h${portWidth}v${portHeight}h${-portWidth * .24}v${portHeight * .18}h${-portWidth * .52}v${-portHeight * .18}H0Z`} />}
          {(screenScale === undefined || portFont * screenScale >= MIN_PORT_NUMBER_PX) && <text className="rd-port-number" fill="currentColor" stroke="none" x={portWidth / 2} y={cellHeight * .22} textAnchor="middle" fontSize={portFont}>{port.number}</text>}
        </g>;
      })}
      {profile.kind === "switch" && <><circle cx="20" cy={height / 2 - 5} r="2.5" /><circle cx="20" cy={height / 2 + 5} r="2.5" /><path d={`M${width - 28} ${height / 2 - 6}h12m-12 6h12m-12 6h12`} /></>}
    </g>;
  }
  if (profile.kind === "manager") return <g className="rd-device-glyph">{Array.from({ length: 7 }, (_, index) => <path key={index} d={`M${35 + index * (width - 70) / 6} 7v${height - 14}m-8 ${-height + 14}h16m-16 ${height - 14}h16`} />)}</g>;
  if (profile.kind === "earth") return width < 100
    ? <g className="rd-device-glyph"><path d={`M${width / 2} 14v${height - 50}m${-width * .35} 0h${width * .7}m${-width * .6} 9h${width * .5}m${-width * .4} 9h${width * .3}`} />{[.2, .4, .6].map(value => <circle key={value} cx={width / 2} cy={height * value} r="4" />)}</g>
    : <g className="rd-device-glyph"><path d={`M25 ${height * .45}H${width - 25}M${width / 2} ${height * .45}v${height * .25}m-22 0h44m-34 7h24m-16 7h8`} />{[.15, .3, .7, .85].map(value => <circle key={value} cx={width * value} cy={height * .45} r="4" />)}</g>;
  if (profile.kind === "ups") return <g className="rd-device-glyph"><rect x="26" y={height * .22} width="65" height={height * .56} rx="5" /><path d={`M45 ${height / 2}h25m-12-12v24`} />{Array.from({ length: 10 }, (_, index) => <line key={index} x1={width - 160 + index * 11} x2={width - 160 + index * 11} y1={height * .25} y2={height * .75} />)}</g>;
  if (profile.kind === "shelf") return <g className="rd-device-glyph"><path d={`M24 ${height * .64}H${width - 24}l-12-10H36Z`} />{Array.from({ length: 15 }, (_, index) => <line key={index} x1={42 + index * 27} x2={52 + index * 27} y1={height * .64 - 5} y2={height * .64 - 5} />)}</g>;
  if (profile.kind === "reserve") return <g className="rd-device-glyph"><path d={`M12 12 ${width - 12} ${height - 12}M${width - 12} 12 12 ${height - 12}`} strokeDasharray="8 7" /></g>;
  // Free/custom parts carry their own text on the face; a centre line would cross it.
  if (profile.kind === "custom") return <g className="rd-device-glyph" />;
  return <g className="rd-device-glyph"><path d={`M25 ${height / 2}H${width - 25}`} opacity=".35" /></g>;
}

export default function RackCanvas({ document, rackId, view, selectedIds, dragProfileId = null, issues = [], onSelect, onPlace, onMove, onError, onDelete, onCopy, onPaste, focusPlacementId }: RackCanvasProps) {
  const holder = useRef<HTMLDivElement>(null), gesture = useRef<Gesture | null>(null), unique = useId().replaceAll(":", "");
  const dropCache = useRef<{ document: RackDocument; key: string; preview: Preview } | null>(null);
  const [size, setSize] = useState({ width: 720, height: 720 });
  const [viewport, setViewport] = useState<Viewport>({ x: -120, y: -100, scale: .3 });
  const [hand, setHand] = useState(false), [space, setSpace] = useState(false), [panning, setPanning] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null), [status, setStatus] = useState("");
  const rack = document.racks.find(item => item.id === rackId);
  const context = useRef({ document, rack, viewport, size, view, selectedIds, dragProfileId });
  context.current = { document, rack, viewport, size, view, selectedIds, dragProfileId };
  const place = useCallback((next: Viewport | ((old: Viewport) => Viewport)) => {
    setViewport(old => {
      const value = typeof next === "function" ? next(old) : next;
      const current = context.current;
      return current.rack ? limitRackViewport(value, current.rack, current.size) : value;
    });
  }, []);
  const profiles = new Map(document.profiles.map(item => [item.id, item]));
  const visible = document.placements.filter(item => item.rackId === rackId && item.status !== "removed" && onFace(item, view));
  const fit = useCallback(() => {
    const { rack: current, size: area } = context.current;
    if (!current) return;
    const width = Math.max(1, area.width - FIT_MARGIN.left - FIT_MARGIN.right);
    const height = Math.max(1, area.height - FIT_MARGIN.top - FIT_MARGIN.bottom);
    const scale = clamp(Math.min(width / current.widthMm, height / current.heightMm), .04, 1.5);
    place({ x: -(FIT_MARGIN.left + (width - current.widthMm * scale) / 2) / scale,
      y: -(FIT_MARGIN.top + (height - current.heightMm * scale) / 2) / scale, scale });
  }, [place]);
  const zoom = useCallback((factor: number, at?: { x: number; y: number }, absolute?: number) => {
    const current = context.current, point = at ?? { x: current.size.width / 2, y: current.size.height / 2 };
    place(old => { const scale = clamp(absolute ?? old.scale * factor, .04, 2.4); return { x: old.x + point.x / old.scale - point.x / scale, y: old.y + point.y / old.scale - point.y / scale, scale }; });
  }, [place]);
  const fitWidth = useCallback(() => {
    const { rack: current, size: area } = context.current;
    if (!current) return;
    const width = Math.max(1, area.width - FIT_MARGIN.left - FIT_MARGIN.right);
    const scale = clamp(width / current.widthMm, .04, 2.4);
    place({ x: -(FIT_MARGIN.left + (width - current.widthMm * scale) / 2) / scale, y: -FIT_MARGIN.top / scale, scale });
  }, [place]);
  useEffect(() => {
    const element = holder.current; if (!element) return;
    const observer = new ResizeObserver(entries => { const rect = entries[0].contentRect; if (rect.width && rect.height) setSize({ width: rect.width, height: rect.height }); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => { fit(); }, [fit, rackId, size.width, size.height]);
  useEffect(() => {
    const element = holder.current; if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) { const rect = element.getBoundingClientRect(); zoom(Math.exp(-event.deltaY * .002), { x: event.clientX - rect.left, y: event.clientY - rect.top }); }
      else place(old => ({ ...old, x: old.x + event.deltaX / old.scale, y: old.y + event.deltaY / old.scale }));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [place, zoom]);
  useEffect(() => {
    const release = () => { setSpace(false); };
    window.addEventListener("keyup", release); window.addEventListener("blur", release);
    return () => { window.removeEventListener("keyup", release); window.removeEventListener("blur", release); };
  }, []);
  useEffect(() => {
    const current = context.current;
    if (!focusPlacementId || !current.rack || gesture.current) return;
    const item = current.document.placements.find(value => value.id === focusPlacementId), profile = item && current.document.profiles.find(value => value.id === item.profileId);
    if (!item || !profile) return;
    const rect = placementRect(current.rack, item, profile), scale = Math.max(current.viewport.scale, BASE_SCALE);
    if (current.view === "rear" && ["zero-left", "zero-right"].includes(item.side)) rect.x = current.rack.widthMm - rect.x - rect.width;
    place({ x: rect.x + rect.width / 2 - current.size.width / scale / 2, y: rect.y + rect.height / 2 - current.size.height / scale / 2, scale });
  }, [focusPlacementId, place]);

  function world(clientX: number, clientY: number) {
    const rect = holder.current!.getBoundingClientRect(), current = context.current.viewport;
    return { x: current.x + (clientX - rect.left) / current.scale, y: current.y + (clientY - rect.top) / current.scale };
  }
  function dropPreview(profileId: string, clientX: number, clientY: number): Preview | null {
    const current = context.current, profile = current.document.profiles.find(item => item.id === profileId);
    if (!current.rack || !profile) return null;
    const point = world(clientX, clientY), physicalLeft = current.view === "rear" ? point.x >= current.rack.widthMm / 2 : point.x < current.rack.widthMm / 2;
    const side: MountSide = profile.units === 0 ? physicalLeft ? "zero-left" : "zero-right" : current.view;
    // 0-HE accessories store a valid inert HE index; their position uses zeroStartMm.
    const startUnit = profile.units === 0 ? 1 : rawStartUnitFromY(current.rack, point.y, profile.units);
    const key = `${current.rack.id}:${profileId}:${side}:${startUnit}`;
    if (dropCache.current?.document === current.document && dropCache.current.key === key) return dropCache.current.preview;
    const result = addPlacement(current.document, { profileId, rackId: current.rack.id, startUnit, side });
    const next = { document: result.document, ids: result.placementIds, accepted: result.accepted, issues: result.issues, profileId, startUnit, side };
    dropCache.current = { document: current.document, key, preview: next };
    return next;
  }
  function dragOver(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("application/x-edeco-rack-profile")) return;
    event.preventDefault();
    const profileId = context.current.dragProfileId || readRackDragProfile(event.dataTransfer.getData("application/x-edeco-rack-profile"));
    const next = profileId && dropPreview(profileId, event.clientX, event.clientY);
    // Keep the drop event deliverable even for a red ghost, so the root receives
    // the concrete rejection instead of a silent native-browser cancellation.
    setPreview(next || null); event.dataTransfer.dropEffect = "copy";
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setPreview(null);
    const profileId = readRackDragProfile(event.dataTransfer.getData("application/x-edeco-rack-profile") || event.dataTransfer.getData("text/plain"));
    if (!profileId) return;
    const next = dropPreview(profileId, event.clientX, event.clientY); if (!next) return;
    if (!next.accepted) { setStatus(next.issues.find(item => item.severity === "error")?.message || "Platzierung nicht möglich."); onError(next.issues); return; }
    onPlace(profileId, next.startUnit!, next.side!); setStatus("Gerät am HE-Raster eingefügt.");
  }
  function startDevice(event: PointerEvent<SVGGElement>, item: Placement) {
    if (event.button !== 0 || hand || space) return;
    event.stopPropagation(); holder.current?.focus();
    const add = event.ctrlKey || event.metaKey || event.shiftKey;
    if (add) { onSelect(item.id, true); return; }
    const ids = selectedIds.includes(item.id) ? selectedIds : [item.id];
    if (!selectedIds.includes(item.id)) onSelect(item.id, false);
    if (item.side.startsWith("zero")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { kind: "move", clientX: event.clientX, clientY: event.clientY, ids, moved: false, delta: 0 };
  }
  function startPan(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    event.preventDefault(); holder.current?.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { kind: "pan", clientX: event.clientX, clientY: event.clientY, viewport, moved: false }; setPanning(true);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const active = gesture.current; if (!active) return;
    const dx = event.clientX - active.clientX, dy = event.clientY - active.clientY;
    active.moved ||= Math.hypot(dx, dy) > 4;
    if (active.kind === "pan") { place({ ...active.viewport, x: active.viewport.x - dx / active.viewport.scale, y: active.viewport.y - dy / active.viewport.scale }); return; }
    if (!active.moved) return;
    const delta = -Math.round(dy / context.current.viewport.scale / HE_MM);
    if (delta === active.delta && preview) return;
    active.delta = delta;
    const result = movePlacements(context.current.document, active.ids, delta);
    setPreview({ document: result.document, ids: result.placementIds, accepted: result.accepted, issues: result.issues, delta });
  }
  function end() {
    const active = gesture.current; gesture.current = null; setPanning(false); setPreview(null);
    if (!active) return;
    if (active.kind === "pan") { if (!active.moved && !space && !hand) onSelect(null, false); return; }
    if (!active.moved || !active.delta) return;
    const result = movePlacements(context.current.document, active.ids, active.delta);
    if (result.accepted) { onMove(active.ids, active.delta); setStatus(`${active.ids.length} Gerät${active.ids.length === 1 ? "" : "e"} um ${Math.abs(active.delta)} HE verschoben.`); }
    else { setStatus(result.issues.find(item => item.severity === "error")?.message || "Verschiebung nicht möglich."); onError(result.issues); }
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (event.target instanceof Element && event.target.closest("button")) return;
    const command = event.ctrlKey || event.metaKey;
    if (event.code === "Space") { event.preventDefault(); setSpace(true); }
    if (event.key === "Escape") { gesture.current = null; setPreview(null); setPanning(false); return; }
    if (command && ["+", "=", "-", "0"].includes(event.key)) { event.preventDefault(); zoom(event.key === "-" ? 1 / 1.2 : 1.2, undefined, event.key === "0" ? BASE_SCALE : undefined); return; }
    if (command && ["c", "v"].includes(event.key.toLowerCase())) { event.preventDefault(); if (event.key.toLowerCase() === "c") onCopy?.(); else onPaste?.(); return; }
    if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length) { event.preventDefault(); onDelete?.(); return; }
    if ((event.key === "ArrowUp" || event.key === "ArrowDown") && selectedIds.length) {
      event.preventDefault(); const delta = event.key === "ArrowUp" ? 1 : -1, result = movePlacements(document, selectedIds, delta);
      if (result.accepted) onMove(selectedIds, delta); else { onError(result.issues); setStatus(result.issues.find(item => item.severity === "error")?.message || "Verschiebung nicht möglich."); }
    }
  }

  if (!rack) return <div className="rd-canvas-empty">Rack auswählen oder neu anlegen.</div>;
  const geometry = rackGeometry(rack), selected = new Set(selectedIds);
  const labelSize = drawingFont(HE_MM * .5, HE_MM * .58);
  const titleSize = drawingFont(geometry.railTopMm * .58, geometry.railTopMm * .72);
  const baseSize = drawingFont((rack.heightMm - geometry.railBottomMm) * .5, Math.max(12, (rack.heightMm - geometry.railBottomMm) * .68));
  const dimensionSize = drawingFont(22, 28);
  const cabinetFill = rackDrawingFill(rack.metadata?.drawingFill, "#cccccc");
  const cabinetStyle = { "--rd-cabinet-fill": cabinetFill, "--rd-cabinet-ink": rackDrawingInk(cabinetFill) } as CSSProperties;
  const unitLabelStep = Math.max(1, Math.ceil(labelSize * 1.35 / HE_MM));
  const previewItems = preview?.document.placements.filter(item => preview.ids.includes(item.id)) ?? [];
  const activePreview = previewItems[0], activeProfile = activePreview && profiles.get(activePreview.profileId);
  const previewText = activePreview && activeProfile ? activeProfile.units === 0 ? "0 HE · seitliches Zubehör" : `HE ${activePreview.startUnit}${activeProfile.units > 1 ? `–${activePreview.startUnit + activeProfile.units - 1}` : ""} · ${activeProfile.units} HE` : "";
  const selectedItem = visible.find(item => selected.has(item.id)), selectedProfile = selectedItem && profiles.get(selectedItem.profileId);
  const errors = preview?.issues.filter(issue => issue.severity === "error") ?? [];
  const fitPercentage = Math.round(viewport.scale / BASE_SCALE * 100);
  const cabinetPixelWidth = rack.widthMm * viewport.scale;
  const brandText = cabinetPixelWidth < 180 ? rack.label : `${rack.label} · ${rack.units} HE`;
  const brandLimit = Math.max(4, Math.floor((cabinetPixelWidth - 28) / Math.max(7.2, titleSize * viewport.scale * .62)));
  const visibleBrand = brandText.length > brandLimit ? `${brandText.slice(0, brandLimit - 1)}…` : brandText;
  const brandBox = textPlate(rack.widthMm / 2, geometry.railTopMm / 2, visibleBrand, titleSize, "middle");
  const baseText = cabinetPixelWidth < 190 ? "19″" : "19″ · 482,6 mm Einbauebene";
  const baseY = rack.heightMm - (rack.heightMm - geometry.railBottomMm) / 2;
  const baseBox = textPlate(rack.widthMm / 2, baseY, baseText, baseSize, "middle");
  const widthLabel = `${number(rack.widthMm)} mm`;
  const heightLabel = `${number(rack.heightMm)} mm${rack.heightMm * viewport.scale >= 190 ? " Gehäusehöhe" : ""}`;
  const widthY = rack.heightMm + Math.max(36, dimensionSize * 2.2);
  const widthBox = textPlate(rack.widthMm / 2, widthY, widthLabel, dimensionSize, "middle");
  const heightBox = textPlate(0, 0, heightLabel, dimensionSize, "middle");
  const showBrand = geometry.railTopMm * viewport.scale >= 20 && cabinetPixelWidth >= 70;
  const showBase = (rack.heightMm - geometry.railBottomMm) * viewport.scale >= 18 && cabinetPixelWidth >= 70;
  const dimensionLineX = rack.widthMm + 22 + 24 / viewport.scale;
  const dimensionTextX = rack.widthMm + 22 + 42 / viewport.scale;
  const dimensionLineY = rack.heightMm + 20 / viewport.scale;
  const drawDevice = (item: Placement, ghost = false) => {
    const profile = profiles.get(item.profileId); if (!profile) return null;
    const rect = placementRect(rack, item, profile), itemIssues = issues.filter(issue => issue.placementIds.includes(item.id)), tone = toneFor(itemIssues);
    if (view === "rear" && ["zero-left", "zero-right"].includes(item.side)) rect.x = rack.widthMm - rect.x - rect.width;
    const isSelected = selected.has(item.id), zero = item.side.startsWith("zero"), faded = !ghost && preview?.ids.includes(item.id), openPosition = zero && (item.zeroStartMm === null || item.zeroHeightMm === null);
    const captionSize = drawingFont(Math.min(26, rect.height * .46), rect.height * .55), captionText = item.label || profile.name;
    const captionLimit = Math.max(1, Math.floor((rect.width - 50) / (captionSize * .6)));
    const visibleCaption = captionText.length > captionLimit ? `${captionText.slice(0, captionLimit - 1)}…` : captionText;
    const captionBox = textPlate(rect.width / 2, rect.height / 2, visibleCaption, captionSize, "middle");
    const deviceFill = rackDrawingFill(profile.metadata?.drawingFill, "#ffffff");
    const deviceStyle = { "--rd-drawing-fill": deviceFill, "--rd-device-ink": rackDrawingInk(deviceFill) } as CSSProperties;
    return <g key={`${ghost ? "ghost-" : ""}${item.id}`} style={deviceStyle} className={`rd-rack-device rd-kind-${profile.kind}${isSelected ? " is-selected" : ""}${openPosition ? " is-position-open" : ""}${ghost ? ` is-ghost ${preview?.accepted ? "is-valid" : "is-invalid"}` : ""}${faded ? " is-moving" : ""}`} data-rack-placement={ghost ? undefined : item.id} data-placement-id={item.id} data-unit-start={item.startUnit} data-units={profile.units} data-side={item.side} data-tone={tone} transform={`translate(${rect.x} ${rect.y})`} role={ghost ? undefined : "button"} tabIndex={ghost ? undefined : 0} aria-label={ghost ? undefined : `${item.label || profile.name}, ${zero ? "0 HE Zubehör" : `HE ${item.startUnit} bis ${item.startUnit + profile.units - 1}`}, ${item.side === "rear" || item.side === "zero-rear" ? "Rückseite" : "Vorderseite"}${openPosition ? ", Lage offen" : ""}`} onPointerDown={ghost ? undefined : event => startDevice(event, item)} onKeyDown={ghost ? undefined : event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onSelect(item.id, event.ctrlKey || event.metaKey || event.shiftKey); } }}>
      <title>{`${item.label || profile.name}\n${zero ? `0 HE · HE-Felder bleiben frei${openPosition ? " · schematische Lage; Montagehöhe offen" : ""}` : `${profile.units} HE · HE ${item.startUnit}–${item.startUnit + profile.units - 1}`}\n${itemIssues.map(issue => issue.message).join("\n")}`}</title>
      <rect className="rd-device-body" x="1" y="1" width={Math.max(0, rect.width - 2)} height={Math.max(0, rect.height - 2)} rx={zero ? 8 : 3} />
      {!zero && <g className="rd-device-ears">{[8, rect.width - 8].flatMap(x => [Math.min(10, rect.height / 2), Math.max(rect.height - 10, rect.height / 2)].map((y, index) => <circle key={`${x}-${index}`} cx={x} cy={y} r="2.7" />))}</g>}
      <RackDeviceGlyph profile={profile} width={rect.width} height={rect.height} screenScale={viewport.scale} />
      {!profile.portCount && !zero && profile.kind !== "manager" && captionSize * viewport.scale >= 8 && <g><rect className="rd-text-plate rd-text-plate-device" x={captionBox.x} y={captionBox.y} width={captionBox.width} height={captionBox.height} rx={captionBox.rx} /><text className="rd-device-caption" x={rect.width / 2} y={rect.height / 2} dominantBaseline="central" fontSize={captionSize} textAnchor="middle">{visibleCaption}</text></g>}
      {isSelected && !ghost && <rect className="rd-selection-ring" x={-3} y={-3} width={rect.width + 6} height={rect.height + 6} rx="5" />}
      {ghost && <path className="rd-snap-cross" d="M-16 0H16M0-16V16" />}
    </g>;
  };

  return <section className="rd-canvas-panel" aria-label="Rack-Zeichnung">
    <div className="rd-canvas-caption"><span><ScanLine size={15} />{rack.label} · {view === "front" ? "Vorderansicht" : "Rückansicht"}</span><span>{rack.units} HE · {number(rack.widthMm)} × {number(rack.heightMm)} × {number(rack.depthMm)} mm</span></div>
    <div className={`rd-canvas-viewport${hand || space ? " is-hand" : ""}${panning ? " is-panning" : ""}`} ref={holder} tabIndex={0} data-document-zoom="true" data-rack-dropzone="true" data-rack-zoom={fitPercentage} onKeyDown={keyDown} onDragOver={dragOver} onDrop={drop} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreview(null); }} aria-label="Rack bearbeiten. Pfeiltasten verschieben Geräte um eine HE, Strg und Mausrad zoomen die Zeichnung.">
      <svg className="rd-rack-svg" viewBox={`${viewport.x} ${viewport.y} ${size.width / viewport.scale} ${size.height / viewport.scale}`} onPointerDown={startPan} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { gesture.current = null; setPreview(null); setPanning(false); }}>
        <defs><pattern id={`${unique}-grid`} width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r={.75 / viewport.scale} fill="currentColor" opacity=".1" /></pattern><pattern id={`${unique}-rail`} width="12" height="14.8167" patternUnits="userSpaceOnUse"><rect x="4" y="4" width="4" height="6" rx="1" fill={rackDrawingInk(cabinetFill)} opacity=".5" /></pattern></defs>
        <rect x={viewport.x} y={viewport.y} width={size.width / viewport.scale} height={size.height / viewport.scale} fill={`url(#${unique}-grid)`} />
        <g className="rd-cabinet" style={cabinetStyle}><rect className="rd-cabinet-shell" width={rack.widthMm} height={rack.heightMm} rx="15" /><rect className="rd-cabinet-interior" x="22" y="22" width={rack.widthMm - 44} height={rack.heightMm - 44} rx="8" />
          <rect className="rd-mount-plane" x={geometry.railLeftMm} y={geometry.railTopMm} width={geometry.railRightMm - geometry.railLeftMm} height={geometry.railHeightMm} />
          {[geometry.railLeftMm - 15, geometry.railRightMm + 3].map(x => <rect key={x} x={x} y={geometry.railTopMm} width="12" height={geometry.railHeightMm} fill={`url(#${unique}-rail)`} />)}
          {Array.from({ length: rack.units }, (_, index) => {
            const unit = rack.units - index, y = geometry.railTopMm + index * HE_MM;
            const showLabel = unit === 1 || index % unitLabelStep === 0 && unit > unitLabelStep;
            return <g key={unit} className={`rd-he-row${unit % 5 === 0 ? " is-fifth" : ""}`} data-he={unit}><rect x={geometry.railLeftMm} y={y} width={geometry.railRightMm - geometry.railLeftMm} height={HE_MM} /><line x1={geometry.railLeftMm - 4} x2={geometry.railRightMm + 4} y1={y} y2={y} />{showLabel && ([["end", -labelSize * .7], ["start", rack.widthMm + labelSize * .7]] as const).map(([anchor, x]) => { const box = textPlate(x, y + HE_MM / 2, String(unit), labelSize, anchor); return <g key={anchor}><rect className="rd-text-plate" x={box.x} y={box.y} width={box.width} height={box.height} rx={box.rx} /><text x={x} y={y + HE_MM / 2} dominantBaseline="central" textAnchor={anchor} fontSize={labelSize}>{unit}</text></g>; })}</g>;
          })}
          <line className="rd-rail-bottom" x1={geometry.railLeftMm - 4} x2={geometry.railRightMm + 4} y1={geometry.railBottomMm} y2={geometry.railBottomMm} />
          {showBrand && <g><rect className="rd-text-plate rd-text-plate-cabinet" x={brandBox.x} y={brandBox.y} width={brandBox.width} height={brandBox.height} rx={brandBox.rx} /><text className="rd-cabinet-brand" x={rack.widthMm / 2} y={geometry.railTopMm / 2} textAnchor="middle" dominantBaseline="central" fontSize={titleSize}><title>{rack.label} · {rack.units} HE</title>{visibleBrand}</text></g>}
          {showBase && <g><rect className="rd-text-plate rd-text-plate-cabinet" x={baseBox.x} y={baseBox.y} width={baseBox.width} height={baseBox.height} rx={baseBox.rx} /><text className="rd-cabinet-base" x={rack.widthMm / 2} y={baseY} textAnchor="middle" dominantBaseline="central" fontSize={baseSize}>{baseText}</text></g>}
        </g>
        <g className="rd-canvas-dimensions" fontSize={dimensionSize}><path d={`M0 ${dimensionLineY - 5 / viewport.scale}v${10 / viewport.scale}m0 ${-5 / viewport.scale}H${rack.widthMm}m0 ${-5 / viewport.scale}v${10 / viewport.scale}`} /><rect className="rd-text-plate" x={widthBox.x} y={widthBox.y} width={widthBox.width} height={widthBox.height} rx={widthBox.rx} /><text x={rack.widthMm / 2} y={widthY} textAnchor="middle" dominantBaseline="central">{widthLabel}</text><path d={`M${dimensionLineX - 5 / viewport.scale} 0h${10 / viewport.scale}m${-5 / viewport.scale} 0V${rack.heightMm}m${-5 / viewport.scale} 0h${10 / viewport.scale}`} /><g transform={`translate(${dimensionTextX} ${rack.heightMm / 2}) rotate(-90)`}><rect className="rd-text-plate" x={heightBox.x} y={heightBox.y} width={heightBox.width} height={heightBox.height} rx={heightBox.rx} /><text textAnchor="middle" dominantBaseline="central">{heightLabel}</text></g></g>
        {visible.map(item => drawDevice(item))}
        {previewItems.map(item => drawDevice(item, true))}
      </svg>
      {preview && <div className={`rd-drop-feedback${preview.accepted ? "" : " is-error"}`} role="status"><strong>{previewText || "Platzierung"}</strong><span>{preview.accepted ? "Am HE-Raster einrasten" : errors[0]?.message || "Position prüfen"}</span></div>}
    </div>
    <div className="rd-canvas-toolbar"><div className="rd-canvas-controls"><button type="button" className={hand ? "is-active" : ""} onClick={() => setHand(value => !value)} title={hand ? "Auswählen" : "Zeichnung verschieben"} aria-label={hand ? "Auswählen" : "Zeichnung verschieben"} aria-pressed={hand}>{hand ? <Hand size={16} /> : <MousePointer2 size={16} />}</button><span className="rd-controls-divider" /><button type="button" onClick={() => zoom(1 / 1.2)} aria-label="Zeichnung verkleinern"><Minus size={16} /></button><button type="button" className="rd-zoom-value" onClick={() => zoom(1, undefined, BASE_SCALE)} title="100 Prozent">{fitPercentage} %</button><button type="button" onClick={() => zoom(1.2)} aria-label="Zeichnung vergrössern"><Plus size={16} /></button><button type="button" onClick={fitWidth} aria-label="Rack auf Breite einpassen" title="Breite einpassen"><MoveHorizontal size={16} /></button><button type="button" onClick={fit} aria-label="Ganzes Rack einpassen" title="Ganzes Rack einpassen"><Maximize2 size={16} /></button></div></div>
    <div className="rd-canvas-status"><span>{selectedItem && selectedProfile ? `${selectedIds.length > 1 ? `${selectedIds.length} Geräte ausgewählt` : selectedItem.label || selectedProfile.name}${selectedProfile.units > 0 ? ` · HE ${selectedItem.startUnit}–${selectedItem.startUnit + selectedProfile.units - 1}` : " · 0 HE Zubehör"}` : "Gerät ziehen · Strg-Klick: Mehrfachauswahl"}</span><span>Strg + Mausrad: Zoom · Leertaste: Verschieben · Ansicht bleibt am Rack</span></div>
    <span className="rd-sr-only" role="status" aria-live="polite">{status}</span>
  </section>;
}
