import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { clampLegendZoom, fitLegendZoom, LEGEND_ZOOM_BASE } from "./legendViewport";

export function useLegendViewport(canvas: RefObject<HTMLDivElement | null>, paper: RefObject<SVGSVGElement | null>, width: number, height: number, enabled: boolean) {
  const [zoom, setZoom] = useState(LEGEND_ZOOM_BASE);
  const [hand, setHand] = useState(false);
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  const [fit, setFit] = useState<"width" | "page" | null>(null);
  const current = useRef({ zoom, hand, space, width, height });
  current.current = { zoom, hand, space, width, height };
  const anchor = useRef<{ x: number; y: number; worldX: number; worldY: number; zoom: number } | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const suppressClick = useRef(0);

  const zoomTo = useCallback((value: number, point?: { x: number; y: number }) => {
    const holder = canvas.current, sheet = paper.current;
    const next = clampLegendZoom(value);
    if (!holder || !sheet) { setZoom(next); return; }
    const box = holder.getBoundingClientRect(), old = sheet.getBoundingClientRect();
    const at = point ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const pending = anchor.current;
    const world = pending
      ? { x: pending.worldX + (at.x - pending.x) / pending.zoom, y: pending.worldY + (at.y - pending.y) / pending.zoom }
      : { x: (at.x - old.left) * sheet.viewBox.baseVal.width / old.width, y: (at.y - old.top) * sheet.viewBox.baseVal.height / old.height };
    anchor.current = { x: at.x, y: at.y, worldX: world.x, worldY: world.y, zoom: next };
    current.current.zoom = next;
    setFit(null); setZoom(next);
  }, [canvas, paper]);

  // React may commit a native wheel update after the next animation frame.
  // Adjust only after the new SVG dimensions exist, so scroll bounds do not
  // clamp against the old, smaller sheet and lose the pointer anchor.
  useLayoutEffect(() => {
    const pending = anchor.current, holder = canvas.current, sheet = paper.current;
    if (!pending || !holder || !sheet || pending.zoom !== zoom) return;
    anchor.current = null;
    const surface = sheet.getBoundingClientRect();
    holder.scrollLeft += surface.left + pending.worldX * zoom - pending.x;
    holder.scrollTop += surface.top + pending.worldY * zoom - pending.y;
  }, [canvas, paper, zoom]);

  const fitView = useCallback((mode: "width" | "page") => {
    const holder = canvas.current;
    if (!holder) return;
    const css = getComputedStyle(holder);
    const availableWidth = holder.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    const availableHeight = holder.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
    const next = fitLegendZoom(current.current.width, current.current.height, availableWidth, availableHeight, mode);
    anchor.current = null;
    setZoom(next); current.current.zoom = next; setFit(mode);
    holder.scrollLeft = 0; holder.scrollTop = 0;
  }, [canvas]);

  useEffect(() => {
    const holder = canvas.current;
    if (!enabled || !holder) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomTo(current.current.zoom * Math.exp(-event.deltaY * 0.002), { x: event.clientX, y: event.clientY });
    };
    const down = (event: KeyboardEvent) => {
      if (!holder.contains(event.target as Node) || (event.target as Element).closest("input,textarea,select,[contenteditable='true']")) return;
      if (event.code === "Space") { event.preventDefault(); setSpace(true); current.current.space = true; }
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (["+", "=", "-", "0"].includes(event.key)) {
        event.preventDefault();
        zoomTo(event.key === "0" ? LEGEND_ZOOM_BASE : current.current.zoom * (event.key === "-" ? 1 / 1.2 : 1.2));
      }
    };
    const release = (event: KeyboardEvent) => { if (event.code === "Space") { setSpace(false); current.current.space = false; } };
    const blur = () => { drag.current = null; setPanning(false); setSpace(false); current.current.space = false; };
    holder.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", down); window.addEventListener("keyup", release); window.addEventListener("blur", blur);
    return () => { holder.removeEventListener("wheel", wheel); window.removeEventListener("keydown", down); window.removeEventListener("keyup", release); window.removeEventListener("blur", blur); };
  }, [canvas, enabled, zoomTo]);

  useEffect(() => {
    const holder = canvas.current;
    if (!holder || !enabled || !fit) return;
    const observer = new ResizeObserver(() => fitView(fit));
    observer.observe(holder); return () => observer.disconnect();
  }, [canvas, enabled, fit, fitView, width, height]);

  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const holder = event.currentTarget;
    holder.focus({ preventScroll: true });
    if (event.button !== 0 || !(current.current.hand || current.current.space)) return;
    event.preventDefault(); event.stopPropagation();
    holder.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: holder.scrollLeft, top: holder.scrollTop };
    setPanning(true);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const value = drag.current;
    if (!value || value.id !== event.pointerId) return;
    event.preventDefault();
    event.currentTarget.scrollLeft = value.left - (event.clientX - value.x);
    event.currentTarget.scrollTop = value.top - (event.clientY - value.y);
    suppressClick.current = Date.now() + 300;
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null; setPanning(false);
  };
  const click = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (current.current.hand || current.current.space || Date.now() < suppressClick.current) { event.preventDefault(); event.stopPropagation(); }
  };
  return { zoom, zoomTo, fitView, hand, setHand, space, panning,
    canvasEvents: { onPointerDownCapture: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerCancel: pointerUp, onClickCapture: click } };
}
