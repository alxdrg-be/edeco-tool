import { useCallback, useEffect, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent, PointerEvent } from 'react';
import { Hand, Maximize2, Minus, MousePointer2, Plus, ScanLine } from 'lucide-react';
import { profileSize, snapToRail } from './documentStore.ts';
import type { DeviceProfile, DistributionDocument, Issue } from './types.ts';

export const DRAG_TYPE = 'application/x-edeco-verteiler-profile';
interface Props {
  document: DistributionDocument; availableProfiles: DeviceProfile[]; svg: string; selected: string[]; issues: Issue[];
  focusId: string | null; focusToken: string; dragProfile: string | null; busy: boolean; viewLabel: string;
  onSelect: (id: string | null, multiple?: boolean) => void;
  onPlace: (id: string, x: number, y: number) => void;
  onMove: (ids: string[], x: number, y: number) => void;
  onDelete: () => void; onCopy: () => void;
}
interface Bounds { x: number; y: number; width: number; height: number; ox: number; oy: number }
interface Viewport { x: number; y: number; scale: number }
type Gesture = { kind: 'pan'; sx: number; sy: number; x: number; y: number } | { kind: 'move'; ids: string[]; sx: number; sy: number; dx: number; dy: number };
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export default function VerteilerCanvas({ document, availableProfiles, svg, selected, issues, focusId, focusToken, dragProfile, busy, viewLabel, onSelect, onPlace, onMove, onDelete, onCopy }: Props) {
  const host = useRef<HTMLDivElement>(null), art = useRef<HTMLDivElement>(null), gesture = useRef<Gesture | null>(null);
  const [size, setSize] = useState({ width: 680, height: 650 });
  const [bounds, setBounds] = useState<Bounds>({ x: 0, y: 0, width: document.cabinet.width_mm + 100, height: document.cabinet.height_mm + 150, ox: 50, oy: 50 });
  const [viewport, setViewport] = useState<Viewport>({ x: 20, y: 20, scale: .65 });
  const [hand, setHand] = useState(false), [space, setSpace] = useState(false);
  const [ghost, setGhost] = useState<{ ids?: string[]; profile?: string; x: number; y: number } | null>(null);
  const latest = useRef({ bounds, size, viewport, document }); latest.current = { bounds, size, viewport, document };
  const fit = useCallback((widthOnly = false) => {
    const { bounds: b, size: s } = latest.current;
    const usableHeight = Math.max(1, s.height - 90);
    const scale = clamp(widthOnly ? (s.width - 40) / b.width : Math.min((s.width - 40) / b.width, usableHeight / b.height), .025, 3);
    setViewport({ scale, x: (s.width - b.width * scale) / 2, y: widthOnly ? 20 : 20 + (usableHeight - b.height * scale) / 2 });
  }, []);
  const zoom = useCallback((factor: number, at?: { x: number; y: number }) => {
    const { size: s, bounds: b } = latest.current;
    const p = at ?? { x: s.width / 2, y: s.height / 2 };
    setViewport(old => {
      const scale = clamp(old.scale * factor, .025, 4);
      return { scale, x: clamp(p.x - (p.x - old.x) * scale / old.scale, -b.width * scale + 50, s.width - 50),
        y: clamp(p.y - (p.y - old.y) * scale / old.scale, -b.height * scale + 50, s.height - 50) };
    });
  }, []);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const observer = new ResizeObserver(entries => { const r = entries[0].contentRect; if (r.width && r.height) setSize({ width: r.width, height: r.height }); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const root = art.current?.querySelector('svg'); if (!root) return;
    const box = root.viewBox.baseVal;
    if (box.width > 0 && box.height > 0) setBounds({ x: box.x, y: box.y, width: box.width, height: box.height,
      ox: Number(root.dataset.originX ?? root.dataset.innerX ?? 50), oy: Number(root.dataset.originY ?? root.dataset.innerY ?? 50) });
  }, [svg]);
  useEffect(() => { fit(); }, [document.id, bounds.width, bounds.height, size.width, size.height, fit]);
  useEffect(() => {
    if (!focusId) return;
    const placement = document.cabinet.placements.find(p => p.id === focusId);
    const profile = document.profiles.find(p => p.id === placement?.profile_id);
    if (!placement || !profile) return;
    const b = profileSize(profile, placement.rotation), scale = clamp(Math.min(1.2, size.width / (b.width + 160), size.height / (b.height + 160)), .1, 2);
    setViewport({ scale, x: size.width / 2 - (placement.x_mm + bounds.ox - bounds.x + b.width / 2) * scale,
      y: size.height / 2 - (placement.y_mm + bounds.oy - bounds.y + b.height / 2) * scale });
  }, [focusId, focusToken]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || !event.shiftKey) {
        event.preventDefault(); event.stopPropagation();
        const box = element.getBoundingClientRect(); zoom(Math.exp(-event.deltaY * .0015), { x: event.clientX - box.left, y: event.clientY - box.top });
      } else { event.preventDefault(); setViewport(old => ({ ...old, x: old.x - event.deltaY })); }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [zoom]);
  function point(clientX: number, clientY: number) {
    const root = art.current?.querySelector('svg');
    const matrix = root?.getScreenCTM();
    if (!root || !matrix) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: p.x - bounds.ox, y: p.y - bounds.oy };
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (busy || event.button > 1 || (event.target as Element).closest('.vd-canvas-controls')) return;
    host.current?.focus();
    if (hand || space || event.button === 1) {
      gesture.current = { kind: 'pan', sx: event.clientX, sy: event.clientY, x: viewport.x, y: viewport.y };
    } else {
      const id = (event.target as Element).closest('[data-placement-id]')?.getAttribute('data-placement-id');
      if (!id) { onSelect(null); return; }
      const p = point(event.clientX, event.clientY); if (!p) return;
      const ids = selected.includes(id) ? selected : event.shiftKey ? [...selected, id] : [id];
      onSelect(id, event.shiftKey); gesture.current = { kind: 'move', ids, sx: p.x, sy: p.y, dx: 0, dy: 0 };
    }
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const g = gesture.current; if (!g) return;
    if (g.kind === 'pan') {
      setViewport(old => ({ ...old, x: clamp(g.x + event.clientX - g.sx, -bounds.width * old.scale + 50, size.width - 50), y: clamp(g.y + event.clientY - g.sy, -bounds.height * old.scale + 50, size.height - 50) }));
    } else {
      const p = point(event.clientX, event.clientY); if (!p) return;
      g.dx = p.x - g.sx; g.dy = p.y - g.sy;
      setGhost({ ids: g.ids, x: g.dx, y: g.dy });
    }
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>, cancel = false) {
    const g = gesture.current; gesture.current = null; setGhost(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && g?.kind === 'move' && (Math.abs(g.dx) > .5 || Math.abs(g.dy) > .5)) onMove(g.ids, g.dx, g.dy);
  }
  function readProfile(event: DragEvent) {
    const id = event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData('text/plain') || dragProfile;
    return id && id.length < 121 && availableProfiles.some(p => p.id === id) ? id : null;
  }
  function dragOver(event: DragEvent<HTMLDivElement>) {
    if (busy) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
    const p = point(event.clientX, event.clientY), profile = availableProfiles.find(item => item.id === dragProfile);
    if (p && profile) { const snap = snapToRail(document, profile, p.x, p.y); setGhost({ profile: profile.id, x: snap.x_mm, y: snap.y_mm }); }
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); setGhost(null);
    const id = readProfile(event), p = point(event.clientX, event.clientY);
    if (id && p && !busy) onPlace(id, p.x, p.y);
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.target as Element).closest('button,input,select,textarea')) return;
    if (event.code === 'Space') { event.preventDefault(); setSpace(true); return; }
    if (event.key === 'Escape') { gesture.current = null; setGhost(null); return; }
    if (!selected.length || busy) return;
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); onDelete(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); onCopy(); }
    const p = document.cabinet.placements.find(item => item.id === selected[0]);
    const rail = document.cabinet.rails.find(item => item.id === p?.rail_id), step = (rail?.te_pitch_mm ?? 1) * (event.shiftKey ? 10 : 1);
    const rails = [...document.cabinet.rails].sort((a, b) => a.y_mm - b.y_mm), index = rails.findIndex(item => item.id === rail?.id);
    const above = rails[index - 1], below = rails[index + 1];
    const delta = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, rail ? (above?.y_mm ?? rail.y_mm) - rail.y_mm : -step], ArrowDown: [0, rail ? (below?.y_mm ?? rail.y_mm) - rail.y_mm : step] } as Record<string, number[]>)[event.key];
    if (delta) { event.preventDefault(); onMove(selected, delta[0], delta[1]); }
  }
  const errors = new Set(issues.filter(issue => issue.severity === 'error').map(issue => issue.target_id));
  const active = document.cabinet.placements.filter(p => p.status !== 'removed');
  function selectionRect(id: string, dx = 0, dy = 0, preview = false) {
    const p = active.find(item => item.id === id), profile = document.profiles.find(item => item.id === p?.profile_id);
    if (!p || !profile) return null;
    const rect = profileSize(profile, p.rotation);
    return <rect key={`${preview ? 'ghost' : 'selected'}-${id}`} x={bounds.ox + p.x_mm + dx} y={bounds.oy + p.y_mm + dy} width={rect.width} height={rect.height}
      className={preview ? 'vd-ghost-rect' : errors.has(id) ? 'vd-error-rect' : 'vd-selected-rect'} vectorEffect="non-scaling-stroke" />;
  }
  const ghostProfile = availableProfiles.find(p => p.id === ghost?.profile);
  return <div className={`vd-canvas ${hand || space ? 'vd-hand' : ''}`} ref={host} tabIndex={0} aria-label={`Verteiler-Zeichenfläche · ${viewLabel}`} aria-busy={busy}
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => pointerUp(event)} onPointerCancel={event => pointerUp(event, true)}
    onKeyDown={keyDown} onKeyUp={event => { if (event.code === 'Space') setSpace(false); }} onBlur={() => setSpace(false)} onDragOver={dragOver} onDrop={drop} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setGhost(null); }}>
    <div className="vd-canvas-art" ref={art} style={{ width: bounds.width * viewport.scale, height: bounds.height * viewport.scale, transform: `translate(${viewport.x}px,${viewport.y}px)` }}>
      <div className="vd-server-svg" dangerouslySetInnerHTML={{ __html: svg }} />
      <svg className="vd-canvas-overlay" viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} aria-hidden="true">
        {[...errors].filter(id => !selected.includes(id)).map(id => selectionRect(id))}
        {[...document.cabinet.fields, ...document.cabinet.covers, ...document.cabinet.reserved_zones].filter(item => errors.has(item.id)).map(item => <rect key={`issue-${item.id}`} x={bounds.ox + item.x_mm} y={bounds.oy + item.y_mm} width={item.width_mm} height={item.height_mm} className="vd-error-rect" vectorEffect="non-scaling-stroke" />)}
        {document.cabinet.rails.filter(item => errors.has(item.id)).map(item => <line key={`issue-${item.id}`} x1={bounds.ox + item.x_mm} x2={bounds.ox + item.x_mm + item.length_mm} y1={bounds.oy + item.y_mm} y2={bounds.oy + item.y_mm} className="vd-error-rect" vectorEffect="non-scaling-stroke" />)}
        {selected.map(id => selectionRect(id))}
        {ghost?.ids?.map(id => selectionRect(id, ghost.x, ghost.y, true))}
        {ghost && ghostProfile && <rect x={bounds.ox + ghost.x} y={bounds.oy + ghost.y} width={ghostProfile.width_mm} height={ghostProfile.height_mm} className="vd-ghost-rect" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
    {!svg && <div className="vd-canvas-empty">Zeichnung wird aufgebaut …</div>}
    {busy && <span className="vd-rendering" role="status">Zeichnung aktualisieren …</span>}
    <div className="vd-canvas-controls" role="group" aria-label={`Ansicht und Zoom · ${viewLabel}`} onPointerDown={event => event.stopPropagation()}>
      <button type="button" onClick={() => setHand(false)} aria-label="Auswählen" aria-pressed={!hand}><MousePointer2 size={16} /></button>
      <button type="button" onClick={() => setHand(!hand)} aria-label="Handmodus" aria-pressed={hand}><Hand size={16} /></button>
      <button type="button" onClick={() => zoom(1 / 1.2)} aria-label="Zeichnung verkleinern"><Minus size={16} /></button>
      <span>{Math.round(viewport.scale * 100)} %</span>
      <button type="button" onClick={() => zoom(1.2)} aria-label="Zeichnung vergrössern"><Plus size={16} /></button>
      <button type="button" onClick={() => fit(true)}><ScanLine size={15} /> Breite</button>
      <button type="button" onClick={() => fit()}><Maximize2 size={15} /> Ganzes Blatt</button>
    </div>
  </div>;
}
