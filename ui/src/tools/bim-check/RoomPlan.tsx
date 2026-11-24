import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { elementLabel, type ModelElement } from "./model";

import { roomLabelAnchor } from "./planLabel";

interface Props {
  rooms: ModelElement[];
  visibleIds: Set<string>;
  selected: string | null;
  onSelect: (id: string) => void;
}

function buildPlan(rooms: ModelElement[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const paths = rooms.flatMap(room => {
    const commands: string[] = [];
    for (const polygon of room.polygons) {
      for (const ring of polygon) {
        if (ring.length < 3) continue;
        for (const [index, [x, y]] of ring.entries()) {
          commands.push(`${index === 0 ? "M" : "L"}${x} ${-y}`);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, -y); maxY = Math.max(maxY, -y);
        }
        commands.push("Z");
      }
    }
    return commands.length ? [{ room, path: commands.join(" "), label: room.number ? roomLabelAnchor(room.polygons) : null }] : [];
  });
  if (!paths.length) return null;
  const spanX = Math.max(maxX - minX, 0.01), spanY = Math.max(maxY - minY, 0.01);
  const padding = Math.max(spanX, spanY) * 0.04;
  return { paths, x: minX - padding, y: minY - padding, w: spanX + 2 * padding, h: spanY + 2 * padding };
}

export default function RoomPlan({ rooms, visibleIds, selected, onSelect }: Props) {
  const plan = useMemo(() => buildPlan(rooms), [rooms]);
  const [pose, setPose] = useState({ zoom: 1, dx: 0, dy: 0 });
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number; unitPerPx: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  if (!plan) return <p className="bc-note">Für dieses Geschoss liegen keine darstellbaren Konturen vor.</p>;
  const { zoom, dx, dy } = pose;
  const w = plan.w / zoom, h = plan.h / zoom;
  const labelHeight = 13 / Math.min(size.w / w, size.h / h);
  const x = plan.x + (plan.w - w) / 2 + dx, y = plan.y + (plan.h - h) / 2 + dy;
  function start(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    suppressClick.current = false;
    const scale = svg.current?.getScreenCTM()?.a;
    if (scale) drag.current = { x: event.clientX, y: event.clientY, dx, dy, unitPerPx: 1 / scale, moved: false };
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const initial = drag.current;
    if (!initial || !event.buttons) return;
    const deltaX = event.clientX - initial.x, deltaY = event.clientY - initial.y;
    if (!initial.moved && Math.hypot(deltaX, deltaY) < 4) return;
    initial.moved = true; suppressClick.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPose(previous => ({ ...previous, dx: initial.dx - deltaX * initial.unitPerPx, dy: initial.dy - deltaY * initial.unitPerPx }));
  }
  function changeZoom(factor: number) {
    setPose(previous => ({ ...previous, zoom: Math.min(16, Math.max(1, previous.zoom * factor)) }));
  }
  return <div className="bc-plan">
    <svg ref={svg} role="group" aria-label="Grundriss mit auswählbaren Raumkonturen" viewBox={`${x} ${y} ${w} ${h}`}
      onPointerDown={start} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      {plan.paths.map(({ room, path }) => {
        const visible = visibleIds.has(room.id);
        return <path key={room.id} d={path} fillRule="evenodd" vectorEffect="non-scaling-stroke"
          className="bc-room-shape" data-active={selected === room.id} data-dim={!visible}
          role="button" aria-label={elementLabel(room)} aria-pressed={selected === room.id} aria-disabled={!visible} tabIndex={visible ? 0 : -1}
          onClick={() => { if (visible && !suppressClick.current) onSelect(room.id); }}
          onKeyDown={event => { if (visible && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(room.id); } }}>
          <title>{elementLabel(room)}</title>
        </path>;
      })}
      {plan.paths.map(({ room, label }) => {
        if (!label || !visibleIds.has(room.id) || labelHeight * Math.hypot(room.number.length, 1) > 1.8 * label.radius) return null;
        return <text key={room.id} className="bc-room-label" aria-hidden="true" x={label.x} y={label.y}
          fontSize={labelHeight} textAnchor="middle" dominantBaseline="central">{room.number}</text>;
      })}
    </svg>
    <div className="bc-plan-tools" aria-label="Grundriss zoomen">
      <button title="Verkleinern" aria-label="Grundriss verkleinern" disabled={zoom <= 1} onClick={() => changeZoom(0.8)}><Minus size={15} /></button>
      <span>{Math.round(zoom * 100)} %</span>
      <button title="Vergrössern" aria-label="Grundriss vergrössern" disabled={zoom >= 16} onClick={() => changeZoom(1.25)}><Plus size={15} /></button>
      <button title="Ganzes Geschoss einpassen" aria-label="Ganzes Geschoss einpassen" onClick={() => setPose({ zoom: 1, dx: 0, dy: 0 })}><Maximize2 size={15} /></button>
    </div>
  </div>;
}
